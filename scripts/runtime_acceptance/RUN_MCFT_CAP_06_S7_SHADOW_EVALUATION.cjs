// Purpose: run the complete MCFT-CAP-06 S7 Shadow Evaluation commit preflight on one clean exact head and emit structured evidence.
// Boundary: disposable PostgreSQL only; no production database, alternative shadow compute, Model Activation, active-config switch, Runtime parameter mutation, State/checkpoint mutation, route, Web, scheduler or CAP-07 authority.

'use strict';

const cp = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');

const ROOT = path.resolve(__dirname, '../..');
const OUTPUT_DIR = path.join(ROOT, 'acceptance-output');
const INPUT_PATH = path.join(OUTPUT_DIR, 'MCFT_CAP_06_S7_SHADOW_EVALUATION_PREFLIGHT_INPUT.json');
const RESULT_PATH = path.join(OUTPUT_DIR, 'MCFT_CAP_06_S7_SHADOW_EVALUATION_PREFLIGHT_RESULT.json');
const S6_DB = 'mcft_cap06_s7_s6_shadow_regression_ci';
const S7_DB = 'mcft_cap06_s7_evaluation_ci';

function executable(name) {
  return process.platform === 'win32' && name === 'pnpm' ? 'pnpm.cmd' : name;
}
function git(args) {
  return cp.execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}
