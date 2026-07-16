// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S3_EFFECTIVENESS_S4_INSERTION.cjs
// Purpose: prove immutable MCFT-CAP-06 S3 merged-main effectiveness and the bounded insertion of CAP-05 predecessor-consumption stabilization before S5.
// Boundary: static governance validation only; no database access, canonical append, projection mutation, calibration math, Runtime authority, State, checkpoint, route, Web, scheduler, Model Activation, or CAP-07 authority.

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const S3 = 'MCFT-CAP-06.MCFT-03-12.D-GOVERNANCE-PERSISTENCE-RECOVERY-V1';
const S4 = 'MCFT-CAP-06.MCFT-02-03-04-05-09-11.PREDECESSOR-CONSUMPTION-STABILIZATION-V1';
const S5 = 'MCFT-CAP-06.MCFT-06-09-11-12.CALIBRATION-CANDIDATE-COMPUTE-COMMIT-V1';

function read(relative) {
  return fs.readFileSync(path.join(ROOT, relative), 'utf8');
}

function json(relative) {
  return JSON.parse(read(relative));
}

function main() {
  const effectiveness = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S3-EFFECTIVENESS.json');
  const s3Status = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S3-STATUS.json');
  const delivery = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-DELIVERY-STATE.json');
  const legacyDelivery = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-DELIVERY-SLICE-STATUS.json');
  const reconciliation = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-STATE-RECONCILIATION.json');
  const debt = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CAP05-STRUCTURAL-DEBT-REGISTER.json');
  const amendment = read('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-TASK-AMENDMENT-CAP05-STRUCTURAL-DEBT-V1.md');
  const s4Contract = read('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S4-PREDECESSOR-CONSUMPTION-STABILIZATION.md');

  assert.equal(effectiveness.delivery_slice_id, S3);
  assert.equal(effectiveness.status, 'MERGED_EFFECTIVE');
  assert.equal(effectiveness.effective, true);
  assert.equal(effectiveness.implementation_pr_number, 2528);
  assert.equal(effectiveness.implementation_exact_head, '0bce4978239094e8eadf6cdd63fbfacf7779bbb6');
  assert.equal(effectiveness.implementation_focused_validation_run, 29520242013);
  assert.equal(effectiveness.implementation_standard_ci_run, 29520241249);
  assert.equal(effectiveness.implementation_merge_commit, '36efb93963222b2768b8d2bf384f748c86ce525a');
  assert.equal(effectiveness.head_to_merge_file_delta_count, 0);
  assert.equal(effectiveness.head_to_merge_tree_equivalence, 'PASS');
  assert.equal(effectiveness.postmerge_probe_pr_number, 2532);
  assert.equal(effectiveness.postmerge_probe_closed_without_merge, true);
  assert.equal(effectiveness.postmerge_workflow_run, 29520979042);
  assert.equal(effectiveness.postmerge_gate, 'PASS');
  assert.equal(effectiveness.additive_migration_count, 1);
  assert.equal(effectiveness.candidate_persistence_acceptance_checks, 12);
  assert.equal(effectiveness.projection_canonicality_acceptance_checks, 5);
  assert.equal(effectiveness.production_candidate_append_count, 0);
  assert.equal(effectiveness.production_evaluation_append_count, 0);
  assert.equal(effectiveness.model_activation_count, 0);
  assert.equal(effectiveness.active_config_switch_count, 0);
  assert.equal(effectiveness.state_mutation_count, 0);
  assert.equal(effectiveness.checkpoint_mutation_count, 0);
  assert.equal(effectiveness.s4_authorized, true);
  assert.equal(effectiveness.s4_implementation_started, false);
  assert.equal(effectiveness.s5_authorized, false);
  assert.equal(effectiveness.active_delivery_slice_id, S4);

  assert.equal(s3Status.delivery_slice_id, S3);
  assert.equal(s3Status.status, 'MERGED_EFFECTIVE');
  assert.equal(s3Status.s3_effective, true);
  assert.equal(s3Status.s4_authorized, true);
  assert.equal(s3Status.s5_authorized, false);
  assert.equal(s3Status.effectiveness_evidence.postmerge_workflow_run, 29520979042);

  assert.equal(debt.insertion_point.after_slice, S3);
  assert.equal(debt.insertion_point.before_slice, S5);
  assert.equal(debt.insertion_point.authorized_remediation_slice, S4);
  assert.equal(debt.paid_hard_debt[0].debt_id, 'CAP05-HARD-01');
  assert.equal(debt.paid_hard_debt[0].status, 'PAID_POST_CLOSURE');
  assert.equal(debt.paid_hard_debt[0].confirmed_failure_code, 'CAP04_CONFIG_PURPOSE_MISMATCH');
  assert.deepEqual(
    debt.open_structural_debt.map((item) => item.debt_id),
    ['CAP05-STRUCT-01', 'CAP05-STRUCT-02', 'CAP05-STRUCT-03', 'CAP05-PROCESS-01'],
  );
  assert.equal(debt.s5_authorized, false);
  assert.equal(debt.explicit_non_debt.includes('NO_MODEL_ACTIVATION_OR_CALIBRATION_WAS_OWED_BY_CAP05'), true);

  assert.match(amendment, /superseded_order:\nS3 -> S5/);
  assert.match(amendment, /amended_order:\nS3 -> S4 PREDECESSOR CONSUMPTION STABILIZATION -> S5/);
  assert.match(amendment, new RegExp(S4.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(amendment, /does not reopen CAP-05 closure/i);
  assert.match(amendment, /NO_MODEL_ACTIVATION/);

  assert.match(s4Contract, /Positive CAP-04 execution projection/);
  assert.match(s4Contract, /Reusable non-canonical graph assembler/);
  assert.match(s4Contract, /CAP-05 effective runtime baseline aggregate pointer/);
  assert.match(s4Contract, /Acceptance topology hardening/);
  assert.match(s4Contract, /S5 and S6 are forbidden from implementing an alternative graph traversal authority/);
  assert.match(s4Contract, /NO_MODEL_ACTIVATION/);
  assert.match(s4Contract, /NO_MCFT_CAP_07_AUTHORIZATION/);

  assert.equal(legacyDelivery.s3_effective, true);
  assert.equal(legacyDelivery.s4_inserted_by_task_amendment, true);
  assert.equal(legacyDelivery.s4_authorized, true);
  assert.equal(legacyDelivery.s4_effective, false);
  assert.equal(legacyDelivery.active_delivery_slice_id, S4);
  assert.deepEqual(legacyDelivery.authorized_not_started_slices, [S4]);
  assert.equal(legacyDelivery.blocked_slices.includes(S5), true);

  assert.equal(reconciliation.current_state.s3, 'MERGED_EFFECTIVE');
  assert.equal(reconciliation.current_state.s3_effective, true);
  assert.equal(reconciliation.current_state.s4, 'AUTHORIZED_NOT_STARTED');
  assert.equal(reconciliation.current_state.s4_authorized, true);
  assert.equal(reconciliation.current_state.s5_authorized, false);
  assert.equal(reconciliation.current_state.active_delivery_slice_id, S4);

  // Current delivery state is intentionally mutable. The gate remains valid after S4 advances,
  // provided S5 never becomes authorized before S4 effectiveness.
  assert.equal(delivery.s3.effective, true);
  assert.equal(delivery.s4.authorized, true);
  if (delivery.s4.effective !== true) {
    assert.equal(delivery.active_delivery_slice_id, S4);
    assert.deepEqual(delivery.authorized_not_started_slices, [S4]);
    assert.equal(delivery.blocked_slices.includes(S5), true);
  }

  const forbiddenWritebackFiles = [
    'apps/server/src/',
    'apps/server/db/migrations/',
    'apps/web/',
  ];
  for (const prefix of forbiddenWritebackFiles) {
    assert.equal(effectiveness.effectiveness_writeback_scope === 'GOVERNANCE_ONLY', true, `WRITEBACK_SCOPE_REQUIRED:${prefix}`);
  }

  console.log('PASS MCFT-CAP-06 S3 effectiveness and CAP-05 debt-stabilization S4 insertion gate');
}

main();
