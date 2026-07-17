// scripts/runtime_acceptance/RUN_MCFT_CAP_06_S4_STABILIZATION.cjs
// Purpose: execute the MCFT-CAP-06 S4 domain, formal CAP-05 production composition, exact-ref PostgreSQL graph assembly, and exact S2 compatibility acceptance in one disposable database topology.
// Boundary: acceptance orchestration only; no production database, Candidate/Evaluation append, calibration/shadow authority, State/checkpoint mutation, active-config mutation, Model Activation, route, Web, scheduler, or CAP-07 authority.

'use strict';

const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');

const ROOT = path.resolve(__dirname, '../..');
const RETAINED_DATABASE_NAME = 'mcft_cap05_post_closure_acceptance';
const OUTPUT_DIR = path.join(ROOT, 'acceptance-output');
const HANDOFF_PATH = path.join(OUTPUT_DIR, 'MCFT_CAP_06_S4_CAP05_HANDOFF.json');

function run(executable, args, options = {}) {
  const result = cp.spawnSync(executable, args, {
    cwd: ROOT,
    env: { ...process.env, ...(options.env || {}) },
    encoding: 'utf8',
    stdio: 'pipe',
    shell: false,
    maxBuffer: 256 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  process.stdout.write(String(result.stdout || ''));
  process.stderr.write(String(result.stderr || ''));
  if (result.status !== 0) {
    throw new Error(`${options.label || executable}_FAILED:${result.status}`);
  }
  return String(result.stdout || '');
}

function pnpm() {
  return process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
}

function resolveBaseDatabaseUrl() {
  const explicit = String(process.env.DATABASE_URL || '').trim();
  if (explicit) return explicit;
  const user = String(process.env.POSTGRES_USER || '').trim();
  const password = String(process.env.POSTGRES_PASSWORD || '').trim();
  const database = String(process.env.POSTGRES_DB || '').trim();
  const host = String(process.env.POSTGRES_HOST || '127.0.0.1').trim();
  const port = String(process.env.POSTGRES_PORT || '5433').trim();
  if (!user || !password || !database) {
    throw new Error('MCFT_CAP_06_S4_POSTGRESQL_CONFIG_REQUIRED');
  }
  return `postgres://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${encodeURIComponent(database)}`;
}

function databaseUrlFor(baseUrl, databaseName) {
  const parsed = new URL(baseUrl);
  parsed.pathname = `/${databaseName}`;
  parsed.search = '';
  parsed.hash = '';
  return parsed.toString();
}

async function dropRetainedDatabase(baseUrl) {
  const admin = new Pool({ connectionString: databaseUrlFor(baseUrl, 'postgres') });
  try {
    await admin.query(
      `SELECT pg_terminate_backend(pid)
         FROM pg_stat_activity
        WHERE datname=$1
          AND pid<>pg_backend_pid()`,
      [RETAINED_DATABASE_NAME],
    );
    await admin.query(`DROP DATABASE IF EXISTS ${RETAINED_DATABASE_NAME}`);
  } finally {
    await admin.end();
  }
}

function requireOutput(output, pattern, code) {
  if (!pattern.test(output)) throw new Error(code);
}

async function main() {
  const baseDatabaseUrl = resolveBaseDatabaseUrl();
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.rmSync(HANDOFF_PATH, { force: true });
  await dropRetainedDatabase(baseDatabaseUrl);

  try {
    const domain = run(pnpm(), [
      '-w', 'exec', 'tsx',
      'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S4_DOMAIN.ts',
    ], { label: 'MCFT_CAP_06_S4_DOMAIN' });
    requireOutput(domain, /MCFT_CAP_06_S4_DOMAIN:PASS/, 'S4_DOMAIN_PASS_MARKER_REQUIRED');

    const formalCap05 = run(pnpm(), [
      '-w', 'exec', 'tsx',
      'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_POST_CLOSURE_POSTGRESQL_RUNNER.ts',
    ], {
      label: 'MCFT_CAP_05_FORMAL_RUNNER',
      env: {
        DATABASE_URL: baseDatabaseUrl,
        MCFT_CAP_05_POST_CLOSURE_RETAIN_DATABASE: '1',
        MCFT_CAP_05_POST_CLOSURE_RESULT_PATH: HANDOFF_PATH,
      },
    });
    requireOutput(formalCap05, /SUMMARY 8 PASS \/ 0 FAIL/, 'CAP05_FORMAL_COMPOSITION_PASS_REQUIRED');
    if (!fs.existsSync(HANDOFF_PATH)) throw new Error('S4_CAP05_HANDOFF_NOT_WRITTEN');

    const composition = run(pnpm(), [
      '-w', 'exec', 'tsx',
      'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S4_FORMAL_COMPOSITION_DB.ts',
    ], {
      label: 'MCFT_CAP_06_S4_FORMAL_COMPOSITION',
      env: {
        MCFT_CAP_06_S4_DESTRUCTIVE_ACCEPTANCE: '1',
        MCFT_CAP_06_S4_CAP05_HANDOFF_PATH: HANDOFF_PATH,
      },
    });
    requireOutput(
      composition,
      /MCFT_CAP_06_S4_FORMAL_COMPOSITION_DB:PASS/,
      'S4_FORMAL_COMPOSITION_PASS_MARKER_REQUIRED',
    );

    const s2 = run(pnpm(), [
      '-w', 'exec', 'tsx',
      'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S2_CONTRACTS_MATH.ts',
    ], { label: 'MCFT_CAP_06_S2_COMPATIBILITY' });
    requireOutput(s2, /MCFT_CAP_06_S2_CONTRACTS_MATH:PASS/, 'S2_COMPATIBILITY_PASS_REQUIRED');

    console.log('MCFT_CAP_06_S4_STABILIZATION:PASS');
  } finally {
    await dropRetainedDatabase(baseDatabaseUrl);
  }
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exitCode = 1;
});
