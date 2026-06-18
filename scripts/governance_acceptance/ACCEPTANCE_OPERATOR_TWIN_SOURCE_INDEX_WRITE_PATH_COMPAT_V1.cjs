// scripts/governance_acceptance/ACCEPTANCE_OPERATOR_TWIN_SOURCE_INDEX_WRITE_PATH_COMPAT_V1.cjs
// Purpose: verify Operator Twin source-index DDL remains compatible with existing write/upsert paths.
// Boundary: static governance acceptance only; no database connection, no runtime writes, no dispatch.

const fs = require("fs");
const path = require("path");

const root = process.cwd();

function readText(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8").replace(/\r\n/g, "\n");
}

function assert(condition, message, details) {
  if (!condition) {
    const error = new Error(message);
    error.details = details;
    throw error;
  }
}

function assertIncludes(haystack, needle, message) {
  assert(haystack.includes(needle), message, { needle });
}

function assertNotIncludes(haystack, needle, message) {
  assert(!haystack.includes(needle), message, { needle });
}

function extractCreateTableBlock(sql, tableName) {
  const marker = "CREATE TABLE IF NOT EXISTS " + tableName;
  const start = sql.indexOf(marker);

  assert(start >= 0, "missing CREATE TABLE block: " + tableName, { tableName });

  const next = sql.indexOf("\nCREATE TABLE IF NOT EXISTS ", start + marker.length);
  const end = next >= 0 ? next : sql.length;

  return sql.slice(start, end);
}

function assertAllTokens(block, tokens, context) {
  tokens.forEach((token) => {
    assertIncludes(block, token, context + " requires token: " + token);
  });
}

const contractSql = readText("db/contracts/operator_twin_source_indexes_v1.sql");
const migrationSql = readText("apps/server/db/migrations/2026_06_18_operator_twin_source_indexes_v1.sql");
const doc = readText("docs/db/GEOX_OPERATOR_TWIN_SOURCE_INDEX_WRITE_PATH_COMPAT_V1.md");
const fieldRoute = readText("apps/server/src/routes/fields_v1.ts");
const flightTableGeometry = readText("apps/server/src/services/flight_table/flight_table_geometry_v1.ts");
const packageJsonText = readText("package.json");

[
  contractSql,
  migrationSql,
].forEach((sql) => {
  const fieldBlock = extractCreateTableBlock(sql, "field_index_v1");

  assertAllTokens(
    fieldBlock,
    [
      "tenant_id text NOT NULL",
      "field_id text NOT NULL",
      "project_id text NOT NULL DEFAULT",
      "group_id text NOT NULL DEFAULT",
      "name text",
      "geojson_json jsonb",
      "area_ha numeric",
      "area_m2 numeric",
      "status text",
      "created_ts_ms bigint",
      "updated_ts_ms bigint",
      "PRIMARY KEY (tenant_id, field_id)",
      "UNIQUE (tenant_id, project_id, group_id, field_id)",
    ],
    "field_index_v1 write-path compatibility"
  );

  assertNotIncludes(
    fieldBlock,
    "PRIMARY KEY (tenant_id, project_id, group_id, field_id)",
    "field_index_v1 must not replace the existing write-path conflict key with the scoped key"
  );

  const soilBlock = extractCreateTableBlock(sql, "soil_moisture_sensing_window_index_v1");

  assertAllTokens(
    soilBlock,
    [
      "tenant_id text NOT NULL",
      "project_id text NOT NULL",
      "group_id text NOT NULL",
      "field_id text NOT NULL",
      "window_id text NOT NULL",
      "window_start timestamptz",
      "window_end timestamptz",
      "expected_interval_ms integer",
      "expected_points integer",
      "actual_points integer",
      "min_total_samples_required integer",
      "min_samples_per_required_metric integer",
      "coverage_ratio numeric",
      "min_coverage_ratio numeric",
      "max_gap_ms integer",
      "max_allowed_gap_ms integer",
      "gap_count integer",
      "quality_status text",
      "source_fact_id text",
      "source_fact_ids_json jsonb",
      "source_observation_ids_json jsonb",
      "PRIMARY KEY (tenant_id, window_id)",
      "UNIQUE (tenant_id, project_id, group_id, field_id, window_id)",
    ],
    "soil_moisture_sensing_window_index_v1 write-path compatibility"
  );

  [
    "sensing_window_id",
    "window_start_at",
    "window_end_at",
  ].forEach((forbiddenToken) => {
    assertNotIncludes(
      soilBlock,
      forbiddenToken,
      "soil_moisture_sensing_window_index_v1 must use runtime write-path column names, not drift token " + forbiddenToken
    );
  });
});

assertIncludes(fieldRoute, "ON CONFLICT (tenant_id, field_id)", "field route must continue to upsert field_index_v1 by tenant_id and field_id");

[
  "name",
  "area_ha",
  "status",
  "created_ts_ms",
  "updated_ts_ms",
].forEach((token) => {
  assertIncludes(fieldRoute, token, "field route write path must still reference " + token);
});

[
  "geojson_json",
  "area_m2",
].forEach((token) => {
  assertIncludes(flightTableGeometry, token, "flight-table geometry write path must still reference " + token);
});

assertIncludes(
  flightTableGeometry,
  "field_index_v1",
  "flight-table geometry writer must still target field_index_v1"
);

assertIncludes(doc, "ON CONFLICT (tenant_id, field_id)", "compatibility doc must record field_index_v1 write-path conflict target");
assertIncludes(doc, "ON CONFLICT (tenant_id, window_id)", "compatibility doc must record soil window write-path conflict target");

const packageJson = JSON.parse(packageJsonText);

assert(
  packageJson.scripts && packageJson.scripts["ci:governance:operator-twin-source-index-write-path-compat"] === "node scripts/governance_acceptance/ACCEPTANCE_OPERATOR_TWIN_SOURCE_INDEX_WRITE_PATH_COMPAT_V1.cjs",
  "package.json must expose ci:governance:operator-twin-source-index-write-path-compat"
);

console.log("[operator-twin-source-index-write-path-compat] PASS");
