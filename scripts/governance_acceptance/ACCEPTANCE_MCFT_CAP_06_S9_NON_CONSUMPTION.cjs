// Purpose: validate the S9 post-evaluation non-consumption implementation candidate, its exact same-scope Runtime evidence, and the unchanged global S9/S10 delivery frontier.
// Boundary: governance read/validation only; PR hygiene remains repository-wide MCFT-DELIVERY-POLICY-V1 authority and is not a Calibration Runtime Slice concern.

'use strict';

const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const OUTPUT_DIR = path.join(ROOT, 'acceptance-output');
const RESULT_PATH = path.join(OUTPUT_DIR, 'MCFT_CAP_06_S9_NON_CONSUMPTION_GOVERNANCE_RESULT.json');
const INPUT_PATH = path.join(OUTPUT_DIR, 'MCFT_CAP_06_S9_NON_CONSUMPTION_PREFLIGHT_INPUT.json');
const DEFAULT_BASELINE = 'cc95f9ebced0c7f8dc92d2a0b5d9716e06c3ec2c';
const S9 = 'MCFT-CAP-06.MCFT-04-06-08-09-12.POST-EVALUATION-NON-CONSUMPTION-TICK-V1';
const S10 = 'MCFT-CAP-06.MCFT-04-12-16.BOUNDED-CALIBRATION-SHADOW-CLOSURE-V1';
const EXPECTED_FILES = [
  '.github/workflows/mcft-cap-06-s9-non-consumption.yml',
  'apps/server/src/runtime/calibration/post_evaluation_non_consumption_tick_service_v1.ts',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S9-POST-EVALUATION-NON-CONSUMPTION-AUTHORITY-GRAPH.json',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S9-POST-EVALUATION-NON-CONSUMPTION-IMPLEMENTATION-CONTRACT.json',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S9-POST-EVALUATION-NON-CONSUMPTION-STATUS.json',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S9_NON_CONSUMPTION.cjs',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S9_NON_CONSUMPTION_DB.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S9_NON_CONSUMPTION_DOMAIN.ts',
  'scripts/runtime_acceptance/RUN_MCFT_CAP_06_S9_NON_CONSUMPTION.cjs',
];
const FORBIDDEN_PREFIXES = [
  'apps/server/db/migrations/',
  'apps/web/',
  'fixtures/',
  'docker/',
];
const ZERO_FIELDS = [
  'candidate_fact_delta',
  'evaluation_fact_delta',
  'model_activation_count',
  'state_parameter_mutation_count',
  'checkpoint_parameter_mutation_count',
  'migration_count',
];

function git(args) {
  return cp.execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}
function text(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}
function json(relativePath) {
  return JSON.parse(text(relativePath));
}
function write(result) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(RESULT_PATH, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
}

