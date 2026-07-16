// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S1_CONTROLLED_DATA_CORRECTION.cjs
// Purpose: fail closed unless corrected S1 evidence remains exact while allowing the mutable MCFT-CAP-06 delivery frontier to advance beyond S2.
// Boundary: governance read-only validation; no database write, calibration search, Candidate, Evaluation, Model Activation, Runtime authority, route, Web, scheduler, or CAP-07 authority.

'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
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

function orderedRefMembershipHash(refs) {
  return `sha256:${crypto.createHash('sha256').update(JSON.stringify(refs), 'utf8').digest('hex')}`;
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
  assert.ok(regimes.calibration_sensitive_case_count >= regimes.minimum_sensitive_case_count);
  assert.ok(
    regimes.calibration_represented_sensitive_regime_count
      >= regimes.minimum_required_sensitive_regime_count,
  );
  assert.equal(regimes.successor_readiness_precondition_status, 'PASS');
  assert.equal(regimes.holdout_purpose, 'HIGH_EXCESS_STRESS_HOLDOUT_ONLY');
  assert.equal(regimes.holdout_generalization_claim, 'NOT_ESTABLISHED');
  assert.equal(regimes.window_hash_semantics, 'ORDERED_RESIDUAL_REF_MEMBERSHIP_ONLY_V1');
  assert.equal(
    regimes.required_window_semantic_companion_hashes.residual_set_hash,
    runtime.residual_set_hash,
  );
  assert.equal(
    regimes.required_window_semantic_companion_hashes.case_input_set_hash,
    runtime.case_input_set_hash,
  );
  assert.equal(
    runtime.calibration_window_hash,
    orderedRefMembershipHash(runtime.ordered_residual_refs.slice(0, 16)),
  );
  assert.equal(
    runtime.holdout_window_hash,
    orderedRefMembershipHash(runtime.ordered_residual_refs.slice(16)),
  );

  assert.equal(erratum.status, 'CORRECTION_MERGED_EFFECTIVE');
  assert.equal(erratum.effectiveness.effective, true);
  assert.equal(erratum.effectiveness.implementation_exact_head, '6ed8956155fba4d7ae040f88ab1870e564945f7c');
  assert.equal(erratum.effectiveness.implementation_exact_head_ci_run, 29493034432);
  assert.equal(erratum.effectiveness.merge_commit, '4fc1044085c4befad7852089b6ebe2afab46a5ca');
  assert.equal(erratum.effectiveness.postmerge_workflow_run, 29493733228);
  assert.equal(erratum.correction.successor_readiness_data_precondition, 'PASS');
  assert.equal(erratum.correction.holdout_generalization_claim, 'NOT_ESTABLISHED');

  assert.equal(contract.canonical_deltas.twin_calibration_candidate_v1, 0);
  assert.equal(contract.canonical_deltas.twin_shadow_evaluation_v1, 0);
  assert.equal(contract.canonical_deltas.twin_model_activation_v1, 0);
  assert.equal(contract.residual_set_hash, EXPECTED_RESIDUAL_SET_HASH);
  assert.equal(contract.case_input_set_hash, EXPECTED_CASE_INPUT_SET_HASH);

  assert.equal(status.status, 'MERGED_EFFECTIVE_CORRECTED');
  assert.equal(status.s1_effective, true);
  assert.equal(status.s2_authorized, true);
  assert.equal(status.effectiveness.effective, true);
  assert.equal(status.effectiveness.implementation_exact_head, '6ed8956155fba4d7ae040f88ab1870e564945f7c');
  assert.equal(status.effectiveness.implementation_exact_head_ci_run, 29493034432);
  assert.equal(status.effectiveness.merge_commit, '4fc1044085c4befad7852089b6ebe2afab46a5ca');
  assert.equal(status.effectiveness.postmerge_workflow_run, 29493733228);

  assert.equal(priorEffectiveness.status, 'MERGED_EFFECTIVE');
  assert.equal(priorEffectiveness.effective, true);
  assert.equal(priorEffectiveness.effectiveness_revision, 'CORRECTED_SUCCESSOR_READINESS_V2');
  assert.equal(priorEffectiveness.implementation_pr_number, 2519);
  assert.equal(priorEffectiveness.implementation_exact_head, '6ed8956155fba4d7ae040f88ab1870e564945f7c');
  assert.equal(priorEffectiveness.implementation_exact_head_ci_run, 29493034432);
  assert.equal(priorEffectiveness.implementation_merge_commit, '4fc1044085c4befad7852089b6ebe2afab46a5ca');
  assert.equal(priorEffectiveness.postmerge_workflow_run, 29493733228);
  assert.equal(priorEffectiveness.active_delivery_slice_id, S2);
  assert.deepEqual(priorEffectiveness.authorized_not_started_slice_ids, [S2]);
  assert.equal(priorEffectiveness.s2_implementation_started, false);
  assert.equal(priorEffectiveness.candidate_runtime_implemented, false);
  assert.equal(priorEffectiveness.shadow_evaluation_runtime_implemented, false);
  assert.equal(priorEffectiveness.calibration_contract_math_implemented, false);
  assert.equal(priorEffectiveness.superseded_prior_effectiveness.implementation_pr_number, 2514);

  assert.equal(delivery.blocked_slices.includes(S2), false);
  assert.equal(delivery.s1_effective, true);
  assert.equal(delivery.s1_successor_readiness_effective, true);
  assert.equal(delivery.s2_authorized, true);
  assert.equal(current.current_state.s1, 'MERGED_EFFECTIVE_CORRECTED');
  assert.equal(current.current_state.controlled_residual_window_effective, true);
  assert.equal(current.current_state.s1_successor_readiness_effective, true);
  assert.equal(current.current_state.s2_authorized, true);
  assert.equal(current.current_state.active_delivery_slice_id, delivery.active_delivery_slice_id);

  const lines = Array.isArray(matrix.capability_lines) ? matrix.capability_lines : matrix.capabilities;
  const line = lines.find((item) => item.capability_line_id === 'MCFT-CAP-06');
  assert.ok(line);
  assert.equal(line.controlled_residual_window_effective, true);
  assert.equal(line.s1_successor_readiness_effective, true);
  const matrixS1 = line.delivery_slices.find((item) => item.delivery_slice_id === S1);
  const matrixS2 = line.delivery_slices.find((item) => item.delivery_slice_id === S2);
  assert.equal(matrixS1.status, 'MERGED_EFFECTIVE_CORRECTED');
  assert.equal(matrixS1.effectiveness_condition_satisfied, true);

  const s2CandidatePhase = delivery.candidate_slices.length === 1
    && delivery.candidate_slices[0] === S2
    && delivery.s2_effective !== true;
  const s2EffectiveOrLater = delivery.s2_effective === true;

  if (s2EffectiveOrLater) {
    assert.equal(delivery.s2_implementation_started, true);
    assert.equal(delivery.s2_candidate_implemented, true);
    assert.equal(delivery.s2_effective, true);
    assert.equal(current.reconciliation_effective, true);
    assert.equal(current.current_state.s2, 'MERGED_EFFECTIVE');
    assert.equal(current.current_state.s2_implementation_started, true);
    assert.equal(current.current_state.calibration_contract_math_candidate_implemented, true);
    assert.equal(current.current_state.calibration_contract_math_implemented, true);
    assert.equal(matrixS2.status, 'MERGED_EFFECTIVE');
    assert.equal(matrixS2.implementation_started, true);
    assert.equal(matrixS2.effectiveness_condition_satisfied, true);
  } else if (s2CandidatePhase) {
    assert.equal(delivery.active_delivery_slice_id, S2);
    assert.deepEqual(delivery.authorized_not_started_slices, []);
    assert.equal(delivery.s2_implementation_started, true);
    assert.equal(delivery.s2_candidate_implemented, true);
    assert.equal(delivery.s2_effective, false);
    assert.equal(current.current_state.active_delivery_slice_id, S2);
    assert.equal(current.current_state.s2, 'CANDIDATE_IMPLEMENTED_NOT_EFFECTIVE');
    assert.equal(current.current_state.calibration_contract_math_candidate_implemented, true);
    assert.equal(current.current_state.calibration_contract_math_implemented, false);
    assert.equal(matrixS2.status, 'CANDIDATE_IMPLEMENTED_NOT_EFFECTIVE');
    assert.equal(matrixS2.effectiveness_condition_satisfied, false);
  } else {
    assert.equal(delivery.active_delivery_slice_id, S2);
    assert.deepEqual(delivery.candidate_slices, []);
    assert.deepEqual(delivery.authorized_not_started_slices, [S2]);
    assert.equal(delivery.s2_implementation_started, false);
    assert.equal(current.current_state.active_delivery_slice_id, S2);
    assert.equal(current.current_state.s2, 'AUTHORIZED_NOT_STARTED');
    assert.equal(current.current_state.s2_implementation_started, false);
    assert.equal(current.current_state.calibration_contract_math_implemented, false);
    assert.equal(matrixS2.status, 'AUTHORIZED_NOT_STARTED');
    assert.equal(matrixS2.implementation_started, false);
  }

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
  console.log('PASS calibration covers frozen wetness regimes and minimum endpoint sensitivity');
  console.log('PASS holdout is disclosed as HIGH_EXCESS stress-only with no generalization claim');
  console.log('PASS window membership hashes require residual-set and case-input semantic companions');
  console.log('PASS corrected S1 effectiveness remains exact after the mutable delivery frontier advances');
  console.log('PASS S1 does not claim ownership over downstream S3/S4/S5 lifecycle state');
}

main();
