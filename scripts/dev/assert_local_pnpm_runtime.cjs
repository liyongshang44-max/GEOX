#!/usr/bin/env node
'use strict';

// scripts/dev/assert_local_pnpm_runtime.cjs
// Purpose: prove S10 merged-main effectiveness at the exact implementation-plus-Gate-remediation main commit, then execute the permanent MCFT-CAP-05 Runtime regression chain from the proof-only checkout.
// Boundary: validation-only probe; this file is the sole allowed PR delta and the probe must be closed without merge.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const S9_SETTLEMENT_BASELINE = '679a1442cc130c174951eb0330b0c82592e4a6df';
const S10_IMPLEMENTATION_EXACT_HEAD = '2b22e209472237f198fc52fc103d5401fac9c28a';
const S10_IMPLEMENTATION_MERGE = '9acfab667ea51d812fd9f644c0f6634b0e45a673';
const S10_GATE_REMEDIATION_EXACT_HEAD = 'a70ee127d14c7939ba2ef756c56c580520379826';
const S10_EFFECTIVE_MAIN = '0c015bad3eb1729000d7f68eb08e00de6ef4afcf';
const PROBE_BRANCH = 'ci/mcft-cap-05-s10-merged-main-probe';
const PROBE_FILE = 'scripts/dev/assert_local_pnpm_runtime.cjs';
const S10_GATE = 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S10_BOUNDED_EIGHT_TICK_FEEDBACK_CHAIN.cjs';
const S10_RUNTIME_ACCEPTANCE = 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_BOUNDED_EIGHT_TICK_FEEDBACK_CHAIN.ts';
const EXPECTED_S10_FILES = [
  'apps/server/scripts/mcft/MCFT_CAP_05_HUMAN_DECISION_FEEDBACK_RUNNER.ts',
  'apps/server/src/runtime/twin_runtime/bounded_feedback_chain_service_v1.ts',
  'apps/server/src/runtime/twin_runtime/effective_feedback_runtime_config_v1.ts',
  'docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S10-BOUNDED-EIGHT-TICK-FEEDBACK-CHAIN.md',
  'docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S10-STATUS.json',
  'scripts/dev/assert_local_pnpm_runtime.cjs',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S10_BOUNDED_EIGHT_TICK_FEEDBACK_CHAIN.cjs',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_BOUNDED_EIGHT_TICK_FEEDBACK_CHAIN.ts',
].sort();

function run(command, args = [], cwd = process.cwd()) {
  const result = spawnSync(command, args, {
    cwd,
    env: process.env,
    encoding: 'utf8',
    shell: false,
    maxBuffer: 256 * 1024 * 1024,
  });
  return {
    command: [command, ...args].join(' '),
    status: result.status,
    error: result.error ? String(result.error.message || result.error) : '',
    stdout: String(result.stdout || '').trim(),
    stderr: String(result.stderr || '').trim(),
  };
}

function requireSuccess(result) {
  if (result.stdout) console.log(result.stdout);
  if (result.stderr) console.error(result.stderr);
  if (result.status !== 0) {
    throw new Error(`COMMAND_FAILED:${result.command}:${String(result.status)}:${result.error}`);
  }
  return result.stdout;
}

function exactChangedFiles(base, head) {
  const output = requireSuccess(run('git', ['diff', '--name-only', base, head]));
  return output.split(/\r?\n/).filter(Boolean).sort();
}

function fetchLockedRefs() {
  requireSuccess(run('git', [
    'fetch',
    '--no-tags',
    '--depth=3',
    'origin',
    '+refs/heads/main:refs/remotes/origin/main',
    '+refs/pull/2483/head:refs/remotes/pull/2483/head',
    '+refs/pull/2484/head:refs/remotes/pull/2484/head',
    `+refs/heads/${PROBE_BRANCH}:refs/remotes/origin/${PROBE_BRANCH}`,
  ]));
}

