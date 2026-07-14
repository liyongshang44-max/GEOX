#!/usr/bin/env node
'use strict';

// Probe-only wrapper. The original local pnpm runtime check is preserved and executed first.
require('./assert_local_pnpm_runtime.original.cjs');

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { Client } = require('pg');

const REPOSITORY_BRANCH = 'agent/mcft-cap-05-s6-action-feedback-h-adapter-v1';
const EXACT_HEAD = '1a4f09278ce8b5ee65af8688f0c4d992a5d10035';
const MERGED_MAIN = 'be8b5ecf061ba5e49c1ae33a7a9d4827aa6b0bbe';
const PROBE_FILES = [
  'scripts/dev/assert_local_pnpm_runtime.cjs',
  'scripts/dev/assert_local_pnpm_runtime.original.cjs',
].sort();

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
    throw new Error('POSTGRES_ACCEPTANCE_ENV_REQUIRED_FOR_S6_MERGED_MAIN_PROBE');
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
  assert.equal(remoteHead, EXACT_HEAD, 'S6 candidate branch moved after exact-head lock');
  assert.equal(remoteMain, MERGED_MAIN, 'main moved after S6 merge lock');

  const treeDelta = run('git', ['diff', '--name-only', `${EXACT_HEAD}..${MERGED_MAIN}`]);
  assert.equal(treeDelta, '', 'S6 exact head and merge commit must be tree-equivalent');

  const probeDiff = run('git', ['diff', '--name-only', `${MERGED_MAIN}..HEAD`])
    .split(/\r?\n/)
    .filter(Boolean)
    .sort();
  assert.deepEqual(probeDiff, PROBE_FILES, 'probe must differ from merged main by exactly two validation-only files');
  console.log(`PASS S6 merged-main identity ${MERGED_MAIN}`);
  console.log(`PASS S6 head-to-merge tree equivalence ${EXACT_HEAD}`);

  run('node', ['scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S6_ACTION_FEEDBACK_H.cjs', '--postmerge']);

  const admin = new Client({ connectionString: baseDatabaseUrl() });
  await admin.connect();
  try {
    await recreateDatabase(admin, 'mcft_cap05_s6_merged_main_probe');
    await recreateDatabase(admin, 'mcft_cap05_s5_remediation_probe');
  } finally {
    await admin.end();
  }

  run('pnpm', [
    '-w', 'exec', 'tsx', 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_ACTION_FEEDBACK_H_DB.ts',
  ], {
    ...process.env,
    DATABASE_URL: databaseUrl('mcft_cap05_s6_merged_main_probe'),
    MCFT_CAP_05_S6_DESTRUCTIVE_ACCEPTANCE: '1',
  });

  run('pnpm', [
    '-w', 'exec', 'tsx', 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_S5_REMEDIATION_DB.ts',
  ], {
    ...process.env,
    DATABASE_URL: databaseUrl('mcft_cap05_s5_remediation_probe'),
    MCFT_CAP_05_S5_REMEDIATION_DESTRUCTIVE_ACCEPTANCE: '1',
  });

  console.log('PASS MCFT-CAP-05 S6 merged-main Governance, PostgreSQL and S5 remediation regression');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
