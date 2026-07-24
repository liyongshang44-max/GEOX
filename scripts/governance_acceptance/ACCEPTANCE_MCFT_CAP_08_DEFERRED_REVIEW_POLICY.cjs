#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const STATUS_PATH = path.join(ROOT, 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S3-DELIVERY-STATUS-V1.json');
const REVIEW_PATH = path.join(ROOT, 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S3-REVIEW-POLICY-V1.json');
const WAIVER_PATH = path.join(ROOT, 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-INTERIM-OWNER-REVIEW-WAIVER-V1.json');
const OUTPUT_PATH = path.join(ROOT, 'acceptance-output/MCFT_CAP_08_DEFERRED_REVIEW_POLICY_RESULT.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeResult(value) {
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

try {
  const status = readJson(STATUS_PATH);
  const review = readJson(REVIEW_PATH);
  const waiver = readJson(WAIVER_PATH);

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
  assert.equal(review.interim_owner_review_waiver_ref, path.relative(ROOT, WAIVER_PATH).replaceAll('\\', '/'));
  assert.equal(review.owner_directive_issue_ref, waiver.owner_directive_issue_ref);
  assert.equal(review.independent_review_required, false);
  assert.equal(review.independent_review_satisfied, false);
  assert.equal(review.independent_review_performed, false);
  assert.equal(review.independent_review_waived, true);
  assert.equal(review.s2_owner_review_waiver_inherited, false);
  assert.equal(review.waiver_is_new_s3_s5_owner_directive, true);
  assert.equal(review.required_before_candidate_merge, false);
  assert.equal(review.required_before_exact_sha_attestation, false);
  assert.equal(review.candidate_merge_authorized_under_owner_waiver_after_all_technical_gates, true);
  assert.equal(review.exact_sha_attestation_authorized_under_owner_waiver, true);
  assert.equal(review.technical_gate_relaxation, false);
  assert.equal(review.retroactive_exact_head_approval_claim_allowed, false);
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

  assert.equal(status.record_status, 'PRE_REGISTERED_SUCCESSOR_STATUS_SEED');
  assert.equal(status.s3_candidate_implemented, false);
  assert.equal(status.implementation_authorized, false);
  assert.equal(status.runtime_source_authorized, false);
  assert.equal(status.s3_effective, false);
  assert.equal(status.s4_authorized, false);
  assert.equal(status.mcft_cap_09_authorized, false);
  assert.equal(review.supersedes_pre_registered_status_review_fields_until_candidate_transition, true);

  const result = {
    schema_version: 'geox_mcft_cap08_deferred_review_policy_result_v1',
    status: 'PASS',
    owner_directive_issue_ref: waiver.owner_directive_issue_ref,
    interim_slice_scope: waiver.interim_slice_scope,
    final_closure_slice: waiver.final_closure_slice,
    slice_independent_review_required: false,
    slice_independent_review_satisfied: false,
    slice_independent_review_waived: true,
    technical_gate_relaxation: false,
    retroactive_approval_claim_allowed: false,
    final_closure_independent_review_required: true,
    pre_registered_status_review_fields_superseded_until_candidate_transition: true,
    candidate_signal_present: false,
    runtime_source_delta: 0,
    s3_effective: false,
    s4_authorized: false,
    mcft_cap_09_authorized: false,
  };
  writeResult(result);
  console.log(JSON.stringify(result));
} catch (error) {
  const result = {
    schema_version: 'geox_mcft_cap08_deferred_review_policy_result_v1',
    status: 'FAIL',
    error: error instanceof Error ? error.message : String(error),
  };
  writeResult(result);
  console.error(JSON.stringify(result, null, 2));
  process.exitCode = 1;
}
