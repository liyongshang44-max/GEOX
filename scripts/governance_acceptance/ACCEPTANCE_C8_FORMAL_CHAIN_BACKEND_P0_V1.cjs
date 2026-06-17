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
const FORMAL_WATER_STATE_SUFFIX = 'wstate_c8_irrigation_001';
const FORMAL_WATER_STATE_UNKNOWN_SUFFIX = 'wstate_c8_irrigation_unknown_001';
const FORMAL_SCENARIO_SET_SUFFIX = 'iscen_c8_irrigation_001';
const FORMAL_SCENARIO_SET_UNKNOWN_SUFFIX = 'iscen_c8_irrigation_unknown_001';
const FORMAL_SKILL_INPUT = 'iskill_input_c8_irrigation_001';
const SENSING_WINDOW_ID = 'sw_c8_soil_moisture_001';
const SENSING_WINDOW_FAIL_ID = 'sw_c8_soil_moisture_fail_001';
const SENSING_WINDOW_LAST_OBSERVATION_REF = 'telemetry_soil_moisture_window_c8_006';

function arg(name, fallback = null) {
  const idx = process.argv.indexOf(`--${name}`);
  return idx >= 0 ? process.argv[idx + 1] : fallback;
}

const BASE_URL = (arg('base-url') || process.env.BASE_URL || process.env.API_BASE_URL || '').replace(/\/+$/, '');
const TENANT = arg('tenant') || process.env.TENANT_ID || 'tenantA';
const FORMAL_WATER_STATE = `full_review_seed_${TENANT}_${FORMAL_WATER_STATE_SUFFIX}`;
const FORMAL_WATER_STATE_UNKNOWN = `full_review_seed_${TENANT}_${FORMAL_WATER_STATE_UNKNOWN_SUFFIX}`;
const FORMAL_SCENARIO_SET = `full_review_seed_${TENANT}_${FORMAL_SCENARIO_SET_SUFFIX}`;
const FORMAL_SCENARIO_SET_UNKNOWN = `full_review_seed_${TENANT}_${FORMAL_SCENARIO_SET_UNKNOWN_SUFFIX}`;
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
  assert(paths['/api/v1/irrigation-requirement-skill-inputs/{skill_input_id}']?.get, 'OpenAPI missing irrigation skill input GET path', paths['/api/v1/irrigation-requirement-skill-inputs/{skill_input_id}']);
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

async function assertSoilMoistureSensingWindowReadback(client) {
  const result = await client.query(
	   `SELECT *
	      FROM soil_moisture_sensing_window_index_v1
	     WHERE tenant_id = $1
	       AND project_id = $2
	       AND group_id = $3
	       AND window_id = $4
	     LIMIT 1`,
	    [TENANT, PROJECT_ID, GROUP_ID, SENSING_WINDOW_ID],
	  );

  assert(result.rows.length === 1, 'soil moisture sensing window index row missing', result.rows);
  const row = result.rows[0];
  assert(row.window_id === SENSING_WINDOW_ID, 'soil moisture sensing window window_id mismatch', row);
  assert(row.tenant_id === TENANT, 'soil moisture sensing window tenant_id mismatch', row);
  assert(row.project_id === PROJECT_ID, 'soil moisture sensing window project_id mismatch', row);
  assert(row.group_id === GROUP_ID, 'soil moisture sensing window group_id mismatch', row);
  assert(row.field_id === FORMAL_FIELD, 'soil moisture sensing window field_id mismatch', row);
  assert(row.device_id === 'dev_soil_c8_001', 'soil moisture sensing window device_id mismatch', row);
  assert(row.metric === 'soil_moisture_percent', 'soil moisture sensing window metric mismatch', row);
  assert(Number(row.expected_interval_ms) === 60000, 'soil moisture sensing window expected_interval_ms mismatch', row);
  assert(Number(row.actual_points) >= 5, 'soil moisture sensing window actual_points too low', row);
  assert(Number(row.coverage_ratio) >= 0.2, 'soil moisture sensing window coverage_ratio too low', row);
  assert(Number(row.max_gap_ms) <= 900000, 'soil moisture sensing window max_gap_ms too high', row);
  assert(Number(row.gap_count) === 0, 'soil moisture sensing window gap_count mismatch', row);
  assert(row.quality_status === 'PASS', 'soil moisture sensing window quality_status mismatch', row);
  assert(row.confidence_json?.level === 'HIGH', 'soil moisture sensing window confidence level mismatch', row.confidence_json);
  nearly(row.summary_json?.last_value, 18.4, 'soil moisture sensing window summary.last_value');
  assert(Array.isArray(row.source_fact_ids_json) && row.source_fact_ids_json.length >= 5, 'soil moisture sensing window source_fact_ids_json too short', row.source_fact_ids_json);
  assert(Array.isArray(row.source_observation_ids_json) && row.source_observation_ids_json.length >= 5, 'soil moisture sensing window source_observation_ids_json too short', row.source_observation_ids_json);
}


