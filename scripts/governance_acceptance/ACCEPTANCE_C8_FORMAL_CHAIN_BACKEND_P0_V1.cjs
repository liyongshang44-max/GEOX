#!/usr/bin/env node
'use strict';

const { Client } = require('pg');

const PROJECT_ID = 'projectA';
const GROUP_ID = 'groupA';
const FORMAL_OP = 'op_plan_c8_irrigation_formal_001';
const FORMAL_ACC = 'acc_c8_irrigation_formal_001';
const FORMAL_RECEIPT = 'receipt_c8_irrigation_formal_001';
const FORMAL_TASK = 'act_c8_irrigation_formal_001';
const FORMAL_FIELD = 'field_c8_demo';
const FORMAL_REQUIREMENT = 'ireq_c8_irrigation_001';

function arg(name, fallback = null) {
  const idx = process.argv.indexOf(`--${name}`);
  return idx >= 0 ? process.argv[idx + 1] : fallback;
}

const BASE_URL = (arg('base-url') || process.env.BASE_URL || process.env.API_BASE_URL || '').replace(/\/+$/, '');
const TENANT = arg('tenant') || process.env.TENANT_ID || 'tenantA';
const TOKEN = process.env.ADMIN_TOKEN || process.env.GEOX_ACCEPTANCE_TOKEN || process.env.ACCEPTANCE_TOKEN || process.env.AO_ACT_TOKEN || process.env.GEOX_AO_ACT_TOKEN || process.env.TOKEN || 'admin_token';
const DATABASE_URL = process.env.DATABASE_URL;

function fail(message, detail) {
  console.error('[ACCEPTANCE_C8_FORMAL_CHAIN_BACKEND_P0_V1] FAIL:', message);
  if (detail !== undefined) console.error(JSON.stringify(detail, null, 2));
  process.exit(1);
}
function assert(condition, message, detail) { if (!condition) fail(message, detail); }
function nearly(actual, expected, message) { assert(Math.abs(Number(actual) - Number(expected)) < 0.0001, `${message}: expected ${expected}, got ${actual}`); }
function headers() { return { accept: 'application/json', 'content-type': 'application/json', authorization: `Bearer ${TOKEN}`, 'x-geox-token': TOKEN, 'x-geox-ao-act-token': TOKEN, 'x-ao-act-token': TOKEN }; }
async function http(path, { method = 'GET', body } = {}) {
  assert(BASE_URL, '--base-url or BASE_URL/API_BASE_URL is required');
  const requestBody = body == null ? undefined : JSON.stringify(body);
  const res = await fetch(`${BASE_URL}${path}`, { method, headers: headers(), body: requestBody });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch {}
  return { method, path, status: res.status, body: text, text, json, request_body: body ?? null };
}
function httpDetail(r) {
  return { method: r?.method, path: r?.path, status: r?.status, body: r?.json ?? r?.body ?? r?.text ?? null };
}
function scoped(extra = {}) { return { tenant_id: TENANT, project_id: PROJECT_ID, group_id: GROUP_ID, ...extra }; }
async function dbClient() {
  assert(DATABASE_URL, 'DATABASE_URL is required for backend P0 acceptance negative/idempotent DB setup');
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  return client;
}

async function assertRuntimeOpenApi() {
  const r = await http('/api/v1/openapi.json');
  assert(r.status === 200, 'runtime OpenAPI request failed', httpDetail(r));
  const paths = r.json?.paths || {};
  const schemas = r.json?.components?.schemas || {};
  assert(paths['/api/v1/field-memory/from-acceptance']?.post, 'OpenAPI missing field-memory from-acceptance POST path', paths['/api/v1/field-memory/from-acceptance']);
  assert(paths['/api/v1/roi-ledger/formalize-from-acceptance']?.post, 'OpenAPI missing ROI formalize-from-acceptance POST path', paths['/api/v1/roi-ledger/formalize-from-acceptance']);
  for (const name of ['FormalFieldMemoryFromAcceptanceRequest', 'FormalFieldMemoryFromAcceptanceResponse', 'RoiLedgerFormalizeFromAcceptanceRequest', 'RoiLedgerFormalizeFromAcceptanceResponse']) {
    assert(Boolean(schemas[name]), `OpenAPI missing schema ${name}`, Object.keys(schemas).filter((x) => x.includes('Acceptance') || x.includes('Formal')));
  }
}

