// Purpose: validate governance-only S5 Candidate merged-main effectiveness, monotonic historical Gates and bounded S6 authorization.
// Boundary: no Runtime implementation, database access, canonical write, S6 compute, Shadow Evaluation, activation, route, Web, scheduler or migration.

'use strict';

const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const OUTPUT_DIR = path.join(ROOT, 'acceptance-output');
const RESULT_PATH = path.join(OUTPUT_DIR, 'MCFT_CAP_06_S5_CANDIDATE_EFFECTIVENESS_RESULT.json');
const S5 = 'MCFT-CAP-06.MCFT-06-09-11-12.CALIBRATION-CANDIDATE-COMPUTE-COMMIT-V1';
const S6 = 'MCFT-CAP-06.MCFT-06-09-11-12.PAIRED-HISTORICAL-SHADOW-COMPUTE-V1';
const S7 = 'MCFT-CAP-06.MCFT-03-12.SHADOW-EVALUATION-COMMIT-V1';
const IMPLEMENTATION_HEAD = 'd6085d0721b519f6a57971600f32b4fa89d15f97';
const IMPLEMENTATION_MERGE = '8edbc27ea0dfabd41faede9fb0f8bed11058c260';
const EFFECTIVENESS_REF = 'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S5-CANDIDATE-EFFECTIVENESS.json';
const STATUS_REF = 'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S5-CANDIDATE-STATUS.json';
const EXPECTED_FILES = [
  '.github/workflows/mcft-cap-06-s5-candidate-effectiveness.yml',
  '.github/workflows/mcft-cap-06-s5-candidate.yml',
  '.github/workflows/mcft-cap-06-s5-entry-controls.yml',
  '.github/workflows/mcft-cap-06-s5-predecessor-graph-conformance.yml',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-DELIVERY-STATE.json',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-STATE-RECONCILIATION.json',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-DELIVERY-SLICE-STATUS.json',
  EFFECTIVENESS_REF,
  STATUS_REF,
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S4_EFFECTIVENESS_S5_AUTHORIZATION.cjs',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S4_STABILIZATION.cjs',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S5_CANDIDATE.cjs',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S5_CANDIDATE_EFFECTIVENESS.cjs',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S5_ENTRY_EFFECTIVENESS.cjs',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S5_PREDECESSOR_EFFECTIVENESS.cjs',
  'scripts/runtime_acceptance/RUN_MCFT_CAP_06_S5_CANDIDATE.cjs',
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
  const explicit = String(process.env.MCFT_CAP_06_S5_CANDIDATE_EFFECTIVENESS_BASELINE_REF || '').trim();
  const baseline = explicit || IMPLEMENTATION_MERGE;
  git(['cat-file', '-e', `${baseline}^{commit}`]);
  return baseline;
}
function assertZeros(object, keys = Object.keys(object)) {
  for (const key of keys) assert.equal(object[key], 0, `S5_EFFECTIVENESS_${key.toUpperCase()}_NONZERO`);
}

