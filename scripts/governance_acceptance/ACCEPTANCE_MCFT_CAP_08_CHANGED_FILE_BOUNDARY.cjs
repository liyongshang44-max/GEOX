#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const MANIFEST_PATH = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-CHANGED-FILE-BOUNDARY-V1.json';
const RESULT_PATH = path.join(ROOT, 'acceptance-output/MCFT_CAP_08_CHANGED_FILE_BOUNDARY_RESULT.json');
const DEFAULT_BASE_SHA = 'dfda2dd55e140313598dbc2fcbc9176c8891f465';

function git(args) {
  return cp.execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}

function writeResult(result) {
  fs.mkdirSync(path.dirname(RESULT_PATH), { recursive: true });
  fs.writeFileSync(RESULT_PATH, `${JSON.stringify(result, null, 2)}\n`);
}

try {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, MANIFEST_PATH), 'utf8'));
  const baseSha = String(process.env.MCFT_BASE_SHA || DEFAULT_BASE_SHA).trim();
  assert.match(baseSha, /^[0-9a-f]{40}$/, 'BOUNDARY_BASE_SHA_INVALID');
  assert.equal(baseSha, manifest.base_sha, 'BOUNDARY_BASE_SHA_MISMATCH');
  git(['cat-file', '-e', `${baseSha}^{commit}`]);

  const diff = git(['diff', '--name-only', `${baseSha}...HEAD`]);
  const actual = diff ? diff.split(/\r?\n/).filter(Boolean).sort() : [];
  const expected = [...manifest.changed_files].sort();
  assert.deepEqual(actual, expected, 'CHANGED_FILE_BOUNDARY_MISMATCH');
  assert.equal(new Set(actual).size, actual.length, 'CHANGED_FILE_BOUNDARY_DUPLICATE');

  const forbiddenPrefixes = [
    'apps/web/src/',
    'apps/server/src/domain/',
    'apps/server/src/runtime/',
    'apps/server/src/routes/',
    'apps/server/db/migrations/',
    '.github/workflows/mcft-cap-07-',
  ];
  for (const file of actual) {
    for (const prefix of forbiddenPrefixes) {
      assert.equal(file.startsWith(prefix), false, `FORBIDDEN_CHANGED_FILE_PREFIX:${prefix}:${file}`);
    }
  }

  const result = {
    schema_version: 'geox_mcft_cap_08_changed_file_boundary_result_v1',
    status: 'PASS',
    base_sha: baseSha,
    head_sha: git(['rev-parse', 'HEAD']),
    changed_file_count: actual.length,
    changed_files: actual,
    runtime_domain_code_delta: 0,
    business_schema_migration_delta: 0,
    cap07_workflow_delta: 0,
  };
  writeResult(result);
  process.stdout.write(`${JSON.stringify(result)}\n`);
} catch (error) {
  const result = {
    schema_version: 'geox_mcft_cap_08_changed_file_boundary_result_v1',
    status: 'FAIL',
    error: error instanceof Error ? error.message : String(error),
  };
  writeResult(result);
  console.error(result.error);
  process.exitCode = 1;
}
