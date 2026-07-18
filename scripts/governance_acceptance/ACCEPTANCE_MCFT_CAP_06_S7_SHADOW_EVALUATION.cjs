// Purpose: validate the exact S7 implementation boundary and keep pure-domain evidence distinct from the authoritative PostgreSQL controlled graph.
// Boundary: structured governance only; no Runtime execution, database access, alternative shadow compute, activation, active Config, State/checkpoint, route, Web or scheduler authority.

'use strict';

const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const OUTPUT_DIR = path.join(ROOT, 'acceptance-output');
const RESULT_PATH = path.join(OUTPUT_DIR, 'MCFT_CAP_06_S7_SHADOW_EVALUATION_GOVERNANCE_RESULT.json');
const BASELINE = '1333ef2f1613745b785d01859e5355ea6fd27274';
const S7 = 'MCFT-CAP-06.MCFT-03-12.SHADOW-EVALUATION-COMMIT-V1';
const S8 = 'MCFT-CAP-06.MCFT-03-04-12.RESTART-READBACK-REBUILD-V1';
const CANDIDATE_REF = 'twin_calibration_candidate_5649b9ab80b5545cf6007387';
const CANDIDATE_HASH = 'sha256:a2018a61bf6699b3cc3b8992058eb2c37b4d38d7f70771f9186495144c229a65';
const DOMAIN_CASE_HASH = 'sha256:dd1a9a996646c4bf6c04efa4e27a267b75828494ce71c76336ab8fedcafe93ab';
const DOMAIN_COMPUTE_HASH = 'sha256:7d168652044065656ed25966259777a67c6add5c877926dded789bb19f56a087';
const DOMAIN_EVALUATION_HASH = 'sha256:12bf65d6687742bc6f0f3cf04054727baa90646b4e797397f65fcf00d3ea37ca';
const DATABASE_ARTIFACT_HASH = 'sha256:396fa1c03a33e4b5722c6d6e7d63774072e46ec8e8f91deaf7a5e0c24b328a71';
const DATABASE_CASE_HASH = 'sha256:e1b33fb79059856c030cab58970c543f384fb30a385bc3aa49c96b315efe4daa';
const DATABASE_COMPUTE_HASH = 'sha256:8017c2ba6006e1f2a593312300937841b5c2dd3a700c949bb8309338994ef63e';
const EVALUATION_REF = 'twin_shadow_evaluation_8cae1f6732420a4999deffc0';
const DATABASE_EVALUATION_HASH = 'sha256:32c43020f45351994120515e5c633531bb594d85659456c65bd46305737d85e0';

const EXPECTED_FILES = [
  '.github/workflows/mcft-cap-06-s7-shadow-evaluation.yml',
  'apps/server/scripts/mcft/MCFT_CAP_06_SHADOW_EVALUATION_COMMIT_RUNNER.ts',
  'apps/server/src/runtime/calibration/shadow_evaluation_commit_service_v1.ts',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S7-SHADOW-EVALUATION-AUTHORITY-GRAPH.json',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S7-SHADOW-EVALUATION-IMPLEMENTATION-CONTRACT.json',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S7-SHADOW-EVALUATION-STATUS.json',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S7_SHADOW_EVALUATION.cjs',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S7_SHADOW_EVALUATION.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S7_SHADOW_EVALUATION_DB.ts',
  'scripts/runtime_acceptance/RUN_MCFT_CAP_06_S7_SHADOW_EVALUATION.cjs',
];
const PROTECTED_PATHS = [
  'apps/server/src/domain/calibration/contracts_v1.ts',
  'apps/server/src/domain/calibration/case_builder_v1.ts',
  'apps/server/src/domain/calibration/shadow_evaluation_v1.ts',
  'apps/server/src/domain/calibration/envelope_profiles_v1.ts',
  'apps/server/src/runtime/calibration/paired_historical_shadow_service_v1.ts',
  'apps/server/src/persistence/calibration/postgres_calibration_governance_repository_v1.ts',
  'apps/server/src/projections/calibration/calibration_governance_projection_v1.ts',
  'apps/server/db/migrations/2026_07_17_mcft_cap_06_calibration_governance_persistence.sql',
];
const REQUIRED_STAGES = [
  'TYPECHECK',
  'BUILD',
  'S3_PERSISTENCE_REGRESSION',
  'S6_DOMAIN_REGRESSION',
  'S6_POSTGRESQL_REGRESSION',
  'S7_DOMAIN_EVALUATION',
  'S7_POSTGRESQL_EVALUATION',
];
const ZERO_KEYS = [
  'candidate_append_count',
  'model_activation_count',
  'active_config_switch_count',
  'runtime_parameter_change_count',
  'state_mutation_count',
  'checkpoint_mutation_count',
  'migration_count',
];

