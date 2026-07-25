#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const relative = {
  status: 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S3-DELIVERY-STATUS-V1.json',
  review: 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S3-REVIEW-POLICY-V1.json',
  waiver: 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-INTERIM-OWNER-REVIEW-WAIVER-V1.json',
  output: 'acceptance-output/MCFT_CAP_08_DEFERRED_REVIEW_POLICY_RESULT.json',
};
const PRE_REGISTERED = 'PRE_REGISTERED_SUCCESSOR_STATUS_SEED';
const FORMAL_CANDIDATE = 'FORMAL_S3_CANDIDATE_IMPLEMENTED_NOT_EFFECTIVE';
const read = (key) => JSON.parse(fs.readFileSync(path.join(ROOT, relative[key]), 'utf8'));
function write(value) {
  const output = path.join(ROOT, relative.output);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function validateAuthority(review, waiver) {
  assert.equal(waiver.schema_version, 'geox_mcft_cap08_interim_owner_review_waiver_v1');
  assert.equal(waiver.record_status, 'OWNER_DIRECTIVE_RECORDED_FOR_PROTECTED_MERGE');
  assert.equal(waiver.capability_line_id, 'MCFT-CAP-08');
  assert.equal(waiver.policy_id, 'MCFT-CAP-08-S3-S5-INTERIM-OWNER-REVIEW-WAIVER-V1');
  assert.equal(waiver.owner_directive_issue_ref, 'https://github.com/liyongshang44-max/GEOX/issues/2649');
  assert.equal(waiver.waiver_authority, 'REPOSITORY_OWNER_DIRECTIVE');
  assert.equal(waiver.repository_owner_login, 'liyongshang44-max');
  assert.deepEqual(waiver.interim_slice_scope, ['MCFT-CAP-08.S3', 'MCFT-CAP-08.S4', 'MCFT-CAP-08.S5']);
  assert.equal(waiver.final_closure_slice, 'MCFT-CAP-08.S6');
  assert.deepEqual(waiver.interim_review_policy, {
    independent_review_required: false,
    independent_review_satisfied: false,
    independent_review_performed: false,
    independent_review_waived: true,
    retroactive_exact_head_approval_claim_allowed: false,
    technical_gate_relaxation: false,
    focused_workflow_required: true,
    standard_ci_required: true,
    protected_merge_required: true,
    candidate_to_merge_tree_equality_required: true,
    exact_merge_sha_attestation_required: true,
    immutable_artifact_readback_required: true,
  });
  assert.equal(waiver.final_closure_review_policy.independent_review_required, true);
  assert.equal(waiver.final_closure_review_policy.verified_second_github_account_required, true);
  assert.equal(waiver.final_closure_review_policy.review_must_target_exact_s6_candidate_head, true);
  assert.equal(waiver.final_closure_review_policy.review_scope_includes_interim_chain, true);
  assert.equal(waiver.final_closure_review_policy.s6_merge_authorized_without_independent_review, false);
  assert.equal(waiver.final_closure_review_policy.s6_exact_sha_closure_authorized_without_independent_review, false);
  assert.equal(waiver.failure_effect.s6_review_absent, 'MCFT_CAP_08_REMAINS_INCOMPLETE');
  assert.equal(waiver.failure_effect.mcft_cap_09_authorized, false);

  assert.equal(review.schema_version, 'geox_mcft_cap08_s3_review_policy_v2');
  assert.equal(review.record_status, 'OWNER_WAIVER_RECORDED_REVIEW_DEFERRED_TO_FINAL_CLOSURE');
  assert.equal(review.capability_line_id, 'MCFT-CAP-08');
  assert.equal(review.slice_id, 'MCFT-CAP-08.S3');
  assert.equal(review.interim_owner_review_waiver_ref, relative.waiver);
  assert.equal(review.owner_directive_issue_ref, waiver.owner_directive_issue_ref);
  for (const key of ['independent_review_required', 'independent_review_satisfied', 'independent_review_performed', 'technical_gate_relaxation', 'retroactive_exact_head_approval_claim_allowed']) assert.equal(review[key], false, `S3_REVIEW_POLICY_EXPECTED_FALSE:${key}`);
  assert.equal(review.independent_review_waived, true);
  assert.equal(review.s2_owner_review_waiver_inherited, false);
  assert.equal(review.waiver_is_new_s3_s5_owner_directive, true);
  assert.equal(review.required_before_candidate_merge, false);
  assert.equal(review.required_before_exact_sha_attestation, false);
  assert.equal(review.candidate_merge_authorized_under_owner_waiver_after_all_technical_gates, true);
  assert.equal(review.exact_sha_attestation_authorized_under_owner_waiver, true);
  assert.equal(review.supersedes_pre_registered_status_review_fields_until_candidate_transition, true);
  assert.equal(review.candidate_transition_must_materialize_waiver_fields, true);
  assert.equal(review.final_closure_review.slice_id, 'MCFT-CAP-08.S6');
  assert.equal(review.final_closure_review.independent_review_required, true);
  assert.equal(review.final_closure_review.verified_second_github_account_required, true);
  assert.equal(review.final_closure_review.review_must_target_exact_s6_candidate_head, true);
  assert.equal(review.final_closure_review.review_scope_includes_s3_contract_implementation_and_artifacts, true);
  assert.equal(review.candidate_merge_authorized_without_slice_independent_review, true);
  assert.equal(review.exact_sha_attestation_authorized_without_slice_independent_review, true);
  assert.equal(review.implementation_authorized, false);
  assert.equal(review.runtime_source_authorized, false);
}

function validateStatus(status, review, waiver) {
  assert.equal(status.capability_line_id, 'MCFT-CAP-08');
  assert.equal(status.slice_id, 'MCFT-CAP-08.S3');
  assert.equal(status.runtime_source_authorized, false);
  assert.equal(status.s3_effective, false);
  assert.equal(status.s4_authorized, false);
  assert.equal(status.mcft_cap_09_authorized, false);
  if (status.record_status === PRE_REGISTERED) {
    assert.equal(status.s3_candidate_implemented, false);
    assert.equal(status.implementation_authorized, false);
    assert.equal(status.independent_review_required, true);
    assert.equal(status.independent_review_satisfied, false);
    assert.equal(status.independent_review_waived, false);
    assert.equal(review.supersedes_pre_registered_status_review_fields_until_candidate_transition, true);
    return { lifecycle: 'PRE_REGISTERED_SUCCESSOR', candidate_signal_present: false };
  }
  assert.equal(status.record_status, FORMAL_CANDIDATE, 'S3_DEFERRED_REVIEW_STATUS_LIFECYCLE_UNRECOGNIZED');
  assert.equal(status.s3_candidate_implemented, true);
  assert.equal(status.implementation_authorized, true);
  assert.equal(status.bounded_canonical_transaction_authorized, true);
  assert.equal(status.delivery_state, 'CANDIDATE_IMPLEMENTED_UNDER_OWNER_WAIVER_AWAITING_PROTECTED_MERGE_AND_EXACT_SHA_ATTESTATION');
  assert.equal(status.owner_review_waiver_ref, relative.waiver);
  assert.equal(status.owner_directive_issue_ref, waiver.owner_directive_issue_ref);
  assert.equal(status.independent_review_required, false);
  assert.equal(status.independent_review_satisfied, false);
  assert.equal(status.independent_review_performed, false);
  assert.equal(status.independent_review_waived, true);
  assert.equal(status.independent_review_must_bind_exact_candidate_head, false);
  assert.equal(status.candidate_merge_requires_independent_review, false);
  assert.equal(status.exact_sha_attestation_requires_independent_review, false);
  assert.equal(status.technical_gate_relaxation, false);
  assert.equal(status.retroactive_exact_head_approval_claim_allowed, false);
  assert.equal(status.final_s6_independent_review_required, true);
  return { lifecycle: 'FORMAL_CANDIDATE_NOT_EFFECTIVE', candidate_signal_present: true };
}

function verifyLifecycleMatrix(status, review, waiver) {
  const common = { runtime_source_authorized: false, s3_effective: false, s4_authorized: false, mcft_cap_09_authorized: false };
  const pre = { ...status, ...common, record_status: PRE_REGISTERED, s3_candidate_implemented: false, implementation_authorized: false, independent_review_required: true, independent_review_satisfied: false, independent_review_waived: false };
  const formal = {
    ...status, ...common, record_status: FORMAL_CANDIDATE, s3_candidate_implemented: true, implementation_authorized: true, bounded_canonical_transaction_authorized: true,
    delivery_state: 'CANDIDATE_IMPLEMENTED_UNDER_OWNER_WAIVER_AWAITING_PROTECTED_MERGE_AND_EXACT_SHA_ATTESTATION', owner_review_waiver_ref: relative.waiver,
    owner_directive_issue_ref: waiver.owner_directive_issue_ref, independent_review_required: false, independent_review_satisfied: false, independent_review_performed: false,
    independent_review_waived: true, independent_review_must_bind_exact_candidate_head: false, candidate_merge_requires_independent_review: false,
    exact_sha_attestation_requires_independent_review: false, technical_gate_relaxation: false, retroactive_exact_head_approval_claim_allowed: false,
    final_s6_independent_review_required: true,
  };
  assert.equal(validateStatus(pre, review, waiver).candidate_signal_present, false);
  assert.equal(validateStatus(formal, review, waiver).candidate_signal_present, true);
}

try {
  const status = read('status');
  const review = read('review');
  const waiver = read('waiver');
  validateAuthority(review, waiver);
  verifyLifecycleMatrix(status, review, waiver);
  const lifecycle = validateStatus(status, review, waiver);
  const result = {
    schema_version: 'geox_mcft_cap08_deferred_review_policy_result_v2', status: 'PASS', owner_directive_issue_ref: waiver.owner_directive_issue_ref,
    interim_slice_scope: waiver.interim_slice_scope, final_closure_slice: waiver.final_closure_slice, status_lifecycle: lifecycle.lifecycle,
    lifecycle_matrix_verified: true, slice_independent_review_required: false, slice_independent_review_satisfied: false,
    slice_independent_review_performed: false, slice_independent_review_waived: true, technical_gate_relaxation: false,
    retroactive_approval_claim_allowed: false, final_closure_independent_review_required: true, candidate_signal_present: lifecycle.candidate_signal_present,
    runtime_source_delta: 0, s3_effective: false, s4_authorized: false, mcft_cap_09_authorized: false,
  };
  write(result);
  console.log(JSON.stringify(result));
} catch (error) {
  const result = { schema_version: 'geox_mcft_cap08_deferred_review_policy_result_v2', status: 'FAIL', error: error instanceof Error ? error.message : String(error) };
  write(result);
  console.error(JSON.stringify(result, null, 2));
  process.exitCode = 1;
}
