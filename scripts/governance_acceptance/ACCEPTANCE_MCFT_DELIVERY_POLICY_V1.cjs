// Purpose: enforce the repository-wide MCFT frozen-taskbook defect rule and validate the MCFT-CAP-06 v0.4.0 design-authority correction.
// Boundary: governance only; no Runtime execution, database access, canonical/projection write, activation, migration, route, Web, scheduler or successor authority.

'use strict';

const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const OUTPUT_DIR = path.join(ROOT, 'acceptance-output');
const RESULT_PATH = path.join(OUTPUT_DIR, 'MCFT_DELIVERY_POLICY_V1_RESULT.json');
const DEFAULT_BASELINE = 'f14dc4c6aaf1cc8b56530c3f9088a1247f5d4db7';
const S4 = 'MCFT-CAP-06.MCFT-02-03-04-05-09-11.PREDECESSOR-CONSUMPTION-STABILIZATION-V1';
const S5 = 'MCFT-CAP-06.MCFT-06-09-11-12.CALIBRATION-CANDIDATE-COMPUTE-COMMIT-V1';
const S8 = 'MCFT-CAP-06.MCFT-03-04-12.RESTART-READBACK-REBUILD-V1';
const HISTORICAL_NODES = [
  'MCFT-CAP-06.S5-ENTRY.AUTHORITY-GRAPH-PREFLIGHT-AND-PR-HYGIENE-V1',
  'MCFT-CAP-06.S5-PREDECESSOR.GRAPH-AND-DUAL-TIME-CONFORMANCE-V1',
];
const EXPECTED_FILES = [
  'docs/digital_twin/mcft/MCFT-DELIVERY-POLICY-V1.json',
  'docs/digital_twin/mcft/MCFT-DELIVERY-POLICY-V1.md',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-DELIVERY-AUTHORITY-V2.json',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S5-AD-HOC-PREREQUISITE-RECLASSIFICATION.json',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S8-RESTART-READBACK-REBUILD-STATUS.json',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-TASK-v0.4.0-REVISION.md',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-TASKBOOK-MANIFEST.json',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-TASKBOOK-V0.4.0-FULL-CHAIN-IMPACT.json',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_DELIVERY_POLICY_V1.cjs',
  '.github/workflows/mcft-delivery-policy-v1.yml',
];
const FORBIDDEN_RUNTIME_PREFIXES = [
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
  'model_activation_count',
  'active_config_switch_count',
  'runtime_parameter_change_count',
  'state_mutation_count',
  'checkpoint_mutation_count',
  'migration_count',
];

