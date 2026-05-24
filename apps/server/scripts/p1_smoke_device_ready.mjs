import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASE_URL = process.env.GEOX_BASE_URL ?? "http://127.0.0.1:3001";
const DEVICE_ID = String(process.env.GEOX_DEVICE_ID ?? "dev_smoke_01").trim() || "dev_smoke_01";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../../..");
const TOKEN_CANDIDATE_FILES = [
  path.join(REPO_ROOT, "config/auth/security_acceptance_tokens.json"),
  path.join(REPO_ROOT, "config/auth/ao_act_tokens_v0.json"),
  path.join(REPO_ROOT, "config/auth/example_tokens.json"),
];
const tenant = {
  tenant_id: String(process.env.GEOX_TENANT_ID ?? "tenantA").trim() || "tenantA",
  project_id: String(process.env.GEOX_PROJECT_ID ?? "projectA").trim() || "projectA",
  group_id: String(process.env.GEOX_GROUP_ID ?? "groupA").trim() || "groupA",
};
const STALE_SMOKE_DEVICE_TRIGGER_TYPES = new Set(["DEVICE_STATUS_UNKNOWN", "DEVICE_OFFLINE"]);
const STALE_SMOKE_DEVICE_REASON_CODES = new Set(["DEVICE_STATUS_UNKNOWN", "DEVICE_OFFLINE"]);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeScope(value) {
  return String(value ?? "").trim();
}

function loadTokenCandidates() {
  const rows = [];
  for (const tokenFilePath of TOKEN_CANDIDATE_FILES) {
    if (!fs.existsSync(tokenFilePath)) continue;
    const parsed = JSON.parse(fs.readFileSync(tokenFilePath, "utf8"));
    const tokens = Array.isArray(parsed?.tokens) ? parsed.tokens : [];
    for (const row of tokens) {
      const token = typeof row?.token === "string" ? row.token.trim() : "";
      if (!token || token.includes("set-via-env-or-external-secret-file")) continue;
      rows.push({
        token,
        source_file: tokenFilePath,
        scopes: Array.isArray(row?.scopes) ? row.scopes.map((s) => String(s)) : [],
        role: String(row?.role ?? "").trim().toLowerCase(),
        tenant_id: String(row?.tenant_id ?? "").trim(),
        project_id: String(row?.project_id ?? "").trim(),
        group_id: String(row?.group_id ?? "").trim(),
        revoked: Boolean(row?.revoked),
      });
    }
  }
  return rows;
}

function findKnownTokenRow(token, candidates = loadTokenCandidates()) {
  const normalized = normalizeScope(token);
  if (!normalized) return null;
  return candidates.find((row) => row.token === normalized) ?? null;
}

function tokenHasAnyScope(row, requiredAnyScopes = []) {
  if (!row?.token) return false;
  if (!Array.isArray(requiredAnyScopes) || requiredAnyScopes.length === 0) return true;
  return requiredAnyScopes.some((scope) => row.scopes.includes(scope));
}

function tokenMatchesTenant(row) {
  return row?.tenant_id === tenant.tenant_id && row?.project_id === tenant.project_id && row?.group_id === tenant.group_id;
}

function formatRequired(requiredAnyScopes = []) {
  return requiredAnyScopes.join("|") || "any";
}

function formatActualScopes(row) {
  const scopes = Array.isArray(row?.scopes) ? row.scopes : [];
  return scopes.length ? scopes.join("|") : "none";
}

function verifyEnvTokenScope(label, token, requiredAnyScopes = [], candidates = loadTokenCandidates()) {
  const row = findKnownTokenRow(token, candidates);
  const required = formatRequired(requiredAnyScopes);
  if (!row) {
    if (process.env.GEOX_ACCEPTANCE_ALLOW_UNVERIFIED_ENV_TOKEN === "1") {
      console.warn(`[p1-smoke-device-ready] WARN unverified env token accepted by GEOX_ACCEPTANCE_ALLOW_UNVERIFIED_ENV_TOKEN=1 label=${label}`);
      return;
    }
    throw new Error(`UNVERIFIED_ENV_TOKEN:${label} token was provided by env but was not found in known acceptance token files`);
  }
  if (row.revoked || !tokenMatchesTenant(row) || !tokenHasAnyScope(row, requiredAnyScopes)) {
    throw new Error(`MISSING_TOKEN_SCOPE:${label} requiredAny=${required} actual=${formatActualScopes(row)}`);
  }
}

