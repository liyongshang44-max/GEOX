#!/usr/bin/env node

// scripts/runtime_acceptance/ACCEPTANCE_THREE_SURFACE_LOCAL_PAGE_SMOKE_V1.cjs
// Purpose: runtime smoke-test for Customer, Operator, and Admin local page backing APIs.
// Boundary: this script performs authenticated read-only requests.
// Boundary: this script verifies that local three-surface page backing APIs do not return 404, 401, 403, or 5xx.
// Boundary: this script verifies that Customer, Operator, and Admin API envelopes do not expose cross-surface write/dispatch capabilities.
// Boundary: this script does not create recommendation, approval, operation plan, AO-ACT task, dispatch, receipt, ROI ledger, or Field Memory records.

const assert = require("node:assert/strict");

const BASE_URL = (
  process.env.THREE_SURFACE_BASE_URL ||
  process.env.BASE_URL ||
  "http://127.0.0.1:3001"
).replace(/\/+$/, "");

const TOKEN =
  process.env.GEOX_ACCEPTANCE_TOKEN ||
  process.env.ACCEPTANCE_TOKEN ||
  process.env.AUTH_TOKEN ||
  process.env.CUSTOMER_TOKEN ||
  process.env.OPERATOR_TOKEN ||
  process.env.ADMIN_TOKEN ||
  "";

const TENANT_ID =
  process.env.GEOX_TENANT_ID ||
  process.env.TENANT_ID ||
  "tenantA";

const PROJECT_ID =
  process.env.GEOX_PROJECT_ID ||
  process.env.PROJECT_ID ||
  "projectA";

const GROUP_ID =
  process.env.GEOX_GROUP_ID ||
  process.env.GROUP_ID ||
  "groupA";

const FIELD_ID =
  process.env.THREE_SURFACE_FIELD_ID ||
  process.env.FIELD_ID ||
  "field_demo_001";

assert.ok(
  TOKEN,
  "GEOX_ACCEPTANCE_TOKEN / ACCEPTANCE_TOKEN / AUTH_TOKEN required for protected local smoke acceptance"
);

function expectedSurface(path) {
  if (path.startsWith("/api/v1/customer/")) return "CUSTOMER";
  if (path.startsWith("/api/v1/operator/")) return "OPERATOR";
  if (path.startsWith("/api/v1/admin/")) return "ADMIN";
  throw new Error(`Unknown surface for path: ${path}`);
}

function authHeaders() {
  return {
    accept: "application/json",
    authorization: `Bearer ${TOKEN}`
  };
}

function scopedPath(path) {
  const scope = new URLSearchParams({
    tenant_id: TENANT_ID,
    project_id: PROJECT_ID,
    group_id: GROUP_ID
  });

  return `${path}${path.includes("?") ? "&" : "?"}${scope.toString()}`;
}

function hasKeyDeep(value, pattern) {
  if (!value || typeof value !== "object") return false;

  for (const [key, child] of Object.entries(value)) {
    if (pattern.test(key)) return true;
    if (hasKeyDeep(child, pattern)) return true;
  }

  return false;
}

async function getJson(path) {
  const url = `${BASE_URL}${scopedPath(path)}`;

  const response = await fetch(url, {
    method: "GET",
    headers: authHeaders()
  });

  const text = await response.text();

  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw_text: text };
  }

  assert.notStrictEqual(response.status, 404, `${path} must not be 404: ${JSON.stringify(body)}`);
  assert.ok(response.status < 500, `${path} must not be 5xx: ${JSON.stringify(body)}`);
  assert.notStrictEqual(response.status, 401, `${path} must not be unauthorized: ${JSON.stringify(body)}`);
  assert.notStrictEqual(response.status, 403, `${path} must not be forbidden: ${JSON.stringify(body)}`);

  return { status: response.status, body };
}

(async () => {
  const paths = [
    `/api/v1/customer/fields/${encodeURIComponent(FIELD_ID)}/confirmed-twin-summary`,
    `/api/v1/operator/twin/fields/${encodeURIComponent(FIELD_ID)}`,
    `/api/v1/operator/twin/fields/${encodeURIComponent(FIELD_ID)}/scenarios`,
    `/api/v1/operator/twin/fields/${encodeURIComponent(FIELD_ID)}/evidence`,
    `/api/v1/operator/twin/fields/${encodeURIComponent(FIELD_ID)}/calibration`,
    `/api/v1/operator/twin/fields/${encodeURIComponent(FIELD_ID)}/post-irrigation`,
    "/api/v1/admin/dashboard",
    "/api/v1/admin/operations",
    "/api/v1/admin/evidence",
    "/api/v1/admin/healthz"
  ];

  for (const path of paths) {
    const { body } = await getJson(path);
    const surface = expectedSurface(path);

    assert.ok(body && typeof body === "object", `${path} must return a JSON object`);
    assert.strictEqual(body.ok, true, `${path} must return ok=true`);
    assert.strictEqual(body.surface, surface, `${path} surface`);

    assert.notStrictEqual(body.writeReady, true, `${path} must not expose writeReady=true`);
    assert.notStrictEqual(body.taskCreationReady, true, `${path} must not expose taskCreationReady=true`);
    assert.notStrictEqual(body.dispatchReady, true, `${path} must not expose dispatchReady=true`);
    assert.notStrictEqual(body.approvalReady, true, `${path} must not expose approvalReady=true`);

    if (surface === "CUSTOMER") {
      assert.strictEqual(
        hasKeyDeep(body, /operator_field_twin_workspace_v1|operator_twin_overview_v1|admin_control_plane_v1|debug/i),
        false,
        `${path} must not expose operator/debug/admin payload`
      );
    }

    if (surface === "ADMIN") {
      assert.strictEqual(
        hasKeyDeep(body, /forecast|scenario/i),
        false,
        `${path} must not expose forecast/scenario main payload keys`
      );
    }
  }

  console.log("[three-surface-local-page-smoke] PASS");
})().catch((error) => {
  console.error("[three-surface-local-page-smoke] FAIL");
  console.error(error);
  process.exit(1);
});