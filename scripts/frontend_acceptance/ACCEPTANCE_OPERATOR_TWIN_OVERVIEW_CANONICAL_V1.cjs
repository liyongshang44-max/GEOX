// scripts/frontend_acceptance/ACCEPTANCE_OPERATOR_TWIN_OVERVIEW_CANONICAL_V1.cjs
// Purpose: verify H20 OperatorShell + Twin Overview canonical contract.
// Boundary: /operator/twin is read-only; it shows field state, risk, data gaps, and low-confidence status, but cannot submit recommendations, approve, dispatch, or create AO-ACT tasks.

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");

const APP_PATH = "apps/web/src/app/App.tsx";
const OPERATOR_LAYOUT_PATH = "apps/web/src/layouts/OperatorLayout.tsx";
const OVERVIEW_PAGE_PATH = "apps/web/src/features/operator/pages/OperatorTwinOverviewPage.tsx";
const API_PATH = "apps/web/src/api/operatorTwin.ts";
const SERVER_ROUTE_PATH = "apps/server/src/routes/v1/operator_twin.ts";
const PACKAGE_JSON_PATH = "package.json";

const SCRIPT_NAME = "ci:frontend:operator-twin-overview-canonical";
const SCRIPT_COMMAND =
  "node scripts/frontend_acceptance/ACCEPTANCE_OPERATOR_TWIN_OVERVIEW_CANONICAL_V1.cjs";

const REQUIRED_APP_TOKENS = [
  'path="/operator/*"',
  "OperatorShell",
  'path="twin"',
  "OperatorTwinOverviewPage",
  "OperatorLayout",
];

const REQUIRED_LAYOUT_TOKENS = [
  "GEOX Operator Twin",
  "Operator Twin Workbench",
  "分析与人工确认，不直接执行",
  "Scenario 不能当作 Task",
];

const REQUIRED_PAGE_TOKENS = [
  "operator_twin_overview_v1",
  "fetchOperatorTwinOverview",
  "田块状态矩阵",
  "数据缺口",
  "人工确认边界",
  "risk_text",
  "low_confidence",
  "LOW_CONFIDENCE",
  "No direct execution",
  "data-page=\"operator-twin-overview\"",
];

const REQUIRED_API_TOKENS = [
  "OperatorTwinOverviewV1",
  "risk_text: string",
  "low_confidence: boolean",
  "writeReady: false",
  "dispatchReady: false",
  "approvalReady: false",
  "taskCreationReady: false",
  'withScope("/api/v1/operator/twin", scope)',
];

const REQUIRED_SERVER_TOKENS = [
  'app.get("/api/v1/operator/twin"',
  "operator_twin_overview_v1",
  "buildOverview",
  "risk_text",
  "low_confidence",
  "riskText(",
  "isLowConfidence(",
  "if (!level && !Number.isFinite(score)) return true",
  "level.includes(\"PENDING\")",
  "level.includes(\"UNKNOWN\")",
  "level.includes(\"待确认\")",
  "writeReady: false",
  "dispatchReady: false",
  "approvalReady: false",
  "taskCreationReady: false",
];

const FORBIDDEN_PAGE_TOKENS = [
  "SubmitScenarioToRecommendationPanel",
  "submitRecommendation",
  "createAoActTask",
  "dispatchNow",
  "approveNow",
  "sendTask",
  "/api/control",
  "/api/control/ao_act",
  "/api/v1/admin",
  "/api/admin",
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

  assert(actual === SCRIPT_COMMAND, "H20 operator twin overview package script missing or drifted", {
    scriptName: SCRIPT_NAME,
    expected: SCRIPT_COMMAND,
    actual,
  });
}

function main() {
  const app = read(APP_PATH);
  const layout = read(OPERATOR_LAYOUT_PATH);
  const page = read(OVERVIEW_PAGE_PATH);
  const api = read(API_PATH);
  const server = read(SERVER_ROUTE_PATH);

  assertTokens(app, REQUIRED_APP_TOKENS, APP_PATH, "H20 operator twin route contract missing");
  assertTokens(layout, REQUIRED_LAYOUT_TOKENS, OPERATOR_LAYOUT_PATH, "H20 operator shell contract missing");
  assertTokens(page, REQUIRED_PAGE_TOKENS, OVERVIEW_PAGE_PATH, "H20 operator twin overview page contract missing");
  assertTokens(api, REQUIRED_API_TOKENS, API_PATH, "H20 operator twin overview API contract missing");
  assertTokens(server, REQUIRED_SERVER_TOKENS, SERVER_ROUTE_PATH, "H20 operator twin overview server contract missing");

  assertNoTokens(page, FORBIDDEN_PAGE_TOKENS, OVERVIEW_PAGE_PATH, "H20 operator twin overview page contains forbidden action/control token");
  assertPackageScriptPinned();

  console.log("[operator-twin-overview-canonical] PASS");
}

try {
  main();
} catch (error) {
  console.error("[operator-twin-overview-canonical] FAIL");
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
}
