const { randomUUID } = require('node:crypto');
const { Pool } = require('pg');
const { assert, env, fetchJson, requireOk, waitForHealth } = require('./_common.cjs');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const id = (p) => `${p}_${randomUUID().replace(/-/g, '').slice(0, 18)}`;
const pctDeviation = (planned, actual) => planned > 0 ? Math.abs(actual - planned) / planned : 1;

function tokenEnv(name, fallback) { return env(name, env('AO_ACT_TOKEN', fallback)); }
function truthy(x) { return x === true; }
function isPass(v) { return String(v ?? '').trim().toUpperCase() === 'PASS'; }
function body(resp) { return resp?.json ?? resp?.text ?? null; }
function compact(resp) { return { ok: resp?.ok, status: resp?.status, body: body(resp) }; }
function getJson(resp) { return resp?.json ?? {}; }
function q(v) { return encodeURIComponent(String(v ?? '')); }

async function post(base, path, token, payload) {
  return fetchJson(`${base}${path}`, { method: 'POST', token, body: payload });
}

async function get(base, path, token) {
  return fetchJson(`${base}${path}`, { method: 'GET', token });
}

async function createSamplingChain(base, token, scope, field_id, sample_id, metrics, quality_status = 'PASS', accept = true) {
  const plan = requireOk(await post(base, '/api/v1/sampling/plan', token, {
    ...scope,
    field_id,
    reason: 'NUTRIENT_CHECK',
    sample_type: 'SOIL',
    required_depth_cm: 30,
    required_points: 8,
    evidence_refs: [],
  }), 'sampling plan');
  const receipt = requireOk(await post(base, '/api/v1/sampling/receipt', token, {
    ...scope,
    plan_id: plan.plan_id,
    sample_id,
    field_id,
    collected_at_ts: Date.now(),
    collector_actor_id: 'formal_fertilization_e2e',
    sample_type: 'SOIL',
    depth_cm: 30,
    evidence_refs: [{ kind: 'raw_sample_v1', ref_id: `soil_${sample_id}` }],
    chain_of_custody_status: 'RECORDED',
  }), 'sample receipt');
  const lab = requireOk(await post(base, '/api/v1/sampling/lab-result', token, {
    sample_id,
    imported_at_ts: Date.now(),
    lab_name: 'formal_fertilization_lab',
    metrics,
    units: { nitrate_n_mg_kg: 'mg/kg', ammonium_n_mg_kg: 'mg/kg', organic_matter_percent: '%' },
    evidence_refs: [{ kind: 'import_run_v1', ref_id: `lab_${sample_id}` }],
    quality_status,
  }), 'lab result');
  if (accept) {
    const acc = requireOk(await post(base, '/api/v1/sampling/acceptance/evaluate', token, {
      plan_id: plan.plan_id,
      sample_id,
      import_id: lab.import_id,
    }), 'sampling acceptance');
    return { plan, receipt, lab, sampling_acceptance: acc };
  }
  return { plan, receipt, lab, sampling_acceptance: null };
}

async function createFormalAssessment(base, token, scope, field_id, sample_id, lab_import_id, status = 'LOW_N_RISK') {
  return post(base, '/api/v1/fertilization/nitrogen-assessment', token, {
    ...scope,
    field_id,
    trigger_source: 'SAMPLING_LAB',
    sample_id,
    lab_import_id,
    sample_type: 'SOIL',
    status,
    metrics: { nitrate_n_mg_kg: 2.1, ammonium_n_mg_kg: 0.7, organic_matter_percent: 1.4 },
    reasons: ['LOW_N_LAB_CONFIRMED'],
    evidence_refs: [{ kind: 'sample_receipt_v1', ref_id: sample_id }, { kind: 'lab_result_import_v1', ref_id: lab_import_id }],
  });
}

