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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseTokenFile(tokenFilePath) {
  if (!fs.existsSync(tokenFilePath)) return null;
  const parsed = JSON.parse(fs.readFileSync(tokenFilePath, "utf8"));
  const tokens = Array.isArray(parsed?.tokens) ? parsed.tokens : [];
  for (const row of tokens) {
    const token = typeof row?.token === "string" ? row.token.trim() : "";
    const scopes = Array.isArray(row?.scopes) ? row.scopes.map((s) => String(s)) : [];
    const role = String(row?.role ?? "").trim().toLowerCase();
    const rowTenant = String(row?.tenant_id ?? "").trim();
    const rowProject = String(row?.project_id ?? "").trim();
    const rowGroup = String(row?.group_id ?? "").trim();
    const revoked = Boolean(row?.revoked);
    if (!token || revoked) continue;
    if (token.includes("set-via-env-or-external-secret-file")) continue;
    if (rowTenant !== tenant.tenant_id || rowProject !== tenant.project_id || rowGroup !== tenant.group_id) continue;
    if (!["admin", "operator", "executor"].includes(role)) continue;
    if (!scopes.includes("action.read") && !scopes.includes("ao_act.index.read") && !scopes.includes("security.admin")) continue;
    return token;
  }
  return null;
}

function resolveAccessToken() {
  const fromEnv = String(process.env.GEOX_TOKEN ?? process.env.GEOX_AO_ACT_TOKEN ?? "").trim();
  if (fromEnv) return fromEnv;
  for (const tokenFilePath of TOKEN_CANDIDATE_FILES) {
    const candidate = parseTokenFile(tokenFilePath);
    if (candidate) return candidate;
  }
  throw new Error(`MISSING_ENV:GEOX_TOKEN (fallback checked: ${TOKEN_CANDIDATE_FILES.join(", ")})`);
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

async function getDeviceStatus(token, maxWaitMs = 5_000) {
  const started = Date.now();
  let lastStatus = null;
  let lastBody = null;
  while (Date.now() - started < maxWaitMs) {
    const res = await fetch(`${BASE_URL}/api/v1/devices/${encodeURIComponent(DEVICE_ID)}/status`, {
      method: "GET",
      headers: { accept: "application/json", authorization: `Bearer ${token}` },
    });
    const raw = await res.text();
    const body = parseJsonOrThrow(raw, "device status");
    lastStatus = res.status;
    lastBody = body;
    if (res.ok && body?.ok === true) return { statusCode: res.status, body };
    await sleep(250);
  }
  throw new Error(`[p1-smoke-device-ready] status read failed status=${lastStatus} body=${JSON.stringify(lastBody)}`);
}

async function main() {
  console.log("[p1-smoke-device-ready] base", { base_url: BASE_URL, device_id: DEVICE_ID, tenant });
  const healthy = await waitForServerHealth();
  if (!healthy) {
    console.warn("[p1-smoke-device-ready] SKIP: server unavailable; original P1 smoke will apply its own prerequisite handling");
    return;
  }

  const token = resolveAccessToken();
  const heartbeatRes = await fetch(`${BASE_URL}/api/v1/devices/${encodeURIComponent(DEVICE_ID)}/heartbeat`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      ...tenant,
      device_id: DEVICE_ID,
      status: "ONLINE",
      ready: true,
      source: "p1_smoke_preflight",
      ts_ms: Date.now(),
      meta: { smoke: "p1", purpose: "satisfy_fail_safe_device_precondition" },
    }),
  });
  const heartbeatText = await heartbeatRes.text();
  if (!heartbeatRes.ok) {
    throw new Error(`[p1-smoke-device-ready] heartbeat failed status=${heartbeatRes.status} body=${heartbeatText}`);
  }

  const { body: statusBody } = await getDeviceStatus(token);
  if (String(statusBody?.status ?? "").toUpperCase() !== "ONLINE" || statusBody?.online !== true) {
    throw new Error(`[p1-smoke-device-ready] device not ready after heartbeat: ${JSON.stringify(statusBody)}`);
  }
  if (!statusBody?.last_heartbeat_ts_ms) {
    throw new Error(`[p1-smoke-device-ready] device status missing last_heartbeat_ts_ms: ${JSON.stringify(statusBody)}`);
  }

  console.log("[p1-smoke-device-ready] PASS", {
    device_id: DEVICE_ID,
    heartbeat_status: heartbeatRes.status,
    status: statusBody.status,
    online: statusBody.online,
    last_heartbeat_ts_ms: statusBody.last_heartbeat_ts_ms,
  });
}

main().catch((err) => {
  console.error("[p1-smoke-device-ready] failed", err);
  process.exitCode = 1;
});
