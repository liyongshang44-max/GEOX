#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const p = (relative) => path.join(ROOT, relative);
const AUTHORITY = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S3-SEMANTIC-COMPLETION-AUTHORITY-V1.json';
const STATUS = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S3-DELIVERY-STATUS-V1.json';
const WORKFLOWS = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S3-WORKFLOW-DECLARATION-V1.json';
const REVIEW = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S3-REVIEW-POLICY-V1.json';
const WAIVER = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-INTERIM-OWNER-REVIEW-WAIVER-V1.json';
const ENFORCEMENT = '.github/workflows/mcft-candidate-declaration-integrity-v2.yml';
const SELFTEST = '.github/workflows/mcft-candidate-declaration-selftest-v2.yml';
const OUTPUT = p('acceptance-output/MCFT_CAP_08_S3_PREFLIGHT_HARDENING_RESULT.json');
const PRE_REGISTERED = 'PRE_REGISTERED_SUCCESSOR_STATUS_SEED';
const FORMAL = 'FORMAL_S3_CANDIDATE_IMPLEMENTED_NOT_EFFECTIVE';

const readJson = (relative) => JSON.parse(fs.readFileSync(p(relative), 'utf8'));
const read = (relative) => fs.readFileSync(p(relative), 'utf8');
function write(value) {
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((output, key) => {
    output[key] = canonical(value[key]);
    return output;
  }, {});
}
function semanticDigest(value) {
  const copy = structuredClone(value);
  delete copy.semantic_digest;
  return `sha256:${crypto.createHash('sha256').update(JSON.stringify(canonical(copy)), 'utf8').digest('hex')}`;
}
function hasOnEvent(text, eventName) {
  return new RegExp(`^  ${eventName}:\\s*$`, 'm').test(text);
}
function commonStatus(status) {
  assert.equal(status.schema_version, 'geox_mcft_cap08_s3_delivery_status_v1');
  assert.equal(status.capability_line_id, 'MCFT-CAP-08');
  assert.equal(status.slice_id, 'MCFT-CAP-08.S3');
  assert.equal(status.candidate_field, 's3_candidate_implemented');
  assert.equal(status.candidate_value, true);
  assert.equal(status.semantic_completion_authority_ref, AUTHORITY);
  assert.equal(status.semantic_completion_authority_storage, 'twin_runtime_authority_snapshot_v1');
  assert.equal(status.semantic_completion_authority_kind, 'REALITY_BINDING');
  assert.equal(status.semantic_completion_authority_profile_id, 'MCFT-CAP-08.S3-SEMANTIC-COMPLETION-AUTHORITY-V1');
  assert.equal(status.semantic_completion_authority_ref_namespace, 'cap08_s3_completion_tuple');
  assert.equal(status.semantic_completion_authority_schema_migration_required, false);
  assert.equal(status.canonical_completion_tuple_fact_authorized, false);
  assert.equal(status.normal_completed_rerun_repair_authorized, false);
  assert.equal(status.database_migration_delta, 0);
  assert.equal(status.business_schema_delta, 0);
  assert.equal(status.runtime_source_authorized, false);
  assert.equal(status.production_runtime_source_authorized, false);
  assert.equal(status.s3_effective, false);
  assert.equal(status.s4_authorized, false);
  assert.equal(status.mcft_cap_09_authorized, false);
}
function validateStatus(status, review, waiver) {
  commonStatus(status);
  if (status.record_status === PRE_REGISTERED) {
    assert.equal(status.delivery_state, 'SEEDED_NOT_AUTHORIZED');
    assert.equal(status.s3_candidate_implemented, false);
    assert.equal(status.implementation_authorized, false);
    assert.equal(status.bounded_canonical_transaction_authorized, false);
    assert.equal(status.semantic_completion_authority_status, 'PRE_REGISTERED_NOT_EFFECTIVE');
    assert.equal(status.independent_review_required, true);
    assert.equal(status.independent_review_satisfied, false);
    assert.equal(status.independent_review_waived, false);
    assert.equal(review.supersedes_pre_registered_status_review_fields_until_candidate_transition, true);
    return { lifecycle: 'PRE_REGISTERED_SUCCESSOR', candidate_signal_present: false, review_mode: 'LEGACY_SEED_SUPERSEDED_BY_POLICY' };
  }
  assert.equal(status.record_status, FORMAL, 'S3_STATUS_LIFECYCLE_UNRECOGNIZED');
  assert.equal(status.delivery_state, 'CANDIDATE_IMPLEMENTED_UNDER_OWNER_WAIVER_AWAITING_PROTECTED_MERGE_AND_EXACT_SHA_ATTESTATION');
  assert.equal(status.s3_candidate_implemented, true);
  assert.equal(status.implementation_authorized, true);
  assert.equal(status.bounded_canonical_transaction_authorized, true);
  assert.equal(status.semantic_completion_authority_status, 'FORMAL_CANDIDATE_NOT_EFFECTIVE');
  assert.equal(status.independent_review_required, false);
  assert.equal(status.independent_review_satisfied, false);
  assert.equal(status.independent_review_performed, false);
  assert.equal(status.independent_review_waived, true);
  assert.equal(status.independent_review_must_bind_exact_candidate_head, false);
  assert.equal(status.owner_review_waiver_ref, WAIVER);
  assert.equal(status.owner_directive_issue_ref, waiver.owner_directive_issue_ref);
  assert.equal(status.technical_gate_relaxation, false);
  assert.equal(status.retroactive_exact_head_approval_claim_allowed, false);
  assert.equal(status.final_s6_independent_review_required, true);
  return { lifecycle: 'FORMAL_CANDIDATE_NOT_EFFECTIVE', candidate_signal_present: true, review_mode: 'OWNER_WAIVED_DEFERRED_TO_S6' };
}
function verifyLifecycleMatrix(status, review, waiver) {
  const pre = {
    ...status,
    record_status: PRE_REGISTERED,
    delivery_state: 'SEEDED_NOT_AUTHORIZED',
    s3_candidate_implemented: false,
    implementation_authorized: false,
    bounded_canonical_transaction_authorized: false,
    semantic_completion_authority_status: 'PRE_REGISTERED_NOT_EFFECTIVE',
    independent_review_required: true,
    independent_review_satisfied: false,
    independent_review_waived: false,
    production_runtime_source_authorized: false,
    s3_effective: false,
    s4_authorized: false,
    mcft_cap_09_authorized: false,
  };
  const formal = {
    ...status,
    record_status: FORMAL,
    delivery_state: 'CANDIDATE_IMPLEMENTED_UNDER_OWNER_WAIVER_AWAITING_PROTECTED_MERGE_AND_EXACT_SHA_ATTESTATION',
    s3_candidate_implemented: true,
    implementation_authorized: true,
    bounded_canonical_transaction_authorized: true,
    semantic_completion_authority_status: 'FORMAL_CANDIDATE_NOT_EFFECTIVE',
    independent_review_required: false,
    independent_review_satisfied: false,
    independent_review_performed: false,
    independent_review_waived: true,
    independent_review_must_bind_exact_candidate_head: false,
    owner_review_waiver_ref: WAIVER,
    owner_directive_issue_ref: waiver.owner_directive_issue_ref,
    technical_gate_relaxation: false,
    retroactive_exact_head_approval_claim_allowed: false,
    final_s6_independent_review_required: true,
    production_runtime_source_authorized: false,
    s3_effective: false,
    s4_authorized: false,
    mcft_cap_09_authorized: false,
  };
  assert.equal(validateStatus(pre, review, waiver).candidate_signal_present, false);
  assert.equal(validateStatus(formal, review, waiver).candidate_signal_present, true);
}

