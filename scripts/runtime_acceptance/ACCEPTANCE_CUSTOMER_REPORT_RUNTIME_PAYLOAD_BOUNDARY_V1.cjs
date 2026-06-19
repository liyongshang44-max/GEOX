// scripts/runtime_acceptance/ACCEPTANCE_CUSTOMER_REPORT_RUNTIME_PAYLOAD_BOUNDARY_V1.cjs
// Purpose: verify customer report runtime JSON payload boundary through real HTTP responses.
// Boundary: customer report APIs must not expose Operator/Admin/Control/Source-Index/raw/debug/internal payload fields.

const BASE_URL = String(process.env.GEOX_BASE_URL || process.env.BASE_URL || "http://127.0.0.1:3001").replace(/\/$/, "");

const TENANT_ID = String(process.env.GEOX_TENANT_ID || process.env.TENANT_ID || "tenantA");
const PROJECT_ID = String(process.env.GEOX_PROJECT_ID || process.env.PROJECT_ID || "projectA");
const GROUP_ID = String(process.env.GEOX_GROUP_ID || process.env.GROUP_ID || "groupA");
const FIELD_ID = String(process.env.GEOX_FIELD_ID || process.env.FIELD_ID || "field_c8_demo");
const OPERATION_ID = String(process.env.GEOX_OPERATION_ID || process.env.OPERATION_ID || "op_plan_c8_irrigation_formal_001");

const MAX_ATTEMPTS = 10;
const RETRY_DELAY_MS = 750;

const AUTHORIZATION = String(process.env.GEOX_AUTHORIZATION || process.env.AUTHORIZATION || "").trim();
const BEARER_TOKEN = String(process.env.GEOX_BEARER_TOKEN || process.env.BEARER_TOKEN || "").trim();

function assertAsciiHeaderValue(name, value) {
  if (!value) return;

  assert(!/[<>]/.test(value), "runtime auth header contains placeholder delimiters; replace it with a real credential", {
    name,
  });

  assert(/^[\x20-\x7E]+$/.test(value), "runtime auth header must contain ASCII header-safe characters only", {
    name,
  });
}

function authHeaders() {
  const headers = {};

  assertAsciiHeaderValue("GEOX_AUTHORIZATION/AUTHORIZATION", AUTHORIZATION);
  assertAsciiHeaderValue("GEOX_BEARER_TOKEN/BEARER_TOKEN", BEARER_TOKEN);

  if (AUTHORIZATION) {
    headers.authorization = AUTHORIZATION;
  } else if (BEARER_TOKEN) {
    headers.authorization = "Bearer " + BEARER_TOKEN;
  }


  return headers;
}

const FORBIDDEN_KEYS = new Set([
  "operator_twin_source_index_inventory_v1",
  "source_indexes",
  "sourceIndexes",
  "scope_columns_present",
  "scopeColumnsPresent",
  "table_name",
  "tableName",
  "row_count",
  "rowCount",
  "latest_ts_ms",
  "latestTsMs",
  "latest_evidence_refs",
  "latestEvidenceRefs",
  "raw_payload",
  "rawPayload",
  "record_json",
  "recordJson",
  "debug_payload",
  "debugPayload",
  "debug_json",
  "debugJson",
  "internal_payload",
  "internalPayload",
  "admin_payload",
  "adminPayload",
  "operator_payload",
  "operatorPayload",
]);

const FORBIDDEN_VALUE_TOKENS = [
  "operator_twin_source_index_inventory_v1",
  "OPERATOR_TWIN_SOURCE_INDEX_INVENTORY",
  "/api/v1/operator",
  "/api/v1/admin",
  "/api/admin",
  "/api/control",
  "/api/control/ao_act",
  "POST /api/control/ao_act/task",
  "createAoActTask",
  "dispatchNow",
  "approveNow",
  "sendTask",
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
              " failed with AUTH_MISSING. Set GEOX_AUTHORIZATION or GEOX_BEARER_TOKEN before running this runtime acceptance."
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
    "Customer report runtime payload boundary request failed at " +
      BASE_URL +
      routePath +
      ". Ensure the server is running and C8 formal seed data exists. " +
      (lastError && lastError.message ? lastError.message : "")
  );
}

