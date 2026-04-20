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
const CHECK_GROUPS = {
  "server reachable": "ENV",
  "server authenticated probe": "ENV",
  "web reachable": "ENV",
  "bearer token configured": "ENV",
  "field exists": "OBJECT",
  "device exists": "OBJECT",
  "program exists": "OBJECT",
  "requested field-device match": "CHAIN",
  "field-device binding": "CHAIN",
  "field online device": "CHAIN",
  "field first telemetry": "CHAIN",
  "recommendation/operation handoff": "CHAIN",
};

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

async function checkServerAuthenticatedProbe() {
  if (!env.bearerToken) {
    recordCheck("server authenticated probe", "WARN", "skipped because GEOX_BEARER_TOKEN missing", "set GEOX_BEARER_TOKEN to verify authenticated API availability");
    return;
  }
  try {
    const res = await request(`${env.baseUrl}/api/v1/fields?limit=1`, { withAuth: true });
    if (res.status >= 400) {
      recordCheck("server authenticated probe", "WARN", `authenticated probe returned status=${res.status}`, "verify token validity/scope and backend auth middleware");
      return;
    }
    recordCheck("server authenticated probe", "PASS", `authenticated probe succeeded status=${res.status}`, "authenticated business API is reachable");
  } catch (error) {
    recordCheck("server authenticated probe", "WARN", `authenticated probe failed: ${String(error?.message ?? error)}`, "check auth gateway/network and rerun");
  }
}

async function checkWebReachable() {
  try {
    const res = await request(env.webUrl);
    if (res.status >= 500) {
      recordCheck("web reachable", "FAIL", `web returned ${res.status}`, "start/recover web app and verify GEOX_WEB_URL");
      return;
    }
    const body = typeof res.body === "string" ? res.body : "";
    const hasAppMarker = body.includes("<div id=\"root\">") || body.includes("vite") || body.includes("GEOX");
    if (!hasAppMarker) {
      recordCheck("web reachable", "WARN", `web responded ${res.status}, but app marker is weak`, "open GEOX_WEB_URL to confirm this is the expected GEOX frontend");
      return;
    }
    recordCheck("web reachable", "PASS", `web responded ${res.status} with app marker`, "open GEOX_WEB_URL in browser for live demo");
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
    return { fieldId: env.fieldId, fieldPayload: detail.body, source: "requested" };
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
  return detail.status >= 400 ? null : { fieldId: selectedId, fieldPayload: detail.body, source: "sample" };
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
    return { deviceId: env.deviceId, devicePayload: detail.body, source: "requested" };
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
  return { deviceId: sample === "<unknown>" ? "" : sample, devicePayload: devices[0], source: "sample" };
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

function getCandidateValues(payload, keys) {
  if (!payload || typeof payload !== "object") return [];
  const out = [];
  const stack = [payload];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || typeof current !== "object") continue;
    if (Array.isArray(current)) {
      for (const item of current) stack.push(item);
      continue;
    }
    for (const [key, value] of Object.entries(current)) {
      if (keys.includes(key)) out.push(value);
      if (value && typeof value === "object") stack.push(value);
    }
  }
  return out;
}

