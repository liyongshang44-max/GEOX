const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);

function env(name, fallback = '') { return String(process.env[name] ?? fallback).trim(); }

async function fetchJson(url, { method = 'GET', token = '', body = undefined } = {}) {
  const res = await fetch(url, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      accept: 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {})
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch {}
  return { status: res.status, ok: res.ok, json, text };
}

function requireOk(resp, label) {
  assert.equal(resp.ok, true, `${label} status=${resp.status} body=${resp.text}`);
  assert.equal(resp.json?.ok, true, `${label} json.ok!=true body=${resp.text}`);
  return resp.json;
}

function recommendationBody(triple, deviceId, suffix) {
  return {
    tenant_id: triple.tenant_id,
    project_id: triple.project_id,
    group_id: triple.group_id,
    field_id: env('FIELD_ID', 'field_c8_demo'),
    season_id: env('SEASON_ID', 'season_demo'),
    device_id: deviceId,
    telemetry: { soil_moisture_pct: 18, canopy_temp_c: 33 },
    image_recognition: { stress_score: 0.8, disease_score: 0.1, pest_risk_score: 0.1, confidence: 0.9 },
    meta: { note: `executor_runtime_v1_${suffix}` }
  };
}

async function createApprovedTaskViaRecommendation(base, token, triple, suffix, deviceId) {
  const recResp = await fetchJson(`${base}/api/v1/recommendations/generate`, {
    method: 'POST',
    token,
    body: recommendationBody(triple, deviceId, suffix)
  });
  const recOut = requireOk(recResp, `generate recommendation ${suffix}`);
  const recommendationId = String(recOut.recommendations?.[0]?.recommendation_id ?? '').trim();
  assert.ok(recommendationId, `recommendation_id missing for ${suffix}; body=${JSON.stringify(recOut)}`);

  const submitResp = await fetchJson(`${base}/api/v1/recommendations/${encodeURIComponent(recommendationId)}/submit-approval`, {
    method: 'POST',
    token,
    body: { ...triple }
  });
  const submitOut = requireOk(submitResp, `submit approval ${suffix}`);

  const approvalRequestId = String(submitOut.approval_request_id ?? '').trim();
  assert.ok(approvalRequestId, `approval_request_id missing for ${suffix}; body=${JSON.stringify(submitOut)}`);

  const decideResp = await fetchJson(`${base}/api/v1/approvals/${encodeURIComponent(approvalRequestId)}/decide`, {
    method: 'POST',
    token,
    body: {
      ...triple,
      decision: 'APPROVE',
      reason: `executor_runtime_v1_${suffix}`
    }
  });
  const decideOut = requireOk(decideResp, `approve request ${suffix}`);

  const actTaskId = String(decideOut.act_task_id ?? '').trim();
  const operationPlanId = String(decideOut.operation_plan_id ?? '').trim();
  assert.ok(actTaskId, `act_task_id missing in approve response: ${JSON.stringify(decideOut)}`);
  assert.ok(operationPlanId, `operation_plan_id missing in approve response: ${JSON.stringify(decideOut)}`);

  return { recommendationId, approvalRequestId, operationPlanId, actTaskId };
}

async function createTaskWithUnsupportedAction(base, token, triple, operationPlanId, suffix, deviceId) {
  return fetchJson(`${base}/api/v1/ao-act/tasks`, {
    method: 'POST',
    token,
    body: {
      ...triple,
      operation_plan_id: operationPlanId,
      approval_request_id: `apr_neg_${suffix}`,
      issuer: { kind: 'system', id: 'acceptance_negative' },
      action_type: 'spray.start',
      target: { kind: 'device', id: deviceId },
      time_window: { start_ts: Date.now(), end_ts: Date.now() + 60000 },
      parameter_schema: { type: 'object' },
      parameters: { dosage_ml: 1 },
      constraints: {},
      meta: { device_id: deviceId, adapter_type: 'irrigation_http_v1' }
    }
  });
}

async function listReceipts(base, token, triple, actTaskId) {
  return fetchJson(
    `${base}/api/v1/ao-act/receipts?tenant_id=${encodeURIComponent(triple.tenant_id)}&project_id=${encodeURIComponent(triple.project_id)}&group_id=${encodeURIComponent(triple.group_id)}&act_task_id=${encodeURIComponent(actTaskId)}&limit=20`,
    { method: 'GET', token }
  );
}

