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
  assert(route.includes("masked_secret"), "flight-table manifest must use masked credential output");

  const devtools = read("apps/server/src/modules/devtools/registerDevtoolsModule.ts");
  assert(devtools.includes("registerFlightTableV1Routes"), "flight-table base route must be registered through devtools module");
  assert(devtools.includes("registerFlightTableRunControlRoutesV1"), "flight-table run control route must be registered");
}

async function disabledHttpCheck() {
  const resp = await getJson("/api/v1/dev/flight-table/runs");
  assert(resp.status === 503, `default flight-table API must return 503 when disabled; got ${resp.status}`);
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
