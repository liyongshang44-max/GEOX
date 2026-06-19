// scripts/frontend_acceptance/ACCEPTANCE_OPERATOR_FIELD_TWIN_WORKSPACE_NAVIGATION_V1.cjs
// Purpose: verify H21 Operator Twin overview-to-field-workspace navigation contract.
// Boundary: overview rows must enter /operator/twin/fields/:fieldId with the same read-only scope query, not operation/task/control routes.

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");

const APP_PATH = "apps/web/src/app/App.tsx";
const OVERVIEW_PAGE_PATH = "apps/web/src/features/operator/pages/OperatorTwinOverviewPage.tsx";
const FIELD_PAGE_PATH = "apps/web/src/features/operator/pages/OperatorFieldTwinWorkspacePage.tsx";
const API_PATH = "apps/web/src/api/operatorTwin.ts";
const SERVER_ROUTE_PATH = "apps/server/src/routes/v1/operator_twin.ts";
const PACKAGE_JSON_PATH = "package.json";

const SCRIPT_NAME = "ci:frontend:operator-field-twin-workspace-navigation";
const SCRIPT_COMMAND =
  "node scripts/frontend_acceptance/ACCEPTANCE_OPERATOR_FIELD_TWIN_WORKSPACE_NAVIGATION_V1.cjs";

const REQUIRED_APP_TOKENS = [
  'path="/operator/*"',
  "OperatorShell",
  'path="twin"',
  "OperatorTwinOverviewPage",
  'path="twin/fields/:fieldId"',
  "OperatorFieldTwinWorkspacePage",
];

const REQUIRED_OVERVIEW_TOKENS = [
  "buildOperatorTwinScopeQuery",
  "scopeQueryString",
  "row.twin_href + scopeQueryString",
  'data-link="operator-field-twin-workspace"',
  "data-field-id={row.field_id}",
  "进入 Field Twin",
  "operator_twin_overview_v1",
];

const REQUIRED_FIELD_PAGE_TOKENS = [
  'data-page="operator-field-twin-workspace"',
  'data-contract="operator_field_twin_workspace_v1"',
  'to={"/operator/twin" + scopeQueryString}',
  "返回 Twin 总览",
];

const REQUIRED_API_TOKENS = [
  "OperatorTwinOverviewV1",
  "twin_href: string",
  "buildOperatorTwinScopeQuery",
  'withScope("/api/v1/operator/twin/fields/" + safeFieldId, scope)',
];

const REQUIRED_SERVER_TOKENS = [
  'app.get("/api/v1/operator/twin"',
  'app.get("/api/v1/operator/twin/fields/:field_id"',
  "twin_href",
  "/operator/twin/fields/",
  "field_id: fieldId",
  "operator_field_twin_workspace_v1",
];

const FORBIDDEN_OVERVIEW_TOKENS = [
  "/operator/twin/operations",
  "/operator/twin/tasks",
  "/operator/twin/approvals",
  "/api/control",
  "/api/control/ao_act",
  "operation_id",
  "act_task_id",
  "createAoActTask",
  "dispatchNow",
  "approveNow",
  "sendTask",
  "submitRecommendation(",
];

const FORBIDDEN_FIELD_PAGE_TOKENS = [
  "/operator/twin/operations",
  "/operator/twin/tasks",
  "/operator/twin/approvals",
  "/api/control",
  "/api/control/ao_act",
  "createAoActTask",
  "dispatchNow",
  "approveNow",
  "sendTask",
  "submitRecommendation(",
];

function assert(condition, message, detail) {
  if (!condition) {
    const suffix = detail === undefined ? "" : "\n" + JSON.stringify(detail, null, 2);
    throw new Error(message + suffix);
  }
}

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8").replace(/\r\n/g, "\n");
}

function assertTokens(source, tokens, relPath, message) {
  for (const token of tokens) {
    assert(source.includes(token), message, { path: relPath, token });
  }
}

function assertNoTokens(source, tokens, relPath, message) {
  for (const token of tokens) {
    assert(!source.includes(token), message, { path: relPath, token });
  }
}

function assertPackageScriptPinned() {
  const pkg = JSON.parse(read(PACKAGE_JSON_PATH));
  const actual = pkg.scripts && pkg.scripts[SCRIPT_NAME];

  assert(actual === SCRIPT_COMMAND, "H21 field workspace navigation package script missing or drifted", {
    scriptName: SCRIPT_NAME,
    expected: SCRIPT_COMMAND,
    actual,
  });
}

function main() {
  const app = read(APP_PATH);
  const overview = read(OVERVIEW_PAGE_PATH);
  const fieldPage = read(FIELD_PAGE_PATH);
  const api = read(API_PATH);
  const server = read(SERVER_ROUTE_PATH);

  assertTokens(app, REQUIRED_APP_TOKENS, APP_PATH, "H21 field workspace navigation route contract missing");
  assertTokens(overview, REQUIRED_OVERVIEW_TOKENS, OVERVIEW_PAGE_PATH, "H21 overview-to-field-workspace link contract missing");
  assertTokens(fieldPage, REQUIRED_FIELD_PAGE_TOKENS, FIELD_PAGE_PATH, "H21 field workspace back-navigation contract missing");
  assertTokens(api, REQUIRED_API_TOKENS, API_PATH, "H21 field workspace navigation API contract missing");
  assertTokens(server, REQUIRED_SERVER_TOKENS, SERVER_ROUTE_PATH, "H21 field workspace navigation server contract missing");

  assertNoTokens(overview, FORBIDDEN_OVERVIEW_TOKENS, OVERVIEW_PAGE_PATH, "H21 overview navigation contains forbidden operation/task/control route");
  assertNoTokens(fieldPage, FORBIDDEN_FIELD_PAGE_TOKENS, FIELD_PAGE_PATH, "H21 field workspace page contains forbidden operation/task/control route");

  assertPackageScriptPinned();

  console.log("[operator-field-twin-workspace-navigation] PASS");
}

try {
  main();
} catch (error) {
  console.error("[operator-field-twin-workspace-navigation] FAIL");
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
}
