// scripts/runtime_acceptance/RUN_MCFT_CAP_06_S5_PREDECESSOR_GRAPH_CONFORMANCE.cjs
// Purpose: run the complete S5 predecessor graph/dual-time prerequisite preflight on one clean exact head and emit structured evidence.
// Boundary: isolated acceptance databases only; no production database, Candidate/Evaluation append, Model Activation, active-config switch, State/checkpoint mutation, route, Web, scheduler, or CAP-07 authority.

'use strict';

const cp = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');

const ROOT = path.resolve(__dirname, '../..');
const OUTPUT_DIR = path.join(ROOT, 'acceptance-output');
const INPUT_PATH = path.join(OUTPUT_DIR, 'MCFT_CAP_06_S5_PREDECESSOR_GRAPH_PREFLIGHT_INPUT.json');
const GOVERNANCE_PATH = path.join(OUTPUT_DIR, 'MCFT_CAP_06_S5_PREDECESSOR_GRAPH_GOVERNANCE_RESULT.json');
const RESULT_PATH = path.join(OUTPUT_DIR, 'MCFT_CAP_06_S5_PREDECESSOR_GRAPH_PREFLIGHT_RESULT.json');
const GRAPH_DB_NAME = 'mcft_cap06_s5_graph_conformance_ci';

function executable(name) {
  return process.platform === 'win32' && name === 'pnpm' ? 'pnpm.cmd' : name;
}

function git(args) {
  return cp.execFileSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
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
  const logPath = path.join(OUTPUT_DIR, logName);
  fs.writeFileSync(logPath, output, 'utf8');
  const stage = {
    stage_id: stageId,
    status: result.status === 0 ? 'PASS' : 'FAIL',
    exit_code: result.status === null ? 1 : result.status,
    started_at: startedAt,
    completed_at: new Date().toISOString(),
    command: [command, ...args],
    log_ref: `acceptance-output/${logName}`,
    log_sha256: crypto.createHash('sha256').update(output).digest('hex'),
  };
  process.stdout.write(String(result.stdout || ''));
  process.stderr.write(String(result.stderr || ''));
  return stage;
}

function requirePass(stage) {
  if (stage.status !== 'PASS' || stage.exit_code !== 0) {
    throw new Error(`S5_GRAPH_PREFLIGHT_STAGE_FAILED:${stage.stage_id}:${stage.exit_code}`);
  }
}

function readJson(relative) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8'));
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
  if (!user || !host || !port) throw new Error('S5_GRAPH_POSTGRESQL_CONFIG_REQUIRED');
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

function validateS1Evidence() {
  const result = readJson('acceptance-output/MCFT_CAP_06_S1_CONTROLLED_REGIMES_RESULT.json');
  if (result.schema_version !== 'geox_mcft_cap_06_s1_controlled_regime_acceptance_v1'
    || result.successor_readiness_precondition_status !== 'PASS'
    || result.total_case_count !== 24
    || result.calibration_case_count !== 16
    || result.holdout_case_count !== 8
    || result.residual_set_hash !== 'sha256:7995da1a8c5221c207087b30bb66a60ac2054e0616338f275ffaf72a01857e60'
    || result.case_input_set_hash !== 'sha256:cb3bd4c273134071e931e8f85765b028ce58986752e94da3902f8563ddba4bb3') {
    throw new Error('S5_GRAPH_S1_STRUCTURED_EVIDENCE_INVALID');
  }
}

function validateS2Evidence() {
  const result = readJson('acceptance-output/MCFT_CAP_06_S2_CONTRACTS_MATH_RESULT.json');
  if (result.schema_version !== 'geox_mcft_cap_06_s2_acceptance_result_v1'
    || result.status !== 'PASS'
    || result.selected_parameter_value !== '0.034000'
    || result.canonical_write_count !== 0
    || result.projection_write_count !== 0
    || result.model_activation_count !== 0) {
    throw new Error('S5_GRAPH_S2_STRUCTURED_EVIDENCE_INVALID');
  }
}

