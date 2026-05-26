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

const restContractPath = 'docs/controlplane/GEOX-CP-ControlPlane-REST-v1.md';
const aoActContractPath = 'docs/controlplane/GEOX-CP-AO-ACT-Contracts-v0.md';
const routePath = 'apps/server/src/routes/control_ao_act.ts';
const v1RoutePath = 'apps/server/src/routes/v1/ao_act.ts';
const approvalRoutePath = 'apps/server/src/routes/control_approval_request_v1.ts';
const scopePath = 'apps/server/src/auth/resource_scope_v1.ts';
const taskServicePath = 'apps/server/src/domain/controlplane/task_service.ts';

for (const p of [restContractPath, aoActContractPath, routePath, v1RoutePath, approvalRoutePath, scopePath, taskServicePath]) {
  assert(fs.existsSync(path.join(root, p)), `missing required file: ${p}`);
}

const restContract = read(restContractPath);
assert(restContract.includes('主入口为 `/api/v1/*`'), 'REST v1 contract must define /api/v1/* as the external primary entry');
assert(restContract.includes('v1 入口允许复用 v0 AO-ACT 运行时'), 'REST v1 contract must explicitly allow v1 wrappers to reuse AO-ACT v0 runtime');
assert(restContract.includes('创建 `ao_act_task_v0`'), 'REST v1 contract must state approval-created action tasks are ao_act_task_v0');
assert(restContract.includes('生成 `ao_act_task_v0`'), 'REST v1 AO-ACT task wrapper must state it generates ao_act_task_v0');
assert(restContract.includes('生成 `ao_act_receipt_v0`'), 'REST v1 AO-ACT receipt wrapper must state it generates ao_act_receipt_v0');

const aoActContract = read(aoActContractPath);
assert(aoActContract.includes('type (required, const) = "ao_act_task_v0"'), 'AO-ACT v0 contract must freeze task fact type');
assert(aoActContract.includes('type (required, const) = "ao_act_receipt_v0"'), 'AO-ACT v0 contract must freeze receipt fact type');
assert(aoActContract.includes('Ledger 中以 record_json 存储'), 'AO-ACT v0 contract must define facts record_json ledger shape');

const route = read(routePath);
assert(route.includes('app.post("/api/v1/actions/task"'), 'AO-ACT task must keep /api/v1/actions/task as primary route');
assert(route.includes('app.post("/api/v1/actions/receipt"'), 'AO-ACT receipt must keep /api/v1/actions/receipt as primary route');
assert(route.includes('type: "ao_act_task_v0"'), 'current task writer must explicitly write ao_act_task_v0 until migration');
assert(route.includes('type: "ao_act_receipt_v0"'), 'current receipt writer must explicitly write ao_act_receipt_v0 until migration');

const v1Route = read(v1RoutePath);
assert(v1Route.includes('registerAoActV1Routes'), 'v1 AO-ACT route module must delegate primary /api/v1/actions routes');
assert(v1Route.includes('type: "ao_act_task_v0"'), 'variable prescription task candidate route must still write ao_act_task_v0 until migration');

const approvalRoute = read(approvalRoutePath);
assert(approvalRoute.includes('/api/v1/actions/task'), 'approval approve flow must issue tasks through /api/v1/actions/task');
assert(approvalRoute.includes('AO_ACT_TASK_ISSUE_FAILED'), 'approval approve flow must surface AO-ACT task issue failures');

const scope = read(scopePath);
assert(scope.includes("record_json::jsonb->>'type' = 'ao_act_task_v0'"), 'getActionTaskScopeV1 must read current ao_act_task_v0 facts');
assert(!scope.includes('FROM ao_act_task_v1'), 'getActionTaskScopeV1 must not read non-current ao_act_task_v1 table');

const taskService = read(taskServicePath);
assert(taskService.includes('app.post("/api/v1/ao-act/receipts/uplink"'), 'receipt uplink bridge route must stay explicit if it writes ao_act_receipt_v1');
assert(taskService.includes('fetchJson(`${hostBaseUrl(req)}/api/v1/ao-act/receipts`'), 'receipt uplink bridge must delegate to stable receipt runtime before writing bridge audit fact');
assert(taskService.includes('type: "ao_act_receipt_v1"'), 'receipt uplink bridge must make the existing v1 audit/write explicit');

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

// Current primary AO-ACT product receipt path is still ao_act_receipt_v0. The existing
// MQTT receipt uplink bridge in task_service.ts delegates into that stable runtime and
// also writes one ao_act_receipt_v1 audit/compat fact for downstream readers. That is an
// existing bridge, not a general AO-ACT fact-v1 migration. Keep the guard strict by
// allowing only this known bridge file and rejecting any additional runtime v1 writers.
const allowedReceiptV1RuntimeWriterFiles = new Set([taskServicePath]);
const receiptV1RuntimeWriters = findText(/["']?type["']?\s*:\s*["']ao_act_receipt_v1["']/i, {
  roots: ['apps/server/src', 'apps/executor/src'],
  exclude: [],
});
const unexpectedReceiptV1RuntimeWriters = receiptV1RuntimeWriters.filter((p) => !allowedReceiptV1RuntimeWriterFiles.has(p));
assert(unexpectedReceiptV1RuntimeWriters.length === 0, `unexpected runtime ao_act_receipt_v1 writer before migration: ${unexpectedReceiptV1RuntimeWriters.join(', ')}`);

const allowedReceiptV1FixtureFiles = new Set([
  'scripts/agronomy_acceptance/ACCEPTANCE_AS_EXECUTED_AS_APPLIED_V1.cjs',
  'scripts/agronomy_acceptance/ACCEPTANCE_AS_EXECUTED_RECORD_V1.cjs',
  'scripts/agronomy_acceptance/ACCEPTANCE_ROI_LEDGER_V1.cjs',
]);
const receiptV1FixtureWriters = findText(/["']?type["']?\s*:\s*["']ao_act_receipt_v1["']/i, {
  roots: ['scripts/agronomy_acceptance'],
  exclude: [],
});
const unexpectedReceiptV1FixtureWriters = receiptV1FixtureWriters.filter((p) => !allowedReceiptV1FixtureFiles.has(p));
assert(unexpectedReceiptV1FixtureWriters.length === 0, `unexpected ao_act_receipt_v1 fixture writer before migration: ${unexpectedReceiptV1FixtureWriters.join(', ')}`);

console.log('[ao-act-version-boundary] PASS', {
  rest_contract: restContractPath,
  ao_act_contract: aoActContractPath,
  product_ingress: '/api/v1/actions/*',
  current_task_fact_type: 'ao_act_task_v0',
  current_receipt_fact_type: 'ao_act_receipt_v0',
  allowed_receipt_v1_runtime_bridge_files: receiptV1RuntimeWriters,
  legacy_receipt_v1_fixture_files: receiptV1FixtureWriters,
});
