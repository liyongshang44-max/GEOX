// scripts/runtime_acceptance/RUN_MCFT_CAP_06_S3_PERSISTENCE.cjs
// Purpose: execute permanent MCFT-CAP-06 S3 persistence and projection-canonicality acceptance in a disposable PostgreSQL database.
// Boundary: acceptance orchestration only; no production database, S5/S6 orchestration, Runtime authority, State, checkpoint, Model Activation, route, Web, scheduler, or CAP-07 authority.

'use strict';

const cp = require('node:child_process');
const path = require('node:path');
const { Pool } = require('pg');

const ROOT = path.resolve(__dirname, '../..');
const ACCEPTANCE_PATHS = [
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S3_PERSISTENCE_DB.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S3_PROJECTION_CANONICALITY_DB.ts',
];
const ISOLATED_DATABASE_NAME = 'mcft_cap06_s3_persistence_ci';

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
    throw new Error('MCFT_CAP_06_S3_POSTGRESQL_ACCEPTANCE_DATABASE_CONFIG_REQUIRED');
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

async function recreateDatabase(baseDatabaseUrl) {
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

async function dropDatabase(baseDatabaseUrl) {
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

function runAcceptance(acceptancePath, isolatedDatabaseUrl) {
  const result = run(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', [
    '-w',
    'exec',
    'tsx',
    acceptancePath,
  ], {
    env: {
      DATABASE_URL: isolatedDatabaseUrl,
      MCFT_CAP_06_S3_DESTRUCTIVE_ACCEPTANCE: '1',
    },
  });
  process.stdout.write(String(result.stdout || ''));
  process.stderr.write(String(result.stderr || ''));
  requireSuccessful(
    result,
    `MCFT_CAP_06_S3_${path.basename(acceptancePath, '.ts')}`,
  );
}

async function main() {
  const baseDatabaseUrl = resolveBaseDatabaseUrl();
  const isolatedDatabaseUrl = await recreateDatabase(baseDatabaseUrl);
  try {
    for (const acceptancePath of ACCEPTANCE_PATHS) {
      runAcceptance(acceptancePath, isolatedDatabaseUrl);
    }
  } finally {
    await dropDatabase(baseDatabaseUrl);
  }
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exitCode = 1;
});