function finalResult(status, stages, error) {
  return {
    schema_version: 'geox_mcft_cap_06_s5_predecessor_graph_preflight_result_v1',
    status,
    exact_head: git(['rev-parse', 'HEAD']),
    stages,
    authority_graph_version: 2,
    exact_graph_case_count: 24,
    delayed_availability_case_count: 24,
    selected_parameter_value: '0.034000',
    canonical_write_count: 0,
    candidate_append_count: 0,
    evaluation_append_count: 0,
    model_activation_count: 0,
    active_config_switch_count: 0,
    runtime_parameter_change_count: 0,
    state_mutation_count: 0,
    checkpoint_mutation_count: 0,
    migration_count: 0,
    production_database_used: false,
    s5_authorized: false,
    s5_implementation_started: false,
    ...(error ? { error } : {}),
  };
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const dirtyBefore = git(['status', '--porcelain']);
  if (dirtyBefore) throw new Error('S5_GRAPH_PREFLIGHT_CLEAN_HEAD_REQUIRED');

  for (const name of fs.readdirSync(OUTPUT_DIR)) {
    if (name.startsWith('MCFT_CAP_06_S5_PREDECESSOR_GRAPH_')) {
      fs.rmSync(path.join(OUTPUT_DIR, name), { force: true });
    }
  }

  const baseDatabaseUrl = resolveBaseDatabaseUrl();
  const stages = [];
  let graphDatabaseCreated = false;
  try {
    const typecheck = runStage('TYPECHECK', 'pnpm', ['-r', 'typecheck'], 'MCFT_CAP_06_S5_GRAPH_TYPECHECK.log');
    stages.push(typecheck); requirePass(typecheck);

    const build = runStage('BUILD', 'pnpm', ['-r', 'build'], 'MCFT_CAP_06_S5_GRAPH_BUILD.log');
    stages.push(build); requirePass(build);

    const s1 = runStage(
      'S1_NUMERICAL_BASELINE_REGRESSION',
      'pnpm',
      ['-w', 'exec', 'tsx', 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S1_CONTROLLED_REGIMES.ts'],
      'MCFT_CAP_06_S5_GRAPH_S1_REGRESSION.log',
    );
    stages.push(s1); requirePass(s1); validateS1Evidence();

    const domain = runStage(
      'V2_DOMAIN_GRAPH_CONFORMANCE',
      'pnpm',
      ['-w', 'exec', 'tsx', 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S5_PREDECESSOR_GRAPH_CONFORMANCE.ts'],
      'MCFT_CAP_06_S5_GRAPH_DOMAIN.log',
    );
    stages.push(domain); requirePass(domain);

    const graphDatabaseUrl = await recreateDatabase(baseDatabaseUrl, GRAPH_DB_NAME);
    graphDatabaseCreated = true;
    const database = runStage(
      'V2_POSTGRESQL_EXACT_REF_CONFORMANCE',
      'pnpm',
      ['-w', 'exec', 'tsx', 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S5_PREDECESSOR_GRAPH_CONFORMANCE_DB.ts'],
      'MCFT_CAP_06_S5_GRAPH_POSTGRESQL.log',
      {
        DATABASE_URL: graphDatabaseUrl,
        MCFT_CAP_06_S5_GRAPH_DESTRUCTIVE_ACCEPTANCE: '1',
      },
    );
    stages.push(database); requirePass(database);
    await dropDatabase(baseDatabaseUrl, GRAPH_DB_NAME);
    graphDatabaseCreated = false;

    const s2 = runStage(
      'S2_EXACT_MATH_COMPATIBILITY',
      'pnpm',
      ['-w', 'exec', 'tsx', 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S2_CONTRACTS_MATH.ts'],
      'MCFT_CAP_06_S5_GRAPH_S2_REGRESSION.log',
    );
    stages.push(s2); requirePass(s2); validateS2Evidence();

    const s3 = runStage(
      'S3_PERSISTENCE_REGRESSION',
      'node',
      ['scripts/runtime_acceptance/RUN_MCFT_CAP_06_S3_PERSISTENCE.cjs'],
      'MCFT_CAP_06_S5_GRAPH_S3_REGRESSION.log',
      { DATABASE_URL: baseDatabaseUrl },
    );
    stages.push(s3); requirePass(s3);

    const s4 = runStage(
      'S4_DOMAIN_AND_FORMAL_COMPOSITION',
      'node',
      ['scripts/runtime_acceptance/RUN_MCFT_CAP_06_S4_STABILIZATION.cjs'],
      'MCFT_CAP_06_S5_GRAPH_S4_REGRESSION.log',
      { DATABASE_URL: baseDatabaseUrl },
    );
    stages.push(s4); requirePass(s4); validateS2Evidence();

    const s4Governance = runStage(
      'S4_STRUCTURED_GOVERNANCE_REGRESSION',
      'node',
      ['scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S4_EFFECTIVENESS_S5_AUTHORIZATION.cjs'],
      'MCFT_CAP_06_S5_GRAPH_S4_GOVERNANCE.log',
    );
    stages.push(s4Governance); requirePass(s4Governance);

    const entry = runStage(
      'S5_ENTRY_EFFECTIVENESS_REGRESSION',
      'node',
      ['scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S5_ENTRY_EFFECTIVENESS.cjs'],
      'MCFT_CAP_06_S5_GRAPH_ENTRY_EFFECTIVENESS.log',
    );
    stages.push(entry); requirePass(entry);

    writeJson(INPUT_PATH, {
      schema_version: 'geox_mcft_cap_06_s5_predecessor_graph_preflight_input_v1',
      status: 'READY_FOR_GOVERNANCE',
      exact_head: git(['rev-parse', 'HEAD']),
      stages,
      canonical_write_count: 0,
      candidate_append_count: 0,
      evaluation_append_count: 0,
      model_activation_count: 0,
      active_config_switch_count: 0,
      state_mutation_count: 0,
      checkpoint_mutation_count: 0,
      production_database_used: false,
      s5_authorized: false,
      s5_implementation_started: false,
    });

    const governance = runStage(
      'STRUCTURED_GOVERNANCE_GATE',
      'node',
      ['scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S5_PREDECESSOR_GRAPH_CONFORMANCE.cjs'],
      'MCFT_CAP_06_S5_GRAPH_GOVERNANCE.log',
    );
    requirePass(governance);
    const governanceResult = readJson('acceptance-output/MCFT_CAP_06_S5_PREDECESSOR_GRAPH_GOVERNANCE_RESULT.json');
    if (governanceResult.schema_version !== 'geox_mcft_cap_06_s5_predecessor_graph_governance_result_v1'
      || governanceResult.status !== 'PASS'
      || governanceResult.canonical_write_count !== 0
      || governanceResult.s5_authorized !== false) {
      throw new Error('S5_GRAPH_GOVERNANCE_STRUCTURED_RESULT_INVALID');
    }
    stages.push({
      ...governance,
      structured_evidence_ref: 'acceptance-output/MCFT_CAP_06_S5_PREDECESSOR_GRAPH_GOVERNANCE_RESULT.json',
    });

    const result = finalResult('PASS', stages);
    writeJson(RESULT_PATH, result);
    console.log(JSON.stringify(result));
  } catch (error) {
    if (graphDatabaseCreated) {
      try { await dropDatabase(baseDatabaseUrl, GRAPH_DB_NAME); } catch { /* preserve primary failure */ }
    }
    const message = error instanceof Error ? error.message : String(error);
    const result = finalResult('FAIL', stages, message);
    writeJson(RESULT_PATH, result);
    console.error(JSON.stringify(result));
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exitCode = 1;
});