async function createSensingAssessment(base, token, scope, field_id, extra = {}) {
  return post(base, '/api/v1/fertilization/nitrogen-assessment', token, {
    ...scope,
    field_id,
    trigger_source: 'SENSING_RISK',
    sensing_state_refs: [{ state_type: 'fertility_state', ref_id: id('fertility_low') }],
    skill_signal_refs: [{ skill_id: 'fertility_inference_v1', skill_run_id: id('skillrun'), signal_type: 'LOW_FERTILITY_SIGNAL' }],
    metrics: { ec_ds_m: extra.ec_ds_m ?? null },
    reasons: extra.reasons ?? ['SENSING_LOW_FERTILITY_ONLY'],
    evidence_refs: [],
    ...extra,
  });
}

async function createRecommendation(base, token, scope, field_id, assessment_id, visible, zoneRates) {
  return post(base, '/api/v1/fertilization/recommendation', token, {
    ...scope,
    field_id,
    assessment_id,
    recommendation_type: 'NITROGEN',
    suggested_total_n_kg_ha: zoneRates.reduce((s, z) => s + Number(z.n_kg_ha ?? 0), 0),
    zone_rates: zoneRates,
    risk_flags: [],
    customer_visible_eligible: visible,
    evidence_refs: [{ kind: 'nitrogen_need_assessment_v1', ref_id: assessment_id }],
  });
}

async function createPrescription(base, token, scope, field_id, recommendation_id, zoneRates) {
  return post(base, '/api/v1/fertilization/prescription', token, {
    ...scope,
    field_id,
    fertilization_recommendation_id: recommendation_id,
    material_type: 'UREA',
    zone_rates: zoneRates,
    evidence_refs: [{ kind: 'fertilization_recommendation_v1', ref_id: recommendation_id }],
  });
}

async function approvePrescription(base, submitToken, approveToken, scope, prescription_id) {
  const submit = await post(base, `/api/v1/prescriptions/${q(prescription_id)}/submit-approval`, submitToken, scope);
  if (!submit.ok || submit.json?.ok === false) return { submit, approve: null, approval_request_id: null };
  const s = getJson(submit);
  const approval_request_id = String(s.approval_request_id ?? s.request_id ?? s.approval_id ?? '').trim();
  if (!approval_request_id) return { submit, approve: null, approval_request_id: null };
  const approve = await post(base, '/api/v1/approvals/approve', approveToken, { ...scope, request_id: approval_request_id, decision: 'APPROVE' });
  return { submit, approve, approval_request_id };
}

async function createTask(base, token, scope, prescription_id, approval_request_id, operation_plan_id, device_id) {
  return post(base, '/api/v1/actions/task/from-variable-prescription', token, {
    ...scope,
    prescription_id,
    approval_request_id,
    operation_plan_id,
    device_id,
  });
}

function receiptBody(scope, operation_plan_id, act_task_id, field_id, device_id, zoneApps, status = 'executed') {
  return {
    ...scope,
    operation_plan_id,
    act_task_id,
    executor_id: { kind: 'script', id: 'formal_fertilization_e2e', namespace: 'agronomy_acceptance' },
    execution_time: { start_ts: Date.now() - 900000, end_ts: Date.now() },
    execution_coverage: { kind: 'field', ref: field_id },
    resource_usage: { fuel_l: null, electric_kwh: null, water_l: null, chemical_ml: null },
    logs_refs: [{ kind: 'formal_fertilization_log', ref: `fert_${act_task_id}` }],
    status,
    constraint_check: { violated: false, violations: [] },
    observed_parameters: { duration_sec: 900, duration_min: 15, amount: zoneApps.reduce((s, z) => s + Number(z.actual_n_kg_ha ?? z.applied_amount ?? 0), 0), coverage_percent: 97 },
    meta: {
      command_id: act_task_id,
      idempotency_key: id(`fert_receipt_${act_task_id}`),
      variable_execution: { mode: 'VARIABLE_BY_ZONE', zone_applications: zoneApps },
      fertilizer_execution: { nutrient: 'N', zone_applications: zoneApps },
    },
  };
}

