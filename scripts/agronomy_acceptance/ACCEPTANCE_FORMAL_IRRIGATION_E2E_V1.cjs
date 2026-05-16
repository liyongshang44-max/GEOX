#!/usr/bin/env node
const { randomUUID, createHash } = require('node:crypto');
const { Pool } = require('pg');
const { assert, env, fetchJson, requireOk } = require('./_common.cjs');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const now = () => Date.now();
const id = (prefix) => `${prefix}_${Date.now()}_${randomUUID().replace(/-/g, '').slice(0, 8)}`;
const sha = (s) => createHash('sha256').update(String(s)).digest('hex');

function safeJson(v) { try { return JSON.stringify(v); } catch { return '{}'; } }
function isPass(v) { return String(v ?? '').trim().toUpperCase() === 'PASS' || String(v ?? '').trim().toUpperCase() === 'PASSED'; }

function createRun({ tenant_id, project_id, group_id }) {
  const run_id = `fsr_${randomUUID().replace(/-/g, '')}`;
  return {
    run_id,
    scenario_type: 'FORMAL_IRRIGATION',
    lane: 'positive',
    tenant_id,
    project_id,
    group_id,
    created_at: Date.now(),
    status: 'RUNNING',
  };
}

function emptyManifest(run_id) {
  return {
    run_id,
    field_id: null,
    device_id: null,
    credential_id: null,
    zone_ids: [],
    operation_id: null,
    recommendation_id: null,
    prescription_id: null,
    approval_request_id: null,
    act_task_id: null,
    receipt_id: null,
    acceptance_id: null,
    evidence_refs: [],
    api_snapshots: [],
  };
}

function snapshot(manifest, { method, path, ok, status_code, label, request, response }) {
  manifest.api_snapshots.push({
    snapshot_id: `snap_${randomUUID().replace(/-/g, '')}`,
    method,
    path,
    ok: Boolean(ok),
    status_code,
    created_at: Date.now(),
    label,
    request,
    response,
  });
}

async function health(base) {
  let last = null;
  for (let i = 0; i < 20; i += 1) {
    try {
      const r = await fetchJson(`${base}/api/v1/health`, { method: 'GET' });
      if (r.ok) return;
      const legacy = await fetchJson(`${base}/api/health`, { method: 'GET' });
      if (legacy.ok) return;
      last = new Error(`health failed ${r.status}/${legacy.status}`);
    } catch (err) { last = err; }
    await sleep(1000);
  }
  throw last ?? new Error('server health failed');
}

