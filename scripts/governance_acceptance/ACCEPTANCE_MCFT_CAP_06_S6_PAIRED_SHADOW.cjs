// Purpose: validate the S6 paired historical shadow implementation from exact changed files, frozen authority, structured preflight evidence and zero-write boundaries.
// Boundary: structured governance only; no Runtime execution, database access, canonical write, Evaluation draft/commit, active Config, State/checkpoint authority, route, Web, scheduler, or Model Activation.

'use strict';

const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const OUTPUT_DIR = path.join(ROOT, 'acceptance-output');
const INPUT_PATH = path.join(OUTPUT_DIR, 'MCFT_CAP_06_S6_PAIRED_SHADOW_PREFLIGHT_INPUT.json');
const RESULT_PATH = path.join(OUTPUT_DIR, 'MCFT_CAP_06_S6_PAIRED_SHADOW_GOVERNANCE_RESULT.json');
const S6 = 'MCFT-CAP-06.MCFT-06-09-11-12.PAIRED-HISTORICAL-SHADOW-COMPUTE-V1';
const S7 = 'MCFT-CAP-06.MCFT-03-12.SHADOW-EVALUATION-COMMIT-V1';
const BASELINE = '5f73ed68cad479276ca55fb70391ae4543cb3dcc';
const EXPECTED_FILES = [
  '.github/workflows/mcft-cap-06-s6-paired-shadow.yml',
  'apps/server/scripts/mcft/MCFT_CAP_06_PAIRED_HISTORICAL_SHADOW_RUNNER.ts',
  'apps/server/src/runtime/calibration/paired_historical_shadow_service_v1.ts',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S6-PAIRED-SHADOW-AUTHORITY-GRAPH.json',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S6-PAIRED-SHADOW-IMPLEMENTATION-CONTRACT.json',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S6-PAIRED-SHADOW-STATUS.json',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S6_PAIRED_SHADOW.cjs',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S6_PAIRED_SHADOW.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S6_PAIRED_SHADOW_DB.ts',
  'scripts/runtime_acceptance/RUN_MCFT_CAP_06_S6_PAIRED_SHADOW.cjs',
];
const PROTECTED_PATHS = [
  'apps/server/src/domain/calibration/contracts_v1.ts',
  'apps/server/src/domain/calibration/case_builder_v1.ts',
  'apps/server/src/domain/calibration/fixed_point_metric_v1.ts',
  'apps/server/src/domain/calibration/shadow_evaluation_v1.ts',
  'apps/server/src/domain/calibration/envelope_profiles_v1.ts',
  'apps/server/src/runtime/calibration/calibration_candidate_service_v1.ts',
  'apps/server/src/runtime/calibration/resolved_forecast_replay_prediction_adapter_v1.ts',
  'apps/server/src/persistence/calibration/postgres_resolved_forecast_observation_case_assembler_v1.ts',
  'apps/server/src/persistence/calibration/postgres_calibration_governance_repository_v1.ts',
  'apps/server/src/domain/soil_water/hourly_water_balance_v1.ts',
];
const REQUIRED_STAGES = [
  'TYPECHECK',
  'BUILD',
  'S2_EXACT_MATH_REGRESSION',
  'S5_DOMAIN_CANDIDATE_REGRESSION',
  'S5_POSTGRESQL_CANDIDATE_REGRESSION',
  'S6_DOMAIN_PAIRED_SHADOW',
  'S6_POSTGRESQL_ZERO_WRITE_SHADOW',
];

function git(args) {
  return cp.execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}
function json(relative) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8'));
}
function write(result) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(RESULT_PATH, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
}
function baselineRef() {
  const explicit = String(process.env.MCFT_CAP_06_S6_PAIRED_SHADOW_BASELINE_REF || '').trim();
  const baseline = explicit || BASELINE;
  git(['cat-file', '-e', `${baseline}^{commit}`]);
  return baseline;
}
function assertZeroBoundary(object, prefix) {
  for (const key of [
    'canonical_fact_write_count',
    'projection_write_count',
    'candidate_append_count',
    'evaluation_append_count',
    'model_activation_count',
    'active_config_switch_count',
    'runtime_parameter_change_count',
    'state_mutation_count',
    'checkpoint_mutation_count',
    'migration_count',
  ]) assert.equal(object[key], 0, `${prefix}_${key.toUpperCase()}_NONZERO`);
}

