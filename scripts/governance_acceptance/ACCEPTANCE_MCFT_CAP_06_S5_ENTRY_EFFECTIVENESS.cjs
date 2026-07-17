// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S5_ENTRY_EFFECTIVENESS.cjs
// Purpose: validate immutable merged-main S5-entry effectiveness and monotonic downstream delivery authority.
// Boundary: structured evidence and governance state only; no S5/S6 implementation, database access, canonical append, activation, or Runtime mutation.

'use strict';

const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const OUTPUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_06_S5_ENTRY_EFFECTIVENESS_RESULT.json');
const IMPLEMENTATION_MERGE = '52965b61e2dbd2974448d529619c5f745acf9301';
const EFFECTIVENESS_MERGE = '437a6ccae5903494638d17c997a7017c6da057cf';
const ENTRY = 'MCFT-CAP-06.S5-ENTRY.AUTHORITY-GRAPH-PREFLIGHT-AND-PR-HYGIENE-V1';
const S5_GRAPH = 'MCFT-CAP-06.S5-PREDECESSOR.GRAPH-AND-DUAL-TIME-CONFORMANCE-V1';
const S5 = 'MCFT-CAP-06.MCFT-06-09-11-12.CALIBRATION-CANDIDATE-COMPUTE-COMMIT-V1';
const S6 = 'MCFT-CAP-06.MCFT-06-09-11-12.PAIRED-HISTORICAL-SHADOW-COMPUTE-V1';
const S7 = 'MCFT-CAP-06.MCFT-03-12.SHADOW-EVALUATION-COMMIT-V1';

function json(relative) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8'));
}

