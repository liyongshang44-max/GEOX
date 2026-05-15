#!/usr/bin/env node
const { randomUUID } = require('node:crypto');
const { Pool } = require('pg');
const { assert, env, fetchJson } = require('../agronomy_acceptance/_common.cjs');

const id = (p) => `${p}_${Date.now()}_${randomUUID().replace(/-/g, '').slice(0, 8)}`;
const js = (x) => JSON.stringify(x);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function tableExists(pool, table) {
  const q = await pool.query('SELECT to_regclass($1) AS reg', [`public.${table}`]);
  return Boolean(q.rows?.[0]?.reg);
}

async function health(base) {
  let lastErr = null;
  for (let i = 0; i < 20; i += 1) {
    try {
      const r = await fetchJson(`${base}/api/v1/health`, { method: 'GET' });
      if (r.ok) return;
      const legacy = await fetchJson(`${base}/api/health`, { method: 'GET' });
      if (legacy.ok) return;
      lastErr = new Error(`health failed ${r.status}/${legacy.status}`);
    } catch (err) {
      lastErr = err;
    }
    await sleep(1000);
  }
  throw lastErr ?? new Error('server health failed');
}

async function insertRaw(pool, tenant, field, dev, source, metric, now) {
  const start = now - 5.5 * 60 * 60 * 1000;
  for (let i = 0; i < 12; i += 1) {
    const ts = Math.trunc(start + i * 30 * 60 * 1000);
    const sid = id(`rs_${source}_${i}`);
    await pool.query(
      `INSERT INTO raw_samples (sample_id,sensor_id,ts_ms,metric,value,qc_quality,source,payload_json)
       VALUES ($1,$2,$3,$4,$5,'ok',$6,$7::jsonb) ON CONFLICT (sample_id) DO NOTHING`,
      [sid, dev, ts, metric, 22 + i * 0.1, source, js({ ...tenant, field_id: field, sensor_id: dev, ts_ms: ts, metric, value: 22 + i * 0.1, sample_kind: 'raw', interpolated: false, synthetic: false })]
    );
  }
}

async function insertStatus(pool, tenant, field, dev, now) {
  await pool.query(
    `INSERT INTO device_status_index_v1
      (tenant_id,project_id,group_id,field_id,device_id,last_telemetry_ts_ms,last_heartbeat_ts_ms,battery_percent,rssi_dbm,updated_ts_ms)
     VALUES ($1,$2,$3,$4,$5,$6,$7,80,-55,$8)
     ON CONFLICT DO NOTHING`,
    [tenant.tenant_id, tenant.project_id, tenant.group_id, field, dev, now - 60000, now - 60000, now]
  );
}

async function insertTrigger(pool, tenant, field, dev, now) {
  const ts = now - 30000;
  await pool.query(
    `INSERT INTO derived_sensing_state_index_v1
      (tenant_id,project_id,group_id,field_id,state_type,payload_json,confidence,explanation_codes_json,source_observation_ids_json,source_device_ids_json,computed_at,computed_at_ts_ms,fact_id)
     VALUES ($1,$2,$3,$4,'irrigation_effectiveness_state',$5::jsonb,0.91,$6::jsonb,$7::jsonb,$8::jsonb,$9::timestamptz,$10,$11)
     ON CONFLICT DO NOTHING`,
    [tenant.tenant_id, tenant.project_id, tenant.group_id, field,
      js({ irrigation_effectiveness: 'low', level: 'LOW', source_observed_at_ts_ms: now - 60000, source_ts_ms: now - 60000, dynamic_e2e: 'appleii_formal_evidence' }),
      js(['dynamic_e2e_irrigation_effectiveness_low']),
      js([`raw:${field}:${dev}`]),
      js([dev]),
      new Date(ts).toISOString(),
      ts,
      `derived_state_dynamic_${randomUUID()}`]
  );
}

async function summary(pool, tenant, field) {
  const q = await pool.query('SELECT * FROM field_sensing_summary_stage1_v1 WHERE tenant_id=$1 AND field_id=$2 ORDER BY updated_ts_ms DESC LIMIT 1', [tenant.tenant_id, field]);
  return q.rows?.[0] ?? null;
}

async function generate(base, token, tenant, field, dev) {
  return fetchJson(`${base}/api/v1/recommendations/generate`, {
    method: 'POST', token,
    body: { ...tenant, field_id: field, device_id: dev, season_id: `season_${field}`, crop_code: 'corn', telemetry: { soil_moisture_pct: 22 }, image_recognition: { stress_score: 0.8, disease_score: 0.1, pest_risk_score: 0.1, confidence: 0.9 } },
  });
}

