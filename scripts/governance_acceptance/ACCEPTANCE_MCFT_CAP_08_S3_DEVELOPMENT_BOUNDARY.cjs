#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const OUTPUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_08_S3_BOUNDARY_RESULT.json');
const TRUSTED_BASE = '13e3e1260c70b9c2b6dd1fd6b8d57fd50fb3202e';
const TASKBOOK = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-TASK.md';

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

  for (const required of [
    'apps/server/src/domain/twin_runtime/cap08_s3_completion_tuple_v1.ts',
    'apps/server/src/runtime/twin_runtime/cap08_s3_completion_evidence_tick_service_v1.ts',
    'apps/server/src/runtime/twin_runtime/cap08_s3_completion_tuple_service_v1.ts',
    'apps/server/src/runtime/twin_runtime/cap08_s3_outcome_completion_evidence_service_v1.ts',
    'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_08_S3_COMPLETED_RERUN_NEGATIVE_DB.ts',
    'scripts/runtime_acceptance/mcft_cap08_s3_source_manifest_v1.ts',
  ]) assert.ok(actual.includes(required), `S3_PREFLIGHT_REQUIRED_FILE_MISSING:${required}`);

  const result = {
    schema_version: 'geox_mcft_cap08_s3_development_boundary_result_v1',
    status: 'PASS',
    classification: 'DEVELOPMENT_PREFLIGHT_NOT_CANDIDATE',
    base_sha: base,
    head_sha: git('rev-parse', 'HEAD'),
    head_tree_sha: git('rev-parse', 'HEAD^{tree}'),
    taskbook_ref: TASKBOOK,
    taskbook_blob_sha: headTaskbookBlob,
    changed_file_count: actual.length,
    changed_files: actual,
    forbidden_file_count: 0,
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
    schema_version: 'geox_mcft_cap08_s3_development_boundary_result_v1',
    status: 'FAIL',
    error: error instanceof Error ? error.message : String(error),
  });
  console.error(error);
  process.exitCode = 1;
}
