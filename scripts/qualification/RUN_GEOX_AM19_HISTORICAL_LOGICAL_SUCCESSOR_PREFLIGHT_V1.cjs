#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const CONTRACT_REF = 'scripts/qualification/contracts/MCFT_CAP09_AM19_PERSISTENT_24T_HISTORICAL_LOGICAL_V1.json';
const PROFILE_REF = 'scripts/qualification/contracts/MCFT_CAP09_AM19_HISTORICAL_LOGICAL_SUCCESSOR_PROFILE_V1.json';
const BINDING_REF = 'scripts/qualification/contracts/MCFT_CAP09_AM19_HISTORICAL_LOGICAL_SUCCESSOR_RECONCILIATION_BINDINGS_V1.json';
const VERIFIER_REF = 'scripts/qualification/VERIFY_GEOX_AM19_HISTORICAL_LOGICAL_SUCCESSOR_RECONCILIATION_V1.cjs';
const RUNNER_REF = 'scripts/qualification/RUN_GEOX_AM19_HISTORICAL_LOGICAL_SUCCESSOR_V1.cjs';
const CONTRACT_ID = 'MCFT_CAP09_AM19_PERSISTENT_24T_HISTORICAL_LOGICAL_V1';
const PROFILE_ID = 'MCFT_CAP09_AM19_HISTORICAL_LOGICAL_SUCCESSOR_PROFILE_V1';
const BINDING_ID = 'MCFT_CAP09_AM19_HISTORICAL_LOGICAL_SUCCESSOR_RECONCILIATION_BINDINGS_V1';

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8', windowsHide: true }).trim();
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function runNodeJson(repoRoot, scriptRef, args = []) {
  const script = path.resolve(repoRoot, scriptRef);
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`AM19_SUCCESSOR_PREFLIGHT_CHILD_FAILED:${scriptRef}:${String(result.stdout || result.stderr || '').trim()}`);
  }
  try {
    return JSON.parse(String(result.stdout || ''));
  } catch {
    throw new Error(`AM19_SUCCESSOR_PREFLIGHT_CHILD_JSON_INVALID:${scriptRef}`);
  }
}

