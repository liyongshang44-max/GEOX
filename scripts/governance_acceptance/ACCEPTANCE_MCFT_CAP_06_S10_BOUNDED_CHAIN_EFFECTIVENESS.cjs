// Purpose: activate merged-main-proven S10 bounded-chain effectiveness and authorize existing taskbook Slice S11A without starting S11A or creating a new prerequisite.
// Boundary: governance only; no Runtime execution, canonical/projection write, activation, migration, route, Web, scheduler, S11A implementation, completion-claim activation or successor authority.

'use strict';

const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const OUTPUT_DIR = path.join(ROOT, 'acceptance-output');
const RESULT_PATH = path.join(OUTPUT_DIR, 'MCFT_CAP_06_S10_BOUNDED_CHAIN_EFFECTIVENESS_RESULT.json');
const DEFAULT_BASELINE = 'dc44a9e7e248e02237ee67a054d6fdd0259a1f3f';
const S10 = 'MCFT-CAP-06.MCFT-04-12-16.BOUNDED-CALIBRATION-SHADOW-CLOSURE-V1';
const S11A = 'MCFT-CAP-06.CLOSURE-CANDIDATE-V1';
const EXPECTED_FILES = [
  '.github/workflows/mcft-cap-06-s9-non-consumption-effectiveness.yml',
  '.github/workflows/mcft-cap-06-s10-bounded-chain-effectiveness.yml',
  '.github/workflows/mcft-cap-06-s10-bounded-chain.yml',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-DELIVERY-AUTHORITY-V2.json',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S10-BOUNDED-CHAIN-EFFECTIVENESS.json',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S10-BOUNDED-CHAIN-STATUS.json',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-TASKBOOK-MANIFEST.json',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S10_BOUNDED_CHAIN_EFFECTIVENESS.cjs',
];
const FORBIDDEN_PREFIXES = [
  'apps/server/src/',
  'apps/server/scripts/',
  'apps/server/db/migrations/',
  'apps/web/',
  'fixtures/',
  'docker/',
  'scripts/runtime_acceptance/',
];
const ZERO_KEYS = [
  'canonical_fact_append_count',
  'canonical_fact_update_count',
  'canonical_fact_delete_count',
  'candidate_append_count',
  'evaluation_append_count',
  'projection_write_count',
  'model_activation_count',
  'active_config_switch_count',
  'runtime_parameter_change_count',
  'state_mutation_count',
  'checkpoint_mutation_count',
  'migration_count',
];
const HISTORICAL_NODES = [
  'MCFT-CAP-06.S5-ENTRY.AUTHORITY-GRAPH-PREFLIGHT-AND-PR-HYGIENE-V1',
  'MCFT-CAP-06.S5-PREDECESSOR.GRAPH-AND-DUAL-TIME-CONFORMANCE-V1',
];

function git(args) {
  return cp.execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}
function text(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}
function json(relativePath) {
  return JSON.parse(text(relativePath));
}
function assertZeroDelta(delta, prefix) {
  for (const key of ZERO_KEYS) assert.equal(delta[key], 0, `${prefix}_${key.toUpperCase()}_NONZERO`);
}
function write(result) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(RESULT_PATH, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
}