async function assertSoilMoistureSensingWindowNegativeGuard(client) {
  const result = await client.query(
	   `SELECT *
	      FROM soil_moisture_sensing_window_index_v1
	     WHERE tenant_id = $1
	       AND project_id = $2
	       AND group_id = $3
	       AND window_id = $4
	     LIMIT 1`,
	    [TENANT, PROJECT_ID, GROUP_ID, SENSING_WINDOW_FAIL_ID],
	  );

  assert(result.rows.length === 1, 'soil moisture sensing window FAIL fixture row missing', result.rows);
  const row = result.rows[0];
  assert(row.quality_status === 'FAIL', 'soil moisture sensing window FAIL fixture quality_status mismatch', row);
  assert(Number(row.actual_points) === 1, 'soil moisture sensing window FAIL fixture actual_points mismatch', row);
  assert(Number(row.coverage_ratio) < 0.2, 'soil moisture sensing window FAIL fixture coverage_ratio must be below 0.2', row);
  assert(row.confidence_json?.level === 'LOW', 'soil moisture sensing window FAIL fixture confidence level mismatch', row.confidence_json);

  const skillInput = await client.query(
    `SELECT skill_input_id, source_refs_json
       FROM irrigation_requirement_skill_input_index_v1
      WHERE tenant_id=$1
        AND project_id=$2
        AND group_id=$3
        AND source_refs_json->>'sensing_window_id' = $4`,
    [TENANT, PROJECT_ID, GROUP_ID, SENSING_WINDOW_FAIL_ID],
  );
  assert(skillInput.rows.length === 0, 'FAIL sensing window must not be bound to formal irrigation skill input', skillInput.rows);
}

async function assertIrrigationSkillInputReadback(client) {
  const result = await client.query(
    `SELECT skill_input_id,
            tenant_id,
            project_id,
            group_id,
            field_id,
            requirement_id,
            source_forecast_id,
            skill_id,
            skill_version,
            skill_run_id,
            input_source,
            source_refs_json,
            input_values_json,
            input_units_json,
            source_fact_id
       FROM irrigation_requirement_skill_input_index_v1
      WHERE tenant_id=$1
        AND project_id=$2
        AND group_id=$3
        AND skill_input_id=$4
      LIMIT 1`,
    [TENANT, PROJECT_ID, GROUP_ID, FORMAL_SKILL_INPUT],
  );

  assert(result.rows.length === 1, 'irrigation skill input index row missing', result.rows);
  const row = result.rows[0];
  assert(row.skill_input_id === FORMAL_SKILL_INPUT, 'irrigation skill input id mismatch', row);
  assert(row.requirement_id === FORMAL_REQUIREMENT, 'irrigation skill input requirement binding mismatch', row);
  assert(row.source_forecast_id === 'wf_c8_irrigation_001', 'irrigation skill input forecast binding mismatch', row);
  assert(row.input_source === 'projected_fact_bindings_v1', 'irrigation skill input source mismatch', row);
  assert(row.source_refs_json?.weather_forecast_id === 'wf_c8_irrigation_001', 'irrigation skill input source_refs weather mismatch', row.source_refs_json);
  assert(row.source_refs_json?.sensing_window_id === SENSING_WINDOW_ID, 'irrigation skill input sensing_window_id mismatch', row.source_refs_json);
  assert(String(row.source_refs_json?.sensing_window_fact_id || '').includes('soil_moisture_sensing_window_c8_001'), 'irrigation skill input sensing_window_fact_id mismatch', row.source_refs_json);
  assert(row.source_refs_json?.sensing_window_quality_status === 'PASS', 'irrigation skill input sensing_window_quality_status mismatch', row.source_refs_json);
  assert(row.source_refs_json?.observation_refs?.soil_moisture_percent === SENSING_WINDOW_LAST_OBSERVATION_REF, 'irrigation skill input soil source ref mismatch', row.source_refs_json);
  nearly(row.input_values_json?.soil_moisture, 18.4, 'irrigation skill input soil_moisture');
  nearly(row.input_values_json?.rain_forecast_mm_72h, 2, 'irrigation skill input rain_forecast_mm_72h');
  nearly(row.input_values_json?.et0_mm_72h, 3.9, 'irrigation skill input et0_mm_72h');
  assert(String(row.source_fact_id || '').includes('irrigation_requirement_skill_input_c8_001'), 'irrigation skill input source_fact_id mismatch', row);
}

