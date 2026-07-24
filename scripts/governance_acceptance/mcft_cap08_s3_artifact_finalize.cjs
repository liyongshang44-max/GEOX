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

function readJson(relative) { return JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8')); }
function git(...args) { return cp.execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim(); }
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
function semanticHash(value) {
  return `sha256:${crypto.createHash('sha256').update(Buffer.from(canonical(value))).digest('hex')}`;
}
function commit(value, code) {
  const text = String(value || '').trim();
  assert.match(text, /^[0-9a-f]{40}$/, code);
  return git('rev-parse', `${text}^{commit}`);
}
function write(value) {
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify(value, null, 2)}\n`);
}

try {
  assert.ok(['CANDIDATE_HEAD', 'EXACT_MERGE_SHA'].includes(STAGE), 'S3_ARTIFACT_STAGE_INVALID');
  const boundary = readJson('acceptance-output/MCFT_CAP_08_S3_BOUNDARY_RESULT.json');
  const positive = readJson('acceptance-output/MCFT_CAP_08_S3_DECISION_ACTION_DB_RESULT.json');
  const negative = readJson('acceptance-output/MCFT_CAP_08_S3_NEGATIVE_DB_RESULT.json');
  const edge = readJson('acceptance-output/MCFT_CAP_08_S3_EDGE_SEMANTICS_DB_RESULT.json');
  const status = readJson('docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S3-DELIVERY-STATUS-V1.json');
  const implementation = readJson('docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S3-IMPLEMENTATION-V1.json');
  const predecessor = readJson('docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S3-PREDECESSOR-CONSUMPTION-V1.json');
  const reviewPolicy = readJson('docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S3-REVIEW-POLICY-V1.json');
  const exact = STAGE === 'EXACT_MERGE_SHA'
    ? readJson('acceptance-output/MCFT_CAP_08_S3_EXACT_SHA_ATTESTATION_RESULT.json')
    : null;

  assert.equal(boundary.status, 'PASS');
  assert.equal(positive.status, 'PASS');
  assert.equal(negative.status, 'PASS');
  assert.equal(edge.status, 'PASS');
  assert.equal(status.s3_candidate_implemented, true);
  assert.equal(status.s3_effective, false);
  assert.equal(status.production_runtime_source_authorized, false);
  assert.equal(status.s4_authorized, false);
  assert.equal(status.mcft_cap_09_authorized, false);
  assert.equal(implementation.formal_provider_contract_digest, positive.provider_contract_digest);
  assert.equal(positive.provider_contract_digest, 'sha256:5816ce6dad81c8b267ed1382ca00a44aa5f1ef271e3f621f181d45d069655746');
  assert.equal(positive.source_manifest.paths.length, 20);
  assert.deepEqual(positive.source_manifest.paths, implementation.source_manifest_paths);
  assert.equal(positive.source_manifest.manifest_digest, positive.phase_engine_source_digest);
  assert.match(positive.source_manifest.manifest_digest, /^sha256:[0-9a-f]{64}$/);
  assert.equal(positive.successful_tick_count, 24);
  assert.deepEqual(positive.persisted_cardinalities, {
    posterior_state_count: 25,
    successful_forecast_count: 24,
    scenario_set_count: 24,
    forecast_point_count: 1728,
    scenario_point_count: 5184,
  });
  assert.equal(positive.tick_trace_digests.length, 24);
  assert.equal(new Set(positive.tick_trace_digests).size, 24);
  for (const digest of positive.tick_trace_digests) assert.match(digest, /^sha256:[0-9a-f]{64}$/);
  assert.deepEqual([
    positive.decision_count,
    positive.approval_assertion_count,
    positive.approved_plan_count,
    positive.execution_receipt_count,
    positive.action_feedback_count,
    positive.outcome_fvo10_identity_count,
    positive.completed_rerun_write_delta,
  ], [1, 1, 1, 1, 1, 1, 0]);
  assert.equal(positive.t08_h_before_a, true);
  assert.equal(positive.t09_outcome_absence, true);
  assert.equal(positive.t10_ordinary_assimilation, true);
  assert.equal(negative.negative_case_count, 22);
  assert.equal(negative.pointer_case_count, 6);
  assert.equal(negative.all_runtime_deltas_zero, true);
  assert.equal(negative.cases.length, 28);
  assert.equal(new Set(negative.cases.map((item) => item.case_id)).size, 28);
  assert.ok(negative.cases.every((item) => item.status === 'PASS' && item.runtime_delta === 0));
  const edgeById = Object.fromEntries(edge.cases.map((item) => [item.case_id, item]));
  assert.equal(edgeById['S3-N09'].t08_disposition, 'EXCLUDED_LATE');
  assert.equal(edgeById['S3-N09'].t09_disposition, 'SELECTED');
  assert.equal(edgeById['S3-N09'].t10_disposition, 'EXCLUDED_OUTSIDE_WINDOW');
  assert.equal(edgeById['S3-N09'].selected_exactly_once, true);
  assert.equal(edgeById['S3-N09'].runtime_delta, 0);
  assert.match(edgeById['S3-P04'].observed_error, /^PERSISTED_OBJECT_CARDINALITY:twin_runtime_checkpoint_v1:/);
  assert.equal(edgeById['S3-P04'].silent_pointer_repair, false);
  assert.equal(edgeById['S3-P04'].runtime_delta, 0);
  assert.equal(reviewPolicy.independent_review_required, true);
  assert.equal(reviewPolicy.independent_review_waived, false);
  assert.equal(predecessor.predecessor_effective_status, 'S2_FORCING_EVIDENCE_STATE_FORECAST_IMPLEMENTED_EFFECTIVE');
  assert.equal(predecessor.effective_next_slice, 'S3');
  assert.equal(predecessor.readback_verified, true);

  const candidateHead = commit(
    STAGE === 'EXACT_MERGE_SHA' ? exact.candidate_head_sha : process.env.MCFT_CANDIDATE_SHA,
    'S3_CANDIDATE_SHA_INVALID',
  );
  const baseHead = commit(
    STAGE === 'EXACT_MERGE_SHA' ? exact.base_head_sha : process.env.MCFT_BASE_SHA,
    'S3_BASE_SHA_INVALID',
  );
  const subject = STAGE === 'EXACT_MERGE_SHA'
    ? commit(exact.subject_sha, 'S3_SUBJECT_SHA_INVALID')
    : candidateHead;

  if (STAGE === 'EXACT_MERGE_SHA') {
    assert.equal(exact.status, 'PASS');
    assert.equal(exact.candidate_to_merge_tree_delta, 0);
    assert.equal(exact.independent_review_required, true);
    assert.equal(exact.independent_review_satisfied, true);
    assert.equal(exact.independent_review_waived, false);
    assert.equal(exact.review_commit_sha, candidateHead);
  }

  const artifact = {
    schema_version: 'geox_mcft_cap08_s3_authority_artifact_v1',
    status: 'PASS',
    capability_line_id: 'MCFT-CAP-08',
    slice_id: 'MCFT-CAP-08.S3',
    stage: STAGE,
    subject_sha: subject,
    subject_commit: subject,
    base_head_sha: baseHead,
    candidate_head_sha: candidateHead,
    candidate_tree_sha: STAGE === 'EXACT_MERGE_SHA' ? exact.candidate_tree_sha : git('rev-parse', `${candidateHead}^{tree}`),
    merge_commit_sha: STAGE === 'EXACT_MERGE_SHA' ? exact.merge_commit_sha : null,
    merge_tree_sha: STAGE === 'EXACT_MERGE_SHA' ? exact.merge_tree_sha : null,
    candidate_to_merge_tree_delta: STAGE === 'EXACT_MERGE_SHA' ? 0 : null,
    attested_tree_sha: STAGE === 'EXACT_MERGE_SHA' ? exact.attested_tree_sha : null,
    predecessor_authority: predecessor,
    status_projection: {
      candidate_field: 's3_candidate_implemented',
      candidate_value: true,
      repository_delivery_state: status.delivery_state,
      effectiveness_condition: status.effectiveness_condition,
      independent_review_required: true,
      independent_review_satisfied: STAGE === 'EXACT_MERGE_SHA',
      independent_review_waived: false,
    },
    implementation: {
      provider_profile_id: positive.provider_profile_id,
      provider_contract_digest: positive.provider_contract_digest,
      source_manifest: positive.source_manifest,
      formal_run_id: positive.formal_run_id,
      successful_tick_count: positive.successful_tick_count,
      persisted_cardinalities: positive.persisted_cardinalities,
      tick_trace_digests: positive.tick_trace_digests,
      decision_count: positive.decision_count,
      approval_assertion_count: positive.approval_assertion_count,
      approved_plan_count: positive.approved_plan_count,
      execution_receipt_count: positive.execution_receipt_count,
      action_feedback_count: positive.action_feedback_count,
      outcome_fvo10_identity_count: positive.outcome_fvo10_identity_count,
      t08_h_before_a: positive.t08_h_before_a,
      t09_outcome_absence: positive.t09_outcome_absence,
      t10_ordinary_assimilation: positive.t10_ordinary_assimilation,
      completed_rerun_write_delta: positive.completed_rerun_write_delta,
      negative_case_count: negative.negative_case_count,
      pointer_case_count: negative.pointer_case_count,
      all_runtime_deltas_zero: negative.all_runtime_deltas_zero,
      deferred_receipt_first_legal_tick_proven: true,
      exact_checkpoint_pointer_failure_proven: true,
    },
    evidence: {
      changed_file_boundary: boundary,
      fresh_postgresql_positive: positive,
      negative_and_pointer_matrix: negative,
      edge_semantics: edge,
      exact_sha_attestation: exact,
    },
    independent_review: STAGE === 'EXACT_MERGE_SHA' ? exact.independent_review : {
      required: true,
      satisfied: false,
      waived: false,
    },
    effective_delivery_frontier_projection: STAGE === 'EXACT_MERGE_SHA' ? {
      effective_status: 'S3_DECISION_ACTION_FEEDBACK_IMPLEMENTED_EFFECTIVE',
      effective_next_slice: 'S4',
    } : null,
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
  artifact.semantic_artifact_digest = semanticHash(artifact);
  write(artifact);
  console.log(JSON.stringify(artifact));
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
