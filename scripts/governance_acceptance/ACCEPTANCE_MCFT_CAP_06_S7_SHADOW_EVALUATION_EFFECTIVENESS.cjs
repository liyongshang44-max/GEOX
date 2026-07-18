// Purpose: validate governance-only S7 merged-main effectiveness and bounded S8 authorization.
// Boundary: no Runtime execution, database access, canonical/projection write, S8 implementation, activation, route, Web, scheduler or migration.

'use strict';

const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const OUTPUT_DIR = path.join(ROOT, 'acceptance-output');
const RESULT_PATH = path.join(OUTPUT_DIR, 'MCFT_CAP_06_S7_SHADOW_EVALUATION_EFFECTIVENESS_RESULT.json');
const BASELINE = 'c52ddd97ddf190db78ded6571263d7a0cc64ece6';
const IMPLEMENTATION_HEAD = '0bf743a838a68102b1dd391636cc70f31f80e789';
const S7 = 'MCFT-CAP-06.MCFT-03-12.SHADOW-EVALUATION-COMMIT-V1';
const S8 = 'MCFT-CAP-06.MCFT-03-04-12.RESTART-READBACK-REBUILD-V1';
const S9 = 'MCFT-CAP-06.MCFT-04-06-08-09-12.POST-EVALUATION-NON-CONSUMPTION-TICK-V1';
const EFFECTIVENESS_REF = 'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S7-SHADOW-EVALUATION-EFFECTIVENESS.json';
const STATUS_REF = 'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S7-SHADOW-EVALUATION-STATUS.json';
const EXPECTED_FILES = [
  '.github/workflows/mcft-cap-06-s7-shadow-evaluation-effectiveness.yml',
  '.github/workflows/mcft-cap-06-s7-shadow-evaluation.yml',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-DELIVERY-STATE.json',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-STATE-RECONCILIATION.json',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-DELIVERY-SLICE-STATUS.json',
  EFFECTIVENESS_REF,
  STATUS_REF,
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S7_SHADOW_EVALUATION_EFFECTIVENESS.cjs',
];
const FORBIDDEN_PREFIXES = [
  'apps/server/src/domain/',
  'apps/server/src/runtime/',
  'apps/server/src/persistence/',
  'apps/server/src/projections/',
  'apps/server/scripts/',
  'apps/server/db/migrations/',
  'apps/web/',
];
const ZERO_KEYS = [
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
function assertZeros(object, prefix) {
  for (const key of ZERO_KEYS) assert.equal(object[key], 0, `${prefix}_${key.toUpperCase()}_NONZERO`);
}

function main() {
  const baseline = String(process.env.MCFT_CAP_06_S7_SHADOW_EVALUATION_EFFECTIVENESS_BASELINE_REF || BASELINE).trim();
  git(['cat-file', '-e', `${baseline}^{commit}`]);
  const changedRaw = git(['diff', '--name-only', `${baseline}...HEAD`]);
  const changed = changedRaw ? changedRaw.split(/\r?\n/).filter(Boolean).sort() : [];
  assert.deepEqual(changed, [...EXPECTED_FILES].sort());
  for (const prefix of FORBIDDEN_PREFIXES) {
    assert.equal(changed.some((file) => file.startsWith(prefix)), false, `S7_EFFECTIVENESS_FORBIDDEN_PREFIX:${prefix}`);
  }
  assert.equal(changed.some((file) => /routes?|controller|openapi/i.test(file)), false);
  const commitCount = Number(git(['rev-list', '--count', `${baseline}..HEAD`]));
  assert.ok(commitCount >= 1 && commitCount <= 10, 'S7_EFFECTIVENESS_LOGICAL_COMMIT_COUNT_INVALID');
  for (const message of git(['log', '--format=%s', `${baseline}..HEAD`]).split(/\r?\n/).filter(Boolean)) {
    assert.equal(/wip|fix ci|try again|debug|temporary/i.test(message), false, `S7_EFFECTIVENESS_COMMIT_MESSAGE_INVALID:${message}`);
  }
  assert.equal(git(['diff', '--name-only', IMPLEMENTATION_HEAD, BASELINE]), '');

  const effect = json(EFFECTIVENESS_REF);
  const status = json(STATUS_REF);
  const delivery = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-DELIVERY-STATE.json');
  const slices = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-DELIVERY-SLICE-STATUS.json');
  const reconciliation = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-STATE-RECONCILIATION.json');

  assert.equal(effect.schema_version, 'geox_mcft_cap_06_s7_shadow_evaluation_effectiveness_v1');
  assert.equal(effect.delivery_slice_id, S7);
  assert.equal(effect.status, 'MERGED_EFFECTIVE');
  assert.equal(effect.effective, true);
  assert.equal(effect.implementation_pr_number, 2564);
  assert.equal(effect.implementation_exact_head, IMPLEMENTATION_HEAD);
  assert.equal(effect.implementation_focused_validation_run, 29629379499);
  assert.equal(effect.implementation_standard_ci_run, 29629379481);
  assert.equal(effect.implementation_merge_commit, BASELINE);
  assert.equal(effect.head_to_merge_file_delta_count, 0);
  assert.equal(effect.head_to_merge_tree_equivalence, 'PASS');
  assert.equal(effect.postmerge_probe_pr_number, 2565);
  assert.equal(effect.postmerge_probe_closed_without_merge, true);
  assert.equal(effect.postmerge_workflow_run, 29629714133);
  assert.equal(effect.postmerge_gate, 'PASS');
  assert.equal(effect.controlled_acceptance.source_s6_artifact_hash, 'sha256:396fa1c03a33e4b5722c6d6e7d63774072e46ec8e8f91deaf7a5e0c24b328a71');
  assert.equal(effect.controlled_acceptance.candidate_ref, 'twin_calibration_candidate_5649b9ab80b5545cf6007387');
  assert.equal(effect.controlled_acceptance.candidate_hash, 'sha256:a2018a61bf6699b3cc3b8992058eb2c37b4d38d7f70771f9186495144c229a65');
  assert.equal(effect.controlled_acceptance.holdout_case_count, 8);
  assert.equal(effect.controlled_acceptance.source_case_results_hash, 'sha256:e1b33fb79059856c030cab58970c543f384fb30a385bc3aa49c96b315efe4daa');
  assert.equal(effect.controlled_acceptance.source_compute_determinism_hash, 'sha256:8017c2ba6006e1f2a593312300937841b5c2dd3a700c949bb8309338994ef63e');
  assert.equal(effect.controlled_acceptance.evaluation_ref, 'twin_shadow_evaluation_8cae1f6732420a4999deffc0');
  assert.equal(effect.controlled_acceptance.evaluation_hash, 'sha256:32c43020f45351994120515e5c633531bb594d85659456c65bd46305737d85e0');
  assert.equal(effect.controlled_acceptance.first_evaluation_append_count, 1);
  assert.equal(effect.controlled_acceptance.completed_chain_rerun_evaluation_append_count, 0);
  assert.equal(effect.controlled_acceptance.aggregate_projection_count, 1);
  assert.equal(effect.controlled_acceptance.candidate_evaluation_index_count, 1);
  assert.equal(effect.controlled_acceptance.case_projection_count, 8);
  assert.equal(effect.controlled_acceptance.canonical_readback_verified, true);
  assertZeros(effect.runtime_delta_boundary, 'S7_EFFECTIVENESS');
  assert.equal(effect.active_delivery_slice_id, S8);
  assert.deepEqual(effect.authorized_not_started_slice_ids, [S8]);
  assert.equal(effect.s7_effective, true);
  assert.equal(effect.s8_authorized, true);
  assert.equal(effect.s8_implementation_started, false);
  assert.equal(effect.s8_candidate_implemented, false);
  assert.equal(effect.s8_effective, false);
  assert.equal(effect.s8_canonical_write_authorized, false);

  assert.equal(status.status, 'MERGED_EFFECTIVE');
  assert.equal(status.s7_effective, true);
  assert.equal(status.s8_authorized, true);
  assert.equal(status.s8_implementation_started, false);
  assert.equal(status.s8_candidate_implemented, false);
  assert.equal(status.s8_effective, false);
  assert.equal(status.runtime_delta.governance_writeback_canonical_write_count, 0);
  assert.equal(status.runtime_delta.governance_writeback_projection_write_count, 0);

  assert.equal(delivery.status, 'S7_SHADOW_EVALUATION_MERGED_EFFECTIVE_S8_AUTHORIZED_NOT_STARTED');
  assert.equal(delivery.active_delivery_slice_id, S8);
  assert.deepEqual(delivery.authorized_not_started_slices, [S8]);
  assert.equal(delivery.s7.effective, true);
  assert.equal(delivery.s7.merge_commit, BASELINE);
  assert.equal(delivery.s8.authorized, true);
  assert.equal(delivery.s8.implementation_started, false);
  assert.equal(delivery.s8.candidate_implemented, false);
  assert.equal(delivery.s8.effective, false);
  assert.equal(delivery.s8.canonical_write_authorized, false);
  assert.equal(delivery.blocked_slices.includes(S8), false);
  assert.equal(delivery.blocked_slices.includes(S9), true);

  assert.equal(slices.active_delivery_slice_id, S8);
  assert.deepEqual(slices.authorized_not_started_slices, [S8]);
  assert.equal(slices.s7_effective, true);
  assert.equal(slices.s8_authorized, true);
  assert.equal(slices.s8_implementation_started, false);
  assert.equal(slices.s8_effective, false);
  assert.equal(slices.blocked_slices.includes(S8), false);
  assert.equal(slices.blocked_slices.includes(S9), true);
  const s7Entry = slices.completed_or_effective_slices.find((item) => item.delivery_slice_id === S7);
  assert.ok(s7Entry, 'S7_EFFECTIVENESS_COMPLETED_SLICE_MISSING');
  assert.equal(s7Entry.status, 'MERGED_EFFECTIVE');
  assert.equal(s7Entry.merge_commit, BASELINE);

  assert.equal(reconciliation.delivery_frontier_status, 'S7_SHADOW_EVALUATION_MERGED_EFFECTIVE_S8_AUTHORIZED_NOT_STARTED');
  assert.equal(reconciliation.current_state.active_delivery_slice_id, S8);
  assert.equal(reconciliation.current_state.shadow_evaluation_runtime_implemented, true);
  assert.equal(reconciliation.current_state.restart_readback_rebuild_runtime_implemented, false);
  assert.equal(reconciliation.current_state.s7, 'MERGED_EFFECTIVE');
  assert.equal(reconciliation.current_state.s7_effective, true);
  assert.equal(reconciliation.current_state.s8_authorized, true);
  assert.equal(reconciliation.current_state.s8_implementation_started, false);
  assert.equal(reconciliation.current_state.s8_effective, false);
  const proof = reconciliation.proof.s7_shadow_evaluation_effectiveness;
  assert.equal(proof.status, 'MERGED_EFFECTIVE');
  assert.equal(proof.implementation_merge_commit, BASELINE);
  assert.equal(proof.postmerge_workflow_run, 29629714133);
  assert.equal(proof.s8_authorized, true);

  const result = {
    schema_version: 'geox_mcft_cap_06_s7_shadow_evaluation_effectiveness_result_v1',
    status: 'PASS',
    exact_head: git(['rev-parse', 'HEAD']),
    baseline_ref: baseline,
    changed_file_count: changed.length,
    logical_commit_count: commitCount,
    implementation_exact_head: IMPLEMENTATION_HEAD,
    implementation_merge_commit: BASELINE,
    head_to_merge_file_delta_count: 0,
    head_to_merge_tree_equivalence: 'PASS',
    implementation_focused_validation_run: 29629379499,
    implementation_standard_ci_run: 29629379481,
    postmerge_probe_pr_number: 2565,
    postmerge_workflow_run: 29629714133,
    evaluation_ref: effect.controlled_acceptance.evaluation_ref,
    evaluation_hash: effect.controlled_acceptance.evaluation_hash,
    first_evaluation_append_count: 1,
    completed_chain_rerun_evaluation_append_count: 0,
    s7_status: status.status,
    s7_effective: true,
    active_delivery_slice_id: S8,
    s8_authorized: true,
    s8_implementation_started: false,
    s8_candidate_implemented: false,
    s8_effective: false,
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
    public_route_count: 0,
    web_change_count: 0,
    scheduler_count: 0,
  };
  write(result);
  console.log(JSON.stringify(result));
}

try {
  main();
} catch (error) {
  const result = {
    schema_version: 'geox_mcft_cap_06_s7_shadow_evaluation_effectiveness_result_v1',
    status: 'FAIL',
    error: error instanceof Error ? error.message : String(error),
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
    public_route_count: 0,
    web_change_count: 0,
    scheduler_count: 0,
    s7_effective: false,
    s8_authorized: false,
  };
  write(result);
  console.error(JSON.stringify(result));
  process.exitCode = 1;
}
