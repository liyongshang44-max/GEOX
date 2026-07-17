// Purpose: validate governance-only S6 paired-shadow merged-main effectiveness and bounded S7 authorization.
// Boundary: no Runtime execution, database access, canonical/projection write, S7 implementation, Evaluation commit, activation, route, Web, scheduler or migration.

'use strict';

const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const OUTPUT_DIR = path.join(ROOT, 'acceptance-output');
const RESULT_PATH = path.join(OUTPUT_DIR, 'MCFT_CAP_06_S6_PAIRED_SHADOW_EFFECTIVENESS_RESULT.json');
const S6 = 'MCFT-CAP-06.MCFT-06-09-11-12.PAIRED-HISTORICAL-SHADOW-COMPUTE-V1';
const S7 = 'MCFT-CAP-06.MCFT-03-12.SHADOW-EVALUATION-COMMIT-V1';
const S8 = 'MCFT-CAP-06.MCFT-03-04-12.RESTART-READBACK-REBUILD-V1';
const IMPLEMENTATION_HEAD = 'a7303ca4c5261d1ae61ecb295d4aa305134db6b4';
const IMPLEMENTATION_MERGE = 'b1111e39ed70b39098362a468eac14101bc29ee3';
const EFFECTIVENESS_REF = 'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S6-PAIRED-SHADOW-EFFECTIVENESS.json';
const STATUS_REF = 'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S6-PAIRED-SHADOW-STATUS.json';
const EXPECTED_FILES = [
  '.github/workflows/mcft-cap-06-s5-candidate-effectiveness.yml',
  '.github/workflows/mcft-cap-06-s6-paired-shadow-effectiveness.yml',
  '.github/workflows/mcft-cap-06-s6-paired-shadow.yml',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-DELIVERY-STATE.json',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-STATE-RECONCILIATION.json',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-DELIVERY-SLICE-STATUS.json',
  EFFECTIVENESS_REF,
  STATUS_REF,
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S6_PAIRED_SHADOW_EFFECTIVENESS.cjs',
];
const FORBIDDEN_PREFIXES = [
  'apps/server/src/domain/',
  'apps/server/src/runtime/',
  'apps/server/src/persistence/',
  'apps/server/scripts/',
  'apps/server/db/migrations/',
  'apps/web/',
];
const ZERO_EFFECT_KEYS = [
  'governance_writeback_canonical_write_count',
  'production_candidate_append_count',
  'production_evaluation_append_count',
  'projection_write_count',
  'model_activation_count',
  'active_config_switch_count',
  'runtime_parameter_change_count',
  'state_mutation_count',
  'checkpoint_mutation_count',
  'migration_count',
  'public_route_count',
  'web_change_count',
  'scheduler_count',
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
  const explicit = String(process.env.MCFT_CAP_06_S6_PAIRED_SHADOW_EFFECTIVENESS_BASELINE_REF || '').trim();
  const baseline = explicit || IMPLEMENTATION_MERGE;
  git(['cat-file', '-e', `${baseline}^{commit}`]);
  return baseline;
}
function assertZeros(object, keys = Object.keys(object)) {
  for (const key of keys) assert.equal(object[key], 0, `S6_EFFECTIVENESS_${key.toUpperCase()}_NONZERO`);
}

