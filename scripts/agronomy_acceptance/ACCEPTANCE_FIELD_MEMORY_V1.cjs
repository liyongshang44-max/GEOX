const { randomUUID } = require('node:crypto');
const { Pool } = require('pg');
const { assert, env, fetchJson, requireOk } = require('./_common.cjs');

let pool;

async function queryFieldMemoryByScope(pool, { tenant_id, project_id, group_id, field_id, operation_id }) {
  const params = [tenant_id, project_id, group_id];
  let sql = `SELECT * FROM field_memory_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3`;
  if (field_id) { params.push(field_id); sql += ` AND field_id=$${params.length}`; }
  if (operation_id) { params.push(operation_id); sql += ` AND operation_id=$${params.length}`; }
  sql += ` ORDER BY occurred_at DESC LIMIT 500`;
  return pool.query(sql, params);
}

async function assertFieldMemoryIdsExist(pool, ids) {
  if (!Array.isArray(ids) || ids.length === 0) return false;
  const q = await pool.query(`SELECT memory_id FROM field_memory_v1 WHERE memory_id = ANY($1::text[])`, [ids]);
  return q.rows.length === ids.length;
}

async function assertProjectionTablesReady(pool) {
  const required = ['derived_sensing_state_index_v1', 'device_observation_index_v1', 'field_memory_v1'];
  const missing = [];
  for (const table of required) {
    const q = await pool.query(`SELECT to_regclass($1) AS reg`, [`public.${table}`]);
    if (!q.rows?.[0]?.reg) missing.push(table);
  }
  if (missing.length > 0) {
    const err = new Error(`BOOTSTRAP_FAILURE_MISSING_PROJECTION_TABLES:${missing.join(',')}`);
    err.code = 'BOOTSTRAP_FAILURE_MISSING_PROJECTION_TABLES';
    throw err;
  }
}

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
  await assertProjectionTablesReady(pool);

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

  await pool.query(
    `
    INSERT INTO facts (fact_id, occurred_at, source, record_json)
    SELECT
      $5,
      NOW(),
      'ACCEPTANCE_FIELD_MEMORY_V1_skip_auto_task_issue',
      jsonb_set(
        src.record_json::jsonb,
        '{payload,proposal,meta}',
        COALESCE((src.record_json::jsonb #> '{payload,proposal,meta}'), '{}'::jsonb)
          || '{"skip_auto_task_issue": true}'::jsonb,
        true
      )
    FROM (
      SELECT record_json
        FROM facts
       WHERE (record_json::jsonb ->> 'type') = 'approval_request_v1'
         AND (record_json::jsonb #>> '{payload,request_id}') = $1
         AND (record_json::jsonb #>> '{payload,tenant_id}') = $2
         AND (record_json::jsonb #>> '{payload,project_id}') = $3
         AND (record_json::jsonb #>> '{payload,group_id}') = $4
       ORDER BY occurred_at DESC, fact_id DESC
       LIMIT 1
    ) src
    `,
    [
      String(submitJson.approval_request_id),
      tenant_id,
      project_id,
      group_id,
      randomUUID()
    ]
  );

  const patchedApproval = await pool.query(
    `
    SELECT fact_id
      FROM facts
     WHERE (record_json::jsonb ->> 'type') = 'approval_request_v1'
       AND (record_json::jsonb #>> '{payload,request_id}') = $1
       AND (record_json::jsonb #>> '{payload,tenant_id}') = $2
       AND (record_json::jsonb #>> '{payload,project_id}') = $3
       AND (record_json::jsonb #>> '{payload,group_id}') = $4
       AND COALESCE((record_json::jsonb #>> '{payload,proposal,meta,skip_auto_task_issue}')::boolean, false) = true
     ORDER BY occurred_at DESC, fact_id DESC
     LIMIT 1
    `,
    [
      String(submitJson.approval_request_id),
      tenant_id,
      project_id,
      group_id
    ]
  );

  assert.ok(patchedApproval.rows?.length > 0, 'approval skip_auto_task_issue append fact missing');
  const nowTs = Date.now();

  await pool.query(
    `INSERT INTO device_binding_index_v1
      (tenant_id, device_id, field_id, bound_ts_ms)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (tenant_id, device_id, field_id) DO UPDATE
       SET bound_ts_ms = EXCLUDED.bound_ts_ms`,
    [tenant_id, device_id, field_id, nowTs]
  );

  await pool.query(
    `INSERT INTO device_capability
      (tenant_id, device_id, capabilities, updated_ts_ms)
     VALUES ($1,$2,$3::jsonb,$4)
     ON CONFLICT (tenant_id, device_id) DO UPDATE
       SET capabilities = EXCLUDED.capabilities,
           updated_ts_ms = EXCLUDED.updated_ts_ms`,
    [tenant_id, device_id, JSON.stringify(['device.irrigation.valve.open']), nowTs]
  );

  await pool.query(
    `INSERT INTO device_status_index_v1
      (tenant_id, project_id, group_id, device_id, status, last_heartbeat_ts_ms, last_telemetry_ts_ms, updated_ts_ms)
     VALUES
      ($1,$2,$3,$4,'ONLINE',$5,$5,$5)
     ON CONFLICT (tenant_id, device_id) DO UPDATE
       SET project_id = EXCLUDED.project_id,
           group_id = EXCLUDED.group_id,
           status = 'ONLINE',
           last_heartbeat_ts_ms = EXCLUDED.last_heartbeat_ts_ms,
           last_telemetry_ts_ms = EXCLUDED.last_telemetry_ts_ms,
           updated_ts_ms = EXCLUDED.updated_ts_ms`,
    [tenant_id, project_id, group_id, device_id, nowTs]
  );

  const approval_id = String(submitJson.approval_request_id ?? '').trim();
  assert.ok(approval_id, 'approval_request_id missing before decide');
  const decideToken = env('AO_ACT_TOKEN', adminToken);
  process.stdout.write(JSON.stringify({
    approval_decide_debug: {
      token_present: Boolean(decideToken),
      approval_id,
      device_id,
      required_scope: 'approval.decide'
    }
  }, null, 2) + '\n');
  const decideApproval = await fetchJson(`${base}/api/v1/approvals/${encodeURIComponent(approval_id)}/decide`, {
    method: 'POST',
    token: decideToken,
    body: {
      tenant_id,
      project_id,
      group_id,
      decision: 'APPROVE',
      reason: 'field memory acceptance',
      device_id,
      adapter_type: 'irrigation_simulator',
      device_type: 'IRRIGATION_CONTROLLER',
      required_capabilities: ['device.irrigation.valve.open'],
    }
  });
  process.stdout.write(`${JSON.stringify({ approval_decide_http: { status: decideApproval.status, json: decideApproval.json } }, null, 2)}\n`);
  const decideJson = requireOk(decideApproval, 'decide approval before action task');
  process.stdout.write(`${JSON.stringify({ approval_decide_response: decideJson }, null, 2)}\n`);

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
    `UPDATE device_status_index_v1
        SET status='ONLINE', updated_ts_ms=$5
      WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND device_id=$4`,
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
      approval_request_id: approval_id,
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
  const taskFactQ = await pool.query(
    `SELECT record_json::jsonb AS record_json
       FROM facts
      WHERE (record_json::jsonb ->> 'type') = 'ao_act_task_v1'
        AND (
          (record_json::jsonb #>> '{payload,act_task_id}') = $1
          OR (record_json::jsonb #>> '{payload,task_id}') = $1
        )
      ORDER BY occurred_at DESC, fact_id DESC
      LIMIT 1`,
    [actTaskId]
  );
  const taskSkillBindingEvidence = taskFactQ.rows?.[0]?.record_json?.payload?.meta?.skill_binding_evidence ?? {};
  process.stdout.write(`${JSON.stringify({ task_skill_binding_evidence: taskSkillBindingEvidence }, null, 2)}\n`);

  const executeSkill = await fetchJson(`${base}/api/v1/skill/execute`, {
    method: 'POST',
    token: adminToken,
    body: {
      tenant_id,
      project_id,
      group_id,
      skill_id: 'mock_valve_control_skill_v1',
      version: 'v1',
      category: 'DEVICE',
      bind_target: 'mock_valve',
      field_id,
      device_id,
      operation_id: operation_plan_id,
      operation_plan_id,
      input: {
        task_id: actTaskId,
        approval_id,
        command: 'OPEN',
        duration_sec: 1200,
        required_capabilities: ['device.irrigation.valve.open'],
      }
    }
  });
  requireOk(executeSkill, 'mock valve skill execute');

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

  const memoryList = await fetchJson(`${base}/api/v1/field-memory?field_id=${encodeURIComponent(field_id)}&limit=50`, { method: 'GET', token: adminToken });
  const memoryListJson = requireOk(memoryList, 'field memory list');
  const items = Array.isArray(memoryListJson.items) ? memoryListJson.items : [];

  const summaryResp = await fetchJson(`${base}/api/v1/field-memory/summary?field_id=${encodeURIComponent(field_id)}&limit=100`, { method: 'GET', token: adminToken });
  const summaryJson = requireOk(summaryResp, 'field memory summary');


  const reportResp = await fetchJson(`${base}/api/v1/reports/operation/${encodeURIComponent(actTaskId)}?tenant_id=${encodeURIComponent(tenant_id)}&project_id=${encodeURIComponent(project_id)}&group_id=${encodeURIComponent(group_id)}`, { method: 'GET', token: adminToken });
  const reportOk = reportResp.ok && reportResp.json?.ok === true;

  const openapiResp = await fetchJson(`${base}/api/v1/openapi.json`, { method: 'GET' });
  assert.equal(openapiResp.ok, true, `openapi fetch failed status=${openapiResp.status}`);
  const openapi = openapiResp.json ?? {};

  const byScopeQ = await queryFieldMemoryByScope(pool, { tenant_id, project_id, group_id, field_id });
  const byOperationQ = await queryFieldMemoryByScope(pool, { tenant_id, project_id, group_id, operation_id: actTaskId });
  const byScopeItems = byScopeQ.rows ?? [];
  const byOperationItems = byOperationQ.rows ?? [];
  const byScopeIds = byScopeItems.slice(0, 3).map((x) => String(x.memory_id ?? '')).filter(Boolean);
  const byIdsExist = await assertFieldMemoryIdsExist(pool, byScopeIds);
  const byType = new Set(byScopeItems.map((item) => String(item?.memory_type ?? '')));

  const fieldResponseItems = byScopeItems.filter((x) => x?.memory_type === 'FIELD_RESPONSE_MEMORY');
  const deviceItems = byScopeItems.filter((x) => x?.memory_type === 'DEVICE_RELIABILITY_MEMORY');
  const colCheck = await pool.query(`
    SELECT data_type, udt_name, column_default, is_nullable
      FROM information_schema.columns
     WHERE table_schema='public' AND table_name='field_memory_v1' AND column_name='created_at'
  `);
  const c = colCheck.rows?.[0] ?? {};
  const dbContractAligned = String(c.data_type ?? '').includes('timestamp with time zone')
    && String(c.is_nullable ?? '').toUpperCase() === 'NO'
    && /now\(\)/i.test(String(c.column_default ?? ''));

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
      memory_count: byScopeItems.length
    }
  }, null, 2)}\n`);
  const checks = {
    db_contract_aligned: dbContractAligned,
    field_response_memory_written:
     byType.has('FIELD_RESPONSE_MEMORY'),
    device_reliability_memory_written: byType.has('DEVICE_RELIABILITY_MEMORY'),
    skill_performance_memory_written: byType.has('SKILL_PERFORMANCE_MEMORY'),
    memory_query_by_field: byScopeItems.length >= 3 && byScopeItems.every((item) => String(item?.field_id ?? '') === field_id),
    memory_query_by_operation: byOperationItems.length >= 3,
    memory_query_by_id_all_exist: byIdsExist,
    memory_has_confidence: byScopeItems.every((item) => Number(item?.confidence) > 0),
    memory_has_summary_text: byScopeItems.every((item) => String(item?.summary_text ?? "").trim().length > 0),
    memory_has_evidence_refs: byScopeItems.every((item) => Array.isArray(item?.evidence_refs)),
    skill_memory_has_skill_trace_ref: byScopeItems.filter((x)=>x.memory_type==='SKILL_PERFORMANCE_MEMORY').every((x)=>String(x.skill_trace_ref??'').trim().length>0),
    field_response_has_before_value: fieldResponseItems.some((x) => Number.isFinite(Number(x?.before_value))),
    field_response_has_after_value: fieldResponseItems.some((x) => Number.isFinite(Number(x?.after_value))),
    field_response_has_delta_value: fieldResponseItems.some((x) => Number.isFinite(Number(x?.delta_value))),
    device_memory_has_skill_id: deviceItems.some((x) => String(x?.skill_id ?? "").trim().length > 0),
    device_memory_has_response_metric: deviceItems.some((x) => String(x?.metric_key ?? "") === "valve_response_status"),
    report_field_response_contains_delta: (reportResp.json?.operation_report_v1?.field_memory?.field_response_memory ?? []).some((x) => Number.isFinite(Number(x?.delta_value))),
    report_reads_field_memory: reportOk
      && (reportResp.json?.operation_report_v1?.field_memory?.field_response_memory?.length ?? 0) > 0
      && (reportResp.json?.operation_report_v1?.field_memory?.device_reliability_memory?.length ?? 0) > 0
      && (reportResp.json?.operation_report_v1?.field_memory?.skill_performance_memory?.length ?? 0) > 0,
    openapi_matches_routes: Boolean(openapi?.components?.schemas?.FieldMemoryV1)
      && Boolean(openapi?.paths?.['/api/v1/field-memory'])
      && Boolean(openapi?.paths?.['/api/v1/field-memory/summary']),
    healthz_ok,
  };

  // Sanity-check summary shape for this stage.
  assert.equal(summaryJson?.ok, true, 'summary endpoint ok=false');
  assert.ok(summaryJson?.summary && typeof summaryJson.summary === 'object', 'summary object missing');
  
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
