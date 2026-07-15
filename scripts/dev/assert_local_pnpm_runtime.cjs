#!/usr/bin/env node
'use strict';

// scripts/dev/assert_local_pnpm_runtime.cjs
// Purpose: prove merged-main effectiveness of the MCFT-CAP-05 S8 Runtime plus strict Forecast-availability hardening.
// Boundary: validation-only one-file probe; this file must never be merged.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ORIGINAL_RUNTIME_HEAD = '172ee2ac2e306b7e04f2db7d05a3163f881b490a';
const ORIGINAL_RUNTIME_MERGE = '0610ed542067e699b7dd9828199661f12e1cdbde';
const HARDENING_BRANCH = 'agent/mcft-cap-05-s8-strict-forecast-availability';
const HARDENING_HEAD = 'ff2fc0ea9a2b387b01fe86560f85c65428cb0fee';
const MERGED_MAIN = 'ca61e86c5a6c1e035b82312b92116a111a76ccc7';
const PROBE_FILE = 'scripts/dev/assert_local_pnpm_runtime.cjs';
const diagnosticPath = path.join(process.cwd(), 'acceptance-output', 'MCFT_CAP_05_S8_MERGED_MAIN_EFFECTIVENESS_PROBE.log');
const isWindows = process.platform === 'win32';
const pnpmCommand = isWindows ? 'pnpm.cmd' : 'pnpm';

function run(command, args = [], envOverrides = {}, cwd = process.cwd()) {
  const result = spawnSync(command, args, {
    cwd,
    env: {
      ...process.env,
      CI: process.env.CI || 'true',
      npm_config_confirmModulesPurge: process.env.npm_config_confirmModulesPurge || 'false',
      npm_config_confirm_modules_purge: process.env.npm_config_confirm_modules_purge || 'false',
      ...envOverrides,
    },
    encoding: 'utf8',
    shell: false,
    maxBuffer: 256 * 1024 * 1024,
  });
  return {
    command: [command, ...args].join(' '),
    cwd,
    status: result.status,
    error: result.error ? String(result.error.message || result.error) : '',
    stdout: String(result.stdout || '').trim(),
    stderr: String(result.stderr || '').trim(),
  };
}

function requireSuccess(result) {
  fs.mkdirSync(path.dirname(diagnosticPath), { recursive: true });
  fs.appendFileSync(
    diagnosticPath,
    `\n$ ${result.command}\ncwd=${result.cwd}\nstatus=${String(result.status)}\n${result.stdout || ''}\n${result.stderr || ''}\n`,
    'utf8',
  );
  if (result.stdout) console.log(result.stdout);
  if (result.stderr) console.error(result.stderr);
  if (result.status !== 0) {
    throw new Error(`COMMAND_FAILED:${result.command}:${String(result.status)}:${result.error}`);
  }
  return result.stdout;
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
  requireSuccess(run('psql', [admin, '-v', 'ON_ERROR_STOP=1', '-c', `DROP DATABASE IF EXISTS ${databaseName} WITH (FORCE)`]));
  requireSuccess(run('psql', [admin, '-v', 'ON_ERROR_STOP=1', '-c', `CREATE DATABASE ${databaseName}`]));
}

function runTsx(script, envOverrides = {}) {
  requireSuccess(run(pnpmCommand, ['-w', 'exec', 'tsx', script], envOverrides));
}

function runDatabaseAcceptance(base, databaseName, script, envOverrides) {
  recreateDatabase(base, databaseName);
  runTsx(script, {
    DATABASE_URL: databaseUrl(base, databaseName),
    ...envOverrides,
  });
}

function exactChangedFiles(base, head) {
  const output = requireSuccess(run('git', ['diff', '--name-only', `${base}..${head}`]));
  return output.split(/\r?\n/).filter(Boolean).sort();
}

