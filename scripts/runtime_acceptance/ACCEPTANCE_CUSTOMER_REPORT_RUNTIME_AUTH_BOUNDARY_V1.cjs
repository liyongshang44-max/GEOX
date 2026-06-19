// scripts/runtime_acceptance/ACCEPTANCE_CUSTOMER_REPORT_RUNTIME_AUTH_BOUNDARY_V1.cjs
// Purpose: verify customer report runtime auth boundary.
// Boundary: customer report APIs must require server-supported Authorization bearer auth; cookie-only auth is not a supported runtime path.

const BASE_URL = String(process.env.GEOX_BASE_URL || process.env.BASE_URL || "http://127.0.0.1:3001").replace(/\/$/, "");

const TENANT_ID = String(process.env.GEOX_TENANT_ID || process.env.TENANT_ID || "tenantA");
const PROJECT_ID = String(process.env.GEOX_PROJECT_ID || process.env.PROJECT_ID || "projectA");
const GROUP_ID = String(process.env.GEOX_GROUP_ID || process.env.GROUP_ID || "groupA");
const FIELD_ID = String(process.env.GEOX_FIELD_ID || process.env.FIELD_ID || "field_c8_demo");
const OPERATION_ID = String(process.env.GEOX_OPERATION_ID || process.env.OPERATION_ID || "op_plan_c8_irrigation_formal_001");

const AUTHORIZATION = String(process.env.GEOX_AUTHORIZATION || process.env.AUTHORIZATION || "").trim();
const BEARER_TOKEN = String(process.env.GEOX_BEARER_TOKEN || process.env.BEARER_TOKEN || "").trim();
const AO_ACT_TOKEN = String(process.env.GEOX_AO_ACT_TOKEN || "").trim();
const GEOX_TOKEN = String(process.env.GEOX_TOKEN || "").trim();

const MAX_ATTEMPTS = 10;
const RETRY_DELAY_MS = 750;

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

function supportedAuthorizationHeaders() {
  const authorization = resolvedAuthorizationHeader();

  if (!authorization) {
    throw new Error("Set GEOX_AUTHORIZATION, GEOX_BEARER_TOKEN, GEOX_AO_ACT_TOKEN, or GEOX_TOKEN before running this runtime acceptance.");
  }

  return { authorization };
}

function baseHeaders(extra = {}) {
  return {
    accept: "application/json",
    "x-tenant-id": TENANT_ID,
    "x-project-id": PROJECT_ID,
    "x-group-id": GROUP_ID,
    ...extra,
  };
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

const REPORT_ROUTES = [
  "/api/v1/reports/operation/" + encodeURIComponent(OPERATION_ID) + scopeQuery(),
  "/api/v1/reports/field/" + encodeURIComponent(FIELD_ID) + scopeQuery(),
  "/api/v1/reports/customer-dashboard/aggregate" + scopeQuery({ "field_ids[]": [FIELD_ID], time_range: "season" }),
];

async function fetchJson(routePath, headers) {
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(BASE_URL + routePath, {
        method: "GET",
        headers,
      });

      const text = await response.text();
      let json = null;

      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        throw new Error("NON_JSON_RESPONSE " + routePath + " status=" + response.status + " body=" + text.slice(0, 300));
      }

      return {
        status: response.status,
        ok: response.ok,
        json,
      };
    } catch (error) {
      lastError = error;

      if (attempt < MAX_ATTEMPTS) {
        await sleep(RETRY_DELAY_MS);
      }
    }
  }

  throw new Error(
    "Customer report runtime auth boundary request failed at " +
      BASE_URL +
      routePath +
      ". Ensure the server is running and C8 formal seed data exists. " +
      (lastError && lastError.message ? lastError.message : "")
  );
}

async function assertAuthMissing(routePath, headers, mode) {
  const result = await fetchJson(routePath, headers);

  assert(result.status === 401, "customer report route must reject " + mode + " with HTTP 401", {
    routePath,
    mode,
    status: result.status,
    body: result.json,
  });

  assert(result.json && result.json.ok === false && result.json.error === "AUTH_MISSING", "customer report route must return AUTH_MISSING for " + mode, {
    routePath,
    mode,
    status: result.status,
    body: result.json,
  });
}

async function assertBearerAuthorized(routePath) {
  const result = await fetchJson(routePath, baseHeaders(supportedAuthorizationHeaders()));

  assert(result.status === 200, "customer report route must accept supported Authorization bearer auth", {
    routePath,
    status: result.status,
    body: result.json,
  });

  assert(result.json && typeof result.json === "object", "authorized customer report response must be JSON object", {
    routePath,
    status: result.status,
    body: result.json,
  });
}

async function main() {
  for (const routePath of REPORT_ROUTES) {
    await assertAuthMissing(routePath, baseHeaders(), "missing auth");
  }

  for (const routePath of REPORT_ROUTES) {
    await assertAuthMissing(
      routePath,
      baseHeaders({
        cookie: "geox_token=placeholder-cookie-only-auth-is-not-supported",
      }),
      "cookie-only auth"
    );
  }

  for (const routePath of REPORT_ROUTES) {
    await assertBearerAuthorized(routePath);
  }

  console.log("[customer-report-runtime-auth-boundary] PASS");
}

main().catch((error) => {
  console.error("[customer-report-runtime-auth-boundary] FAIL");
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
