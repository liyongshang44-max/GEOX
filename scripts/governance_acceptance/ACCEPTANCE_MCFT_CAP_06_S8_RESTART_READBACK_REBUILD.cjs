// Purpose: validate the exact S8 implementation boundary and structured fresh-process PostgreSQL recovery evidence.
// Boundary: governance only; no Runtime execution, database access, canonical/projection write, activation, route, Web, scheduler, migration or CAP-07 authority.

'use strict';

const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const OUTPUT_DIR = path.join(ROOT, 'acceptance-output');
const RESULT_PATH = path.join(OUTPUT_DIR, 'MCFT_CAP_06_S8_RESTART_READBACK_REBUILD_GOVERNANCE_RESULT.json');
const BASELINE = '7bd493b54abf93fa40cb7f17af88b2a063a38e1d';
const S8 = 'MCFT-CAP-06.MCFT-03-04-12.RESTART-READBACK-REBUILD-V1';
const S9 = 'MCFT-CAP-06.MCFT-04-06-08-09-12.POST-EVALUATION-NON-CONSUMPTION-TICK-V1';
const EVALUATION_REF = 'twin_shadow_evaluation_8cae1f6732420a4999deffc0';
const EVALUATION_HASH = 'sha256:32c43020f45351994120515e5c633531bb594d85659456c65bd46305737d85e0';
const CANDIDATE_REF = 'twin_calibration_candidate_5649b9ab80b5545cf6007387';
const CANDIDATE_HASH = 'sha256:a2018a61bf6699b3cc3b8992058eb2c37b4d38d7f70771f9186495144c229a65';
const SUMMARY = {
  canonical_objects_scanned: 2,
  idempotency_guards_rebuilt: 2,
  candidate_projections_rebuilt: 1,
  evaluation_projections_rebuilt: 1,
  candidate_evaluation_rows_rebuilt: 1,
  evaluation_case_rows_rebuilt: 8,
};
const EXPECTED_FILES = [
  '.github/workflows/mcft-cap-06-s8-restart-readback-rebuild.yml',
  'apps/server/scripts/mcft/MCFT_CAP_06_RESTART_READBACK_REBUILD_RUNNER.ts',
  'apps/server/src/runtime/calibration/restart_readback_rebuild_service_v1.ts',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S8-RESTART-READBACK-REBUILD-AUTHORITY-GRAPH.json',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S8-RESTART-READBACK-REBUILD-IMPLEMENTATION-CONTRACT.json',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S8-RESTART-READBACK-REBUILD-STATUS.json',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S8_RESTART_READBACK_REBUILD.cjs',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S8_RESTART_READBACK_REBUILD.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S8_RESTART_READBACK_REBUILD_DB.ts',
  'scripts/runtime_acceptance/RUN_MCFT_CAP_06_S8_RESTART_READBACK_REBUILD.cjs',
];
const PROTECTED_PATHS = [
  'apps/server/src/domain/calibration/contracts_v1.ts',
  'apps/server/src/domain/calibration/case_builder_v1.ts',
  'apps/server/src/domain/calibration/shadow_evaluation_v1.ts',
  'apps/server/src/domain/calibration/envelope_profiles_v1.ts',
  'apps/server/src/runtime/calibration/paired_historical_shadow_service_v1.ts',
  'apps/server/src/runtime/calibration/shadow_evaluation_commit_service_v1.ts',
  'apps/server/src/persistence/calibration/postgres_calibration_governance_repository_v1.ts',
  'apps/server/src/projections/calibration/calibration_governance_projection_v1.ts',
  'apps/server/db/migrations/2026_07_17_mcft_cap_06_calibration_governance_persistence.sql',
];
const REQUIRED_STAGES = [
  'TYPECHECK',
  'BUILD',
  'S3_PERSISTENCE_REGRESSION',
  'S6_DOMAIN_REGRESSION',
  'S7_DOMAIN_REGRESSION',
  'S8_DOMAIN_RECOVERY',
  'S8_POSTGRESQL_RESTART_RECOVERY',
];
const ZERO_KEYS = [
  'canonical_fact_append_count',
  'canonical_fact_update_count',
  'canonical_fact_delete_count',
  'candidate_append_count',
  'evaluation_append_count',
  'model_activation_count',
  'active_config_switch_count',
  'runtime_parameter_change_count',
  'state_mutation_count',
  'checkpoint_mutation_count',
  'migration_count',
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
function assertZeros(object, prefix) {
  for (const key of ZERO_KEYS) assert.equal(object[key], 0, `${prefix}_${key.toUpperCase()}_NONZERO`);
}

function main() {
  const baseline = String(process.env.MCFT_CAP_06_S8_RESTART_READBACK_REBUILD_BASELINE_REF || BASELINE).trim();
  git(['cat-file', '-e', `${baseline}^{commit}`]);
  const changedRaw = git(['diff', '--name-only', `${baseline}...HEAD`]);
  const changed = changedRaw ? changedRaw.split(/\r?\n/).filter(Boolean).sort() : [];
  assert.deepEqual(changed, [...EXPECTED_FILES].sort());
  assert.deepEqual(changed.filter((file) => PROTECTED_PATHS.includes(file)), []);
  assert.equal(changed.some((file) => file.startsWith('apps/server/db/migrations/')), false);
  assert.equal(changed.some((file) => file.startsWith('apps/server/src/projections/')), false);
  assert.equal(changed.some((file) => file.startsWith('apps/web/')), false);
  assert.equal(changed.some((file) => /routes?|controller|openapi/i.test(file)), false);
  const commitCount = Number(git(['rev-list', '--count', `${baseline}..HEAD`]));
  assert.ok(commitCount >= 1 && commitCount <= 14, 'S8_RESTART_REBUILD_LOGICAL_COMMIT_COUNT_INVALID');
  for (const message of git(['log', '--format=%s', `${baseline}..HEAD`]).split(/\r?\n/).filter(Boolean)) {
    assert.equal(/wip|fix ci|try again|debug|temporary/i.test(message), false, `S8_RESTART_REBUILD_COMMIT_MESSAGE_INVALID:${message}`);
  }

  const predecessor = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S7-SHADOW-EVALUATION-EFFECTIVENESS.json');
  const authority = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S8-RESTART-READBACK-REBUILD-AUTHORITY-GRAPH.json');
  const contract = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S8-RESTART-READBACK-REBUILD-IMPLEMENTATION-CONTRACT.json');
  const status = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S8-RESTART-READBACK-REBUILD-STATUS.json');
  const delivery = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-DELIVERY-STATE.json');
  const slices = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-DELIVERY-SLICE-STATUS.json');
  const reconciliation = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-STATE-RECONCILIATION.json');
  const input = json('acceptance-output/MCFT_CAP_06_S8_RESTART_READBACK_REBUILD_PREFLIGHT_INPUT.json');
  const database = json('acceptance-output/MCFT_CAP_06_S8_RESTART_READBACK_REBUILD_DB_RESULT.json');

  assert.equal(predecessor.status, 'MERGED_EFFECTIVE');
  assert.equal(predecessor.s7_effective, true);
  assert.equal(predecessor.s8_authorized, true);
  assert.equal(predecessor.s8_implementation_started, false);

  assert.equal(authority.schema_version, 'geox_mcft_cap_06_s8_restart_readback_rebuild_authority_graph_v1');
  assert.equal(authority.delivery_slice_id, S8);
  assert.equal(authority.status, 'FROZEN_BEFORE_RUNTIME_SOURCE');
  assert.equal(authority.input_authority.evaluation_ref, EVALUATION_REF);
  assert.equal(authority.input_authority.evaluation_hash, EVALUATION_HASH);
  assert.equal(authority.input_authority.latest_or_list_query_permitted, false);
  assert.equal(authority.restart_boundary.fresh_process_required, true);
  assert.equal(authority.restart_boundary.canonical_fact_store_is_only_recovery_authority, true);
  assert.equal(authority.rebuild_graph.authority, 'PostgresCalibrationGovernanceRepositoryV1.rebuildFromFacts');
  assert.deepEqual(authority.rebuild_graph.expected_summary, SUMMARY);
  assert.equal(authority.rebuild_graph.second_rebuild_required, true);
  assert.equal(authority.controlled_mutation_boundary.projection_delete_for_rebuild_authorized, true);
  assert.equal(authority.controlled_mutation_boundary.projection_insert_for_rebuild_authorized, true);
  assertZeros(authority.controlled_mutation_boundary, 'S8_AUTHORITY');
  assert.equal(authority.successor_boundary.s9_authorized, false);

  assert.equal(contract.status, 'AUTHORIZED_NOT_STARTED_AUTHORITY_GRAPH_FROZEN');
  assert.equal(contract.predecessor_effective, true);
  assert.equal(contract.authorized_existing_apis.canonical_readback, 'PostgresCalibrationGovernanceRepositoryV1.readCanonicalObject');
  assert.equal(contract.authorized_existing_apis.facts_based_rebuild, 'PostgresCalibrationGovernanceRepositoryV1.rebuildFromFacts');
  assert.equal(contract.new_source_forbidden.canonical_commit_port, true);
  assert.deepEqual(contract.required_rebuild_summary, SUMMARY);
  assertZeros(contract.required_zero_deltas, 'S8_CONTRACT');
  assert.equal(contract.protected_existing_file_delta_required, 0);
  assert.equal(contract.s9_authorized, false);

  assert.equal(status.status, 'CANDIDATE_IMPLEMENTED_NOT_EFFECTIVE');
  assert.equal(status.s8_authorized, true);
  assert.equal(status.s8_implementation_started, true);
  assert.equal(status.s8_candidate_implemented, true);
  assert.equal(status.s8_effective, false);
  assert.equal(status.canonical_write_authorized, false);
  assert.equal(status.projection_rebuild_authorized, true);
  assert.deepEqual(status.controlled_acceptance.first_rebuild_summary, SUMMARY);
  assertZeros(status.runtime_delta, 'S8_STATUS');
  assert.equal(status.s9_authorized, false);

  // Candidate implementation must not move the global effectiveness frontier.
  assert.equal(delivery.active_delivery_slice_id, S8);
  assert.deepEqual(delivery.authorized_not_started_slices, [S8]);
  assert.equal(delivery.s8.authorized, true);
  assert.equal(delivery.s8.implementation_started, false);
  assert.equal(delivery.s8.candidate_implemented, false);
  assert.equal(delivery.s8.effective, false);
  assert.equal(delivery.blocked_slices.includes(S9), true);
  assert.equal(slices.active_delivery_slice_id, S8);
  assert.equal(slices.s8_authorized, true);
  assert.equal(slices.s8_implementation_started, false);
  assert.equal(slices.s8_candidate_implemented, false);
  assert.equal(slices.s8_effective, false);
  assert.equal(reconciliation.current_state.active_delivery_slice_id, S8);
  assert.equal(reconciliation.current_state.s8_authorized, true);
  assert.equal(reconciliation.current_state.s8_implementation_started, false);
  assert.equal(reconciliation.current_state.s8_candidate_implemented, false);
  assert.equal(reconciliation.current_state.s8_effective, false);

  assert.equal(input.schema_version, 'geox_mcft_cap_06_s8_restart_readback_rebuild_preflight_input_v1');
  assert.equal(input.status, 'READY_FOR_GOVERNANCE');
  assert.equal(input.production_database_used, false);
  for (const stageId of REQUIRED_STAGES) {
    const stage = input.stages.find((item) => item.stage_id === stageId);
    assert.ok(stage, `S8_RESTART_REBUILD_PREFLIGHT_STAGE_MISSING:${stageId}`);
    assert.equal(stage.status, 'PASS', `S8_RESTART_REBUILD_PREFLIGHT_STAGE_NOT_PASS:${stageId}`);
    assert.equal(stage.exit_code, 0, `S8_RESTART_REBUILD_PREFLIGHT_STAGE_EXIT_NONZERO:${stageId}`);
  }

  assert.equal(database.status, 'PASS');
  assert.equal(database.evaluation_ref, EVALUATION_REF);
  assert.equal(database.evaluation_hash, EVALUATION_HASH);
  assert.equal(database.candidate_ref, CANDIDATE_REF);
  assert.equal(database.candidate_hash, CANDIDATE_HASH);
  assert.equal(database.evaluation_case_count, 8);
  assert.equal(database.governance_fact_count, 2);
  assert.equal(database.fresh_process_count, 2);
  assert.notEqual(database.first_restart_process_pid, database.parent_process_pid);
  assert.notEqual(database.second_restart_process_pid, database.parent_process_pid);
  assert.notEqual(database.first_restart_process_pid, database.second_restart_process_pid);
  assert.deepEqual(database.first_rebuild_summary, SUMMARY);
  assert.deepEqual(database.second_rebuild_summary, SUMMARY);
  assert.equal(database.canonical_facts_hash_before, database.canonical_facts_hash_after);
  assert.equal(database.first_projection_snapshot_hash, database.second_projection_snapshot_hash);
  assert.equal(database.exact_readback_verified, true);
  assert.equal(database.deterministic_second_rebuild_verified, true);
  assert.deepEqual(database.projection_counts, {
    idempotency: 2,
    candidate: 1,
    evaluation: 1,
    candidate_evaluation: 1,
    cases: 8,
  });
  assertZeros(database, 'S8_DATABASE');
  assert.equal(database.production_database_used, false);

  const result = {
    schema_version: 'geox_mcft_cap_06_s8_restart_readback_rebuild_governance_result_v1',
    status: 'PASS',
    exact_head: git(['rev-parse', 'HEAD']),
    baseline_ref: baseline,
    changed_file_count: changed.length,
    logical_commit_count: commitCount,
    protected_predecessor_path_delta_count: 0,
    authority_graph_status: authority.status,
    preflight_stage_count: input.stages.length,
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
    exact_readback_verified: true,
    deterministic_second_rebuild_verified: true,
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
    s8_candidate_implemented: true,
    s8_effective: false,
    s9_authorized: false,
  };
  write(result);
  console.log(JSON.stringify(result));
}

try {
  main();
} catch (error) {
  const result = {
    schema_version: 'geox_mcft_cap_06_s8_restart_readback_rebuild_governance_result_v1',
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
  write(result);
  console.error(JSON.stringify(result));
  process.exitCode = 1;
}
