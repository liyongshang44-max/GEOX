// Purpose: validate immutable S5 Candidate implementation evidence, frozen authority, structured preflight results and a monotonic post-effectiveness frontier.
// Boundary: structured governance only; no Runtime execution, database access, canonical write, Shadow Evaluation, Model Activation, State/checkpoint authority, route or scheduler.

'use strict';

const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const OUTPUT_DIR = path.join(ROOT, 'acceptance-output');
const INPUT_PATH = path.join(OUTPUT_DIR, 'MCFT_CAP_06_S5_CANDIDATE_PREFLIGHT_INPUT.json');
const RESULT_PATH = path.join(OUTPUT_DIR, 'MCFT_CAP_06_S5_CANDIDATE_GOVERNANCE_RESULT.json');
const S5 = 'MCFT-CAP-06.MCFT-06-09-11-12.CALIBRATION-CANDIDATE-COMPUTE-COMMIT-V1';
const S6 = 'MCFT-CAP-06.MCFT-06-09-11-12.PAIRED-HISTORICAL-SHADOW-COMPUTE-V1';
const S7 = 'MCFT-CAP-06.MCFT-03-12.SHADOW-EVALUATION-COMMIT-V1';
const IMPLEMENTATION_HEAD = 'd6085d0721b519f6a57971600f32b4fa89d15f97';
const IMPLEMENTATION_MERGE = '8edbc27ea0dfabd41faede9fb0f8bed11058c260';
const EFFECTIVENESS_REF = 'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S5-CANDIDATE-EFFECTIVENESS.json';
const EXPECTED_FILES = [
  '.github/workflows/mcft-cap-06-s5-candidate.yml',
  'apps/server/scripts/mcft/MCFT_CAP_06_CALIBRATION_SHADOW_RUNNER.ts',
  'apps/server/src/runtime/calibration/calibration_candidate_service_v1.ts',
  'apps/server/src/runtime/calibration/resolved_forecast_replay_prediction_adapter_v1.ts',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S5-CANDIDATE-AUTHORITY-GRAPH.json',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S5-CANDIDATE-IMPLEMENTATION-CONTRACT.json',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S5-CANDIDATE-STATUS.json',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S5_CANDIDATE.cjs',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S5_CANDIDATE.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S5_CANDIDATE_DB.ts',
  'scripts/runtime_acceptance/RUN_MCFT_CAP_06_S5_CANDIDATE.cjs',
  'scripts/runtime_acceptance/mcft_cap_06_s5_candidate_fixture_v1.ts',
];
const PROTECTED_PATHS = [
  'apps/server/src/domain/twin_runtime/canonical_object_contracts_v1.ts',
  'apps/server/src/domain/twin_runtime/canonical_identity_v1.ts',
  'apps/server/src/domain/twin_runtime/forecast_canonical_authority_v1.ts',
  'apps/server/src/runtime/twin_runtime/a0_record_set_builder_v1.ts',
  'apps/server/src/domain/twin_runtime/forecast_scenario_runtime_config_v1.ts',
];
const REQUIRED_STAGES = [
  'TYPECHECK',
  'BUILD',
  'S5_DOMAIN_CANDIDATE',
  'V2_DOMAIN_GRAPH_CONFORMANCE',
  'V2_POSTGRESQL_EXACT_REF_CONFORMANCE',
  'S2_EXACT_MATH_COMPATIBILITY',
  'S3_PERSISTENCE_REGRESSION',
  'S4_FORMAL_COMPOSITION',
  'S5_POSTGRESQL_CANDIDATE',
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
  const explicit = String(process.env.MCFT_CAP_06_S5_CANDIDATE_BASELINE_REF || '').trim();
  const baseline = explicit || 'dc7913d070c4a0c2cac0a7c35ccfa4292e633876';
  git(['cat-file', '-e', `${baseline}^{commit}`]);
  return baseline;
}
function commitExists(ref) {
  return cp.spawnSync('git', ['cat-file', '-e', `${ref}^{commit}`], {
    cwd: ROOT,
    stdio: 'ignore',
    shell: false,
  }).status === 0;
}

