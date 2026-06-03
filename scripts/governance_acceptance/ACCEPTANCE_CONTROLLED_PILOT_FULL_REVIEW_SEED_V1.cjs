#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const http = require('node:http');

const ROOT = path.resolve(__dirname, '..', '..');
const SEED = 'scripts/demo_seed/SEED_CONTROLLED_PILOT_FULL_REVIEW_V1.cjs';
const README = 'scripts/demo_seed/README_CONTROLLED_PILOT_FULL_REVIEW_V1.md';
let failed = false;
function read(rel) { const p = path.join(ROOT, rel); if (!fs.existsSync(p)) { console.error(`[controlled-pilot-full-review-seed] missing file: ${rel}`); failed = true; return ''; } return fs.readFileSync(p, 'utf8'); }
function requireText(scope, text, entries) { for (const item of entries) if (!text.includes(item)) { console.error(`[controlled-pilot-full-review-seed] ${scope} missing: ${item}`); failed = true; } }
function forbid(scope, text, entries) { for (const [label, pattern] of entries) if (pattern.test(text)) { console.error(`[controlled-pilot-full-review-seed] ${scope} forbidden: ${label}`); failed = true; } }
function runNode(args, allowFail = false) { const r = spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8' }); if (r.status !== 0) { if (allowFail) return null; console.error(r.stdout); console.error(r.stderr); throw new Error(`${args.join(' ')} failed`); } return JSON.parse(r.stdout); }
function runScript(args, label) { const r = spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8' }); if (r.status !== 0) { console.error(r.stdout); console.error(r.stderr); console.error(`[controlled-pilot-full-review-seed] ${label} failed`); failed = true; } }
function hasAll(arr, required) { return required.every((x) => arr.includes(x)); }
function assert(cond, msg) { if (!cond) { console.error(`[controlled-pilot-full-review-seed] ${msg}`); failed = true; } }
function httpOk(url) { return new Promise((resolve) => { const req = http.get(url, (res) => { res.resume(); resolve(Boolean(res.statusCode && res.statusCode < 500)); }); req.on('error', () => resolve(false)); req.setTimeout(1000, () => { req.destroy(); resolve(false); }); }); }

const seed = read(SEED);
const readme = read(README);
const pkgText = read('package.json');
requireText('package scripts', pkgText, ['seed:controlled-pilot:full-review:dry-run', 'seed:controlled-pilot:full-review:apply', 'seed:controlled-pilot:full-review:export-json', 'seed:controlled-pilot:full-review:verify', 'ci:frontend:customer-pr18h-routes', 'acceptance:controlled-pilot:full-review-seed']);
requireText('seed static guards', seed, ['ALLOWED_TENANTS', 'demo', 'tenantA', '--apply requires explicit --tenant', "mode: 'dry-run'", 'BEGIN', 'COMMIT', 'ROLLBACK', 'pg_advisory_lock', 'pg_advisory_unlock', 'controlled_pilot_full_review_manifest_v1', 'seed_owned_ids', 'ON CONFLICT', 'export-json', 'export-db-json', 'verify-api', 'verify-clean']);
requireText('seed schema fields', seed, ['request_id', 'from_status', 'status', 'trigger', 'created_ts', 'trigger_stage', 'formal_eligible', 'is_simulated', 'source_lane', 'FORMAL_OPERATION']);
requireText('seed scenario coverage', seed, ['field_c8_demo', 'field_1_demo', 'field_device_risk_demo', 'dev_gateway_offline_001', 'alert_aggregate_missing_location_001', 'op_plan_c8_irrigation_formal_001', 'op_plan_c8_irrigation_pending_001', 'approval_c8_pest_pending_001', 'roi_ledger_v1', 'fm_c8_irrigation_response_001']);
requireText('README seed contract', readme, ['dry-run', 'apply', 'verify', 'cleanup', 'manifest', 'CONTROLLED_PILOT_FULL_REVIEW']);
forbid('seed source', seed, [['TRUNCATE', /\bTRUNCATE\b/i], ['broad facts tenant delete', /DELETE\s+FROM\s+facts\s+WHERE\s+tenant_id/i], ['broad field tenant delete', /DELETE\s+FROM\s+field_index_v1\s+WHERE\s+tenant_id\s*=\s*\$1\s*(?:;|`)/i], ['production bypass', /NODE_ENV\s*===\s*['"]production['"]/], ['allowed all tenants', /ALLOWED_TENANTS[^\n]+all/i], ['literal dev evidence token', /sim_trace|flight-table|flight_table|dev_source/i]]);
runScript(['scripts/frontend_acceptance/ACCEPTANCE_CUSTOMER_PR18H_ROUTES_V1.cjs'], 'customer PR-18H route gate');
runScript(['scripts/frontend_acceptance/ACCEPTANCE_OPERATOR_DEVICE_OFFLINE_WORKFLOW_V1.cjs'], 'operator offline workflow gate');
const dry = runNode([SEED, '--dry-run', '--tenant', 'tenantA']);
assert(dry.ok === true && dry.apply === false && dry.tenant === 'tenantA', 'dry-run envelope invalid');
assert(Number(dry.planned?.facts) === 0, 'dry-run planned.facts must be 0');
for (const [k, min] of Object.entries({ fields: 3, devices: 4, formal_operations: 1, pending_operations: 1, recommendations: 2, approval_requests: 2, receipts: 1, formal_evidence: 2, acceptance_results: 1, field_memory: 1, device_offline_cases: 2, negative_cases: 1 })) assert(Number(dry.planned_counts?.[k] || 0) >= min, `dry-run planned_counts.${k} < ${min}`);
const exported = runNode([SEED, '--export-json', '--tenant', 'tenantA']);
assert(exported.ok === true && exported.tenant_id === 'tenantA', 'export-json envelope invalid');
for (const k of ['manifest', 'tables', 'facts_by_type', 'derived_expectations', 'negative_cases', 'forbidden_customer_dom_text', 'guards', 'system_domains']) assert(exported[k] !== undefined, `export-json missing top-level ${k}`);
for (const t of ['field_index_v1', 'field_polygon_v1', 'device_index_v1', 'device_binding_index_v1', 'device_status_index_v1', 'device_capability', 'telemetry_index_v1', 'device_observation_index_v1', 'alert_event_index_v1', 'field_memory_v1', 'approval_requests_v1', 'operation_state_v1_optional']) assert(Array.isArray(exported.tables?.[t]), `export-json missing table ${t}`);
for (const t of ['decision_recommendation_v1', 'approval_request_v1', 'approval_decision_v1', 'operation_plan_v1', 'operation_plan_transition_v1', 'ao_act_task_v0', 'ao_act_receipt_v1', 'evidence_artifact_v1', 'acceptance_result_v1', 'skill_run_v1', 'controlled_pilot_full_review_manifest_v1']) assert(Array.isArray(exported.facts_by_type?.[t]), `export-json missing fact type ${t}`);
assert(exported.facts_by_type.approval_request_v1.every((x) => x.record_json?.payload?.request_id), 'approval_request_v1 payload must include request_id');
assert(exported.facts_by_type.approval_decision_v1.every((x) => x.record_json?.payload?.request_id), 'approval_decision_v1 payload must include request_id');
assert(exported.facts_by_type.operation_plan_transition_v1.every((x) => x.record_json?.payload?.status && x.record_json?.payload?.trigger && x.record_json?.payload?.created_ts), 'operation_plan_transition_v1 payload must include status/trigger/created_ts');
assert(exported.facts_by_type.skill_run_v1.every((x) => x.record_json?.payload?.trigger_stage), 'skill_run_v1 payload must include trigger_stage');
assert(hasAll(exported.derived_expectations.operator_workbench_queues || [], ['DEVICE_OFFLINE', 'APPROVAL_PENDING', 'ACCEPTANCE_PENDING']), 'operator workbench expectations incomplete');
assert(hasAll(exported.derived_expectations.customer_reports || [], ['OVERVIEW', 'FIELD', 'OPERATION', 'EVIDENCE_VALUE']), 'customer report expectations incomplete');
assert((exported.system_domains || []).length >= 26, 'system domains A-Z coverage missing');
const apiBase = process.env.CONTROLLED_PILOT_VERIFY_API_BASE || process.env.API_BASE_URL || '';
if (apiBase) {
  httpOk(`${apiBase.replace(/\/+$/, '')}/api/health`).then((ok) => {
    if (!ok) return finish();
    const result = runNode([SEED, '--verify-api', '--tenant', 'tenantA', '--base-url', apiBase], true);
    if (!result || result.ok !== true) { console.error('[controlled-pilot-full-review-seed] verify-api failed'); failed = true; }
    finish();
  });
} else finish();
function finish() { if (failed) { console.error('[controlled-pilot-full-review-seed] FAIL'); process.exit(1); } console.log('[controlled-pilot-full-review-seed] PASS'); }
