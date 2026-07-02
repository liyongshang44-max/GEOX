// scripts/twin_kernel/P32_ALL_ACCEPTANCE_CHECK.cjs
'use strict';

const fs = require('node:fs');
const cp = require('node:child_process');

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

function runRuntime(args) {
  return JSON.parse(
    cp.execFileSync(
      process.execPath,
      ['scripts/twin_kernel/P32_16_CONTROLLED_FORECAST_PROJECTION_RUNTIME_V0.cjs', ...args],
      { encoding: 'utf8' }
    )
  );
}

function collectFailure(failures, name, value) {
  if (!value) {
    failures.push(name);
  }
}

const failures = [];

const core = readJson('docs/twin_kernel/P32_FORECAST_PROJECTION_CORE_CONTRACT_V0.json');
const assumption = readJson('docs/twin_kernel/P32_ASSUMPTION_TRUTH_POLICY_V0.json');
const noEvaluation = readJson('docs/twin_kernel/P32_NO_EVALUATION_POLICY_V0.json');
const belief = readJson('docs/twin_kernel/P32_PROJECTION_BELIEF_POLICY_V0.json');
const chain = readJson('docs/twin_kernel/P32_PROJECTION_CHAIN_POLICY_V0.json');

const dryA = runRuntime([]);
const dryB = runRuntime([]);
const controlledWrite = runRuntime(['--mode', 'controlled-write']);
const twoStep = runRuntime(['--mode', 'controlled-two-step-projection']);

collectFailure(
  failures,
  'P32_00_baseline_commit_matches_p31_closure',
  core.baseline_commit === '129e981f24befa061c876399869a92a0fffe0297'
);

collectFailure(
  failures,
  'P32_01_only_forecast_run_and_projection_allowed',
  JSON.stringify(core.allowed_created_fact_types) === JSON.stringify(['forecast_run_v1', 'twin_state_projection_v1'])
);

collectFailure(
  failures,
  'P32_02_atomic_pair_contract_required',
  core.atomic_write_contract.forecast_run_v1_and_twin_state_projection_v1_must_be_created_atomically === true &&
    core.atomic_write_contract.forecast_run_without_projection_blocked === true &&
    core.atomic_write_contract.projection_without_forecast_run_blocked === true &&
    core.atomic_write_contract.projection_must_reference_forecast_run_id === true &&
    core.atomic_write_contract.forecast_run_must_reference_projection_id === true
);

collectFailure(
  failures,
  'P32_03_projection_references_forecast_run',
  dryA.projection_must_reference_forecast_run_id === true &&
    dryA.forecast_run_must_reference_projection_id === true
);

collectFailure(
  failures,
  'P32_04_source_state_is_twin_state_estimate',
  dryA.forecast_run.source_twin_state_estimate_ref.kind === 'twin_state_estimate_v1' &&
    dryA.twin_state_projection.source_twin_state_estimate_ref.kind === 'twin_state_estimate_v1'
);

collectFailure(
  failures,
  'P32_05_assumption_truth_split',
  assumption.scenario_assumption_ref_is_not_fact_truth === true &&
    assumption.weather_ref_is_not_weather_truth === true &&
    assumption.weather_observation_context_ref_is_context_only === true &&
    assumption.assumption_set_hash_required === true &&
    assumption.projection_must_preserve_assumption_refs === true
);

collectFailure(
  failures,
  'P32_06_horizon_policy_is_bounded',
  core.horizon_policy.forecast_horizon_required === true &&
    core.horizon_policy.forecast_horizon_max_days_v0 === 7 &&
    core.horizon_policy.forecast_time_step_required === true &&
    core.horizon_policy.forecast_projection_time_grid_must_be_deterministic === true
);

collectFailure(
  failures,
  'P32_07_runtime_kind_is_controlled_projection',
  dryA.runtime_kind === 'controlled_forecast_projection_runtime'
);

collectFailure(
  failures,
  'P32_08_idempotency_key_shared',
  dryA.forecast_run.idempotency_key === dryA.twin_state_projection.idempotency_key &&
    dryA.forecast_run.meta.idempotency_key === dryA.forecast_run.idempotency_key
);

collectFailure(
  failures,
  'P32_09_determinism_hash_stable',
  dryA.determinism_hash === dryB.determinism_hash &&
    dryA.forecast_run.determinism_hash === dryA.twin_state_projection.determinism_hash
);

collectFailure(
  failures,
  'P32_10_projection_belief_boundary',
  belief.projection_is_future_belief === true &&
    belief.projection_is_not_future_reality === true &&
    belief.projection_is_not_prediction_commitment === true &&
    belief.projection_is_not_ground_truth === true &&
    belief.projection_timeline_is_belief_trajectory === true
);

