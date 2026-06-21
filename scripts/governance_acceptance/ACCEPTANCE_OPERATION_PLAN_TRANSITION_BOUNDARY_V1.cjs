#!/usr/bin/env node
// scripts/governance_acceptance/ACCEPTANCE_OPERATION_PLAN_TRANSITION_BOUNDARY_V1.cjs
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const fail = (m) => { throw new Error(m); };
const assert = (c, m) => { if (!c) fail(m); };
const routePath = 'apps/server/src/routes/control_operation_plan_v1.ts';
const builderPath = 'apps/server/src/domain/operations/operation_plan_transition_builder_v1.ts';
const route = read(routePath);
const builder = read(builderPath);
const roles = read('apps/server/src/domain/auth/roles.ts');
const auth = read('apps/server/src/auth/ao_act_authz_v0.ts');
assert(route.includes('POST') || route.includes('app.post'), 'route must use POST');
assert(route.includes('/api/v1/operator/operation-plans/:operation_plan_id/transition'), 'route path missing');
assert(route.includes('operation_plan_index_v1'), 'route must read/update operation_plan_index_v1');
assert(route.includes("operation_plan_v1"), 'route must read operation_plan_v1');
assert(route.includes("operation_plan_transition_v1"), 'route must write operation_plan_transition_v1');
assert(route.includes("operator_operation_plan_transition_submission_v1"), 'route must write submission fact');
assert(route.includes('upsertOperationPlanIndexV1'), 'route must update index projection');
for (const forbidden of ['ao_act_task_v0', '/api/v1/actions/task', 'ao_act_receipt_v1', 'roi_ledger_v1', 'field_memory_v1']) assert(!route.includes(forbidden), `route forbidden token ${forbidden}`);
assert(!/dispatch/i.test(route.replace('dispatch_created', '')), 'route must not create dispatch');
for (const forbidden of ['from "pg"', "from 'pg'", 'Fastify', '../routes', 'process.env', 'Date.now', 'new Date', 'randomUUID']) assert(!builder.includes(forbidden), `builder forbidden token ${forbidden}`);
assert(auth.includes('"operation.plan.transition"'), 'auth scope missing');
assert(/operator:\s*\[[^\]]*operation\.plan\.transition/s.test(roles), 'operator lacks transition scope');
assert(/admin:\s*\[[^\]]*"\*"/s.test(roles), 'admin lacks wildcard scope');
assert(!/approver:\s*\[[^\]]*operation\.plan\.transition/s.test(roles), 'approver must not have transition scope');
const customerFiles = require('child_process').execFileSync('rg', ['--files', 'apps/web/src', 'apps/server/src/routes']).toString().trim().split('\n').filter(Boolean).filter((p) => /customer|client|reports|dashboard/.test(p));
for (const file of customerFiles) {
  const txt = read(file);
  assert(!txt.includes('operator_operation_plan_transition_submission_v1'), `customer surface exposes submission: ${file}`);
  assert(!/READY[\s\S]{0,80}(confirmed execution|executed|successful)/i.test(txt), `READY exposed as confirmed execution: ${file}`);
}
console.log('ACCEPTANCE_OPERATION_PLAN_TRANSITION_BOUNDARY_V1 passed');
