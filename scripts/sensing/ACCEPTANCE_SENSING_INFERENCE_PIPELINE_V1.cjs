#!/usr/bin/env node
const crypto = require('node:crypto');
const { Client } = require('pg');

function env(name, fallback = '') {
  const v = process.env[name];
  return v == null || String(v).trim() === '' ? fallback : String(v).trim();
}

function mustEnv(name, fallback = '') {
  const v = env(name, fallback);
  if (!v) throw new Error(`MISSING_ENV:${name}`);
  return v;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function rand(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
}

function iso(ms) {
  return new Date(ms).toISOString();
}

async function poll(checker, opts = {}) {
  const timeoutMs = Number.isFinite(opts.timeoutMs) ? Number(opts.timeoutMs) : 20000;
  const intervalMs = Number.isFinite(opts.intervalMs) ? Number(opts.intervalMs) : 500;
  const deadline = Date.now() + timeoutMs;
  let last;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    last = await checker();
    if (last && last.ok) return last;
    if (Date.now() >= deadline) return last || { ok: false };
    await sleep(intervalMs);
  }
}

(async () => {
  const databaseUrl = mustEnv('DATABASE_URL', 'postgres://postgres:postgres@127.0.0.1:5432/geox');
  const tenant_id = env('TENANT_ID', 'tenantA');
  const project_id = env('PROJECT_ID', '_na_project');
  const group_id = env('GROUP_ID', '_na_group');
  const field_id = env('FIELD_ID', 'field_demo_1');
  const device_id = env('DEVICE_ID', rand('device_sensing_accept'));

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  const t0 = Date.now();
  const writeStartMs = t0 - 1000;

  const metrics = [
    { metric: 'canopy_temperature', value: 34.6, unit: 'c' },
    { metric: 'air_temperature', value: 30.2, unit: 'c' },
    { metric: 'air_humidity', value: 41.0, unit: 'pct' },
    { metric: 'signal_strength_dbm', value: -95, unit: 'dbm' },
    { metric: 'battery_level_pct', value: 82, unit: 'pct' },
    { metric: 'packet_loss_rate_pct', value: 10.8, unit: 'pct' },
    { metric: 'inlet_flow_lpm', value: 116, unit: 'lpm' },
    { metric: 'outlet_flow_lpm', value: 73, unit: 'lpm' },
    { metric: 'pressure_drop_kpa', value: 35, unit: 'kpa' },
  ];

  const failures = [];

  try {
    for (let i = 0; i < metrics.length; i += 1) {
      const m = metrics[i];
      const observed_at_ts_ms = t0 + i;
      const fact_id = `obs_${crypto.createHash('sha256').update(`${tenant_id}|${field_id}|${device_id}|${m.metric}|${observed_at_ts_ms}`).digest('hex')}`;
      const record = {
        type: 'device_observation_v1',
        entity: { tenant_id, project_id, group_id, field_id, device_id },
        payload: {
          metric: m.metric,
          value: m.value,
          unit: m.unit,
          quality_flags: ['OK'],
          confidence: 1,
          observed_at_ts_ms,
          source_fact_id: fact_id,
        },
      };

      await client.query(
        `INSERT INTO facts (fact_id, occurred_at, source, record_json)
         VALUES ($1, $2::timestamptz, $3, $4::jsonb)
         ON CONFLICT (fact_id) DO NOTHING`,
        [fact_id, iso(observed_at_ts_ms), 'acceptance_sensing_inference_pipeline_v1', JSON.stringify(record)]
      );

      await client.query(
        `INSERT INTO device_observation_index_v1
          (tenant_id, project_id, group_id, device_id, field_id, metric, observed_at, observed_at_ts_ms, value_num, value_text, unit, confidence, quality_flags_json, fact_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7::timestamptz,$8,$9,$10,$11,$12,$13::jsonb,$14)
         ON CONFLICT (tenant_id, device_id, metric, observed_at_ts_ms) DO NOTHING`,
        [tenant_id, project_id, group_id, device_id, field_id, m.metric, iso(observed_at_ts_ms), observed_at_ts_ms, m.value, String(m.value), m.unit, 1, JSON.stringify(['OK']), fact_id]
      );
    }

    const windowStartMs = writeStartMs;
    const windowEndMs = Date.now() + 30000;

    const assertA = await poll(async () => {
      const q = await client.query(
        `SELECT DISTINCT state_type
           FROM derived_sensing_state_index_v1
          WHERE tenant_id = $1
            AND field_id = $2
            AND ($3::text IS NULL OR project_id = $3)
            AND ($4::text IS NULL OR group_id = $4)
            AND computed_at_ts_ms BETWEEN $5 AND $6
            AND state_type = ANY($7::text[])`,
        [tenant_id, field_id, project_id || null, group_id || null, windowStartMs, windowEndMs, ['canopy_state', 'sensor_quality_state', 'water_flow_state']]
      );
      const got = new Set((q.rows || []).map((r) => String(r.state_type)));
      const expected = ['canopy_state', 'sensor_quality_state', 'water_flow_state'];
      const missing = expected.filter((s) => !got.has(s));
      return { ok: missing.length === 0, missing, got: [...got] };
    });

    if (assertA.ok) {
      console.log('PASS A: derived states generated -> canopy_state/sensor_quality_state/water_flow_state');
    } else {
      failures.push('A');
      console.log(`FAIL A: missing derived states=${(assertA.missing || []).join(',')}; tenant=${tenant_id}; field=${field_id}; window=${windowStartMs}-${windowEndMs}`);
    }

    const assertB = await poll(async () => {
      const q = await client.query(
        `SELECT DISTINCT (record_json::jsonb#>>'{payload,skill_id}') AS skill_id
           FROM facts
          WHERE (record_json::jsonb->>'type') = 'skill_run_v1'
            AND COALESCE(record_json::jsonb#>>'{entity,tenant_id}','') = $1
            AND COALESCE(record_json::jsonb#>>'{payload,field_id}','') = $2
            AND occurred_at BETWEEN $3::timestamptz AND $4::timestamptz
            AND (record_json::jsonb#>>'{payload,skill_id}') = ANY($5::text[])`,
        [tenant_id, field_id, iso(windowStartMs), iso(windowEndMs), ['canopy_temperature_inference_v1', 'sensor_quality_inference_v1', 'water_flow_inference_v1']]
      );
      const got = new Set((q.rows || []).map((r) => String(r.skill_id || '')));
      const expected = ['canopy_temperature_inference_v1', 'sensor_quality_inference_v1', 'water_flow_inference_v1'];
      const missing = expected.filter((s) => !got.has(s));
      return { ok: missing.length === 0, missing, got: [...got] };
    });

    if (assertB.ok) {
      console.log('PASS B: 3 new skill_run_v1 records found in window (by skill_id)');
    } else {
      failures.push('B');
      console.log(`FAIL B: missing skill_run_v1 skill_id=${(assertB.missing || []).join(',')}; tenant=${tenant_id}; field=${field_id}; window=${windowStartMs}-${windowEndMs}`);
    }

    const assertC = await poll(async () => {
      const q = await client.query(
        `SELECT canopy_temp_status, sensor_quality, irrigation_effectiveness, updated_ts_ms
           FROM field_sensing_overview_v1
          WHERE tenant_id = $1
            AND field_id = $2
            AND ($3::text IS NULL OR project_id = $3)
            AND ($4::text IS NULL OR group_id = $4)
          ORDER BY updated_ts_ms DESC NULLS LAST
          LIMIT 1`,
        [tenant_id, field_id, project_id || null, group_id || null]
      );
      const row = (q.rows || [])[0] || null;
      const missingFields = [];
      if (!row) missingFields.push('row_not_found');
      else {
        if (!row.canopy_temp_status) missingFields.push('canopy_temp_status');
        if (!row.sensor_quality) missingFields.push('sensor_quality');
        if (!row.irrigation_effectiveness) missingFields.push('irrigation_effectiveness');
      }
      return { ok: missingFields.length === 0, missingFields, row };
    });

    if (assertC.ok) {
      console.log('PASS C: field_sensing_overview_v1 has aggregated fields canopy_temp_status/sensor_quality/irrigation_effectiveness');
    } else {
      failures.push('C');
      console.log(`FAIL C: missing aggregated fields=${(assertC.missingFields || []).join(',')}; tenant=${tenant_id}; field=${field_id}; window=${windowStartMs}-${windowEndMs}`);
    }

    if (failures.length > 0) {
      console.log(`RESULT: FAIL (${failures.join(',')})`);
      process.exitCode = 1;
    } else {
      console.log('RESULT: PASS');
      process.exitCode = 0;
    }
  } finally {
    await client.end().catch(() => null);
  }
})();
