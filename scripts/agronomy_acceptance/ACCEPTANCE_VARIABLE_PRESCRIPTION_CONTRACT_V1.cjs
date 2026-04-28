const { randomUUID } = require('node:crypto');
const { Pool } = require('pg');
const { assert, env, fetchJson, requireOk } = require('./_common.cjs');

(async () => {
  const base = env('BASE_URL', 'http://127.0.0.1:3001');
  const token = env('AO_ACT_TOKEN', '');
  const tenant_id = env('TENANT_ID', 'tenantA');
  const project_id = env('PROJECT_ID', 'projectA');
  const group_id = env('GROUP_ID', 'groupA');
  const field_id = env('FIELD_ID', `field_variable_${Date.now()}`);
  const season_id = env('SEASON_ID', 'season_demo');
  const device_id = env('DEVICE_ID', `dev_variable_${Date.now()}`);
  const databaseUrl = env('DATABASE_URL', 'postgres://postgres:postgres@127.0.0.1:5432/geox');
  const pool = new Pool({ connectionString: databaseUrl });

  const nowMs = Date.now();
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
      ($1,$2,$3,$4,'irrigation_effectiveness_state','{"level":"LOW"}'::jsonb,0.9,'[]'::jsonb,'[]'::jsonb,now(),$5,$6,'["obs_variable_stage1"]'::jsonb)`,
    [tenant_id, project_id, group_id, field_id, nowMs, randomUUID()]
  );

  const zoneLow = {
    tenant_id,
    project_id,
    group_id,
    zone_id: 'zone_low_moisture_north',
    zone_name: 'North low moisture zone',
    zone_type: 'IRRIGATION_ZONE',
    geometry: { type: 'Polygon', coordinates: [] },
    area_ha: 3.2,
    risk_tags: ['LOW_MOISTURE'],
    agronomy_tags: ['SANDY_SOIL'],
    source_refs: ['judge_low'],
  };
  const zoneNormal = {
    tenant_id,
    project_id,
    group_id,
    zone_id: 'zone_normal_south',
    zone_name: 'South normal zone',
    zone_type: 'IRRIGATION_ZONE',
    geometry: { type: 'Polygon', coordinates: [] },
    area_ha: 4.1,
    risk_tags: ['NORMAL'],
    agronomy_tags: ['BALANCED_SOIL'],
    source_refs: ['judge_normal'],
  };

  const createZoneLowResp = await fetchJson(`${base}/api/v1/fields/${encodeURIComponent(field_id)}/zones`, { method: 'POST', token, body: zoneLow });
  requireOk(createZoneLowResp, 'create zone low moisture');
  const createZoneNormalResp = await fetchJson(`${base}/api/v1/fields/${encodeURIComponent(field_id)}/zones`, { method: 'POST', token, body: zoneNormal });
  requireOk(createZoneNormalResp, 'create zone normal');

  const listZonesResp = await fetchJson(`${base}/api/v1/fields/${encodeURIComponent(field_id)}/zones?tenant_id=${encodeURIComponent(tenant_id)}&project_id=${encodeURIComponent(project_id)}&group_id=${encodeURIComponent(group_id)}`, { method: 'GET', token });
  const listZonesJson = requireOk(listZonesResp, 'list zones');

  const recGen = await fetchJson(`${base}/api/v1/recommendations/generate`, {
    method: 'POST',
    token,
    body: {
      tenant_id,
      project_id,
      group_id,
      field_id,
      season_id,
      device_id,
      crop_code: 'corn',
      stage1_sensing_summary: {
        irrigation_effectiveness: 'low',
        leak_risk: 'low',
        canopy_temp_status: 'normal',
        evapotranspiration_risk: 'medium',
        sensor_quality_level: 'GOOD',
      },
      image_recognition: { stress_score: 0.8, disease_score: 0.1, pest_risk_score: 0.1, confidence: 0.95 },
    },
  });
  const recJson = requireOk(recGen, 'generate recommendation');
  const recommendation = recJson.recommendations?.[0] ?? {};
  const recommendation_id = String(recommendation.recommendation_id ?? '').trim();
  assert.ok(recommendation_id, 'recommendation_id missing');
  const recommendation_has_skill_trace = Boolean(recommendation.skill_trace && recommendation.skill_trace.skill_id);

  const variableReqBody = {
    tenant_id,
    project_id,
    group_id,
    recommendation_id,
    field_id,
    season_id,
    crop_id: 'corn',
    variable_plan: {
      mode: 'VARIABLE_BY_ZONE',
      zone_rates: [
        {
          zone_id: zoneLow.zone_id,
          operation_type: 'IRRIGATION',
          planned_amount: 30,
          unit: 'mm',
          priority: 'HIGH',
          reason_codes: ['LOW_SOIL_MOISTURE'],
          source_refs: ['judge_low_moisture'],
        },
        {
          zone_id: zoneNormal.zone_id,
          operation_type: 'IRRIGATION',
          planned_amount: 15,
          unit: 'mm',
          priority: 'MEDIUM',
          reason_codes: ['MODERATE_DEFICIT'],
          source_refs: ['judge_normal'],
        },
      ],
    },
  };

  const createVariableResp = await fetchJson(`${base}/api/v1/prescriptions/variable/from-recommendation`, {
    method: 'POST',
    token,
    body: variableReqBody,
  });
  const createVariableJson = requireOk(createVariableResp, 'create variable prescription');
  const prescription_id = String(createVariableJson.prescription?.prescription_id ?? '').trim();
  assert.ok(prescription_id, 'prescription_id missing');

  const readResp = await fetchJson(`${base}/api/v1/prescriptions/${encodeURIComponent(prescription_id)}?tenant_id=${encodeURIComponent(tenant_id)}&project_id=${encodeURIComponent(project_id)}&group_id=${encodeURIComponent(group_id)}`, { method: 'GET', token });
  const readJson = requireOk(readResp, 'read prescription');

  const createVariableAgainResp = await fetchJson(`${base}/api/v1/prescriptions/variable/from-recommendation`, {
    method: 'POST',
    token,
    body: variableReqBody,
  });
  const createVariableAgainJson = requireOk(createVariableAgainResp, 'idempotent variable prescription');

  const openapiResp = await fetchJson(`${base}/api/v1/openapi.json`, { method: 'GET', token });
  const openapiContainsVariablePrescription = Boolean(
    openapiResp.ok
      && openapiResp.json?.paths?.['/api/v1/prescriptions/variable/from-recommendation']
      && openapiResp.json?.components?.schemas?.VariablePrescriptionPlanV1
      && openapiResp.json?.components?.schemas?.VariableZoneRateV1
  );

  const listItems = Array.isArray(listZonesJson.items) ? listZonesJson.items : [];
  const zoneIds = new Set(listItems.map((item) => item.zone_id));
  const prescription = readJson.prescription ?? {};
  const zoneRates = Array.isArray(prescription.operation_amount?.zone_rates) ? prescription.operation_amount.zone_rates : [];

  const checks = {
    management_zones_ready: Boolean(zoneIds.has(zoneLow.zone_id) && zoneIds.has(zoneNormal.zone_id)),
    recommendation_has_skill_trace,
    variable_prescription_created: Boolean(prescription_id),
    variable_prescription_idempotent: Boolean(createVariableAgainJson.idempotent === true),
    operation_amount_mode_variable_by_zone: String(prescription.operation_amount?.mode ?? '') === 'VARIABLE_BY_ZONE',
    zone_rates_count_valid: zoneRates.length === 2,
    zone_ids_match_management_zones: Boolean(zoneRates.every((z) => zoneIds.has(z.zone_id))),
    spatial_scope_mode_management_zone: String(prescription.spatial_scope?.mode ?? '') === 'MANAGEMENT_ZONE',
    device_requires_variable_rate: Boolean(prescription.device_requirements?.variable_rate_required === true),
    approval_required: Boolean(prescription.approval_requirement?.required === true),
    acceptance_conditions_zone_level: Boolean(prescription.acceptance_conditions?.zone_level_required === true),
    skill_trace_preserved: Boolean(prescription.skill_trace && prescription.skill_trace.skill_id),
    openapi_contains_variable_prescription: openapiContainsVariablePrescription,
  };

  Object.entries(checks).forEach(([k, v]) => assert.equal(v, true, `check failed: ${k}`));
  process.stdout.write(`${JSON.stringify({ ok: true, checks }, null, 2)}\n`);
  await pool.end();
})().catch(async (err) => {
  console.error(err);
  process.exit(1);
});
