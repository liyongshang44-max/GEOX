#!/usr/bin/env node

const DEFAULT_BASE_URL = "http://127.0.0.1:3001";
const DEFAULT_WEB_URL = "http://127.0.0.1:5173";
const REQUEST_TIMEOUT_MS = Number.parseInt(process.env.GEOX_CHECK_TIMEOUT_MS ?? "6000", 10) || 6000;

const env = {
  baseUrl: String(process.env.GEOX_BASE_URL ?? DEFAULT_BASE_URL).trim(),
  webUrl: String(process.env.GEOX_WEB_URL ?? DEFAULT_WEB_URL).trim(),
  bearerToken: String(process.env.GEOX_BEARER_TOKEN ?? "").trim(),
  fieldId: String(process.env.GEOX_FIELD_ID ?? "").trim(),
  deviceId: String(process.env.GEOX_DEVICE_ID ?? "").trim(),
  programId: String(process.env.GEOX_PROGRAM_ID ?? "").trim(),
};

const checks = [];

function recordCheck(name, status, reason, nextStep) {
  checks.push({ name, status, reason, nextStep });
  console.log(`${status} ${name}`);
  console.log(`  reason: ${reason}`);
  console.log(`  next: ${nextStep}`);
}

function headers(withAuth = false) {
  const h = { accept: "application/json" };
  if (withAuth && env.bearerToken) h.authorization = `Bearer ${env.bearerToken}`;
  return h;
}

async function request(url, { method = "GET", withAuth = false } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(`timeout>${REQUEST_TIMEOUT_MS}ms`)), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { method, headers: headers(withAuth), signal: controller.signal });
    const contentType = String(res.headers.get("content-type") ?? "").toLowerCase();
    let body = null;
    if (contentType.includes("application/json")) {
      body = await res.json().catch(() => null);
    } else {
      body = await res.text().catch(() => null);
    }
    return { ok: res.ok, status: res.status, body };
  } finally {
    clearTimeout(timer);
  }
}

function pickArray(payload, candidates) {
  if (!payload || typeof payload !== "object") return [];
  for (const key of candidates) {
    if (Array.isArray(payload[key])) return payload[key];
  }
  return [];
}

async function checkServerReachable() {
  try {
    const res = await request(`${env.baseUrl}/api/v1/auth/providers`);
    if (res.status >= 500) {
      recordCheck("server reachable", "FAIL", `server returned ${res.status} from /api/v1/auth/providers`, "start/recover server, then rerun script");
      return false;
    }
    recordCheck("server reachable", "PASS", `server responded ${res.status}`, "keep server process alive for demo");
    return true;
  } catch (error) {
    recordCheck("server reachable", "FAIL", `cannot reach GEOX_BASE_URL=${env.baseUrl}; ${String(error?.message ?? error)}`, "check GEOX_BASE_URL and server boot logs");
    return false;
  }
}

async function checkWebReachable() {
  try {
    const res = await request(env.webUrl);
    if (res.status >= 500) {
      recordCheck("web reachable", "FAIL", `web returned ${res.status}`, "start/recover web app and verify GEOX_WEB_URL");
      return;
    }
    recordCheck("web reachable", "PASS", `web responded ${res.status}`, "open GEOX_WEB_URL in browser for live demo");
  } catch (error) {
    recordCheck("web reachable", "FAIL", `cannot reach GEOX_WEB_URL=${env.webUrl}; ${String(error?.message ?? error)}`, "check GEOX_WEB_URL and frontend dev server");
  }
}

function checkBearerTokenPresence() {
  if (!env.bearerToken) {
    recordCheck("bearer token configured", "FAIL", "GEOX_BEARER_TOKEN missing", "export GEOX_BEARER_TOKEN with read scopes (fields/devices/programs/ao_act.index.read)");
    return false;
  }
  recordCheck("bearer token configured", "PASS", "GEOX_BEARER_TOKEN present", "ensure token tenant/project/group matches trial environment");
  return true;
}

async function loadField() {
  if (env.fieldId) {
    const detail = await request(`${env.baseUrl}/api/v1/fields/${encodeURIComponent(env.fieldId)}`, { withAuth: true });
    if (detail.status === 404) {
      recordCheck("field exists", "FAIL", `field_id=${env.fieldId} not found`, "create/import target field or fix GEOX_FIELD_ID");
      return null;
    }
    if (detail.status >= 400) {
      recordCheck("field exists", "FAIL", `field detail request failed status=${detail.status}`, "verify token scope includes fields.read");
      return null;
    }
    recordCheck("field exists", "PASS", `field_id=${env.fieldId} is readable`, "use this field_id for demo walkthrough");
    return detail.body;
  }

  const list = await request(`${env.baseUrl}/api/v1/fields?limit=20`, { withAuth: true });
  if (list.status >= 400) {
    recordCheck("field exists", "FAIL", `field list request failed status=${list.status}`, "verify token scope includes fields.read");
    return null;
  }
  const fields = pickArray(list.body, ["fields", "items"]);
  if (fields.length < 1) {
    recordCheck("field exists", "WARN", "no field found in current tenant", "create at least one field before first-day loop demo");
    return null;
  }
  const selected = fields[0];
  const selectedId = String(selected?.field_id ?? selected?.id ?? "").trim();
  recordCheck("field exists", "PASS", `found ${fields.length} field(s), sample=${selectedId || "<unknown>"}`, "optionally set GEOX_FIELD_ID for deterministic check");

  if (!selectedId) return null;
  const detail = await request(`${env.baseUrl}/api/v1/fields/${encodeURIComponent(selectedId)}`, { withAuth: true });
  return detail.status >= 400 ? null : detail.body;
}

