const { randomUUID } = require('node:crypto');
const { Pool } = require('pg');
const { assert, env, fetchJson, requireOk } = require('./_common.cjs');
const {
  seedFormalCropContextV1,
  seedFormalIrrigationStage1Evidence,
} = require('./_stage1_formal_irrigation_fixture.cjs');

let pool;
function pickIrrigationRecommendation(genJson) {
  const recommendations = Array.isArray(genJson?.recommendations) ? genJson.recommendations : [];
  return recommendations.find((x) =>
    String(x?.recommendation_type ?? '') === 'irrigation_recommendation_v1'
    || String(x?.action_type ?? '').toUpperCase() === 'IRRIGATE'
    || String(x?.skill_trace?.skill_id ?? '') === 'irrigation_deficit_skill_v1'
  ) ?? null;
}
function formalEvidenceRef(kind, ref) {
  return {
    kind,
    ref,
    source_lane: 'FORMAL_OPERATION',
    evidence_level: 'FORMAL',
    formal_eligible: true,
    is_simulated: false,
  };
}

function buildIrrigationReceiptBody({
  tenant_id,
  project_id,
  group_id,
  operation_plan_id,
  act_task_id,
  field_id,
  suffix,
  recommendation_id,
  prescription_id,
  skill_trace_ref,
  water_l = 20,
  amount = 20,
  coverage_percent = 90,
  duration_min = 20,
}) {
  return {
    tenant_id,
    project_id,
    group_id,
    operation_plan_id,
    act_task_id,
    executor_id: { kind: 'script', id: 'acceptance_executor', namespace: 'qa' },
    execution_time: { start_ts: Date.now() - 20_000, end_ts: Date.now() - 5_000 },
    execution_coverage: { kind: 'field', ref: field_id },
    resource_usage: { fuel_l: 0, electric_kwh: 0, water_l, chemical_ml: 0 },
    observed_parameters: {
      amount,
      coverage_percent,
      duration_min,
    },
    evidence_refs: [formalEvidenceRef('sensor', `sensor_${suffix}`)],
    logs_refs: [
      { kind: 'dispatch_ack', ref: `ack_${suffix}` },
      { kind: 'valve_open_confirmation', ref: `valve_${suffix}` },
      { kind: 'water_delivery_receipt', ref: `water_${suffix}` },
      { kind: 'coverage_evidence', ref: `coverage_${suffix}` },
      { kind: 'effect_observation', ref: `effect_${suffix}` },
      { kind: 'soil_moisture_delta', ref: `delta_${suffix}` },
    ],
    status: 'executed',
    constraint_check: { violated: false, violations: [] },
    meta: {
      command_id: act_task_id,
      idempotency_key: `receipt_${act_task_id}_${suffix}`,
      recommendation_id,
      prescription_id,
      skill_id: 'irrigation_deficit_skill_v1',
      skill_trace_ref,
      source_lane: 'FORMAL_OPERATION',
      evidence_level: 'FORMAL',
      formal_eligible: true,
      is_simulated: false,
    },
  };
}

async function queryFieldMemoryByScope(pool, { tenant_id, project_id, group_id, field_id, operation_id }) {
  const params = [tenant_id, project_id, group_id];
  let sql = `SELECT * FROM field_memory_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3`;
  if (field_id) { params.push(field_id); sql += ` AND field_id=$${params.length}`; }
  if (operation_id) { params.push(operation_id); sql += ` AND operation_id=$${params.length}`; }
  sql += ` ORDER BY occurred_at DESC LIMIT 500`;
  return pool.query(sql, params);
}

async function queryFieldMemoryByOperationOrTask(pool, {
  tenant_id,
  project_id,
  group_id,
  operation_plan_id,
  act_task_id,
}) {
  return pool.query(
    `SELECT *
       FROM field_memory_v1
      WHERE tenant_id=$1
        AND project_id=$2
        AND group_id=$3
        AND (
          operation_id=$4
          OR task_id=$5
        )
      ORDER BY occurred_at DESC
      LIMIT 500`,
    [tenant_id, project_id, group_id, operation_plan_id, act_task_id]
  );
}

async function assertFieldMemoryIdsExist(pool, ids) {
  if (!Array.isArray(ids) || ids.length === 0) return false;
  const q = await pool.query(`SELECT memory_id FROM field_memory_v1 WHERE memory_id = ANY($1::text[])`, [ids]);
  return q.rows.length === ids.length;
}

