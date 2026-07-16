from pathlib import Path
p=Path('scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S1_CONTROLLED_DATA_CORRECTION.cjs')
t=p.read_text(encoding='utf-8')
a=t.index('  const s2CandidatePhase =')
b=t.index('  const runner =',a)
block='''  const s2CandidatePhase = delivery.candidate_slices.length === 1 && delivery.candidate_slices[0] === S2;
  const s2EffectivePhase = delivery.s2_effective === true && delivery.active_delivery_slice_id === S3;

  assert.equal(delivery.blocked_slices.includes(S2), false);
  assert.equal(delivery.s1_effective, true);
  assert.equal(delivery.s1_successor_readiness_effective, true);
  assert.equal(delivery.s2_authorized, true);
  assert.equal(current.current_state.s1, 'MERGED_EFFECTIVE_CORRECTED');
  assert.equal(current.current_state.controlled_residual_window_effective, true);
  assert.equal(current.current_state.s1_successor_readiness_effective, true);
  assert.equal(current.current_state.s2_authorized, true);

  const lines = Array.isArray(matrix.capability_lines) ? matrix.capability_lines : matrix.capabilities;
  const line = lines.find((item) => item.capability_line_id === 'MCFT-CAP-06');
  assert.ok(line);
  assert.equal(line.controlled_residual_window_effective, true);
  assert.equal(line.s1_successor_readiness_effective, true);
  assert.equal(line.candidate_runtime_implemented, false);
  assert.equal(line.shadow_evaluation_runtime_implemented, false);
  const matrixS1 = line.delivery_slices.find((item) => item.delivery_slice_id === S1);
  const matrixS2 = line.delivery_slices.find((item) => item.delivery_slice_id === S2);
  assert.equal(matrixS1.status, 'MERGED_EFFECTIVE_CORRECTED');
  assert.equal(matrixS1.effectiveness_condition_satisfied, true);

  if (s2EffectivePhase) {
    const matrixS3 = line.delivery_slices.find((item) => item.delivery_slice_id === S3);
    assert.deepEqual(delivery.candidate_slices, []);
    assert.deepEqual(delivery.authorized_not_started_slices, [S3]);
    assert.equal(delivery.blocked_slices.includes(S3), false);
    assert.equal(delivery.s2_implementation_started, true);
    assert.equal(delivery.s2_candidate_implemented, true);
    assert.equal(delivery.s2_effective, true);
    assert.equal(delivery.s3_authorized, true);
    assert.equal(delivery.s3_implementation_started, false);
    assert.equal(current.status, 'MERGED_EFFECTIVE');
    assert.equal(current.reconciliation_effective, true);
    assert.equal(current.current_state.active_delivery_slice_id, S3);
    assert.equal(current.current_state.s2, 'MERGED_EFFECTIVE');
    assert.equal(current.current_state.s2_implementation_started, true);
    assert.equal(current.current_state.calibration_contract_math_candidate_implemented, true);
    assert.equal(current.current_state.calibration_contract_math_implemented, true);
    assert.equal(current.current_state.s3, 'AUTHORIZED_NOT_STARTED');
    assert.equal(current.current_state.s3_authorized, true);
    assert.equal(current.current_state.s3_implementation_started, false);
    assert.equal(line.active_delivery_slice_id, S3);
    assert.deepEqual(line.next_authorized_slice_ids, [S3]);
    assert.equal(line.calibration_contract_math_candidate_implemented, true);
    assert.equal(line.calibration_contract_math_implemented, true);
    assert.equal(matrixS2.status, 'MERGED_EFFECTIVE');
    assert.equal(matrixS2.implementation_started, true);
    assert.equal(matrixS2.effectiveness_condition_satisfied, true);
    assert.equal(matrixS3.status, 'AUTHORIZED_NOT_STARTED');
    assert.equal(matrixS3.implementation_started, false);
  } else if (s2CandidatePhase) {
    assert.equal(delivery.active_delivery_slice_id, S2);
    assert.deepEqual(delivery.authorized_not_started_slices, []);
    assert.equal(delivery.blocked_slices.includes(S3), true);
    assert.equal(delivery.s2_implementation_started, true);
    assert.equal(delivery.s2_candidate_implemented, true);
    assert.equal(delivery.s2_effective, false);
    assert.equal(delivery.s3_authorized, false);
    assert.equal(current.status, 'S2_CONTRACTS_MATH_CANDIDATE');
    assert.equal(current.reconciliation_effective, false);
    assert.equal(current.current_state.active_delivery_slice_id, S2);
    assert.equal(current.current_state.s2, 'CANDIDATE_IMPLEMENTED_NOT_EFFECTIVE');
    assert.equal(current.current_state.calibration_contract_math_candidate_implemented, true);
    assert.equal(current.current_state.calibration_contract_math_implemented, false);
    assert.equal(line.active_delivery_slice_id, S2);
    assert.deepEqual(line.next_authorized_slice_ids, []);
    assert.equal(line.calibration_contract_math_candidate_implemented, true);
    assert.equal(line.calibration_contract_math_implemented, false);
    assert.equal(matrixS2.status, 'CANDIDATE_IMPLEMENTED_NOT_EFFECTIVE');
    assert.equal(matrixS2.effectiveness_condition_satisfied, false);
  } else {
    assert.equal(delivery.active_delivery_slice_id, S2);
    assert.deepEqual(delivery.candidate_slices, []);
    assert.deepEqual(delivery.authorized_not_started_slices, [S2]);
    assert.equal(delivery.blocked_slices.includes(S3), true);
    assert.equal(delivery.s2_implementation_started, false);
    assert.equal(current.status, 'MERGED_EFFECTIVE');
    assert.equal(current.reconciliation_effective, true);
    assert.equal(current.current_state.active_delivery_slice_id, S2);
    assert.equal(current.current_state.s2, 'AUTHORIZED_NOT_STARTED');
    assert.equal(current.current_state.s2_implementation_started, false);
    assert.equal(current.current_state.calibration_contract_math_implemented, false);
    assert.equal(line.active_delivery_slice_id, S2);
    assert.deepEqual(line.next_authorized_slice_ids, [S2]);
    assert.equal(matrixS2.status, 'AUTHORIZED_NOT_STARTED');
    assert.equal(matrixS2.implementation_started, false);
  }

'''
p.write_text(t[:a]+block+t[b:],encoding='utf-8')
print('S1_GATE_LIFECYCLE_FIXED')