function implementationBoundary(baseline, effectivenessMode) {
  const implementationRef = effectivenessMode ? IMPLEMENTATION_HEAD : 'HEAD';
  if (effectivenessMode) {
    assert.equal(commitExists(IMPLEMENTATION_HEAD), true, 'S5_CANDIDATE_IMPLEMENTATION_HEAD_REQUIRED');
    assert.equal(commitExists(IMPLEMENTATION_MERGE), true, 'S5_CANDIDATE_IMPLEMENTATION_MERGE_REQUIRED');
    assert.equal(git(['diff', '--name-only', IMPLEMENTATION_HEAD, IMPLEMENTATION_MERGE]), '', 'S5_CANDIDATE_HEAD_TO_MERGE_DELTA_NONZERO');
  }
  const changedRaw = git(['diff', '--name-only', `${baseline}...${implementationRef}`]);
  const changed = changedRaw ? changedRaw.split(/\r?\n/).filter(Boolean).sort() : [];
  const commitCount = Number(git(['rev-list', '--count', `${baseline}..${implementationRef}`]));
  return { implementationRef, changed, commitCount };
}

function main() {
  const baseline = baselineRef();
  const status = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S5-CANDIDATE-STATUS.json');
  const effectivenessMode = status.s5_effective === true;
  const boundary = implementationBoundary(baseline, effectivenessMode);
  const changed = boundary.changed;
  const commitCount = boundary.commitCount;

  assert.deepEqual(changed, [...EXPECTED_FILES].sort());
  assert.deepEqual(changed.filter((file) => PROTECTED_PATHS.includes(file)), []);
  assert.equal(changed.some((file) => file.startsWith('apps/server/db/migrations/')), false);
  assert.equal(changed.some((file) => file.startsWith('apps/web/')), false);
  assert.equal(changed.some((file) => /routes?|controller|openapi/i.test(file)), false);
  assert.ok(commitCount >= 1 && commitCount <= 6, 'S5_CANDIDATE_LOGICAL_COMMIT_COUNT_INVALID');
  for (const message of git(['log', '--format=%s', `${baseline}..${boundary.implementationRef}`]).split(/\r?\n/).filter(Boolean)) {
    assert.equal(/wip|fix ci|try again|debug|temporary/i.test(message), false, `S5_CANDIDATE_COMMIT_MESSAGE_INVALID:${message}`);
  }

  const authority = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S5-CANDIDATE-AUTHORITY-GRAPH.json');
  const contract = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S5-CANDIDATE-IMPLEMENTATION-CONTRACT.json');
  const predecessorEffectiveness = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S5-PREDECESSOR-EFFECTIVENESS.json');
  const delivery = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-DELIVERY-STATE.json');
  const input = json('acceptance-output/MCFT_CAP_06_S5_CANDIDATE_PREFLIGHT_INPUT.json');
  const domain = json('acceptance-output/MCFT_CAP_06_S5_CANDIDATE_DOMAIN_RESULT.json');
  const database = json('acceptance-output/MCFT_CAP_06_S5_CANDIDATE_DB_RESULT.json');

  assert.equal(predecessorEffectiveness.status, 'MERGED_EFFECTIVE');
  assert.equal(predecessorEffectiveness.s5_authorized, true);

  assert.equal(authority.schema_version, 'geox_mcft_cap_06_s5_candidate_authority_graph_v1');
  assert.equal(authority.delivery_slice_id, S5);
  assert.equal(authority.status, 'FROZEN_BEFORE_RUNTIME_SOURCE');
  assert.equal(authority.input_authority.required_ref_count, 16);
  assert.equal(authority.input_authority.holdout_refs_permitted, false);
  assert.equal(authority.read_graph.sole_postgresql_authority, 'PostgresResolvedForecastObservationCaseAssemblerV1.resolveExactResidualRefs');
  assert.equal(authority.read_graph.transaction, 'ONE_REPEATABLE_READ_READ_ONLY_TRANSACTION');
  assert.equal(authority.compute_graph[2].expected_controlled_selected_parameter, '0.034000');
  assert.equal(authority.commit_graph.allowed_canonical_append.object_type, 'twin_calibration_candidate_v1');
  assert.equal(authority.commit_graph.allowed_canonical_append.maximum, 1);
  assert.equal(authority.canonical_boundary.evaluation_append_count, 0);
  assert.equal(authority.canonical_boundary.model_activation_count, 0);

  assert.equal(contract.status, 'AUTHORIZED_NOT_STARTED_AUTHORITY_GRAPH_FROZEN');
  assert.equal(contract.protected_existing_file_delta_required, 0);
  assert.equal(contract.migration_authorized, false);
  assert.equal(contract.shadow_compute_authorized, false);
  assert.equal(contract.evaluation_append_authorized, false);
  assert.equal(contract.model_activation_authorized, false);

  assert.equal(status.delivery_slice_id, S5);
  assert.equal(status.s5_authorized, true);
  assert.equal(status.s5_implementation_started, true);
  assert.equal(status.s5_candidate_implemented, true);
  assert.equal(status.controlled_acceptance.selected_parameter_value, '0.034000');
  assert.equal(status.controlled_acceptance.first_candidate_append_count, 1);
  assert.equal(status.controlled_acceptance.completed_chain_rerun_candidate_append_count, 0);
  for (const value of Object.values(status.production_runtime_delta)) assert.equal(value, 0);
  assert.equal(status.successor_capability_line_authorized, false);

  if (effectivenessMode) {
    const effect = json(EFFECTIVENESS_REF);
    assert.equal(status.status, 'MERGED_EFFECTIVE');
    assert.equal(status.implementation_status, 'MERGED_EFFECTIVE');
    assert.equal(status.effectiveness_ref, EFFECTIVENESS_REF);
    assert.equal(status.s5_effective, true);
    assert.equal(status.s6_authorized, true);
    assert.equal(status.s6_implementation_started, false);
    assert.equal(effect.status, 'MERGED_EFFECTIVE');
    assert.equal(effect.effective, true);
    assert.equal(effect.implementation_exact_head, IMPLEMENTATION_HEAD);
    assert.equal(effect.implementation_merge_commit, IMPLEMENTATION_MERGE);
    assert.equal(effect.head_to_merge_file_delta_count, 0);
    assert.equal(effect.head_to_merge_tree_equivalence, 'PASS');
    assert.equal(effect.postmerge_workflow_run, 29602381716);
    assert.equal(effect.s5_effective, true);
    assert.equal(effect.s6_authorized, true);
    assert.equal(effect.s6_implementation_started, false);
    assert.equal(delivery.active_delivery_slice_id, S6);
    assert.deepEqual(delivery.authorized_not_started_slices, [S6]);
    assert.equal(delivery.blocked_slices.includes(S6), false);
    assert.equal(delivery.blocked_slices.includes(S7), true);
    assert.equal(delivery.s5.effective, true);
    assert.equal(delivery.s6.authorized, true);
    assert.equal(delivery.s6.implementation_started, false);
    assert.equal(delivery.s6.canonical_write_authorized, false);
    assert.equal(delivery.s6.projection_write_authorized, false);
    assert.equal(delivery.s6.shadow_evaluation_append_authorized, false);
  } else {
    assert.equal(status.status, 'CANDIDATE_IMPLEMENTED_NOT_EFFECTIVE');
    assert.equal(status.s5_effective, false);
    assert.equal(status.s6_authorized, false);
    assert.equal(delivery.active_delivery_slice_id, S5);
    assert.equal(delivery.s5.authorized, true);
    assert.equal(delivery.s5.implementation_started, false);
    assert.equal(delivery.blocked_slices.includes(S6), true);
  }

  assert.equal(input.schema_version, 'geox_mcft_cap_06_s5_candidate_preflight_input_v1');
  assert.equal(input.status, 'READY_FOR_GOVERNANCE');
  assert.equal(input.production_database_used, false);
  for (const stageId of REQUIRED_STAGES) {
    const stage = input.stages.find((item) => item.stage_id === stageId);
    assert.ok(stage, `S5_CANDIDATE_PREFLIGHT_STAGE_MISSING:${stageId}`);
    assert.equal(stage.status, 'PASS', `S5_CANDIDATE_PREFLIGHT_STAGE_NOT_PASS:${stageId}`);
    assert.equal(stage.exit_code, 0, `S5_CANDIDATE_PREFLIGHT_STAGE_EXIT_NONZERO:${stageId}`);
  }
  assert.equal(domain.status, 'PASS');
  assert.equal(domain.calibration_case_count, 16);
  assert.equal(domain.grid_point_count, 21);
  assert.equal(domain.selected_parameter_value, '0.034000');
  assert.equal(domain.first_candidate_append_count, 1);
  assert.equal(domain.completed_chain_rerun_candidate_append_count, 0);
  assert.equal(database.status, 'PASS');
  assert.equal(database.exact_calibration_case_count, 16);
  assert.equal(database.selected_parameter_value, '0.034000');
  assert.equal(database.first_candidate_append_count, 1);
  assert.equal(database.completed_chain_rerun_candidate_append_count, 0);
  assert.equal(database.candidate_projection_count, 1);
  for (const key of [
    'evaluation_append_count',
    'model_activation_count',
    'active_config_switch_count',
    'runtime_parameter_change_count',
    'state_mutation_count',
    'checkpoint_mutation_count',
  ]) assert.equal(database[key], 0, `S5_CANDIDATE_DATABASE_${key.toUpperCase()}_NONZERO`);

  const result = {
    schema_version: 'geox_mcft_cap_06_s5_candidate_governance_result_v1',
    status: 'PASS',
    exact_head: git(['rev-parse', 'HEAD']),
    baseline_ref: baseline,
    implementation_ref: boundary.implementationRef,
    implementation_proof_mode: effectivenessMode ? 'EXACT_HISTORICAL_HEAD_AND_MERGE' : 'CURRENT_CANDIDATE_HEAD',
    changed_file_count: changed.length,
    logical_commit_count: commitCount,
    protected_predecessor_path_delta_count: 0,
    authority_graph_status: authority.status,
    preflight_stage_count: input.stages.length,
    calibration_case_count: database.exact_calibration_case_count,
    grid_point_count: domain.grid_point_count,
    selected_parameter_value: database.selected_parameter_value,
    controlled_candidate_append_count: database.first_candidate_append_count,
    completed_chain_rerun_candidate_append_count: database.completed_chain_rerun_candidate_append_count,
    production_candidate_append_count: 0,
    evaluation_append_count: 0,
    model_activation_count: 0,
    active_config_switch_count: 0,
    runtime_parameter_change_count: 0,
    state_mutation_count: 0,
    checkpoint_mutation_count: 0,
    s5_candidate_implemented: true,
    s5_effective: effectivenessMode,
    s6_authorized: effectivenessMode,
    s6_implementation_started: effectivenessMode ? delivery.s6.implementation_started : false,
  };
  write(result);
  console.log(JSON.stringify(result));
}

try {
  main();
} catch (error) {
  const result = {
    schema_version: 'geox_mcft_cap_06_s5_candidate_governance_result_v1',
    status: 'FAIL',
    error: error instanceof Error ? error.message : String(error),
    production_candidate_append_count: 0,
    evaluation_append_count: 0,
    model_activation_count: 0,
    active_config_switch_count: 0,
    state_mutation_count: 0,
    checkpoint_mutation_count: 0,
    s5_effective: false,
    s6_authorized: false,
    s6_implementation_started: false,
  };
  write(result);
  console.error(JSON.stringify(result));
  process.exitCode = 1;
}
