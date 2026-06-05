#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const http = require('node:http');

const ROOT = path.resolve(__dirname, '..', '..');
const SEED = 'scripts/demo_seed/SEED_CONTROLLED_PILOT_FULL_REVIEW_V1.cjs';
const README = 'scripts/demo_seed/README_CONTROLLED_PILOT_FULL_REVIEW_V1.md';
const CHAIN_ID = 'C8_FORMAL_IRRIGATION_FULL_CHAIN_V1';
const FORMAL_OP = 'op_plan_c8_irrigation_formal_001';
const FORMAL_TASK = 'act_c8_irrigation_formal_001';
const FORMAL_RECEIPT = 'receipt_c8_irrigation_formal_001';
const FORMAL_ACC = 'acc_c8_irrigation_formal_001';
const FORMAL_FIELD = 'field_c8_demo';
let failed = false;

function fail(message, detail) {
  console.error(`[controlled-pilot-full-review-seed] ${message}`);
  if (detail !== undefined) console.error(JSON.stringify(detail, null, 2));
  failed = true;
}
function assert(ok, message, detail) { if (!ok) fail(message, detail); }
function nearly(actual, expected, message) { assert(Math.abs(Number(actual) - Number(expected)) < 0.0001, `${message}: expected ${expected}, got ${actual}`); }
function read(rel) {
  const file = path.join(ROOT, rel);
  assert(fs.existsSync(file), `missing file ${rel}`);
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}
function need(scope, text, items) { for (const item of items) assert(text.includes(item), `${scope} missing ${item}`); }
function ban(scope, text, pairs) { for (const [label, pattern] of pairs) assert(!pattern.test(text), `${scope} forbidden ${label}`); }
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
    fail(`gate failed: ${label}`);
  }
}
function hasAll(list, expected) { return expected.every((x) => Array.isArray(list) && list.includes(x)); }
function facts(exported, type) { return Array.isArray(exported?.facts_by_type?.[type]) ? exported.facts_by_type[type] : []; }
function payloads(exported, type) { return facts(exported, type).map((x) => x.record_json?.payload || {}); }
function firstPayload(exported, type, predicate) { return payloads(exported, type).find(predicate) || null; }
function authHeaders() {
  const token = process.env.ADMIN_TOKEN || process.env.TOKEN_ADMIN || process.env.AO_ACT_TOKEN || process.env.GEOX_AO_ACT_TOKEN || process.env.TOKEN || 'admin_token';
  return { accept: 'application/json', authorization: `Bearer ${token}`, 'x-geox-token': token, 'x-geox-ao-act-token': token, 'x-ao-act-token': token };
}
function httpOk(url) {
  return new Promise((resolve) => {
    const req = http.get(url, { headers: authHeaders() }, (res) => { res.resume(); resolve(Boolean(res.statusCode && res.statusCode < 500)); });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => { req.destroy(); resolve(false); });
  });
}

