#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const http = require('node:http');

const ROOT = path.resolve(__dirname, '..', '..');
const SEED = 'scripts/demo_seed/SEED_CONTROLLED_PILOT_FULL_REVIEW_V1.cjs';
const CHAIN_ID = 'C8_FORMAL_IRRIGATION_FULL_CHAIN_V1';
const FORMAL_OP = 'op_plan_c8_irrigation_formal_001';
const FORMAL_TASK = 'act_c8_irrigation_formal_001';
const FORMAL_RECEIPT = 'receipt_c8_irrigation_formal_001';
const FORMAL_ACCEPTANCE = 'acc_c8_irrigation_formal_001';
const FORMAL_FIELD = 'field_c8_demo';
const MEMORY_ID = 'fm_c8_irrigation_response_001';
const ACTUAL_JSON = 'acceptance-output/controlled_pilot_full_review.actual.json';
const RELEASE_GATE_ACTUAL_JSON = 'acceptance-output/controlled_pilot_full_review.release_gate.actual.json';
let failed = false;

function read(rel) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) {
    console.error(`[controlled-pilot-full-review-seed] missing: ${rel}`);
    failed = true;
    return '';
  }
  return fs.readFileSync(file, 'utf8');
}
function need(scope, text, items) { for (const item of items) if (!text.includes(item)) { console.error(`[controlled-pilot-full-review-seed] ${scope} missing: ${item}`); failed = true; } }
function ban(scope, text, pairs) { for (const [label, pattern] of pairs) if (pattern.test(text)) { console.error(`[controlled-pilot-full-review-seed] ${scope} forbidden: ${label}`); failed = true; } }
function rx(parts, flags = 'i') { return new RegExp(parts.join(''), flags); }
function runJson(args) {
  const r = spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) {
    console.error(r.stdout);
    console.error(r.stderr);
    throw new Error(args.join(' '));
  }
  return JSON.parse(r.stdout);
}
function runGate(args, label) {
  const r = spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) {
    console.error(r.stdout);
    console.error(r.stderr);
    console.error(`[controlled-pilot-full-review-seed] gate failed: ${label}`);
    failed = true;
  }
}
function assert(ok, msg, detail) {
  if (!ok) {
    console.error(`[controlled-pilot-full-review-seed] ${msg}`);
    if (detail !== undefined) console.error(JSON.stringify(detail, null, 2));
    failed = true;
  }
}
function nearly(actual, expected, msg) { assert(Math.abs(Number(actual) - Number(expected)) < 0.0001, `${msg}: expected ${expected}, got ${actual}`); }
function hasAll(list, expected) { return expected.every((x) => Array.isArray(list) && list.includes(x)); }
function authTokenForHttp() { return process.env.ADMIN_TOKEN || process.env.TOKEN_ADMIN || process.env.AO_ACT_TOKEN || process.env.GEOX_AO_ACT_TOKEN || process.env.TOKEN || 'admin_token'; }
function httpHeaders() { const token = authTokenForHttp(); return { accept: 'application/json', authorization: `Bearer ${token}`, 'x-geox-token': token, 'x-geox-ao-act-token': token, 'x-ao-act-token': token }; }
function httpOk(url) { return new Promise((resolve) => { const req = http.get(url, { headers: httpHeaders() }, (res) => { res.resume(); resolve(Boolean(res.statusCode && res.statusCode < 500)); }); req.on('error', () => resolve(false)); req.setTimeout(1000, () => { req.destroy(); resolve(false); }); }); }
function httpGet(url) { return new Promise((resolve) => { const req = http.get(url, { headers: httpHeaders() }, (res) => { let raw = ''; res.on('data', (d) => { raw += d; }); res.on('end', () => resolve({ status: res.statusCode || 0, raw })); }); req.on('error', (e) => resolve({ status: 0, raw: String(e.message || e) })); req.setTimeout(3000, () => { req.destroy(); resolve({ status: 0, raw: 'timeout' }); }); }); }
function includesId(rows, id, keys) { return Array.isArray(rows) && rows.some((row) => keys.some((key) => row && row[key] === id) || JSON.stringify(row || {}).includes(id)); }
function table(actual, name) { return actual && actual.tables && Array.isArray(actual.tables[name]) ? actual.tables[name] : []; }
function facts(actual, type) { return actual && actual.facts_by_type && Array.isArray(actual.facts_by_type[type]) ? actual.facts_by_type[type] : []; }
function firstFactPayload(exported, type, predicate = () => true) {
  const row = facts(exported, type).find((x) => predicate(x.record_json?.payload || {}));
  return row ? row.record_json.payload : null;
}
function assertFormalChain(exported) {
  const chain = exported.formal_chain;
  assert(exported.chain_id === CHAIN_ID, 'export-json top-level chain_id mismatch', exported.chain_id);
  assert(exported.manifest?.chain_id === CHAIN_ID, 'manifest.chain_id mismatch', exported.manifest);
  assert(chain?.chain_id === CHAIN_ID, 'formal_chain.chain_id mismatch', chain);
  for (const key of ['field','boundary','devices','observations','diagnosis','recommendation','prescription','approval','operation_plan','ao_act_task','receipt','as_executed_expected','as_applied_expected','evidence','acceptance','roi','field_memory','report_expectations']) assert(chain && chain[key] !== undefined, `formal_chain missing ${key}`);
  assert(chain.field?.field_id === FORMAL_FIELD, 'formal_chain.field_id mismatch', chain.field);
  nearly(chain.field?.area_mu, 30, 'formal_chain.field.area_mu');
  assert(chain.field?.crop_code === 'corn' && chain.field?.crop_name === '玉米' && chain.field?.season_id === 'season_2026_c8_corn' && chain.field?.crop_stage === '营养生长期', 'formal_chain crop/season incomplete', chain.field);
  for (const deviceId of ['dev_soil_c8_001','dev_valve_pump_c8_001','dev_weather_station_c8_001']) {
    const d = (chain.devices || []).find((x) => x.device_id === deviceId);
    assert(d, `formal_chain missing device ${deviceId}`);
    assert(d?.display_kind_text && d?.sensing_role_text && d?.capability_text && d?.field_role_text, `device ${deviceId} missing customer-readable fields`, d);
  }
  const before = (chain.observations || []).find((x) => x.metric === 'soil_moisture_percent');
  const after = (chain.observations || []).find((x) => x.metric === 'soil_moisture_after_percent');
  const rain = (chain.observations || []).find((x) => x.metric === 'forecast_rain_72h_mm');
  assert(before?.metric_label === '20cm 土层水分' && before?.metric_role === 'before' && before?.diagnostic_use === 'irrigation_decision_input', 'before observation metadata invalid', before);
  assert(after?.metric_role === 'after' && after?.diagnostic_use === 'acceptance_effect_input', 'after observation metadata invalid', after);
  assert(rain?.metric_role === 'weather_forecast' && rain?.diagnostic_use === 'irrigation_decision_input', 'rain observation metadata invalid', rain);
  assert(chain.diagnosis?.input_observation_refs?.includes('telemetry_soil_before_001') && chain.diagnosis?.input_observation_refs?.includes('telemetry_rain_001'), 'diagnosis input refs missing', chain.diagnosis);
  assert(chain.recommendation?.expected_effect?.metric === 'soil_moisture_percent', 'recommendation expected effect missing', chain.recommendation);
  assert(chain.prescription?.prescription_id === 'presc_c8_irrigation_001', 'prescription id mismatch', chain.prescription);
  nearly(chain.prescription?.operation_amount?.amount, 22, 'prescription operation_amount.amount');
  assert(chain.prescription?.operation_amount?.metadata?.trace_id === 'skill_trace_c8_irrigation_001', 'prescription trace id missing', chain.prescription);
  assert(chain.operation_plan?.prescription_id === 'presc_c8_irrigation_001' && chain.operation_plan?.target_device_id === 'dev_valve_pump_c8_001', 'operation plan formal fields missing', chain.operation_plan);
  assert(hasAll(chain.operation_plan?.expected_evidence, ['water_delivery_receipt','post_soil_moisture_metric']), 'operation plan expected_evidence incomplete', chain.operation_plan);
  assert(chain.ao_act_task?.parameters?.target_soil_moisture_percent === 24 && chain.ao_act_task?.parameters?.safety?.manual_approval_required === true, 'AO-ACT task executable parameters incomplete', chain.ao_act_task);
  assert(chain.receipt?.receipt_id === FORMAL_RECEIPT && chain.receipt?.task_id === FORMAL_TASK && chain.receipt?.status === 'executed', 'formal receipt identity/status invalid', chain.receipt);
  nearly(chain.receipt?.observed_parameters?.executed_amount, 21.6, 'receipt observed executed_amount');
  nearly(chain.receipt?.resource_usage?.water_l, 432000, 'receipt water_l');
  assert(hasAll(chain.receipt?.evidence_refs, ['ev_c8_irrigation_water_delivery_001','ev_c8_irrigation_metric_001']), 'receipt evidence refs incomplete', chain.receipt);
  assert(chain.acceptance?.acceptance_id === FORMAL_ACCEPTANCE && chain.acceptance?.verdict === 'PASS' && chain.acceptance?.formal_acceptance === true && chain.acceptance?.formal_evidence_passed === true && chain.acceptance?.chain_validation_passed === true && chain.acceptance?.customer_visible_eligible === true, 'formal acceptance gate invalid', chain.acceptance);
  assert(chain.as_executed_expected?.derivation === '/api/v1/as-executed/from-receipt' && chain.as_executed_expected?.status === 'CONFIRMED', 'as_executed expectation invalid', chain.as_executed_expected);
  assert(chain.roi?.source_lane === 'FORMAL_ACCEPTANCE' && chain.roi?.trust_level === 'FORMAL_ACCEPTED' && chain.roi?.formal_acceptance_id === FORMAL_ACCEPTANCE && chain.roi?.formal_evidence_passed === true && chain.roi?.chain_validation_passed === true && chain.roi?.customer_visible_value === true, 'formal ROI trust gate invalid', chain.roi);
  assert(chain.field_memory?.memory_lane === 'FORMAL_FIELD_MEMORY' && chain.field_memory?.trust_level === 'FORMAL_ACCEPTED' && chain.field_memory?.formal_acceptance_id === FORMAL_ACCEPTANCE && chain.field_memory?.customer_visible_memory === true && chain.field_memory?.learning_eligible === true, 'formal field memory gate invalid', chain.field_memory);
  assert(hasAll(chain.report_expectations?.operation_report, ['diagnostic_inputs','prescription','as_executed','as_applied','roi_ledger','field_memory']), 'operation report expectations incomplete', chain.report_expectations);
  assert(hasAll(chain.report_expectations?.field_report, ['field_context','sensing_summary','decision_summary','execution_summary','value_summary','learning_summary']), 'field report expectations incomplete', chain.report_expectations);
  const operationPlan = firstFactPayload(exported, 'operation_plan_v1', (x) => x.operation_plan_id === FORMAL_OP);
  assert(operationPlan?.prescription_id === 'presc_c8_irrigation_001', 'operation_plan fact missing prescription_id', operationPlan);
  const receipt = firstFactPayload(exported, 'ao_act_receipt_v1', (x) => x.receipt_id === FORMAL_RECEIPT);
  assert(receipt?.status === 'executed', 'receipt fact status must be executed', receipt);
}
async function assertOperationsViaApi(apiBase) {
  const base = apiBase.replace(/\/+$/, '');
  const res = await httpGet(`${base}/api/v1/customer/operations`);
  assert(res.status >= 200 && res.status < 500, `operation API fallback failed: ${res.status}`);
  assert(res.raw.includes(FORMAL_OP), 'operation API fallback missing formal operation');
  assert(res.raw.includes('op_plan_c8_irrigation_pending_001'), 'operation API fallback missing pending operation');
}
async function runRuntimeSeedGate() {
  const apiBase = process.env.API_BASE_URL || process.env.BASE_URL || 'http://127.0.0.1:3001';
  fs.mkdirSync(path.join(ROOT, 'acceptance-output'), { recursive: true });
  for (const args of [
    [SEED, '--apply', '--tenant', 'tenantA', '--base-url', apiBase],
    [SEED, '--verify', '--tenant', 'tenantA'],
    [SEED, '--verify-api', '--tenant', 'tenantA', '--base-url', apiBase],
    [SEED, '--export-db-json', '--tenant', 'tenantA', '--out', ACTUAL_JSON],
  ]) runJson(args);
  const actual = JSON.parse(read(ACTUAL_JSON));
  assert(table(actual, 'field_index_v1').length >= 3, 'runtime actual field_index_v1 length < 3');
  assert(table(actual, 'device_index_v1').length >= 4, 'runtime actual device_index_v1 length < 4');
  assert(facts(actual, 'operation_plan_v1').length >= 2, 'runtime actual operation_plan_v1 facts length < 2');
  assert(facts(actual, 'acceptance_result_v1').length >= 2, 'runtime actual acceptance_result_v1 facts length < 2');
  assert(facts(actual, 'skill_run_v1').length >= 4, 'runtime actual skill_run_v1 facts length < 4');
  assert(includesId(table(actual, 'alert_event_index_v1'), 'alert_dev_gateway_offline_001', ['event_id']), 'runtime actual missing alert_dev_gateway_offline_001');
  assert(includesId(table(actual, 'alert_event_index_v1'), 'alert_aggregate_missing_location_001', ['event_id']), 'runtime actual missing alert_aggregate_missing_location_001');
  assert(includesId(table(actual, 'field_memory_v1'), 'fm_c8_irrigation_response_001', ['memory_id']), 'runtime actual missing fm_c8_irrigation_response_001');
  const ops = table(actual, 'operation_state_v1_optional');
  if (ops.length) assert(includesId(ops, FORMAL_OP, ['operation_id']), 'runtime actual missing formal operation_state');
  else await assertOperationsViaApi(apiBase);
  const releaseActual = { ok: !failed, runtime: true, api_base_url: apiBase, actual_json: ACTUAL_JSON, checked_at: new Date().toISOString(), chain_id: CHAIN_ID, checks: { fields: table(actual, 'field_index_v1').length, devices: table(actual, 'device_index_v1').length, operation_plan_facts: facts(actual, 'operation_plan_v1').length, acceptance_result_facts: facts(actual, 'acceptance_result_v1').length, skill_run_facts: facts(actual, 'skill_run_v1').length } };
  fs.writeFileSync(path.join(ROOT, RELEASE_GATE_ACTUAL_JSON), `${JSON.stringify(releaseActual, null, 2)}\n`);
}
async function main() {
  const seed = read(SEED);
  const readme = read('scripts/demo_seed/README_CONTROLLED_PILOT_FULL_REVIEW_V1.md');
  const pkg = read('package.json');
  need('package scripts', pkg, ['seed:controlled-pilot:full-review:dry-run', 'seed:controlled-pilot:full-review:apply', 'seed:controlled-pilot:full-review:export-json', 'seed:controlled-pilot:full-review:verify', 'ci:frontend:customer-pr18h-routes', 'acceptance:controlled-pilot:full-review-seed']);
  need('seed commands and guards', seed, ['ALLOWED_TENANTS', 'demo', 'tenantA', '--apply requires explicit --tenant', 'BEGIN', 'COMMIT', 'ROLLBACK', 'pg_advisory_lock', 'pg_advisory_unlock', 'controlled_pilot_full_review_manifest_v1', 'seed_owned_ids', 'ON CONFLICT', 'export-json', 'export-db-json', 'verify-api', 'verify-clean']);
  need('seed formal chain contract', seed, [CHAIN_ID, 'formal_chain', 'field_crop_season_v1', 'device_observation_context_v1', 'metric_label', 'metric_role', 'diagnostic_use', 'threshold_ref', 'prescription_contract_v1', 'post_soil_moisture_metric', 'target_soil_moisture_percent', 'as_executed_expected', 'as_applied_expected', 'FORMAL_FIELD_MEMORY', 'FORMAL_ACCEPTED']);
  need('seed schema contract', seed, ['request_id', 'from_status', 'status', 'trigger', 'created_ts', 'trigger_stage', 'formal_eligible', 'is_simulated', 'source_lane', 'FORMAL_OPERATION']);
  need('seed scenario ids', seed, ['field_c8_demo', 'field_1_demo', 'field_device_risk_demo', 'dev_gateway_offline_001', 'alert_aggregate_missing_location_001', FORMAL_OP, 'op_plan_c8_irrigation_pending_001', 'approval_c8_pest_pending_001', 'roi_ledger_v1', MEMORY_ID]);
  need('README', readme, ['dry-run', 'apply', 'verify', 'cleanup', 'export-json', 'verify-api', 'verify-clean', CHAIN_ID, 'formal_chain', 'as-executed/from-receipt']);
  ban('seed source', seed, [
    ['truncate', /\bTRUNCATE\b/i],
    ['broad facts tenant cleanup', rx(['DE','LETE\\s+FROM\\s+facts\\s+WHERE\\s+tenant_id'])],
    ['broad field tenant cleanup', rx(['DE','LETE\\s+FROM\\s+field_index_v1\\s+WHERE\\s+tenant_id'])],
    ['production bypass', /NODE_ENV\s*===\s*['"]production['"]],
    ['allow all tenants', /ALLOWED_TENANTS[^\n]*(?:['"]all['"]|\*)/i],
    ['development evidence marker', rx(['sim','_trace|flight_table|dev_source'])],
  ]);
  runGate(['scripts/frontend_acceptance/ACCEPTANCE_CUSTOMER_PR18H_ROUTES_V1.cjs'], 'customer PR-18H routes');
  runGate(['scripts/frontend_acceptance/ACCEPTANCE_OPERATOR_DEVICE_OFFLINE_WORKFLOW_V1.cjs'], 'operator offline workflow');
  const dry = runJson([SEED, '--dry-run', '--tenant', 'tenantA']);
  assert(dry.ok === true && dry.apply === false && dry.tenant === 'tenantA' && dry.chain_id === CHAIN_ID, 'dry-run envelope invalid', dry);
  assert(Number(dry.planned?.facts) === 0, 'dry-run planned.facts must be 0');
  for (const [key, min] of Object.entries({ fields: 3, devices: 4, formal_operations: 1, pending_operations: 1, recommendations: 2, approval_requests: 2, receipts: 2, formal_evidence: 2, acceptance_results: 2, field_memory: 1, prescriptions: 1, device_offline_cases: 2, negative_cases: 1 })) assert(Number(dry.planned_counts?.[key] || 0) >= min, `dry-run planned_counts.${key} < ${min}`);
  const exported = runJson([SEED, '--export-json', '--tenant', 'tenantA']);
  assert(exported.ok === true && exported.tenant_id === 'tenantA', 'export-json envelope invalid');
  for (const key of ['manifest', 'formal_chain', 'tables', 'facts_by_type', 'derived_expectations', 'negative_cases', 'forbidden_customer_dom_text', 'guards', 'system_domains']) assert(exported[key] !== undefined, `export-json missing ${key}`);
  for (const tableName of ['field_index_v1', 'field_polygon_v1', 'device_index_v1', 'device_binding_index_v1', 'device_status_index_v1', 'device_capability', 'telemetry_index_v1', 'device_observation_index_v1', 'alert_event_index_v1', 'prescription_contract_v1', 'field_memory_v1', 'approval_requests_v1', 'operation_state_v1_optional', 'roi_ledger_v1_optional']) assert(Array.isArray(exported.tables?.[tableName]), `export-json missing table ${tableName}`);
  for (const type of ['field_crop_season_v1','device_observation_context_v1','decision_recommendation_v1', 'approval_request_v1', 'approval_decision_v1', 'operation_plan_v1', 'operation_plan_transition_v1', 'ao_act_task_v0', 'ao_act_receipt_v1', 'evidence_artifact_v1', 'acceptance_result_v1', 'skill_run_v1', 'telemetry_observation_v1', 'controlled_pilot_full_review_manifest_v1']) assert(Array.isArray(exported.facts_by_type?.[type]), `export-json missing fact type ${type}`);
  assertFormalChain(exported);
  assert(exported.facts_by_type.approval_request_v1.every((x) => x.record_json?.payload?.request_id), 'approval request facts must include request_id');
  assert(exported.facts_by_type.approval_decision_v1.every((x) => x.record_json?.payload?.request_id), 'approval decision facts must include request_id');
  assert(exported.facts_by_type.operation_plan_transition_v1.every((x) => x.record_json?.payload?.status && x.record_json?.payload?.from_status !== undefined && x.record_json?.payload?.trigger && x.record_json?.payload?.created_ts), 'transition facts must include status/from_status/trigger/created_ts');
  assert(exported.facts_by_type.skill_run_v1.every((x) => x.record_json?.payload?.trigger_stage), 'skill_run facts must include trigger_stage');
  assert(hasAll(exported.derived_expectations.operator_workbench_queues, ['DEVICE_OFFLINE', 'APPROVAL_PENDING', 'ACCEPTANCE_PENDING']), 'operator queue expectations incomplete');
  assert(hasAll(exported.derived_expectations.customer_reports, ['OVERVIEW', 'FIELD', 'OPERATION', 'EVIDENCE_VALUE']), 'customer report expectations incomplete');
  assert((exported.system_domains || []).length >= 26, 'system domains A-Z coverage missing');
  assert((exported.system_domains || []).every((x) => x.id && Array.isArray(x.data) && x.data.length > 0 && x.write_target && Array.isArray(x.consumer) && x.consumer.length > 0 && Array.isArray(x.constraints) && Array.isArray(x.forbidden)), 'system domains must be complete and non-empty');
  if (process.env.CONTROLLED_PILOT_FULL_REVIEW_RUNTIME === '1') {
    await runRuntimeSeedGate();
    finish();
    return;
  }
  const apiBase = process.env.CONTROLLED_PILOT_VERIFY_API_BASE || process.env.API_BASE_URL || '';
  if (apiBase) {
    const ok = await httpOk(`${apiBase.replace(/\/+$/, '')}/api/health`);
    if (ok) {
      const r = spawnSync(process.execPath, [SEED, '--verify-api', '--tenant', 'tenantA', '--base-url', apiBase], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
      if (r.status !== 0) { console.error(r.stdout); console.error(r.stderr); failed = true; }
    }
  }
  finish();
}
function finish() { if (failed) { console.error('[controlled-pilot-full-review-seed] FAIL'); process.exit(1); } console.log('[controlled-pilot-full-review-seed] PASS'); }
main().catch((error) => { console.error(error && (error.stack || error.message) ? (error.stack || error.message) : error); process.exit(1); });
