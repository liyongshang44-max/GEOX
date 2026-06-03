#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const SEED = 'scripts/demo_seed/SEED_CONTROLLED_PILOT_FULL_REVIEW_V1.cjs';
const README = 'scripts/demo_seed/README_CONTROLLED_PILOT_FULL_REVIEW_V1.md';
let failed = false;

function read(rel) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) {
    console.error(`[controlled-pilot-full-review-seed] missing file: ${rel}`);
    failed = true;
    return '';
  }
  return fs.readFileSync(p, 'utf8');
}
function requireText(scope, text, entries) {
  for (const item of entries) if (!text.includes(item)) {
    console.error(`[controlled-pilot-full-review-seed] ${scope} missing: ${item}`);
    failed = true;
  }
}
function forbid(scope, text, entries) {
  for (const [label, pattern] of entries) if (pattern.test(text)) {
    console.error(`[controlled-pilot-full-review-seed] ${scope} forbidden: ${label}`);
    failed = true;
  }
}
function runNode(args) {
  const r = spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8' });
  if (r.status !== 0) {
    console.error(r.stdout);
    console.error(r.stderr);
    throw new Error(`${args.join(' ')} failed`);
  }
  return JSON.parse(r.stdout);
}

const seed = read(SEED);
const readme = read(README);
const pkgText = read('package.json');

requireText('package scripts', pkgText, [
  'seed:controlled-pilot:full-review:dry-run',
  'seed:controlled-pilot:full-review:apply',
  'acceptance:controlled-pilot:full-review-seed',
]);
requireText('seed safety gates', seed, [
  'ALLOWED_TENANTS', 'demo', 'tenantA', '--apply requires explicit --tenant', "mode: 'dry-run'",
  'BEGIN', 'COMMIT', 'ROLLBACK', 'pg_advisory_lock', 'pg_advisory_unlock',
  'controlled_pilot_full_review_manifest_v1', 'seed_owned_ids', 'prefixOf',
  'CONTROLLED_PILOT_FULL_REVIEW', 'ON CONFLICT', 'NEEDS_FIELD_BINDING',
]);
requireText('seed full review scenarios', seed, [
  'field_c8_demo', 'C8 灌溉示范田', 'field_1_demo', 'field_device_risk_demo',
  'op_plan_c8_irrigation_formal_001', 'act_c8_irrigation_formal_001', 'receipt_c8_irrigation_formal_001', 'acc_c8_irrigation_formal_001', 'fm_c8_irrigation_response_001',
  'op_plan_c8_irrigation_pending_001', 'dev_gateway_offline_001', 'alert_aggregate_missing_location_001',
  'rec_c8_pest_inspection_pending_001', 'approval_c8_pest_pending_001',
  'soil_moisture_percent', 'soil_moisture_after_percent', 'forecast_rain_72h_mm', 'temperature_max_c',
  'operation_state_v1', 'approval_requests_v1', 'field_memory_v1', 'device_observation_index_v1',
]);
requireText('README seed contract', readme, ['dry-run', 'apply', 'verify', 'cleanup', 'manifest', 'CONTROLLED_PILOT_FULL_REVIEW']);
forbid('seed source', seed, [
  ['TRUNCATE', /\bTRUNCATE\b/i],
  ['broad facts tenant delete', /DELETE\s+FROM\s+facts\s+WHERE\s+tenant_id/i],
  ['broad field tenant delete', /DELETE\s+FROM\s+field_index_v1\s+WHERE\s+tenant_id\s*=\s*\$1\s*(?:;|`)/i],
  ['production bypass', /NODE_ENV\s*===\s*['"]production['"]/],
  ['allowed all tenants', /ALLOWED_TENANTS[^\n]+all/i],
  ['literal dev evidence token', /sim_trace|flight-table|flight_table|dev_source/i],
]);

const planned = runNode([SEED, '--dry-run', '--tenant', 'tenantA']);
const c = planned.planned_counts || {};
for (const [key, min] of Object.entries({ fields: 3, devices: 4, formal_operations: 1, pending_operations: 1, recommendations: 2, approval_requests: 2, receipts: 1, formal_evidence: 2, acceptance_results: 1, field_memory: 1, device_offline_cases: 2, negative_cases: 1 })) {
  if (Number(c[key] || 0) < min) {
    console.error(`[controlled-pilot-full-review-seed] dry-run planned_counts.${key} < ${min}`);
    failed = true;
  }
}
if (planned.ok !== true || planned.apply !== false || planned.tenant !== 'tenantA' || planned.source_lane !== 'CONTROLLED_PILOT_FULL_REVIEW' || planned.dataset_version !== 'v1') {
  console.error('[controlled-pilot-full-review-seed] dry-run envelope invalid');
  failed = true;
}
if (Number(planned.planned?.facts || -1) !== 0) {
  console.error('[controlled-pilot-full-review-seed] dry-run planned.facts must be 0');
  failed = true;
}
if (Number(planned.planned?.tables?.operation_state_v1_if_exists || 0) < 2 || Number(planned.planned?.tables?.approval_requests_v1_if_exists || 0) < 1) {
  console.error('[controlled-pilot-full-review-seed] dry-run must plan optional operator fallback rows');
  failed = true;
}

const customerRoute = read('apps/server/src/routes/customer_v1.ts');
requireText('customer reports backend hardening', customerRoute, ['data_trust_text', '有限记录', '当前数据可信级别为有限记录，不代表正式经营结论']);
forbid('customer reports backend hardening', customerRoute, [
  ['limited subtitle raw code', /limitedSubtitle[\s\S]*?LIMITED，不代表正式经营结论/],
  ['reports official api data scope', /dataScope:\s*["']OFFICIAL_CUSTOMER_API["']/],
]);

const api = read('apps/web/src/api/customerReportsCenter.ts');
const vm = read('apps/web/src/viewmodels/customerReportsCenterVm.ts');
const page = read('apps/web/src/views/CustomerReportsCenterPage.tsx');
requireText('customer reports frontend hardening', api + vm + page, ['data_trust_text', 'trustText', 'sanitizeCustomerText', 'customerSemanticLabel', '数据可信级别：', '状态：', '更新时间：']);
forbid('customer reports frontend source', page + vm, [
  ['admin/internal preview', /admin\/internal\s+preview/i],
  ['STATE_FALLBACK_LIMITED visible literal', /STATE_FALLBACK_LIMITED/],
  ['OFFICIAL_CUSTOMER_API visible literal', /OFFICIAL_CUSTOMER_API/],
]);

const productLanguage = read('scripts/frontend_acceptance/ACCEPTANCE_CUSTOMER_PRODUCT_LANGUAGE_V1.cjs');
const runtimeAudit = read('scripts/frontend_acceptance/ACCEPTANCE_FRONTEND_RUNTIME_PAGE_AUDIT_V1.cjs');
const uiSemantics = read('scripts/frontend_acceptance/ACCEPTANCE_CUSTOMER_UI_SEMANTICS_V1.cjs');
requireText('frontend acceptance route coverage', productLanguage + runtimeAudit + uiSemantics, ['/customer/reports', '/customer/fields', '/customer/operations']);
requireText('frontend acceptance raw code gates', productLanguage + runtimeAudit + uiSemantics, ['LIMITED', 'AVAILABLE', 'PENDING', 'UNAVAILABLE', 'STATE_FALLBACK_LIMITED', 'OFFICIAL_CUSTOMER_API']);

if (failed) {
  console.error('[controlled-pilot-full-review-seed] FAIL');
  process.exit(1);
}
console.log('[controlled-pilot-full-review-seed] PASS');
