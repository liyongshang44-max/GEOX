const { assert, env, fetchJson, requireOk } = require('./_common.cjs');

(async () => {
  const base = env('BASE_URL', 'http://127.0.0.1:3001');
  const token = env('AO_ACT_TOKEN', '');
  const tenant_id = env('TENANT_ID', 'tenantA');
  const project_id = env('PROJECT_ID', 'projectA');
  const group_id = env('GROUP_ID', 'groupA');
  const field_id = env('FIELD_ID', 'field_c8_demo');
  const season_id = env('SEASON_ID', 'season_demo');
  const device_id = env('DEVICE_ID', 'dev_onboard_accept_001');

  const zoneLow = { tenant_id, project_id, group_id, zone_id: 'zone_low_moisture_north', zone_name: 'North low moisture zone', zone_type: 'IRRIGATION_ZONE', geometry: { type: 'Polygon', coordinates: [] }, area_ha: 3.2 };
  const zoneNormal = { tenant_id, project_id, group_id, zone_id: 'zone_normal_south', zone_name: 'South normal zone', zone_type: 'IRRIGATION_ZONE', geometry: { type: 'Polygon', coordinates: [] }, area_ha: 4.1 };
  requireOk(await fetchJson(`${base}/api/v1/fields/${encodeURIComponent(field_id)}/zones`, { method: 'POST', token, body: zoneLow }), 'create zone low');
  requireOk(await fetchJson(`${base}/api/v1/fields/${encodeURIComponent(field_id)}/zones`, { method: 'POST', token, body: zoneNormal }), 'create zone normal');

  const rec = requireOk(await fetchJson(`${base}/api/v1/recommendations/generate`, { method: 'POST', token, body: { tenant_id, project_id, group_id, field_id, season_id, device_id, crop_code: 'corn' } }), 'generate recommendation');
  const recommendation_id = String(rec.recommendations?.[0]?.recommendation_id ?? '').trim();
  const prc = requireOk(await fetchJson(`${base}/api/v1/prescriptions/variable/from-recommendation`, { method: 'POST', token, body: { tenant_id, project_id, group_id, recommendation_id, field_id, season_id, crop_id: 'corn', variable_plan: { mode: 'VARIABLE_BY_ZONE', zone_rates: [{ zone_id: zoneLow.zone_id, operation_type: 'IRRIGATION', planned_amount: 30, unit: 'mm' }, { zone_id: zoneNormal.zone_id, operation_type: 'IRRIGATION', planned_amount: 15, unit: 'mm' }] } } }), 'variable prescription');
  const prescription_id = String(prc.prescription?.prescription_id ?? '').trim();

  const sub = requireOk(await fetchJson(`${base}/api/v1/prescriptions/${encodeURIComponent(prescription_id)}/submit-approval`, { method: 'POST', token, body: { tenant_id, project_id, group_id } }), 'submit');
  const approval_request_id = String(sub.approval_request_id ?? '').trim();
  let appr = await fetchJson(`${base}/api/v1/approvals/${encodeURIComponent(approval_request_id)}/decide`, { method: 'POST', token, body: { tenant_id, project_id, group_id, decision: 'APPROVE' } });
  if (!appr.ok) appr = await fetchJson(`${base}/api/v1/approvals/approve`, { method: 'POST', token, body: { request_id: approval_request_id, tenant_id, project_id, group_id, decision: 'APPROVE' } });
  requireOk(appr, 'approve');

  const task = requireOk(await fetchJson(`${base}/api/v1/actions/task/from-variable-prescription`, { method: 'POST', token, body: { tenant_id, project_id, group_id, prescription_id, approval_request_id, operation_plan_id: `opl_var_roi_${Date.now()}`, device_id } }), 'task');
  const act_task_id = String(task.act_task_id ?? '').trim();

  const operation_plan_id = `opl_var_roi_${Date.now()}`;
  const receiptPayload = {
    tenant_id,
    project_id,
    group_id,
    operation_plan_id,
    act_task_id,
    executor_id: { kind: 'script', id: 'acceptance_variable_roi_ledger_v1', namespace: 'agronomy_acceptance' },
    execution_time: { start_ts: Date.now() - 1200 * 1000, end_ts: Date.now() },
    execution_coverage: { kind: 'field', ref: field_id },
    resource_usage: { fuel_l: null, electric_kwh: null, water_l: 440, chemical_ml: null },
    logs_refs: [{ kind: 'acceptance_log', ref: `variable_receipt_${act_task_id}` }],
    status: 'executed',
    constraint_check: { violated: false, violations: [] },
    observed_parameters: { duration_sec: 1200, duration_min: 20, amount: 44, coverage_percent: 97 },
    meta: {
      command_id: act_task_id,
      idempotency_key: `variable-roi-ledger-${act_task_id}`,
      variable_execution: {
        mode: 'VARIABLE_BY_ZONE',
        zone_applications: [
          { zone_id: zoneLow.zone_id, planned_amount: 30, applied_amount: 29, unit: 'mm', coverage_percent: 96, status: 'APPLIED' },
          { zone_id: zoneNormal.zone_id, planned_amount: 15, applied_amount: 15, unit: 'mm', coverage_percent: 98, status: 'APPLIED' },
        ],
      },
    },
  };
  const receipt = requireOk(await fetchJson(`${base}/api/v1/actions/receipt`, { method: 'POST', token, body: receiptPayload }), 'receipt');
  const receipt_id = String(receipt.receipt_id ?? receipt.fact_id ?? '').trim();

  const asExecutedResp = requireOk(await fetchJson(`${base}/api/v1/as-executed/from-receipt`, { method: 'POST', token, body: { act_task_id, receipt_id, tenant_id, project_id, group_id } }), 'as-executed');
  const as_executed_id = String(asExecutedResp.as_executed?.as_executed_id ?? '').trim();

  const acceptance = requireOk(await fetchJson(`${base}/api/v1/acceptance/evaluate`, { method: 'POST', token, body: { act_task_id, receipt_id, tenant_id, project_id, group_id } }), 'acceptance');

  const roiResp = requireOk(await fetchJson(`${base}/api/v1/roi-ledger/from-as-executed`, { method: 'POST', token, body: { as_executed_id, tenant_id, project_id, group_id } }), 'roi');
  const roiAgain = requireOk(await fetchJson(`${base}/api/v1/roi-ledger/from-as-executed`, { method: 'POST', token, body: { as_executed_id, tenant_id, project_id, group_id } }), 'roi again');
  const byAs = requireOk(await fetchJson(`${base}/api/v1/roi-ledger/by-as-executed/${encodeURIComponent(as_executed_id)}?tenant_id=${encodeURIComponent(tenant_id)}&project_id=${encodeURIComponent(project_id)}&group_id=${encodeURIComponent(group_id)}`, { method: 'GET', token }), 'by as-executed');
  const openapi = await fetchJson(`${base}/api/v1/openapi.json`, { method: 'GET', token });

  const ledgers = Array.isArray(byAs.roi_ledgers) ? byAs.roi_ledgers : [];
  const byType = Object.fromEntries(ledgers.map((x) => [x.roi_type, x]));
  const vws = byType.VARIABLE_WATER_SAVED;
  const zcr = byType.ZONE_COMPLETION_RATE;
  const ver = byType.VARIABLE_EXECUTION_RELIABILITY;

  const checks = {
    variable_as_applied_ready: String(asExecutedResp.as_applied?.application?.mode ?? '') === 'VARIABLE_BY_ZONE',
    variable_acceptance_passed: String(acceptance.result ?? '').toUpperCase() === 'PASSED',
    roi_ledger_created: roiResp.ok === true && ledgers.length > 0,
    roi_ledger_idempotent: roiAgain.ok === true && roiAgain.idempotent === true,
    variable_water_saved_created: Boolean(vws),
    zone_completion_rate_created: Boolean(zcr),
    variable_execution_reliability_created: Boolean(ver),
    variable_water_saved_amount_correct: Number(vws?.delta?.amount) === 1 && String(vws?.delta?.unit ?? '').toLowerCase() === 'mm',
    zone_completion_rate_correct: Number(zcr?.actual?.zone_count) === 2 && Number(zcr?.actual?.completed_zone_count) === 2 && Number(zcr?.actual?.completion_rate) === 1 && Number(zcr?.actual?.avg_coverage_percent) === 97,
    variable_execution_reliability_correct: Number(ver?.actual?.zone_count) === 2 && Number(ver?.actual?.applied_count) === 2 && Number(ver?.actual?.skipped_count) === 0 && Math.abs(Number(ver?.actual?.max_abs_deviation_percent) - 3.3333333333333335) < 0.02,
    roi_evidence_refs_present: [vws, zcr, ver].every((x) => Array.isArray(x?.evidence_refs)),
    roi_confidence_present: [vws, zcr, ver].every((x) => x?.confidence?.level && x?.confidence?.basis),
    roi_links_as_executed_and_as_applied: [vws, zcr, ver].every((x) => x?.as_executed_id === as_executed_id && String(x?.as_applied_id ?? '').trim()),
    no_yield_or_profit_fabrication: ledgers.every((x) => !String(x?.roi_type ?? '').includes('YIELD') && !String(x?.roi_type ?? '').includes('PROFIT')),
    openapi_contains_variable_roi_types: Boolean(openapi.ok && openapi.json?.components?.schemas?.RoiTypeV1?.enum?.includes('VARIABLE_WATER_SAVED') && openapi.json?.components?.schemas?.RoiTypeV1?.enum?.includes('ZONE_COMPLETION_RATE') && openapi.json?.components?.schemas?.RoiTypeV1?.enum?.includes('VARIABLE_EXECUTION_RELIABILITY')),
  };

  Object.entries(checks).forEach(([k, v]) => assert.equal(v, true, `check failed: ${k}`));
  process.stdout.write(`${JSON.stringify({ ok: true, checks }, null, 2)}\n`);
})();