function git(args) {
  return cp.execFileSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function json(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function write(result) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(RESULT_PATH, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
}

function assertZeroDelta(delta, prefix) {
  for (const key of ZERO_KEYS) {
    assert.equal(delta[key], 0, `${prefix}_${key.toUpperCase()}_NONZERO`);
  }
}

function assertConsecutive(list, predecessor, successor) {
  const predecessorIndex = list.indexOf(predecessor);
  const successorIndex = list.indexOf(successor);
  assert.notEqual(predecessorIndex, -1, `MISSING_GRAPH_NODE:${predecessor}`);
  assert.notEqual(successorIndex, -1, `MISSING_GRAPH_NODE:${successor}`);
  assert.equal(successorIndex, predecessorIndex + 1, `NON_CONSECUTIVE_GRAPH_TRANSITION:${predecessor}->${successor}`);
}

function main() {
  const baseline = String(process.env.MCFT_DELIVERY_POLICY_BASE_REF || DEFAULT_BASELINE).trim();
  git(['cat-file', '-e', `${baseline}^{commit}`]);
  const changedRaw = git(['diff', '--name-only', `${baseline}...HEAD`]);
  const changed = changedRaw ? changedRaw.split(/\r?\n/).filter(Boolean).sort() : [];
  assert.deepEqual(changed, [...EXPECTED_FILES].sort(), 'DELIVERY_POLICY_CHANGED_FILE_BOUNDARY_INVALID');
  assert.equal(
    changed.some((file) => FORBIDDEN_RUNTIME_PREFIXES.some((prefix) => file.startsWith(prefix))),
    false,
    'DELIVERY_POLICY_RUNTIME_OR_MIGRATION_FILE_CHANGED',
  );
  assert.equal(changed.some((file) => /route|controller|openapi|scheduler/i.test(file)), false, 'DELIVERY_POLICY_FORBIDDEN_SURFACE_CHANGED');

  const messages = git(['log', '--format=%s', `${baseline}..HEAD`]).split(/\r?\n/).filter(Boolean);
  for (const message of messages) {
    assert.equal(/\bwip\b|fix ci|try again|\bdebug\b|\btemporary\b/i.test(message), false, `DELIVERY_POLICY_COMMIT_MESSAGE_INVALID:${message}`);
  }

  const policy = json('docs/digital_twin/mcft/MCFT-DELIVERY-POLICY-V1.json');
  const manifest = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-TASKBOOK-MANIFEST.json');
  const impact = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-TASKBOOK-V0.4.0-FULL-CHAIN-IMPACT.json');
  const reclassification = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S5-AD-HOC-PREREQUISITE-RECLASSIFICATION.json');
  const frontier = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-DELIVERY-AUTHORITY-V2.json');
  const s8 = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S8-RESTART-READBACK-REBUILD-STATUS.json');

  assert.equal(policy.policy_id, 'MCFT-DELIVERY-POLICY-V1');
  assert.equal(policy.scope, 'ALL_MCFT_CAPABILITY_LINES');
  assert.equal(policy.capability_slice, false);
  assert.equal(policy.runtime_authority, false);
  assert.deepEqual(policy.frozen_taskbook_gap_classification.allowed_classes, [
    'IMPLEMENTATION_DEFECT',
    'TASKBOOK_DESIGN_DEFECT',
  ]);
  assert.equal(policy.frozen_taskbook_gap_classification.implementation_defect.new_prerequisite_allowed, false);
  assert.equal(policy.frozen_taskbook_gap_classification.taskbook_design_defect.pause_execution_required, true);
  assert.equal(policy.frozen_taskbook_gap_classification.taskbook_design_defect.taskbook_version_increment_required, true);
  assert.equal(policy.frozen_taskbook_gap_classification.taskbook_design_defect.full_chain_impact_analysis_required, true);
  assert.equal(policy.frozen_taskbook_gap_classification.taskbook_design_defect.new_prerequisite_under_old_frozen_version_allowed, false);
  assert.equal(policy.enforcement.reject_same_version_prerequisite_insertion, true);
  assert.equal(policy.enforcement.reject_delivery_process_slice, true);
  assert.equal(policy.delivery_process_controls_may_not.includes('CREATE_CAPABILITY_PREDECESSOR'), true);
  assert.equal(policy.delivery_process_controls_may_not.includes('COUNT_AS_TECHNICAL_SLICE'), true);
  assert.deepEqual(policy.historical_reclassifications.map((item) => item.artifact_id).sort(), [...HISTORICAL_NODES].sort());

  assert.equal(manifest.effective_taskbook_version, 'v0.4.0-candidate');
  assert.equal(manifest.revision_status, 'CANDIDATE_NOT_EFFECTIVE');
  assert.equal(manifest.change_classification, 'TASKBOOK_DESIGN_DEFECT');
  assert.equal(manifest.execution_control.execution_paused, true);
  assert.equal(manifest.execution_control.active_delivery_slice_id, null);
  assert.equal(manifest.execution_control.new_prerequisite_inserted, false);
  assert.equal(manifest.execution_control.resume_action, 'S8_EFFECTIVENESS_WRITEBACK');
  assert.equal(manifest.execution_control.resume_action_is_capability_prerequisite, false);
  assert.equal(manifest.current_delivery_authority_ref.endsWith('CURRENT-DELIVERY-AUTHORITY-V2.json'), true);
  assert.deepEqual(manifest.excluded_historical_nodes.sort(), [...HISTORICAL_NODES].sort());
  for (const node of HISTORICAL_NODES) assert.equal(manifest.normative_slice_graph.includes(node), false, `HISTORICAL_NODE_STILL_IN_GRAPH:${node}`);
  assertConsecutive(manifest.normative_slice_graph, S4, S5);

  assert.equal(impact.change_classification, 'TASKBOOK_DESIGN_DEFECT');
  assert.equal(impact.execution_paused, true);
  assert.equal(impact.runtime_code_rollback_required, false);
  assert.equal(impact.canonical_data_rollback_required, false);
  assert.equal(impact.migration_rollback_required, false);
  assert.deepEqual(impact.historical_nodes_removed_from_normative_graph.sort(), [...HISTORICAL_NODES].sort());
  assert.equal(impact.slice_impacts.S8.implementation_evidence_status, 'VALID_MERGED_MAIN_PROVEN');
  assert.equal(impact.slice_impacts.S8.effectiveness_status, 'PAUSED_NOT_WRITTEN');
  assert.equal(impact.slice_impacts.S8.resume_action_is_new_prerequisite, false);
  assert.equal(impact.slice_impacts.S9.status, 'BLOCKED_UNAUTHORIZED');
  assertZeroDelta(impact.runtime_delta, 'TASKBOOK_IMPACT');

  assert.equal(reclassification.change_classification, 'TASKBOOK_DESIGN_DEFECT');
  assert.equal(reclassification.historical_rewrite_allowed, false);
  assert.deepEqual(reclassification.records.map((item) => item.historical_node_id).sort(), [...HISTORICAL_NODES].sort());
  for (const record of reclassification.records) {
    assert.equal(record.normative_capability_slice, false);
    assert.equal(record.capability_completion_counted, false);
  }
  assert.equal(reclassification.corrected_normative_transition.from, S4);
  assert.equal(reclassification.corrected_normative_transition.to, S5);
  assert.deepEqual(reclassification.corrected_normative_transition.intermediate_capability_nodes, []);

  assert.equal(frontier.record_kind, 'SOLE_MUTABLE_DELIVERY_FRONTIER');
  assert.equal(frontier.status, 'TASKBOOK_DESIGN_DEFECT_EXECUTION_PAUSED');
  assert.equal(frontier.execution_paused, true);
  assert.equal(frontier.active_delivery_slice_id, null);
  assert.equal(frontier.new_prerequisite_inserted, false);
  assert.equal(frontier.next_repository_action_kind, 'TASKBOOK_GOVERNANCE_CORRECTION');
  assert.equal(frontier.next_repository_action_is_capability_slice, false);
  assert.equal(frontier.resume_action, 'S8_EFFECTIVENESS_WRITEBACK');
  assert.equal(frontier.resume_action_is_new_prerequisite, false);
  assert.equal(frontier.implementation_state.s8_implementation_merged, true);
  assert.equal(frontier.implementation_state.s8_merged_main_proven, true);
  assert.equal(frontier.implementation_state.s8_effective, false);
  assert.equal(frontier.implementation_state.s9_authorized, false);
  assertZeroDelta(frontier.runtime_delta, 'CURRENT_FRONTIER');

  assert.equal(s8.delivery_slice_id, S8);
  assert.equal(s8.status, 'IMPLEMENTATION_MERGED_MAIN_PROVEN_EFFECTIVENESS_PAUSED');
  assert.equal(s8.implementation_status, 'MERGED_MAIN_PROVEN');
  assert.equal(s8.effectiveness_status, 'PAUSED_BY_TASKBOOK_DESIGN_DEFECT');
  assert.equal(s8.execution_paused, true);
  assert.equal(s8.s8_implementation_merged, true);
  assert.equal(s8.s8_merged_main_proven, true);
  assert.equal(s8.s8_effective, false);
  assert.equal(s8.s9_authorized, false);
  assert.equal(s8.next_repository_action_is_new_prerequisite, false);
  assertZeroDelta(s8.runtime_delta, 'S8_STATUS');

  const result = {
    schema_version: 'geox_mcft_delivery_policy_v1_acceptance_result_v1',
    status: 'PASS',
    baseline,
    changed_files: changed,
    changed_file_count: changed.length,
    commit_count: messages.length,
    allowed_gap_classes: policy.frozen_taskbook_gap_classification.allowed_classes,
    forbidden_mode: policy.frozen_taskbook_gap_classification.forbidden_mode,
    taskbook_version: manifest.effective_taskbook_version,
    taskbook_revision_status: manifest.revision_status,
    execution_paused: frontier.execution_paused,
    paused_frontier: frontier.paused_frontier,
    active_delivery_slice_id: frontier.active_delivery_slice_id,
    normative_transition: `${S4}->${S5}`,
    excluded_historical_nodes: HISTORICAL_NODES,
    s8_implementation_evidence_valid: true,
    s8_effective: false,
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
    schema_version: 'geox_mcft_delivery_policy_v1_acceptance_result_v1',
    status: 'FAIL',
    error: error instanceof Error ? error.message : String(error),
  };
  write(failure);
  console.error(JSON.stringify(failure, null, 2));
  process.exitCode = 1;
}