function assertFormalChain(exported) {
  const c = exported.formal_chain;
  assert(exported.chain_id === CHAIN_ID, 'top-level chain_id mismatch', exported.chain_id);
  assert(exported.manifest?.chain_id === CHAIN_ID, 'manifest.chain_id mismatch', exported.manifest);
  assert(c?.chain_id === CHAIN_ID, 'formal_chain.chain_id mismatch', c);
  for (const key of ['field','boundary','devices','observations','diagnosis','recommendation','prescription','approval','operation_plan','ao_act_task','receipt','as_executed_expected','as_applied_expected','evidence','acceptance','roi','field_memory','report_expectations']) assert(c?.[key] !== undefined, `formal_chain missing ${key}`);

  assert(c.field?.field_id === FORMAL_FIELD, 'formal field id mismatch', c.field);
  nearly(c.field?.area_mu, 30, 'field area_mu');
  assert(c.field?.crop_code === 'corn' && c.field?.crop_name === '玉米' && c.field?.season_id === 'season_2026_c8_corn' && c.field?.crop_stage === '营养生长期', 'crop season metadata incomplete', c.field);

  for (const deviceId of ['dev_soil_c8_001','dev_valve_pump_c8_001','dev_weather_station_c8_001']) {
    const d = (c.devices || []).find((x) => x.device_id === deviceId);
    assert(d, `formal_chain missing device ${deviceId}`);
    assert(d?.display_kind_text && d?.sensing_role_text && d?.capability_text && d?.field_role_text, `device ${deviceId} missing customer text`, d);
  }
  const before = (c.observations || []).find((x) => x.metric === 'soil_moisture_percent');
  const after = (c.observations || []).find((x) => x.metric === 'soil_moisture_after_percent');
  const rain = (c.observations || []).find((x) => x.metric === 'forecast_rain_72h_mm');
  assert(before?.metric_label === '20cm 土层水分' && before?.metric_role === 'before' && before?.diagnostic_use === 'irrigation_decision_input', 'before observation metadata invalid', before);
  assert(after?.metric_role === 'after' && after?.diagnostic_use === 'acceptance_effect_input', 'after observation metadata invalid', after);
  assert(rain?.metric_role === 'weather_forecast' && rain?.diagnostic_use === 'irrigation_decision_input', 'rain observation metadata invalid', rain);

  assert(c.diagnosis?.input_observation_refs?.includes('telemetry_soil_before_001') && c.diagnosis?.input_observation_refs?.includes('telemetry_rain_001'), 'diagnosis input refs missing', c.diagnosis);
  assert(c.recommendation?.expected_effect?.metric === 'soil_moisture_percent', 'recommendation expected effect missing', c.recommendation);
  assert(c.prescription?.prescription_id === 'presc_c8_irrigation_001', 'prescription id mismatch', c.prescription);
  nearly(c.prescription?.operation_amount?.amount, 22, 'prescription amount');
  assert(c.prescription?.operation_amount?.metadata?.trace_id === 'skill_trace_c8_irrigation_001', 'prescription trace missing', c.prescription);
  assert(c.operation_plan?.prescription_id === 'presc_c8_irrigation_001' && c.operation_plan?.target_device_id === 'dev_valve_pump_c8_001', 'operation plan formal fields missing', c.operation_plan);
  assert(hasAll(c.operation_plan?.expected_evidence, ['water_delivery_receipt','post_soil_moisture_metric']), 'operation plan expected_evidence incomplete', c.operation_plan);
  assert(c.ao_act_task?.parameters?.target_soil_moisture_percent === 24 && c.ao_act_task?.parameters?.safety?.manual_approval_required === true, 'AO-ACT executable parameters incomplete', c.ao_act_task);
  assert(c.receipt?.receipt_id === FORMAL_RECEIPT && c.receipt?.task_id === FORMAL_TASK && c.receipt?.status === 'executed', 'formal receipt identity/status invalid', c.receipt);
  nearly(c.receipt?.observed_parameters?.executed_amount, 21.6, 'receipt executed_amount');
  nearly(c.receipt?.resource_usage?.water_l, 432000, 'receipt water_l');
  assert(hasAll(c.receipt?.evidence_refs, ['ev_c8_irrigation_water_delivery_001','ev_c8_irrigation_metric_001']), 'receipt evidence refs incomplete', c.receipt);
  assert(c.acceptance?.acceptance_id === FORMAL_ACC && c.acceptance?.verdict === 'PASS' && c.acceptance?.formal_acceptance === true && c.acceptance?.formal_evidence_passed === true && c.acceptance?.chain_validation_passed === true && c.acceptance?.customer_visible_eligible === true, 'formal acceptance gate invalid', c.acceptance);
  assert(c.as_executed_expected?.derivation === '/api/v1/as-executed/from-receipt' && c.as_executed_expected?.status === 'CONFIRMED', 'as-executed expectation invalid', c.as_executed_expected);
  assert(c.roi?.source_lane === 'FORMAL_ACCEPTANCE' && c.roi?.trust_level === 'FORMAL_ACCEPTED' && c.roi?.formal_acceptance_id === FORMAL_ACC && c.roi?.formal_evidence_passed === true && c.roi?.chain_validation_passed === true && c.roi?.customer_visible_value === true, 'formal ROI gate invalid', c.roi);
  assert(c.field_memory?.memory_lane === 'FORMAL_FIELD_MEMORY' && c.field_memory?.trust_level === 'FORMAL_ACCEPTED' && c.field_memory?.formal_acceptance_id === FORMAL_ACC && c.field_memory?.customer_visible_memory === true && c.field_memory?.learning_eligible === true, 'formal field memory gate invalid', c.field_memory);
  assert(hasAll(c.report_expectations?.operation_report, ['diagnostic_inputs','prescription','as_executed','as_applied','roi_ledger','field_memory']), 'operation report expectations incomplete', c.report_expectations);
  assert(hasAll(c.report_expectations?.field_report, ['field_context','sensing_summary','decision_summary','execution_summary','value_summary','learning_summary']), 'field report expectations incomplete', c.report_expectations);
}

