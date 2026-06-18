// scripts/governance_acceptance/ACCEPTANCE_OPERATOR_TWIN_SOURCE_INDEX_CONTRACT_V1.cjs
// Purpose: verify Operator Twin source-index schema contract does not drift from the API route contract.
// Boundary: this acceptance is static; it does not connect to a database and does not create tables.

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");

function readText(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

function assert(condition, message, detail) {
  if (!condition) {
    const suffix = detail === undefined ? "" : "\n" + JSON.stringify(detail, null, 2);
    throw new Error(message + suffix);
  }
}

function assertIncludes(text, needle, label) {
  assert(text.includes(needle), "missing required token: " + label, { needle });
}

function assertNotIncludes(text, needle, label) {
  assert(!text.includes(needle), "forbidden token present: " + label, { needle });
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractCreateTableBlock(sql, tableName) {
  const pattern = new RegExp(
    "CREATE\\s+TABLE\\s+IF\\s+NOT\\s+EXISTS\\s+" +
      escapeRegExp(tableName) +
      "\\s*\\([\\s\\S]*?\\n\\);",
    "i"
  );

  const match = sql.match(pattern);

  assert(match && match[0], "missing CREATE TABLE block: " + tableName, { tableName });

  return match[0];
}

function hasColumnInTableBlock(sql, tableName, columnName) {
  const block = extractCreateTableBlock(sql, tableName);
  const pattern = new RegExp("(^|\\n)\\s*" + escapeRegExp(columnName) + "\\b", "i");

  return pattern.test(block);
}

function hasRequiredTextScopeColumnInTableBlock(sql, tableName, columnName) {
  const block = extractCreateTableBlock(sql, tableName);
  const pattern = new RegExp(
    "(^|\\n)\\s*" + escapeRegExp(columnName) + "\\s+text\\s+NOT\\s+NULL\\s*,?",
    "i"
  );

  return pattern.test(block);
}

function assertColumnInTableBlock(sql, tableName, columnName) {
  assert(
    hasColumnInTableBlock(sql, tableName, columnName),
    "missing column in table block: " + tableName + "." + columnName,
    { tableName, columnName, block: extractCreateTableBlock(sql, tableName) }
  );
}

function assertRequiredTextScopeColumnInTableBlock(sql, tableName, columnName) {
  assert(
    hasRequiredTextScopeColumnInTableBlock(sql, tableName, columnName),
    "missing required text scope column in table block: " + tableName + "." + columnName,
    { tableName, columnName, block: extractCreateTableBlock(sql, tableName) }
  );
}

function removeColumnLineFromTableBlock(sql, tableName, columnName) {
  const block = extractCreateTableBlock(sql, tableName);
  const pattern = new RegExp("(^|\\n)\\s*" + escapeRegExp(columnName) + "\\s+[^\\n]*\\n?", "i");
  const mutatedBlock = block.replace(pattern, "$1");

  assert(mutatedBlock !== block, "negative self-test could not remove column from table block", {
    tableName,
    columnName,
  });

  return sql.replace(block, mutatedBlock);
}

const docPath = "docs/db/GEOX_OPERATOR_TWIN_SOURCE_INDEX_DDL_CONTRACT_V1.md";
const sqlPath = "db/contracts/operator_twin_source_indexes_v1.sql";
const routePath = "apps/server/src/routes/v1/operator_twin.ts";
const packagePath = "package.json";

assert(fs.existsSync(path.join(ROOT, docPath)), "source index contract doc missing", { docPath });
assert(fs.existsSync(path.join(ROOT, sqlPath)), "source index SQL contract missing", { sqlPath });

const doc = readText(docPath);
const sql = readText(sqlPath);
const route = readText(routePath);
const pkg = JSON.parse(readText(packagePath));

const tableContracts = [
  {
    table: "field_index_v1",
    columns: ["tenant_id", "project_id", "group_id", "field_id", "field_name", "crop", "updated_at"],
  },
  {
    table: "water_state_estimate_index_v1",
    columns: [
      "tenant_id",
      "project_id",
      "group_id",
      "field_id",
      "water_state",
      "confidence_level",
      "confidence_score",
      "evidence_refs_json",
      "computed_at",
    ],
  },
  {
    table: "soil_moisture_sensing_window_index_v1",
    columns: [
      "tenant_id",
      "project_id",
      "group_id",
      "field_id",
      "window_id",
      "device_id",
      "metric",
      "window_start",
      "window_end",
      "expected_interval_ms",
      "expected_points",
      "actual_points",
      "coverage_ratio",
      "max_gap_ms",
      "quality_status",
      "confidence_json",
      "summary_json",
      "config_snapshot_json",
      "evidence_refs_json",
      "source_fact_ids_json",
      "source_observation_ids_json",
      "source_fact_id",
      "created_at",
      "updated_at",
    ],
  },
  {
    table: "weather_forecast_index_v1",
    columns: [
      "tenant_id",
      "project_id",
      "group_id",
      "field_id",
      "forecast_id",
      "forecast_horizon",
      "provider",
      "evidence_refs_json",
      "generated_at",
    ],
  },
  {
    table: "irrigation_scenario_set_index_v1",
    columns: [
      "tenant_id",
      "project_id",
      "group_id",
      "field_id",
      "scenario_set_id",
      "options_json",
      "evidence_refs_json",
      "generated_at",
    ],
  },
  {
    table: "decision_recommendation_index_v1",
    columns: [
      "tenant_id",
      "project_id",
      "group_id",
      "field_id",
      "recommendation_id",
      "suggested_action_json",
      "action_type",
      "amount_mm",
      "evidence_refs_json",
      "generated_at",
    ],
  },
];

const sharedScopeColumns = ["tenant_id", "project_id", "group_id", "field_id"];

for (const contract of tableContracts) {
  assertIncludes(doc, contract.table, "doc table " + contract.table);
  assertIncludes(sql, "CREATE TABLE IF NOT EXISTS " + contract.table, "sql table " + contract.table);
  assertIncludes(route, contract.table, "route scoped source table " + contract.table);

  const ddlBlock = extractCreateTableBlock(sql, contract.table);

  for (const column of contract.columns) {
    assertIncludes(doc, column, "doc required column " + contract.table + "." + column);
    assertColumnInTableBlock(sql, contract.table, column);
  }

  for (const column of sharedScopeColumns) {
    assertRequiredTextScopeColumnInTableBlock(sql, contract.table, column);

    const mutatedSql = removeColumnLineFromTableBlock(sql, contract.table, column);

    assert(
      !hasRequiredTextScopeColumnInTableBlock(mutatedSql, contract.table, column),
      "negative self-test failed: table-block scope guard did not detect removed column",
      { table: contract.table, column }
    );
  }

  assert(
    ddlBlock.includes("PRIMARY KEY"),
    "table block must define a primary key: " + contract.table,
    { table: contract.table, ddlBlock }
  );
}

assertIncludes(route, "OPERATOR_TWIN_SCOPED_INDEX_TABLES", "route scoped index table constant");
assertIncludes(route, "TENANT_SCOPE_COLUMNS", "route scope columns constant");
assertIncludes(route, "hasTenantScope", "route no-scope guard helper");
assertIncludes(route, "field_id", "route field scope guard");
assertIncludes(route, "suggested_action_json", "route suggested_action_json parser");
assertIncludes(route, "recommendationActionType", "route recommendation action type parser");
assertIncludes(route, "recommendationAmountMm", "route recommendation amount parser");
assertIncludes(route, "options_json", "route options_json parser");
assertIncludes(route, "IRRIGATION_SCENARIO_SET_MISSING", "route missing scenario semantic");
assertIncludes(route, "no_action_baseline_present", "route real scenario baseline semantic");

[
  "DROP TABLE",
  "TRUNCATE",
  "DELETE FROM",
  "UPDATE ",
  "INSERT INTO",
  "ao_act_task",
  "approval_decision",
  "dispatch",
].forEach((token) => {
  assertNotIncludes(sql, token, "SQL contract must not contain mutation/execution token " + token);
});

assert(
  pkg.scripts &&
    pkg.scripts["ci:governance:operator-twin-source-index-contract"] ===
      "node scripts/governance_acceptance/ACCEPTANCE_OPERATOR_TWIN_SOURCE_INDEX_CONTRACT_V1.cjs",
  "package script ci:governance:operator-twin-source-index-contract missing or incorrect",
  { actual: pkg.scripts && pkg.scripts["ci:governance:operator-twin-source-index-contract"] }
);

// field_index_v1 existing write-path compatibility
const fieldIndexBlock = extractCreateTableBlock(sql, "field_index_v1");

[
  "tenant_id text NOT NULL",
  "field_id text NOT NULL",
  "project_id text NOT NULL DEFAULT",
  "group_id text NOT NULL DEFAULT",
  "name text",
  "field_name text",
  "area_ha numeric",
  "status text",
  "created_ts_ms bigint",
  "updated_ts_ms bigint",
  "PRIMARY KEY (tenant_id, field_id)",
  "UNIQUE (tenant_id, project_id, group_id, field_id)",
].forEach((token) => {
  assertIncludes(fieldIndexBlock, token, "field_index_v1 write-path compatibility token " + token);
});

assertIncludes(doc, "PRIMARY KEY (tenant_id, field_id)", "field_index_v1 doc write-path primary key");
assertIncludes(doc, "ON CONFLICT (tenant_id, field_id)", "field_index_v1 doc legacy upsert compatibility");

// soil_moisture_sensing_window_index_v1 existing write-path compatibility
const soilWindowBlock = extractCreateTableBlock(sql, "soil_moisture_sensing_window_index_v1");

[
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
].forEach((token) => {
  assertIncludes(soilWindowBlock, token, "soil_moisture_sensing_window_index_v1 write-path compatibility token " + token);
});

assertIncludes(doc, "ON CONFLICT (tenant_id, window_id)", "soil window doc upsert compatibility");

console.log("[operator-twin-source-index-contract] PASS");