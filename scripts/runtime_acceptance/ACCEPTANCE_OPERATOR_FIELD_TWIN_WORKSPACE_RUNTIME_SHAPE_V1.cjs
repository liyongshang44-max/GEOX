// scripts/runtime_acceptance/ACCEPTANCE_OPERATOR_FIELD_TWIN_WORKSPACE_RUNTIME_SHAPE_V1.cjs
// Purpose: verify H21 Operator Field Twin Workspace runtime response shape through real HTTP.
// Boundary: field workspace runtime payload is read-only and cannot expose execution, approval, dispatch, or AO-ACT creation readiness.

const BASE_URL = String(process.env.GEOX_BASE_URL || process.env.BASE_URL || "http://127.0.0.1:3001").replace(/\/$/, "");

const TENANT_ID = String(process.env.GEOX_TENANT_ID || process.env.TENANT_ID || "tenantA");
const PROJECT_ID = String(process.env.GEOX_PROJECT_ID || process.env.PROJECT_ID || "projectA");
const GROUP_ID = String(process.env.GEOX_GROUP_ID || process.env.GROUP_ID || "groupA");
const FIELD_ID = String(process.env.GEOX_FIELD_ID || process.env.FIELD_ID || "field_c8_demo");

const AUTHORIZATION = String(process.env.GEOX_AUTHORIZATION || process.env.AUTHORIZATION || "").trim();
const BEARER_TOKEN = String(process.env.GEOX_BEARER_TOKEN || process.env.BEARER_TOKEN || "").trim();
const AO_ACT_TOKEN = String(process.env.GEOX_AO_ACT_TOKEN || "").trim();
const GEOX_TOKEN = String(process.env.GEOX_TOKEN || "").trim();

const MAX_ATTEMPTS = 10;
const RETRY_DELAY_MS = 750;

const FORBIDDEN_VALUE_TOKENS = [
  "/api/control",
  "/api/control/ao_act",
  "POST /api/control/ao_act/task",
  "createAoActTask",
  "dispatchNow",
  "approveNow",
  "sendTask",
  "taskCreationReady: true",
  "approvalReady: true",
  "dispatchReady: true",
  "writeReady: true",
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assert(condition, message, detail) {
  if (!condition) {
    const suffix = detail === undefined ? "" : "\n" + JSON.stringify(detail, null, 2);
    throw new Error(message + suffix);
  }
}

function assertAsciiHeaderValue(name, value) {
  if (!value) return;

  assert(!/[<>]/.test(value), "runtime auth header contains placeholder delimiters; replace it with a real credential", {
    name,
  });

  assert(/^[\x20-\x7E]+$/.test(value), "runtime auth header must contain ASCII header-safe characters only", {
    name,
  });
}

function resolvedAuthorizationHeader() {
  assertAsciiHeaderValue("GEOX_AUTHORIZATION/AUTHORIZATION", AUTHORIZATION);
  assertAsciiHeaderValue("GEOX_BEARER_TOKEN/BEARER_TOKEN", BEARER_TOKEN);
  assertAsciiHeaderValue("GEOX_AO_ACT_TOKEN", AO_ACT_TOKEN);
  assertAsciiHeaderValue("GEOX_TOKEN", GEOX_TOKEN);

  if (AUTHORIZATION) return AUTHORIZATION;
  if (BEARER_TOKEN) return "Bearer " + BEARER_TOKEN;
  if (AO_ACT_TOKEN) return "Bearer " + AO_ACT_TOKEN;
  if (GEOX_TOKEN) return "Bearer " + GEOX_TOKEN;

  return "";
}

function authHeaders() {
  const authorization = resolvedAuthorizationHeader();

  if (!authorization) {
    return {};
  }

  return { authorization };
}

function scopeQuery(extra = {}) {
  const params = new URLSearchParams();

  params.set("tenant_id", TENANT_ID);
  params.set("project_id", PROJECT_ID);
  params.set("group_id", GROUP_ID);

  for (const [key, value] of Object.entries(extra)) {
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, String(item));
      continue;
    }

    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  }

  return "?" + params.toString();
}

