// Purpose: run the complete MCFT-CAP-06 S5 Candidate compute/commit preflight on one clean exact head and emit structured evidence across candidate and post-effectiveness governance states.
// Boundary: isolated acceptance databases only; no production database, Shadow Evaluation, Model Activation, active-config switch, Runtime parameter mutation, State/checkpoint mutation, route, Web, scheduler or CAP-07 authority.

'use strict';

const cp = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');

const ROOT = path.resolve(__dirname, '../..');
const OUTPUT_DIR = path.join(ROOT, 'acceptance-output');
const INPUT_PATH = path.join(OUTPUT_DIR, 'MCFT_CAP_06_S5_CANDIDATE_PREFLIGHT_INPUT.json');
const RESULT_PATH = path.join(OUTPUT_DIR, 'MCFT_CAP_06_S5_CANDIDATE_PREFLIGHT_RESULT.json');
const GOVERNANCE_RESULT_PATH = path.join(OUTPUT_DIR, 'MCFT_CAP_06_S5_CANDIDATE_GOVERNANCE_RESULT.json');
const GRAPH_DB = 'mcft_cap06_s5_candidate_graph_ci';
const CANDIDATE_DB = 'mcft_cap06_s5_candidate_commit_ci';

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
    throw new Error(`S5_CANDIDATE_PREFLIGHT_STAGE_FAILED:${stage.stage_id}:${stage.exit_code}`);
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
  if (!user || !host || !port) throw new Error('S5_CANDIDATE_POSTGRESQL_CONFIG_REQUIRED');
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
function governanceFrontier() {
  if (!fs.existsSync(GOVERNANCE_RESULT_PATH)) {
    return {
      s5_effective: false,
      s6_authorized: false,
      s6_implementation_started: false,
    };
  }
  const governance = readJson('acceptance-output/MCFT_CAP_06_S5_CANDIDATE_GOVERNANCE_RESULT.json');
  return {
    s5_effective: governance.s5_effective === true,
    s6_authorized: governance.s6_authorized === true,
    s6_implementation_started: governance.s6_implementation_started === true,
  };
}
function finalResult(status, stages, error) {
  const domain = fs.existsSync(path.join(OUTPUT_DIR, 'MCFT_CAP_06_S5_CANDIDATE_DOMAIN_RESULT.json'))
    ? readJson('acceptance-output/MCFT_CAP_06_S5_CANDIDATE_DOMAIN_RESULT.json')
    : null;
  const database = fs.existsSync(path.join(OUTPUT_DIR, 'MCFT_CAP_06_S5_CANDIDATE_DB_RESULT.json'))
    ? readJson('acceptance-output/MCFT_CAP_06_S5_CANDIDATE_DB_RESULT.json')
    : null;
  const frontier = governanceFrontier();
  return {
    schema_version: 'geox_mcft_cap_06_s5_candidate_preflight_result_v1',
    status,
    exact_head: git(['rev-parse', 'HEAD']),
    stages,
    calibration_case_count: database?.exact_calibration_case_count ?? domain?.calibration_case_count ?? 0,
    grid_point_count: domain?.grid_point_count ?? 0,
    selected_parameter_value: database?.selected_parameter_value ?? domain?.selected_parameter_value ?? null,
    controlled_candidate_append_count: database?.first_candidate_append_count ?? 0,
    completed_chain_rerun_candidate_append_count: database?.completed_chain_rerun_candidate_append_count ?? 0,
    production_candidate_append_count: 0,
    evaluation_append_count: 0,
    model_activation_count: 0,
    active_config_switch_count: 0,
    runtime_parameter_change_count: 0,
    state_mutation_count: 0,
    checkpoint_mutation_count: 0,
    migration_count: 0,
    production_database_used: false,
    s5_candidate_implemented: true,
    s5_effective: frontier.s5_effective,
    s6_authorized: frontier.s6_authorized,
    s6_implementation_started: frontier.s6_implementation_started,
    ...(error ? { error } : {}),
  };
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  if (git(['status', '--porcelain'])) throw new Error('S5_CANDIDATE_PREFLIGHT_CLEAN_HEAD_REQUIRED');
  for (const name of fs.readdirSync(OUTPUT_DIR)) {
    if (name.startsWith('MCFT_CAP_06_S5_CANDIDATE_')) {
      fs.rmSync(path.join(OUTPUT_DIR, name), { force: true });
    }
  }
  const baseDatabaseUrl = resolveBaseDatabaseUrl();
  const stages = [];
  let graphDbCreated = false;
  let candidateDbCreated = false;
  try {
    let stage = runStage('TYPECHECK', 'pnpm', ['-r', 'typecheck'], 'MCFT_CAP_06_S5_CANDIDATE_TYPECHECK.log');
    stages.push(stage); requirePass(stage);
    stage = runStage('BUILD', 'pnpm', ['-r', 'build'], 'MCFT_CAP_06_S5_CANDIDATE_BUILD.log');
    stages.push(stage); requirePass(stage);
    stage = runStage('S5_DOMAIN_CANDIDATE', 'pnpm', ['-w', 'exec', 'tsx', 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S5_CANDIDATE.ts'], 'MCFT_CAP_06_S5_CANDIDATE_DOMAIN.log');
    stages.push(stage); requirePass(stage);
    const domain = readJson('acceptance-output/MCFT_CAP_06_S5_CANDIDATE_DOMAIN_RESULT.json');
    if (domain.status !== 'PASS' || domain.selected_parameter_value !== '0.034000'
      || domain.first_candidate_append_count !== 1 || domain.completed_chain_rerun_candidate_append_count !== 0) {
      throw new Error('S5_CANDIDATE_DOMAIN_STRUCTURED_RESULT_INVALID');
    }
    stage = runStage('V2_DOMAIN_GRAPH_CONFORMANCE', 'pnpm', ['-w', 'exec', 'tsx', 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S5_PREDECESSOR_GRAPH_CONFORMANCE.ts'], 'MCFT_CAP_06_S5_CANDIDATE_GRAPH_DOMAIN.log');
    stages.push(stage); requirePass(stage);

    const graphUrl = await recreateDatabase(baseDatabaseUrl, GRAPH_DB);
    graphDbCreated = true;
    stage = runStage('V2_POSTGRESQL_EXACT_REF_CONFORMANCE', 'pnpm', ['-w', 'exec', 'tsx', 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S5_PREDECESSOR_GRAPH_CONFORMANCE_DB.ts'], 'MCFT_CAP_06_S5_CANDIDATE_GRAPH_DB.log', {
      DATABASE_URL: graphUrl,
      MCFT_CAP_06_S5_GRAPH_DESTRUCTIVE_ACCEPTANCE: '1',
    });
    stages.push(stage); requirePass(stage);
    await dropDatabase(baseDatabaseUrl, GRAPH_DB); graphDbCreated = false;

    stage = runStage('S2_EXACT_MATH_COMPATIBILITY', 'pnpm', ['-w', 'exec', 'tsx', 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S2_CONTRACTS_MATH.ts'], 'MCFT_CAP_06_S5_CANDIDATE_S2.log');
    stages.push(stage); requirePass(stage);
    const s2 = readJson('acceptance-output/MCFT_CAP_06_S2_CONTRACTS_MATH_RESULT.json');
    if (s2.status !== 'PASS' || s2.selected_parameter_value !== '0.034000'
      || s2.canonical_write_count !== 0 || s2.model_activation_count !== 0) {
      throw new Error('S5_CANDIDATE_S2_STRUCTURED_RESULT_INVALID');
    }

    stage = runStage('S3_PERSISTENCE_REGRESSION', 'node', ['scripts/runtime_acceptance/RUN_MCFT_CAP_06_S3_PERSISTENCE.cjs'], 'MCFT_CAP_06_S5_CANDIDATE_S3.log', { DATABASE_URL: baseDatabaseUrl });
    stages.push(stage); requirePass(stage);
    stage = runStage('S4_FORMAL_COMPOSITION', 'node', ['scripts/runtime_acceptance/RUN_MCFT_CAP_06_S4_STABILIZATION.cjs'], 'MCFT_CAP_06_S5_CANDIDATE_S4.log', { DATABASE_URL: baseDatabaseUrl });
    stages.push(stage); requirePass(stage);

    const candidateUrl = await recreateDatabase(baseDatabaseUrl, CANDIDATE_DB);
    candidateDbCreated = true;
    stage = runStage('S5_POSTGRESQL_CANDIDATE', 'pnpm', ['-w', 'exec', 'tsx', 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S5_CANDIDATE_DB.ts'], 'MCFT_CAP_06_S5_CANDIDATE_DB.log', {
      DATABASE_URL: candidateUrl,
      MCFT_CAP_06_S5_CANDIDATE_DESTRUCTIVE_ACCEPTANCE: '1',
    });
    stages.push(stage); requirePass(stage);
    const database = readJson('acceptance-output/MCFT_CAP_06_S5_CANDIDATE_DB_RESULT.json');
    if (database.status !== 'PASS' || database.selected_parameter_value !== '0.034000'
      || database.first_candidate_append_count !== 1
      || database.completed_chain_rerun_candidate_append_count !== 0
      || database.evaluation_append_count !== 0 || database.model_activation_count !== 0) {
      throw new Error('S5_CANDIDATE_DATABASE_STRUCTURED_RESULT_INVALID');
    }
    await dropDatabase(baseDatabaseUrl, CANDIDATE_DB); candidateDbCreated = false;

    writeJson(INPUT_PATH, {
      schema_version: 'geox_mcft_cap_06_s5_candidate_preflight_input_v1',
      status: 'READY_FOR_GOVERNANCE',
      exact_head: git(['rev-parse', 'HEAD']),
      stages,
      production_database_used: false,
      production_candidate_append_count: 0,
      evaluation_append_count: 0,
      model_activation_count: 0,
      active_config_switch_count: 0,
      runtime_parameter_change_count: 0,
      state_mutation_count: 0,
      checkpoint_mutation_count: 0,
      migration_count: 0,
      s5_candidate_implemented: true,
      s5_effective: false,
      s6_authorized: false,
      s6_implementation_started: false,
    });

    stage = runStage('STRUCTURED_GOVERNANCE_GATE', 'node', ['scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S5_CANDIDATE.cjs'], 'MCFT_CAP_06_S5_CANDIDATE_GOVERNANCE.log');
    requirePass(stage);
    const governance = readJson('acceptance-output/MCFT_CAP_06_S5_CANDIDATE_GOVERNANCE_RESULT.json');
    const baseGovernanceValid = governance.status === 'PASS'
      && governance.selected_parameter_value === '0.034000'
      && governance.production_candidate_append_count === 0
      && governance.evaluation_append_count === 0
      && governance.model_activation_count === 0
      && governance.active_config_switch_count === 0
      && governance.runtime_parameter_change_count === 0
      && governance.state_mutation_count === 0
      && governance.checkpoint_mutation_count === 0
      && governance.s5_candidate_implemented === true;
    const frontierValid = governance.s5_effective === true
      ? governance.s6_authorized === true && governance.s6_implementation_started === false
      : governance.s6_authorized === false && governance.s6_implementation_started === false;
    if (!baseGovernanceValid || !frontierValid) {
      throw new Error('S5_CANDIDATE_GOVERNANCE_STRUCTURED_RESULT_INVALID');
    }
    stages.push(stage);

    const result = finalResult('PASS', stages);
    writeJson(RESULT_PATH, result);
    console.log(JSON.stringify(result));
  } catch (error) {
    if (graphDbCreated) try { await dropDatabase(baseDatabaseUrl, GRAPH_DB); } catch {}
    if (candidateDbCreated) try { await dropDatabase(baseDatabaseUrl, CANDIDATE_DB); } catch {}
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
