// scripts/frontend_acceptance/ACCEPTANCE_OPERATOR_TWIN_SHELL_V1.cjs
// Purpose: verify the first /operator/* shell exists and remains view-only.
// Boundary: this acceptance checks product-surface wiring, not agronomy algorithms.

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

const appPath = "apps/web/src/app/App.tsx";
const layoutPath = "apps/web/src/layouts/OperatorLayout.tsx";
const overviewPath = "apps/web/src/features/operator/pages/OperatorTwinOverviewPage.tsx";
const workspacePath = "apps/web/src/features/operator/pages/OperatorFieldTwinWorkspacePage.tsx";
const packagePath = "package.json";

const app = readText(appPath);
const layout = readText(layoutPath);
const overview = readText(overviewPath);
const workspace = readText(workspacePath);
const pkg = JSON.parse(readText(packagePath));

assertIncludes(app, "OperatorLayout", "operator layout import/use");
assertIncludes(app, "OperatorTwinOverviewPage", "operator twin overview lazy import");
assertIncludes(app, "OperatorFieldTwinWorkspacePage", "operator field workspace lazy import");
assertIncludes(app, 'path="/operator/*"', "operator top-level route");
assertIncludes(app, "function OperatorRoutes()", "operator routes function");
assertIncludes(app, "function OperatorShell()", "operator shell function");
assertIncludes(app, "<OperatorLayout>", "operator shell uses operator layout");

assertNotIncludes(app, 'path="/operator/*" element={<CustomerShell', "operator must not mount customer shell");
assertNotIncludes(app, 'path="/operator/*" element={<AdminShell', "operator must not mount admin shell");

assertIncludes(layout, 'data-layout="operator-shell"', "operator layout marker");
assertIncludes(layout, "Operator Twin Workbench", "operator product surface copy");
assertIncludes(layout, "情景只能进入 recommendation / approval 链路", "scenario boundary copy");
assertIncludes(layout, "分析与人工确认，不直接执行", "operator action boundary copy");

assertIncludes(overview, 'data-surface="operator-twin"', "overview surface marker");
assertIncludes(overview, 'data-page="operator-twin-overview"', "overview page marker");
assertIncludes(overview, "No direct execution", "overview no direct execution copy");
assertIncludes(overview, "fetchOperatorTwinOverview", "overview API source");

assertIncludes(workspace, 'data-page="operator-field-twin-workspace"', "workspace page marker");
assertIncludes(workspace, "Fact", "fact layer visible");
assertIncludes(workspace, "Estimate", "estimate layer visible");
assertIncludes(workspace, "Forecast", "forecast layer visible");
assertIncludes(workspace, "Scenario", "scenario layer visible");
assertIncludes(workspace, "Recommendation", "recommendation layer visible");
assertIncludes(workspace, "fetchOperatorFieldTwinWorkspace", "workspace API source");

[
  "createAoActTask",
  "dispatchNow",
  "approveNow",
  "sendTask",
  "POST /api/v1/control",
  "POST /api/control/ao_act/task"
].forEach((token) => {
  assertNotIncludes(overview + workspace + layout, token, "operator shell must not include direct write token " + token);
});

assert(
  pkg.scripts && pkg.scripts["ci:frontend:operator-twin-shell"] === "node scripts/frontend_acceptance/ACCEPTANCE_OPERATOR_TWIN_SHELL_V1.cjs",
  "package script ci:frontend:operator-twin-shell missing or incorrect",
  { actual: pkg.scripts && pkg.scripts["ci:frontend:operator-twin-shell"] }
);

console.log("[operator-twin-shell] PASS");
