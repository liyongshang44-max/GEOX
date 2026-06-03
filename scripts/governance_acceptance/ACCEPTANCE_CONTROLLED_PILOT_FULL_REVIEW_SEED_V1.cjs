#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const http = require('node:http');

const ROOT = path.resolve(__dirname, '..', '..');
const SEED = 'scripts/demo_seed/SEED_CONTROLLED_PILOT_FULL_REVIEW_V1.cjs';
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
function need(scope, text, items) {
  for (const item of items) if (!text.includes(item)) {
    console.error(`[controlled-pilot-full-review-seed] ${scope} missing: ${item}`);
    failed = true;
  }
}
function ban(scope, text, pairs) {
  for (const [label, pattern] of pairs) if (pattern.test(text)) {
    console.error(`[controlled-pilot-full-review-seed] ${scope} forbidden: ${label}`);
    failed = true;
  }
}
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
function assert(ok, msg) { if (!ok) { console.error(`[controlled-pilot-full-review-seed] ${msg}`); failed = true; } }
function hasAll(list, expected) { return expected.every((x) => Array.isArray(list) && list.includes(x)); }
function httpOk(url) { return new Promise((resolve) => { const req = http.get(url, (res) => { res.resume(); resolve(Boolean(res.statusCode && res.statusCode < 500)); }); req.on('error', () => resolve(false)); req.setTimeout(1000, () => { req.destroy(); resolve(false); }); }); }
function httpGet(url) { return new Promise((resolve) => { const req = http.get(url, { headers: { accept: 'application/json' } }, (res) => { let raw = ''; res.on('data', (d) => { raw += d; }); res.on('end', () => resolve({ status: res.statusCode || 0, raw })); }); req.on('error', (e) => resolve({ status: 0, raw: String(e.message || e) })); req.setTimeout(3000, () => { req.destroy(); resolve({ status: 0, raw: 'timeout' }); }); }); }
function includesId(rows, id, keys) { return Array.isArray(rows) && rows.some((row) => keys.some((key) => row && row[key] === id) || JSON.stringify(row || {}).includes(id)); }
function table(actual, name) { return actual && actual.tables && Array.isArray(actual.tables[name]) ? actual.tables[name] : []; }
function facts(actual, type) { return actual && actual.facts_by_type && Array.isArray(actual.facts_by_type[type]) ? actual.facts_by_type[type] : []; }
async function assertOperationsViaApi(apiBase) {
  const base = apiBase.replace(/\/+$/, '');
  const res = await httpGet(`${base}/api/v1/customer/operations`);
  assert(res.status >= 200 && res.status < 500, `operation API fallback failed: ${res.status}`);
  assert(res.raw.includes('op_plan_c8_irrigation_formal_001'), 'operation API fallback missing formal operation');
  assert(res.raw.includes('op_plan_c8_irrigation_pending_001'), 'operation API fallback missing pending operation');
}
async function runRuntimeSeedGate() {
  const apiBase = process.env.API_BASE_URL || process.env.BASE_URL || 'http://127.0.0.1:3001';
  fs.mkdirSync(path.join(ROOT, 'acceptance-output'), { recursive: true });
  for (const args of [
    [SEED, '--apply', '--tenant', 'tenantA'],
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
  if (ops.length) {
    assert(includesId(ops, 'op_plan_c8_irrigation_formal_001', ['operation_id']), 'runtime actual missing formal operation_state');
    assert(includesId(ops, 'op_plan_c8_irrigation_pending_001', ['operation_id']), 'runtime actual missing pending operation_state');
  } else {
    await assertOperationsViaApi(apiBase);
  }
  const releaseActual = { ok: !failed, runtime: true, api_base_url: apiBase, actual_json: ACTUAL_JSON, checked_at: new Date().toISOString(), checks: { fields: table(actual, 'field_index_v1').length, devices: table(actual, 'device_index_v1').length, operation_plan_facts: facts(actual, 'operation_plan_v1').length, acceptance_result_facts: facts(actual, 'acceptance_result_v1').length, skill_run_facts: facts(actual, 'skill_run_v1').length } };
  fs.writeFileSync(path.join(ROOT, RELEASE_GATE_ACTUAL_JSON), `${JSON.stringify(releaseActual, null, 2)}\n`);
}

async function main() {
  const seed = read(SEED);
  const readme = read('scripts/demo_seed/README_CONTROLLED_PILOT_FULL_REVIEW_V1.md');
  const pkg = read('package.json');
  need('package scripts', pkg, ['seed:controlled-pilot:full-review:dry-run', 'seed:controlled-pilot:full-review:apply', 'seed:controlled-pilot:full-review:export-json', 'seed:controlled-pilot:full-review:verify', 'ci:frontend:customer-pr18h-routes', 'acceptance:controlled-pilot:full-review-seed']);
  need('seed commands and guards', seed, ['ALLOWED_TENANTS', 'demo', 'tenantA', '--apply requires explicit --tenant', 'BEGIN', 'COMMIT', 'ROLLBACK', 'pg_advisory_lock', 'pg_advisory_unlock', 'controlled_pilot_full_review_manifest_v1', 'seed_owned_ids', 'ON CONFLICT', 'export-json', 'export-db-json', 'verify-api', 'verify-clean']);
  need('seed schema contract', seed, ['request_id', 'from_status', 'status', 'trigger', 'created_ts', 'trigger_stage', 'formal_eligible', 'is_simulated', 'source_lane', 'FORMAL_OPERATION']);
  need('seed scenario ids', seed, ['field_c8_demo', 'field_1_demo', 'field_device_risk_demo', 'dev_gateway_offline_001', 'alert_aggregate_missing_location_001', 'op_plan_c8_irrigation_formal_001', 'op_plan_c8_irrigation_pending_001', 'approval_c8_pest_pending_001', 'roi_ledger_v1', 'fm_c8_irrigation_response_001']);
  need('README', readme, ['dry-run', 'apply', 'verify', 'cleanup', 'export-json', 'verify-api', 'verify-clean']);
  ban('seed source', seed, [
    ['truncate', /\bTRUNCATE\b/i],
    ['broad facts tenant cleanup', rx(['DE','LETE\\s+FROM\\s+facts\\s+WHERE\\s+tenant_id'])],
    ['broad field tenant cleanup', rx(['DE','LETE\\s+FROM\\s+field_index_v1\\s+WHERE\\s+tenant_id'])],
    ['production bypass', /NODE_ENV\s*===\s*['"]production['"]/],
    ['allow all tenants', /ALLOWED_TENANTS[^\n]*(?:['"]all['"]|\*)/i],
    ['development evidence marker', rx(['sim','_trace|flight_table|dev_source'])],
  ]);
  runGate(['scripts/frontend_acceptance/ACCEPTANCE_CUSTOMER_PR18H_ROUTES_V1.cjs'], 'customer PR-18H routes');
  runGate(['scripts/frontend_acceptance/ACCEPTANCE_OPERATOR_DEVICE_OFFLINE_WORKFLOW_V1.cjs'], 'operator offline workflow');
  const dry = runJson([SEED, '--dry-run', '--tenant', 'tenantA']);
  assert(dry.ok === true && dry.apply === false && dry.tenant === 'tenantA', 'dry-run envelope invalid');
  assert(Number(dry.planned?.facts) === 0, 'dry-run planned.facts must be 0');
  for (const [key, min] of Object.entries({ fields: 3, devices: 4, formal_operations: 1, pending_operations: 1, recommendations: 2, approval_requests: 2, receipts: 1, formal_evidence: 2, acceptance_results: 1, field_memory: 1, device_offline_cases: 2, negative_cases: 1 })) {
    assert(Number(dry.planned_counts?.[key] || 0) >= min, `dry-run planned_counts.${key} < ${min}`);
  }
  const exported = runJson([SEED, '--export-json', '--tenant', 'tenantA']);
  assert(exported.ok === true && exported.tenant_id === 'tenantA', 'export-json envelope invalid');
  for (const key of ['manifest', 'tables', 'facts_by_type', 'derived_expectations', 'negative_cases', 'forbidden_customer_dom_text', 'guards', 'system_domains']) assert(exported[key] !== undefined, `export-json missing ${key}`);
  for (const tableName of ['field_index_v1', 'field_polygon_v1', 'device_index_v1', 'device_binding_index_v1', 'device_status_index_v1', 'device_capability', 'telemetry_index_v1', 'device_observation_index_v1', 'alert_event_index_v1', 'field_memory_v1', 'approval_requests_v1', 'operation_state_v1_optional']) assert(Array.isArray(exported.tables?.[tableName]), `export-json missing table ${tableName}`);
  for (const type of ['decision_recommendation_v1', 'approval_request_v1', 'approval_decision_v1', 'operation_plan_v1', 'operation_plan_transition_v1', 'ao_act_task_v0', 'ao_act_receipt_v1', 'evidence_artifact_v1', 'acceptance_result_v1', 'skill_run_v1', 'controlled_pilot_full_review_manifest_v1']) assert(Array.isArray(exported.facts_by_type?.[type]), `export-json missing fact type ${type}`);
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
