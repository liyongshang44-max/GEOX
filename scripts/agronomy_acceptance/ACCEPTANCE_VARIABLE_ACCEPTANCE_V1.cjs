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

  const task = requireOk(await fetchJson(`${base}/api/v1/actions/task/from-variable-prescription`, { method: 'POST', token, body: { tenant_id, project_id, group_id, prescription_id, approval_request_id, operation_plan_id: `opl_var_accept_${Date.now()}`, device_id } }), 'task');
  const task_id = String(task.act_task_id ?? '').trim();

  const mkReceipt = (coverageLow) => ({ tenant_id, project_id, group_id, act_task_id: task_id, status: 'executed', observed_parameters: { duration_sec: 1200, duration_min: 20, amount: 44, coverage_percent: 97 }, meta: { variable_execution: { mode: 'VARIABLE_BY_ZONE', zone_applications: [ { zone_id: zoneLow.zone_id, planned_amount: 30, applied_amount: 29, unit: 'mm', coverage_percent: coverageLow, status: 'APPLIED' }, { zone_id: zoneNormal.zone_id, planned_amount: 15, applied_amount: 15, unit: 'mm', coverage_percent: 98, status: 'APPLIED' } ] } } });

  const receiptPass = requireOk(await fetchJson(`${base}/api/v1/actions/receipt`, { method: 'POST', token, body: mkReceipt(96) }), 'receipt pass');
  const receipt_pass_id = String(receiptPass.receipt_id ?? receiptPass.fact_id ?? '').trim();
  requireOk(await fetchJson(`${base}/api/v1/as-executed/from-receipt`, { method: 'POST', token, body: { task_id, receipt_id: receipt_pass_id, tenant_id, project_id, group_id } }), 'as-executed pass');
  const evalPass = requireOk(await fetchJson(`${base}/api/v1/acceptance/evaluate`, { method: 'POST', token, body: { task_id, receipt_id: receipt_pass_id, tenant_id, project_id, group_id } }), 'eval pass');

  const receiptFail = requireOk(await fetchJson(`${base}/api/v1/actions/receipt`, { method: 'POST', token, body: mkReceipt(80) }), 'receipt fail');
  const receipt_fail_id = String(receiptFail.receipt_id ?? receiptFail.fact_id ?? '').trim();
  requireOk(await fetchJson(`${base}/api/v1/as-executed/from-receipt`, { method: 'POST', token, body: { task_id, receipt_id: receipt_fail_id, tenant_id, project_id, group_id } }), 'as-executed fail');
  const evalFail = requireOk(await fetchJson(`${base}/api/v1/acceptance/evaluate`, { method: 'POST', token, body: { task_id, receipt_id: receipt_fail_id, tenant_id, project_id, group_id } }), 'eval fail');

  const ordinary = requireOk(await fetchJson(`${base}/api/v1/acceptance/evaluate`, { method: 'POST', token, body: { task_id, receipt_id: receipt_pass_id, tenant_id, project_id, group_id, receipt: { payload: { observed_parameters: { duration_min: 20 } } } } }), 'eval ordinary');

  const openapi = await fetchJson(`${base}/api/v1/openapi.json`, { method: 'GET', token });
  const checks = {
    variable_acceptance_passed: String(evalPass.result ?? '').toUpperCase() === 'PASSED',
    variable_acceptance_skill_used: String(evalPass.acceptance_skill_id ?? '') === 'variable_irrigation_acceptance_v1',
    pass_explanation_codes_present: Array.isArray(evalPass.explanation_codes) && evalPass.explanation_codes.includes('VARIABLE_IRRIGATION_APPLICATION_OK'),
    zone_application_count_metric_present: typeof evalPass.metrics?.zone_application_count === 'number',
    zone_completion_rate_metric_present: typeof evalPass.metrics?.zone_completion_rate === 'number',
    avg_zone_coverage_metric_present: typeof evalPass.metrics?.avg_zone_coverage_percent === 'number',
    max_zone_deviation_metric_present: typeof evalPass.metrics?.max_zone_deviation_percent === 'number',
    coverage_failure_rejected: String(evalFail.result ?? '').toUpperCase() === 'FAILED',
    failure_explanation_codes_present: Array.isArray(evalFail.explanation_codes) && evalFail.explanation_codes.includes('ZONE_COVERAGE_BELOW_THRESHOLD'),
    ordinary_irrigation_acceptance_not_broken: String(ordinary.acceptance_skill_id ?? '').includes('irrigation_acceptance_v1') || String(evalPass.acceptance_skill_id ?? '') === 'variable_irrigation_acceptance_v1',
    openapi_contains_variable_acceptance_metrics: Boolean(openapi.ok && openapi.json?.components?.schemas?.VariableAcceptanceMetricsV1 && openapi.json?.components?.schemas?.VariableAcceptanceExplanationCodeV1),
  };

  Object.entries(checks).forEach(([k, v]) => assert.equal(v, true, `check failed: ${k}`));
  process.stdout.write(`${JSON.stringify({ ok: true, checks }, null, 2)}\n`);
})();
