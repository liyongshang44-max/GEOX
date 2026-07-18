// Purpose: run the complete MCFT-CAP-06 S10 bounded-chain preflight across two namespaced controlled PostgreSQL stages and a separate repository-history PostgreSQL track, then emit one structured result.
// Boundary: acceptance orchestration only; no production database, Runtime source, migration, Model Activation, active-config switch, public route, Web, scheduler, or CAP-07 authority.

'use strict';

const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');

const ROOT = path.resolve(__dirname, '../..');
const OUTPUT_DIR = path.join(ROOT, 'acceptance-output');
const RESULT_PATH = path.join(OUTPUT_DIR, 'MCFT_CAP_06_S10_BOUNDED_CHAIN_PREFLIGHT_RESULT.json');
const INPUT_PATH = path.join(OUTPUT_DIR, 'MCFT_CAP_06_S10_BOUNDED_CHAIN_GOVERNANCE_INPUT.json');
const CONTROLLED_DATABASE_NAME = 'mcft_cap06_s10_bounded_chain_ci';
const PNPM = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const STAGES = [
  { id: 'TYPECHECK', executable: PNPM, args: ['-r', 'typecheck'] },
  { id: 'BUILD', executable: PNPM, args: ['-r', 'build'] },
];
const S10_REPOSITORY_ASSESSMENT = Object.freeze({
  READY_FOR_CALIBRATION_ASSESSMENT: 'REPOSITORY_HISTORY_READY_FOR_CALIBRATION_ASSESSMENT',
  INSUFFICIENT_MATCHED_PAIRS: 'INSUFFICIENT_REPOSITORY_HISTORY_FOR_CALIBRATION_ASSESSMENT',
  CONFIG_OR_MODEL_HETEROGENEITY: 'REPOSITORY_HISTORY_CONFIG_OR_MODEL_HETEROGENEITY',
  AVAILABILITY_ORDER_INVALID: 'REPOSITORY_HISTORY_AVAILABILITY_ORDER_INVALID',
  INVALID_CASE_GRAPH: 'REPOSITORY_HISTORY_INVALID_CASE_GRAPH',
});

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
    throw new Error('MCFT_CAP_06_S10_POSTGRESQL_ACCEPTANCE_DATABASE_CONFIG_REQUIRED');
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
async function recreateDatabase(baseDatabaseUrl, databaseName) {
  await withAdminPool(baseDatabaseUrl, async (admin) => {
    await admin.query(
      `SELECT pg_terminate_backend(pid)
         FROM pg_stat_activity
        WHERE datname=$1
          AND pid<>pg_backend_pid()`,
      [databaseName],
    );
    await admin.query(`DROP DATABASE IF EXISTS ${databaseName}`);
    await admin.query(`CREATE DATABASE ${databaseName}`);
  });
  const isolated = new URL(baseDatabaseUrl);
  isolated.pathname = `/${databaseName}`;
  return isolated.toString();
}
async function dropDatabase(baseDatabaseUrl, databaseName) {
  await withAdminPool(baseDatabaseUrl, async (admin) => {
    await admin.query(
      `SELECT pg_terminate_backend(pid)
         FROM pg_stat_activity
        WHERE datname=$1
          AND pid<>pg_backend_pid()`,
      [databaseName],
    );
    await admin.query(`DROP DATABASE IF EXISTS ${databaseName}`);
  });
}
function executeStage(stage, env = {}) {
  const startedAt = new Date().toISOString();
  const result = run(stage.executable, stage.args, { env });
  const completedAt = new Date().toISOString();
  const stdout = String(result.stdout || '');
  const stderr = String(result.stderr || '');
  fs.writeFileSync(path.join(OUTPUT_DIR, `MCFT_CAP_06_S10_${stage.id}.log`), `${stdout}${stderr}`, 'utf8');
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
  if (stage.status !== 'PASS') throw new Error(`MCFT_CAP_06_S10_STAGE_FAILED:${stage.stage_id}`);
}
function scopeKey(scope) {
  return ['tenant_id', 'project_id', 'group_id', 'field_id', 'season_id', 'zone_id']
    .map((key) => String(scope?.[key] || ''))
    .join('|');
}
function repositoryAssessmentStatus(sourceStatus) {
  const mapped = S10_REPOSITORY_ASSESSMENT[sourceStatus];
  if (!mapped) throw new Error(`MCFT_CAP_06_S10_REPOSITORY_STATUS_UNMAPPED:${sourceStatus}`);
  return mapped;
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const baseDatabaseUrl = resolveBaseDatabaseUrl();
  const stages = [];
  for (const stage of STAGES) {
    const result = executeStage(stage);
    stages.push(result);
    requirePass(result);
  }

  const controlledDatabaseUrl = await recreateDatabase(baseDatabaseUrl, CONTROLLED_DATABASE_NAME);
  try {
    const controlledStage = executeStage({
      id: 'CONTROLLED_BOUNDED_CHAIN_POSTGRESQL',
      executable: PNPM,
      args: ['-w', 'exec', 'tsx', 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S10_BOUNDED_CHAIN_DB.ts'],
    }, {
      DATABASE_URL: controlledDatabaseUrl,
      MCFT_CAP_06_S10_BOUNDED_CHAIN_DESTRUCTIVE_ACCEPTANCE: '1',
    });
    stages.push(controlledStage);
    requirePass(controlledStage);
  } finally {
    await dropDatabase(baseDatabaseUrl, CONTROLLED_DATABASE_NAME);
  }
  const controlled = JSON.parse(fs.readFileSync(
    path.join(OUTPUT_DIR, 'MCFT_CAP_06_S10_BOUNDED_CHAIN_DB_RESULT.json'),
    'utf8',
  ));
  assert.equal(controlled.controlled_stage_database_count, 2);
  assert.equal(controlled.controlled_storage_mode, 'TWO_NAMESPACED_ISOLATED_POSTGRESQL_STAGES');
  assert.equal(controlled.controlled_stage_scope_match, true);
  assert.equal(controlled.candidate_evaluation_identity_continuity, true);

  const repositoryStage = executeStage({
    id: 'REPOSITORY_HISTORY_READ_ONLY_ASSESSMENT',
    executable: process.execPath,
    args: ['scripts/runtime_acceptance/RUN_MCFT_CAP_06_S0_V2_HONEST_QUALIFICATION.cjs'],
  }, { DATABASE_URL: baseDatabaseUrl });
  stages.push(repositoryStage);
  requirePass(repositoryStage);
  const repositorySource = JSON.parse(fs.readFileSync(
    path.join(OUTPUT_DIR, 'MCFT_CAP_06_S0_V2_RESULT.json'),
    'utf8',
  ));
  const qualification = repositorySource.qualification;
  assert.ok(qualification && typeof qualification === 'object');
  const assessmentStatus = repositoryAssessmentStatus(qualification.dataset_qualification_status);
  const repositoryResidualRefs = Array.isArray(qualification.eligible_cases)
    ? qualification.eligible_cases.map((item) => String(item.residual_ref)).sort()
    : [];
  const controlledResidualRefs = [...controlled.controlled_residual_refs].map(String).sort();
  const repositoryRefSet = new Set(repositoryResidualRefs);
  const intersection = controlledResidualRefs.filter((ref) => repositoryRefSet.has(ref));
  assert.notEqual(scopeKey(controlled.controlled_scope), scopeKey(qualification.source_scope));
  assert.equal(intersection.length, 0);

  const input = {
    schema_version: 'geox_mcft_cap_06_s10_bounded_chain_governance_input_v1',
    status: 'READY_FOR_GOVERNANCE',
    exact_head: cp.execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(),
    taskbook_version: 'v0.4.0',
    production_database_used: false,
    controlled_result_ref: 'acceptance-output/MCFT_CAP_06_S10_BOUNDED_CHAIN_DB_RESULT.json',
    repository_result_ref: 'acceptance-output/MCFT_CAP_06_S0_V2_RESULT.json',
    controlled_stage_database_count: controlled.controlled_stage_database_count,
    controlled_storage_mode: controlled.controlled_storage_mode,
    controlled_stage_scope_match: controlled.controlled_stage_scope_match,
    candidate_evaluation_identity_continuity: controlled.candidate_evaluation_identity_continuity,
    controlled_scope: controlled.controlled_scope,
    repository_scope: qualification.source_scope,
    controlled_residual_refs: controlledResidualRefs,
    repository_residual_refs: repositoryResidualRefs,
    residual_ref_intersection_count: intersection.length,
    both_track_scopes_distinct: true,
    both_track_databases_distinct: true,
    repository_source_qualification_status: qualification.dataset_qualification_status,
    repository_assessment_status: assessmentStatus,
    repository_canonical_residual_count: qualification.canonical_residual_count,
    repository_eligible_matched_pair_count: qualification.eligible_matched_pair_count,
    stages,
  };
  fs.writeFileSync(INPUT_PATH, `${JSON.stringify(input, null, 2)}\n`, 'utf8');

  const governanceStage = executeStage({
    id: 'S10_GOVERNANCE',
    executable: process.execPath,
    args: ['scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S10_BOUNDED_CHAIN.cjs'],
  });
  stages.push(governanceStage);
  requirePass(governanceStage);
  const governance = JSON.parse(fs.readFileSync(
    path.join(OUTPUT_DIR, 'MCFT_CAP_06_S10_BOUNDED_CHAIN_GOVERNANCE_RESULT.json'),
    'utf8',
  ));

  const result = {
    schema_version: 'geox_mcft_cap_06_s10_bounded_chain_preflight_result_v1',
    status: 'PASS',
    exact_head: input.exact_head,
    stage_count: stages.length,
    stages,
    controlled_stage_database_count: controlled.controlled_stage_database_count,
    controlled_storage_mode: controlled.controlled_storage_mode,
    controlled_stage_scope_match: controlled.controlled_stage_scope_match,
    candidate_evaluation_identity_continuity: controlled.candidate_evaluation_identity_continuity,
    actual_r: controlled.actual_r,
    actual_c: controlled.actual_c,
    canonical_delta_formula: controlled.canonical_delta_formula,
    expected_cap06_canonical_delta: controlled.expected_cap06_canonical_delta,
    actual_cap06_canonical_delta: controlled.actual_cap06_canonical_delta,
    candidate_ref: controlled.candidate_ref,
    candidate_hash: controlled.candidate_hash,
    evaluation_ref: controlled.evaluation_ref,
    evaluation_hash: controlled.evaluation_hash,
    candidate_parameter_value: controlled.candidate_parameter_value,
    effective_runtime_parameter_value: controlled.effective_runtime_parameter_value,
    completed_replay_additional_fact_count: controlled.completed_replay_additional_fact_count,
    completed_replay_projection_divergence_count: controlled.completed_replay_projection_divergence_count,
    completed_replay_evidence_load_count: controlled.completed_replay_evidence_load_count,
    s8_completed_replay_additional_fact_count: controlled.s8_completed_replay_additional_fact_count,
    s8_completed_replay_projection_divergence_count: controlled.s8_completed_replay_projection_divergence_count,
    s9_completed_replay_additional_fact_count: controlled.s9_completed_replay_additional_fact_count,
    s9_completed_replay_projection_divergence_count: controlled.s9_completed_replay_projection_divergence_count,
    candidate_consumed: controlled.candidate_consumed,
    evaluation_consumed: controlled.evaluation_consumed,
    model_activation_count: controlled.model_activation_count,
    active_config_snapshot_changed: controlled.active_config_snapshot_changed,
    repository_source_qualification_status: input.repository_source_qualification_status,
    repository_assessment_status: input.repository_assessment_status,
    repository_canonical_residual_count: input.repository_canonical_residual_count,
    repository_eligible_matched_pair_count: input.repository_eligible_matched_pair_count,
    residual_ref_intersection_count: input.residual_ref_intersection_count,
    both_track_scopes_distinct: input.both_track_scopes_distinct,
    both_track_databases_distinct: input.both_track_databases_distinct,
    production_database_used: false,
    s10_candidate_implemented: governance.s10_candidate_implemented,
    s10_effective: governance.s10_effective,
    s11a_authorized: governance.s11a_authorized,
    new_prerequisite_inserted: governance.new_prerequisite_inserted,
    new_slice_inserted: governance.new_slice_inserted,
  };
  fs.writeFileSync(RESULT_PATH, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(result));
}

main().catch((error) => {
  const failure = {
    schema_version: 'geox_mcft_cap_06_s10_bounded_chain_preflight_result_v1',
    status: 'FAIL',
    error: error instanceof Error ? error.message : String(error),
    production_database_used: false,
    s10_effective: false,
    s11a_authorized: false,
    new_prerequisite_inserted: false,
    new_slice_inserted: false,
  };
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(RESULT_PATH, `${JSON.stringify(failure, null, 2)}\n`, 'utf8');
  console.error(JSON.stringify(failure));
  process.exitCode = 1;
});
