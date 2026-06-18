// scripts/frontend_acceptance/ACCEPTANCE_OPERATOR_TWIN_INVENTORY_DEGRADE_GUARD_V1.cjs
// Purpose: prevent source-index inventory failure from hiding the Operator Twin overview.
// Boundary: static frontend guard only; no backend calls and no user action surface.

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

function sliceFrom(text, startNeedle, endNeedle) {
  const start = text.indexOf(startNeedle);
  assert(start >= 0, "start marker not found", { startNeedle });

  const end = text.indexOf(endNeedle, start);
  assert(end > start, "end marker not found", { endNeedle });

  return text.slice(start, end);
}

const page = readText("apps/web/src/features/operator/pages/OperatorTwinOverviewPage.tsx");
const pkg = JSON.parse(readText("package.json"));

assertIncludes(page, "fetchOperatorTwinOverview(scope)", "overview fetch call");
assertIncludes(page, "fetchOperatorTwinSourceIndexInventory(scope)", "inventory fetch call");
assertIncludes(page, "inventoryLoadState", "inventory local load state");
assertIncludes(page, "inventoryError", "inventory local error state");
assertIncludes(page, "setInventoryLoadState(\"error\")", "inventory error state transition");
assertIncludes(page, "setInventoryError(", "inventory local error recording");
assertIncludes(page, "SourceIndexInventoryCard", "inventory panel component");
assertIncludes(page, "loadState={inventoryLoadState}", "inventory panel receives local load state");
assertIncludes(page, "error={inventoryError}", "inventory panel receives local error");

assertNotIncludes(
  page,
  "Promise.all([fetchOperatorTwinOverview(scope), fetchOperatorTwinSourceIndexInventory(scope)])",
  "overview and inventory must not be coupled by Promise.all"
);

assertNotIncludes(
  page,
  "Promise.allSettled([fetchOperatorTwinOverview(scope), fetchOperatorTwinSourceIndexInventory(scope)])",
  "overview and inventory must not be coupled by Promise.allSettled"
);

const overviewBlock = sliceFrom(page, "void fetchOperatorTwinOverview(scope)", "void fetchOperatorTwinSourceIndexInventory(scope)");
const inventoryBlock = sliceFrom(page, "void fetchOperatorTwinSourceIndexInventory(scope)", "return () => {");

assertIncludes(overviewBlock, "setOverview(nextOverview)", "overview success owns overview state");
assertIncludes(overviewBlock, "setState(nextOverview.fields.length > 0 ? \"ready\" : \"empty\")", "overview success owns page state");
assertIncludes(overviewBlock, "setState(\"error\")", "overview failure may own page error state");
assertNotIncludes(overviewBlock, "setInventoryLoadState(\"error\")", "overview fetch must not own inventory error state");

assertIncludes(inventoryBlock, "setInventory(response.operator_twin_source_index_inventory_v1)", "inventory success owns inventory state");
assertIncludes(inventoryBlock, "setInventoryLoadState(\"ready\")", "inventory success owns inventory ready state");
assertIncludes(inventoryBlock, "setInventoryLoadState(\"error\")", "inventory failure owns inventory error state");
assertIncludes(inventoryBlock, "setInventoryError(", "inventory failure records panel-local error");
assertNotIncludes(inventoryBlock, "setState(\"error\")", "inventory failure must not hide overview");
assertNotIncludes(inventoryBlock, "setOverview(null)", "inventory failure must not clear overview");
assertNotIncludes(inventoryBlock, "throw new Error", "inventory failure must not throw through page load");

[
  "createAoActTask",
  "dispatchNow",
  "approveNow",
  "sendTask",
  "recommendNow",
  "priority",
  "severityPill",
  "trafficLight",
].forEach((token) => {
  assertNotIncludes(page, token, "degrade guard must not introduce action or scoring token " + token);
});

assert(
  pkg.scripts &&
    pkg.scripts["ci:frontend:operator-twin-inventory-degrade-guard"] ===
      "node scripts/frontend_acceptance/ACCEPTANCE_OPERATOR_TWIN_INVENTORY_DEGRADE_GUARD_V1.cjs",
  "package script ci:frontend:operator-twin-inventory-degrade-guard missing or incorrect",
  { actual: pkg.scripts && pkg.scripts["ci:frontend:operator-twin-inventory-degrade-guard"] }
);

console.log("[operator-twin-inventory-degrade-guard] PASS");
