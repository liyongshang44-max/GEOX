#!/usr/bin/env node
const { randomUUID, createHash } = require('node:crypto');
const { Pool } = require('pg');
const { assert, env, fetchJson, requireOk } = require('./_common.cjs');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const sha = (s) => createHash('sha256').update(String(s)).digest('hex');
const rid = () => `fsr_${randomUUID().replace(/-/g, '')}`;
const sid = (p) => `${p}_${Date.now()}_${randomUUID().replace(/-/g, '').slice(0, 8)}`;
const isPass = (v) => ['PASS', 'PASSED'].includes(String(v ?? '').trim().toUpperCase());

function fx(scope, suffix = rid()) {
  return {
    run_id: suffix,
    ...scope,
    field_id: `field_${suffix}`,
    season_id: `season_${suffix}`,
    device_id: `dev_${suffix}`,
    credential_id: `cred_${suffix}`,
  };
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
    } catch (e) { last = e; }
    await sleep(1000);
  }
  throw last ?? new Error('server health failed');
}

async function ensureTables(pool) {
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

async function upsertDevice(pool, f, status = 'ONLINE') {
  await ensureTables(pool);
  const ts = Date.now();
  const hb = status === 'ONLINE' ? ts - 30_000 : ts - 60 * 60 * 1000;
  await pool.query(
    `INSERT INTO device_index_v1 (tenant_id, device_id, display_name, device_mode, created_ts_ms, last_credential_id, last_credential_status)
     VALUES ($1,$2,$3,'physical',$4,$5,'ACTIVE')
     ON CONFLICT (tenant_id, device_id) DO UPDATE SET display_name=EXCLUDED.display_name, device_mode='physical', last_credential_id=EXCLUDED.last_credential_id, last_credential_status='ACTIVE'`,
    [f.tenant_id, f.device_id, `Device anomaly fixture ${f.device_id}`, ts, f.credential_id],
  );
  await pool.query(`INSERT INTO device_capability (tenant_id, device_id, capabilities, updated_ts_ms) VALUES ($1,$2,$3::jsonb,$4) ON CONFLICT (tenant_id, device_id) DO UPDATE SET capabilities=EXCLUDED.capabilities, updated_ts_ms=EXCLUDED.updated_ts_ms`, [f.tenant_id, f.device_id, JSON.stringify(['telemetry.water_pressure', 'telemetry.soil_moisture', 'telemetry.inlet_flow_lpm', 'telemetry.outlet_flow_lpm', 'telemetry.pressure_drop_kpa', 'device.irrigation.valve.open']), ts]);
  await pool.query(`INSERT INTO device_binding_index_v1 (tenant_id, device_id, field_id, bound_ts_ms) VALUES ($1,$2,$3,$4) ON CONFLICT (tenant_id, device_id, field_id) DO UPDATE SET bound_ts_ms=EXCLUDED.bound_ts_ms`, [f.tenant_id, f.device_id, f.field_id, ts]);
  await pool.query(`INSERT INTO device_credential_index_v1 (tenant_id, device_id, credential_id, credential_hash, status, issued_ts_ms, revoked_ts_ms, created_ts_ms, updated_ts_ms) VALUES ($1,$2,$3,$4,'ACTIVE',$5,NULL,$5,$5) ON CONFLICT (tenant_id, device_id, credential_id) DO UPDATE SET credential_hash=EXCLUDED.credential_hash, status='ACTIVE', revoked_ts_ms=NULL, updated_ts_ms=EXCLUDED.updated_ts_ms`, [f.tenant_id, f.device_id, f.credential_id, sha(`${f.run_id}:${f.device_id}:credential`), ts]);
  await pool.query(`INSERT INTO device_status_index_v1 (tenant_id, project_id, group_id, field_id, device_id, status, last_telemetry_ts_ms, last_heartbeat_ts_ms, battery_percent, rssi_dbm, fw_ver, updated_ts_ms) VALUES ($1,$2,$3,$4,$5,$6,$7,$7,81,-60,'device-anomaly-e2e',$8) ON CONFLICT (tenant_id, device_id) DO UPDATE SET project_id=EXCLUDED.project_id, group_id=EXCLUDED.group_id, field_id=EXCLUDED.field_id, status=EXCLUDED.status, last_telemetry_ts_ms=EXCLUDED.last_telemetry_ts_ms, last_heartbeat_ts_ms=EXCLUDED.last_heartbeat_ts_ms, battery_percent=EXCLUDED.battery_percent, rssi_dbm=EXCLUDED.rssi_dbm, updated_ts_ms=EXCLUDED.updated_ts_ms`, [f.tenant_id, f.project_id, f.group_id, f.field_id, f.device_id, status, hb, ts]);
}

async function setDeviceStatus(pool, f, status) {
  await pool.query(`UPDATE device_status_index_v1 SET status=$4, last_heartbeat_ts_ms=$5, last_telemetry_ts_ms=$5, updated_ts_ms=$6 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND device_id=$7`, [f.tenant_id, f.project_id, f.group_id, status, Date.now() - 60 * 60 * 1000, Date.now(), f.device_id]);
}

async function removeDeviceStatus(pool, f) {
  await pool.query(`DELETE FROM device_status_index_v1 WHERE tenant_id=$1 AND device_id=$2`, [f.tenant_id, f.device_id]);
}

async function postSamples({ base, token, f, source = 'device', count = 12 }) {
  const metricDefs = [
    { metric: 'soil_moisture', unit: '%', base: 19 },
    { metric: 'inlet_flow_lpm', unit: 'L/min', base: 36 },
    { metric: 'outlet_flow_lpm', unit: 'L/min', base: 20 },
    { metric: 'pressure_drop_kpa', unit: 'kPa', base: 38 },
  ];
  const start = Date.now() - (count - 1) * 30 * 60 * 1000 - 60_000;
  for (const def of metricDefs) {
    for (let i = 0; i < count; i += 1) {
      const body = {
        tenant_id: f.tenant_id,
        project_id: f.project_id,
        group_id: f.group_id,
        sample_id: sid(`rs_${f.run_id}_${def.metric}_${i}`),
        sensor_id: f.device_id,
        field_id: f.field_id,
        ts_ms: Math.trunc(start + i * 30 * 60 * 1000),
        metric: def.metric,
        value: Number(def.base) + i * 0.01,
        unit: def.unit,
        qc_quality: 'ok',
        source,
        payload: {
          tenant_id: f.tenant_id,
          project_id: f.project_id,
          group_id: f.group_id,
          field_id: f.field_id,
          device_id: f.device_id,
          credential_id: f.credential_id,
          formal_scenario_run_id: f.run_id,
          interpolated: false,
          synthetic: false,
        },
      };
      requireOk(await fetchJson(`${base}/api/v1/sensing/raw-samples`, { method: 'POST', token, body }), `raw sample ${def.metric} ${i}`);
    }
  }
}

async function ensureCropContextViaProgram({ base, token, f }) {
  const body = {
    tenant_id: f.tenant_id,
    project_id: f.project_id,
    group_id: f.group_id,
    program_id: `prg_${f.run_id}`,
    field_id: f.field_id,
    season_id: f.season_id,
    crop_code: 'corn',
    status: 'ACTIVE',
    goal_profile: { yield_priority: 'high', quality_priority: 'medium', residue_priority: 'low', water_saving_priority: 'medium', cost_priority: 'medium' },
    constraints: { forbid_pesticide_classes: [], forbid_fertilizer_types: [], max_irrigation_mm_per_day: null, manual_approval_required_for: [], allow_night_irrigation: true, max_irrigation_rounds_per_day: 3 },
    budget: { max_cost_total: null, currency: 'USD' },
    execution_policy: { mode: 'approval_required', auto_execute_allowed_task_types: [] },
  };
  return requireOk(await fetchJson(`${base}/api/v1/programs`, { method: 'POST', token, body }), 'field program create');
}

async function generateRecommendationWithRetry({ base, token, f, attempts = 8, waitMs = 1200 }) {
  let last = null;
  for (let i = 0; i < attempts; i += 1) {
    const resp = await generateRecommendation({ base, token, f });
    if (resp.ok) return resp;
    last = resp;
    await sleep(waitMs);
  }
  return last;
}

async function generateRecommendation({ base, token, f }) {
  return fetchJson(`${base}/api/v1/recommendations/generate`, {
    method: 'POST',
    token,
    body: { tenant_id: f.tenant_id, project_id: f.project_id, group_id: f.group_id, field_id: f.field_id, season_id: f.season_id, device_id: f.device_id, crop_code: 'corn' },
  });
}

function pickRecommendation(json) {
  const list = Array.isArray(json?.recommendations) ? json.recommendations : [];
  return list.find((x) => String(x?.recommendation_type ?? '') === 'irrigation_recommendation_v1' || String(x?.action_type ?? '').toUpperCase() === 'IRRIGATE') ?? list[0] ?? null;
}

async function countFacts(pool, f, type, extraSql = '', args = []) {
  const q = await pool.query(`SELECT COUNT(*)::int AS count FROM facts WHERE (record_json::jsonb->>'type')=$1 AND (record_json::jsonb#>>'{payload,tenant_id}')=$2 AND (record_json::jsonb#>>'{payload,project_id}')=$3 AND (record_json::jsonb#>>'{payload,group_id}')=$4 ${extraSql}`, [type, f.tenant_id, f.project_id, f.group_id, ...args]).catch(() => ({ rows: [{ count: 0 }] }));
  return Number(q.rows?.[0]?.count ?? 0);
}

async function requestApproval({ base, adminToken, f, recommendation, skipAutoTaskIssue = true }) {
  const body = {
    tenant_id: f.tenant_id,
    project_id: f.project_id,
    group_id: f.group_id,
    field_id: f.field_id,
    season_id: f.season_id,
    issuer: { kind: 'human', id: 'device_anomaly_e2e', namespace: 'P0.6' },
    action_type: 'IRRIGATE',
    target: { kind: 'field', ref: f.field_id },
    time_window: { start_ts: Date.now(), end_ts: Date.now() + 60 * 60 * 1000 },
    parameter_schema: { keys: [{ name: 'duration_sec', type: 'number', min: 1 }] },
    parameters: { duration_sec: 1200 },
    constraints: {},
    meta: {
      recommendation_id: recommendation.recommendation_id,
      recommendation_type: recommendation.recommendation_type,
      field_id: f.field_id,
      season_id: f.season_id,
      device_id: f.device_id,
      operation_plan_id: `op_${f.run_id}`,
      formal_scenario_run_id: f.run_id,
      skip_auto_task_issue: skipAutoTaskIssue,
      allow_auto_task_issue: !skipAutoTaskIssue,
      expected_evidence_requirements: ['dispatch_ack', 'valve_open_confirmation', 'water_delivery_receipt'],
    },
  };
  return requireOk(await fetchJson(`${base}/api/v1/approvals/request`, { method: 'POST', token: adminToken, body }), 'approval request');
}

async function approve({ base, approverToken, f, request_id }) {
  return fetchJson(`${base}/api/v1/approvals/approve`, { method: 'POST', token: approverToken, body: { tenant_id: f.tenant_id, project_id: f.project_id, group_id: f.group_id, request_id } });
}

async function dispatchTask({ base, adminToken, f, request_id }) {
  const body = {
    tenant_id: f.tenant_id,
    project_id: f.project_id,
    group_id: f.group_id,
    operation_plan_id: `op_${f.run_id}`,
    approval_request_id: request_id,
    field_id: f.field_id,
    season_id: f.season_id,
    issuer: { kind: 'human', id: 'device_anomaly_e2e', namespace: 'P0.6' },
    action_type: 'IRRIGATE',
    target: { kind: 'field', ref: f.field_id },
    time_window: { start_ts: Date.now(), end_ts: Date.now() + 60 * 60 * 1000 },
    parameter_schema: { keys: [{ name: 'duration_sec', type: 'number', min: 1 }] },
    parameters: { duration_sec: 1200 },
    constraints: {},
    meta: { device_id: f.device_id, field_id: f.field_id, season_id: f.season_id, formal_scenario_run_id: f.run_id, expected_evidence_requirements: ['dispatch_ack', 'valve_open_confirmation', 'water_delivery_receipt'] },
  };
  return fetchJson(`${base}/api/v1/actions/task`, { method: 'POST', token: adminToken, body });
}

async function latestFailSafe(pool, f) {
  const q = await pool.query(`SELECT * FROM fail_safe_event_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND device_id=$4 ORDER BY created_at DESC LIMIT 1`, [f.tenant_id, f.project_id, f.group_id, f.device_id]).catch(() => ({ rows: [] }));
  return q.rows?.[0] ?? null;
}

async function latestTakeover(pool, f, fail_safe_event_id) {
  const q = await pool.query(`SELECT * FROM manual_takeover_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND fail_safe_event_id=$4 ORDER BY created_at DESC LIMIT 1`, [f.tenant_id, f.project_id, f.group_id, fail_safe_event_id]).catch(() => ({ rows: [] }));
  return q.rows?.[0] ?? null;
}

async function ackCompleteTakeover({ base, operatorToken, f, takeover_id }) {
  const ack = await fetchJson(`${base}/api/v1/manual-takeovers/${encodeURIComponent(takeover_id)}/ack`, { method: 'POST', token: operatorToken, body: { tenant_id: f.tenant_id, project_id: f.project_id, group_id: f.group_id } });
  const complete = await fetchJson(`${base}/api/v1/manual-takeovers/${encodeURIComponent(takeover_id)}/complete`, { method: 'POST', token: operatorToken, body: { tenant_id: f.tenant_id, project_id: f.project_id, group_id: f.group_id, completion_note: 'device anomaly e2e manual intervention completed' } });
  return { ack, complete };
}

async function auditWritten(pool, f, takeover_id) {
  const q = await pool.query(`SELECT COUNT(*)::int AS count FROM security_audit_event_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND target_id=$4 AND action IN ('manual_override.acked','manual_override.completed')`, [f.tenant_id, f.project_id, f.group_id, takeover_id]).catch(() => ({ rows: [{ count: 0 }] }));
  return Number(q.rows?.[0]?.count ?? 0) >= 2;
}

async function reportDowngraded({ base, token, f }) {
  const r = await fetchJson(`${base}/api/v1/reports/operation/${encodeURIComponent(`op_${f.run_id}`)}?tenant_id=${encodeURIComponent(f.tenant_id)}&project_id=${encodeURIComponent(f.project_id)}&group_id=${encodeURIComponent(f.group_id)}`, { method: 'GET', token });
  if (r.status === 404) return true;
  const report = r.json?.operation_report_v1 ?? null;
  if (!report) return false;
  return report.customer_visible_eligible === false || String(report.trust_level ?? '') !== 'FORMAL_CHAIN_PASSED' || report.needs_review === true;
}

async function noAcceptancePass(pool, f) {
  const q = await pool.query(`SELECT COUNT(*)::int AS count FROM facts WHERE (record_json::jsonb->>'type')='acceptance_result_v1' AND (record_json::jsonb#>>'{payload,tenant_id}')=$1 AND (record_json::jsonb#>>'{payload,project_id}')=$2 AND (record_json::jsonb#>>'{payload,group_id}')=$3 AND (record_json::jsonb#>>'{payload,operation_plan_id}')=$4 AND UPPER(record_json::jsonb#>>'{payload,verdict}')='PASS'`, [f.tenant_id, f.project_id, f.group_id, `op_${f.run_id}`]).catch(() => ({ rows: [{ count: 0 }] }));
  return Number(q.rows?.[0]?.count ?? 0) === 0;
}

async function noCustomerVisibleRoi(pool, f) {
  const q = await pool.query(`SELECT COUNT(*)::int AS count FROM roi_ledger_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND operation_id=$4 AND customer_visible_value=true`, [f.tenant_id, f.project_id, f.group_id, `op_${f.run_id}`]).catch(() => ({ rows: [{ count: 0 }] }));
  return Number(q.rows?.[0]?.count ?? 0) === 0;
}

async function noFormalMemory(pool, f) {
  const q = await pool.query(`SELECT COUNT(*)::int AS count FROM field_memory_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND operation_id=$5`, [f.tenant_id, f.project_id, f.group_id, f.field_id, `op_${f.run_id}`]).catch(() => ({ rows: [{ count: 0 }] }));
  return Number(q.rows?.[0]?.count ?? 0) === 0;
}

async function receiptFailureLane(ctx, baseF, recommendation) {
  const f = fx(baseF, rid());
  await upsertDevice(ctx.pool, f, 'ONLINE');
  const req = await requestApproval({ ...ctx, f, recommendation, skipAutoTaskIssue: true });
  const ap = requireOk(await approve({ ...ctx, f, request_id: req.request_id }), 'failure lane approval');
  assert.equal(ap.auto_task_issue_skipped, true, 'failure lane approval must skip auto task');
  const taskResp = await dispatchTask({ ...ctx, f, request_id: req.request_id });
  const task = requireOk(taskResp, 'failure lane dispatch');
  const receiptBody = {
    tenant_id: f.tenant_id,
    project_id: f.project_id,
    group_id: f.group_id,
    operation_plan_id: `op_${f.run_id}`,
    act_task_id: task.act_task_id,
    executor_id: { kind: 'device', id: f.device_id, namespace: 'device_anomaly_e2e' },
    execution_time: { start_ts: Date.now() - 600000, end_ts: Date.now() - 300000 },
    execution_coverage: { kind: 'field', ref: f.field_id },
    resource_usage: { fuel_l: 0, electric_kwh: 0, water_l: 0, chemical_ml: 0 },
    evidence_refs: [{ kind: 'sim_trace', ref: `sim://${task.act_task_id}` }],
    logs_refs: [{ kind: 'sim_trace', ref: `sim://${task.act_task_id}` }],
    status: 'not_executed',
    constraint_check: { violated: true, violations: ['DEVICE_OFFLINE_DURING_EXECUTION'] },
    observed_parameters: { duration_sec: 1200 },
    meta: { idempotency_key: sid('receipt_failed'), command_id: task.act_task_id, operation_plan_id: `op_${f.run_id}`, evidence_source: 'sim', device_id: f.device_id, formal_scenario_run_id: f.run_id },
  };
  requireOk(await fetchJson(`${ctx.base}/api/v1/actions/receipt`, { method: 'POST', token: ctx.executorToken, body: receiptBody }), 'failure receipt');
  const accResp = await fetchJson(`${ctx.base}/api/v1/acceptance/evaluate`, { method: 'POST', token: ctx.operatorToken, body: { tenant_id: f.tenant_id, project_id: f.project_id, group_id: f.group_id, act_task_id: task.act_task_id } });
  const accOk = accResp.ok && accResp.json?.ok === true;
  const accVerdict = accResp.json?.verdict;
  return {
    acceptance_not_pass: accOk && !isPass(accVerdict),
    roi_not_customer_visible: await noCustomerVisibleRoi(ctx.pool, f),
    field_memory_not_formal: await noFormalMemory(ctx.pool, f),
  };
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
  try {
    await health(base);

    const pre = fx(scope, rid());
    await upsertDevice(pool, pre, 'ONLINE');
    await ensureCropContextViaProgram({ ...ctx, f: pre });
    await postSamples({ ...ctx, f: pre });
    await removeDeviceStatus(pool, pre);
    const preRec = await generateRecommendation({ ...ctx, f: pre });
    const preReasons = Array.isArray(preRec.json?.reason_codes) ? preRec.json.reason_codes : [];
    const preError = String(preRec.json?.error ?? '');
    const preBlockingReasons = Array.isArray(preRec.json?.blocking_reasons)
      ? preRec.json.blocking_reasons.map(String)
      : [];
    const preRecommendationBlocked = preRec.status === 400;
    const deviceHealthReasonPresent =
      preReasons.includes('DEVICE_STATUS_MISSING') ||
      preReasons.includes('DEVICE_HEALTH_UNKNOWN') ||
      preBlockingReasons.some((x) =>
        x.includes('DEVICE_STATUS_MISSING') || x.includes('DEVICE_HEALTH_UNKNOWN')
      ) ||
      preError.includes('DEVICE_STATUS_MISSING') ||
      preError.includes('DEVICE_HEALTH_UNKNOWN');
    const prePrescriptionCount = await countFacts(pool, pre, 'prescription_v1', `AND (record_json::jsonb#>>'{payload,field_id}')=$5`, [pre.field_id]);
    const preTaskCount = await countFacts(pool, pre, 'ao_act_task_v0', `AND (record_json::jsonb#>>'{payload,field_id}')=$5`, [pre.field_id]);

    const off = fx(scope, rid());
    await upsertDevice(pool, off, 'ONLINE');
    await ensureCropContextViaProgram({ ...ctx, f: off });
    await postSamples({ ...ctx, f: off });
    const recJson = requireOk(await generateRecommendationWithRetry({ ...ctx, f: off }), 'offline lane recommendation');
    const recommendation = pickRecommendation(recJson);
    assert.ok(recommendation?.recommendation_id, 'offline lane recommendation missing');
    const approvalReq = await requestApproval({ ...ctx, f: off, recommendation, skipAutoTaskIssue: true });
    const approval = requireOk(await approve({ ...ctx, f: off, request_id: approvalReq.request_id }), 'offline lane approval');
    assert.equal(approval.auto_task_issue_skipped, true, 'approval must be approved without auto task before dispatch');
    await setDeviceStatus(pool, off, 'OFFLINE');
    const dispatch = await dispatchTask({ ...ctx, f: off, request_id: approvalReq.request_id });
    const fs = await latestFailSafe(pool, off);
    const mtRequested = fs ? await latestTakeover(pool, off, fs.fail_safe_event_id) : null;
    const ackComplete = mtRequested ? await ackCompleteTakeover({ ...ctx, f: off, takeover_id: mtRequested.takeover_id }) : null;
    const mtAfter = mtRequested ? await latestTakeover(pool, off, fs.fail_safe_event_id) : null;

    const failureLane = await receiptFailureLane(ctx, scope, recommendation);

    const checks = {
      pre_recommendation_device_unknown_blocked: preRecommendationBlocked,
      device_health_unknown_reason_present: deviceHealthReasonPresent,
      no_prescription_created: prePrescriptionCount === 0,
      no_ao_act_task_created: preTaskCount === 0,
      offline_dispatch_blocked: dispatch.status === 409 && (dispatch.json?.error === 'FAIL_SAFE_TRIGGERED' || dispatch.json?.error === 'FAIL_SAFE_OPEN'),
      fail_safe_event_open_created: Boolean(fs && fs.status === 'OPEN' && ['DEVICE_OFFLINE', 'DEVICE_STATUS_UNKNOWN'].includes(String(fs.trigger_type ?? fs.reason_code ?? ''))),
      manual_takeover_requested: Boolean(mtRequested && mtRequested.status === 'REQUESTED'),
      manual_takeover_acked: Boolean(ackComplete?.ack?.ok && mtAfter && ['ACKED', 'COMPLETED'].includes(String(mtAfter.status ?? ''))),
      manual_takeover_completed: Boolean(ackComplete?.complete?.ok && mtAfter && mtAfter.status === 'COMPLETED'),
      customer_report_downgraded: await reportDowngraded({ ...ctx, f: off }),
      acceptance_not_pass: await noAcceptancePass(pool, off) && failureLane.acceptance_not_pass,
      roi_not_customer_visible: await noCustomerVisibleRoi(pool, off) && failureLane.roi_not_customer_visible,
      field_memory_not_formal: await noFormalMemory(pool, off) && failureLane.field_memory_not_formal,
      security_audit_written: mtRequested ? await auditWritten(pool, off, mtRequested.takeover_id) : false,
      report_manual_intervention_visible: Boolean(mtAfter && mtAfter.status === 'COMPLETED' && fs && fs.blocked_action),
    };
    const output = { ok: Object.values(checks).every(Boolean), scenario: 'DEVICE_ANOMALY_E2E_V1', checks };
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
    if (!output.ok) process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
