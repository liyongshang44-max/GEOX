#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const mqtt = require('mqtt');
const { Client } = require('pg');

function env(name, fallback = '') {
  const value = process.env[name];
  if (value == null || String(value).trim() === '') return fallback;
  return String(value).trim();
}

function mustEnv(name, fallback = '') {
  const value = env(name, fallback);
  if (!value) throw new Error(`MISSING_ENV:${name}`);
  return value;
}

function loadDefaultAoActToken() {
  const tokenFile = path.resolve('config/auth/ao_act_tokens_v0.json');
  try {
    const raw = fs.readFileSync(tokenFile, 'utf8');
    const parsed = JSON.parse(raw);
    const firstToken = Array.isArray(parsed?.tokens) ? parsed.tokens.find((x) => typeof x?.token === 'string' && x.token.trim()) : null;
    return firstToken?.token ? String(firstToken.token).trim() : '';
  } catch {
    return '';
  }
}

async function fetchJson(url, options = {}) {
  const method = options.method || 'GET';
  const headers = { ...(options.headers || {}) };
  if (options.token) headers.authorization = `Bearer ${options.token}`;
  if (options.body !== undefined) headers['content-type'] = 'application/json';
  const res = await fetch(url, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = null; }
  return { ok: res.ok, status: res.status, text, json };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function newId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
}

