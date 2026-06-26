'use strict';

// scripts/governance_acceptance/ACCEPTANCE_H54_3_APPROVAL_DECISION_LINKAGE_V1.cjs
// Purpose: verify that the existing recommendation approval decision runtime remains the H54.3 linkage boundary.
// Boundary: this wrapper does not add any new approval-decision implementation, operation-plan implementation, or AO-ACT implementation.

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ACCEPTANCE = 'ACCEPTANCE_H54_3_APPROVAL_DECISION_LINKAGE_V1';
const EXISTING_RUNTIME = 'scripts/runtime_acceptance/ACCEPTANCE_RECOMMENDATION_APPROVAL_DECISION_RUNTIME_V1.cjs';

function fail(error, details = {}) {
  console.error(JSON.stringify({ ok: false, acceptance: ACCEPTANCE, error, details }, null, 2));
  process.exit(1);
}

function ok(value, error, details = {}) {
  if (!value) fail(error, details);
}

function read(file) {
  return fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');
}

function staticChecks() {
  const route = read('apps/server/src/routes/control_approval_request_v1.ts');
  ok(route.includes('/api/v1/operator/approval-requests/:request_id/decision'), 'APPROVAL_DECISION_ROUTE_MISSING');
  ok(route.includes('operator_recommendation_approval_decision_submission_v1'), 'DECISION_SUBMISSION_FACT_TOKEN_MISSING');
  ok(route.includes('approval_decision_v1'), 'APPROVAL_DECISION_FACT_TOKEN_MISSING');
  const builder = read('apps/server/src/domain/approval/recommendation_approval_decision_builder_v1.ts');
  ok(builder.includes('DECISION_RECORDED'), 'DECISION_BUILDER_STATUS_TOKEN_MISSING');
  ok(builder.includes('operation_plan_created: false'), 'DECISION_BUILDER_OPERATION_PLAN_BOUNDARY_MISSING');
  ok(builder.includes('task_created: false'), 'DECISION_BUILDER_TASK_BOUNDARY_MISSING');
  const runtime = read(EXISTING_RUNTIME);
  ok(runtime.includes('approval_decision_v1'), 'EXISTING_RUNTIME_DECISION_TOKEN_MISSING');
  ok(runtime.includes('operation_plan_v1'), 'EXISTING_RUNTIME_OPERATION_PLAN_GUARD_MISSING');
  ok(runtime.includes('ao_act_task_v0'), 'EXISTING_RUNTIME_AO_ACT_GUARD_MISSING');
}

function runtimeChecks() {
  const output = execFileSync(process.execPath, [EXISTING_RUNTIME], {
    cwd: process.cwd(),
    env: { ...process.env },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  ok(output.includes('ACCEPTANCE_RECOMMENDATION_APPROVAL_DECISION_RUNTIME_V1 passed'), 'EXISTING_RUNTIME_DID_NOT_PASS', { output });
  return output.trim().split(/\r?\n/).slice(-1)[0] || '';
}

(function main() {
  staticChecks();
  const runtime_tail = runtimeChecks();
  console.log(JSON.stringify({ ok: true, acceptance: ACCEPTANCE, approval_decision_linkage_runtime: 'PASS', approval_decision_created: true, operation_plan_created: false, ao_act_task_created: false, runtime_tail }, null, 2));
})();
