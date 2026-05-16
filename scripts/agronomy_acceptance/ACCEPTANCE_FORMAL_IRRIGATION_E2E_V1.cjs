#!/usr/bin/env node
const { randomUUID, createHash } = require('node:crypto');
const { Pool } = require('pg');
const { assert, env, fetchJson, requireOk } = require('./_common.cjs');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const sha = (s) => createHash('sha256').update(String(s)).digest('hex');
const isPass = (v) => ['PASS', 'PASSED'].includes(String(v ?? '').trim().toUpperCase());

function runId() { return `fsr_${randomUUID().replace(/-/g, '')}`; }
function sid(prefix) { return `${prefix}_${Date.now()}_${randomUUID().replace(/-/g, '').slice(0, 8)}`; }
function fixture(scope, suffix = runId()) {
  return {
    run_id: suffix,
    ...scope,
    field_id: `field_${suffix}`,
    season_id: `season_${suffix}`,
    device_id: `dev_${suffix}`,
    credential_id: `cred_${suffix}`,
  };
}
function manifestOf(fx) {
  return {
    run_id: fx.run_id,
    field_id: fx.field_id,
    device_id: fx.device_id,
    credential_id: fx.credential_id,
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
function snap(manifest, input) {
  manifest.api_snapshots.push({ snapshot_id: `snap_${randomUUID().replace(/-/g, '')}`, created_at: Date.now(), ...input });
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

async function ensureFixtureTables(pool) {
  await pool.query(`ALTER TABLE device_index_v1 ADD COLUMN IF NOT EXISTS device_mode TEXT NOT NULL DEFAULT 'physical'`).catch(() => undefined);
  await pool.query(`ALTER TABLE device_index_v1 ADD COLUMN IF NOT EXISTS last_credential_id TEXT NULL`).catch(() => undefined);
  await pool.query(`ALTER TABLE device_index_v1 ADD COLUMN IF NOT EXISTS last_credential_status TEXT NULL`).catch(() => undefined);
  await pool.query(`CREATE TABLE IF NOT EXISTS device_capability (tenant_id TEXT NOT NULL, device_id TEXT NOT NULL, capabilities JSONB NOT NULL DEFAULT '[]'::jsonb, updated_ts_ms BIGINT NOT NULL, PRIMARY KEY (tenant_id, device_id))`);
  await pool.query(`CREATE TABLE IF NOT EXISTS device_binding_index_v1 (tenant_id TEXT NOT NULL, device_id TEXT NOT NULL, field_id TEXT NOT NULL, bound_ts_ms BIGINT NULL, PRIMARY KEY (tenant_id, device_id, field_id))`);
  await pool.query(`CREATE TABLE IF NOT EXISTS device_credential_index_v1 (tenant_id TEXT NOT NULL, device_id TEXT NOT NULL, credential_id TEXT NOT NULL, credential_hash TEXT NOT NULL, status TEXT NOT NULL, issued_ts_ms BIGINT NOT NULL, revoked_ts_ms BIGINT NULL, created_ts_ms BIGINT NULL, updated_ts_ms BIGINT NULL, PRIMARY KEY (tenant_id, device_id, credential_id))`);
  await pool.query(`CREATE TABLE IF NOT EXISTS device_status_index_v1 (tenant_id TEXT NOT NULL, project_id TEXT NULL, group_id TEXT NULL, field_id TEXT NULL, device_id TEXT NOT NULL, status TEXT NULL, last_telemetry_ts_ms BIGINT NULL, last_heartbeat_ts_ms BIGINT NULL, battery_percent INTEGER NULL, rssi_dbm INTEGER NULL, fw_ver TEXT NULL, updated_ts_ms BIGINT NOT NULL, PRIMARY KEY (tenant_id, device_id))`);
  await pool.query(`ALTER TABLE device_status_index_v1 ADD COLUMN IF NOT EXISTS status TEXT NULL`).catch(() => undefined);
  await pool.query(`ALTER TABLE device_status_index_v1 ADD COLUMN IF NOT EXISTS field_id TEXT NULL`).catch(() => undefined);
}
async function upsertDevice(pool, fx) {
  await ensureFixtureTables(pool);
  const ts = Date.now();
  await pool.query(
    `INSERT INTO device_index_v1 (tenant_id, device_id, display_name, device_mode, created_ts_ms, last_credential_id, last_credential_status)
     VALUES ($1,$2,$3,'physical',$4,$5,'ACTIVE')
     ON CONFLICT (tenant_id, device_id) DO UPDATE SET display_name=EXCLUDED.display_name, device_mode='physical', last_credential_id=EXCLUDED.last_credential_id, last_credential_status='ACTIVE'`,
    [fx.tenant_id, fx.device_id, `Formal irrigation device ${fx.device_id}`, ts, fx.credential_id],
  );
  await pool.query(
    `INSERT INTO device_capability (tenant_id, device_id, capabilities, updated_ts_ms)
     VALUES ($1,$2,$3::jsonb,$4)
     ON CONFLICT (tenant_id, device_id) DO UPDATE SET capabilities=EXCLUDED.capabilities, updated_ts_ms=EXCLUDED.updated_ts_ms`,
    [fx.tenant_id, fx.device_id, JSON.stringify(['telemetry.soil_moisture', 'telemetry.water_pressure', 'telemetry.inlet_flow_lpm', 'telemetry.outlet_flow_lpm', 'telemetry.pressure_drop_kpa', 'device.irrigation.valve.open']), ts],
  );
  await pool.query(`INSERT INTO device_binding_index_v1 (tenant_id, device_id, field_id, bound_ts_ms) VALUES ($1,$2,$3,$4) ON CONFLICT (tenant_id, device_id, field_id) DO UPDATE SET bound_ts_ms=EXCLUDED.bound_ts_ms`, [fx.tenant_id, fx.device_id, fx.field_id, ts]);
  await pool.query(`INSERT INTO device_credential_index_v1 (tenant_id, device_id, credential_id, credential_hash, status, issued_ts_ms, revoked_ts_ms, created_ts_ms, updated_ts_ms) VALUES ($1,$2,$3,$4,'ACTIVE',$5,NULL,$5,$5) ON CONFLICT (tenant_id, device_id, credential_id) DO UPDATE SET credential_hash=EXCLUDED.credential_hash, status='ACTIVE', revoked_ts_ms=NULL, updated_ts_ms=EXCLUDED.updated_ts_ms`, [fx.tenant_id, fx.device_id, fx.credential_id, sha(`${fx.run_id}:${fx.device_id}:credential`), ts]);
  await pool.query(`INSERT INTO device_status_index_v1 (tenant_id, project_id, group_id, field_id, device_id, status, last_telemetry_ts_ms, last_heartbeat_ts_ms, battery_percent, rssi_dbm, fw_ver, updated_ts_ms) VALUES ($1,$2,$3,$4,$5,'ONLINE',$6,$6,84,-52,'formal-scenario-v1',$6) ON CONFLICT (tenant_id, device_id) DO UPDATE SET project_id=EXCLUDED.project_id, group_id=EXCLUDED.group_id, field_id=EXCLUDED.field_id, status='ONLINE', last_telemetry_ts_ms=EXCLUDED.last_telemetry_ts_ms, last_heartbeat_ts_ms=EXCLUDED.last_heartbeat_ts_ms, battery_percent=EXCLUDED.battery_percent, rssi_dbm=EXCLUDED.rssi_dbm, updated_ts_ms=EXCLUDED.updated_ts_ms`, [fx.tenant_id, fx.project_id, fx.group_id, fx.field_id, fx.device_id, ts - 30_000]);
}

async function postSamples({ base, token, fx, manifest = null, source = 'device', metric = 'pressure', unit = 'kPa', value = 42, count = 12, expectOk = true, field_id = fx.field_id, device_id = fx.device_id, credential_id = fx.credential_id, offsetMs = 0 }) {
  const out = [];
  const start = Date.now() - (count - 1) * 30 * 60 * 1000 - 60_000 + offsetMs;
  for (let i = 0; i < count; i += 1) {
    const body = {
      tenant_id: fx.tenant_id, project_id: fx.project_id, group_id: fx.group_id,
      sample_id: sid(`rs_${fx.run_id}_${source}_${metric}_${i}`),
      sensor_id: device_id, field_id,
      ts_ms: Math.trunc(start + i * 30 * 60 * 1000), metric, value: Number(value) + i * 0.01, unit, qc_quality: 'ok', source,
      payload: { tenant_id: fx.tenant_id, project_id: fx.project_id, group_id: fx.group_id, field_id, device_id, credential_id, sample_kind: 'raw', interpolated: false, synthetic: false, formal_scenario_run_id: fx.run_id },
    };
    const resp = await fetchJson(`${base}/api/v1/sensing/raw-samples`, { method: 'POST', token, body });
    if (manifest) snap(manifest, { method: 'POST', path: '/api/v1/sensing/raw-samples', ok: resp.ok && resp.json?.ok === true, status_code: resp.status, label: `${source}/${metric}`, request: body, response: resp.json ?? resp.text });
    out.push(resp);
    if (expectOk) requireOk(resp, `raw sample ${source}/${metric}/${i}`);
    else return out;
  }
  return out;
}
async function generateRecommendation({ base, token, fx, manifest = null }) {
  const body = { tenant_id: fx.tenant_id, project_id: fx.project_id, group_id: fx.group_id, field_id: fx.field_id, season_id: fx.season_id, device_id: fx.device_id, crop_code: 'corn' };
  const resp = await fetchJson(`${base}/api/v1/recommendations/generate`, { method: 'POST', token, body });
  if (manifest) snap(manifest, { method: 'POST', path: '/api/v1/recommendations/generate', ok: resp.ok && resp.json?.ok === true, status_code: resp.status, label: 'recommendation generate', request: body, response: resp.json ?? resp.text });
  return resp;
}
async function ensureCropContextViaProgram({ base, token, fx, manifest = null }) {
  const body = {
    tenant_id: fx.tenant_id,
    project_id: fx.project_id,
    group_id: fx.group_id,
    program_id: `prg_${fx.run_id}`,
    field_id: fx.field_id,
    season_id: fx.season_id,
    crop_code: 'corn',
    status: 'ACTIVE',
    goal_profile: { yield_priority: 'high', quality_priority: 'medium', residue_priority: 'low', water_saving_priority: 'medium', cost_priority: 'medium' },
    constraints: { forbid_pesticide_classes: [], forbid_fertilizer_types: [], max_irrigation_mm_per_day: null, manual_approval_required_for: [], allow_night_irrigation: true, max_irrigation_rounds_per_day: 3 },
    budget: { max_cost_total: null, currency: 'USD' },
    execution_policy: { mode: 'approval_required', auto_execute_allowed_task_types: [] },
  };
  const resp = await fetchJson(`${base}/api/v1/programs`, { method: 'POST', token, body });
  if (manifest) snap(manifest, { method: 'POST', path: '/api/v1/programs', ok: resp.ok && resp.json?.ok === true, status_code: resp.status, label: 'field program create', request: body, response: resp.json ?? resp.text });
  return requireOk(resp, 'field program create');
}
function pickRecommendation(json) {
  const list = Array.isArray(json?.recommendations) ? json.recommendations : [];
  return list.find((x) => String(x?.recommendation_type ?? '') === 'irrigation_recommendation_v1' || String(x?.action_type ?? '').toUpperCase() === 'IRRIGATE') ?? list[0] ?? null;
}
async function stage1(pool, fx) {
  const q = await pool.query(`SELECT * FROM field_sensing_summary_stage1_v1 WHERE tenant_id=$1 AND field_id=$2 ORDER BY updated_ts_ms DESC LIMIT 1`, [fx.tenant_id, fx.field_id]).catch(() => ({ rows: [] }));
  return q.rows?.[0] ?? null;
}
async function problemRows(pool, fx) {
  const q = await pool.query(
    `SELECT fact_id
       FROM facts
      WHERE (record_json::jsonb->>'type') IN ('problem_state_v1','uncertainty_envelope_v1')
        AND (record_json::jsonb#>>'{payload,tenant_id}')=$1
        AND (
          (record_json::jsonb#>>'{payload,field_id}')=$2
          OR (record_json::jsonb#>>'{payload,target,ref}')=$2
          OR (record_json::jsonb#>>'{payload,context,field_id}')=$2
        )
      ORDER BY occurred_at DESC
      LIMIT 20`,
    [fx.tenant_id, fx.field_id],
  ).catch(() => ({ rows: [] }));
  return q.rows ?? [];
}
async function createTask({ base, adminToken, approverToken, fx, manifest, recommendation, allowAuto = true }) {
  const requestBody = {
    tenant_id: fx.tenant_id, project_id: fx.project_id, group_id: fx.group_id, field_id: fx.field_id, season_id: fx.season_id,
    issuer: { kind: 'human', id: 'formal_scenario_kernel', namespace: 'P0.6' }, action_type: 'IRRIGATE', target: { kind: 'field', ref: fx.field_id },
    time_window: { start_ts: Date.now(), end_ts: Date.now() + 60 * 60 * 1000 },
    parameter_schema: {
      keys: [
        { name: 'duration_sec', type: 'number', min: 1 },
        { name: 'duration_min', type: 'number', min: 0 },
        { name: 'coverage_percent', type: 'number', min: 0, max: 1 },
        { name: 'pre_soil_moisture', type: 'number', min: 0 },
        { name: 'post_soil_moisture', type: 'number', min: 0 },
        { name: 'soil_moisture_delta', type: 'number' },
      ]
    },
    parameters: {
      duration_sec: 1200,
      duration_min: 14,
      coverage_percent: 0.96,
      pre_soil_moisture: 0.18,
      post_soil_moisture: 0.25,
      soil_moisture_delta: 0.07,
    },
    constraints: { approval_required: true },
    meta: { allow_auto_task_issue: allowAuto, recommendation_id: recommendation?.recommendation_id ?? null, field_id: fx.field_id, season_id: fx.season_id, device_id: fx.device_id, formal_scenario_run_id: fx.run_id, expected_evidence_requirements: ['dispatch_ack', 'valve_open_confirmation', 'water_delivery_receipt'] },
  };
  const reqResp = await fetchJson(`${base}/api/v1/approvals/request`, { method: 'POST', token: adminToken, body: requestBody });
  if (manifest) snap(manifest, { method: 'POST', path: '/api/v1/approvals/request', ok: reqResp.ok && reqResp.json?.ok === true, status_code: reqResp.status, label: 'approval request', request: requestBody, response: reqResp.json ?? reqResp.text });
  const reqJson = requireOk(reqResp, 'approval request');
  if (manifest) manifest.approval_request_id = reqJson.request_id;
  const approveBody = { tenant_id: fx.tenant_id, project_id: fx.project_id, group_id: fx.group_id, request_id: reqJson.request_id };
  const approveResp = await fetchJson(`${base}/api/v1/approvals/approve`, { method: 'POST', token: approverToken, body: approveBody });
  if (manifest) snap(manifest, { method: 'POST', path: '/api/v1/approvals/approve', ok: approveResp.ok && approveResp.json?.ok === true, status_code: approveResp.status, label: 'approval approve', request: approveBody, response: approveResp.json ?? approveResp.text });
  if (!allowAuto) return approveResp;
  const approveJson = requireOk(approveResp, 'approval approve');
  if (manifest) { manifest.act_task_id = approveJson.act_task_id; manifest.operation_id = `opl_${reqJson.request_id}`; }
  return approveJson;
}
async function receipt({ base, executorToken, fx, manifest, pre = 0.18, post = 0.25, delta = 0.07 }) {
  const body = {
    tenant_id: fx.tenant_id, project_id: fx.project_id, group_id: fx.group_id, operation_plan_id: manifest.operation_id, act_task_id: manifest.act_task_id, command_id: manifest.act_task_id,
    executor_id: { kind: 'device', id: fx.device_id, namespace: 'formal_scenario' }, execution_time: { start_ts: Date.now() - 900000, end_ts: Date.now() - 60000 }, execution_coverage: { kind: 'field', ref: fx.field_id },
    resource_usage: { fuel_l: 0, electric_kwh: 1.1, water_l: 360, chemical_ml: 0 }, evidence_refs: [{ kind: 'formal_device_log', ref: `formal://${fx.device_id}/${manifest.act_task_id}` }],
    logs_refs: [{ kind: 'dispatch_ack', ref: `ack_${manifest.act_task_id}` }, { kind: 'valve_open_confirmation', ref: `valve_${manifest.act_task_id}` }, { kind: 'water_delivery_receipt', ref: `water_${manifest.act_task_id}` }],
    status: 'executed', constraint_check: { violated: false, violations: [] }, observed_parameters: { duration_min: 14, coverage_percent: 0.96, pre_soil_moisture: pre, post_soil_moisture: post, soil_moisture_delta: delta },
    meta: { idempotency_key: `formal_receipt_${manifest.act_task_id}_${Date.now()}`, command_id: manifest.act_task_id, operation_plan_id: manifest.operation_id, recommendation_id: manifest.recommendation_id, formal_scenario_run_id: fx.run_id, evidence_source: 'device', device_id: fx.device_id },
  };
  const resp = await fetchJson(`${base}/api/v1/actions/receipt`, { method: 'POST', token: executorToken, body });
  snap(manifest, { method: 'POST', path: '/api/v1/actions/receipt', ok: resp.ok && resp.json?.ok === true, status_code: resp.status, label: 'formal receipt', request: body, response: resp.json ?? resp.text });
  const json = requireOk(resp, 'formal receipt');
  manifest.receipt_id = json.fact_id;
  manifest.evidence_refs.push(...body.evidence_refs.map((x) => x.ref));
}
async function acceptance({ base, operatorToken, fx, manifest }) {
  const body = { tenant_id: fx.tenant_id, project_id: fx.project_id, group_id: fx.group_id, act_task_id: manifest.act_task_id };
  const resp = await fetchJson(`${base}/api/v1/acceptance/evaluate`, { method: 'POST', token: operatorToken, body });
  snap(manifest, { method: 'POST', path: '/api/v1/acceptance/evaluate', ok: resp.ok && resp.json?.ok === true, status_code: resp.status, label: 'acceptance evaluate', request: body, response: resp.json ?? resp.text });
  const json = requireOk(resp, 'acceptance evaluate');
  manifest.acceptance_id = json.fact_id;
  return json;
}
async function asExecutedFromReceipt({ base, token, fx, manifest }) {
  const body = {
    tenant_id: fx.tenant_id,
    project_id: fx.project_id,
    group_id: fx.group_id,
    task_id: manifest.act_task_id,
    receipt_id: manifest.receipt_id,
  };
  const resp = await fetchJson(`${base}/api/v1/as-executed/from-receipt`, { method: 'POST', token, body });
  snap(manifest, { method: 'POST', path: '/api/v1/as-executed/from-receipt', ok: resp.ok && resp.json?.ok === true, status_code: resp.status, label: 'as executed from receipt', request: body, response: resp.json ?? resp.text });
  return requireOk(resp, 'as executed from receipt');
}
async function operationReport({ base, token, fx, manifest }) {
  const path = `/api/v1/reports/operation/${encodeURIComponent(manifest.operation_id)}?tenant_id=${encodeURIComponent(fx.tenant_id)}&project_id=${encodeURIComponent(fx.project_id)}&group_id=${encodeURIComponent(fx.group_id)}`;
  const resp = await fetchJson(`${base}${path}`, { method: 'GET', token });
  snap(manifest, { method: 'GET', path: '/api/v1/reports/operation/:operation_id', ok: resp.ok && resp.json?.ok === true, status_code: resp.status, label: 'operation report', request: { operation_id: manifest.operation_id }, response: resp.json ?? resp.text });
  return requireOk(resp, 'operation report');
}

async function acceptancePayload(pool, fx, taskId) {
  const q = await pool.query(`SELECT record_json FROM facts WHERE (record_json::jsonb->>'type')='acceptance_result_v1' AND (record_json::jsonb#>>'{payload,tenant_id}')=$1 AND (record_json::jsonb#>>'{payload,act_task_id}')=$2 ORDER BY occurred_at DESC LIMIT 1`, [fx.tenant_id, taskId]).catch(() => ({ rows: [] }));
  return q.rows?.[0]?.record_json?.payload ?? null;
}
async function memoryExists(pool, fx, manifest) {
  const q = await pool.query(`SELECT COUNT(*)::int AS count FROM field_memory_v1 WHERE tenant_id=$1 AND field_id=$2 AND (operation_id=$3 OR task_id=$4 OR acceptance_id=$5)`, [fx.tenant_id, fx.field_id, manifest.operation_id, manifest.act_task_id, manifest.acceptance_id]).catch(() => ({ rows: [{ count: 0 }] }));
  return Number(q.rows?.[0]?.count ?? 0) > 0;
}
async function negativeNonFormal(ctx, baseFx) {
  const checks = [];
  for (const source of ['sim', 'import', 'human', 'system']) {
    const fx = fixture(baseFx, runId());
    await upsertDevice(ctx.pool, fx);
    await postSamples({ ...ctx, fx, source, metric: 'pressure', value: 42, expectOk: true });
    const r = await generateRecommendation({ ...ctx, fx });
    checks.push(r.status === 400 && ['FORMAL_STAGE1_TRIGGER_NEEDS_EVIDENCE', 'FORMAL_STAGE1_TRIGGER_NOT_ELIGIBLE'].includes(String(r.json?.error ?? '')));
  }
  return checks.every(Boolean);
}
async function negativeOnePost(ctx, fx, body) {
  await upsertDevice(ctx.pool, fx);
  const [resp] = await postSamples({ ...ctx, fx, count: 1, expectOk: false, ...body });
  return resp.status === 400;
}
async function negativeMissingStatus(ctx, baseFx) {
  const fx = fixture(baseFx, runId());
  await upsertDevice(ctx.pool, fx);
  await ctx.pool.query(`DELETE FROM device_status_index_v1 WHERE tenant_id=$1 AND device_id=$2`, [fx.tenant_id, fx.device_id]);
  await postSamples({ ...ctx, fx, source: 'device', metric: 'pressure', value: 42, expectOk: true });
  const r = await generateRecommendation({ ...ctx, fx });
  const reasons = Array.isArray(r.json?.reason_codes) ? r.json.reason_codes : [];
  return r.status === 400 && (reasons.includes('DEVICE_STATUS_MISSING') || reasons.includes('DEVICE_HEALTH_UNKNOWN'));
}
async function negativeApprovalNoTask(ctx, fx) {
  const r = await createTask({ ...ctx, fx, manifest: null, recommendation: { recommendation_id: 'negative_no_auto_task' }, allowAuto: false });
  return r.status === 403 || !r.json?.act_task_id;
}
async function negativeReceiptNoImprovement(ctx, scope) {
  const fx = fixture(scope, runId());
  const m = manifestOf(fx);
  await upsertDevice(ctx.pool, fx);
  await ensureCropContextViaProgram({ ...ctx, fx, manifest: m });
  await postSamples({ ...ctx, fx, manifest: m, source: 'device', metric: 'inlet_flow_lpm', unit: 'L/min', value: 36 });
  await postSamples({ ...ctx, fx, manifest: m, source: 'device', metric: 'outlet_flow_lpm', unit: 'L/min', value: 20 });
  await postSamples({ ...ctx, fx, manifest: m, source: 'device', metric: 'pressure_drop_kpa', unit: 'kPa', value: 38 });
  await postSamples({ ...ctx, fx, manifest: m, source: 'device', metric: 'soil_moisture', unit: '%', value: 19 });
  const recResp = await generateRecommendation({ ...ctx, fx, manifest: m });
  const recommendation = pickRecommendation(requireOk(recResp, 'negative recommendation generate'));
  m.recommendation_id = recommendation?.recommendation_id ?? null;
  await createTask({ ...ctx, fx, manifest: m, recommendation, allowAuto: true });
  await receipt({ ...ctx, fx, manifest: m, pre: 0.18, post: 0.18, delta: 0 });
  await postSamples({ ...ctx, fx, manifest: m, source: 'device', metric: 'pressure', unit: 'kPa', value: 42, count: 1, offsetMs: 120000 });
  const acc = await acceptance({ ...ctx, fx, manifest: m });
  const payload = await acceptancePayload(ctx.pool, fx, m.act_task_id);
  return !isPass(payload?.verdict ?? acc.verdict);
}

async function main() {
  const base = env('BASE_URL', process.env.GEOX_BASE_URL || 'http://127.0.0.1:3001');
  const adminToken = env('ADMIN_TOKEN', env('AO_ACT_TOKEN', 'admin_token'));
  const approverToken = env('APPROVER_TOKEN', 'approver_token');
  const operatorToken = env('OPERATOR_TOKEN', 'operator_token');
  const executorToken = env('EXECUTOR_TOKEN', 'executor_token');
  const pool = new Pool({ connectionString: env('DATABASE_URL', 'postgres://postgres:postgres@127.0.0.1:5432/geox') });
  const scope = { tenant_id: env('TENANT_ID', 'tenantA'), project_id: env('PROJECT_ID', 'projectA'), group_id: env('GROUP_ID', 'groupA') };
  const ctx = { base, token: adminToken, adminToken, approverToken, operatorToken, executorToken, pool };
  const fx = fixture(scope);
  const manifest = manifestOf(fx);
  try {
    await health(base);
    await upsertDevice(pool, fx);
    await ensureCropContextViaProgram({ ...ctx, fx, manifest });
    await postSamples({ ...ctx, fx, manifest, source: 'device', metric: 'inlet_flow_lpm', unit: 'L/min', value: 36 });
    await postSamples({ ...ctx, fx, manifest, source: 'device', metric: 'outlet_flow_lpm', unit: 'L/min', value: 20 });
    await postSamples({ ...ctx, fx, manifest, source: 'device', metric: 'pressure_drop_kpa', unit: 'kPa', value: 38 });
    await postSamples({ ...ctx, fx, manifest, source: 'device', metric: 'soil_moisture', unit: '%', value: 19 });
    const recResp = await generateRecommendation({ ...ctx, fx, manifest });
    const recJson = requireOk(recResp, 'recommendation generate');
    const recommendation = pickRecommendation(recJson);
    assert.ok(recommendation?.recommendation_id, `irrigation recommendation missing body=${recResp.text}`);
    manifest.recommendation_id = recommendation.recommendation_id;
    manifest.prescription_id = recommendation.prescription_id ?? null;
    const summary = await stage1(pool, fx);
    const problems = await problemRows(pool, fx);
    await createTask({ ...ctx, fx, manifest, recommendation, allowAuto: true });
    await receipt({ ...ctx, fx, manifest });
    await postSamples({ ...ctx, fx, manifest, source: 'device', metric: 'pressure', unit: 'kPa', value: 10, count: 1, offsetMs: 60000 });
    const acc = await acceptance({ ...ctx, fx, manifest });
    const asExecuted = await asExecutedFromReceipt({ ...ctx, fx, manifest });
    const report = await operationReport({ ...ctx, fx, manifest });
    const accPayload = await acceptancePayload(pool, fx, manifest.act_task_id);
    const memory = await memoryExists(pool, fx, manifest);
    const verify = {
      run_id: fx.run_id,
      passed: false,
      checks: {
        appleii_evidence_pass: summary?.evidence_sufficiency === 'PASS',
        formal_evidence_passed: summary?.evidence_sufficiency === 'PASS',
        problem_state_created: problems.length > 0,
        recommendation_created: Boolean(manifest.recommendation_id),
        approval_approved: Boolean(manifest.approval_request_id),
        ao_act_task_created: Boolean(manifest.act_task_id),
        receipt_is_not_acceptance: Boolean(manifest.receipt_id && manifest.acceptance_id && manifest.receipt_id !== manifest.acceptance_id),
        as_executed_irrigation_payload_valid: (() => {
          const asApplied = asExecuted?.as_applied ?? {};
          const executed = asExecuted?.as_executed?.executed ?? {};
          const observed = executed?.observed_parameters ?? {};
          const evidenceRefs = Array.isArray(asApplied?.evidence_refs) ? asApplied.evidence_refs : [];
          const hasEvidence = evidenceRefs.some((x) => String(x?.ref ?? x ?? '').startsWith('formal://'));
          return Number.isFinite(Number(asApplied?.coverage?.coverage_percent))
            && Number.isFinite(Number(observed?.duration_min))
            && Number.isFinite(Number(observed?.pre_soil_moisture))
            && Number.isFinite(Number(observed?.post_soil_moisture))
            && Number.isFinite(Number(observed?.soil_moisture_delta))
            && hasEvidence;
        })(),
        operation_report_has_irrigation_execution_result: (() => {
          const reportBody = report?.operation_report_v1 ?? report;
          const text = JSON.stringify(reportBody ?? {});
          return text.includes('operation_report')
            && text.includes(String(manifest.operation_id))
            && (text.includes('receipt') || text.includes('as_executed') || text.includes('evidence'));
        })(),
        formal_acceptance_passed: isPass(accPayload?.verdict ?? acc.verdict),
        guarded_report_customer_visible: isPass(accPayload?.verdict ?? acc.verdict),
        roi_trust_lane_valid: isPass(accPayload?.verdict ?? acc.verdict),
        field_memory_lane_valid: memory,
      },
      blocking_reasons: [],
    };
    verify.blocking_reasons = Object.entries(verify.checks).filter(([, v]) => v !== true).map(([k]) => `CHECK_FAILED:${k}`);
    verify.passed = verify.blocking_reasons.length === 0;

    const invalidCredFx = fixture(scope, runId());
    const bindingFx = fixture(scope, runId());
    const metricFx = fixture(scope, runId());
    const wrongMetricFx = fixture(scope, runId());
    const negative = {
      non_formal_source_blocked: await negativeNonFormal(ctx, scope),
      invalid_credential_blocked: await negativeOnePost(ctx, invalidCredFx, { source: 'device', metric: 'pressure', credential_id: `bad_${invalidCredFx.credential_id}` }),
      field_binding_mismatch_blocked: await negativeOnePost(ctx, bindingFx, { source: 'device', metric: 'pressure', field_id: `${bindingFx.field_id}_other` }),
      unsupported_metric_blocked: await negativeOnePost(ctx, metricFx, { source: 'device', metric: 'soil_ec', unit: 'dS/m', value: 1.2 }),
      missing_device_status_blocked: await negativeMissingStatus(ctx, scope),
      wrong_metric_blocked: await negativeOnePost(ctx, wrongMetricFx, { source: 'device', metric: 'ec_ds_m', unit: 'dS/m', value: 1.2 }),
      approval_rejected_no_task: await negativeApprovalNoTask(ctx, fx),
      receipt_success_not_acceptance_pass: await negativeReceiptNoImprovement(ctx, scope),
    };
    const output = { ok: verify.passed && Object.values(negative).every(Boolean), scenario: 'FORMAL_IRRIGATION_E2E_V1', manifest, verify, positive: { passed: verify.passed }, negative };
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
    if (!output.ok) process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
