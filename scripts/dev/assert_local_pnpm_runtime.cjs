#!/usr/bin/env node
'use strict';

// scripts/dev/assert_local_pnpm_runtime.cjs
// Purpose: probe the merged-main effectiveness of MCFT-CAP-05 S6 validation-orthogonality remediation without changing Runtime code.
// Boundary: validation-only branch; never merge this probe file into main.

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { Client } = require('pg');

const REPOSITORY_BRANCH = 'agent/mcft-cap-05-s6-validation-orthogonality-remediation-v1';
const EXACT_HEAD = '56927d10ba6a1557ba88be9103b972dbffd43032';
const MERGED_MAIN = '210622dbbfb96e6999568630e5095f7c6097d8c7';
const PROBE_FILES = ['scripts/dev/assert_local_pnpm_runtime.cjs'];

function run(command, args, env = process.env) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env,
    encoding: 'utf8',
    shell: false,
    stdio: 'pipe',
    maxBuffer: 256 * 1024 * 1024,
  });
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
    throw new Error('POSTGRES_ACCEPTANCE_ENV_REQUIRED_FOR_S6_REMEDIATION_MERGED_MAIN_PROBE');
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
  console.log(`PASS remediation merged-main identity ${MERGED_MAIN}`);
  console.log(`PASS remediation head-to-merge tree equivalence ${EXACT_HEAD}`);

  run('node', ['scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S6_VALIDATION_ORTHOGONALITY_REMEDIATION.cjs', '--postmerge']);
  run('node', ['scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S6_ACTION_FEEDBACK_H.cjs', '--postmerge']);
  run('node', ['scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S6_ACTIVATION.cjs', '--auto']);

  const admin = new Client({ connectionString: baseDatabaseUrl() });
  await admin.connect();
  try {
    await recreateDatabase(admin, 'mcft_cap05_s6_validation_orthogonality_merged_main_probe');
  } finally {
    await admin.end();
  }

  run('pnpm', [
    '-w', 'exec', 'tsx', 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_ACTION_FEEDBACK_H_DB.ts',
  ], {
    ...process.env,
    DATABASE_URL: databaseUrl('mcft_cap05_s6_validation_orthogonality_merged_main_probe'),
    MCFT_CAP_05_S6_DESTRUCTIVE_ACCEPTANCE: '1',
  });

  console.log('PASS MCFT-CAP-05 S6 validation-orthogonality remediation merged-main effectiveness probe');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