async function listDownlinks(base, token, triple, actTaskId) {
  return fetchJson(
    `${base}/api/v1/ao-act/downlinks?tenant_id=${encodeURIComponent(triple.tenant_id)}&project_id=${encodeURIComponent(triple.project_id)}&group_id=${encodeURIComponent(triple.group_id)}&act_task_id=${encodeURIComponent(actTaskId)}&limit=20`,
    { method: 'GET', token }
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

(async () => {
  const base = env('BASE_URL', 'http://127.0.0.1:3000');
  const token = env('AO_ACT_TOKEN', env('GEOX_AO_ACT_TOKEN', ''));
  const triple = {
    tenant_id: env('TENANT_ID', 'tenantA'),
    project_id: env('PROJECT_ID', 'projectA'),
    group_id: env('GROUP_ID', 'groupA')
  };
  const deviceId = env('DEVICE_ID', 'dev_onboard_accept_001');

  if (!token) throw new Error('MISSING_AO_ACT_TOKEN');

  const rid = crypto.randomUUID().replace(/-/g, '').slice(0, 8);

  // 先走 recommendation → approval → operation_plan 合法链路（seed 用于 unsupported）
  const seed = await createApprovedTaskViaRecommendation(base, token, triple, `seed_${rid}`, deviceId);

  // adapter 不支持 action 的拒绝（使用真实 operation_plan_id，避免 404）
  {
    const bad = await createTaskWithUnsupportedAction(base, token, triple, seed.operationPlanId, rid, deviceId);
    assert.equal(bad.status, 400, `expected 400 for unsupported action, got ${bad.status} body=${bad.text}`);
    assert.equal(String(bad.json?.error ?? ''), 'ADAPTER_UNSUPPORTED_ACTION', `unexpected error payload: ${bad.text}`);
  }

  // claim/lease（使用独立任务，避免影响后续 worker 用例）
  const claimSeed = await createApprovedTaskViaRecommendation(base, token, triple, `claim_${rid}`, deviceId);
  const claim = await fetchJson(`${base}/api/v1/ao-act/dispatches/claim`, {
    method: 'POST',
    token,
    body: { ...triple, executor_id: `acc_exec_${rid}`, limit: 1, lease_seconds: 20, act_task_id: claimSeed.actTaskId }
  });
  const claimOut = requireOk(claim, 'claim dispatch');
  assert.ok(Array.isArray(claimOut.items) && claimOut.items.length >= 1, 'claim should return at least 1 item');
  const item = claimOut.items[0];
  assert.ok(Number(item.attempt_no ?? item.attempt_count ?? 0) >= 1, 'attempt_no should be >= 1');

  // dispatch + retry + simulator receipt 闭环（使用新任务，避免被 claim 占用）
  const runSeed = await createApprovedTaskViaRecommendation(base, token, triple, `run_${rid}`, deviceId);
  await execFileAsync('pnpm', [
    '--filter', '@geox/executor', 'exec', 'tsx', 'src/run_dispatch_once.ts',
    '--baseUrl', base,
    '--token', token,
    '--tenant_id', triple.tenant_id,
    '--project_id', triple.project_id,
    '--group_id', triple.group_id,
    '--executor_id', `acc_exec_${rid}`,
    '--limit', '1',
    '--lease_seconds', '20',
    '--act_task_id', runSeed.actTaskId
  ], { cwd: process.cwd(), env: process.env });

  await sleep(200);

  const receiptsResp = await listReceipts(base, token, triple, runSeed.actTaskId);
  const receiptsOut = requireOk(receiptsResp, 'list receipts');
  assert.ok(Array.isArray(receiptsOut.items) && receiptsOut.items.length >= 1, `receipts should exist for simulator flow: ${JSON.stringify(receiptsOut)}`);
  const receiptItem = receiptsOut.items[0];
  const receiptPayload = receiptItem?.receipt?.payload ?? {};
  const receiptMeta = receiptPayload?.meta ?? {};
  const idempotencyKey = String(receiptPayload?.idempotency_key ?? receiptMeta?.idempotency_key ?? '').trim();
  assert.ok(idempotencyKey, `idempotency_key missing from receipt payload: ${JSON.stringify(receiptItem)}`);
  console.log(`INFO: receipt observed act_task_id=${runSeed.actTaskId} idempotency_key=${idempotencyKey}`);
  console.log(`INFO: receipt sample ${JSON.stringify(receiptItem)}`);

  const downlinksResp = await listDownlinks(base, token, triple, runSeed.actTaskId);
  const downlinksOut = requireOk(downlinksResp, 'list downlinks');
  assert.ok(Array.isArray(downlinksOut.items) && downlinksOut.items.length >= 1, `downlinks/published should exist: ${JSON.stringify(downlinksOut)}`);
  console.log(`INFO: downlink sample ${JSON.stringify(downlinksOut.items[0])}`);

  const retry = await fetchJson(`${base}/api/v1/ao-act/tasks/${encodeURIComponent(runSeed.actTaskId)}/retry`, {
    method: 'POST',
    token,
    body: { ...triple, retry_reason: 'acceptance_retry' }
  });
  assert.equal(retry.status, 400, `retry after receipt should be rejected, got ${retry.status} body=${retry.text}`);

  // receipt 去重（基于真实 simulator uplink receipt 重放）
  const dedupeReplay = await fetchJson(`${base}/api/v1/ao-act/receipts/uplink`, {
    method: 'POST',
    token,
    body: {
      ...triple,
      task_id: runSeed.actTaskId,
      act_task_id: runSeed.actTaskId,
      command_id: runSeed.actTaskId,
      device_id: deviceId,
      status: 'executed',
      start_ts: Date.now() - 50,
      end_ts: Date.now(),
      meta: {
        idempotency_key: idempotencyKey,
        adapter_type: 'irrigation_simulator',
        attempt_no: Number(receiptPayload?.attempt_no ?? receiptMeta?.attempt_no ?? 1),
        receipt_status: 'SUCCEEDED',
        receipt_code: String(receiptPayload?.receipt_code ?? receiptMeta?.receipt_code ?? 'ACK'),
        device_id: deviceId
      }
    }
  });
  assert.equal(dedupeReplay.status, 409, `replay same simulator receipt must dedupe, got ${dedupeReplay.status} body=${dedupeReplay.text}`);

  console.log('PASS: ACCEPTANCE_EXECUTOR_RUNTIME_V1');
})().catch((err) => {
  console.error(`FAIL: ${err?.message ?? String(err)}`);
  process.exit(1);
});