function main() {
  requireSuccess(run('git', ['fetch', 'origin', 'main', HARDENING_BRANCH]));
  assert.equal(requireSuccess(run('git', ['rev-parse', `origin/${HARDENING_BRANCH}`])), HARDENING_HEAD);
  assert.equal(requireSuccess(run('git', ['rev-parse', 'origin/main'])), MERGED_MAIN);
  assert.deepEqual(exactChangedFiles(ORIGINAL_RUNTIME_HEAD, ORIGINAL_RUNTIME_MERGE), []);
  assert.deepEqual(exactChangedFiles(HARDENING_HEAD, MERGED_MAIN), []);
  assert.deepEqual(exactChangedFiles(MERGED_MAIN, 'HEAD'), [PROBE_FILE]);
  assert.equal(requireSuccess(run(pnpmCommand, ['--version'])), '9.15.4');

  const worktreePath = fs.mkdtempSync(path.join(os.tmpdir(), 'geox-s8-effective-'));
  try {
    requireSuccess(run('git', ['worktree', 'add', '--detach', worktreePath, MERGED_MAIN]));
    requireSuccess(run(
      process.execPath,
      ['scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S8_STRICT_FORECAST_AVAILABILITY.cjs', '--auto'],
      {},
      worktreePath,
    ));
  } finally {
    requireSuccess(run('git', ['worktree', 'remove', '--force', worktreePath]));
  }

  runTsx('scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_CONTRACTS_PROJECTION_CONFIG.ts');
  runTsx('scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_S8_RESIDUAL_CONTRACT_CONFORMANCE.ts');
  runTsx('scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_RECEIPT_CONSUMING_TICK.ts');
  runTsx('scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_NOT_YET_VALIDATED_RECEIPT_CONSUMING_TICK.ts');
  runTsx('scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_SINGLE_TICK_INTEGRATION.ts');
  runTsx('scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_FORECAST_RESIDUAL_OUTCOME_TICK.ts');

  const base = postgresBaseUrl();
  if (base && (process.env.CI === 'true' || process.env.MCFT_CAP_05_S8_RUN_DB_ACCEPTANCE === '1')) {
    runDatabaseAcceptance(
      base,
      'mcft_cap05_s8_probe_s6',
      'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_ACTION_FEEDBACK_H_DB.ts',
      { MCFT_CAP_05_S6_DESTRUCTIVE_ACCEPTANCE: '1' },
    );
    runDatabaseAcceptance(
      base,
      'mcft_cap05_s8_probe_s7',
      'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_RECEIPT_CONSUMING_TICK_DB.ts',
      { MCFT_CAP_05_S7_DESTRUCTIVE_ACCEPTANCE: '1' },
    );
    runDatabaseAcceptance(
      base,
      'mcft_cap05_s8_probe_contract',
      'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_PERSISTENCE_RECOVERY_DB.ts',
      { MCFT_CAP_05_S3_DESTRUCTIVE_ACCEPTANCE: '1' },
    );
    runDatabaseAcceptance(
      base,
      'mcft_cap05_s8_probe_runtime',
      'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_FORECAST_RESIDUAL_OUTCOME_TICK_DB.ts',
      { MCFT_CAP_05_S8_DESTRUCTIVE_ACCEPTANCE: '1' },
    );
  }

  console.log(JSON.stringify({
    ok: true,
    proof: 'MCFT_CAP_05_S8_MERGED_MAIN_EFFECTIVE_RUNTIME_PROBE_V1',
    original_runtime_head: ORIGINAL_RUNTIME_HEAD,
    original_runtime_merge: ORIGINAL_RUNTIME_MERGE,
    hardening_head: HARDENING_HEAD,
    merged_main: MERGED_MAIN,
    probe_delta: [PROBE_FILE],
    historical_static_candidate_boundaries_reasserted: false,
    strict_forecast_availability: 'forecast.created_at < observation.available_to_runtime_at',
    successor_authorized: false,
    cap_06_authorized: false,
  }, null, 2));
}

main();
