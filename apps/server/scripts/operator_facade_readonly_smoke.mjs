#!/usr/bin/env node

const baseUrl = process.env.OPERATOR_FACADE_BASE_URL ?? "http://127.0.0.1:3001";

async function getJson(pathname, token) {
  const headers = { accept: "application/json" };
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${baseUrl}${pathname}`, {
    headers,
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
  if (typeof value === "string") return /(token|secret|access[_-]?key|credential_payload|password|private\s*key)/i.test(value);
  if (Array.isArray(value)) return value.some(deepHasSensitive);
  if (typeof value === "object") return Object.entries(value).some(([k, v]) => /(token|secret|access[_-]?key|credential_payload|password|private\s*key)/i.test(k) || deepHasSensitive(v));
  return false;
}

function hasMeasuredWithoutBaseline(items) {
  return (items ?? []).some((x) => x && x.baseline_present === false && String(x.value_kind ?? "").toUpperCase() === "MEASURED");
}

function deepHasObjectObjectString(value) {
  if (value == null) return false;
  if (typeof value === "string") return value.includes("[object Object]");
  if (Array.isArray(value)) return value.some(deepHasObjectObjectString);
  if (typeof value === "object") return Object.values(value).some(deepHasObjectObjectString);
  return false;
}

async function main() {
  const authToken = process.env.OPERATOR_FACADE_AUTH_TOKEN;
  const devicesAlerts = await getJson("/api/v1/operator/devices-alerts");
  const devicesAlertsLimit5 = await getJson("/api/v1/operator/devices-alerts?limit=5");
  const fieldMemory = await getJson("/api/v1/operator/field-memory");
  const roiLedger = await getJson("/api/v1/operator/roi-ledger");

  assert(devicesAlerts.status !== 404, "devices-alerts must not return 404");
  assert(devicesAlerts.status !== 500, "devices-alerts must not return 500");
  assert(devicesAlerts.status === 200, "devices-alerts must return 200");

  assert(roiLedger.status !== 404, "roi-ledger must not return 404");
  assert(roiLedger.status !== 500, "roi-ledger must not return 500");
  assert(roiLedger.status === 200, "roi-ledger must return 200");

  assert(fieldMemory.status !== 404, "field-memory must not return 404");
  assert(fieldMemory.status !== 500, "field-memory must not return 500");
  assert(fieldMemory.status === 200 || fieldMemory.status === 401 || fieldMemory.status === 403, "field-memory must return 200, 401, or 403");

  for (const [name, resp] of [["devices-alerts", devicesAlerts], ["devices-alerts(limit=5)", devicesAlertsLimit5], ["field-memory", fieldMemory], ["roi-ledger", roiLedger]]) {
    assert(!deepHasSensitive(resp.json), `${name} payload contains sensitive fields`);
    assert(!deepHasObjectObjectString(resp.json), `${name} payload contains [object Object]`);
  }

  if (devicesAlertsLimit5.status === 200) {
    assert(Array.isArray(devicesAlertsLimit5.json?.devices), "devices-alerts(limit=5) devices must be an array");
    assert(devicesAlertsLimit5.json.devices.length <= 5, "devices-alerts(limit=5) devices.length must be <= 5");
  }

  if (roiLedger.status === 200) {
    assert(!hasMeasuredWithoutBaseline(roiLedger.json?.items), "roi-ledger has MEASURED item without baseline_present");
    const unitOnlyPattern = /^[a-zA-Z%³㎡]+$/;
    for (const [idx, item] of (roiLedger.json?.items ?? []).entries()) {
      assert(
        item?.evidence_ref === null || typeof item?.evidence_ref === "string",
        `roi-ledger item[${idx}] evidence_ref must be string or null`,
      );
      if (item?.value_text) {
        assert(!unitOnlyPattern.test(String(item.value_text)), `roi-ledger item[${idx}] value_text must not be unit-only`);
      }
      if (String(item?.value_kind ?? "").toUpperCase() === "MEASURED") {
        assert(item?.baseline_present === true, `roi-ledger item[${idx}] MEASURED requires baseline_present=true`);
        assert(item?.actual_present === true, `roi-ledger item[${idx}] MEASURED requires actual_present=true`);
        assert(item?.evidence_present === true, `roi-ledger item[${idx}] MEASURED requires evidence_present=true`);
        const confidenceLevel = String(item?.confidence?.level ?? "").toUpperCase();
        assert(
          confidenceLevel === "HIGH" || confidenceLevel === "MEDIUM",
          `roi-ledger item[${idx}] MEASURED requires confidence.level in HIGH|MEDIUM`,
        );
      }
    }
  }

  if (fieldMemory.status === 401) {
    assert(
      fieldMemory.json?.error === "AUTH_MISSING" || fieldMemory.json?.ok === false,
      "field-memory 401 must return error=AUTH_MISSING or ok=false",
    );
  }

  if (fieldMemory.status === 403) {
    assert(fieldMemory.json?.error === "FORBIDDEN", "field-memory 403 must return error=FORBIDDEN");
    assert(typeof fieldMemory.json?.message === "string" && fieldMemory.json.message.length > 0, "field-memory 403 must include message");
  }

  let fieldMemoryWithToken = null;
  if (authToken) {
    fieldMemoryWithToken = await getJson("/api/v1/operator/field-memory", authToken);
    assert(fieldMemoryWithToken.status !== 404, "field-memory(with token) must not return 404");
    assert(fieldMemoryWithToken.status !== 500, "field-memory(with token) must not return 500");
    assert(fieldMemoryWithToken.status !== 401, "field-memory(with token) must not return 401");
    assert(fieldMemoryWithToken.status === 200 || fieldMemoryWithToken.status === 403, "field-memory(with token) must return 200 or 403");

    if (fieldMemoryWithToken.status === 403) {
      assert(fieldMemoryWithToken.json?.error === "FORBIDDEN", "field-memory(with token) 403 must return error=FORBIDDEN");
      assert(
        typeof fieldMemoryWithToken.json?.message === "string" && fieldMemoryWithToken.json.message.length > 0,
        "field-memory(with token) 403 must include message",
      );
    }
  }

  console.log("operator facade readonly smoke passed", {
    baseUrl,
    statuses: {
      devices_alerts: devicesAlerts.status,
      field_memory: fieldMemory.status,
      roi_ledger: roiLedger.status,
      field_memory_with_token: fieldMemoryWithToken?.status ?? null,
    },
  });
}

main().catch((error) => {
  console.error("operator facade readonly smoke failed");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
