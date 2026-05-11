#!/usr/bin/env node

const baseUrl = process.env.FLIGHT_TABLE_BASE_URL ?? "http://127.0.0.1:3001";
const token = process.env.FLIGHT_TABLE_AUTH_TOKEN ?? process.env.GEOX_AO_ACT_TOKEN ?? "";
const tenantId = process.env.FLIGHT_TABLE_TENANT_ID ?? "tenantA";
const projectId = process.env.FLIGHT_TABLE_PROJECT_ID ?? "projectA";
const groupId = process.env.FLIGHT_TABLE_GROUP_ID ?? "groupA";
const lanes = ["success", "evidence_insufficient", "weather_interference", "skill_failure", "all"];
const stamp = Date.now();

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
  assert(resp.status !== 503 || resp.json?.error !== "FLIGHT_TABLE_DISABLED", "server must be started with ENABLE_FLIGHT_TABLE_API=true for all-lanes smoke");
  assert(resp.status !== 401, "flight-table smoke token is missing or invalid");
  assert(resp.status !== 403, "flight-table smoke token lacks security.admin scope");
}

async function smokeLane(lane) {
  const runId = `ft_${lane}_smoke_${stamp}`.replace(/[^A-Za-z0-9_.:-]/g, "_");
  const create = await requestJson("POST", "/api/v1/dev/flight-table/runs", {
    run_id: runId,
    tenant_id: tenantId,
    project_id: projectId,
    group_id: groupId,
    lane,
  });
  assertEnabled(create);
  assert(create.status === 200 || create.status === 409, `${lane}: create expected 200 or 409, got ${create.status}`);

  const start = await requestJson("POST", `/api/v1/dev/flight-table/runs/${encodeURIComponent(runId)}/start`, {
    lane,
    field_id: `ft_${lane}_field`,
    device_set: `ft_${lane}_device_set`,
    skill_policy: lane === "skill_failure" || lane === "all" ? "failure:missing_sensing_skill" : "require_all_bound",
    weather_policy: lane === "weather_interference" || lane === "all" ? "simulate_weather_interference" : "observe_only",
    evidence_policy: lane === "evidence_insufficient" || lane === "all" ? "insufficient" : "complete",
  });
  assertEnabled(start);
  assert(start.status === 200, `${lane}: start expected 200, got ${start.status}`);
  assert(start.json?.run?.lane === lane, `${lane}: returned run must keep requested lane`);

  const verify = await requestJson("POST", `/api/v1/dev/flight-table/runs/${encodeURIComponent(runId)}/verify`, {});
  assert(verify.status === 200, `${lane}: verify expected 200, got ${verify.status}`);
  assert(verify.json?.run?.steps?.length >= 1, `${lane}: verify must return run steps`);

  const clean = await requestJson("POST", `/api/v1/dev/flight-table/runs/${encodeURIComponent(runId)}/clean`, {});
  assert(clean.status === 200, `${lane}: clean expected 200, got ${clean.status}`);
  assert(clean.json?.run?.status === "CLEANED", `${lane}: clean must set status=CLEANED`);
  return { lane, runId, status: clean.json?.run?.status };
}

async function main() {
  const results = [];
  for (const lane of lanes) {
    results.push(await smokeLane(lane));
  }
  console.log("flight table all-lanes smoke passed", { baseUrl, results });
}

main().catch((error) => {
  console.error("flight table all-lanes smoke failed");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
