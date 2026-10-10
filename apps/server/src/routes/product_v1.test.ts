import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import {
  registerProductV1Routes,
  type CustomerProductProjectionReadBuilderV1,
} from "./product_v1.js";

const NOW = "2026-09-23T00:05:00.000Z";

function envelope(type: "CUSTOMER_OVERVIEW" | "FIELD_SUMMARY" | "FIELD_WORKSPACE", fieldId: string | null) {
  return {
    projection_id: `projection-${type.toLowerCase()}-${fieldId ?? "all"}`,
    projection_type: type,
    projection_schema_version: "geox.product-projection.v1",
    generated_at: NOW,
    derivation_version: "geox.customer-product-projection.derivation.v1",
    subject_scope: {
      tenant_id: "tenant-a",
      project_id: "project-a",
      group_id: "group-a",
      field_id: fieldId,
      zone_id: fieldId ? "zone-a" : null,
      season_id: fieldId ? "season-a" : null,
    },
    source_authority_refs: [],
    source_non_authority_refs: [],
    source_content_digests: [],
    source_effective_interval: {
      mode: "NOT_ESTABLISHED",
      effective_from: null,
      effective_until: null,
      basis_ref_keys: [],
    },
    source_evidence_cutoff: null,
    authority_ceiling: "NON_AUTHORITATIVE_PRODUCT_PROJECTION_ONLY",
    limitations: [],
    freshness: {
      status: "UNKNOWN",
      evaluated_at: NOW,
      basis: "UNESTABLISHED",
      reason_codes: ["PRODUCT_TEMPORAL_FRESHNESS_POLICY_NOT_ESTABLISHED"],
    },
    projection_semantics: "CURRENT_PROJECTION",
    non_authoritative: true,
  } as any;
}

const field = {
  envelope: envelope("FIELD_SUMMARY", "field-a"),
  field_ref: "field-a",
  identity: {
    display_name: "North Field 07",
    display_name_status: "AVAILABLE",
    farm_display_name: null,
    crop_display_name: null,
    crop_stage_display: null,
    season_display: null,
    area: 82,
    area_unit: "ha",
  },
  current_condition: {
    status: "UNAVAILABLE",
    condition_kind: "ROOT_ZONE_WATER_STATE",
    effective_at: null,
    support_state: "UNAVAILABLE",
    source_ref_key: null,
    root_zone_water: null,
    reason_codes: ["MCFT_CURRENT_RUNTIME_NOT_ESTABLISHED"],
  },
  reporting_state: {
    state: "UNAVAILABLE",
    reason_codes: ["MCFT_CURRENT_RUNTIME_NOT_ESTABLISHED"],
    last_qualified_at: null,
  },
  attention: {
    status: "UNAVAILABLE",
    has_attention: null,
    attention_item_refs: [],
    reason_codes: ["ATTENTION_QUEUE_BUILDER_NOT_IMPLEMENTED"],
  },
  recent_operation: null,
  geometry_availability: "UNAVAILABLE",
  capability_refs: [],
  limitation_reason_codes: ["MCFT_CURRENT_RUNTIME_NOT_ESTABLISHED"],
} as any;

const workspace = {
  envelope: envelope("FIELD_WORKSPACE", "field-a"),
  field_ref: "field-a",
  identity: field.identity,
  current_condition: field.current_condition,
  reporting_state: field.reporting_state,
  recent_changes: { status: "UNAVAILABLE", items: [], reason_codes: [] },
  open_action_cases: { status: "UNAVAILABLE", items: [], reason_codes: [] },
  recent_operations: { status: "UNAVAILABLE", items: [], reason_codes: [] },
  evidence_summary: {
    field_condition: { status: "UNAVAILABLE", artifact_count: null, reason_codes: [] },
    execution_evidence: { status: "UNAVAILABLE", artifact_count: null, reason_codes: [] },
  },
  observed_outcomes: { status: "UNAVAILABLE", items: [], reason_codes: [] },
  capability_availability: { status: "UNAVAILABLE", items: [], reason_codes: [] },
  history_summary: { status: "UNAVAILABLE", latest_event_at: null, reason_codes: [] },
  limitation_reason_codes: [],
  provenance_summary: { source_authority_count: 0, source_non_authority_count: 0 },
} as any;

