const { randomUUID } = require('node:crypto');
const { Pool } = require('pg');
const { assert, env, fetchJson, requireOk } = require('./_common.cjs');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const runId = () => `fsr_${randomUUID().replace(/-/g, '')}`;
const sampleId = (prefix) => `${prefix}_${Date.now()}_${randomUUID().replace(/-/g, '').slice(0, 8)}`;
const PASS_COVERAGE = 0.9;
const MAX_DEVIATION = 0.1;

function isPass(v) { return String(v ?? '').trim().toUpperCase() === 'PASS'; }
function pctDeviation(planned, actual) { return planned > 0 ? Math.abs(actual - planned) / planned : 1; }
function zoneResult(app) {
  if (!app || app.status === 'SKIPPED') return 'FAIL';
  if (Number(app.coverage_percent) < PASS_COVERAGE) return 'FAIL';
  if (pctDeviation(Number(app.planned_rate), Number(app.actual_rate)) > MAX_DEVIATION) return 'FAIL';
  if (!app.pre_sensing_ref || !app.post_sensing_ref) return 'FAIL';
  return 'PASS';
}
function buildZoneMatrix(zoneRates, zoneApps, policy = 'ALL_REQUIRED_PASS') {
  return zoneRates.map((z) => {
    const app = zoneApps.find((x) => x.zone_id === z.zone_id) ?? null;
    const planned = Number(z.planned_amount ?? z.planned_rate ?? 0);
    const actual = Number(app?.applied_amount ?? app?.actual_rate ?? 0);
    const row = {
      zone_id: z.zone_id,
      planned_rate: planned,
      actual_rate: actual,
      coverage_percent: Number(app?.coverage_percent ?? 0),
      deviation_percent: Number(pctDeviation(planned, actual).toFixed(4)),
      pre_sensing_ref: app?.pre_sensing_ref ?? null,
      post_sensing_ref: app?.post_sensing_ref ?? null,
      evidence_sufficiency: app?.pre_sensing_ref && app?.post_sensing_ref ? 'PASS' : 'FAIL',
      zone_acceptance_result: 'FAIL',
      operation_rollup_policy: policy,
    };
    row.zone_acceptance_result = zoneResult(row);
    return row;
  });
}
function rollup(zoneMatrix, policy = 'ALL_REQUIRED_PASS', opts = {}) {
  if (policy === 'CRITICAL_ZONE_REQUIRED') {
    const critical = new Set(opts.critical_zone_ids ?? []);
    if (zoneMatrix.some((z) => critical.has(z.zone_id) && z.zone_acceptance_result !== 'PASS')) return 'FAIL';
  }
  if (policy === 'PARTIAL_ALLOWED') {
    const ratio = zoneMatrix.filter((z) => z.zone_acceptance_result === 'PASS').length / Math.max(1, zoneMatrix.length);
    return ratio >= Number(opts.threshold ?? 0.8) ? 'PARTIAL' : 'FAIL';
  }
  return zoneMatrix.every((z) => z.zone_acceptance_result === 'PASS') ? 'PASS' : 'PARTIAL';
}
function pickRecommendation(json) {
  return json?.recommendations?.[0]
    ?? json?.recommendation
    ?? json?.item
    ?? json?.items?.[0]
    ?? null;
}
async function health(base) {
  let last = null;
  for (let i = 0; i < 20; i += 1) {
    try {
      const a = await fetchJson(`${base}/api/v1/health`, { method: 'GET' });
      if (a.ok) return;
      const b = await fetchJson(`${base}/api/health`, { method: 'GET' });
      if (b.ok) return;
      last = new Error(`health ${a.status}/${b.status}`);
    } catch (e) { last = e; }
    await sleep(1000);
  }
  throw last ?? new Error('health failed');
}
async function ensureDevice(pool, scope, field_id, device_id) {
  await pool.query(`ALTER TABLE device_index_v1 ADD COLUMN IF NOT EXISTS device_mode TEXT NOT NULL DEFAULT 'physical'`).catch(() => undefined);
  await pool.query(`CREATE TABLE IF NOT EXISTS device_capability(tenant_id TEXT NOT NULL,device_id TEXT NOT NULL,capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,updated_ts_ms BIGINT NOT NULL,PRIMARY KEY(tenant_id,device_id))`);
  await pool.query(`CREATE TABLE IF NOT EXISTS device_binding_index_v1(tenant_id TEXT NOT NULL,device_id TEXT NOT NULL,field_id TEXT NOT NULL,bound_ts_ms BIGINT NULL,PRIMARY KEY(tenant_id,device_id,field_id))`);
  await pool.query(`CREATE TABLE IF NOT EXISTS device_status_index_v1(tenant_id TEXT NOT NULL,project_id TEXT NULL,group_id TEXT NULL,field_id TEXT NULL,device_id TEXT NOT NULL,status TEXT NULL,last_telemetry_ts_ms BIGINT NULL,last_heartbeat_ts_ms BIGINT NULL,battery_percent INTEGER NULL,rssi_dbm INTEGER NULL,fw_ver TEXT NULL,updated_ts_ms BIGINT NOT NULL,PRIMARY KEY(tenant_id,device_id))`);
  await pool.query(`ALTER TABLE device_status_index_v1 ADD COLUMN IF NOT EXISTS status TEXT NULL`).catch(() => undefined);
  await pool.query(`ALTER TABLE device_status_index_v1 ADD COLUMN IF NOT EXISTS field_id TEXT NULL`).catch(() => undefined);
  const ts = Date.now();
  await pool.query(`INSERT INTO device_index_v1(tenant_id,device_id,display_name,device_mode,created_ts_ms) VALUES($1,$2,$3,'physical',$4) ON CONFLICT(tenant_id,device_id) DO UPDATE SET display_name=EXCLUDED.display_name,device_mode='physical'`, [scope.tenant_id, device_id, `Formal variable ${device_id}`, ts]);
  await pool.query(`INSERT INTO device_capability VALUES($1,$2,$3::jsonb,$4) ON CONFLICT(tenant_id,device_id) DO UPDATE SET capabilities=EXCLUDED.capabilities,updated_ts_ms=EXCLUDED.updated_ts_ms`, [scope.tenant_id, device_id, JSON.stringify([
    'telemetry.soil_moisture',
    'telemetry.inlet_flow_lpm',
    'telemetry.outlet_flow_lpm',
    'telemetry.pressure_drop_kpa',
    'telemetry.water_pressure',
    'device.irrigation.valve.open',
  ]), ts]);
  await pool.query(`INSERT INTO device_binding_index_v1 VALUES($1,$2,$3,$4) ON CONFLICT(tenant_id,device_id,field_id) DO UPDATE SET bound_ts_ms=EXCLUDED.bound_ts_ms`, [scope.tenant_id, device_id, field_id, ts]);
  await pool.query(`INSERT INTO device_status_index_v1(tenant_id,project_id,group_id,field_id,device_id,status,last_telemetry_ts_ms,last_heartbeat_ts_ms,battery_percent,rssi_dbm,fw_ver,updated_ts_ms) VALUES($1,$2,$3,$4,$5,'ONLINE',$6,$6,82,-55,'formal-variable-e2e',$6) ON CONFLICT(tenant_id,device_id) DO UPDATE SET project_id=EXCLUDED.project_id,group_id=EXCLUDED.group_id,field_id=EXCLUDED.field_id,status='ONLINE',last_telemetry_ts_ms=EXCLUDED.last_telemetry_ts_ms,last_heartbeat_ts_ms=EXCLUDED.last_heartbeat_ts_ms,updated_ts_ms=EXCLUDED.updated_ts_ms`, [scope.tenant_id, scope.project_id, scope.group_id, field_id, device_id, ts - 30000]);
}
async function postZoneSamples(base, token, scope, field_id, device_id, zone_id, phase, formal_scenario_run_id, sampleWindow) {
  const start = Number(sampleWindow?.startTs ?? Date.now() - 60_000 - 18 * 20 * 60 * 1000);
  const intervalMs = Number(sampleWindow?.intervalMs ?? 20 * 60 * 1000);
  const pointCount = Number(sampleWindow?.pointCount ?? 19);
  const refs = [];
  for (let i = 0; i < pointCount; i += 1) {
    const ts_ms = start + i * intervalMs;
    const metrics = phase === 'pre'
      ? [
        { metric: 'soil_moisture', value: 0.185 + i * 0.0003, unit: 'm3/m3' },
        { metric: 'inlet_flow_lpm', value: 36.1 + i * 0.01, unit: 'L/min' },
        { metric: 'outlet_flow_lpm', value: 20.1 + i * 0.01, unit: 'L/min' },
        { metric: 'pressure_drop_kpa', value: 38.1 + i * 0.01, unit: 'kPa' },
      ]
      : [
        { metric: 'soil_moisture', value: 0.265 + i * 0.0004, unit: 'm3/m3' },
        { metric: 'inlet_flow_lpm', value: 32.8 + i * 0.01, unit: 'L/min' },
        { metric: 'outlet_flow_lpm', value: 24.8 + i * 0.01, unit: 'L/min' },
        { metric: 'pressure_drop_kpa', value: 14.8 + i * 0.01, unit: 'kPa' },
      ];
    for (const m of metrics) {
      const body = {
        tenant_id: scope.tenant_id, project_id: scope.project_id, group_id: scope.group_id,
        sample_id: sampleId(`${phase}_${zone_id}_${m.metric}_${i}`), sensor_id: device_id, field_id,
        ts_ms, metric: m.metric, value: m.value, unit: m.unit, qc_quality: 'ok', source: i % 2 === 0 ? 'device' : 'gateway',
        interpolated: false, synthetic: false,
        payload: { ...scope, field_id, device_id, zone_id, phase, formal_scenario_run_id, formal_scenario: 'FORMAL_VARIABLE_OPERATION_E2E_V1' },
      };
      requireOk(await fetchJson(`${base}/api/v1/sensing/raw-samples`, { method: 'POST', token, body }), `zone sample ${zone_id}/${phase}/${m.metric}/${i}`);
      refs.push(body.sample_id);
    }
  }
  return refs[0];
}
async function createZones(base, token, scope, field_id, zones) {
  for (const z of zones) {
    await fetchJson(`${base}/api/v1/fields/${encodeURIComponent(field_id)}/zones`, { method: 'POST', token, body: { ...scope, ...z, zone_type: 'IRRIGATION_ZONE', geometry: { type: 'Polygon', coordinates: [] }, area_ha: 2.5 } });
  }
  const read = requireOk(await fetchJson(`${base}/api/v1/fields/${encodeURIComponent(field_id)}/zones?tenant_id=${scope.tenant_id}&project_id=${scope.project_id}&group_id=${scope.group_id}`, { method: 'GET', token }), 'read zones');
  const ids = new Set((read.items ?? []).map((x) => x.zone_id));
  zones.forEach((z) => assert.ok(ids.has(z.zone_id), `zone missing: ${z.zone_id}`));
}
async function ensureCropContextViaProgram(base, token, scope, field_id, season_id, run) {
  const body = {
    tenant_id: scope.tenant_id,
    project_id: scope.project_id,
    group_id: scope.group_id,
    program_id: `prg_${run}`,
    field_id,
    season_id,
    crop_code: 'corn',
    status: 'ACTIVE',
    goal_profile: { yield_priority: 'high', quality_priority: 'medium', residue_priority: 'low', water_saving_priority: 'medium', cost_priority: 'medium' },
    constraints: { forbid_pesticide_classes: [], forbid_fertilizer_types: [], max_irrigation_mm_per_day: null, manual_approval_required_for: [], allow_night_irrigation: true, max_irrigation_rounds_per_day: 3 },
    budget: { max_cost_total: null, currency: 'USD' },
    execution_policy: { mode: 'approval_required', auto_execute_allowed_task_types: [] },
  };
  return requireOk(await fetchJson(`${base}/api/v1/programs`, { method: 'POST', token, body }), 'field program create');
}
async function approvePrescription(base, token, approverToken, scope, prescription_id) {
  const sub = requireOk(await fetchJson(`${base}/api/v1/prescriptions/${encodeURIComponent(prescription_id)}/submit-approval`, { method: 'POST', token, body: scope }), 'submit approval');
  const approval_request_id = String(sub.approval_request_id ?? sub.request_id ?? sub.approval_id ?? '').trim();
  if (!approval_request_id) {
    assert.fail(`approval_request_id missing: ${JSON.stringify({
      ok: sub?.ok ?? null,
      keys: Object.keys(sub ?? {}),
      prescription_id,
      approval_request_id: sub?.approval_request_id ?? null,
      request_id: sub?.request_id ?? null,
      approval_id: sub?.approval_id ?? null,
      body: sub,
    })}`);
  }
  const appr = await fetchJson(`${base}/api/v1/approvals/approve`, { method: 'POST', token: approverToken, body: { ...scope, request_id: approval_request_id, decision: 'APPROVE' } });
  requireOk(appr, 'approve');
  return approval_request_id;
}
async function createTask(base, token, scope, prescription_id, approval_request_id, operation_plan_id, device_id) {
  return requireOk(await fetchJson(`${base}/api/v1/actions/task/from-variable-prescription`, { method: 'POST', token, body: { ...scope, prescription_id, approval_request_id, operation_plan_id, device_id } }), 'variable task');
}
async function taskPayload(pool, scope, operation_plan_id) {
  const q = await pool.query(`SELECT record_json::jsonb AS r FROM facts WHERE (record_json::jsonb->>'type')='ao_act_task_v0' AND (record_json::jsonb#>>'{payload,tenant_id}')=$1 AND (record_json::jsonb#>>'{payload,project_id}')=$2 AND (record_json::jsonb#>>'{payload,group_id}')=$3 AND (record_json::jsonb#>>'{payload,operation_plan_id}')=$4 ORDER BY occurred_at DESC LIMIT 1`, [scope.tenant_id, scope.project_id, scope.group_id, operation_plan_id]);
  return q.rows?.[0]?.r?.payload ?? {};
}
function receiptBody(scope, operation_plan_id, act_task_id, field_id, device_id, zoneApps, status = 'executed') {
  return {
    ...scope, operation_plan_id, act_task_id,
    executor_id: { kind: 'script', id: 'formal_variable_operation_e2e', namespace: 'agronomy_acceptance' },
    execution_time: { start_ts: Date.now() - 1200000, end_ts: Date.now() },
    execution_coverage: { kind: 'field', ref: field_id },
    resource_usage: { fuel_l: null, electric_kwh: null, water_l: 440, chemical_ml: null },
    logs_refs: [{ kind: 'formal_variable_log', ref: `variable_${act_task_id}` }],
    status, constraint_check: { violated: false, violations: [] },
    observed_parameters: { duration_sec: 1200, duration_min: 20, amount: 44, coverage_percent: 97 },
    meta: { command_id: act_task_id, idempotency_key: sampleId(`variable_${act_task_id}`), variable_execution: { mode: 'VARIABLE_BY_ZONE', zone_applications: zoneApps } },
  };
}
async function submitReceiptEval(base, token, operatorToken, scope, body) {
  const receipt = requireOk(await fetchJson(`${base}/api/v1/actions/receipt`, { method: 'POST', token, body }), 'receipt');
  const receipt_id = String(receipt.receipt_id ?? receipt.fact_id ?? '').trim();
  const asxResp = await fetchJson(`${base}/api/v1/as-executed/from-receipt`, { method: 'POST', token, body: { ...scope, task_id: body.act_task_id, receipt_id } });
  const asx = requireOk(asxResp, 'as-executed');
  const acc = await fetchJson(`${base}/api/v1/acceptance/evaluate`, { method: 'POST', token: operatorToken, body: { ...scope, act_task_id: body.act_task_id, receipt_id } });
  return { receipt, receipt_id, asx, acc };
}
async function stage1Summary(pool, scope, field_id) {
  const q = await pool.query(
    `SELECT *
       FROM field_sensing_summary_stage1_v1
      WHERE tenant_id=$1
        AND project_id=$2
        AND group_id=$3
        AND field_id=$4
      ORDER BY updated_ts_ms DESC
      LIMIT 1`,
    [scope.tenant_id, scope.project_id, scope.group_id, field_id],
  ).catch(() => ({ rows: [] }));
  return q.rows?.[0] ?? null;
}
async function fetchLatestAcceptance(pool, scope, act_task_id) {
  const q = await pool.query(`SELECT record_json::jsonb AS r FROM facts WHERE (record_json::jsonb->>'type')='acceptance_result_v1' AND (record_json::jsonb#>>'{payload,tenant_id}')=$1 AND (record_json::jsonb#>>'{payload,project_id}')=$2 AND (record_json::jsonb#>>'{payload,group_id}')=$3 AND (record_json::jsonb#>>'{payload,act_task_id}')=$4 ORDER BY occurred_at DESC LIMIT 1`, [scope.tenant_id, scope.project_id, scope.group_id, act_task_id]).catch(() => ({ rows: [] }));
  return q.rows?.[0]?.r?.payload ?? {};
}
async function createRoi(base, token, scope, asx) {
  const as_executed_id = String(asx.as_executed?.as_executed_id ?? '').trim();
  if (!as_executed_id) return [];
  const fromResp = await fetchJson(`${base}/api/v1/roi-ledger/from-as-executed`, { method: 'POST', token, body: { ...scope, as_executed_id } });
  if (!fromResp.ok || fromResp.json?.ok === false) {
    assert.fail(`roi from-as-executed failed: ${JSON.stringify({ as_executed_id, status: fromResp.status, body: fromResp.json ?? fromResp.text ?? null })}`);
  }
  const got = await fetchJson(`${base}/api/v1/roi-ledger/by-as-executed/${encodeURIComponent(as_executed_id)}?tenant_id=${scope.tenant_id}&project_id=${scope.project_id}&group_id=${scope.group_id}`, { method: 'GET', token });
  return { as_executed_id, fromResp: fromResp.json ?? fromResp.text ?? null, rows: (got.json?.roi_ledgers ?? got.roi_ledgers ?? []) };
}
async function fetchOperationReport(base, token, scope, operation_plan_id) {
  const resp = await fetchJson(
    `${base}/api/v1/reports/operation/${encodeURIComponent(operation_plan_id)}?tenant_id=${encodeURIComponent(scope.tenant_id)}&project_id=${encodeURIComponent(scope.project_id)}&group_id=${encodeURIComponent(scope.group_id)}`,
    { method: 'GET', token },
  );
  if (!resp.ok) {
    assert.fail(`operation report failed: ${JSON.stringify({
      status: resp.status,
      body: resp.json ?? resp.text ?? null,
      operation_plan_id,
      request_url: `${base}/api/v1/reports/operation/${encodeURIComponent(operation_plan_id)}?tenant_id=${encodeURIComponent(scope.tenant_id)}&project_id=${encodeURIComponent(scope.project_id)}&group_id=${encodeURIComponent(scope.group_id)}`,
    })}`);
  }
  return resp.json?.operation_report_v1 ?? null;
}
(async () => {
  const base = env('BASE_URL', process.env.GEOX_BASE_URL || 'http://127.0.0.1:3001');
  const adminToken = env('ADMIN_TOKEN', env('AO_ACT_TOKEN', 'admin_token'));
  const approverToken = env('APPROVER_TOKEN', 'approver_token');
  const operatorToken = env('OPERATOR_TOKEN', 'operator_token');
  const executorToken = env('EXECUTOR_TOKEN', 'executor_token');
  const pool = new Pool({ connectionString: env('DATABASE_URL', 'postgres://postgres:postgres@127.0.0.1:5432/geox') });
  const scope = { tenant_id: env('TENANT_ID', 'tenantA'), project_id: env('PROJECT_ID', 'projectA'), group_id: env('GROUP_ID', 'groupA') };
  try {
    await health(base);
    const run = runId();
    const field_id = `field_${run}`;
    const season_id = `season_${run}`;
    const device_id = `dev_${run}`;
    const zones = [{ zone_id: 'zone_a', zone_name: 'North required zone' }, { zone_id: 'zone_b', zone_name: 'South required zone' }];
    await ensureDevice(pool, scope, field_id, device_id);
    await createZones(base, adminToken, scope, field_id, zones);
    await ensureCropContextViaProgram(base, adminToken, scope, field_id, season_id, run);
    const endTs = Date.now() - 60_000;
    const intervalMs = 20 * 60 * 1000;
    const pointCount = 19;
    const startTs = endTs - (pointCount - 1) * intervalMs;
    const sampleWindow = { startTs, intervalMs, pointCount, endTs };

    const preA = await postZoneSamples(base, adminToken, scope, field_id, device_id, 'zone_a', 'pre', run, sampleWindow);
    const preB = await postZoneSamples(base, adminToken, scope, field_id, device_id, 'zone_b', 'pre', run, sampleWindow);
    const summary = await stage1Summary(pool, scope, field_id);
    const recJson = requireOk(await fetchJson(`${base}/api/v1/recommendations/generate`, { method: 'POST', token: adminToken, body: { ...scope, field_id, season_id, device_id, crop_code: 'corn' } }), 'recommendation');
    const recommendation = pickRecommendation(recJson) ?? {};
    if (!recommendation.recommendation_id) {
      const compactBody = {
        ok: recJson?.ok ?? null,
        keys: Object.keys(recJson ?? {}),
        fact_ids: recJson?.fact_ids ?? null,
        recommendations_len: Array.isArray(recJson?.recommendations) ? recJson.recommendations.length : null,
        field_id,
        run_id: run,
        evidence_snapshot: {
          evidence_sufficiency: summary?.evidence_sufficiency ?? null,
          formal_coverage_ratio: Number(summary?.formal_coverage_ratio ?? summary?.coverage_ratio ?? 0),
          trigger_metric_evidence: summary?.trigger_metric_evidence ?? null,
          max_gap_ms: summary?.max_gap_ms ?? null,
        },
      };
      assert.fail(`recommendation missing: ${JSON.stringify(compactBody)}`);
    }
    const zoneRates = [
      { zone_id: 'zone_a', operation_type: 'IRRIGATION', planned_amount: 25, unit: 'mm', required: true },
      { zone_id: 'zone_b', operation_type: 'IRRIGATION', planned_amount: 15, unit: 'mm', required: true },
    ];
    const prc = requireOk(await fetchJson(`${base}/api/v1/prescriptions/variable/from-recommendation`, { method: 'POST', token: adminToken, body: { ...scope, recommendation_id: recommendation.recommendation_id, field_id, season_id, crop_id: 'corn', variable_plan: { mode: 'VARIABLE_BY_ZONE', zone_rates: zoneRates } } }), 'variable prescription');
    const prescription_id = String(prc.prescription?.prescription_id ?? '').trim();
    const approval_request_id = await approvePrescription(base, adminToken, approverToken, scope, prescription_id);
    const operation_plan_id = `op_${run}`;
    const task = await createTask(base, operatorToken, scope, prescription_id, approval_request_id, operation_plan_id, device_id);
    const act_task_id = String(task.act_task_id ?? '').trim();
    const tp = await taskPayload(pool, scope, operation_plan_id);
    const task_not_auto_acked = String(tp?.meta?.ack_status ?? '') === 'ACK_REQUIRED' && String(tp?.meta?.task_lifecycle_status ?? '') === 'READY_TO_DISPATCH';
    const postA = await postZoneSamples(base, adminToken, scope, field_id, device_id, 'zone_a', 'post', run, sampleWindow);
    const postB = await postZoneSamples(base, adminToken, scope, field_id, device_id, 'zone_b', 'post', run, sampleWindow);
    const positiveApps = [
      { zone_id: 'zone_a', planned_amount: 25, applied_amount: 24, planned_rate: 25, actual_rate: 24, unit: 'mm', coverage_percent: 0.95, status: 'APPLIED', pre_sensing_ref: preA, post_sensing_ref: postA },
      { zone_id: 'zone_b', planned_amount: 15, applied_amount: 15, planned_rate: 15, actual_rate: 15, unit: 'mm', coverage_percent: 0.96, status: 'APPLIED', pre_sensing_ref: preB, post_sensing_ref: postB },
    ];
    const pos = await submitReceiptEval(base, executorToken, operatorToken, scope, receiptBody(scope, operation_plan_id, act_task_id, field_id, device_id, positiveApps));
    const accPayload = await fetchLatestAcceptance(pool, scope, act_task_id);
    const zone_matrix = buildZoneMatrix(zoneRates, positiveApps);
    const roiResult = await createRoi(base, adminToken, scope, pos.asx);
    const roiRows = roiResult.rows ?? [];
    const roiTypes = new Set(roiRows.map((x) => String(x.roi_type ?? '')));
    const asAppliedZoneApps = pos.asx?.as_applied?.application?.zone_applications ?? [];
    const asAppliedZoneDeviationComputed = Array.isArray(asAppliedZoneApps)
      && asAppliedZoneApps.length === 2
      && asAppliedZoneApps.every((z) => typeof z.deviation_percent === 'number' || typeof z.deviation_amount === 'number');
    const report = await fetchOperationReport(base, adminToken, scope, operation_plan_id);
    const reportZoneApps = report?.as_applied?.application?.zone_applications
      ?? report?.operation?.as_applied?.application?.zone_applications
      ?? report?.zone_applications
      ?? [];

    const negative = {
      zone_skip_not_full_pass: rollup(buildZoneMatrix(zoneRates, [positiveApps[0]])) !== 'PASS',
      zone_coverage_fail_visible: buildZoneMatrix(zoneRates, [{ ...positiveApps[0], coverage_percent: 0.8 }, positiveApps[1]])[0].zone_acceptance_result === 'FAIL',
      deviation_exceeded_not_pass: rollup(buildZoneMatrix(zoneRates, [{ ...positiveApps[0], applied_amount: 10, actual_rate: 10 }, positiveApps[1]])) !== 'PASS',
      missing_zone_applications_blocked: buildZoneMatrix(zoneRates, []).every((z) => z.zone_acceptance_result === 'FAIL'),
      auto_acked_blocked: task_not_auto_acked,
      zone_evidence_missing_report_downgraded: rollup(buildZoneMatrix(zoneRates, [{ ...positiveApps[0], pre_sensing_ref: null }, positiveApps[1]])) !== 'PASS',
      operation_average_required_zone_failed_not_pass: rollup(buildZoneMatrix(zoneRates, [{ ...positiveApps[0], coverage_percent: 0.5, applied_amount: 50, actual_rate: 50 }, positiveApps[1]])) !== 'PASS',
    };
    const checks = {
      management_zones_exist: true,
      appleii_evidence_pass: summary?.evidence_sufficiency === 'PASS',
      variable_recommendation_created: Boolean(recommendation.recommendation_id),
      variable_prescription_with_zone_rates: Boolean(prescription_id && Array.isArray(prc.prescription?.operation_amount?.zone_rates)),
      approval_approved: Boolean(approval_request_id),
      task_created_not_auto_acked: Boolean(act_task_id && task_not_auto_acked),
      receipt_contains_zone_applications: positiveApps.length === 2,
      as_applied_zone_deviations_computed: asAppliedZoneDeviationComputed,
      zone_level_acceptance_computed: zone_matrix.every((z) => z.zone_acceptance_result === 'PASS'),
      operation_rollup_computed: rollup(zone_matrix) === 'PASS',
      acceptance_pass_from_zone_rollup: isPass(accPayload.verdict) && rollup(zone_matrix) === 'PASS',
      roi_contains_variable_metrics: roiTypes.has('VARIABLE_WATER_SAVED') && roiTypes.has('ZONE_COMPLETION_RATE') && roiTypes.has('VARIABLE_EXECUTION_RELIABILITY'),
      report_includes_zone_level_result: Array.isArray(reportZoneApps) && reportZoneApps.length === 2,
    };
    const ok = Object.values(checks).every(Boolean) && Object.values(negative).every(Boolean);
    const zoneLevelEvidenceSummary = {
      zone_count: zone_matrix.length,
      zones_with_pre_and_post_refs: positiveApps.filter((z) => z.pre_sensing_ref && z.post_sensing_ref).length,
      zone_ids_with_complete_refs: positiveApps.filter((z) => z.pre_sensing_ref && z.post_sensing_ref).map((z) => z.zone_id),
      source: 'zone_applications.pre/post_sensing_ref',
    };
    const evidenceSnapshot = {
      evidence_sufficiency: summary?.evidence_sufficiency ?? null,
      stage1_formal_coverage_ratio: Number(summary?.formal_coverage_ratio ?? summary?.coverage_ratio ?? 0),
      stage1_trigger_metric_evidence: summary?.trigger_metric_evidence ?? null,
      stage1_max_gap_ms: summary?.max_gap_ms ?? null,
      stage1_expected_sample_interval_ms: summary?.expected_sample_interval_ms ?? null,
      stage1_supporting_metrics: summary?.supporting_metrics ?? null,
      zone_level_evidence_summary: zoneLevelEvidenceSummary,
      note: 'stage1_* fields are Stage-1 summary/debug fields and may not represent zone-level evidence directly',
      sample_window: sampleWindow,
    };
    const output = { ok, scenario: 'FORMAL_VARIABLE_OPERATION_E2E_V1', zone_matrix, checks, negative, evidence_snapshot: evidenceSnapshot };
    if (!checks.acceptance_pass_from_zone_rollup) output.acceptance_debug = { verdict: accPayload?.verdict ?? null, result: accPayload?.result ?? null, status: accPayload?.status ?? null, reason_codes: accPayload?.reason_codes ?? null, zone_results: accPayload?.zone_results ?? accPayload?.zone_matrix ?? null, operation_rollup_policy: accPayload?.operation_rollup_policy ?? null };
    if (!checks.roi_contains_variable_metrics) output.roi_debug = { as_executed_id: roiResult.as_executed_id, returned_roi_types: roiRows.map((x) => x.roi_type), from_as_executed_response: roiResult.fromResp };
    if (!checks.report_includes_zone_level_result) output.report_debug = { operation_report_v1_keys: Object.keys(report ?? {}), as_applied_keys: Object.keys(report?.as_applied ?? {}), operation_as_applied_keys: Object.keys(report?.operation?.as_applied ?? {}), zone_applications_length: Array.isArray(reportZoneApps) ? reportZoneApps.length : null };
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
    if (!ok) process.exitCode = 1;
  } finally { await pool.end(); }
})().catch((err) => { console.error(err); process.exit(1); });
