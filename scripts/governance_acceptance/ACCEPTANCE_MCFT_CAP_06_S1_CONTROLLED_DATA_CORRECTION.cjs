// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S1_CONTROLLED_DATA_CORRECTION.cjs
// Purpose: fail closed unless the additive S1 controlled-data erratum, regenerated runtime outputs and current SSOT agree exactly while S2 remains unauthorized.
// Boundary: governance read-only validation; no database write, calibration search, Candidate, Evaluation, Model Activation, Runtime authority, route, Web, scheduler, or CAP-07 authority.

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '../..');
const S1 = 'MCFT-CAP-06.MCFT-01-03-11.CANONICAL-RESIDUAL-WINDOWS-V1';
const S2 = 'MCFT-CAP-06.MCFT-02-06-07-09-11-12.CALIBRATION-SHADOW-CONTRACTS-MATH-V1';
const EXPECTED_RESIDUAL_SET_HASH = 'sha256:7995da1a8c5221c207087b30bb66a60ac2054e0616338f275ffaf72a01857e60';
const EXPECTED_CASE_INPUT_SET_HASH = 'sha256:cb3bd4c273134071e931e8f85765b028ce58986752e94da3902f8563ddba4bb3';
const EXPECTED_CALIBRATION_WINDOW_HASH = 'sha256:e5403ae258326909d054e92b53d089494d709785d8c48775a8cd142b0f0d191d';
const EXPECTED_HOLDOUT_WINDOW_HASH = 'sha256:20bc567b9e75027425c981a24d8889f80327b55226dd29d04a97880bc07a428a';

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function readText(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function main() {
  const runtime = readJson('acceptance-output/MCFT_CAP_06_S1_RESULT.json');
  const regimes = readJson('acceptance-output/MCFT_CAP_06_S1_CONTROLLED_REGIMES_RESULT.json');
  const erratum = readJson('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S1-CONTROLLED-DATA-ERRATUM.json');
  const contract = readJson('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S1-RESIDUAL-WINDOWS.json');
  const status = readJson('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S1-RESIDUAL-WINDOWS-STATUS.json');
  const priorEffectiveness = readJson('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S1-EFFECTIVENESS.json');
  const delivery = readJson('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-DELIVERY-SLICE-STATUS.json');
  const current = readJson('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-STATE-RECONCILIATION.json');
  const matrix = readJson('docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json');

  assert.equal(runtime.canonical_residual_count, 24);
  assert.equal(runtime.residual_set_hash, EXPECTED_RESIDUAL_SET_HASH);
  assert.equal(runtime.case_input_set_hash, EXPECTED_CASE_INPUT_SET_HASH);
  assert.equal(runtime.calibration_window_hash, EXPECTED_CALIBRATION_WINDOW_HASH);
  assert.equal(runtime.holdout_window_hash, EXPECTED_HOLDOUT_WINDOW_HASH);
  assert.equal(runtime.candidate_fact_delta, 0);
  assert.equal(runtime.evaluation_fact_delta, 0);
  assert.equal(runtime.model_activation_fact_delta, 0);

  assert.deepEqual(regimes.ordered_residual_refs, runtime.ordered_residual_refs);
  assert.deepEqual(regimes.ordered_residual_hashes, runtime.ordered_residual_hashes);
  assert.equal(regimes.residual_set_hash, runtime.residual_set_hash);
  assert.equal(regimes.case_input_set_hash, runtime.case_input_set_hash);
  assert.deepEqual(regimes.calibration_regime_counts, { LOW_EXCESS: 8, MID_EXCESS: 2, HIGH_EXCESS: 6 });
  assert.deepEqual(regimes.holdout_regime_counts, { LOW_EXCESS: 0, MID_EXCESS: 0, HIGH_EXCESS: 8 });
  assert.equal(regimes.calibration_represented_regime_count, 3);
  assert.equal(regimes.minimum_required_calibration_regime_count, 2);
  assert.equal(regimes.base_replay_status, 'PASS_24_EXACT_STORAGE_AND_ZERO_MASS_BALANCE_ERROR');

  assert.equal(erratum.status, 'CORRECTION_CANDIDATE');
  assert.equal(erratum.discovery.closed_without_merge_s2_pr_number, 2518);
  assert.equal(erratum.discovery.original_maximum_normalized_excess_ratio_scale_9, '0.093326488');
  assert.equal(erratum.discovery.frozen_mid_lower_bound, '0.100000000');
  assert.equal(erratum.scope_of_retraction.prior_s1_mechanical_proof_preserved, true);
  assert.equal(erratum.scope_of_retraction.prior_s1_successor_readiness_claim_superseded, true);
  assert.equal(erratum.scope_of_retraction.s2_authorization_withdrawn, true);
  assert.equal(erratum.correction.dynamics_changed, false);
  assert.equal(erratum.correction.regime_formula_changed, false);
  assert.equal(erratum.correction.regime_thresholds_changed, false);
  assert.equal(erratum.correction.residual_set_hash, runtime.residual_set_hash);
  assert.deepEqual(erratum.correction.ordered_residual_hashes, runtime.ordered_residual_hashes);
  assert.equal(erratum.effectiveness.effective, false);

  assert.equal(contract.status, 'CONTROLLED_DATA_CORRECTION_CANDIDATE');
  assert.deepEqual(contract.ordered_residual_refs, runtime.ordered_residual_refs);
  assert.deepEqual(contract.ordered_residual_hashes, runtime.ordered_residual_hashes);
  assert.equal(contract.residual_set_hash, runtime.residual_set_hash);
  assert.equal(contract.case_input_set_hash, runtime.case_input_set_hash);
  assert.deepEqual(contract.validation.calibration_regime_counts, regimes.calibration_regime_counts);
  assert.equal(contract.validation.runtime_result_ssot_crosscheck, 'PASS');

  assert.equal(status.status, 'CONTROLLED_DATA_CORRECTION_CANDIDATE');
  assert.equal(status.s1_effective, false);
  assert.equal(status.s2_authorized, false);
  assert.equal(status.effectiveness.effective, false);
  assert.equal(status.prior_effectiveness.postmerge_gate, 'PASS');
  assert.equal(status.candidate_tree_validation.runtime_result_ssot_crosscheck, 'PASS');

  assert.equal(priorEffectiveness.status, 'MERGED_EFFECTIVE');
  assert.equal(priorEffectiveness.effective, true);
  assert.equal(priorEffectiveness.implementation_merge_commit, '6db3f8d0c2b2ba7bcc48993b4b4783332e2ae62b');

  assert.equal(delivery.active_delivery_slice_id, S1);
  assert.deepEqual(delivery.candidate_slices, [S1]);
  assert.deepEqual(delivery.authorized_not_started_slices, []);
  assert.equal(delivery.s1_effective, false);
  assert.equal(delivery.s1_prior_mechanical_effectiveness_preserved, true);
  assert.equal(delivery.s2_authorized, false);
  assert.equal(delivery.blocked_slices.includes(S2), true);

  assert.equal(current.current_state.active_delivery_slice_id, S1);
  assert.equal(current.current_state.s1, 'CONTROLLED_DATA_CORRECTION_CANDIDATE');
  assert.equal(current.current_state.controlled_residual_window_effective, false);
  assert.equal(current.current_state.s2, 'BLOCKED_BY_S1_CONTROLLED_DATA_CORRECTION');
  assert.equal(current.current_state.calibration_contract_math_implemented, false);

  const lines = Array.isArray(matrix.capability_lines) ? matrix.capability_lines : matrix.capabilities;
  const line = lines.find((item) => item.capability_line_id === 'MCFT-CAP-06');
  assert.ok(line);
  assert.equal(line.active_delivery_slice_id, S1);
  assert.deepEqual(line.next_authorized_slice_ids, []);
  assert.equal(line.controlled_residual_window_effective, false);
  const matrixS1 = line.delivery_slices.find((item) => item.delivery_slice_id === S1);
  const matrixS2 = line.delivery_slices.find((item) => item.delivery_slice_id === S2);
  assert.equal(matrixS1.status, 'CONTROLLED_DATA_CORRECTION_CANDIDATE');
  assert.equal(matrixS1.effectiveness_condition_satisfied, false);
  assert.equal(matrixS2.status, 'BLOCKED_BY_S1_CONTROLLED_DATA_CORRECTION');
  assert.equal(matrixS2.implementation_started, false);

  const runner = readText('scripts/acceptance/run_acceptance.cjs');
  assert.ok(runner.includes('MCFT_CAP_06_S1_CONTROLLED_REGIMES'));
  assert.ok(runner.includes('ACCEPTANCE_MCFT_CAP_06_S1_CONTROLLED_DATA_CORRECTION.cjs'));
  const cap04Fixture = readText('scripts/runtime_acceptance/mcft_cap_04_twenty_four_tick_range_fixture_v1.ts');
  const s1Fixture = readText('scripts/runtime_acceptance/mcft_cap_06_s1_residual_windows_fixture_v1.ts');
  assert.ok(cap04Fixture.includes('CAP06_MULTI_REGIME_V1'));
  assert.ok(s1Fixture.includes('rainfall_profile_id: "CAP06_MULTI_REGIME_V1"'));
  assert.equal(s1Fixture.includes('twin_calibration_candidate_v1'), false);
  assert.equal(s1Fixture.includes('twin_shadow_evaluation_v1'), false);
  assert.equal(s1Fixture.includes('twin_model_activation_v1'), false);

  console.log('PASS corrected S1 runtime output equals contract and erratum SSOT');
  console.log('PASS calibration covers frozen 8 LOW / 2 MID / 6 HIGH regimes');
  console.log('PASS prior mechanical proof preserved while S2 authorization is withdrawn');
  console.log('PASS Candidate/Evaluation/Activation/S3/CAP-07 remain absent or blocked');
}

main();
