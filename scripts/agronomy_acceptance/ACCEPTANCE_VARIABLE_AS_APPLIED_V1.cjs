const { randomUUID } = require('node:crypto');
const { Pool } = require('pg');
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
  const databaseUrl = env('DATABASE_URL', 'postgres://postgres:postgres@127.0.0.1:5432/geox');
  const pool = new Pool({ connectionString: databaseUrl });

  const operation_plan_id = `opl_variable_as_applied_${Date.now()}`;
  const zoneLow = { tenant_id, project_id, group_id, zone_id: 'zone_low_moisture_north', zone_name: 'North low moisture zone', zone_type: 'IRRIGATION_ZONE', geometry: { type: 'Polygon', coordinates: [] }, area_ha: 3.2, risk_tags: ['LOW_MOISTURE'], agronomy_tags: ['SANDY_SOIL'], source_refs: ['judge_low'] };
  const zoneNormal = { tenant_id, project_id, group_id, zone_id: 'zone_normal_south', zone_name: 'South normal zone', zone_type: 'IRRIGATION_ZONE', geometry: { type: 'Polygon', coordinates: [] }, area_ha: 4.1, risk_tags: ['NORMAL'], agronomy_tags: ['BALANCED_SOIL'], source_refs: ['judge_normal'] };
  requireOk(await fetchJson(`${base}/api/v1/fields/${encodeURIComponent(field_id)}/zones`, { method: 'POST', token, body: zoneLow }), 'create zone low');
  requireOk(await fetchJson(`${base}/api/v1/fields/${encodeURIComponent(field_id)}/zones`, { method: 'POST', token, body: zoneNormal }), 'create zone normal');

  const recJson = requireOk(await fetchJson(`${base}/api/v1/recommendations/generate`, { method: 'POST', token, body: { tenant_id, project_id, group_id, field_id, season_id, device_id, crop_code: 'corn', stage1_sensing_summary: { irrigation_effectiveness: 'low', leak_risk: 'low', canopy_temp_status: 'normal', evapotranspiration_risk: 'medium', sensor_quality_level: 'GOOD' }, image_recognition: { stress_score: 0.8, disease_score: 0.1, pest_risk_score: 0.1, confidence: 0.95 } } }), 'generate recommendation');
  const recommendation_id = String(recJson.recommendations?.[0]?.recommendation_id ?? '').trim();
  assert.ok(recommendation_id, 'recommendation_id missing');

  const variablePrescriptionJson = requireOk(await fetchJson(`${base}/api/v1/prescriptions/variable/from-recommendation`, { method: 'POST', token, body: { tenant_id, project_id, group_id, recommendation_id, field_id, season_id, crop_id: 'corn', variable_plan: { mode: 'VARIABLE_BY_ZONE', zone_rates: [{ zone_id: zoneLow.zone_id, operation_type: 'IRRIGATION', planned_amount: 30, unit: 'mm', priority: 'HIGH', reason_codes: ['LOW_SOIL_MOISTURE'], source_refs: ['judge_low_moisture'] }, { zone_id: zoneNormal.zone_id, operation_type: 'IRRIGATION', planned_amount: 15, unit: 'mm', priority: 'MEDIUM', reason_codes: ['MODERATE_DEFICIT'], source_refs: ['judge_normal'] }] } } }), 'create variable prescription');
  const prescription_id = String(variablePrescriptionJson.prescription?.prescription_id ?? '').trim();

  const submitApprovalJson = requireOk(await fetchJson(`${base}/api/v1/prescriptions/${encodeURIComponent(prescription_id)}/submit-approval`, { method: 'POST', token, body: { tenant_id, project_id, group_id } }), 'submit prescription approval');
  const approval_request_id = String(submitApprovalJson.approval_request_id ?? '').trim();
  let approvalDecideResp = await fetchJson(`${base}/api/v1/approvals/${encodeURIComponent(approval_request_id)}/decide`, { method: 'POST', token, body: { tenant_id, project_id, group_id, decision: 'APPROVE', reason: 'acceptance_variable_as_applied_v1' } });
  if (!approvalDecideResp.ok) approvalDecideResp = await fetchJson(`${base}/api/v1/approvals/approve`, { method: 'POST', token, body: { request_id: approval_request_id, tenant_id, project_id, group_id, decision: 'APPROVE', reason: 'acceptance_variable_as_applied_v1' } });
  requireOk(approvalDecideResp, 'approve request');

  const createTaskJson = requireOk(await fetchJson(`${base}/api/v1/actions/task/from-variable-prescription`, { method: 'POST', token, body: { tenant_id, project_id, group_id, prescription_id, approval_request_id, operation_plan_id, device_id } }), 'create variable action task');
  const act_task_id = String(createTaskJson.act_task_id ?? '').trim();

  const receiptPayload = { tenant_id, project_id, group_id, act_task_id, status: 'executed', observed_parameters: { duration_sec: 1200, duration_min: 20, amount: 44, coverage_percent: 97 }, meta: { variable_execution: { mode: 'VARIABLE_BY_ZONE', zone_applications: [{ zone_id: zoneLow.zone_id, planned_amount: 30, applied_amount: 29, unit: 'mm', coverage_percent: 96, status: 'APPLIED' }, { zone_id: zoneNormal.zone_id, planned_amount: 15, applied_amount: 15, unit: 'mm', coverage_percent: 98, status: 'APPLIED' }] } } };
  const receiptJson = requireOk(await fetchJson(`${base}/api/v1/actions/receipt`, { method: 'POST', token, body: receiptPayload }), 'submit receipt');
  const receipt_id = String(receiptJson.receipt_id ?? receiptJson.fact_id ?? '').trim();

  const createAsExecutedJson = requireOk(await fetchJson(`${base}/api/v1/as-executed/from-receipt`, { method: 'POST', token, body: { task_id: act_task_id, receipt_id, tenant_id, project_id, group_id } }), 'create as executed');
  const createAgainJson = requireOk(await fetchJson(`${base}/api/v1/as-executed/from-receipt`, { method: 'POST', token, body: { task_id: act_task_id, receipt_id, tenant_id, project_id, group_id } }), 'idempotent create as executed');

  const asExecuted = createAsExecutedJson.as_executed ?? {};
  const asApplied = createAsExecutedJson.as_applied ?? {};
  const zoneApplications = asApplied?.application?.zone_applications ?? [];
  const openapi = await fetchJson(`${base}/api/v1/openapi.json`, { method: 'GET', token });

  const checks = {
    variable_action_task_created: Boolean(act_task_id),
    receipt_preserves_variable_execution: String(receiptJson?.payload?.meta?.variable_execution?.mode ?? receiptPayload.meta.variable_execution.mode) === 'VARIABLE_BY_ZONE',
    as_executed_created: Boolean(asExecuted?.as_executed_id),
    as_applied_created: Boolean(asApplied?.as_applied_id),
    as_executed_has_variable_execution: String(asExecuted?.executed?.variable_execution?.mode ?? '') === 'VARIABLE_BY_ZONE',
    as_applied_mode_variable_by_zone: String(asApplied?.application?.mode ?? '') === 'VARIABLE_BY_ZONE',
    as_applied_has_zone_applications: Array.isArray(zoneApplications),
    zone_applications_count_valid: zoneApplications.length === 2,
    zone_ids_preserved: zoneApplications.some((z) => z.zone_id === zoneLow.zone_id) && zoneApplications.some((z) => z.zone_id === zoneNormal.zone_id),
    zone_level_planned_amounts_preserved: zoneApplications.some((z) => Number(z.planned_amount) === 30) && zoneApplications.some((z) => Number(z.planned_amount) === 15),
    zone_level_applied_amounts_preserved: zoneApplications.some((z) => Number(z.applied_amount) === 29) && zoneApplications.some((z) => Number(z.applied_amount) === 15),
    zone_level_coverage_preserved: zoneApplications.some((z) => Number(z.coverage_percent) === 96) && zoneApplications.some((z) => Number(z.coverage_percent) === 98),
    zone_level_deviation_computed: zoneApplications.every((z) => typeof z.deviation_percent === 'number' && typeof z.deviation_amount === 'number'),
    total_planned_amount_computed: Number(asApplied?.application?.total_planned_amount) === 45,
    total_applied_amount_computed: Number(asApplied?.application?.total_applied_amount) === 44,
    avg_coverage_percent_computed: Number(asApplied?.application?.avg_coverage_percent) === 97,
    idempotent: createAgainJson.idempotent === true,
    openapi_contains_variable_as_applied_schema: Boolean(openapi.ok && openapi.json?.components?.schemas?.VariableExecutionV1 && openapi.json?.components?.schemas?.VariableZoneApplicationV1 && openapi.json?.components?.schemas?.AsAppliedApplicationV1),
  };

  Object.entries(checks).forEach(([k, v]) => assert.equal(v, true, `check failed: ${k}`));
  process.stdout.write(`${JSON.stringify({ ok: true, checks }, null, 2)}\n`);
  await pool.end();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
