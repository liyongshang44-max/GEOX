// Purpose: validate merged-main effectiveness writeback for the S5 predecessor graph/dual-time prerequisite.
// Boundary: structured governance only; no Runtime execution, database access, canonical write, S5 implementation, activation, or State/checkpoint authority.

'use strict';

const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const OUTPUT_DIR = path.join(ROOT, 'acceptance-output');
const RESULT_PATH = path.join(OUTPUT_DIR, 'MCFT_CAP_06_S5_PREDECESSOR_EFFECTIVENESS_RESULT.json');
const PRE = 'MCFT-CAP-06.S5-PREDECESSOR.GRAPH-AND-DUAL-TIME-CONFORMANCE-V1';
const S5 = 'MCFT-CAP-06.MCFT-06-09-11-12.CALIBRATION-CANDIDATE-COMPUTE-COMMIT-V1';
const S6 = 'MCFT-CAP-06.MCFT-06-09-11-12.PAIRED-HISTORICAL-SHADOW-COMPUTE-V1';
const IMPLEMENTATION_MERGE = '17a01ec25be2bbd7ee92b9e9e6115afed9665435';
const EFFECTIVENESS_REF = 'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S5-PREDECESSOR-EFFECTIVENESS.json';
const EXPECTED_FILES = [
  '.github/workflows/mcft-cap-06-s5-predecessor-graph-conformance.yml',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-DELIVERY-STATE.json',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-STATE-RECONCILIATION.json',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-DELIVERY-SLICE-STATUS.json',
  EFFECTIVENESS_REF,
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S5_PREDECESSOR_EFFECTIVENESS.cjs',
];
const PROTECTED_PATHS = [
  'apps/server/src/domain/twin_runtime/canonical_object_contracts_v1.ts',
  'apps/server/src/domain/twin_runtime/canonical_identity_v1.ts',
  'apps/server/src/domain/twin_runtime/forecast_canonical_authority_v1.ts',
  'apps/server/src/runtime/twin_runtime/a0_record_set_builder_v1.ts',
];

function json(relative) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8'));
}
function write(result) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(RESULT_PATH, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
}
function git(args) {
  return cp.execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}
function baselineRef() {
  const explicit = String(process.env.MCFT_CAP_06_S5_PREDECESSOR_EFFECTIVENESS_BASELINE_REF || '').trim();
  const baseline = explicit || IMPLEMENTATION_MERGE;
  git(['cat-file', '-e', `${baseline}^{commit}`]);
  return baseline;
}
function assertZeroBoundary(boundary) {
  for (const key of [
    'canonical_write_count',
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
  ]) assert.equal(boundary[key], 0, `S5_PREDECESSOR_EFFECTIVENESS_${key.toUpperCase()}_NONZERO`);
}