async function fetchJson(routePath) {
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(BASE_URL + routePath, {
        method: "GET",
        headers: {
          accept: "application/json",
          "x-tenant-id": TENANT_ID,
          "x-project-id": PROJECT_ID,
          "x-group-id": GROUP_ID,
          ...authHeaders(),
        },
      });

      const text = await response.text();
      let json = null;

      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        throw new Error("NON_JSON_RESPONSE " + routePath + " status=" + response.status + " body=" + text.slice(0, 300));
      }

      if (!response.ok) {
        if (response.status === 401 && json && json.error === "AUTH_MISSING") {
          throw new Error(
            "GET " +
              routePath +
              " failed with AUTH_MISSING. Set GEOX_AUTHORIZATION, GEOX_BEARER_TOKEN, GEOX_AO_ACT_TOKEN, or GEOX_TOKEN before running this runtime acceptance."
          );
        }

        throw new Error("GET " + routePath + " failed with HTTP " + response.status + ": " + JSON.stringify(json).slice(0, 600));
      }

      return json;
    } catch (error) {
      lastError = error;

      if (attempt < MAX_ATTEMPTS) {
        await sleep(RETRY_DELAY_MS);
      }
    }
  }

  throw new Error(
    "Operator field twin workspace runtime request failed at " +
      BASE_URL +
      routePath +
      ". Ensure the server is running and H21 field workspace source indexes exist. " +
      (lastError && lastError.message ? lastError.message : "")
  );
}

function isObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function assertObject(value, label) {
  assert(isObject(value), label + " must be an object", { value });
}

function assertArray(value, label) {
  assert(Array.isArray(value), label + " must be an array", { value });
}

function assertString(value, label) {
  assert(typeof value === "string", label + " must be a string", { value });
}

function assertBoolean(value, label) {
  assert(typeof value === "boolean", label + " must be a boolean", { value });
}

function assertNoForbiddenValueTokens(value, jsonPath = "$") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoForbiddenValueTokens(item, jsonPath + "[" + index + "]"));
    return;
  }

  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      assertNoForbiddenValueTokens(child, jsonPath + "." + key);
    }
    return;
  }

  if (typeof value === "string") {
    for (const token of FORBIDDEN_VALUE_TOKENS) {
      assert(!value.includes(token), "operator field twin workspace runtime payload exposes forbidden value token", {
        jsonPath,
        token,
        value,
      });
    }
  }
}

function assertCurrentStateShape(workspace) {
  const state = workspace.current_state;
  assertObject(state, "current_state");

  assertString(state.state_text, "current_state.state_text");
  assertString(state.risk_text, "current_state.risk_text");
  assertBoolean(state.low_confidence, "current_state.low_confidence");
  assertString(state.confidence_text, "current_state.confidence_text");
  assert(state.classification === "Estimate", "current_state.classification must remain Estimate", {
    actual: state.classification,
  });
  assertArray(state.evidence_refs, "current_state.evidence_refs");

  if (state.confidence_text === "置信度待确认") {
    assert(state.low_confidence === true, "pending confidence must remain low_confidence=true", {
      current_state: state,
    });
  }

  if (state.state_text === "水分状态待确认") {
    assert(state.low_confidence === true, "missing water state estimate must remain low_confidence=true", {
      current_state: state,
    });
  }
}

