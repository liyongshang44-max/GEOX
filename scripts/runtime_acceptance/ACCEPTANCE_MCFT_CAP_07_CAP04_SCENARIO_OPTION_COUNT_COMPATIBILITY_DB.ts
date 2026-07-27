import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import { Pool } from "pg";

import { AggregateProjectionValidatorV1 } from "../../apps/server/src/domain/field_twin_read_model/exact_resolvers_v1.js";
import { resolveMcftCap07S4SourceObligationV1 } from "../../apps/server/src/domain/field_twin_read_model/s4_source_obligations_v1.js";
import { registerMcftFieldTwinReadRoutesV1 } from "../../apps/server/src/routes/v1/mcft_field_twin_read_v1.js";

if (process.env.MCFT_CAP07_CAP04_SCENARIO_OPTION_COUNT_RECONCILIATION_DESTRUCTIVE !== "1") {
  throw new Error("SET_MCFT_CAP07_CAP04_SCENARIO_OPTION_COUNT_RECONCILIATION_DESTRUCTIVE_1");
}
const DATABASE_URL = String(process.env.DATABASE_URL ?? "").trim();
const ADMIN_DATABASE_URL = String(process.env.MCFT_CAP08_ADMIN_DATABASE_URL ?? "").trim();
if (!DATABASE_URL) throw new Error("DATABASE_URL_REQUIRED");
if (!ADMIN_DATABASE_URL) throw new Error("MCFT_CAP08_ADMIN_DATABASE_URL_REQUIRED");
const databaseName = new URL(DATABASE_URL).pathname.replace(/^\//, "").toLowerCase();
if (!/^(geox_)?mcft_cap08_.*(scenario|option|reconciliation|compat)/.test(databaseName)) {
  throw new Error(`CAP07_CAP04_SCENARIO_OPTION_COUNT_FRESH_DATABASE_REQUIRED:${databaseName}`);
}
if (new URL(ADMIN_DATABASE_URL).pathname.replace(/^\//, "").toLowerCase() !== databaseName) {
  throw new Error("CAP07_CAP04_SCENARIO_OPTION_COUNT_ADMIN_DATABASE_MISMATCH");
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = path.join(ROOT, "acceptance-output/MCFT_CAP_07_CAP04_SCENARIO_OPTION_COUNT_COMPATIBILITY_DB_RESULT.json");
const runner = new Pool({ connectionString: DATABASE_URL, max: 4 });
const admin = new Pool({ connectionString: ADMIN_DATABASE_URL, max: 2 });

function write(value: unknown): void {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`);
}

function normalizeProjectionValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalizeProjectionValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, normalizeProjectionValue(item)]),
    );
  }
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    const parsed = new Date(value);
    if (Number.isFinite(parsed.getTime())) return parsed.toISOString();
  }
  return value;
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

async function main(): Promise<void> {
  process.env.MCFT_CURSOR_SIGNING_KEYS_JSON = JSON.stringify({ reconciliation: "cap07-cap04-scenario-option-count-reconciliation-signing-key-0001" });
  process.env.MCFT_CURSOR_PRIMARY_KEY_ID = "reconciliation";

  const scopeResult = await admin.query(
    `SELECT tenant_id,project_id,group_id,field_id,season_id,zone_id
       FROM twin_calibration_candidate_projection_v1
      ORDER BY logical_time DESC,candidate_object_id ASC`,
  );
  assert.equal(scopeResult.rows.length, 1, `CAP07_SCENARIO_OPTION_COUNT_SCOPE_CARDINALITY:${scopeResult.rows.length}`);
  const scope = Object.fromEntries(
    ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"].map((key) => [key, String(scopeResult.rows[0][key])]),
  ) as Record<string, string>;

  const projectionRows = await admin.query<{
    row_json: Record<string, unknown>;
    fact_id: string;
    record_json: Record<string, unknown>;
  }>(
    `SELECT to_jsonb(p) AS row_json,f.fact_id,f.record_json
       FROM twin_scenario_set_projection_v1 AS p
       JOIN facts AS f ON f.fact_id=p.source_fact_id
      WHERE p.tenant_id=$1 AND p.project_id=$2 AND p.group_id=$3
        AND p.field_id=$4 AND p.season_id=$5 AND p.zone_id=$6
      ORDER BY p.logical_time DESC,p.scenario_set_id ASC`,
    [scope.tenant_id, scope.project_id, scope.group_id, scope.field_id, scope.season_id, scope.zone_id],
  );
  assert.ok(projectionRows.rows.length >= 24, `CAP07_SCENARIO_OPTION_COUNT_PROJECTION_CARDINALITY:${projectionRows.rows.length}`);

  const obligation = resolveMcftCap07S4SourceObligationV1("public.twin_scenario_set_projection_v1");
  const optionComparison = obligation.required_column_comparisons
    .map((value) => value as Record<string, unknown>)
    .filter((value) => value.projection_column === "option_count");
  assert.equal(optionComparison.length, 1, `CAP07_SCENARIO_OPTION_COUNT_EFFECTIVE_COMPARISON_CARDINALITY:${optionComparison.length}`);
  assert.equal(optionComparison[0].canonical_path, "record_json.payload.payload.options.length");
  assert.equal(optionComparison[0].comparison, "EXACT");

  const validator = new AggregateProjectionValidatorV1();
  const normalizedRows = projectionRows.rows.map((row) => ({
    ...row,
    row_json: normalizeProjectionValue(row.row_json) as Record<string, unknown>,
  }));
  const observed: Array<{ scenario_set_id: string; option_count: number; canonical_options_length: number }> = [];
  for (const row of normalizedRows) {
    const envelope = row.record_json as { payload?: { payload?: { options?: unknown; option_count?: unknown } } };
    const options = envelope.payload?.payload?.options;
    assert.ok(Array.isArray(options), `CAP07_SCENARIO_OPTION_COUNT_CANONICAL_OPTIONS_ARRAY_REQUIRED:${String(row.row_json.scenario_set_id)}`);
    assert.equal(Object.hasOwn(envelope.payload?.payload ?? {}, "option_count"), false, `CAP07_SCENARIO_OPTION_COUNT_NONCANONICAL_FIELD_FORBIDDEN:${String(row.row_json.scenario_set_id)}`);
    assert.equal(Number(row.row_json.option_count), options.length, `CAP07_SCENARIO_OPTION_COUNT_DERIVATION_MISMATCH:${String(row.row_json.scenario_set_id)}`);
    const result = validator.validate({
      obligation,
      projection_row: row.row_json,
      canonical_context: { record_json: row.record_json, facts: { fact_id: row.fact_id } },
    });
    assert.equal(result.validation_status, "PASS");
    observed.push({
      scenario_set_id: String(row.row_json.scenario_set_id),
      option_count: Number(row.row_json.option_count),
      canonical_options_length: options.length,
    });
  }

  const first = normalizedRows[0];
  assert.throws(
    () => validator.validate({
      obligation,
      projection_row: { ...first.row_json, option_count: Number(first.row_json.option_count) + 1 },
      canonical_context: { record_json: first.record_json, facts: { fact_id: first.fact_id } },
    }),
    (error: unknown) => error instanceof Error
      && error.message === "MCFT_AGGREGATE_PROJECTION_CANONICAL_DIVERGENCE:option_count",
    "CAP07_SCENARIO_OPTION_COUNT_CORRUPTION_MUST_FAIL_CLOSED",
  );

  const activationCount = Number((await admin.query(
    `SELECT count(*)::int AS n FROM facts
      WHERE record_json->>'type'='twin_model_activation_v1'
        AND COALESCE(record_json->'payload'->'scope'->>'tenant_id',record_json->'payload'->>'tenant_id')=$1
        AND COALESCE(record_json->'payload'->'scope'->>'project_id',record_json->'payload'->>'project_id')=$2
        AND COALESCE(record_json->'payload'->'scope'->>'group_id',record_json->'payload'->>'group_id')=$3
        AND COALESCE(record_json->'payload'->'scope'->>'field_id',record_json->'payload'->>'field_id')=$4
        AND COALESCE(record_json->'payload'->'scope'->>'season_id',record_json->'payload'->>'season_id')=$5
        AND COALESCE(record_json->'payload'->'scope'->>'zone_id',record_json->'payload'->>'zone_id')=$6`,
    [scope.tenant_id, scope.project_id, scope.group_id, scope.field_id, scope.season_id, scope.zone_id],
  )).rows[0].n);
  assert.equal(activationCount, 0, `CAP07_SCENARIO_OPTION_COUNT_MODEL_ACTIVATION_FORBIDDEN:${activationCount}`);

  const before = await tableCardinalitySnapshot(admin);
  const app = Fastify({ logger: false });
  registerMcftFieldTwinReadRoutesV1(app, runner, {
    authorizeScope: (_request, requested) => ({
      tenant_id: requested.tenant_id,
      project_id: requested.project_id,
      group_id: requested.group_id,
      allowed_field_ids: [requested.field_id],
      principal_id: "mcft-cap07-cap04-scenario-option-count-reconciliation",
    } as any),
  });
  await app.ready();
  const query = new URLSearchParams({
    tenant_id: scope.tenant_id,
    project_id: scope.project_id,
    group_id: scope.group_id,
    season_id: scope.season_id,
    zone_id: scope.zone_id,
    limit: "50",
  }).toString();
  const url = `/api/v1/operator/twin/fields/${encodeURIComponent(scope.field_id)}/runtime/scenarios?${query}`;
  let responseStatus = 0;
  let contentHash = "";
  let responseHash = "";
  try {
    const response = await app.inject({ method: "GET", url });
    responseStatus = response.statusCode;
    assert.equal(response.statusCode, 200, `CAP07_SCENARIO_OPTION_COUNT_HTTP_SCENARIOS:${response.body}`);
    assert.equal(response.headers["cache-control"], "no-store");
    contentHash = String(response.headers["x-geox-mcft-content-hash"] ?? "");
    responseHash = String(response.headers["x-geox-mcft-response-instance-hash"] ?? "");
    assert.ok(contentHash.startsWith("sha256:"), "CAP07_SCENARIO_OPTION_COUNT_HTTP_CONTENT_HASH");
    assert.ok(responseHash.startsWith("sha256:"), "CAP07_SCENARIO_OPTION_COUNT_HTTP_RESPONSE_HASH");
    assert.equal(response.body.includes(observed[0].scenario_set_id), true, "CAP07_SCENARIO_OPTION_COUNT_HTTP_LATEST_SCENARIO_MISSING");
  } finally {
    await app.close();
  }
  const after = await tableCardinalitySnapshot(admin);
  assert.deepEqual(after, before, "CAP07_SCENARIO_OPTION_COUNT_PRODUCT_READ_WRITE_DELTA");

  const result = {
    schema_version: "geox_mcft_cap07_cap04_scenario_option_count_compatibility_db_result_v1",
    status: "PASS",
    database_name: databaseName,
    scope,
    observed_scenario_projection_count: observed.length,
    observed_scenarios: observed,
    effective_canonical_path: "record_json.payload.payload.options.length",
    comparison: "EXACT",
    projection_normalization: "MATCHES_PRODUCT_REPOSITORY_DATE_TO_ISO",
    canonical_option_count_field_absent: true,
    positive_projection_validation: "PASS",
    corrupted_projection_option_count: "FAIL_CLOSED",
    scenario_collection_status: responseStatus,
    scenario_collection_content_hash: contentHash,
    scenario_collection_response_hash: responseHash,
    product_read_write_delta: 0,
    model_activation_count: activationCount,
    runtime_write_authority_delta: 0,
    production_runtime_source_authorized: false,
    s6_candidate_implemented: false,
    mcft_cap_08_complete: false,
    mcft_cap_09_authorized: false,
  };
  write(result);
  console.log(JSON.stringify(result));
}

main()
  .catch((error) => {
    write({
      schema_version: "geox_mcft_cap07_cap04_scenario_option_count_compatibility_db_result_v1",
      status: "FAIL",
      error: error instanceof Error ? error.message : String(error),
    });
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.allSettled([runner.end(), admin.end()]);
  });