function main() {
  const baseline = String(process.env.MCFT_CAP_06_S10_EFFECTIVENESS_BASE_REF || DEFAULT_BASELINE).trim();
  git(['cat-file', '-e', `${baseline}^{commit}`]);
  const changedRaw = git(['diff', '--name-only', `${baseline}...HEAD`]);
  const changed = changedRaw ? changedRaw.split(/\r?\n/).filter(Boolean).sort() : [];
  assert.deepEqual(changed, [...EXPECTED_FILES].sort(), 'S10_EFFECTIVENESS_CHANGED_FILE_BOUNDARY_INVALID');
  assert.equal(changed.some((file) => FORBIDDEN_PREFIXES.some((prefix) => file.startsWith(prefix))), false, 'S10_EFFECTIVENESS_RUNTIME_OR_MIGRATION_FILE_CHANGED');
  assert.equal(changed.some((file) => /route|controller|openapi|scheduler/i.test(file)), false, 'S10_EFFECTIVENESS_FORBIDDEN_SURFACE_CHANGED');

  const messages = git(['log', '--format=%s', `${baseline}..HEAD`]).split(/\r?\n/).filter(Boolean);
  for (const message of messages) {
    assert.equal(/\bwip\b|fix ci|try again|\bdebug\b|\btemporary\b/i.test(message), false, `S10_EFFECTIVENESS_COMMIT_MESSAGE_INVALID:${message}`);
  }

  const policy = json('docs/digital_twin/mcft/MCFT-DELIVERY-POLICY-V1.json');
  const effectiveness = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S10-BOUNDED-CHAIN-EFFECTIVENESS.json');
  const manifest = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-TASKBOOK-MANIFEST.json');
  const frontier = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-DELIVERY-AUTHORITY-V2.json');
  const status = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S10-BOUNDED-CHAIN-STATUS.json');
  const frozenS9EffectivenessWorkflow = text('.github/workflows/mcft-cap-06-s9-non-consumption-effectiveness.yml');
  const frozenS10Workflow = text('.github/workflows/mcft-cap-06-s10-bounded-chain.yml');

  assert.deepEqual(policy.frozen_taskbook_gap_classification.allowed_classes, ['IMPLEMENTATION_DEFECT', 'TASKBOOK_DESIGN_DEFECT']);
  assert.equal(policy.frozen_taskbook_gap_classification.implementation_defect.new_prerequisite_allowed, false);
  assert.equal(policy.capability_slice, false);

  assert.equal(effectiveness.status, 'MERGED_EFFECTIVE');
  assert.equal(effectiveness.delivery_slice_id, S10);
  assert.equal(effectiveness.governance_action_kind, 'EXISTING_SLICE_EFFECTIVENESS_WRITEBACK');
  assert.equal(effectiveness.new_capability_slice, false);
  assert.equal(effectiveness.new_prerequisite, false);
  assert.equal(effectiveness.taskbook_version, 'v0.4.0');
  const implementation = effectiveness.implementation_evidence;
  assert.equal(implementation.implementation_pr_number, 2582);
  assert.equal(implementation.exact_head, '3072227904dbc753a1fe5d24a6dd714ee65c1ef2');
  assert.equal(implementation.focused_workflow_run, 29648654760);
  assert.deepEqual(implementation.focused_fresh_postgresql_job_ids, [88091097876, 88091422058]);
  assert.equal(implementation.delivery_policy_run, 29648654734);
  assert.equal(implementation.standard_ci_run, 29648654708);
  assert.equal(implementation.merge_commit, DEFAULT_BASELINE);
  assert.equal(implementation.governed_file_count, 7);
  assert.equal(implementation.head_to_merge_file_delta_count, 0);
  assert.equal(implementation.head_to_merge_tree_equivalence, 'PASS');
  assert.equal(implementation.postmerge_probe_pr_number, 2583);
  assert.equal(implementation.postmerge_probe_closed_without_merge, true);
  assert.equal(implementation.postmerge_workflow_run, 29649040109);
  assert.equal(implementation.postmerge_workflow_job, 88092093049);
  assert.equal(implementation.postmerge_standard_ci_run, 29649040085);
  assert.equal(implementation.postmerge_gate, 'PASS');

  const controlled = effectiveness.controlled_acceptance;
  assert.equal(controlled.storage_mode, 'TWO_NAMESPACED_ISOLATED_POSTGRESQL_STAGES');
  assert.equal(controlled.controlled_stage_database_count, 2);
  assert.equal(controlled.controlled_stage_scope_match, true);
  assert.equal(controlled.candidate_evaluation_identity_continuity, true);
  assert.equal(controlled.actual_r, 24);
  assert.equal(controlled.actual_c, 0);
  assert.equal(controlled.canonical_delta_formula, 'R_PLUS_C_PLUS_12');
  assert.equal(controlled.actual_cap06_canonical_delta, 36);
  assert.equal(controlled.candidate_parameter_value, '0.034000');
  assert.equal(controlled.effective_runtime_parameter_value, '0.030000');
  assert.equal(controlled.completed_replay_additional_fact_count, 0);
  assert.equal(controlled.completed_replay_projection_divergence_count, 0);
  assert.equal(controlled.completed_replay_evidence_load_count, 0);
  assert.equal(controlled.s8_completed_replay_additional_fact_count, 0);
  assert.equal(controlled.s8_completed_replay_projection_divergence_count, 0);
  assert.equal(controlled.s9_completed_replay_additional_fact_count, 0);
  assert.equal(controlled.s9_completed_replay_projection_divergence_count, 0);
  assert.equal(controlled.candidate_consumed, false);
  assert.equal(controlled.evaluation_consumed, false);
  assert.equal(controlled.model_activation_count, 0);
  assert.equal(controlled.active_config_snapshot_changed, false);
  assert.equal(controlled.repository_source_qualification_status, 'INSUFFICIENT_MATCHED_PAIRS');
  assert.equal(controlled.repository_assessment_status, 'INSUFFICIENT_REPOSITORY_HISTORY_FOR_CALIBRATION_ASSESSMENT');
  assert.equal(controlled.repository_canonical_residual_count, 1);
  assert.equal(controlled.repository_eligible_matched_pair_count, 1);
  assert.equal(controlled.residual_ref_intersection_count, 0);
  assert.equal(controlled.both_track_scopes_distinct, true);
  assert.equal(controlled.both_track_databases_distinct, true);
  assert.equal(controlled.production_database_used, false);

  const transition = effectiveness.effectiveness_transition;
  assert.equal(transition.s10_effective, true);
  assert.equal(transition.s11a_authorized, true);
  assert.equal(transition.s11a_implementation_started, false);
  assert.equal(transition.active_delivery_slice_id, S11A);
  assert.equal(transition.next_repository_action, 'IMPLEMENT_S11A_CLOSURE_CANDIDATE');
  assert.equal(transition.new_prerequisite_inserted, false);
  assert.equal(transition.new_slice_inserted, false);
  assertZeroDelta(effectiveness.runtime_delta, 'S10_EFFECTIVENESS');

  assert.equal(status.status, 'MERGED_EFFECTIVE');
  assert.equal(status.effectiveness_status, 'MERGED_EFFECTIVE');
  assert.equal(status.s10_implementation_merged, true);
  assert.equal(status.s10_merged_main_proven, true);
  assert.equal(status.s10_effective, true);
  assert.equal(status.controlled_internal_continuity_proven, true);
  assert.equal(status.both_track_separation_proven, true);
  assert.equal(status.s11a_authorized, true);
  assert.equal(status.s11a_implementation_started, false);
  assert.equal(status.next_repository_action, 'IMPLEMENT_S11A_CLOSURE_CANDIDATE');
  assert.equal(status.next_repository_action_is_existing_taskbook_slice, true);
  assert.equal(status.new_prerequisite_inserted, false);
  assert.equal(status.new_slice_inserted, false);

  assert.equal(frontier.record_kind, 'SOLE_MUTABLE_DELIVERY_FRONTIER');
  assert.equal(frontier.status, 'S10_BOUNDED_CHAIN_MERGED_EFFECTIVE_S11A_AUTHORIZED_NOT_STARTED');
  assert.equal(frontier.execution_paused, false);
  assert.equal(frontier.active_delivery_slice_id, S11A);
  assert.equal(frontier.next_repository_action, 'IMPLEMENT_S11A_CLOSURE_CANDIDATE');
  assert.equal(frontier.next_repository_action_kind, 'EXISTING_TASKBOOK_SLICE_IMPLEMENTATION');
  assert.equal(frontier.next_repository_action_is_capability_slice, true);
  assert.equal(frontier.implementation_state.s10_effective, true);
  assert.equal(frontier.implementation_state.s11a_authorized, true);
  assert.equal(frontier.implementation_state.s11a_implementation_started, false);
  assert.equal(frontier.completed_action, 'S10_EFFECTIVENESS_WRITEBACK');
  assert.equal(frontier.completed_action_is_new_prerequisite, false);
  assert.equal(frontier.completed_action_is_new_slice, false);
  assertZeroDelta(frontier.runtime_delta, 'CURRENT_FRONTIER');

  assert.equal(manifest.effective_taskbook_version, 'v0.4.0');
  assert.equal(manifest.execution_control.active_delivery_slice_id, S11A);
  assert.equal(manifest.execution_control.completed_action, 'S10_EFFECTIVENESS_WRITEBACK');
  assert.equal(manifest.execution_control.next_action, 'IMPLEMENT_S11A_CLOSURE_CANDIDATE');
  assert.equal(manifest.execution_control.next_action_is_existing_taskbook_slice, true);
  assert.equal(manifest.s10_implementation_evidence.effectiveness_written, true);
  assert.equal(manifest.s10_effective, true);
  assert.equal(manifest.s11a_authorized, true);
  assert.equal(manifest.s11a_implementation_started, false);
  assert.equal(manifest.normative_slice_graph.includes(S10), true);
  assert.equal(manifest.normative_slice_graph.includes(S11A), true);
  for (const node of HISTORICAL_NODES) assert.equal(manifest.normative_slice_graph.includes(node), false, `HISTORICAL_NODE_REENTERED_GRAPH:${node}`);

  assert.equal(frozenS9EffectivenessWorkflow.includes('d77eb3ac05e56b82aa1f65e8859a0ebe3d9bbcae'), true, 'S9_EFFECTIVENESS_FROZEN_MERGE_REF_REQUIRED');
  assert.equal(frozenS9EffectivenessWorkflow.includes('s9_effective'), true, 'S9_EFFECTIVENESS_FREEZE_CONDITION_REQUIRED');
  assert.equal(frozenS10Workflow.includes('dc44a9e7e248e02237ee67a054d6fdd0259a1f3f'), true, 'S10_FROZEN_MERGE_REF_REQUIRED');
  assert.equal(frozenS10Workflow.includes('s10_effective'), true, 'S10_EFFECTIVENESS_FREEZE_CONDITION_REQUIRED');

  const result = {
    schema_version: 'geox_mcft_cap_06_s10_bounded_chain_effectiveness_result_v1',
    status: 'PASS',
    baseline,
    changed_files: changed,
    changed_file_count: changed.length,
    commit_count: messages.length,
    taskbook_version: manifest.effective_taskbook_version,
    s10_status: status.status,
    s10_effective: status.s10_effective,
    s11a_authorized: status.s11a_authorized,
    s11a_implementation_started: status.s11a_implementation_started,
    active_delivery_slice_id: frontier.active_delivery_slice_id,
    next_repository_action: frontier.next_repository_action,
    new_prerequisite_inserted: frontier.new_prerequisite_inserted,
    new_slice_inserted: status.new_slice_inserted,
    runtime_delta: frontier.runtime_delta,
  };
  write(result);
  console.log(JSON.stringify(result, null, 2));
}

try {
  main();
} catch (error) {
  const failure = {
    schema_version: 'geox_mcft_cap_06_s10_bounded_chain_effectiveness_result_v1',
    status: 'FAIL',
    error: error instanceof Error ? error.message : String(error),
  };
  write(failure);
  console.error(JSON.stringify(failure, null, 2));
  process.exitCode = 1;
}
