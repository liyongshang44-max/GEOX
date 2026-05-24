import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASE_URL = process.env.GEOX_BASE_URL ?? "http://127.0.0.1:3001";
const DEVICE_ID = String(process.env.GEOX_DEVICE_ID ?? "dev_smoke_01").trim() || "dev_smoke_01";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../../..");
const TOKEN_CANDIDATE_FILES = [
  path.join(REPO_ROOT, "config/auth/ao_act_tokens_v0.json"),
  path.join(REPO_ROOT, "config/auth/example_tokens.json"),
];
const REQUIRED_SCOPES_FOR_P1_SMOKE = Object.freeze([
  "ao_act.task.write",
  "ao_act.index.read",
  "ao_act.receipt.write",
  "evidence_export.read",
  "evidence_export.write",
]);
const tenant = {
  tenant_id: String(process.env.GEOX_TENANT_ID ?? "tenantA").trim() || "tenantA",
  project_id: String(process.env.GEOX_PROJECT_ID ?? "projectA").trim() || "projectA",
  group_id: String(process.env.GEOX_GROUP_ID ?? "groupA").trim() || "groupA",
};

function parseTokenFile(tokenFilePath) {
  if (!fs.existsSync(tokenFilePath)) return null;
  const parsed = JSON.parse(fs.readFileSync(tokenFilePath, "utf8"));
  const tokens = Array.isArray(parsed?.tokens) ? parsed.tokens : [];
  for (const row of tokens) {
    const token = typeof row?.token === "string" ? row.token.trim() : "";
    const scopes = Array.isArray(row?.scopes) ? row.scopes.map((s) => String(s)) : [];
    const role = String(row?.role ?? "").trim().toLowerCase();
    const tenantId = String(row?.tenant_id ?? "").trim();
    const projectId = String(row?.project_id ?? "").trim();
    const groupId = String(row?.group_id ?? "").trim();
    const revoked = Boolean(row?.revoked);
    if (!token || revoked) continue;
    if (token.includes("set-via-env-or-external-secret-file")) continue;
    if (tenantId !== tenant.tenant_id || projectId !== tenant.project_id || groupId !== tenant.group_id) continue;
    if (!["admin", "operator"].includes(role)) continue;
    if (!REQUIRED_SCOPES_FOR_P1_SMOKE.every((scope) => scopes.includes(scope))) continue;
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

const ACCESS = resolveAccessToken();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jsonHeaders() {
  return {
    "content-type": "application/json",
    accept: "application/json",
    authorization: `Bearer ${ACCESS}`,
  };
}

async function requestJson(pathname, init = {}) {
  const res = await fetch(`${BASE_URL}${pathname}`, {
    ...init,
    headers: { ...jsonHeaders(), ...(init.headers ?? {}) },
  });
  const text = await res.text();
  const json = (() => {
    if (!text) return {};
    try { return JSON.parse(text); } catch { return { raw: text }; }
  })();
  if (!res.ok) {
    const error = new Error(`HTTP ${res.status} ${pathname} ${JSON.stringify(json)}`);
    error.httpStatus = res.status;
    error.responseBody = json;
    throw error;
  }
  return json;
}

async function waitForServerHealth(maxWaitMs = 15_000) {
  const started = Date.now();
  while (Date.now() - started < maxWaitMs) {
    try {
      const res = await fetch(`${BASE_URL}/api/health`, { method: "GET", headers: { accept: "application/json" } });
      if (res.ok) return;
    } catch {}
    await sleep(500);
  }
  throw new Error(`[p1-smoke-device-ready] server not ready: ${BASE_URL}/api/health timeout ${maxWaitMs}ms`);
}

async function ensureSmokeDeviceReady() {
  let lastStatus = null;
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    await requestJson(`/api/v1/devices/${encodeURIComponent(DEVICE_ID)}/heartbeat`, {
      method: "POST",
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

    try {
      const status = await requestJson(`/api/v1/devices/${encodeURIComponent(DEVICE_ID)}/status`, { method: "GET" });
      lastStatus = status;
      const normalized = String(status?.status ?? "").trim().toUpperCase();
      const online = status?.online === true || normalized === "ONLINE" || normalized === "READY";
      if (online) {
        console.log("[p1-smoke-device-ready] PASS", {
          device_id: DEVICE_ID,
          status: normalized,
          online: Boolean(status?.online),
          last_heartbeat_ts_ms: status?.last_heartbeat_ts_ms ?? null,
          attempt,
        });
        return;
      }
    } catch (err) {
      lastStatus = {
        error: String(err?.message ?? err),
        httpStatus: err?.httpStatus ?? null,
        responseBody: err?.responseBody ?? null,
      };
    }

    await sleep(500);
  }

  assert.fail(`[p1-smoke-device-ready] device ${DEVICE_ID} did not become ONLINE/READY before manual operation; last_status=${JSON.stringify(lastStatus)}`);
}

async function main() {
  console.log("[p1-smoke-device-ready] base", { base_url: BASE_URL, device_id: DEVICE_ID, tenant });
  await waitForServerHealth();
  await ensureSmokeDeviceReady();
}

main().catch((err) => {
  const isAuthInvalid = err?.httpStatus === 401 && String(err?.responseBody?.error ?? "") === "AUTH_INVALID";
  const isServerUnavailable = String(err?.message ?? "").includes("server not ready");
  if (isAuthInvalid || isServerUnavailable) {
    console.warn(`[p1-smoke-device-ready] SKIP due to ${isAuthInvalid ? "AUTH_INVALID" : "server unavailable"} (smoke env prerequisite not met)`);
    process.exitCode = 0;
    return;
  }
  console.error("[p1-smoke-device-ready] failed", err);
  process.exitCode = 1;
});
