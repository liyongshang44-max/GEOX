#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const OUTPUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_08_S3_BOUNDARY_RESULT.json');
const FORMAL_BASE = 'cabd5fb171ffa24439a40dd27a3471de04049faf';
const TASKBOOK = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-TASK.md';
const STATUS = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S3-DELIVERY-STATUS-V1.json';
const IMPLEMENTATION = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S3-IMPLEMENTATION-V1.json';
const BOUNDARY = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S3-CANDIDATE-CHANGED-FILE-BOUNDARY-V1.json';
const CONTRACT = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S3-CONTRACT-V1.json';
const REVIEW = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S3-REVIEW-POLICY-V1.json';
const PREDECESSOR = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S3-PREDECESSOR-CONSUMPTION-V1.json';
const FOCUSED = '.github/workflows/mcft-cap-08-s3-decision-action-feedback.yml';
const EXACT = '.github/workflows/mcft-cap-08-s3-exact-sha-attestation.yml';
const FROZEN_PREDECESSOR = [
  'apps/server/src/domain/twin_runtime/canonical_identity_v1.ts',
  'scripts/runtime_acceptance/mcft_cap08_s2_g3_acceptance_support_v1.ts',
];
const DEVELOPMENT_ONLY = [
  '.github/workflows/mcft-cap-08-s3-development-preflight.yml',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_08_S3_DEVELOPMENT_BOUNDARY.cjs',
  'scripts/governance_acceptance/mcft_cap08_s3_preflight_finalize.cjs',
  'scripts/runtime_acceptance/MCFT_CAP_08_S3_PREFLIGHT.ps1',
];

function git(...args) {
  return cp.execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}
