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

test('final_status priority: transition > receipt > acceptance_pending > fallback', () => {
  const base = fact('operation_plan_v1', { operation_plan_id: 'op2', act_task_id: 't2' }, '2026-03-19T20:00:00.000Z', 'p');
  const withTransition = projectOperationStateFromFacts([
    base,
    fact('operation_plan_transition_v1', { operation_plan_id: 'op2', status: 'FAILED' }, '2026-03-19T20:01:00.000Z', 'tr'),
    fact('ao_act_receipt_v1', { act_task_id: 't2', status: 'executed' }, '2026-03-19T20:02:00.000Z', 'rc'),
  ]);
  assert.equal(withTransition[0].final_status, 'FAILED');

  const withReceipt = projectOperationStateFromFacts([
    base,
    fact('ao_act_receipt_v1', { act_task_id: 't2', status: 'executed' }, '2026-03-19T20:02:00.000Z', 'rc2'),
  ]);
  assert.equal(withReceipt[0].final_status, 'SUCCESS');

  const missingAcceptance = projectOperationStateFromFacts([base]);
  assert.equal(missingAcceptance[0].final_status, 'PENDING_ACCEPTANCE');

  const fallback = projectOperationStateFromFacts([
    base,
    fact('acceptance_result_v1', { operation_plan_id: 'op2', act_task_id: 't2', verdict: 'PASS' }, '2026-03-19T20:02:00.000Z', 'ac2')
  ]);
  assert.equal(fallback[0].final_status, 'RUNNING');
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