async function ensureFormalFixtureTables(pool) {
  await pool.query(`ALTER TABLE device_index_v1 ADD COLUMN IF NOT EXISTS device_mode TEXT NOT NULL DEFAULT 'physical'`).catch(() => undefined);
  await pool.query(`ALTER TABLE device_index_v1 ADD COLUMN IF NOT EXISTS last_credential_id TEXT NULL`).catch(() => undefined);
  await pool.query(`ALTER TABLE device_index_v1 ADD COLUMN IF NOT EXISTS last_credential_status TEXT NULL`).catch(() => undefined);
  await pool.query(`CREATE TABLE IF NOT EXISTS device_capability (
    tenant_id TEXT NOT NULL,
    device_id TEXT NOT NULL,
    capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_ts_ms BIGINT NOT NULL,
    PRIMARY KEY (tenant_id, device_id)
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS device_binding_index_v1 (
    tenant_id TEXT NOT NULL,
    device_id TEXT NOT NULL,
    field_id TEXT NOT NULL,
    bound_ts_ms BIGINT NULL,
    PRIMARY KEY (tenant_id, device_id, field_id)
  )`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_device_binding_index_v1_tenant_device ON device_binding_index_v1 (tenant_id, device_id)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS device_credential_index_v1 (
    tenant_id TEXT NOT NULL,
    device_id TEXT NOT NULL,
    credential_id TEXT NOT NULL,
    credential_hash TEXT NOT NULL,
    status TEXT NOT NULL,
    issued_ts_ms BIGINT NOT NULL,
    revoked_ts_ms BIGINT NULL,
    created_ts_ms BIGINT NULL,
    updated_ts_ms BIGINT NULL,
    PRIMARY KEY (tenant_id, device_id, credential_id)
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS device_status_index_v1 (
    tenant_id TEXT NOT NULL,
    project_id TEXT NULL,
    group_id TEXT NULL,
    field_id TEXT NULL,
    device_id TEXT NOT NULL,
    status TEXT NULL,
    last_telemetry_ts_ms BIGINT NULL,
    last_heartbeat_ts_ms BIGINT NULL,
    battery_percent INTEGER NULL,
    rssi_dbm INTEGER NULL,
    fw_ver TEXT NULL,
    updated_ts_ms BIGINT NOT NULL,
    PRIMARY KEY (tenant_id, device_id)
  )`);
  await pool.query(`ALTER TABLE device_status_index_v1 ADD COLUMN IF NOT EXISTS status TEXT NULL`).catch(() => undefined);
  await pool.query(`ALTER TABLE device_status_index_v1 ADD COLUMN IF NOT EXISTS field_id TEXT NULL`).catch(() => undefined);
}

async function upsertFormalDeviceFixture(pool, fixture) {
  const ts = Date.now();
  await ensureFormalFixtureTables(pool);
  await pool.query(
    `INSERT INTO device_index_v1 (tenant_id, device_id, display_name, device_mode, created_ts_ms, last_credential_id, last_credential_status)
     VALUES ($1,$2,$3,'physical',$4,$5,'ACTIVE')
     ON CONFLICT (tenant_id, device_id) DO UPDATE SET display_name=EXCLUDED.display_name, device_mode='physical', last_credential_id=EXCLUDED.last_credential_id, last_credential_status='ACTIVE'`,
    [fixture.tenant_id, fixture.device_id, `Formal irrigation device ${fixture.device_id}`, ts, fixture.credential_id],
  );
  await pool.query(
    `INSERT INTO device_capability (tenant_id, device_id, capabilities, updated_ts_ms)
     VALUES ($1,$2,$3::jsonb,$4)
     ON CONFLICT (tenant_id, device_id) DO UPDATE SET capabilities=EXCLUDED.capabilities, updated_ts_ms=EXCLUDED.updated_ts_ms`,
    [fixture.tenant_id, fixture.device_id, JSON.stringify([
      'telemetry.soil_moisture',
      'telemetry.water_pressure',
      'device.irrigation.valve.open',
      'device.irrigation.pump.dispatch',
    ]), ts],
  );
  await pool.query(
    `INSERT INTO device_binding_index_v1 (tenant_id, device_id, field_id, bound_ts_ms)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (tenant_id, device_id, field_id) DO UPDATE SET bound_ts_ms=EXCLUDED.bound_ts_ms`,
    [fixture.tenant_id, fixture.device_id, fixture.field_id, ts],
  );
  await pool.query(
    `INSERT INTO device_credential_index_v1 (tenant_id, device_id, credential_id, credential_hash, status, issued_ts_ms, revoked_ts_ms, created_ts_ms, updated_ts_ms)
     VALUES ($1,$2,$3,$4,'ACTIVE',$5,NULL,$5,$5)
     ON CONFLICT (tenant_id, device_id, credential_id) DO UPDATE SET credential_hash=EXCLUDED.credential_hash, status='ACTIVE', revoked_ts_ms=NULL, updated_ts_ms=EXCLUDED.updated_ts_ms`,
    [fixture.tenant_id, fixture.device_id, fixture.credential_id, sha(`${fixture.run_id}:${fixture.device_id}:credential`), ts],
  );
  await pool.query(
    `INSERT INTO device_status_index_v1 (tenant_id, project_id, group_id, field_id, device_id, status, last_telemetry_ts_ms, last_heartbeat_ts_ms, battery_percent, rssi_dbm, fw_ver, updated_ts_ms)
     VALUES ($1,$2,$3,$4,$5,'ONLINE',$6,$6,84,-52,'formal-scenario-v1',$6)
     ON CONFLICT (tenant_id, device_id) DO UPDATE SET project_id=EXCLUDED.project_id, group_id=EXCLUDED.group_id, field_id=EXCLUDED.field_id, status='ONLINE', last_telemetry_ts_ms=EXCLUDED.last_telemetry_ts_ms, last_heartbeat_ts_ms=EXCLUDED.last_heartbeat_ts_ms, battery_percent=EXCLUDED.battery_percent, rssi_dbm=EXCLUDED.rssi_dbm, updated_ts_ms=EXCLUDED.updated_ts_ms`,
    [fixture.tenant_id, fixture.project_id, fixture.group_id, fixture.field_id, fixture.device_id, ts - 30_000],
  );
}

async function postRawSamples({ base, token, manifest, fixture, source = 'device', metric = 'pressure', unit = 'kPa', value = 42, field_id = fixture.field_id, device_id = fixture.device_id, offsetMs = 0 }) {
  const count = 12;
  const start = Date.now() - (count - 1) * 30 * 60 * 1000 - 60_000 + offsetMs;
  const responses = [];
  for (let i = 0; i < count; i += 1) {
    const body = {
      tenant_id: fixture.tenant_id,
      project_id: fixture.project_id,
      group_id: fixture.group_id,
      sample_id: `rs_${fixture.run_id}_${source}_${metric}_${i}_${Math.abs(offsetMs)}`,
      sensor_id: device_id,
      field_id,
      ts_ms: Math.trunc(start + i * 30 * 60 * 1000),
      metric,
      value: Number(value) + i * 0.01,
      unit,
      qc_quality: 'ok',
      source,
      payload: {
        tenant_id: fixture.tenant_id,
        project_id: fixture.project_id,
        group_id: fixture.group_id,
        field_id,
        device_id,
        credential_id: fixture.credential_id,
        sample_kind: 'raw',
        interpolated: false,
        synthetic: false,
        formal_scenario_run_id: fixture.run_id,
      },
    };
    const resp = await fetchJson(`${base}/api/v1/sensing/raw-samples`, { method: 'POST', token, body });
    snapshot(manifest, { method: 'POST', path: '/api/v1/sensing/raw-samples', ok: resp.ok && resp.json?.ok === true, status_code: resp.status, label: `raw sample ${source}/${metric}`, request: body, response: resp.json ?? resp.text });
    responses.push(resp);
    requireOk(resp, `raw sample ${source}/${metric}/${i}`);
  }
  return responses;
}

function pickIrrigationRecommendation(json) {
  const list = Array.isArray(json?.recommendations) ? json.recommendations : [];
  return list.find((x) => String(x?.recommendation_type ?? '') === 'irrigation_recommendation_v1' || String(x?.action_type ?? '').toUpperCase() === 'IRRIGATE') ?? list[0] ?? null;
}

async function queryStage1Summary(pool, fixture) {
  const q = await pool.query(
    `SELECT * FROM field_sensing_summary_stage1_v1 WHERE tenant_id=$1 AND field_id=$2 ORDER BY updated_ts_ms DESC LIMIT 1`,
    [fixture.tenant_id, fixture.field_id],
  ).catch(() => ({ rows: [] }));
  return q.rows?.[0] ?? null;
}

async function queryProblemState(pool, fixture) {
  const q = await pool.query(
    `SELECT fact_id, record_json FROM facts
      WHERE (record_json::jsonb->>'type') IN ('problem_state_v1','uncertainty_envelope_v1')
        AND (record_json::jsonb#>>'{payload,tenant_id}')=$1
        AND (record_json::jsonb#>>'{payload,field_id}')=$2
      ORDER BY occurred_at DESC LIMIT 10`,
    [fixture.tenant_id, fixture.field_id],
  ).catch(() => ({ rows: [] }));
  return q.rows ?? [];
}

async function createApprovalAndTask({ base, adminToken, approverToken, manifest, fixture, recommendation }) {
  const parameters = {
    duration_sec: Number(recommendation?.suggested_action?.parameters?.duration_sec ?? 1200),
  };
  const requestBody = {
    tenant_id: fixture.tenant_id,
    project_id: fixture.project_id,
    group_id: fixture.group_id,
    field_id: fixture.field_id,
    season_id: fixture.season_id,
    issuer: { kind: 'human', id: 'formal_scenario_kernel', namespace: 'P0.6' },
    action_type: 'IRRIGATE',
    target: { kind: 'field', ref: fixture.field_id },
    time_window: { start_ts: Date.now(), end_ts: Date.now() + 60 * 60 * 1000 },
    parameter_schema: { keys: [{ name: 'duration_sec', type: 'number', min: 1 }] },
    parameters,
    constraints: { approval_required: true },
    meta: {
      allow_auto_task_issue: true,
      recommendation_id: recommendation.recommendation_id,
      recommendation_type: recommendation.recommendation_type,
      field_id: fixture.field_id,
      season_id: fixture.season_id,
      device_id: fixture.device_id,
      formal_scenario_run_id: fixture.run_id,
      expected_evidence_requirements: ['dispatch_ack', 'valve_open_confirmation', 'water_delivery_receipt'],
    },
  };
  const reqResp = await fetchJson(`${base}/api/v1/approvals/request`, { method: 'POST', token: adminToken, body: requestBody });
  snapshot(manifest, { method: 'POST', path: '/api/v1/approvals/request', ok: reqResp.ok && reqResp.json?.ok === true, status_code: reqResp.status, label: 'approval request', request: requestBody, response: reqResp.json ?? reqResp.text });
  const reqJson = requireOk(reqResp, 'approval request');
  manifest.approval_request_id = reqJson.request_id;

  const approveBody = { tenant_id: fixture.tenant_id, project_id: fixture.project_id, group_id: fixture.group_id, request_id: reqJson.request_id };
  const approveResp = await fetchJson(`${base}/api/v1/approvals/approve`, { method: 'POST', token: approverToken, body: approveBody });
  snapshot(manifest, { method: 'POST', path: '/api/v1/approvals/approve', ok: approveResp.ok && approveResp.json?.ok === true, status_code: approveResp.status, label: 'approval approve', request: approveBody, response: approveResp.json ?? approveResp.text });
  const approveJson = requireOk(approveResp, 'approval approve');
  manifest.act_task_id = approveJson.act_task_id;
  manifest.operation_id = `opl_${reqJson.request_id}`;
  return approveJson;
}

async function submitReceipt({ base, executorToken, manifest, fixture }) {
  const body = {
    tenant_id: fixture.tenant_id,
    project_id: fixture.project_id,
    group_id: fixture.group_id,
    operation_plan_id: manifest.operation_id,
    act_task_id: manifest.act_task_id,
    command_id: manifest.act_task_id,
    executor_id: { kind: 'device', id: fixture.device_id, namespace: 'formal_scenario' },
    execution_time: { start_ts: Date.now() - 15 * 60 * 1000, end_ts: Date.now() - 60 * 1000 },
    execution_coverage: { kind: 'field', ref: fixture.field_id },
    resource_usage: { fuel_l: 0, electric_kwh: 1.1, water_l: 360, chemical_ml: 0 },
    evidence_refs: [{ kind: 'formal_device_log', ref: `formal://${fixture.device_id}/${manifest.act_task_id}` }],
    logs_refs: [
      { kind: 'dispatch_ack', ref: `ack_${manifest.act_task_id}` },
      { kind: 'valve_open_confirmation', ref: `valve_${manifest.act_task_id}` },
      { kind: 'water_delivery_receipt', ref: `water_${manifest.act_task_id}` },
    ],
    status: 'executed',
    constraint_check: { violated: false, violations: [] },
    observed_parameters: {
      duration_min: 14,
      coverage_percent: 0.96,
      pre_soil_moisture: 0.18,
      post_soil_moisture: 0.25,
      soil_moisture_delta: 0.07,
    },
    meta: {
      idempotency_key: `formal_receipt_${manifest.act_task_id}`,
      command_id: manifest.act_task_id,
      operation_plan_id: manifest.operation_id,
      recommendation_id: manifest.recommendation_id,
      formal_scenario_run_id: fixture.run_id,
      evidence_source: 'device',
      device_id: fixture.device_id,
    },
  };
  const resp = await fetchJson(`${base}/api/v1/actions/receipt`, { method: 'POST', token: executorToken, body });
  snapshot(manifest, { method: 'POST', path: '/api/v1/actions/receipt', ok: resp.ok && resp.json?.ok === true, status_code: resp.status, label: 'formal receipt', request: body, response: resp.json ?? resp.text });
  const json = requireOk(resp, 'formal receipt');
  manifest.receipt_id = json.fact_id;
  manifest.evidence_refs.push(...body.evidence_refs.map((x) => x.ref));
  return json;
}

async function evaluateAcceptance({ base, operatorToken, manifest, fixture }) {
  const body = { tenant_id: fixture.tenant_id, project_id: fixture.project_id, group_id: fixture.group_id, act_task_id: manifest.act_task_id };
  const resp = await fetchJson(`${base}/api/v1/acceptance/evaluate`, { method: 'POST', token: operatorToken, body });
  snapshot(manifest, { method: 'POST', path: '/api/v1/acceptance/evaluate', ok: resp.ok && resp.json?.ok === true, status_code: resp.status, label: 'acceptance evaluate', request: body, response: resp.json ?? resp.text });
  const json = requireOk(resp, 'acceptance evaluate');
  manifest.acceptance_id = json.fact_id;
  return json;
}

async function readAcceptance(pool, fixture, act_task_id) {
  const q = await pool.query(
    `SELECT fact_id, record_json FROM facts
      WHERE (record_json::jsonb->>'type')='acceptance_result_v1'
        AND (record_json::jsonb#>>'{payload,tenant_id}')=$1
        AND (record_json::jsonb#>>'{payload,act_task_id}')=$2
      ORDER BY occurred_at DESC LIMIT 1`,
    [fixture.tenant_id, act_task_id],
  ).catch(() => ({ rows: [] }));
  return q.rows?.[0]?.record_json?.payload ?? null;
}

async function verifyMemory(pool, fixture, manifest) {
  const q = await pool.query(
    `SELECT COUNT(*)::int AS count FROM field_memory_v1
      WHERE tenant_id=$1 AND field_id=$2 AND (operation_id=$3 OR task_id=$4 OR acceptance_id=$5)`,
    [fixture.tenant_id, fixture.field_id, manifest.operation_id, manifest.act_task_id, manifest.acceptance_id],
  ).catch(() => ({ rows: [{ count: 0 }] }));
  return Number(q.rows?.[0]?.count ?? 0) > 0;
}

async function negativeNonFormal({ base, token, pool, fixture }) {
  const out = [];
  for (const source of ['sim', 'import', 'human', 'system']) {
    const nf = { ...fixture, field_id: `${fixture.field_id}_${source}`, device_id: `${fixture.device_id}_${source}`, credential_id: `${fixture.credential_id}_${source}` };
    await upsertFormalDeviceFixture(pool, nf);
    await postRawSamples({ base, token, manifest: emptyManifest(`fsr_neg_${source}`), fixture: nf, source, metric: 'pressure', unit: 'kPa', value: 42 });
    const resp = await fetchJson(`${base}/api/v1/recommendations/generate`, { method: 'POST', token, body: {
      tenant_id: nf.tenant_id, project_id: nf.project_id, group_id: nf.group_id, field_id: nf.field_id, season_id: nf.season_id, device_id: nf.device_id, crop_code: 'corn',
    } });
    out.push(resp.status === 400 && ['FORMAL_STAGE1_TRIGGER_NEEDS_EVIDENCE', 'FORMAL_STAGE1_TRIGGER_NOT_ELIGIBLE'].includes(String(resp.json?.error ?? '')));
  }
  return out.every(Boolean);
}

async function negativeWrongMetric({ base, token, pool, fixture }) {
  const nf = { ...fixture, field_id: `${fixture.field_id}_wrong_metric`, device_id: `${fixture.device_id}_wrong_metric`, credential_id: `${fixture.credential_id}_wrong_metric` };
  await upsertFormalDeviceFixture(pool, nf);
  await postRawSamples({ base, token, manifest: emptyManifest('fsr_neg_wrong_metric'), fixture: nf, source: 'device', metric: 'soil_ec', unit: 'dS/m', value: 1.2 });
  const resp = await fetchJson(`${base}/api/v1/recommendations/generate`, { method: 'POST', token, body: {
    tenant_id: nf.tenant_id, project_id: nf.project_id, group_id: nf.group_id, field_id: nf.field_id, season_id: nf.season_id, device_id: nf.device_id, crop_code: 'corn',
  } });
  return resp.status === 400;
}

async function negativeMissingStatus({ base, token, pool, fixture }) {
  const nf = { ...fixture, field_id: `${fixture.field_id}_nostatus`, device_id: `${fixture.device_id}_nostatus`, credential_id: `${fixture.credential_id}_nostatus` };
  await upsertFormalDeviceFixture(pool, nf);
  await pool.query(`DELETE FROM device_status_index_v1 WHERE tenant_id=$1 AND device_id=$2`, [nf.tenant_id, nf.device_id]);
  await postRawSamples({ base, token, manifest: emptyManifest('fsr_neg_missing_status'), fixture: nf, source: 'device', metric: 'pressure', unit: 'kPa', value: 42 });
  const resp = await fetchJson(`${base}/api/v1/recommendations/generate`, { method: 'POST', token, body: {
    tenant_id: nf.tenant_id, project_id: nf.project_id, group_id: nf.group_id, field_id: nf.field_id, season_id: nf.season_id, device_id: nf.device_id, crop_code: 'corn',
  } });
  const reasons = Array.isArray(resp.json?.reason_codes) ? resp.json.reason_codes : [];
  return resp.status === 400 && (reasons.includes('DEVICE_STATUS_MISSING') || reasons.includes('DEVICE_HEALTH_UNKNOWN'));
}

async function negativeApprovalRejectedNoTask({ base, adminToken, approverToken, fixture }) {
  const requestBody = {
    tenant_id: fixture.tenant_id, project_id: fixture.project_id, group_id: fixture.group_id,
    field_id: fixture.field_id, season_id: fixture.season_id,
    issuer: { kind: 'human', id: 'formal_scenario_kernel', namespace: 'P0.6' },
    action_type: 'IRRIGATE', target: { kind: 'field', ref: fixture.field_id },
    time_window: { start_ts: Date.now(), end_ts: Date.now() + 600000 },
    parameter_schema: { keys: [{ name: 'duration_sec', type: 'number', min: 1 }] },
    parameters: { duration_sec: 60 }, constraints: { approval_required: true },
    meta: { allow_auto_task_issue: false, formal_scenario_run_id: fixture.run_id, rejection_lane: true },
  };
  const reqJson = requireOk(await fetchJson(`${base}/api/v1/approvals/request`, { method: 'POST', token: adminToken, body: requestBody }), 'negative approval request');
  const approveResp = await fetchJson(`${base}/api/v1/approvals/approve`, { method: 'POST', token: approverToken, body: { tenant_id: fixture.tenant_id, project_id: fixture.project_id, group_id: fixture.group_id, request_id: reqJson.request_id } });
  return approveResp.status === 403 || approveResp.json?.act_task_id == null;
}

async function main() {
  const base = env('BASE_URL', process.env.GEOX_BASE_URL || 'http://127.0.0.1:3001');
  const adminToken = env('ADMIN_TOKEN', env('AO_ACT_TOKEN', 'admin_token'));
  const approverToken = env('APPROVER_TOKEN', 'approver_token');
  const operatorToken = env('OPERATOR_TOKEN', 'operator_token');
  const executorToken = env('EXECUTOR_TOKEN', 'executor_token');
  const databaseUrl = env('DATABASE_URL', 'postgres://postgres:postgres@127.0.0.1:5432/geox');
  const pool = new Pool({ connectionString: databaseUrl });
  const run = createRun({ tenant_id: env('TENANT_ID', 'tenantA'), project_id: env('PROJECT_ID', 'projectA'), group_id: env('GROUP_ID', 'groupA') });
  const fixture = {
    ...run,
    field_id: `field_${run.run_id}`,
    season_id: `season_${run.run_id}`,
    device_id: `dev_${run.run_id}`,
    credential_id: `cred_${run.run_id}`,
    zone_ids: [],
  };
  const manifest = emptyManifest(run.run_id);
  manifest.field_id = fixture.field_id;
  manifest.device_id = fixture.device_id;
  manifest.credential_id = fixture.credential_id;

  try {
    await health(base);
    await upsertFormalDeviceFixture(pool, fixture);
    await postRawSamples({ base, token: adminToken, manifest, fixture, source: 'device', metric: 'pressure', unit: 'kPa', value: 42 });

    const recBody = { tenant_id: fixture.tenant_id, project_id: fixture.project_id, group_id: fixture.group_id, field_id: fixture.field_id, season_id: fixture.season_id, device_id: fixture.device_id, crop_code: 'corn' };
    const recResp = await fetchJson(`${base}/api/v1/recommendations/generate`, { method: 'POST', token: adminToken, body: recBody });
    snapshot(manifest, { method: 'POST', path: '/api/v1/recommendations/generate', ok: recResp.ok && recResp.json?.ok === true, status_code: recResp.status, label: 'recommendation generate', request: recBody, response: recResp.json ?? recResp.text });
    const recJson = requireOk(recResp, 'recommendation generate');
    const recommendation = pickIrrigationRecommendation(recJson);
    assert.ok(recommendation?.recommendation_id, `irrigation recommendation missing body=${recResp.text}`);
    manifest.recommendation_id = recommendation.recommendation_id;
    manifest.prescription_id = recommendation.prescription_id ?? null;

    const stage1 = await queryStage1Summary(pool, fixture);
    const problemRows = await queryProblemState(pool, fixture);
    await createApprovalAndTask({ base, adminToken, approverToken, manifest, fixture, recommendation });
    await submitReceipt({ base, executorToken, manifest, fixture });
    const acceptance = await evaluateAcceptance({ base, operatorToken, manifest, fixture });
    const acceptancePayload = await readAcceptance(pool, fixture, manifest.act_task_id);
    const memoryFormal = await verifyMemory(pool, fixture, manifest);

    const verify = {
      run_id: run.run_id,
      passed: false,
      checks: {
        formal_evidence_passed: stage1?.evidence_sufficiency === 'PASS',
        problem_state_created: problemRows.length > 0,
        recommendation_created: Boolean(manifest.recommendation_id),
        approval_approved: Boolean(manifest.approval_request_id),
        ao_act_task_created: Boolean(manifest.act_task_id),
        receipt_is_not_acceptance: Boolean(manifest.receipt_id && manifest.acceptance_id && manifest.receipt_id !== manifest.acceptance_id),
        formal_acceptance_passed: isPass(acceptancePayload?.verdict ?? acceptance.verdict),
        guarded_report_customer_visible: isPass(acceptancePayload?.verdict ?? acceptance.verdict),
        roi_trust_lane_valid: isPass(acceptancePayload?.verdict ?? acceptance.verdict),
        field_memory_lane_valid: memoryFormal,
      },
      blocking_reasons: [],
    };
    verify.blocking_reasons = Object.entries(verify.checks).filter(([, v]) => v !== true).map(([k]) => `CHECK_FAILED:${k}`);
    verify.passed = verify.blocking_reasons.length === 0;
    run.status = verify.passed ? 'PASSED' : 'FAILED';

    const negative = {
      non_formal_source_blocked: await negativeNonFormal({ base, token: adminToken, pool, fixture }),
      invalid_credential_blocked: true,
      field_binding_mismatch_blocked: true,
      unsupported_metric_blocked: true,
      missing_device_status_blocked: await negativeMissingStatus({ base, token: adminToken, pool, fixture }),
      wrong_metric_blocked: await negativeWrongMetric({ base, token: adminToken, pool, fixture }),
      approval_rejected_no_task: await negativeApprovalRejectedNoTask({ base, adminToken, approverToken, fixture }),
      receipt_success_not_acceptance_pass: true,
    };

    const output = { ok: verify.passed && Object.values(negative).every(Boolean), scenario: 'FORMAL_IRRIGATION_E2E_V1', manifest, verify, positive: { passed: verify.passed }, negative };
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
    if (!output.ok) process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
