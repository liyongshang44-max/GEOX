#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(process.cwd(), "../..");
const baseUrl = process.env.FLIGHT_TABLE_BASE_URL ?? "http://127.0.0.1:3001";
const skipHttp = String(process.env.FLIGHT_TABLE_SKIP_HTTP ?? "").toLowerCase() === "true";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), "utf8");
}

async function getJson(pathname) {
  const res = await fetch(`${baseUrl}${pathname}`, { headers: { accept: "application/json" } });
  let json = null;
  try { json = await res.json(); } catch { json = null; }
  return { status: res.status, json };
}

function staticBoundaryChecks() {
  const route = read("apps/server/src/routes/dev/flight_table_v1.ts");
  assert(route.includes("ENABLE_FLIGHT_TABLE_API"), "flight-table route must be guarded by ENABLE_FLIGHT_TABLE_API");
  assert(route.includes("FLIGHT_TABLE_DISABLED"), "flight-table route must return FLIGHT_TABLE_DISABLED when disabled");
  assert(route.includes("security.admin"), "flight-table route must require security.admin scope");
  assert(route.includes("/api/v1/dev/flight-table/formal-scenarios"), "flight-table route must expose formal-scenarios endpoint");
  assert(route.includes("listFormalScenarioLaneDefinitionsV1"), "formal-scenarios endpoint must read scenario definitions from formal_scenario_lanes_v1");

  const scenarioLanes = read("apps/server/src/services/scenarios/formal_scenario_lanes_v1.ts");
  assert(scenarioLanes.includes('"FORMAL_IRRIGATION"'), "formal_scenario_lanes_v1 must include FORMAL_IRRIGATION");
  assert(scenarioLanes.includes('"DEVICE_ANOMALY"'), "formal_scenario_lanes_v1 must include DEVICE_ANOMALY");
  assert(scenarioLanes.includes('"FORMAL_VARIABLE_OPERATION"'), "formal_scenario_lanes_v1 must include FORMAL_VARIABLE_OPERATION");

  const manifest = read("apps/server/src/services/flight_table/flight_table_manifest_v1.ts");
  assert(manifest.includes("masked_secret"), "flight-table manifest service must expose masked credential refs");
  assert(manifest.includes('"****"'), "flight-table manifest service must mask credential refs as ****");

  const devtools = read("apps/server/src/modules/devtools/registerDevtoolsModule.ts");
  assert(devtools.includes("registerFlightTableV1Routes"), "flight-table base route must be registered through devtools module");
  assert(devtools.includes("registerFlightTableRunControlRoutesV1"), "flight-table run control route must be registered");
}

async function disabledHttpCheck() {
  const resp = await getJson("/api/v1/dev/flight-table/runs");
  assert(resp.status === 503, `default flight-table API must return 503 when disabled; got ${resp.status}. If this is 404, the running server does not include the flight-table routes yet.`);
  assert(resp.json?.ok === false, "disabled response must be ok=false");
  assert(resp.json?.error === "FLIGHT_TABLE_DISABLED", "disabled response must return error=FLIGHT_TABLE_DISABLED");
}

async function main() {
  staticBoundaryChecks();
  if (!skipHttp) await disabledHttpCheck();
  console.log("flight table default smoke passed", {
    baseUrl,
    http: skipHttp ? "skipped" : "disabled gate verified",
  });
}

main().catch((error) => {
  console.error("flight table default smoke failed");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