function syntaxCheck(repoRoot, scriptRef) {
  const result = spawnSync(process.execPath, ['--check', path.resolve(repoRoot, scriptRef)], {
    cwd: repoRoot,
    encoding: 'utf8',
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`AM19_SUCCESSOR_PREFLIGHT_SYNTAX_FAILED:${scriptRef}:${String(result.stderr || '').trim()}`);
}

function main() {
  if (String(process.env.GITHUB_ACTIONS || '').toLowerCase() === 'true') {
    throw new Error('AM19_SUCCESSOR_PREFLIGHT_GITHUB_ACTIONS_FORBIDDEN');
  }

  const repoRoot = git('rev-parse', '--show-toplevel');
  const subject = git('rev-parse', 'HEAD');
  assert.match(subject, /^[0-9a-f]{40}$/, 'AM19_SUCCESSOR_PREFLIGHT_SUBJECT_SHA_REQUIRED');
  assert.equal(git('status', '--porcelain'), '', 'AM19_SUCCESSOR_PREFLIGHT_DIRTY_WORKTREE_FORBIDDEN');

  const contract = readJson(path.resolve(repoRoot, CONTRACT_REF));
  const profile = readJson(path.resolve(repoRoot, PROFILE_REF));
  const binding = readJson(path.resolve(repoRoot, BINDING_REF));
  assert.equal(contract.contract_id, CONTRACT_ID, 'AM19_SUCCESSOR_PREFLIGHT_CONTRACT_ID_REQUIRED');
  assert.equal(profile.profile_id, PROFILE_ID, 'AM19_SUCCESSOR_PREFLIGHT_PROFILE_ID_REQUIRED');
  assert.equal(binding.binding_id, BINDING_ID, 'AM19_SUCCESSOR_PREFLIGHT_BINDING_ID_REQUIRED');
  assert.equal(contract.successor_profile_ref, PROFILE_REF, 'AM19_SUCCESSOR_PREFLIGHT_PROFILE_REF_MISMATCH');
  assert.equal(contract.design_reconciliation_binding_ref, BINDING_REF, 'AM19_SUCCESSOR_PREFLIGHT_CONTRACT_BINDING_REF_MISMATCH');
  assert.equal(profile.design_reconciliation_binding_ref, BINDING_REF, 'AM19_SUCCESSOR_PREFLIGHT_PROFILE_BINDING_REF_MISMATCH');
  assert.equal(contract.reconciliation_verifier_ref, VERIFIER_REF, 'AM19_SUCCESSOR_PREFLIGHT_VERIFIER_REF_MISMATCH');
  assert.equal(contract.qualification_runner_ref, RUNNER_REF, 'AM19_SUCCESSOR_PREFLIGHT_RUNNER_REF_MISMATCH');
  assert.equal(contract.current_admission_route, 'HISTORICAL_LOGICAL_SUCCESSOR_V1', 'AM19_SUCCESSOR_PREFLIGHT_ROUTE_REQUIRED');
  assert.equal(binding.admission_route, 'HISTORICAL_LOGICAL_SUCCESSOR_V1', 'AM19_SUCCESSOR_PREFLIGHT_BINDING_ROUTE_REQUIRED');
  assert.equal(contract.current_2026_crop_window_status, 'CLOSED_NO_RETRY_NO_RECAPTURE_NO_BYPASS', 'AM19_SUCCESSOR_PREFLIGHT_CURRENT_CROP_WINDOW_MUST_REMAIN_CLOSED');
  assert.equal(contract.legacy_controlled_capture_required_for_current_admission, false, 'AM19_SUCCESSOR_PREFLIGHT_LEGACY_CAPTURE_NOT_REQUIRED');
  assert.equal(contract.legacy_controlled_capture_reactivation_authorized, false, 'AM19_SUCCESSOR_PREFLIGHT_LEGACY_CAPTURE_REACTIVATION_FORBIDDEN');
  assert.equal(binding.execution_gate.qualification_execution_allowed_before_static_reconciliation_pass, false, 'AM19_SUCCESSOR_PREFLIGHT_EXECUTION_BEFORE_RECONCILIATION_FORBIDDEN');
  assert.equal(binding.execution_gate.required_static_blocker_count, 0, 'AM19_SUCCESSOR_PREFLIGHT_ZERO_STATIC_BLOCKERS_REQUIRED');

  syntaxCheck(repoRoot, VERIFIER_REF);
  syntaxCheck(repoRoot, RUNNER_REF);

  const reconciliation = runNodeJson(repoRoot, VERIFIER_REF);
  assert.equal(reconciliation.status, 'PASS', 'AM19_SUCCESSOR_PREFLIGHT_RECONCILIATION_PASS_REQUIRED');
  assert.equal(reconciliation.blocker_count, 0, 'AM19_SUCCESSOR_PREFLIGHT_RECONCILIATION_ZERO_BLOCKERS_REQUIRED');
  assert.equal(reconciliation.design_reconciliation_binding_id, BINDING_ID, 'AM19_SUCCESSOR_PREFLIGHT_RECONCILIATION_BINDING_MISMATCH');
  assert.equal(reconciliation.package_binding, 'PASS', 'AM19_SUCCESSOR_PREFLIGHT_PACKAGE_BINDING_PASS_REQUIRED');
  assert.equal(reconciliation.verifier_1_binding, 'PASS', 'AM19_SUCCESSOR_PREFLIGHT_VERIFIER1_BINDING_PASS_REQUIRED');
  assert.equal(reconciliation.verifier_2_binding, 'PASS', 'AM19_SUCCESSOR_PREFLIGHT_VERIFIER2_BINDING_PASS_REQUIRED');
  assert.equal(reconciliation.qcp_binding, 'PASS', 'AM19_SUCCESSOR_PREFLIGHT_QCP_BINDING_PASS_REQUIRED');
  assert.equal(reconciliation.closure_binding, 'PASS', 'AM19_SUCCESSOR_PREFLIGHT_CLOSURE_BINDING_PASS_REQUIRED');
  assert.equal(reconciliation.legacy_qcp_check_current_admission, false, 'AM19_SUCCESSOR_PREFLIGHT_LEGACY_QCP_CURRENT_ADMISSION_FORBIDDEN');
  assert.equal(reconciliation.current_successor_qcp_registered, false, 'AM19_SUCCESSOR_PREFLIGHT_PREMATURE_QCP_REGISTRATION_FORBIDDEN');
  assert.equal(reconciliation.static_reconciliation_complete, true, 'AM19_SUCCESSOR_PREFLIGHT_FULL_STATIC_RECONCILIATION_REQUIRED');
  assert.equal(reconciliation.qualification_execution_performed, false, 'AM19_SUCCESSOR_PREFLIGHT_RECONCILIATION_STATIC_REQUIRED');
  assert.equal(reconciliation.database_access, false, 'AM19_SUCCESSOR_PREFLIGHT_RECONCILIATION_DATABASE_ACCESS_FORBIDDEN');
  assert.equal(reconciliation.provider_access, false, 'AM19_SUCCESSOR_PREFLIGHT_RECONCILIATION_PROVIDER_ACCESS_FORBIDDEN');

  const runnerSelftest = runNodeJson(repoRoot, RUNNER_REF, [
    'selftest',
    '--contract', CONTRACT_REF,
    '--subject', subject,
    '--runtime', contract.frozen_runtime_sha,
    '--postgres-image', contract.execution_postgres_image,
  ]);
  assert.equal(runnerSelftest.status, 'PASS', 'AM19_SUCCESSOR_PREFLIGHT_RUNNER_SELFTEST_PASS_REQUIRED');
  assert.equal(runnerSelftest.contract_id, CONTRACT_ID, 'AM19_SUCCESSOR_PREFLIGHT_RUNNER_CONTRACT_MISMATCH');
  assert.equal(runnerSelftest.successor_profile_id, PROFILE_ID, 'AM19_SUCCESSOR_PREFLIGHT_RUNNER_PROFILE_MISMATCH');
  assert.equal(runnerSelftest.current_admission_route, 'HISTORICAL_LOGICAL_SUCCESSOR_V1', 'AM19_SUCCESSOR_PREFLIGHT_RUNNER_ROUTE_MISMATCH');
  assert.equal(runnerSelftest.reconciliation_status, 'PASS', 'AM19_SUCCESSOR_PREFLIGHT_RUNNER_RECONCILIATION_PASS_REQUIRED');
  assert.equal(runnerSelftest.reconciliation_blocker_count, 0, 'AM19_SUCCESSOR_PREFLIGHT_RUNNER_RECONCILIATION_ZERO_BLOCKERS_REQUIRED');
  assert.equal(runnerSelftest.database_access, false, 'AM19_SUCCESSOR_PREFLIGHT_RUNNER_DATABASE_ACCESS_FORBIDDEN');
  assert.equal(runnerSelftest.provider_access, false, 'AM19_SUCCESSOR_PREFLIGHT_RUNNER_PROVIDER_ACCESS_FORBIDDEN');

  process.stdout.write(`${JSON.stringify({
    schema_version: 'geox_mcft_cap09_am19_historical_logical_successor_preflight_v1',
    status: 'PASS',
    blocker_count: 0,
    subject_sha: subject,
    contract_id: CONTRACT_ID,
    profile_id: PROFILE_ID,
    design_reconciliation_binding_id: BINDING_ID,
    current_admission_route: 'HISTORICAL_LOGICAL_SUCCESSOR_V1',
    reconciliation_status: reconciliation.status,
    package_binding: reconciliation.package_binding,
    verifier_1_binding: reconciliation.verifier_1_binding,
    verifier_2_binding: reconciliation.verifier_2_binding,
    qcp_binding: reconciliation.qcp_binding,
    closure_binding: reconciliation.closure_binding,
    legacy_qcp_check_current_admission: reconciliation.legacy_qcp_check_current_admission,
    current_successor_qcp_registered: reconciliation.current_successor_qcp_registered,
    static_reconciliation_complete: reconciliation.static_reconciliation_complete,
    runner_selftest_status: runnerSelftest.status,
    current_2026_crop_window_status: contract.current_2026_crop_window_status,
    legacy_controlled_capture_required_for_current_admission: false,
    qualification_execution_performed: false,
    database_access: false,
    provider_access: false,
    production_mutation: false,
    formal_v5_arm: false,
    a0: false,
    o00_o23: false,
    admitted_to_fresh_historical_successor_13_of_13: true
  }, null, 2)}\n`);
}

try {
  main();
} catch (error) {
  process.stdout.write(`${JSON.stringify({
    schema_version: 'geox_mcft_cap09_am19_historical_logical_successor_preflight_v1',
    status: 'FAIL',
    blocker_count: 1,
    error: error && error.message ? error.message : String(error),
    static_reconciliation_complete: false,
    qualification_execution_performed: false,
    database_access: false,
    provider_access: false,
    production_mutation: false,
    admitted_to_fresh_historical_successor_13_of_13: false
  }, null, 2)}\n`);
  process.exitCode = 1;
}
