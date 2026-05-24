const BASE_URL = process.env.GEOX_BASE_URL ?? "http://127.0.0.1:3001";
const DEVICE_ID = String(process.env.GEOX_DEVICE_ID ?? "dev_smoke_01").trim() || "dev_smoke_01";
const tenant = {
  tenant_id: String(process.env.GEOX_TENANT_ID ?? "tenantA").trim() || "tenantA",
  project_id: String(process.env.GEOX_PROJECT_ID ?? "projectA").trim() || "projectA",
  group_id: String(process.env.GEOX_GROUP_ID ?? "groupA").trim() || "groupA",
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

async function main() {
  console.log("[p1-smoke-device-ready] base", { base_url: BASE_URL, device_id: DEVICE_ID, tenant });
  const healthy = await waitForServerHealth();
  if (!healthy) {
    console.warn("[p1-smoke-device-ready] SKIP: server unavailable; original P1 smoke will apply its own prerequisite handling");
    return;
  }

  const res = await fetch(`${BASE_URL}/api/v1/devices/${encodeURIComponent(DEVICE_ID)}/heartbeat`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
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
  if (!res.ok) {
    throw new Error(`[p1-smoke-device-ready] heartbeat failed status=${res.status} body=${text}`);
  }
  console.log("[p1-smoke-device-ready] PASS", { device_id: DEVICE_ID, heartbeat_status: res.status });
}

main().catch((err) => {
  console.error("[p1-smoke-device-ready] failed", err);
  process.exitCode = 1;
});