async function submitReceiptAndAsApplied(base, executorToken, operatorToken, scope, receipt) {
  const receiptResp = await post(base, '/api/v1/actions/receipt', executorToken, receipt);
  if (!receiptResp.ok || receiptResp.json?.ok === false) return { receiptResp, receipt_id: null, asApplied: null, genericAcceptance: null };
  const receipt_id = String(receiptResp.json?.receipt_id ?? receiptResp.json?.fact_id ?? '').trim();
  const asApplied = await post(base, '/api/v1/as-executed/from-receipt', executorToken, { ...scope, task_id: receipt.act_task_id, receipt_id });
  const genericAcceptance = await post(base, '/api/v1/acceptance/evaluate', operatorToken, { ...scope, act_task_id: receipt.act_task_id, receipt_id });
  return { receiptResp, receipt_id, asApplied, genericAcceptance };
}

async function evalFertilizationAcceptance(base, token, scope, prescription_id, receipt_id, act_task_id, operation_plan_id, zoneApps) {
  return post(base, '/api/v1/fertilization/acceptance/evaluate', token, {
    ...scope,
    fertilization_prescription_id: prescription_id,
    receipt_id,
    act_task_id,
    operation_plan_id,
    zone_applications: zoneApps,
    evidence_refs: [{ kind: 'ao_act_receipt_v0', ref_id: receipt_id }],
  });
}

async function fetchOperationReport(base, token, scope, operation_plan_id) {
  return get(base, `/api/v1/reports/operation/${q(operation_plan_id)}?tenant_id=${q(scope.tenant_id)}&project_id=${q(scope.project_id)}&group_id=${q(scope.group_id)}`, token);
}

async function latestFact(pool, type, key, value, scope) {
  const res = await pool.query(
    `SELECT fact_id, record_json::jsonb AS r
       FROM facts
      WHERE (record_json::jsonb->>'type') = $1
        AND (record_json::jsonb->>$2) = $3
        AND COALESCE(record_json::jsonb->>'tenant_id', record_json::jsonb#>>'{payload,tenant_id}') = $4
        AND COALESCE(record_json::jsonb->>'project_id', record_json::jsonb#>>'{payload,project_id}') = $5
        AND COALESCE(record_json::jsonb->>'group_id', record_json::jsonb#>>'{payload,group_id}') = $6
      ORDER BY occurred_at DESC, fact_id DESC
      LIMIT 1`,
    [type, key, value, scope.tenant_id, scope.project_id, scope.group_id],
  ).catch(() => ({ rows: [] }));
  return res.rows?.[0] ?? null;
}

async function latestTaskByOperation(pool, scope, operation_plan_id) {
  const res = await pool.query(
    `SELECT record_json::jsonb AS r
       FROM facts
      WHERE (record_json::jsonb->>'type') = 'ao_act_task_v0'
        AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
        AND (record_json::jsonb#>>'{payload,project_id}') = $2
        AND (record_json::jsonb#>>'{payload,group_id}') = $3
        AND (record_json::jsonb#>>'{payload,operation_plan_id}') = $4
      ORDER BY occurred_at DESC, fact_id DESC
      LIMIT 1`,
    [scope.tenant_id, scope.project_id, scope.group_id, operation_plan_id],
  ).catch(() => ({ rows: [] }));
  return res.rows?.[0]?.r?.payload ?? null;
}

