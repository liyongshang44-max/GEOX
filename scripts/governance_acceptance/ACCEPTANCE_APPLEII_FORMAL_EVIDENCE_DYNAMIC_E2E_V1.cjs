#!/usr/bin/env node
const { randomUUID } = require('node:crypto');
const { Pool } = require('pg');
const { assert, env, fetchJson } = require('../agronomy_acceptance/_common.cjs');

function nowId(prefix) {
  return `${prefix}_${Date.now()}_${randomUUID().replace(/-/g, '').slice(0, 8)}`;
}

async function tableExists(pool, table) {
  const q = await pool.query(`SELECT to_regclass($1) AS reg`, [`public.${table}`]);
  return Boolean(q.rows?.[0]?.reg);
}

async function requireHealth(base) {
  const resp = await fetchJson(`${base}/api/v1/health`, { method: 'GET' });
  if (!resp.ok) {
    const legacy = await fetchJson(`${base}/api/health`, { method: 'GET' });
    assert.equal(legacy.ok, true, `server health failed status=${resp.status}/${legacy.status}`);
  }
}

async function columnsFor(pool, table) {
  const q = await pool.query(
    `SELECT column_name, is_nullable, column_default
       FROM information_schema.columns
      WHERE table_schema='public' AND table_name=$1
      ORDER BY ordinal_position`,
    [table]
  );
  return q.rows ?? [];
}

async function insertKnownColumns(pool, table, values) {
  const cols = await columnsFor(pool, table);
  if (!cols.length) throw new Error(`missing table or columns: ${table}`);
  const allowed = new Set(cols.map((c) => String(c.column_name)));
  const picked = Object.entries(values).filter(([key]) => allowed.has(key));
  if (!picked.length) throw new Error(`no matching insert columns for ${table}`);
  const missingRequired = cols
    .filter((c) => String(c.is_nullable).toUpperCase() === 'NO' && c.column_default == null && !Object.prototype.hasOwnProperty.call(values, c.column_name))
    .map((c) => c.column_name)
    .filter((name) => name !== 'id');
  if (missingRequired.length) {
    throw new Error(`missing required columns for ${table}: ${missingRequired.join(',')}`);
  }
  const names = picked.map(([key]) => key);
  const placeholders = names.map((_, idx) => `$${idx + 1}`);
  const params = picked.map(([, value]) => value);
  await pool.query(
    `INSERT INTO ${table} (${names.map((n) => `"${n}"`).join(',')}) VALUES (${placeholders.join(',')}) ON CONFLICT DO NOTHING`,
    params
  );
}

async function insertRawCoverage(pool, { tenant, field_id, device_id, source, metric, nowMs }) {
  const start = nowMs - 5.5 * 60 * 60 * 1000;
  const rows = [];
  for (let i = 0; i < 12; i += 1) {
    const ts = Math.trunc(start + i * 30 * 60 * 1000);
    const sample_id = nowId(`rs_${source}_${i}`);
    rows.push({ sample_id, ts });
    await pool.query(
      `INSERT INTO raw_samples (sample_id, sensor_id, ts_ms, metric, value, qc_quality, source, payload_json)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
       ON CONFLICT (sample_id) DO NOTHING`,
      [
        sample_id,
        device_id,
        ts,
        metric,
        22 + i * 0.1,
        'ok',
        source,
        JSON.stringify({
          ...tenant,
          field_id,
          sensor_id: device_id,
          ts_ms: ts,
          metric,
          value: 22 + i * 0.1,
          sample_kind: 'raw',
          interpolated: false,
          synthetic: false,
          dynamic_e2e: 'appleii_formal_evidence',
        }),
      ]
    );
  }
  return rows;
}

async function insertDeviceStatus(pool, { tenant, field_id, device_id, nowMs }) {
  await insertKnownColumns(pool, 'device_status_index_v1', {
    tenant_id: tenant.tenant_id,
    project_id: tenant.project_id,
    group_id: tenant.group_id,
    field_id,
    device_id,
    last_telemetry_ts_ms: nowMs - 60_000,
    last_heartbeat_ts_ms: nowMs - 60_000,
    battery_percent: 80,
    rssi_dbm: -55,
    updated_ts_ms: nowMs,
    created_at: new Date(nowMs),
    updated_at: new Date(nowMs),
  });
}

