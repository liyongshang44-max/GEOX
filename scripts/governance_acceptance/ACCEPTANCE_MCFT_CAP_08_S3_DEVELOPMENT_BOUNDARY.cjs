#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const OUTPUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_08_S3_BOUNDARY_RESULT.json');
const TRUSTED_BASE = 'cabd5fb171ffa24439a40dd27a3471de04049faf';
const TASKBOOK = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-TASK.md';
const STATUS = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S3-DELIVERY-STATUS-V1.json';

function git(...args) {
  return cp.execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}
function write(value) {
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify(value, null, 2)}\n`);
}
function changedFiles(base, head = 'HEAD') {
  const raw = git('diff', '--name-only', `${base}...${head}`);
  return raw ? raw.split(/\r?\n/).filter(Boolean).sort() : [];
}
function sha(value, code) {
  const text = String(value || '').trim();
  assert.match(text, /^[0-9a-f]{40}$/, code);
  return git('rev-parse', `${text}^{commit}`);
}

try {
  const base = sha(process.env.MCFT_BASE_SHA || TRUSTED_BASE, 'S3_PREFLIGHT_BASE_SHA_INVALID');
  assert.equal(base, TRUSTED_BASE, 'S3_PREFLIGHT_TRUSTED_BASE_MISMATCH');
  assert.equal(git('merge-base', base, 'HEAD'), base, 'S3_PREFLIGHT_BASE_NOT_ANCESTOR');
  assert.equal(git('diff', '--check', `${base}...HEAD`), '', 'S3_PREFLIGHT_DIFF_CHECK_FAILED');

  const baseTaskbookBlob = git('rev-parse', `${base}:${TASKBOOK}`);
  const headTaskbookBlob = git('rev-parse', `HEAD:${TASKBOOK}`);
  assert.equal(headTaskbookBlob, baseTaskbookBlob, 'S3_PREFLIGHT_TASKBOOK_BLOB_DRIFT');
  const status = JSON.parse(fs.readFileSync(path.join(ROOT, STATUS), 'utf8'));
  assert.equal(status.record_status, 'PRE_REGISTERED_SUCCESSOR_STATUS_SEED');
  assert.equal(status.s3_candidate_implemented, false, 'S3_PREFLIGHT_CANDIDATE_SIGNAL_FORBIDDEN');
  assert.equal(status.implementation_authorized, false);
  assert.equal(status.s3_effective, false);
  assert.equal(status.s4_authorized, false);

  const actual = changedFiles(base);
  assert.ok(actual.length > 0, 'S3_PREFLIGHT_EMPTY_CHANGESET');
  const forbidden = actual.filter((file) =>
    file.startsWith('apps/server/db/migrations/')
    || file.startsWith('apps/server/src/routes/')
    || file.startsWith('apps/web/')
    || file.startsWith('docker/postgres/init/')
    || file.includes('scheduler')
    || file.includes('model_activation'));
  assert.deepEqual(forbidden, [], 'S3_PREFLIGHT_FORBIDDEN_FILE_BOUNDARY');

  for (const formalOnly of [
    '.github/workflows/mcft-cap-08-s3-decision-action-feedback.yml',
    '.github/workflows/mcft-cap-08-s3-exact-sha-attestation.yml',
    'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S3-CANDIDATE-CHANGED-FILE-BOUNDARY-V1.json',
    'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S3-IMPLEMENTATION-V1.json',
    'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_08_S3_BOUNDARY.cjs',
    'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_08_S3_EXACT_SHA_ATTESTATION.cjs',
    'scripts/governance_acceptance/mcft_cap08_s3_artifact_finalize.cjs',
  ]) assert.equal(actual.includes(formalOnly), false, `S3_PREFLIGHT_FORMAL_ONLY_FILE_FORBIDDEN:${formalOnly}`);

  for (const required of [
    '.github/workflows/mcft-cap-08-s3-development-preflight.yml',
    'apps/server/src/domain/twin_runtime/cap08_s3_completion_authority_pair_contracts_v1.ts',
    'apps/server/src/domain/twin_runtime/cap08_s3_completion_tuple_v1.ts',
    'apps/server/src/persistence/twin_runtime/postgres_cap08_s3_completion_authority_pair_repository_v1.ts',
    'apps/server/src/runtime/twin_runtime/cap08_s3_completion_evidence_tick_service_v1.ts',
    'apps/server/src/runtime/twin_runtime/cap08_s3_completion_tuple_service_v1.ts',
    'apps/server/src/runtime/twin_runtime/cap08_s3_formal_range_service_v1.ts',
    'apps/server/src/runtime/twin_runtime/cap08_s3_outcome_completion_evidence_service_v1.ts',
    'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_08_S3_COMPLETED_RERUN_NEGATIVE_DB.ts',
    'scripts/runtime_acceptance/MCFT_CAP_08_S3_PREFLIGHT.ps1',
    'scripts/runtime_acceptance/mcft_cap08_s3_source_manifest_v1.ts',
  ]) assert.ok(actual.includes(required), `S3_PREFLIGHT_REQUIRED_FILE_MISSING:${required}`);

  const result = {
    schema_version: 'geox_mcft_cap08_s3_development_boundary_result_v3',
    status: 'PASS',
    classification: 'DEVELOPMENT_PREFLIGHT_NOT_CANDIDATE',
    base_sha: base,
    head_sha: git('rev-parse', 'HEAD'),
    head_tree_sha: git('rev-parse', 'HEAD^{tree}'),
    taskbook_ref: TASKBOOK,
    taskbook_blob_sha: headTaskbookBlob,
    status_ref: STATUS,
    changed_file_count: actual.length,
    changed_files: actual,
    forbidden_file_count: 0,
    formal_only_file_count: 0,
    candidate_signal_present: false,
    database_migration_delta: 0,
    business_schema_delta: 0,
    canonical_completion_tuple_fact_authorized: false,
    atomic_completion_authority_pair_required: true,
    normal_completed_rerun_repair_authorized: false,
    candidate_declaration_authorized: false,
    merge_authorized: false,
    production_runtime_source_authorized: false,
    s3_effective: false,
    s4_authorized: false,
  };
  write(result);
  console.log(JSON.stringify(result));
} catch (error) {
  write({
    schema_version: 'geox_mcft_cap08_s3_development_boundary_result_v3',
    status: 'FAIL',
    error: error instanceof Error ? error.message : String(error),
  });
  console.error(error);
  process.exitCode = 1;
}
