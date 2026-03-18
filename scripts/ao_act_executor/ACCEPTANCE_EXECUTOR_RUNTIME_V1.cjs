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

async function createTask(base, token, triple, suffix, adapter_type = 'mqtt') {
  const body = {
    ...triple,
    operation_plan_id: `op_${suffix}`,
    approval_request_id: `apr_${suffix}`,
    issuer: { kind: 'system', id: 'acceptance' },
    action_type: 'irrigation.start',
    target: { kind: 'device', id: env('DEVICE_ID', 'dev_onboard_accept_001') },
    time_window: { start_ts: Date.now(), end_ts: Date.now() + 60000 },
    parameter_schema: { type: 'object' },
    parameters: { water_l: 12 },
    constraints: {},
    meta: { device_id: env('DEVICE_ID', 'dev_onboard_accept_001'), adapter_type }
  };

  const out = await fetchJson(`${base}/api/v1/ao-act/tasks`, { method: 'POST', token, body });
  const json = requireOk(out, `create task ${suffix}`);
  return String(json.act_task_id ?? '').trim();
}

(async () => {
  const base = env('BASE_URL', 'http://127.0.0.1:3000');
  const token = env('AO_ACT_TOKEN', env('GEOX_AO_ACT_TOKEN', ''));
  const triple = {
    tenant_id: env('TENANT_ID', 'tenantA'),
    project_id: env('PROJECT_ID', 'projectA'),
    group_id: env('GROUP_ID', 'groupA')
  };
  if (!token) throw new Error('MISSING_AO_ACT_TOKEN');

  const rid = crypto.randomUUID().replace(/-/g, '').slice(0, 8);

  // adapter 不支持 action 的拒绝
  {
    const bad = await fetchJson(`${base}/api/v1/ao-act/tasks`, {
      method: 'POST',
      token,
      body: {
        ...triple,
        operation_plan_id: `op_bad_${rid}`,
        action_type: 'spray.start',
        meta: { device_id: env('DEVICE_ID', 'dev_onboard_accept_001'), adapter_type: 'irrigation_http_v1' }
      }
    });
    assert.equal(bad.status, 400, `expect unsupported action reject, got ${bad.status} body=${bad.text}`);
  }

  const taskId = await createTask(base, token, triple, rid, 'mqtt');

  // claim/lease
  const claim = await fetchJson(`${base}/api/v1/ao-act/dispatches/claim`, {
    method: 'POST',
    token,
    body: { ...triple, executor_id: `acc_exec_${rid}`, limit: 1, lease_seconds: 20, act_task_id: taskId }
  });
  const claimOut = requireOk(claim, 'claim dispatch');
  assert.ok(Array.isArray(claimOut.items) && claimOut.items.length >= 1, 'claim should return at least 1 item');
  const item = claimOut.items[0];
  assert.ok(Number(item.attempt_no ?? 0) >= 1, 'attempt_no should be >= 1');

  // 幂等 dispatch + retry
  await execFileAsync('pnpm', [
    '--filter', '@geox/executor', 'exec', 'tsx', 'src/run_dispatch_once.ts',
    '--baseUrl', base,
    '--token', token,
    '--tenant_id', triple.tenant_id,
    '--project_id', triple.project_id,
    '--group_id', triple.group_id,
    '--executor_id', `acc_exec_${rid}`,
    '--limit', '1'
  ], { cwd: process.cwd(), env: process.env });

  const retry = await fetchJson(`${base}/api/v1/ao-act/tasks/${encodeURIComponent(taskId)}/retry`, {
    method: 'POST',
    token,
    body: { ...triple, retry_reason: 'acceptance_retry' }
  });
  // task has receipt now => retry should be rejected or no-op depending server protection.
  assert.ok([200, 400].includes(retry.status), `unexpected retry status=${retry.status} body=${retry.text}`);

  // receipt 去重（相同 task/attempt/code）
  const r1 = await fetchJson(`${base}/api/v1/ao-act/receipts`, {
    method: 'POST',
    token,
    body: {
      ...triple,
      task_id: taskId,
      command_id: taskId,
      meta: {
        idempotency_key: `${taskId}:1:ACK`,
        adapter_type: 'mqtt',
        attempt_no: 1,
        receipt_status: 'SUCCEEDED',
        receipt_code: 'ACK',
        device_id: env('DEVICE_ID', 'dev_onboard_accept_001')
      }
    }
  });
  assert.ok([200, 409].includes(r1.status), `receipt write should pass or dedupe, got ${r1.status}`);

  const r2 = await fetchJson(`${base}/api/v1/ao-act/receipts`, {
    method: 'POST',
    token,
    body: {
      ...triple,
      task_id: taskId,
      command_id: taskId,
      meta: {
        idempotency_key: `${taskId}:1:ACK`,
        adapter_type: 'mqtt',
        attempt_no: 1,
        receipt_status: 'SUCCEEDED',
        receipt_code: 'ACK',
        device_id: env('DEVICE_ID', 'dev_onboard_accept_001')
      }
    }
  });
  assert.equal(r2.status, 409, `second same receipt must dedupe, got ${r2.status} body=${r2.text}`);

  console.log('PASS: ACCEPTANCE_EXECUTOR_RUNTIME_V1');
})().catch((err) => {
  console.error(`FAIL: ${err?.message ?? String(err)}`);
  process.exit(1);
});
