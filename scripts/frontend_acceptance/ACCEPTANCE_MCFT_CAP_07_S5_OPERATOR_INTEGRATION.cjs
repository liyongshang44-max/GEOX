#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const RESULT = path.join(ROOT, 'acceptance-output/MCFT_CAP_07_S5_OPERATOR_INTEGRATION_RESULT.json');
const HELPER = 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_07_POST_CLOSURE_SUCCESSOR_BOUNDARY.cjs';
const LEGACY_ACCEPTANCE_SOURCE_SHA = 'ade35875ff6f5ef92ec76f04ab9fc302c57f700e';
const SELF_PATH = 'scripts/frontend_acceptance/ACCEPTANCE_MCFT_CAP_07_S5_OPERATOR_INTEGRATION.cjs';

function git(args) {
  return cp.execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}

function runLegacy() {
  git(['cat-file', '-e', `${LEGACY_ACCEPTANCE_SOURCE_SHA}^{commit}`]);
  const source = git(['show', `${LEGACY_ACCEPTANCE_SOURCE_SHA}:${SELF_PATH}`]);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mcft-cap07-s5-legacy-'));
  const file = path.join(directory, 'ACCEPTANCE_MCFT_CAP_07_S5_OPERATOR_INTEGRATION.cjs');
  fs.writeFileSync(file, `${source}\n`);
  try {
    cp.execFileSync(process.execPath, [file], {
      cwd: ROOT,
      env: process.env,
      stdio: 'inherit',
    });
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

function runSuccessorBoundary() {
  const base = String(process.env.MCFT_BASE_SHA || '').trim();
  assert.match(base, /^[0-9a-f]{40}$/, 'MCFT_BASE_SHA_INVALID');
  const helper = path.join(ROOT, HELPER);
  const mode = cp.execFileSync(process.execPath, [helper, '--resolve-s5-mode'], {
    cwd: ROOT,
    env: process.env,
    encoding: 'utf8',
  }).trim();
  assert.notEqual(mode, 'LEGACY_S5_ACCEPTANCE_MODE', 'SUCCESSOR_WRAPPER_MODE_NOT_APPLICABLE');
  cp.execFileSync(process.execPath, [helper, '--accept-mode', mode], {
    cwd: ROOT,
    env: process.env,
    stdio: 'inherit',
  });
  const boundaryPath = path.join(ROOT, 'acceptance-output/MCFT_CAP_07_POST_CLOSURE_SUCCESSOR_BOUNDARY_RESULT.json');
  const boundary = JSON.parse(fs.readFileSync(boundaryPath, 'utf8'));
  assert.equal(boundary.status, 'PASS');
  const result = {
    ...boundary,
    schema_version: 'geox_mcft_cap_07_s5_operator_integration_result_v1',
    acceptance_mode: process.env.MCFT_S5_ACCEPTANCE_MODE || 'S6_SUCCESSOR_REGRESSION_MODE',
    successor_boundary_mode: mode,
    legacy_acceptance_source_sha: LEGACY_ACCEPTANCE_SOURCE_SHA,
  };
  fs.mkdirSync(path.dirname(RESULT), { recursive: true });
  fs.writeFileSync(RESULT, `${JSON.stringify(result, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

try {
  const requested = String(process.env.MCFT_S5_ACCEPTANCE_MODE || '').trim();
  if (requested === 'S6_SUCCESSOR_REGRESSION_MODE') runSuccessorBoundary();
  else runLegacy();
} catch (error) {
  const result = {
    schema_version: 'geox_mcft_cap_07_s5_operator_integration_result_v1',
    status: 'FAIL',
    acceptance_mode: String(process.env.MCFT_S5_ACCEPTANCE_MODE || ''),
    error: error instanceof Error ? error.message : String(error),
  };
  fs.mkdirSync(path.dirname(RESULT), { recursive: true });
  fs.writeFileSync(RESULT, `${JSON.stringify(result, null, 2)}\n`);
  console.error(result.error);
  process.exitCode = 1;
}
