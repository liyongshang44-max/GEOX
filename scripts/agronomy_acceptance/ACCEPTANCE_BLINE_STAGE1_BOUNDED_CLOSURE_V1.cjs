#!/usr/bin/env node
const { Pool } = require('pg');
const { assert, env, fetchJson, requireOk, waitForHealth } = require('./_common.cjs');
const { seedFormalIrrigationStage1Evidence } = require('./_stage1_formal_irrigation_fixture.cjs');

const RUNTIME_ROLE = 'geox_runtime_v1';

function scenarioIds(label) {
  const suffix = `${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
  return {
    field_id: `field_bline_stage1_${label}_${suffix}`,
    season_id: `season_bline_stage1_${label}_${suffix}`,
    device_id: `device_bline_stage1_${label}_${suffix}`,
  };
}

function generateBody(scope) {
  return {
    tenant_id: scope.tenant_id,
    project_id: scope.project_id,
    group_id: scope.group_id,
    field_id: scope.field_id,
    season_id: scope.season_id,
    device_id: scope.device_id,
    crop_code: 'corn',
    stage1_sensing_summary: {
      irrigation_effectiveness: 'low',
      leak_risk: 'low',
      canopy_temp_status: 'normal',
      evapotranspiration_risk: 'high',
      sensor_quality_level: 'GOOD',
    },
    image_recognition: {
      stress_score: 0.6,
      disease_score: 0.1,
      pest_risk_score: 0.1,
      confidence: 0.9,
    },
  };
}

async function seedScenario(pool, baseScope, label, sample_mode = 'formal') {
  const ids = scenarioIds(label);
  const scope = { ...baseScope, ...ids };
  await seedFormalIrrigationStage1Evidence(pool, {
    ...scope,
    now_ms: Date.now(),
    sample_mode,
    crop_code: 'corn',
    crop_stage: 'V8',
  });
  return scope;
}

async function assertSchemaBoundary(pool) {
  const result = await pool.query(
    `SELECT
       pg_catalog.to_regclass('public.field_sensing_overview_v1')::text AS overview_relation,
       pg_catalog.to_regclass('public.field_sensing_summary_stage1_v1')::text AS summary_relation,
       pg_catalog.to_regclass('public.idx_field_sensing_overview_v1_scope')::text AS overview_scope_index,
       pg_catalog.has_schema_privilege($1, 'public', 'CREATE') AS runtime_can_create_public,
       pg_catalog.has_table_privilege($1, 'public.field_sensing_overview_v1', 'SELECT') AS runtime_can_select_overview,
       pg_catalog.has_table_privilege($1, 'public.field_sensing_overview_v1', 'INSERT') AS runtime_can_insert_overview,
       pg_catalog.has_table_privilege($1, 'public.field_sensing_overview_v1', 'UPDATE') AS runtime_can_update_overview,
       pg_catalog.has_table_privilege($1, 'public.field_sensing_overview_v1', 'DELETE') AS runtime_can_delete_overview`,
    [RUNTIME_ROLE],
  );
  const row = result.rows?.[0] ?? {};
  assert.equal(row.overview_relation, 'field_sensing_overview_v1', 'Stage1 overview relation must be preprovisioned');
  assert.equal(row.summary_relation, 'field_sensing_summary_stage1_v1', 'Stage1 summary relation must be preprovisioned');
  assert.equal(row.overview_scope_index, 'idx_field_sensing_overview_v1_scope', 'Stage1 overview scope index must be preprovisioned');
  assert.equal(row.runtime_can_create_public, false, 'geox_runtime_v1 must not have CREATE on public');
  assert.equal(row.runtime_can_select_overview, true, 'geox_runtime_v1 must SELECT Stage1 overview');
  assert.equal(row.runtime_can_insert_overview, true, 'geox_runtime_v1 must INSERT Stage1 overview');
  assert.equal(row.runtime_can_update_overview, true, 'geox_runtime_v1 must UPDATE Stage1 overview');
  assert.equal(row.runtime_can_delete_overview, true, 'geox_runtime_v1 must DELETE Stage1 overview');
  return row;
}

async function assertExactDeviceStatusIdentity(pool, scope) {
  const result = await pool.query(
    `SELECT tenant_id, project_id, group_id, field_id, device_id,
            last_telemetry_ts_ms, last_heartbeat_ts_ms
       FROM device_status_index_v1
      WHERE tenant_id = $1 AND device_id = $2`,
    [scope.tenant_id, scope.device_id],
  );
  assert.equal(result.rowCount, 1, 'formal fixture must create exactly one device status row');
  const row = result.rows[0];
  assert.equal(String(row.project_id ?? ''), scope.project_id, 'device status project identity mismatch');
  assert.equal(String(row.group_id ?? ''), scope.group_id, 'device status group identity mismatch');
  assert.equal(String(row.field_id ?? ''), scope.field_id, 'device status field identity mismatch');
  assert.equal(String(row.device_id ?? ''), scope.device_id, 'device status device identity mismatch');
  assert.ok(Number(row.last_telemetry_ts_ms) > 0, 'device status telemetry timestamp missing');
  assert.ok(Number(row.last_heartbeat_ts_ms) > 0, 'device status heartbeat timestamp missing');
  return row;
}

async function postGenerate(base, token, scope) {
  return fetchJson(`${base}/api/v1/recommendations/generate`, {
    method: 'POST',
    token,
    body: generateBody(scope),
  });
}

(async () => {
  const base = env('BASE_URL', 'http://127.0.0.1:3001');
  const token = env('AO_ACT_TOKEN', '');
  const databaseUrl = env('DATABASE_URL', '');
  const tenant_id = env('TENANT_ID', 'tenantA');
  const project_id = env('PROJECT_ID', 'projectA');
  const group_id = env('GROUP_ID', 'groupA');

  assert.ok(token, 'AO_ACT_TOKEN is required');
  assert.ok(databaseUrl, 'DATABASE_URL is required');
  await waitForHealth(base);

  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const schema_boundary = await assertSchemaBoundary(pool);
    const baseScope = { tenant_id, project_id, group_id };

    const formalScope = await seedScenario(pool, baseScope, 'formal', 'formal');
    const formal_device_status = await assertExactDeviceStatusIdentity(pool, formalScope);
    const formalResp = await postGenerate(base, token, formalScope);
    const formalJson = requireOk(formalResp, 'formal+sufficient Stage1 must be admitted');
    assert.ok(Array.isArray(formalJson.recommendations) && formalJson.recommendations.length > 0, 'formal+sufficient Stage1 must generate recommendation');

    const insufficientScope = await seedScenario(pool, baseScope, 'insufficient', 'insufficient');
    await assertExactDeviceStatusIdentity(pool, insufficientScope);
    const insufficientResp = await postGenerate(base, token, insufficientScope);
    assert.equal(insufficientResp.ok, false, 'insufficient Stage1 evidence must be blocked');
    assert.equal(insufficientResp.status, 400, 'insufficient Stage1 evidence must return HTTP 400');
    assert.equal(String(insufficientResp.json?.error ?? ''), 'FORMAL_STAGE1_TRIGGER_NEEDS_EVIDENCE', `unexpected insufficient error: ${insufficientResp.text}`);

    const staleScope = await seedScenario(pool, baseScope, 'stale', 'stale');
    await assertExactDeviceStatusIdentity(pool, staleScope);
    const staleResp = await postGenerate(base, token, staleScope);
    assert.equal(staleResp.ok, false, 'stale Stage1 evidence must be blocked');
    assert.equal(staleResp.status, 400, 'stale Stage1 evidence must return HTTP 400');
    assert.equal(String(staleResp.json?.error ?? ''), 'FORMAL_STAGE1_TRIGGER_NEEDS_EVIDENCE', `unexpected stale error: ${staleResp.text}`);

    const noFormalScope = await seedScenario(pool, baseScope, 'noformal', 'formal');
    await assertExactDeviceStatusIdentity(pool, noFormalScope);
    await pool.query(
      `UPDATE derived_sensing_state_index_v1
          SET payload_json = jsonb_set(
            jsonb_set(payload_json, '{level}', '"MEDIUM"'::jsonb, true),
            '{irrigation_effectiveness}', '"medium"'::jsonb, true
          )
        WHERE tenant_id = $1
          AND project_id = $2
          AND group_id = $3
          AND field_id = $4
          AND state_type = 'irrigation_effectiveness_state'`,
      [tenant_id, project_id, group_id, noFormalScope.field_id],
    );
    const noFormalResp = await postGenerate(base, token, noFormalScope);
    assert.equal(noFormalResp.ok, false, 'no-formal-signal Stage1 must be blocked');
    assert.equal(noFormalResp.status, 400, 'no-formal-signal Stage1 must return HTTP 400');
    assert.equal(String(noFormalResp.json?.error ?? ''), 'FORMAL_STAGE1_TRIGGER_NOT_ELIGIBLE', `unexpected no-formal error: ${noFormalResp.text}`);

    process.stdout.write(`${JSON.stringify({
      ok: true,
      task: 'BLINE_COMMERCIAL_MVP0_STAGE1_BOUNDED_CLOSURE_V1',
      checks: {
        stage1_overview_relation_preprovisioned: 'PASS',
        stage1_summary_relation_preprovisioned: 'PASS',
        stage1_overview_scope_index_preprovisioned: 'PASS',
        runtime_create_public_forbidden: 'PASS',
        runtime_overview_dml_granted: 'PASS',
        formal_fixture_exact_field_device_status: 'PASS',
        formal_sufficient_admitted: 'PASS',
        insufficient_maps_to_needs_evidence: 'PASS',
        stale_maps_to_needs_evidence: 'PASS',
        no_formal_signal_maps_to_not_eligible: 'PASS',
      },
      schema_boundary,
      formal_device_status: {
        tenant_id: formal_device_status.tenant_id,
        project_id: formal_device_status.project_id,
        group_id: formal_device_status.group_id,
        field_id: formal_device_status.field_id,
        device_id: formal_device_status.device_id,
      },
      scenarios: {
        formal: { field_id: formalScope.field_id, http_status: formalResp.status },
        insufficient: { field_id: insufficientScope.field_id, http_status: insufficientResp.status, error: insufficientResp.json?.error ?? null, reason_codes: insufficientResp.json?.reason_codes ?? [] },
        stale: { field_id: staleScope.field_id, http_status: staleResp.status, error: staleResp.json?.error ?? null, reason_codes: staleResp.json?.reason_codes ?? [] },
        no_formal: { field_id: noFormalScope.field_id, http_status: noFormalResp.status, error: noFormalResp.json?.error ?? null, reason_codes: noFormalResp.json?.reason_codes ?? [] },
      },
    }, null, 2)}\n`);
  } finally {
    await pool.end();
  }
})().catch((err) => {
  console.error(err?.stack || err);
  process.exit(1);
});