try {
  const authority = readJson(AUTHORITY);
  const status = readJson(STATUS);
  const workflowDeclaration = readJson(WORKFLOWS);
  const review = readJson(REVIEW);
  const waiver = readJson(WAIVER);
  const enforcementWorkflow = read(ENFORCEMENT);
  const selftestWorkflow = read(SELFTEST);

  assert.equal(authority.schema_version, 'geox_mcft_cap08_s3_semantic_completion_authority_v1');
  assert.equal(authority.record_status, 'FROZEN_PRE_CANDIDATE_GOVERNANCE_STORAGE_CORRECTED');
  assert.equal(authority.authority_profile_id, 'MCFT-CAP-08.S3-SEMANTIC-COMPLETION-AUTHORITY-V1');
  assert.equal(authority.semantic_digest, semanticDigest(authority));
  assert.deepEqual(authority.storage_contract, {
    table: 'twin_runtime_authority_snapshot_v1',
    authority_kind: 'REALITY_BINDING',
    authority_ref_namespace: 'cap08_s3_completion_tuple',
    semantic_profile_field: 'schema_version',
    semantic_profile_value: 'geox_mcft_cap08_s3_completion_tuple_v1',
    physical_constraint_compatible: true,
    database_migration_required: false,
    canonical_fact_write: false,
    projection_write: false,
    mutable_read_index_write: false,
    immutable_insert_only: true,
    conflicting_duplicate_effect: 'FAIL_CLOSED',
  });
  assert.equal(authority.completion_pair.generic_authority_kind, 'REALITY_BINDING');
  assert.equal(authority.completion_pair.semantic_authority_kind, 'REALITY_BINDING');
  assert.equal(authority.completion_pair.authority_ref_collision_forbidden, true);
  assert.equal(authority.completion_pair.commit_requirement, 'ONE_DATABASE_TRANSACTION');
  assert.equal(authority.completion_pair.partial_pair_effect, 'FAIL_CLOSED_ZERO_WRITE');
  assert.equal(authority.completion_pair.normal_runner_repair_authorized, false);
  assert.equal(authority.stored_semantic_payload.tick_binding_count, 24);
  assert.equal(authority.stored_semantic_payload.tick_trace_digest_count, 24);
  assert.equal(authority.rebuild_contract.projection_only_truth_forbidden, true);
  assert.equal(authority.rebuild_contract.hard_coded_qualification_truth_forbidden, true);
  assert.deepEqual(authority.normal_already_complete_contract, {
    generic_authority_exact: true,
    semantic_authority_exact: true,
    stored_equals_rebuilt: true,
    write_delta: 0,
    lease_delta: 0,
    authority_snapshot_delta: 0,
    failure_effect: 'FAIL_CLOSED',
  });
  assert.deepEqual(authority.corruption_matrix.map((item) => item.case_id), ['S3-CR01', 'S3-CR02', 'S3-CR03', 'S3-CR04', 'S3-CR05', 'S3-CR06', 'S3-CR07', 'S3-CR08']);

  assert.equal(review.schema_version, 'geox_mcft_cap08_s3_review_policy_v2');
  assert.equal(review.independent_review_required, false);
  assert.equal(review.independent_review_satisfied, false);
  assert.equal(review.independent_review_performed, false);
  assert.equal(review.independent_review_waived, true);
  assert.equal(review.technical_gate_relaxation, false);
  assert.equal(review.retroactive_exact_head_approval_claim_allowed, false);
  assert.equal(review.final_closure_review.slice_id, 'MCFT-CAP-08.S6');
  assert.equal(review.final_closure_review.independent_review_required, true);
  assert.equal(review.final_closure_review.review_must_target_exact_s6_candidate_head, true);

  assert.equal(waiver.schema_version, 'geox_mcft_cap08_interim_owner_review_waiver_v1');
  assert.equal(waiver.policy_id, 'MCFT-CAP-08-S3-S5-INTERIM-OWNER-REVIEW-WAIVER-V1');
  assert.deepEqual(waiver.interim_slice_scope, ['MCFT-CAP-08.S3', 'MCFT-CAP-08.S4', 'MCFT-CAP-08.S5']);
  assert.equal(waiver.interim_review_policy.technical_gate_relaxation, false);
  assert.equal(waiver.interim_review_policy.retroactive_exact_head_approval_claim_allowed, false);
  assert.equal(waiver.final_closure_review_policy.independent_review_required, true);
  assert.equal(waiver.final_closure_review_policy.s6_merge_authorized_without_independent_review, false);

  verifyLifecycleMatrix(status, review, waiver);
  const lifecycle = validateStatus(status, review, waiver);

  assert.equal(workflowDeclaration.hardening_workflow.name, 'mcft-cap-08-s3-preflight-hardening');
  assert.equal(workflowDeclaration.hardening_workflow.candidate_declaration_expected, false);
  assert.equal(workflowDeclaration.hardening_workflow.runtime_source_delta, 0);
  assert.equal(workflowDeclaration.candidate_workflow.runs_exact_completed_rerun, true);
  assert.equal(workflowDeclaration.candidate_workflow.runs_completed_rerun_corruption_matrix, true);
  assert.equal(workflowDeclaration.candidate_workflow.uses_atomic_completion_authority_pair, true);
  assert.equal(workflowDeclaration.candidate_workflow.canonical_completion_tuple_fact, false);
  assert.equal(workflowDeclaration.candidate_integrity_workflows.shared_visible_workflow_identity, false);

  assert.match(enforcementWorkflow, /^name: mcft-candidate-declaration-integrity-v2$/m);
  assert.equal(hasOnEvent(enforcementWorkflow, 'pull_request_target'), true);
  assert.equal(hasOnEvent(enforcementWorkflow, 'merge_group'), true);
  assert.equal(hasOnEvent(enforcementWorkflow, 'pull_request'), false);
  assert.match(selftestWorkflow, /^name: mcft-candidate-declaration-selftest-v2$/m);
  assert.equal(hasOnEvent(selftestWorkflow, 'pull_request'), true);
  assert.equal(hasOnEvent(selftestWorkflow, 'pull_request_target'), false);

  const result = {
    schema_version: 'geox_mcft_cap08_s3_preflight_hardening_result_v3',
    status: 'PASS',
    semantic_completion_authority_digest: authority.semantic_digest,
    storage_table: authority.storage_contract.table,
    atomic_completion_authority_pair_required: true,
    normal_completed_rerun_write_delta: 0,
    corruption_case_count: authority.corruption_matrix.length,
    status_lifecycle: lifecycle.lifecycle,
    review_mode: lifecycle.review_mode,
    candidate_signal_present: lifecycle.candidate_signal_present,
    lifecycle_matrix_verified: true,
    owner_directive_issue_ref: waiver.owner_directive_issue_ref,
    technical_gate_relaxation: false,
    retroactive_approval_claim_allowed: false,
    final_s6_independent_review_required: true,
    runtime_source_delta: 0,
    s3_effective: false,
    s4_authorized: false,
    mcft_cap_09_authorized: false,
  };
  write(result);
  console.log(JSON.stringify(result));
} catch (error) {
  write({ schema_version: 'geox_mcft_cap08_s3_preflight_hardening_result_v3', status: 'FAIL', error: error instanceof Error ? error.message : String(error) });
  console.error(error);
  process.exitCode = 1;
}
