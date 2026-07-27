import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import { Pool } from "pg";

import { registerMcftFieldTwinReadRoutesV1 } from "../../apps/server/src/routes/v1/mcft_field_twin_read_v1.js";

if (process.env.MCFT_CAP07_CAP04_FORECAST_RECONCILIATION_DESTRUCTIVE !== "1") {
  throw new Error("SET_MCFT_CAP07_CAP04_FORECAST_RECONCILIATION_DESTRUCTIVE_1");
}
const DATABASE_URL = String(process.env.DATABASE_URL ?? "").trim();
const ADMIN_DATABASE_URL = String(process.env.MCFT_CAP08_ADMIN_DATABASE_URL ?? "").trim();
if (!DATABASE_URL) throw new Error("DATABASE_URL_REQUIRED");
if (!ADMIN_DATABASE_URL) throw new Error("MCFT_CAP08_ADMIN_DATABASE_URL_REQUIRED");
const databaseName = new URL(DATABASE_URL).pathname.replace(/^\//, "").toLowerCase();
if (!/^(geox_)?mcft_cap08_.*(forecast|payload|reconciliation|compat)/.test(databaseName)) {
  throw new Error(`CAP07_CAP04_FORECAST_RECONCILIATION_FRESH_DATABASE_REQUIRED:${databaseName}`);
}
if (new URL(ADMIN_DATABASE_URL).pathname.replace(/^\//, "").toLowerCase() !== databaseName) {
  throw new Error("CAP07_CAP04_FORECAST_RECONCILIATION_ADMIN_DATABASE_MISMATCH");
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = path.join(ROOT, "acceptance-output/MCFT_CAP_07_CAP04_FORECAST_PAYLOAD_COMPATIBILITY_DB_RESULT.json");
const runner = new Pool({ connectionString: DATABASE_URL, max: 4 });
const admin = new Pool({ connectionString: ADMIN_DATABASE_URL, max: 2 });

function write(value: unknown): void {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`);
}

async function tableCardinalitySnapshot(pool: Pool): Promise<Array<{ table: string; count: number }>> {
  const tables = (await pool.query<{ tablename: string }>(
    "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
  )).rows.map((row) => row.tablename);
  const output: Array<{ table: string; count: number }> = [];
  for (const table of tables) {
    const safe = `"${table.replaceAll('"', '""')}"`;
    output.push({ table, count: Number((await pool.query(`SELECT count(*)::int AS n FROM ${safe}`)).rows[0].n) });
  }
  return output;
}

async function canonicalScopedTypeCount(type: string, scope: Record<string, string>): Promise<number> {
  return Number((await admin.query(
    `SELECT count(*)::int AS n
       FROM facts
      WHERE record_json->>'type'=$1
        AND record_json->'payload'->>'tenant_id'=$2
        AND record_json->'payload'->>'project_id'=$3
        AND record_json->'payload'->>'group_id'=$4
        AND record_json->'payload'->>'field_id'=$5
        AND record_json->'payload'->>'season_id'=$6
        AND record_json->'payload'->>'zone_id'=$7`,
    [type, scope.tenant_id, scope.project_id, scope.group_id, scope.field_id, scope.season_id, scope.zone_id],
  )).rows[0].n);
}

async function main(): Promise<void> {
  process.env.MCFT_CURSOR_SIGNING_KEYS_JSON = JSON.stringify({ reconciliation: "cap07-cap04-forecast-payload-reconciliation-signing-key-0001" });
  process.env.MCFT_CURSOR_PRIMARY_KEY_ID = "reconciliation";

  const scopeResult = await admin.query(
    `SELECT tenant_id,project_id,group_id,field_id,season_id,zone_id
       FROM twin_calibration_candidate_projection_v1
      ORDER BY logical_time DESC,candidate_object_id ASC`,
  );
  assert.equal(scopeResult.rows.length, 1, `CAP07_CAP04_SCOPE_CARDINALITY:${scopeResult.rows.length}`);
  const scope = Object.fromEntries(
    ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"].map((key) => [key, String(scopeResult.rows[0][key])]),
  ) as Record<string, string>;

  const forecastCount = await canonicalScopedTypeCount("twin_forecast_run_v1", scope);
  const scenarioCount = await canonicalScopedTypeCount("twin_scenario_set_v1", scope);
  const activationCount = await canonicalScopedTypeCount("twin_model_activation_v1", scope);
  assert.equal(activationCount, 0, `CAP07_CAP04_MODEL_ACTIVATION_FORBIDDEN:${activationCount}`);

  const terminal = await admin.query(
    `SELECT s.scenario_set_id,s.source_forecast_ref,s.source_forecast_hash,s.logical_time,
            f.fact_id AS forecast_fact_id,f.record_json->'payload' AS forecast_object
       FROM twin_scenario_set_projection_v1 AS s
       JOIN facts AS f
         ON f.record_json->>'type'='twin_forecast_run_v1'
        AND f.record_json->'payload'->>'object_id'=s.source_forecast_ref
      WHERE s.tenant_id=$1 AND s.project_id=$2 AND s.group_id=$3
        AND s.field_id=$4 AND s.season_id=$5 AND s.zone_id=$6
      ORDER BY s.logical_time DESC,s.scenario_set_id ASC
      LIMIT 1`,
    [scope.tenant_id, scope.project_id, scope.group_id, scope.field_id, scope.season_id, scope.zone_id],
  );
  assert.equal(terminal.rows.length, 1, "CAP07_CAP04_TERMINAL_SCENARIO_SOURCE_CARDINALITY");
  const forecastObject = terminal.rows[0].forecast_object as Record<string, unknown>;
  assert.equal(forecastObject.object_type, "twin_forecast_run_v1");
  assert.equal(String(forecastObject.object_id), String(terminal.rows[0].source_forecast_ref));
  assert.equal(String(forecastObject.determinism_hash), String(terminal.rows[0].source_forecast_hash));
  const forecastPayload = forecastObject.payload as Record<string, unknown>;
  assert.ok(forecastPayload && typeof forecastPayload === "object" && !Array.isArray(forecastPayload), "CAP07_CAP04_FORECAST_PAYLOAD_REQUIRED");
  assert.equal(forecastPayload.status, "COMPLETED", "CAP07_CAP04_TERMINAL_FORECAST_STATUS");
  assert.ok(Array.isArray(forecastPayload.points), "CAP07_CAP04_CANONICAL_POINTS_ARRAY_REQUIRED");
  assert.equal(forecastPayload.points.length, 72, "CAP07_CAP04_CANONICAL_POINTS_CARDINALITY");
  assert.equal(Object.hasOwn(forecastPayload, "point_count"), false, "CAP07_CAP04_NONCANONICAL_POINT_COUNT_FIELD_FORBIDDEN");

  const before = await tableCardinalitySnapshot(admin);
  const app = Fastify({ logger: false });
  registerMcftFieldTwinReadRoutesV1(app, runner, {
    authorizeScope: (_request, requested) => ({
      tenant_id: requested.tenant_id,
      project_id: requested.project_id,
      group_id: requested.group_id,
      allowed_field_ids: [requested.field_id],
      principal_id: "mcft-cap07-cap04-forecast-reconciliation",
    } as any),
  });
  await app.ready();
  const query = new URLSearchParams({
    tenant_id: scope.tenant_id,
    project_id: scope.project_id,
    group_id: scope.group_id,
    season_id: scope.season_id,
    zone_id: scope.zone_id,
  }).toString();
  const base = `/api/v1/operator/twin/fields/${encodeURIComponent(scope.field_id)}/runtime`;
  const surfaces: Array<{ endpoint: string; status: number; content_hash: string; response_hash: string }> = [];
  try {
    for (const [endpoint, suffix] of [
      ["runtime", ""],
      ["timeline_first_page", "/timeline?limit=10"],
    ] as const) {
      const separator = suffix.includes("?") ? "&" : "?";
      const response = await app.inject({ method: "GET", url: `${base}${suffix}${separator}${query}` });
      assert.equal(response.statusCode, 200, `CAP07_CAP04_HTTP_${endpoint.toUpperCase()}:${response.body}`);
      assert.equal(response.headers["cache-control"], "no-store");
      const contentHash = String(response.headers["x-geox-mcft-content-hash"] ?? "");
      const responseHash = String(response.headers["x-geox-mcft-response-instance-hash"] ?? "");
      assert.ok(contentHash.startsWith("sha256:"), `CAP07_CAP04_HTTP_${endpoint.toUpperCase()}_CONTENT_HASH`);
      assert.ok(responseHash.startsWith("sha256:"), `CAP07_CAP04_HTTP_${endpoint.toUpperCase()}_RESPONSE_HASH`);
      if (endpoint === "runtime") {
        assert.equal(response.body.includes(String(terminal.rows[0].source_forecast_ref)), true, "CAP07_CAP04_RUNTIME_SOURCE_FORECAST_MISSING");
        assert.equal(response.body.includes(String(terminal.rows[0].scenario_set_id)), true, "CAP07_CAP04_RUNTIME_SCENARIO_MISSING");
      }
      surfaces.push({ endpoint, status: response.statusCode, content_hash: contentHash, response_hash: responseHash });
    }
  } finally {
    await app.close();
  }
  const after = await tableCardinalitySnapshot(admin);
  assert.deepEqual(after, before, "CAP07_CAP04_PRODUCT_READ_WRITE_DELTA");

  const result = {
    schema_version: "geox_mcft_cap07_cap04_forecast_payload_compatibility_db_result_v1",
    status: "PASS",
    database_name: databaseName,
    scope,
    observed_scoped_forecast_fact_count: forecastCount,
    observed_scoped_scenario_fact_count: scenarioCount,
    terminal_scenario_ref: terminal.rows[0].scenario_set_id,
    terminal_source_forecast_ref: terminal.rows[0].source_forecast_ref,
    terminal_source_forecast_hash: terminal.rows[0].source_forecast_hash,
    terminal_source_forecast_fact_id: terminal.rows[0].forecast_fact_id,
    terminal_source_forecast_status: forecastPayload.status,
    terminal_source_forecast_point_count: forecastPayload.points.length,
    canonical_points_path: "record_json.payload.payload.points",
    canonical_point_count_field_absent: true,
    cap04_full_payload_validation: "PASS_VIA_PRODUCT_READ",
    runtime_readback: "PASS",
    timeline_first_page_readback: "PASS",
    timeline_cursor_continuation: "OUT_OF_SCOPE_BLOCKED_BY_CAP07_HISTORICAL_ROOT_HEALTH_ROLE_REMEDIATION",
    timeline_cursor_continuation_failure_code: "MCFT_RUNTIME_HEALTH_ROLE_UNRESOLVED:ATTEMPT_REF",
    http_surface_count: surfaces.length,
    http_surfaces: surfaces,
    product_read_write_delta: 0,
    model_activation_count: activationCount,
    runtime_write_authority_delta: 0,
    production_runtime_source_authorized: false,
    mcft_cap_08_complete: false,
    mcft_cap_09_authorized: false,
  };
  write(result);
  console.log(JSON.stringify(result));
}

main()
  .catch((error) => {
    write({ schema_version: "geox_mcft_cap07_cap04_forecast_payload_compatibility_db_result_v1", status: "FAIL", error: error instanceof Error ? error.message : String(error) });
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.allSettled([runner.end(), admin.end()]);
  });
