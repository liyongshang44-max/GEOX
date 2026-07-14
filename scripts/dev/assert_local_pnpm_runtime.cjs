#!/usr/bin/env node
'use strict';

// scripts/dev/assert_local_pnpm_runtime.cjs
// Purpose: prove merged-main effectiveness of the MCFT-CAP-05 pre-S8 Forecast Residual contract remediation.
// Boundary: validation-only probe; this file must never be merged.
// MCFT_CAP_05_S6_VALIDATION_ORTHOGONALITY_REMEDIATION_GATE_V1
// MCFT_CAP_05_S7_SSOT_SETTLEMENT_GATE_V1
// MCFT_CAP_05_S8_RESIDUAL_CONTRACT_REMEDIATION_GATE_V1

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { Client } = require('pg');

const REPOSITORY_BRANCH = 'agent/mcft-cap-05-s8-residual-contract-conformance-remediation-v1';
const EXACT_HEAD = 'bd882181fbbfb34f4c87ee93a3f302271d013cc3';
const MERGED_MAIN = '509fe707104a12fbdbbf08823b6d71a70342e0ad';
const PROBE_FILES = ['scripts/dev/assert_local_pnpm_runtime.cjs'];
const DIAGNOSTIC = path.join(process.cwd(), 'acceptance-output', 'MCFT_CAP_05_S8_REMEDIATION_MERGED_MAIN_PROBE.log');

function run(command, args, env = process.env) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env,
    encoding: 'utf8',
    shell: false,
    stdio: 'pipe',
    maxBuffer: 256 * 1024 * 1024,
  });
  fs.mkdirSync(path.dirname(DIAGNOSTIC), { recursive: true });
  fs.appendFileSync(DIAGNOSTIC, `\n$ ${command} ${args.join(' ')}\nstatus=${String(result.status)}\n${result.stdout || ''}\n${result.stderr || ''}\n`, 'utf8');
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
  if (!user || !password || !database) {
    throw new Error('POSTGRES_ACCEPTANCE_ENV_REQUIRED_FOR_S8_REMEDIATION_MERGED_MAIN_PROBE');
  }
  const host = process.env.POSTGRES_HOST || '127.0.0.1';
  const port = process.env.POSTGRES_PORT || '5433';
  return `postgres://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${encodeURIComponent(database)}`;
}

function databaseUrl(databaseName) {
  const url = new URL(baseDatabaseUrl());
  url.pathname = `/${databaseName}`;
  return url.toString();
}

async function recreateDatabase(admin, databaseName) {
  if (!/^[a-z0-9_]+$/.test(databaseName)) throw new Error('PROBE_DATABASE_NAME_INVALID');
  await admin.query(`DROP DATABASE IF EXISTS ${databaseName} WITH (FORCE)`);
  await admin.query(`CREATE DATABASE ${databaseName}`);
}

async function main() {
  run('git', ['fetch', 'origin', 'main', REPOSITORY_BRANCH]);
  const remoteHead = run('git', ['rev-parse', `origin/${REPOSITORY_BRANCH}`]);
  const remoteMain = run('git', ['rev-parse', 'origin/main']);
  assert.equal(remoteHead, EXACT_HEAD, 'remediation candidate branch moved after exact-head lock');
  assert.equal(remoteMain, MERGED_MAIN, 'main moved after remediation merge lock');

  const treeDelta = run('git', ['diff', '--name-only', `${EXACT_HEAD}..${MERGED_MAIN}`]);
  assert.equal(treeDelta, '', 'remediation exact head and merge commit must be tree-equivalent');

  const probeDiff = run('git', ['diff', '--name-only', `${MERGED_MAIN}..HEAD`])
    .split(/\r?\n/)
    .filter(Boolean)
    .sort();
  assert.deepEqual(probeDiff, PROBE_FILES, 'probe must differ from merged main by exactly one validation-only file');
  console.log(`PASS S8 remediation merged-main identity ${MERGED_MAIN}`);
  console.log(`PASS S8 remediation head-to-merge tree equivalence ${EXACT_HEAD}`);

  run('git', ['update-ref', 'refs/remotes/origin/main', 'HEAD']);
  try {
    // The explicit exact-head-to-merge tree proof above is the postmerge delta authority; auto mode rechecks all static remediation invariants without reusing the historical baseline as a false current delta.
    run('node', ['scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S8_RESIDUAL_CONTRACT_REMEDIATION.cjs', '--auto']);
    run('node', ['scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S7_SETTLEMENT.cjs', '--postmerge']);
    run('node', ['scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S6_VALIDATION_ORTHOGONALITY_REMEDIATION.cjs', '--postmerge']);
  } finally {
    run('git', ['update-ref', 'refs/remotes/origin/main', MERGED_MAIN]);
  }

  run('pnpm', ['-w', 'exec', 'tsx', 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_CONTRACTS_PROJECTION_CONFIG.ts']);
  run('pnpm', ['-w', 'exec', 'tsx', 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_S8_RESIDUAL_CONTRACT_CONFORMANCE.ts']);
  run('pnpm', ['-w', 'exec', 'tsx', 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_RECEIPT_CONSUMING_TICK.ts']);
  run('pnpm', ['-w', 'exec', 'tsx', 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_NOT_YET_VALIDATED_RECEIPT_CONSUMING_TICK.ts']);
  run('pnpm', ['-w', 'exec', 'tsx', 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_SINGLE_TICK_INTEGRATION.ts']);

  const admin = new Client({ connectionString: baseDatabaseUrl() });
  await admin.connect();
  try {
    await recreateDatabase(admin, 'mcft_cap05_s8_residual_remediation_probe_s3');
    await recreateDatabase(admin, 'mcft_cap05_s8_residual_remediation_probe_s6');
    await recreateDatabase(admin, 'mcft_cap05_s8_residual_remediation_probe_s7');
  } finally {
    await admin.end();
  }

  run('pnpm', ['-w', 'exec', 'tsx', 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_PERSISTENCE_RECOVERY_DB.ts'], {
    ...process.env,
    DATABASE_URL: databaseUrl('mcft_cap05_s8_residual_remediation_probe_s3'),
    MCFT_CAP_05_S3_DESTRUCTIVE_ACCEPTANCE: '1',
  });

  run('pnpm', ['-w', 'exec', 'tsx', 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_ACTION_FEEDBACK_H_DB.ts'], {
    ...process.env,
    DATABASE_URL: databaseUrl('mcft_cap05_s8_residual_remediation_probe_s6'),
    MCFT_CAP_05_S6_DESTRUCTIVE_ACCEPTANCE: '1',
  });

  run('pnpm', ['-w', 'exec', 'tsx', 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_RECEIPT_CONSUMING_TICK_DB.ts'], {
    ...process.env,
    DATABASE_URL: databaseUrl('mcft_cap05_s8_residual_remediation_probe_s7'),
    MCFT_CAP_05_S7_DESTRUCTIVE_ACCEPTANCE: '1',
  });

  console.log('PASS MCFT-CAP-05 S8 residual contract remediation merged-main effectiveness probe');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