function git(args) {
  return cp.execFileSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}
function json(relative) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8'));
}
function write(result) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(RESULT_PATH, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
}
function assertZero(object, prefix) {
  for (const key of ZERO_KEYS) assert.equal(object[key], 0, `${prefix}_${key.toUpperCase()}_NONZERO`);
}
function assertCommonControlledResult(result, prefix) {
  assert.equal(result.status, 'PASS', `${prefix}_STATUS_NOT_PASS`);
  assert.equal(result.candidate_ref, CANDIDATE_REF, `${prefix}_CANDIDATE_REF_MISMATCH`);
  assert.equal(result.candidate_hash, CANDIDATE_HASH, `${prefix}_CANDIDATE_HASH_MISMATCH`);
  assert.equal(result.candidate_parameter_value, '0.034000', `${prefix}_PARAMETER_MISMATCH`);
  assert.equal(result.holdout_case_count, 8, `${prefix}_HOLDOUT_COUNT_MISMATCH`);
  assert.equal(result.evaluation_ref, EVALUATION_REF, `${prefix}_EVALUATION_REF_MISMATCH`);
  assert.equal(result.evaluation_disposition, 'ELIGIBLE_FOR_HUMAN_ACTIVATION_REVIEW', `${prefix}_DISPOSITION_MISMATCH`);
  assert.deepEqual(result.reason_codes, ['ALL_THRESHOLDS_PASS'], `${prefix}_REASON_CODES_MISMATCH`);
  assert.equal(result.first_evaluation_append_count, 1, `${prefix}_FIRST_APPEND_MISMATCH`);
  assert.equal(result.completed_chain_rerun_evaluation_append_count, 0, `${prefix}_RERUN_APPEND_MISMATCH`);
  assert.equal(result.aggregate_projection_count, 1, `${prefix}_AGGREGATE_PROJECTION_MISMATCH`);
  assert.equal(result.candidate_evaluation_index_count, 1, `${prefix}_CANDIDATE_INDEX_MISMATCH`);
  assert.equal(result.case_projection_count, 8, `${prefix}_CASE_PROJECTION_MISMATCH`);
  assert.equal(result.canonical_readback_verified, true, `${prefix}_READBACK_NOT_VERIFIED`);
  assertZero(result, prefix);
}

