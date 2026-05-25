#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (['.git', 'node_modules', 'dist', 'build', 'coverage', '.turbo', 'acceptance-output'].includes(name)) continue;
    const abs = path.join(dir, name);
    const st = fs.statSync(abs);
    if (st.isDirectory()) walk(abs, out);
    else out.push(abs);
  }
  return out;
}

function rel(abs) {
  return path.relative(root, abs).replaceAll('\\\\', '/').replaceAll('\\', '/');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function findText(pattern, options = {}) {
  const roots = options.roots ?? ['apps/server/src', 'apps/executor/src', 'scripts/agronomy_acceptance', 'scripts/governance_acceptance'];
  const exclude = new Set(options.exclude ?? []);
  const hits = [];
  for (const r of roots) {
    const absRoot = path.join(root, r);
    if (!fs.existsSync(absRoot)) continue;
    for (const file of walk(absRoot)) {
      const p = rel(file);
      if (exclude.has(p)) continue;
      if (!/\.(ts|tsx|js|cjs|mjs|md|json)$/.test(p)) continue;
      const txt = fs.readFileSync(file, 'utf8');
      if (typeof pattern === 'string' ? txt.includes(pattern) : pattern.test(txt)) hits.push(p);
    }
  }
  return hits;
}

const contractPath = 'docs/contracts/AO_ACT_VERSION_BOUNDARY_V1.md';
const routePath = 'apps/server/src/routes/control_ao_act.ts';
const v1RoutePath = 'apps/server/src/routes/v1/ao_act.ts';
const scopePath = 'apps/server/src/auth/resource_scope_v1.ts';

assert(fs.existsSync(path.join(root, contractPath)), `missing contract: ${contractPath}`);
assert(fs.existsSync(path.join(root, routePath)), `missing route file: ${routePath}`);
assert(fs.existsSync(path.join(root, v1RoutePath)), `missing v1 route file: ${v1RoutePath}`);
assert(fs.existsSync(path.join(root, scopePath)), `missing scope file: ${scopePath}`);

const contract = read(contractPath);
assert(contract.includes('/api/v1/actions/*'), 'contract must explicitly define /api/v1/actions/* as AO-ACT product ingress');
assert(contract.includes('ao_act_task_v0'), 'contract must explicitly freeze current task fact type ao_act_task_v0');
assert(contract.includes('ao_act_receipt_v0'), 'contract must explicitly freeze current receipt fact type ao_act_receipt_v0');
assert(contract.includes('API v1 does not imply fact type v1'), 'contract must state API version and fact type version are separate');

const route = read(routePath);
assert(route.includes('app.post("/api/v1/actions/task"'), 'AO-ACT task must keep /api/v1/actions/task as primary route');
assert(route.includes('app.post("/api/v1/actions/receipt"'), 'AO-ACT receipt must keep /api/v1/actions/receipt as primary route');
assert(route.includes('type: "ao_act_task_v0"'), 'current task writer must explicitly write ao_act_task_v0 until migration');
assert(route.includes('type: "ao_act_receipt_v0"'), 'current receipt writer must explicitly write ao_act_receipt_v0 until migration');

const v1Route = read(v1RoutePath);
assert(v1Route.includes('registerAoActV1Routes'), 'v1 AO-ACT route module must delegate primary /api/v1/actions routes');

const scope = read(scopePath);
assert(scope.includes("record_json::jsonb->>'type' = 'ao_act_task_v0'"), 'getActionTaskScopeV1 must read current ao_act_task_v0 facts');
assert(!scope.includes('FROM ao_act_task_v1'), 'getActionTaskScopeV1 must not read non-current ao_act_task_v1 table');

const forbiddenTaskV1RuntimeReads = findText(/FROM\s+ao_act_task_v1|record_json::jsonb[^\n]+ao_act_task_v1|record_json[^\n]+ao_act_task_v1/i, {
  roots: ['apps/server/src', 'apps/executor/src'],
  exclude: [
    'apps/server/src/routes/approvals_reject_no_task_regression.test.ts',
    'apps/web/src/viewmodels/timelineLabels.ts',
  ],
});
assert(forbiddenTaskV1RuntimeReads.length === 0, `runtime code must not depend on ao_act_task_v1 before migration: ${forbiddenTaskV1RuntimeReads.join(', ')}`);

const taskV1Writers = findText(/type:\s*["']ao_act_task_v1["']|type\s*=\s*["']ao_act_task_v1["']|->>'type'\)\s*=\s*'ao_act_task_v1'/i, {
  roots: ['apps/server/src', 'apps/executor/src', 'scripts/agronomy_acceptance', 'scripts/governance_acceptance'],
  exclude: [
    'apps/server/src/routes/approvals_reject_no_task_regression.test.ts',
    'scripts/governance_acceptance/ACCEPTANCE_AO_ACT_VERSION_BOUNDARY_V1.cjs',
  ],
});
assert(taskV1Writers.length === 0, `do not introduce ao_act_task_v1 writers/checks before migration: ${taskV1Writers.join(', ')}`);

const receiptV1Writers = findText(/type:\s*["']ao_act_receipt_v1["']|type\s*=\s*["']ao_act_receipt_v1["']/i, {
  roots: ['apps/server/src', 'apps/executor/src', 'scripts/agronomy_acceptance', 'scripts/governance_acceptance'],
  exclude: ['scripts/governance_acceptance/ACCEPTANCE_AO_ACT_VERSION_BOUNDARY_V1.cjs'],
});
assert(receiptV1Writers.length === 0, `do not introduce ao_act_receipt_v1 writers before migration: ${receiptV1Writers.join(', ')}`);

const knownReceiptV1CompatibilityReads = findText('ao_act_receipt_v1', {
  roots: ['apps/server/src', 'apps/executor/src'],
});
const allowedReceiptV1CompatibilityReads = new Set([
  'apps/server/src/routes/billing_v1.ts',
  'apps/server/src/projections/program_timeline_v1.ts',
  'apps/server/src/routes/dashboard_v1.ts',
  'apps/server/src/routes/reports_v1.ts',
  'apps/server/src/routes/acceptance_v1.ts',
  'apps/server/src/routes/operation_state_v1.ts',
  'apps/server/src/routes/evidence_export_jobs_v1.ts',
  'apps/server/src/projections/operation_report_chain_v1.ts',
  'apps/server/src/projections/manual_execution_quality_v1.ts',
  'apps/executor/src/run_dispatch_once.ts',
  'apps/executor/src/adapters/irrigation_simulator.ts',
  'apps/server/src/routes/evidence_report_v1.ts',
  'apps/server/src/domain/controlplane/task_service.ts',
  'apps/server/src/routes/evidence_bundle_v1.ts',
  'apps/server/src/routes/sla_v1.ts',
  'apps/server/src/domain/execution/as_executed_v1.ts',
  'apps/server/src/projections/operation_state_v1.ts',
  'apps/server/src/routes/delivery_evidence_export_v1.ts',
  'apps/executor/src/run_mqtt_receipt_uplink_once.ts',
]);
const unexpectedReceiptV1Reads = knownReceiptV1CompatibilityReads.filter((p) => !allowedReceiptV1CompatibilityReads.has(p));
assert(unexpectedReceiptV1Reads.length === 0, `new ao_act_receipt_v1 compatibility reads must be reviewed and allowlisted: ${unexpectedReceiptV1Reads.join(', ')}`);

console.log('[ao-act-version-boundary] PASS', {
  product_ingress: '/api/v1/actions/*',
  current_task_fact_type: 'ao_act_task_v0',
  current_receipt_fact_type: 'ao_act_receipt_v0',
  compatibility_receipt_v1_reads: knownReceiptV1CompatibilityReads.length,
  contract: contractPath,
});
