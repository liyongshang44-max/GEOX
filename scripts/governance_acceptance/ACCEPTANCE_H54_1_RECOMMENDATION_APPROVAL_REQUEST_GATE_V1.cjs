'use strict';

// scripts/governance_acceptance/ACCEPTANCE_H54_1_RECOMMENDATION_APPROVAL_REQUEST_GATE_V1.cjs
// Purpose: verify H54.1 connector gate blocks the current C8 NO_ACTION recommendation from entering approval/control execution.
// Boundary: read-only acceptance; no facts or downstream control artifacts are written.

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { Client } = require('pg');

const DB = process.env.DATABASE_URL || 'postgres://landos:landos_pwd@127.0.0.1:5433/landos';
const ACCEPTANCE = 'ACCEPTANCE_H54_1_RECOMMENDATION_APPROVAL_REQUEST_GATE_V1';
const CONNECTOR_PATH = 'scripts/h54/CONNECT_H54_1_RECOMMENDATION_APPROVAL_REQUEST_GATE_V1.cjs';
const FORBIDDEN_TYPES = ['approval_request_v1','approval_decision_v1','operation_plan_v1','ao_act_task_v0','ao_act_receipt_v1','as_executed_record_v1','evidence_artifact_v1','acceptance_result_v1','water_response_verification_v1','roi_ledger_v1','field_memory_v1'];
const H54_1_SOURCE = 'CONNECT_H54_1_RECOMMENDATION_APPROVAL_REQUEST_GATE_V1';

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
  const connector = read(CONNECTOR_PATH);
  ok(connector.includes('CONTROL_CHAIN_NOT_REQUIRED'), 'GATE_STATUS_TOKEN_MISSING');
  ok(connector.includes('NO_ACTION_RECOMMENDATION'), 'NO_ACTION_REASON_TOKEN_MISSING');
  ok(connector.includes('ACTIONABLE_IRRIGATION_REQUIRES_APPROVAL_REQUEST_ADAPTER'), 'ACTIONABLE_LANE_TOKEN_MISSING');
  ok(!connector.includes('INSERT INTO facts'), 'CONNECTOR_MUST_NOT_WRITE_FACTS');
  ok(!connector.includes('createApprovalRequestV1'), 'CONNECTOR_MUST_NOT_CREATE_APPROVAL_REQUEST');
  const approvalBuilder = read('apps/server/src/domain/approval/recommendation_approval_request_builder_v1.ts');
  ok(approvalBuilder.includes('text(rec.status) !== "CANDIDATE"'), 'APPROVAL_BUILDER_CANDIDATE_GUARD_MISSING');
  ok(approvalBuilder.includes('DELAYED_IRRIGATION'), 'APPROVAL_BUILDER_ACTIONABLE_GUARD_MISSING');
  ok(approvalBuilder.includes('amount <= 0'), 'APPROVAL_BUILDER_POSITIVE_AMOUNT_GUARD_MISSING');
}

function runConnector() {
  const output = execFileSync(process.execPath, [CONNECTOR_PATH], { cwd: process.cwd(), env: { ...process.env, DATABASE_URL: DB }, encoding: 'utf8' });
  try {
    return JSON.parse(output);
  } catch (error) {
    fail('CONNECTOR_OUTPUT_NOT_JSON', { output });
  }
}

async function countForbiddenBySource(client) {
  const result = await client.query(`select record_json::jsonb->>'type' as type, count(*)::int as count from facts where source=$1 and record_json::jsonb->>'type'=any($2::text[]) group by 1`, [H54_1_SOURCE, FORBIDDEN_TYPES]);
  return result.rows || [];
}

async function dbChecks() {
  const client = new Client({ connectionString: DB });
  await client.connect();
  try {
    const before = await countForbiddenBySource(client);
    const gate = runConnector();
    const after = await countForbiddenBySource(client);
    ok(before.length === 0, 'PREEXISTING_H54_1_FORBIDDEN_WRITES', { before });
    ok(after.length === 0, 'H54_1_FORBIDDEN_WRITES_CREATED', { after });
    ok(gate.ok === true, 'GATE_NOT_OK', gate);
    ok(gate.gate_status === 'CONTROL_CHAIN_NOT_REQUIRED', 'GATE_STATUS_UNEXPECTED', gate);
    ok(gate.gate_lane === 'NO_ACTION', 'GATE_LANE_UNEXPECTED', gate);
    ok(gate.recommendation_id === 'rec_h53_4_0fa3d7158a6582f5', 'RECOMMENDATION_ID_UNEXPECTED', gate);
    ok(gate.action_type === 'NO_ACTION', 'ACTION_TYPE_UNEXPECTED', gate);
    ok(gate.amount_mm === 0, 'AMOUNT_UNEXPECTED', gate);
    ok(gate.approval_request_created === false, 'APPROVAL_REQUEST_MUST_NOT_BE_CREATED', gate);
    ok(gate.approval_decision_created === false, 'APPROVAL_DECISION_MUST_NOT_BE_CREATED', gate);
    ok(gate.operation_plan_created === false, 'OPERATION_PLAN_MUST_NOT_BE_CREATED', gate);
    ok(gate.ao_act_task_created === false, 'AO_ACT_TASK_MUST_NOT_BE_CREATED', gate);
    ok(gate.acceptance_created === false, 'ACCEPTANCE_MUST_NOT_BE_CREATED', gate);
    ok(gate.verification_created === false, 'VERIFICATION_MUST_NOT_BE_CREATED', gate);
    ok(gate.roi_created === false, 'ROI_MUST_NOT_BE_CREATED', gate);
    ok(gate.field_memory_created === false, 'FIELD_MEMORY_MUST_NOT_BE_CREATED', gate);
    ok(gate.writes_created === false, 'WRITES_CREATED_MUST_BE_FALSE', gate);
    return gate;
  } finally {
    await client.end();
  }
}

(async function main() {
  staticChecks();
  const gate = await dbChecks();
  console.log(JSON.stringify({ ok: true, acceptance: ACCEPTANCE, gate }, null, 2));
})().catch((error) => fail(error.message));
