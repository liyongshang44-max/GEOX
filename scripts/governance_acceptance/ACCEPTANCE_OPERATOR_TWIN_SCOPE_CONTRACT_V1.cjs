// scripts/governance_acceptance/ACCEPTANCE_OPERATOR_TWIN_SCOPE_CONTRACT_V1.cjs
// Purpose: verify Operator Twin scope and evidence contract does not regress.
// Boundary: this is a governance contract acceptance, not a runtime integration test.

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

const docPath = "docs/backend/GEOX_OPERATOR_TWIN_SCOPE_CONTRACT_V1.md";
const routePath = "apps/server/src/routes/v1/operator_twin.ts";
const packagePath = "package.json";

const doc = readText(docPath);
const route = readText(routePath);
const pkg = JSON.parse(readText(packagePath));

[
  "GET /api/v1/operator/twin",
  "GET /api/v1/operator/twin/fields/:field_id",
  "tenant_id",
  "project_id",
  "group_id",
  "field_id",
  "suggested_action_json",
  "IRRIGATION_SCENARIO_SET_MISSING",
  "scenario_comparison.options = []",
  "must not synthesize default options",
  "Read-only boundary"
].forEach((token) => assertIncludes(doc, token, "contract doc " + token));

assertIncludes(route, "const TENANT_SCOPE_COLUMNS", "scope columns constant");
assertIncludes(route, '["tenant_id", "project_id", "group_id"] as const', "scope columns exact list");
assertIncludes(route, "const OPERATOR_TWIN_SCOPED_INDEX_TABLES", "scoped index table contract");
assertIncludes(route, '"field_index_v1"', "field index table listed");
assertIncludes(route, '"water_state_estimate_index_v1"', "water state index table listed");
assertIncludes(route, '"soil_moisture_sensing_window_index_v1"', "sensing index table listed");
assertIncludes(route, '"weather_forecast_index_v1"', "weather index table listed");
assertIncludes(route, '"irrigation_scenario_set_index_v1"', "scenario index table listed");
assertIncludes(route, '"decision_recommendation_index_v1"', "recommendation index table listed");

assertIncludes(route, "SCOPE_REQUIRED_REASON", "scope missing reason");
assertIncludes(route, "TABLE_SCOPE_COLUMNS_REQUIRED_REASON", "table scope missing reason");
assertIncludes(route, "if (!hasTenantScope(scope)) return [];", "no-scope empty result guard");
assertIncludes(route, "TENANT_SCOPE_COLUMNS.filter", "scope column discovery uses contract constant");
assertIncludes(route, "if (scopedColumns.length === 0)", "table without scope columns guard");
assertIncludes(route, "clauses.push(identifier(column) +", "scoped WHERE clause construction");
assertIncludes(route, 'scope.fieldId && columns.has("field_id")', "field id filter guard");
assertIncludes(route, 'clauses.push("field_id = $"', "field id WHERE clause");

assertIncludes(route, "scope_policy:", "scope policy in payload");
assertIncludes(route, "accepted_scope_keys: [...TENANT_SCOPE_COLUMNS]", "scope keys exposed");
assertIncludes(route, "scope_applied: hasTenantScope(scope)", "overview scope applied flag");
assertIncludes(route, "scope_applied: hasTenantScope(fieldScope)", "field workspace scope applied flag");
assertIncludes(route, "field_scope_required: true", "field workspace field scope requirement");

assertIncludes(route, "suggested_action_json", "suggested action parser");
assertIncludes(route, "recommendationActionType", "recommendation action type helper");
assertIncludes(route, "recommendationAmountMm", "recommendation amount helper");
assertIncludes(route, "suggested?.action_type", "suggested action_type source");
assertIncludes(route, "suggested?.amount_mm", "suggested amount_mm source");

assertIncludes(route, "scenarioOptions(row: Row | null | undefined): Row[]", "scenario options helper");
assertIncludes(route, "if (!row) return [];", "scenario missing returns empty options");
assertIncludes(route, "const noActionBaselinePresent = scenario ? hasNoActionBaseline(options) : false;", "scenario baseline requires real scenario");
assertIncludes(route, 'status: scenario ? "AVAILABLE" : "NOT_AVAILABLE"', "scenario status truth source");
assertIncludes(route, 'unavailable_reason: scenario ? null : "IRRIGATION_SCENARIO_SET_MISSING"', "scenario missing reason");

[
  "defaultScenarioOptions",
  "no_action_baseline_present: true",
  "app.post(",
  "app.put(",
  "app.patch(",
  "app.delete(",
  "INSERT INTO",
  "UPDATE ",
  "DELETE FROM",
  "createAoActTask",
  "dispatchNow",
  "approveNow"
].forEach((token) => assertNotIncludes(route, token, "operator twin route must not contain " + token));

assert(
  pkg.scripts && pkg.scripts["ci:governance:operator-twin-scope-contract"] === "node scripts/governance_acceptance/ACCEPTANCE_OPERATOR_TWIN_SCOPE_CONTRACT_V1.cjs",
  "package script ci:governance:operator-twin-scope-contract missing or incorrect",
  { actual: pkg.scripts && pkg.scripts["ci:governance:operator-twin-scope-contract"] }
);

console.log("[operator-twin-scope-contract] PASS");
