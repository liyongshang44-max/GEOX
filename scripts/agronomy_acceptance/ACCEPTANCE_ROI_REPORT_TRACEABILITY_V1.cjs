const { assert } = require('./_common.cjs');

const VALUE_KIND_WHITELIST = new Set(['MEASURED', 'ESTIMATED', 'ASSUMPTION_BASED', 'INSUFFICIENT_EVIDENCE']);

function normalizeRoiItem(x) {
  const evidence_refs = Array.isArray(x.evidence_refs) ? x.evidence_refs : [];
  let value_kind = String(x.value_kind ?? 'INSUFFICIENT_EVIDENCE').toUpperCase();
  if (!VALUE_KIND_WHITELIST.has(value_kind)) value_kind = 'INSUFFICIENT_EVIDENCE';
  if (value_kind === 'MEASURED' && evidence_refs.length === 0) value_kind = 'INSUFFICIENT_EVIDENCE';

  const baseline_value = x.baseline?.value ?? null;
  let customer_text = String(x.customer_text ?? '');
  if (baseline_value == null) {
    customer_text = customer_text.replace(/节水|节省|减少/g, '价值');
  }

  return {
    ...x,
    value_kind,
    evidence_refs,
    customer_text,
  };
}

(function main() {
  const raw = [
    {
      roi_ledger_id: '1', roi_type: 'WATER_SAVED', value_kind: 'MEASURED', evidence_refs: ['e1'],
      baseline: { type: 'HISTORICAL', value: 100, unit: 'm3' }, planned: { value: 90, unit: 'm3' }, actual: { value: 80, unit: 'm3' }, delta: { value: 20, unit: 'm3' },
      confidence: { level: 'HIGH', basis: 'meter', reasons: [] }, calculation_method: 'meter_diff', assumptions: {}, uncertainty_notes: null,
      skill_trace_id: 'trace-1', skill_refs: [{ skill_id: 's1', skill_version: '1.0.0', trace_id: 'trace-1', run_id: 'run-1' }], field_memory_refs: ['fm-1'], customer_text: '节水 20m3',
    },
    {
      roi_ledger_id: '2', roi_type: 'WATER_SAVED', value_kind: 'MEASURED', evidence_refs: [],
      baseline: { type: 'HISTORICAL', value: 100, unit: 'm3' }, planned: { value: 95, unit: 'm3' }, actual: { value: 90, unit: 'm3' }, delta: { value: 10, unit: 'm3' },
      confidence: { level: 'MEDIUM', basis: 'estimate', reasons: [] }, calculation_method: 'manual', assumptions: {}, uncertainty_notes: null,
      skill_trace_id: null, skill_refs: [{ skill_id: 's2', skill_version: '1.0.0', trace_id: 'trace-2', run_id: 'run-2' }], field_memory_refs: ['fm-2'], customer_text: '节水 10m3',
    },
    {
      roi_ledger_id: '3', roi_type: 'LABOR_SAVED', value_kind: 'ESTIMATED', evidence_refs: ['e2'],
      baseline: { type: 'DEFAULT', value: 12, unit: 'h' }, planned: { value: 10, unit: 'h' }, actual: { value: 9, unit: 'h' }, delta: { value: 3, unit: 'h' },
      confidence: { level: 'MEDIUM', basis: 'model', reasons: [] }, calculation_method: 'model_v1', assumptions: { speed: 1.2 }, uncertainty_notes: 'weather',
      skill_trace_id: 'trace-3', skill_refs: [], field_memory_refs: [], customer_text: '节省工时 3h',
    },
    {
      roi_ledger_id: '4', roi_type: 'EARLY_WARNING_LEAD_TIME', value_kind: 'ASSUMPTION_BASED', evidence_refs: ['e3'],
      baseline: { type: 'DEFAULT', value: null, unit: 'h' }, planned: { value: 5, unit: 'h' }, actual: { value: 6, unit: 'h' }, delta: { value: 1, unit: 'h' },
      confidence: { level: 'LOW', basis: 'assumption', reasons: ['cold-start'] }, calculation_method: 'rule', assumptions: { window: 24 }, uncertainty_notes: null,
      skill_trace_id: null, skill_refs: [{ skill_id: 's4', skill_version: null, trace_id: 'trace-4', run_id: null }], field_memory_refs: ['fm-4'], customer_text: '减少风险',
    },
  ];

  const items = raw.map(normalizeRoiItem);

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

  const summary = {
    total_items: items.length,
    measured_items: items.filter((x) => x.value_kind === 'MEASURED').length,
    estimated_items: items.filter((x) => x.value_kind === 'ESTIMATED').length,
    assumption_based_items: items.filter((x) => x.value_kind === 'ASSUMPTION_BASED').length,
    insufficient_items: items.filter((x) => x.value_kind === 'INSUFFICIENT_EVIDENCE').length,
    has_customer_visible_value: items.some((x) => typeof x.customer_text === 'string' && x.customer_text.trim().length > 0),
  };

  assert.equal(summary.total_items, 4);
  assert.equal(summary.measured_items, 1);
  assert.equal(summary.estimated_items, 1);
  assert.equal(summary.assumption_based_items, 1);
  assert.equal(summary.insufficient_items, 1);
  assert.equal(summary.has_customer_visible_value, true);

  process.stdout.write('ACCEPTANCE_ROI_REPORT_TRACEABILITY_V1: PASS\n');
})();
