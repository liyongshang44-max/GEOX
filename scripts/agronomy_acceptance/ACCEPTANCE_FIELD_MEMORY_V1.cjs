const { randomUUID } = require('node:crypto');
const { Pool } = require('pg');
const { assert, env, fetchJson, requireOk } = require('./_common.cjs');

let pool;

(async () => {
  const base = env('BASE_URL', process.env.GEOX_BASE_URL || 'http://127.0.0.1:3001');
  const adminToken = env('ADMIN_TOKEN', 'admin_token');
  const approverToken = env('APPROVER_TOKEN', 'approver_token');
  const operatorToken = env('OPERATOR_TOKEN', 'operator_token');
  const executorToken = env('EXECUTOR_TOKEN', 'executor_token');
  const tenant_id = env('TENANT_ID', 'tenantA');
  const project_id = env('PROJECT_ID', 'projectA');
  const group_id = env('GROUP_ID', 'groupA');
  const databaseUrl = env('DATABASE_URL', 'postgres://landos:landos_pwd@127.0.0.1:5433/landos');
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
    method: 'POST', token: adminToken,
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
    method: 'POST', token: adminToken,
    body: { tenant_id, project_id, group_id }
  });
  const submitJson = requireOk(submit, 'submit approval');
  const operation_plan_id = String(submitJson.operation_plan_id ?? '');
  assert.ok(operation_plan_id, 'operation_plan_id missing');

  const decide = await fetchJson(`${base}/api/v1/approvals/approve`, {
    method: 'POST',
    token: approverToken,
    body: {
      request_id: String(submitJson.approval_request_id),
      tenant_id,
      project_id,
      group_id,
      decision: 'APPROVE',
      reason: 'field memory acceptance'
    }
  });
  requireOk(decide, 'approval decide');

  await pool.query(
    `UPDATE fail_safe_event_v1
        SET status='RESOLVED',
            resolved_at=$5,
            resolved_by_actor_id='acceptance_cleanup',
            resolved_by_token_id='acceptance_cleanup',
            resolution_note='cleanup before field memory acceptance'
      WHERE tenant_id=$1
        AND project_id=$2
        AND group_id=$3
        AND device_id=$4
        AND status='OPEN'`,
    [tenant_id, project_id, group_id, device_id, Date.now()]
  );

  await pool.query(
    `DELETE FROM device_status_index_v1
     WHERE tenant_id=$1
       AND project_id=$2
       AND group_id=$3
       AND device_id=$4`,
    [tenant_id, project_id, group_id, device_id]
  );

  await pool.query(
    `INSERT INTO device_status_index_v1
      (tenant_id, project_id, group_id, device_id, status, last_heartbeat_ts_ms, last_telemetry_ts_ms, updated_ts_ms)
     VALUES
      ($1,$2,$3,$4,'ONLINE',$5,$5,$5)`,
    [tenant_id, project_id, group_id, device_id, Date.now()]
  );

  const taskResp = await fetchJson(`${base}/api/v1/actions/task`, {
    method: 'POST',
    token: operatorToken,
    body: {
      tenant_id,
      project_id,
      group_id,
      operation_plan_id,
      approval_request_id: String(submitJson.approval_request_id),
      field_id,
      season_id,
      device_id,
      issuer: { kind: 'human', id: 'field_memory_acceptance', namespace: 'qa' },
      action_type: 'IRRIGATE',
      target: { kind: 'field', ref: field_id },
      time_window: { start_ts: ts0, end_ts: ts0 + 3600_000 },
      parameter_schema: {
        keys: [
          { name: 'duration_sec', type: 'number', min: 1, max: 7200 },
          { name: 'duration_min', type: 'number', min: 1, max: 720 },
          { name: 'amount', type: 'number', min: 1, max: 1000 },
          { name: 'coverage_percent', type: 'number', min: 0, max: 100 },
        ],
      },
      parameters: {
        duration_sec: 1200,
        duration_min: 20,
        amount: 20,
        coverage_percent: 95,
      },
      constraints: {},
      meta: {
        recommendation_id: recId,
        task_type: 'IRRIGATION',
        device_id,
        adapter_type: 'irrigation_simulator',
        device_type: 'IRRIGATION_CONTROLLER',
        required_capabilities: ['device.irrigation.valve.open'],
      },
    }
  });
  const taskJson = requireOk(taskResp, 'create action task');
  const actTaskId = String(taskJson.act_task_id ?? '').trim();
  assert.ok(actTaskId, 'act_task_id missing');

  const receiptResp = await fetchJson(`${base}/api/v1/actions/receipt`, {
    method: 'POST',
    token: executorToken,
    body: {
      tenant_id,
      project_id,
      group_id,
      operation_plan_id,
      act_task_id: actTaskId,
      executor_id: { kind: 'script', id: 'field_memory_acceptance_executor', namespace: 'qa' },
      execution_time: { start_ts: Date.now() - 20_000, end_ts: Date.now() - 5_000 },
      execution_coverage: { kind: 'field', ref: field_id },
      resource_usage: {
        fuel_l: null,
        electric_kwh: null,
        water_l: 20,
        chemical_ml: null,
      },
      observed_parameters: {
        duration_sec: 1200,
        duration_min: 20,
        amount: 20,
        coverage_percent: 95,
      },
      evidence_refs: [
        { kind: 'sensor', ref: `sensor_${suffix}` },
        { kind: 'photo', ref: `photo_${suffix}` },
      ],
      logs_refs: [
        { kind: 'water_delivery_receipt', ref: `water_${suffix}` },
        { kind: 'dispatch_ack', ref: `dispatch_${suffix}` },
        { kind: 'valve_open_confirmation', ref: `valve_${suffix}` },
      ],
      status: 'executed',
      constraint_check: { violated: false, violations: [] },
      meta: {
        command_id: actTaskId,
        idempotency_key: `field-memory-receipt-${actTaskId}`,
        recommendation_id: recId,
        soil_moisture_delta: Number((post_soil_moisture - pre_soil_moisture).toFixed(2))
      }
    }
  });
  const receiptJson = requireOk(receiptResp, 'submit action receipt');
  const receipt_fact_id = String(receiptJson.fact_id ?? '').trim();
  assert.ok(receipt_fact_id, 'receipt_fact_id missing');

  const executionJudgeResp = await fetchJson(`${base}/api/v1/judge/execution/evaluate`, {
    method: 'POST', token: adminToken,
    body: {
      tenant_id, project_id, group_id,
      field_id,
      device_id,
      receipt: {
        receipt_id: receipt_fact_id,
        task_id: actTaskId,
        status: 'executed',
        evidence_refs: [receipt_fact_id]
      },
      as_executed: { as_executed_id: `as_exec_${actTaskId}`, task_id: actTaskId },
      as_applied: { as_applied_id: `as_applied_${actTaskId}` },
      pre_soil_moisture,
      post_soil_moisture,
      evidence_refs: [receipt_fact_id],
      source_refs: [operation_plan_id]
    }
  });
  const executionJudgeJson = requireOk(executionJudgeResp, 'execution judge evaluate');
  const execution_judge_id = String(executionJudgeJson?.judge_result?.judge_id ?? '').trim();
  assert.ok(execution_judge_id, 'execution_judge_id missing');

  const acceptanceResp = await fetchJson(`${base}/api/v1/acceptance/evaluate`, {
    method: 'POST', token: adminToken,
    body: {
      tenant_id,
      project_id,
      group_id,
      act_task_id: actTaskId,
      execution_judge_id
    }
  });
  const acceptanceJson = requireOk(acceptanceResp, 'acceptance evaluate');
  const acceptance_verdict = String(acceptanceJson?.verdict ?? '').trim().toUpperCase();
  const acceptance_fact_id = String(acceptanceJson?.fact_id ?? '').trim();
  assert.ok(acceptance_fact_id, 'acceptance_fact_id missing');
  assert.equal(acceptance_verdict, 'PASS', `acceptance verdict must be PASS, got ${acceptance_verdict}`);

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
      JSON.stringify([receipt_fact_id, execution_judge_id, acceptance_fact_id]),
      Date.now()
    ]
  );

  const memoryList = await fetchJson(`${base}/api/v1/field-memory?field_id=${encodeURIComponent(field_id)}&limit=50`, { method: 'GET', token: adminToken });
  const memoryListJson = requireOk(memoryList, 'field memory list');
  const items = Array.isArray(memoryListJson.items) ? memoryListJson.items : [];

  const summaryResp = await fetchJson(`${base}/api/v1/field-memory/summary?field_id=${encodeURIComponent(field_id)}&limit=100`, { method: 'GET', token: adminToken });
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
      acceptance_verdict,
      acceptance_fact_id,
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
