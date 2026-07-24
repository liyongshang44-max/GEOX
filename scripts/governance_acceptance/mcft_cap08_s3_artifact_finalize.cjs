#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const OUTPUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_08_S3_AUTHORITY_ARTIFACT.json');
const STAGE = String(process.env.MCFT_ARTIFACT_STAGE || 'CANDIDATE_HEAD');

function read(relative) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8'));
}
function git(...args) {
  return cp.execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
function digest(value) {
  return `sha256:${crypto.createHash('sha256').update(Buffer.from(canonical(value))).digest('hex')}`;
}
function sha(value, code) {
  const candidate = String(value || '').trim();
  assert.match(candidate, /^[0-9a-f]{40}$/, code);
  return git('rev-parse', `${candidate}^{commit}`);
}
function write(value) {
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify(value, null, 2)}\n`);
}

try {
  assert.ok(['CANDIDATE_HEAD', 'EXACT_MERGE_SHA'].includes(STAGE), 'S3_ARTIFACT_STAGE_INVALID');

  const boundary = read('acceptance-output/MCFT_CAP_08_S3_BOUNDARY_RESULT.json');
  const positive = read('acceptance-output/MCFT_CAP_08_S3_DECISION_ACTION_DB_RESULT.json');
  const completed = read('acceptance-output/MCFT_CAP_08_S3_COMPLETED_RERUN_NEGATIVE_DB_RESULT.json');
  const negative = read('acceptance-output/MCFT_CAP_08_S3_NEGATIVE_DB_RESULT.json');
  const edge = read('acceptance-output/MCFT_CAP_08_S3_EDGE_SEMANTICS_DB_RESULT.json');
  const status = read('docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S3-DELIVERY-STATUS-V1.json');
  const implementation = read('docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S3-IMPLEMENTATION-V1.json');
  const predecessor = read('docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S3-PREDECESSOR-CONSUMPTION-V1.json');

  for (const result of [boundary, positive, completed, negative, edge]) {
    assert.equal(result.status, 'PASS');
  }

  assert.equal(boundary.classification, 'FORMAL_S3_CANDIDATE_MODE');
  assert.equal(boundary.changed_file_count, 36);
  assert.equal(boundary.independent_review_required, true);
  assert.equal(boundary.independent_review_satisfied, false);
  assert.equal(status.s3_candidate_implemented, true);
  assert.equal(status.s3_effective, false);
  assert.equal(status.s4_authorized, false);
  assert.equal(status.production_runtime_source_authorized, false);

  assert.equal(positive.source_manifest.paths.length, 34);
  assert.equal(positive.source_manifest.paths.length, implementation.source_manifest_file_count);
  assert.match(positive.source_manifest.manifest_digest, /^sha256:[0-9a-f]{64}$/);
  assert.match(positive.completion_tuple_ref, /^cap08_s3_completion_tuple_[0-9a-f]{24}$/);
  assert.match(positive.completion_tuple_hash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(positive.completion_authority_pair_write_status, 'INSERTED_ATOMIC_PAIR');
  assert.equal(positive.completion_authority_pair_write_delta, 2);
  assert.equal(positive.completed_rerun_write_delta, 0);
  assert.equal(positive.normal_runner_repair_authorized, false);
  assert.equal(positive.canonical_completion_tuple_fact_count, 0);
  assert.equal(positive.persisted_tick_binding_count, 24);
  assert.equal(positive.tick_trace_digests.length, 24);
  assert.deepEqual(positive.completed_rerun_tick_trace_digests, positive.tick_trace_digests);
  assert.equal(positive.t08_h_before_a, true);
  assert.equal(positive.t09_outcome_absence, true);
  assert.equal(positive.t10_ordinary_assimilation, true);

  assert.equal(completed.completed_rerun_corruption_case_count, 8);
  assert.equal(completed.all_runtime_deltas_zero, true);
  assert.equal(completed.suite_restore_delta, 0);
  assert.equal(negative.negative_case_count, 22);
  assert.equal(negative.pointer_case_count, 6);
  assert.equal(negative.all_runtime_deltas_zero, true);
  assert.equal(negative.reusable_fault_slot_restored, true);
  assert.equal(negative.visibility_metadata_mutation_count, 0);

  const edgeById = Object.fromEntries(edge.cases.map((item) => [item.case_id, item]));
  assert.equal(edgeById['S3-N09'].selected_exactly_once, true);
  assert.equal(edgeById['S3-N09'].runtime_delta, 0);
  assert.match(edgeById['S3-P04'].observed_error, /^PERSISTED_OBJECT_CARDINALITY:twin_runtime_checkpoint_v1:/);
  assert.equal(edgeById['S3-P04'].silent_pointer_repair, false);
  assert.equal(edgeById['S3-P04'].runtime_delta, 0);

  assert.equal(predecessor.predecessor_effective_status, 'S2_FORCING_EVIDENCE_STATE_FORECAST_IMPLEMENTED_EFFECTIVE');
  assert.equal(predecessor.effective_next_slice, 'S3');
  assert.equal(predecessor.readback_verified, true);

  const exact = STAGE === 'EXACT_MERGE_SHA'
    ? read('acceptance-output/MCFT_CAP_08_S3_EXACT_SHA_ATTESTATION_RESULT.json')
    : null;
  const candidateHead = sha(
    STAGE === 'EXACT_MERGE_SHA' ? exact.candidate_head_sha : process.env.MCFT_CANDIDATE_SHA,
    'S3_ARTIFACT_CANDIDATE_SHA_INVALID',
  );
  const baseHead = sha(
    STAGE === 'EXACT_MERGE_SHA' ? exact.base_head_sha : process.env.MCFT_BASE_SHA,
    'S3_ARTIFACT_BASE_SHA_INVALID',
  );
  const subjectSha = STAGE === 'EXACT_MERGE_SHA'
    ? sha(exact.subject_sha, 'S3_ARTIFACT_SUBJECT_SHA_INVALID')
    : candidateHead;

  if (STAGE === 'EXACT_MERGE_SHA') {
    assert.equal(exact.status, 'PASS');
    assert.equal(exact.candidate_to_merge_tree_delta, 0);
    assert.equal(exact.independent_review_required, true);
    assert.equal(exact.independent_review_satisfied, true);
    assert.equal(exact.independent_review_waived, false);
    assert.equal(exact.review_commit_sha, candidateHead);
  }

  const independentReview = STAGE === 'EXACT_MERGE_SHA'
    ? exact.independent_review
    : { required: true, satisfied: false, waived: false };

  const artifact = {
    schema_version: 'geox_mcft_cap08_s3_authority_artifact_v2',
    status: 'PASS',
    capability_line_id: 'MCFT-CAP-08',
    slice_id: 'MCFT-CAP-08.S3',
    stage: STAGE,
    subject_sha: subjectSha,
    base_head_sha: baseHead,
    candidate_head_sha: candidateHead,
    candidate_tree_sha: STAGE === 'EXACT_MERGE_SHA'
      ? exact.candidate_tree_sha
      : git('rev-parse', `${candidateHead}^{tree}`),
    merge_commit_sha: STAGE === 'EXACT_MERGE_SHA' ? exact.merge_commit_sha : null,
    merge_tree_sha: STAGE === 'EXACT_MERGE_SHA' ? exact.merge_tree_sha : null,
    candidate_to_merge_tree_delta: STAGE === 'EXACT_MERGE_SHA' ? 0 : null,
    attested_tree_sha: STAGE === 'EXACT_MERGE_SHA' ? exact.attested_tree_sha : null,
    predecessor_authority: predecessor,
    status_projection: {
      candidate_field: 's3_candidate_implemented',
      candidate_value: true,
      repository_delivery_state: status.delivery_state,
      independent_review_required: true,
      independent_review_satisfied: STAGE === 'EXACT_MERGE_SHA',
    },
    implementation: {
      provider_profile_id: positive.provider_profile_id,
      provider_contract_digest: positive.provider_contract_digest,
      source_manifest: positive.source_manifest,
      completion_tuple_ref: positive.completion_tuple_ref,
      completion_tuple_hash: positive.completion_tuple_hash,
      completion_authority_pair_write_status: positive.completion_authority_pair_write_status,
      completion_authority_pair_write_delta: positive.completion_authority_pair_write_delta,
      normal_completed_rerun_write_delta: positive.completed_rerun_write_delta,
      completed_rerun_corruption_case_count: completed.completed_rerun_corruption_case_count,
      negative_case_count: negative.negative_case_count,
      pointer_case_count: negative.pointer_case_count,
      reusable_fault_slot_restored: negative.reusable_fault_slot_restored,
      visibility_metadata_mutation_count: negative.visibility_metadata_mutation_count,
    },
    evidence: {
      changed_file_boundary: boundary,
      fresh_postgresql_positive: positive,
      completed_rerun_corruption: completed,
      negative_and_pointer_matrix: negative,
      edge_semantics: edge,
      exact_sha_attestation: exact,
    },
    independent_review: independentReview,
    effective_delivery_frontier_projection: STAGE === 'EXACT_MERGE_SHA'
      ? {
          effective_status: 'S3_DECISION_ACTION_FEEDBACK_IMPLEMENTED_EFFECTIVE',
          effective_next_slice: 'S4',
        }
      : null,
    effective_authority_projection: {
      bounded_replay_runner_authorized: STAGE === 'EXACT_MERGE_SHA',
      bounded_canonical_transaction_authorized: STAGE === 'EXACT_MERGE_SHA',
      decision_action_feedback_authorized: STAGE === 'EXACT_MERGE_SHA',
      production_runtime_source_authorized: false,
      late_append_forward_authorized: false,
      residual_calibration_shadow_authorized: false,
      model_activation_authorized: false,
      s4_authorized: STAGE === 'EXACT_MERGE_SHA',
      mcft_cap_09_authorized: false,
    },
    retention_class: STAGE === 'EXACT_MERGE_SHA' ? 'R1_180_DAYS' : 'TRANSIENT_CANDIDATE',
  };

  artifact.semantic_artifact_digest = digest(artifact);
  write(artifact);
  console.log(JSON.stringify(artifact));
} catch (error) {
  write({
    schema_version: 'geox_mcft_cap08_s3_authority_artifact_v2',
    status: 'FAIL',
    error: error instanceof Error ? error.message : String(error),
  });
  console.error(error);
  process.exitCode = 1;
}
