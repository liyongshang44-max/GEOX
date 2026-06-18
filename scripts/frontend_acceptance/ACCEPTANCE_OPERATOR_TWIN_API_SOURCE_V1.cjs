// scripts/frontend_acceptance/ACCEPTANCE_OPERATOR_TWIN_API_SOURCE_V1.cjs
// Purpose: verify Operator Twin pages read from official operator twin API.
// Boundary: pages must not stay as static demo-only shell and must not expose direct execution writes.

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

const apiPath = "apps/web/src/api/operatorTwin.ts";
const overviewPath = "apps/web/src/features/operator/pages/OperatorTwinOverviewPage.tsx";
const workspacePath = "apps/web/src/features/operator/pages/OperatorFieldTwinWorkspacePage.tsx";
const shellAcceptancePath = "scripts/frontend_acceptance/ACCEPTANCE_OPERATOR_TWIN_SHELL_V1.cjs";
const packagePath = "package.json";

const api = readText(apiPath);
const overview = readText(overviewPath);
const workspace = readText(workspacePath);
const shellAcceptance = readText(shellAcceptancePath);
const pkg = JSON.parse(readText(packagePath));

assertIncludes(api, "/api/v1/operator/twin", "overview API endpoint");
assertIncludes(api, "/api/v1/operator/twin/fields/", "field workspace API endpoint");
assertIncludes(api, "fetchOperatorTwinOverview", "overview fetch function");
assertIncludes(api, "fetchOperatorFieldTwinWorkspace", "field workspace fetch function");
assertIncludes(api, "writeReady: false", "writeReady false typing");
assertIncludes(api, "taskCreationReady: false", "taskCreationReady false typing");

assertIncludes(overview, "fetchOperatorTwinOverview", "overview page uses API");
assertIncludes(overview, "operator_twin_overview_v1", "overview page reads projection");
assertIncludes(workspace, "fetchOperatorFieldTwinWorkspace", "workspace page uses API");
assertIncludes(workspace, "operator_field_twin_workspace_v1", "workspace page reads projection");

assertNotIncludes(overview, "const DEMO_ROWS", "overview must not use static demo rows");
assertNotIncludes(overview, "const DATA_GAPS", "overview must not use static data gaps");
assertNotIncludes(workspace, "const STATE_LAYERS", "workspace must not use static state layers");
assertNotIncludes(shellAcceptance, "field_c8_demo", "shell acceptance must not require static demo row");

[
  "createAoActTask",
  "dispatchNow",
  "approveNow",
  "sendTask",
  "POST /api/v1/control",
  "POST /api/control/ao_act/task"
].forEach((token) => {
  assertNotIncludes(api + overview + workspace, token, "operator twin frontend must not include direct write token " + token);
});

assert(
  pkg.scripts && pkg.scripts["ci:frontend:operator-twin-api-source"] === "node scripts/frontend_acceptance/ACCEPTANCE_OPERATOR_TWIN_API_SOURCE_V1.cjs",
  "package script ci:frontend:operator-twin-api-source missing or incorrect",
  { actual: pkg.scripts && pkg.scripts["ci:frontend:operator-twin-api-source"] }
);

console.log("[operator-twin-api-source] PASS");
