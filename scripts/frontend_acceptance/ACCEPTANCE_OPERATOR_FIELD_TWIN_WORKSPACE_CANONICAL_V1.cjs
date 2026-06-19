// scripts/frontend_acceptance/ACCEPTANCE_OPERATOR_FIELD_TWIN_WORKSPACE_CANONICAL_V1.cjs
// Purpose: verify H21 Operator Field Twin Workspace canonical contract.
// Boundary: /operator/twin/fields/:fieldId is field-centered, read-only, and cannot create tasks, approve, dispatch, or submit recommendations.

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");

const APP_PATH = "apps/web/src/app/App.tsx";
const PAGE_PATH = "apps/web/src/features/operator/pages/OperatorFieldTwinWorkspacePage.tsx";
const API_PATH = "apps/web/src/api/operatorTwin.ts";
const SERVER_ROUTE_PATH = "apps/server/src/routes/v1/operator_twin.ts";
const PACKAGE_JSON_PATH = "package.json";

const SCRIPT_NAME = "ci:frontend:operator-field-twin-workspace-canonical";
const SCRIPT_COMMAND =
  "node scripts/frontend_acceptance/ACCEPTANCE_OPERATOR_FIELD_TWIN_WORKSPACE_CANONICAL_V1.cjs";

const REQUIRED_APP_TOKENS = [
  "OperatorFieldTwinWorkspacePage",
  'path="twin/fields/:fieldId"',
];

const REQUIRED_PAGE_TOKENS = [
  "operator_field_twin_workspace_v1",
  "fetchOperatorFieldTwinWorkspace",
  "TwinStateVectorCard",
  "DataCoverageMatrix",
  "EvidenceSummary",
  "RecommendationCandidate",
  "field_id 为入口",
  "operation_id 不作为入口",
  "risk_text",
  "low_confidence",
  "evidence_refs",
  "Scenario 不能当作 Task",
  "本页只读，不提交 recommendation",
  "data-page=\"operator-field-twin-workspace\"",
];

const REQUIRED_API_TOKENS = [
  "OperatorFieldTwinWorkspaceV1",
  "field_context",
  `current_state: {
    state_text: string;
    risk_text: string;
    low_confidence: boolean;
    confidence_text: string;`,
  "data_coverage",
  "forecast_window",
  "scenario_comparison",
  "recommendation_candidate",
  "evidence_refs",
  'withScope("/api/v1/operator/twin/fields/" + safeFieldId, scope)',
];

const REQUIRED_SERVER_TOKENS = [
  'app.get("/api/v1/operator/twin/fields/:field_id"',
  "buildFieldWorkspace",
  "report_kind: \"OPERATOR_FIELD_TWIN_WORKSPACE\"",
  "field_scope_required: true",
  "risk_text: riskText(waterState, recommendation, scenario)",
  "low_confidence: isLowConfidence(waterState ?? recommendation ?? scenario)",
  "no_direct_execution: true",
  "human_approval_required: true",
  "defaultBoundaryRules()",
];

const FORBIDDEN_PAGE_TOKENS = [
  "createAoActTask",
  "dispatchNow",
  "approveNow",
  "sendTask",
  "submitRecommendation(",
  "SubmitScenarioToRecommendationPanel",
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

  assert(actual === SCRIPT_COMMAND, "H21 operator field twin workspace package script missing or drifted", {
    scriptName: SCRIPT_NAME,
    expected: SCRIPT_COMMAND,
    actual,
  });
}

function main() {
  const app = read(APP_PATH);
  const page = read(PAGE_PATH);
  const api = read(API_PATH);
  const server = read(SERVER_ROUTE_PATH);

  assertTokens(app, REQUIRED_APP_TOKENS, APP_PATH, "H21 operator field twin workspace route contract missing");
  assertTokens(page, REQUIRED_PAGE_TOKENS, PAGE_PATH, "H21 operator field twin workspace page contract missing");
  assertTokens(api, REQUIRED_API_TOKENS, API_PATH, "H21 operator field twin workspace API contract missing");
  assertTokens(server, REQUIRED_SERVER_TOKENS, SERVER_ROUTE_PATH, "H21 operator field twin workspace server contract missing");

  assertNoTokens(page, FORBIDDEN_PAGE_TOKENS, PAGE_PATH, "H21 operator field twin workspace page contains forbidden action/control token");
  assertPackageScriptPinned();

  console.log("[operator-field-twin-workspace-canonical] PASS");
}

try {
  main();
} catch (error) {
  console.error("[operator-field-twin-workspace-canonical] FAIL");
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
}
