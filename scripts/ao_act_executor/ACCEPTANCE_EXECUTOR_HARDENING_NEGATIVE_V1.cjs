const assert = require('node:assert/strict');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const execFileAsync = promisify(execFile);

function env(name, fallback = '') { return String(process.env[name] ?? fallback).trim(); }

function readDefaultToken() {
  try {
    const file = path.join(process.cwd(), 'config', 'auth', 'ao_act_tokens_v0.json');
    const json = JSON.parse(fs.readFileSync(file, 'utf8'));
    const token = (Array.isArray(json?.tokens) ? json.tokens : []).find((item) => item && item.revoked !== true && Array.isArray(item.scopes) && item.scopes.includes('ao_act.task.write') && item.scopes.includes('ao_act.receipt.write') && item.scopes.includes('ao_act.index.read'));
    return token?.token ? String(token.token) : '';
  } catch {
    return '';
  }
}

async function fetchJson(url, { method = 'GET', token = '', body = undefined } = {}) {
  const res = await fetch(url, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch {}
  return { status: res.status, ok: res.ok, json, text };
}

function requireOk(resp, msg) {
  assert.equal(resp.ok, true, `${msg} status=${resp.status} body=${resp.text}`);
  assert.equal(resp.json?.ok, true, `${msg} json.ok!=true body=${resp.text}`);
  return resp.json;
}

function taskBody(triple, suffix) {
  const now = Date.now();
  return {
    tenant_id: triple.tenant_id,
    project_id: triple.project_id,
    group_id: triple.group_id,
    issuer: { kind: 'human', id: 'executor_hardening', namespace: 'acceptance' },
    action_type: 'IRRIGATE',
    target: { kind: 'field', ref: `field_${suffix}` },
    time_window: { start_ts: now, end_ts: now + 60_000 },
    parameter_schema: { keys: [ { name: 'water_l', type: 'number', min: 1, max: 2000 } ] },
    parameters: { water_l: 360 },
    constraints: {},
    meta: { note: 'executor_hardening_negative' }
  };
}

async function createTask(base, token, triple, suffix) {
  const created = await fetchJson(`${base}/api/control/ao_act/task`, {
    method: 'POST',
    token,
    body: taskBody(triple, suffix)
  });
  const out = requireOk(created, `create task ${suffix}`);
  const actTaskId = String(out.act_task_id ?? '').trim();
  assert.ok(actTaskId, `act_task_id missing for ${suffix}`);
  return actTaskId;
}

(async () => {
  const base = env('BASE_URL', 'http://127.0.0.1:3000');
  const token = env('AO_ACT_TOKEN', env('GEOX_AO_ACT_TOKEN', readDefaultToken()));
  const tenant_id = env('TENANT_ID', env('GEOX_AO_ACT_TENANT_ID', 'tenantA'));
  const project_id = env('PROJECT_ID', env('GEOX_AO_ACT_PROJECT_ID', 'projectA'));
  const group_id = env('GROUP_ID', env('GEOX_AO_ACT_GROUP_ID', 'groupA'));
  const device_id = env('DEVICE_ID', 'device_negative_v1');
  if (!token) throw new Error('MISSING_AO_ACT_TOKEN');

  const triple = { tenant_id, project_id, group_id };
  const rid = crypto.randomUUID().replace(/-/g, '').slice(0, 12);

  // 1) non-executor token calling irrigation simulator must be rejected.
  {
    const actTaskId = await createTask(base, token, triple, `non_executor_${rid}`);
    const resp = await fetchJson(`${base}/api/v1/simulators/irrigation/execute`, {
      method: 'POST',
      token,
      body: { ...triple, act_task_id: actTaskId, command_id: actTaskId, parameters: { water_l: 360 } }
    });
    assert.equal(resp.status, 403, `expected 403 EXECUTOR_TOKEN_REQUIRED, got ${resp.status} body=${resp.text}`);
    assert.equal(String(resp.json?.error ?? ''), 'EXECUTOR_TOKEN_REQUIRED', `unexpected error: ${resp.text}`);
  }

  // 2) non-READY queue item must be refused by executor dispatch loop.
  {
    const actTaskId = await createTask(base, token, triple, `not_ready_${rid}`);
    const dispatched = await fetchJson(`${base}/api/v1/ao-act/tasks/${encodeURIComponent(actTaskId)}/dispatch`, {
      method: 'POST', token, body: { ...triple, command_id: actTaskId, device_id }
    });
    requireOk(dispatched, 'dispatch for not-ready setup');

    const stateSet = await fetchJson(`${base}/api/v1/ao-act/dispatches/state`, {
      method: 'POST', token, body: { ...triple, act_task_id: actTaskId, command_id: actTaskId, state: 'DISPATCHED' }
    });
    requireOk(stateSet, 'mark DISPATCHED for not-ready setup');

    const run = await execFileAsync('pnpm', [
      '--filter', '@geox/executor', 'exec', 'tsx', 'src/run_dispatch_once.ts',
      '--baseUrl', base,
      '--token', token,
      '--tenant_id', tenant_id,
      '--project_id', project_id,
      '--group_id', group_id,
      '--limit', '5'
    ], { cwd: process.cwd(), env: process.env });
    const combined = `${run.stdout || ''}\n${run.stderr || ''}`;
    assert.ok(combined.includes(`act_task_id=${actTaskId}`) && combined.includes('reason=task_not_ready'), `expected task_not_ready skip log, got: ${combined}`);
  }

  // 3) existing receipt must block duplicate dispatch.
  {
    const actTaskId = await createTask(base, token, triple, `receipt_guard_${rid}`);
    const dispatch = await fetchJson(`${base}/api/v1/ao-act/tasks/${encodeURIComponent(actTaskId)}/dispatch`, {
      method: 'POST', token, body: { ...triple, command_id: actTaskId, device_id }
    });
    const dispatchJson = requireOk(dispatch, 'dispatch for receipt guard');

    const published = await fetchJson(`${base}/api/v1/ao-act/downlinks/published`, {
      method: 'POST',
      token,
      body: {
        ...triple,
        act_task_id: actTaskId,
        command_id: actTaskId,
        outbox_fact_id: dispatchJson.outbox_fact_id,
        device_id,
        topic: `downlink/${tenant_id}/${device_id}`
      }
    });
    requireOk(published, 'downlinks published for receipt guard');

    const uplink = await fetchJson(`${base}/api/v1/ao-act/receipts/uplink`, {
      method: 'POST',
      token,
      body: {
        ...triple,
        task_id: actTaskId,
        act_task_id: actTaskId,
        command_id: actTaskId,
        device_id,
        status: 'executed',
        meta: { idempotency_key: `negative-${actTaskId}` }
      }
    });
    requireOk(uplink, 'receipt uplink for duplicate dispatch guard');

    const duplicateDispatch = await fetchJson(`${base}/api/v1/ao-act/tasks/${encodeURIComponent(actTaskId)}/dispatch`, {
      method: 'POST', token, body: { ...triple, command_id: actTaskId, device_id }
    });
    assert.equal(duplicateDispatch.status, 400, `expected 400 TASK_ALREADY_HAS_RECEIPT, got ${duplicateDispatch.status} body=${duplicateDispatch.text}`);
    assert.equal(String(duplicateDispatch.json?.error ?? ''), 'TASK_ALREADY_HAS_RECEIPT', `unexpected duplicate dispatch error: ${duplicateDispatch.text}`);
  }

  // 4) illegal state transition must return STATE_TRANSITION_DENIED.
  {
    const actTaskId = await createTask(base, token, triple, `transition_${rid}`);
    const dispatch = await fetchJson(`${base}/api/v1/ao-act/tasks/${encodeURIComponent(actTaskId)}/dispatch`, {
      method: 'POST', token, body: { ...triple, command_id: actTaskId, device_id }
    });
    requireOk(dispatch, 'dispatch for illegal transition setup');

    const denied = await fetchJson(`${base}/api/v1/ao-act/dispatches/state`, {
      method: 'POST', token, body: { ...triple, act_task_id: actTaskId, command_id: actTaskId, state: 'SUCCEEDED' }
    });
    assert.equal(denied.status, 409, `expected 409 STATE_TRANSITION_DENIED, got ${denied.status} body=${denied.text}`);
    assert.equal(String(denied.json?.error ?? ''), 'STATE_TRANSITION_DENIED', `unexpected transition error: ${denied.text}`);
  }

  console.log('PASS ACCEPTANCE_EXECUTOR_HARDENING_NEGATIVE_V1');
})().catch((e) => {
  console.error('FAIL ACCEPTANCE_EXECUTOR_HARDENING_NEGATIVE_V1', e?.stack || e?.message || String(e));
  process.exit(1);
});