async function loadDevice() {
  if (env.deviceId) {
    const detail = await request(`${env.baseUrl}/api/v1/devices/${encodeURIComponent(env.deviceId)}`, { withAuth: true });
    if (detail.status === 404) {
      recordCheck("device exists", "FAIL", `device_id=${env.deviceId} not found`, "onboard/connect target device or fix GEOX_DEVICE_ID");
      return null;
    }
    if (detail.status >= 400) {
      recordCheck("device exists", "FAIL", `device detail request failed status=${detail.status}`, "verify token scope includes devices.read");
      return null;
    }
    recordCheck("device exists", "PASS", `device_id=${env.deviceId} is readable`, "keep this device online during demo");
    return detail.body;
  }

  const list = await request(`${env.baseUrl}/api/v1/devices?limit=20`, { withAuth: true });
  if (list.status >= 400) {
    recordCheck("device exists", "FAIL", `device list request failed status=${list.status}`, "verify token scope includes devices.read");
    return null;
  }
  const devices = pickArray(list.body, ["devices", "items"]);
  if (devices.length < 1) {
    recordCheck("device exists", "WARN", "no device found in current tenant", "register at least one device and complete onboarding");
    return null;
  }
  const sample = String(devices[0]?.device_id ?? devices[0]?.id ?? "").trim() || "<unknown>";
  recordCheck("device exists", "PASS", `found ${devices.length} device(s), sample=${sample}`, "optionally set GEOX_DEVICE_ID for deterministic check");
  return devices[0];
}

async function loadProgram() {
  if (env.programId) {
    const detail = await request(`${env.baseUrl}/api/v1/programs/${encodeURIComponent(env.programId)}`, { withAuth: true });
    if (detail.status === 404) {
      recordCheck("program exists", "WARN", `program_id=${env.programId} not found`, "initialize or sync program, then rerun");
      return null;
    }
    if (detail.status >= 400) {
      recordCheck("program exists", "FAIL", `program detail request failed status=${detail.status}`, "verify token scope includes ao_act.index.read");
      return null;
    }
    recordCheck("program exists", "PASS", `program_id=${env.programId} is readable`, "use this program in trial narrative");
    return detail.body;
  }

  const list = await request(`${env.baseUrl}/api/v1/programs?limit=20`, { withAuth: true });
  if (list.status >= 400) {
    recordCheck("program exists", "FAIL", `program list request failed status=${list.status}`, "verify token scope includes ao_act.index.read");
    return null;
  }
  const programs = pickArray(list.body, ["items", "programs"]);
  if (programs.length < 1) {
    recordCheck("program exists", "WARN", "no program found in current tenant", "initialize at least one program before closed-loop demo");
    return null;
  }
  const sample = String(programs[0]?.program_id ?? programs[0]?.id ?? "").trim() || "<unknown>";
  recordCheck("program exists", "PASS", `found ${programs.length} program(s), sample=${sample}`, "optionally set GEOX_PROGRAM_ID for deterministic check");
  return programs[0];
}