function main() {
  const baseline = baselineRef();
  const changedRaw = git(['diff', '--name-only', `${baseline}...HEAD`]);
  const changed = changedRaw ? changedRaw.split(/\r?\n/).filter(Boolean).sort() : [];
  assert.deepEqual(changed, [...EXPECTED_FILES].sort());
  for (const prefix of FORBIDDEN_PREFIXES) {
    assert.equal(changed.some((file) => file.startsWith(prefix)), false, `S5_EFFECTIVENESS_FORBIDDEN_PREFIX:${prefix}`);
  }
  assert.equal(changed.some((file) => /routes?|controller|openapi/i.test(file)), false);

  const commitCount = Number(git(['rev-list', '--count', `${baseline}..HEAD`]));
  assert.ok(commitCount >= 1 && commitCount <= 24, 'S5_EFFECTIVENESS_LOGICAL_COMMIT_COUNT_INVALID');
  for (const message of git(['log', '--format=%s', `${baseline}..HEAD`]).split(/\r?\n/).filter(Boolean)) {
    assert.equal(/wip|fix ci|try again|debug|temporary/i.test(message), false, `S5_EFFECTIVENESS_COMMIT_MESSAGE_INVALID:${message}`);
  }
  assert.equal(git(['diff', '--name-only', IMPLEMENTATION_HEAD, IMPLEMENTATION_MERGE]), '');

  const effect = json(EFFECTIVENESS_REF);
  const status = json(STATUS_REF);
  const delivery = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-DELIVERY-STATE.json');
  const reconciliation = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-STATE-RECONCILIATION.json');
  const slices = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-DELIVERY-SLICE-STATUS.json');

  assert.equal(effect.schema_version, 'geox_mcft_cap_06_s5_candidate_effectiveness_v1');
  assert.equal(effect.delivery_slice_id, S5);
  assert.equal(effect.status, 'MERGED_EFFECTIVE');
  assert.equal(effect.effective, true);
  assert.equal(effect.implementation_pr_number, 2556);
  assert.equal(effect.implementation_exact_head, IMPLEMENTATION_HEAD);
  assert.equal(effect.implementation_focused_validation_run, 29601667644);
  assert.equal(effect.implementation_standard_ci_run, 29601667658);
  assert.equal(effect.implementation_merge_commit, IMPLEMENTATION_MERGE);
  assert.equal(effect.head_to_merge_file_delta_count, 0);
  assert.equal(effect.head_to_merge_tree_equivalence, 'PASS');
  assert.equal(effect.postmerge_probe_pr_number, 2557);
  assert.equal(effect.postmerge_probe_closed_without_merge, true);
  assert.equal(effect.postmerge_workflow_run, 29602381716);
  assert.equal(effect.postmerge_gate, 'PASS');
  assert.equal(effect.controlled_acceptance.calibration_case_count, 16);
  assert.equal(effect.controlled_acceptance.grid_point_count, 21);
  assert.equal(effect.controlled_acceptance.selected_parameter_value, '0.034000');
  assert.equal(effect.controlled_acceptance.candidate_ref, 'twin_calibration_candidate_5649b9ab80b5545cf6007387');
  assert.equal(effect.controlled_acceptance.candidate_hash, 'sha256:a2018a61bf6699b3cc3b8992058eb2c37b4d38d7f70771f9186495144c229a65');
  assert.equal(effect.controlled_acceptance.first_candidate_append_count, 1);
  assert.equal(effect.controlled_acceptance.completed_chain_rerun_candidate_append_count, 0);
  assert.equal(effect.controlled_acceptance.candidate_projection_count, 1);
  assert.equal(effect.controlled_acceptance.canonical_readback_verified, true);
  assert.equal(effect.preflight.status, 'PASS_EXACT_HEAD_AND_MERGED_MAIN');
  assert.equal(effect.preflight.preflight_stage_count, 9);
  assert.equal(effect.preflight.changed_file_count, 12);
  assert.equal(effect.preflight.logical_commit_count_before_merge, 5);
  assert.equal(effect.preflight.protected_predecessor_path_delta_count, 0);
  assertZeros(effect.runtime_delta_boundary, ZERO_EFFECT_KEYS);
  assert.equal(effect.active_delivery_slice_id, S6);
  assert.deepEqual(effect.authorized_not_started_slice_ids, [S6]);
  assert.equal(effect.s5_effective, true);
  assert.equal(effect.s6_authorized, true);
  assert.equal(effect.s6_implementation_started, false);
  assert.equal(effect.s6_canonical_write_authorized, false);
  assert.equal(effect.s6_projection_write_authorized, false);
  assert.equal(effect.s6_shadow_evaluation_append_authorized, false);
  assert.equal(effect.successor_capability_line_authorized, false);

  assert.equal(status.status, 'MERGED_EFFECTIVE');
  assert.equal(status.implementation_status, 'MERGED_EFFECTIVE');
  assert.equal(status.effectiveness_ref, EFFECTIVENESS_REF);
  assert.equal(status.s5_candidate_implemented, true);
  assert.equal(status.s5_effective, true);
  assert.equal(status.implementation_evidence.implementation_pr_number, 2556);
  assert.equal(status.implementation_evidence.exact_head, IMPLEMENTATION_HEAD);
  assert.equal(status.implementation_evidence.merge_commit, IMPLEMENTATION_MERGE);
  assert.equal(status.implementation_evidence.postmerge_workflow_run, 29602381716);
  assert.equal(status.implementation_evidence.postmerge_gate, 'PASS');
  assert.equal(status.controlled_acceptance.candidate_ref, effect.controlled_acceptance.candidate_ref);
  assert.equal(status.controlled_acceptance.candidate_hash, effect.controlled_acceptance.candidate_hash);
  assertZeros(status.production_runtime_delta);
  assert.equal(status.s6_authorized, true);
  assert.equal(status.s6_implementation_started, false);
  assert.equal(status.s6_status, 'AUTHORIZED_NOT_STARTED');

  assert.equal(delivery.baseline_effectiveness_ref, EFFECTIVENESS_REF);
  assert.equal(delivery.baseline_main_commit, IMPLEMENTATION_MERGE);
  assert.equal(delivery.status, 'S5_CANDIDATE_MERGED_EFFECTIVE_S6_AUTHORIZED_NOT_STARTED');
  assert.equal(delivery.implementation_status, 'S6_AUTHORIZED_NOT_STARTED');
  assert.equal(delivery.active_delivery_slice_id, S6);
  assert.deepEqual(delivery.candidate_slices, []);
  assert.deepEqual(delivery.authorized_not_started_slices, [S6]);
  assert.equal(delivery.blocked_slices.includes(S6), false);
  assert.equal(delivery.blocked_slices.includes(S7), true);
  assert.equal(delivery.s5.effective, true);
  assert.equal(delivery.s5.effectiveness_ref, EFFECTIVENESS_REF);
  assert.equal(delivery.s6.authorized, true);
  assert.equal(delivery.s6.implementation_started, false);
  assert.equal(delivery.s6.candidate_implemented, false);
  assert.equal(delivery.s6.effective, false);
  assert.equal(delivery.s6.canonical_write_authorized, false);
  assert.equal(delivery.s6.projection_write_authorized, false);
  assert.equal(delivery.s6.shadow_evaluation_append_authorized, false);
  assert.equal(delivery.next_repository_action, S6);

  assert.equal(slices.implementation_status, 'S6_AUTHORIZED_NOT_STARTED');
  assert.equal(slices.active_delivery_slice_id, S6);
  assert.deepEqual(slices.authorized_not_started_slices, [S6]);
  assert.equal(slices.blocked_slices.includes(S6), false);
  assert.equal(slices.blocked_slices.includes(S7), true);
  assert.equal(slices.s5_effective, true);
  assert.equal(slices.s5_effectiveness_ref, EFFECTIVENESS_REF);
  assert.equal(slices.s6_authorized, true);
  assert.equal(slices.s6_implementation_started, false);
  assert.equal(slices.s6_effective, false);
  const completedS5 = slices.completed_or_effective_slices.find((item) => item.delivery_slice_id === S5);
  assert.ok(completedS5, 'S5_EFFECTIVE_SLICE_MISSING');
  assert.equal(completedS5.status, 'MERGED_EFFECTIVE');
  assert.equal(completedS5.exact_head, IMPLEMENTATION_HEAD);
  assert.equal(completedS5.merge_commit, IMPLEMENTATION_MERGE);
  assert.equal(completedS5.postmerge_workflow_run, 29602381716);
  assert.equal(completedS5.controlled_candidate_append_count, 1);
  assert.equal(completedS5.completed_chain_rerun_candidate_append_count, 0);
  assert.equal(completedS5.production_candidate_append_count, 0);
  assert.equal(completedS5.production_evaluation_append_count, 0);
  assert.equal(completedS5.model_activation_count, 0);

  assert.equal(reconciliation.baseline_main_commit, IMPLEMENTATION_MERGE);
  assert.equal(reconciliation.delivery_frontier_status, 'S5_CANDIDATE_MERGED_EFFECTIVE_S6_AUTHORIZED_NOT_STARTED');
  assert.equal(reconciliation.current_state.active_delivery_slice_id, S6);
  assert.equal(reconciliation.current_state.candidate_runtime_implemented, true);
  assert.equal(reconciliation.current_state.shadow_evaluation_runtime_implemented, false);
  assert.equal(reconciliation.current_state.s5, 'MERGED_EFFECTIVE');
  assert.equal(reconciliation.current_state.s5_effective, true);
  assert.equal(reconciliation.current_state.s6_authorized, true);
  assert.equal(reconciliation.current_state.s6_implementation_started, false);
  assert.equal(reconciliation.current_state.s6_candidate_implemented, false);
  assert.equal(reconciliation.current_state.s6_effective, false);
  assert.equal(reconciliation.proof.s5_candidate_effectiveness.implementation_merge_commit, IMPLEMENTATION_MERGE);
  assert.equal(reconciliation.proof.s5_candidate_effectiveness.postmerge_workflow_run, 29602381716);
  assert.equal(reconciliation.next_repository_action, S6);
  assert.equal(reconciliation.s5_candidate_effectiveness_ref, EFFECTIVENESS_REF);

  const result = {
    schema_version: 'geox_mcft_cap_06_s5_candidate_effectiveness_result_v1',
    status: 'PASS',
    exact_head: git(['rev-parse', 'HEAD']),
    baseline_ref: baseline,
    changed_file_count: changed.length,
    logical_commit_count: commitCount,
    s5_status: 'MERGED_EFFECTIVE',
    active_delivery_slice_id: S6,
    s5_effective: true,
    s6_authorized: true,
    s6_implementation_started: false,
    governance_writeback_canonical_write_count: 0,
    production_candidate_append_count: 0,
    production_evaluation_append_count: 0,
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

try {
  main();
} catch (error) {
  const result = {
    schema_version: 'geox_mcft_cap_06_s5_candidate_effectiveness_result_v1',
    status: 'FAIL',
    error: error instanceof Error ? error.message : String(error),
    s5_effective: false,
    s6_authorized: false,
    s6_implementation_started: false,
    governance_writeback_canonical_write_count: 0,
    production_candidate_append_count: 0,
    production_evaluation_append_count: 0,
    model_activation_count: 0,
    state_mutation_count: 0,
    checkpoint_mutation_count: 0,
  };
  write(result);
  console.error(JSON.stringify(result));
  process.exitCode = 1;
}
