const { assert, env, fetchJson, requireOk } = require('./_common.cjs');

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj ?? {}, key);
}

(async () => {
  const base = env('BASE_URL', process.env.GEOX_BASE_URL || 'http://127.0.0.1:3001');
  const token = env('AO_ACT_TOKEN', process.env.GEOX_BEARER || '');
  const tenant_id = env('TENANT_ID', 'tenantA');
  const project_id = env('PROJECT_ID', 'projectA');
  const group_id = env('GROUP_ID', 'groupA');
  const field_id = env('FIELD_ID', 'fieldA');

  const query = `tenant_id=${encodeURIComponent(tenant_id)}&project_id=${encodeURIComponent(project_id)}&group_id=${encodeURIComponent(group_id)}`;

  const fieldResp = await fetchJson(
    `${base}/api/v1/reports/field/${encodeURIComponent(field_id)}?${query}`,
    { method: 'GET', token },
  );
  const fieldJson = requireOk(fieldResp, 'read field report');
  const fieldReport = fieldJson.field_report_v1 ?? {};

  const valueSummary = fieldReport.value_summary ?? {};
  assert.ok(Number(valueSummary.total_roi_items ?? 0) > 0, 'value_summary.total_roi_items must be > 0');

  const recentOperations = Array.isArray(fieldReport.recent_operations) ? fieldReport.recent_operations : [];
  const operation_id = String(recentOperations[0]?.operation_id ?? '').trim();
  assert.ok(operation_id, 'field report recent_operations[0].operation_id missing');

  const opResp = await fetchJson(
    `${base}/api/v1/reports/operation/${encodeURIComponent(operation_id)}?${query}`,
    { method: 'GET', token },
  );
  const opJson = requireOk(opResp, 'read operation report');
  const opReport = opJson.operation_report_v1 ?? {};
  const items = Array.isArray(opReport?.roi_ledger?.items) ? opReport.roi_ledger.items : [];

  assert.ok(items.length > 0, 'roi_ledger.items.length must be > 0');

  for (const [index, item] of items.entries()) {
    const prefix = `roi_ledger.items[${index}]`;
    assert.ok(hasOwn(item, 'baseline_value'), `${prefix}.baseline_value missing`);
    assert.ok(hasOwn(item, 'planned_value'), `${prefix}.planned_value missing`);
    assert.ok(hasOwn(item, 'actual_value'), `${prefix}.actual_value missing`);
    assert.ok(hasOwn(item, 'delta_value'), `${prefix}.delta_value missing`);
    assert.ok(hasOwn(item, 'value_kind'), `${prefix}.value_kind missing`);
    assert.ok(hasOwn(item, 'confidence'), `${prefix}.confidence missing`);
    assert.ok(Array.isArray(item?.evidence_refs), `${prefix}.evidence_refs must be array`);
    assert.ok(typeof item?.calculation_method === 'string', `${prefix}.calculation_method must be string`);
    assert.ok(item?.assumptions && typeof item.assumptions === 'object' && !Array.isArray(item.assumptions), `${prefix}.assumptions must be object`);
    assert.ok(typeof item?.customer_text === 'string' && item.customer_text.length > 0, `${prefix}.customer_text missing`);

    if (String(item?.value_kind ?? '').toUpperCase() === 'MEASURED') {
      assert.ok(item.evidence_refs.length > 0, `${prefix}.MEASURED must include evidence_refs`);
    }

    const hasSkillSource = String(item?.source_skill_id ?? '').trim().length > 0
      || String(item?.skill_trace_ref ?? '').trim().length > 0;
    assert.ok(hasSkillSource, `${prefix} must contain source_skill_id or skill_trace_ref`);

    if (String(item?.roi_type ?? '') === 'WATER_SAVED' && item?.baseline_value == null) {
      assert.ok(!String(item?.customer_text ?? '').includes('节水'), `${prefix} WATER_SAVED without baseline must not claim 节水`);
    }
  }

  const dashboardResp = await fetchJson(
    `${base}/api/v1/reports/customer-dashboard/aggregate?${query}`,
    { method: 'GET', token },
  );
  const dashboardJson = requireOk(dashboardResp, 'read customer dashboard aggregate');
  const roiSummary = dashboardJson.customer_dashboard_aggregate_v1?.roi_summary ?? dashboardJson.roi_summary ?? {};
  assert.ok(Number(roiSummary.total_items ?? 0) > 0, 'roi_summary.total_items must be > 0');

  const checks = {
    operation_report_items_present: items.length > 0,
    field_value_summary_present: Number(valueSummary.total_roi_items ?? 0) > 0,
    dashboard_roi_summary_present: Number(roiSummary.total_items ?? 0) > 0,
  };

  process.stdout.write(`${JSON.stringify({ ok: true, operation_id, field_id, checks }, null, 2)}\n`);
})();