collectFailure(
  failures,
  'P32_11_projection_chain_policy',
  chain.previous_projection_chain_subject_must_remain_constant === true &&
    chain.previous_projection_chain_source_state_must_be_consistent === true &&
    chain.scenario_fork_must_be_explicit === true &&
    chain.implicit_projection_branching_forbidden === true
);

collectFailure(
  failures,
  'P32_12_no_forbidden_downstream_facts',
  dryA.forbidden_downstream_fact_count === 0 &&
    controlledWrite.forbidden_downstream_fact_count === 0 &&
    twoStep.forbidden_downstream_fact_count === 0
);

collectFailure(
  failures,
  'P32_13_no_evaluation_policy',
  noEvaluation.review_forbidden === true &&
    noEvaluation.score_forbidden === true &&
    noEvaluation.correctness_claim_forbidden === true &&
    noEvaluation.error_estimation_forbidden === true &&
    noEvaluation.projection_is_not_evaluation === true
);

collectFailure(
  failures,
  'P32_14_projection_does_not_authorize_recommendation_or_action',
  dryA.projection_is_not_evaluation === true &&
    belief.projection_timeline_is_not_plan === true &&
    belief.projection_timeline_is_not_transition === true
);

collectFailure(
  failures,
  'P32_15_atomic_local_write_readback',
  controlledWrite.forecast_run_v1_created === true &&
    controlledWrite.twin_state_projection_v1_created === true &&
    controlledWrite.atomic_pair_created === true &&
    controlledWrite.forecast_run_readback_passed === true &&
    controlledWrite.projection_readback_passed === true &&
    controlledWrite.projection_must_reference_forecast_run_id === true &&
    controlledWrite.forecast_run_must_reference_projection_id === true
);

collectFailure(
  failures,
  'P32_16_runner_modes_pass',
  dryA.ok === true &&
    controlledWrite.ok === true &&
    twoStep.ok === true
);

collectFailure(
  failures,
  'P32_17_blocked_fixture_surface_exists',
  runRuntime(['--fixture', 'missing-source-state']).projection_state === 'INSUFFICIENT_STATE_BASIS' &&
    runRuntime(['--fixture', 'horizon-exceeds']).projection_state === 'HORIZON_BLOCKED' &&
    runRuntime(['--fixture', 'weather-outside-horizon']).projection_state === 'WEATHER_CONTEXT_BLOCKED' &&
    runRuntime(['--fixture', 'implicit-branch']).projection_state === 'POLICY_BLOCKED'
);

collectFailure(
  failures,
  'P32_18_two_step_projection_chain_passes',
  twoStep.previous_projection_chain_subject_must_remain_constant === true &&
    twoStep.previous_projection_chain_source_state_must_be_consistent === true &&
    twoStep.scenario_fork_must_be_explicit === true &&
    twoStep.previous_projection_chain_hash_required_when_previous_projection_ref_present === true
);

collectFailure(
  failures,
  'P32_19_completion_review_ready',
  fs.existsSync('docs/tasks/P32-Controlled-Twin-Forecast-Projection-Runtime-v0.md') &&
    fs.existsSync('scripts/twin_kernel/P32_16_CONTROLLED_FORECAST_PROJECTION_RUNTIME_V0.cjs') &&
    fs.existsSync('docs/twin_kernel/P32_FORECAST_PROJECTION_CORE_CONTRACT_V0.json') &&
    fs.existsSync('docs/twin_kernel/P32_ASSUMPTION_TRUTH_POLICY_V0.json') &&
    fs.existsSync('docs/twin_kernel/P32_NO_EVALUATION_POLICY_V0.json') &&
    fs.existsSync('docs/twin_kernel/P32_PROJECTION_BELIEF_POLICY_V0.json') &&
    fs.existsSync('docs/twin_kernel/P32_PROJECTION_CHAIN_POLICY_V0.json')
);

const ok = failures.length === 0;

console.log(JSON.stringify({
  ok,
  acceptance: 'P32_ALL_ACCEPTANCE',
  phase: 'P32',
  baseline_tag: core.baseline_tag,
  baseline_commit: core.baseline_commit,
  assertion_count: 20,
  failed_assertion_count: failures.length,
  failed_assertions: failures,
  dry_run_determinism_hash: dryA.determinism_hash,
  controlled_write_determinism_hash: controlledWrite.determinism_hash,
  first_projection_determinism_hash: twoStep.first_determinism_hash,
  second_projection_determinism_hash: twoStep.second_determinism_hash
}, null, 2));

if (!ok) {
  process.exit(1);
}