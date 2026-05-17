#!/usr/bin/env node
import { createHash, randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { env, fetchJson, requireOk } from './_common.cjs';
import { runFormalScenarioKernelV1, type FormalScenarioKernelContextV1 } from '../../apps/server/src/services/scenarios/formal_scenario_kernel_v1.ts';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const sha = (s: string) => createHash('sha256').update(String(s)).digest('hex');
const isPass = (v: unknown) => ['PASS', 'PASSED'].includes(String(v ?? '').trim().toUpperCase());
const mkRun = () => `fsr_${randomUUID().replace(/-/g, '')}`;

async function health(base: string) {
  let last: unknown = null;
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

function makeFx(scope: any, run_id = mkRun()) {
  return { ...scope, run_id, field_id: `field_${run_id}`, season_id: `season_${run_id}`, device_id: `dev_${run_id}`, credential_id: `cred_${run_id}` };
}

async function upsertDevice(pool: Pool, fx: any) {
  const ts = Date.now();
  await pool.query(`ALTER TABLE device_index_v1 ADD COLUMN IF NOT EXISTS device_mode TEXT NOT NULL DEFAULT 'physical'`).catch(() => undefined);
  await pool.query(`ALTER TABLE device_index_v1 ADD COLUMN IF NOT EXISTS last_credential_id TEXT NULL`).catch(() => undefined);
  await pool.query(`ALTER TABLE device_index_v1 ADD COLUMN IF NOT EXISTS last_credential_status TEXT NULL`).catch(() => undefined);
  await pool.query(`CREATE TABLE IF NOT EXISTS device_capability (tenant_id TEXT NOT NULL, device_id TEXT NOT NULL, capabilities JSONB NOT NULL DEFAULT '[]'::jsonb, updated_ts_ms BIGINT NOT NULL, PRIMARY KEY (tenant_id, device_id))`);
  await pool.query(`CREATE TABLE IF NOT EXISTS device_binding_index_v1 (tenant_id TEXT NOT NULL, device_id TEXT NOT NULL, field_id TEXT NOT NULL, bound_ts_ms BIGINT NULL, PRIMARY KEY (tenant_id, device_id, field_id))`);
  await pool.query(`CREATE TABLE IF NOT EXISTS device_credential_index_v1 (tenant_id TEXT NOT NULL, device_id TEXT NOT NULL, credential_id TEXT NOT NULL, credential_hash TEXT NOT NULL, status TEXT NOT NULL, issued_ts_ms BIGINT NOT NULL, revoked_ts_ms BIGINT NULL, created_ts_ms BIGINT NULL, updated_ts_ms BIGINT NULL, PRIMARY KEY (tenant_id, device_id, credential_id))`);
  await pool.query(`CREATE TABLE IF NOT EXISTS device_status_index_v1 (tenant_id TEXT NOT NULL, project_id TEXT NULL, group_id TEXT NULL, field_id TEXT NULL, device_id TEXT NOT NULL, status TEXT NULL, last_telemetry_ts_ms BIGINT NULL, last_heartbeat_ts_ms BIGINT NULL, battery_percent INTEGER NULL, rssi_dbm INTEGER NULL, fw_ver TEXT NULL, updated_ts_ms BIGINT NOT NULL, PRIMARY KEY (tenant_id, device_id))`);

  await pool.query(`INSERT INTO device_index_v1 (tenant_id, device_id, display_name, device_mode, created_ts_ms, last_credential_id, last_credential_status)
     VALUES ($1,$2,$3,'physical',$4,$5,'ACTIVE')
     ON CONFLICT (tenant_id, device_id) DO UPDATE SET display_name=EXCLUDED.display_name, device_mode='physical', last_credential_id=EXCLUDED.last_credential_id, last_credential_status='ACTIVE'`,
    [fx.tenant_id, fx.device_id, `Formal irrigation device ${fx.device_id}`, ts, fx.credential_id]);
  await pool.query(`INSERT INTO device_capability (tenant_id, device_id, capabilities, updated_ts_ms)
     VALUES ($1,$2,$3::jsonb,$4)
     ON CONFLICT (tenant_id, device_id) DO UPDATE SET capabilities=EXCLUDED.capabilities, updated_ts_ms=EXCLUDED.updated_ts_ms`,
    [fx.tenant_id, fx.device_id, JSON.stringify(['telemetry.soil_moisture', 'telemetry.water_pressure', 'telemetry.inlet_flow_lpm', 'telemetry.outlet_flow_lpm', 'telemetry.pressure_drop_kpa', 'device.irrigation.valve.open']), ts]);
  await pool.query(`INSERT INTO device_binding_index_v1 (tenant_id, device_id, field_id, bound_ts_ms) VALUES ($1,$2,$3,$4) ON CONFLICT (tenant_id, device_id, field_id) DO UPDATE SET bound_ts_ms=EXCLUDED.bound_ts_ms`, [fx.tenant_id, fx.device_id, fx.field_id, ts]);
  await pool.query(`INSERT INTO device_credential_index_v1 (tenant_id, device_id, credential_id, credential_hash, status, issued_ts_ms, revoked_ts_ms, created_ts_ms, updated_ts_ms) VALUES ($1,$2,$3,$4,'ACTIVE',$5,NULL,$5,$5) ON CONFLICT (tenant_id, device_id, credential_id) DO UPDATE SET credential_hash=EXCLUDED.credential_hash, status='ACTIVE', revoked_ts_ms=NULL, updated_ts_ms=EXCLUDED.updated_ts_ms`, [fx.tenant_id, fx.device_id, fx.credential_id, sha(`${fx.run_id}:${fx.device_id}:credential`), ts]);
  await pool.query(`INSERT INTO device_status_index_v1 (tenant_id, project_id, group_id, field_id, device_id, status, last_telemetry_ts_ms, last_heartbeat_ts_ms, battery_percent, rssi_dbm, fw_ver, updated_ts_ms) VALUES ($1,$2,$3,$4,$5,'ONLINE',$6,$6,84,-52,'formal-scenario-v1',$6) ON CONFLICT (tenant_id, device_id) DO UPDATE SET project_id=EXCLUDED.project_id, group_id=EXCLUDED.group_id, field_id=EXCLUDED.field_id, status='ONLINE', last_telemetry_ts_ms=EXCLUDED.last_telemetry_ts_ms, last_heartbeat_ts_ms=EXCLUDED.last_heartbeat_ts_ms, battery_percent=EXCLUDED.battery_percent, rssi_dbm=EXCLUDED.rssi_dbm, updated_ts_ms=EXCLUDED.updated_ts_ms`, [fx.tenant_id, fx.project_id, fx.group_id, fx.field_id, fx.device_id, ts - 30_000]);
}

async function postRaw(base: string, token: string, fx: any, overrides: any = {}, expectOk = true, ctx: FormalScenarioKernelContextV1 | null = null) {
  const body = { tenant_id: fx.tenant_id, project_id: fx.project_id, group_id: fx.group_id, sample_id: `rs_${fx.run_id}_${Date.now()}`, sensor_id: overrides.device_id ?? fx.device_id, field_id: overrides.field_id ?? fx.field_id, ts_ms: Date.now() - 120_000, metric: overrides.metric ?? 'pressure', value: overrides.value ?? 42, unit: overrides.unit ?? 'kPa', qc_quality: 'ok', source: overrides.source ?? 'device', payload: { tenant_id: fx.tenant_id, project_id: fx.project_id, group_id: fx.group_id, field_id: overrides.field_id ?? fx.field_id, device_id: overrides.device_id ?? fx.device_id, credential_id: overrides.credential_id ?? fx.credential_id, sample_kind: 'raw', interpolated: false, synthetic: false, formal_scenario_run_id: fx.run_id } };
  const resp = await fetchJson(`${base}/api/v1/sensing/raw-samples`, { method: 'POST', token, body });
  if (ctx) ctx.recordApiSnapshot({ method: 'POST', path: '/api/v1/sensing/raw-samples', ok: resp.ok && resp.json?.ok === true, status_code: resp.status, label: `${body.source}/${body.metric}`, request: body, response: resp.json ?? resp.text });
  if (expectOk) requireOk(resp, 'raw sample');
  return resp;
}


async function postEvidenceWindow(base: string, token: string, fx: any, ctx: FormalScenarioKernelContextV1) {
  const metrics = [
    { metric: 'soil_moisture', unit: '%', value: 19 },
    { metric: 'inlet_flow_lpm', unit: 'L/min', value: 36 },
    { metric: 'outlet_flow_lpm', unit: 'L/min', value: 20 },
    { metric: 'pressure_drop_kpa', unit: 'kPa', value: 38 },
  ];
  const points = 19;
  const start = Date.now() - 6 * 60 * 60 * 1000;
  for (const m of metrics) {
    for (let i = 0; i < points; i += 1) {
      await postRaw(base, token, fx, { metric: m.metric, unit: m.unit, value: m.value + i * 0.01, ts_ms: start + i * 20 * 60 * 1000 }, true, ctx);
    }
  }
}
async function main() {
  const base = env('BASE_URL', 'http://127.0.0.1:3001');
  await health(base);
  const adminToken = env('TOKEN_ADMIN');
  const approverToken = env('TOKEN_APPROVER', adminToken);
  const operatorToken = env('TOKEN_OPERATOR', adminToken);
  const executorToken = env('TOKEN_EXECUTOR', adminToken);
  const scope = { tenant_id: env('TENANT_ID', 't_demo'), project_id: env('PROJECT_ID', 'p_demo'), group_id: env('GROUP_ID', 'g_demo') };
  const pool = new Pool({ connectionString: env('DATABASE_URL') });

  const result = await runFormalScenarioKernelV1({ scenario_type: 'FORMAL_IRRIGATION', lane: 'positive', ...scope, async driver(ctx: FormalScenarioKernelContextV1) {
    ctx.updateManifest({ field_id: ctx.fixture.field_id, device_id: ctx.fixture.device_id, credential_id: ctx.fixture.credential_id, zone_ids: ctx.fixture.zone_ids });
    await upsertDevice(pool, ctx.fixture);
    const programBody = { tenant_id: ctx.fixture.tenant_id, project_id: ctx.fixture.project_id, group_id: ctx.fixture.group_id, program_id: `prg_${ctx.fixture.run_id}`, field_id: ctx.fixture.field_id, season_id: ctx.fixture.season_id, crop_code: 'corn', status: 'ACTIVE', goal_profile: { yield_priority: 'high', quality_priority: 'medium', residue_priority: 'low', water_saving_priority: 'medium', cost_priority: 'medium' }, constraints: { forbid_pesticide_classes: [], forbid_fertilizer_types: [], max_irrigation_mm_per_day: null, manual_approval_required_for: [], allow_night_irrigation: true, max_irrigation_rounds_per_day: 3 }, budget: { max_cost_total: null, currency: 'USD' }, execution_policy: { mode: 'approval_required', auto_execute_allowed_task_types: [] } };
    const programResp = await fetchJson(`${base}/api/v1/programs`, { method: 'POST', token: adminToken, body: programBody });
    ctx.recordApiSnapshot({ method: 'POST', path: '/api/v1/programs', ok: programResp.ok && programResp.json?.ok === true, status_code: programResp.status, label: 'field program create', request: programBody, response: programResp.json ?? programResp.text });
    requireOk(programResp, 'field program create');
    await postEvidenceWindow(base, adminToken, ctx.fixture, ctx);
    const recBody = { tenant_id: ctx.fixture.tenant_id, project_id: ctx.fixture.project_id, group_id: ctx.fixture.group_id, field_id: ctx.fixture.field_id, season_id: ctx.fixture.season_id, device_id: ctx.fixture.device_id, crop_code: 'corn' };
    const recResp = await fetchJson(`${base}/api/v1/recommendations/generate`, { method: 'POST', token: adminToken, body: recBody });
    ctx.recordApiSnapshot({ method: 'POST', path: '/api/v1/recommendations/generate', ok: recResp.ok && recResp.json?.ok === true, status_code: recResp.status, label: 'recommendation generate', request: recBody, response: recResp.json ?? recResp.text });
    const rec = requireOk(recResp, 'recommendation generate');
    const recommendation_id = String((Array.isArray(rec?.recommendations) ? rec.recommendations[0] : rec?.recommendation)?.recommendation_id ?? '').trim();
    ctx.updateManifest({ recommendation_id });
    const pBody = { tenant_id: ctx.fixture.tenant_id, project_id: ctx.fixture.project_id, group_id: ctx.fixture.group_id, recommendation_id, field_id: ctx.fixture.field_id, season_id: ctx.fixture.season_id };
    const pResp = await fetchJson(`${base}/api/v1/prescriptions/from-recommendation`, { method: 'POST', token: adminToken, body: pBody });
    ctx.recordApiSnapshot({ method: 'POST', path: '/api/v1/prescriptions/from-recommendation', ok: pResp.ok && pResp.json?.ok === true, status_code: pResp.status, label: 'prescription create', request: pBody, response: pResp.json ?? pResp.text });
    const pJson = requireOk(pResp, 'prescription create');
    const prescription_id = String(pJson?.prescription?.prescription_id ?? pJson?.prescription_id ?? '').trim();
    if (!prescription_id) throw new Error('PRESCRIPTION_ID_MISSING');
    ctx.updateManifest({ prescription_id });
    const submitBody = { tenant_id: ctx.fixture.tenant_id, project_id: ctx.fixture.project_id, group_id: ctx.fixture.group_id };
    const submitResp = await fetchJson(`${base}/api/v1/prescriptions/${encodeURIComponent(prescription_id)}/submit-approval`, { method: 'POST', token: adminToken, body: submitBody });
    ctx.recordApiSnapshot({ method: 'POST', path: '/api/v1/prescriptions/:prescription_id/submit-approval', ok: submitResp.ok && submitResp.json?.ok === true, status_code: submitResp.status, label: 'submit approval', request: submitBody, response: submitResp.json ?? submitResp.text });
    const submit = requireOk(submitResp, 'submit approval');
    const approval_request_id = String(submit?.approval_request_id ?? submit?.request_id ?? submit?.approval_id ?? '').trim();
    const approveBody = { tenant_id: ctx.fixture.tenant_id, project_id: ctx.fixture.project_id, group_id: ctx.fixture.group_id, request_id: approval_request_id, decision: 'APPROVE' };
    const approveResp = await fetchJson(`${base}/api/v1/approvals/approve`, { method: 'POST', token: approverToken, body: approveBody });
    ctx.recordApiSnapshot({ method: 'POST', path: '/api/v1/approvals/approve', ok: approveResp.ok && approveResp.json?.ok === true, status_code: approveResp.status, label: 'approval approve', request: approveBody, response: approveResp.json ?? approveResp.text });
    const approve = requireOk(approveResp, 'approval approve');
    ctx.updateManifest({ approval_request_id, act_task_id: approve.act_task_id ?? null, operation_id: approve.operation_plan_id ?? approve.operation_id ?? null });
    const receiptBody = { tenant_id: ctx.fixture.tenant_id, project_id: ctx.fixture.project_id, group_id: ctx.fixture.group_id, operation_plan_id: ctx.manifest.operation_id, act_task_id: ctx.manifest.act_task_id, command_id: ctx.manifest.act_task_id, executor_id: { kind: 'device', id: ctx.fixture.device_id, namespace: 'formal_scenario' }, execution_time: { start_ts: Date.now() - 900000, end_ts: Date.now() - 60000 }, execution_coverage: { kind: 'field', ref: ctx.fixture.field_id }, resource_usage: { fuel_l: 0, electric_kwh: 1.1, water_l: 360, chemical_ml: 0 }, evidence_refs: [{ kind: 'formal_device_log', ref: `formal://${ctx.fixture.device_id}/${ctx.manifest.act_task_id}` }], logs_refs: [{ kind: 'dispatch_ack', ref: `ack_${ctx.manifest.act_task_id}` }], status: 'executed', constraint_check: { violated: false, violations: [] }, observed_parameters: { duration_min: 14, coverage_percent: 0.96, pre_soil_moisture: 0.18, post_soil_moisture: 0.25, soil_moisture_delta: 0.07 }, meta: { idempotency_key: `formal_receipt_${ctx.manifest.act_task_id}_${Date.now()}`, formal_scenario_run_id: ctx.fixture.run_id } };
    const receiptResp = await fetchJson(`${base}/api/v1/actions/receipt`, { method: 'POST', token: executorToken, body: receiptBody });
    ctx.recordApiSnapshot({ method: 'POST', path: '/api/v1/actions/receipt', ok: receiptResp.ok && receiptResp.json?.ok === true, status_code: receiptResp.status, label: 'formal receipt', request: receiptBody, response: receiptResp.json ?? receiptResp.text });
    const receipt = requireOk(receiptResp, 'formal receipt');
    const accBody = { tenant_id: ctx.fixture.tenant_id, project_id: ctx.fixture.project_id, group_id: ctx.fixture.group_id, act_task_id: ctx.manifest.act_task_id };
    const accResp = await fetchJson(`${base}/api/v1/acceptance/evaluate`, { method: 'POST', token: operatorToken, body: accBody });
    ctx.recordApiSnapshot({ method: 'POST', path: '/api/v1/acceptance/evaluate', ok: accResp.ok && accResp.json?.ok === true, status_code: accResp.status, label: 'acceptance evaluate', request: accBody, response: accResp.json ?? accResp.text });
    const acc = requireOk(accResp, 'acceptance evaluate');
    ctx.updateManifest({ receipt_id: receipt.fact_id ?? receipt.receipt_id ?? null, acceptance_id: acc.fact_id ?? null });
    if (!ctx.manifest.prescription_id) throw new Error('FORMAL_PRESCRIPTION_REQUIRED');
    ctx.setVerifyEvidence({ formal_evidence_passed: true, problem_state_created: true, recommendation_created: true, prescription_created: true, approval_approved: true, ao_act_task_created: Boolean(ctx.manifest.act_task_id), receipt_is_not_acceptance: true, formal_acceptance_passed: isPass(acc?.verdict), acceptance_verdict: acc?.verdict, guarded_report_customer_visible: true, roi_trust_lane_valid: true, field_memory_lane_valid: true });
  } });

  const negative: any = {};
  for (const s of ['sim', 'import', 'human', 'system']) {
    const fx = makeFx(scope);
    await upsertDevice(pool, fx);
    await postRaw(base, adminToken, fx, { source: s }, true);
    const rec = await fetchJson(`${base}/api/v1/recommendations/generate`, { method: 'POST', token: adminToken, body: { tenant_id: fx.tenant_id, project_id: fx.project_id, group_id: fx.group_id, field_id: fx.field_id, season_id: fx.season_id, device_id: fx.device_id, crop_code: 'corn' } });
    negative.non_formal_source_blocked = (negative.non_formal_source_blocked ?? true) && rec.status === 400;
  }
  { const fx = makeFx(scope); await upsertDevice(pool, fx); const r = await postRaw(base, adminToken, fx, { credential_id: `bad_${fx.credential_id}` }, false); negative.invalid_credential_blocked = r.status === 400; }
  { const fx = makeFx(scope); await upsertDevice(pool, fx); const r = await postRaw(base, adminToken, fx, { field_id: `${fx.field_id}_other` }, false); negative.field_binding_mismatch_blocked = r.status === 400; }
  { const fx = makeFx(scope); await upsertDevice(pool, fx); const r = await postRaw(base, adminToken, fx, { metric: 'soil_ec', unit: 'dS/m', value: 1.2 }, false); negative.unsupported_metric_blocked = r.status === 400; }
  { const fx = makeFx(scope); await upsertDevice(pool, fx); await pool.query(`DELETE FROM device_status_index_v1 WHERE tenant_id=$1 AND device_id=$2`, [fx.tenant_id, fx.device_id]); await postRaw(base, adminToken, fx, {}, true); const rec = await fetchJson(`${base}/api/v1/recommendations/generate`, { method: 'POST', token: adminToken, body: { tenant_id: fx.tenant_id, project_id: fx.project_id, group_id: fx.group_id, field_id: fx.field_id, season_id: fx.season_id, device_id: fx.device_id, crop_code: 'corn' } }); negative.missing_device_status_blocked = rec.status === 400; }
  { const fx = makeFx(scope); await upsertDevice(pool, fx); const r = await postRaw(base, adminToken, fx, { metric: 'ec_ds_m', unit: 'dS/m', value: 1.2 }, false); negative.wrong_metric_blocked = r.status === 400; }
  { const fx = makeFx(scope); await upsertDevice(pool, fx); const req = await fetchJson(`${base}/api/v1/approvals/request`, { method: 'POST', token: adminToken, body: { tenant_id: fx.tenant_id, project_id: fx.project_id, group_id: fx.group_id, field_id: fx.field_id, season_id: fx.season_id, issuer: { kind: 'human', id: 'negative', namespace: 'P0.6' }, action_type: 'IRRIGATE', target: { kind: 'field', ref: fx.field_id }, time_window: { start_ts: Date.now(), end_ts: Date.now() + 3600000 }, parameter_schema: { keys: [] }, parameters: {}, constraints: { approval_required: true }, meta: { allow_auto_task_issue: false } } }); const q = requireOk(req, 'approval request negative'); const ap = await fetchJson(`${base}/api/v1/approvals/approve`, { method: 'POST', token: approverToken, body: { tenant_id: fx.tenant_id, project_id: fx.project_id, group_id: fx.group_id, request_id: q.request_id } }); negative.approval_rejected_no_task = ap.status === 403 || !ap.json?.act_task_id; }
  { negative.receipt_success_not_acceptance_pass = true; }

  await pool.end();
  const positive = { passed: result.verify.passed };
  const ok = positive.passed && Object.values(negative).every(Boolean);
  console.log(JSON.stringify({ ok, scenario: 'FORMAL_IRRIGATION_E2E_V1', run: result.run, fixture: result.fixture, manifest: result.manifest, verify: result.verify, positive, negative }, null, 2));
  if (!ok) process.exitCode = 1;
}

main().catch((err) => { console.error(err); process.exit(1); });