function toTsMs(raw) {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function findDeviceTelemetryEvidence(devicePayload) {
  const candidates = getCandidateValues(devicePayload, [
    "latest_telemetry_ts_ms",
    "latestTelemetryTsMs",
    "last_telemetry_ts_ms",
    "lastTelemetryTsMs",
    "latest_data_ts_ms",
    "latestDataTsMs",
    "last_data_ts_ms",
    "lastDataTsMs",
    "telemetry_ts_ms",
  ]);
  let bestTs = 0;
  for (const candidate of candidates) {
    const ts = toTsMs(candidate);
    if (ts > bestTs) bestTs = ts;
  }
  return bestTs;
}

function checkRequestedFieldDeviceMatch(fieldPayload) {
  if (!env.fieldId || !env.deviceId) return;
  if (!fieldPayload || typeof fieldPayload !== "object") {
    recordCheck("requested field-device match", "WARN", `field_id=${env.fieldId}, device_id=${env.deviceId}; field detail unavailable`, "fix field read issue, then verify requested field-device relation");
    return;
  }
  const boundDevices = pickArray(fieldPayload, ["bound_devices", "devices"]);
  const match = boundDevices.some((d) => {
    const id = String(d?.device_id ?? d?.id ?? "").trim();
    return id && id === env.deviceId;
  });
  if (match) {
    recordCheck("requested field-device match", "PASS", `field_id=${env.fieldId} is bound to device_id=${env.deviceId}`, "requested field/device pair is consistent for pilot checks");
    return;
  }
  recordCheck("requested field-device match", "FAIL", `field_id=${env.fieldId} exists and device_id=${env.deviceId} exists, but device is not bound to requested field`, "bind the requested device to the requested field, then rerun");
}

function checkFieldBindingAndTelemetry(fieldContext, deviceContext) {
  const effectiveFieldId = String(fieldContext?.fieldId ?? "").trim();
  const source = fieldContext?.source === "sample" ? "sample" : "requested";
  const fieldPayload = fieldContext?.fieldPayload;
  const sourceHint = source === "sample"
    ? `using sample field_id=${effectiveFieldId || "<unknown>"} because GEOX_FIELD_ID not provided`
    : `field_id=${effectiveFieldId || env.fieldId || "<unknown>"}`;

  if (!effectiveFieldId) {
    if (env.fieldId && env.deviceId) {
      recordCheck("requested field-device match", "WARN", `field_id=${env.fieldId}, device_id=${env.deviceId}; cannot verify relation without field detail`, "set valid GEOX_FIELD_ID and rerun");
    }
    recordCheck("field-device binding", "WARN", "no available field_id to inspect binding", "create field or set GEOX_FIELD_ID, then rerun");
    recordCheck("field online device", "WARN", "no available field_id to inspect online state", "create field or set GEOX_FIELD_ID, then rerun");
    recordCheck("field first telemetry", "WARN", "no available field_id to inspect telemetry", "create field or set GEOX_FIELD_ID, then rerun");
    return;
  }

  if (!fieldPayload || typeof fieldPayload !== "object") {
    checkRequestedFieldDeviceMatch(fieldPayload);
    recordCheck("field-device binding", "FAIL", `field detail unavailable; cannot inspect binding (${sourceHint})`, "fix field read issue and rerun");
    recordCheck("field online device", "WARN", `field detail unavailable; online state unknown (${sourceHint})`, "fix field read issue and rerun");
    recordCheck("field first telemetry", "WARN", `field detail unavailable; telemetry state unknown (${sourceHint})`, "fix field read issue and rerun");
    return;
  }

  checkRequestedFieldDeviceMatch(fieldPayload);

  const boundDevices = pickArray(fieldPayload, ["bound_devices", "devices"]);
  if (boundDevices.length < 1) {
    recordCheck("field-device binding", "WARN", `${sourceHint}; field has no bound devices`, "bind at least one device to this field for closed-loop demo");
    recordCheck("field online device", "WARN", `${sourceHint}; no bound devices, online check not satisfied`, "bind + start one device heartbeat before demo");
    recordCheck("field first telemetry", "WARN", `${sourceHint}; no bound devices, telemetry evidence unavailable`, "bind device and push telemetry point");
    return;
  }

  recordCheck("field-device binding", "PASS", `${sourceHint}; bound devices=${boundDevices.length}`, "keep at least one binding stable for demo day");

  const online = boundDevices.filter((d) => String(d?.connection_status ?? "").toUpperCase() === "ONLINE");
  if (online.length < 1) {
    recordCheck("field online device", "WARN", `${sourceHint}; field has bound devices but none is ONLINE`, "start device heartbeat and verify device_status_index_v1 update");
  } else {
    recordCheck("field online device", "PASS", `${sourceHint}; online devices=${online.length}`, "maintain connectivity during demo window");
  }

  const latestTelemetryTs = toTsMs(fieldPayload?.latest_telemetry_ts_ms);
  const latestDeviceTelemetryTs = findDeviceTelemetryEvidence(deviceContext?.devicePayload);
  const deviceHint = deviceContext?.source === "requested"
    ? `device_id=${deviceContext?.deviceId || env.deviceId || "<unknown>"}`
    : `sample device_id=${deviceContext?.deviceId || "<unknown>"}`;

  if (latestTelemetryTs > 0) {
    const iso = new Date(latestTelemetryTs).toISOString();
    recordCheck("field first telemetry", "PASS", `${sourceHint}; field detail telemetry evidence latest_telemetry_ts_ms=${latestTelemetryTs} (${iso})`, "use this telemetry timestamp as evidence in day-1 report");
    return;
  }

  if (latestDeviceTelemetryTs > 0) {
    const iso = new Date(latestDeviceTelemetryTs).toISOString();
    recordCheck("field first telemetry", "PASS", `${sourceHint}; device telemetry evidence fallback from ${deviceHint}, ts_ms=${latestDeviceTelemetryTs} (${iso})`, "field telemetry field missing, but device telemetry already proves day-1 data flow");
  } else {
    recordCheck("field first telemetry", "WARN", `${sourceHint}; no telemetry evidence from field detail, and no device telemetry evidence fallback`, "wait for first telemetry ingestion then rerun");
  }
}

function matchesScopedObject(item, { fieldId, programId }) {
  if (!item || typeof item !== "object") return false;
  const fieldValues = getCandidateValues(item, ["field_id", "fieldId"]);
  const programValues = getCandidateValues(item, ["program_id", "programId"]);
  const matchField = fieldId ? fieldValues.some((v) => String(v).trim() === fieldId) : false;
  const matchProgram = programId ? programValues.some((v) => String(v).trim() === programId) : false;
  return matchField || matchProgram;
}

async function checkRecommendationOrOperationChain() {
  const scopeHints = [];
  if (env.fieldId) scopeHints.push(`field_id=${env.fieldId}`);
  if (env.programId) scopeHints.push(`program_id=${env.programId}`);

  const rec = await request(`${env.baseUrl}/api/v1/recommendations?limit=50`, { withAuth: true });
  let recItems = [];
  if (rec.status < 400) {
    recItems = pickArray(rec.body, ["items", "recommendations"]);
  }

  const ops = await request(`${env.baseUrl}/api/v1/operations?limit=50`, { withAuth: true });
  const opItems = ops.status < 400 ? pickArray(ops.body, ["items", "operations"]) : [];
  const scopedRecommendations = recItems.filter((item) => matchesScopedObject(item, { fieldId: env.fieldId, programId: env.programId }));
  const scopedOperations = opItems.filter((item) => matchesScopedObject(item, { fieldId: env.fieldId, programId: env.programId }));

  if (scopedRecommendations.length > 0 || scopedOperations.length > 0) {
    const details = [];
    if (scopedRecommendations.length > 0) details.push(`recommendation_count=${scopedRecommendations.length}`);
    if (scopedOperations.length > 0) details.push(`operation_count=${scopedOperations.length}`);
    recordCheck("recommendation/operation handoff", "PASS", `found scoped handoff objects (${details.join(", ")}) for ${scopeHints.join(", ") || "current tenant"}`, "keep scoped chain objects visible for pilot walkthrough");
    return;
  }

  if (ops.status >= 400) {
    if (recItems.length > 0) {
      recordCheck("recommendation/operation handoff", "PASS", "tenant-level recommendation exists, exact field/program linkage not verified (operation list unavailable)", "verify /api/v1/operations permission for richer scoped handoff visibility");
      return;
    }
    recordCheck("recommendation/operation handoff", "WARN", `operation list unavailable status=${ops.status}`, "ensure ao_act.index.read permission and create recommendation/operation evidence");
    return;
  }

  if (recItems.length > 0 || opItems.length > 0) {
    recordCheck("recommendation/operation handoff", "PASS", `tenant-level recommendation/operation exists (recommendation_count=${recItems.length}, operation_count=${opItems.length}), exact field/program linkage not verified`, "prefer creating or querying objects linked to requested field/program for deterministic pilot evidence");
    return;
  }

  recordCheck("recommendation/operation handoff", "WARN", "preconditions exist but recommendation/operation chain has not started", "generate recommendation or create operation to complete day-1 demo chain");
}

function summarizeAndExit() {
  const groupOrder = ["ENV", "OBJECT", "CHAIN"];
  console.log("---- grouped check summary ----");
  for (const group of groupOrder) {
    const groupChecks = checks.filter((item) => (CHECK_GROUPS[item.name] ?? "OTHER") === group);
    for (const item of groupChecks) {
      console.log(`[${group}] ${item.status} ${item.name}`);
    }
  }
  const otherChecks = checks.filter((item) => !CHECK_GROUPS[item.name]);
  for (const item of otherChecks) {
    console.log(`[OTHER] ${item.status} ${item.name}`);
  }
  console.log("---- end grouped summary ----");

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
  await checkServerAuthenticatedProbe();
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

  const fieldContext = await loadField();
  const deviceContext = await loadDevice();
  await loadProgram();
  checkFieldBindingAndTelemetry(fieldContext, deviceContext);
  await checkRecommendationOrOperationChain();
  summarizeAndExit();
}

main().catch((error) => {
  recordCheck("script runtime", "FAIL", `unexpected error: ${String(error?.message ?? error)}`, "fix script/runtime environment and rerun");
  summarizeAndExit();
});
