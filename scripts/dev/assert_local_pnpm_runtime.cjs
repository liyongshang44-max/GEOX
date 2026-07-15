#!/usr/bin/env node
'use strict';

// scripts/dev/assert_local_pnpm_runtime.cjs
// Purpose: prove merged-main effectiveness of the bounded MCFT-CAP-05 S9 restart, response-loss, late-receipt and support-rebuild implementation.
// Boundary: validation-only one-file probe; this file must never be merged.
// MCFT_CAP_05_S9_RESTART_LATE_RECEIPT_REBUILD_GATE_V1
// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S9_RESTART_LATE_RECEIPT_REBUILD.cjs
// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_S9_RESTART_LATE_RECEIPT_REBUILD_DB.ts
// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_ASSIMILATED_PERSISTENCE_RECOVERY_DB.ts

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const IMPLEMENTATION_BRANCH = 'agent/mcft-cap-05-s9-restart-late-receipt-rebuild-v1';
const EXACT_HEAD = 'cfe0766d474c0e0a37f38fbe2166fcac79ff96de';
const MERGED_MAIN = '07485e93ab17c5a4f9dc057f6c79e190a38d425f';
const PROBE_FILE = 'scripts/dev/assert_local_pnpm_runtime.cjs';
const diagnosticPath = path.join(process.cwd(), 'acceptance-output', 'MCFT_CAP_05_S9_MERGED_MAIN_EFFECTIVENESS_PROBE.log');
const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

function run(command, args = [], envOverrides = {}, cwd = process.cwd()) {
  const result = spawnSync(command, args, {
    cwd,
    env: {
      ...process.env,
      CI: process.env.CI || 'true',
      npm_config_confirmModulesPurge: 'false',
      npm_config_confirm_modules_purge: 'false',
      ...envOverrides,
    },
    encoding: 'utf8',
    shell: false,
    maxBuffer: 256 * 1024 * 1024,
  });
  const record = `\n$ ${[command, ...args].join(' ')}\ncwd=${cwd}\nstatus=${String(result.status)}\n${result.stdout || ''}\n${result.stderr || ''}\n`;
  fs.mkdirSync(path.dirname(diagnosticPath), { recursive: true });
  fs.appendFileSync(diagnosticPath, record, 'utf8');
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) throw new Error(`COMMAND_FAILED:${command}:${String(result.status)}`);
  return String(result.stdout || '').trim();
}

function databaseUrl(base, databaseName) {
  const url = new URL(base);
  url.pathname = `/${databaseName}`;
  return url.toString();
}

function postgresBaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (!process.env.POSTGRES_USER || !process.env.POSTGRES_PASSWORD || !process.env.POSTGRES_DB) return null;
  const host = process.env.POSTGRES_HOST || '127.0.0.1';
  const port = process.env.POSTGRES_PORT || '5433';
  return `postgres://${encodeURIComponent(process.env.POSTGRES_USER)}:${encodeURIComponent(process.env.POSTGRES_PASSWORD)}@${host}:${port}/${encodeURIComponent(process.env.POSTGRES_DB)}`;
}

function recreateDatabase(base, databaseName) {
  const admin = databaseUrl(base, 'postgres');
  run('psql', [admin, '-v', 'ON_ERROR_STOP=1', '-c', `DROP DATABASE IF EXISTS ${databaseName} WITH (FORCE)`]);
  run('psql', [admin, '-v', 'ON_ERROR_STOP=1', '-c', `CREATE DATABASE ${databaseName}`]);
}

function tsx(script, envOverrides = {}) {
  run(pnpmCommand, ['-w', 'exec', 'tsx', script], envOverrides);
}

function databaseAcceptance(base, databaseName, script, envOverrides) {
  recreateDatabase(base, databaseName);
  tsx(script, {
    DATABASE_URL: databaseUrl(base, databaseName),
    ...envOverrides,
  });
}

function exactChangedFiles(base, head) {
  return run('git', ['diff', '--name-only', `${base}..${head}`])
    .split(/\r?\n/)
    .filter(Boolean)
    .sort();
}

