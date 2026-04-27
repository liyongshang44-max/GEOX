const { randomUUID } = require('node:crypto');
const { Pool } = require('pg');
const { assert, env, fetchJson, requireOk } = require('./_common.cjs');

(async () => {
  const base = env('BASE_URL', 'http://127.0.0.1:3001');
  const token = env('AO_ACT_TOKEN', '');
  const tenant_id = env('TENANT_ID', 'tenantA');
  const project_id = env('PROJECT_ID', 'projectA');
  const group_id = env('GROUP_ID', 'groupA');
  const databaseUrl = env('DATABASE_URL', 'postgres://postgres:postgres@127.0.0.1:5432/geox');
  const pool = new Pool({ connectionString: databaseUrl });

  const suffix = Date.now();
  const field_id = `field_judge_layer_${suffix}`;
  const season_id = `season_judge_layer_${suffix}`;
  const device_id = `device_judge_layer_${suffix}`;
  const pre_soil_moisture = 0.18;
  const post_soil_moisture = 0.24;
  const ts0 = Date.now() - 60_000;

  const checks = {
    skill_registry_service_exists: false,
    skill_binding_service_exists: false,
    skill_runtime_service_exists: false,
    skill_trace_service_exists: false,
    skill_health_service_exists: false,
    skill_results_service_exists: false,
    skill_trace_query_service_exists: false,
    openapi_contains_skill_v1_paths: false,
    evidence_judge_created: false,
    evidence_judge_pass: false,
    agronomy_judge_created: false,
    agronomy_judge_water_deficit: false,
    agronomy_judge_uses_irrigation_skill: false,
    recommendation_trace_linked: false,
    prescription_created: false,
    prescription_trace_linked: false,
    task_and_receipt_created: false,
    execution_trace_linked: false,
    as_executed_and_as_applied_created: false,
    execution_judge_created: false,
    execution_judge_passed_after_post_moisture: false,
    acceptance_references_execution_judge: false,
    acceptance_trace_linked: false,
    roi_trace_linked: false,
    judge_result_query_by_kind: false,
    judge_result_query_by_field: false,
    judge_result_query_by_task: false,
    judge_result_query_by_prescription: false,
    openapi_contains_judge_v2_paths: false,
    healthz_ok: false,
    stale_evidence_blocks_agronomy: false,
    execution_without_evidence_not_passed: false,
  };

  try {
    await pool.query(`ALTER TABLE derived_sensing_state_index_v1 ADD COLUMN IF NOT EXISTS project_id text`);
    await pool.query(`ALTER TABLE derived_sensing_state_index_v1 ADD COLUMN IF NOT EXISTS group_id text`);
    await pool.query(`ALTER TABLE derived_sensing_state_index_v1 ADD COLUMN IF NOT EXISTS source_observation_ids_json jsonb NOT NULL DEFAULT '[]'::jsonb`);

    await pool.query(
      `INSERT INTO derived_sensing_state_index_v1
        (tenant_id, project_id, group_id, field_id, state_type, payload_json, confidence, explanation_codes_json, source_device_ids_json, computed_at, computed_at_ts_ms, fact_id, source_observation_ids_json)
       VALUES
        ($1,$2,$3,$4,'irrigation_effectiveness_state','{"level":"LOW"}'::jsonb,0.95,'[]'::jsonb,'[]'::jsonb,NOW(),$5,$6,'["obs_stage1_irrigation"]'::jsonb),
        ($1,$2,$3,$4,'leak_risk_state','{"level":"LOW"}'::jsonb,0.95,'[]'::jsonb,'[]'::jsonb,NOW(),$5,$7,'["obs_stage1_leak"]'::jsonb)
       ON CONFLICT DO NOTHING`,
      [tenant_id, project_id, group_id, field_id, ts0, randomUUID(), randomUUID()]
    );

    await pool.query(
      `INSERT INTO device_observation_index_v1
        (tenant_id, project_id, group_id, field_id, device_id, metric, observed_at, observed_at_ts_ms, value_num, confidence, fact_id)
       VALUES
        ($1,$2,$3,$4,$5,'soil_moisture',to_timestamp($6 / 1000.0),$6,$7,0.92,$8)
       ON CONFLICT DO NOTHING`,
      [tenant_id, project_id, group_id, field_id, device_id, ts0, pre_soil_moisture, `obs_pre_soil_${randomUUID()}`]
    );

    const evidenceJson = requireOk(await fetchJson(`${base}/api/v1/judge/evidence/evaluate`, {
      method: 'POST',
      token,
      body: {
        tenant_id, project_id, group_id, field_id, device_id,
        soil_moisture: pre_soil_moisture,
        observed_at_ts_ms: ts0,
        now_ts_ms: ts0 + 5_000,
        last_heartbeat_ts_ms: ts0 + 1_000,
        last_telemetry_ts_ms: ts0 + 2_000,
        evidence_refs: [`obs:soil:${ts0}`],
      }
    }), 'judge evidence evaluate');
    const evidenceJudge = evidenceJson.judge_result ?? {};
    checks.evidence_judge_created = Boolean(evidenceJudge.judge_id);
    checks.evidence_judge_pass = String(evidenceJudge.verdict ?? '') === 'PASS';

    const staleAgronomyJson = requireOk(await fetchJson(`${base}/api/v1/judge/agronomy/evaluate`, {
      method: 'POST',
      token,
      body: {
        tenant_id, project_id, group_id, field_id, season_id, device_id,
        soil_moisture: pre_soil_moisture,
        evidence_judge_verdict: 'STALE_DATA',
        evidence_refs: ['obs:stale'],
      }
    }), 'judge agronomy evaluate stale evidence');
    checks.stale_evidence_blocks_agronomy = String(staleAgronomyJson.judge_result?.verdict ?? '') === 'BLOCKED';

    const genJson = requireOk(await fetchJson(`${base}/api/v1/recommendations/generate`, {
      method: 'POST', token,
      body: {
        tenant_id, project_id, group_id, field_id, season_id, device_id,
        crop_code: 'corn',
        stage1_sensing_summary: {
          irrigation_effectiveness: 'low', leak_risk: 'low', canopy_temp_status: 'normal', evapotranspiration_risk: 'medium', sensor_quality_level: 'GOOD'
        },
        image_recognition: { stress_score: 0.6, disease_score: 0.1, pest_risk_score: 0.1, confidence: 0.9 },
      }
    }), 'generate recommendation');
    const recommendation = genJson.recommendations?.[0] ?? {};
    const recommendation_id = String(recommendation.recommendation_id ?? '');

    const agronomyJson = requireOk(await fetchJson(`${base}/api/v1/judge/agronomy/evaluate`, {
      method: 'POST',
      token,
      body: {
        tenant_id, project_id, group_id, recommendation_id, field_id, season_id, device_id,
        soil_moisture: pre_soil_moisture,
        evidence_judge_id: String(evidenceJudge.judge_id ?? ''),
        evidence_judge_verdict: String(evidenceJudge.verdict ?? ''),
        evidence_refs: [String(evidenceJudge.judge_id ?? '')],
      }
    }), 'judge agronomy evaluate');
    const agronomyJudge = agronomyJson.judge_result ?? {};
    checks.agronomy_judge_created = Boolean(agronomyJudge.judge_id);
    checks.agronomy_judge_water_deficit = String(agronomyJudge.verdict ?? '') === 'WATER_DEFICIT';
    checks.agronomy_judge_uses_irrigation_skill = String(agronomyJudge.outputs?.skill_id ?? '') === 'irrigation_deficit_skill_v1';
    const recommendationTrace = recommendation?.skill_trace ?? {};
    checks.recommendation_trace_linked = Boolean(recommendationTrace)
      && String(recommendationTrace.skill_id ?? '') === 'irrigation_deficit_skill_v1'
      && (String(recommendationTrace.stage ?? '').toLowerCase() === 'recommendation'
        || String(recommendationTrace.trace_stage ?? '').toLowerCase() === 'recommendation');

    const prescriptionJson = requireOk(await fetchJson(`${base}/api/v1/prescriptions/from-recommendation`, {
      method: 'POST', token,
      body: {
        recommendation_id, tenant_id, project_id, group_id, field_id, season_id, device_id,
        crop_id: 'corn', zone_id: null,
        device_requirements: { device_id, device_type: 'IRRIGATION_CONTROLLER', required_capabilities: ['device.irrigation.valve.open'], adapter_type: 'irrigation_simulator' },
        operation_amount: { amount: 25, unit: 'L', parameters: { device_id, duration_sec: 1200, flow_lpm: 1, prescription_id: `draft_${suffix}` } }
      }
    }), 'create prescription');
    const prescription = prescriptionJson.prescription ?? {};
    const prescription_id = String(prescription.prescription_id ?? '');
    checks.prescription_created = Boolean(prescription_id);
    const prescriptionTrace = prescription?.skill_trace ?? {};
    checks.prescription_trace_linked = !prescription?.skill_trace || (
      String(prescriptionTrace.skill_id ?? '') === 'irrigation_deficit_skill_v1'
      && (String(prescriptionTrace.stage ?? '').toLowerCase() === 'prescription'
        || String(prescriptionTrace.trace_stage ?? '').toLowerCase() === 'prescription')
    );

    const submitApprovalJson = requireOk(await fetchJson(`${base}/api/v1/prescriptions/${encodeURIComponent(prescription_id)}/submit-approval`, {
      method: 'POST', token, body: { tenant_id, project_id, group_id }
    }), 'submit approval');
    const approval_request_id = String(submitApprovalJson.approval_request_id ?? '');

    const approveJson = requireOk(await fetchJson(`${base}/api/v1/approvals/${encodeURIComponent(approval_request_id)}/decide`, {
      method: 'POST', token,
      body: {
        tenant_id, project_id, group_id, decision: 'APPROVE', reason: 'judge layering', device_id,
        adapter_type: 'irrigation_simulator', device_type: 'IRRIGATION_CONTROLLER', required_capabilities: ['device.irrigation.valve.open']
      }
    }), 'decide approval');
    const operation_plan_id = String(approveJson.operation_plan_id ?? approveJson.operation_plan?.operation_plan_id ?? '');

    const taskJson = requireOk(await fetchJson(`${base}/api/v1/actions/task`, {
      method: 'POST', token,
      body: {
        tenant_id, project_id, group_id, operation_plan_id, approval_request_id, field_id, season_id, device_id,
        issuer: { kind: 'human', id: 'acceptance', namespace: 'qa' }, action_type: 'IRRIGATE',
        target: { kind: 'field', ref: field_id }, time_window: { start_ts: ts0, end_ts: ts0 + 3600_000 },
        parameter_schema: { keys: [{ name: 'duration_min', type: 'number', min: 1 }, { name: 'prescription_id', type: 'enum', enum: [prescription_id] }] },
        parameters: { duration_min: 20, prescription_id }, constraints: {},
        meta: { recommendation_id, prescription_id, task_type: 'IRRIGATION', device_id }
      }
    }), 'create task');
    const task_id = String(taskJson.act_task_id ?? '');

    const receiptJson = requireOk(await fetchJson(`${base}/api/v1/actions/receipt`, {
      method: 'POST', token,
      body: {
        tenant_id, project_id, group_id, operation_plan_id, act_task_id: task_id,
        executor_id: { kind: 'script', id: 'executor', namespace: 'qa' },
        execution_time: { start_ts: Date.now() - 20_000, end_ts: Date.now() - 5_000 },
        execution_coverage: { kind: 'field', ref: field_id },
        resource_usage: { fuel_l: null, electric_kwh: null, water_l: 20, chemical_ml: null },
        observed_parameters: { duration_min: 20, prescription_id },
        evidence_refs: [{ kind: 'photo', ref: `ev_${suffix}` }], logs_refs: [{ kind: 'dispatch_ack', ref: `dispatch_${suffix}` }],
        status: 'executed', constraint_check: { violated: false, violations: [] },
        meta: { command_id: task_id, idempotency_key: `acceptance_receipt_${suffix}`, recommendation_id, prescription_id }
      }
    }), 'create receipt');
    const receipt_fact_id = String(receiptJson.fact_id ?? '');
    checks.task_and_receipt_created = Boolean(task_id && receipt_fact_id);
    const receiptTrace = receiptJson?.skill_trace ?? {};
    checks.execution_trace_linked = !receiptJson?.skill_trace || (
      String(receiptTrace.stage ?? '').toLowerCase() === 'execution'
      || String(receiptTrace.trace_stage ?? '').toLowerCase() === 'execution'
    );

    const asExecutedJson = requireOk(await fetchJson(`${base}/api/v1/as-executed/from-receipt`, {
      method: 'POST', token,
      body: { task_id, receipt_id: receipt_fact_id, tenant_id, project_id, group_id }
    }), 'create as-executed/as-applied');
    const as_executed_id = String(asExecutedJson?.as_executed?.as_executed_id ?? '');
    const as_applied_id = String(asExecutedJson?.as_applied?.as_applied_id ?? '');
    checks.as_executed_and_as_applied_created = Boolean(as_executed_id && as_applied_id);

    await pool.query(
      `INSERT INTO device_observation_index_v1
        (tenant_id, project_id, group_id, field_id, device_id, metric, observed_at, observed_at_ts_ms, value_num, confidence, fact_id)
       VALUES ($1,$2,$3,$4,$5,'soil_moisture',to_timestamp($6 / 1000.0),$6,$7,0.95,$8)
       ON CONFLICT DO NOTHING`,
      [tenant_id, project_id, group_id, field_id, device_id, Date.now(), post_soil_moisture, `obs_post_soil_${randomUUID()}`]
    );

    const executionJson = requireOk(await fetchJson(`${base}/api/v1/judge/execution/evaluate`, {
      method: 'POST', token,
      body: {
        tenant_id, project_id, group_id, field_id, device_id, prescription_id,
        receipt: { receipt_id: receipt_fact_id, task_id, status: 'executed', evidence_refs: [{ kind: 'photo', ref: `ev_${suffix}` }] },
        as_executed: { as_executed_id, task_id },
        as_applied: { as_applied_id },
        pre_soil_moisture, post_soil_moisture,
        evidence_refs: [receipt_fact_id, as_executed_id, as_applied_id],
        source_refs: [prescription_id]
      }
    }), 'judge execution evaluate');
    const executionJudge = executionJson.judge_result ?? {};
    checks.execution_judge_created = Boolean(executionJudge.judge_id);
    checks.execution_judge_passed_after_post_moisture = String(executionJudge.verdict ?? '') === 'PASS';

    const executionNegativeJson = requireOk(await fetchJson(`${base}/api/v1/judge/execution/evaluate`, {
      method: 'POST', token,
      body: {
        tenant_id, project_id, group_id, field_id, device_id, prescription_id,
        receipt: { receipt_id: `${receipt_fact_id}_neg`, task_id: `${task_id}_neg`, status: 'executed', evidence_refs: [] },
        pre_soil_moisture, post_soil_moisture
      }
    }), 'judge execution evaluate negative');
    checks.execution_without_evidence_not_passed = String(executionNegativeJson.judge_result?.verdict ?? '') !== 'PASS';

    const acceptanceJson = requireOk(await fetchJson(`${base}/api/v1/acceptance/evaluate`, {
      method: 'POST', token,
      body: { tenant_id, project_id, group_id, act_task_id: task_id, execution_judge_id: String(executionJudge.judge_id ?? '') }
    }), 'acceptance evaluate');

    const acceptanceFact = await pool.query(
      `SELECT record_json::jsonb AS record_json FROM facts WHERE fact_id = $1 LIMIT 1`,
      [String(acceptanceJson.fact_id ?? '')]
    );
    const acceptancePayload = acceptanceFact.rows?.[0]?.record_json?.payload ?? {};
    const acceptanceRefs = Array.isArray(acceptancePayload.evidence_refs) ? acceptancePayload.evidence_refs : [];
    checks.acceptance_references_execution_judge = acceptanceRefs.includes(String(executionJudge.judge_id ?? ''))
      && String(acceptancePayload.execution_judge_id ?? '') === String(executionJudge.judge_id ?? '');
    const acceptanceTrace = acceptanceJson?.skill_trace ?? acceptancePayload?.skill_trace ?? {};
    checks.acceptance_trace_linked = !acceptanceJson?.skill_trace && !acceptancePayload?.skill_trace
      ? true
      : (String(acceptanceTrace.stage ?? '').toLowerCase() === 'acceptance'
        || String(acceptanceTrace.trace_stage ?? '').toLowerCase() === 'acceptance');
    const roiTrace = acceptanceJson?.roi_trace ?? acceptancePayload?.roi_trace ?? {};
    checks.roi_trace_linked = !acceptanceJson?.roi_trace && !acceptancePayload?.roi_trace
      ? true
      : (String(roiTrace.stage ?? '').toLowerCase() === 'roi'
        || String(roiTrace.trace_stage ?? '').toLowerCase() === 'roi');

    const byKind = requireOk(await fetchJson(`${base}/api/v1/judge/results/by-kind/EXECUTION?tenant_id=${encodeURIComponent(tenant_id)}&project_id=${encodeURIComponent(project_id)}&group_id=${encodeURIComponent(group_id)}&limit=20`, { method: 'GET', token }), 'judge by kind');
    checks.judge_result_query_by_kind = Array.isArray(byKind.items) && byKind.items.some((x) => String(x?.judge_id ?? '') === String(executionJudge.judge_id ?? ''));

    const byField = requireOk(await fetchJson(`${base}/api/v1/judge/results/by-field/${encodeURIComponent(field_id)}?tenant_id=${encodeURIComponent(tenant_id)}&project_id=${encodeURIComponent(project_id)}&group_id=${encodeURIComponent(group_id)}&limit=20`, { method: 'GET', token }), 'judge by field');
    checks.judge_result_query_by_field = Array.isArray(byField.items) && byField.items.some((x) => String(x?.judge_id ?? '') === String(executionJudge.judge_id ?? ''));

    const byTask = requireOk(await fetchJson(`${base}/api/v1/judge/results/by-task/${encodeURIComponent(task_id)}?tenant_id=${encodeURIComponent(tenant_id)}&project_id=${encodeURIComponent(project_id)}&group_id=${encodeURIComponent(group_id)}&limit=20`, { method: 'GET', token }), 'judge by task');
    checks.judge_result_query_by_task = Array.isArray(byTask.items) && byTask.items.some((x) => String(x?.judge_id ?? '') === String(executionJudge.judge_id ?? ''));

    const byPrescription = requireOk(await fetchJson(`${base}/api/v1/judge/results/by-prescription/${encodeURIComponent(prescription_id)}?tenant_id=${encodeURIComponent(tenant_id)}&project_id=${encodeURIComponent(project_id)}&group_id=${encodeURIComponent(group_id)}&limit=20`, { method: 'GET', token }), 'judge by prescription');
    checks.judge_result_query_by_prescription = Array.isArray(byPrescription.items) && byPrescription.items.some((x) => String(x?.judge_id ?? '') === String(executionJudge.judge_id ?? ''));

    const healthz = requireOk(await fetchJson(`${base}/api/admin/healthz`, { method: 'GET', token }), 'admin healthz');
    checks.healthz_ok = Boolean(healthz.ok);

    const openapiResp = await fetchJson(`${base}/api/v1/openapi.json`, { method: 'GET', token });
    assert.equal(openapiResp.status, 200, `openapi status=${openapiResp.status}`);
    const openapi = openapiResp.json ?? {};
    const paths = openapi.paths ?? {};
    const requiredPaths = [
      '/api/v1/judge/health',
      '/api/v1/judge/evidence/evaluate',
      '/api/v1/judge/agronomy/evaluate',
      '/api/v1/judge/execution/evaluate',
      '/api/v1/judge/results/{judge_id}',
      '/api/v1/judge/results/by-kind/{judge_kind}',
      '/api/v1/judge/results/by-field/{field_id}',
      '/api/v1/judge/results/by-task/{task_id}',
      '/api/v1/judge/results/by-prescription/{prescription_id}',
    ];
    const requiredSkillPaths = [
      '/api/v1/skill/register',
      '/api/v1/skill/bind',
      '/api/v1/skill/run',
      '/api/v1/skill/trace',
      '/api/v1/skill/health',
      '/api/v1/skill/results/{skill_run_id}',
      '/api/v1/skill/trace/{trace_id}',
    ];
    checks.skill_registry_service_exists = Object.prototype.hasOwnProperty.call(paths, '/api/v1/skill/register');
    checks.skill_binding_service_exists = Object.prototype.hasOwnProperty.call(paths, '/api/v1/skill/bind');
    checks.skill_runtime_service_exists = Object.prototype.hasOwnProperty.call(paths, '/api/v1/skill/run');
    checks.skill_trace_service_exists = Object.prototype.hasOwnProperty.call(paths, '/api/v1/skill/trace');
    checks.skill_health_service_exists = Object.prototype.hasOwnProperty.call(paths, '/api/v1/skill/health');
    checks.skill_results_service_exists = Object.prototype.hasOwnProperty.call(paths, '/api/v1/skill/results/{skill_run_id}');
    checks.skill_trace_query_service_exists = Object.prototype.hasOwnProperty.call(paths, '/api/v1/skill/trace/{trace_id}');
    checks.openapi_contains_skill_v1_paths = requiredSkillPaths.every((p) => Object.prototype.hasOwnProperty.call(paths, p));
    checks.openapi_contains_judge_v2_paths = requiredPaths.every((p) => Object.prototype.hasOwnProperty.call(paths, p));

    Object.entries(checks).forEach(([k, v]) => assert.equal(v, true, `check failed: ${k}`));
    process.stdout.write(`${JSON.stringify({ ok: true, checks }, null, 2)}\n`);
  } finally {
    await pool.end();
  }
})().catch((err) => {
  console.error('[FAIL] ACCEPTANCE_JUDGE_V2_LAYERING', err?.stack || String(err));
  process.exit(1);
});