function assertWorkspaceShape(workspace) {
  assertObject(workspace, "operator_field_twin_workspace_v1");

  assert(workspace.report_kind === "OPERATOR_FIELD_TWIN_WORKSPACE", "workspace report_kind mismatch", {
    actual: workspace.report_kind,
  });
  assert(workspace.surface === "OPERATOR", "workspace surface mismatch", {
    actual: workspace.surface,
  });

  assertObject(workspace.scope_policy, "scope_policy");
  assert(workspace.scope_policy.field_scope_required === true, "field workspace must require field scope", {
    scope_policy: workspace.scope_policy,
  });

  assertObject(workspace.field_context, "field_context");
  assert(workspace.field_context.field_id === FIELD_ID, "field_context.field_id must match requested field id", {
    expected: FIELD_ID,
    actual: workspace.field_context.field_id,
  });

  assertCurrentStateShape(workspace);

  assertObject(workspace.data_coverage, "data_coverage");
  assertString(workspace.data_coverage.coverage_text, "data_coverage.coverage_text");
  assertBoolean(workspace.data_coverage.sensing_available, "data_coverage.sensing_available");
  assertBoolean(workspace.data_coverage.weather_available, "data_coverage.weather_available");
  assertArray(workspace.data_coverage.evidence_refs, "data_coverage.evidence_refs");

  assertObject(workspace.forecast_window, "forecast_window");
  assertString(workspace.forecast_window.available_horizon, "forecast_window.available_horizon");
  assertBoolean(workspace.forecast_window.forecast_horizon_limited, "forecast_window.forecast_horizon_limited");
  assertArray(workspace.forecast_window.unavailable_horizons, "forecast_window.unavailable_horizons");
  assertString(workspace.forecast_window.reason, "forecast_window.reason");

  assertObject(workspace.scenario_comparison, "scenario_comparison");
  assertBoolean(workspace.scenario_comparison.no_action_baseline_present, "scenario_comparison.no_action_baseline_present");
  assertArray(workspace.scenario_comparison.options, "scenario_comparison.options");
  assertArray(workspace.scenario_comparison.evidence_refs, "scenario_comparison.evidence_refs");
  assertString(workspace.scenario_comparison.status, "scenario_comparison.status");

  assertObject(workspace.recommendation_candidate, "recommendation_candidate");
  assertBoolean(workspace.recommendation_candidate.human_approval_required, "recommendation_candidate.human_approval_required");
  assertBoolean(workspace.recommendation_candidate.no_direct_execution, "recommendation_candidate.no_direct_execution");
  assert(workspace.recommendation_candidate.human_approval_required === true, "recommendation candidate must require human approval");
  assert(workspace.recommendation_candidate.no_direct_execution === true, "recommendation candidate must not allow direct execution");
  assertArray(workspace.recommendation_candidate.evidence_refs, "recommendation_candidate.evidence_refs");

  assertArray(workspace.layers, "layers");
  const layerNames = new Set(workspace.layers.map((layer) => layer && layer.layer));
  for (const expectedLayer of ["Fact", "Estimate", "Forecast", "Scenario", "Recommendation"]) {
    assert(layerNames.has(expectedLayer), "workspace layer missing", {
      expectedLayer,
      actualLayers: [...layerNames],
    });
  }

  assertArray(workspace.data_gaps, "data_gaps");
  assertArray(workspace.boundary_rules, "boundary_rules");

  const boundaryCodes = new Set(workspace.boundary_rules.map((rule) => rule && rule.rule_code));
  for (const expectedRule of ["NO_AO_ACT_TASK_CREATION", "NO_DISPATCH", "NO_APPROVAL_BYPASS", "SCENARIO_IS_NOT_TASK"]) {
    assert(boundaryCodes.has(expectedRule), "workspace boundary rule missing", {
      expectedRule,
      actualRules: [...boundaryCodes],
    });
  }
}

async function main() {
  const routePath = "/api/v1/operator/twin/fields/" + encodeURIComponent(FIELD_ID) + scopeQuery();
  const json = await fetchJson(routePath);

  assert(json && json.ok === true, "operator field twin workspace response must be ok", { json });
  assert(json.writeReady === false, "operator field twin workspace top-level writeReady must be false", { writeReady: json.writeReady });
  assert(json.dispatchReady === false, "operator field twin workspace top-level dispatchReady must be false", { dispatchReady: json.dispatchReady });
  assert(json.approvalReady === false, "operator field twin workspace top-level approvalReady must be false", { approvalReady: json.approvalReady });
  assert(json.taskCreationReady === false, "operator field twin workspace top-level taskCreationReady must be false", {
    taskCreationReady: json.taskCreationReady,
  });

  assertObject(json.operator_field_twin_workspace_v1, "operator_field_twin_workspace_v1");
  assertWorkspaceShape(json.operator_field_twin_workspace_v1);
  assertNoForbiddenValueTokens(json);

  console.log("[operator-field-twin-workspace-runtime-shape] PASS");
}

main().catch((error) => {
  console.error("[operator-field-twin-workspace-runtime-shape] FAIL");
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
