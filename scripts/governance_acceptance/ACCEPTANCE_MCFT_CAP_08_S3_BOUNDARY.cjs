#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const OUTPUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_08_S3_BOUNDARY_RESULT.json');
const FORMAL_BASE = '13e3e1260c70b9c2b6dd1fd6b8d57fd50fb3202e';
const TASKBOOK = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-TASK.md';
const STATUS = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S3-DELIVERY-STATUS-V1.json';
const IMPLEMENTATION = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S3-IMPLEMENTATION-V1.json';
const BOUNDARY = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S3-CANDIDATE-CHANGED-FILE-BOUNDARY-V1.json';
const CONTRACT = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S3-CONTRACT-V1.json';
const REVIEW = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S3-REVIEW-POLICY-V1.json';
const PREDECESSOR = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S3-PREDECESSOR-CONSUMPTION-V1.json';
const FOCUSED = '.github/workflows/mcft-cap-08-s3-decision-action-feedback.yml';
const EXACT = '.github/workflows/mcft-cap-08-s3-exact-sha-attestation.yml';

function git(...args) {
  return cp.execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}
function read(relative) { return fs.readFileSync(path.join(ROOT, relative), 'utf8'); }
function json(relative) { return JSON.parse(read(relative)); }
function write(value) {
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify(value, null, 2)}\n`);
}
function changedFiles(base, head = 'HEAD') {
  const raw = git('diff', '--name-only', `${base}...${head}`);
  return raw ? raw.split(/\r?\n/).filter(Boolean).sort() : [];
}
function sha(value, code) {
  assert.match(String(value || ''), /^[0-9a-f]{40}$/, code);
  return String(value);
}

try {
  const base = sha(process.env.MCFT_BASE_SHA, 'MCFT_BASE_SHA_INVALID');
  assert.equal(base, FORMAL_BASE, 'S3_FORMAL_BASE_MISMATCH');
  assert.equal(git('merge-base', base, 'HEAD'), base, 'S3_BASE_NOT_ANCESTOR');
  assert.equal(git('diff', '--check', `${base}...HEAD`), '', 'S3_DIFF_CHECK_FAILED');
  const baseTaskbookBlob = git('rev-parse', `${base}:${TASKBOOK}`);
  const candidateTaskbookBlob = git('rev-parse', `HEAD:${TASKBOOK}`);
  assert.equal(candidateTaskbookBlob, baseTaskbookBlob, 'S3_TASKBOOK_BLOB_DRIFT');

  const status = json(STATUS);
  const implementation = json(IMPLEMENTATION);
  const boundary = json(BOUNDARY);
  const contract = json(CONTRACT);
  const review = json(REVIEW);
  const predecessor = json(PREDECESSOR);
  const actual = changedFiles(base);

  assert.equal(status.s3_candidate_implemented, true);
  assert.equal(status.delivery_state, 'CANDIDATE_IMPLEMENTED_AWAITING_INDEPENDENT_REVIEW_PROTECTED_MERGE_AND_EXACT_SHA_ATTESTATION');
  assert.equal(status.implementation_authorized, true);
  assert.equal(status.runtime_source_authorized, false);
  assert.equal(status.bounded_canonical_transaction_authorized, true);
  assert.equal(status.independent_review_required, true);
  assert.equal(status.independent_review_satisfied, false);
  assert.equal(status.independent_review_waived, false);
  assert.equal(status.focused_workflow, 'mcft-cap-08-s3-decision-action-feedback');
  assert.equal(status.standard_workflow, 'ci');
  assert.equal(status.exact_sha_workflow, 'mcft-cap-08-s3-exact-sha-attestation');
  assert.equal(status.s3_effective, false);
  assert.equal(status.s4_authorized, false);
  assert.equal(status.mcft_cap_09_authorized, false);
  assert.equal(status.production_runtime_source_authorized, false);

  assert.equal(implementation.record_status, 'FORMAL_CANDIDATE_IMPLEMENTATION_PREPARED_NOT_EFFECTIVE');
  assert.equal(implementation.formal_provider_contract_digest, 'sha256:5816ce6dad81c8b267ed1382ca00a44aa5f1ef271e3f621f181d45d069655746');
  assert.equal(implementation.source_manifest_file_count, 20);
  assert.equal(implementation.formal_run_cardinality.successful_tick_count, 24);
  assert.equal(implementation.formal_run_cardinality.posterior_state_count, 25);
  assert.equal(implementation.formal_run_cardinality.forecast_point_count, 1728);
  assert.equal(implementation.formal_run_cardinality.scenario_point_count, 5184);
  assert.equal(implementation.negative_matrix.case_count, 22);
  assert.equal(implementation.negative_matrix.pointer_case_count, 6);
  assert.equal(implementation.persistence_policy.runtime_acl_expansion, false);
  assert.equal(implementation.persistence_policy.migration_delta, 0);
  assert.equal(implementation.production_runtime_source_authorized, false);

  assert.equal(contract.contract_id, 'GEOX-MCFT-CAP-08-S3-CONTRACT-V1');
  assert.equal(review.independent_review_required, true);
  assert.equal(review.required_before_candidate_merge, true);
  assert.equal(review.required_before_exact_sha_attestation, true);
  assert.equal(review.independent_review_waived, false);
  assert.equal(predecessor.predecessor_effective_status, 'S2_FORCING_EVIDENCE_STATE_FORECAST_IMPLEMENTED_EFFECTIVE');
  assert.equal(predecessor.effective_next_slice, 'S3');
  assert.equal(predecessor.readback_verified, true);

  assert.equal(boundary.record_status, 'FORMAL_S3_CANDIDATE_CHANGED_FILE_BOUNDARY_FROZEN');
  assert.equal(boundary.base_sha, FORMAL_BASE);
  assert.equal(boundary.taskbook_blob_sha, candidateTaskbookBlob);
  assert.equal(boundary.changed_file_count, 28);
  assert.equal(boundary.changed_file_count, boundary.changed_files.length);
  assert.deepEqual(actual, [...boundary.changed_files].sort(), 'S3_CHANGED_FILE_BOUNDARY_MISMATCH');
  assert.equal(boundary.workflow_file_count, 2);
  assert.equal(boundary.runtime_source_file_count, 16);
  assert.equal(boundary.candidate_ssot_file_count, 3);
  assert.equal(boundary.governance_acceptance_file_count, 3);
  assert.equal(boundary.runtime_acceptance_file_count, 4);
  assert.equal(boundary.database_migration_file_count, 0);
  assert.equal(boundary.route_file_count, 0);
  assert.equal(boundary.web_file_count, 0);
  assert.equal(boundary.database_acl_delta_expected, 0);
  assert.equal(boundary.business_schema_delta_expected, 0);

  for (const file of implementation.source_manifest_paths) {
    assert.equal(fs.existsSync(path.join(ROOT, file)), true, `S3_SOURCE_MANIFEST_FILE_MISSING:${file}`);
  }
  const forbidden = actual.filter((file) =>
    file.startsWith('apps/server/db/migrations/') ||
    file.startsWith('apps/server/src/routes/') ||
    file.startsWith('apps/web/') ||
    file.startsWith('docker/postgres/init/') ||
    file.includes('scheduler') ||
    file.includes('model_activation'));
  assert.deepEqual(forbidden, [], 'S3_FORBIDDEN_FILE_BOUNDARY');

  const focused = read(FOCUSED);
  const exact = read(EXACT);
  for (const token of [
    'ACCEPTANCE_MCFT_CAP_08_S3_BOUNDARY.cjs',
    'ACCEPTANCE_MCFT_CAP_08_S3_DECISION_ACTION_DB.ts',
    'ACCEPTANCE_MCFT_CAP_08_S3_NEGATIVE_DB.ts',
    'ACCEPTANCE_MCFT_CAP_08_S3_EDGE_SEMANTICS_DB.ts',
    'mcft_cap08_s3_artifact_finalize.cjs',
  ]) assert.ok(focused.includes(token), `S3_FOCUSED_WORKFLOW_MISSING:${token}`);
  for (const token of [
    'ACCEPTANCE_MCFT_CAP_08_S3_EXACT_SHA_ATTESTATION.cjs',
    'ACCEPTANCE_MCFT_CAP_08_S3_BOUNDARY.cjs',
    'ACCEPTANCE_MCFT_CAP_08_S3_DECISION_ACTION_DB.ts',
    'ACCEPTANCE_MCFT_CAP_08_S3_NEGATIVE_DB.ts',
    'ACCEPTANCE_MCFT_CAP_08_S3_EDGE_SEMANTICS_DB.ts',
    'mcft_cap08_s3_artifact_finalize.cjs',
    'mcft_attestation_retention_store_v1.cjs',
  ]) assert.ok(exact.includes(token), `S3_EXACT_WORKFLOW_MISSING:${token}`);

  const result = {
    schema_version: 'geox_mcft_cap08_s3_boundary_result_v1',
    status: 'PASS',
    classification: 'FORMAL_S3_CANDIDATE_MODE',
    base_sha: base,
    candidate_sha: git('rev-parse', 'HEAD'),
    candidate_tree_sha: git('rev-parse', 'HEAD^{tree}'),
    taskbook_blob_sha: candidateTaskbookBlob,
    changed_file_count: actual.length,
    changed_files: actual,
    source_manifest_file_count: implementation.source_manifest_file_count,
    independent_review_required: true,
    independent_review_satisfied: false,
    s3_candidate_implemented: true,
    s3_effective: false,
    s4_authorized: false,
    production_runtime_source_authorized: false,
  };
  write(result);
  console.log(JSON.stringify(result));
} catch (error) {
  write({
    schema_version: 'geox_mcft_cap08_s3_boundary_result_v1',
    status: 'FAIL',
    error: error instanceof Error ? error.message : String(error),
  });
  console.error(error);
  process.exitCode = 1;
}
