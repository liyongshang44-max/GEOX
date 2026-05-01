#!/usr/bin/env node
/* eslint-disable no-console */
const { randomUUID } = require('node:crypto');
const { Pool } = require('pg');
const { env, fetchJson } = require('./_common.cjs');
const { assertSecurityAcceptanceTokensLoaded } = require('./_security_acceptance_tokens.cjs');

(async () => {
  const base = env('BASE_URL', process.env.GEOX_BASE_URL || 'http://127.0.0.1:3001');
  const q = 'tenant_id=tenantA&project_id=projectA&group_id=groupA';
  const checks = {};
  const databaseUrl = env('DATABASE_URL', 'postgres://landos:landos_pwd@127.0.0.1:5433/landos');
  const pool = new Pool({ connectionString: databaseUrl });
  const ts0 = Date.now() - 60_000;

  try {
    try {
      await assertSecurityAcceptanceTokensLoaded(base);
    } catch (err) {
      console.log(JSON.stringify({ ok: false, error: 'SECURITY_ACCEPTANCE_TOKEN_FIXTURE_NOT_LOADED', detail: String(err?.message || err) }, null, 2));
      process.exit(1);
    }

    await fetchJson(`${base}/api/v1/fields/field_c8_demo/zones`, { method: 'POST', token: 'tenant_a_admin_token', body: { tenant_id: 'tenantA', project_id: 'projectA', group_id: 'groupA', zone_id: 'tenant_iso_zone_a', zone_name: 'Tenant isolation zone A', zone_type: 'IRRIGATION_ZONE', geometry: { type: 'Polygon', coordinates: [] }, area_ha: 1, risk_tags: ['SECURITY_TEST'], agronomy_tags: ['TENANT_ISOLATION'], source_refs: ['ACCEPTANCE_SECURITY_TENANT_ISOLATION_V1'] } });
    await fetchJson(`${base}/api/v1/fields/field_c8_demo/zones`, { method: 'POST', token: 'tenant_a_admin_token', body: { tenant_id: 'tenantA', project_id: 'projectA', group_id: 'groupA', zone_id: 'tenant_iso_zone_b', zone_name: 'Tenant isolation zone B', zone_type: 'IRRIGATION_ZONE', geometry: { type: 'Polygon', coordinates: [] }, area_ha: 1, risk_tags: ['SECURITY_TEST'], agronomy_tags: ['TENANT_ISOLATION'], source_refs: ['ACCEPTANCE_SECURITY_TENANT_ISOLATION_V1'] } });
    const ownRead = await fetchJson(`${base}/api/v1/fields/field_c8_demo/zones?${q}`, { token: 'tenant_a_admin_token' }); checks.tenant_a_can_access_own_field = ownRead.ok === true && ownRead.json?.ok === true;
    const tbRead = await fetchJson(`${base}/api/v1/fields/field_c8_demo/zones?${q}`, { token: 'tenant_b_admin_token' }); checks.tenant_b_cannot_read_tenant_a_zone = tbRead.status === 404 && tbRead.json?.error === 'NOT_FOUND';
    const allowlist = await fetchJson(`${base}/api/v1/fields/field_c8_demo/zones?${q}`, { token: 'tenant_a_restricted_token' }); checks.field_allowlist_enforced = allowlist.status === 404 && allowlist.json?.error === 'NOT_FOUND';

    await pool.query(`ALTER TABLE derived_sensing_state_index_v1 ADD COLUMN IF NOT EXISTS project_id text`);
    await pool.query(`ALTER TABLE derived_sensing_state_index_v1 ADD COLUMN IF NOT EXISTS group_id text`);
    await pool.query(`ALTER TABLE derived_sensing_state_index_v1 ADD COLUMN IF NOT EXISTS source_observation_ids_json jsonb NOT NULL DEFAULT '[]'::jsonb`);

    await pool.query(
      `INSERT INTO derived_sensing_state_index_v1
        (tenant_id, project_id, group_id, field_id, state_type, payload_json, confidence, explanation_codes_json, source_device_ids_json, computed_at, computed_at_ts_ms, fact_id, source_observation_ids_json)
       VALUES
        ($1,$2,$3,$4,'irrigation_effectiveness_state','{"level":"LOW"}'::jsonb,0.95,'[]'::jsonb,'[]'::jsonb,NOW(),$5,$6,'["obs_tenant_iso_irrigation"]'::jsonb),
        ($1,$2,$3,$4,'leak_risk_state','{"level":"LOW"}'::jsonb,0.95,'[]'::jsonb,'[]'::jsonb,NOW(),$5,$7,'["obs_tenant_iso_leak"]'::jsonb)
       ON CONFLICT DO NOTHING`,
      ['tenantA', 'projectA', 'groupA', 'field_c8_demo', ts0, randomUUID(), randomUUID()]
    );

    await pool.query(
      `INSERT INTO device_observation_index_v1
        (tenant_id, project_id, group_id, field_id, device_id, metric, observed_at, observed_at_ts_ms, value_num, confidence, fact_id)
       VALUES
        ($1,$2,$3,$4,$5,'soil_moisture',to_timestamp($6 / 1000.0),$6,$7,0.92,$9),
        ($1,$2,$3,$4,$5,'canopy_temp_c',to_timestamp($6 / 1000.0),$6,$8,0.88,$10)
       ON CONFLICT DO NOTHING`,
      [
        'tenantA',
        'projectA',
        'groupA',
        'field_c8_demo',
        'd_tenant_iso',
        ts0,
        0.18,
        31.2,
        `obs_soil_tenant_iso_${randomUUID()}`,
        `obs_canopy_tenant_iso_${randomUUID()}`
      ]
    );

    const rec = await fetchJson(`${base}/api/v1/recommendations/generate`, { method: 'POST', token: 'tenant_a_admin_token', body: { tenant_id: 'tenantA', project_id: 'projectA', group_id: 'groupA', field_id: 'field_c8_demo', season_id: 's_tenant_iso', device_id: 'd_tenant_iso', crop_code: 'corn' } });
    const recommendation_id = String(
      rec.json?.recommendation_id ??
      rec.json?.recommendations?.[0]?.recommendation_id ??
      ''
    );

    if (!recommendation_id) {
      console.log(JSON.stringify({
        ok: false,
        error: 'TENANT_ISOLATION_RECOMMENDATION_ID_MISSING',
        detail: rec.json
      }, null, 2));
      process.exit(1);
    }

    const vp = await fetchJson(`${base}/api/v1/prescriptions/variable/from-recommendation`, {
      method: 'POST',
      token: 'tenant_a_admin_token',
      body: {
        tenant_id: 'tenantA',
        project_id: 'projectA',
        group_id: 'groupA',
        recommendation_id,
        field_id: 'field_c8_demo',
        season_id: 's_tenant_iso',
        crop_id: 'corn',
        variable_plan: {
          mode: 'VARIABLE_BY_ZONE',
          zone_rates: [
            {
              zone_id: 'tenant_iso_zone_a',
              operation_type: 'IRRIGATION',
              planned_amount: 10,
              unit: 'mm',
              priority: 'HIGH',
              reason_codes: ['SECURITY_TEST'],
              source_refs: ['ACCEPTANCE_SECURITY_TENANT_ISOLATION_V1']
            },
            {
              zone_id: 'tenant_iso_zone_b',
              operation_type: 'IRRIGATION',
              planned_amount: 12,
              unit: 'mm',
              priority: 'MEDIUM',
              reason_codes: ['SECURITY_TEST'],
              source_refs: ['ACCEPTANCE_SECURITY_TENANT_ISOLATION_V1']
            }
          ]
        }
      }
    });

    const pid = String(
      vp.json?.prescription_id ??
      vp.json?.prescription?.prescription_id ??
      vp.json?.prescription?.id ??
      ''
    );

    if (!pid) {
      console.log(JSON.stringify({
        ok: false,
        error: 'TENANT_ISOLATION_PRESCRIPTION_ID_MISSING',
        detail: vp.json
      }, null, 2));
      process.exit(1);
    }

    const pReadTenantMismatch = await fetchJson(
      `${base}/api/v1/prescriptions/${encodeURIComponent(pid)}?tenant_id=tenantA&project_id=projectA&group_id=groupA`,
      { token: 'tenant_b_admin_token' }
    );

    checks.prescription_cross_tenant_hidden =
      pReadTenantMismatch.status === 404 &&
      String(pReadTenantMismatch.json?.error ?? '') === 'NOT_FOUND';

    const pReadWrongTenantScope = await fetchJson(
      `${base}/api/v1/prescriptions/${encodeURIComponent(pid)}?tenant_id=tenantB&project_id=projectB&group_id=groupB`,
      { token: 'tenant_b_admin_token' }
    );
    const fm = await fetchJson(`${base}/api/v1/field-memory/summary?field_id=field_c8_demo&${q}`, { token: 'tenant_a_restricted_token' }); checks.field_memory_field_allowlist_enforced = fm.status === 404 && fm.json?.error === 'NOT_FOUND';
    checks.resource_id_only_access_blocked =
      pReadWrongTenantScope.status === 404 &&
      ['NOT_FOUND', 'PRESCRIPTION_NOT_FOUND'].includes(String(pReadWrongTenantScope.json?.error ?? ''));
    console.log(JSON.stringify({ ok: Object.values(checks).every(Boolean), checks }, null, 2));

    await pool.end();
  } catch (err) {
    try {
      await pool.end();
    } catch (_) {}
    throw err;
  }
})();