function main() {
  const baseline = String(process.env.MCFT_CAP_06_S7_SHADOW_EVALUATION_BASELINE_REF || BASELINE).trim();
  git(['cat-file', '-e', `${baseline}^{commit}`]);
  const changedRaw = git(['diff', '--name-only', `${baseline}...HEAD`]);
  const changed = changedRaw ? changedRaw.split(/\r?\n/).filter(Boolean).sort() : [];
  assert.deepEqual(changed, [...EXPECTED_FILES].sort());
  assert.deepEqual(changed.filter((file) => PROTECTED_PATHS.includes(file)), []);
  assert.equal(changed.some((file) => file.startsWith('apps/server/db/migrations/')), false);
  assert.equal(changed.some((file) => file.startsWith('apps/web/')), false);
  assert.equal(changed.some((file) => /routes?|controller|openapi/i.test(file)), false);
  const commitCount = Number(git(['rev-list', '--count', `${baseline}..HEAD`]));
  assert.ok(commitCount >= 1 && commitCount <= 16, 'S7_SHADOW_EVALUATION_LOGICAL_COMMIT_COUNT_INVALID');
  for (const message of git(['log', '--format=%s', `${baseline}..HEAD`]).split(/\r?\n/).filter(Boolean)) {
    assert.equal(/wip|fix ci|try again|debug|temporary/i.test(message), false, `S7_SHADOW_EVALUATION_COMMIT_MESSAGE_INVALID:${message}`);
  }

  const authority = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S7-SHADOW-EVALUATION-AUTHORITY-GRAPH.json');
  const contract = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S7-SHADOW-EVALUATION-IMPLEMENTATION-CONTRACT.json');
  const status = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S7-SHADOW-EVALUATION-STATUS.json');
  const predecessor = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S6-PAIRED-SHADOW-EFFECTIVENESS.json');
  const delivery = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-DELIVERY-STATE.json');
  const slices = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-DELIVERY-SLICE-STATUS.json');
  const reconciliation = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-STATE-RECONCILIATION.json');
  const input = json('acceptance-output/MCFT_CAP_06_S7_SHADOW_EVALUATION_PREFLIGHT_INPUT.json');
  const domain = json('acceptance-output/MCFT_CAP_06_S7_SHADOW_EVALUATION_DOMAIN_RESULT.json');
  const database = json('acceptance-output/MCFT_CAP_06_S7_SHADOW_EVALUATION_DB_RESULT.json');

  assert.equal(predecessor.status, 'MERGED_EFFECTIVE');
  assert.equal(predecessor.s6_effective, true);
  assert.equal(predecessor.s7_authorized, true);
  assert.equal(predecessor.s7_implementation_started, false);

  assert.equal(authority.schema_version, 'geox_mcft_cap_06_s7_shadow_evaluation_authority_graph_v1');
  assert.equal(authority.delivery_slice_id, S7);
  assert.equal(authority.status, 'FROZEN_BEFORE_RUNTIME_SOURCE');
  assert.equal(authority.input_authority.holdout_case_count, 8);
  assert.equal(authority.input_authority.alternative_artifact_or_latest_query_permitted, false);
  assert.equal(authority.read_graph.s6_artifact_recompute_in_s7, false);
  assert.equal(authority.build_graph.authority, 'buildCap06ShadowEvaluationDraftV1');
  assert.equal(authority.commit_graph.d_transaction_authority, 'PostgresCalibrationGovernanceRepositoryV1.commitCanonicalObject');
  assert.equal(authority.commit_graph.maximum_new_canonical_append_count, 1);
  assert.equal(authority.commit_graph.required_projection_rows.total, 10);
  assert.equal(authority.output_authority.canonical_object_type, 'twin_shadow_evaluation_v1');
  assert.equal(authority.controlled_write_boundary.canonical_evaluation_append_count, 1);
  assert.equal(authority.controlled_write_boundary.projection_row_count, 10);
  assertZero(authority.controlled_write_boundary, 'S7_AUTHORITY');

  assert.equal(contract.status, 'AUTHORIZED_NOT_STARTED_AUTHORITY_GRAPH_FROZEN');
  assert.equal(contract.predecessor_effective, true);
  assert.equal(contract.shadow_evaluation_builder_authorized, true);
  assert.equal(contract.shadow_evaluation_append_authorized, true);
  assert.equal(contract.projection_write_authorized, true);
  assert.equal(contract.alternative_shadow_compute_authorized, false);
  assert.equal(contract.candidate_append_authorized, false);
  assert.equal(contract.model_activation_authorized, false);
  assert.equal(contract.active_config_switch_authorized, false);
  assert.equal(contract.protected_existing_file_delta_required, 0);
  assert.equal(contract.required_result.first_evaluation_append_count, 1);
  assert.equal(contract.required_result.completed_chain_rerun_evaluation_append_count, 0);
  assert.equal(contract.required_result.aggregate_projection_count, 1);
  assert.equal(contract.required_result.candidate_evaluation_index_count, 1);
  assert.equal(contract.required_result.case_projection_count, 8);
  assert.equal(contract.s8_authorized, false);

  assert.equal(status.delivery_slice_id, S7);
  assert.equal(status.status, 'CANDIDATE_IMPLEMENTED_NOT_EFFECTIVE');
  assert.equal(status.s7_authorized, true);
  assert.equal(status.s7_implementation_started, true);
  assert.equal(status.s7_candidate_implemented, true);
  assert.equal(status.s7_effective, false);
  assert.equal(status.runtime_delta.canonical_evaluation_append_count, 1);
  assert.equal(status.runtime_delta.projection_row_count, 10);
  assertZero(status.runtime_delta, 'S7_STATUS');
  assert.equal(status.s8_authorized, false);

  // Candidate implementation must not move the global effectiveness frontier.
  assert.equal(delivery.active_delivery_slice_id, S7);
  assert.deepEqual(delivery.authorized_not_started_slices, [S7]);
  assert.equal(delivery.s7.authorized, true);
  assert.equal(delivery.s7.implementation_started, false);
  assert.equal(delivery.s7.candidate_implemented, false);
  assert.equal(delivery.s7.effective, false);
  assert.equal(delivery.blocked_slices.includes(S8), true);
  assert.equal(slices.active_delivery_slice_id, S7);
  assert.equal(slices.s7_authorized, true);
  assert.equal(slices.s7_implementation_started, false);
  assert.equal(slices.s7_effective, false);
  assert.equal(reconciliation.current_state.active_delivery_slice_id, S7);
  assert.equal(reconciliation.current_state.s7_authorized, true);
  assert.equal(reconciliation.current_state.s7_implementation_started, false);
  assert.equal(reconciliation.current_state.s7_candidate_implemented, false);
  assert.equal(reconciliation.current_state.s7_effective, false);

  assert.equal(input.schema_version, 'geox_mcft_cap_06_s7_shadow_evaluation_preflight_input_v1');
  assert.equal(input.status, 'READY_FOR_GOVERNANCE');
  assert.equal(input.production_database_used, false);
  for (const stageId of REQUIRED_STAGES) {
    const stage = input.stages.find((item) => item.stage_id === stageId);
    assert.ok(stage, `S7_SHADOW_EVALUATION_PREFLIGHT_STAGE_MISSING:${stageId}`);
    assert.equal(stage.status, 'PASS', `S7_SHADOW_EVALUATION_PREFLIGHT_STAGE_NOT_PASS:${stageId}`);
    assert.equal(stage.exit_code, 0, `S7_SHADOW_EVALUATION_PREFLIGHT_STAGE_EXIT_NONZERO:${stageId}`);
  }

  // Pure-domain fixture is independently deterministic; it is not the canonical DB graph.
  assertCommonControlledResult(domain, 'S7_DOMAIN');
  assert.equal(domain.source_s6_case_results_hash, DOMAIN_CASE_HASH);
  assert.equal(domain.source_s6_compute_determinism_hash, DOMAIN_COMPUTE_HASH);
  assert.equal(domain.evaluation_hash, DOMAIN_EVALUATION_HASH);

  // PostgreSQL graph is the authoritative controlled S7 result used by governance output.
  assertCommonControlledResult(database, 'S7_DATABASE');
  assert.equal(database.source_s6_artifact_hash, DATABASE_ARTIFACT_HASH);
  assert.equal(database.source_s6_case_results_hash, DATABASE_CASE_HASH);
  assert.equal(database.source_s6_compute_determinism_hash, DATABASE_COMPUTE_HASH);
  assert.equal(database.evaluation_hash, DATABASE_EVALUATION_HASH);
  assert.equal(database.fact_count_after_evaluation, database.fact_count_before_evaluation + 1);

  // Cross-fixture equality is intentionally limited to authority identities and dispositions.
  assert.equal(database.candidate_ref, domain.candidate_ref);
  assert.equal(database.candidate_hash, domain.candidate_hash);
  assert.equal(database.candidate_parameter_value, domain.candidate_parameter_value);
  assert.equal(database.evaluation_ref, domain.evaluation_ref);
  assert.equal(database.holdout_case_count, domain.holdout_case_count);
  assert.equal(database.evaluation_disposition, domain.evaluation_disposition);
  assert.deepEqual(database.reason_codes, domain.reason_codes);

  const result = {
    schema_version: 'geox_mcft_cap_06_s7_shadow_evaluation_governance_result_v1',
    status: 'PASS',
    exact_head: git(['rev-parse', 'HEAD']),
    baseline_ref: baseline,
    changed_file_count: changed.length,
    logical_commit_count: commitCount,
    protected_predecessor_path_delta_count: 0,
    authority_graph_status: authority.status,
    preflight_stage_count: input.stages.length,
    evidence_domain_separation_verified: true,
    domain_source_s6_case_results_hash: domain.source_s6_case_results_hash,
    domain_source_s6_compute_determinism_hash: domain.source_s6_compute_determinism_hash,
    source_s6_artifact_hash: database.source_s6_artifact_hash,
    source_s6_case_results_hash: database.source_s6_case_results_hash,
    source_s6_compute_determinism_hash: database.source_s6_compute_determinism_hash,
    candidate_ref: database.candidate_ref,
    candidate_hash: database.candidate_hash,
    candidate_parameter_value: database.candidate_parameter_value,
    holdout_case_count: database.holdout_case_count,
    evaluation_ref: database.evaluation_ref,
    evaluation_hash: database.evaluation_hash,
    evaluation_disposition: database.evaluation_disposition,
    reason_codes: database.reason_codes,
    first_evaluation_append_count: 1,
    completed_chain_rerun_evaluation_append_count: 0,
    aggregate_projection_count: 1,
    candidate_evaluation_index_count: 1,
    case_projection_count: 8,
    canonical_readback_verified: true,
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
  };
  write(result);
  console.log(JSON.stringify(result));
}

try {
  main();
} catch (error) {
  const result = {
    schema_version: 'geox_mcft_cap_06_s7_shadow_evaluation_governance_result_v1',
    status: 'FAIL',
    error: error instanceof Error ? error.message : String(error),
    candidate_append_count: 0,
    model_activation_count: 0,
    active_config_switch_count: 0,
    runtime_parameter_change_count: 0,
    state_mutation_count: 0,
    checkpoint_mutation_count: 0,
    migration_count: 0,
    s7_effective: false,
    s8_authorized: false,
  };
  write(result);
  console.error(JSON.stringify(result));
  process.exitCode = 1;
}
