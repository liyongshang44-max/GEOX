// Purpose: activate the merged-main-proven MCFT-CAP-06 taskbook v0.4.0 correction and resume the existing S8 effectiveness writeback without creating a new prerequisite or Slice.
// Boundary: governance only; no Runtime execution, database access, canonical/projection write, activation, migration, route, Web, scheduler, S9 implementation or successor authority.

'use strict';

const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const OUTPUT_DIR = path.join(ROOT, 'acceptance-output');
const RESULT_PATH = path.join(OUTPUT_DIR, 'MCFT_CAP_06_TASKBOOK_V0_4_EFFECTIVENESS_RESULT.json');
const DEFAULT_BASELINE = '56fd50500a14cc8b5d3743306da85f9d0055abe0';
const S8 = 'MCFT-CAP-06.MCFT-03-04-12.RESTART-READBACK-REBUILD-V1';
const EXPECTED_FILES = [
  '.github/workflows/mcft-cap-06-s8-restart-readback-rebuild.yml',
  '.github/workflows/mcft-cap-06-taskbook-v0-4-effectiveness.yml',
  '.github/workflows/mcft-delivery-policy-v1.yml',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-DELIVERY-AUTHORITY-V2.json',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S8-RESTART-READBACK-REBUILD-STATUS.json',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-TASKBOOK-MANIFEST.json',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-TASKBOOK-V0.4.0-EFFECTIVENESS.json',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_TASKBOOK_V0_4_EFFECTIVENESS.cjs',
];
const FORBIDDEN_PREFIXES = [
  'apps/server/src/',
  'apps/server/scripts/',
  'apps/server/db/migrations/',
  'apps/web/',
  'fixtures/',
  'docker/',
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
  const baseline = String(process.env.MCFT_CAP_06_TASKBOOK_V0_4_EFFECTIVENESS_BASE_REF || DEFAULT_BASELINE).trim();
  git(['cat-file', '-e', `${baseline}^{commit}`]);
  const changedRaw = git(['diff', '--name-only', `${baseline}...HEAD`]);
  const changed = changedRaw ? changedRaw.split(/\r?\n/).filter(Boolean).sort() : [];
  assert.deepEqual(changed, [...EXPECTED_FILES].sort(), 'TASKBOOK_V0_4_EFFECTIVENESS_CHANGED_FILE_BOUNDARY_INVALID');
  assert.equal(changed.some((file) => FORBIDDEN_PREFIXES.some((prefix) => file.startsWith(prefix))), false, 'TASKBOOK_V0_4_EFFECTIVENESS_PRODUCT_RUNTIME_FILE_CHANGED');
  assert.equal(changed.some((file) => /route|controller|openapi|scheduler/i.test(file)), false, 'TASKBOOK_V0_4_EFFECTIVENESS_FORBIDDEN_SURFACE_CHANGED');

  const messages = git(['log', '--format=%s', `${baseline}..HEAD`]).split(/\r?\n/).filter(Boolean);
  for (const message of messages) {
    assert.equal(/\bwip\b|fix ci|try again|\bdebug\b|\btemporary\b/i.test(message), false, `TASKBOOK_V0_4_EFFECTIVENESS_COMMIT_MESSAGE_INVALID:${message}`);
  }

  const policy = json('docs/digital_twin/mcft/MCFT-DELIVERY-POLICY-V1.json');
  const effectiveness = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-TASKBOOK-V0.4.0-EFFECTIVENESS.json');
  const manifest = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-TASKBOOK-MANIFEST.json');
  const frontier = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-DELIVERY-AUTHORITY-V2.json');
  const s8 = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S8-RESTART-READBACK-REBUILD-STATUS.json');
  const policyWorkflow = text('.github/workflows/mcft-delivery-policy-v1.yml');
  const s8Workflow = text('.github/workflows/mcft-cap-06-s8-restart-readback-rebuild.yml');

  assert.deepEqual(policy.frozen_taskbook_gap_classification.allowed_classes, ['IMPLEMENTATION_DEFECT', 'TASKBOOK_DESIGN_DEFECT']);
  assert.equal(policy.frozen_taskbook_gap_classification.implementation_defect.new_prerequisite_allowed, false);
  assert.equal(policy.frozen_taskbook_gap_classification.taskbook_design_defect.new_prerequisite_under_old_frozen_version_allowed, false);
  assert.equal(policy.capability_slice, false);

  assert.equal(effectiveness.taskbook_version, 'v0.4.0');
  assert.equal(effectiveness.status, 'MERGED_MAIN_EFFECTIVE_FROZEN');
  assert.equal(effectiveness.capability_slice, false);
  assert.equal(effectiveness.revision_evidence.pull_request_number, 2570);
  assert.equal(effectiveness.revision_evidence.exact_head, '4f5ddad78759beec8c81f58fb018ffa63a629fe2');
  assert.equal(effectiveness.revision_evidence.merge_commit, '56fd50500a14cc8b5d3743306da85f9d0055abe0');
  assert.equal(effectiveness.revision_evidence.head_to_merge_file_delta_count, 0);
  assert.equal(effectiveness.revision_evidence.head_to_merge_tree_equivalence, 'PASS');
  assert.equal(effectiveness.revision_evidence.postmerge_probe_pr_number, 2571);
  assert.equal(effectiveness.revision_evidence.postmerge_probe_closed_without_merge, true);
  assert.equal(effectiveness.revision_evidence.postmerge_workflow_run, 29633193658);
  assert.equal(effectiveness.revision_evidence.postmerge_gate, 'PASS');
  assert.equal(effectiveness.corrected_authority.same_version_ad_hoc_prerequisite_forbidden, true);
  assert.equal(effectiveness.corrected_authority.delivery_process_policy_is_capability_slice, false);
  assert.deepEqual(effectiveness.corrected_authority.excluded_historical_nodes.sort(), [...HISTORICAL_NODES].sort());
  assert.equal(effectiveness.corrected_authority.s0_branch_transport_neutralized, true);
  assert.equal(effectiveness.execution_transition.execution_paused, false);
  assert.equal(effectiveness.execution_transition.active_delivery_slice_id, S8);
  assert.equal(effectiveness.execution_transition.resumed_action, 'S8_EFFECTIVENESS_WRITEBACK');
  assert.equal(effectiveness.execution_transition.resumed_action_is_new_prerequisite, false);
  assert.equal(effectiveness.execution_transition.new_prerequisite_inserted, false);
  assert.equal(effectiveness.frontier.s8_implementation_merged_main_proven, true);
  assert.equal(effectiveness.frontier.s8_effective, false);
  assert.equal(effectiveness.frontier.s8_effectiveness_writeback_authorized, true);
  assert.equal(effectiveness.frontier.s9_authorized, false);
  assertZeroDelta(effectiveness.runtime_delta, 'TASKBOOK_EFFECTIVENESS');

  assert.equal(manifest.effective_taskbook_version, 'v0.4.0');
  assert.equal(manifest.revision_status, 'MERGED_MAIN_EFFECTIVE_FROZEN');
  assert.equal(manifest.execution_control.execution_paused, false);
  assert.equal(manifest.execution_control.active_delivery_slice_id, S8);
  assert.equal(manifest.execution_control.new_prerequisite_inserted, false);
  assert.equal(manifest.execution_control.resumed_action, 'S8_EFFECTIVENESS_WRITEBACK');
  assert.equal(manifest.execution_control.resumed_action_is_capability_prerequisite, false);
  assert.equal(manifest.execution_control.resumed_action_is_new_slice, false);
  assert.equal(manifest.s8_implementation_evidence.effectiveness_written, false);
  assert.equal(manifest.s8_effectiveness_writeback_authorized, true);
  assert.equal(manifest.s9_authorized, false);
  for (const node of HISTORICAL_NODES) assert.equal(manifest.normative_slice_graph.includes(node), false, `HISTORICAL_NODE_REENTERED_GRAPH:${node}`);

  assert.equal(frontier.record_kind, 'SOLE_MUTABLE_DELIVERY_FRONTIER');
  assert.equal(frontier.status, 'TASKBOOK_V0_4_0_EFFECTIVE_S8_EFFECTIVENESS_RESUMED');
  assert.equal(frontier.execution_paused, false);
  assert.equal(frontier.active_delivery_slice_id, S8);
  assert.equal(frontier.next_repository_action, 'S8_EFFECTIVENESS_WRITEBACK');
  assert.equal(frontier.next_repository_action_kind, 'EXISTING_SLICE_EFFECTIVENESS_WRITEBACK');
  assert.equal(frontier.next_repository_action_is_capability_slice, false);
  assert.equal(frontier.new_prerequisite_inserted, false);
  assert.equal(frontier.implementation_state.s8_effectiveness_writeback_authorized, true);
  assert.equal(frontier.implementation_state.s8_effective, false);
  assert.equal(frontier.implementation_state.s9_authorized, false);
  assert.equal(frontier.resumed_action_is_new_prerequisite, false);
  assert.equal(frontier.resumed_action_is_new_slice, false);
  assertZeroDelta(frontier.runtime_delta, 'CURRENT_FRONTIER');

  assert.equal(s8.status, 'IMPLEMENTATION_MERGED_MAIN_PROVEN_EFFECTIVENESS_RESUMED');
  assert.equal(s8.effectiveness_status, 'AUTHORIZED_TO_WRITEBACK');
  assert.equal(s8.execution_paused, false);
  assert.equal(s8.s8_effectiveness_writeback_authorized, true);
  assert.equal(s8.s8_effective, false);
  assert.equal(s8.s9_authorized, false);
  assert.equal(s8.next_repository_action, 'S8_EFFECTIVENESS_WRITEBACK');
  assert.equal(s8.next_repository_action_is_new_prerequisite, false);
  assert.equal(s8.next_repository_action_is_new_slice, false);
  assertZeroDelta(s8.runtime_delta, 'S8_STATUS');

  assert.equal(policyWorkflow.includes('56fd50500a14cc8b5d3743306da85f9d0055abe0'), true, 'HISTORICAL_POLICY_MERGE_FREEZE_REQUIRED');
  assert.equal(policyWorkflow.includes('TASKBOOK-V0.4.0-EFFECTIVENESS.json'), true, 'POLICY_EFFECTIVENESS_DETECTION_REQUIRED');
  assert.equal(s8Workflow.includes('s8_implementation_merged === true'), true, 'S8_IMPLEMENTATION_MERGE_FREEZE_REQUIRED');
  assert.equal(s8Workflow.includes('f14dc4c6aaf1cc8b56530c3f9088a1247f5d4db7'), true, 'S8_FROZEN_IMPLEMENTATION_REF_REQUIRED');

  const result = {
    schema_version: 'geox_mcft_cap_06_taskbook_v0_4_effectiveness_result_v1',
    status: 'PASS',
    baseline,
    changed_files: changed,
    changed_file_count: changed.length,
    commit_count: messages.length,
    taskbook_version: manifest.effective_taskbook_version,
    taskbook_status: manifest.revision_status,
    execution_paused: frontier.execution_paused,
    active_delivery_slice_id: frontier.active_delivery_slice_id,
    next_repository_action: frontier.next_repository_action,
    new_prerequisite_inserted: frontier.new_prerequisite_inserted,
    s8_implementation_merged_main_proven: true,
    s8_effective: false,
    s8_effectiveness_writeback_authorized: true,
    s9_authorized: false,
    runtime_delta: frontier.runtime_delta,
  };
  write(result);
  console.log(JSON.stringify(result, null, 2));
}

try {
  main();
} catch (error) {
  const failure = {
    schema_version: 'geox_mcft_cap_06_taskbook_v0_4_effectiveness_result_v1',
    status: 'FAIL',
    error: error instanceof Error ? error.message : String(error),
  };
  write(failure);
  console.error(JSON.stringify(failure, null, 2));
  process.exitCode = 1;
}
