#!/usr/bin/env node
const { ensureTsxRuntime } = require('./_tsx_bootstrap.cjs');
ensureTsxRuntime();

const { assert } = require('./_common.cjs');

(async function main() {
  const { projectOperationReportV1 } = await import('../../apps/server/src/projections/report_v1.ts');
  const now = new Date('2026-05-04T00:00:00.000Z');
  const operation_state = {
    operation_id: 'op_roi_traceability_v1',
    recommendation_id: 'rec_1',
    field_id: 'field_1',
    final_status: 'SUCCEEDED',
    invalid_reason: null,
    acceptance: { status: 'PASS' },
    timeline: [
      { type: 'RECOMMENDATION_CREATED', ts: Date.parse('2026-05-04T00:00:00.000Z') },
      { type: 'TASK_CREATED', ts: Date.parse('2026-05-04T00:05:00.000Z') },
      { type: 'EXECUTION_STARTED', ts: Date.parse('2026-05-04T00:10:00.000Z') },
      { type: 'EXECUTION_FINISHED', ts: Date.parse('2026-05-04T00:20:00.000Z') },
      { type: 'RECEIPT_SUBMITTED', ts: Date.parse('2026-05-04T00:21:00.000Z') },
      { type: 'ACCEPTANCE_GENERATED', ts: Date.parse('2026-05-04T00:22:00.000Z') },
    ],
  };

  const report = projectOperationReportV1({
    tenant: { tenant_id: 'tenantA', project_id: 'projectA', group_id: 'groupA' },
    operation_plan_id: 'plan_1',
    operation_state,
    evidence_bundle: { artifacts: [], logs: [], media: [], metrics: [] },
    acceptance: { status: 'PASS', verdict: 'PASS', missing_evidence: [] },
    receipt: {
      execution_started_at: '2026-05-04T00:10:00.000Z',
      execution_finished_at: '2026-05-04T00:20:00.000Z',
    },
    cost: { estimated_total: 100 },
    sla: { execution_success: true, acceptance_pass: true, response_time_ms: 1000 },
    now,
    roi_ledger: [
      {
        roi_ledger_id: '1', roi_type: 'WATER_SAVED', value_kind: 'MEASURED', evidence_refs: ['e1'],
        baseline_type: 'HISTORICAL', baseline_value: 100, planned_value: 90, actual_value: 80, delta_value: 20, unit: 'm3',
        confidence: { level: 'HIGH', basis: 'meter', reasons: [] }, calculation_method: 'meter_diff', assumptions: {}, uncertainty_notes: null,
        skill_trace_id: 'trace-1', skill_refs: [{ skill_id: 's1', skill_version: '1.0.0', trace_id: 'trace-1', run_id: 'run-1' }], field_memory_refs: ['fm-1'],
        estimated_money_value: 50, currency: 'CNY',
      },
      {
        roi_ledger_id: '2', roi_type: 'WATER_SAVED', value_kind: 'MEASURED', evidence_refs: [],
        baseline_type: 'HISTORICAL', baseline_value: 100, planned_value: 95, actual_value: 90, delta_value: 10, unit: 'm3',
        confidence: { level: 'MEDIUM', basis: 'estimate', reasons: [] }, calculation_method: 'manual', assumptions: {}, uncertainty_notes: null,
        skill_trace_id: null, skill_refs: [{ skill_id: 's2', skill_version: '1.0.0', trace_id: 'trace-2', run_id: 'run-2' }], field_memory_refs: ['fm-2'],
      },
      {
        roi_ledger_id: '3', roi_type: 'LABOR_SAVED', value_kind: 'ESTIMATED', evidence_refs: ['e2'],
        baseline_type: 'DEFAULT', baseline_value: 12, planned_value: 10, actual_value: 9, delta_value: 3, unit: 'h',
        confidence: { level: 'MEDIUM', basis: 'model', reasons: [] }, calculation_method: 'model_v1', assumptions: { speed: 1.2 }, uncertainty_notes: 'weather',
        skill_trace_id: 'trace-3', skill_refs: [], field_memory_refs: [], estimated_money_value: 20, currency: 'CNY',
      },
      {
        roi_ledger_id: '4', roi_type: 'EARLY_WARNING_LEAD_TIME', value_kind: 'ASSUMPTION_BASED', evidence_refs: ['e3'],
        baseline_type: 'DEFAULT', baseline_value: null, planned_value: 5, actual_value: 6, delta_value: 1, unit: 'h',
        confidence: { level: 'LOW', basis: 'assumption', reasons: ['cold-start'] }, calculation_method: 'rule', assumptions: { window: 24 }, uncertainty_notes: null,
        skill_trace_id: null, skill_refs: [{ skill_id: 's4', skill_version: null, trace_id: 'trace-4', run_id: null }], field_memory_refs: ['fm-4'],
      },
    ],
  });

  const items = Array.isArray(report?.roi_ledger?.items) ? report.roi_ledger.items : [];
  assert.equal(items.length, 4);
  for (const [i, item] of items.entries()) {
    const p = `roi_items[${i}]`;
    assert.ok(item.baseline && typeof item.baseline === 'object', `${p}.baseline missing`);
    assert.ok(item.planned && typeof item.planned === 'object', `${p}.planned missing`);
    assert.ok(item.actual && typeof item.actual === 'object', `${p}.actual missing`);
    assert.ok(item.delta && typeof item.delta === 'object', `${p}.delta missing`);
    assert.ok(typeof item.value_kind === 'string', `${p}.value_kind missing`);
    assert.ok(item.confidence && typeof item.confidence === 'object', `${p}.confidence missing`);
    assert.ok(Array.isArray(item.evidence_refs), `${p}.evidence_refs invalid`);
    assert.ok(typeof item.calculation_method === 'string', `${p}.calculation_method missing`);
    assert.ok(item.assumptions && typeof item.assumptions === 'object' && !Array.isArray(item.assumptions), `${p}.assumptions missing`);
    assert.ok('uncertainty_notes' in item, `${p}.uncertainty_notes missing`);
    assert.ok(Boolean(item.skill_trace_id) || (Array.isArray(item.skill_refs) && item.skill_refs.length > 0), `${p}.skill trace missing`);
    assert.ok(typeof item.customer_text === 'string' && item.customer_text.length > 0, `${p}.customer_text missing`);
  }

  const summary = report.roi_ledger.summary;
  assert.equal(summary.total_items, 4);
  assert.equal(summary.measured_items, 1);
  assert.equal(summary.estimated_items, 1);
  assert.equal(summary.assumption_based_items, 1);
  assert.equal(summary.insufficient_items, 1);
  assert.equal(summary.has_customer_visible_value, true);

  process.stdout.write('ACCEPTANCE_ROI_REPORT_TRACEABILITY_V1: PASS\n');
})();
