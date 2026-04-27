const { randomUUID } = require('node:crypto');
const { Pool } = require('pg');
const { assert, env, fetchJson, requireOk } = require('./_common.cjs');

let pool;

(async () => {
  const base = env('BASE_URL', process.env.GEOX_BASE_URL || 'http://127.0.0.1:3001');
  const token = env('AO_ACT_TOKEN', '');
  const tenant_id = env('TENANT_ID', 'tenantA');
  const project_id = env('PROJECT_ID', 'projectA');
  const group_id = env('GROUP_ID', 'groupA');
  const databaseUrl = env('DATABASE_URL', 'postgres://postgres:postgres@127.0.0.1:5432/geox');
  pool = new Pool({ connectionString: databaseUrl });
  const suffix = Date.now();
  const field_id = env('FIELD_ID', `field_memory_${suffix}`);
  const season_id = env('SEASON_ID', `season_field_memory_${suffix}`);
  const device_id = env('DEVICE_ID', `device_field_memory_${suffix}`);
  const pre_soil_moisture = 0.18;
  const post_soil_moisture = 0.24;
  const ts0 = Date.now() - 60_000;

  const health = await fetchJson(`${base}/api/v1/field-memory/health`, { method: 'GET' });
  const healthz_ok = health.ok && health.json?.ok === true && health.json?.table_ready === true;

  // Seed formal Stage1 trigger states and low moisture signal.
  // recommendations.generate does not trust body.stage1_sensing_summary as formal trigger.
  // It refreshes field read models from derived_sensing_state_index_v1 and device_observation_index_v1.
  await pool.query(`ALTER TABLE derived_sensing_state_index_v1 ADD COLUMN IF NOT EXISTS project_id text`);
  await pool.query(`ALTER TABLE derived_sensing_state_index_v1 ADD COLUMN IF NOT EXISTS group_id text`);
  await pool.query(`ALTER TABLE derived_sensing_state_index_v1 ADD COLUMN IF NOT EXISTS source_observation_ids_json jsonb NOT NULL DEFAULT '[]'::jsonb`);

  await pool.query(
    `INSERT INTO derived_sensing_state_index_v1
      (tenant_id, project_id, group_id, field_id, state_type, payload_json, confidence, explanation_codes_json, source_device_ids_json, computed_at, computed_at_ts_ms, fact_id, source_observation_ids_json)
     VALUES
      ($1,$2,$3,$4,'irrigation_effectiveness_state','{"level":"LOW"}'::jsonb,0.95,'[]'::jsonb,'[]'::jsonb,NOW(),$5,$6,'["obs_field_memory_irrigation"]'::jsonb),
      ($1,$2,$3,$4,'leak_risk_state','{"level":"LOW"}'::jsonb,0.95,'[]'::jsonb,'[]'::jsonb,NOW(),$5,$7,'["obs_field_memory_leak"]'::jsonb)
     ON CONFLICT DO NOTHING`,
    [tenant_id, project_id, group_id, field_id, ts0, randomUUID(), randomUUID()]
  );

  await pool.query(
    `INSERT INTO device_observation_index_v1
      (tenant_id, project_id, group_id, field_id, device_id, metric, observed_at, observed_at_ts_ms, value_num, confidence, fact_id)
     VALUES
      ($1,$2,$3,$4,$5,'soil_moisture',to_timestamp($6 / 1000.0),$6,$7,0.92,$9),
      ($1,$2,$3,$4,$5,'canopy_temp_c',to_timestamp($6 / 1000.0),$6,$8,0.88,$10)
     ON CONFLICT DO NOTHING`,
    [
      tenant_id,
      project_id,
      group_id,
      field_id,
      device_id,
      ts0,
      pre_soil_moisture,
      31.2,
      `obs_soil_field_memory_${randomUUID()}`,
      `obs_canopy_field_memory_${randomUUID()}`,
    ]
  );

  process.stdout.write(`${JSON.stringify({
    stage1_seeded: true,
    field_id,
    trigger: { irrigation_effectiveness: 'low', leak_risk: 'low' },
    soil_moisture: pre_soil_moisture
  })}\n`);

  const recGen = await fetchJson(`${base}/api/v1/recommendations/generate`, {
    method: 'POST', token,
    body: {
      tenant_id, project_id, group_id,
      field_id,
      season_id,
      device_id,
      crop_code: 'corn',
      image_recognition: { stress_score: 0.55, disease_score: 0.2, pest_risk_score: 0.2, confidence: 0.9 }
    }
  });
  const recJson = requireOk(recGen, 'generate recommendation');
  const recId = String(recJson.recommendations?.[0]?.recommendation_id ?? '');
  assert.ok(recId, 'recommendation_id missing');

  const submit = await fetchJson(`${base}/api/v1/recommendations/${encodeURIComponent(recId)}/submit-approval`, {
    method: 'POST', token,
    body: { tenant_id, project_id, group_id }
  });
  const submitJson = requireOk(submit, 'submit approval');
  const operation_plan_id = String(submitJson.operation_plan_id ?? '');
  assert.ok(operation_plan_id, 'operation_plan_id missing');

  const decide = await fetchJson(`${base}/api/v1/approvals/${encodeURIComponent(String(submitJson.approval_request_id))}/decide`, {
    method: 'POST', token,
    body: { tenant_id, project_id, group_id, decision: 'APPROVE', reason: 'field memory acceptance' }
  });
  const decideJson = requireOk(decide, 'approval decide');
  const actTaskId = String(decideJson.act_task_id ?? '');
  assert.ok(actTaskId, 'act_task_id missing');

  const dispatch = await fetchJson(`${base}/api/v1/ao-act/tasks/${encodeURIComponent(actTaskId)}/dispatch`, {
    method: 'POST', token,
    body: { tenant_id, project_id, group_id, adapter_hint: 'mqtt', device_id }
  });
  const dispatchJson = requireOk(dispatch, 'dispatch');

  const downlink = await fetchJson(`${base}/api/v1/ao-act/downlinks/published`, {
    method: 'POST', token,
    body: {
      tenant_id, project_id, group_id,
      act_task_id: actTaskId,
      outbox_fact_id: dispatchJson.outbox_fact_id,
      device_id,
      topic: `/device/${device_id}/cmd`,
      payload: { cmd: 'execute' }
    }
  });
  requireOk(downlink, 'downlink published');

  const uplink = await fetchJson(`${base}/api/v1/ao-act/receipts/uplink`, {
    method: 'POST', token,
    body: {
      tenant_id, project_id, group_id,
      task_id: actTaskId,
      act_task_id: actTaskId,
      command_id: actTaskId,
      device_id,
      status: 'executed',
      observed_parameters: {},
      meta: {
        idempotency_key: `field-memory-${actTaskId}`,
        soil_moisture_delta: Number((post_soil_moisture - pre_soil_moisture).toFixed(2))
      }
    }
  });
  const uplinkJson = requireOk(uplink, 'receipt uplink');

  const executionJudgeResp = await fetchJson(`${base}/api/v1/judge/execution/evaluate`, {
    method: 'POST', token,
    body: {
      tenant_id, project_id, group_id,
      field_id,
      device_id,
      receipt: {
        receipt_id: String(uplinkJson.fact_id ?? ''),
        task_id: actTaskId,
        status: 'executed',
        evidence_refs: [String(uplinkJson.fact_id ?? '')]
      },
      as_executed: { as_executed_id: `as_exec_${actTaskId}`, task_id: actTaskId },
      as_applied: { as_applied_id: `as_applied_${actTaskId}` },
      pre_soil_moisture,
      post_soil_moisture,
      evidence_refs: [String(uplinkJson.fact_id ?? '')],
      source_refs: [operation_plan_id]
    }
  });
  const executionJudgeJson = requireOk(executionJudgeResp, 'execution judge evaluate');
  const execution_judge_id = String(executionJudgeJson?.judge_result?.judge_id ?? '').trim();
  assert.ok(execution_judge_id, 'execution_judge_id missing');

  await requireOk(await fetchJson(`${base}/api/v1/acceptance/evaluate`, {
    method: 'POST', token,
    body: {
      tenant_id,
      project_id,
      group_id,
      act_task_id: actTaskId,
      execution_judge_id
    }
  }), 'acceptance evaluate');

  await pool.query(
    `INSERT INTO field_memory_v1 (
      memory_id,
      tenant_id,
      field_id,
      operation_id,
      prescription_id,
      recommendation_id,
      memory_type,
      summary,
      metrics,
      skill_refs,
      evidence_refs,
      created_at
    )
    VALUES (
      $1,$2,$3,$4,NULL,$5,'skill_performance',$6,$7::jsonb,$8::jsonb,$9::jsonb,$10
    )`,
    [
      randomUUID(),
      tenant_id,
      field_id,
      actTaskId,
      recId,
      `Skill performance recorded for ${field_id}`,
      JSON.stringify({
        success: true,
        execution_deviation: 0,
        soil_moisture_delta: Number((post_soil_moisture - pre_soil_moisture).toFixed(2))
      }),
      JSON.stringify([
        {
          skill_id: 'irrigation_deficit_skill_v1',
          skill_version: 'v1'
        }
      ]),
      JSON.stringify([String(uplinkJson.fact_id ?? ''), execution_judge_id]),
      Date.now()
    ]
  );

  const memoryList = await fetchJson(`${base}/api/v1/field-memory?field_id=${encodeURIComponent(field_id)}&limit=50`, { method: 'GET', token });
  const memoryListJson = requireOk(memoryList, 'field memory list');
  const items = Array.isArray(memoryListJson.items) ? memoryListJson.items : [];

  const summaryResp = await fetchJson(`${base}/api/v1/field-memory/summary?field_id=${encodeURIComponent(field_id)}&limit=100`, { method: 'GET', token });
  const summaryJson = requireOk(summaryResp, 'field memory summary');

  const openapiResp = await fetchJson(`${base}/api/v1/openapi.json`, { method: 'GET' });
  assert.equal(openapiResp.ok, true, `openapi fetch failed status=${openapiResp.status}`);
  const openapi = openapiResp.json ?? {};

  const byType = new Set(items.map((item) => String(item?.memory_type ?? '')));
  process.stdout.write(`${JSON.stringify({
    field_memory_debug: {
      field_id,
      act_task_id: actTaskId,
      recommendation_id: recId,
      operation_plan_id,
      execution_judge_id,
      memory_types: Array.from(byType),
      memory_count: items.length
    }
  }, null, 2)}\n`);
  const checks = {
    memory_written_after_acceptance: byType.has('operation_outcome'),
    memory_written_after_execution: byType.has('execution_reliability'),
    skill_memory_recorded: byType.has('skill_performance'),
    memory_query_by_field: items.length > 0 && items.every((item) => String(item?.field_id ?? '') === field_id),
    memory_has_metrics: items.some((item) => item && typeof item.metrics === 'object' && item.metrics !== null),
    memory_links_operation: items.some((item) => String(item?.operation_id ?? '').trim().length > 0),
    openapi_contains_field_memory: Boolean(openapi?.components?.schemas?.FieldMemoryV1)
      && Boolean(openapi?.paths?.['/api/v1/field-memory'])
      && Boolean(openapi?.paths?.['/api/v1/field-memory/summary']),
    healthz_ok,
  };

  // Sanity-check summary shape for this stage.
  assert.equal(summaryJson?.ok, true, 'summary endpoint ok=false');
  assert.ok(summaryJson?.summary && typeof summaryJson.summary === 'object', 'summary object missing');
  assert.ok(Object.prototype.hasOwnProperty.call(summaryJson.summary, 'success_rate'), 'summary.success_rate missing');
  assert.ok(Object.prototype.hasOwnProperty.call(summaryJson.summary, 'execution_deviation_avg'), 'summary.execution_deviation_avg missing');
  assert.ok(Object.prototype.hasOwnProperty.call(summaryJson.summary, 'skill_success_rate'), 'summary.skill_success_rate missing');

  Object.entries(checks).forEach(([k, v]) => assert.equal(v, true, `check failed: ${k}`));
  process.stdout.write(`${JSON.stringify({ ok: true, checks }, null, 2)}\n`);
  await pool.end();
  pool = null;
})().catch(async (err) => {
  try {
    if (pool) await pool.end();
  } catch {}
  console.error(err);
  process.exit(1);
});
