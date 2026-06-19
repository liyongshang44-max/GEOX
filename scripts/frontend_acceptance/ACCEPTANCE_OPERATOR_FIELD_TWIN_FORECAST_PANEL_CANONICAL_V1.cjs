// scripts/frontend_acceptance/ACCEPTANCE_OPERATOR_FIELD_TWIN_FORECAST_PANEL_CANONICAL_V1.cjs
// Purpose: verify H22-A canonical Operator Field Twin Forecast Panel contract.
// Boundary: forecast panel only exposes forecast_window_v1 and ForecastRiskTimeline; no scenario compare, recommendation submit, approval, dispatch, or AO-ACT task creation.

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");

const APP_PATH = "apps/web/src/app/App.tsx";
const PAGE_PATH = "apps/web/src/features/operator/pages/OperatorFieldTwinForecastPage.tsx";
const API_PATH = "apps/web/src/api/operatorTwin.ts";
const SERVER_PATH = "apps/server/src/routes/v1/operator_twin.ts";
const PACKAGE_JSON_PATH = "package.json";

const SCRIPT_NAME = "ci:frontend:operator-field-twin-forecast-panel-canonical";
const SCRIPT_COMMAND =
  "node scripts/frontend_acceptance/ACCEPTANCE_OPERATOR_FIELD_TWIN_FORECAST_PANEL_CANONICAL_V1.cjs";

const REQUIRED_APP_TOKENS = [
  "OperatorFieldTwinForecastPage",
  'path="twin/fields/:fieldId/forecast"',
];

const REQUIRED_PAGE_TOKENS = [
  'data-page="operator-field-twin-forecast-panel"',
  'data-contract="forecast_window_v1"',
  "ForecastRiskTimeline",
  'data-card="ForecastRiskTimeline"',
  'data-card="ForecastWindowCard"',
  "forecast_window_v1",
  "available_horizon",
  "forecast_horizon_limited",
  "unavailable_horizons",
  "reason",
  "evidence_refs",
  "risk_timeline",
  "返回 Field Twin",
  "返回 Twin 总览",
];

const REQUIRED_API_TOKENS = [
  "OperatorFieldTwinForecastPanelV1",
  "OperatorForecastWindowV1",
  "OperatorForecastRiskTimelineItem",
  "OperatorFieldTwinForecastPanelResponse",
  "fetchOperatorFieldTwinForecastPanel",
  'withScope("/api/v1/operator/twin/fields/" + safeFieldId + "/forecast", scope)',
  "operator_field_twin_forecast_panel_v1",
];

const REQUIRED_SERVER_TOKENS = [
  "buildFieldForecastPanel",
  "forecast_window_v1",
  "forecastRiskTimeline",
  "forecastEvidenceRefs",
  "unavailableHorizons",
  "risk_text: risk",
  "RISK: FORECAST_WINDOW_LIMITED",
  '"/api/v1/operator/twin/fields/:field_id/forecast"',
  "operator_field_twin_forecast_panel_api",
  "operator_field_twin_forecast_panel_v1",
  "LONG_RANGE_FORECAST_RUN_NOT_AVAILABLE",
];

const FORBIDDEN_PAGE_TOKENS = [
  "ScenarioCompareTable",
  "scenario_comparison.options.map",
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
  'risk_text: workspace?.forecast_window?.forecast_horizon_limited ? "RISK: FORECAST_WINDOW_LIMITED" : risk',
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

  assert(actual === SCRIPT_COMMAND, "H22 forecast panel package script missing or drifted", {
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

  assertTokens(app, REQUIRED_APP_TOKENS, APP_PATH, "H22 forecast route contract missing");
  assertTokens(page, REQUIRED_PAGE_TOKENS, PAGE_PATH, "H22 forecast page canonical contract missing");
  assertTokens(api, REQUIRED_API_TOKENS, API_PATH, "H22 forecast API client contract missing");
  assertTokens(server, REQUIRED_SERVER_TOKENS, SERVER_PATH, "H22 forecast server contract missing");

  assertNoTokens(page, FORBIDDEN_PAGE_TOKENS, PAGE_PATH, "H22 forecast page drifted into scenario/action workflow");
  assertNoTokens(server, FORBIDDEN_SERVER_TOKENS, SERVER_PATH, "H22 forecast server route contains forbidden write/control workflow");

  assertPackageScriptPinned();

  console.log("[operator-field-twin-forecast-panel-canonical] PASS");
}

try {
  main();
} catch (error) {
  console.error("[operator-field-twin-forecast-panel-canonical] FAIL");
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
}