function git(args) {
  return cp.execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function write(result) {
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
}

function commitExists(ref) {
  return cp.spawnSync('git', ['cat-file', '-e', `${ref}^{commit}`], {
    cwd: ROOT,
    stdio: 'ignore',
    shell: false
  }).status === 0;
}

function verifyHistoricalGitProof() {
  if (commitExists(IMPLEMENTATION_MERGE) && commitExists(EFFECTIVENESS_MERGE)) {
    assert.equal(git(['diff', '--name-only', 'ebadebdfd8f0189a0f7776316287a7d7dad0b15e', IMPLEMENTATION_MERGE]), '');
    assert.equal(git(['diff', '--name-only', 'b046e10e343d1d5b9549eaea9d66050dc4fe62ea', EFFECTIVENESS_MERGE]), '');
    return 'EXACT_GIT_OBJECTS';
  }
  assert.equal(process.env.MCFT_CAP_06_ALLOW_ARCHIVE_BASELINE_PROOF, '1', 'S5_ENTRY_EXACT_HISTORICAL_GIT_OBJECTS_REQUIRED');
  assert.equal(process.env.MCFT_CAP_06_ARCHIVE_BASELINE_MAIN_COMMIT, EFFECTIVENESS_MERGE, 'S5_ENTRY_ARCHIVE_BASELINE_COMMIT_MISMATCH');
  const localBaseline = String(process.env.MCFT_CAP_06_S5_GRAPH_BASELINE_REF || '').trim();
  assert.ok(localBaseline, 'S5_ENTRY_ARCHIVE_LOCAL_BASELINE_REF_REQUIRED');
  git(['cat-file', '-e', `${localBaseline}^{commit}`]);
  assert.match(git(['log', '-1', '--format=%B', localBaseline]), new RegExp(EFFECTIVENESS_MERGE));
  return 'DECLARED_EXACT_ARCHIVE_BASELINE';
}

function main() {
  const historicalGitProofMode = verifyHistoricalGitProof();

  const effectiveness = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S5-ENTRY-EFFECTIVENESS.json');
  const delivery = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-DELIVERY-STATE.json');
  const slices = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-DELIVERY-SLICE-STATUS.json');
  const reconciliation = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-STATE-RECONCILIATION.json');
  const debt = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CAP05-STRUCTURAL-DEBT-REGISTER.json');
  const graph = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S5-ENTRY-AUTHORITY-GRAPH.json');
  const contract = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S5-ENTRY-PREREQUISITE.json');

  assert.equal(effectiveness.schema_version, 'geox_mcft_cap_06_s5_entry_effectiveness_v1');
  assert.equal(effectiveness.delivery_slice_id, ENTRY);
  assert.equal(effectiveness.status, 'MERGED_EFFECTIVE');
  assert.equal(effectiveness.effective, true);
  assert.equal(effectiveness.implementation_pr_number, 2539);
  assert.equal(effectiveness.implementation_exact_head, 'ebadebdfd8f0189a0f7776316287a7d7dad0b15e');
  assert.equal(effectiveness.implementation_preflight_run, 29562643937);
  assert.equal(effectiveness.implementation_standard_ci_run, 29562643856);
  assert.equal(effectiveness.implementation_merge_commit, IMPLEMENTATION_MERGE);
  assert.equal(effectiveness.head_to_merge_file_delta_count, 0);
  assert.equal(effectiveness.head_to_merge_tree_equivalence, 'PASS');
  assert.equal(effectiveness.postmerge_probe_pr_number, 2540);
  assert.equal(effectiveness.postmerge_probe_closed_without_merge, true);
  assert.equal(effectiveness.postmerge_workflow_run, 29563740347);
  assert.equal(effectiveness.postmerge_gate, 'PASS');
  assert.equal(effectiveness.preflight.protected_predecessor_path_delta_count, 0);
  assert.equal(effectiveness.preflight.logical_commit_count, 3);
  assert.equal(effectiveness.runtime_delta_boundary.production_candidate_append_count, 0);
  assert.equal(effectiveness.runtime_delta_boundary.production_evaluation_append_count, 0);
  assert.equal(effectiveness.runtime_delta_boundary.model_activation_count, 0);
  assert.equal(effectiveness.runtime_delta_boundary.active_config_switch_count, 0);
  assert.equal(effectiveness.runtime_delta_boundary.state_mutation_count, 0);
  assert.equal(effectiveness.runtime_delta_boundary.checkpoint_mutation_count, 0);

  assert.equal(graph.status, 'FROZEN');
  assert.equal(graph.resolution_policy.mode, 'EXACT_REF_HASH_ONLY');
  assert.equal(graph.repository_authority.alternative_s5_or_s6_graph_authority_allowed, false);
  assert.equal(contract.s5_authorized, false);
  assert.equal(contract.canonical_write_authorized, false);

  assert.equal(delivery.s5_entry.delivery_slice_id, ENTRY);
  assert.equal(delivery.s5_entry.effective, true);
  assert.equal(delivery.s5_entry.merge_commit, IMPLEMENTATION_MERGE);
  assert.equal(delivery.s5.model_activation_authorized, false);
  assert.equal(delivery.s5.active_config_switch_authorized, false);
  assert.equal(slices.s5_entry_effective, true);
  assert.equal(reconciliation.current_state.s5_entry_effective, true);
  assert.equal(reconciliation.proof.s5_entry_effectiveness.postmerge_workflow_run, 29563740347);

  const graphPrerequisite = delivery.s5_predecessor_graph_conformance;
  if (graphPrerequisite && graphPrerequisite.effective !== true) {
    assert.equal(graphPrerequisite.delivery_slice_id, S5_GRAPH);
    assert.equal(delivery.active_delivery_slice_id, S5_GRAPH);
    assert.deepEqual(delivery.candidate_slices, [S5_GRAPH]);
    assert.equal(delivery.blocked_slices.includes(S5), true);
    assert.equal(delivery.s5.authorized, false);
    assert.equal(delivery.s5.implementation_started, false);
    assert.equal(delivery.s5.candidate_implemented, false);
    assert.equal(slices.active_delivery_slice_id, S5_GRAPH);
    assert.equal(slices.s5_authorized, false);
    assert.equal(reconciliation.current_state.active_delivery_slice_id, S5_GRAPH);
    assert.equal(reconciliation.current_state.s5_authorized, false);
  } else if (delivery.s5.effective === true) {
    assert.equal(delivery.active_delivery_slice_id, S6);
    assert.deepEqual(delivery.authorized_not_started_slices, [S6]);
    assert.equal(delivery.blocked_slices.includes(S6), false);
    assert.equal(delivery.blocked_slices.includes(S7), true);
    assert.equal(delivery.s5.authorized, true);
    assert.equal(delivery.s5.implementation_started, true);
    assert.equal(delivery.s5.candidate_implemented, true);
    assert.equal(delivery.s6.authorized, true);
    assert.equal(delivery.s6.implementation_started, false);
    assert.equal(delivery.s6.candidate_implemented, false);
    assert.equal(delivery.s6.canonical_write_authorized, false);
    assert.equal(delivery.s6.projection_write_authorized, false);
    assert.equal(delivery.s6.shadow_evaluation_append_authorized, false);
    assert.equal(slices.active_delivery_slice_id, S6);
    assert.equal(slices.s5_effective, true);
    assert.equal(slices.s6_authorized, true);
    assert.equal(slices.s6_implementation_started, false);
    assert.equal(reconciliation.current_state.active_delivery_slice_id, S6);
    assert.equal(reconciliation.current_state.s5_effective, true);
    assert.equal(reconciliation.current_state.s6_authorized, true);
    assert.equal(reconciliation.current_state.s6_implementation_started, false);
  } else {
    assert.equal(delivery.active_delivery_slice_id, S5);
    assert.deepEqual(delivery.authorized_not_started_slices, [S5]);
    assert.equal(delivery.blocked_slices.includes(S5), false);
    assert.equal(delivery.s5.authorized, true);
    assert.equal(delivery.s5.implementation_started, false);
    assert.equal(delivery.s5.candidate_implemented, false);
    assert.equal(slices.active_delivery_slice_id, S5);
    assert.equal(slices.s5_authorized, true);
    assert.equal(reconciliation.current_state.active_delivery_slice_id, S5);
    assert.equal(reconciliation.current_state.s5_authorized, true);
  }

  assert.equal(debt.status, 'S4_EFFECTIVE_TREATMENTS_S5_ENTRY_EFFECTIVE_S5_AUTHORIZED');
  assert.equal(debt.s5_entry_effective, true);
  assert.equal(debt.s5_authorized, true);

  const result = {
    schema_version: 'geox_mcft_cap_06_s5_entry_effectiveness_result_v1',
    status: 'PASS',
    exact_head: git(['rev-parse', 'HEAD']),
    implementation_merge_commit: IMPLEMENTATION_MERGE,
    effectiveness_merge_commit: EFFECTIVENESS_MERGE,
    historical_git_proof_mode: historicalGitProofMode,
    s5_entry_effective: true,
    s5_graph_prerequisite_active: Boolean(graphPrerequisite && graphPrerequisite.effective !== true),
    s5_authorized: delivery.s5.authorized,
    s5_implementation_started: delivery.s5.implementation_started,
    s5_effective: delivery.s5.effective === true,
    s6_authorized: delivery.s6?.authorized === true,
    s6_implementation_started: delivery.s6?.implementation_started === true,
    canonical_write_count: 0,
    production_candidate_append_count: 0,
    production_evaluation_append_count: 0,
    model_activation_count: 0,
    active_config_switch_count: 0,
    state_mutation_count: 0,
    checkpoint_mutation_count: 0
  };
  write(result);
  console.log(JSON.stringify(result));
}

try {
  main();
} catch (error) {
  const result = {
    schema_version: 'geox_mcft_cap_06_s5_entry_effectiveness_result_v1',
    status: 'FAIL',
    error: error instanceof Error ? error.message : String(error),
    canonical_write_count: 0,
    s5_implementation_started: false,
    s5_effective: false,
    s6_authorized: false
  };
  write(result);
  console.error(JSON.stringify(result));
  process.exitCode = 1;
}
