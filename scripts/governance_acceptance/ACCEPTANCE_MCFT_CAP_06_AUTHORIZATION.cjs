// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_AUTHORIZATION.cjs
// Purpose: fail closed on the MCFT-CAP-06 S0 v2 candidate and merged-main effectiveness prerequisites.
// Boundary: governance/readback validation only; no Runtime, persistence, route, scheduler, Candidate, Evaluation, or activation write.

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const BASELINE_MAIN = 'ca819ba51bdf3017dbefa96015f76bd3b66a647c';
const S0 = 'MCFT-CAP-06.GOV-AUTHORIZATION-PREDECESSOR-AND-DATASET-QUALIFICATION-V1';
const S1 = 'MCFT-CAP-06.MCFT-01-03-11.CANONICAL-RESIDUAL-WINDOWS-V1';
const EXACT_CHANGED_FILES = Object.freeze([
  "docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md",
  "docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json",
  "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-AUTHORIZATION-STATUS.json",
  "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-AUTHORIZATION.md",
  "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-DATASET-QUALIFICATION.json",
  "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-DELIVERY-SLICE-STATUS.json",
  "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-PREDECESSOR-LOCK.json",
  "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-TASK.md",
  "scripts/acceptance/run_acceptance.cjs",
  "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_AUTHORIZATION.cjs",
  "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S0_V2_EXACT_QUALIFICATION.ts",
  "scripts/runtime_acceptance/RUN_MCFT_CAP_06_S0_V2_HONEST_QUALIFICATION.cjs"
]);

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function readText(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function main() {
  const postmerge = process.argv.includes('--postmerge');
  const authorization = readJson('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-AUTHORIZATION-STATUS.json');
  const lock = readJson('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-PREDECESSOR-LOCK.json');
  const qualification = readJson('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-DATASET-QUALIFICATION.json');
  const delivery = readJson('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-DELIVERY-SLICE-STATUS.json');
  const matrix = readJson('docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json');
  const task = readText('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-TASK.md');
  const map = readText('docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md');

  assert.equal(authorization.capability_line_id, 'MCFT-CAP-06');
  assert.equal(authorization.delivery_slice_id, S0);
  assert.equal(authorization.baseline_main_commit, BASELINE_MAIN);
  assert.equal(authorization.status, 'S0_CANDIDATE_PENDING_MERGED_MAIN_EFFECTIVENESS');
  assert.equal(authorization.authorization_effective, false);
  assert.equal(authorization.runtime_source_authorized, false);
  assert.equal(authorization.active_delivery_slice_id, null);
  assert.deepEqual([...authorization.exact_changed_file_boundary].sort(), [...EXACT_CHANGED_FILES].sort());

  assert.equal(lock.canonical_identity.checkpoint_sequence, 80);
  assert.equal(lock.canonical_identity.reproduced_state_fact_count, 33);
  assert.equal(lock.canonical_identity.config_authority_mode, 'EXPLICIT_REPLAY_PIN');
  assert.equal(lock.canonical_identity.active_binding_status, 'NOT_ESTABLISHED');
  assert.equal(lock.canonical_identity.active_binding_ref, null);
  assert.equal(lock.canonical_identity.active_binding_hash, null);

  assert.equal(qualification.dataset_qualification_status, 'INSUFFICIENT_MATCHED_PAIRS');
  assert.equal(qualification.canonical_residual_count, 1);
  assert.equal(qualification.eligible_residual_count, 1);
  assert.equal(qualification.excluded_case_count, 0);
  assert.equal(qualification.invalid_graph_case_count, 0);
  assert.equal(qualification.availability_invalid_case_count, 0);
  assert.equal(qualification.case_graph_validation_status, 'PASS');
  assert.equal(qualification.availability_order_validation_status, 'PASS');
  assert.equal(qualification.homogeneity_validation_status, 'PASS');
  assert.equal(qualification.qualification_effective, false);

  assert.equal(delivery.runtime_source_authorized, false);
  assert.equal(delivery.authorization_effective, false);
  assert.equal(delivery.active_delivery_slice_id, null);
  assert.equal(delivery.s0_candidate_materialized, true);
  assert.equal(delivery.s0_effective, false);
  assert.equal(delivery.candidate_slices.length, 1);
  assert.equal(delivery.candidate_slices[0].delivery_slice_id, S0);
  assert.equal(delivery.candidate_slices[0].next_authorized_slice_after_effectiveness, S1);

  const lines = Array.isArray(matrix.capability_lines) ? matrix.capability_lines : matrix.capabilities;
  const line = lines.find((item) => item.capability_line_id === 'MCFT-CAP-06');
  assert.ok(line);
  assert.equal(line.authorization_effective, false);
  assert.equal(line.runtime_source_authorized, false);
  assert.equal(line.active_delivery_slice_id, null);
  assert.equal(line.dataset_qualification_status, 'INSUFFICIENT_MATCHED_PAIRS');
  assert.equal(line.candidate_runtime_implemented, false);
  assert.equal(line.shadow_evaluation_runtime_implemented, false);
  assert.equal(line.capability_complete, false);

  assert.ok(task.includes('S0_CANDIDATE_PENDING_MERGED_MAIN_EFFECTIVENESS'));
  assert.ok(task.includes('exact S0 v2 reproduced State fact count:\n33'));
  assert.ok(map.includes('MCFT-CAP-06 S0 v2 Candidate'));

  for (const forbidden of [
    'twin_model_activation_v1 write implementation',
    'active_delivery_slice_id: MCFT-CAP-06.MCFT-01-03-11.CANONICAL-RESIDUAL-WINDOWS-V1',
  ]) {
    assert.equal(readText('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-AUTHORIZATION.md').includes(forbidden), false, 'FORBIDDEN_PRE_EFFECTIVENESS_CLAIM:' + forbidden);
  }

  console.log('PASS MCFT-CAP-06 S0 v2 governance candidate');
  console.log('PASS repository history classification = INSUFFICIENT_MATCHED_PAIRS');
  console.log('PASS graph/availability/homogeneity validation');
  console.log('PASS Runtime/canonical-write/activation authority remains false');
  console.log(postmerge
    ? 'PASS merged-main candidate is eligible for separate effectiveness activation writeback'
    : 'PASS premerge candidate boundary');
}

main();
