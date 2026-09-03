#!/usr/bin/env node
const { spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const { Pool } = require('pg');

const BASE_URL = process.env.BASE_URL || process.env.API_BASE_URL || process.env.GEOX_BASE_URL || 'http://127.0.0.1:3001';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || process.env.AO_ACT_TOKEN || process.env.GEOX_TOKEN || process.env.GEOX_AO_ACT_TOKEN || 'admin_token';
const DATABASE_URL = process.env.DATABASE_URL || '';
const TENANT = {
  tenant_id: process.env.TENANT_ID || process.env.GEOX_TENANT_ID || 'tenantA',
  project_id: process.env.PROJECT_ID || process.env.GEOX_PROJECT_ID || 'projectA',
  group_id: process.env.GROUP_ID || process.env.GEOX_GROUP_ID || 'groupA',
};

function fail(code, detail) {
  console.error(`[p1-smoke-preflight-idempotent] FAIL ${code}`, detail || '');
  process.exit(1);
}
function log(message, detail) {
  console.log(`[p1-smoke-preflight-idempotent] ${message}`, detail || '');
}
function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function sha256Hex(value) { return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex'); }

async function provisionDeviceIdentityFixture(pool, deviceId, fieldId) {
  if (!DATABASE_URL) fail('DATABASE_URL_REQUIRED_FOR_DEVICE_IDENTITY_FIXTURE');
  const ts = Date.now();
  const credentialId = `p1_smoke_${sha256Hex(`${deviceId}|${fieldId}`).slice(0,16)}`;
  const secret = `p1_smoke_secret_${crypto.randomBytes(24).toString('base64url')}`;
  await pool.query(
    `INSERT INTO field_index_v1(tenant_id,field_id,name,area_ha,status,project_id,group_id,created_ts_ms,updated_ts_ms)
     VALUES($1,$2,$3,1,'ACTIVE',$4,$5,$6,$6)
     ON CONFLICT(tenant_id,field_id) DO UPDATE SET project_id=EXCLUDED.project_id,group_id=EXCLUDED.group_id,updated_ts_ms=EXCLUDED.updated_ts_ms`,
    [TENANT.tenant_id,fieldId,`P1 smoke ${fieldId}`,TENANT.project_id,TENANT.group_id,ts],
  );
  await pool.query(
    `INSERT INTO device_index_v1(tenant_id,device_id,display_name,created_ts_ms,last_credential_id,last_credential_status)
     VALUES($1,$2,$3,$4,$5,'ACTIVE')
     ON CONFLICT(tenant_id,device_id) DO UPDATE SET last_credential_id=EXCLUDED.last_credential_id,last_credential_status='ACTIVE'`,
    [TENANT.tenant_id,deviceId,`P1 smoke ${deviceId}`,ts,credentialId],
  );
  await pool.query(
    `INSERT INTO device_binding_index_v1(tenant_id,device_id,field_id,bound_ts_ms)
     VALUES($1,$2,$3,$4)
     ON CONFLICT(tenant_id,device_id) DO UPDATE SET field_id=EXCLUDED.field_id,bound_ts_ms=EXCLUDED.bound_ts_ms`,
    [TENANT.tenant_id,deviceId,fieldId,ts],
  );
  await pool.query(
    `INSERT INTO device_credential_index_v1(tenant_id,device_id,credential_id,credential_hash,status,issued_ts_ms,revoked_ts_ms)
     VALUES($1,$2,$3,$4,'ACTIVE',$5,NULL)
     ON CONFLICT(tenant_id,device_id,credential_id) DO UPDATE SET credential_hash=EXCLUDED.credential_hash,status='ACTIVE',issued_ts_ms=EXCLUDED.issued_ts_ms,revoked_ts_ms=NULL`,
    [TENANT.tenant_id,deviceId,credentialId,sha256Hex(secret),ts],
  );
  return secret;
}

async function fetchJson(path, { method = 'GET', token = ADMIN_TOKEN, body } = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      accept: 'application/json',
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const raw = await res.text();
  let json;
  try { json = raw ? JSON.parse(raw) : {}; } catch { json = { raw }; }
  return { ok: res.ok, status: res.status, json, raw };
}

async function waitForHealth(maxWaitMs = 120000) {
  const started = Date.now();
  while (Date.now() - started < maxWaitMs) {
    try {
      const r = await fetchJson('/api/health', { token: null });
      if (r.ok) return;
    } catch {}
    await sleep(1000);
  }
  fail('SERVER_NOT_READY', { base_url: BASE_URL });
}

function findValueDeep(value, keys) {
  if (!value || typeof value !== 'object') return null;
  for (const key of keys) {
    if (value[key] !== undefined && value[key] !== null && String(value[key]).trim()) return value[key];
  }
  for (const child of Object.values(value)) {
    if (child && typeof child === 'object') {
      const found = findValueDeep(child, keys);
      if (found !== null && found !== undefined && String(found).trim()) return found;
    }
  }
  return null;
}
function collectValuesDeep(value, key, out = []) {
  if (!value || typeof value !== 'object') return out;
  if (value[key] !== undefined && value[key] !== null) out.push(value[key]);
  for (const child of Object.values(value)) {
    if (child && typeof child === 'object') collectValuesDeep(child, key, out);
  }
  return out;
}

function opPayload(deviceId, fieldId, suffix) {
  const now = Date.now();
  return {
    ...TENANT,
    field_id: fieldId,
    device_id: deviceId,
    action_type: 'IRRIGATE',
    adapter_type: 'irrigation_simulator',
    parameters: { duration_sec: 30 },
    issuer: { kind: 'human', id: 'p1_idempotent', namespace: 'qa' },
    command_id: `p1_idempotent_${suffix}_${now}`,
    meta: { smoke: 'p1_preflight_idempotent', device_id: deviceId },
  };
}

function assertCreatedDeviceFailSafe(result, deviceId, label) {
  const eventId = findValueDeep(result.json, ['fail_safe_event_id']);
  const reason = String(findValueDeep(result.json, ['reason_code']) || '').toUpperCase();
  const errors = collectValuesDeep(result.json, 'error').map((x) => String(x).toUpperCase());
  const triggered = errors.includes('FAIL_SAFE_TRIGGERED') || errors.includes('AO_ACT_TASK_CREATE_FAILED');
  if (![400, 409].includes(result.status) || !triggered || !eventId || reason !== 'DEVICE_STATUS_UNKNOWN') {
    fail('FAILED_TO_CREATE_STALE_FAIL_SAFE', { label, device_id: deviceId, status: result.status, body: result.json });
  }
  return String(eventId);
}

async function createUnknownDeviceFailSafe(deviceId, fieldId, suffix) {
  const result = await fetchJson('/api/v1/operations/manual', {
    method: 'POST',
    body: opPayload(deviceId, fieldId, suffix),
  });
  return assertCreatedDeviceFailSafe(result, deviceId, suffix);
}

async function listFailSafes() {
  const qs = new URLSearchParams(TENANT);
  const result = await fetchJson(`/api/v1/fail-safe/events?${qs.toString()}`);
  if (!result.ok || result.json?.ok !== true || !Array.isArray(result.json?.items)) {
    fail('FAIL_SAFE_LIST_FAILED', { status: result.status, body: result.json });
  }
  return result.json.items;
}
function byId(items, id) { return items.find((x) => String(x?.fail_safe_event_id) === String(id)); }
function openAcceptanceFailSafeIds(items) {
  return items.filter((item) =>
    String(item?.status || '').toUpperCase() === 'OPEN' &&
    String(item?.trigger_type || '').toUpperCase() === 'ACCEPTANCE_NEEDS_REVIEW' &&
    String(item?.blocked_action || '') === 'acceptance.evaluate'
  ).map((x) => String(x.fail_safe_event_id)).filter(Boolean);
}

function runPreflight(deviceId, deviceCredentialSecret) {
  const env = {
    ...process.env,
    GEOX_BASE_URL: BASE_URL,
    GEOX_DEVICE_ID: deviceId,
    GEOX_TENANT_ID: TENANT.tenant_id,
    GEOX_PROJECT_ID: TENANT.project_id,
    GEOX_GROUP_ID: TENANT.group_id,
    GEOX_TOKEN: ADMIN_TOKEN,
    GEOX_AO_ACT_TOKEN: ADMIN_TOKEN,
    GEOX_DEVICE_CREDENTIAL_SECRET: deviceCredentialSecret,
  };
  const result = spawnSync(process.execPath, ['apps/server/scripts/p1_smoke_device_ready.mjs'], {
    cwd: process.cwd(), env, encoding: 'utf8',
  });
  const output = `${result.stdout || ''}\n${result.stderr || ''}`;
  if (result.status !== 0) {
    const code = output.includes('MISSING_TOKEN_SCOPE') ? 'PREFLIGHT_USED_TOKEN_WITH_INSUFFICIENT_SCOPE' : 'PREFLIGHT_FAILED';
    fail(code, { status: result.status, output });
  }
  if (!output.includes('resolved stale smoke fail-safe') || !output.includes('resolved_fail_safe_count: 1')) {
    fail('PREFLIGHT_DID_NOT_RESOLVE_STALE_FAIL_SAFE', { output });
  }
  return output;
}

async function assertNoFailSafeOpenBlock(deviceId, fieldId) {
  const result = await fetchJson('/api/v1/operations/manual', {
    method: 'POST',
    body: opPayload(deviceId, fieldId, 'after_preflight'),
  });
  const errors = collectValuesDeep(result.json, 'error').map((x) => String(x).toUpperCase());
  if (errors.includes('FAIL_SAFE_OPEN')) {
    fail('PREFLIGHT_DID_NOT_CLEAR_FAIL_SAFE_OPEN_BLOCK', { status: result.status, body: result.json });
  }
  log('post-preflight operation did not hit FAIL_SAFE_OPEN', { status: result.status, errors });
}

async function main() {
  await waitForHealth();
  const ts = Date.now();
  const deviceId = `dev_smoke_idempotent_${ts}`;
  const otherDeviceId = `${deviceId}_other`;
  const fieldId = `field_p1_idempotent_${ts}`;

  const currentEventId = await createUnknownDeviceFailSafe(deviceId, fieldId, 'current');
  const otherEventId = await createUnknownDeviceFailSafe(otherDeviceId, fieldId, 'other');
  const before = await listFailSafes();
  const acceptanceIds = openAcceptanceFailSafeIds(before);
  if (acceptanceIds.length === 0) log('SKIP acceptance fail-safe preservation fixture: none currently OPEN');

  const pool = new Pool({ connectionString: DATABASE_URL });
  const deviceCredentialSecret = await provisionDeviceIdentityFixture(pool, deviceId, fieldId);
  await pool.end();
  runPreflight(deviceId, deviceCredentialSecret);

  const after = await listFailSafes();
  const current = byId(after, currentEventId);
  const other = byId(after, otherEventId);
  if (String(current?.status || '').toUpperCase() !== 'RESOLVED') {
    fail('PREFLIGHT_DID_NOT_RESOLVE_STALE_FAIL_SAFE', { currentEventId, current });
  }
  if (String(other?.status || '').toUpperCase() !== 'OPEN') {
    fail('OTHER_DEVICE_FAIL_SAFE_WAS_RESOLVED_UNEXPECTEDLY', { otherEventId, other });
  }
  const changedAcceptance = after
    .filter((item) => acceptanceIds.includes(String(item?.fail_safe_event_id)))
    .find((item) => String(item?.status || '').toUpperCase() !== 'OPEN');
  if (changedAcceptance) fail('ACCEPTANCE_FAIL_SAFE_WAS_RESOLVED_UNEXPECTEDLY', changedAcceptance);

  await assertNoFailSafeOpenBlock(deviceId, fieldId);

  console.log(JSON.stringify({
    ok: true,
    device_id: deviceId,
    resolved_event_id: currentEventId,
    other_event_id_still_open: true,
    acceptance_fail_safes_preserved: true,
    preflight_log_checked: true,
  }, null, 2));
}
main().catch((err) => {
  console.error('[p1-smoke-preflight-idempotent] ERROR', err);
  process.exit(1);
});
