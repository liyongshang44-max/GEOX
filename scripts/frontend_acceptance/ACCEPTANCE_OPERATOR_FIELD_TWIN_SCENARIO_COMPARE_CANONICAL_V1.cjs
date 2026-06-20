// scripts/frontend_acceptance/ACCEPTANCE_OPERATOR_FIELD_TWIN_SCENARIO_COMPARE_CANONICAL_V1.cjs
// Purpose: verify H23-A canonical Operator Field Twin Scenario Compare contract.
// Boundary: scenario compare is read-only comparison only; no recommendation submit, approval, dispatch, or AO-ACT task creation.

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");

const APP_PATH = "apps/web/src/app/App.tsx";
const PAGE_PATH = "apps/web/src/features/operator/pages/OperatorFieldTwinScenarioComparePage.tsx";
const API_PATH = "apps/web/src/api/operatorTwin.ts";
const SERVER_PATH = "apps/server/src/routes/v1/operator_twin.ts";
const PACKAGE_JSON_PATH = "package.json";

const SCRIPT_NAME = "ci:frontend:operator-field-twin-scenario-compare-canonical";
const SCRIPT_COMMAND =
  "node scripts/frontend_acceptance/ACCEPTANCE_OPERATOR_FIELD_TWIN_SCENARIO_COMPARE_CANONICAL_V1.cjs";

const REQUIRED_APP_TOKENS = [
  "OperatorFieldTwinScenarioComparePage",
  'path="twin/fields/:fieldId/scenarios"',
];

const REQUIRED_PAGE_TOKENS = [
  'data-page="operator-field-twin-scenario-compare"',
  'data-contract="scenario_compare_v1"',
  "ScenarioCompareTable",
  'data-card="ScenarioCompareTable"',
  'data-card="ScenarioCompareStatus"',
  "scenario_compare_v1",
  "no_action_baseline_present",
  "options",
  "risk_delta",
  "confidence_text",
  "failure_conditions",
  "evidence_refs",
  "unavailable_reason",
  "返回 Field Twin",
  "查看 Forecast",
  "返回 Twin 总览",
];

const REQUIRED_API_TOKENS = [
  "OperatorScenarioCompareOption",
  "OperatorScenarioCompareV1",
  "OperatorFieldTwinScenarioCompareV1",
  "OperatorFieldTwinScenarioCompareResponse",
  "fetchOperatorFieldTwinScenarioCompare",
  'withScope("/api/v1/operator/twin/fields/" + safeFieldId + "/scenarios", scope)',
  "operator_field_twin_scenario_compare_v1",
];

const REQUIRED_SERVER_TOKENS = [
  "buildFieldScenarioCompare",
  "noActionBaselinePresent",
  "scenarioCompareAvailable",
  "NO_ACTION_BASELINE_OR_OPTIONS_NOT_AVAILABLE",
  "scenario_compare_v1",
  "no_action_baseline_present",
  "options:",
  "risk_delta",
  "confidence_text",
  "confidenceText(option)",
  "failure_conditions",
  "evidence_refs",
  "unavailable_reason",
  '"/api/v1/operator/twin/fields/:field_id/scenarios"',
  "operator_field_twin_scenario_compare_api",
  "operator_field_twin_scenario_compare_v1",
];

const FORBIDDEN_PAGE_TOKENS = [
  "submitRecommendation(",
  "createAoActTask",
  "dispatchNow",
  "approveNow",
  "sendTask",
  "/api/control",
  "/api/control/ao_act",
  "/approval",
  "/dispatch",
];

const FORBIDDEN_SERVER_TOKENS = [
  "confidence_text: nullableText(option.confidence_text ?? option.confidence)",
  "status: scenarioComparison.status === \"AVAILABLE\" ? \"AVAILABLE\" : \"NOT_AVAILABLE\"",
  "INSERT INTO ao_act_task",
  "ao_act_task_v0",
  "approval_decision_v1",
  "approval_request_v1",
  "operation_plan_transition_v1",
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

  assert(actual === SCRIPT_COMMAND, "H23 scenario compare package script missing or drifted", {
    scriptName: SCRIPT_NAME,
    expected: SCRIPT_COMMAND,
    actual,
  });
}

function main() {
  const app = read(APP_PATH);
  const page = read(PAGE_PATH);
  const api = read(API_PATH);
  const server = read(SERVER_PATH);

  assertTokens(app, REQUIRED_APP_TOKENS, APP_PATH, "H23 scenario compare route contract missing");
  assertTokens(page, REQUIRED_PAGE_TOKENS, PAGE_PATH, "H23 scenario compare page canonical contract missing");
  assertTokens(api, REQUIRED_API_TOKENS, API_PATH, "H23 scenario compare API client contract missing");
  assertTokens(server, REQUIRED_SERVER_TOKENS, SERVER_PATH, "H23 scenario compare server contract missing");

  assertNoTokens(page, FORBIDDEN_PAGE_TOKENS, PAGE_PATH, "H23 scenario compare page drifted into action workflow");
  assertNoTokens(server, FORBIDDEN_SERVER_TOKENS, SERVER_PATH, "H23 scenario compare server route contains forbidden write/control workflow");

  assertPackageScriptPinned();

  console.log("[operator-field-twin-scenario-compare-canonical] PASS");
}

try {
  main();
} catch (error) {
  console.error("[operator-field-twin-scenario-compare-canonical] FAIL");
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
}