async function insertIrrigationEffectivenessTrigger(pool, { tenant, field_id, device_id, nowMs }) {
  await insertKnownColumns(pool, 'derived_sensing_state_index_v1', {
    tenant_id: tenant.tenant_id,
    project_id: tenant.project_id,
    group_id: tenant.group_id,
    field_id,
    device_id,
    state_type: 'irrigation_effectiveness_state',
    payload_json: JSON.stringify({
      irrigation_effectiveness: 'low',
      level: 'low',
      source_observed_at_ts_ms: nowMs - 60_000,
      source_ts_ms: nowMs - 60_000,
      dynamic_e2e: 'appleii_formal_evidence',
    }),
    confidence: 0.91,
    computed_at_ts_ms: nowMs - 30_000,
    source_observed_at_ts_ms: nowMs - 60_000,
    source_observation_ids_json: JSON.stringify([`raw:${field_id}:${device_id}`]),
    updated_ts_ms: nowMs,
    created_at: new Date(nowMs),
    updated_at: new Date(nowMs),
  });
}

async function getStage1Summary(pool, tenant, field_id) {
  const q = await pool.query(
    `SELECT * FROM field_sensing_summary_stage1_v1 WHERE tenant_id=$1 AND field_id=$2 ORDER BY updated_ts_ms DESC LIMIT 1`,
    [tenant.tenant_id, field_id]
  );
  return q.rows?.[0] ?? null;
}

function recommendationBody(tenant, field_id, device_id) {
  return {
    ...tenant,
    field_id,
    device_id,
    season_id: `season_${field_id}`,
    crop_code: 'corn',
    telemetry: { soil_moisture_pct: 22 },
    image_recognition: { stress_score: 0.8, disease_score: 0.1, pest_risk_score: 0.1, confidence: 0.9 },
  };
}

async function triggerRecommendationPreflight({ base, token, tenant, field_id, device_id }) {
  return fetchJson(`${base}/api/v1/recommendations/generate`, {
    method: 'POST',
    token,
    body: recommendationBody(tenant, field_id, device_id),
  });
}

function assertFormalGateBlocked(resp, expectedReasons, label) {
  assert.equal(resp.status, 400, `${label} must be blocked by formal evidence gate, status=${resp.status} body=${resp.text}`);
  assert.equal(resp.json?.error, 'FORMAL_STAGE1_TRIGGER_NEEDS_EVIDENCE', `${label} wrong error body=${resp.text}`);
  const reasons = Array.isArray(resp.json?.reason_codes) ? resp.json.reason_codes : [];
  for (const reason of expectedReasons) {
    assert.ok(reasons.includes(reason), `${label} missing reason ${reason}; got=${JSON.stringify(reasons)}`);
  }
}

function assertNotFormalGateBlocked(resp, label) {
  assert.notEqual(resp.json?.error, 'FORMAL_STAGE1_TRIGGER_NEEDS_EVIDENCE', `${label} unexpectedly blocked by formal evidence gate body=${resp.text}`);
}

async function caseNonFormalSourcesCannotPass(ctx) {
  const { pool, base, token, tenant } = ctx;
  const nowMs = Date.now();
  const checks = [];
  for (const source of ['sim', 'import', 'human', 'system']) {
    const field_id = nowId(`field_nonformal_${source}`);
    const device_id = nowId(`dev_nonformal_${source}`);
    await insertRawCoverage(pool, { tenant, field_id, device_id, source, metric: 'soil_moisture', nowMs });
    await insertDeviceStatus(pool, { tenant, field_id, device_id, nowMs });
    await insertIrrigationEffectivenessTrigger(pool, { tenant, field_id, device_id, nowMs });
    const resp = await triggerRecommendationPreflight({ base, token, tenant, field_id, device_id });
    const expected = source === 'sim'
      ? ['NON_FORMAL_SAMPLE_SOURCE', 'SIMULATED_SAMPLE_NOT_FORMAL', 'INSUFFICIENT_FORMAL_SAMPLE_COUNT']
      : ['NON_FORMAL_SAMPLE_SOURCE', 'INSUFFICIENT_FORMAL_SAMPLE_COUNT'];
    assertFormalGateBlocked(resp, expected, `source=${source}`);
    const summary = await getStage1Summary(pool, tenant, field_id);
    assert.equal(summary?.evidence_sufficiency, 'NEEDS_EVIDENCE', `source=${source} summary must NEEDS_EVIDENCE`);
    checks.push({ source, blocked: true, reasons: resp.json.reason_codes });
  }
  return checks;
}