function blocked(resp, reasons, label) {
  assert.equal(resp.status, 400, `${label} must be blocked, status=${resp.status} body=${resp.text}`);
  assert.equal(resp.json?.error, 'FORMAL_STAGE1_TRIGGER_NEEDS_EVIDENCE', `${label} wrong error body=${resp.text}`);
  const got = Array.isArray(resp.json?.reason_codes) ? resp.json.reason_codes : [];
  for (const r of reasons) assert.ok(got.includes(r), `${label} missing ${r}; got=${JSON.stringify(got)}`);
  return got;
}

async function scenario(ctx, { source, metric = 'soil_moisture', withStatus = true, shouldPass = false, reasons = [] }) {
  const now = Date.now();
  const field = id(`field_${source}_${metric}`);
  const dev = id(`dev_${source}_${metric}`);
  await insertRaw(ctx.pool, ctx.tenant, field, dev, source, metric, now);
  if (withStatus) await insertStatus(ctx.pool, ctx.tenant, field, dev, now);
  await insertTrigger(ctx.pool, ctx.tenant, field, dev, now);
  const resp = await generate(ctx.base, ctx.token, ctx.tenant, field, dev);
  const row = await summary(ctx.pool, ctx.tenant, field);
  if (shouldPass) {
    assert.notEqual(resp.json?.error, 'FORMAL_STAGE1_TRIGGER_NEEDS_EVIDENCE', `${source} unexpectedly blocked body=${resp.text}`);
    assert.equal(row?.evidence_sufficiency, 'PASS', `${source} summary must PASS; summary=${JSON.stringify(row)}`);
    assert.equal(row?.time_coverage_v1?.formal_source_eligible, true, `${source} formal_source_eligible`);
    assert.equal(row?.time_coverage_v1?.trigger_metric_evidence?.irrigation_effectiveness, true, `${source} trigger metric evidence`);
    return { source, metric, passed: true, response_status: resp.status };
  }
  const got = blocked(resp, reasons, `${source}/${metric}`);
  if (!withStatus || source !== 'device' || metric !== 'ec_ds_m') assert.equal(row?.evidence_sufficiency, 'NEEDS_EVIDENCE', `${source}/${metric} summary must NEEDS_EVIDENCE`);
  return { source, metric, blocked: true, reasons: got };
}

(async () => {
  const base = env('BASE_URL', process.env.GEOX_BASE_URL || 'http://127.0.0.1:3001');
  const token = env('AO_ACT_TOKEN', env('ADMIN_TOKEN', 'admin_token'));
  const pool = new Pool({ connectionString: env('DATABASE_URL', 'postgres://postgres:postgres@127.0.0.1:5432/geox') });
  const tenant = { tenant_id: env('TENANT_ID', 'tenantA'), project_id: env('PROJECT_ID', 'projectA'), group_id: env('GROUP_ID', 'groupA') };
  try {
    await health(base);
    for (const t of ['raw_samples', 'field_sensing_summary_stage1_v1', 'derived_sensing_state_index_v1', 'device_status_index_v1']) assert.equal(await tableExists(pool, t), true, `${t} table missing`);
    const ctx = { pool, base, token, tenant };
    const checks = { non_formal: [], formal: [], missing_device_status: null, trigger_metric: null };
    for (const source of ['sim', 'import', 'human', 'system']) {
      const reasons = source === 'sim' ? ['NON_FORMAL_SAMPLE_SOURCE', 'SIMULATED_SAMPLE_NOT_FORMAL', 'INSUFFICIENT_FORMAL_SAMPLE_COUNT'] : ['NON_FORMAL_SAMPLE_SOURCE', 'INSUFFICIENT_FORMAL_SAMPLE_COUNT'];
      checks.non_formal.push(await scenario(ctx, { source, reasons }));
    }
    checks.formal.push(await scenario(ctx, { source: 'device', shouldPass: true }));
    checks.formal.push(await scenario(ctx, { source: 'gateway', shouldPass: true }));
    checks.missing_device_status = await scenario(ctx, { source: 'device', withStatus: false, reasons: ['DEVICE_STATUS_MISSING', 'DEVICE_HEALTH_UNKNOWN'] });
    checks.trigger_metric = await scenario(ctx, { source: 'device', metric: 'ec_ds_m', reasons: ['MISSING_IRRIGATION_EFFECTIVENESS_METRIC_EVIDENCE'] });
    process.stdout.write(`${JSON.stringify({ ok: true, checks }, null, 2)}\n`);
  } finally {
    await pool.end();
  }
})().catch((err) => { console.error(err); process.exit(1); });
