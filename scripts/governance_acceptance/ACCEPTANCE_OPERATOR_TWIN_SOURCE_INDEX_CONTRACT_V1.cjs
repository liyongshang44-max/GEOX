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

const tables = [
  "field_index_v1",
  "water_state_estimate_index_v1",
  "soil_moisture_sensing_window_index_v1",
  "weather_forecast_index_v1",
  "irrigation_scenario_set_index_v1",
  "decision_recommendation_index_v1"
];

const sharedScopeColumns = ["tenant_id", "project_id", "group_id", "field_id"];

for (const table of tables) {
  assertIncludes(doc, table, "doc table " + table);
  assertIncludes(sql, "CREATE TABLE IF NOT EXISTS " + table, "sql table " + table);
  assertIncludes(route, table, "route scoped source table " + table);

  for (const column of sharedScopeColumns) {
    assertIncludes(doc, column, "doc shared scope column " + column);
    assertIncludes(sql, column + " text NOT NULL", "sql shared scope column " + table + "." + column);
  }
}

[
  "field_name",
  "crop",
  "water_state",
  "confidence_level",
  "confidence_score",
  "sensing_window_id",
  "window_start_at",
  "window_end_at",
  "coverage_ratio",
  "forecast_id",
  "forecast_horizon",
  "provider",
  "scenario_set_id",
  "options_json",
  "recommendation_id",
  "suggested_action_json",
  "action_type",
  "amount_mm",
  "evidence_refs_json"
].forEach((column) => {
  assertIncludes(doc, column, "doc required column " + column);
  assertIncludes(sql, column, "sql required column " + column);
});

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
  "dispatch"
].forEach((token) => {
  assertNotIncludes(sql, token, "SQL contract must not contain mutation/execution token " + token);
});

assert(
  pkg.scripts && pkg.scripts["ci:governance:operator-twin-source-index-contract"] === "node scripts/governance_acceptance/ACCEPTANCE_OPERATOR_TWIN_SOURCE_INDEX_CONTRACT_V1.cjs",
  "package script ci:governance:operator-twin-source-index-contract missing or incorrect",
  { actual: pkg.scripts && pkg.scripts["ci:governance:operator-twin-source-index-contract"] }
);

console.log("[operator-twin-source-index-contract] PASS");
