#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'acceptance-output/MCFT_DELIVERY_POLICY_V2_RESULT.json');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const json = (p) => JSON.parse(read(p));
const exists = (p) => fs.existsSync(path.join(ROOT, p));
const write = (value) => { fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`); };

try {
  const v1Path = 'docs/digital_twin/mcft/MCFT-DELIVERY-POLICY-V1.json';
  const v2Path = 'docs/digital_twin/mcft/MCFT-DELIVERY-POLICY-V2.json';
  const registryPath = 'docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json';
  const foundationPath = 'docs/digital_twin/mcft/MCFT-DELIVERY-FOUNDATION-V2-STATUS.json';
  const taskbookPath = 'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-TASKBOOK-MANIFEST.json';
  const currentAuthorityPath = 'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-DELIVERY-AUTHORITY-V3.json';
  const effectivenessPath = 'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-GOVERNANCE-EFFECTIVENESS-STATUS-V3.json';
  const ledgerPath = 'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-HARD-ACCEPTANCE-EVIDENCE-LEDGER.json';
  const correctionsPath = 'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-HARD-ACCEPTANCE-STATEMENT-CORRECTIONS-V1.json';
  const candidateWorkflowPath = '.github/workflows/mcft-candidate-declaration-integrity-v2.yml';
  const releaseWorkflowPath = '.github/workflows/mcft-release-lane-v1.yml';
  const policyWorkflowPath = '.github/workflows/mcft-delivery-policy-v2.yml';
  const retrospectiveWorkflowPath = '.github/workflows/mcft-cap-06-retrospective-exact-sha-verification.yml';
  const candidateGatePath = 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CANDIDATE_DECLARATION_INTEGRITY_V2.cjs';
  const mergeGroupGatePath = 'scripts/governance_acceptance/ACCEPTANCE_MCFT_MERGE_GROUP_RELEASE_LANE_V1.cjs';

  for (const p of [v1Path, v2Path, registryPath, foundationPath, taskbookPath, currentAuthorityPath, effectivenessPath, ledgerPath, correctionsPath, candidateWorkflowPath, releaseWorkflowPath, policyWorkflowPath, retrospectiveWorkflowPath, candidateGatePath, mergeGroupGatePath]) {
    assert.equal(exists(p), true, `REQUIRED_FILE_MISSING:${p}`);
  }

  const v1 = json(v1Path);
  assert.equal(v1.record_status, 'HISTORICAL_SUPERSEDED');
  assert.equal(v1.historical_snapshot, true);
  assert.equal(v1.current_enforcement_authority, false);
  assert.equal(v1.superseded_by, v2Path);
  assert.equal(v1.scope, 'HISTORICAL_REPRODUCTION_ONLY');

  const v2 = json(v2Path);
  assert.equal(v2.policy_id, 'MCFT-DELIVERY-POLICY-V2');
  assert.equal(v2.supersedes, v1Path);
  assert.equal(v2.candidate_declaration.authority_registry_ref, registryPath);
  assert.equal(v2.candidate_declaration.discovery_mode, 'AUTHORITY_REGISTRY_WITH_FAIL_CLOSED_UNREGISTERED_CANDIDATE_DETECTION');
  assert.equal(v2.candidate_declaration.array_traversal_required, true);
  assert.equal(v2.release_lane.required_triggers.includes('merge_group'), true);
  assert.equal(v2.repository_setting_boundary.branch_ruleset_verified, false);
  assert.equal(v2.repository_setting_boundary.operational_release_authority_established, false);
  assert.equal(v2.nonclaims.includes('DOES_NOT_AUTHORIZE_MCFT_CAP_07'), true);

  const registry = json(registryPath);
  assert.equal(registry.default_behavior, 'FAIL_CLOSED');
  assert.equal(registry.array_traversal_required, true);
  const cap06 = registry.capabilities.find((entry) => entry.capability_line === 'MCFT-CAP-06');
  assert.ok(cap06, 'CAP06_REGISTRY_ENTRY_MISSING');
  assert.equal(cap06.current_candidate_authority, false);
  assert.equal(cap06.successor_capability_authorized, false);
  assert.ok(cap06.authoritative_candidate_status_paths.length >= 2);
  assert.ok(cap06.candidate_transition_fields.length >= 3);

  const foundation = json(foundationPath);
  assert.equal(foundation.record_status, 'MERGED_MAIN_EFFECTIVE_WITH_EXTERNAL_RULESET_DEPENDENCY');
  assert.equal(foundation.repository_setting_boundary.branch_ruleset_verified, false);
  assert.equal(foundation.repository_setting_boundary.operational_release_authority_established, false);
  assert.equal(foundation.successor_capability_line_authorized, false);

  const taskbook = json(taskbookPath);
  assert.equal(taskbook.global_delivery_policy_ref, v2Path);
  assert.equal(taskbook.historical_delivery_policy_ref, v1Path);
  assert.equal(taskbook.candidate_authority_registry_ref, registryPath);
  assert.equal(taskbook.current_delivery_authority_ref, currentAuthorityPath);
  assert.equal(taskbook.historical_delivery_authority_ref, 'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-DELIVERY-AUTHORITY-V2.json');
  assert.equal(taskbook.governance_effectiveness_status_ref, effectivenessPath);
  assert.equal(taskbook.s11d.implementation_merge_commit, 'ea8caa10e6369ec5018d7c7b6630e2330d1ca085');
  assert.equal(taskbook.s11d.exact_merge_sha_attestation_status, 'UNVERIFIED_BY_REPOSITORY_RECORD_AND_AVAILABLE_CONNECTOR');
  assert.equal(taskbook.terminal_state.operational_closure_effective, false);
  assert.equal(taskbook.terminal_state.operational_capability_effective, false);
  assert.equal(taskbook.successor_capability_line_authorized, false);


  const currentAuthority = json(currentAuthorityPath);
  assert.equal(currentAuthority.record_status, 'CURRENT_AUTHORITY');
  assert.equal(currentAuthority.authority_version, 3);
  assert.equal(currentAuthority.delivery_policy_ref, v2Path);
  assert.equal(currentAuthority.operational_closure_effective, false);
  assert.equal(currentAuthority.attestation_status, 'UNVERIFIED');
  assert.equal(currentAuthority.exact_merge_sha_attestation.retrospective_verification_workflow_ref, retrospectiveWorkflowPath);
  assert.equal(currentAuthority.exact_merge_sha_attestation.retrospective_verification_status, 'PENDING_WORKFLOW_EXECUTION');
  assert.equal(currentAuthority.successor_capability_line_authorized, false);

  const effectiveness = json(effectivenessPath);
  assert.equal(effectiveness.record_status, 'CURRENT_EFFECTIVENESS_AUTHORITY');
  assert.equal(effectiveness.capability_implementation_complete, true);
  assert.equal(effectiveness.operational_closure_effective, false);
  assert.equal(effectiveness.exact_merge_sha_attestation.verification_status, 'UNVERIFIED_BY_REPOSITORY_RECORD_AND_AVAILABLE_CONNECTOR');
  assert.equal(effectiveness.exact_merge_sha_attestation.retrospective_verification_workflow_ref, retrospectiveWorkflowPath);
  assert.equal(effectiveness.exact_merge_sha_attestation.retrospective_verification_status, 'PENDING_WORKFLOW_EXECUTION');
  assert.equal(effectiveness.successor_capability_line_authorized, false);

  const ledger = json(ledgerPath);
  assert.deepEqual(ledger.status_counts, { PASS: 253, FAIL: 0, PENDING: 2, NOT_APPLICABLE: 0 });
  assert.equal(ledger.independent_predicate_program_per_item_claim, false);
  assert.equal(ledger.evidence_reference_presence_is_not_semantic_satisfaction_by_itself, true);
  assert.equal(ledger.completion_claims_operationally_verified_effective, false);
  assert.equal(ledger.verified, false);
  assert.equal(ledger.statement_corrections_ref, correctionsPath);

  const corrections = json(correctionsPath);
  const j016 = corrections.corrections.find((item) => item.acceptance_id === 'MCFT_CAP_06_HARD_J_016');
  assert.ok(j016, 'J016_CORRECTION_MISSING');
  assert.equal(j016.effective_statement, 'exact-SHA attestation performs no repository or SSOT writeback');
  assert.equal(j016.status, 'PENDING');

  for (const workflowPath of [candidateWorkflowPath, releaseWorkflowPath, policyWorkflowPath]) {
    const workflow = read(workflowPath);
    assert.match(workflow, /^\s*merge_group:/m, `MERGE_GROUP_TRIGGER_MISSING:${workflowPath}`);
    assert.equal(/contents:\s*write/.test(workflow), false, `WRITE_PERMISSION_FORBIDDEN:${workflowPath}`);
    assert.equal(workflow.includes('persist-credentials: false'), true, `PERSISTED_CREDENTIALS_FORBIDDEN:${workflowPath}`);
  }
  const releaseWorkflow = read(releaseWorkflowPath);
  assert.equal(releaseWorkflow.includes('group: mcft-release-lane-main'), true);
  assert.equal(releaseWorkflow.includes('ACCEPTANCE_MCFT_MERGE_GROUP_RELEASE_LANE_V1.cjs'), true);

  const retrospectiveWorkflow = read(retrospectiveWorkflowPath);
  assert.match(retrospectiveWorkflow, /^\s*pull_request:/m, 'RETROSPECTIVE_PULL_REQUEST_TRIGGER_MISSING');
  assert.match(retrospectiveWorkflow, /^\s*push:/m, 'RETROSPECTIVE_PUSH_TRIGGER_MISSING');
  assert.equal(retrospectiveWorkflow.includes('ref: ea8caa10e6369ec5018d7c7b6630e2330d1ca085'), true, 'RETROSPECTIVE_EXACT_SHA_CHECKOUT_MISSING');
  assert.equal(retrospectiveWorkflow.includes('MCFT_CAP_06_ATTESTATION_MODE: RETROSPECTIVE_EXACT_SHA_VERIFICATION'), true, 'RETROSPECTIVE_MODE_MISSING');
  assert.equal(retrospectiveWorkflow.includes('ACCEPTANCE_MCFT_CAP_06_S11D_REPAIR_MERGED_MAIN_ATTESTATION.cjs'), true, 'RETROSPECTIVE_GATE_MISSING');
  assert.equal(/contents:\s*write/.test(retrospectiveWorkflow), false, 'RETROSPECTIVE_WRITE_PERMISSION_FORBIDDEN');
  assert.equal(retrospectiveWorkflow.includes('persist-credentials: false'), true, 'RETROSPECTIVE_PERSISTED_CREDENTIALS_FORBIDDEN');
  const candidateGate = read(candidateGatePath);
  assert.equal(candidateGate.includes('MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json'), true);
  assert.equal(candidateGate.includes('Array.isArray'), true);
  assert.equal(candidateGate.includes('UNREGISTERED_CANDIDATE_AUTHORITY'), true);

  const result = {
    schema_version: 'geox_mcft_delivery_policy_v2_1_result_v1',
    status: 'PASS',
    historical_v1_self_supersession: 'PASS',
    cap06_policy_ref_v2: 'PASS',
    candidate_authority_registry: 'PASS',
    array_candidate_detection: 'PASS',
    merge_group_workflow_support: 'PASS',
    cap06_effectiveness_semantics_split: 'PASS',
    j016_scope_correction: 'PASS',
    retrospective_exact_sha_verification_contract: 'PASS',
    branch_ruleset_verified: false,
    operational_release_authority_established: false,
    successor_capability_line_authorized: false,
    capability_slice: false,
    runtime_authority: false
  };
  write(result);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} catch (error) {
  const result = { schema_version: 'geox_mcft_delivery_policy_v2_1_result_v1', status: 'FAIL', error: error instanceof Error ? error.message : String(error) };
  write(result); console.error(JSON.stringify(result, null, 2)); process.exitCode = 1;
}
