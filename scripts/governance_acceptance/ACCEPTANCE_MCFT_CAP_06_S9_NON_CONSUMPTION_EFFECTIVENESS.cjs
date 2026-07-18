// Purpose: activate merged-main-proven S9 non-consumption effectiveness and authorize existing taskbook Slice S10 without starting S10 or creating a new prerequisite.
// Boundary: governance only; no Runtime execution, canonical/projection write, activation, migration, route, Web, scheduler, S10 implementation or successor authority.

'use strict';

const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const OUTPUT_DIR = path.join(ROOT, 'acceptance-output');
const RESULT_PATH = path.join(OUTPUT_DIR, 'MCFT_CAP_06_S9_NON_CONSUMPTION_EFFECTIVENESS_RESULT.json');
const DEFAULT_BASELINE = 'b61b7433c36c8bc352513b20d365dacf5d92f951';
const S9 = 'MCFT-CAP-06.MCFT-04-06-08-09-12.POST-EVALUATION-NON-CONSUMPTION-TICK-V1';
const S10 = 'MCFT-CAP-06.MCFT-04-12-16.BOUNDED-CALIBRATION-SHADOW-CLOSURE-V1';
const EXPECTED_FILES = [
  '.github/workflows/mcft-cap-06-s8-restart-readback-rebuild-effectiveness.yml',
  '.github/workflows/mcft-cap-06-s9-non-consumption-effectiveness.yml',
  '.github/workflows/mcft-cap-06-s9-non-consumption.yml',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-DELIVERY-AUTHORITY-V2.json',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S9-POST-EVALUATION-NON-CONSUMPTION-EFFECTIVENESS.json',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S9-POST-EVALUATION-NON-CONSUMPTION-STATUS.json',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-TASKBOOK-MANIFEST.json',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S9_NON_CONSUMPTION_EFFECTIVENESS.cjs',
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
  const baseline = String(process.env.MCFT_CAP_06_S9_EFFECTIVENESS_BASE_REF || DEFAULT_BASELINE).trim();
  git(['cat-file', '-e', `${baseline}^{commit}`]);
  const changedRaw = git(['diff', '--name-only', `${baseline}...HEAD`]);
  const changed = changedRaw ? changedRaw.split(/\r?\n/).filter(Boolean).sort() : [];
  assert.deepEqual(changed, [...EXPECTED_FILES].sort(), 'S9_EFFECTIVENESS_CHANGED_FILE_BOUNDARY_INVALID');
  assert.equal(changed.some((file) => FORBIDDEN_PREFIXES.some((prefix) => file.startsWith(prefix))), false, 'S9_EFFECTIVENESS_RUNTIME_OR_MIGRATION_FILE_CHANGED');
  assert.equal(changed.some((file) => /route|controller|openapi|scheduler/i.test(file)), false, 'S9_EFFECTIVENESS_FORBIDDEN_SURFACE_CHANGED');

  const messages = git(['log', '--format=%s', `${baseline}..HEAD`]).split(/\r?\n/).filter(Boolean);
  for (const message of messages) {
    assert.equal(/\bwip\b|fix ci|try again|\bdebug\b|\btemporary\b/i.test(message), false, `S9_EFFECTIVENESS_COMMIT_MESSAGE_INVALID:${message}`);
  }

  const policy = json('docs/digital_twin/mcft/MCFT-DELIVERY-POLICY-V1.json');
  const effectiveness = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S9-POST-EVALUATION-NON-CONSUMPTION-EFFECTIVENESS.json');
  const manifest = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-TASKBOOK-MANIFEST.json');
  const frontier = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-DELIVERY-AUTHORITY-V2.json');
  const status = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S9-POST-EVALUATION-NON-CONSUMPTION-STATUS.json');
  const frozenS8EffectivenessWorkflow = text('.github/workflows/mcft-cap-06-s8-restart-readback-rebuild-effectiveness.yml');
  const frozenS9Workflow = text('.github/workflows/mcft-cap-06-s9-non-consumption.yml');

  assert.deepEqual(policy.frozen_taskbook_gap_classification.allowed_classes, ['IMPLEMENTATION_DEFECT', 'TASKBOOK_DESIGN_DEFECT']);
  assert.equal(policy.frozen_taskbook_gap_classification.implementation_defect.new_prerequisite_allowed, false);
  assert.equal(policy.capability_slice, false);

  assert.equal(effectiveness.status, 'MERGED_EFFECTIVE');
  assert.equal(effectiveness.delivery_slice_id, S9);
  assert.equal(effectiveness.governance_action_kind, 'EXISTING_SLICE_EFFECTIVENESS_WRITEBACK');
  assert.equal(effectiveness.new_capability_slice, false);
  assert.equal(effectiveness.new_prerequisite, false);
  assert.equal(effectiveness.taskbook_version, 'v0.4.0');
  assert.equal(effectiveness.implementation_evidence.implementation_pr_number, 2579);
  assert.equal(effectiveness.implementation_evidence.exact_head, '0e3f1b0d7f1b28830e906b55e46463f5ec733275');
  assert.equal(effectiveness.implementation_evidence.focused_workflow_run, 29645245818);
  assert.deepEqual(effectiveness.implementation_evidence.focused_fresh_postgresql_job_ids, [88082297573, 88082476347]);
  assert.equal(effectiveness.implementation_evidence.standard_ci_run, 29645245800);
  assert.equal(effectiveness.implementation_evidence.merge_commit, DEFAULT_BASELINE);
  assert.equal(effectiveness.implementation_evidence.governed_file_count, 9);
  assert.equal(effectiveness.implementation_evidence.head_to_merge_file_delta_count, 0);
  assert.equal(effectiveness.implementation_evidence.head_to_merge_tree_equivalence, 'PASS');
  assert.equal(effectiveness.implementation_evidence.postmerge_probe_pr_number, 2580);
  assert.equal(effectiveness.implementation_evidence.postmerge_probe_closed_without_merge, true);
  assert.equal(effectiveness.implementation_evidence.postmerge_workflow_run, 29645624586);
  assert.equal(effectiveness.implementation_evidence.postmerge_standard_ci_run, 29645624536);
  assert.equal(effectiveness.implementation_evidence.postmerge_gate, 'PASS');
  assert.equal(effectiveness.superseded_implementation_evidence.defect_classification, 'IMPLEMENTATION_DEFECT');
  assert.equal(effectiveness.superseded_implementation_evidence.head_to_merge_file_delta_count, 4);
  assert.equal(effectiveness.superseded_implementation_evidence.candidate_effectiveness_invalidated, true);

  const controlled = effectiveness.controlled_acceptance;
  assert.equal(controlled.candidate_parameter_value, '0.034000');
  assert.equal(controlled.effective_tick_parameter_value, '0.030000');
  assert.equal(controlled.same_scope_precondition_tick_count, 24);
  assert.equal(controlled.same_scope_precondition_final_sequence, 72);
  assert.equal(controlled.governance_runtime_scope_match, true);
  assert.equal(controlled.normal_tick_canonical_fact_append_count, 9);
  assert.equal(controlled.forecast_point_count, 72);
  assert.equal(controlled.scenario_option_count, 3);
  assert.equal(controlled.scenario_points_per_option, 72);
  assert.equal(controlled.candidate_consumed, false);
  assert.equal(controlled.evaluation_consumed, false);
  assert.equal(controlled.model_activation_count, 0);
  assert.equal(controlled.active_config_snapshot_changed, false);
  assert.equal(controlled.completed_rerun_additional_fact_count, 0);
  assert.equal(controlled.completed_rerun_evidence_load_count, 0);
  assert.equal(controlled.production_database_used, false);

  assert.equal(effectiveness.effectiveness_transition.s9_effective, true);
  assert.equal(effectiveness.effectiveness_transition.s10_authorized, true);
  assert.equal(effectiveness.effectiveness_transition.s10_implementation_started, false);
  assert.equal(effectiveness.effectiveness_transition.active_delivery_slice_id, S10);
  assert.equal(effectiveness.effectiveness_transition.next_repository_action, 'IMPLEMENT_S10_BOUNDED_CALIBRATION_SHADOW_CLOSURE');
  assert.equal(effectiveness.effectiveness_transition.new_prerequisite_inserted, false);
  assert.equal(effectiveness.effectiveness_transition.new_slice_inserted, false);
  assertZeroDelta(effectiveness.runtime_delta, 'S9_EFFECTIVENESS');

  assert.equal(manifest.effective_taskbook_version, 'v0.4.0');
  assert.equal(manifest.execution_control.active_delivery_slice_id, S10);
  assert.equal(manifest.execution_control.completed_action, 'S9_EFFECTIVENESS_WRITEBACK');
  assert.equal(manifest.execution_control.next_action, 'IMPLEMENT_S10_BOUNDED_CALIBRATION_SHADOW_CLOSURE');
  assert.equal(manifest.execution_control.next_action_is_existing_taskbook_slice, true);
  assert.equal(manifest.s9_implementation_evidence.effectiveness_written, true);
  assert.equal(manifest.s9_effective, true);
  assert.equal(manifest.s10_authorized, true);
  assert.equal(manifest.s10_implementation_started, false);
  assert.equal(manifest.normative_slice_graph.includes(S9), true);
  assert.equal(manifest.normative_slice_graph.includes(S10), true);
  for (const node of HISTORICAL_NODES) assert.equal(manifest.normative_slice_graph.includes(node), false, `HISTORICAL_NODE_REENTERED_GRAPH:${node}`);

  assert.equal(frontier.record_kind, 'SOLE_MUTABLE_DELIVERY_FRONTIER');
  assert.equal(frontier.status, 'S9_POST_EVALUATION_NON_CONSUMPTION_MERGED_EFFECTIVE_S10_AUTHORIZED_NOT_STARTED');
  assert.equal(frontier.execution_paused, false);
  assert.equal(frontier.active_delivery_slice_id, S10);
  assert.equal(frontier.next_repository_action, 'IMPLEMENT_S10_BOUNDED_CALIBRATION_SHADOW_CLOSURE');
  assert.equal(frontier.next_repository_action_kind, 'EXISTING_TASKBOOK_SLICE_IMPLEMENTATION');
  assert.equal(frontier.next_repository_action_is_capability_slice, true);
  assert.equal(frontier.implementation_state.s9_effective, true);
  assert.equal(frontier.implementation_state.s10_authorized, true);
  assert.equal(frontier.implementation_state.s10_implementation_started, false);
  assert.equal(frontier.completed_action, 'S9_EFFECTIVENESS_WRITEBACK');
  assert.equal(frontier.completed_action_is_new_prerequisite, false);
  assert.equal(frontier.completed_action_is_new_slice, false);
  assertZeroDelta(frontier.runtime_delta, 'CURRENT_FRONTIER');

  assert.equal(status.status, 'MERGED_EFFECTIVE');
  assert.equal(status.effectiveness_status, 'MERGED_EFFECTIVE');
  assert.equal(status.s9_implementation_merged, true);
  assert.equal(status.s9_merged_main_proven, true);
  assert.equal(status.s9_effective, true);
  assert.equal(status.s10_authorized, true);
  assert.equal(status.s10_implementation_started, false);
  assert.equal(status.next_repository_action, 'IMPLEMENT_S10_BOUNDED_CALIBRATION_SHADOW_CLOSURE');
  assert.equal(status.next_repository_action_is_existing_taskbook_slice, true);
  assert.equal(status.new_prerequisite_inserted, false);
  assert.equal(status.new_slice_inserted, false);

  assert.equal(frozenS8EffectivenessWorkflow.includes('cc95f9ebced0c7f8dc92d2a0b5d9716e06c3ec2c'), true, 'S8_EFFECTIVENESS_FROZEN_MERGE_REF_REQUIRED');
  assert.equal(frozenS8EffectivenessWorkflow.includes('s8_effective'), true, 'S8_EFFECTIVENESS_FREEZE_CONDITION_REQUIRED');
  assert.equal(frozenS9Workflow.includes('b61b7433c36c8bc352513b20d365dacf5d92f951'), true, 'S9_FROZEN_MERGE_REF_REQUIRED');
  assert.equal(frozenS9Workflow.includes('s9_effective'), true, 'S9_EFFECTIVENESS_FREEZE_CONDITION_REQUIRED');

  const result = {
    schema_version: 'geox_mcft_cap_06_s9_non_consumption_effectiveness_result_v1',
    status: 'PASS',
    baseline,
    changed_files: changed,
    changed_file_count: changed.length,
    commit_count: messages.length,
    taskbook_version: manifest.effective_taskbook_version,
    s9_status: status.status,
    s9_effective: status.s9_effective,
    s10_authorized: status.s10_authorized,
    s10_implementation_started: status.s10_implementation_started,
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
    schema_version: 'geox_mcft_cap_06_s9_non_consumption_effectiveness_result_v1',
    status: 'FAIL',
    error: error instanceof Error ? error.message : String(error),
  };
  write(failure);
  console.error(JSON.stringify(failure, null, 2));
  process.exitCode = 1;
}
