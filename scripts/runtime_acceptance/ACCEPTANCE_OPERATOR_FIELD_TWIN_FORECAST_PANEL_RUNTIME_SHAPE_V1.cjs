// scripts/runtime_acceptance/ACCEPTANCE_OPERATOR_FIELD_TWIN_FORECAST_PANEL_RUNTIME_SHAPE_V1.cjs
// Purpose: verify H22-B runtime shape for Operator Field Twin Forecast Panel.
// Boundary: runtime must expose forecast_window_v1 and preserve in-window 24-72h risk; no action/control readiness.

const DEFAULT_BASE_URL = "http://127.0.0.1:3001";
const DEFAULT_TENANT_ID = "tenantA";
const DEFAULT_PROJECT_ID = "projectA";
const DEFAULT_GROUP_ID = "groupA";
const DEFAULT_FIELD_ID = "field_c8_demo";

const BASE_URL = String(process.env.GEOX_BASE_URL || process.env.BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
const TENANT_ID = String(process.env.GEOX_TENANT_ID || process.env.TENANT_ID || DEFAULT_TENANT_ID);
const PROJECT_ID = String(process.env.GEOX_PROJECT_ID || process.env.PROJECT_ID || DEFAULT_PROJECT_ID);
const GROUP_ID = String(process.env.GEOX_GROUP_ID || process.env.GROUP_ID || DEFAULT_GROUP_ID);
const FIELD_ID = String(process.env.GEOX_FIELD_ID || process.env.FIELD_ID || DEFAULT_FIELD_ID);

const AUTHORIZATION =
  process.env.GEOX_AUTHORIZATION ||
  process.env.AUTHORIZATION ||
  (process.env.GEOX_BEARER_TOKEN ? "Bearer " + process.env.GEOX_BEARER_TOKEN : "") ||
  (process.env.BEARER_TOKEN ? "Bearer " + process.env.BEARER_TOKEN : "") ||
  (process.env.GEOX_AO_ACT_TOKEN ? "Bearer " + process.env.GEOX_AO_ACT_TOKEN : "") ||
  (process.env.GEOX_TOKEN ? "Bearer " + process.env.GEOX_TOKEN : "");

const FORBIDDEN_VALUE_TOKENS = [
  "createAoActTask",
  "dispatchNow",
  "approveNow",
  "sendTask",
  "submitRecommendation",
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

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isString(value) {
  return typeof value === "string";
}

function isBoolean(value) {
  return typeof value === "boolean";
}

function valueText(value) {
  return JSON.stringify(value);
}

function assertNoForbiddenValues(value) {
  const text = valueText(value);
  for (const token of FORBIDDEN_VALUE_TOKENS) {
    assert(!text.includes(token), "Forecast runtime payload contains forbidden workflow token", { token });
  }
}

function buildUrl() {
  const params = new URLSearchParams();
  params.set("tenant_id", TENANT_ID);
  params.set("project_id", PROJECT_ID);
  params.set("group_id", GROUP_ID);

  return (
    BASE_URL +
    "/api/v1/operator/twin/fields/" +
    encodeURIComponent(FIELD_ID) +
    "/forecast?" +
    params.toString()
  );
}

function buildHeaders() {
  const headers = {
    "content-type": "application/json",
    "x-tenant-id": TENANT_ID,
    "x-project-id": PROJECT_ID,
    "x-group-id": GROUP_ID,
  };

  if (AUTHORIZATION) {
    headers.authorization = AUTHORIZATION;
  }

  return headers;
}

async function fetchJson(url) {
  let response;

  try {
    response = await fetch(url, {
      method: "GET",
      headers: buildHeaders(),
    });
  } catch (error) {
    throw new Error(
      "Operator field twin forecast panel runtime request failed at " +
        url +
        ". Ensure the server is running and H22 forecast panel route is mounted. " +
        (error && error.message ? error.message : String(error))
    );
  }

  const text = await response.text();

  let payload;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    throw new Error("Forecast runtime response was not JSON: " + text.slice(0, 400));
  }

  assert(response.ok, "Forecast runtime HTTP request failed", {
    url,
    status: response.status,
    payload,
  });

  return payload;
}

function assertTopLevel(payload) {
  assert(isObject(payload), "Forecast runtime payload must be an object", payload);
  assert(payload.ok === true, "Forecast runtime ok must be true", payload);
  assert(payload.source === "operator_field_twin_forecast_panel_api", "Forecast runtime source mismatch", payload);
  assert(payload.dataScope === "OFFICIAL_OPERATOR_TWIN_API", "Forecast runtime dataScope mismatch", payload);
  assert(payload.writeReady === false, "Forecast runtime writeReady must remain false", payload);
  assert(payload.dispatchReady === false, "Forecast runtime dispatchReady must remain false", payload);
  assert(payload.approvalReady === false, "Forecast runtime approvalReady must remain false", payload);
  assert(payload.taskCreationReady === false, "Forecast runtime taskCreationReady must remain false", payload);
}

function assertScopePolicy(panel) {
  assert(isObject(panel.scope_policy), "Forecast scope_policy must be object", panel.scope_policy);
  assert(panel.scope_policy.field_scope_required === true, "Forecast field_scope_required must be true", panel.scope_policy);
  assert(panel.scope_policy.required === true, "Forecast scope_policy.required must be true", panel.scope_policy);
  assert(panel.scope_policy.scope_applied === true, "Forecast scope_policy.scope_applied must be true", panel.scope_policy);
  assert(Array.isArray(panel.scope_policy.accepted_scope_keys), "Forecast accepted_scope_keys must be array", panel.scope_policy);
}

function assertFieldContext(panel) {
  assert(isObject(panel.field_context), "Forecast field_context must be object", panel.field_context);
  assert(panel.field_context.field_id === FIELD_ID, "Forecast field_id mismatch", panel.field_context);
  assert(isString(panel.field_context.field_name), "Forecast field_name must be string", panel.field_context);
  assert(isString(panel.field_context.crop_text), "Forecast crop_text must be string", panel.field_context);
}

function assertForecastWindow(panel) {
  const forecast = panel.forecast_window_v1;

  assert(isObject(forecast), "forecast_window_v1 must be object", forecast);
  assert(isString(forecast.available_horizon), "available_horizon must be string", forecast);
  assert(isBoolean(forecast.forecast_horizon_limited), "forecast_horizon_limited must be boolean", forecast);
  assert(Array.isArray(forecast.unavailable_horizons), "unavailable_horizons must be array", forecast);
  assert(isString(forecast.reason), "reason must be string", forecast);
  assert(Array.isArray(forecast.evidence_refs), "evidence_refs must be array", forecast);
  assert(Array.isArray(forecast.risk_timeline), "risk_timeline must be array", forecast);
  assert(forecast.risk_timeline.length >= 2, "risk_timeline must include at least in-window horizons", forecast);

  for (const item of forecast.risk_timeline) {
    assert(isObject(item), "risk_timeline item must be object", item);
    assert(isString(item.horizon), "risk_timeline horizon must be string", item);
    assert(isString(item.risk_text), "risk_timeline risk_text must be string", item);
    assert(isString(item.confidence_text), "risk_timeline confidence_text must be string", item);
    assert(Array.isArray(item.evidence_refs), "risk_timeline evidence_refs must be array", item);
  }

  const horizons = forecast.risk_timeline.map((item) => item.horizon);
  assert(horizons.includes("0-24h"), "risk_timeline must include 0-24h", forecast);
  assert(horizons.includes("24-72h"), "risk_timeline must include 24-72h", forecast);

  const inWindow = forecast.risk_timeline.find((item) => item.horizon === "24-72h");
  assert(isObject(inWindow), "24-72h risk bucket must exist", forecast);
  assert(
    inWindow.risk_text !== "RISK: FORECAST_WINDOW_LIMITED",
    "24-72h is within available_horizon and must preserve field risk",
    forecast
  );

  for (const horizon of forecast.unavailable_horizons) {
    const item = forecast.risk_timeline.find((entry) => entry.horizon === horizon);
    if (item) {
      assert(
        item.risk_text === "RISK: FORECAST_WINDOW_LIMITED",
        "Unavailable horizon may carry forecast-window-limited risk only outside the available window",
        { horizon, item }
      );
    }
  }
}

function assertBoundaryRules(panel) {
  assert(Array.isArray(panel.boundary_rules), "boundary_rules must be array", panel.boundary_rules);

  const codes = panel.boundary_rules.map((rule) => rule.rule_code);
  assert(codes.includes("NO_AO_ACT_TASK_CREATION"), "Forecast boundary must forbid AO-ACT task creation", codes);
  assert(codes.includes("NO_DISPATCH"), "Forecast boundary must forbid dispatch", codes);
  assert(codes.includes("NO_APPROVAL_BYPASS"), "Forecast boundary must forbid approval bypass", codes);
}

function assertForecastPanel(payload) {
  const panel = payload.operator_field_twin_forecast_panel_v1;

  assert(isObject(panel), "operator_field_twin_forecast_panel_v1 must be object", panel);
  assert(panel.version === "v1", "Forecast panel version must be v1", panel);
  assert(panel.surface === "OPERATOR", "Forecast panel surface must be OPERATOR", panel);
  assert(panel.report_kind === "OPERATOR_FIELD_TWIN_FORECAST_PANEL", "Forecast panel report_kind mismatch", panel);

  assertScopePolicy(panel);
  assertFieldContext(panel);
  assertForecastWindow(panel);

  assert(Array.isArray(panel.data_gaps), "Forecast panel data_gaps must be array", panel.data_gaps);
  assertBoundaryRules(panel);
  assertNoForbiddenValues(panel);
}

async function main() {
  const url = buildUrl();
  const payload = await fetchJson(url);

  assertTopLevel(payload);
  assertForecastPanel(payload);
  assertNoForbiddenValues(payload);

  console.log("[operator-field-twin-forecast-panel-runtime-shape] PASS");
}

main().catch((error) => {
  console.error("[operator-field-twin-forecast-panel-runtime-shape] FAIL");
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
