// scripts/runtime_acceptance/RUN_MCFT_CAP_06_S0_V2_HONEST_QUALIFICATION.cjs
// Purpose: run the permanent MCFT-CAP-06 S0 v2 exact qualification against an isolated PostgreSQL database in CI.
// Boundary: acceptance orchestration only; no source patching, repository materialization, canonical CAP-06 write, Runtime authority, or downstream Slice activation.

'use strict';

const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');

const ROOT = path.resolve(__dirname, '../..');
const EXACT_RUNNER_PATH = 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S0_V2_EXACT_QUALIFICATION.ts';
const RESULT_ARTIFACT_PATH = path.join(ROOT, 'acceptance-output', 'MCFT_CAP_06_S0_V2_RESULT.json');
const BASELINE_MAIN = 'ca819ba51bdf3017dbefa96015f76bd3b66a647c';
const EXPECTED_HEAD_BRANCH = 'agent/mcft-cap-06-s0-v2-exact-qualification';
const ISOLATED_DATABASE_NAME = 'mcft_cap06_s0_v2_ci';

function run(executable, args, options = {}) {
  const result = cp.spawnSync(executable, args, {
    cwd: ROOT,
    env: { ...process.env, ...(options.env || {}) },
    encoding: 'utf8',
    stdio: options.stdio || 'pipe',
    maxBuffer: 256 * 1024 * 1024,
    shell: false,
  });
  if (result.error) throw result.error;
  return result;
}

function requireSuccessful(result, label) {
  if (result.status === 0) return;
  throw new Error(`${label}_FAILED\n${String(result.stdout || '')}\n${String(result.stderr || '')}`);
}

function resolveBaseDatabaseUrl() {
  const explicitDatabaseUrl = String(process.env.DATABASE_URL || '').trim();
  if (explicitDatabaseUrl) return explicitDatabaseUrl;

  const postgresUser = String(process.env.POSTGRES_USER || '').trim();
  const postgresPassword = String(process.env.POSTGRES_PASSWORD || '').trim();
  const postgresDatabase = String(process.env.POSTGRES_DB || '').trim();
  const postgresHost = String(process.env.POSTGRES_HOST || '127.0.0.1').trim();
  const postgresPort = String(process.env.POSTGRES_PORT || '5433').trim();
  if (!postgresUser || !postgresPassword || !postgresDatabase || !postgresHost || !postgresPort) {
    throw new Error('MCFT_CAP_06_S0_POSTGRESQL_ACCEPTANCE_DATABASE_CONFIG_REQUIRED');
  }

  return `postgres://${encodeURIComponent(postgresUser)}:${encodeURIComponent(postgresPassword)}@${postgresHost}:${postgresPort}/${encodeURIComponent(postgresDatabase)}`;
}

async function withAdminPool(baseDatabaseUrl, callback) {
  const adminUrl = new URL(baseDatabaseUrl);
  adminUrl.pathname = '/postgres';
  const admin = new Pool({ connectionString: adminUrl.toString() });
  try {
    return await callback(admin);
  } finally {
    await admin.end();
  }
}

async function recreateIsolatedDatabase(baseDatabaseUrl) {
  await withAdminPool(baseDatabaseUrl, async (admin) => {
    await admin.query(
      `SELECT pg_terminate_backend(pid)
         FROM pg_stat_activity
        WHERE datname=$1
          AND pid<>pg_backend_pid()`,
      [ISOLATED_DATABASE_NAME],
    );
    await admin.query(`DROP DATABASE IF EXISTS ${ISOLATED_DATABASE_NAME}`);
    await admin.query(`CREATE DATABASE ${ISOLATED_DATABASE_NAME}`);
  });

  const isolatedUrl = new URL(baseDatabaseUrl);
  isolatedUrl.pathname = `/${ISOLATED_DATABASE_NAME}`;
  return isolatedUrl.toString();
}

async function dropIsolatedDatabase(baseDatabaseUrl) {
  await withAdminPool(baseDatabaseUrl, async (admin) => {
    await admin.query(
      `SELECT pg_terminate_backend(pid)
         FROM pg_stat_activity
        WHERE datname=$1
          AND pid<>pg_backend_pid()`,
      [ISOLATED_DATABASE_NAME],
    );
    await admin.query(`DROP DATABASE IF EXISTS ${ISOLATED_DATABASE_NAME}`);
  });
}

function restoreGitAncestry() {
  const shallowPath = path.join(ROOT, '.git', 'shallow');
  if (fs.existsSync(shallowPath)) {
    requireSuccessful(
      run('git', ['fetch', '--no-tags', '--prune', '--unshallow', 'origin']),
      'FETCH_UNSHALLOW',
    );
  }

  requireSuccessful(
    run('git', ['fetch', 'origin', 'main:refs/remotes/origin/main']),
    'FETCH_ORIGIN_MAIN',
  );

  const resolvedHeadBranch = String(process.env.GITHUB_HEAD_REF || '').trim();
  if (resolvedHeadBranch === EXPECTED_HEAD_BRANCH) {
    requireSuccessful(
      run('git', ['fetch', 'origin', `${EXPECTED_HEAD_BRANCH}:refs/remotes/origin/${EXPECTED_HEAD_BRANCH}`]),
      'FETCH_ORIGIN_HEAD',
    );
  }

  requireSuccessful(
    run('git', ['merge-base', '--is-ancestor', BASELINE_MAIN, 'HEAD']),
    'S0_BASELINE_ANCESTRY',
  );
}

function persistQualificationResult(stdout) {
  const line = String(stdout || '')
    .split(/\r?\n/)
    .find((candidate) => candidate.startsWith('S0_V2_RESULT_JSON:'));
  if (!line) throw new Error('S0_V2_RESULT_JSON_REQUIRED');

  const result = JSON.parse(line.slice('S0_V2_RESULT_JSON:'.length));
  fs.mkdirSync(path.dirname(RESULT_ARTIFACT_PATH), { recursive: true });
  fs.writeFileSync(RESULT_ARTIFACT_PATH, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
}

async function main() {
  const baseDatabaseUrl = resolveBaseDatabaseUrl();
  restoreGitAncestry();
  const isolatedDatabaseUrl = await recreateIsolatedDatabase(baseDatabaseUrl);

  try {
    const result = run(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', [
      '-w',
      'exec',
      'tsx',
      EXACT_RUNNER_PATH,
    ], {
      env: {
        DATABASE_URL: isolatedDatabaseUrl,
        MCFT_CAP_06_S0_DESTRUCTIVE_ACCEPTANCE: '1',
        GITHUB_HEAD_REF: process.env.GITHUB_HEAD_REF || '',
        GITHUB_REF_NAME: process.env.GITHUB_REF_NAME || '',
      },
    });

    process.stdout.write(String(result.stdout || ''));
    process.stderr.write(String(result.stderr || ''));
    requireSuccessful(result, 'MCFT_CAP_06_S0_V2_HONEST_QUALIFICATION');
    persistQualificationResult(result.stdout);
  } finally {
    await dropIsolatedDatabase(baseDatabaseUrl);
  }
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exitCode = 1;
});
