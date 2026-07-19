#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const POLICY = 'docs/digital_twin/mcft/MCFT-DELIVERY-POLICY-V2.json';
const RESULT = path.join(ROOT, 'acceptance-output/MCFT_DELIVERY_POLICY_V2_RESULT.json');
const WORKFLOWS = {
  policy: '.github/workflows/mcft-delivery-policy-v2.yml',
  candidate: '.github/workflows/mcft-candidate-declaration-integrity-v2.yml',
  lane: '.github/workflows/mcft-release-lane-v1.yml',
};
const GATES = {
  policy: 'scripts/governance_acceptance/ACCEPTANCE_MCFT_DELIVERY_POLICY_V2.cjs',
  candidate: 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CANDIDATE_DECLARATION_INTEGRITY_V2.cjs',
  lane: 'scripts/governance_acceptance/ACCEPTANCE_MCFT_RELEASE_LANE_V1.cjs',
};

function read(relative) { return fs.readFileSync(path.join(ROOT, relative), 'utf8'); }
function json(relative) { return JSON.parse(read(relative)); }
function write(value) {
  fs.mkdirSync(path.dirname(RESULT), { recursive: true });
  fs.writeFileSync(RESULT, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
function assertReadOnlyWorkflow(relative, expectedGate) {
  const source = read(relative);
  assert.match(source, /permissions:\s*\n(?:\s+[a-z-]+:\s*read\s*\n)+/m, `${relative}:READ_ONLY_PERMISSIONS_REQUIRED`);
  assert.equal(/contents:\s*write|pull-requests:\s*write|actions:\s*write/.test(source), false, `${relative}:WRITE_PERMISSION_FORBIDDEN`);
  assert.equal(/git\s+push|create_file|update_file|delete_file|\/merge['"`]/i.test(source), false, `${relative}:REPOSITORY_WRITE_COMMAND_FORBIDDEN`);
  assert.equal(source.includes(expectedGate), true, `${relative}:GATE_NOT_BOUND`);
}

function main() {
  const policy = json(POLICY);
  assert.equal(policy.schema_version, 'geox_mcft_delivery_policy_v2');
  assert.equal(policy.policy_id, 'MCFT-DELIVERY-POLICY-V2');
  assert.equal(policy.scope, 'ALL_MCFT_CAPABILITY_LINES');
  assert.equal(policy.capability_slice, false);
  assert.equal(policy.runtime_authority, false);
  assert.equal(policy.canonical_object_authority, false);
  assert.equal(policy.successor_capability_authority, false);
  assert.equal(policy.candidate_declaration.marker, 'MCFT_CANDIDATE_DECLARATION_V2');
  assert.equal(policy.candidate_declaration.applies_to, 'ANY_MCFT_CAPABILITY_LINE_OR_SLICE');
  assert.deepEqual(policy.candidate_declaration.required_fields, [
    'capability_line', 'slice_id', 'status_file', 'candidate_field', 'candidate_value',
    'focused_workflow', 'standard_workflow', 'semantic_snapshot_files',
    'semantic_snapshot_blobs', 'candidate_head', 'base_head',
  ]);
  assert.equal(policy.candidate_declaration.failure_effect, 'CANDIDATE_INVALIDATED');
  assert.equal(policy.release_lane.mode, 'MERGE_REF_EXACT_TREE_GATE');
  assert.equal(policy.release_lane.global_concurrency_group, 'mcft-release-lane-main');
  assert.equal(policy.release_lane.branch_transport_allowed, false);
  assert.equal(policy.release_lane.validation_carrier_pr_allowed, false);
  assert.equal(policy.release_lane.proof_only_pr_allowed, false);
  assert.equal(policy.workflow_security.pull_request_target_executes_default_branch_policy_only, true);
  assert.equal(policy.workflow_security.untrusted_pr_code_execution_under_pull_request_target, false);
  assert.equal(policy.workflow_security.repository_write_permission, false);
  assert.equal(policy.historical_policy.v1_status, 'HISTORICAL_SUPERSEDED');
  assert.equal(policy.historical_policy.v1_realtime_enforcement, false);
  assert.equal(policy.historical_policy.v1_workflows_manual_only, true);
  assert.equal(policy.enforcement.policy_contract_workflow, WORKFLOWS.policy);
  assert.equal(policy.enforcement.candidate_integrity_workflow, WORKFLOWS.candidate);
  assert.equal(policy.enforcement.release_lane_workflow, WORKFLOWS.lane);
  assert.equal(policy.enforcement.policy_gate, GATES.policy);
  assert.equal(policy.enforcement.candidate_gate, GATES.candidate);
  assert.equal(policy.enforcement.release_lane_gate, GATES.lane);

  for (const relative of [...Object.values(WORKFLOWS), ...Object.values(GATES)]) {
    assert.equal(fs.existsSync(path.join(ROOT, relative)), true, `REQUIRED_POLICY_ARTIFACT_MISSING:${relative}`);
  }
  assertReadOnlyWorkflow(WORKFLOWS.candidate, GATES.candidate);
  assertReadOnlyWorkflow(WORKFLOWS.lane, GATES.lane);

  const oldPolicyWorkflow = read('.github/workflows/mcft-delivery-policy-v1.yml');
  const oldCandidateWorkflow = read('.github/workflows/mcft-candidate-declaration-integrity.yml');
  for (const [name, source] of Object.entries({ oldPolicyWorkflow, oldCandidateWorkflow })) {
    assert.equal(source.includes('Historical MCFT Delivery Policy V1'), true, `${name}:HISTORICAL_MARKER_MISSING`);
    assert.match(source, /^on:\s*\n\s*workflow_dispatch:\s*$/m, `${name}:V1_NOT_MANUAL_ONLY`);
    assert.equal(/^\s*(pull_request|pull_request_target|workflow_run|push|merge_group):/m.test(source), false, `${name}:V1_AUTOMATIC_TRIGGER_REMAINS`);
  }

  const result = {
    schema_version: 'geox_mcft_delivery_policy_v2_result_v1',
    status: 'PASS',
    policy_id: policy.policy_id,
    candidate_declaration_marker: policy.candidate_declaration.marker,
    release_lane_id: policy.release_lane.lane_id,
    historical_v1_manual_only: true,
    repository_write_permission: false,
    capability_slice: false,
    runtime_authority: false,
    successor_capability_authority: false,
  };
  write(result);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

try { main(); } catch (error) {
  const result = {
    schema_version: 'geox_mcft_delivery_policy_v2_result_v1',
    status: 'FAIL',
    error: error instanceof Error ? error.message : String(error),
  };
  write(result);
  console.error(JSON.stringify(result, null, 2));
  process.exitCode = 1;
}
