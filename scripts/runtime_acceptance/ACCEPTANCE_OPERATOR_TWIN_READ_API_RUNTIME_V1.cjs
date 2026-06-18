// scripts/runtime_acceptance/ACCEPTANCE_OPERATOR_TWIN_READ_API_RUNTIME_V1.cjs
// Purpose: verify Operator Twin read API runtime behavior through real HTTP requests.
// Boundary: this script performs GET requests only and must not mutate facts, approvals, dispatches, or AO-ACT tasks.

const BASE_URL = String(process.env.GEOX_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const TENANT_ID = String(process.env.GEOX_TENANT_ID || "T_ACCEPTANCE");
const PROJECT_ID = String(process.env.GEOX_PROJECT_ID || "P_DEFAULT");
const GROUP_ID = String(process.env.GEOX_GROUP_ID || "G_CAF");
const FIELD_ID = String(process.env.GEOX_FIELD_ID || "field_c8_demo");

function assert(condition, message, detail) {
  if (!condition) {
    const suffix = detail === undefined ? "" : "\n" + JSON.stringify(detail, null, 2);
    throw new Error(message + suffix);
  }
}

function valueAt(object, path) {
  return path.split(".").reduce((cursor, key) => {
    if (cursor === null || cursor === undefined) return undefined;
    return cursor[key];
  }, object);
}

function assertFlagFalse(payload, key) {
  assert(payload[key] === false, "expected read-only flag to be false: " + key, { actual: payload[key] });
}

function scopeQuery() {
  const params = new URLSearchParams();
  params.set("tenant_id", TENANT_ID);
  params.set("project_id", PROJECT_ID);
  params.set("group_id", GROUP_ID);
  return "?" + params.toString();
}

async function fetchJson(path) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(BASE_URL + path, {
      method: "GET",
      signal: controller.signal,
      headers: {
        accept: "application/json",
      },
    });

    const text = await response.text();
    let json = null;

    try {
      json = text ? JSON.parse(text) : null;
    } catch (error) {
      throw new Error("NON_JSON_RESPONSE " + path + " status=" + response.status + " body=" + text.slice(0, 300));
    }

    assert(response.ok, "HTTP request failed: " + path, { status: response.status, body: json });
    return json;
  } catch (error) {
    if (error && error.name === "AbortError") {
      throw new Error("HTTP request timed out: " + path);
    }

    if (String(error && error.message || "").includes("fetch failed")) {
      throw new Error("GEOX server is not reachable at " + BASE_URL + ". Start the server before running this runtime acceptance.");
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function assertBaseEnvelope(payload, source) {
  assert(payload && payload.ok === true, "expected ok true", payload);
  assert(payload.source === source, "unexpected source", { expected: source, actual: payload.source });
  assert(payload.dataScope === "OFFICIAL_OPERATOR_TWIN_API", "unexpected dataScope", payload);
  assertFlagFalse(payload, "writeReady");
  assertFlagFalse(payload, "dispatchReady");
  assertFlagFalse(payload, "approvalReady");
  assertFlagFalse(payload, "taskCreationReady");
}

function assertOverview(payload, expectedScopeApplied) {
  assertBaseEnvelope(payload, "operator_twin_overview_api");

  const overview = payload.operator_twin_overview_v1;
  assert(overview && overview.report_kind === "OPERATOR_TWIN_OVERVIEW", "missing overview projection", payload);
  assert(overview.scope_policy && overview.scope_policy.required === true, "missing overview scope_policy", overview);
  assert(overview.scope_policy.scope_applied === expectedScopeApplied, "unexpected overview scope_applied", {
    expectedScopeApplied,
    actual: overview.scope_policy.scope_applied,
    request_scope: overview.request_scope,
  });
  assert(Array.isArray(overview.fields), "overview fields must be array", overview.fields);
  assert(Array.isArray(overview.data_gaps), "overview data_gaps must be array", overview.data_gaps);
  assert(Array.isArray(overview.boundary_rules), "overview boundary_rules must be array", overview.boundary_rules);

  if (!expectedScopeApplied) {
    assert(overview.fields.length === 0, "unscoped overview must not expose fields", overview.fields);
    assert(overview.scope_policy.missing_reason === "TENANT_PROJECT_OR_GROUP_SCOPE_REQUIRED", "unscoped overview missing_reason mismatch", overview.scope_policy);
  }

  if (expectedScopeApplied) {
    const tenant = valueAt(overview, "request_scope.tenantId") || valueAt(overview, "request_scope.tenant_id");
    const project = valueAt(overview, "request_scope.projectId") || valueAt(overview, "request_scope.project_id");
    const group = valueAt(overview, "request_scope.groupId") || valueAt(overview, "request_scope.group_id");

    assert(tenant === TENANT_ID, "overview tenant scope mismatch", { expected: TENANT_ID, actual: tenant, request_scope: overview.request_scope });
    assert(project === PROJECT_ID, "overview project scope mismatch", { expected: PROJECT_ID, actual: project, request_scope: overview.request_scope });
    assert(group === GROUP_ID, "overview group scope mismatch", { expected: GROUP_ID, actual: group, request_scope: overview.request_scope });
  }
}

function assertWorkspace(payload, expectedScopeApplied) {
  assertBaseEnvelope(payload, "operator_field_twin_workspace_api");

  const workspace = payload.operator_field_twin_workspace_v1;
  assert(workspace && workspace.report_kind === "OPERATOR_FIELD_TWIN_WORKSPACE", "missing workspace projection", payload);
  assert(workspace.field_context && workspace.field_context.field_id === FIELD_ID, "workspace field_id mismatch", workspace.field_context);
  assert(workspace.scope_policy && workspace.scope_policy.required === true, "missing workspace scope_policy", workspace);
  assert(workspace.scope_policy.field_scope_required === true, "workspace must declare field_scope_required", workspace.scope_policy);
  assert(workspace.scope_policy.scope_applied === expectedScopeApplied, "unexpected workspace scope_applied", {
    expectedScopeApplied,
    actual: workspace.scope_policy.scope_applied,
    request_scope: workspace.request_scope,
  });

  assert(workspace.current_state && workspace.current_state.classification === "Estimate", "workspace current_state invalid", workspace.current_state);
  assert(workspace.scenario_comparison && Array.isArray(workspace.scenario_comparison.options), "workspace scenario_comparison invalid", workspace.scenario_comparison);
  assert(workspace.recommendation_candidate && workspace.recommendation_candidate.human_approval_required === true, "recommendation must require human approval", workspace.recommendation_candidate);
  assert(workspace.recommendation_candidate.no_direct_execution === true, "recommendation must not allow direct execution", workspace.recommendation_candidate);

  if (!expectedScopeApplied) {
    assert(workspace.scope_policy.missing_reason === "TENANT_PROJECT_OR_GROUP_SCOPE_REQUIRED", "unscoped workspace missing_reason mismatch", workspace.scope_policy);
  }

  if (workspace.scenario_comparison.status === "NOT_AVAILABLE") {
    assert(workspace.scenario_comparison.options.length === 0, "missing scenario evidence must not expose synthetic options", workspace.scenario_comparison);
    assert(workspace.scenario_comparison.no_action_baseline_present === false, "missing scenario evidence must not claim baseline", workspace.scenario_comparison);
    assert(workspace.scenario_comparison.unavailable_reason === "IRRIGATION_SCENARIO_SET_MISSING", "missing scenario reason mismatch", workspace.scenario_comparison);
  }
}

async function main() {
  const unscopedOverview = await fetchJson("/api/v1/operator/twin");
  assertOverview(unscopedOverview, false);

  const scopedOverview = await fetchJson("/api/v1/operator/twin" + scopeQuery());
  assertOverview(scopedOverview, true);

  const unscopedWorkspace = await fetchJson("/api/v1/operator/twin/fields/" + encodeURIComponent(FIELD_ID));
  assertWorkspace(unscopedWorkspace, false);

  const scopedWorkspace = await fetchJson("/api/v1/operator/twin/fields/" + encodeURIComponent(FIELD_ID) + scopeQuery());
  assertWorkspace(scopedWorkspace, true);

  console.log("[operator-twin-read-api-runtime] PASS");
}

main().catch((error) => {
  console.error("[operator-twin-read-api-runtime] FAIL");
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