function main() {
  const baseline = baselineRef();
  const changedRaw = git(['diff', '--name-only', `${baseline}...HEAD`]);
  const changed = changedRaw ? changedRaw.split(/\r?\n/).filter(Boolean).sort() : [];
  assert.deepEqual(changed, [...EXPECTED_FILES].sort());
  assert.deepEqual(changed.filter((file) => PROTECTED_PATHS.includes(file)), []);
  assert.equal(changed.some((file) => file.startsWith('apps/server/src/domain/')), false);
  assert.equal(changed.some((file) => file.startsWith('apps/server/src/runtime/')), false);
  assert.equal(changed.some((file) => file.startsWith('apps/server/src/persistence/')), false);
  assert.equal(changed.some((file) => file.startsWith('apps/server/db/migrations/')), false);
  assert.equal(changed.some((file) => file.startsWith('apps/web/')), false);
  const commitCount = Number(git(['rev-list', '--count', `${baseline}..HEAD`]));
  assert.ok(commitCount >= 1 && commitCount <= 2, 'S5_PREDECESSOR_EFFECTIVENESS_LOGICAL_COMMIT_COUNT_INVALID');
  const messagesRaw = git(['log', '--format=%s', `${baseline}..HEAD`]);
  for (const message of messagesRaw.split(/\r?\n/).filter(Boolean)) {
    assert.equal(/wip|fix ci|try again|debug|temporary/i.test(message), false, `S5_PREDECESSOR_EFFECTIVENESS_COMMIT_MESSAGE_INVALID:${message}`);
  }

  const effect = json(EFFECTIVENESS_REF);
  const delivery = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-DELIVERY-STATE.json');
  const reconciliation = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-STATE-RECONCILIATION.json');
  const slices = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-DELIVERY-SLICE-STATUS.json');
  const contract = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S5-PREDECESSOR-GRAPH-CONFORMANCE.json');
  const graph = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S5-PREDECESSOR-AUTHORITY-GRAPH-V2.json');

  assert.equal(effect.schema_version, 'geox_mcft_cap_06_s5_predecessor_effectiveness_v1');
  assert.equal(effect.delivery_slice_id, PRE);
  assert.equal(effect.status, 'MERGED_EFFECTIVE');
  assert.equal(effect.effective, true);
  assert.equal(effect.implementation_pr_number, 2547);
  assert.equal(effect.implementation_exact_head, '001effed492514a5ea866d5b976af8f4a9e3357c');
  assert.equal(effect.implementation_predecessor_graph_focused_run, 29575208769);
  assert.equal(effect.implementation_standard_ci_run, 29575208701);
  assert.equal(effect.implementation_merge_commit, IMPLEMENTATION_MERGE);
  assert.equal(effect.head_to_merge_file_delta_count, 0);
  assert.equal(effect.head_to_merge_tree_equivalence, 'PASS');
  assert.equal(effect.postmerge_probe_pr_number, 2549);
  assert.equal(effect.postmerge_probe_closed_without_merge, true);
  assert.equal(effect.postmerge_workflow_run, 29575857015);
  assert.equal(effect.postmerge_gate, 'PASS');
  assert.equal(effect.authority_graph.status, 'FROZEN_CORRECTED_NONZERO_AVAILABILITY_LATENCY');
  assert.equal(effect.authority_graph.transaction, 'ONE_REPEATABLE_READ_READ_ONLY_TRANSACTION');
  assert.equal(effect.controlled_profile.exact_graph_case_count, 24);
  assert.equal(effect.controlled_profile.delayed_availability_case_count, 24);
  assert.equal(effect.controlled_profile.selected_parameter_value_under_exact_s2_math, '0.034000');
  assertZeroBoundary(effect.runtime_delta_boundary);
  assert.equal(effect.active_delivery_slice_id, S5);
  assert.deepEqual(effect.authorized_not_started_slice_ids, [S5]);
  assert.equal(effect.s5_authorized, true);
  assert.equal(effect.s5_implementation_started, false);
  assert.equal(effect.s5_canonical_candidate_append_authorized, true);
  assert.equal(effect.s6_authorized, false);
  assert.equal(effect.successor_capability_line_authorized, false);

  assert.equal(contract.status, 'CANDIDATE_IMPLEMENTED_NOT_EFFECTIVE');
  assert.equal(contract.s5_authorized, false);
  assert.equal(contract.s5_implementation_started, false);
  assert.equal(graph.status, 'FROZEN_CORRECTED_NONZERO_AVAILABILITY_LATENCY');
  assert.equal(graph.resolution_policy.mode, 'EXACT_REF_HASH_ONLY');
  assert.equal(graph.resolution_policy.transaction, 'ONE_REPEATABLE_READ_READ_ONLY_TRANSACTION');

  assert.equal(delivery.baseline_effectiveness_ref, EFFECTIVENESS_REF);
  assert.equal(delivery.baseline_main_commit, IMPLEMENTATION_MERGE);
  assert.equal(delivery.active_delivery_slice_id, S5);
  assert.deepEqual(delivery.candidate_slices, []);
  assert.deepEqual(delivery.authorized_not_started_slices, [S5]);
  assert.equal(delivery.blocked_slices.includes(S5), false);
  assert.equal(delivery.blocked_slices.includes(S6), true);
  assert.equal(delivery.s5.authorized, true);
  assert.equal(delivery.s5.implementation_started, false);
  assert.equal(delivery.s5.canonical_candidate_append_authorized, true);
  assert.equal(delivery.s5.model_activation_authorized, false);
  assert.equal(delivery.s5.active_config_switch_authorized, false);
  assert.equal(delivery.s5.blocked_until_predecessor_graph_conformance_effective, false);
  assert.equal(delivery.s5_predecessor_graph_conformance.effective, true);
  assert.equal(delivery.s5_predecessor_graph_conformance.effectiveness_ref, EFFECTIVENESS_REF);
  assert.equal(delivery.next_repository_action, S5);

  assert.equal(reconciliation.baseline_main_commit, IMPLEMENTATION_MERGE);
  assert.equal(reconciliation.current_state.active_delivery_slice_id, S5);
  assert.equal(reconciliation.current_state.s5_authorized, true);
  assert.equal(reconciliation.current_state.s5_implementation_started, false);
  assert.equal(reconciliation.current_state.s5_predecessor_graph_conformance, 'MERGED_EFFECTIVE');
  assert.equal(reconciliation.current_state.s5_predecessor_graph_conformance_effective, true);
  assert.equal(reconciliation.proof.s5_predecessor_graph_conformance_effectiveness.postmerge_workflow_run, 29575857015);
  assert.equal(reconciliation.s5_predecessor_effectiveness_ref, EFFECTIVENESS_REF);
  assert.equal(reconciliation.next_repository_action, S5);

  assert.equal(slices.implementation_status, 'S5_AUTHORIZED_NOT_STARTED');
  assert.equal(slices.active_delivery_slice_id, S5);
  assert.deepEqual(slices.candidate_slices, []);
  assert.deepEqual(slices.authorized_not_started_slices, [S5]);
  assert.equal(slices.blocked_slices.includes(S5), false);
  assert.equal(slices.blocked_slices.includes(S6), true);
  assert.equal(slices.s5_authorized, true);
  assert.equal(slices.s5_implementation_started, false);
  assert.equal(slices.s5_predecessor_graph_conformance_effective, true);
  assert.equal(slices.s5_predecessor_graph_conformance_effectiveness_ref, EFFECTIVENESS_REF);
  const completed = slices.completed_or_effective_slices.find((item) => item.delivery_slice_id === PRE);
  assert.ok(completed, 'S5_PREDECESSOR_EFFECTIVE_SLICE_MISSING');
  assert.equal(completed.status, 'MERGED_EFFECTIVE');
  assert.equal(completed.postmerge_workflow_run, 29575857015);

  const result = {
    schema_version: 'geox_mcft_cap_06_s5_predecessor_effectiveness_result_v1',
    status: 'PASS',
    exact_head: git(['rev-parse', 'HEAD']),
    baseline_ref: baseline,
    changed_file_count: changed.length,
    logical_commit_count: commitCount,
    predecessor_status: 'MERGED_EFFECTIVE',
    active_delivery_slice_id: S5,
    s5_authorized: true,
    s5_implementation_started: false,
    s5_canonical_candidate_append_authorized: true,
    s6_authorized: false,
    canonical_write_count: 0,
    candidate_append_count: 0,
    evaluation_append_count: 0,
    model_activation_count: 0,
    active_config_switch_count: 0,
    state_mutation_count: 0,
    checkpoint_mutation_count: 0,
  };
  write(result);
  console.log(JSON.stringify(result));
}

try { main(); } catch (error) {
  const result = {
    schema_version: 'geox_mcft_cap_06_s5_predecessor_effectiveness_result_v1',
    status: 'FAIL',
    error: error instanceof Error ? error.message : String(error),
    canonical_write_count: 0,
    candidate_append_count: 0,
    evaluation_append_count: 0,
    s5_implementation_started: false,
  };
  write(result);
  console.error(JSON.stringify(result));
  process.exitCode = 1;
}
