// Purpose: run the complete MCFT-CAP-06 S8 restart/readback/rebuild preflight in isolated PostgreSQL and emit one structured result.
// Boundary: acceptance orchestration only; no production database, new canonical authority, activation, active Config, State/checkpoint, route, Web, scheduler or CAP-07 authority.

'use strict';

const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');

const ROOT = path.resolve(__dirname, '../..');
const OUTPUT_DIR = path.join(ROOT, 'acceptance-output');
const RESULT_PATH = path.join(OUTPUT_DIR, 'MCFT_CAP_06_S8_RESTART_READBACK_REBUILD_PREFLIGHT_RESULT.json');
const INPUT_PATH = path.join(OUTPUT_DIR, 'MCFT_CAP_06_S8_RESTART_READBACK_REBUILD_PREFLIGHT_INPUT.json');
const ISOLATED_DATABASE_NAME = 'mcft_cap06_s8_restart_rebuild_ci';
const STAGES = [
  {
    id: 'TYPECHECK',
    executable: process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
    args: ['-r', 'typecheck'],
  },
  {
    id: 'BUILD',
    executable: process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
    args: ['-r', 'build'],
  },
  {
    id: 'S3_PERSISTENCE_REGRESSION',
    executable: process.execPath,
    args: ['scripts/runtime_acceptance/RUN_MCFT_CAP_06_S3_PERSISTENCE.cjs'],
  },
  {
    id: 'S6_DOMAIN_REGRESSION',
    executable: process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
    args: ['-w', 'exec', 'tsx', 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S6_PAIRED_SHADOW.ts'],
  },
  {
    id: 'S7_DOMAIN_REGRESSION',
    executable: process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
    args: ['-w', 'exec', 'tsx', 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S7_SHADOW_EVALUATION.ts'],
  },
  {
    id: 'S8_DOMAIN_RECOVERY',
    executable: process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
    args: ['-w', 'exec', 'tsx', 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S8_RESTART_READBACK_REBUILD.ts'],
  },
];

function run(executable, args, options = {}) {
  return cp.spawnSync(executable, args, {
    cwd: ROOT,
    env: { ...process.env, ...(options.env || {}) },
    encoding: 'utf8',
    stdio: 'pipe',
    maxBuffer: 256 * 1024 * 1024,
    shell: false,
  });
}
function resolveBaseDatabaseUrl() {
  const explicit = String(process.env.DATABASE_URL || '').trim();
  if (explicit) return explicit;
  const user = String(process.env.POSTGRES_USER || '').trim();
  const password = String(process.env.POSTGRES_PASSWORD || '').trim();
  const database = String(process.env.POSTGRES_DB || '').trim();
  const host = String(process.env.POSTGRES_HOST || '127.0.0.1').trim();
  const port = String(process.env.POSTGRES_PORT || '5433').trim();
  if (!user || !password || !database || !host || !port) {
    throw new Error('MCFT_CAP_06_S8_POSTGRESQL_ACCEPTANCE_DATABASE_CONFIG_REQUIRED');
  }
  return `postgres://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${encodeURIComponent(database)}`;
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
  const isolated = new URL(baseDatabaseUrl);
  isolated.pathname = `/${ISOLATED_DATABASE_NAME}`;
  return isolated.toString();
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
function executeStage(stage, env = {}) {
  const startedAt = new Date().toISOString();
  const result = run(stage.executable, stage.args, { env });
  const completedAt = new Date().toISOString();
  const stdout = String(result.stdout || '');
  const stderr = String(result.stderr || '');
  fs.writeFileSync(path.join(OUTPUT_DIR, `MCFT_CAP_06_S8_${stage.id}.log`), `${stdout}${stderr}`, 'utf8');
  process.stdout.write(stdout);
  process.stderr.write(stderr);
  return {
    stage_id: stage.id,
    status: result.status === 0 ? 'PASS' : 'FAIL',
    exit_code: result.status ?? -1,
    started_at: startedAt,
    completed_at: completedAt,
  };
}
function requirePass(stage) {
  if (stage.status !== 'PASS') throw new Error(`MCFT_CAP_06_S8_STAGE_FAILED:${stage.stage_id}`);
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const baseDatabaseUrl = resolveBaseDatabaseUrl();
  const stageResults = [];
  for (const stage of STAGES) {
    const result = executeStage(stage);
    stageResults.push(result);
    requirePass(result);
  }

  const isolatedDatabaseUrl = await recreateDatabase(baseDatabaseUrl);
  try {
    const databaseStage = executeStage({
      id: 'S8_POSTGRESQL_RESTART_RECOVERY',
      executable: process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
      args: ['-w', 'exec', 'tsx', 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S8_RESTART_READBACK_REBUILD_DB.ts'],
    }, {
      DATABASE_URL: isolatedDatabaseUrl,
      MCFT_CAP_06_S8_RESTART_READBACK_REBUILD_DESTRUCTIVE_ACCEPTANCE: '1',
    });
    stageResults.push(databaseStage);
    requirePass(databaseStage);
  } finally {
    await dropDatabase(baseDatabaseUrl);
  }

  const database = JSON.parse(fs.readFileSync(
    path.join(OUTPUT_DIR, 'MCFT_CAP_06_S8_RESTART_READBACK_REBUILD_DB_RESULT.json'),
    'utf8',
  ));
  const input = {
    schema_version: 'geox_mcft_cap_06_s8_restart_readback_rebuild_preflight_input_v1',
    status: 'READY_FOR_GOVERNANCE',
    exact_head: cp.execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(),
    production_database_used: false,
    stages: stageResults,
    database_result_ref: 'acceptance-output/MCFT_CAP_06_S8_RESTART_READBACK_REBUILD_DB_RESULT.json',
    evaluation_ref: database.evaluation_ref,
    evaluation_hash: database.evaluation_hash,
    candidate_ref: database.candidate_ref,
    candidate_hash: database.candidate_hash,
    canonical_facts_hash_before: database.canonical_facts_hash_before,
    canonical_facts_hash_after: database.canonical_facts_hash_after,
    first_projection_snapshot_hash: database.first_projection_snapshot_hash,
    second_projection_snapshot_hash: database.second_projection_snapshot_hash,
  };
  fs.writeFileSync(INPUT_PATH, `${JSON.stringify(input, null, 2)}\n`, 'utf8');

  const governanceStage = executeStage({
    id: 'S8_GOVERNANCE',
    executable: process.execPath,
    args: ['scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S8_RESTART_READBACK_REBUILD.cjs'],
  });
  stageResults.push(governanceStage);
  requirePass(governanceStage);

  const governance = JSON.parse(fs.readFileSync(
    path.join(OUTPUT_DIR, 'MCFT_CAP_06_S8_RESTART_READBACK_REBUILD_GOVERNANCE_RESULT.json'),
    'utf8',
  ));
  const result = {
    schema_version: 'geox_mcft_cap_06_s8_restart_readback_rebuild_preflight_result_v1',
    status: 'PASS',
    exact_head: input.exact_head,
    stage_count: stageResults.length,
    stages: stageResults,
    evaluation_ref: database.evaluation_ref,
    evaluation_hash: database.evaluation_hash,
    candidate_ref: database.candidate_ref,
    candidate_hash: database.candidate_hash,
    evaluation_case_count: database.evaluation_case_count,
    canonical_fact_count: database.canonical_fact_count,
    governance_fact_count: database.governance_fact_count,
    canonical_facts_hash_before: database.canonical_facts_hash_before,
    canonical_facts_hash_after: database.canonical_facts_hash_after,
    first_rebuild_summary: database.first_rebuild_summary,
    second_rebuild_summary: database.second_rebuild_summary,
    first_projection_snapshot_hash: database.first_projection_snapshot_hash,
    second_projection_snapshot_hash: database.second_projection_snapshot_hash,
    fresh_process_count: database.fresh_process_count,
    exact_readback_verified: database.exact_readback_verified,
    deterministic_second_rebuild_verified: database.deterministic_second_rebuild_verified,
    canonical_fact_append_count: database.canonical_fact_append_count,
    canonical_fact_update_count: database.canonical_fact_update_count,
    canonical_fact_delete_count: database.canonical_fact_delete_count,
    candidate_append_count: database.candidate_append_count,
    evaluation_append_count: database.evaluation_append_count,
    model_activation_count: database.model_activation_count,
    active_config_switch_count: database.active_config_switch_count,
    runtime_parameter_change_count: database.runtime_parameter_change_count,
    state_mutation_count: database.state_mutation_count,
    checkpoint_mutation_count: database.checkpoint_mutation_count,
    migration_count: database.migration_count,
    production_database_used: false,
    s8_candidate_implemented: governance.s8_candidate_implemented,
    s8_effective: governance.s8_effective,
    s9_authorized: governance.s9_authorized,
  };
  fs.writeFileSync(RESULT_PATH, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(result));
}

main().catch((error) => {
  const result = {
    schema_version: 'geox_mcft_cap_06_s8_restart_readback_rebuild_preflight_result_v1',
    status: 'FAIL',
    error: error instanceof Error ? error.message : String(error),
    canonical_fact_append_count: 0,
    canonical_fact_update_count: 0,
    canonical_fact_delete_count: 0,
    candidate_append_count: 0,
    evaluation_append_count: 0,
    model_activation_count: 0,
    active_config_switch_count: 0,
    runtime_parameter_change_count: 0,
    state_mutation_count: 0,
    checkpoint_mutation_count: 0,
    migration_count: 0,
    s8_effective: false,
    s9_authorized: false,
  };
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(RESULT_PATH, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  console.error(JSON.stringify(result));
  process.exitCode = 1;
});