function resolveAccessToken(requiredAnyScopes = [], opts = {}) {
  const label = String(opts.label ?? "accessToken");
  const envNames = Array.isArray(opts.envNames) && opts.envNames.length > 0
    ? opts.envNames
    : ["GEOX_TOKEN", "GEOX_AO_ACT_TOKEN"];
  const candidates = loadTokenCandidates();

  for (const envName of envNames) {
    const value = normalizeScope(process.env[envName] ?? "");
    if (!value) continue;
    verifyEnvTokenScope(label, value, requiredAnyScopes, candidates);
    return value;
  }

  const preferredRoles = ["admin", "operator", "executor", "auditor", "client"];
  for (const role of preferredRoles) {
    const candidate = candidates.find((row) =>
      row.role === role &&
      !row.revoked &&
      tokenMatchesTenant(row) &&
      tokenHasAnyScope(row, requiredAnyScopes)
    );
    if (candidate) return candidate.token;
  }
  const anyCandidate = candidates.find((row) =>
    !row.revoked &&
    tokenMatchesTenant(row) &&
    tokenHasAnyScope(row, requiredAnyScopes)
  );
  if (anyCandidate) return anyCandidate.token;
  throw new Error(`MISSING_TOKEN_WITH_SCOPE:${formatRequired(requiredAnyScopes)} (fallback checked: ${TOKEN_CANDIDATE_FILES.join(", ")})`);
}

function parseJsonOrThrow(raw, context) {
  try {
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    throw new Error(`${context} returned non-json body=${raw}`);
  }
}

async function waitForServerHealth(maxWaitMs = 15_000) {
  const started = Date.now();
  while (Date.now() - started < maxWaitMs) {
    try {
      const res = await fetch(`${BASE_URL}/api/health`, { method: "GET", headers: { accept: "application/json" } });
      if (res.ok) return true;
    } catch {}
    await sleep(500);
  }
  return false;
}