async function publishTelemetryBatch(mqttUrl, tenant_id, device_id, credential, points) {
  const topic = `telemetry/${tenant_id}/${device_id}`;
  const client = mqtt.connect(mqttUrl);
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('MQTT_CONNECT_TIMEOUT')), 5000);
    client.once('connect', () => {
      clearTimeout(timeout);
      resolve();
    });
    client.once('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });

  try {
    for (const point of points) {
      const payload = {
        metric: point.metric,
        value: point.value,
        ts_ms: point.ts_ms,
        credential,
      };
      await new Promise((resolve, reject) => {
        client.publish(topic, JSON.stringify(payload), { qos: 1 }, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
  } finally {
    client.end(true);
  }
}

(async () => {
  const base = env('BASE_URL', 'http://127.0.0.1:3001');
  const mqttUrl = env('MQTT_URL', env('GEOX_MQTT_URL', 'mqtt://127.0.0.1:1883'));
  const token = mustEnv('AO_ACT_TOKEN', loadDefaultAoActToken());
  const databaseUrl = mustEnv('DATABASE_URL', 'postgres://postgres:postgres@127.0.0.1:5432/geox');
  const tenant_id = env('TENANT_ID', 'tenantA');
  const project_id = env('PROJECT_ID', 'projectA');
  const group_id = env('GROUP_ID', 'groupA');
  const field_id = env('FIELD_ID', 'field_demo_1');
  const season_id = env('SEASON_ID', 'season_demo_1');
  const crop_code = env('CROP_CODE', 'corn');
  const reportPath = env('ACCEPTANCE_REPORT_PATH', 'scripts/acceptance/data/minimal_sensing_e2e_report.json');

  const db = new Client({ connectionString: databaseUrl });
  await db.connect();

  const report = {
    run_id: newId('minimal_sensing_e2e'),
    generated_at: new Date().toISOString(),
    tenant: { tenant_id, project_id, group_id, field_id, season_id },
    checkpoints: {},
  };

  try {
    const device_id = newId('device_e2e');
    const registerRes = await fetchJson(`${base}/api/v1/devices/register`, {
      method: 'POST',
      token,
      body: { device_id, display_name: 'Minimal sensing E2E device' },
    });
    if (!registerRes.ok) throw new Error(`REGISTER_FAILED:${registerRes.status}:${registerRes.text}`);
    const credential = String(registerRes.json?.credential_secret || '').trim();
    assert.ok(credential, 'MISSING_CREDENTIAL_SECRET');

    const bindRes = await fetchJson(`${base}/api/v1/devices/${encodeURIComponent(device_id)}/bind-field`, {
      method: 'POST',
      token,
      body: { field_id },
    });
    if (!bindRes.ok) throw new Error(`BIND_FAILED:${bindRes.status}:${bindRes.text}`);

    const now = Date.now();
    await publishTelemetryBatch(mqttUrl, tenant_id, device_id, credential, [
      { metric: 'soil_moisture', value: 18, ts_ms: now - 1000 },
      { metric: 'canopy_temp', value: 36, ts_ms: now },
    ]);

    let observationRow = null;
    for (let i = 0; i < 20; i += 1) {
      const q = await db.query(
        `SELECT metric, observed_at_ts_ms, confidence, quality_flags_json, fact_id
           FROM device_observation_index_v1
          WHERE tenant_id = $1 AND device_id = $2
          ORDER BY observed_at_ts_ms DESC
          LIMIT 1`,
        [tenant_id, device_id]
      );
      if ((q.rows || []).length > 0) {
        observationRow = q.rows[0];
        break;
      }
      await sleep(300);
    }
    assert.ok(observationRow, 'device_observation_v1 not generated from telemetry');

    report.checkpoints.device_observation_v1 = {
      status_value: 'generated',
      explain_codes: Array.isArray(observationRow.quality_flags_json) ? observationRow.quality_flags_json : [],
      source_timestamps: { observed_at_ts_ms: Number(observationRow.observed_at_ts_ms) },
      confidence: observationRow.confidence == null ? null : Number(observationRow.confidence),
      fact_id: String(observationRow.fact_id || ''),
    };

    const recommendationRes = await fetchJson(`${base}/api/v1/recommendations/generate`, {
      method: 'POST',
      token,
      body: {
        tenant_id,
        project_id,
        group_id,
        field_id,
        season_id,
        device_id,
        crop_code,
      },
    });
    if (!recommendationRes.ok) throw new Error(`GENERATE_FAILED:${recommendationRes.status}:${recommendationRes.text}`);
    const recommendations = Array.isArray(recommendationRes.json?.recommendations) ? recommendationRes.json.recommendations : [];
    assert.ok(recommendations.length > 0, 'recommendations empty');

    let derivedRow = null;
    for (let i = 0; i < 20; i += 1) {
      const q = await db.query(
        `SELECT state_type, payload_json, confidence, explanation_codes_json, computed_at_ts_ms
           FROM derived_sensing_state_index_v1
          WHERE tenant_id = $1 AND project_id = $2 AND group_id = $3 AND field_id = $4
          ORDER BY computed_at_ts_ms DESC
          LIMIT 1`,
        [tenant_id, project_id, group_id, field_id]
      );
      if ((q.rows || []).length > 0) {
        derivedRow = q.rows[0];
        break;
      }
      await sleep(200);
    }
    assert.ok(derivedRow, 'derived_sensing_state_v1 not generated');

    const derivedPayload = derivedRow.payload_json && typeof derivedRow.payload_json === 'object' ? derivedRow.payload_json : {};
    report.checkpoints.derived_sensing_state_v1 = {
      status_value: String(derivedPayload.fertility_level || derivedPayload.level || 'unknown'),
      explain_codes: Array.isArray(derivedRow.explanation_codes_json) ? derivedRow.explanation_codes_json : [],
      source_timestamps: { computed_at_ts_ms: Number(derivedRow.computed_at_ts_ms) },
      confidence: derivedRow.confidence == null ? null : Number(derivedRow.confidence),
      state_type: String(derivedRow.state_type || ''),
    };

    const readModelRes = await fetchJson(`${base}/api/v1/fields/${encodeURIComponent(field_id)}/sensing-read-models`, { token });
    if (!readModelRes.ok) throw new Error(`READ_MODEL_FAILED:${readModelRes.status}:${readModelRes.text}`);
    const readModel = readModelRes.json || {};

    report.checkpoints.field_read_models_v1 = {
      status_value: {
        sensing_overview: String(readModel?.status?.sensing_overview || 'unknown'),
        fertility_state: String(readModel?.status?.fertility_state || 'unknown'),
      },
      explain_codes: {
        sensing_overview: Array.isArray(readModel?.sensing_overview?.explanation_codes_json) ? readModel.sensing_overview.explanation_codes_json : [],
        fertility_state: Array.isArray(readModel?.fertility_state?.explanation_codes_json) ? readModel.fertility_state.explanation_codes_json : [],
      },
      source_timestamps: {
        sensing_observed_at_ts_ms: readModel?.sensing_overview?.observed_at_ts_ms ?? null,
        fertility_computed_at_ts_ms: readModel?.fertility_state?.computed_at_ts_ms ?? null,
      },
      confidence: {
        sensing_overview: readModel?.sensing_overview?.confidence ?? null,
        fertility_state: readModel?.fertility_state?.confidence ?? null,
      },
    };

    const hit = recommendations.find((item) => {
      const codes = Array.isArray(item?.reason_codes) ? item.reason_codes.map((x) => String(x)) : [];
      return codes.includes('irrigate_first') || codes.includes('inspect');
    });
    assert.ok(hit, 'precheck hint not hit: expected irrigate_first or inspect');

    report.checkpoints.recommendation_precheck = {
      status_value: Array.isArray(hit.reason_codes) && hit.reason_codes.includes('inspect') ? 'inspect' : 'irrigate_first',
      explain_codes: Array.isArray(hit.reason_codes) ? hit.reason_codes : [],
      source_timestamps: { created_ts: hit.created_ts ?? null },
      confidence: hit.confidence ?? null,
      recommendation_id: hit.recommendation_id,
    };

    const fullPath = path.resolve(process.cwd(), reportPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, JSON.stringify({ ok: true, report }, null, 2), 'utf8');
    console.log('PASS ACCEPTANCE_MINIMAL_SENSING_E2E_V1', { report_path: reportPath, recommendation_id: report.checkpoints.recommendation_precheck.recommendation_id });
  } catch (error) {
    const fullPath = path.resolve(process.cwd(), reportPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, JSON.stringify({ ok: false, error: String(error?.message || error), report }, null, 2), 'utf8');
    console.error('FAIL ACCEPTANCE_MINIMAL_SENSING_E2E_V1', error?.message || error);
    process.exitCode = 1;
  } finally {
    await db.end().catch(() => {});
  }
})();
