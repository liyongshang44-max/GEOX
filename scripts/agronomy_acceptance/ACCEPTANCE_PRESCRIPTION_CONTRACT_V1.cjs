const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const { Pool } = require('pg');
const { assert, env, fetchJson, requireOk } = require('./_common.cjs');

(async () => {
  const base = env('BASE_URL', 'http://127.0.0.1:3001');
  const token = env('AO_ACT_TOKEN', '');
  const tenant_id = env('TENANT_ID', 'tenantA');
  const project_id = env('PROJECT_ID', 'projectA');
  const group_id = env('GROUP_ID', 'groupA');
  const field_id = env('FIELD_ID', 'field_demo_1');
  const season_id = env('SEASON_ID', 'season_demo_1');
  const databaseUrl = env('DATABASE_URL', 'postgres://postgres:postgres@127.0.0.1:5432/geox');
  const pool = new Pool({ connectionString: databaseUrl });

  const healthz = await fetchJson(`${base}/api/admin/healthz`, { method: 'GET', token });
  const healthzOk = healthz.ok && healthz.json && healthz.json.ok === true && !(healthz.json.missing_tables || []).includes('prescription_contract_v1');

  const openapi = await fetchJson(`${base}/api/v1/openapi.json`, { method: 'GET', token });
  const openapiContainsPrescriptionPaths = Boolean(
    openapi.ok &&
    openapi.json &&
    openapi.json.paths &&
    openapi.json.paths['/api/v1/prescriptions/from-recommendation']
  );

  // Seed formal Stage1 summary source fields so /recommendations/generate can pass
  // FORMAL_STAGE1_TRIGGER_NOT_ELIGIBLE boundary with current strict Stage1 contract.
  await pool.query(
    `CREATE TABLE IF NOT EXISTS field_sensing_overview_v1 (
      tenant_id text NOT NULL,
      project_id text NULL,
      group_id text NULL,
      field_id text NOT NULL,
      observed_at_ts_ms bigint NULL,
      freshness text NOT NULL DEFAULT 'fresh',
      confidence double precision NULL,
      soil_indicators_json jsonb NOT NULL DEFAULT '[]'::jsonb,
      irrigation_need_level text NULL,
      sensor_quality_level text NULL,
      canopy_temp_status text NULL,
      evapotranspiration_risk text NULL,
      sensor_quality text NULL,
      irrigation_effectiveness text NULL,
      leak_risk text NULL,
      irrigation_action_hint text NULL,
      computed_at_ts_ms bigint NULL,
      source_observed_at_ts_ms bigint NULL,
      explanation_codes_json jsonb NOT NULL DEFAULT '[]'::jsonb,
      source_observation_ids_json jsonb NOT NULL DEFAULT '[]'::jsonb,
      updated_ts_ms bigint NOT NULL,
      PRIMARY KEY (tenant_id, field_id)
    )`
  );
  const nowMs = Date.now();
  await pool.query(
    `INSERT INTO field_sensing_overview_v1
      (tenant_id, project_id, group_id, field_id, observed_at_ts_ms, freshness, confidence, soil_indicators_json, sensor_quality_level, canopy_temp_status, evapotranspiration_risk, irrigation_effectiveness, leak_risk, irrigation_action_hint, computed_at_ts_ms, source_observed_at_ts_ms, explanation_codes_json, source_observation_ids_json, updated_ts_ms)
     VALUES
      ($1,$2,$3,$4,$5,'fresh',0.93,'[]'::jsonb,'GOOD','normal','medium','low','low','irrigate_first',$5,$5,'[]'::jsonb,'[]'::jsonb,$5)
     ON CONFLICT (tenant_id, field_id)
     DO UPDATE SET
      project_id = EXCLUDED.project_id,
      group_id = EXCLUDED.group_id,
      observed_at_ts_ms = EXCLUDED.observed_at_ts_ms,
      freshness = EXCLUDED.freshness,
      confidence = EXCLUDED.confidence,
      soil_indicators_json = EXCLUDED.soil_indicators_json,
      sensor_quality_level = EXCLUDED.sensor_quality_level,
      canopy_temp_status = EXCLUDED.canopy_temp_status,
      evapotranspiration_risk = EXCLUDED.evapotranspiration_risk,
      irrigation_effectiveness = EXCLUDED.irrigation_effectiveness,
      leak_risk = EXCLUDED.leak_risk,
      irrigation_action_hint = EXCLUDED.irrigation_action_hint,
      computed_at_ts_ms = EXCLUDED.computed_at_ts_ms,
      source_observed_at_ts_ms = EXCLUDED.source_observed_at_ts_ms,
      explanation_codes_json = EXCLUDED.explanation_codes_json,
      source_observation_ids_json = EXCLUDED.source_observation_ids_json,
      updated_ts_ms = EXCLUDED.updated_ts_ms`,
    [tenant_id, project_id, group_id, field_id, nowMs]
  );

  const gen = await fetchJson(`${base}/api/v1/recommendations/generate`, {
    method: 'POST',
    token,
    body: {
      tenant_id,
      project_id,
      group_id,
      field_id,
      season_id,
      device_id: env('DEVICE_ID', `device_prescription_${Date.now()}`),
      crop_code: 'corn',
      stage1_sensing_summary: {
        irrigation_effectiveness: 'low',
        leak_risk: 'low',
        canopy_temp_status: 'normal',
        evapotranspiration_risk: 'medium',
        sensor_quality_level: 'GOOD',
      },
      image_recognition: { stress_score: 0.72, disease_score: 0.1, pest_risk_score: 0.1, confidence: 0.95 },
    },
  });
  const genJson = requireOk(gen, 'generate recommendation for prescription');
  const recommendation_id = String(genJson.recommendations?.[0]?.recommendation_id ?? '').trim();
  assert.ok(recommendation_id, 'recommendation_id missing');

  const fromRecommendationBody = {
    recommendation_id,
    tenant_id,
    project_id,
    group_id,
    field_id,
    season_id,
    crop_id: env('CROP_ID', 'corn'),
    zone_id: null,
  };

  const fieldMismatch = await fetchJson(`${base}/api/v1/prescriptions/from-recommendation`, {
    method: 'POST',
    token,
    body: { ...fromRecommendationBody, field_id: `${field_id}_mismatch` },
  });

  const seededCrossScopePrescriptionId = `prc_seed_${Date.now()}`;
  const crossScopeProjectId = 'project_scope_other';
  const crossScopeGroupId = 'group_scope_other';
  await pool.query(
    `INSERT INTO prescription_contract_v1
      (prescription_id, recommendation_id, tenant_id, project_id, group_id, field_id, season_id, crop_id, zone_id, operation_type, spatial_scope, timing_window, operation_amount, device_requirements, risk, evidence_refs, approval_requirement, acceptance_conditions, status, created_at, updated_at, created_by)
     VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8,NULL,'IRRIGATION','{}'::jsonb,'{}'::jsonb,'{\"amount\":25,\"unit\":\"mm\"}'::jsonb,'{}'::jsonb,'{\"level\":\"MEDIUM\",\"reasons\":[]}'::jsonb,'[]'::jsonb,'{\"required\":true}'::jsonb,'{\"evidence_required\":[\"receipt\"]}'::jsonb,'READY_FOR_APPROVAL',NOW(),NOW(),'acceptance_seed')
     ON CONFLICT (tenant_id, project_id, group_id, recommendation_id) DO UPDATE SET updated_at = NOW()`,
    [seededCrossScopePrescriptionId, recommendation_id, tenant_id, crossScopeProjectId, crossScopeGroupId, field_id, season_id, 'corn']
  );

  const create = await fetchJson(`${base}/api/v1/prescriptions/from-recommendation`, {
    method: 'POST',
    token,
    body: fromRecommendationBody,
  });
  const createJson = requireOk(create, 'create prescription from recommendation');
  const prescription = createJson.prescription;
  const prescription_id = String(prescription?.prescription_id ?? '').trim();
  assert.ok(prescription_id, 'prescription_id missing');
  const idempotencyScoped = prescription_id !== seededCrossScopePrescriptionId;

  const checkShape = Boolean(
    prescription &&
    prescription.recommendation_id === recommendation_id &&
    prescription.tenant_id === tenant_id &&
    prescription.field_id === field_id &&
    prescription.operation_type &&
    prescription.operation_amount &&
    prescription.risk &&
    Array.isArray(prescription.evidence_refs) &&
    prescription.approval_requirement &&
    prescription.acceptance_conditions &&
    prescription.status
  );

  const createAgain = await fetchJson(`${base}/api/v1/prescriptions/from-recommendation`, {
    method: 'POST',
    token,
    body: fromRecommendationBody,
  });
  const createAgainJson = requireOk(createAgain, 'idempotent create prescription from recommendation');

  const readById = await fetchJson(`${base}/api/v1/prescriptions/${encodeURIComponent(prescription_id)}`, { method: 'GET', token });
  const readByIdJson = requireOk(readById, 'read prescription by id');
  const crossProjectRead = await fetchJson(
    `${base}/api/v1/prescriptions/${encodeURIComponent(prescription_id)}?tenant_id=${encodeURIComponent(tenant_id)}&project_id=${encodeURIComponent(crossScopeProjectId)}&group_id=${encodeURIComponent(group_id)}`,
    { method: 'GET', token }
  );

  const readByRecommendation = await fetchJson(`${base}/api/v1/prescriptions/by-recommendation/${encodeURIComponent(recommendation_id)}`, { method: 'GET', token });
  const readByRecommendationJson = requireOk(readByRecommendation, 'read prescription by recommendation');

  const submitApproval = await fetchJson(`${base}/api/v1/prescriptions/${encodeURIComponent(prescription_id)}/submit-approval`, {
    method: 'POST',
    token,
    body: { tenant_id, project_id, group_id },
  });
  const submitApprovalJson = requireOk(submitApproval, 'submit prescription approval');
  const approval_request_id = String(submitApprovalJson.approval_request_id ?? '').trim();
  const latestStatus = String(submitApprovalJson.prescription?.status ?? '').trim();
  const submitApprovalDuplicate = await fetchJson(`${base}/api/v1/prescriptions/${encodeURIComponent(prescription_id)}/submit-approval`, {
    method: 'POST',
    token,
    body: { tenant_id, project_id, group_id },
  });
  const approvalSingletonQuery = await pool.query(
    `SELECT COUNT(*)::int AS c
     FROM facts
     WHERE (record_json::jsonb->>'type')='approval_request_v1'
       AND (record_json::jsonb#>>'{payload,tenant_id}')=$1
       AND (record_json::jsonb#>>'{payload,project_id}')=$2
       AND (record_json::jsonb#>>'{payload,group_id}')=$3
       AND (record_json::jsonb#>>'{payload,proposal,meta,prescription_id}')=$4`,
    [tenant_id, project_id, group_id, prescription_id]
  );
  const approvalRequestCount = Number(approvalSingletonQuery.rows?.[0]?.c ?? 0);

  const draftRecommendationId = `rec_prescription_draft_${Date.now()}`;
  const draftFactId = randomUUID();
  await pool.query(
    'INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, NOW(), $2, $3::jsonb)',
    [
      draftFactId,
      'scripts/agronomy_acceptance/prescription_contract_v1',
      {
        type: 'decision_recommendation_v1',
        payload: {
          tenant_id,
          project_id,
          group_id,
          recommendation_id: draftRecommendationId,
          recommendation_type: 'fertilization_recommendation_v1',
          action_type: 'FERTILIZE',
          field_id,
          season_id,
          crop_code: 'corn',
          evidence_refs: ['fact:draft-recommendation'],
          suggested_action: {
            action_type: 'fertilization.apply',
            summary: 'Draft fertilization dotted-action prescription without amount for acceptance negative check',
            parameters: {},
          },
        },
      },
    ],
  );

  const createDraft = await fetchJson(`${base}/api/v1/prescriptions/from-recommendation`, {
    method: 'POST',
    token,
    body: {
      recommendation_id: draftRecommendationId,
      tenant_id,
      project_id,
      group_id,
      field_id,
      season_id,
      crop_id: 'corn',
      zone_id: null,
    },
  });
  const createDraftJson = requireOk(createDraft, 'create draft prescription from fertilization recommendation without amount');
  const draftPrescriptionId = String(createDraftJson.prescription?.prescription_id ?? '').trim();
  assert.ok(draftPrescriptionId, 'draft prescription_id missing');
  assert.equal(String(createDraftJson.prescription?.status ?? ''), 'DRAFT', 'draft prescription should be DRAFT');
  assert.equal(String(createDraftJson.prescription?.operation_type ?? ''), 'FERTILIZATION', 'dotted fertilization should map to FERTILIZATION');
  assert.equal(String(createDraftJson.prescription?.risk?.level ?? ''), 'HIGH', 'dotted fertilization missing amount should be HIGH risk');
  assert.equal(Boolean(createDraftJson.prescription?.approval_requirement?.second_confirmation_required), true, 'dotted fertilization should require second confirmation');

  const submitDraft = await fetchJson(`${base}/api/v1/prescriptions/${encodeURIComponent(draftPrescriptionId)}/submit-approval`, {
    method: 'POST',
    token,
    body: { tenant_id, project_id, group_id },
  });

  const readDraftAfterSubmit = await fetchJson(`${base}/api/v1/prescriptions/${encodeURIComponent(draftPrescriptionId)}`, { method: 'GET', token });
  const readDraftAfterSubmitJson = requireOk(readDraftAfterSubmit, 'read draft prescription after blocked submit');
  const scopeFixMigrationSql = fs.readFileSync('apps/server/db/migrations/2026_04_24_prescription_contract_v1_scope_fix.sql', 'utf8');
  const scopeMigrationNoHardcodedDefault = !scopeFixMigrationSql.includes('projectA') && !scopeFixMigrationSql.includes('groupA');

  const out = {
    ok: true,
    prescription_id,
    recommendation_id,
    approval_request_id,
    draft_prescription_id: draftPrescriptionId,
    checks: {
      created: Boolean(prescription_id),
      idempotent: String(createAgainJson.prescription?.prescription_id ?? '') === prescription_id,
      read_by_id: String(readByIdJson.prescription?.prescription_id ?? '') === prescription_id,
      read_by_recommendation: String(readByRecommendationJson.prescription?.prescription_id ?? '') === prescription_id,
      approval_submitted: Boolean(approval_request_id) && latestStatus === 'APPROVAL_REQUESTED',
      contract_shape_valid: checkShape,
      draft_submit_blocked: submitDraft.status === 400 && submitDraft.json?.error === 'PRESCRIPTION_NOT_READY_FOR_APPROVAL',
      draft_status_preserved: String(readDraftAfterSubmitJson.prescription?.status ?? '') === 'DRAFT',
      fertilization_dotted_operation_type: String(createDraftJson.prescription?.operation_type ?? '') === 'FERTILIZATION',
      fertilization_dotted_risk_high: String(createDraftJson.prescription?.risk?.level ?? '') === 'HIGH',
      fertilization_dotted_second_confirmation: Boolean(createDraftJson.prescription?.approval_requirement?.second_confirmation_required) === true,
      field_mismatch_blocked: fieldMismatch.status === 400 && fieldMismatch.json?.error === 'PRESCRIPTION_FIELD_MISMATCH',
      cross_project_read_blocked: crossProjectRead.status === 404 && crossProjectRead.json?.error === 'NOT_FOUND',
      idempotency_scoped: idempotencyScoped,
      duplicate_submit_blocked: submitApprovalDuplicate.status === 400 && submitApprovalDuplicate.json?.error === 'PRESCRIPTION_NOT_READY_FOR_APPROVAL',
      approval_request_singleton: approvalRequestCount === 1,
      scope_migration_no_hardcoded_default: scopeMigrationNoHardcodedDefault,
      healthz_ok: Boolean(healthzOk),
      openapi_contains_prescription_paths: Boolean(openapiContainsPrescriptionPaths),
    },
  };

  console.log(JSON.stringify(out, null, 2));

  assert.equal(out.checks.created, true, 'created failed');
  assert.equal(out.checks.idempotent, true, 'idempotent failed');
  assert.equal(out.checks.read_by_id, true, 'read by id failed');
  assert.equal(out.checks.read_by_recommendation, true, 'read by recommendation failed');
  assert.equal(out.checks.approval_submitted, true, 'approval submit failed');
  assert.equal(out.checks.contract_shape_valid, true, 'contract shape failed');
  assert.equal(out.checks.draft_submit_blocked, true, `draft submit blocked failed status=${submitDraft.status} body=${submitDraft.text}`);
  assert.equal(out.checks.draft_status_preserved, true, 'draft status preserved failed');
  assert.equal(out.checks.fertilization_dotted_operation_type, true, 'fertilization dotted operation_type failed');
  assert.equal(out.checks.fertilization_dotted_risk_high, true, 'fertilization dotted risk level failed');
  assert.equal(out.checks.fertilization_dotted_second_confirmation, true, 'fertilization dotted second confirmation failed');
  assert.equal(out.checks.field_mismatch_blocked, true, `field mismatch blocked failed status=${fieldMismatch.status} body=${fieldMismatch.text}`);
  assert.equal(out.checks.cross_project_read_blocked, true, `cross project read blocked failed status=${crossProjectRead.status} body=${crossProjectRead.text}`);
  assert.equal(out.checks.idempotency_scoped, true, 'idempotency scoped failed');
  assert.equal(out.checks.duplicate_submit_blocked, true, `duplicate submit blocked failed status=${submitApprovalDuplicate.status} body=${submitApprovalDuplicate.text}`);
  assert.equal(out.checks.approval_request_singleton, true, `approval request singleton failed count=${approvalRequestCount}`);
  assert.equal(out.checks.scope_migration_no_hardcoded_default, true, 'scope migration contains hardcoded defaults');
  assert.equal(out.checks.healthz_ok, true, `healthz check failed status=${healthz.status} body=${healthz.text}`);
  assert.equal(out.checks.openapi_contains_prescription_paths, true, 'openapi missing prescription path');
  await pool.end();
})().catch((e) => {
  console.error(JSON.stringify({ ok: false, error: e?.message ?? String(e) }, null, 2));
  if (e?.stack) console.error(e.stack);
  process.exit(1);
});
