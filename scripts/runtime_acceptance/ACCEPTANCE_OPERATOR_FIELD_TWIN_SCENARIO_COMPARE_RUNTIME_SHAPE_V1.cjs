// scripts/runtime_acceptance/ACCEPTANCE_OPERATOR_FIELD_TWIN_SCENARIO_COMPARE_RUNTIME_SHAPE_V1.cjs
// Purpose: verify H23-B runtime shape for Operator Field Twin Scenario Compare.
// Boundary: runtime must expose scenario_compare_v1 only; no recommendation submit, approval, dispatch, or AO-ACT task creation.

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
  "submitRecommendation",
  "createAoActTask",
  "dispatchNow",
  "approveNow",
  "sendTask",
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
    assert(!text.includes(token), "Scenario runtime payload contains forbidden workflow token", { token });
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
    "/scenarios?" +
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
      "Operator field twin scenario compare runtime request failed at " +
        url +
        ". Ensure the server is running and H23 scenario route is mounted. " +
        (error && error.message ? error.message : String(error))
    );
  }

  const text = await response.text();

  let payload;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    throw new Error("Scenario runtime response was not JSON: " + text.slice(0, 400));
  }

  assert(response.ok, "Scenario runtime HTTP request failed", {
    url,
    status: response.status,
    payload,
  });

  return payload;
}

function assertTopLevel(payload) {
  assert(isObject(payload), "Scenario runtime payload must be an object", payload);
  assert(payload.ok === true, "Scenario runtime ok must be true", payload);
  assert(payload.source === "operator_field_twin_scenario_compare_api", "Scenario runtime source mismatch", payload);
  assert(payload.dataScope === "OFFICIAL_OPERATOR_TWIN_API", "Scenario runtime dataScope mismatch", payload);
  assert(payload.writeReady === false, "Scenario runtime writeReady must remain false", payload);
  assert(payload.dispatchReady === false, "Scenario runtime dispatchReady must remain false", payload);
  assert(payload.approvalReady === false, "Scenario runtime approvalReady must remain false", payload);
  assert(payload.taskCreationReady === false, "Scenario runtime taskCreationReady must remain false", payload);
}

function assertScopePolicy(panel) {
  assert(isObject(panel.scope_policy), "Scenario scope_policy must be object", panel.scope_policy);
  assert(panel.scope_policy.field_scope_required === true, "Scenario field_scope_required must be true", panel.scope_policy);
  assert(panel.scope_policy.required === true, "Scenario scope_policy.required must be true", panel.scope_policy);
  assert(panel.scope_policy.scope_applied === true, "Scenario scope_policy.scope_applied must be true", panel.scope_policy);
  assert(Array.isArray(panel.scope_policy.accepted_scope_keys), "Scenario accepted_scope_keys must be array", panel.scope_policy);
}

function assertFieldContext(panel) {
  assert(isObject(panel.field_context), "Scenario field_context must be object", panel.field_context);
  assert(panel.field_context.field_id === FIELD_ID, "Scenario field_id mismatch", panel.field_context);
  assert(isString(panel.field_context.field_name), "Scenario field_name must be string", panel.field_context);
  assert(isString(panel.field_context.crop_text), "Scenario crop_text must be string", panel.field_context);
}

function assertScenarioOption(option) {
  assert(isObject(option), "Scenario option must be object", option);
  assert(isString(option.option_id), "Scenario option_id must be string", option);
  assert(isString(option.label), "Scenario label must be string", option);
  assert(option.risk_delta === null || isString(option.risk_delta), "Scenario risk_delta must be string or null", option);
  assert(option.confidence_text === null || isString(option.confidence_text), "Scenario confidence_text must be string or null", option);
  assert(option.confidence_text !== "[object Object]", "Scenario confidence_text must not stringify structured confidence", option);
  assert(Array.isArray(option.failure_conditions), "Scenario failure_conditions must be array", option);
  for (const failureCondition of option.failure_conditions) {
    assert(isString(failureCondition), "Scenario failure condition must be string", option);
  }
}

function assertScenarioCompare(panel) {
  const compare = panel.scenario_compare_v1;

  assert(isObject(compare), "scenario_compare_v1 must be object", compare);
  assert(isBoolean(compare.no_action_baseline_present), "no_action_baseline_present must be boolean", compare);
  assert(Array.isArray(compare.options), "options must be array", compare);
  assert(Array.isArray(compare.evidence_refs), "evidence_refs must be array", compare);
  assert(compare.status === "AVAILABLE" || compare.status === "NOT_AVAILABLE", "scenario status must be enum", compare);
  assert(compare.unavailable_reason === null || isString(compare.unavailable_reason), "unavailable_reason must be string or null", compare);

  for (const option of compare.options) {
    assertScenarioOption(option);
  }

  if (compare.status === "AVAILABLE") {
    assert(compare.no_action_baseline_present === true, "AVAILABLE scenario compare must contain no-action baseline", compare);
    assert(compare.options.length > 0, "AVAILABLE scenario compare must expose options", compare);
  }

  if (compare.status === "NOT_AVAILABLE") {
    assert(compare.unavailable_reason !== "", "NOT_AVAILABLE scenario compare must not use empty unavailable_reason", compare);
  }
}

function assertBoundaryRules(panel) {
  assert(Array.isArray(panel.boundary_rules), "boundary_rules must be array", panel.boundary_rules);

  const codes = panel.boundary_rules.map((rule) => rule.rule_code);
  assert(codes.includes("NO_AO_ACT_TASK_CREATION"), "Scenario boundary must forbid AO-ACT task creation", codes);
  assert(codes.includes("NO_DISPATCH"), "Scenario boundary must forbid dispatch", codes);
  assert(codes.includes("NO_APPROVAL_BYPASS"), "Scenario boundary must forbid approval bypass", codes);
  assert(codes.includes("SCENARIO_IS_NOT_TASK"), "Scenario boundary must say scenario is not task", codes);
}

function assertScenarioPanel(payload) {
  const panel = payload.operator_field_twin_scenario_compare_v1;

  assert(isObject(panel), "operator_field_twin_scenario_compare_v1 must be object", panel);
  assert(panel.version === "v1", "Scenario panel version must be v1", panel);
  assert(panel.surface === "OPERATOR", "Scenario panel surface must be OPERATOR", panel);
  assert(panel.report_kind === "OPERATOR_FIELD_TWIN_SCENARIO_COMPARE", "Scenario panel report_kind mismatch", panel);

  assertScopePolicy(panel);
  assertFieldContext(panel);
  assertScenarioCompare(panel);

  assert(Array.isArray(panel.data_gaps), "Scenario panel data_gaps must be array", panel.data_gaps);
  assertBoundaryRules(panel);
  assertNoForbiddenValues(panel);
}

async function main() {
  const url = buildUrl();
  const payload = await fetchJson(url);

  assertTopLevel(payload);
  assertScenarioPanel(payload);
  assertNoForbiddenValues(payload);

  console.log("[operator-field-twin-scenario-compare-runtime-shape] PASS");
}

main().catch((error) => {
  console.error("[operator-field-twin-scenario-compare-runtime-shape] FAIL");
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