async function cleanupP0Rows(client) {
  await client.query(`DELETE FROM as_applied_map_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND task_id LIKE 'p0_%'`, [TENANT, PROJECT_ID, GROUP_ID]).catch(() => {});
  await client.query(`DELETE FROM as_executed_record_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND task_id LIKE 'p0_%'`, [TENANT, PROJECT_ID, GROUP_ID]).catch(() => {});
  await client.query(`DELETE FROM facts WHERE fact_id LIKE 'p0_%'`).catch(() => {});
}

async function insertAcceptance(client, id, patch) {
  const payload = scoped({
    acceptance_id: id,
    operation_plan_id: patch.operation_plan_id || FORMAL_OP,
    operation_id: patch.operation_plan_id || FORMAL_OP,
    act_task_id: patch.act_task_id || `task_${id}`,
    field_id: patch.field_id || FORMAL_FIELD,
    verdict: 'PASS',
    formal_acceptance: true,
    formal_evidence_passed: true,
    chain_validation_passed: true,
    source_lane: 'FORMAL_OPERATION',
    is_simulated: false,
    evidence_refs: [],
    ...patch,
  });
  await client.query(
    `INSERT INTO facts (fact_id, occurred_at, source, record_json)
     VALUES ($1, now(), 'acceptance-p0-test', $2::jsonb)
     ON CONFLICT (fact_id) DO UPDATE SET record_json = EXCLUDED.record_json, occurred_at = now()`,
    [id, JSON.stringify({ type: 'acceptance_result_v1', payload })]
  );
}
async function insertReceipt(client, taskId, status, extra = {}) {
  const factId = `p0_receipt_${taskId}`;
  await client.query(
    `INSERT INTO facts (fact_id, occurred_at, source, record_json)
     VALUES ($1, now(), 'receipt-p0-test', $2::jsonb)
     ON CONFLICT (fact_id) DO UPDATE SET record_json = EXCLUDED.record_json, occurred_at = now()`,
    [factId, JSON.stringify({ type: 'ao_act_receipt_v1', payload: scoped({ receipt_id: factId, task_id: taskId, act_task_id: taskId, status, ...extra }) })]
  );
  return factId;
}
async function asExecutedFromReceipt(taskId, receiptId) {
  const r = await http('/api/v1/as-executed/from-receipt', { method: 'POST', body: scoped({ task_id: taskId, receipt_id: receiptId }) });
  assert(r.status === 200, `as-executed from receipt failed for ${taskId}`, httpDetail(r));
  return r.json.as_executed;
}
async function assertReceiptStatusMatrix(client) {
  const cases = [
    ['executed', 'CONFIRMED'], ['EXECUTED', 'CONFIRMED'], ['SUCCEEDED', 'CONFIRMED'], ['SUCCESS', 'CONFIRMED'], ['CONFIRMED', 'CONFIRMED'],
    ['not_executed', 'FAILED'], ['NOT_EXECUTED', 'FAILED'], ['FAILED', 'FAILED'], ['ERROR', 'FAILED'],
  ];
  for (const [status, expected] of cases) {
    const taskId = `p0_status_${String(status).toLowerCase()}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const receiptId = await insertReceipt(client, taskId, status);
    const ae = await asExecutedFromReceipt(taskId, receiptId);
    assert(ae.executed.status === expected, `receipt status ${status} should map to ${expected}`, ae.executed);
  }
  const failedTask = `p0_status_empty_exception_${Date.now()}`;
  const failedReceipt = await insertReceipt(client, failedTask, '', { exception: { code: 'ERR' } });
  const failed = await asExecutedFromReceipt(failedTask, failedReceipt);
  assert(failed.executed.status === 'FAILED', 'empty status + exception should map to FAILED', failed.executed);

  const insufficientTask = `p0_status_empty_${Date.now()}`;
  const insufficientReceipt = await insertReceipt(client, insufficientTask, '');
  const insufficient = await asExecutedFromReceipt(insufficientTask, insufficientReceipt);
  assert(insufficient.executed.status === 'INSUFFICIENT_RECEIPT', 'empty status without exception should map to INSUFFICIENT_RECEIPT', insufficient.executed);

  const formal = await asExecutedFromReceipt(FORMAL_TASK, FORMAL_RECEIPT);
  assert(formal.executed.status === 'CONFIRMED', 'C8 SUCCEEDED receipt should produce CONFIRMED as_executed', formal.executed);
  nearly(formal.planned?.amount, 22, 'formal as_executed planned amount');
  assert(formal.planned?.requirement_id === FORMAL_REQUIREMENT, 'formal as_executed planned requirement_id mismatch', formal.planned);
  assert(formal.planned?.amount_source?.requirement_id === FORMAL_REQUIREMENT, 'formal as_executed planned amount_source requirement mismatch', formal.planned);
  assert(formal.planned?.amount_source?.source_field === 'gross_irrigation_requirement_mm', 'formal as_executed planned amount_source source_field mismatch', formal.planned);
  nearly(formal.planned?.amount_source?.source_value_mm, 22, 'formal as_executed planned amount_source source_value_mm');
  return formal;
}
async function assertRoiFormalization(client, asExecutedId) {
  const body = scoped({ operation_plan_id: FORMAL_OP, acceptance_id: FORMAL_ACC, as_executed_id: asExecutedId });
  const first = await http('/api/v1/roi-ledger/formalize-from-acceptance', { method: 'POST', body });
  assert(first.status === 200, 'ROI formalize positive case failed', httpDetail(first));
  const rows = first.json.roi_ledgers || [];
  assert(rows.length >= 1, 'ROI formalize returned no rows', first.json);
  for (const row of rows) {
    assert(row.trust_level === 'FORMAL_ACCEPTED', 'ROI trust_level not FORMAL_ACCEPTED', row);
    assert(row.source_lane === 'FORMAL_ACCEPTANCE', 'ROI source_lane not FORMAL_ACCEPTANCE', row);
    assert(row.formal_acceptance_id === FORMAL_ACC, 'ROI formal_acceptance_id mismatch', row);
    assert(row.formal_evidence_passed === true, 'ROI formal_evidence_passed not true', row);
    assert(row.chain_validation_passed === true, 'ROI chain_validation_passed not true', row);
    assert(row.customer_visible_value === true, 'ROI customer_visible_value not true', row);
  }
  const second = await http('/api/v1/roi-ledger/formalize-from-acceptance', { method: 'POST', body });
  assert(second.status === 200, 'ROI formalize idempotent second call failed', httpDetail(second));
  assert(second.json.idempotent === true, 'ROI formalize second call should be idempotent=true', second.json);
  const count = await client.query(`SELECT as_executed_id, roi_type, count(*)::int AS count FROM roi_ledger_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND as_executed_id=$4 GROUP BY as_executed_id, roi_type HAVING count(*) > 1`, [TENANT, PROJECT_ID, GROUP_ID, asExecutedId]);
  assert(count.rows.length === 0, 'ROI formalize duplicated roi_type/as_executed rows', count.rows);

  const negatives = [
    ['p0_roi_bad_verdict', { verdict: 'FAIL' }, 422, 'ACCEPTANCE_VERDICT_NOT_PASS'],
    ['p0_roi_not_formal', { formal_acceptance: false }, 422, 'ACCEPTANCE_NOT_FORMAL'],
    ['p0_roi_no_evidence', { formal_evidence_passed: false }, 422, 'FORMAL_EVIDENCE_NOT_PASSED'],
    ['p0_roi_no_chain', { chain_validation_passed: false }, 422, 'CHAIN_VALIDATION_NOT_PASSED'],
  ];
  for (const [id, patch, status, code] of negatives) {
    await insertAcceptance(client, id, patch);
    const r = await http('/api/v1/roi-ledger/formalize-from-acceptance', { method: 'POST', body: scoped({ operation_plan_id: FORMAL_OP, acceptance_id: id, as_executed_id: asExecutedId }) });
    assert(r.status === status && r.json?.error === code, `ROI negative ${id} expected ${status}/${code}`, httpDetail(r));
  }
  const missing = await http('/api/v1/roi-ledger/formalize-from-acceptance', { method: 'POST', body: scoped({ operation_plan_id: FORMAL_OP, acceptance_id: FORMAL_ACC, as_executed_id: 'missing_as_executed_p0' }) });
  assert(missing.status === 404 && missing.json?.error === 'AS_EXECUTED_NOT_FOUND', 'ROI missing as_executed negative failed', httpDetail(missing));
}
async function assertFieldMemory(client) {
  const body = scoped({ operation_plan_id: FORMAL_OP, acceptance_id: FORMAL_ACC });
  const first = await http('/api/v1/field-memory/from-acceptance', { method: 'POST', body });
  assert(first.status === 200, 'Field Memory from acceptance positive case failed', httpDetail(first));
  assert(first.json.field_memory?.memory_lane === 'FORMAL_FIELD_MEMORY', 'field memory lane mismatch', first.json.field_memory);
  assert(first.json.field_memory?.trust_level === 'FORMAL_ACCEPTED', 'field memory trust mismatch', first.json.field_memory);
  assert(first.json.field_memory?.formal_acceptance_id === FORMAL_ACC, 'field memory formal acceptance id mismatch', first.json.field_memory);
  assert(first.json.field_memory?.customer_visible_memory === true, 'field memory customer visibility mismatch', first.json.field_memory);
  assert(first.json.field_memory?.learning_eligible === true, 'field memory learning eligibility mismatch', first.json.field_memory);

  const second = await http('/api/v1/field-memory/from-acceptance', { method: 'POST', body });
  assert(second.status === 200 && second.json.idempotent === true, 'field memory second call should be idempotent', httpDetail(second));
  const count = await client.query(`SELECT count(*)::int AS count FROM field_memory_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND formal_acceptance_id=$4 AND memory_type='FIELD_RESPONSE_MEMORY' AND memory_lane='FORMAL_FIELD_MEMORY'`, [TENANT, PROJECT_ID, GROUP_ID, FORMAL_ACC]);
  assert(Number(count.rows[0].count) === 1, 'field memory duplicated formal FIELD_RESPONSE_MEMORY', count.rows[0]);

  await insertAcceptance(client, 'p0_fm_no_chain', { chain_validation_passed: false });
  const noChain = await http('/api/v1/field-memory/from-acceptance', { method: 'POST', body: scoped({ operation_plan_id: FORMAL_OP, acceptance_id: 'p0_fm_no_chain' }) });
  assert(noChain.status === 422 && noChain.json?.error === 'CHAIN_VALIDATION_NOT_PASSED', 'field memory chain negative failed', httpDetail(noChain));

  await insertAcceptance(client, 'p0_fm_no_obs', { operation_plan_id: 'op_plan_p0_no_obs', field_id: 'p0_no_observations_field', evidence_refs: [] });
  const noObs = await http('/api/v1/field-memory/from-acceptance', { method: 'POST', body: scoped({ operation_plan_id: 'op_plan_p0_no_obs', acceptance_id: 'p0_fm_no_obs' }) });
  assert(noObs.status === 422 && noObs.json?.error === 'OBSERVATION_PAIR_NOT_FOUND', 'field memory missing observation pair negative failed', httpDetail(noObs));
}
function findBy(arr, pred) { return Array.isArray(arr) ? arr.find(pred) : null; }
async function assertIrrigationRequirementReadback(client) {
  const result = await client.query(
    `SELECT requirement_id, field_id, season_id, source_forecast_id, skill_id, net_irrigation_mm, gross_irrigation_mm, gross_irrigation_requirement_mm, unit, calculation_method, calculation_inputs_json, quality_json, source_fact_id
       FROM irrigation_requirement_index_v1
      WHERE tenant_id=$1
        AND project_id=$2
        AND group_id=$3
        AND requirement_id=$4
      LIMIT 1`,
    [TENANT, PROJECT_ID, GROUP_ID, FORMAL_REQUIREMENT]
  );
  const row = result.rows?.[0];
  assert(row, 'irrigation requirement index row missing', result.rows);
  assert(row.field_id === FORMAL_FIELD, 'irrigation requirement field_id mismatch', row);
  assert(row.source_forecast_id === 'wf_c8_irrigation_001', 'irrigation requirement forecast binding mismatch', row);
  assert(row.skill_id === 'irrigation_requirement_skill_v1', 'irrigation requirement skill_id mismatch', row);
  nearly(row.net_irrigation_mm, 18.7, 'irrigation requirement net_irrigation_mm');
  nearly(row.gross_irrigation_mm, 22, 'irrigation requirement gross_irrigation_mm');
  nearly(row.gross_irrigation_requirement_mm, 22, 'irrigation requirement gross_irrigation_requirement_mm');
  assert(row.unit === 'mm', 'irrigation requirement unit mismatch', row);
  assert(row.calculation_method === 'irrigation_requirement_skill_v1', 'irrigation requirement calculation_method mismatch', row);
  assert(row.quality_json?.status === 'SKILL_CALCULATED', 'irrigation requirement quality status mismatch', row.quality_json);
  assert(row.quality_json?.source_binding_status === 'BOUND_TO_PROJECTED_FACTS', 'irrigation requirement source binding status mismatch', row.quality_json);
  assert(row.calculation_inputs_json?.input_source === 'projected_fact_bindings_v1', 'irrigation requirement calculation input source mismatch', row.calculation_inputs_json);
  assert(row.calculation_inputs_json?.source_refs?.weather_forecast_id === 'wf_c8_irrigation_001', 'irrigation requirement weather source ref mismatch', row.calculation_inputs_json);
  assert(row.calculation_inputs_json?.source_refs?.observation_refs?.soil_moisture_percent === 'telemetry_soil_before_001', 'irrigation requirement soil source ref mismatch', row.calculation_inputs_json);
  nearly(row.calculation_inputs_json?.et0_mm_72h, 3.9, 'irrigation requirement calculation input et0_mm_72h');
  assert(String(row.source_fact_id || '').includes('irrigation_requirement_c8_001'), 'irrigation requirement source_fact_id mismatch', row);
}

async function assertOperationReport() {
  const r = await http(`/api/v1/reports/operation/${FORMAL_OP}?tenant_id=${TENANT}&project_id=${PROJECT_ID}&group_id=${GROUP_ID}`);
  assert(r.status === 200, 'operation report request failed', httpDetail(r));
  const report = r.json.operation_report_v1;
  assert(report, 'operation report missing operation_report_v1', r.json);
  const diag = report.diagnostic_inputs;
  assert(diag?.field_id === FORMAL_FIELD, 'diagnostic_inputs.field_id mismatch', diag);
  assert((diag.devices || []).length >= 2, 'diagnostic_inputs.devices must contain at least 2 devices', diag);
  assert(findBy(diag.devices, (x) => x.device_id === 'dev_soil_c8_001'), 'diagnostic_inputs missing dev_soil_c8_001', diag.devices);
  assert(findBy(diag.devices, (x) => x.device_id === 'dev_weather_station_c8_001'), 'diagnostic_inputs missing dev_weather_station_c8_001', diag.devices);
  const soil = findBy(diag.observations, (x) => x.metric === 'soil_moisture_percent');
  const rain = findBy(diag.observations, (x) => x.metric === 'forecast_rain_72h_mm');
  assert(soil, 'diagnostic_inputs missing soil_moisture_percent observation', diag.observations);
  assert(rain, 'diagnostic_inputs missing forecast_rain_72h_mm observation', diag.observations);
  nearly(soil.value, 18.4, 'soil_moisture_percent observation value');
  nearly(rain.value, 2, 'forecast_rain_72h_mm observation value');
  assert(String(diag.diagnosis?.human || '').trim(), 'diagnostic_inputs.diagnosis.human must be non-empty', diag);
  const weatherSummary = report.weather_summary;
  assert(weatherSummary, 'operation report weather_summary missing', report);
  assert(weatherSummary.weather_forecast_id === 'wf_c8_irrigation_001', 'operation report weather_summary.weather_forecast_id mismatch', weatherSummary);
  assert(weatherSummary.source_quality?.provider === 'MOCK', 'operation report weather_summary source provider mismatch', weatherSummary);
  assert(weatherSummary.source_quality?.provider_status === 'OK', 'operation report weather_summary provider_status mismatch', weatherSummary);
  nearly(weatherSummary.rainfall_forecast_mm, 2, 'operation report weather_summary rainfall');
  nearly(weatherSummary.max_temperature_c, 31, 'operation report weather_summary max temperature');

  const requirementSummary = report.irrigation_requirement_summary;
  assert(requirementSummary, 'operation report irrigation_requirement_summary missing', report);
  assert(requirementSummary.requirement_id === FORMAL_REQUIREMENT, 'operation report requirement_id mismatch', requirementSummary);
  assert(requirementSummary.source_forecast_id === 'wf_c8_irrigation_001', 'operation report requirement forecast binding mismatch', requirementSummary);
  assert(requirementSummary.source_fact_id === 'full_review_seed_tenantA_irrigation_requirement_c8_001', 'operation report requirement source_fact_id mismatch', requirementSummary);
  assert(requirementSummary.skill_id === 'irrigation_requirement_skill_v1', 'operation report requirement skill_id mismatch', requirementSummary);
  assert(requirementSummary.calculation_inputs?.input_source === 'projected_fact_bindings_v1', 'operation report requirement input_source mismatch', requirementSummary);
  assert(requirementSummary.calculation_inputs?.source_refs?.weather_forecast_id === 'wf_c8_irrigation_001', 'operation report requirement weather source ref mismatch', requirementSummary);
  nearly(requirementSummary.net_irrigation_mm, 18.7, 'operation report requirement net_irrigation_mm');
  nearly(requirementSummary.gross_irrigation_mm, 22, 'operation report requirement gross_irrigation_mm');
  nearly(requirementSummary.gross_irrigation_requirement_mm, 22, 'operation report requirement gross_irrigation_requirement_mm');
  assert(requirementSummary.unit === 'mm', 'operation report requirement unit mismatch', requirementSummary);
  assert(requirementSummary.source_quality?.status === 'SKILL_CALCULATED', 'operation report requirement quality status mismatch', requirementSummary);
  assert(requirementSummary.source_quality?.deterministic === true, 'operation report requirement deterministic flag mismatch', requirementSummary);
  assert(requirementSummary.binding?.requirement_to_forecast === true, 'operation report requirement_to_forecast binding mismatch', requirementSummary);
  assert(requirementSummary.binding?.requirement_to_field === true, 'operation report requirement_to_field binding mismatch', requirementSummary);
  assert(requirementSummary.binding?.report_binding_status === 'BOUND', 'operation report requirement binding status mismatch', requirementSummary);

  assert(report.prescription?.prescription_id === 'presc_c8_irrigation_001', 'report prescription_id mismatch', report.prescription);
  nearly(report.prescription?.amount, report.as_executed?.planned_amount, 'report prescription.amount follows as_executed planned_amount');
  assert(report.prescription?.unit === 'mm', 'report prescription.unit mismatch', report.prescription);
  assert(report.prescription?.amount_source?.requirement_id === FORMAL_REQUIREMENT, 'report prescription amount_source requirement mismatch', report.prescription);
  assert(report.prescription?.amount_source?.source_field === 'gross_irrigation_requirement_mm', 'report prescription amount_source source_field mismatch', report.prescription);
  nearly(report.prescription?.amount_source?.source_value_mm, 22, 'report prescription amount_source source_value_mm');
  assert(report.as_executed?.as_executed_id, 'report as_executed_id missing', report.as_executed);
  nearly(report.as_executed?.planned_amount, report.prescription?.amount, 'report as_executed.planned_amount follows prescription amount');
  assert(report.as_executed?.planned_amount_source?.requirement_id === FORMAL_REQUIREMENT, 'report as_executed planned_amount_source requirement mismatch', report.as_executed);
  assert(report.as_executed?.planned_amount_source?.source_field === 'gross_irrigation_requirement_mm', 'report as_executed planned_amount_source source_field mismatch', report.as_executed);
  nearly(report.as_executed?.planned_amount_source?.source_value_mm, 22, 'report as_executed planned_amount_source source_value_mm');

  assert(report.as_executed?.unit === 'mm', 'report as_executed.unit mismatch', report.as_executed);
  assert(report.as_executed?.status === 'CONFIRMED', 'report as_executed.status mismatch', report.as_executed);
  nearly(report.as_applied?.coverage_percent, 100, 'report as_applied.coverage_percent');
  assert(report.as_applied?.field_id === FORMAL_FIELD, 'report as_applied.field_id mismatch', report.as_applied);
  assert(report.roi_ledger?.summary?.has_customer_visible_value === true, 'report ROI has_customer_visible_value must be true', report.roi_ledger?.summary);
  const formalRoi = (report.roi_ledger?.items || []).find(
    (x) =>
      x.trust_level === 'FORMAL_ACCEPTED' &&
      x.source_lane === 'FORMAL_ACCEPTANCE' &&
      x.formal_acceptance_id === FORMAL_ACC &&
      x.formal_evidence_passed === true &&
      x.chain_validation_passed === true &&
      x.customer_visible_value === true
  );
  assert(formalRoi, 'operation report ROI item lost formal trust fields', report.roi_ledger?.items);
  nearly(report.as_executed?.executed_amount, formalRoi.actual_value, 'report as_executed.executed_amount follows formal ROI actual value');
  assert((report.field_memory?.field_response_memory || []).length >= 1, 'report field memory response rows missing', report.field_memory);
}
async function assertFieldReport() {
  const r = await http(`/api/v1/reports/field/${FORMAL_FIELD}?tenant_id=${TENANT}&project_id=${PROJECT_ID}&group_id=${GROUP_ID}`);
  assert(r.status === 200, 'field report request failed', httpDetail(r));
  const report = r.json.field_report_v1;
  assert(report?.field_context?.field_id === FORMAL_FIELD, 'field report field_context.field_id mismatch', report?.field_context);
  assert(Number(report?.field_context?.area_m2 || 0) > 0, 'field report field_context.area_m2 missing', report?.field_context);
  assert(report?.field_context?.boundary_geojson, 'field report field_context.boundary_geojson missing', report?.field_context);
  assert(Number(report?.device_summary?.total_devices || 0) >= 3, 'field report device_summary.total_devices < 3', report?.device_summary);
  assert((report?.sensing_summary?.devices || []).some((x) => x.device_id === 'dev_soil_c8_001'), 'field report sensing_summary missing soil device', report?.sensing_summary);
  assert((report?.sensing_summary?.observations || []).some((x) => x.metric === 'soil_moisture_percent'), 'field report sensing_summary missing soil moisture observation', report?.sensing_summary);
  assert(report?.decision_summary?.latest_recommendation_id === 'rec_c8_irrigation_001', 'field report decision_summary recommendation mismatch', report?.decision_summary);
  assert(report?.decision_summary?.prescription_id === 'presc_c8_irrigation_001', 'field report decision_summary prescription mismatch', report?.decision_summary);
  assert(Number(report?.execution_summary?.formal_operation_count || 0) >= 1, 'field report execution_summary formal operation missing', report?.execution_summary);
  assert(report?.execution_summary?.latest_operation_id === FORMAL_OP, 'field report execution_summary latest operation mismatch', report?.execution_summary);
  assert(report?.value_summary?.has_customer_visible_value === true, 'field report value_summary must expose formal customer value', report?.value_summary);
  assert(Number(report?.learning_summary?.formal_field_response_memory_count || 0) >= 1, 'field report learning_summary formal field memory missing', report?.learning_summary);
  assert(report?.learning_summary?.latest_formal_acceptance_id === FORMAL_ACC, 'field report learning_summary formal acceptance mismatch', report?.learning_summary);
}

(async () => {
  const client = await dbClient();
  try {
    await cleanupP0Rows(client);
    console.log('[ACCEPTANCE_C8_FORMAL_CHAIN_BACKEND_P0_V1] STEP runtime-openapi');
    await assertRuntimeOpenApi();
    console.log('[ACCEPTANCE_C8_FORMAL_CHAIN_BACKEND_P0_V1] STEP receipt-status');
    const asExecuted = await assertReceiptStatusMatrix(client);
    console.log('[ACCEPTANCE_C8_FORMAL_CHAIN_BACKEND_P0_V1] STEP roi-formalize');
    await assertRoiFormalization(client, asExecuted.as_executed_id);
    console.log('[ACCEPTANCE_C8_FORMAL_CHAIN_BACKEND_P0_V1] STEP field-memory');
    await assertFieldMemory(client);
    console.log('[ACCEPTANCE_C8_FORMAL_CHAIN_BACKEND_P0_V1] STEP irrigation-requirement');
    await assertIrrigationRequirementReadback(client);
    console.log('[ACCEPTANCE_C8_FORMAL_CHAIN_BACKEND_P0_V1] STEP operation-report');
    await assertOperationReport();
    await assertFieldReport();
    console.log('[ACCEPTANCE_C8_FORMAL_CHAIN_BACKEND_P0_V1] PASS', JSON.stringify({ base_url: BASE_URL, tenant: TENANT, as_executed_id: asExecuted.as_executed_id }));
  } finally {
    await cleanupP0Rows(client);
    await client.end().catch(() => {});
  }
})().catch((error) => fail(error?.message || String(error), error?.stack));
