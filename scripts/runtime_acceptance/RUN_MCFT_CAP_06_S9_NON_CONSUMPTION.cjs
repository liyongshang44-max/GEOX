// Purpose: run the complete MCFT-CAP-06 S9 post-evaluation non-consumption preflight in isolated PostgreSQL and emit one structured result.
// Boundary: acceptance orchestration only; no production database, new prerequisite, Model Activation, active Config, public route, Web, scheduler or CAP-07 authority.

'use strict';

const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');

const ROOT = path.resolve(__dirname, '../..');
const OUTPUT_DIR = path.join(ROOT, 'acceptance-output');
const RESULT_PATH = path.join(OUTPUT_DIR, 'MCFT_CAP_06_S9_NON_CONSUMPTION_PREFLIGHT_RESULT.json');
const INPUT_PATH = path.join(OUTPUT_DIR, 'MCFT_CAP_06_S9_NON_CONSUMPTION_PREFLIGHT_INPUT.json');
const ISOLATED_DATABASE_NAME = 'mcft_cap06_s9_non_consumption_ci';
const PNPM = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const STAGES = [
  { id: 'TYPECHECK', executable: PNPM, args: ['-r', 'typecheck'] },
  { id: 'BUILD', executable: PNPM, args: ['-r', 'build'] },
  {
    id: 'CAP04_A1_B_REGRESSION',
    executable: PNPM,
    args: ['-w', 'exec', 'tsx', 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_SINGLE_TICK_INTEGRATION.ts'],
  },
  {
    id: 'S9_DOMAIN_NON_CONSUMPTION',
    executable: PNPM,
    args: ['-w', 'exec', 'tsx', 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S9_NON_CONSUMPTION_DOMAIN.ts'],
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
    throw new Error('MCFT_CAP_06_S9_POSTGRESQL_ACCEPTANCE_DATABASE_CONFIG_REQUIRED');
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
  fs.writeFileSync(path.join(OUTPUT_DIR, `MCFT_CAP_06_S9_${stage.id}.log`), `${stdout}${stderr}`, 'utf8');
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
  if (stage.status !== 'PASS') throw new Error(`MCFT_CAP_06_S9_STAGE_FAILED:${stage.stage_id}`);
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
      id: 'S9_POSTGRESQL_NON_CONSUMPTION',
      executable: PNPM,
      args: ['-w', 'exec', 'tsx', 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S9_NON_CONSUMPTION_DB.ts'],
    }, {
      DATABASE_URL: isolatedDatabaseUrl,
      MCFT_CAP_06_S9_NON_CONSUMPTION_DESTRUCTIVE_ACCEPTANCE: '1',
    });
    stageResults.push(databaseStage);
    requirePass(databaseStage);
  } finally {
    await dropDatabase(baseDatabaseUrl);
  }

  const domain = JSON.parse(fs.readFileSync(
    path.join(OUTPUT_DIR, 'MCFT_CAP_06_S9_NON_CONSUMPTION_DOMAIN_RESULT.json'),
    'utf8',
  ));
  const database = JSON.parse(fs.readFileSync(
    path.join(OUTPUT_DIR, 'MCFT_CAP_06_S9_NON_CONSUMPTION_DB_RESULT.json'),
    'utf8',
  ));
  const input = {
    schema_version: 'geox_mcft_cap_06_s9_non_consumption_preflight_input_v1',
    status: 'READY_FOR_GOVERNANCE',
    exact_head: cp.execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(),
    taskbook_version: 'v0.4.0',
    production_database_used: false,
    stages: stageResults,
    domain_result_ref: 'acceptance-output/MCFT_CAP_06_S9_NON_CONSUMPTION_DOMAIN_RESULT.json',
    database_result_ref: 'acceptance-output/MCFT_CAP_06_S9_NON_CONSUMPTION_DB_RESULT.json',
    candidate_ref: database.candidate_ref,
    candidate_hash: database.candidate_hash,
    evaluation_ref: database.evaluation_ref,
    evaluation_hash: database.evaluation_hash,
    candidate_parameter_value: database.candidate_parameter_value,
    effective_tick_parameter_value: database.effective_tick_parameter_value,
    forecast_ref: database.forecast_ref,
    forecast_hash: database.forecast_hash,
    scenario_set_ref: database.scenario_set_ref,
    scenario_set_hash: database.scenario_set_hash,
  };
  fs.writeFileSync(INPUT_PATH, `${JSON.stringify(input, null, 2)}\n`, 'utf8');

  const governanceStage = executeStage({
    id: 'S9_GOVERNANCE',
    executable: process.execPath,
    args: ['scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S9_NON_CONSUMPTION.cjs'],
  });
  stageResults.push(governanceStage);
  requirePass(governanceStage);
  const governance = JSON.parse(fs.readFileSync(
    path.join(OUTPUT_DIR, 'MCFT_CAP_06_S9_NON_CONSUMPTION_GOVERNANCE_RESULT.json'),
    'utf8',
  ));

  const result = {
    schema_version: 'geox_mcft_cap_06_s9_non_consumption_preflight_result_v1',
    status: 'PASS',
    exact_head: input.exact_head,
    stage_count: stageResults.length,
    stages: stageResults,
    candidate_ref: database.candidate_ref,
    candidate_hash: database.candidate_hash,
    evaluation_ref: database.evaluation_ref,
    evaluation_hash: database.evaluation_hash,
    candidate_parameter_value: database.candidate_parameter_value,
    effective_tick_parameter_value: database.effective_tick_parameter_value,
    immutable_runtime_config_append_count: database.immutable_runtime_config_append_count,
    normal_tick_canonical_fact_append_count: database.normal_tick_canonical_fact_append_count,
    a1_canonical_fact_append_count: database.a1_canonical_fact_append_count,
    scenario_set_canonical_fact_append_count: database.scenario_set_canonical_fact_append_count,
    forecast_ref: database.forecast_ref,
    forecast_hash: database.forecast_hash,
    forecast_point_count: database.forecast_point_count,
    scenario_set_ref: database.scenario_set_ref,
    scenario_set_hash: database.scenario_set_hash,
    scenario_option_count: database.scenario_option_count,
    scenario_points_per_option: database.scenario_points_per_option,
    candidate_fact_delta: database.candidate_fact_delta,
    evaluation_fact_delta: database.evaluation_fact_delta,
    model_activation_count: database.model_activation_count,
    active_config_relation: database.active_config_relation,
    active_config_snapshot_changed: database.active_config_snapshot_changed,
    candidate_consumed: database.candidate_consumed,
    evaluation_consumed: database.evaluation_consumed,
    completed_rerun_additional_fact_count: database.completed_rerun_additional_fact_count,
    completed_rerun_evidence_load_count: database.completed_rerun_evidence_load_count,
    state_parameter_mutation_count: database.state_parameter_mutation_count,
    checkpoint_parameter_mutation_count: database.checkpoint_parameter_mutation_count,
    migration_count: database.migration_count,
    production_database_used: false,
    s9_candidate_implemented: governance.s9_candidate_implemented,
    s9_effective: governance.s9_effective,
    s10_authorized: governance.s10_authorized,
    new_prerequisite_inserted: governance.new_prerequisite_inserted,
  };
  fs.writeFileSync(RESULT_PATH, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(result));
}

main().catch((error) => {
  const result = {
    schema_version: 'geox_mcft_cap_06_s9_non_consumption_preflight_result_v1',
    status: 'FAIL',
    error: error instanceof Error ? error.message : String(error),
    candidate_fact_delta: 0,
    evaluation_fact_delta: 0,
    model_activation_count: 0,
    active_config_snapshot_changed: false,
    state_parameter_mutation_count: 0,
    checkpoint_parameter_mutation_count: 0,
    migration_count: 0,
    production_database_used: false,
    s9_effective: false,
    s10_authorized: false,
    new_prerequisite_inserted: false,
  };
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(RESULT_PATH, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  console.error(JSON.stringify(result));
  process.exitCode = 1;
});