async function assertProjectionTablesReady(pool) {
  const required = [
    'raw_samples',
    'derived_sensing_state_index_v1',
    'device_observation_index_v1',
    'device_status_index_v1',
    'device_binding_index_v1',
    'device_capability',
    'field_memory_v1',
    'facts',
  ];
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

function pickFirstObject(...candidates) {
  return candidates.find((x) => x && typeof x === 'object' && !Array.isArray(x)) ?? {};
}

function pickAcceptanceField(acceptanceJson, key) {
  const acceptance = pickFirstObject(acceptanceJson?.acceptance);
  const formalGate = pickFirstObject(
    acceptanceJson?.formal_gate,
    acceptanceJson?.formal_acceptance_gate,
    acceptanceJson?.formal_evidence_gate
  );
  const metrics = pickFirstObject(
    acceptanceJson?.metrics,
    acceptance?.metrics,
    formalGate?.metrics
  );

  if (Object.prototype.hasOwnProperty.call(acceptanceJson ?? {}, key)) return acceptanceJson[key];
  if (Object.prototype.hasOwnProperty.call(acceptance, key)) return acceptance[key];
  if (Object.prototype.hasOwnProperty.call(formalGate, key)) return formalGate[key];
  if (Object.prototype.hasOwnProperty.call(metrics, key)) return metrics[key];
  return undefined;
}

function buildAcceptanceGateDiagnostics(acceptanceJson) {
  const acceptance = pickFirstObject(acceptanceJson?.acceptance);
  const metrics = pickFirstObject(
    acceptanceJson?.metrics,
    acceptance?.metrics,
    acceptanceJson?.formal_gate?.metrics,
    acceptanceJson?.formal_acceptance_gate?.metrics
  );

  return {
    verdict: acceptanceJson?.verdict ?? acceptance?.verdict ?? null,
    formal_acceptance: pickAcceptanceField(acceptanceJson, 'formal_acceptance'),
    formal_evidence_passed: pickAcceptanceField(acceptanceJson, 'formal_evidence_passed'),
    receipt_structure_passed: pickAcceptanceField(acceptanceJson, 'receipt_structure_passed'),
    execution_evidence_passed: pickAcceptanceField(acceptanceJson, 'execution_evidence_passed'),
    execution_effect_passed: pickAcceptanceField(acceptanceJson, 'execution_effect_passed'),
    formal_execution_passed: pickAcceptanceField(acceptanceJson, 'formal_execution_passed'),
    source_lane: pickAcceptanceField(acceptanceJson, 'source_lane'),
    is_simulated: pickAcceptanceField(acceptanceJson, 'is_simulated'),
    blocking_reasons: pickAcceptanceField(acceptanceJson, 'blocking_reasons') ?? [],
    metrics,
  };
}

function assertAcceptanceDiagnosticsResponseShape() {
  const mock = {
    ok: true,
    verdict: 'PASS',
    acceptance: {
      formal_acceptance: true,
      formal_evidence_passed: true,
      execution_evidence_passed: true,
      execution_effect_passed: true,
      formal_execution_passed: true,
      source_lane: 'FORMAL_OPERATION',
      is_simulated: false,
      blocking_reasons: [],
      metrics: { formal_evidence_count: 3 },
    },
  };
  const diagnostics = buildAcceptanceGateDiagnostics(mock);
  assert.equal(diagnostics.formal_acceptance, true, 'acceptance diagnostics must read acceptance.formal_acceptance');
  assert.equal(diagnostics.formal_evidence_passed, true, 'acceptance diagnostics must read acceptance.formal_evidence_passed');
  assert.equal(diagnostics.execution_evidence_passed, true, 'acceptance diagnostics must read acceptance.execution_evidence_passed');
  assert.equal(diagnostics.execution_effect_passed, true, 'acceptance diagnostics must read acceptance.execution_effect_passed');
  assert.equal(diagnostics.formal_execution_passed, true, 'acceptance diagnostics must read acceptance.formal_execution_passed');
  assert.equal(diagnostics.source_lane, 'FORMAL_OPERATION', 'acceptance diagnostics must read acceptance.source_lane');
  assert.equal(diagnostics.is_simulated, false, 'acceptance diagnostics must read acceptance.is_simulated');
  assert.deepEqual(diagnostics.blocking_reasons, [], 'acceptance diagnostics must read acceptance.blocking_reasons');
  assert.equal(diagnostics.metrics?.formal_evidence_count, 3, 'acceptance diagnostics must read acceptance.metrics');
}

assertAcceptanceDiagnosticsResponseShape();

function buildStage1GateDiagnostics(recGenJson) {
  const problemState = pickFirstObject(recGenJson?.problem_state_v1, recGenJson?.problem_state);
  const evidence = pickFirstObject(
    recGenJson?.evidence_sufficiency_v1,
    recGenJson?.evidence_sufficiency,
    problemState?.evidence_sufficiency_v1,
    problemState?.evidence_sufficiency
  );
  const device = pickFirstObject(
    recGenJson?.device_health_snapshot_v1,
    recGenJson?.device_health_snapshot,
    problemState?.device_health_snapshot_v1,
    problemState?.device_health_snapshot
  );
  return {
    error: recGenJson?.error ?? null,
    reason_codes: Array.isArray(recGenJson?.reason_codes) ? recGenJson.reason_codes : [],
    evidence_sufficiency: evidence,
    formal_sample_count: Number(evidence?.formal_sample_count ?? evidence?.sample_count ?? 0),
    formal_coverage_ratio: Number(evidence?.formal_coverage_ratio ?? evidence?.coverage_ratio ?? 0),
    device_status_present: Boolean(device?.device_status_present ?? device?.status_present ?? device?.status),
    device_health_status: String(device?.device_health_status ?? device?.health_status ?? device?.status ?? 'UNKNOWN'),
  };
}

function buildRecommendationFailureDiagnostic({ recGen, field_id, device_id, season_id, fixture, cropContextSeed }) {
  return {
    reason: 'NO_RECOMMENDATION_TRIGGERED',
    field_id,
    device_id,
    season_id,
    fixture: {
      raw_sample_count: Array.isArray(fixture?.raw_sample_ids) ? fixture.raw_sample_ids.length : 0,
      sample_mode: fixture?.sample_mode ?? 'unknown',
      crop_context_fact_id: cropContextSeed?.fact_id ?? fixture?.crop_context_seed?.fact_id ?? '',
      observation_id: fixture?.observation_id ?? '',
    },
    stage1_gate: buildStage1GateDiagnostics(recGen?.json ?? {}),
    recommendation_generate_response: recGen?.json ?? {},
    status: recGen?.status,
  };
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
  const allowStaticFieldMemory = String(process.env.ALLOW_STATIC_FIELD_MEMORY ?? '').trim() === '1';
  const field_id = allowStaticFieldMemory
    ? env('FIELD_ID', `field_memory_${suffix}`)
    : `field_memory_${suffix}`;
  const season_id = allowStaticFieldMemory
    ? env('SEASON_ID', `season_field_memory_${suffix}`)
    : `season_field_memory_${suffix}`;
  const device_id = allowStaticFieldMemory
    ? env('DEVICE_ID', `device_memory_${suffix}`)
    : `device_memory_${suffix}`;
  const pre_soil_moisture = 0.16;
  const post_soil_moisture = 0.24;
  const now_ms = Date.now();
  const ts0 = now_ms - 60_000;
  await assertProjectionTablesReady(pool);

  const health = await fetchJson(`${base}/api/v1/field-memory/health`, { method: 'GET' });
  const healthz_ok = health.ok && health.json?.ok === true && health.json?.table_ready === true;

  const cropContextSeed = await seedFormalCropContextV1(pool, {
    tenant_id,
    project_id,
    group_id,
    field_id,
    season_id,
    crop_code: 'corn',
    crop_stage: 'V8',
    now_ms,
  });

  const fixture = await seedFormalIrrigationStage1Evidence(pool, {
    tenant_id,
    project_id,
    group_id,
    field_id,
    season_id,
    device_id,
    now_ms,
    pre_soil_moisture,
    sample_mode: 'formal',
    crop_code: 'corn',
    crop_stage: 'V8',
  });

  process.stdout.write(`${JSON.stringify({
    stage1_fixture_seeded: true,
    field_id,
    device_id,
    season_id,
    fixture: {
      raw_sample_count: fixture.raw_sample_ids?.length ?? 0,
      sample_mode: fixture.sample_mode,
      crop_context_fact_id: cropContextSeed.fact_id,
      observation_id: fixture.observation_id,
    },
    trigger: fixture.stage1_sensing_summary,
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
      stage1_sensing_summary: fixture.stage1_sensing_summary,
      image_recognition: { stress_score: 0.55, disease_score: 0.2, pest_risk_score: 0.2, confidence: 0.9 }
    }
  });
  process.stdout.write(`${JSON.stringify({ recommendation_generate_response: recGen.json ?? {}, status: recGen.status }, null, 2)}\n`);
  if (!recGen.ok || !Array.isArray(recGen.json?.recommendations) || recGen.json.recommendations.length === 0) {
    process.stdout.write(`${JSON.stringify(buildRecommendationFailureDiagnostic({ recGen, field_id, device_id, season_id, fixture, cropContextSeed }), null, 2)}\n`);
    throw new Error('NO_RECOMMENDATION_TRIGGERED');
  }
  const recJson = requireOk(recGen, 'generate recommendation');
  assert.equal(recJson.crop_context?.status, 'PLANTED_CONFIRMED');
  assert.equal(recJson.crop_context?.crop_code, 'corn');
  assert.equal(recJson.crop_context?.crop_stage, 'V8');
  assert.equal(recJson.crop_context_guard?.blocked_crop_specific_recommendations ?? 0, 0);
  const recommendationCount = Array.isArray(recJson.recommendations) ? recJson.recommendations.length : 0;
  assert.ok(recommendationCount > 0, 'recommendation_count must be positive');
  const recommendation = pickIrrigationRecommendation(recJson);
  assert.ok(recommendation, 'NO_IRRIGATION_RECOMMENDATION_RETURNED');
  const recId = String(recommendation.recommendation_id ?? '');
  assert.ok(recId, 'recommendation_id missing');
  const prescription_id = String(recommendation?.prescription_id ?? '').trim();
  const skill_trace_ref = String(
    recommendation?.skill_trace?.trace_id
    ?? recommendation?.trace_id
    ?? ''
  ).trim();
  assert.ok(skill_trace_ref, 'skill_trace_ref missing from irrigation recommendation');

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
      device_id,
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
        prescription_id,
        skill_trace_ref,
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
    body: buildIrrigationReceiptBody({
      tenant_id, project_id, group_id, operation_plan_id, act_task_id: actTaskId, field_id, suffix,
      recommendation_id: recId,
      prescription_id,
      skill_trace_ref,
      coverage_percent: 95,
      pre_soil_moisture,
      post_soil_moisture,
    })
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
  process.stdout.write(`${JSON.stringify({ acceptance_evaluate_response: acceptanceJson }, null, 2)}\n`);
  const acceptanceGateDiagnostics = buildAcceptanceGateDiagnostics(acceptanceJson);
  process.stdout.write(`${JSON.stringify({ acceptance_formal_gate_diagnostics: acceptanceGateDiagnostics }, null, 2)}\n`);
  const acceptance_verdict = String(acceptanceJson?.verdict ?? '').trim().toUpperCase();
  const acceptance_fact_id = String(acceptanceJson?.fact_id ?? '').trim();
  assert.ok(acceptance_fact_id, 'acceptance_fact_id missing');
  assert.equal(acceptance_verdict, 'PASS', `acceptance verdict must be PASS, got ${acceptance_verdict}`);
  assert.equal(acceptanceGateDiagnostics.formal_acceptance, true, 'formal_acceptance must be true');
  assert.equal(acceptanceGateDiagnostics.formal_evidence_passed, true, 'formal_evidence_passed must be true');
  assert.equal(acceptanceGateDiagnostics.execution_evidence_passed, true, 'execution_evidence_passed must be true');
  assert.equal(acceptanceGateDiagnostics.execution_effect_passed, true, 'execution_effect_passed must be true');
  assert.equal(acceptanceGateDiagnostics.formal_execution_passed, true, 'formal_execution_passed must be true');
  assert.equal(acceptanceGateDiagnostics.source_lane, 'FORMAL_OPERATION', 'source_lane must be FORMAL_OPERATION');
  assert.equal(acceptanceGateDiagnostics.is_simulated, false, 'is_simulated must be false');
  assert.deepEqual(acceptanceGateDiagnostics.blocking_reasons ?? [], [], 'blocking_reasons must be empty');

  const memoryList = await fetchJson(`${base}/api/v1/field-memory?field_id=${encodeURIComponent(field_id)}&limit=50`, { method: 'GET', token: adminToken });
  const memoryListJson = requireOk(memoryList, 'field memory list');
  const items = Array.isArray(memoryListJson.items) ? memoryListJson.items : [];

  const summaryResp = await fetchJson(`${base}/api/v1/field-memory/summary?field_id=${encodeURIComponent(field_id)}&limit=100`, { method: 'GET', token: adminToken });
  const summaryJson = requireOk(summaryResp, 'field memory summary');



  const openapiResp = await fetchJson(`${base}/api/v1/openapi.json`, { method: 'GET' });
  assert.equal(openapiResp.ok, true, `openapi fetch failed status=${openapiResp.status}`);
  const openapi = openapiResp.json ?? {};

  const byScopeQ = await queryFieldMemoryByScope(pool, { tenant_id, project_id, group_id, field_id });
  const byOperationQ = await queryFieldMemoryByOperationOrTask(pool, {
    tenant_id,
    project_id,
    group_id,
    operation_plan_id,
    act_task_id: actTaskId,
  });
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
    report_field_response_contains_delta: fieldResponseItems.some((x) => {
      const before = Number(x?.before_value);
      const after = Number(x?.after_value);
      const delta = Number(x?.delta_value);
      return Number.isFinite(before)
        && Number.isFinite(after)
        && Number.isFinite(delta)
        && Math.abs(delta) > 0;
    }),
    report_reads_field_memory:
      fieldResponseItems.length > 0
      && deviceItems.length > 0
      && byScopeItems.some((x) => x?.memory_type === 'SKILL_PERFORMANCE_MEMORY'),
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
