// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_AUTHORIZATION.cjs
// Purpose: fail closed on immutable MCFT-CAP-06 S0 merged-main effectiveness, predecessor lock and structural qualification evidence.
// Boundary: governance validation only; downstream active-Slice state is validated by the current Slice Gate; no Runtime, persistence, route, scheduler, Residual, Candidate, Evaluation, or activation write.

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '../..');
const S0 = 'MCFT-CAP-06.GOV-AUTHORIZATION-PREDECESSOR-AND-DATASET-QUALIFICATION-V1';
const S1 = 'MCFT-CAP-06.MCFT-01-03-11.CANONICAL-RESIDUAL-WINDOWS-V1';
const EXACT_HEAD = '375adfa3ba85082c1742b30314951df61b3a1936';
const EXACT_CI = 29471606766;
const MERGE = '4c93ec59a6ac0b53b43584cbef1a7e0295d6b58a';
const PROBE_PR = 2511;
const PROBE_RUN = 29472057972;

function readJson(relativePath) { return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8')); }

function main() {
  const postmerge = process.argv.includes('--postmerge');
  const authorization = readJson('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-AUTHORIZATION-STATUS.json');
  const effectiveness = readJson('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S0-EFFECTIVENESS.json');
  const lock = readJson('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-PREDECESSOR-LOCK.json');
  const qualification = readJson('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-DATASET-QUALIFICATION.json');
  const delivery = readJson('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-DELIVERY-SLICE-STATUS.json');
  const current = readJson('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-STATE-RECONCILIATION.json');
  const matrix = readJson('docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json');

  assert.equal(effectiveness.status, 'MERGED_EFFECTIVE');
  assert.equal(effectiveness.effective, true);
  assert.equal(effectiveness.implementation_exact_head, EXACT_HEAD);
  assert.equal(effectiveness.implementation_exact_head_ci_run, EXACT_CI);
  assert.equal(effectiveness.implementation_merge_commit, MERGE);
  assert.equal(effectiveness.head_to_merge_file_delta_count, 0);
  assert.equal(effectiveness.head_to_merge_tree_equivalence, 'PASS');
  assert.equal(effectiveness.postmerge_probe_pr_number, PROBE_PR);
  assert.equal(effectiveness.postmerge_workflow_run, PROBE_RUN);
  assert.equal(effectiveness.postmerge_gate, 'PASS');

  assert.equal(authorization.delivery_slice_id, S0);
  assert.equal(authorization.status, 'MERGED_EFFECTIVE');
  assert.equal(authorization.authorization_effective, true);
  assert.equal(authorization.runtime_source_authorized, true);
  assert.equal(authorization.migration_authorized, false);
  assert.equal(authorization.canonical_write_authorized, false);
  assert.equal(authorization.active_delivery_slice_id, S1);
  assert.deepEqual(authorization.current_authorized_slice_ids, [S1]);

  assert.equal(lock.status, 'MERGED_EFFECTIVE');
  assert.equal(lock.lock_effective, true);
  assert.equal(lock.canonical_identity.checkpoint_sequence, 80);
  assert.equal(lock.canonical_identity.reproduced_state_fact_count, 33);
  assert.equal(qualification.status, 'MERGED_EFFECTIVE');
  assert.equal(qualification.qualification_effective, true);
  assert.equal(qualification.dataset_qualification_status, 'INSUFFICIENT_MATCHED_PAIRS');
  assert.equal(qualification.case_graph_validation_status, 'PASS');
  assert.equal(qualification.availability_order_validation_status, 'PASS');
  assert.equal(qualification.homogeneity_validation_status, 'PASS');

  assert.equal(delivery.s0_effective, true);
  const completedS0 = delivery.completed_or_effective_slices.find((item) => item.delivery_slice_id === S0);
  assert.ok(completedS0, 'S0_COMPLETED_SLICE_RECORD_REQUIRED');
  assert.equal(completedS0.status, 'MERGED_EFFECTIVE');
  assert.equal(completedS0.exact_head, EXACT_HEAD);
  assert.equal(completedS0.exact_head_ci_run, EXACT_CI);
  assert.equal(completedS0.merge_commit, MERGE);
  assert.equal(completedS0.head_to_merge_file_delta_count, 0);
  assert.equal(completedS0.head_to_merge_tree_equivalence, 'PASS');
  assert.equal(completedS0.postmerge_probe_pr_number, PROBE_PR);
  assert.equal(completedS0.postmerge_workflow_run, PROBE_RUN);
  assert.equal(completedS0.postmerge_gate, 'PASS');
  assert.equal(delivery.blocked_slices.includes(S0), false);

  assert.equal(current.current_state.s0, 'MERGED_EFFECTIVE');
  const lines = Array.isArray(matrix.capability_lines) ? matrix.capability_lines : matrix.capabilities;
  assert.ok(lines.find((item) => item.capability_line_id === 'MCFT-CAP-06'));

  console.log('PASS MCFT-CAP-06 immutable S0 merged-main effectiveness evidence');
  console.log('PASS repository history remains INSUFFICIENT_MATCHED_PAIRS with structural validation PASS');
  console.log('PASS S0 predecessor lock and first-successor authorization record remain exact');
  console.log('PASS downstream active-Slice state is delegated to the current Slice governance Gate');
  console.log(postmerge ? 'PASS effective merged-main S0 evidence boundary' : 'PASS immutable S0 evidence conformance');
}

main();