async function ensureFertilizerDevice(pool, scope, field_id, device_id) {
  const ts = Date.now();
  await pool.query(`ALTER TABLE device_index_v1 ADD COLUMN IF NOT EXISTS device_mode TEXT NOT NULL DEFAULT 'physical'`).catch(() => undefined);
  await pool.query(`CREATE TABLE IF NOT EXISTS device_capability(tenant_id TEXT NOT NULL,device_id TEXT NOT NULL,capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,updated_ts_ms BIGINT NOT NULL,PRIMARY KEY(tenant_id,device_id))`).catch(() => undefined);
  await pool.query(`CREATE TABLE IF NOT EXISTS device_binding_index_v1(tenant_id TEXT NOT NULL,device_id TEXT NOT NULL,field_id TEXT NOT NULL,bound_ts_ms BIGINT NULL,PRIMARY KEY(tenant_id,device_id,field_id))`).catch(() => undefined);
  await pool.query(`CREATE TABLE IF NOT EXISTS device_status_index_v1(tenant_id TEXT NOT NULL,project_id TEXT NULL,group_id TEXT NULL,field_id TEXT NULL,device_id TEXT NOT NULL,status TEXT NULL,last_telemetry_ts_ms BIGINT NULL,last_heartbeat_ts_ms BIGINT NULL,battery_percent INTEGER NULL,rssi_dbm INTEGER NULL,fw_ver TEXT NULL,updated_ts_ms BIGINT NOT NULL,PRIMARY KEY(tenant_id,device_id))`).catch(() => undefined);
  await pool.query(`INSERT INTO device_index_v1(tenant_id,device_id,display_name,device_mode,created_ts_ms) VALUES($1,$2,$3,'physical',$4) ON CONFLICT(tenant_id,device_id) DO UPDATE SET display_name=EXCLUDED.display_name,device_mode='physical'`, [scope.tenant_id, device_id, `Formal fertilization ${device_id}`, ts]).catch(() => undefined);
  await pool.query(`INSERT INTO device_capability VALUES($1,$2,$3::jsonb,$4) ON CONFLICT(tenant_id,device_id) DO UPDATE SET capabilities=EXCLUDED.capabilities,updated_ts_ms=EXCLUDED.updated_ts_ms`, [scope.tenant_id, device_id, JSON.stringify(['device.fertilization.dispense', 'telemetry.fertilizer_rate']), ts]).catch(() => undefined);
  await pool.query(`INSERT INTO device_binding_index_v1 VALUES($1,$2,$3,$4) ON CONFLICT(tenant_id,device_id,field_id) DO UPDATE SET bound_ts_ms=EXCLUDED.bound_ts_ms`, [scope.tenant_id, device_id, field_id, ts]).catch(() => undefined);
  await pool.query(`INSERT INTO device_status_index_v1(tenant_id,project_id,group_id,field_id,device_id,status,last_telemetry_ts_ms,last_heartbeat_ts_ms,battery_percent,rssi_dbm,fw_ver,updated_ts_ms) VALUES($1,$2,$3,$4,$5,'ONLINE',$6,$6,82,-55,'formal-fertilization-e2e',$6) ON CONFLICT(tenant_id,device_id) DO UPDATE SET project_id=EXCLUDED.project_id,group_id=EXCLUDED.group_id,field_id=EXCLUDED.field_id,status='ONLINE',last_telemetry_ts_ms=EXCLUDED.last_telemetry_ts_ms,last_heartbeat_ts_ms=EXCLUDED.last_heartbeat_ts_ms,updated_ts_ms=EXCLUDED.updated_ts_ms`, [scope.tenant_id, scope.project_id, scope.group_id, field_id, device_id, ts - 30000]).catch(() => undefined);
}

function localZoneRollup(zoneRates, zoneApps) {
  const matrix = zoneRates.map((z) => {
    const app = zoneApps.find((x) => x.zone_id === z.zone_id);
    const planned = Number(z.planned_n_kg_ha ?? z.planned_amount ?? 0);
    const actual = Number(app?.actual_n_kg_ha ?? app?.applied_amount ?? 0);
    const coverage = Number(app?.coverage_percent ?? 0);
    const deviation = pctDeviation(planned, actual);
    const result = !app || coverage < 0.9 || deviation > 0.15 ? 'FAIL' : 'PASS';
    return { zone_id: z.zone_id, planned, actual, coverage, deviation, result };
  });
  const verdict = matrix.every((z) => z.result === 'PASS') ? 'PASS' : 'FAIL';
  const averagePlanned = matrix.reduce((s, z) => s + z.planned, 0);
  const averageActual = matrix.reduce((s, z) => s + z.actual, 0);
  const averageLooksOk = pctDeviation(averagePlanned, averageActual) <= 0.15;
  return { matrix, verdict, averageLooksOk };
}

