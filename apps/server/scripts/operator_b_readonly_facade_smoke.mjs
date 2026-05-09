#!/usr/bin/env node

const baseUrl = process.env.OPERATOR_FACADE_BASE_URL ?? "http://127.0.0.1:3001";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function deepHasSensitive(value) {
  if (value == null) return false;
  if (typeof value === "string") return /(token|secret|access[_-]?key|credential_payload|password|private\s*key)/i.test(value);
  if (Array.isArray(value)) return value.some(deepHasSensitive);
  if (typeof value === "object") {
    return Object.entries(value).some(([k, v]) => /(token|secret|access[_-]?key|credential_payload|password|private\s*key)/i.test(k) || deepHasSensitive(v));
  }
  return false;
}

function deepHasObjectObjectString(value) {
  if (value == null) return false;
  if (typeof value === "string") return value.includes("[object Object]");
  if (Array.isArray(value)) return value.some(deepHasObjectObjectString);
  if (typeof value === "object") return Object.values(value).some(deepHasObjectObjectString);
  return false;
}

async function getJson(pathname) {
  const res = await fetch(`${baseUrl}${pathname}`, { headers: { accept: "application/json" } });
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, json };
}

async function main() {
  const endpoints = [
    ["workbench", "/api/v1/operator/workbench"],
    ["dispatch", "/api/v1/operator/dispatch"],
    ["acceptance", "/api/v1/operator/acceptance"],
    ["evidence", "/api/v1/operator/evidence"],
    ["export-jobs", "/api/v1/evidence/export-jobs"],
  ];

  const results = await Promise.all(endpoints.map(async ([name, path]) => [name, await getJson(path)]));

  for (const [name, resp] of results) {
    assert(resp.status !== 404, `${name} must not return 404`);
    assert(resp.status !== 500, `${name} must not return 500`);
    assert([200, 401, 403].includes(resp.status), `${name} must return 200/401/403`);
    assert(!deepHasSensitive(resp.json), `${name} payload contains sensitive field/value`);
    assert(!deepHasObjectObjectString(resp.json), `${name} payload contains [object Object]`);
  }

  const byName = Object.fromEntries(results);

  if (byName.workbench.status === 200) assert(Array.isArray(byName.workbench.json?.items), "workbench.items must be array");
  if (byName.dispatch.status === 200) {
    assert(Array.isArray(byName.dispatch.json?.items), "dispatch.items must be array");
    assert(byName.dispatch.json?.writeReady === false, "dispatch.writeReady must be false");
  }
  if (byName.acceptance.status === 200) {
    assert(Array.isArray(byName.acceptance.json?.items), "acceptance.items must be array");
    assert(byName.acceptance.json?.writeReady === false, "acceptance.writeReady must be false");
  }
  if (byName.evidence.status === 200) {
    assert(Array.isArray(byName.evidence.json?.items), "evidence.items must be array");
    assert(byName.evidence.json?.exportReady === false, "evidence.exportReady must be false");
  }
  if (byName["export-jobs"].status === 200) assert(Array.isArray(byName["export-jobs"].json?.items), "export-jobs.items must be array");

  console.log("operator b readonly facade smoke passed", {
    baseUrl,
    statuses: Object.fromEntries(results.map(([name, resp]) => [name, resp.status])),
  });
}

main().catch((error) => {
  console.error("operator b readonly facade smoke failed");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