function json(relative) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8'));
}
function text(relative) {
  return fs.readFileSync(path.join(ROOT, relative), 'utf8');
}
function changed(base) {
  const raw = git('diff', '--name-only', `${base}...HEAD`);
  return raw ? raw.split(/\r?\n/).filter(Boolean).sort() : [];
}
function write(value) {
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify(value, null, 2)}\n`);
}
function sha(value, code) {
  const candidate = String(value || '').trim();
  assert.match(candidate, /^[0-9a-f]{40}$/, code);
  return git('rev-parse', `${candidate}^{commit}`);
}

try {
  const base = sha(process.env.MCFT_BASE_SHA, 'S3_FORMAL_BASE_SHA_INVALID');
  assert.equal(base, FORMAL_BASE, 'S3_FORMAL_BASE_MISMATCH');
  assert.equal(git('merge-base', base, 'HEAD'), base, 'S3_FORMAL_BASE_NOT_ANCESTOR');
  assert.equal(git('diff', '--check', `${base}...HEAD`), '', 'S3_FORMAL_DIFF_CHECK_FAILED');
  const taskbookBlob = git('rev-parse', `HEAD:${TASKBOOK}`);
  assert.equal(taskbookBlob, git('rev-parse', `${base}:${TASKBOOK}`), 'S3_FORMAL_TASKBOOK_BLOB_DRIFT');

  const status = json(STATUS);
  const implementation = json(IMPLEMENTATION);
  const boundary = json(BOUNDARY);
  const contract = json(CONTRACT);
  const review = json(REVIEW);
  const predecessor = json(PREDECESSOR);
  const actual = changed(base);

  assert.equal(status.record_status, 'FORMAL_S3_CANDIDATE_IMPLEMENTED_NOT_EFFECTIVE');
  assert.equal(status.s3_candidate_implemented, true);
  assert.equal(status.delivery_state, 'CANDIDATE_IMPLEMENTED_AWAITING_INDEPENDENT_REVIEW_PROTECTED_MERGE_AND_EXACT_SHA_ATTESTATION');
  assert.equal(status.implementation_authorized, true);
  assert.equal(status.bounded_canonical_transaction_authorized, true);
  assert.equal(status.runtime_source_authorized, false);
  assert.equal(status.semantic_completion_authority_storage, 'twin_runtime_authority_snapshot_v1');
  assert.equal(status.semantic_completion_authority_kind, 'REALITY_BINDING');
  assert.equal(status.semantic_completion_authority_ref_namespace, 'cap08_s3_completion_tuple');
  assert.equal(status.canonical_completion_tuple_fact_authorized, false);
  assert.equal(status.normal_completed_rerun_repair_authorized, false);
  assert.equal(status.completed_rerun_corruption_case_count, 8);
  assert.equal(status.negative_case_count, 22);
  assert.equal(status.pointer_case_count, 6);
  assert.equal(status.independent_review_required, true);
  assert.equal(status.independent_review_satisfied, false);
  assert.equal(status.independent_review_waived, false);
  assert.equal(status.s3_effective, false);
  assert.equal(status.s4_authorized, false);
  assert.equal(status.production_runtime_source_authorized, false);

  assert.equal(implementation.record_status, 'FORMAL_CANDIDATE_IMPLEMENTATION_PREPARED_NOT_EFFECTIVE');
  assert.equal(implementation.trusted_base_sha, base);
  assert.equal(implementation.taskbook_blob_sha, taskbookBlob);
  assert.equal(implementation.machine_contract_semantic_digest, contract.semantic_digest);
  assert.equal(implementation.formal_provider_contract_digest, status.formal_provider_contract_digest);
  assert.equal(implementation.source_manifest_file_count, 34);
  assert.equal(implementation.formal_run_cardinality.successful_tick_count, 24);
  assert.equal(implementation.completion_authority.generic_and_semantic_rows, 2);
  assert.equal(implementation.completion_authority.normal_runner_repair_authorized, false);
  assert.equal(implementation.completion_authority.canonical_completion_tuple_fact_authorized, false);
  assert.equal(implementation.negative_matrix.completed_rerun_corruption_case_count, 8);
  assert.equal(implementation.negative_matrix.case_count, 22);
  assert.equal(implementation.negative_matrix.pointer_case_count, 6);
  assert.equal(implementation.negative_matrix.visibility_metadata_mutation_count, 0);
  assert.equal(implementation.persistence_policy.migration_delta, 0);
  assert.equal(implementation.persistence_policy.business_schema_delta, 0);
  assert.equal(implementation.independent_review_required, true);
  assert.equal(implementation.independent_review_satisfied, false);
  assert.equal(implementation.independent_review_waived, false);

  assert.equal(boundary.record_status, 'FORMAL_S3_CANDIDATE_CHANGED_FILE_BOUNDARY_FROZEN');
  assert.equal(boundary.base_sha, base);
  assert.equal(boundary.taskbook_blob_sha, taskbookBlob);
  assert.equal(boundary.changed_file_count, 36);
  assert.equal(boundary.changed_file_count, boundary.changed_files.length);
  assert.deepEqual(actual, [...boundary.changed_files].sort(), 'S3_FORMAL_CHANGED_FILE_BOUNDARY_MISMATCH');
  assert.equal(boundary.workflow_file_count, 2);
  assert.equal(boundary.runtime_source_file_count, 22);
  assert.equal(boundary.candidate_ssot_file_count, 3);
  assert.equal(boundary.governance_acceptance_file_count, 3);
  assert.equal(boundary.runtime_acceptance_file_count, 6);
  assert.equal(boundary.database_migration_file_count, 0);
  assert.equal(boundary.route_file_count, 0);
  assert.equal(boundary.web_file_count, 0);
  assert.equal(boundary.development_only_file_count, 0);

  for (const file of FROZEN_PREDECESSOR) {
    assert.equal(git('rev-parse', `${base}:${file}`), git('rev-parse', `HEAD:${file}`), `S3_FORMAL_PREDECESSOR_BLOB_DRIFT:${file}`);
    assert.equal(actual.includes(file), false, `S3_FORMAL_PREDECESSOR_IN_CHANGESET:${file}`);
  }
  for (const file of DEVELOPMENT_ONLY) {
    assert.equal(actual.includes(file), false, `S3_FORMAL_DEVELOPMENT_ONLY_FILE_FORBIDDEN:${file}`);
  }
  for (const file of implementation.source_manifest_paths) {
    assert.equal(fs.existsSync(path.join(ROOT, file)), true, `S3_FORMAL_SOURCE_MANIFEST_FILE_MISSING:${file}`);
  }

  const forbidden = actual.filter((file) =>
    file.startsWith('apps/server/db/migrations/')
    || file.startsWith('apps/server/src/routes/')
    || file.startsWith('apps/web/')
    || file.startsWith('docker/postgres/init/')
    || file.includes('scheduler')
    || file.includes('model_activation'));
  assert.deepEqual(forbidden, [], 'S3_FORMAL_FORBIDDEN_FILE_BOUNDARY');

  assert.equal(contract.semantic_digest, 'sha256:bc4355d20bea6ba127ffdaccc2bd19f2d950237d10bffb652479bb712739b8a5');
  assert.equal(review.independent_review_required, true);
  assert.equal(review.independent_review_waived, false);
  assert.equal(predecessor.predecessor_effective_status, 'S2_FORCING_EVIDENCE_STATE_FORECAST_IMPLEMENTED_EFFECTIVE');
  assert.equal(predecessor.effective_next_slice, 'S3');
  assert.equal(predecessor.readback_verified, true);

  const focused = text(FOCUSED);
  const exact = text(EXACT);
  for (const token of [
    'ACCEPTANCE_MCFT_CAP_08_S3_BOUNDARY.cjs',
    'ACCEPTANCE_MCFT_CAP_08_S3_DECISION_ACTION_DB.ts',
    'ACCEPTANCE_MCFT_CAP_08_S3_COMPLETED_RERUN_NEGATIVE_DB.ts',
    'ACCEPTANCE_MCFT_CAP_08_S3_NEGATIVE_DB.ts',
    'ACCEPTANCE_MCFT_CAP_08_S3_EDGE_SEMANTICS_DB.ts',
    'mcft_cap08_s3_artifact_finalize.cjs',
  ]) assert.ok(focused.includes(token), `S3_FORMAL_FOCUSED_WORKFLOW_MISSING:${token}`);
  for (const token of [
    'ACCEPTANCE_MCFT_CAP_08_S3_EXACT_SHA_ATTESTATION.cjs',
    'ACCEPTANCE_MCFT_CAP_08_S3_BOUNDARY.cjs',
    'ACCEPTANCE_MCFT_CAP_08_S3_DECISION_ACTION_DB.ts',
    'ACCEPTANCE_MCFT_CAP_08_S3_COMPLETED_RERUN_NEGATIVE_DB.ts',
    'ACCEPTANCE_MCFT_CAP_08_S3_NEGATIVE_DB.ts',
    'ACCEPTANCE_MCFT_CAP_08_S3_EDGE_SEMANTICS_DB.ts',
    'mcft_cap08_s3_artifact_finalize.cjs',
    'mcft_attestation_retention_store_v1.cjs',
  ]) assert.ok(exact.includes(token), `S3_FORMAL_EXACT_WORKFLOW_MISSING:${token}`);

  const result = {
    schema_version: 'geox_mcft_cap08_s3_boundary_result_v2',
    status: 'PASS',
    classification: 'FORMAL_S3_CANDIDATE_MODE',
    base_sha: base,
    candidate_sha: git('rev-parse', 'HEAD'),
    candidate_tree_sha: git('rev-parse', 'HEAD^{tree}'),
    taskbook_blob_sha: taskbookBlob,
    machine_contract_digest: contract.semantic_digest,
    provider_contract_digest: implementation.formal_provider_contract_digest,
    changed_file_count: actual.length,
    changed_files: actual,
    source_manifest_file_count: implementation.source_manifest_file_count,
    frozen_predecessor_file_count: FROZEN_PREDECESSOR.length,
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
    schema_version: 'geox_mcft_cap08_s3_boundary_result_v2',
    status: 'FAIL',
    error: error instanceof Error ? error.message : String(error),
  });
  console.error(error);
  process.exitCode = 1;
}