function assertExportFacts(exported) {
  const op = firstPayload(exported, 'operation_plan_v1', (x) => x.operation_plan_id === FORMAL_OP);
  assert(op?.prescription_id === 'presc_c8_irrigation_001', 'operation_plan fact missing prescription_id', op);
  assert(hasAll(op?.expected_evidence, ['water_delivery_receipt','post_soil_moisture_metric']), 'operation_plan fact expected_evidence incomplete', op);
  const receipt = firstPayload(exported, 'ao_act_receipt_v1', (x) => x.receipt_id === FORMAL_RECEIPT);
  assert(receipt?.status === 'executed' && receipt?.task_id === FORMAL_TASK, 'receipt fact status/task_id invalid', receipt);
  const acc = firstPayload(exported, 'acceptance_result_v1', (x) => x.acceptance_id === FORMAL_ACC);
  assert(acc?.formal_acceptance === true && acc?.formal_evidence_passed === true && acc?.chain_validation_passed === true, 'acceptance fact formal gate invalid', acc);
  const transitions = payloads(exported, 'operation_plan_transition_v1').filter((x) => x.operation_plan_id === FORMAL_OP).map((x) => x.status);
  assert(hasAll(transitions, ['CREATED','APPROVAL_REQUESTED','APPROVED','READY','DISPATCHED','ACKED','EXECUTED','ACCEPTANCE_REQUESTED','ACCEPTED']), 'formal transition chain incomplete', transitions);
}

