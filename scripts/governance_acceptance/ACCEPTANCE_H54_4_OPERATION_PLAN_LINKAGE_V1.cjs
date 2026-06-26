'use strict';

// scripts/governance_acceptance/ACCEPTANCE_H54_4_OPERATION_PLAN_LINKAGE_V1.cjs
// Purpose: verify that the existing approved-decision-to-operation-plan runtime remains the H54.4 linkage boundary.
// Boundary: this wrapper does not add any new operation-plan implementation, AO-ACT implementation, receipt implementation, acceptance implementation, verification implementation, ROI implementation, or Field Memory implementation.

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ACCEPTANCE = 'ACCEPTANCE_H54_4_OPERATION_PLAN_LINKAGE_V1';
const EXISTING_RUNTIME = 'scripts/runtime_acceptance/ACCEPTANCE_OPERATION_PLAN_FROM_APPROVED_DECISION_RUNTIME_V1.cjs';

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
  ok(route.includes('/api/v1/operator/approval-decisions/:decision_id/create-operation-plan'), 'CREATE_OPERATION_PLAN_ROUTE_MISSING');
  ok(route.includes('operator_approval_decision_operation_plan_submission_v1'), 'OPERATION_PLAN_SUBMISSION_FACT_TOKEN_MISSING');
  ok(route.includes('operation_plan_v1'), 'OPERATION_PLAN_FACT_TOKEN_MISSING');
  ok(route.includes('upsertOperationPlanIndexV1'), 'OPERATION_PLAN_INDEX_UPSERT_TOKEN_MISSING');
  const builder = read('apps/server/src/domain/operations/operation_plan_from_approval_decision_builder_v1.ts');
  ok(builder.includes('OPERATION_PLAN_CREATED'), 'OPERATION_PLAN_BUILDER_STATUS_TOKEN_MISSING');
  ok(builder.includes('status: "CREATED"'), 'OPERATION_PLAN_CREATED_STATUS_TOKEN_MISSING');
  ok(builder.includes('act_task_id: null'), 'OPERATION_PLAN_AO_ACT_BOUNDARY_TOKEN_MISSING');
  ok(builder.includes('receipt_fact_id: null'), 'OPERATION_PLAN_RECEIPT_BOUNDARY_TOKEN_MISSING');
  const runtime = read(EXISTING_RUNTIME);
  ok(runtime.includes('operation_plan_index_v1 row is upserted'), 'EXISTING_RUNTIME_INDEX_GUARD_MISSING');
  ok(runtime.includes('ao_act_task_v0'), 'EXISTING_RUNTIME_AO_ACT_GUARD_MISSING');
}

function runtimeChecks() {
  const output = execFileSync(process.execPath, [EXISTING_RUNTIME], {
    cwd: process.cwd(),
    env: { ...process.env },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  ok(output.includes('PASS: operation_plan_index_v1 row is upserted'), 'EXISTING_RUNTIME_INDEX_UPSERT_DID_NOT_PASS', { output });
  ok(output.includes('PASS: no ao_act_task_v0 fact is created'), 'EXISTING_RUNTIME_AO_ACT_GUARD_DID_NOT_PASS', { output });
  return output.trim().split(/\r?\n/).slice(-1)[0] || '';
}

(function main() {
  staticChecks();
  const runtime_tail = runtimeChecks();
  console.log(JSON.stringify({ ok: true, acceptance: ACCEPTANCE, operation_plan_linkage_runtime: 'PASS', operation_plan_created: true, operation_plan_index_upserted: true, ao_act_task_created: false, runtime_tail }, null, 2));
})();
