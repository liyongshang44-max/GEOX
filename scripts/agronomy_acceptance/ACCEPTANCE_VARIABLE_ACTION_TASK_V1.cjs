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
  const pool = new Pool({ connectionString: env('DATABASE_URL', 'postgres://postgres:postgres@127.0.0.1:5432/geox') });
  const suffix = randomUUID().replace(/-/g, '').slice(0, 12);
  const operation_plan_id = `opl_variable_action_${suffix}`;

  try {
    const zoneLow = { tenant_id, project_id, group_id, zone_id: `zone_low_${suffix}`, zone_name: 'North low moisture zone', zone_type: 'IRRIGATION_ZONE', geometry: { type: 'Polygon', coordinates: [] }, area_ha: 3.2, risk_tags: ['LOW_MOISTURE'], agronomy_tags: ['SANDY_SOIL'], source_refs: ['judge_low'] };
    const zoneNormal = { tenant_id, project_id, group_id, zone_id: `zone_normal_${suffix}`, zone_name: 'South normal zone', zone_type: 'IRRIGATION_ZONE', geometry: { type: 'Polygon', coordinates: [] }, area_ha: 4.1, risk_tags: ['NORMAL'], agronomy_tags: ['BALANCED_SOIL'], source_refs: ['judge_normal'] };
    await fetchJson(`${base}/api/v1/fields/${encodeURIComponent(field_id)}/zones`, { method: 'POST', token, body: zoneLow }).catch(() => null);
    await fetchJson(`${base}/api/v1/fields/${encodeURIComponent(field_id)}/zones`, { method: 'POST', token, body: zoneNormal }).catch(() => null);

    const recJson = requireOk(await fetchJson(`${base}/api/v1/recommendations/generate`, { method: 'POST', token, body: { tenant_id, project_id, group_id, field_id, season_id, device_id, crop_code: 'corn', stage1_sensing_summary: { irrigation_effectiveness: 'low', leak_risk: 'low', canopy_temp_status: 'normal', evapotranspiration_risk: 'medium', sensor_quality_level: 'GOOD' }, image_recognition: { stress_score: 0.8, disease_score: 0.1, pest_risk_score: 0.1, confidence: 0.95 } } }), 'generate recommendation');
    const recommendation_id = String(recJson.recommendations?.[0]?.recommendation_id ?? '').trim();
    assert.ok(recommendation_id, 'recommendation_id missing');

    const prescriptionJson = requireOk(await fetchJson(`${base}/api/v1/prescriptions/variable/from-recommendation`, { method: 'POST', token, body: { tenant_id, project_id, group_id, recommendation_id, field_id, season_id, crop_id: 'corn', variable_plan: { mode: 'VARIABLE_BY_ZONE', zone_rates: [ { zone_id: zoneLow.zone_id, operation_type: 'IRRIGATION', planned_amount: 30, unit: 'mm', priority: 'HIGH', reason_codes: ['LOW_SOIL_MOISTURE'], source_refs: ['judge_low_moisture'] }, { zone_id: zoneNormal.zone_id, operation_type: 'IRRIGATION', planned_amount: 15, unit: 'mm', priority: 'MEDIUM', reason_codes: ['MODERATE_DEFICIT'], source_refs: ['judge_normal'] } ] } } }), 'create variable prescription');
    const prescription_id = String(prescriptionJson.prescription?.prescription_id ?? '').trim();
    assert.ok(prescription_id, 'prescription_id missing');

    const submitJson = requireOk(await fetchJson(`${base}/api/v1/prescriptions/${encodeURIComponent(prescription_id)}/submit-approval`, { method: 'POST', token, body: { tenant_id, project_id, group_id } }), 'submit prescription approval');
    const approval_request_id = String(submitJson.approval_request_id ?? '').trim();
    assert.ok(approval_request_id, 'approval_request_id missing');

    let approvalResp = await fetchJson(`${base}/api/v1/approvals/${encodeURIComponent(approval_request_id)}/decide`, { method: 'POST', token, body: { tenant_id, project_id, group_id, decision: 'APPROVE', reason: 'acceptance_variable_action_task_v1' } });
    if (!approvalResp.ok) approvalResp = await fetchJson(`${base}/api/v1/approvals/approve`, { method: 'POST', token, body: { request_id: approval_request_id, tenant_id, project_id, group_id, decision: 'APPROVE', reason: 'acceptance_variable_action_task_v1' } });
    requireOk(approvalResp, 'approve request');

    const taskJson = requireOk(await fetchJson(`${base}/api/v1/actions/task/from-variable-prescription`, { method: 'POST', token, body: { tenant_id, project_id, group_id, prescription_id, approval_request_id, operation_plan_id, device_id } }), 'create variable action task');
    assert.ok(String(taskJson.act_task_id ?? '').trim(), 'act_task_id missing');
    assert.equal(String(taskJson.operation_plan_status ?? ''), 'READY_TO_DISPATCH', 'route must not return ACKED');
    assert.equal(String(taskJson.ack_status ?? ''), 'ACK_REQUIRED', 'route must require executor ack');

    const taskQ = await pool.query(`SELECT record_json::jsonb AS record_json FROM facts WHERE (record_json::jsonb->>'type')='ao_act_task_v0' AND (record_json::jsonb#>>'{payload,operation_plan_id}')=$1 ORDER BY occurred_at DESC, fact_id DESC LIMIT 1`, [operation_plan_id]);
    const taskPayload = taskQ.rows?.[0]?.record_json?.payload ?? {};
    const parameterSource = taskPayload.meta?.parameter_source ?? {};
    assert.equal(String(taskPayload.meta?.task_lifecycle_status ?? ''), 'READY_TO_DISPATCH');
    assert.equal(String(taskPayload.meta?.ack_status ?? ''), 'ACK_REQUIRED');
    assert.equal(parameterSource.time_window, 'DEMO_DEFAULT');
    assert.equal(parameterSource.duration_sec, 'DEMO_DEFAULT');
    assert.equal(parameterSource.duration_min, 'DEMO_DEFAULT');
    assert.equal(parameterSource.coverage_percent, 'DEMO_DEFAULT');
    assert.equal(parameterSource.amount, 'FORMAL_PRESCRIPTION');

    const planQ = await pool.query(`SELECT record_json::jsonb AS record_json FROM facts WHERE (record_json::jsonb->>'type')='operation_plan_v1' AND (record_json::jsonb#>>'{payload,operation_plan_id}')=$1 ORDER BY occurred_at DESC, fact_id DESC LIMIT 1`, [operation_plan_id]);
    const planPayload = planQ.rows?.[0]?.record_json?.payload ?? {};
    const transitionQ = await pool.query(`SELECT record_json::jsonb AS record_json FROM facts WHERE (record_json::jsonb->>'type')='operation_plan_transition_v1' AND (record_json::jsonb#>>'{payload,operation_plan_id}')=$1 ORDER BY occurred_at DESC, fact_id DESC LIMIT 1`, [operation_plan_id]);
    const transitionPayload = transitionQ.rows?.[0]?.record_json?.payload ?? {};

    const checks = {
      operation_plan_not_auto_acked: String(planPayload.status ?? '') === 'READY_TO_DISPATCH' && String(planPayload.status ?? '') !== 'ACKED',
      operation_plan_transition_not_auto_acked: String(transitionPayload.to_status ?? transitionPayload.status ?? '') === 'READY_TO_DISPATCH' && String(transitionPayload.to_status ?? transitionPayload.status ?? '') !== 'ACKED',
      dispatch_ack_not_synthesized: String(planPayload.ack_status ?? '') === 'ACK_REQUIRED' && String(planPayload.dispatch_status ?? '') === 'NOT_DISPATCHED',
      exact_parameter_sources: parameterSource.time_window === 'DEMO_DEFAULT' && parameterSource.duration_sec === 'DEMO_DEFAULT' && parameterSource.duration_min === 'DEMO_DEFAULT' && parameterSource.coverage_percent === 'DEMO_DEFAULT' && parameterSource.amount === 'FORMAL_PRESCRIPTION',
    };
    Object.entries(checks).forEach(([k, v]) => assert.equal(Boolean(v), true, `check failed: ${k}`));
    process.stdout.write(`${JSON.stringify({ ok: true, checks }, null, 2)}\n`);
  } finally {
    await pool.end().catch(() => undefined);
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
