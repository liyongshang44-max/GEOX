// Purpose: activate merged-main-proven S8 Restart/Readback/Rebuild effectiveness and authorize existing taskbook Slice S9 without starting S9 or creating a new prerequisite.
// Boundary: governance only; no Runtime execution, PostgreSQL rebuild, canonical/projection write, activation, migration, route, Web, scheduler, S9 implementation or successor authority.

'use strict';

const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const OUTPUT_DIR = path.join(ROOT, 'acceptance-output');
const RESULT_PATH = path.join(OUTPUT_DIR, 'MCFT_CAP_06_S8_RESTART_READBACK_REBUILD_EFFECTIVENESS_RESULT.json');
const DEFAULT_BASELINE = 'a573e741ea0d2b84bfc3727af3412eaa4552fdd0';
const S8 = 'MCFT-CAP-06.MCFT-03-04-12.RESTART-READBACK-REBUILD-V1';
const S9 = 'MCFT-CAP-06.MCFT-04-06-08-09-12.POST-EVALUATION-NON-CONSUMPTION-TICK-V1';
const EXPECTED_FILES = [
  '.github/workflows/mcft-cap-06-s8-restart-readback-rebuild-effectiveness.yml',
  '.github/workflows/mcft-cap-06-taskbook-v0-4-effectiveness.yml',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-DELIVERY-AUTHORITY-V2.json',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S8-RESTART-READBACK-REBUILD-EFFECTIVENESS.json',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S8-RESTART-READBACK-REBUILD-STATUS.json',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-TASKBOOK-MANIFEST.json',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S8_RESTART_READBACK_REBUILD_EFFECTIVENESS.cjs',
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
  return cp.execFileSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function text(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function json(relativePath) {
  return JSON.parse(text(relativePath));
}

function assertZeroDelta(delta, prefix) {
  for (const key of ZERO_KEYS) {
    assert.equal(delta[key], 0, `${prefix}_${key.toUpperCase()}_NONZERO`);
  }
}

function write(result) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(RESULT_PATH, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
}

function main() {
  const baseline = String(process.env.MCFT_CAP_06_S8_EFFECTIVENESS_BASE_REF || DEFAULT_BASELINE).trim();
  git(['cat-file', '-e', `${baseline}^{commit}`]);
  const changedRaw = git(['diff', '--name-only', `${baseline}...HEAD`]);
  const changed = changedRaw ? changedRaw.split(/\r?\n/).filter(Boolean).sort() : [];
  assert.deepEqual(changed, [...EXPECTED_FILES].sort(), 'S8_EFFECTIVENESS_CHANGED_FILE_BOUNDARY_INVALID');
  assert.equal(changed.some((file) => FORBIDDEN_PREFIXES.some((prefix) => file.startsWith(prefix))), false, 'S8_EFFECTIVENESS_RUNTIME_OR_MIGRATION_FILE_CHANGED');
  assert.equal(changed.some((file) => /route|controller|openapi|scheduler/i.test(file)), false, 'S8_EFFECTIVENESS_FORBIDDEN_SURFACE_CHANGED');

  const messages = git(['log', '--format=%s', `${baseline}..HEAD`]).split(/\r?\n/).filter(Boolean);
  for (const message of messages) {
    assert.equal(/\bwip\b|fix ci|try again|\bdebug\b|\btemporary\b/i.test(message), false, `S8_EFFECTIVENESS_COMMIT_MESSAGE_INVALID:${message}`);
  }

  const policy = json('docs/digital_twin/mcft/MCFT-DELIVERY-POLICY-V1.json');
  const taskbookEffectiveness = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-TASKBOOK-V0.4.0-EFFECTIVENESS.json');
  const effectiveness = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S8-RESTART-READBACK-REBUILD-EFFECTIVENESS.json');
  const manifest = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-TASKBOOK-MANIFEST.json');
  const frontier = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-DELIVERY-AUTHORITY-V2.json');
  const s8 = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S8-RESTART-READBACK-REBUILD-STATUS.json');
  const activationWorkflow = text('.github/workflows/mcft-cap-06-taskbook-v0-4-effectiveness.yml');

  assert.deepEqual(policy.frozen_taskbook_gap_classification.allowed_classes, ['IMPLEMENTATION_DEFECT', 'TASKBOOK_DESIGN_DEFECT']);
  assert.equal(policy.frozen_taskbook_gap_classification.implementation_defect.new_prerequisite_allowed, false);
  assert.equal(policy.frozen_taskbook_gap_classification.taskbook_design_defect.new_prerequisite_under_old_frozen_version_allowed, false);
  assert.equal(taskbookEffectiveness.status, 'MERGED_MAIN_EFFECTIVE_FROZEN');
  assert.equal(taskbookEffectiveness.capability_slice, false);

  assert.equal(effectiveness.status, 'MERGED_EFFECTIVE');
  assert.equal(effectiveness.delivery_slice_id, S8);
  assert.equal(effectiveness.governance_action_kind, 'EXISTING_SLICE_EFFECTIVENESS_WRITEBACK');
  assert.equal(effectiveness.new_capability_slice, false);
  assert.equal(effectiveness.new_prerequisite, false);
  assert.equal(effectiveness.taskbook_version, 'v0.4.0');
  assert.equal(effectiveness.implementation_evidence.implementation_pr_number, 2568);
  assert.equal(effectiveness.implementation_evidence.exact_head, '2715140adbd6cb951a424a7594446c9f989dd942');
  assert.equal(effectiveness.implementation_evidence.merge_commit, 'f14dc4c6aaf1cc8b56530c3f9088a1247f5d4db7');
  assert.equal(effectiveness.implementation_evidence.head_to_merge_file_delta_count, 0);
  assert.equal(effectiveness.implementation_evidence.head_to_merge_tree_equivalence, 'PASS');
  assert.equal(effectiveness.implementation_evidence.postmerge_workflow_run, 29631551159);
  assert.equal(effectiveness.taskbook_activation_evidence.activation_pr_number, 2572);
  assert.equal(effectiveness.taskbook_activation_evidence.activation_exact_head, '2548e98eacc32eb53d67d8c192bb810c56589b03');
  assert.equal(effectiveness.taskbook_activation_evidence.activation_merge_commit, 'a573e741ea0d2b84bfc3727af3412eaa4552fdd0');
  assert.equal(effectiveness.taskbook_activation_evidence.postmerge_probe_pr_number, 2573);
  assert.equal(effectiveness.taskbook_activation_evidence.postmerge_workflow_run, 29633855684);
  assert.equal(effectiveness.controlled_acceptance.fresh_process_count, 2);
  assert.equal(effectiveness.controlled_acceptance.canonical_fact_count, 218);
  assert.equal(effectiveness.controlled_acceptance.canonical_facts_hash, 'sha256:64eab5a2c5c7a79edb35a6eaefb4aeb7e760c630b44f45021cc1c7c31226a7e7');
  assert.equal(effectiveness.controlled_acceptance.semantic_projection_snapshot_hash, 'sha256:c562d7107099df8be110f5cc4bf7a39f11defe22f655283c53b05205c7794962');
  assert.equal(effectiveness.controlled_acceptance.second_rebuild_summary_matches, true);
  assert.equal(effectiveness.controlled_acceptance.semantic_projection_snapshot_matches, true);
  assert.equal(effectiveness.controlled_acceptance.canonical_facts_hash_remains_equal, true);
  assert.equal(effectiveness.effectiveness_transition.s8_effective, true);
  assert.equal(effectiveness.effectiveness_transition.s9_authorized, true);
  assert.equal(effectiveness.effectiveness_transition.s9_implementation_started, false);
  assert.equal(effectiveness.effectiveness_transition.active_delivery_slice_id, S9);
  assert.equal(effectiveness.effectiveness_transition.new_prerequisite_inserted, false);
  assert.equal(effectiveness.effectiveness_transition.new_slice_inserted, false);
  assertZeroDelta(effectiveness.runtime_delta, 'S8_EFFECTIVENESS');

  assert.equal(manifest.effective_taskbook_version, 'v0.4.0');
  assert.equal(manifest.revision_status, 'MERGED_MAIN_EFFECTIVE_FROZEN');
  assert.equal(manifest.execution_control.active_delivery_slice_id, S9);
  assert.equal(manifest.execution_control.new_prerequisite_inserted, false);
  assert.equal(manifest.execution_control.completed_action, 'S8_EFFECTIVENESS_WRITEBACK');
  assert.equal(manifest.execution_control.completed_action_is_capability_prerequisite, false);
  assert.equal(manifest.execution_control.completed_action_is_new_slice, false);
  assert.equal(manifest.execution_control.next_action_is_existing_taskbook_slice, true);
  assert.equal(manifest.s8_implementation_evidence.effectiveness_written, true);
  assert.equal(manifest.s8_effective, true);
  assert.equal(manifest.s9_authorized, true);
  assert.equal(manifest.s9_implementation_started, false);
  for (const node of HISTORICAL_NODES) assert.equal(manifest.normative_slice_graph.includes(node), false, `HISTORICAL_NODE_REENTERED_GRAPH:${node}`);
  assert.equal(manifest.normative_slice_graph.includes(S9), true);

  assert.equal(frontier.record_kind, 'SOLE_MUTABLE_DELIVERY_FRONTIER');
  assert.equal(frontier.status, 'S8_RESTART_READBACK_REBUILD_MERGED_EFFECTIVE_S9_AUTHORIZED_NOT_STARTED');
  assert.equal(frontier.execution_paused, false);
  assert.equal(frontier.active_delivery_slice_id, S9);
  assert.equal(frontier.next_repository_action, 'IMPLEMENT_S9_POST_EVALUATION_NON_CONSUMPTION_TICK');
  assert.equal(frontier.next_repository_action_kind, 'EXISTING_TASKBOOK_SLICE_IMPLEMENTATION');
  assert.equal(frontier.next_repository_action_is_capability_slice, true);
  assert.equal(frontier.new_prerequisite_inserted, false);
  assert.equal(frontier.implementation_state.s8_effective, true);
  assert.equal(frontier.implementation_state.s9_authorized, true);
  assert.equal(frontier.implementation_state.s9_implementation_started, false);
  assert.equal(frontier.completed_action_is_new_prerequisite, false);
  assert.equal(frontier.completed_action_is_new_slice, false);
  assertZeroDelta(frontier.runtime_delta, 'CURRENT_FRONTIER');

  assert.equal(s8.status, 'MERGED_EFFECTIVE');
  assert.equal(s8.effectiveness_status, 'MERGED_EFFECTIVE');
  assert.equal(s8.s8_effective, true);
  assert.equal(s8.s8_effectiveness_writeback_authorized, false);
  assert.equal(s8.s9_authorized, true);
  assert.equal(s8.s9_implementation_started, false);
  assert.equal(s8.next_repository_action, 'IMPLEMENT_S9_POST_EVALUATION_NON_CONSUMPTION_TICK');
  assert.equal(s8.next_repository_action_is_existing_taskbook_slice, true);
  assert.equal(s8.new_prerequisite_inserted, false);
  assert.equal(s8.new_slice_inserted, false);
  assertZeroDelta(s8.runtime_delta, 'S8_STATUS');

  assert.equal(activationWorkflow.includes('s8_effective === true'), true, 'TASKBOOK_ACTIVATION_FREEZE_CONDITION_REQUIRED');
  assert.equal(activationWorkflow.includes('a573e741ea0d2b84bfc3727af3412eaa4552fdd0'), true, 'TASKBOOK_ACTIVATION_FROZEN_REF_REQUIRED');

  const result = {
    schema_version: 'geox_mcft_cap_06_s8_restart_readback_rebuild_effectiveness_result_v1',
    status: 'PASS',
    baseline,
    changed_files: changed,
    changed_file_count: changed.length,
    commit_count: messages.length,
    taskbook_version: manifest.effective_taskbook_version,
    s8_status: s8.status,
    s8_effective: s8.s8_effective,
    s9_authorized: s8.s9_authorized,
    s9_implementation_started: s8.s9_implementation_started,
    active_delivery_slice_id: frontier.active_delivery_slice_id,
    next_repository_action: frontier.next_repository_action,
    new_prerequisite_inserted: frontier.new_prerequisite_inserted,
    new_slice_inserted: s8.new_slice_inserted,
    runtime_delta: frontier.runtime_delta,
  };
  write(result);
  console.log(JSON.stringify(result, null, 2));
}

try {
  main();
} catch (error) {
  const failure = {
    schema_version: 'geox_mcft_cap_06_s8_restart_readback_rebuild_effectiveness_result_v1',
    status: 'FAIL',
    error: error instanceof Error ? error.message : String(error),
  };
  write(failure);
  console.error(JSON.stringify(failure, null, 2));
  process.exitCode = 1;
}
