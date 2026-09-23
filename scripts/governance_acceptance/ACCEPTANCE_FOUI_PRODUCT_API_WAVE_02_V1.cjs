#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = process.cwd();
const OUT = path.join(ROOT, "acceptance-output/FOUI_PRODUCT_API_WAVE_02_RESULT.json");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const checks = [];
const check = (name, fn) => { fn(); checks.push({ name, status: "PASS" }); };

try {
  const contract = read("apps/server/src/product_projection/customer/customer_product_projection_contracts_v1.ts");
  const customerSchema = JSON.parse(read("apps/server/src/product_projection/customer/customer_product_projection_contracts_v1.schema.json"));
  const builder = read("apps/server/src/product_projection/customer/customer_product_projection_builder_v1.ts");
  const route = read("apps/server/src/routes/product_v1.ts");
  const moduleSource = read("apps/server/src/modules/product/registerProductModule.ts");
  const registration = read("apps/server/src/modules/domain/registerDomainModules.ts");
  const sourceRegistry = read("apps/server/src/product_projection/contracts/product_projection_source_binding_registry_v1.ts");
  const productContract = read("apps/server/src/product_projection/contracts/product_projection_contracts_v1.ts");
  const doc = read("docs/product_projection/GEOX-FOUI-PRODUCT-API-WAVE-02-V1.md");

  check("CUSTOMER_PROJECTION_JSON_SCHEMA_PRESENT", () => {
    assert.equal(customerSchema["$schema"], "https://json-schema.org/draft/2020-12/schema");
    for (const name of ["CustomerOverview", "FieldSummary", "FieldWorkspace"]) {
      assert.ok(customerSchema["$defs"]?.[name], name);
    }
    assert.equal(customerSchema["$defs"]?.["RootZoneWater"]?.properties?.water_stress_state?.properties?.status?.const, "NOT_ESTABLISHED");
    assert.equal(customerSchema["$defs"]?.["RootZoneWater"]?.properties?.confidence?.properties?.status?.const, "NOT_ESTABLISHED");
  });

  check("THREE_CONCRETE_CUSTOMER_PROJECTION_CONTRACTS", () => {
    for (const name of [
      "CustomerOverviewProjectionV1",
      "FieldSummaryProjectionV1",
      "FieldWorkspaceProjectionV1",
    ]) assert.match(contract, new RegExp("type " + name));
    for (const token of ["CUSTOMER_OVERVIEW", "FIELD_SUMMARY", "FIELD_WORKSPACE"]) {
      assert.match(productContract, new RegExp('"' + token + '"'));
    }
  });

  check("CANONICAL_PRODUCT_API_THREE_GET_ROUTES_ONLY", () => {
    assert.equal((route.match(/app\.get\(/g) || []).length, 3);
    assert.equal((route.match(/app\.(?:post|put|patch|delete)\(/g) || []).length, 0);
    for (const exact of [
      "PRODUCT_API_V1_BASE}/overview",
      "PRODUCT_API_V1_BASE}/fields",
      "PRODUCT_API_V1_BASE}/fields/:fieldRef",
    ]) assert.ok(route.includes(exact), exact);
  });

  check("NO_LEGACY_CUSTOMER_PRESENTATION_API_DEPENDENCY", () => {
    const production = [builder, route, moduleSource].join("\n");
    for (const forbidden of [
      "/api/v1/customer/",
      "/api/v1/reports/",
      "/api/v1/fields/portfolio",
      "customerConfirmedTwinSummary",
      "queryOperationsFromFacts",
    ]) assert.equal(production.includes(forbidden), false, forbidden);
  });

  check("READ_ONLY_SQL_AND_NO_DATABASE_MUTATION", () => {
    assert.match(builder, /\bSELECT\b/);
    assert.doesNotMatch(builder, /\b(?:INSERT\s+INTO|UPDATE\s+[A-Za-z0-9_.]+\s+SET|DELETE\s+FROM|CREATE\s+TABLE|ALTER\s+TABLE|DROP\s+TABLE|TRUNCATE\s+TABLE|GRANT\s+|REVOKE\s+)\b/i);
    assert.doesNotMatch(route, /\b(?:SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE|GRANT|REVOKE)\b/i);
  });

  check("PRODUCTION_FIELD_SCHEMA_COMPATIBILITY", () => {
    assert.match(builder, /record_json->'payload'->>'tenant_id' = \$1/);
    assert.match(builder, /record_json->'payload'->>'project_id' = \$2/);
    assert.match(builder, /record_json->'payload'->>'group_id' = \$3/);
    assert.match(builder, /LEFT JOIN public\.field_index_v1 fi/);
    assert.match(builder, /fi\.tenant_id = \$1/);
    assert.doesNotMatch(builder, /fi\.project_id/);
    assert.doesNotMatch(builder, /fi\.group_id/);
    assert.match(builder, /FIELD_IDENTITY_NOT_ESTABLISHED/);
    assert.match(builder, /FIELD_SCOPE_OBSERVED_IN_GOVERNED_FACTS/);
    assert.match(sourceRegistry, /GEOX_SCOPED_FACT_FIELD_BASIS_V1/);
  });

  check("CANONICAL_MCFT_READ_MODEL_AND_EXACT_STATE_BINDING", () => {
    assert.match(builder, /PostgresMcftFieldTwinS4ReadApiV1/);
    assert.match(builder, /root_graph_status !== "COMPLETE_EXACT_GRAPH"/);
    assert.match(builder, /public\.twin_active_lineage_index_v1/);
    assert.match(builder, /public\.twin_state_history_projection_v1/);
    assert.match(builder, /determinism_hash/);
    assert.match(builder, /source_fact_id/);
    assert.match(builder, /MCFT_CURRENT_STATE_PROJECTION_EXACT_REF_MISMATCH/);
  });

  check("FIELD_LEVEL_MULTI_SCOPE_FAILS_CLOSED", () => {
    assert.match(builder, /FIELD_LEVEL_RUNTIME_SCOPE_AMBIGUOUS_NO_AGGREGATION_AUTHORITY/);
    assert.doesNotMatch(builder, /ORDER BY updated_at DESC[^;]*LIMIT 1/);
  });

  check("NO_PRODUCT_OWNED_RISK_RECOMMENDATION_INFERENCE", () => {
    for (const forbidden of [
      /risk_level\s*:/,
      /risk_score\s*:/,
      /severity\s*:/,
      /recommendation\s*:/,
      /approval\s*:/,
      /authorization\s*:/,
      /dispatch\s*:/,
    ]) assert.doesNotMatch(builder, forbidden);
    assert.match(contract, /FIELD_SUMMARY_PRODUCT_AUTHORITY_INFERENCE_FORBIDDEN/);
  });

  check("UNIMPLEMENTED_COLLECTIONS_EXPLICITLY_UNAVAILABLE", () => {
    for (const reason of [
      "ATTENTION_QUEUE_BUILDER_NOT_IMPLEMENTED",
      "OPERATION_PROJECTION_NOT_IMPLEMENTED",
      "ACTION_CASE_BUILDER_NOT_IMPLEMENTED",
      "OUTCOME_PROJECTION_NOT_IMPLEMENTED",
      "HISTORY_PROJECTION_NOT_IMPLEMENTED",
    ]) assert.match(builder, new RegExp(reason));
  });

  check("AUTH_SCOPE_AND_BROWSER_SECRET_BOUNDARY", () => {
    assert.match(route, /enforceRouteRoleAuth/);
    assert.match(route, /enforceFieldScopeOrDeny/);
    assert.match(route, /resolveCustomerScope/);
    assert.doesNotMatch(route + builder, /DATABASE_URL|GEOX_MCFT_CAP09_TWIN_RUNTIME_DATABASE_URL|Bearer\s+[A-Za-z0-9]/);
  });

  check("SOURCE_BINDING_REGISTRY_EXTENDED_EXPLICITLY", () => {
    for (const role of ["FIELD_SCOPE_BASIS", "FIELD_IDENTITY", "FIELD_CURRENT_STATE", "FIELD_CURRENT_RUNTIME_LINEAGE"]) {
      assert.match(sourceRegistry, new RegExp('"' + role + '"'));
    }
    assert.match(sourceRegistry, /GEOX_FIELD_INDEX_V1/);
    assert.match(sourceRegistry, /MCFT_RUNTIME_ACTIVE_LINEAGE_V1/);
    assert.match(builder, /assertProductProjectionSourceBindingsV1/);
  });

  check("SHARED_STARTUP_TOUCH_IS_BOUNDED", () => {
    assert.match(moduleSource, /registerProductV1Routes/);
    assert.match(registration, /registerProductModule\(app, pool\)/);
    assert.doesNotMatch(registration, /GEOX_PRODUCT_DATABASE_URL|GEOX_MCFT_CAP09_TWIN_RUNTIME_DATABASE_URL/);
  });

  check("GOVERNANCE_DOCUMENT_MATCHES_IMPLEMENTATION", () => {
    for (const required of [
      "database migration = NONE",
      "FIELD_LEVEL_RUNTIME_SCOPE_AMBIGUOUS_NO_AGGREGATION_AUTHORITY",
      "PRODUCT_TEMPORAL_FRESHNESS_POLICY_NOT_ESTABLISHED",
      "GET /api/product/v1/overview",
      "GET /api/product/v1/fields",
      "GET /api/product/v1/fields/:fieldRef",
    ]) assert.ok(doc.includes(required), required);
  });

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({
    schema_version: "geox_foui_product_api_wave_02_acceptance_v1",
    status: "PASS",
    check_count: checks.length,
    checks,
    database_schema_change: false,
    canonical_write_authority_delta: "ZERO",
    product_routes: [
      "GET /api/product/v1/overview",
      "GET /api/product/v1/fields",
      "GET /api/product/v1/fields/:fieldRef",
    ],
  }, null, 2) + "\n");
  console.log(JSON.stringify({ status: "PASS", check_count: checks.length }));
} catch (error) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({
    schema_version: "geox_foui_product_api_wave_02_acceptance_v1",
    status: "FAIL",
    check_count: checks.length,
    checks,
    error: String(error && error.stack ? error.stack : error),
  }, null, 2) + "\n");
  console.error(error);
  process.exitCode = 1;
}