function assertNoForbiddenPayload(value, routePath, jsonPath = "$") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoForbiddenPayload(item, routePath, jsonPath + "[" + index + "]"));
    return;
  }

  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      assert(!FORBIDDEN_KEYS.has(key), "customer report runtime payload exposes forbidden key", {
        routePath,
        jsonPath,
        key,
      });

      assertNoForbiddenPayload(child, routePath, jsonPath + "." + key);
    }

    return;
  }

  if (typeof value === "string") {
    for (const token of FORBIDDEN_VALUE_TOKENS) {
      assert(!value.includes(token), "customer report runtime payload exposes forbidden value token", {
        routePath,
        jsonPath,
        token,
        value,
      });
    }
  }
}

function assertAllowedReportProjectionShape(payload, routePath, shapeKind) {
  const topLevelKeys = Object.keys(payload);

  if (shapeKind === "operation") {
    const operationReport =
      payload.operation_report_v1 && typeof payload.operation_report_v1 === "object"
        ? payload.operation_report_v1
        : payload;

    assert(
      operationReport &&
        typeof operationReport === "object" &&
        operationReport.type === "operation_report_v1" &&
        operationReport.identifiers &&
        typeof operationReport.identifiers === "object",
      "operation report runtime payload missing required operation_report_v1 projection shape",
      {
        routePath,
        topLevelKeys,
        type: operationReport && operationReport.type,
        hasIdentifiers: Boolean(operationReport && operationReport.identifiers),
      }
    );

    return;
  }

  if (shapeKind === "field") {
    const fieldReport =
      payload.field_report_v1 && typeof payload.field_report_v1 === "object"
        ? payload.field_report_v1
        : payload;

    assert(
      fieldReport &&
        typeof fieldReport === "object" &&
        fieldReport.type === "field_report_v1" &&
        fieldReport.field &&
        typeof fieldReport.field === "object",
      "field report runtime payload missing required field_report_v1 projection shape",
      {
        routePath,
        topLevelKeys,
        type: fieldReport && fieldReport.type,
        hasField: Boolean(fieldReport && fieldReport.field),
      }
    );

    return;
  }

  if (shapeKind === "dashboard") {
    const aggregate =
      payload.customer_dashboard_aggregate_v1 && typeof payload.customer_dashboard_aggregate_v1 === "object"
        ? payload.customer_dashboard_aggregate_v1
        : payload.aggregate && typeof payload.aggregate === "object"
          ? payload.aggregate
          : payload.data && typeof payload.data === "object"
            ? payload.data
            : payload;

    assert(
      aggregate &&
        typeof aggregate === "object" &&
        aggregate.fields &&
        typeof aggregate.fields === "object" &&
        Array.isArray(aggregate.recent_operations) &&
        aggregate.risk_summary &&
        typeof aggregate.risk_summary === "object",
      "customer dashboard runtime payload missing required aggregate projection shape",
      {
        routePath,
        topLevelKeys,
        hasFields: Boolean(aggregate && aggregate.fields),
        hasRecentOperations: Boolean(aggregate && Array.isArray(aggregate.recent_operations)),
        hasRiskSummary: Boolean(aggregate && aggregate.risk_summary),
      }
    );

    return;
  }

  throw new Error("UNKNOWN_REPORT_SHAPE_KIND " + shapeKind);
}

async function assertCustomerReport(routePath, shapeKind) {
  const payload = await fetchJson(routePath);

  assert(payload && typeof payload === "object", "customer report runtime payload must be object", {
    routePath,
    payload,
  });

  assertNoForbiddenPayload(payload, routePath);
  assertAllowedReportProjectionShape(payload, routePath, shapeKind);
}

async function main() {
  await assertCustomerReport(
    "/api/v1/reports/operation/" + encodeURIComponent(OPERATION_ID) + scopeQuery(),
    "operation"
  );

  await assertCustomerReport(
    "/api/v1/reports/field/" + encodeURIComponent(FIELD_ID) + scopeQuery(),
    "field"
  );

  await assertCustomerReport(
    "/api/v1/reports/customer-dashboard/aggregate" + scopeQuery({ "field_ids[]": [FIELD_ID], time_range: "season" }),
    "dashboard"
  );

  console.log("[customer-report-runtime-payload-boundary] PASS");
}

main().catch((error) => {
  console.error("[customer-report-runtime-payload-boundary] FAIL");
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
