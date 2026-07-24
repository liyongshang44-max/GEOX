#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_08_S3_PREFLIGHT_ARTIFACT.json');

function read(relative) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8'));
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
function write(value) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`);
}

try {
  const boundary = read('acceptance-output/MCFT_CAP_08_S3_BOUNDARY_RESULT.json');
  const positive = read('acceptance-output/MCFT_CAP_08_S3_DECISION_ACTION_DB_RESULT.json');
  const completedNegative = read('acceptance-output/MCFT_CAP_08_S3_COMPLETED_RERUN_NEGATIVE_DB_RESULT.json');
  const negative = read('acceptance-output/MCFT_CAP_08_S3_NEGATIVE_DB_RESULT.json');
  const edge = read('acceptance-output/MCFT_CAP_08_S3_EDGE_SEMANTICS_DB_RESULT.json');

  assert.equal(boundary.status, 'PASS');
  assert.equal(boundary.classification, 'DEVELOPMENT_PREFLIGHT_NOT_CANDIDATE');
  assert.equal(positive.status, 'PASS');
  assert.equal(completedNegative.status, 'PASS');
  assert.equal(negative.status, 'PASS');
  assert.equal(edge.status, 'PASS');

  assert.equal(positive.source_manifest.paths.length, 24);
  assert.match(positive.source_manifest.manifest_digest, /^sha256:[0-9a-f]{64}$/);
  assert.match(positive.completion_tuple_ref, /^geox-semantic:\/\//);
  assert.match(positive.completion_tuple_hash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(positive.persisted_tick_binding_count, 24);
  assert.equal(positive.tick_trace_digests.length, 24);
  assert.equal(positive.completed_rerun_tick_trace_digests.length, 24);
  assert.deepEqual(positive.completed_rerun_tick_trace_digests, positive.tick_trace_digests);
  assert.equal(new Set(positive.tick_trace_digests).size, 24);
  assert.equal(positive.completed_rerun_write_delta, 0);
  assert.equal(positive.t08_h_before_a, true);
  assert.equal(positive.t09_outcome_absence, true);
  assert.equal(positive.t10_ordinary_assimilation, true);

  assert.equal(completedNegative.completed_rerun_corruption_case_count, 6);
  assert.equal(completedNegative.all_runtime_deltas_zero, true);
  assert.deepEqual(completedNegative.cases.map((item) => item.case_id), [
    'S3-CR01', 'S3-CR02', 'S3-CR03', 'S3-CR04', 'S3-CR05', 'S3-CR06',
  ]);
  assert.ok(completedNegative.cases.every((item) => item.status === 'PASS' && item.runtime_delta === 0));

  assert.equal(negative.negative_case_count, 22);
  assert.equal(negative.pointer_case_count, 6);
  assert.equal(negative.all_runtime_deltas_zero, true);
  assert.equal(negative.cases.length, 28);
  assert.equal(new Set(negative.cases.map((item) => item.case_id)).size, 28);
  assert.ok(negative.cases.every((item) => item.status === 'PASS' && item.runtime_delta === 0));

  const edgeById = Object.fromEntries(edge.cases.map((item) => [item.case_id, item]));
  assert.equal(edgeById['S3-N09'].selected_exactly_once, true);
  assert.equal(edgeById['S3-N09'].runtime_delta, 0);
  assert.equal(edgeById['S3-P04'].silent_pointer_repair, false);
  assert.equal(edgeById['S3-P04'].runtime_delta, 0);

  const artifact = {
    schema_version: 'geox_mcft_cap08_s3_preflight_artifact_v1',
    status: 'PASS',
    classification: 'DEVELOPMENT_PREFLIGHT_NOT_CANDIDATE',
    base_sha: boundary.base_sha,
    implementation_head_sha: boundary.head_sha,
    implementation_tree_sha: boundary.head_tree_sha,
    taskbook_blob_sha: boundary.taskbook_blob_sha,
    changed_file_count: boundary.changed_file_count,
    changed_files: boundary.changed_files,
    provider_profile_id: positive.provider_profile_id,
    provider_contract_digest: positive.provider_contract_digest,
    source_manifest: positive.source_manifest,
    completion_tuple_ref: positive.completion_tuple_ref,
    completion_tuple_hash: positive.completion_tuple_hash,
    persisted_tick_binding_count: positive.persisted_tick_binding_count,
    tick_trace_digests: positive.tick_trace_digests,
    completed_rerun_tick_trace_digests: positive.completed_rerun_tick_trace_digests,
    positive_proof: positive,
    completed_rerun_corruption_proof: completedNegative,
    negative_and_pointer_proof: negative,
    edge_semantics_proof: edge,
    candidate_declaration_authorized: false,
    independent_review_satisfied: false,
    merge_authorized: false,
    s3_effective: false,
    production_runtime_source_authorized: false,
    s4_authorized: false,
    mcft_cap_09_authorized: false,
  };
  artifact.semantic_artifact_digest = digest(artifact);
  write(artifact);
  console.log(JSON.stringify(artifact));
} catch (error) {
  write({
    schema_version: 'geox_mcft_cap08_s3_preflight_artifact_v1',
    status: 'FAIL',
    error: error instanceof Error ? error.message : String(error),
  });
  console.error(error);
  process.exitCode = 1;
}