async function fetchJson(pathname, { method = "GET", token, body } = {}) {
  const res = await fetch(`${BASE_URL}${pathname}`, {
    method,
    headers: {
      accept: "application/json",
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const raw = await res.text();
  const json = parseJsonOrThrow(raw, pathname);
  return { status: res.status, ok: res.ok, json, raw };
}

async function getDeviceStatus(token, maxWaitMs = 5_000) {
  const started = Date.now();
  let lastStatus = null;
  let lastBody = null;
  while (Date.now() - started < maxWaitMs) {
    const result = await fetchJson(`/api/v1/devices/${encodeURIComponent(DEVICE_ID)}/status`, { token });
    lastStatus = result.status;
    lastBody = result.json;
    if (result.ok && result.json?.ok === true) return { statusCode: result.status, body: result.json };
    await sleep(250);
  }
  throw new Error(`[p1-smoke-device-ready] status read failed status=${lastStatus} body=${JSON.stringify(lastBody)}`);
}

function strictEquals(a, b) {
  return String(a ?? "").trim() === String(b ?? "").trim();
}

function isNullishOrEmpty(value) {
  return value === null || value === undefined || String(value).trim() === "";
}

function isStaleSmokeDeviceFailSafe(item) {
  if (!item || typeof item !== "object") return false;
  const status = String(item.status ?? "").trim().toUpperCase();
  const triggerType = String(item.trigger_type ?? "").trim().toUpperCase();
  const reasonCode = String(item.reason_code ?? "").trim().toUpperCase();
  if (status !== "OPEN") return false;
  if (!strictEquals(item.tenant_id, tenant.tenant_id)) return false;
  if (!strictEquals(item.project_id, tenant.project_id)) return false;
  if (!strictEquals(item.group_id, tenant.group_id)) return false;
  if (!strictEquals(item.device_id, DEVICE_ID)) return false;
  if (!STALE_SMOKE_DEVICE_TRIGGER_TYPES.has(triggerType)) return false;
  if (!STALE_SMOKE_DEVICE_REASON_CODES.has(reasonCode)) return false;
  if (!strictEquals(item.blocked_action, "action.task.create")) return false;
  if (!strictEquals(item.source, "api/v1/actions/task")) return false;
  if (!isNullishOrEmpty(item.act_task_id)) return false;
  if (!item.fail_safe_event_id) return false;
  return true;
}

async function resolveStaleSmokeDeviceFailSafes(token) {
  const query = new URLSearchParams({
    tenant_id: tenant.tenant_id,
    project_id: tenant.project_id,
    group_id: tenant.group_id,
  });
  const list = await fetchJson(`/api/v1/fail-safe/events?${query.toString()}`, { token });
  if (!list.ok || list.json?.ok !== true || !Array.isArray(list.json?.items)) {
    throw new Error(`[p1-smoke-device-ready] fail-safe scan failed status=${list.status} body=${list.raw}`);
  }

  const openItems = list.json.items.filter((item) => String(item?.status ?? "").trim().toUpperCase() === "OPEN");
  const matched = openItems.filter((item) => isStaleSmokeDeviceFailSafe(item));
  console.log("[p1-smoke-device-ready] stale fail-safe scan", {
    total_open: openItems.length,
    matched: matched.length,
  });

  if (matched.length === 0) {
    console.log("[p1-smoke-device-ready] no stale smoke device fail-safe found");
    return [];
  }

  const resolved = [];
  for (const item of matched) {
    const eventId = String(item.fail_safe_event_id);
    const result = await fetchJson(`/api/v1/fail-safe/events/${encodeURIComponent(eventId)}/resolve`, {
      method: "POST",
      token,
      body: {
        tenant_id: tenant.tenant_id,
        project_id: tenant.project_id,
        group_id: tenant.group_id,
        resolution_note: "resolved by p1 smoke preflight after device status verified ONLINE",
      },
    });
    if (!result.ok || result.json?.ok !== true) {
      throw new Error(`[p1-smoke-device-ready] fail-safe resolve failed status=${result.status} body=${result.raw}`);
    }
    resolved.push(eventId);
    console.log("[p1-smoke-device-ready] resolved stale smoke fail-safe", {
      fail_safe_event_id: eventId,
      reason_code: item.reason_code,
    });
  }
  return resolved;
}

async function main() {
  console.log("[p1-smoke-device-ready] base", { base_url: BASE_URL, device_id: DEVICE_ID, tenant });
  const healthy = await waitForServerHealth();
  if (!healthy) {
    console.warn("[p1-smoke-device-ready] SKIP: server unavailable; original P1 smoke will apply its own prerequisite handling");
    return;
  }

  const statusToken = resolveAccessToken(
    ["action.read", "ao_act.index.read", "security.admin"],
    { label: "statusToken", envNames: ["GEOX_STATUS_TOKEN", "GEOX_TOKEN", "GEOX_AO_ACT_TOKEN"] }
  );
  const adminToken = resolveAccessToken(
    ["security.admin", "action.task.dispatch"],
    { label: "adminToken", envNames: ["GEOX_ADMIN_TOKEN", "GEOX_TOKEN", "GEOX_AO_ACT_TOKEN"] }
  );
  const heartbeatRes = await fetchJson(`/api/v1/devices/${encodeURIComponent(DEVICE_ID)}/heartbeat`, {
    method: "POST",
    token: statusToken,
    body: {
      ...tenant,
      device_id: DEVICE_ID,
      status: "ONLINE",
      ready: true,
      source: "p1_smoke_preflight",
      ts_ms: Date.now(),
      meta: { smoke: "p1", purpose: "satisfy_fail_safe_device_precondition" },
    },
  });
  if (!heartbeatRes.ok) {
    throw new Error(`[p1-smoke-device-ready] heartbeat failed status=${heartbeatRes.status} body=${heartbeatRes.raw}`);
  }

  const { body: statusBody } = await getDeviceStatus(statusToken);
  if (String(statusBody?.status ?? "").toUpperCase() !== "ONLINE" || statusBody?.online !== true) {
    throw new Error(`[p1-smoke-device-ready] device not ready after heartbeat: ${JSON.stringify(statusBody)}`);
  }
  if (!statusBody?.last_heartbeat_ts_ms) {
    throw new Error(`[p1-smoke-device-ready] device status missing last_heartbeat_ts_ms: ${JSON.stringify(statusBody)}`);
  }

  const resolvedFailSafeIds = await resolveStaleSmokeDeviceFailSafes(adminToken);

  console.log("[p1-smoke-device-ready] PASS", {
    device_id: DEVICE_ID,
    heartbeat_status: heartbeatRes.status,
    status: statusBody.status,
    online: statusBody.online,
    last_heartbeat_ts_ms: statusBody.last_heartbeat_ts_ms,
    resolved_fail_safe_count: resolvedFailSafeIds.length,
  });
}

main().catch((err) => {
  console.error("[p1-smoke-device-ready] failed", err);
  process.exitCode = 1;
});