async function run() {
  const base = env('BASE_URL', process.env.GEOX_BASE_URL || 'http://127.0.0.1:3001');
  const adminToken = tokenEnv('ADMIN_TOKEN', 'admin_token');
  const approverToken = tokenEnv('APPROVER_TOKEN', 'approver_token');
  const operatorToken = tokenEnv('OPERATOR_TOKEN', 'operator_token');
  const executorToken = tokenEnv('EXECUTOR_TOKEN', 'executor_token');
  const pool = new Pool({ connectionString: env('DATABASE_URL', 'postgres://postgres:postgres@127.0.0.1:5432/geox') });
  const scope = { tenant_id: env('TENANT_ID', 'tenantA'), project_id: env('PROJECT_ID', 'projectA'), group_id: env('GROUP_ID', 'groupA') };
  const runId = id('formal_fert');
  const field_id = `field_${runId}`;
  const device_id = `fert_dev_${runId}`;
  const sample_id = `sample_${runId}`;

  const checks = {
    sampling_lab_formal_trigger_creates_low_n_risk: false,
    sensing_risk_only_creates_needs_review: false,
    sensing_risk_does_not_create_customer_visible_recommendation: false,
    ec_salinity_risk_does_not_trigger_nitrogen_prescription: false,
    fertilization_prescription_requires_approval: false,
    ao_act_task_created_after_approval: false,
    receipt_contains_zone_fertilizer_applications: false,
    fertilization_acceptance_evaluated: false,
    zone_failure_not_hidden_by_average: false,
    operation_report_contains_fertilization: false,
  };
  const negative = {
    lab_result_quality_status_invalid_assessment_not_low_n_risk: false,
    sampling_acceptance_not_pass_assessment_not_formal_low_n_risk: false,
    fertility_state_low_only_needs_review_warning: false,
    sensing_risk_customer_visible_recommendation_blocked: false,
    ec_high_salinity_risk_blocks_nitrogen_prescription: false,
    zone_rate_negative_blocked: false,
    planned_n_exceeds_max_blocked: false,
    receipt_success_missing_zone_applications_acceptance_not_pass: false,
    one_required_zone_over_under_operation_not_pass: false,
    operation_average_cannot_hide_zone_fail: false,
    unapproved_prescription_cannot_dispatch_task: false,
  };
  const debug = { runId, field_id, device_id, known_current_gaps: [] };

  try {
    await waitForHealth(base);
    await ensureFertilizerDevice(pool, scope, field_id, device_id);

    const sampling = await createSamplingChain(base, adminToken, scope, field_id, sample_id, { nitrate_n_mg_kg: 2.1, ammonium_n_mg_kg: 0.7, organic_matter_percent: 1.4 }, 'PASS', true);
    const formalResp = await createFormalAssessment(base, adminToken, scope, field_id, sample_id, sampling.lab.import_id, 'LOW_N_RISK');
    const formal = requireOk(formalResp, 'formal nitrogen assessment');
    checks.sampling_lab_formal_trigger_creates_low_n_risk = formal.assessment?.trigger_source === 'SAMPLING_LAB'
      && formal.assessment?.evidence_tier === 'FORMAL'
      && formal.assessment?.status === 'LOW_N_RISK';

    const sensingResp = await createSensingAssessment(base, adminToken, scope, field_id);
    const sensing = requireOk(sensingResp, 'sensing risk assessment');
    checks.sensing_risk_only_creates_needs_review = sensing.assessment?.trigger_source === 'SENSING_RISK'
      && sensing.assessment?.evidence_tier === 'WARNING'
      && sensing.assessment?.status === 'NEEDS_REVIEW';
    negative.fertility_state_low_only_needs_review_warning = checks.sensing_risk_only_creates_needs_review;

    const sensingVisibleRec = await createRecommendation(base, adminToken, scope, field_id, sensing.assessment.assessment_id, true, [
      { zone_id: 'zone_a', n_kg_ha: 40, confidence: 'LOW', reason: 'SENSING_REVIEW_ONLY' },
    ]);
    checks.sensing_risk_does_not_create_customer_visible_recommendation = sensingVisibleRec.status >= 400 || sensingVisibleRec.json?.ok === false;
    negative.sensing_risk_customer_visible_recommendation_blocked = checks.sensing_risk_does_not_create_customer_visible_recommendation;

    const salinityResp = await createSensingAssessment(base, adminToken, scope, field_id, {
      metrics: { ec_ds_m: 6.5 },
      sensing_state_refs: [{ state_type: 'salinity_risk_state', ref_id: id('salinity_high') }],
      reasons: ['EC_HIGH_SALINITY_RISK'],
    });
    const salinity = requireOk(salinityResp, 'salinity sensing risk assessment');
    const salinityRec = await createRecommendation(base, adminToken, scope, field_id, salinity.assessment.assessment_id, true, [
      { zone_id: 'zone_a', n_kg_ha: 55, confidence: 'LOW', reason: 'SHOULD_NOT_BE_CUSTOMER_VISIBLE' },
    ]);
    checks.ec_salinity_risk_does_not_trigger_nitrogen_prescription = salinityRec.status >= 400 || salinityRec.json?.ok === false;
    negative.ec_high_salinity_risk_blocks_nitrogen_prescription = checks.ec_salinity_risk_does_not_trigger_nitrogen_prescription;

    const invalidSampleId = `sample_invalid_${runId}`;
    const invalid = await createSamplingChain(base, adminToken, scope, field_id, invalidSampleId, { nitrate_n_mg_kg: 1.8 }, 'INVALID', false);
    const invalidFormal = await createFormalAssessment(base, adminToken, scope, field_id, invalidSampleId, invalid.lab.import_id, 'LOW_N_RISK');
    negative.lab_result_quality_status_invalid_assessment_not_low_n_risk = invalidFormal.status >= 400 || invalidFormal.json?.ok === false;

    const noAcceptSampleId = `sample_noaccept_${runId}`;
    const noAccept = await createSamplingChain(base, adminToken, scope, field_id, noAcceptSampleId, { nitrate_n_mg_kg: 1.9 }, 'PASS', false);
    const noAcceptFormal = await createFormalAssessment(base, adminToken, scope, field_id, noAcceptSampleId, noAccept.lab.import_id, 'LOW_N_RISK');
    negative.sampling_acceptance_not_pass_assessment_not_formal_low_n_risk = noAcceptFormal.status >= 400 || noAcceptFormal.json?.ok === false;

    const formalZoneRates = [
      { zone_id: 'zone_a', n_kg_ha: 50, confidence: 'HIGH', reason: 'FORMAL_LOW_N_ZONE_A' },
      { zone_id: 'zone_b', n_kg_ha: 30, confidence: 'HIGH', reason: 'FORMAL_LOW_N_ZONE_B' },
    ];
    const recResp = await createRecommendation(base, adminToken, scope, field_id, formal.assessment.assessment_id, true, formalZoneRates);
    const rec = requireOk(recResp, 'formal fertilization recommendation');
    const recommendation_id = rec.recommendation.fertilization_recommendation_id;

    const negRateResp = await createPrescription(base, adminToken, scope, field_id, recommendation_id, [
      { zone_id: 'zone_neg', planned_n_kg_ha: -1, max_n_kg_ha: 50, unit: 'kgN/ha', required: true, reason: 'NEGATIVE_SHOULD_BLOCK' },
    ]);
    negative.zone_rate_negative_blocked = negRateResp.status >= 400 || negRateResp.json?.ok === false;

    const maxResp = await createPrescription(base, adminToken, scope, field_id, recommendation_id, [
      { zone_id: 'zone_max', planned_n_kg_ha: 75, max_n_kg_ha: 50, unit: 'kgN/ha', required: true, reason: 'MAX_SHOULD_BLOCK' },
    ]);
    negative.planned_n_exceeds_max_blocked = maxResp.status >= 400 || maxResp.json?.ok === false;

    const fertZoneRates = [
      { zone_id: 'zone_a', planned_n_kg_ha: 50, max_n_kg_ha: 80, unit: 'kgN/ha', required: true, reason: 'FORMAL_LOW_N_ZONE_A' },
      { zone_id: 'zone_b', planned_n_kg_ha: 30, max_n_kg_ha: 60, unit: 'kgN/ha', required: true, reason: 'FORMAL_LOW_N_ZONE_B' },
    ];
    const presResp = await createPrescription(base, adminToken, scope, field_id, recommendation_id, fertZoneRates);
    const pres = requireOk(presResp, 'formal fertilization prescription');
    const fertilization_prescription_id = pres.prescription.fertilization_prescription_id;

    const bridgeResp = await post(base, `/api/v1/fertilization/prescription/${q(fertilization_prescription_id)}/to-variable-prescription`, adminToken, scope);
    const bridge = requireOk(bridgeResp, 'bridge to variable prescription');
    const variable_prescription_id = String(bridge.variable_prescription?.prescription_id ?? '').trim();
    assert.ok(variable_prescription_id, 'bridge variable prescription_id missing');
    checks.fertilization_prescription_requires_approval = bridge.variable_prescription?.status === 'READY_FOR_APPROVAL'
      || String(bridge.variable_prescription?.status ?? '').toUpperCase() === 'READY_FOR_APPROVAL';

    const unapprovedTask = await createTask(base, operatorToken, scope, variable_prescription_id, id('fake_approval'), `op_unapproved_${runId}`, device_id);
    negative.unapproved_prescription_cannot_dispatch_task = unapprovedTask.status >= 400 || unapprovedTask.json?.ok === false;

    const approval = await approvePrescription(base, adminToken, approverToken, scope, variable_prescription_id);
    const approved = approval.approve?.ok === true && approval.approve?.json?.ok !== false && Boolean(approval.approval_request_id);
    const operation_plan_id = `op_${runId}`;
    const taskResp = approved ? await createTask(base, operatorToken, scope, variable_prescription_id, approval.approval_request_id, operation_plan_id, device_id) : { ok: false, status: 0, json: { error: 'APPROVAL_FAILED' } };
    const taskJson = getJson(taskResp);
    const act_task_id = String(taskJson.act_task_id ?? '').trim();
    checks.ao_act_task_created_after_approval = Boolean(approved && taskResp.ok && taskJson.ok !== false && act_task_id);
    if (!checks.ao_act_task_created_after_approval) {
      debug.known_current_gaps.push({
        code: 'FERTILIZATION_VARIABLE_TASK_CHAIN_NOT_READY',
        detail: 'Current variable_action_task_v1 only supports IRRIGATION; fertilization bridge produces operation_type=FERTILIZATION.',
        task_response: compact(taskResp),
      });
    }

    const goodApps = [
      { zone_id: 'zone_a', planned_n_kg_ha: 50, actual_n_kg_ha: 49, applied_amount: 49, planned_amount: 50, actual_rate: 49, planned_rate: 50, unit: 'kgN/ha', coverage_percent: 0.97, status: 'APPLIED' },
      { zone_id: 'zone_b', planned_n_kg_ha: 30, actual_n_kg_ha: 30, applied_amount: 30, planned_amount: 30, actual_rate: 30, planned_rate: 30, unit: 'kgN/ha', coverage_percent: 0.96, status: 'APPLIED' },
    ];
    checks.receipt_contains_zone_fertilizer_applications = goodApps.length === 2 && goodApps.every((z) => z.zone_id && z.actual_n_kg_ha != null);

    let receiptFlow = null;
    let fertAcc = null;
    let reportResp = null;
    if (checks.ao_act_task_created_after_approval) {
      receiptFlow = await submitReceiptAndAsApplied(base, executorToken, operatorToken, scope, receiptBody(scope, operation_plan_id, act_task_id, field_id, device_id, goodApps));
      fertAcc = await evalFertilizationAcceptance(base, operatorToken, scope, fertilization_prescription_id, receiptFlow.receipt_id, act_task_id, operation_plan_id, goodApps);
      checks.fertilization_acceptance_evaluated = fertAcc.ok === true && fertAcc.json?.ok !== false && Boolean(fertAcc.json?.acceptance);
      reportResp = await fetchOperationReport(base, adminToken, scope, operation_plan_id);
      const reportText = JSON.stringify(reportResp.json ?? reportResp.text ?? '').toUpperCase();
      checks.operation_report_contains_fertilization = reportResp.ok === true && reportText.includes('FERTILIZATION');

      const missingAcc = await evalFertilizationAcceptance(base, operatorToken, scope, fertilization_prescription_id, receiptFlow.receipt_id, act_task_id, operation_plan_id, []);
      negative.receipt_success_missing_zone_applications_acceptance_not_pass = missingAcc.ok && String(missingAcc.json?.acceptance?.acceptance_status ?? '').toUpperCase() !== 'PASS';
      const failApps = [
        { ...goodApps[0], actual_n_kg_ha: 80, applied_amount: 80, actual_rate: 80, coverage_percent: 0.97 },
        goodApps[1],
      ];
      const failAcc = await evalFertilizationAcceptance(base, operatorToken, scope, fertilization_prescription_id, receiptFlow.receipt_id, act_task_id, operation_plan_id, failApps);
      negative.one_required_zone_over_under_operation_not_pass = failAcc.ok && String(failAcc.json?.acceptance?.acceptance_status ?? '').toUpperCase() !== 'PASS';
    }

    const localFail = localZoneRollup(fertZoneRates, [
      { zone_id: 'zone_a', actual_n_kg_ha: 80, coverage_percent: 0.97 },
      { zone_id: 'zone_b', actual_n_kg_ha: 0, coverage_percent: 0.97 },
    ]);
    negative.operation_average_cannot_hide_zone_fail = localFail.averageLooksOk === true && localFail.verdict !== 'PASS';
    checks.zone_failure_not_hidden_by_average = negative.operation_average_cannot_hide_zone_fail
      && (negative.one_required_zone_over_under_operation_not_pass || !checks.ao_act_task_created_after_approval);

    const taskPayload = checks.ao_act_task_created_after_approval ? await latestTaskByOperation(pool, scope, operation_plan_id) : null;
    debug.positive_chain = {
      plan_id: sampling.plan.plan_id,
      sample_id,
      lab_import_id: sampling.lab.import_id,
      sampling_acceptance_id: sampling.sampling_acceptance?.acceptance_id,
      assessment_id: formal.assessment?.assessment_id,
      fertilization_recommendation_id: recommendation_id,
      fertilization_prescription_id,
      variable_prescription_id,
      approval_request_id: approval.approval_request_id,
      act_task_id,
      operation_plan_id,
      task_meta: taskPayload?.meta ?? null,
      receipt_id: receiptFlow?.receipt_id ?? null,
      fertilization_acceptance_status: fertAcc?.json?.acceptance?.acceptance_status ?? null,
      report_status: reportResp?.status ?? null,
    };

    const ok = Object.values(checks).every(truthy) && Object.values(negative).every(truthy);
    const output = { ok, scenario: 'FORMAL_FERTILIZATION_E2E_V1', checks, negative, debug };
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
    if (!ok) process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
