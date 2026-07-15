#!/usr/bin/env node
'use strict';

// scripts/dev/assert_local_pnpm_runtime.cjs
// Purpose: prove merged-main effectiveness of the MCFT-CAP-05 S8 SSOT settlement and explicit S9 authorization.
// Boundary: validation-only one-file probe; this file must never be merged.
// MCFT_CAP_05_S6_VALIDATION_ORTHOGONALITY_REMEDIATION_GATE_V1
// MCFT_CAP_05_S7_RECEIPT_CONSUMING_TICK_GATE_V1
// MCFT_CAP_05_S7_SSOT_SETTLEMENT_GATE_V1
// MCFT_CAP_05_S8_RESIDUAL_CONTRACT_REMEDIATION_GATE_V1
// MCFT_CAP_05_S8_FORECAST_RESIDUAL_C_COMMIT_GATE_V1
// MCFT_CAP_05_S8_STRICT_FORECAST_AVAILABILITY_GATE_V1
// MCFT_CAP_05_S8_SSOT_SETTLEMENT_GATE_V1

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SETTLEMENT_BRANCH = 'agent/mcft-cap-05-s8-ssot-settlement-v1';
const EXACT_HEAD = '4e2a20340257994a8209f74be5f53ac413ada74b';
const MERGED_MAIN = '786e95db9b06bbe16daa456575d23d24bd194360';
const PROBE_FILE = 'scripts/dev/assert_local_pnpm_runtime.cjs';
const diagnosticPath = path.join(
  process.cwd(),
  'acceptance-output',
  'MCFT_CAP_05_S8_SETTLEMENT_MERGED_MAIN_PROBE.log',
);
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

function exactChangedFiles(base, head) {
  const output = requireSuccess(run('git', ['diff', '--name-only', `${base}..${head}`]));
  return output.split(/\r?\n/).filter(Boolean).sort();
}

function postgresBaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (!process.env.POSTGRES_USER || !process.env.POSTGRES_PASSWORD || !process.env.POSTGRES_DB) return null;
  const host = process.env.POSTGRES_HOST || '127.0.0.1';
  const port = process.env.POSTGRES_PORT || '5433';
  return `postgres://${encodeURIComponent(process.env.POSTGRES_USER)}:${encodeURIComponent(process.env.POSTGRES_PASSWORD)}@${host}:${port}/${encodeURIComponent(process.env.POSTGRES_DB)}`;
}

function databaseUrl(base, databaseName) {
  const url = new URL(base);
  url.pathname = `/${databaseName}`;
  return url.toString();
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

function main() {
  requireSuccess(run('git', ['fetch', '--no-tags', 'origin', 'main', SETTLEMENT_BRANCH]));
  assert.equal(
    requireSuccess(run('git', ['rev-parse', `origin/${SETTLEMENT_BRANCH}`])),
    EXACT_HEAD,
    'settlement candidate branch moved after exact-head lock',
  );
  assert.equal(
    requireSuccess(run('git', ['rev-parse', 'origin/main'])),
    MERGED_MAIN,
    'main moved after settlement merge lock',
  );
  assert.deepEqual(
    exactChangedFiles(EXACT_HEAD, MERGED_MAIN),
    [],
    'settlement exact head and merge commit must be file-tree equivalent',
  );
  assert.deepEqual(
    exactChangedFiles(MERGED_MAIN, 'HEAD'),
    [PROBE_FILE],
    'probe must differ from merged main by exactly one validation-only wrapper',
  );

  requireSuccess(run(pnpmCommand, ['--version']));

  const worktreePath = fs.mkdtempSync(path.join(os.tmpdir(), 'geox-s8-settlement-effective-'));
  try {
    requireSuccess(run('git', ['worktree', 'add', '--detach', worktreePath, MERGED_MAIN]));
    requireSuccess(run(
      process.execPath,
      ['scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S8_SETTLEMENT.cjs', '--auto'],
      {},
      worktreePath,
    ));
  } finally {
    requireSuccess(run('git', ['worktree', 'remove', '--force', worktreePath]));
  }

  requireSuccess(run(
    process.execPath,
    ['scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S6_VALIDATION_ORTHOGONALITY_REMEDIATION.cjs', '--auto'],
  ));
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
      'mcft_cap05_s8_settlement_probe_s6',
      'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_ACTION_FEEDBACK_H_DB.ts',
      { MCFT_CAP_05_S6_DESTRUCTIVE_ACCEPTANCE: '1' },
    );
    runDatabaseAcceptance(
      base,
      'mcft_cap05_s8_settlement_probe_s7',
      'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_RECEIPT_CONSUMING_TICK_DB.ts',
      { MCFT_CAP_05_S7_DESTRUCTIVE_ACCEPTANCE: '1' },
    );
    runDatabaseAcceptance(
      base,
      'mcft_cap05_s8_settlement_probe_contract',
      'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_PERSISTENCE_RECOVERY_DB.ts',
      { MCFT_CAP_05_S3_DESTRUCTIVE_ACCEPTANCE: '1' },
    );
    runDatabaseAcceptance(
      base,
      'mcft_cap05_s8_settlement_probe_runtime',
      'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_FORECAST_RESIDUAL_OUTCOME_TICK_DB.ts',
      { MCFT_CAP_05_S8_DESTRUCTIVE_ACCEPTANCE: '1' },
    );
  }

  console.log(JSON.stringify({
    ok: true,
    result: 'MCFT_CAP_05_S8_SETTLEMENT_MERGED_MAIN_EFFECTIVE',
    settlement_exact_head: EXACT_HEAD,
    settlement_merge_commit: MERGED_MAIN,
    tree_equivalence: 'PASS',
    probe_delta: [PROBE_FILE],
    s9_authorized_not_started: true,
    s10_authorized: false,
    cap_06_authorized: false,
    probe_must_never_merge: true,
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exit(1);
}