function main() {
  const baseline = String(process.env.MCFT_CAP_06_S9_NON_CONSUMPTION_BASE_REF || DEFAULT_BASELINE).trim();
  git(['cat-file', '-e', `${baseline}^{commit}`]);
  const changedRaw = git(['diff', '--name-only', `${baseline}...HEAD`]);
  const changed = changedRaw ? changedRaw.split(/\r?\n/).filter(Boolean).sort() : [];
  assert.deepEqual(changed, [...EXPECTED_FILES].sort(), 'S9_CHANGED_FILE_BOUNDARY_INVALID');
  assert.equal(changed.some((file) => FORBIDDEN_PREFIXES.some((prefix) => file.startsWith(prefix))), false, 'S9_FORBIDDEN_FILE_CHANGED');
  assert.equal(changed.some((file) => /route|controller|openapi|scheduler/i.test(file)), false, 'S9_FORBIDDEN_SURFACE_CHANGED');
  assert.deepEqual(
    changed.filter((file) => file.startsWith('apps/server/src/')),
    ['apps/server/src/runtime/calibration/post_evaluation_non_consumption_tick_service_v1.ts'],
    'S9_PRODUCT_RUNTIME_BOUNDARY_INVALID',
  );

  const policy = json('docs/digital_twin/mcft/MCFT-DELIVERY-POLICY-V1.json');
  const manifest = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-TASKBOOK-MANIFEST.json');
  const frontier = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-DELIVERY-AUTHORITY-V2.json');
  const graph = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S9-POST-EVALUATION-NON-CONSUMPTION-AUTHORITY-GRAPH.json');
  const contract = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S9-POST-EVALUATION-NON-CONSUMPTION-IMPLEMENTATION-CONTRACT.json');
  const status = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S9-POST-EVALUATION-NON-CONSUMPTION-STATUS.json');
  const input = json(path.relative(ROOT, INPUT_PATH));
  const domain = json('acceptance-output/MCFT_CAP_06_S9_NON_CONSUMPTION_DOMAIN_RESULT.json');
  const database = json('acceptance-output/MCFT_CAP_06_S9_NON_CONSUMPTION_DB_RESULT.json');
  const serviceSource = text('apps/server/src/runtime/calibration/post_evaluation_non_consumption_tick_service_v1.ts');

  assert.deepEqual(policy.frozen_taskbook_gap_classification.allowed_classes, ['IMPLEMENTATION_DEFECT', 'TASKBOOK_DESIGN_DEFECT']);
  assert.equal(policy.frozen_taskbook_gap_classification.implementation_defect.new_prerequisite_allowed, false);
  assert.equal(policy.capability_slice, false);
  assert.equal(manifest.effective_taskbook_version, 'v0.4.0');
  assert.equal(manifest.execution_control.active_delivery_slice_id, S9);
  assert.equal(manifest.s8_effective, true);
  assert.equal(manifest.s9_authorized, true);
  assert.equal(manifest.s9_implementation_started, false);
  assert.equal(manifest.normative_slice_graph.includes(S9), true);
  assert.equal(manifest.normative_slice_graph.includes(S10), true);

  assert.equal(frontier.record_kind, 'SOLE_MUTABLE_DELIVERY_FRONTIER');
  assert.equal(frontier.active_delivery_slice_id, S9);
  assert.equal(frontier.implementation_state.s8_effective, true);
  assert.equal(frontier.implementation_state.s9_authorized, true);
  assert.equal(frontier.implementation_state.s9_implementation_started, false);
  assert.equal(frontier.new_prerequisite_inserted, false);
  assert.equal(frontier.successor_capability_line_authorized, false);

  assert.equal(graph.delivery_slice_id, S9);
  assert.equal(graph.classification, 'CAPABILITY_SLICE_IMPLEMENTATION');
  assert.equal(graph.predecessor.status, 'MERGED_EFFECTIVE');
  assert.equal(graph.predecessor.effectiveness_merge, DEFAULT_BASELINE);
  assert.equal(graph.runtime_authority.base_effective_drainage_coefficient, '0.030000');
  assert.equal(graph.runtime_authority.same_scope_precondition_tick_count, 24);
  assert.equal(graph.runtime_authority.same_scope_precondition_final_sequence, 72);
  assert.equal(graph.runtime_authority.cross_scope_proof_composition_forbidden, true);
  assert.equal(graph.runtime_authority.candidate_ref_is_runtime_authority, false);
  assert.equal(graph.runtime_authority.evaluation_ref_is_runtime_authority, false);
  assert.equal(graph.runtime_authority.new_immutable_per_tick_config_allowed, true);
  assert.equal(graph.ordered_execution.includes('VALIDATE_CANDIDATE_EVALUATION_RUNTIME_SCOPE_EQUALITY'), true);
  assert.equal(graph.forbidden_writes.includes('CROSS_SCOPE_RUNTIME_PROOF_COMPOSITION'), true);
  assert.equal(graph.new_prerequisite_inserted, false);
  assert.equal(graph.successor.authorized, false);

  assert.equal(contract.delivery_slice_id, S9);
  assert.equal(contract.new_runtime_semantics, false);
  assert.equal(contract.new_calibration_math, false);
  assert.equal(contract.new_scenario_math, false);
  assert.equal(contract.new_persistence_transaction, false);
  assert.equal(contract.new_migration, false);
  assert.equal(contract.new_route, false);
  assert.equal(contract.new_scheduler, false);
  assert.equal(contract.postgresql_precondition.candidate_evaluation_runtime_scope_must_match, true);
  assert.equal(contract.postgresql_precondition.same_scope_precondition_tick_count, 24);
  assert.equal(contract.postgresql_precondition.same_scope_precondition_final_sequence, 72);
  assert.equal(contract.postgresql_precondition.cross_scope_proof_composition_forbidden, true);
  assert.equal(contract.required_positive_proof.governance_runtime_scope_match, true);
  assert.equal(contract.required_negative_proof.includes('CANDIDATE_SCOPE_MISMATCH_REJECTED_BEFORE_RUNTIME_AUTHORITY_READ'), true);
  assert.equal(contract.required_negative_proof.includes('EVALUATION_SCOPE_MISMATCH_REJECTED_BEFORE_RUNTIME_AUTHORITY_READ'), true);
  assert.equal(contract.new_prerequisite_inserted, false);
  assert.equal(contract.successor_authorized, false);

  assert.equal(status.status, 'CANDIDATE_IMPLEMENTED_NOT_EFFECTIVE');
  assert.equal(status.s9_authorized, true);
  assert.equal(status.s9_implementation_started, true);
  assert.equal(status.s9_candidate_implemented, true);
  assert.equal(status.s9_implementation_merged, false);
  assert.equal(status.s9_merged_main_proven, false);
  assert.equal(status.s9_effective, false);
  assert.equal(status.governance_runtime_scope_match, true);
  assert.equal(status.same_scope_precondition.tick_count, 24);
  assert.equal(status.same_scope_precondition.final_sequence, 72);
  assert.equal(status.same_scope_precondition.cross_scope_proof_composition_forbidden, true);
  assert.equal(status.base_effective_drainage_coefficient, '0.030000');
  assert.equal(status.candidate_parameter_value, '0.034000');
  assert.equal(status.candidate_consumed, false);
  assert.equal(status.evaluation_consumed, false);
  assert.equal(status.model_activation_created, false);
  assert.equal(status.active_config_changed, false);
  assert.equal(status.new_prerequisite_inserted, false);
  assert.equal(status.new_slice_inserted, false);
  assert.equal(status.s10_authorized, false);
  assert.equal(status.s10_implementation_started, false);

  assert.equal(input.status, 'READY_FOR_GOVERNANCE');
  assert.equal(input.taskbook_version, 'v0.4.0');
  assert.equal(input.production_database_used, false);
  assert.equal(domain.status, 'PASS');
  assert.equal(database.status, 'PASS');
  assert.equal(domain.candidate_ref, database.candidate_ref);
  assert.equal(domain.candidate_hash, database.candidate_hash);
  assert.equal(domain.evaluation_ref, database.evaluation_ref);
  assert.equal(domain.evaluation_hash, database.evaluation_hash);
  assert.equal(domain.governance_runtime_scope_match, true);
  assert.equal(database.governance_runtime_scope_match, true);
  assert.equal(database.same_scope_precondition_tick_count, 24);
  assert.equal(database.same_scope_precondition_final_sequence, 72);
  assert.equal(database.candidate_parameter_value, '0.034000');
  assert.equal(database.effective_tick_parameter_value, '0.030000');
  assert.equal(database.immutable_runtime_config_append_count, 1);
  assert.equal(database.normal_tick_canonical_fact_append_count, 9);
  assert.equal(database.a1_canonical_fact_append_count, 8);
  assert.equal(database.scenario_set_canonical_fact_append_count, 1);
  assert.equal(database.forecast_point_count, 72);
  assert.equal(database.scenario_option_count, 3);
  assert.equal(database.scenario_points_per_option, 72);
  assert.equal(database.active_config_snapshot_changed, false);
  assert.equal(database.candidate_consumed, false);
  assert.equal(database.evaluation_consumed, false);
  assert.equal(database.completed_rerun_additional_fact_count, 0);
  assert.equal(database.completed_rerun_evidence_load_count, 0);
  assert.equal(database.production_database_used, false);
  for (const field of ZERO_FIELDS) assert.equal(database[field], 0, `S9_DATABASE_${field.toUpperCase()}_NONZERO`);

  assert.equal(serviceSource.includes('commitCanonicalObject'), false, 'S9_SERVICE_GOVERNANCE_COMMIT_PORT_FORBIDDEN');
  assert.equal(serviceSource.includes('twin_model_activation_v1'), false, 'S9_SERVICE_MODEL_ACTIVATION_WRITE_FORBIDDEN');
  assert.equal(serviceSource.includes('active_config_relation'), true, 'S9_ACTIVE_CONFIG_RELATION_SNAPSHOT_REQUIRED');
  assert.equal(serviceSource.includes('CAP06_S9_CANDIDATE_SCOPE_MISMATCH'), true, 'S9_CANDIDATE_SCOPE_GUARD_REQUIRED');
  assert.equal(serviceSource.includes('CAP06_S9_EVALUATION_SCOPE_MISMATCH'), true, 'S9_EVALUATION_SCOPE_GUARD_REQUIRED');
  assert.equal(serviceSource.includes('CAP06_S9_BASE_DRAINAGE_COEFFICIENT_V1 = "0.030000"'), true, 'S9_BASE_COEFFICIENT_CONSTANT_REQUIRED');

  const result = {
    schema_version: 'geox_mcft_cap_06_s9_non_consumption_governance_result_v1',
    status: 'PASS',
    baseline,
    changed_files: changed,
    changed_file_count: changed.length,
    taskbook_version: manifest.effective_taskbook_version,
    active_delivery_slice_id: frontier.active_delivery_slice_id,
    candidate_ref: database.candidate_ref,
    candidate_hash: database.candidate_hash,
    evaluation_ref: database.evaluation_ref,
    evaluation_hash: database.evaluation_hash,
    candidate_parameter_value: database.candidate_parameter_value,
    effective_tick_parameter_value: database.effective_tick_parameter_value,
    governance_runtime_scope_match: database.governance_runtime_scope_match,
    same_scope_precondition_tick_count: database.same_scope_precondition_tick_count,
    same_scope_precondition_final_sequence: database.same_scope_precondition_final_sequence,
    normal_tick_canonical_fact_append_count: database.normal_tick_canonical_fact_append_count,
    forecast_point_count: database.forecast_point_count,
    scenario_option_count: database.scenario_option_count,
    scenario_points_per_option: database.scenario_points_per_option,
    candidate_consumed: database.candidate_consumed,
    evaluation_consumed: database.evaluation_consumed,
    active_config_snapshot_changed: database.active_config_snapshot_changed,
    s9_candidate_implemented: true,
    s9_effective: false,
    s10_authorized: false,
    new_prerequisite_inserted: false,
    successor_capability_line_authorized: false,
  };
  write(result);
  console.log(JSON.stringify(result));
}

try {
  main();
} catch (error) {
  const failure = {
    schema_version: 'geox_mcft_cap_06_s9_non_consumption_governance_result_v1',
    status: 'FAIL',
    error: error instanceof Error ? error.message : String(error),
    s9_candidate_implemented: false,
    s9_effective: false,
    s10_authorized: false,
    new_prerequisite_inserted: false,
  };
  write(failure);
  console.error(JSON.stringify(failure));
  process.exitCode = 1;
}