function main() {
  const baseline = baselineRef();
  const changedRaw = git(['diff', '--name-only', `${baseline}...HEAD`]);
  const changed = changedRaw ? changedRaw.split(/\r?\n/).filter(Boolean).sort() : [];
  assert.deepEqual(changed, [...EXPECTED_FILES].sort());
  assert.deepEqual(changed.filter((file) => PROTECTED_PATHS.includes(file)), []);
  assert.equal(changed.some((file) => file.startsWith('apps/server/db/migrations/')), false);
  assert.equal(changed.some((file) => file.startsWith('apps/web/')), false);
  assert.equal(changed.some((file) => /routes?|controller|openapi/i.test(file)), false);

  const commitCount = Number(git(['rev-list', '--count', `${baseline}..HEAD`]));
  assert.ok(commitCount >= 1 && commitCount <= 16, 'S6_PAIRED_SHADOW_LOGICAL_COMMIT_COUNT_INVALID');
  for (const message of git(['log', '--format=%s', `${baseline}..HEAD`]).split(/\r?\n/).filter(Boolean)) {
    assert.equal(/wip|fix ci|try again|debug|temporary/i.test(message), false, `S6_PAIRED_SHADOW_COMMIT_MESSAGE_INVALID:${message}`);
  }

  const authority = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S6-PAIRED-SHADOW-AUTHORITY-GRAPH.json');
  const contract = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S6-PAIRED-SHADOW-IMPLEMENTATION-CONTRACT.json');
  const status = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S6-PAIRED-SHADOW-STATUS.json');
  const predecessor = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S5-CANDIDATE-EFFECTIVENESS.json');
  const delivery = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-DELIVERY-STATE.json');
  const slices = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-DELIVERY-SLICE-STATUS.json');
  const reconciliation = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-STATE-RECONCILIATION.json');
  const input = json('acceptance-output/MCFT_CAP_06_S6_PAIRED_SHADOW_PREFLIGHT_INPUT.json');
  const domain = json('acceptance-output/MCFT_CAP_06_S6_PAIRED_SHADOW_DOMAIN_RESULT.json');
  const database = json('acceptance-output/MCFT_CAP_06_S6_PAIRED_SHADOW_DB_RESULT.json');

  assert.equal(predecessor.status, 'MERGED_EFFECTIVE');
  assert.equal(predecessor.s5_effective, true);
  assert.equal(predecessor.s6_authorized, true);
  assert.equal(predecessor.s6_implementation_started, false);

  assert.equal(authority.schema_version, 'geox_mcft_cap_06_s6_paired_shadow_authority_graph_v1');
  assert.equal(authority.delivery_slice_id, S6);
  assert.equal(authority.status, 'FROZEN_BEFORE_RUNTIME_SOURCE');
  assert.equal(authority.input_authority.required_holdout_ref_count, 8);
  assert.equal(authority.input_authority.calibration_refs_permitted, false);
  assert.equal(authority.read_graph.candidate_authority, 'PostgresCalibrationGovernanceRepositoryV1.readCanonicalObject');
  assert.equal(authority.read_graph.holdout_graph_authority, 'PostgresResolvedForecastObservationCaseAssemblerV1.resolveExactResidualRefs');
  assert.equal(authority.read_graph.holdout_transaction, 'ONE_REPEATABLE_READ_READ_ONLY_TRANSACTION');
  assert.equal(authority.compute_graph[2].authority, 'runCap06PairedHistoricalShadowV1');
  assert.equal(authority.output_authority.canonical_authority, false);
  assert.equal(authority.output_authority.future_exact_consumer, 'S7 SHADOW-EVALUATION-COMMIT only after S6 merged-effective');
  assertZeroBoundary(authority.zero_write_boundary, 'S6_AUTHORITY');

  assert.equal(contract.status, 'AUTHORIZED_NOT_STARTED_AUTHORITY_GRAPH_FROZEN');
  assert.equal(contract.predecessor_effective, true);
  assert.equal(contract.paired_historical_shadow_compute_authorized, true);
  assert.equal(contract.canonical_write_authorized, false);
  assert.equal(contract.projection_write_authorized, false);
  assert.equal(contract.shadow_evaluation_append_authorized, false);
  assert.equal(contract.evaluation_draft_authorized_as_output, false);
  assert.equal(contract.s7_authorized, false);
  assert.equal(contract.protected_existing_file_delta_required, 0);
  assert.equal(contract.required_result.holdout_case_count, 8);
  assert.equal(contract.required_result.controlled_candidate_parameter_value, '0.034000');

  assert.equal(status.delivery_slice_id, S6);
  assert.equal(status.status, 'CANDIDATE_IMPLEMENTED_NOT_EFFECTIVE');
  assert.equal(status.s6_authorized, true);
  assert.equal(status.s6_implementation_started, true);
  assert.equal(status.s6_candidate_implemented, true);
  assert.equal(status.s6_effective, false);
  assert.equal(status.controlled_acceptance.candidate_parameter_value, '0.034000');
  assert.equal(status.controlled_acceptance.holdout_case_count, 8);
  assert.equal(status.controlled_acceptance.expected_disposition, 'ELIGIBLE_FOR_HUMAN_ACTIVATION_REVIEW');
  assertZeroBoundary(status.runtime_delta, 'S6_STATUS');
  assert.equal(status.s7_authorized, false);

  // Implementation candidate does not rewrite the global delivery frontier before merged-main effectiveness.
  assert.equal(delivery.active_delivery_slice_id, S6);
  assert.deepEqual(delivery.authorized_not_started_slices, [S6]);
  assert.equal(delivery.s6.authorized, true);
  assert.equal(delivery.s6.implementation_started, false);
  assert.equal(delivery.s6.candidate_implemented, false);
  assert.equal(delivery.s6.effective, false);
  assert.equal(delivery.s6.canonical_write_authorized, false);
  assert.equal(delivery.s6.projection_write_authorized, false);
  assert.equal(delivery.s6.shadow_evaluation_append_authorized, false);
  assert.equal(delivery.blocked_slices.includes(S7), true);
  assert.equal(slices.active_delivery_slice_id, S6);
  assert.equal(slices.s6_authorized, true);
  assert.equal(slices.s6_implementation_started, false);
  assert.equal(slices.s6_effective, false);
  assert.equal(reconciliation.current_state.active_delivery_slice_id, S6);
  assert.equal(reconciliation.current_state.s6_authorized, true);
  assert.equal(reconciliation.current_state.s6_implementation_started, false);
  assert.equal(reconciliation.current_state.s6_candidate_implemented, false);
  assert.equal(reconciliation.current_state.s6_effective, false);

  assert.equal(input.schema_version, 'geox_mcft_cap_06_s6_paired_shadow_preflight_input_v1');
  assert.equal(input.status, 'READY_FOR_GOVERNANCE');
  assert.equal(input.production_database_used, false);
  for (const stageId of REQUIRED_STAGES) {
    const stage = input.stages.find((item) => item.stage_id === stageId);
    assert.ok(stage, `S6_PAIRED_SHADOW_PREFLIGHT_STAGE_MISSING:${stageId}`);
    assert.equal(stage.status, 'PASS', `S6_PAIRED_SHADOW_PREFLIGHT_STAGE_NOT_PASS:${stageId}`);
    assert.equal(stage.exit_code, 0, `S6_PAIRED_SHADOW_PREFLIGHT_STAGE_EXIT_NONZERO:${stageId}`);
  }

  assert.equal(domain.status, 'PASS');
  assert.equal(domain.candidate_parameter_value, '0.034000');
  assert.equal(domain.holdout_case_count, 8);
  assert.equal(domain.evaluation_disposition, 'ELIGIBLE_FOR_HUMAN_ACTIVATION_REVIEW');
  assert.deepEqual(domain.reason_codes, ['ALL_THRESHOLDS_PASS']);
  assert.equal(domain.deterministic_rerun_verified, true);
  assert.equal(domain.future_leakage_count, 0);
  assertZeroBoundary({ ...domain, migration_count: 0 }, 'S6_DOMAIN');

  assert.equal(database.status, 'PASS');
  assert.equal(database.candidate_ref, 'twin_calibration_candidate_5649b9ab80b5545cf6007387');
  assert.equal(database.candidate_hash, 'sha256:a2018a61bf6699b3cc3b8992058eb2c37b4d38d7f70771f9186495144c229a65');
  assert.equal(database.candidate_parameter_value, '0.034000');
  assert.equal(database.exact_holdout_case_count, 8);
  assert.equal(database.evaluation_disposition, 'ELIGIBLE_FOR_HUMAN_ACTIVATION_REVIEW');
  assert.deepEqual(database.reason_codes, ['ALL_THRESHOLDS_PASS']);
  assert.equal(database.deterministic_rerun_verified, true);
  assert.equal(database.fact_count_before_shadow, database.fact_count_after_shadow);
  assertZeroBoundary(database, 'S6_DATABASE');

  const result = {
    schema_version: 'geox_mcft_cap_06_s6_paired_shadow_governance_result_v1',
    status: 'PASS',
    exact_head: git(['rev-parse', 'HEAD']),
    baseline_ref: baseline,
    changed_file_count: changed.length,
    logical_commit_count: commitCount,
    protected_predecessor_path_delta_count: 0,
    authority_graph_status: authority.status,
    preflight_stage_count: input.stages.length,
    candidate_ref: database.candidate_ref,
    candidate_hash: database.candidate_hash,
    candidate_parameter_value: database.candidate_parameter_value,
    holdout_case_count: database.exact_holdout_case_count,
    evaluation_disposition: database.evaluation_disposition,
    reason_codes: database.reason_codes,
    case_results_hash: database.case_results_hash,
    compute_determinism_hash: database.compute_determinism_hash,
    deterministic_rerun_verified: true,
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
  };
  write(result);
  console.log(JSON.stringify(result));
}

try { main(); } catch (error) {
  const result = {
    schema_version: 'geox_mcft_cap_06_s6_paired_shadow_governance_result_v1',
    status: 'FAIL',
    error: error instanceof Error ? error.message : String(error),
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
    s6_effective: false,
    s7_authorized: false,
  };
  write(result);
  console.error(JSON.stringify(result));
  process.exitCode = 1;
}
