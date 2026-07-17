// Purpose: run the complete MCFT-CAP-06 S6 paired historical shadow preflight on one clean exact head and emit structured evidence.
// Boundary: isolated acceptance databases only; no production database, canonical/projection write by S6, Evaluation commit, Model Activation, active-config switch, Runtime parameter mutation, State/checkpoint mutation, route, Web, scheduler, or CAP-07 authority.

'use strict';

const cp = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');

const ROOT = path.resolve(__dirname, '../..');
const OUTPUT_DIR = path.join(ROOT, 'acceptance-output');
const INPUT_PATH = path.join(OUTPUT_DIR, 'MCFT_CAP_06_S6_PAIRED_SHADOW_PREFLIGHT_INPUT.json');
const RESULT_PATH = path.join(OUTPUT_DIR, 'MCFT_CAP_06_S6_PAIRED_SHADOW_PREFLIGHT_RESULT.json');
const S5_DB = 'mcft_cap06_s6_s5_candidate_regression_ci';
const S6_DB = 'mcft_cap06_s6_paired_shadow_ci';

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
    throw new Error(`S6_PAIRED_SHADOW_PREFLIGHT_STAGE_FAILED:${stage.stage_id}:${stage.exit_code}`);
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
  if (!user || !host || !port) throw new Error('S6_PAIRED_SHADOW_POSTGRESQL_CONFIG_REQUIRED');
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
  const domain = fs.existsSync(path.join(OUTPUT_DIR, 'MCFT_CAP_06_S6_PAIRED_SHADOW_DOMAIN_RESULT.json'))
    ? readJson('acceptance-output/MCFT_CAP_06_S6_PAIRED_SHADOW_DOMAIN_RESULT.json')
    : null;
  const database = fs.existsSync(path.join(OUTPUT_DIR, 'MCFT_CAP_06_S6_PAIRED_SHADOW_DB_RESULT.json'))
    ? readJson('acceptance-output/MCFT_CAP_06_S6_PAIRED_SHADOW_DB_RESULT.json')
    : null;
  return {
    schema_version: 'geox_mcft_cap_06_s6_paired_shadow_preflight_result_v1',
    status,
    exact_head: git(['rev-parse', 'HEAD']),
    stages,
    candidate_ref: database?.candidate_ref ?? domain?.candidate_ref ?? null,
    candidate_hash: database?.candidate_hash ?? domain?.candidate_hash ?? null,
    candidate_parameter_value: database?.candidate_parameter_value ?? domain?.candidate_parameter_value ?? null,
    holdout_case_count: database?.exact_holdout_case_count ?? domain?.holdout_case_count ?? 0,
    evaluation_disposition: database?.evaluation_disposition ?? domain?.evaluation_disposition ?? null,
    reason_codes: database?.reason_codes ?? domain?.reason_codes ?? [],
    baseline_metrics: database?.baseline_metrics ?? domain?.baseline_metrics ?? null,
    candidate_metrics: database?.candidate_metrics ?? domain?.candidate_metrics ?? null,
    case_results_hash: database?.case_results_hash ?? domain?.case_results_hash ?? null,
    compute_determinism_hash: database?.compute_determinism_hash ?? domain?.compute_determinism_hash ?? null,
    deterministic_rerun_verified: database?.deterministic_rerun_verified ?? domain?.deterministic_rerun_verified ?? false,
    future_leakage_count: domain?.future_leakage_count ?? 0,
    production_database_used: false,
    canonical_fact_write_count: 0,
    projection_write_count: 0,
    candidate_append_count: 0,
    evaluation_append_count: 0,
    model_activation_count: 0,
    active_config_switch_count: 0,
    runtime_parameter_change_count: 0,
    state_mutation_count: 0,
    checkpoint_mutation_count: 0,
    migration_count: 0,
    s6_candidate_implemented: true,
    s6_effective: false,
    s7_authorized: false,
    ...(error ? { error } : {}),
  };
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  if (git(['status', '--porcelain'])) throw new Error('S6_PAIRED_SHADOW_PREFLIGHT_CLEAN_HEAD_REQUIRED');
  for (const name of fs.readdirSync(OUTPUT_DIR)) {
    if (name.startsWith('MCFT_CAP_06_S6_PAIRED_SHADOW_')) {
      fs.rmSync(path.join(OUTPUT_DIR, name), { force: true });
    }
  }
  const baseDatabaseUrl = resolveBaseDatabaseUrl();
  const stages = [];
  let s5DbCreated = false;
  let s6DbCreated = false;
  try {
    let stage = runStage('TYPECHECK', 'pnpm', ['-r', 'typecheck'], 'MCFT_CAP_06_S6_PAIRED_SHADOW_TYPECHECK.log');
    stages.push(stage); requirePass(stage);
    stage = runStage('BUILD', 'pnpm', ['-r', 'build'], 'MCFT_CAP_06_S6_PAIRED_SHADOW_BUILD.log');
    stages.push(stage); requirePass(stage);

    stage = runStage('S2_EXACT_MATH_REGRESSION', 'pnpm', ['-w', 'exec', 'tsx', 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S2_CONTRACTS_MATH.ts'], 'MCFT_CAP_06_S6_PAIRED_SHADOW_S2.log');
    stages.push(stage); requirePass(stage);
    const s2 = readJson('acceptance-output/MCFT_CAP_06_S2_CONTRACTS_MATH_RESULT.json');
    if (s2.status !== 'PASS' || s2.selected_parameter_value !== '0.034000'
      || s2.positive_shadow_disposition !== 'ELIGIBLE_FOR_HUMAN_ACTIVATION_REVIEW'
      || s2.canonical_write_count !== 0 || s2.model_activation_count !== 0) {
      throw new Error('S6_PAIRED_SHADOW_S2_REGRESSION_INVALID');
    }

    stage = runStage('S5_DOMAIN_CANDIDATE_REGRESSION', 'pnpm', ['-w', 'exec', 'tsx', 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S5_CANDIDATE.ts'], 'MCFT_CAP_06_S6_PAIRED_SHADOW_S5_DOMAIN.log');
    stages.push(stage); requirePass(stage);
    const s5Domain = readJson('acceptance-output/MCFT_CAP_06_S5_CANDIDATE_DOMAIN_RESULT.json');
    if (s5Domain.status !== 'PASS' || s5Domain.selected_parameter_value !== '0.034000') {
      throw new Error('S6_PAIRED_SHADOW_S5_DOMAIN_REGRESSION_INVALID');
    }

    const s5Url = await recreateDatabase(baseDatabaseUrl, S5_DB);
    s5DbCreated = true;
    stage = runStage('S5_POSTGRESQL_CANDIDATE_REGRESSION', 'pnpm', ['-w', 'exec', 'tsx', 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S5_CANDIDATE_DB.ts'], 'MCFT_CAP_06_S6_PAIRED_SHADOW_S5_DB.log', {
      DATABASE_URL: s5Url,
      MCFT_CAP_06_S5_CANDIDATE_DESTRUCTIVE_ACCEPTANCE: '1',
    });
    stages.push(stage); requirePass(stage);
    const s5Db = readJson('acceptance-output/MCFT_CAP_06_S5_CANDIDATE_DB_RESULT.json');
    if (s5Db.status !== 'PASS' || s5Db.selected_parameter_value !== '0.034000'
      || s5Db.first_candidate_append_count !== 1 || s5Db.completed_chain_rerun_candidate_append_count !== 0
      || s5Db.evaluation_append_count !== 0 || s5Db.model_activation_count !== 0) {
      throw new Error('S6_PAIRED_SHADOW_S5_DATABASE_REGRESSION_INVALID');
    }
    await dropDatabase(baseDatabaseUrl, S5_DB); s5DbCreated = false;

    stage = runStage('S6_DOMAIN_PAIRED_SHADOW', 'pnpm', ['-w', 'exec', 'tsx', 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S6_PAIRED_SHADOW.ts'], 'MCFT_CAP_06_S6_PAIRED_SHADOW_DOMAIN.log');
    stages.push(stage); requirePass(stage);
    const domain = readJson('acceptance-output/MCFT_CAP_06_S6_PAIRED_SHADOW_DOMAIN_RESULT.json');
    if (domain.status !== 'PASS' || domain.candidate_parameter_value !== '0.034000'
      || domain.holdout_case_count !== 8
      || domain.evaluation_disposition !== 'ELIGIBLE_FOR_HUMAN_ACTIVATION_REVIEW'
      || domain.deterministic_rerun_verified !== true
      || domain.future_leakage_count !== 0
      || domain.canonical_fact_write_count !== 0 || domain.projection_write_count !== 0) {
      throw new Error('S6_PAIRED_SHADOW_DOMAIN_RESULT_INVALID');
    }

    const s6Url = await recreateDatabase(baseDatabaseUrl, S6_DB);
    s6DbCreated = true;
    stage = runStage('S6_POSTGRESQL_ZERO_WRITE_SHADOW', 'pnpm', ['-w', 'exec', 'tsx', 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S6_PAIRED_SHADOW_DB.ts'], 'MCFT_CAP_06_S6_PAIRED_SHADOW_DB.log', {
      DATABASE_URL: s6Url,
      MCFT_CAP_06_S6_PAIRED_SHADOW_DESTRUCTIVE_ACCEPTANCE: '1',
    });
    stages.push(stage); requirePass(stage);
    const database = readJson('acceptance-output/MCFT_CAP_06_S6_PAIRED_SHADOW_DB_RESULT.json');
    if (database.status !== 'PASS' || database.candidate_parameter_value !== '0.034000'
      || database.exact_holdout_case_count !== 8
      || database.evaluation_disposition !== 'ELIGIBLE_FOR_HUMAN_ACTIVATION_REVIEW'
      || database.deterministic_rerun_verified !== true
      || database.fact_count_before_shadow !== database.fact_count_after_shadow
      || database.canonical_fact_write_count !== 0 || database.projection_write_count !== 0
      || database.evaluation_append_count !== 0 || database.model_activation_count !== 0) {
      throw new Error('S6_PAIRED_SHADOW_DATABASE_RESULT_INVALID');
    }
    await dropDatabase(baseDatabaseUrl, S6_DB); s6DbCreated = false;

    writeJson(INPUT_PATH, {
      schema_version: 'geox_mcft_cap_06_s6_paired_shadow_preflight_input_v1',
      status: 'READY_FOR_GOVERNANCE',
      exact_head: git(['rev-parse', 'HEAD']),
      stages,
      production_database_used: false,
      canonical_fact_write_count: 0,
      projection_write_count: 0,
      candidate_append_count: 0,
      evaluation_append_count: 0,
      model_activation_count: 0,
      active_config_switch_count: 0,
      runtime_parameter_change_count: 0,
      state_mutation_count: 0,
      checkpoint_mutation_count: 0,
      migration_count: 0,
      s6_candidate_implemented: true,
      s6_effective: false,
      s7_authorized: false,
    });

    stage = runStage('STRUCTURED_GOVERNANCE_GATE', 'node', ['scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S6_PAIRED_SHADOW.cjs'], 'MCFT_CAP_06_S6_PAIRED_SHADOW_GOVERNANCE.log');
    requirePass(stage);
    stages.push(stage);
    const governance = readJson('acceptance-output/MCFT_CAP_06_S6_PAIRED_SHADOW_GOVERNANCE_RESULT.json');
    if (governance.status !== 'PASS' || governance.candidate_parameter_value !== '0.034000'
      || governance.holdout_case_count !== 8
      || governance.evaluation_disposition !== 'ELIGIBLE_FOR_HUMAN_ACTIVATION_REVIEW'
      || governance.canonical_fact_write_count !== 0 || governance.projection_write_count !== 0
      || governance.evaluation_append_count !== 0 || governance.s6_effective !== false
      || governance.s7_authorized !== false) {
      throw new Error('S6_PAIRED_SHADOW_GOVERNANCE_RESULT_INVALID');
    }

    const result = finalResult('PASS', stages);
    writeJson(RESULT_PATH, result);
    console.log(JSON.stringify(result));
  } catch (error) {
    if (s5DbCreated) try { await dropDatabase(baseDatabaseUrl, S5_DB); } catch {}
    if (s6DbCreated) try { await dropDatabase(baseDatabaseUrl, S6_DB); } catch {}
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
