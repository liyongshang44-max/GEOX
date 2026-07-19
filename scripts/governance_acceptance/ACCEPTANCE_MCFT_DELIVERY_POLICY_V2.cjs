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
const write = (value) => {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`);
};

try {
  const v1Path = 'docs/digital_twin/mcft/MCFT-DELIVERY-POLICY-V1.json';
  const v2Path = 'docs/digital_twin/mcft/MCFT-DELIVERY-POLICY-V2.json';
  const registryPath = 'docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json';
  const foundationPath = 'docs/digital_twin/mcft/MCFT-DELIVERY-FOUNDATION-V2-STATUS.json';
  const rulesetProfilePath = 'docs/digital_twin/mcft/MCFT-MAIN-RULESET-PROFILE-V1.json';
  const trustedVerificationPath = 'docs/digital_twin/mcft/MCFT-TRUSTED-ENFORCEMENT-OPERATIONAL-VERIFICATION-V1.json';
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

  for (const p of [
    v1Path, v2Path, registryPath, foundationPath, rulesetProfilePath, trustedVerificationPath,
    taskbookPath, currentAuthorityPath, effectivenessPath, ledgerPath, correctionsPath,
    candidateWorkflowPath, releaseWorkflowPath, policyWorkflowPath, retrospectiveWorkflowPath,
    candidateGatePath, mergeGroupGatePath,
  ]) assert.equal(exists(p), true, `REQUIRED_FILE_MISSING:${p}`);

  const v1 = json(v1Path);
  assert.equal(v1.record_status, 'HISTORICAL_SUPERSEDED');
  assert.equal(v1.historical_snapshot, true);
  assert.equal(v1.current_enforcement_authority, false);
  assert.equal(v1.superseded_by, v2Path);
  assert.equal(v1.scope, 'HISTORICAL_REPRODUCTION_ONLY');

  const v2 = json(v2Path);
  assert.equal(v2.policy_id, 'MCFT-DELIVERY-POLICY-V2');
  assert.equal(v2.policy_revision, '2.2');
  assert.equal(v2.record_status, 'MERGED_MAIN_OPERATIONALLY_EFFECTIVE');
  assert.equal(v2.supersedes, v1Path);
  assert.equal(v2.candidate_declaration.authority_registry_ref, registryPath);
  assert.equal(v2.candidate_declaration.discovery_mode, 'AUTHORITY_REGISTRY_WITH_FAIL_CLOSED_UNREGISTERED_CANDIDATE_DETECTION');
  assert.equal(v2.candidate_declaration.array_traversal_required, true);
  assert.equal(v2.release_lane.required_triggers.includes('merge_group'), true);
  assert.equal(v2.release_lane.concurrency_scope, 'EVENT_AND_EXACT_HEAD');
  assert.equal(v2.release_lane.global_concurrency_group, null);
  assert.equal(v2.release_lane.cross_event_cancellation_forbidden, true);
  assert.equal(v2.repository_setting_boundary.required_check_binding_committed_artifact, true);
  assert.equal(v2.repository_setting_boundary.branch_ruleset_verified, true);
  assert.equal(v2.repository_setting_boundary.strict_up_to_date_verified, true);
  assert.equal(v2.repository_setting_boundary.trusted_enforcement_required_checks_bound, true);
  assert.equal(v2.repository_setting_boundary.trusted_enforcement_fail_closed_verified, true);
  assert.equal(v2.repository_setting_boundary.operational_release_authority_established, true);
  assert.equal(v2.repository_setting_boundary.ruleset_profile_ref, rulesetProfilePath);
  assert.equal(v2.repository_setting_boundary.trusted_enforcement_verification_ref, trustedVerificationPath);
  assert.equal(v2.repository_setting_boundary.required_admin_action, null);
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
  assert.equal(foundation.record_status, 'MERGED_MAIN_OPERATIONALLY_EFFECTIVE');
  assert.equal(foundation.ruleset_profile_ref, rulesetProfilePath);
  assert.equal(foundation.trusted_enforcement_verification_ref, trustedVerificationPath);
  assert.equal(foundation.workstreams.P4_STABLE_RELEASE_PATH.global_concurrency, false);
  assert.equal(foundation.workstreams.P4_STABLE_RELEASE_PATH.event_and_exact_head_scoped_concurrency, true);
  assert.equal(foundation.repository_setting_boundary.required_check_binding_committed_artifact, true);
  assert.equal(foundation.repository_setting_boundary.branch_ruleset_verified, true);
  assert.equal(foundation.repository_setting_boundary.strict_up_to_date_verified, true);
  assert.equal(foundation.repository_setting_boundary.trusted_enforcement_required_checks_bound, true);
  assert.equal(foundation.repository_setting_boundary.trusted_enforcement_fail_closed_verified, true);
  assert.equal(foundation.repository_setting_boundary.operational_release_authority_established, true);
  assert.equal(foundation.repository_setting_boundary.merge_queue_verified, false);
  assert.equal(foundation.successor_capability_line_authorized, false);

  const profile = json(rulesetProfilePath);
  assert.equal(profile.enforcement_status, 'ACTIVE_OPERATIONALLY_VERIFIED');
  assert.equal(profile.trusted_enforcement_verification_ref, trustedVerificationPath);
  assert.equal(profile.required_status_checks_after_ui_subject_verification.includes('mcft-candidate-integrity-enforce-current-pr'), true);
  assert.equal(profile.required_status_checks_after_ui_subject_verification.includes('mcft-release-lane-enforce-current-pr'), true);
  assert.equal(profile.trusted_enforcement_operational_verification.negative_fail_closed_verified, true);
  assert.equal(profile.trusted_enforcement_operational_verification.positive_all_eight_required_checks_verified, true);
  assert.equal(profile.remaining_authority_boundary.trusted_enforcement_required_checks_bound, true);
  assert.equal(profile.remaining_authority_boundary.operational_release_authority_established, true);
  assert.equal(profile.remaining_authority_boundary.next_admin_action, null);
  assert.equal(profile.configuration_nonclaims.mcft_cap_07_authorized, false);

  const trusted = json(trustedVerificationPath);
  assert.equal(trusted.record_status, 'FINAL_CANDIDATE_EFFECTIVE_WHEN_PRESENT_ON_MAIN');
  assert.equal(trusted.verification_pull_request, 2599);
  assert.equal(trusted.negative_phase.ordinary_required_checks, 'ALL_SUCCESS');
  assert.equal(trusted.negative_phase.trusted_required_checks, 'BOTH_FAILING');
  assert.equal(trusted.negative_phase.merge_attempt_http_status, 405);
  assert.equal(trusted.negative_phase.probe_removed_before_merge, true);
  assert.equal(trusted.positive_phase.validated_head, '40728de443f60329c90e380431f2de55c265697d');
  assert.equal(trusted.positive_phase.required_checks, 'ALL_SUCCESS');
  assert.equal(trusted.observations.corrected_head_passed_all_eight_required_checks, true);
  assert.equal(trusted.observations.negative_probe_absent_from_final_tree, true);
  assert.equal(trusted.effective_projection_when_present_on_main.operational_release_authority_established, true);
  assert.equal(trusted.authority_boundary.mcft_cap_07_authorized, false);
  assert.equal(exists('docs/digital_twin/mcft/cap_06/MCFT-TRUSTED-ENFORCEMENT-NEGATIVE-PROBE.json'), false, 'NEGATIVE_PROBE_MUST_NOT_ENTER_FINAL_TREE');

  const taskbook = json(taskbookPath);
  assert.equal(taskbook.global_delivery_policy_ref, v2Path);
  assert.equal(taskbook.historical_delivery_policy_ref, v1Path);
  assert.equal(taskbook.candidate_authority_registry_ref, registryPath);
  assert.equal(taskbook.current_delivery_authority_ref, currentAuthorityPath);
  assert.equal(taskbook.governance_effectiveness_status_ref, effectivenessPath);
  assert.equal(taskbook.successor_capability_line_authorized, false);

  const currentAuthority = json(currentAuthorityPath);
  assert.equal(currentAuthority.record_status, 'CURRENT_AUTHORITY');
  assert.equal(currentAuthority.authority_version, 3);
  assert.equal(currentAuthority.delivery_policy_ref, v2Path);
  assert.equal(currentAuthority.successor_capability_line_authorized, false);

  const effectiveness = json(effectivenessPath);
  assert.equal(effectiveness.record_status, 'CURRENT_EFFECTIVENESS_AUTHORITY');
  assert.equal(effectiveness.capability_implementation_complete, true);
  assert.equal(effectiveness.successor_capability_line_authorized, false);

  const ledger = json(ledgerPath);
  assert.deepEqual(ledger.status_counts, { PASS: 253, FAIL: 0, PENDING: 2, NOT_APPLICABLE: 0 });
  assert.equal(ledger.independent_predicate_program_per_item_claim, false);
  assert.equal(ledger.evidence_reference_presence_is_not_semantic_satisfaction_by_itself, true);
  assert.equal(ledger.statement_corrections_ref, correctionsPath);

  const corrections = json(correctionsPath);
  const j016 = corrections.corrections.find((item) => item.acceptance_id === 'MCFT_CAP_06_HARD_J_016');
  assert.ok(j016, 'J016_CORRECTION_MISSING');
  assert.equal(j016.effective_statement, 'exact-SHA attestation performs no repository or SSOT writeback');

  for (const workflowPath of [candidateWorkflowPath, releaseWorkflowPath, policyWorkflowPath]) {
    const workflow = read(workflowPath);
    assert.match(workflow, /^\s*merge_group:/m, `MERGE_GROUP_TRIGGER_MISSING:${workflowPath}`);
    assert.equal(/contents:\s*write/.test(workflow), false, `WRITE_PERMISSION_FORBIDDEN:${workflowPath}`);
    assert.equal(workflow.includes('persist-credentials: false'), true, `PERSISTED_CREDENTIALS_FORBIDDEN:${workflowPath}`);
  }
  const candidateWorkflow = read(candidateWorkflowPath);
  const releaseWorkflow = read(releaseWorkflowPath);
  assert.equal(candidateWorkflow.includes('group: mcft-candidate-integrity-v2-${{ github.event_name }}-'), true, 'CANDIDATE_CROSS_EVENT_CONCURRENCY_ISOLATION_MISSING');
  assert.equal(releaseWorkflow.includes('group: mcft-release-lane-v1-${{ github.event_name }}-'), true, 'RELEASE_CROSS_EVENT_CONCURRENCY_ISOLATION_MISSING');
  assert.equal(releaseWorkflow.includes('ACCEPTANCE_MCFT_MERGE_GROUP_RELEASE_LANE_V1.cjs'), true);

  const retrospectiveWorkflow = read(retrospectiveWorkflowPath);
  assert.equal(/contents:\s*write/.test(retrospectiveWorkflow), false, 'RETROSPECTIVE_WRITE_PERMISSION_FORBIDDEN');
  assert.equal(retrospectiveWorkflow.includes('persist-credentials: false'), true, 'RETROSPECTIVE_PERSISTED_CREDENTIALS_FORBIDDEN');
  const candidateGate = read(candidateGatePath);
  assert.equal(candidateGate.includes('MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json'), true);
  assert.equal(candidateGate.includes('Array.isArray'), true);
  assert.equal(candidateGate.includes('UNREGISTERED_CANDIDATE_AUTHORITY'), true);

  const result = {
    schema_version: 'geox_mcft_delivery_policy_v2_2_result_v1',
    status: 'PASS',
    historical_v1_self_supersession: 'PASS',
    candidate_authority_registry: 'PASS',
    merge_group_workflow_support: 'PASS',
    cross_event_concurrency_isolation: 'PASS',
    branch_ruleset_verified: true,
    strict_up_to_date_verified: true,
    trusted_enforcement_required_checks_bound: true,
    trusted_enforcement_fail_closed_verified: true,
    operational_release_authority_established: true,
    successor_capability_line_authorized: false,
    capability_slice: false,
    runtime_authority: false,
  };
  write(result);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} catch (error) {
  const result = {
    schema_version: 'geox_mcft_delivery_policy_v2_2_result_v1',
    status: 'FAIL',
    error: error instanceof Error ? error.message : String(error),
  };
  write(result);
  console.error(JSON.stringify(result, null, 2));
  process.exitCode = 1;
}
