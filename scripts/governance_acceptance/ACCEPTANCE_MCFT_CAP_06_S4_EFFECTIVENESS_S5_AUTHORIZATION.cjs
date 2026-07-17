// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S4_EFFECTIVENESS_S5_AUTHORIZATION.cjs
// Purpose: prove immutable S4 merged-main effectiveness and authorize S5 as the sole active not-started Slice without implementing S5 or weakening any nonactivation boundary.
// Boundary: static governance validation only; no database access, canonical append, calibration/shadow compute, Runtime authority, State/checkpoint mutation, route, Web, scheduler, Model Activation, or CAP-07 authority.

'use strict';

const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const BASELINE = 'd2a71aaa5a80a708476d1abaceeef266fe955659';
const S4 = 'MCFT-CAP-06.MCFT-02-03-04-05-09-11.PREDECESSOR-CONSUMPTION-STABILIZATION-V1';
const S5 = 'MCFT-CAP-06.MCFT-06-09-11-12.CALIBRATION-CANDIDATE-COMPUTE-COMMIT-V1';
const S6 = 'MCFT-CAP-06.MCFT-06-09-11-12.PAIRED-HISTORICAL-SHADOW-COMPUTE-V1';
const EXPECTED_WRITEBACK_FILES = [
  '.github/workflows/mcft-cap-06-s4-effectiveness-s5-authorization.yml',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CAP05-STRUCTURAL-DEBT-REGISTER.json',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-DELIVERY-STATE.json',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-STATE-RECONCILIATION.json',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-DELIVERY-SLICE-STATUS.json',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S4-EFFECTIVENESS.json',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S4-STATUS.json',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S4_EFFECTIVENESS_S5_AUTHORIZATION.cjs',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S4_STABILIZATION.cjs',
];
const GOVERNANCE_PAYLOAD_FILES = EXPECTED_WRITEBACK_FILES.filter(
  (file) => file.startsWith('docs/digital_twin/'),
);

function read(relative) {
  return fs.readFileSync(path.join(ROOT, relative), 'utf8');
}

function json(relative) {
  return JSON.parse(read(relative));
}