function checkFieldBindingAndTelemetry(fieldPayload) {
  if (!env.fieldId) {
    recordCheck("field-device binding", "WARN", "GEOX_FIELD_ID not provided; skipped deterministic binding check", "set GEOX_FIELD_ID to verify exact field binding state");
    recordCheck("field online device", "WARN", "GEOX_FIELD_ID not provided; skipped deterministic online check", "set GEOX_FIELD_ID to verify online device state");
    recordCheck("field first telemetry", "WARN", "GEOX_FIELD_ID not provided; skipped deterministic telemetry check", "set GEOX_FIELD_ID to verify first telemetry arrival");
    return;
  }

  if (!fieldPayload || typeof fieldPayload !== "object") {
    recordCheck("field-device binding", "FAIL", "field detail unavailable; cannot inspect binding", "fix field read issue and rerun");
    recordCheck("field online device", "WARN", "field detail unavailable; online state unknown", "fix field read issue and rerun");
    recordCheck("field first telemetry", "WARN", "field detail unavailable; telemetry state unknown", "fix field read issue and rerun");
    return;
  }

  const boundDevices = pickArray(fieldPayload, ["bound_devices", "devices"]);
  if (boundDevices.length < 1) {
    recordCheck("field-device binding", "WARN", `field_id=${env.fieldId} has no bound devices`, "bind at least one device to this field for closed-loop demo");
    recordCheck("field online device", "WARN", "no bound devices, online check not satisfied", "bind + start one device heartbeat before demo");
    recordCheck("field first telemetry", "WARN", "no bound devices, telemetry evidence unavailable", "bind device and push telemetry point");
    return;
  }

  recordCheck("field-device binding", "PASS", `field_id=${env.fieldId} has ${boundDevices.length} bound device(s)`, "keep at least one binding stable for demo day");

  const online = boundDevices.filter((d) => String(d?.connection_status ?? "").toUpperCase() === "ONLINE");
  if (online.length < 1) {
    recordCheck("field online device", "WARN", "field has bound devices but none is ONLINE", "start device heartbeat and verify device_status_index_v1 update");
  } else {
    recordCheck("field online device", "PASS", `online devices=${online.length}`, "maintain connectivity during demo window");
  }

  const latestTelemetryTs = Number(fieldPayload?.latest_telemetry_ts_ms ?? 0);
  if (!Number.isFinite(latestTelemetryTs) || latestTelemetryTs <= 0) {
    recordCheck("field first telemetry", "WARN", "no latest telemetry evidence found for bound devices", "wait for first telemetry ingestion then rerun");
  } else {
    const iso = new Date(latestTelemetryTs).toISOString();
    recordCheck("field first telemetry", "PASS", `latest_telemetry_ts_ms=${latestTelemetryTs} (${iso})`, "use this telemetry timestamp as evidence in day-1 report");
  }
}

async function checkRecommendationOrOperationChain() {
  const rec = await request(`${env.baseUrl}/api/v1/recommendations?limit=20`, { withAuth: true });
  let hasRecommendation = false;
  if (rec.status < 400) {
    const recItems = pickArray(rec.body, ["items", "recommendations"]);
    hasRecommendation = recItems.length > 0;
  }

  const ops = await request(`${env.baseUrl}/api/v1/operations?limit=20`, { withAuth: true });
  if (ops.status >= 400) {
    if (hasRecommendation) {
      recordCheck("recommendation/operation handoff", "PASS", "recommendation object exists (operation list unavailable)", "verify /api/v1/operations permission for richer handoff visibility");
      return;
    }
    recordCheck("recommendation/operation handoff", "WARN", `operation list unavailable status=${ops.status}`, "ensure ao_act.index.read permission and create recommendation/operation evidence");
    return;
  }

  const opItems = pickArray(ops.body, ["items", "operations"]);
  if (hasRecommendation || opItems.length > 0) {
    recordCheck("recommendation/operation handoff", "PASS", `recommendation=${hasRecommendation ? "yes" : "no"}, operation_count=${opItems.length}`, "keep at least one active chain object for on-site walkthrough");
    return;
  }

  recordCheck("recommendation/operation handoff", "WARN", "preconditions exist but recommendation/operation chain has not started", "generate recommendation or create operation to complete day-1 demo chain");
}

function summarizeAndExit() {
  const hasFail = checks.some((item) => item.status === "FAIL");
  const hasWarn = checks.some((item) => item.status === "WARN");
  const finalStatus = hasFail ? "FAIL" : (hasWarn ? "WARN" : "PASS");
  const summary = finalStatus === "PASS"
    ? "当前环境已具备首日演示条件"
    : finalStatus === "WARN"
      ? "当前环境可启动，但尚未达到首日闭环演示条件"
      : "当前环境基础入口异常，未通过首日检查";

  console.log(`TRIAL_DAY1_STATUS=${finalStatus}`);
  console.log(summary);
  process.exitCode = finalStatus === "FAIL" ? 1 : 0;
}

async function main() {
  const serverOk = await checkServerReachable();
  await checkWebReachable();

  if (!serverOk) {
    recordCheck("business-object checks", "FAIL", "server unreachable, skipped field/device/program/telemetry/handoff checks", "recover server first, then rerun full check");
    summarizeAndExit();
    return;
  }

  const tokenOk = checkBearerTokenPresence();
  if (!tokenOk) {
    recordCheck("business-object checks", "FAIL", "missing bearer token, skipped authenticated object checks", "set GEOX_BEARER_TOKEN and rerun");
    summarizeAndExit();
    return;
  }

  const fieldPayload = await loadField();
  await loadDevice();
  await loadProgram();
  checkFieldBindingAndTelemetry(fieldPayload);
  await checkRecommendationOrOperationChain();
  summarizeAndExit();
}

main().catch((error) => {
  recordCheck("script runtime", "FAIL", `unexpected error: ${String(error?.message ?? error)}`, "fix script/runtime environment and rerun");
  summarizeAndExit();
});