function main() {
  const baseline = baselineRef();
  const changedRaw = git(['diff', '--name-only', `${baseline}...HEAD`]);
  const changed = changedRaw ? changedRaw.split(/\r?\n/).filter(Boolean).sort() : [];
  assert.deepEqual(changed, [...EXPECTED_FILES].sort());
  for (const prefix of FORBIDDEN_PREFIXES) {
    assert.equal(changed.some((file) => file.startsWith(prefix)), false, `S6_EFFECTIVENESS_FORBIDDEN_PREFIX:${prefix}`);
  }
  assert.equal(changed.some((file) => /routes?|controller|openapi/i.test(file)), false);
  const commitCount = Number(git(['rev-list', '--count', `${baseline}..HEAD`]));
  assert.ok(commitCount >= 1 && commitCount <= 12, 'S6_EFFECTIVENESS_LOGICAL_COMMIT_COUNT_INVALID');
  for (const message of git(['log', '--format=%s', `${baseline}..HEAD`]).split(/\r?\n/).filter(Boolean)) {
    assert.equal(/wip|fix ci|try again|debug|temporary/i.test(message), false, `S6_EFFECTIVENESS_COMMIT_MESSAGE_INVALID:${message}`);
  }
  assert.equal(git(['diff', '--name-only', IMPLEMENTATION_HEAD, IMPLEMENTATION_MERGE]), '');

  const effect = json(EFFECTIVENESS_REF);
  const status = json(STATUS_REF);
  const delivery = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-DELIVERY-STATE.json');
  const reconciliation = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-STATE-RECONCILIATION.json');
  const slices = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-DELIVERY-SLICE-STATUS.json');

  assert.equal(effect.schema_version, 'geox_mcft_cap_06_s6_paired_shadow_effectiveness_v1');
  assert.equal(effect.delivery_slice_id, S6);
  assert.equal(effect.status, 'MERGED_EFFECTIVE');
  assert.equal(effect.effective, true);
  assert.equal(effect.implementation_pr_number, 2560);
  assert.equal(effect.implementation_exact_head, IMPLEMENTATION_HEAD);
  assert.equal(effect.implementation_focused_validation_run, 29606770957);
  assert.equal(effect.implementation_standard_ci_run, 29606770968);
  assert.equal(effect.implementation_merge_commit, IMPLEMENTATION_MERGE);
  assert.equal(effect.head_to_merge_file_delta_count, 0);
  assert.equal(effect.head_to_merge_tree_equivalence, 'PASS');
  assert.equal(effect.postmerge_probe_pr_number, 2561);
  assert.equal(effect.postmerge_probe_closed_without_merge, true);
  assert.equal(effect.postmerge_workflow_run, 29607442809);
  assert.equal(effect.postmerge_gate, 'PASS');
  assert.equal(effect.controlled_acceptance.candidate_ref, 'twin_calibration_candidate_5649b9ab80b5545cf6007387');
  assert.equal(effect.controlled_acceptance.candidate_hash, 'sha256:a2018a61bf6699b3cc3b8992058eb2c37b4d38d7f70771f9186495144c229a65');
  assert.equal(effect.controlled_acceptance.candidate_parameter_value, '0.034000');
  assert.equal(effect.controlled_acceptance.holdout_case_count, 8);
  assert.equal(effect.controlled_acceptance.evaluation_disposition, 'ELIGIBLE_FOR_HUMAN_ACTIVATION_REVIEW');
  assert.deepEqual(effect.controlled_acceptance.reason_codes, ['ALL_THRESHOLDS_PASS']);
  assert.equal(effect.controlled_acceptance.candidate_metrics.rmse_vwc, '0.000000000');
  assert.equal(effect.controlled_acceptance.case_results_hash, 'sha256:e1b33fb79059856c030cab58970c543f384fb30a385bc3aa49c96b315efe4daa');
  assert.equal(effect.controlled_acceptance.compute_determinism_hash, 'sha256:8017c2ba6006e1f2a593312300937841b5c2dd3a700c949bb8309338994ef63e');
  assert.equal(effect.controlled_acceptance.deterministic_rerun_verified, true);
  assert.equal(effect.controlled_acceptance.future_leakage_count, 0);
  assert.equal(effect.controlled_acceptance.fact_count_before_shadow, 217);
  assert.equal(effect.controlled_acceptance.fact_count_after_shadow, 217);
  assert.equal(effect.preflight.status, 'PASS_EXACT_HEAD_AND_MERGED_MAIN');
  assert.equal(effect.preflight.preflight_stage_count, 8);
  assert.equal(effect.preflight.changed_file_count, 10);
  assert.equal(effect.preflight.logical_commit_count_before_merge, 11);
  assert.equal(effect.preflight.logical_commit_count_with_merge, 12);
  assert.equal(effect.preflight.protected_predecessor_path_delta_count, 0);
  assertZeros(effect.runtime_delta_boundary, ZERO_EFFECT_KEYS);
  assert.equal(effect.active_delivery_slice_id, S7);
  assert.deepEqual(effect.authorized_not_started_slice_ids, [S7]);
  assert.equal(effect.s6_effective, true);
  assert.equal(effect.s7_authorized, true);
  assert.equal(effect.s7_implementation_started, false);
  assert.equal(effect.s7_candidate_implemented, false);
  assert.equal(effect.s7_effective, false);
  assert.equal(effect.s7_exact_s6_result_consumption_required, true);
  assert.equal(effect.s7_evaluation_builder_authorized, true);
  assert.equal(effect.s7_evaluation_append_authorized, true);
  assert.equal(effect.s7_projection_write_authorized, true);
  assert.equal(effect.s7_candidate_append_authorized, false);
  assert.equal(effect.s7_model_activation_authorized, false);
  assert.equal(effect.s7_active_config_switch_authorized, false);
  assert.equal(effect.successor_capability_line_authorized, false);

  assert.equal(status.status, 'MERGED_EFFECTIVE');
  assert.equal(status.implementation_status, 'MERGED_EFFECTIVE');
  assert.equal(status.effectiveness_ref, EFFECTIVENESS_REF);
  assert.equal(status.s6_candidate_implemented, true);
  assert.equal(status.s6_effective, true);
  assert.equal(status.implementation_evidence.implementation_pr_number, 2560);
  assert.equal(status.implementation_evidence.exact_head, IMPLEMENTATION_HEAD);
  assert.equal(status.implementation_evidence.merge_commit, IMPLEMENTATION_MERGE);
  assert.equal(status.implementation_evidence.postmerge_workflow_run, 29607442809);
  assert.equal(status.implementation_evidence.postmerge_gate, 'PASS');
  assert.equal(status.controlled_acceptance.case_results_hash, effect.controlled_acceptance.case_results_hash);
  assert.equal(status.controlled_acceptance.compute_determinism_hash, effect.controlled_acceptance.compute_determinism_hash);
  assertZeros(status.runtime_delta);
  assert.equal(status.s7_authorized, true);
  assert.equal(status.s7_implementation_started, false);
  assert.equal(status.s7_status, 'AUTHORIZED_NOT_STARTED');

  assert.equal(delivery.baseline_effectiveness_ref, EFFECTIVENESS_REF);
  assert.equal(delivery.baseline_main_commit, IMPLEMENTATION_MERGE);
  assert.equal(delivery.status, 'S6_PAIRED_SHADOW_MERGED_EFFECTIVE_S7_AUTHORIZED_NOT_STARTED');
  assert.equal(delivery.implementation_status, 'S7_AUTHORIZED_NOT_STARTED');
  assert.equal(delivery.active_delivery_slice_id, S7);
  assert.deepEqual(delivery.candidate_slices, []);
  assert.deepEqual(delivery.authorized_not_started_slices, [S7]);
  assert.equal(delivery.blocked_slices.includes(S7), false);
  assert.equal(delivery.blocked_slices.includes(S8), true);
  assert.equal(delivery.s6.effective, true);
  assert.equal(delivery.s6.effectiveness_ref, EFFECTIVENESS_REF);
  assert.equal(delivery.s7.authorized, true);
  assert.equal(delivery.s7.implementation_started, false);
  assert.equal(delivery.s7.candidate_implemented, false);
  assert.equal(delivery.s7.effective, false);
  assert.equal(delivery.s7.exact_s6_result_consumption_required, true);
  assert.equal(delivery.s7.evaluation_append_authorized, true);
  assert.equal(delivery.s7.projection_write_authorized, true);
  assert.equal(delivery.s7.model_activation_authorized, false);
  assert.equal(delivery.next_repository_action, S7);

  assert.equal(slices.implementation_status, 'S7_AUTHORIZED_NOT_STARTED');
  assert.equal(slices.active_delivery_slice_id, S7);
  assert.deepEqual(slices.candidate_slices, []);
  assert.deepEqual(slices.authorized_not_started_slices, [S7]);
  assert.equal(slices.blocked_slices.includes(S7), false);
  assert.equal(slices.blocked_slices.includes(S8), true);
  assert.equal(slices.s6_effective, true);
  assert.equal(slices.s6_effectiveness_ref, EFFECTIVENESS_REF);
  assert.equal(slices.s7_authorized, true);
  assert.equal(slices.s7_implementation_started, false);
  assert.equal(slices.s7_effective, false);
  const completedS6 = slices.completed_or_effective_slices.find((item) => item.delivery_slice_id === S6);
  assert.ok(completedS6, 'S6_EFFECTIVE_SLICE_MISSING');
  assert.equal(completedS6.status, 'MERGED_EFFECTIVE');
  assert.equal(completedS6.exact_head, IMPLEMENTATION_HEAD);
  assert.equal(completedS6.merge_commit, IMPLEMENTATION_MERGE);
  assert.equal(completedS6.postmerge_workflow_run, 29607442809);
  assert.equal(completedS6.holdout_case_count, 8);
  assert.equal(completedS6.evaluation_disposition, 'ELIGIBLE_FOR_HUMAN_ACTIVATION_REVIEW');
  assert.equal(completedS6.canonical_fact_write_count, 0);
  assert.equal(completedS6.projection_write_count, 0);
  assert.equal(completedS6.evaluation_append_count, 0);
  assert.equal(completedS6.model_activation_count, 0);

  assert.equal(reconciliation.baseline_main_commit, IMPLEMENTATION_MERGE);
  assert.equal(reconciliation.delivery_frontier_status, 'S6_PAIRED_SHADOW_MERGED_EFFECTIVE_S7_AUTHORIZED_NOT_STARTED');
  assert.equal(reconciliation.current_state.active_delivery_slice_id, S7);
  assert.equal(reconciliation.current_state.paired_historical_shadow_runtime_implemented, true);
  assert.equal(reconciliation.current_state.shadow_evaluation_runtime_implemented, false);
  assert.equal(reconciliation.current_state.s6, 'MERGED_EFFECTIVE');
  assert.equal(reconciliation.current_state.s6_effective, true);
  assert.equal(reconciliation.current_state.s7_authorized, true);
  assert.equal(reconciliation.current_state.s7_implementation_started, false);
  assert.equal(reconciliation.current_state.s7_candidate_implemented, false);
  assert.equal(reconciliation.current_state.s7_effective, false);
  assert.equal(reconciliation.proof.s6_paired_shadow_effectiveness.implementation_merge_commit, IMPLEMENTATION_MERGE);
  assert.equal(reconciliation.proof.s6_paired_shadow_effectiveness.postmerge_workflow_run, 29607442809);
  assert.equal(reconciliation.proof.s6_paired_shadow_effectiveness.s6_effective, true);
  assert.equal(reconciliation.proof.s6_paired_shadow_effectiveness.s7_authorized, true);
  assert.equal(reconciliation.proof.s6_paired_shadow_effectiveness.s7_implementation_started, false);
  assert.equal(reconciliation.next_repository_action, S7);
  assert.equal(reconciliation.s6_paired_shadow_effectiveness_ref, EFFECTIVENESS_REF);

  const result = {
    schema_version: 'geox_mcft_cap_06_s6_paired_shadow_effectiveness_result_v1',
    status: 'PASS',
    exact_head: git(['rev-parse', 'HEAD']),
    baseline_ref: baseline,
    changed_file_count: changed.length,
    logical_commit_count: commitCount,
    s6_status: 'MERGED_EFFECTIVE',
    active_delivery_slice_id: S7,
    s6_effective: true,
    s7_authorized: true,
    s7_implementation_started: false,
    governance_writeback_canonical_write_count: 0,
    production_candidate_append_count: 0,
    production_evaluation_append_count: 0,
    projection_write_count: 0,
    model_activation_count: 0,
    active_config_switch_count: 0,
    runtime_parameter_change_count: 0,
    state_mutation_count: 0,
    checkpoint_mutation_count: 0,
    migration_count: 0,
  };
  write(result);
  console.log(JSON.stringify(result));
}

try { main(); } catch (error) {
  const result = {
    schema_version: 'geox_mcft_cap_06_s6_paired_shadow_effectiveness_result_v1',
    status: 'FAIL',
    error: error instanceof Error ? error.message : String(error),
    s6_effective: false,
    s7_authorized: false,
    s7_implementation_started: false,
    governance_writeback_canonical_write_count: 0,
    production_candidate_append_count: 0,
    production_evaluation_append_count: 0,
    projection_write_count: 0,
    model_activation_count: 0,
    active_config_switch_count: 0,
    runtime_parameter_change_count: 0,
    state_mutation_count: 0,
    checkpoint_mutation_count: 0,
    migration_count: 0,
  };
  write(result);
  console.error(JSON.stringify(result));
  process.exitCode = 1;
}
