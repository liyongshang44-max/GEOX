#!/usr/bin/env node
'use strict';

// scripts/dev/assert_local_pnpm_runtime.cjs
// Purpose: prove merged-main effectiveness of MCFT-CAP-05 S8 Forecast Residual Runtime.
// Boundary: validation-only probe; this file must never be merged.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const IMPLEMENTATION_BRANCH = 'agent/mcft-cap-05-s8-forecast-residual-c-commit-v1';
const EXACT_HEAD = '172ee2ac2e306b7e04f2db7d05a3163f881b490a';
const MERGED_MAIN = '0610ed542067e699b7dd9828199661f12e1cdbde';
const PROBE_FILES = ['scripts/dev/assert_local_pnpm_runtime.cjs'];
const DIAGNOSTIC = path.join(process.cwd(), 'acceptance-output', 'MCFT_CAP_05_S8_MERGED_MAIN_PROBE.log');
const PNPM = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

function run(command, args = [], envOverrides = {}) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      CI: process.env.CI || 'true',
      npm_config_confirmModulesPurge: process.env.npm_config_confirmModulesPurge || 'false',
      npm_config_confirm_modules_purge: process.env.npm_config_confirm_modules_purge || 'false',
      ...envOverrides,
    },
    encoding: 'utf8',
    shell: false,
    stdio: 'pipe',
    maxBuffer: 256 * 1024 * 1024,
  });
  fs.mkdirSync(path.dirname(DIAGNOSTIC), { recursive: true });
  fs.appendFileSync(
    DIAGNOSTIC,
    `\n$ ${command} ${args.join(' ')}\nstatus=${String(result.status)}\n${result.stdout || ''}\n${result.stderr || ''}\n`,
    'utf8',
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`COMMAND_FAILED:${command} ${args.join(' ')}\n${result.stdout || ''}\n${result.stderr || ''}`);
  }
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  return String(result.stdout || '').trim();
}

function baseDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const user = process.env.POSTGRES_USER;
  const password = process.env.POSTGRES_PASSWORD;
  const database = process.env.POSTGRES_DB;
  if (!user || !password || !database) throw new Error('POSTGRES_ACCEPTANCE_ENV_REQUIRED_FOR_S8_MERGED_MAIN_PROBE');
  const host = process.env.POSTGRES_HOST || '127.0.0.1';
  const port = process.env.POSTGRES_PORT || '5433';
  return `postgres://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${encodeURIComponent(database)}`;
}

function databaseUrl(databaseName) {
  const value = new URL(baseDatabaseUrl());
  value.pathname = `/${databaseName}`;
  return value.toString();
}

function recreateDatabase(databaseName) {
  const admin = databaseUrl('postgres');
  run('psql', [admin, '-v', 'ON_ERROR_STOP=1', '-c', `DROP DATABASE IF EXISTS ${databaseName} WITH (FORCE)`]);
  run('psql', [admin, '-v', 'ON_ERROR_STOP=1', '-c', `CREATE DATABASE ${databaseName}`]);
}

function runTsx(file, env = {}) {
  run(PNPM, ['-w', 'exec', 'tsx', file], env);
}

function runDatabaseAcceptance(databaseName, file, env) {
  recreateDatabase(databaseName);
  runTsx(file, { ...env, DATABASE_URL: databaseUrl(databaseName) });
}

function main() {
  run('git', ['fetch', 'origin', 'main', IMPLEMENTATION_BRANCH]);
  const remoteHead = run('git', ['rev-parse', `origin/${IMPLEMENTATION_BRANCH}`]);
  const remoteMain = run('git', ['rev-parse', 'origin/main']);
  assert.equal(remoteHead, EXACT_HEAD, 'S8 implementation branch moved after exact-head lock');
  assert.equal(remoteMain, MERGED_MAIN, 'main moved after S8 merge lock');

  const treeDelta = run('git', ['diff', '--name-only', `${EXACT_HEAD}..${MERGED_MAIN}`]);
  assert.equal(treeDelta, '', 'S8 exact head and merge commit must be tree-equivalent');
  const probeDelta = run('git', ['diff', '--name-only', `${MERGED_MAIN}..HEAD`])
    .split(/\r?\n/)
    .filter(Boolean)
    .sort();
  assert.deepEqual(probeDelta, PROBE_FILES, 'probe must differ from merged main by exactly one validation-only wrapper');
  console.log(`PASS S8 merged-main identity ${MERGED_MAIN}`);
  console.log(`PASS S8 exact-head-to-merge tree equivalence ${EXACT_HEAD}`);

  run(PNPM, ['--version']);
  run('node', ['scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S8_FORECAST_RESIDUAL_C_COMMIT.cjs', '--auto']);
  run('node', ['scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S8_RESIDUAL_CONTRACT_REMEDIATION.cjs', '--auto']);
  run('node', ['scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S7_SETTLEMENT.cjs', '--auto']);
  run('node', ['scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S6_VALIDATION_ORTHOGONALITY_REMEDIATION.cjs', '--auto']);

  runTsx('scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_FORECAST_RESIDUAL_OUTCOME_TICK.ts');
  runTsx('scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_S8_RESIDUAL_CONTRACT_CONFORMANCE.ts');
  runTsx('scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_CONTRACTS_PROJECTION_CONFIG.ts');
  runTsx('scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_RECEIPT_CONSUMING_TICK.ts');
  runTsx('scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_NOT_YET_VALIDATED_RECEIPT_CONSUMING_TICK.ts');
  runTsx('scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_SINGLE_TICK_INTEGRATION.ts');

  runDatabaseAcceptance(
    'mcft_cap05_s8_probe_runtime',
    'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_FORECAST_RESIDUAL_OUTCOME_TICK_DB.ts',
    { MCFT_CAP_05_S8_DESTRUCTIVE_ACCEPTANCE: '1' },
  );
  runDatabaseAcceptance(
    'mcft_cap05_s8_probe_s7',
    'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_RECEIPT_CONSUMING_TICK_DB.ts',
    { MCFT_CAP_05_S7_DESTRUCTIVE_ACCEPTANCE: '1' },
  );
  runDatabaseAcceptance(
    'mcft_cap05_s8_probe_s6',
    'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_ACTION_FEEDBACK_H_DB.ts',
    { MCFT_CAP_05_S6_DESTRUCTIVE_ACCEPTANCE: '1' },
  );
  runDatabaseAcceptance(
    'mcft_cap05_s8_probe_persistence',
    'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_PERSISTENCE_RECOVERY_DB.ts',
    { MCFT_CAP_05_S3_DESTRUCTIVE_ACCEPTANCE: '1' },
  );

  console.log('PASS MCFT-CAP-05 S8 Forecast Residual merged-main effectiveness probe');
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
}
