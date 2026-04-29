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

  const nowMs = Date.now();
  const operation_plan_id = `opl_variable_action_${nowMs}`;

  await pool.query(`ALTER TABLE derived_sensing_state_index_v1 ADD COLUMN IF NOT EXISTS project_id text`);
  await pool.query(`ALTER TABLE derived_sensing_state_index_v1 ADD COLUMN IF NOT EXISTS group_id text`);
  await pool.query(`ALTER TABLE derived_sensing_state_index_v1 ADD COLUMN IF NOT EXISTS source_observation_ids_json jsonb NOT NULL DEFAULT '[]'::jsonb`);

  await pool.query(
    `DELETE FROM derived_sensing_state_index_v1
      WHERE tenant_id=$1 AND field_id=$2 AND state_type='irrigation_effectiveness_state' AND (project_id=$3 OR project_id IS NULL) AND (group_id=$4 OR group_id IS NULL)`,
    [tenant_id, field_id, project_id, group_id]
  );
  await pool.query(
    `INSERT INTO derived_sensing_state_index_v1
      (tenant_id, project_id, group_id, field_id, state_type, payload_json, confidence, explanation_codes_json, source_device_ids_json, computed_at, computed_at_ts_ms, fact_id, source_observation_ids_json)
     VALUES
      ($1,$2,$3,$4,'irrigation_effectiveness_state','{"level":"LOW"}'::jsonb,0.9,'[]'::jsonb,'[]'::jsonb,now(),$5,$6,'["obs_variable_action_stage1"]'::jsonb)`,
    [tenant_id, project_id, group_id, field_id, nowMs, randomUUID()]
  );

  const zoneLow = {
    tenant_id, project_id, group_id,
    zone_id: 'zone_low_moisture_north', zone_name: 'North low moisture zone', zone_type: 'IRRIGATION_ZONE',
    geometry: { type: 'Polygon', coordinates: [] }, area_ha: 3.2,
    risk_tags: ['LOW_MOISTURE'], agronomy_tags: ['SANDY_SOIL'], source_refs: ['judge_low'],
  };
  const zoneNormal = {
    tenant_id, project_id, group_id,
    zone_id: 'zone_normal_south', zone_name: 'South normal zone', zone_type: 'IRRIGATION_ZONE',
    geometry: { type: 'Polygon', coordinates: [] }, area_ha: 4.1,
    risk_tags: ['NORMAL'], agronomy_tags: ['BALANCED_SOIL'], source_refs: ['judge_normal'],
  };
  requireOk(await fetchJson(`${base}/api/v1/fields/${encodeURIComponent(field_id)}/zones`, { method: 'POST', token, body: zoneLow }), 'create zone low');
  requireOk(await fetchJson(`${base}/api/v1/fields/${encodeURIComponent(field_id)}/zones`, { method: 'POST', token, body: zoneNormal }), 'create zone normal');

  const recJson = requireOk(await fetchJson(`${base}/api/v1/recommendations/generate`, {
    method: 'POST', token,
    body: {
      tenant_id, project_id, group_id, field_id, season_id, device_id, crop_code: 'corn',
      stage1_sensing_summary: {
        irrigation_effectiveness: 'low', leak_risk: 'low', canopy_temp_status: 'normal', evapotranspiration_risk: 'medium', sensor_quality_level: 'GOOD',
      },
      image_recognition: { stress_score: 0.8, disease_score: 0.1, pest_risk_score: 0.1, confidence: 0.95 },
    }
  }), 'generate recommendation');
  const recommendation = recJson.recommendations?.[0] ?? {};
  const recommendation_id = String(recommendation.recommendation_id ?? '').trim();
  assert.ok(recommendation_id, 'recommendation_id missing');

  const variablePrescriptionResp = await fetchJson(`${base}/api/v1/prescriptions/variable/from-recommendation`, {
    method: 'POST', token,
    body: {
      tenant_id, project_id, group_id, recommendation_id, field_id, season_id, crop_id: 'corn',
      variable_plan: {
        mode: 'VARIABLE_BY_ZONE',
        zone_rates: [
          { zone_id: zoneLow.zone_id, operation_type: 'IRRIGATION', planned_amount: 30, unit: 'mm', priority: 'HIGH', reason_codes: ['LOW_SOIL_MOISTURE'], source_refs: ['judge_low_moisture'] },
          { zone_id: zoneNormal.zone_id, operation_type: 'IRRIGATION', planned_amount: 15, unit: 'mm', priority: 'MEDIUM', reason_codes: ['MODERATE_DEFICIT'], source_refs: ['judge_normal'] },
        ],
      }
    }
  });
  const variablePrescriptionJson = requireOk(variablePrescriptionResp, 'create variable prescription');
  const prescription = variablePrescriptionJson.prescription ?? {};
  const prescription_id = String(prescription.prescription_id ?? '').trim();
  assert.ok(prescription_id, 'prescription_id missing');

  const submitApprovalJson = requireOk(await fetchJson(`${base}/api/v1/prescriptions/${encodeURIComponent(prescription_id)}/submit-approval`, {
    method: 'POST', token, body: { tenant_id, project_id, group_id }
  }), 'submit prescription approval');
  const approval_request_id = String(submitApprovalJson.approval_request_id ?? '').trim();
  assert.ok(approval_request_id, 'approval_request_id missing');

  let approvalDecideResp = await fetchJson(`${base}/api/v1/approvals/${encodeURIComponent(approval_request_id)}/decide`, {
    method: 'POST', token,
    body: { tenant_id, project_id, group_id, decision: 'APPROVE', reason: 'acceptance_variable_action_task_v1' }
  });
  if (!approvalDecideResp.ok) {
    approvalDecideResp = await fetchJson(`${base}/api/v1/approvals/approve`, {
      method: 'POST', token,
      body: { request_id: approval_request_id, tenant_id, project_id, group_id, decision: 'APPROVE', reason: 'acceptance_variable_action_task_v1' }
    });
  }
  const approvalDecideJson = requireOk(approvalDecideResp, 'approve request');

  const createTaskResp = await fetchJson(`${base}/api/v1/actions/task/from-variable-prescription`, {
    method: 'POST', token,
    body: { tenant_id, project_id, group_id, prescription_id, approval_request_id, operation_plan_id, device_id }
  });
  const createTaskJson = requireOk(createTaskResp, 'create variable action task');
  const act_task_id = String(createTaskJson.act_task_id ?? '').trim();
  const task_fact_id = String(createTaskJson.task_fact_id ?? '').trim();

  const factQuery = await pool.query(
    `SELECT fact_id, record_json::jsonb AS record_json
       FROM facts
      WHERE (record_json::jsonb->>'type')='ao_act_task_v0'
        AND (record_json::jsonb#>>'{payload,tenant_id}')=$1
        AND (record_json::jsonb#>>'{payload,project_id}')=$2
        AND (record_json::jsonb#>>'{payload,group_id}')=$3
        AND (record_json::jsonb#>>'{payload,operation_plan_id}')=$4
      ORDER BY occurred_at DESC, fact_id DESC
      LIMIT 1`,
    [tenant_id, project_id, group_id, operation_plan_id]
  );
  const taskFact = factQuery.rows?.[0] ?? null;
  const taskPayload = taskFact?.record_json?.payload ?? {};
  const taskParams = taskPayload.parameters ?? {};
  const schemaKeys = Array.isArray(taskPayload.parameter_schema?.keys) ? taskPayload.parameter_schema.keys : [];
  const paramNames = Object.keys(taskParams).sort();
  const schemaNames = schemaKeys.map((k) => k.name).sort();
  const primitiveOnly = Object.values(taskParams).every((v) => ['string', 'number', 'boolean'].includes(typeof v));

  const zoneRates = Array.isArray(taskPayload.meta?.variable_plan?.zone_rates) ? taskPayload.meta.variable_plan.zone_rates : [];
  const zoneIds = new Set(zoneRates.map((z) => String(z.zone_id ?? '')));

  const openapiResp = await fetchJson(`${base}/api/v1/openapi.json`, { method: 'GET', token });
  const openapi_contains_variable_action_task = Boolean(openapiResp.ok && openapiResp.json?.paths?.['/api/v1/actions/task/from-variable-prescription']);

  const checks = {
    variable_prescription_ready: Boolean(prescription_id && String(prescription.operation_amount?.mode ?? '') === 'VARIABLE_BY_ZONE'),
    approval_approved: Boolean(String(approvalDecideJson?.decision?.decision ?? approvalDecideJson?.decision ?? 'APPROVED').toUpperCase().includes('APPROV')),
    variable_action_task_created: Boolean(act_task_id && task_fact_id),
    task_parameters_are_primitive: primitiveOnly,
    task_parameter_schema_1_to_1: JSON.stringify(paramNames) === JSON.stringify(schemaNames),
    task_has_duration_sec: Number(taskParams.duration_sec) > 0,
    task_meta_has_variable_plan: String(taskPayload.meta?.variable_plan?.mode ?? '') === 'VARIABLE_BY_ZONE',
    task_meta_preserves_zone_rates: zoneRates.length === 2,
    task_meta_preserves_prescription_id: String(taskPayload.meta?.prescription_id ?? '') === prescription_id,
    task_meta_preserves_recommendation_id: String(taskPayload.meta?.recommendation_id ?? '') === recommendation_id,
    zone_ids_preserved: zoneIds.has(zoneLow.zone_id) && zoneIds.has(zoneNormal.zone_id),
    openapi_contains_variable_action_task,
  };

  Object.entries(checks).forEach(([k, v]) => assert.equal(v, true, `check failed: ${k}`));
  process.stdout.write(`${JSON.stringify({ ok: true, checks }, null, 2)}\n`);
  await pool.end();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
