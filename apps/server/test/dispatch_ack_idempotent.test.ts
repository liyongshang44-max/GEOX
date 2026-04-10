import test from 'node:test';
import assert from 'node:assert/strict';

import {
  shouldTreatAckAsIdempotent,
  isAckConvergedDispatchQueueState,
  isAckConvergedOperationPlanStatus
} from '../src/domain/controlplane/task_service';

test('ACKED is idempotent when queue already converged', () => {
  assert.equal(isAckConvergedDispatchQueueState('ACKED'), true);
  assert.equal(isAckConvergedDispatchQueueState('SUCCEEDED'), true);
  assert.equal(isAckConvergedDispatchQueueState('FAILED'), true);
  assert.equal(shouldTreatAckAsIdempotent({ requestedState: 'ACKED', queueState: 'SUCCEEDED' }), true);
});

test('ACKED is idempotent when operation plan already in convergence chain', () => {
  assert.equal(isAckConvergedOperationPlanStatus('ACKED'), true);
  assert.equal(isAckConvergedOperationPlanStatus('PENDING_ACCEPTANCE'), true);
  assert.equal(isAckConvergedOperationPlanStatus('SUCCEEDED'), true);
  assert.equal(isAckConvergedOperationPlanStatus('FAILED'), true);

  assert.equal(
    shouldTreatAckAsIdempotent({ requestedState: 'ACKED', queueState: 'DISPATCHED', operationPlanStatus: 'PENDING_ACCEPTANCE' }),
    true
  );
});

test('illegal reverse transition still denied for non-ACKED states', () => {
  assert.equal(
    shouldTreatAckAsIdempotent({ requestedState: 'FAILED', queueState: 'SUCCEEDED', operationPlanStatus: 'PENDING_ACCEPTANCE' }),
    false
  );
  assert.equal(
    shouldTreatAckAsIdempotent({ requestedState: 'ACKED', queueState: 'READY', operationPlanStatus: 'DISPATCHED' }),
    false
  );
});

test('race lane: DISPATCHED -> receipt uplink -> ACKED should stay in success lane', () => {
  const receiptUplinkWon = shouldTreatAckAsIdempotent({
    requestedState: 'ACKED',
    queueState: 'DISPATCHED',
    operationPlanStatus: 'PENDING_ACCEPTANCE'
  });
  assert.equal(receiptUplinkWon, true);
});
