import {
  W5_LEGACY_RUNTIME_CONTAINMENT_ERROR,
  W5_LEGACY_RUNTIME_CONTAINMENT_RULES_V1,
} from "../../apps/server/src/runtime/legacy_runtime_containment_v1.js";

const BASE_URL = String(process.env.BASE_URL ?? "http://127.0.0.1:3001").replace(/\/+$/, "");

function expect(condition: unknown, message: string, detail?: unknown): asserts condition {
  if (!condition) throw new Error(message + (detail === undefined ? "" : `: ${JSON.stringify(detail)}`));
}

function concretePath(template: string): string {
  return template.replace(":groupId", "group_w5_commercial").replace(":sensorId", "sensor_w5_commercial");
}

async function request(method: string, pathname: string): Promise<{status:number; json:any; body:string}> {
  const init: RequestInit = { method, headers: { accept: "application/json" } };
  if (method === "POST") {
    init.headers = { ...init.headers, "content-type": "application/json" };
    init.body = JSON.stringify({ sentinel: "w5_commercial_containment_probe" });
  }
  const response = await fetch(`${BASE_URL}${pathname}`, init);
  const body = await response.text();
  let json: any = {};
  try { json = body ? JSON.parse(body) : {}; } catch { json = { raw: body }; }
  return { status: response.status, json, body };
}

async function main(): Promise<void> {
  expect(W5_LEGACY_RUNTIME_CONTAINMENT_RULES_V1.length === 22, "W5 Commercial rule count drift");
  const results: Array<Record<string, unknown>> = [];
  for (const rule of W5_LEGACY_RUNTIME_CONTAINMENT_RULES_V1) {
    const response = await request(rule.method, concretePath(rule.route_template));
    expect(response.status === 410, "Commercial legacy mutation surface remained reachable", { rule, response });
    expect(response.json?.error === W5_LEGACY_RUNTIME_CONTAINMENT_ERROR, "Commercial containment error drift", { rule, response });
    expect(response.json?.surface_id === rule.surface_id, "Commercial containment surface identity drift", { rule, response });
    results.push({ surface_id: rule.surface_id, method: rule.method, route: rule.route_template, status: response.status });
  }

  const bsec030 = await request("POST", "/api/canopy/upload");
  expect(
    bsec030.status === 403 && bsec030.json?.error === "LEGACY_CANOPY_UPLOAD_COMMERCIAL_AUTHORITY_UNAVAILABLE",
    "BSEC-030 prior Commercial containment baseline drift",
    bsec030,
  );

  const readRoute = await request("GET", "/api/canopy/list");
  expect(readRoute.status !== 410, "W5 incorrectly contained a legacy read route", readRoute);

  console.log(JSON.stringify({
    result: "PASS",
    workstream: "W5_LEGACY_RUNTIME_CONTAINMENT",
    strict_runtime_probe_count: results.length,
    contained: results,
    bsec_030_baseline: { status: bsec030.status, error: bsec030.json?.error },
    legacy_read_not_contained: { route: "/api/canopy/list", status: readRoute.status },
    new_authority_granted: false,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
