const BASE_URL = process.env.GEOX_BASE_URL ?? "http://127.0.0.1:3001";
const DEVICE_ID = String(process.env.GEOX_DEVICE_ID ?? "dev_smoke_01").trim() || "dev_smoke_01";
const ACCESS = String(process.env.GEOX_TOKEN ?? process.env.GEOX_AO_ACT_TOKEN ?? "").trim();
const tenant = {
  tenant_id: String(process.env.GEOX_TENANT_ID ?? "tenantA").trim() || "tenantA",
  project_id: String(process.env.GEOX_PROJECT_ID ?? "projectA").trim() || "projectA",
  group_id: String(process.env.GEOX_GROUP_ID ?? "groupA").trim() || "groupA",
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function headers() {
  return {
    "content-type": "application/json",
    accept: "application/json",
    ...(ACCESS ? { authorization: `Bearer ${ACCESS}` } : {}),
  };
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

async function postHeartbeat() {
  const res = await fetch(`${BASE_URL}/api/v1/devices/${encodeURIComponent(DEVICE_ID)}/heartbeat`, {
    method: "POST",
    headers: headers(),
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
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
  return { status: res.status, ok: res.ok, json, text };
}

async function main() {
  console.log("[p1-smoke-device-ready] base", { base_url: BASE_URL, device_id: DEVICE_ID, tenant });
  const healthy = await waitForServerHealth();
  if (!healthy) {
    console.warn("[p1-smoke-device-ready] SKIP: server unavailable; original P1 smoke will apply its own prerequisite handling");
    return;
  }

  const result = await postHeartbeat();
  if (!result.ok) {
    const err = String(result.json?.error ?? "").toUpperCase();
    if (result.status === 401 && err === "AUTH_INVALID") {
      console.warn("[p1-smoke-device-ready] SKIP due to AUTH_INVALID; original P1 smoke will apply its own prerequisite handling");
      return;
    }
    throw new Error(`[p1-smoke-device-ready] heartbeat failed status=${result.status} body=${result.text}`);
  }

  console.log("[p1-smoke-device-ready] PASS", {
    device_id: DEVICE_ID,
    heartbeat_status: result.status,
    ts_ms: result.json?.ts_ms ?? null,
  });
}

main().catch((err) => {
  console.error("[p1-smoke-device-ready] failed", err);
  process.exitCode = 1;
});