async function caseFormalSourcesCanPass(ctx) {
  const { pool, base, token, tenant } = ctx;
  const nowMs = Date.now();
  const out = [];
  for (const source of ['device', 'gateway']) {
    const field_id = nowId(`field_formal_${source}`);
    const device_id = nowId(`dev_formal_${source}`);
    await insertRawCoverage(pool, { tenant, field_id, device_id, source, metric: 'soil_moisture', nowMs });
    await insertDeviceStatus(pool, { tenant, field_id, device_id, nowMs });
    await insertIrrigationEffectivenessTrigger(pool, { tenant, field_id, device_id, nowMs });
    const resp = await triggerRecommendationPreflight({ base, token, tenant, field_id, device_id });
    assertNotFormalGateBlocked(resp, `source=${source}`);
    const summary = await getStage1Summary(pool, tenant, field_id);
    assert.equal(summary?.evidence_sufficiency, 'PASS', `source=${source} summary must PASS`);
    const coverage = summary.time_coverage_v1 ?? {};
    assert.ok(Number(coverage.formal_sample_count ?? 0) >= 3, `source=${source} formal_sample_count insufficient`);
    assert.ok(Number(coverage.formal_coverage_ratio ?? 0) >= 0.5, `source=${source} formal_coverage_ratio insufficient`);
    assert.equal(coverage.formal_source_eligible, true, `source=${source} formal_source_eligible must be true`);
    assert.equal(coverage.trigger_metric_evidence?.irrigation_effectiveness, true, `source=${source} trigger metric evidence missing`);
    out.push({ source, passed: true, response_status: resp.status, evidence_sufficiency: summary.evidence_sufficiency });
  }
  return out;
}

async function caseMissingDeviceStatusNeedsEvidence(ctx) {
  const { pool, base, token, tenant } = ctx;
  const nowMs = Date.now();
  const field_id = nowId('field_missing_device_status');
  const device_id = nowId('dev_missing_device_status');
  await insertRawCoverage(pool, { tenant, field_id, device_id, source: 'device', metric: 'soil_moisture', nowMs });
  await insertIrrigationEffectivenessTrigger(pool, { tenant, field_id, device_id, nowMs });
  const resp = await triggerRecommendationPreflight({ base, token, tenant, field_id, device_id });
  assertFormalGateBlocked(resp, ['DEVICE_STATUS_MISSING', 'DEVICE_HEALTH_UNKNOWN'], 'missing device_status');
  const summary = await getStage1Summary(pool, tenant, field_id);
  assert.equal(summary?.evidence_sufficiency, 'NEEDS_EVIDENCE', 'missing device_status summary must NEEDS_EVIDENCE');
  assert.equal(summary?.device_health_snapshot_v1?.device_health_status, 'UNKNOWN', 'missing device_status must be UNKNOWN');
  return { blocked: true, reasons: resp.json.reason_codes };
}

async function caseTriggerRequiresRelevantMetricEvidence(ctx) {
  const { pool, base, token, tenant } = ctx;
  const nowMs = Date.now();
  const field_id = nowId('field_unrelated_metric');
  const device_id = nowId('dev_unrelated_metric');
  await insertRawCoverage(pool, { tenant, field_id, device_id, source: 'device', metric: 'ec_ds_m', nowMs });
  await insertDeviceStatus(pool, { tenant, field_id, device_id, nowMs });
  await insertIrrigationEffectivenessTrigger(pool, { tenant, field_id, device_id, nowMs });
  const resp = await triggerRecommendationPreflight({ base, token, tenant, field_id, device_id });
  assertFormalGateBlocked(resp, ['MISSING_IRRIGATION_EFFECTIVENESS_METRIC_EVIDENCE'], 'unrelated metric trigger evidence');
  const summary = await getStage1Summary(pool, tenant, field_id);
  assert.equal(summary?.evidence_sufficiency, 'PASS', 'unrelated formal metric may pass general evidence sufficiency');
  assert.equal(summary?.time_coverage_v1?.trigger_metric_evidence?.irrigation_effectiveness, false, 'trigger metric evidence must be false for unrelated metric');
  return { blocked: true, reasons: resp.json.reason_codes };
}

(async () => {
  const base = env('BASE_URL', process.env.GEOX_BASE_URL || 'http://127.0.0.1:3001');
  const token = env('AO_ACT_TOKEN', env('ADMIN_TOKEN', 'admin_token'));
  const databaseUrl = env('DATABASE_URL', 'postgres://postgres:postgres@127.0.0.1:5432/geox');
  const tenant = {
    tenant_id: env('TENANT_ID', 'tenantA'),
    project_id: env('PROJECT_ID', 'projectA'),
    group_id: env('GROUP_ID', 'groupA'),
  };
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    await requireHealth(base);
    for (const table of ['raw_samples', 'field_sensing_summary_stage1_v1', 'derived_sensing_state_index_v1', 'device_status_index_v1']) {
      assert.equal(await tableExists(pool, table), true, `${table} table missing`);
    }
    const ctx = { pool, base, token, tenant };
    const checks = {
      non_formal_sources_do_not_pass: await caseNonFormalSourcesCannotPass(ctx),
      formal_sources_can_pass: await caseFormalSourcesCanPass(ctx),
      missing_device_status_needs_evidence: await caseMissingDeviceStatusNeedsEvidence(ctx),
      trigger_requires_relevant_metric_evidence: await caseTriggerRequiresRelevantMetricEvidence(ctx),
    };
    process.stdout.write(`${JSON.stringify({ ok: true, checks }, null, 2)}\n`);
  } finally {
    await pool.end();
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