async function assertIrrigationSkillInputApiReadback() {
  const path = `/api/v1/irrigation-requirement-skill-inputs/${encodeURIComponent(FORMAL_SKILL_INPUT)}?tenant_id=${encodeURIComponent(TENANT)}&project_id=${encodeURIComponent(PROJECT_ID)}&group_id=${encodeURIComponent(GROUP_ID)}`;
  const r = await http(path);
  assert(r.status === 200, 'irrigation skill input API readback failed', httpDetail(r));
  assert(r.json?.ok === true, 'irrigation skill input API ok mismatch', httpDetail(r));
  const item = r.json?.irrigation_requirement_skill_input_v1;
  assert(item?.skill_input_id === FORMAL_SKILL_INPUT, 'irrigation skill input API id mismatch', item);
  assert(item?.requirement_id === FORMAL_REQUIREMENT, 'irrigation skill input API requirement binding mismatch', item);
  assert(item?.input_source === 'projected_fact_bindings_v1', 'irrigation skill input API input_source mismatch', item);
  assert(item?.source_refs?.weather_forecast_id === 'wf_c8_irrigation_001', 'irrigation skill input API weather source mismatch', item?.source_refs);
  assert(item?.source_refs?.sensing_window_id === SENSING_WINDOW_ID, 'irrigation skill input API sensing_window_id mismatch', item?.source_refs);
  assert(item?.source_refs?.sensing_window_quality_status === 'PASS', 'irrigation skill input API sensing_window_quality_status mismatch', item?.source_refs);
  assert(item?.source_refs?.observation_refs?.soil_moisture_percent === SENSING_WINDOW_LAST_OBSERVATION_REF, 'irrigation skill input API soil source mismatch', item?.source_refs);
  nearly(item?.input_values?.soil_moisture, 18.4, 'irrigation skill input API soil_moisture');
  nearly(item?.input_values?.rain_forecast_mm_72h, 2, 'irrigation skill input API rain_forecast_mm_72h');
  nearly(item?.input_values?.et0_mm_72h, 3.9, 'irrigation skill input API et0_mm_72h');
}

