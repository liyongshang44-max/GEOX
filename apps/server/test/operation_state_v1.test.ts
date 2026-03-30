import test from 'node:test';
import assert from 'node:assert/strict';
import { projectOperationStateFromFacts, type OperationProjectionFactRow } from '../src/projections/operation_state_v1';

function fact(type: string, payload: any, occurred_at: string, fact_id: string): OperationProjectionFactRow {
  return { fact_id, occurred_at, record_json: { type, payload } } as OperationProjectionFactRow;
}

test('builds timeline from transitions', () => {
  const rows: OperationProjectionFactRow[] = [
    fact('operation_plan_v1', { operation_plan_id: 'op1', recommendation_id: 'r1', approval_request_id: 'a1', act_task_id: 't1' }, '2026-03-19T20:00:00.000Z', 'f1'),
    fact('operation_plan_transition_v1', { operation_plan_id: 'op1', status: 'PENDING_APPROVAL' }, '2026-03-19T20:01:00.000Z', 'f2'),
    fact('operation_plan_transition_v1', { operation_plan_id: 'op1', status: 'APPROVED' }, '2026-03-19T20:02:00.000Z', 'f3'),
    fact('operation_plan_transition_v1', { operation_plan_id: 'op1', status: 'DISPATCHED' }, '2026-03-19T20:03:00.000Z', 'f4'),
    fact('operation_plan_transition_v1', { operation_plan_id: 'op1', status: 'SUCCEEDED' }, '2026-03-19T20:04:00.000Z', 'f5'),
  ];
  const out = projectOperationStateFromFacts(rows);
  assert.equal(out.length, 1);
  assert.deepEqual(out[0].timeline.map((x) => x.type), ['APPROVAL_REQUESTED', 'APPROVED', 'TASK_DISPATCHED', 'SUCCEEDED']);
});

test('final_status priority: transition > receipt > acceptance gate > fallback', () => {
  const base = fact('operation_plan_v1', { operation_plan_id: 'op2', act_task_id: 't2' }, '2026-03-19T20:00:00.000Z', 'p');
  const withTransition = projectOperationStateFromFacts([
    base,
    fact('operation_plan_transition_v1', { operation_plan_id: 'op2', status: 'FAILED' }, '2026-03-19T20:01:00.000Z', 'tr'),
    fact('ao_act_receipt_v1', { act_task_id: 't2', status: 'executed' }, '2026-03-19T20:02:00.000Z', 'rc'),
  ]);
  assert.equal(withTransition[0].final_status, 'FAILED');

  const withReceipt = projectOperationStateFromFacts([
    base,
    fact('ao_act_receipt_v1', { act_task_id: 't2', status: 'executed', evidence_artifact_ids: ['ea_x'] }, '2026-03-19T20:02:00.000Z', 'rc2'),
  ]);
  assert.equal(withReceipt[0].final_status, 'PENDING_ACCEPTANCE');

  const missingAcceptance = projectOperationStateFromFacts([base]);
  assert.equal(missingAcceptance[0].final_status, 'PENDING_ACCEPTANCE');

  const fallback = projectOperationStateFromFacts([
    base,
    fact('acceptance_result_v1', { operation_plan_id: 'op2', act_task_id: 't2', verdict: 'PASS' }, '2026-03-19T20:02:00.000Z', 'ac2')
  ]);
  assert.equal(fallback[0].final_status, 'RUNNING');
});



test('reads human receipt v1 minimal shape on the shared chain', () => {
  const out = projectOperationStateFromFacts([
    fact('operation_plan_v1', { operation_plan_id: 'op3', act_task_id: 't3' }, '2026-03-19T20:00:00.000Z', 'p3'),
    fact('ao_act_receipt_v1', {
      act_task_id: 't3',
      executor_id: { kind: 'human', id: 'worker_01' },
      status: 'executed',
      execution_time: { start_ts: 1000, end_ts: 1200 }
    }, '2026-03-19T20:02:00.000Z', 'rc3'),
  ]);
  assert.equal(out[0].receipt_status, 'executed');
  assert.equal(out[0].final_status, 'PENDING_ACCEPTANCE');
  assert.ok(out[0].timeline.some((x) => x.type === 'DEVICE_ACK'));
  assert.ok(out[0].timeline.some((x) => x.type === 'SUCCEEDED'));
});

test('receipt evidence cannot bypass acceptance gate', () => {
  const out = projectOperationStateFromFacts([
    fact('operation_plan_v1', { operation_plan_id: 'op3b', act_task_id: 't3b' }, '2026-03-19T20:00:00.000Z', 'p3b'),
    fact('ao_act_receipt_v1', {
      act_task_id: 't3b',
      executor_id: { kind: 'human', id: 'worker_02' },
      status: 'executed',
      execution_time: { start_ts: 1000, end_ts: 1200 },
      evidence_artifact_ids: ['ea_001']
    }, '2026-03-19T20:02:00.000Z', 'rc3b'),
  ]);
  assert.equal(out[0].final_status, 'PENDING_ACCEPTANCE');
});

test('acceptance result unlocks success after receipt evidence', () => {
  const out = projectOperationStateFromFacts([
    fact('operation_plan_v1', { operation_plan_id: 'op3c', act_task_id: 't3c' }, '2026-03-19T20:00:00.000Z', 'p3c'),
    fact('ao_act_receipt_v1', {
      act_task_id: 't3c',
      executor_id: { kind: 'human', id: 'worker_03' },
      status: 'executed',
      evidence_artifact_ids: ['ea_002']
    }, '2026-03-19T20:02:00.000Z', 'rc3c'),
    fact('acceptance_result_v1', {
      operation_plan_id: 'op3c',
      act_task_id: 't3c',
      verdict: 'PASS'
    }, '2026-03-19T20:03:00.000Z', 'ac3c'),
  ]);
  assert.equal(out[0].final_status, 'SUCCESS');
});

test('filters by field/device/final_status', () => {
  const out = projectOperationStateFromFacts([
    fact('operation_plan_v1', { operation_plan_id: 'a', target: { ref: 'field_1' }, device_id: 'dev_1', status: 'CREATED' }, '2026-03-19T20:00:00.000Z', 'a1'),
    fact('operation_plan_v1', { operation_plan_id: 'b', target: { ref: 'field_2' }, device_id: 'dev_2', status: 'CREATED' }, '2026-03-19T20:00:00.000Z', 'b1'),
    fact('operation_plan_transition_v1', { operation_plan_id: 'b', status: 'FAILED' }, '2026-03-19T20:01:00.000Z', 'b2'),
  ]);
  assert.equal(out.filter((x) => x.field_id === 'field_1').length, 1);
  assert.equal(out.filter((x) => x.device_id === 'dev_2').length, 1);
  assert.equal(out.filter((x) => x.final_status === 'FAILED').length, 1);
});
