#!/usr/bin/env node

const baseUrl = process.env.FLIGHT_TABLE_BASE_URL ?? "http://127.0.0.1:3001";
const token = process.env.FLIGHT_TABLE_AUTH_TOKEN ?? process.env.GEOX_AO_ACT_TOKEN ?? "";
const tenantId = process.env.FLIGHT_TABLE_TENANT_ID ?? "tenantA";
const projectId = process.env.FLIGHT_TABLE_PROJECT_ID ?? "projectA";
const groupId = process.env.FLIGHT_TABLE_GROUP_ID ?? "groupA";
const runId = process.env.FLIGHT_TABLE_RUN_ID ?? `ft_success_smoke_${Date.now()}`;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function headers() {
  assert(token, "FLIGHT_TABLE_AUTH_TOKEN or GEOX_AO_ACT_TOKEN is required for enabled flight-table smoke");
  return {
    accept: "application/json",
    "content-type": "application/json",
    authorization: `Bearer ${token}`,
  };
}

async function requestJson(method, pathname, body) {
  const res = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: headers(),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch { json = null; }
  return { status: res.status, json };
}

function assertEnabled(resp) {
  assert(resp.status !== 503 || resp.json?.error !== "FLIGHT_TABLE_DISABLED", "server must be started with ENABLE_FLIGHT_TABLE_API=true for success smoke");
  assert(resp.status !== 401, "flight-table smoke token is missing or invalid");
  assert(resp.status !== 403, "flight-table smoke token lacks security.admin scope");
}

function assertNoSecret(value, path = "response") {
  if (value == null) return;
  if (typeof value === "string") {
    assert(!/(raw secret|credential secret|private key)/i.test(value), `${path} contains a raw secret-like string`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoSecret(item, `${path}[${index}]`));
    return;
  }
  if (typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (/secret|token|password|credential_payload/i.test(key)) {
        assert(key === "masked_secret", `${path}.${key} exposes a forbidden sensitive key`);
        assert(child === "****", `${path}.${key} must be masked as ****`);
      }
      assertNoSecret(child, `${path}.${key}`);
    }
  }
}

async function main() {
  const create = await requestJson("POST", "/api/v1/dev/flight-table/runs", {
    run_id: runId,
    tenant_id: tenantId,
    project_id: projectId,
    group_id: groupId,
    lane: "success",
  });
  assertEnabled(create);
  assert(create.status === 200 || create.status === 409, `create run expected 200 or 409, got ${create.status}`);

  const read = await requestJson("GET", `/api/v1/dev/flight-table/runs/${encodeURIComponent(runId)}`);
  assertEnabled(read);
  assert(read.status === 200, `read run expected 200, got ${read.status}`);
  assert(read.json?.run?.run_id === runId, "read run must return requested run_id");
  assert(read.json?.run?.lane === "success", "success smoke run must use success lane");
  assertNoSecret(read.json);

  const manifest = await requestJson("GET", `/api/v1/dev/flight-table/runs/${encodeURIComponent(runId)}/manifest`);
  assert(manifest.status === 200, `manifest expected 200, got ${manifest.status}`);
  assert(manifest.json?.manifest, "manifest response must include manifest");
  assertNoSecret(manifest.json);

  const start = await requestJson("POST", `/api/v1/dev/flight-table/runs/${encodeURIComponent(runId)}/start`, {
    lane: "success",
    evidence_policy: "complete",
    skill_policy: "require_all_bound",
    weather_policy: "observe_only",
  });
  assert(start.status === 200, `start expected 200, got ${start.status}`);
  assert(start.json?.run?.status === "RUNNING" || start.json?.run?.status === "READY" || start.json?.run?.status === "PASS", "start must return a valid run status");

  const verify = await requestJson("POST", `/api/v1/dev/flight-table/runs/${encodeURIComponent(runId)}/verify`, {});
  assert(verify.status === 200, `verify expected 200, got ${verify.status}`);
  assert(verify.json?.verify_report || verify.json?.run?.verify_summary, "verify response must include verify_report or verify_summary");
  assertNoSecret(verify.json);

  const snapshots = await requestJson("GET", `/api/v1/dev/flight-table/runs/${encodeURIComponent(runId)}/api-snapshots`);
  assert(snapshots.status === 200, `api-snapshots expected 200, got ${snapshots.status}`);
  assert(Array.isArray(snapshots.json?.snapshots), "api-snapshots must return snapshots array");

  const clean = await requestJson("POST", `/api/v1/dev/flight-table/runs/${encodeURIComponent(runId)}/clean`, {});
  assert(clean.status === 200, `clean expected 200, got ${clean.status}`);
  assert(clean.json?.run?.status === "CLEANED", "clean must set run status to CLEANED");

  console.log("flight table success smoke passed", { baseUrl, runId });
}

main().catch((error) => {
  console.error("flight table success smoke failed");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