async function assertIrrigationRequirementReadback(client) {
  const result = await client.query(
    `SELECT requirement_id, field_id, season_id, source_forecast_id, skill_id, net_irrigation_mm, gross_irrigation_mm, gross_irrigation_requirement_mm, unit, calculation_method, calculation_inputs_json, derivation_json, quality_json, source_fact_id
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
  assert(row.quality_json?.derivation_status === 'DERIVED_FROM_FORMAL_SKILL_INPUT', 'irrigation requirement derivation status mismatch', row.quality_json);
  assert(row.calculation_inputs_json?.input_source === 'projected_fact_bindings_v1', 'irrigation requirement calculation input source mismatch', row.calculation_inputs_json);
  assert(row.calculation_inputs_json?.source_input_id === FORMAL_SKILL_INPUT, 'irrigation requirement source_input_id mismatch', row.calculation_inputs_json);
  assert(String(row.calculation_inputs_json?.source_input_fact_id || '').includes('irrigation_requirement_skill_input_c8_001'), 'irrigation requirement source_input_fact_id mismatch', row.calculation_inputs_json);
  assert(row.calculation_inputs_json?.source_refs?.weather_forecast_id === 'wf_c8_irrigation_001', 'irrigation requirement weather source ref mismatch', row.calculation_inputs_json);
  assert(row.calculation_inputs_json?.source_refs?.sensing_window_id === SENSING_WINDOW_ID, 'irrigation requirement sensing_window_id mismatch', row.calculation_inputs_json);
  assert(row.calculation_inputs_json?.source_refs?.sensing_window_quality_status === 'PASS', 'irrigation requirement sensing_window_quality_status mismatch', row.calculation_inputs_json);
  assert(row.calculation_inputs_json?.source_refs?.observation_refs?.soil_moisture_percent === SENSING_WINDOW_LAST_OBSERVATION_REF, 'irrigation requirement soil source ref mismatch', row.calculation_inputs_json);
  assert(row.derivation_json?.derivation_type === 'irrigation_requirement_from_skill_input_v1', 'irrigation requirement derivation_type mismatch', row.derivation_json);
  assert(row.derivation_json?.source_type === 'irrigation_requirement_skill_input_v1', 'irrigation requirement derivation source_type mismatch', row.derivation_json);
  assert(row.derivation_json?.source_input_id === FORMAL_SKILL_INPUT, 'irrigation requirement derivation source_input_id mismatch', row.derivation_json);
  assert(String(row.derivation_json?.source_input_fact_id || '').includes('irrigation_requirement_skill_input_c8_001'), 'irrigation requirement derivation source_input_fact_id mismatch', row.derivation_json);
  assert(row.derivation_json?.formula_version === 'irrigation_requirement_skill_v1', 'irrigation requirement derivation formula_version mismatch', row.derivation_json);
  assert(row.derivation_json?.deterministic === true, 'irrigation requirement derivation deterministic mismatch', row.derivation_json);
  nearly(row.calculation_inputs_json?.et0_mm_72h, 3.9, 'irrigation requirement calculation input et0_mm_72h');
  assert(String(row.source_fact_id || '').includes('irrigation_requirement_c8_001'), 'irrigation requirement source_fact_id mismatch', row);
}

async function assertWaterStateEstimateReadback(client) {
  const result = await client.query(
    `SELECT
        estimate_id,
        tenant_id,
        project_id,
        group_id,
        field_id,
        season_id,
        state,
        root_zone_soil_moisture_percent,
        target_min_soil_moisture_percent,
        net_irrigation_mm,
        gross_irrigation_requirement_mm,
        source_sensing_window_id,
        source_forecast_id,
        source_requirement_id,
        source_sensing_window_fact_id,
        source_weather_fact_id,
        source_requirement_fact_id,
        input_refs_json,
        evidence_refs_json,
        calculation_inputs_json,
        quality_json,
        confidence_json,
        source_fact_id
       FROM water_state_estimate_index_v1
      WHERE tenant_id=$1
        AND project_id=$2
        AND group_id=$3
        AND estimate_id=$4
      LIMIT 1`,
    [TENANT, PROJECT_ID, GROUP_ID, FORMAL_WATER_STATE],
  );

  const row = result.rows?.[0];
  assert(row, 'water state estimate index row missing', result.rows);
  assert(row.estimate_id === FORMAL_WATER_STATE, 'water state estimate_id mismatch', row);
  assert(row.field_id === FORMAL_FIELD, 'water state field_id mismatch', row);
  assert(row.state === 'MODERATE_DEFICIT', 'water state must be MODERATE_DEFICIT', row);
  nearly(row.root_zone_soil_moisture_percent, 18.4, 'water state root_zone_soil_moisture_percent');
  nearly(row.target_min_soil_moisture_percent, 22, 'water state target_min_soil_moisture_percent');
  nearly(row.net_irrigation_mm, 18.7, 'water state net_irrigation_mm');
  nearly(row.gross_irrigation_requirement_mm, 22, 'water state gross_irrigation_requirement_mm');
  assert(row.source_sensing_window_id === SENSING_WINDOW_ID, 'water state source_sensing_window_id mismatch', row);
  assert(row.source_forecast_id === 'wf_c8_irrigation_001', 'water state source_forecast_id mismatch', row);
  assert(row.source_requirement_id === FORMAL_REQUIREMENT, 'water state source_requirement_id mismatch', row);
  assert(row.source_sensing_window_fact_id === 'full_review_seed_tenantA_soil_moisture_sensing_window_c8_001', 'water state source_sensing_window_fact_id mismatch', row);
  assert(row.source_weather_fact_id === 'full_review_seed_tenantA_weather_forecast_c8_irrigation_001', 'water state source_weather_fact_id mismatch', row);
  assert(row.source_requirement_fact_id === 'full_review_seed_tenantA_irrigation_requirement_c8_001', 'water state source_requirement_fact_id mismatch', row);
  assert(row.source_fact_id === 'full_review_seed_tenantA_water_state_estimate_c8_001', 'water state source_fact_id mismatch', row);
  assert(row.quality_json?.status === 'ESTIMATED', 'water state quality status mismatch', row.quality_json);
  assert(row.quality_json?.deterministic === true, 'water state quality deterministic mismatch', row.quality_json);
  assert(row.confidence_json?.level === 'HIGH', 'water state confidence level mismatch', row.confidence_json);
  nearly(row.confidence_json?.score, 0.9, 'water state confidence score');
  assert(row.input_refs_json?.weather_forecast_id === 'wf_c8_irrigation_001', 'water state input_refs weather_forecast_id mismatch', row.input_refs_json);
  assert(String(row.input_refs_json?.weather_forecast_version || '').includes('c8_external_weather_provider_sample_001:'), 'water state input_refs weather_forecast_version missing', row.input_refs_json);
  assert(row.input_refs_json?.weather_provider_run_id === 'provider_run_c8_irrigation_001', 'water state input_refs provider_run_id mismatch', row.input_refs_json);
  assert(row.input_refs_json?.weather_external_forecast_id === 'external_forecast_c8_irrigation_001', 'water state input_refs external_forecast_id mismatch', row.input_refs_json);
  assert(Array.isArray(row.evidence_refs_json) && row.evidence_refs_json.includes(FORMAL_REQUIREMENT), 'water state evidence refs missing requirement', row.evidence_refs_json);
  assert(row.calculation_inputs_json?.weather_provider_status === 'OK', 'water state weather provider status mismatch', row.calculation_inputs_json);
  assert(row.calculation_inputs_json?.weather_stale === false, 'water state weather stale mismatch', row.calculation_inputs_json);

  const unknownResult = await client.query(
    `SELECT
        estimate_id,
        tenant_id,
        project_id,
        group_id,
        field_id,
        state,
        source_sensing_window_id,
        source_sensing_window_fact_id,
        source_forecast_id,
        source_requirement_id,
        quality_json,
        confidence_json,
        calculation_inputs_json,
        source_fact_id
       FROM water_state_estimate_index_v1
      WHERE tenant_id=$1
        AND project_id=$2
        AND group_id=$3
        AND estimate_id=$4
      LIMIT 1`,
    [TENANT, PROJECT_ID, GROUP_ID, FORMAL_WATER_STATE_UNKNOWN],
  );

  const unknown = unknownResult.rows?.[0];
  assert(unknown, 'UNKNOWN water state estimate index row missing', unknownResult.rows);
  assert(unknown.estimate_id === FORMAL_WATER_STATE_UNKNOWN, 'UNKNOWN water state estimate_id mismatch', unknown);
  assert(unknown.field_id === FORMAL_FIELD, 'UNKNOWN water state field_id mismatch', unknown);
  assert(unknown.state === 'UNKNOWN', 'UNKNOWN water state must remain UNKNOWN', unknown);
  assert(unknown.source_sensing_window_id === SENSING_WINDOW_FAIL_ID, 'UNKNOWN water state source_sensing_window_id mismatch', unknown);
  assert(unknown.source_sensing_window_fact_id === 'full_review_seed_tenantA_soil_moisture_sensing_window_c8_fail_001', 'UNKNOWN water state source_sensing_window_fact_id mismatch', unknown);
  assert(unknown.source_forecast_id === 'wf_c8_irrigation_001', 'UNKNOWN water state source_forecast_id mismatch', unknown);
  assert(unknown.source_requirement_id === FORMAL_REQUIREMENT, 'UNKNOWN water state source_requirement_id mismatch', unknown);
  assert(unknown.source_fact_id === 'full_review_seed_tenantA_water_state_estimate_c8_unknown_001', 'UNKNOWN water state source_fact_id mismatch', unknown);
  assert(unknown.quality_json?.status === 'UNKNOWN', 'UNKNOWN water state quality status mismatch', unknown.quality_json);
  assert(Array.isArray(unknown.quality_json?.reason_codes) && unknown.quality_json.reason_codes.includes('SENSING_WINDOW_NOT_PASS'), 'UNKNOWN water state reason code mismatch', unknown.quality_json);
  assert(unknown.confidence_json?.level === 'LOW', 'UNKNOWN water state confidence level mismatch', unknown.confidence_json);
  assert(unknown.calculation_inputs_json?.sensing_window_quality_status === 'FAIL', 'UNKNOWN water state sensing window quality mismatch', unknown.calculation_inputs_json);
}

async function assertIrrigationScenarioSetReadback(client) {
  const result = await client.query(
    `SELECT
        scenario_set_id,
        tenant_id,
        project_id,
        group_id,
        field_id,
        season_id,
        source_water_state_estimate_id,
        source_requirement_id,
        source_forecast_id,
        source_sensing_window_id,
        baseline_water_state,
        baseline_soil_moisture_percent,
        target_min_soil_moisture_percent,
        target_max_soil_moisture_percent,
        net_irrigation_mm,
        gross_irrigation_requirement_mm,
        options_json,
        recommended_option_id,
        input_refs_json,
        evidence_refs_json,
        derivation_json,
        quality_json,
        confidence_json,
        source_fact_id
       FROM irrigation_scenario_set_index_v1
      WHERE tenant_id=$1
        AND project_id=$2
        AND group_id=$3
        AND scenario_set_id=$4
      LIMIT 1`,
    [TENANT, PROJECT_ID, GROUP_ID, FORMAL_SCENARIO_SET],
  );

  const row = result.rows?.[0];
  assert(row, 'irrigation scenario set index row missing', result.rows);
  assert(row.scenario_set_id === FORMAL_SCENARIO_SET, 'scenario_set_id mismatch', row);
  assert(row.tenant_id === TENANT, 'scenario tenant_id mismatch', row);
  assert(row.project_id === PROJECT_ID, 'scenario project_id mismatch', row);
  assert(row.group_id === GROUP_ID, 'scenario group_id mismatch', row);
  assert(row.field_id === FORMAL_FIELD, 'scenario field_id mismatch', row);
  assert(row.season_id === 'season_2026_c8_corn', 'scenario season_id mismatch', row);

  assert(row.source_water_state_estimate_id === FORMAL_WATER_STATE, 'scenario source water state mismatch', row);
  assert(row.source_requirement_id === FORMAL_REQUIREMENT, 'scenario source requirement mismatch', row);
  assert(row.source_forecast_id === 'wf_c8_irrigation_001', 'scenario source forecast mismatch', row);
  assert(row.source_sensing_window_id === SENSING_WINDOW_ID, 'scenario source sensing window mismatch', row);
  assert(row.baseline_water_state === 'MODERATE_DEFICIT', 'scenario baseline water state mismatch', row);

  nearly(row.baseline_soil_moisture_percent, 18.4, 'scenario baseline_soil_moisture_percent');
  nearly(row.target_min_soil_moisture_percent, 22, 'scenario target_min_soil_moisture_percent');
  nearly(row.target_max_soil_moisture_percent, 28, 'scenario target_max_soil_moisture_percent');
  nearly(row.net_irrigation_mm, 18.7, 'scenario net_irrigation_mm');
  nearly(row.gross_irrigation_requirement_mm, 22, 'scenario gross_irrigation_requirement_mm');

  assert(row.recommended_option_id === null, 'H15 scenario must not set recommended_option_id', row);
  assert(row.quality_json?.status === 'COMPARABLE', 'scenario quality status mismatch', row.quality_json);
  assert(row.quality_json?.deterministic === true, 'scenario quality deterministic mismatch', row.quality_json);
  assert(row.confidence_json?.level === 'HIGH', 'scenario confidence level mismatch', row.confidence_json);
  assert(row.confidence_json?.basis === 'h14_water_state_high_confidence_v1', 'scenario confidence basis mismatch', row.confidence_json);
  assert(row.source_fact_id === `full_review_seed_${TENANT}_irrigation_scenario_set_c8_001`, 'scenario source_fact_id mismatch', row);

  assert(row.input_refs_json?.root_zone_depth_mm === 300, 'scenario root_zone_depth_mm mismatch', row.input_refs_json);
  assert(row.input_refs_json?.application_efficiency === 0.85, 'scenario application_efficiency mismatch', row.input_refs_json);
  assert(row.input_refs_json?.weather_provider_status === 'OK', 'scenario weather provider status mismatch', row.input_refs_json);
  assert(row.input_refs_json?.weather_valid_from, 'scenario weather valid_from missing', row.input_refs_json);
  assert(row.input_refs_json?.weather_valid_to, 'scenario weather valid_to missing', row.input_refs_json);

  const options = Array.isArray(row.options_json) ? row.options_json : [];
  const expectedOptionIds = ['no_action', 'irrigate_10mm', 'irrigate_20mm', 'irrigate_22mm', 'delay_3d'];
  assert(options.length === 5, 'scenario options count mismatch', options);
  assert(JSON.stringify(options.map((x) => x.option_id)) === JSON.stringify(expectedOptionIds), 'scenario option order mismatch', options);

  const expected = {
    no_action: { action_type: 'NO_ACTION', assumed: 0, effective: 0, delay: 0, risk_after: 'MODERATE_DEFICIT', risk_delta: 'UNCHANGED', confidence: 'MEDIUM', min: 17.0, max: 18.6, failures: ['PROJECTED_DEFICIT_REMAINS', 'NO_IRRIGATION_APPLIED'] },
    irrigate_10mm: { action_type: 'IRRIGATE', assumed: 10, effective: 10, delay: 0, risk_after: 'MODERATE_DEFICIT', risk_delta: 'UNCHANGED', confidence: 'MEDIUM', min: 19.8, max: 21.4, failures: ['PROJECTED_DEFICIT_REMAINS', 'EXECUTION_REQUIRED'] },
    irrigate_20mm: { action_type: 'IRRIGATE', assumed: 20, effective: 20, delay: 0, risk_after: 'NORMAL', risk_delta: 'IMPROVED', confidence: 'HIGH', min: 22.6, max: 24.2, failures: ['EXECUTION_REQUIRED'] },
    irrigate_22mm: { action_type: 'IRRIGATE', assumed: 22, effective: 22, delay: 0, risk_after: 'NORMAL', risk_delta: 'IMPROVED', confidence: 'HIGH', min: 23.2, max: 24.8, failures: ['EXECUTION_REQUIRED'] },
    delay_3d: { action_type: 'DELAY_IRRIGATION', assumed: 22, effective: 0, delay: 3, risk_after: 'MODERATE_DEFICIT', risk_delta: 'UNCHANGED', confidence: 'LOW', min: 16.3, max: 19.3, failures: ['PROJECTED_DEFICIT_REMAINS', 'IRRIGATION_DELAY_EXPOSURE'] },
  };

  for (const optionId of expectedOptionIds) {
    const actual = findBy(options, (x) => x.option_id === optionId);
    const spec = expected[optionId];
    assert(actual, `scenario option missing ${optionId}`, options);
    assert(actual.action_type === spec.action_type, `${optionId} action_type mismatch`, actual);
    assert(actual.risk_before === 'MODERATE_DEFICIT', `${optionId} risk_before mismatch`, actual);
    assert(actual.risk_after === spec.risk_after, `${optionId} risk_after mismatch`, actual);
    assert(actual.risk_delta === spec.risk_delta, `${optionId} risk_delta mismatch`, actual);
    assert(actual.confidence?.level === spec.confidence, `${optionId} confidence level mismatch`, actual);
    assert(Array.isArray(actual.confidence?.reasons), `${optionId} confidence reasons must be array`, actual);
    const baseScenarioConfidenceReasons = ['water_state_estimate_available', 'versioned_weather_forecast_available', 'formal_requirement_available'];
    for (const reason of baseScenarioConfidenceReasons) {
      assert(actual.confidence.reasons.includes(reason), `${optionId} missing confidence reason ${reason}`, actual);
    }
    if (optionId === 'delay_3d') {
      assert(actual.confidence.reasons.includes('delay_increases_uncertainty'), 'delay_3d missing confidence reason delay_increases_uncertainty', actual);
    }
    for (const condition of ['rainfall_forecast_deviation_gt_5mm', 'sensor_coverage_below_threshold', 'weather_provider_status_not_ok']) {
      assert(Array.isArray(actual.failure_conditions) && actual.failure_conditions.includes(condition), `${optionId} missing shared failure condition ${condition}`, actual);
    }
    if (optionId.startsWith('irrigate_')) {
      for (const condition of ['actual_application_efficiency_lt_assumed', 'post_irrigation_soil_response_not_observed', 'irrigation_execution_not_completed']) {
        assert(actual.failure_conditions.includes(condition), `${optionId} missing irrigation failure condition ${condition}`, actual);
      }
    }
    if (optionId === 'delay_3d') {
      for (const condition of ['soil_moisture_declines_faster_than_expected', 'forecast_window_changes_before_execution']) {
        assert(actual.failure_conditions.includes(condition), `${optionId} missing delay failure condition ${condition}`, actual);
      }
    }
    nearly(actual.assumed_irrigation_mm, spec.assumed, `${optionId} assumed_irrigation_mm`);
    nearly(actual.effective_irrigation_mm_within_72h, spec.effective, `${optionId} effective_irrigation_mm_within_72h`);
    assert(actual.delay_days === spec.delay, `${optionId} delay_days mismatch`, actual);
    nearly(actual.projected_soil_moisture_range?.min, spec.min, `${optionId} range min`);
    nearly(actual.projected_soil_moisture_range?.max, spec.max, `${optionId} range max`);
    assert(actual.calculation_trace?.formula_version === 'formal_irrigation_scenario_delta_model_v1', `${optionId} formula version mismatch`, actual);
    assert(actual.calculation_trace?.root_zone_depth_mm === 300, `${optionId} root zone depth mismatch`, actual);
    assert(actual.calculation_trace?.application_efficiency === 0.85, `${optionId} application efficiency mismatch`, actual);
    assert(actual.calculation_trace?.rounding_policy === 'risk_before_rounding_range_min_max_rounded_1_decimal', `${optionId} rounding policy mismatch`, actual);

    for (const failure of spec.failures) {
      assert(Array.isArray(actual.failure_conditions) && actual.failure_conditions.includes(failure), `${optionId} missing failure condition ${failure}`, actual);
    }
  }

  assert(row.derivation_json?.comparison_only === true, 'scenario derivation must be comparison_only', row.derivation_json);
  assert(row.derivation_json?.no_recommendation === true, 'scenario derivation must be no_recommendation', row.derivation_json);
  assert(row.derivation_json?.recommended_option_id === null, 'scenario derivation recommended_option_id must be null', row.derivation_json);
  assert(JSON.stringify(row.derivation_json?.fixed_option_ids) === JSON.stringify(expectedOptionIds), 'scenario fixed option ids mismatch', row.derivation_json);
  assert(row.derivation_json?.delay_3d_semantics === 'effective_irrigation_mm_within_72h_is_zero', 'scenario delay_3d semantics mismatch', row.derivation_json);

  for (const expectedRef of [
    FORMAL_WATER_STATE,
    SENSING_WINDOW_ID,
    'wf_c8_irrigation_001',
    FORMAL_REQUIREMENT,
    `full_review_seed_${TENANT}_water_state_estimate_c8_001`,
    `full_review_seed_${TENANT}_soil_moisture_sensing_window_c8_001`,
    `full_review_seed_${TENANT}_weather_forecast_c8_irrigation_001`,
    `full_review_seed_${TENANT}_irrigation_requirement_c8_001`,
  ]) {
    assert(Array.isArray(row.evidence_refs_json) && row.evidence_refs_json.includes(expectedRef), `scenario evidence ref missing ${expectedRef}`, row.evidence_refs_json);
  }

  const unknownResult = await client.query(
    `SELECT
        scenario_set_id,
        tenant_id,
        project_id,
        group_id,
        field_id,
        source_water_state_estimate_id,
        source_requirement_id,
        source_forecast_id,
        source_sensing_window_id,
        baseline_water_state,
        options_json,
        recommended_option_id,
        quality_json,
        confidence_json,
        source_fact_id
       FROM irrigation_scenario_set_index_v1
      WHERE tenant_id=$1
        AND project_id=$2
        AND group_id=$3
        AND scenario_set_id=$4
      LIMIT 1`,
    [TENANT, PROJECT_ID, GROUP_ID, FORMAL_SCENARIO_SET_UNKNOWN],
  );

  const unknown = unknownResult.rows?.[0];
  assert(unknown, 'UNKNOWN irrigation scenario set row missing', unknownResult.rows);
  assert(unknown.scenario_set_id === FORMAL_SCENARIO_SET_UNKNOWN, 'UNKNOWN scenario_set_id mismatch', unknown);
  assert(unknown.source_water_state_estimate_id === FORMAL_WATER_STATE_UNKNOWN, 'UNKNOWN scenario source water state mismatch', unknown);
  assert(unknown.source_requirement_id === FORMAL_REQUIREMENT, 'UNKNOWN scenario source requirement mismatch', unknown);
  assert(unknown.source_forecast_id === 'wf_c8_irrigation_001', 'UNKNOWN scenario source forecast mismatch', unknown);
  assert(unknown.source_sensing_window_id === SENSING_WINDOW_FAIL_ID, 'UNKNOWN scenario source sensing window mismatch', unknown);
  assert(unknown.baseline_water_state === 'UNKNOWN', 'UNKNOWN scenario baseline state mismatch', unknown);
  assert(unknown.recommended_option_id === null, 'UNKNOWN scenario recommended_option_id must be null', unknown);
  assert(Array.isArray(unknown.options_json) && unknown.options_json.length === 0, 'UNKNOWN scenario options must be empty', unknown.options_json);
  assert(unknown.quality_json?.status === 'UNKNOWN', 'UNKNOWN scenario quality status mismatch', unknown.quality_json);
  assert(Array.isArray(unknown.quality_json?.reason_codes) && unknown.quality_json.reason_codes.includes('WATER_STATE_UNKNOWN'), 'UNKNOWN scenario reason code missing WATER_STATE_UNKNOWN', unknown.quality_json);
  assert(unknown.confidence_json?.level === 'LOW', 'UNKNOWN scenario confidence level mismatch', unknown.confidence_json);
  assert(unknown.source_fact_id === `full_review_seed_${TENANT}_irrigation_scenario_set_c8_unknown_001`, 'UNKNOWN scenario source_fact_id mismatch', unknown);
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
  assert(weatherSummary.source_quality?.provider === 'C8_EXTERNAL_WEATHER_SAMPLE', 'operation report weather_summary source provider mismatch', weatherSummary);
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
  assert(requirementSummary.calculation_inputs?.source_input_id === FORMAL_SKILL_INPUT, 'operation report requirement source_input_id mismatch', requirementSummary);
  assert(requirementSummary.calculation_inputs?.source_refs?.weather_forecast_id === 'wf_c8_irrigation_001', 'operation report requirement weather source ref mismatch', requirementSummary);
  assert(requirementSummary.derivation?.source_input_id === FORMAL_SKILL_INPUT, 'operation report requirement derivation source_input_id mismatch', requirementSummary);
  assert(requirementSummary.derivation?.source_type === 'irrigation_requirement_skill_input_v1', 'operation report requirement derivation source_type mismatch', requirementSummary);
  assert(requirementSummary.derivation?.derivation_type === 'irrigation_requirement_from_skill_input_v1', 'operation report requirement derivation_type mismatch', requirementSummary);
  nearly(requirementSummary.net_irrigation_mm, 18.7, 'operation report requirement net_irrigation_mm');
  nearly(requirementSummary.gross_irrigation_mm, 22, 'operation report requirement gross_irrigation_mm');
  nearly(requirementSummary.gross_irrigation_requirement_mm, 22, 'operation report requirement gross_irrigation_requirement_mm');
  assert(requirementSummary.unit === 'mm', 'operation report requirement unit mismatch', requirementSummary);
  assert(requirementSummary.source_quality?.status === 'SKILL_CALCULATED', 'operation report requirement quality status mismatch', requirementSummary);
  assert(requirementSummary.source_quality?.deterministic === true, 'operation report requirement deterministic flag mismatch', requirementSummary);
  assert(requirementSummary.source_quality?.derivation_status === 'DERIVED_FROM_FORMAL_SKILL_INPUT', 'operation report requirement derivation status mismatch', requirementSummary);
  assert(requirementSummary.source_quality?.source_binding_status === 'BOUND_TO_PROJECTED_FACTS', 'operation report requirement source binding status mismatch', requirementSummary);
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
    console.log('[ACCEPTANCE_C8_FORMAL_CHAIN_BACKEND_P0_V1] STEP soil-moisture-sensing-window');
    await assertSoilMoistureSensingWindowReadback(client);
    console.log('[ACCEPTANCE_C8_FORMAL_CHAIN_BACKEND_P0_V1] STEP soil-moisture-sensing-window-negative-guard');
    await assertSoilMoistureSensingWindowNegativeGuard(client);
    console.log('[ACCEPTANCE_C8_FORMAL_CHAIN_BACKEND_P0_V1] STEP irrigation-skill-input');
    await assertIrrigationSkillInputReadback(client);
    console.log('[ACCEPTANCE_C8_FORMAL_CHAIN_BACKEND_P0_V1] STEP irrigation-skill-input-api');
    await assertIrrigationSkillInputApiReadback();
    console.log('[ACCEPTANCE_C8_FORMAL_CHAIN_BACKEND_P0_V1] STEP irrigation-requirement');
    await assertIrrigationRequirementReadback(client);
    console.log('[ACCEPTANCE_C8_FORMAL_CHAIN_BACKEND_P0_V1] STEP water-state-estimate');
    await assertWaterStateEstimateReadback(client);
    console.log('[ACCEPTANCE_C8_FORMAL_CHAIN_BACKEND_P0_V1] STEP irrigation-scenario-set');
    await assertIrrigationScenarioSetReadback(client);
    console.log('[ACCEPTANCE_C8_FORMAL_CHAIN_BACKEND_P0_V1] STEP roi-formalize');
    await assertRoiFormalization(client, asExecuted.as_executed_id);
    console.log('[ACCEPTANCE_C8_FORMAL_CHAIN_BACKEND_P0_V1] STEP field-memory');
    await assertFieldMemory(client);
    console.log('[ACCEPTANCE_C8_FORMAL_CHAIN_BACKEND_P0_V1] STEP operation-report');
    await assertOperationReport();
    await assertFieldReport();
    console.log('[ACCEPTANCE_C8_FORMAL_CHAIN_BACKEND_P0_V1] PASS', JSON.stringify({ base_url: BASE_URL, tenant: TENANT, as_executed_id: asExecuted.as_executed_id }));
  } finally {
    await cleanupP0Rows(client);
    await client.end().catch(() => {});
  }
})().catch((error) => fail(error?.message || String(error), error?.stack));