async function main() {
  const seed = read(SEED);
  const readme = read(README);
  const pkg = read('package.json');
  need('package scripts', pkg, ['seed:controlled-pilot:full-review:dry-run', 'seed:controlled-pilot:full-review:apply', 'seed:controlled-pilot:full-review:export-json', 'seed:controlled-pilot:full-review:verify', 'acceptance:controlled-pilot:full-review-seed']);
  need('seed commands and guards', seed, ['ALLOWED_TENANTS', 'demo', 'tenantA', '--apply requires explicit --tenant', 'BEGIN', 'COMMIT', 'ROLLBACK', 'pg_advisory_lock', 'pg_advisory_unlock', 'controlled_pilot_full_review_manifest_v1', 'seed_owned_ids', 'ON CONFLICT', 'export-json', 'export-db-json', 'verify-api', 'verify-clean']);
  need('seed formal chain contract', seed, [CHAIN_ID, 'formal_chain', 'field_crop_season_v1', 'device_observation_context_v1', 'metric_label', 'metric_role', 'diagnostic_use', 'threshold_ref', 'prescription_contract_v1', 'post_soil_moisture_metric', 'target_soil_moisture_percent', 'as_executed_expected', 'as_applied_expected', 'FORMAL_FIELD_MEMORY', 'FORMAL_ACCEPTED']);
  need('README', readme, ['dry-run', 'apply', 'verify', 'cleanup', 'export-json', 'verify-api', 'verify-clean', CHAIN_ID, 'formal_chain', 'as-executed/from-receipt']);
  ban('seed source', seed, [
    ['truncate', /\bTRUNCATE\b/i],
    ['broad facts tenant cleanup', /DELETE\s+FROM\s+facts\s+WHERE\s+tenant_id/i],
    ['broad field tenant cleanup', /DELETE\s+FROM\s+field_index_v1\s+WHERE\s+tenant_id/i],
    ['production bypass', /NODE_ENV\s*===\s*['"]production['"]/],
    ['allow all tenants', /ALLOWED_TENANTS[^\n]*(?:['"]all['"]|\*)/i],
    ['development evidence marker', /sim_trace|flight_table|dev_source/i],
  ]);

  runGate(['scripts/frontend_acceptance/ACCEPTANCE_CUSTOMER_PR18H_ROUTES_V1.cjs'], 'customer PR-18H routes');
  runGate(['scripts/frontend_acceptance/ACCEPTANCE_OPERATOR_DEVICE_OFFLINE_WORKFLOW_V1.cjs'], 'operator offline workflow');

  const dry = runJson([SEED, '--dry-run', '--tenant', 'tenantA']);
  assert(dry.ok === true && dry.apply === false && dry.tenant === 'tenantA' && dry.chain_id === CHAIN_ID, 'dry-run envelope invalid', dry);
  for (const [key, min] of Object.entries({ fields: 3, devices: 4, formal_operations: 1, pending_operations: 1, recommendations: 2, approval_requests: 2, receipts: 2, formal_evidence: 2, acceptance_results: 2, field_memory: 1, prescriptions: 1, device_offline_cases: 2, negative_cases: 1 })) assert(Number(dry.planned_counts?.[key] || 0) >= min, `dry-run planned_counts.${key} < ${min}`);

  const exported = runJson([SEED, '--export-json', '--tenant', 'tenantA']);
  assert(exported.ok === true && exported.tenant_id === 'tenantA', 'export-json envelope invalid', exported);
  for (const key of ['chain_id', 'manifest', 'formal_chain', 'tables', 'facts_by_type', 'derived_expectations', 'negative_cases', 'forbidden_customer_dom_text', 'guards', 'system_domains']) assert(exported[key] !== undefined, `export-json missing ${key}`);
  for (const tableName of ['field_index_v1', 'field_polygon_v1', 'device_index_v1', 'device_binding_index_v1', 'device_status_index_v1', 'device_capability', 'telemetry_index_v1', 'device_observation_index_v1', 'alert_event_index_v1', 'prescription_contract_v1', 'field_memory_v1', 'approval_requests_v1', 'operation_state_v1_optional', 'roi_ledger_v1_optional']) assert(Array.isArray(exported.tables?.[tableName]), `export-json missing table ${tableName}`);
  for (const type of ['field_crop_season_v1','device_observation_context_v1','decision_recommendation_v1', 'approval_request_v1', 'approval_decision_v1', 'operation_plan_v1', 'operation_plan_transition_v1', 'ao_act_task_v0', 'ao_act_receipt_v1', 'evidence_artifact_v1', 'acceptance_result_v1', 'skill_run_v1', 'telemetry_observation_v1', 'controlled_pilot_full_review_manifest_v1']) assert(Array.isArray(exported.facts_by_type?.[type]), `export-json missing fact type ${type}`);
  assertFormalChain(exported);
  assertExportFacts(exported);
  assert(hasAll(exported.derived_expectations.operator_workbench_queues, ['DEVICE_OFFLINE', 'APPROVAL_PENDING', 'ACCEPTANCE_PENDING']), 'operator queue expectations incomplete');
  assert(hasAll(exported.derived_expectations.customer_reports, ['OVERVIEW', 'FIELD', 'OPERATION', 'EVIDENCE_VALUE']), 'customer report expectations incomplete');
  assert((exported.system_domains || []).length >= 26, 'system domains A-Z coverage missing');
  assert((exported.system_domains || []).every((x) => x.id && Array.isArray(x.data) && x.data.length > 0 && x.write_target && Array.isArray(x.consumer) && x.consumer.length > 0 && Array.isArray(x.constraints) && Array.isArray(x.forbidden)), 'system domains must be complete and non-empty');

  const apiBase = process.env.CONTROLLED_PILOT_VERIFY_API_BASE || process.env.API_BASE_URL || '';
  if (apiBase && await httpOk(`${apiBase.replace(/\/+$/, '')}/api/health`)) {
    const r = spawnSync(process.execPath, [SEED, '--verify-api', '--tenant', 'tenantA', '--base-url', apiBase], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    if (r.status !== 0) { console.error(r.stdout); console.error(r.stderr); failed = true; }
  }

  if (failed) { console.error('[controlled-pilot-full-review-seed] FAIL'); process.exit(1); }
  console.log('[controlled-pilot-full-review-seed] PASS');
}
main().catch((error) => { console.error(error && (error.stack || error.message) ? (error.stack || error.message) : error); process.exit(1); });
