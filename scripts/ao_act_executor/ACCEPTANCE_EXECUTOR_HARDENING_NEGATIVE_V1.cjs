const assert = require('node:assert/strict');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const execFileAsync = promisify(execFile);

function env(name, fallback = '') { return String(process.env[name] ?? fallback).trim(); }

function tokenFilePath() {
  return path.join(process.cwd(), 'config', 'auth', 'ao_act_tokens_v0.json');
}

function readTokenFile() {
  const file = tokenFilePath();
  const raw = fs.readFileSync(file, 'utf8');
  return JSON.parse(raw);
}

function writeTokenFile(json) {
  const file = tokenFilePath();
  fs.writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`, 'utf8');
}

function readDefaultTokenRecord() {
  try {
    const json = readTokenFile();
    const rec = (Array.isArray(json?.tokens) ? json.tokens : []).find((item) =>
      item &&
      item.revoked !== true &&
      Array.isArray(item.scopes) &&
      item.scopes.includes('ao_act.task.write') &&
      item.scopes.includes('ao_act.receipt.write') &&
      item.scopes.includes('ao_act.index.read')
    );
    return rec || null;
  } catch {
    return null;
  }
}

function readDefaultToken() {
  const rec = readDefaultTokenRecord();
  return rec?.token ? String(rec.token) : '';
}

function createTempExecutorToken(baseRecord, suffix) {
  assert.ok(baseRecord && typeof baseRecord === 'object', 'BASE_TOKEN_RECORD_MISSING');

  const json = readTokenFile();
  const tokens = Array.isArray(json.tokens) ? json.tokens.slice() : [];

  const token = `geox_exec_${crypto.randomUUID().replace(/-/g, '')}`;
  const token_id = `executor_accept_${suffix}`;
  const actor_id = `executor_accept_${suffix}`;

  const scopes = Array.from(new Set([
    ...(Array.isArray(baseRecord.scopes) ? baseRecord.scopes : []),
    'ao_act.task.write',
    'ao_act.receipt.write',
    'ao_act.index.read'
  ]));

  const rec = {
    ...baseRecord,
    token,
    token_id,
    actor_id,
    scopes,
    revoked: false
  };

  tokens.push(rec);
  writeTokenFile({ ...json, tokens });

  let cleaned = false;

  return {
    token,
    cleanup() {
      if (cleaned) return;
      cleaned = true;
      const latest = readTokenFile();
      const latestTokens = Array.isArray(latest.tokens) ? latest.tokens : [];
      writeTokenFile({
        ...latest,
        tokens: latestTokens.filter((item) => String(item?.token_id ?? '') !== token_id)
      });
    }
  };
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

function recommendationBody(triple, deviceId, suffix) {
  return {
    tenant_id: triple.tenant_id,
    project_id: triple.project_id,
    group_id: triple.group_id,
    field_id: env('FIELD_ID', 'field_c8_demo'),
    season_id: env('SEASON_ID', 'season_demo'),
    device_id: deviceId,
    telemetry: { soil_moisture_pct: 20, canopy_temp_c: 33 },
    image_recognition: { stress_score: 0.55, disease_score: 0.75, pest_risk_score: 0.2, confidence: 0.9 },
    meta: { note: `executor_hardening_negative_${suffix}` }
  };
}

async function createTask(base, token, triple, suffix, deviceId) {
  const recResp = await fetchJson(`${base}/api/v1/recommendations/generate`, {
    method: 'POST',
    token,
    body: recommendationBody(triple, deviceId, suffix)
  });
  const recOut = requireOk(recResp, `generate recommendation ${suffix}`);
  const recId = String(recOut.recommendations?.[0]?.recommendation_id ?? '').trim();
  assert.ok(recId, `recommendation_id missing for ${suffix}; body=${JSON.stringify(recOut)}`);

  const submitResp = await fetchJson(`${base}/api/v1/recommendations/${encodeURIComponent(recId)}/submit-approval`, {
    method: 'POST',
    token,
    body: { ...triple }
  });
  const submitOut = requireOk(submitResp, `submit approval ${suffix}`);

  let approvalRequestId = String(submitOut.approval_request_id ?? '').trim();
  let actTaskId = String(
    submitOut.act_task_id ??
    submitOut.item?.act_task_id ??
    submitOut.task?.act_task_id ??
    ''
  ).trim();

  if (!actTaskId) {
    assert.ok(approvalRequestId, `approval_request_id missing for ${suffix}; body=${JSON.stringify(submitOut)}`);

    const decideResp = await fetchJson(`${base}/api/v1/approvals/${encodeURIComponent(approvalRequestId)}/decide`, {
      method: 'POST',
      token,
      body: {
        ...triple,
        decision: 'APPROVE',
        reason: `executor_hardening_negative_${suffix}`
      }
    });
    const decideOut = requireOk(decideResp, `approval decide ${suffix}`);
    actTaskId = String(decideOut.act_task_id ?? '').trim();
    approvalRequestId = String(decideOut.approval_request_id ?? approvalRequestId).trim();
  }

  assert.ok(actTaskId, `act_task_id missing for ${suffix}`);
  return { actTaskId, recommendationId: recId, approvalRequestId };
}

(async () => {
  const base = env('BASE_URL', 'http://127.0.0.1:3000');
  const baseTokenRecord = readDefaultTokenRecord();
  const token = env('AO_ACT_TOKEN', env('GEOX_AO_ACT_TOKEN', baseTokenRecord?.token ? String(baseTokenRecord.token) : ''));
  const tenant_id = env('TENANT_ID', env('GEOX_AO_ACT_TENANT_ID', 'tenantA'));
  const project_id = env('PROJECT_ID', env('GEOX_AO_ACT_PROJECT_ID', 'projectA'));
  const group_id = env('GROUP_ID', env('GEOX_AO_ACT_GROUP_ID', 'groupA'));
  const device_id = env('DEVICE_ID', 'dev_onboard_accept_001');
  if (!token) throw new Error('MISSING_AO_ACT_TOKEN');
  if (!baseTokenRecord) throw new Error('MISSING_BASE_TOKEN_RECORD');

  const triple = { tenant_id, project_id, group_id };
  const rid = crypto.randomUUID().replace(/-/g, '').slice(0, 12);

  const tempExecutor = createTempExecutorToken(baseTokenRecord, rid);
  const executorToken = tempExecutor.token;

  try {
    // 1) non-executor token calling irrigation simulator must be rejected at outer gate.
    {
      const { actTaskId } = await createTask(base, token, triple, `non_executor_${rid}`, device_id);
      const resp = await fetchJson(`${base}/api/v1/simulators/irrigation/execute`, {
        method: 'POST',
        token,
        body: {
          ...triple,
          act_task_id: actTaskId,
          command_id: actTaskId,
          parameters: { water_l: 360 }
        }
      });
      assert.equal(resp.status, 403, `expected 403 EXECUTOR_TOKEN_REQUIRED, got ${resp.status} body=${resp.text}`);
      assert.equal(String(resp.json?.error ?? ''), 'EXECUTOR_TOKEN_REQUIRED', `unexpected error: ${resp.text}`);
    }

    // 2) executor token + recommendation_id as execute primary key must be rejected.
    {
      const { recommendationId } = await createTask(base, token, triple, `bad_recommendation_key_${rid}`, device_id);
      const resp = await fetchJson(`${base}/api/v1/simulators/irrigation/execute`, {
        method: 'POST',
        token: executorToken,
        body: {
          ...triple,
          act_task_id: recommendationId,
          command_id: recommendationId,
          parameters: { water_l: 360 }
        }
      });
      assert.equal(resp.status, 400, `expected 400 RECOMMENDATION_ID_NOT_ALLOWED, got ${resp.status} body=${resp.text}`);
      assert.equal(String(resp.json?.error ?? ''), 'RECOMMENDATION_ID_NOT_ALLOWED', `unexpected error: ${resp.text}`);
    }

    // 3) executor token + nonexistent act_task_id must be rejected.
    {
      const missingId = `act_missing_${rid}`;
      const resp = await fetchJson(`${base}/api/v1/simulators/irrigation/execute`, {
        method: 'POST',
        token: executorToken,
        body: {
          ...triple,
          act_task_id: missingId,
          command_id: missingId,
          parameters: { water_l: 360 }
        }
      });
      assert.equal(resp.status, 404, `expected 404 TASK_NOT_FOUND, got ${resp.status} body=${resp.text}`);
      assert.equal(String(resp.json?.error ?? ''), 'TASK_NOT_FOUND', `unexpected error: ${resp.text}`);
    }

    // 4) non-READY queue item must be filtered before executor dispatch loop claim result.
    {
      const { actTaskId } = await createTask(base, token, triple, `not_ready_${rid}`, device_id);

      const dispatched = await fetchJson(`${base}/api/v1/ao-act/tasks/${encodeURIComponent(actTaskId)}/dispatch`, {
        method: 'POST',
        token,
        body: { ...triple, command_id: actTaskId, device_id }
      });
      requireOk(dispatched, 'dispatch for not-ready setup');

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
      assert.ok(
        combined.includes('claimed queue size=0') || combined.includes('no claimed dispatch items found'),
        `expected no-op due to empty claim, got: ${combined}`
      );
    }

    // 5) existing receipt must block duplicate dispatch.
    {
      const { actTaskId } = await createTask(base, token, triple, `receipt_guard_${rid}`, device_id);

      const dispatch = await fetchJson(`${base}/api/v1/ao-act/tasks/${encodeURIComponent(actTaskId)}/dispatch`, {
        method: 'POST',
        token,
        body: { ...triple, command_id: actTaskId, device_id }
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
        method: 'POST',
        token,
        body: { ...triple, command_id: actTaskId, device_id }
      });
      assert.equal(
        duplicateDispatch.status,
        400,
        `expected 400 TASK_ALREADY_HAS_RECEIPT, got ${duplicateDispatch.status} body=${duplicateDispatch.text}`
      );
      assert.equal(
        String(duplicateDispatch.json?.error ?? ''),
        'TASK_ALREADY_HAS_RECEIPT',
        `unexpected duplicate dispatch error: ${duplicateDispatch.text}`
      );
    }

    // 6) illegal state transition must return STATE_TRANSITION_DENIED.
    {
      const { actTaskId } = await createTask(base, token, triple, `transition_${rid}`, device_id);

      const dispatch = await fetchJson(`${base}/api/v1/ao-act/tasks/${encodeURIComponent(actTaskId)}/dispatch`, {
        method: 'POST',
        token,
        body: { ...triple, command_id: actTaskId, device_id }
      });
      requireOk(dispatch, 'dispatch for illegal transition setup');

      const denied = await fetchJson(`${base}/api/v1/ao-act/dispatches/state`, {
        method: 'POST',
        token,
        body: { ...triple, act_task_id: actTaskId, command_id: actTaskId, state: 'SUCCEEDED' }
      });
      assert.equal(
        denied.status,
        409,
        `expected 409 STATE_TRANSITION_DENIED, got ${denied.status} body=${denied.text}`
      );
      assert.equal(
        String(denied.json?.error ?? ''),
        'STATE_TRANSITION_DENIED',
        `unexpected transition error: ${denied.text}`
      );
    }

    console.log('PASS ACCEPTANCE_EXECUTOR_HARDENING_NEGATIVE_V1');
  } finally {
    tempExecutor.cleanup();
  }
})().catch((e) => {
  console.error('FAIL ACCEPTANCE_EXECUTOR_HARDENING_NEGATIVE_V1', e?.stack || e?.message || String(e));
  process.exit(1);
});