function proveLockedIdentitiesAndTrees() {
  fetchLockedRefs();
  assert.equal(
    requireSuccess(run('git', ['rev-parse', 'refs/remotes/pull/2483/head'])),
    S10_IMPLEMENTATION_EXACT_HEAD,
    'S10 implementation exact head moved',
  );
  assert.equal(
    requireSuccess(run('git', ['rev-parse', 'refs/remotes/pull/2484/head'])),
    S10_GATE_REMEDIATION_EXACT_HEAD,
    'S10 Gate remediation exact head moved',
  );
  assert.equal(
    requireSuccess(run('git', ['rev-parse', 'origin/main'])),
    S10_EFFECTIVE_MAIN,
    'main moved after the locked S10 Gate remediation merge',
  );
  assert.deepEqual(
    exactChangedFiles(S10_IMPLEMENTATION_EXACT_HEAD, S10_IMPLEMENTATION_MERGE),
    [],
    'S10 implementation exact head and merge commit must be file-tree equivalent',
  );
  assert.deepEqual(
    exactChangedFiles(S10_GATE_REMEDIATION_EXACT_HEAD, S10_EFFECTIVE_MAIN),
    [],
    'S10 Gate remediation exact head and merge commit must be file-tree equivalent',
  );
  assert.deepEqual(
    exactChangedFiles(S9_SETTLEMENT_BASELINE, S10_EFFECTIVE_MAIN),
    EXPECTED_S10_FILES,
    'effective main must retain the exact eight-file S10 implementation boundary',
  );
  assert.deepEqual(
    exactChangedFiles(S10_EFFECTIVE_MAIN, `origin/${PROBE_BRANCH}`),
    [PROBE_FILE],
    'probe must differ from effective main by exactly one validation wrapper',
  );
}

function runPostmergeGateAtEffectiveMain() {
  const worktreePath = fs.mkdtempSync(path.join(os.tmpdir(), 'geox-s10-effective-main-'));
  let worktreeAdded = false;
  try {
    requireSuccess(run('git', ['worktree', 'add', '--detach', worktreePath, S10_EFFECTIVE_MAIN]));
    worktreeAdded = true;
    requireSuccess(run(process.execPath, [S10_GATE, '--postmerge'], worktreePath));
  } finally {
    if (worktreeAdded) {
      requireSuccess(run('git', ['worktree', 'remove', '--force', worktreePath]));
    } else {
      fs.rmSync(worktreePath, { recursive: true, force: true });
    }
  }
}

function runPermanentAcceptanceWithoutProbeBoundaryReassertion() {
  const original = requireSuccess(run('git', ['show', `${S10_EFFECTIVE_MAIN}:${PROBE_FILE}`]));
  const originalCall = 'runCap05S10BoundedFeedbackChainAcceptance();';
  assert.equal(original.split(originalCall).length, 2, 'effective wrapper must contain exactly one S10 acceptance call');
  const replacement = [
    "requireSuccess(run(isWindows ? 'pnpm.cmd' : 'pnpm', [",
    "  '-w', 'exec', 'tsx', 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_BOUNDED_EIGHT_TICK_FEEDBACK_CHAIN.ts',",
    ']));',
  ].join('\n');
  const transformed = original.replace(originalCall, replacement);
  const temporaryPath = path.join(
    process.cwd(),
    'acceptance-output',
    'MCFT_CAP_05_S10_EFFECTIVE_MAIN_ORIGINAL_WRAPPER.cjs',
  );
  fs.mkdirSync(path.dirname(temporaryPath), { recursive: true });
  fs.writeFileSync(temporaryPath, transformed, 'utf8');
  try {
    requireSuccess(run(process.execPath, [temporaryPath]));
  } finally {
    fs.rmSync(temporaryPath, { force: true });
  }
}

function main() {
  proveLockedIdentitiesAndTrees();
  runPostmergeGateAtEffectiveMain();
  runPermanentAcceptanceWithoutProbeBoundaryReassertion();
  console.log(JSON.stringify({
    ok: true,
    proof: 'MCFT_CAP_05_S10_MERGED_MAIN_EFFECTIVE',
    implementation_exact_head: S10_IMPLEMENTATION_EXACT_HEAD,
    implementation_merge: S10_IMPLEMENTATION_MERGE,
    gate_remediation_exact_head: S10_GATE_REMEDIATION_EXACT_HEAD,
    effective_main: S10_EFFECTIVE_MAIN,
    implementation_head_to_merge_file_delta_count: 0,
    gate_remediation_head_to_merge_file_delta_count: 0,
    effective_main_s10_file_count: EXPECTED_S10_FILES.length,
    probe_file_count: 1,
    postmerge_gate: 'PASS',
    runtime_regression_chain: 'PASS',
    disposition: 'CLOSE_WITHOUT_MERGE',
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
}
