#!/usr/bin/env node
'use strict';

// Probe-only wrapper. The original local pnpm runtime check is preserved and executed first.
require('./assert_local_pnpm_runtime.original.cjs');

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { Client } = require('pg');

const REPOSITORY_BRANCH = 'agent/mcft-cap-05-s6-action-feedback-h-adapter-v1';
const EXACT_HEAD = '1a4f09278ce8b5ee65af8688f0c4d992a5d10035';
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

function databaseUrl(databaseName) {
  const source = process.env.DATABASE_URL;
  if (!source) throw new Error('DATABASE_URL_REQUIRED_FOR_S6_EXACT_HEAD_PROBE');
  const url = new URL(source);
  url.pathname = `/${databaseName}`;
  return url.toString();
}

async function recreateDatabase(admin, databaseName) {
  if (!/^[a-z0-9_]+$/.test(databaseName)) throw new Error('PROBE_DATABASE_NAME_INVALID');
  await admin.query(`DROP DATABASE IF EXISTS ${databaseName} WITH (FORCE)`);
  await admin.query(`CREATE DATABASE ${databaseName}`);
}

async function main() {
  run('git', ['fetch', 'origin', REPOSITORY_BRANCH]);
  const remoteHead = run('git', ['rev-parse', `origin/${REPOSITORY_BRANCH}`]);
  assert.equal(remoteHead, EXACT_HEAD, 'S6 candidate branch moved after exact-head lock');

  const probeDiff = run('git', ['diff', '--name-only', `${EXACT_HEAD}..HEAD`])
    .split(/\r?\n/)
    .filter(Boolean)
    .sort();
  assert.deepEqual(probeDiff, PROBE_FILES, 'probe must differ from exact S6 head by exactly two validation-only files');
  console.log(`PASS exact S6 candidate identity ${EXACT_HEAD}`);

  run('node', ['scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S6_ACTION_FEEDBACK_H.cjs', '--postmerge']);

  const admin = new Client({ connectionString: process.env.DATABASE_URL });
  await admin.connect();
  try {
    await recreateDatabase(admin, 'mcft_cap05_s6_exact_head_probe');
    await recreateDatabase(admin, 'mcft_cap05_s5_remediation_probe');
  } finally {
    await admin.end();
  }

  run('pnpm', [
    '-w', 'exec', 'tsx', 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_ACTION_FEEDBACK_H_DB.ts',
  ], {
    ...process.env,
    DATABASE_URL: databaseUrl('mcft_cap05_s6_exact_head_probe'),
    MCFT_CAP_05_S6_DESTRUCTIVE_ACCEPTANCE: '1',
  });

  run('pnpm', [
    '-w', 'exec', 'tsx', 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_S5_REMEDIATION_DB.ts',
  ], {
    ...process.env,
    DATABASE_URL: databaseUrl('mcft_cap05_s5_remediation_probe'),
    MCFT_CAP_05_S5_REMEDIATION_DESTRUCTIVE_ACCEPTANCE: '1',
  });

  console.log('PASS MCFT-CAP-05 S6 exact-head Governance, PostgreSQL and S5 remediation regression');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
