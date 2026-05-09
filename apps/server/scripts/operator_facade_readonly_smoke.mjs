#!/usr/bin/env node

const baseUrl = process.env.OPERATOR_FACADE_BASE_URL ?? "http://127.0.0.1:3001";

async function getJson(pathname) {
  const res = await fetch(`${baseUrl}${pathname}`, {
    headers: { accept: "application/json" },
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, json };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function deepHasSensitive(value) {
  if (value == null) return false;
  if (typeof value === "string") return /(token|secret|access[_-]?key)/i.test(value);
  if (Array.isArray(value)) return value.some(deepHasSensitive);
  if (typeof value === "object") return Object.entries(value).some(([k, v]) => /(token|secret|access[_-]?key)/i.test(k) || deepHasSensitive(v));
  return false;
}

function hasMeasuredWithoutBaseline(items) {
  return (items ?? []).some((x) => x && x.baseline_present === false && String(x.value_kind ?? "").toUpperCase() === "MEASURED");
}

async function main() {
  const devicesAlerts = await getJson("/api/v1/operator/devices-alerts");
  const fieldMemory = await getJson("/api/v1/operator/field-memory");
  const roiLedger = await getJson("/api/v1/operator/roi-ledger");

  for (const [name, resp] of [["devices-alerts", devicesAlerts], ["field-memory", fieldMemory], ["roi-ledger", roiLedger]]) {
    assert(resp.status !== 404, `${name} must not return 404`);
    assert(resp.status !== 500, `${name} must not return 500`);
    assert(resp.status === 200 || resp.status === 403, `${name} must return 200 or 403`);
  }

  if (devicesAlerts.status === 200) {
    assert(!deepHasSensitive(devicesAlerts.json), "devices-alerts payload contains token/secret/access_key");
  }

  if (roiLedger.status === 200) {
    assert(!hasMeasuredWithoutBaseline(roiLedger.json?.items), "roi-ledger has MEASURED item without baseline_present");
  }

  if (fieldMemory.status === 403) {
    assert(fieldMemory.json?.error === "FORBIDDEN", "field-memory 403 must return error=FORBIDDEN");
    assert(typeof fieldMemory.json?.message === "string" && fieldMemory.json.message.length > 0, "field-memory 403 must include message");
  }

  console.log("operator facade readonly smoke passed", {
    baseUrl,
    statuses: {
      devices_alerts: devicesAlerts.status,
      field_memory: fieldMemory.status,
      roi_ledger: roiLedger.status,
    },
  });
}

main().catch((error) => {
  console.error("operator facade readonly smoke failed");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
