// scripts/governance_acceptance/ACCEPTANCE_OPERATOR_TWIN_SOURCE_INDEX_INVENTORY_API_V1.cjs
// Purpose: verify the Operator Twin source-index inventory API remains scoped and read-only.
// Boundary: static governance acceptance only; no database connection and no runtime writes.

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

const route = readText("apps/server/src/routes/v1/operator_twin.ts");
const pkg = JSON.parse(readText("package.json"));

assertIncludes(route, 'app.get("/api/v1/operator/twin/source-indexes"', "source-index inventory route");
assertIncludes(route, "operator_twin_source_index_inventory_v1", "inventory projection key");
assertIncludes(route, "OPERATOR_TWIN_SOURCE_INDEX_INVENTORY", "inventory report kind");
assertIncludes(route, "buildSourceIndexInventory", "inventory builder");
assertIncludes(route, "countScopedRows", "scoped row counter");
assertIncludes(route, "latest_evidence_refs", "latest evidence refs");
assertIncludes(route, "source_indexes", "source index list");
assertIncludes(route, "available_table_count", "available table count summary");
assertIncludes(route, "total_row_count", "total row count summary");

[
  "field_index_v1",
  "water_state_estimate_index_v1",
  "soil_moisture_sensing_window_index_v1",
  "weather_forecast_index_v1",
  "irrigation_scenario_set_index_v1",
  "decision_recommendation_index_v1",
].forEach((tableName) => {
  assertIncludes(route, tableName, "inventory includes " + tableName);
});

assertIncludes(route, "tenant_id", "tenant scope");
assertIncludes(route, "project_id", "project scope");
assertIncludes(route, "group_id", "group scope");
assertIncludes(route, "field_id", "optional field scope");
assertIncludes(route, "scope_columns_present", "scope column visibility");
assertIncludes(route, "SCOPE_REQUIRED_REASON", "scope required reason");
assertIncludes(route, "TABLE_SCOPE_COLUMNS_REQUIRED_REASON", "table scope columns required reason");

[
  "app.post(",
  "app.put(",
  "app.patch(",
  "app.delete(",
  "INSERT INTO",
  "UPDATE ",
  "DELETE FROM",
  "approveNow",
  "dispatchNow",
  "ao_act_task_v0",
].forEach((token) => {
  assertNotIncludes(route, token, "source-index inventory API must not include " + token);
});

assert(
  pkg.scripts &&
    pkg.scripts["ci:governance:operator-twin-source-index-inventory-api"] ===
      "node scripts/governance_acceptance/ACCEPTANCE_OPERATOR_TWIN_SOURCE_INDEX_INVENTORY_API_V1.cjs",
  "package script ci:governance:operator-twin-source-index-inventory-api missing or incorrect",
  { actual: pkg.scripts && pkg.scripts["ci:governance:operator-twin-source-index-inventory-api"] }
);

console.log("[operator-twin-source-index-inventory-api] PASS");