function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
function readJson(relative) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8'));
}
function runStage(stageId, command, args, logName, env = {}) {
  const startedAt = new Date().toISOString();
  const result = cp.spawnSync(executable(command), args, {
    cwd: ROOT,
    env: { ...process.env, ...env },
    encoding: 'utf8',
    shell: false,
    stdio: 'pipe',
    maxBuffer: 256 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  const output = `${String(result.stdout || '')}${String(result.stderr || '')}`;
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUTPUT_DIR, logName), output, 'utf8');
  process.stdout.write(String(result.stdout || ''));
  process.stderr.write(String(result.stderr || ''));
  return {
    stage_id: stageId,
    status: result.status === 0 ? 'PASS' : 'FAIL',
    exit_code: result.status === null ? 1 : result.status,
    started_at: startedAt,
    completed_at: new Date().toISOString(),
    command: [command, ...args],
    log_ref: `acceptance-output/${logName}`,
    log_sha256: crypto.createHash('sha256').update(output).digest('hex'),
  };
}
function requirePass(stage) {
  if (stage.status !== 'PASS' || stage.exit_code !== 0) {
    throw new Error(`S7_SHADOW_EVALUATION_PREFLIGHT_STAGE_FAILED:${stage.stage_id}:${stage.exit_code}`);
  }
}
function databaseUrlFor(baseUrl, databaseName) {
  const parsed = new URL(baseUrl);
  parsed.pathname = `/${databaseName}`;
  parsed.search = '';
  parsed.hash = '';
  return parsed.toString();
}
function resolveBaseDatabaseUrl() {
  const explicit = String(process.env.DATABASE_URL || '').trim();
  if (explicit) return explicit;
  const user = String(process.env.POSTGRES_USER || '').trim();
  const password = String(process.env.POSTGRES_PASSWORD || '').trim();
  const database = String(process.env.POSTGRES_DB || 'postgres').trim();
  const host = String(process.env.POSTGRES_HOST || '127.0.0.1').trim();
  const port = String(process.env.POSTGRES_PORT || '5432').trim();
  if (!user || !host || !port) throw new Error('S7_SHADOW_EVALUATION_POSTGRESQL_CONFIG_REQUIRED');
  const credential = password
    ? `${encodeURIComponent(user)}:${encodeURIComponent(password)}`
    : encodeURIComponent(user);
  return `postgres://${credential}@${host}:${port}/${encodeURIComponent(database)}`;
}
async function recreateDatabase(baseUrl, databaseName) {
  const admin = new Pool({ connectionString: databaseUrlFor(baseUrl, 'postgres') });
  try {
    await admin.query(
      `SELECT pg_terminate_backend(pid)
         FROM pg_stat_activity
        WHERE datname=$1
          AND pid<>pg_backend_pid()`,
      [databaseName],
    );
    await admin.query(`DROP DATABASE IF EXISTS ${databaseName}`);
    await admin.query(`CREATE DATABASE ${databaseName}`);
  } finally {
    await admin.end();
  }
  return databaseUrlFor(baseUrl, databaseName);
}
async function dropDatabase(baseUrl, databaseName) {
  const admin = new Pool({ connectionString: databaseUrlFor(baseUrl, 'postgres') });
  try {
    await admin.query(
      `SELECT pg_terminate_backend(pid)
         FROM pg_stat_activity
        WHERE datname=$1
          AND pid<>pg_backend_pid()`,
      [databaseName],
    );
    await admin.query(`DROP DATABASE IF EXISTS ${databaseName}`);
  } finally {
    await admin.end();
  }
}
function finalResult(status, stages, error) {
  const domain = fs.existsSync(path.join(OUTPUT_DIR, 'MCFT_CAP_06_S7_SHADOW_EVALUATION_DOMAIN_RESULT.json'))
    ? readJson('acceptance-output/MCFT_CAP_06_S7_SHADOW_EVALUATION_DOMAIN_RESULT.json')
    : null;
  const database = fs.existsSync(path.join(OUTPUT_DIR, 'MCFT_CAP_06_S7_SHADOW_EVALUATION_DB_RESULT.json'))
    ? readJson('acceptance-output/MCFT_CAP_06_S7_SHADOW_EVALUATION_DB_RESULT.json')
    : null;
  return {
    schema_version: 'geox_mcft_cap_06_s7_shadow_evaluation_preflight_result_v1',
    status,
    exact_head: git(['rev-parse', 'HEAD']),
    stages,
    source_s6_artifact_hash: database?.source_s6_artifact_hash ?? domain?.source_s6_artifact_hash ?? null,
    source_s6_case_results_hash: database?.source_s6_case_results_hash ?? domain?.source_s6_case_results_hash ?? null,
    source_s6_compute_determinism_hash: database?.source_s6_compute_determinism_hash ?? domain?.source_s6_compute_determinism_hash ?? null,
    candidate_ref: database?.candidate_ref ?? domain?.candidate_ref ?? null,
    candidate_hash: database?.candidate_hash ?? domain?.candidate_hash ?? null,
    candidate_parameter_value: database?.candidate_parameter_value ?? domain?.candidate_parameter_value ?? null,
    holdout_case_count: database?.holdout_case_count ?? domain?.holdout_case_count ?? 0,
    evaluation_ref: database?.evaluation_ref ?? domain?.evaluation_ref ?? null,
    evaluation_hash: database?.evaluation_hash ?? domain?.evaluation_hash ?? null,
    evaluation_disposition: database?.evaluation_disposition ?? domain?.evaluation_disposition ?? null,
    reason_codes: database?.reason_codes ?? domain?.reason_codes ?? [],
    first_evaluation_append_count: database?.first_evaluation_append_count ?? domain?.first_evaluation_append_count ?? 0,
    completed_chain_rerun_evaluation_append_count: database?.completed_chain_rerun_evaluation_append_count ?? domain?.completed_chain_rerun_evaluation_append_count ?? 0,
    aggregate_projection_count: database?.aggregate_projection_count ?? domain?.aggregate_projection_count ?? 0,
    candidate_evaluation_index_count: database?.candidate_evaluation_index_count ?? domain?.candidate_evaluation_index_count ?? 0,
    case_projection_count: database?.case_projection_count ?? domain?.case_projection_count ?? 0,
    canonical_readback_verified: database?.canonical_readback_verified ?? domain?.canonical_readback_verified ?? false,
    production_database_used: false,
    candidate_append_count: 0,
    model_activation_count: 0,
    active_config_switch_count: 0,
    runtime_parameter_change_count: 0,
    state_mutation_count: 0,
    checkpoint_mutation_count: 0,
    migration_count: 0,
    s7_candidate_implemented: true,
    s7_effective: false,
    s8_authorized: false,
    ...(error ? { error } : {}),
  };
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  if (git(['status', '--porcelain'])) throw new Error('S7_SHADOW_EVALUATION_PREFLIGHT_CLEAN_HEAD_REQUIRED');
  for (const name of fs.readdirSync(OUTPUT_DIR)) {
    if (name.startsWith('MCFT_CAP_06_S7_SHADOW_EVALUATION_')) {
      fs.rmSync(path.join(OUTPUT_DIR, name), { force: true });
    }
  }
  const baseDatabaseUrl = resolveBaseDatabaseUrl();
  const stages = [];
  let s6DbCreated = false;
  let s7DbCreated = false;
  try {
    let stage = runStage('TYPECHECK', 'pnpm', ['-r', 'typecheck'], 'MCFT_CAP_06_S7_SHADOW_EVALUATION_TYPECHECK.log');
    stages.push(stage); requirePass(stage);
    stage = runStage('BUILD', 'pnpm', ['-r', 'build'], 'MCFT_CAP_06_S7_SHADOW_EVALUATION_BUILD.log');
    stages.push(stage); requirePass(stage);

    stage = runStage('S3_PERSISTENCE_REGRESSION', 'node', ['scripts/runtime_acceptance/RUN_MCFT_CAP_06_S3_PERSISTENCE.cjs'], 'MCFT_CAP_06_S7_SHADOW_EVALUATION_S3.log', {
      DATABASE_URL: baseDatabaseUrl,
    });
    stages.push(stage); requirePass(stage);

    stage = runStage('S6_DOMAIN_REGRESSION', 'pnpm', ['-w', 'exec', 'tsx', 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S6_PAIRED_SHADOW.ts'], 'MCFT_CAP_06_S7_SHADOW_EVALUATION_S6_DOMAIN.log');
    stages.push(stage); requirePass(stage);
    const s6Domain = readJson('acceptance-output/MCFT_CAP_06_S6_PAIRED_SHADOW_DOMAIN_RESULT.json');
    if (s6Domain.status !== 'PASS' || s6Domain.candidate_parameter_value !== '0.034000'
      || s6Domain.holdout_case_count !== 8
      || s6Domain.evaluation_disposition !== 'ELIGIBLE_FOR_HUMAN_ACTIVATION_REVIEW'
      || s6Domain.deterministic_rerun_verified !== true || s6Domain.future_leakage_count !== 0) {
      throw new Error('S7_SHADOW_EVALUATION_S6_DOMAIN_REGRESSION_INVALID');
    }

    const s6Url = await recreateDatabase(baseDatabaseUrl, S6_DB);
    s6DbCreated = true;
    stage = runStage('S6_POSTGRESQL_REGRESSION', 'pnpm', ['-w', 'exec', 'tsx', 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S6_PAIRED_SHADOW_DB.ts'], 'MCFT_CAP_06_S7_SHADOW_EVALUATION_S6_DB.log', {
      DATABASE_URL: s6Url,
      MCFT_CAP_06_S6_PAIRED_SHADOW_DESTRUCTIVE_ACCEPTANCE: '1',
    });
    stages.push(stage); requirePass(stage);
    const s6Db = readJson('acceptance-output/MCFT_CAP_06_S6_PAIRED_SHADOW_DB_RESULT.json');
    if (s6Db.status !== 'PASS' || s6Db.candidate_parameter_value !== '0.034000'
      || s6Db.exact_holdout_case_count !== 8
      || s6Db.evaluation_disposition !== 'ELIGIBLE_FOR_HUMAN_ACTIVATION_REVIEW'
      || s6Db.deterministic_rerun_verified !== true
      || s6Db.fact_count_before_shadow !== s6Db.fact_count_after_shadow
      || s6Db.evaluation_append_count !== 0 || s6Db.model_activation_count !== 0) {
      throw new Error('S7_SHADOW_EVALUATION_S6_DATABASE_REGRESSION_INVALID');
    }
    await dropDatabase(baseDatabaseUrl, S6_DB); s6DbCreated = false;

    stage = runStage('S7_DOMAIN_EVALUATION', 'pnpm', ['-w', 'exec', 'tsx', 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S7_SHADOW_EVALUATION.ts'], 'MCFT_CAP_06_S7_SHADOW_EVALUATION_DOMAIN.log');
    stages.push(stage); requirePass(stage);
    const domain = readJson('acceptance-output/MCFT_CAP_06_S7_SHADOW_EVALUATION_DOMAIN_RESULT.json');
    if (domain.status !== 'PASS' || domain.candidate_parameter_value !== '0.034000'
      || domain.holdout_case_count !== 8
      || domain.evaluation_disposition !== 'ELIGIBLE_FOR_HUMAN_ACTIVATION_REVIEW'
      || domain.first_evaluation_append_count !== 1
      || domain.completed_chain_rerun_evaluation_append_count !== 0
      || domain.aggregate_projection_count !== 1
      || domain.candidate_evaluation_index_count !== 1
      || domain.case_projection_count !== 8
      || domain.canonical_readback_verified !== true
      || domain.candidate_append_count !== 0 || domain.model_activation_count !== 0) {
      throw new Error('S7_SHADOW_EVALUATION_DOMAIN_RESULT_INVALID');
    }

    const s7Url = await recreateDatabase(baseDatabaseUrl, S7_DB);
    s7DbCreated = true;
    stage = runStage('S7_POSTGRESQL_EVALUATION', 'pnpm', ['-w', 'exec', 'tsx', 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S7_SHADOW_EVALUATION_DB.ts'], 'MCFT_CAP_06_S7_SHADOW_EVALUATION_DB.log', {
      DATABASE_URL: s7Url,
      MCFT_CAP_06_S7_SHADOW_EVALUATION_DESTRUCTIVE_ACCEPTANCE: '1',
    });
    stages.push(stage); requirePass(stage);
    const database = readJson('acceptance-output/MCFT_CAP_06_S7_SHADOW_EVALUATION_DB_RESULT.json');
    if (database.status !== 'PASS' || database.candidate_parameter_value !== '0.034000'
      || database.holdout_case_count !== 8
      || database.evaluation_disposition !== 'ELIGIBLE_FOR_HUMAN_ACTIVATION_REVIEW'
      || database.first_evaluation_append_count !== 1
      || database.completed_chain_rerun_evaluation_append_count !== 0
      || database.aggregate_projection_count !== 1
      || database.candidate_evaluation_index_count !== 1
      || database.case_projection_count !== 8
      || database.canonical_readback_verified !== true
      || database.fact_count_after_evaluation !== database.fact_count_before_evaluation + 1
      || database.candidate_append_count !== 0 || database.model_activation_count !== 0) {
      throw new Error('S7_SHADOW_EVALUATION_DATABASE_RESULT_INVALID');
    }
    await dropDatabase(baseDatabaseUrl, S7_DB); s7DbCreated = false;

    writeJson(INPUT_PATH, {
      schema_version: 'geox_mcft_cap_06_s7_shadow_evaluation_preflight_input_v1',
      status: 'READY_FOR_GOVERNANCE',
      exact_head: git(['rev-parse', 'HEAD']),
      stages,
      production_database_used: false,
      candidate_append_count: 0,
      model_activation_count: 0,
      active_config_switch_count: 0,
      runtime_parameter_change_count: 0,
      state_mutation_count: 0,
      checkpoint_mutation_count: 0,
      migration_count: 0,
      s7_candidate_implemented: true,
      s7_effective: false,
      s8_authorized: false,
    });

    stage = runStage('STRUCTURED_GOVERNANCE_GATE', 'node', ['scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S7_SHADOW_EVALUATION.cjs'], 'MCFT_CAP_06_S7_SHADOW_EVALUATION_GOVERNANCE.log');
    requirePass(stage);
    stages.push(stage);
    const governance = readJson('acceptance-output/MCFT_CAP_06_S7_SHADOW_EVALUATION_GOVERNANCE_RESULT.json');
    if (governance.status !== 'PASS'
      || governance.first_evaluation_append_count !== 1
      || governance.completed_chain_rerun_evaluation_append_count !== 0
      || governance.aggregate_projection_count !== 1
      || governance.candidate_evaluation_index_count !== 1
      || governance.case_projection_count !== 8
      || governance.canonical_readback_verified !== true
      || governance.candidate_append_count !== 0 || governance.model_activation_count !== 0
      || governance.s7_effective !== false || governance.s8_authorized !== false) {
      throw new Error('S7_SHADOW_EVALUATION_GOVERNANCE_RESULT_INVALID');
    }

    const result = finalResult('PASS', stages);
    writeJson(RESULT_PATH, result);
    console.log(JSON.stringify(result));
  } catch (error) {
    if (s6DbCreated) try { await dropDatabase(baseDatabaseUrl, S6_DB); } catch {}
    if (s7DbCreated) try { await dropDatabase(baseDatabaseUrl, S7_DB); } catch {}
    const result = finalResult('FAIL', stages, error instanceof Error ? error.message : String(error));
    writeJson(RESULT_PATH, result);
    console.error(JSON.stringify(result));
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exitCode = 1;
});