const overview = {
  envelope: envelope("CUSTOMER_OVERVIEW", null),
  reporting_summary: {
    total_fields: 1,
    current_fields: 0,
    limited_fields: 0,
    unavailable_fields: 1,
  },
  attention_items: { status: "UNAVAILABLE", items: [], reason_codes: [] },
  field_previews: [field],
  recent_operations: { status: "UNAVAILABLE", items: [], reason_codes: [] },
  latest_reports: { status: "UNAVAILABLE", items: [], reason_codes: [] },
  limitation_reason_codes: [],
} as any;

class FakeBuilder implements CustomerProductProjectionReadBuilderV1 {
  buildCustomerOverviewV1() { return Promise.resolve(overview); }
  buildFieldSummariesV1() { return Promise.resolve([field]); }
  buildFieldWorkspaceV1(_scope: any, fieldRef: string) {
    if (fieldRef !== "field-a") throw new Error("unexpected");
    return Promise.resolve(workspace);
  }
}

function tokenEnv() {
  return JSON.stringify({
    version: "ao_act_tokens_v0",
    tokens: [{
      token: "product-test-token",
      token_id: "token-product-test",
      actor_id: "actor-product-test",
      tenant_id: "tenant-a",
      project_id: "project-a",
      group_id: "group-a",
      scopes: [],
      revoked: false,
      role: "client",
      allowed_field_ids: ["field-a"],
    }],
  });
}

test("canonical Product API exposes only the three Wave-02 GET routes with auth and ETag", async () => {
  const previousTokens = process.env.GEOX_TOKENS_JSON;
  const previousRuntime = process.env.GEOX_RUNTIME_ENV;
  process.env.GEOX_TOKENS_JSON = tokenEnv();
  process.env.GEOX_RUNTIME_ENV = "test";
  try {
    const app = Fastify();
    registerProductV1Routes(app, {} as never, { builder: new FakeBuilder() });
    await app.ready();

    for (const url of [
      "/api/product/v1/overview",
      "/api/product/v1/fields",
      "/api/product/v1/fields/field-a",
    ]) {
      const response = await app.inject({
        method: "GET",
        url,
        headers: { authorization: "Bearer product-test-token" },
      });
      assert.equal(response.statusCode, 200, `${url}:${response.body}`);
      assert.equal(response.headers["x-geox-product-contract"], "FOUI_PRODUCT_PROJECTION");
      assert.equal(response.headers["x-geox-product-authority-ceiling"], "NON_AUTHORITATIVE_PRODUCT_PROJECTION_ONLY");
      assert.match(String(response.headers.etag), /^"sha256:/);

      const cached = await app.inject({
        method: "GET",
        url,
        headers: {
          authorization: "Bearer product-test-token",
          "if-none-match": String(response.headers.etag),
        },
      });
      assert.equal(cached.statusCode, 304);
    }

    for (const method of ["POST", "PUT", "PATCH", "DELETE"] as const) {
      const response = await app.inject({
        method,
        url: "/api/product/v1/fields",
        headers: { authorization: "Bearer product-test-token" },
      });
      assert.equal(response.statusCode, 404);
    }

    await app.close();
  } finally {
    if (previousTokens === undefined) delete process.env.GEOX_TOKENS_JSON;
    else process.env.GEOX_TOKENS_JSON = previousTokens;
    if (previousRuntime === undefined) delete process.env.GEOX_RUNTIME_ENV;
    else process.env.GEOX_RUNTIME_ENV = previousRuntime;
  }
});

test("Product API rejects unauthenticated and out-of-scope field reads", async () => {
  const previousTokens = process.env.GEOX_TOKENS_JSON;
  const previousRuntime = process.env.GEOX_RUNTIME_ENV;
  process.env.GEOX_TOKENS_JSON = tokenEnv();
  process.env.GEOX_RUNTIME_ENV = "test";
  try {
    const app = Fastify();
    registerProductV1Routes(app, {} as never, { builder: new FakeBuilder() });
    await app.ready();

    const missing = await app.inject({ method: "GET", url: "/api/product/v1/fields" });
    assert.equal(missing.statusCode, 401);

    const forbidden = await app.inject({
      method: "GET",
      url: "/api/product/v1/fields/field-b",
      headers: { authorization: "Bearer product-test-token" },
    });
    assert.equal(forbidden.statusCode, 404);

    await app.close();
  } finally {
    if (previousTokens === undefined) delete process.env.GEOX_TOKENS_JSON;
    else process.env.GEOX_TOKENS_JSON = previousTokens;
    if (previousRuntime === undefined) delete process.env.GEOX_RUNTIME_ENV;
    else process.env.GEOX_RUNTIME_ENV = previousRuntime;
  }
});