function git(args) {
  return cp.execFileSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function changedFiles() {
  git(['cat-file', '-e', `${BASELINE}^{commit}`]);
  const output = git(['diff', '--name-only', `${BASELINE}...HEAD`]);
  return output ? output.split(/\r?\n/).filter(Boolean).sort() : [];
}

function main() {
  const changed = changedFiles();
  assert.deepEqual(changed, [...EXPECTED_WRITEBACK_FILES].sort());
  assert.equal(changed.some((file) => file.startsWith('apps/server/src/')), false);
  assert.equal(changed.some((file) => file.startsWith('apps/server/db/migrations/')), false);
  assert.equal(changed.some((file) => file.startsWith('apps/web/')), false);
  assert.equal(changed.some((file) => /routes?|controller|openapi/i.test(file)), false);
  assert.equal(changed.some((file) => file.startsWith('scripts/runtime_acceptance/')), false);

  const effectiveness = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S4-EFFECTIVENESS.json');
  const status = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S4-STATUS.json');
  const delivery = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-DELIVERY-STATE.json');
  const reconciliation = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-STATE-RECONCILIATION.json');
  const legacyDelivery = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-DELIVERY-SLICE-STATUS.json');
  const debt = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CAP05-STRUCTURAL-DEBT-REGISTER.json');

  assert.equal(effectiveness.delivery_slice_id, S4);
  assert.equal(effectiveness.status, 'MERGED_EFFECTIVE');
  assert.equal(effectiveness.effective, true);
  assert.equal(effectiveness.implementation_pr_number, 2536);
  assert.equal(effectiveness.implementation_exact_head, '3df36f40b94993941ba8845adcf66b7e189d4bc9');
  assert.equal(effectiveness.implementation_focused_validation_run, 29557910269);
  assert.equal(effectiveness.implementation_s3_regression_run, 29557910311);
  assert.equal(effectiveness.implementation_s3_s4_compatibility_run, 29557910272);
  assert.equal(effectiveness.implementation_standard_ci_run, 29557910267);
  assert.equal(effectiveness.implementation_merge_commit, BASELINE);
  assert.equal(effectiveness.head_to_merge_file_delta_count, 0);
  assert.equal(effectiveness.head_to_merge_tree_equivalence, 'PASS');
  assert.equal(effectiveness.postmerge_probe_pr_number, 2537);
  assert.equal(effectiveness.postmerge_probe_closed_without_merge, true);
  assert.equal(effectiveness.postmerge_workflow_run, 29558471514);
  assert.equal(effectiveness.postmerge_gate, 'PASS');
  assert.equal(effectiveness.s5_authorized, true);
  assert.equal(effectiveness.s5_implementation_started, false);
  assert.equal(effectiveness.active_delivery_slice_id, S5);
  assert.deepEqual(effectiveness.authorized_not_started_slice_ids, [S5]);
  assert.equal(effectiveness.successor_capability_line_authorized, false);
  assert.equal(effectiveness.effectiveness_writeback_scope, 'GOVERNANCE_ONLY');

  for (const key of [
    'positive_cap04_execution_projection',
    'resolved_forecast_observation_case_read_model',
    'exact_ref_postgresql_graph_assembler',
    'source_forecast_and_residual_runtime_config_authorities_resolved_separately',
    'observation_reconstructed_from_canonical_evidence_window',
    'single_repeatable_read_snapshot_batch_resolution',
    'cap05_effective_runtime_baseline_aggregate',
    'four_layer_acceptance_topology',
    'exact_s2_nonwriting_compatibility',
  ]) assert.equal(effectiveness.implementation[key], true, `S4_EFFECTIVENESS_IMPLEMENTATION_MISSING:${key}`);
  assert.equal(effectiveness.implementation.new_canonical_type_count, 0);
  assert.equal(effectiveness.implementation.migration_count, 0);
  assert.equal(effectiveness.runtime_delta_boundary.production_candidate_append_count, 0);
  assert.equal(effectiveness.runtime_delta_boundary.production_evaluation_append_count, 0);
  assert.equal(effectiveness.runtime_delta_boundary.model_activation_count, 0);
  assert.equal(effectiveness.runtime_delta_boundary.active_config_switch_count, 0);
  assert.equal(effectiveness.runtime_delta_boundary.runtime_parameter_change_count, 0);
  assert.equal(effectiveness.runtime_delta_boundary.state_mutation_count, 0);
  assert.equal(effectiveness.runtime_delta_boundary.checkpoint_mutation_count, 0);

  assert.equal(status.status, 'MERGED_EFFECTIVE');
  assert.equal(status.s4_effective, true);
  assert.equal(status.s5_authorized, true);
  assert.equal(status.s5_implementation_started, false);
  assert.equal(status.effectiveness_evidence.merge_commit, BASELINE);
  assert.equal(status.effectiveness_evidence.postmerge_workflow_run, 29558471514);

  assert.equal(delivery.record_kind, 'MUTABLE_DELIVERY_FRONTIER');
  assert.equal(delivery.baseline_effectiveness_ref, 'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S4-EFFECTIVENESS.json');
  assert.equal(delivery.status, 'S4_MERGED_EFFECTIVE_S5_AUTHORIZED_NOT_STARTED');
  assert.equal(delivery.active_delivery_slice_id, S5);
  assert.deepEqual(delivery.candidate_slices, []);
  assert.deepEqual(delivery.authorized_not_started_slices, [S5]);
  assert.equal(delivery.blocked_slices.includes(S5), false);
  assert.equal(delivery.blocked_slices.includes(S6), true);
  assert.equal(delivery.s4.effective, true);
  assert.equal(delivery.s5.authorized, true);
  assert.equal(delivery.s5.implementation_started, false);
  assert.equal(delivery.s5.candidate_implemented, false);
  assert.equal(delivery.s5.effective, false);
  assert.equal(delivery.s5.s2_engine_reuse_required, true);
  assert.equal(delivery.s5.s4_graph_assembler_reuse_required, true);

  assert.equal(reconciliation.delivery_frontier_status, 'S4_MERGED_EFFECTIVE_S5_AUTHORIZED_NOT_STARTED');
  assert.equal(reconciliation.current_state.s4, 'MERGED_EFFECTIVE');
  assert.equal(reconciliation.current_state.s4_effective, true);
  assert.equal(reconciliation.current_state.s5_authorized, true);
  assert.equal(reconciliation.current_state.s5_implementation_started, false);
  assert.equal(reconciliation.current_state.active_delivery_slice_id, S5);
  assert.equal(reconciliation.proof.s4_effectiveness.implementation_merge_commit, BASELINE);
  assert.equal(reconciliation.proof.s4_effectiveness.postmerge_workflow_run, 29558471514);

  assert.equal(legacyDelivery.implementation_status, 'S4_MERGED_EFFECTIVE_S5_AUTHORIZED_NOT_STARTED');
  assert.equal(legacyDelivery.active_delivery_slice_id, S5);
  assert.deepEqual(legacyDelivery.authorized_not_started_slices, [S5]);
  assert.equal(legacyDelivery.blocked_slices.includes(S5), false);
  assert.equal(legacyDelivery.completed_or_effective_slices.some(
    (slice) => slice.delivery_slice_id === S4
      && slice.status === 'MERGED_EFFECTIVE'
      && slice.merge_commit === BASELINE
      && slice.postmerge_workflow_run === 29558471514,
  ), true);
  assert.equal(legacyDelivery.s4_effective, true);
  assert.equal(legacyDelivery.s5_authorized, true);
  assert.equal(legacyDelivery.s5_implementation_started, false);

  assert.equal(debt.status, 'S4_EFFECTIVE_TREATMENTS_S5_AUTHORIZED');
  assert.deepEqual(
    debt.open_structural_debt.map((item) => item.status),
    Array(4).fill('EFFECTIVE_TREATED'),
  );
  assert.equal(debt.effectiveness_evidence.implementation_merge_commit, BASELINE);
  assert.equal(debt.effectiveness_evidence.postmerge_workflow_run, 29558471514);
  assert.equal(debt.exit_condition, 'SATISFIED_BY_S4_MERGED_MAIN_PROOF_AND_EFFECTIVENESS_WRITEBACK');
  assert.equal(debt.s4_effective, true);
  assert.equal(debt.s5_authorized, true);

  const combined = [
    effectiveness,
    status,
    delivery,
    reconciliation,
    legacyDelivery,
  ].flatMap((value) => value.preserved_nonclaims ?? []);
  for (const token of [
    'NO_MODEL_ACTIVATION',
    'NO_ACTIVE_CONFIG_SWITCH',
    'NO_RUNTIME_PARAMETER_CHANGE',
    'NO_MCFT_CAP_07_AUTHORIZATION',
  ]) assert.equal(combined.includes(token), true, `WRITEBACK_NONCLAIM_MISSING:${token}`);
  assert.equal(combined.some((token) => token.includes('NO_S5_IMPLEMENTATION')), true);

  const governancePayloadSource = GOVERNANCE_PAYLOAD_FILES.map(read).join('\n');
  assert.equal(/INSERT\s+INTO\s+facts/i.test(governancePayloadSource), false);
  assert.equal(/twin_model_activation_v1/.test(governancePayloadSource), false);
  assert.equal(/active_config_switch_performed\s*:\s*true/.test(governancePayloadSource), false);
  assert.equal(/model_parameter_change_applied\s*:\s*true/.test(governancePayloadSource), false);

  console.log(`PASS MCFT-CAP-06 S4 effectiveness and S5 authorization gate; changed_files=${changed.length}`);
}

main();
