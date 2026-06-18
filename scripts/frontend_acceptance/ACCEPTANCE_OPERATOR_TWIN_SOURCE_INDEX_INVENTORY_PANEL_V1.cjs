// scripts/frontend_acceptance/ACCEPTANCE_OPERATOR_TWIN_SOURCE_INDEX_INVENTORY_PANEL_V1.cjs
// Purpose: verify Operator Twin overview exposes source-index inventory as read-only presentation.
// Boundary: no recommendations, approvals, dispatch, AO-ACT task creation, scoring, ranking, or prioritization.

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

const api = readText("apps/web/src/api/operatorTwin.ts");
const page = readText("apps/web/src/features/operator/pages/OperatorTwinOverviewPage.tsx");
const pkg = JSON.parse(readText("package.json"));

assertIncludes(api, "/api/v1/operator/twin/source-indexes", "source-index inventory endpoint");
assertIncludes(api, "fetchOperatorTwinSourceIndexInventory", "source-index inventory fetch function");
assertIncludes(api, "operator_twin_source_index_inventory_v1", "source-index inventory projection key");
assertIncludes(api, "OperatorTwinSourceIndexInventoryV1", "source-index inventory response type");
assertIncludes(api, "writeReady: false", "writeReady false typing");
assertIncludes(api, "dispatchReady: false", "dispatchReady false typing");
assertIncludes(api, "approvalReady: false", "approvalReady false typing");
assertIncludes(api, "taskCreationReady: false", "taskCreationReady false typing");

assertIncludes(page, "fetchOperatorTwinSourceIndexInventory", "overview page fetches inventory");
assertIncludes(page, "SourceIndexInventoryCard", "source-index inventory card");
assertIncludes(page, "data-card=\"operator-twin-source-index-inventory\"", "inventory card marker");
assertIncludes(page, "data-table=\"operator-twin-source-index-inventory\"", "inventory table marker");
assertIncludes(page, "latest_ts_ms", "latest timestamp presentation");
assertIncludes(page, "latest_evidence_refs", "latest evidence refs presentation");
assertIncludes(page, "scope_columns_present", "scope column presentation");
assertIncludes(page, "row_count", "row count presentation");
assertIncludes(page, "available_table_count", "available table count presentation");

[
  "createAoActTask",
  "dispatchNow",
  "approveNow",
  "sendTask",
  "POST /api/v1/control",
  "POST /api/control/ao_act/task",
  "recommendNow",
  "score",
  "rank",
  "priority",
  "severityPill",
  "statusRed",
  "statusYellow",
  "statusGreen",
  "riskRed",
  "riskYellow",
  "riskGreen",
  "trafficLight",
].forEach((token) => {
  assertNotIncludes(api + page, token, "operator twin inventory panel must not include " + token);
});

assert(
  pkg.scripts &&
    pkg.scripts["ci:frontend:operator-twin-source-index-inventory-panel"] ===
      "node scripts/frontend_acceptance/ACCEPTANCE_OPERATOR_TWIN_SOURCE_INDEX_INVENTORY_PANEL_V1.cjs",
  "package script ci:frontend:operator-twin-source-index-inventory-panel missing or incorrect",
  { actual: pkg.scripts && pkg.scripts["ci:frontend:operator-twin-source-index-inventory-panel"] }
);

console.log("[operator-twin-source-index-inventory-panel] PASS");