run('git', ['fetch', '--no-tags', 'origin', `refs/heads/${IMPLEMENTATION_BRANCH}:refs/remotes/origin/${IMPLEMENTATION_BRANCH}`, 'refs/heads/main:refs/remotes/origin/main']);
assert.equal(run('git', ['rev-parse', `refs/remotes/origin/${IMPLEMENTATION_BRANCH}`]), EXACT_HEAD);
run('git', ['merge-base', '--is-ancestor', MERGED_MAIN, 'refs/remotes/origin/main']);
assert.deepEqual(exactChangedFiles(EXACT_HEAD, MERGED_MAIN), []);
assert.deepEqual(exactChangedFiles(MERGED_MAIN, 'HEAD'), [PROBE_FILE]);
run(pnpmCommand, ['--version']);

const worktreePath = fs.mkdtempSync(path.join(os.tmpdir(), 'geox-cap05-s9-effective-'));
try {
  run('git', ['worktree', 'add', '--detach', worktreePath, MERGED_MAIN]);
  run(process.execPath, [
    'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S9_RESTART_LATE_RECEIPT_REBUILD.cjs',
    '--auto',
  ], {}, worktreePath);
} finally {
  run('git', ['worktree', 'remove', '--force', worktreePath]);
}

tsx('scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_RECEIPT_CONSUMING_TICK.ts');
tsx('scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_NOT_YET_VALIDATED_RECEIPT_CONSUMING_TICK.ts');
tsx('scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_SINGLE_TICK_INTEGRATION.ts');
tsx('scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_CONTRACTS_PROJECTION_CONFIG.ts');
tsx('scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_S8_RESIDUAL_CONTRACT_CONFORMANCE.ts');
tsx('scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_FORECAST_RESIDUAL_OUTCOME_TICK.ts');

const base = postgresBaseUrl();
if (base && process.env.CI === 'true') {
  databaseAcceptance(
    base,
    'mcft_cap05_s9_probe_s6',
    'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_ACTION_FEEDBACK_H_DB.ts',
    { MCFT_CAP_05_S6_DESTRUCTIVE_ACCEPTANCE: '1' },
  );
  databaseAcceptance(
    base,
    'mcft_cap05_s9_probe_s7',
    'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_RECEIPT_CONSUMING_TICK_DB.ts',
    { MCFT_CAP_05_S7_DESTRUCTIVE_ACCEPTANCE: '1' },
  );
  databaseAcceptance(
    base,
    'mcft_cap05_s9_probe_cap05_recovery',
    'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_PERSISTENCE_RECOVERY_DB.ts',
    { MCFT_CAP_05_S3_DESTRUCTIVE_ACCEPTANCE: '1' },
  );
  databaseAcceptance(
    base,
    'mcft_cap05_s9_probe_s8',
    'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_FORECAST_RESIDUAL_OUTCOME_TICK_DB.ts',
    { MCFT_CAP_05_S8_DESTRUCTIVE_ACCEPTANCE: '1' },
  );
  databaseAcceptance(
    base,
    'mcft_cap05_s9_probe_runtime',
    'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_S9_RESTART_LATE_RECEIPT_REBUILD_DB.ts',
    { MCFT_CAP_05_S9_DESTRUCTIVE_ACCEPTANCE: '1' },
  );
  databaseAcceptance(
    base,
    'mcft_cap03_s3b_cap05_s9_probe',
    'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_ASSIMILATED_PERSISTENCE_RECOVERY_DB.ts',
    { MCFT_CAP_03_S3B_DESTRUCTIVE_ACCEPTANCE: '1' },
  );
}

console.log(JSON.stringify({
  ok: true,
  result: 'MCFT_CAP_05_S9_MERGED_MAIN_EFFECTIVE',
  implementation_head: EXACT_HEAD,
  merge_commit: MERGED_MAIN,
  tree_equivalence: 'PASS',
  probe_delta: [PROBE_FILE],
  probe_must_never_merge: true,
  s10_authorized: false,
  cap_06_authorized: false,
}, null, 2));
