#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
function read(rel) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) throw new Error(`MISSING_REQUIRED_FILE:${rel}`);
  return fs.readFileSync(p, "utf8");
}
function assert(cond, code) {
  if (!cond) throw new Error(code);
}
function assertContains(rel, needle, code) {
  const s = read(rel);
  assert(s.includes(needle), code || `MISSING_REQUIRED_MARKER:${rel}:${needle}`);
}

function walkFiles(relDir) {
  const start = path.join(root, relDir);
  const out = [];
  if (!fs.existsSync(start)) return out;
  for (const entry of fs.readdirSync(start, { withFileTypes: true })) {
    const abs = path.join(start, entry.name);
    const rel = path.relative(root, abs).replace(/\\/g, "/");
    if (entry.isDirectory()) out.push(...walkFiles(rel));
    else out.push(rel);
  }
  return out;
}

const manifestPath = "docs/frontend-productization/GEOX-PRODUCT-DATA-CONTRACT-SUCCESSION-V1.json";
const manifest = JSON.parse(read(manifestPath));

assert(manifest.schema_version === "geox_product_data_contract_succession_v1", "BAD_SCHEMA_VERSION");
assert(manifest.status === "READY_FOR_PROTECTED_MAIN_ADOPTION", "BAD_ADOPTION_STATUS");
assert(manifest.canonical_persistence?.engine_family === "POSTGRESQL", "POSTGRESQL_NOT_CANONICAL");
assert(manifest.canonical_persistence?.create_second_business_database === false, "SECOND_BUSINESS_DATABASE_FORBIDDEN");
assert(manifest.canonical_persistence?.sites_d1_is_canonical_business_store === false, "SITES_D1_MUST_NOT_BE_CANONICAL_BUSINESS_STORE");
assert(manifest.canonical_product_contract?.family === "FOUI_PRODUCT_PROJECTION", "FOUI_NOT_CANONICAL_PRODUCT_CONTRACT");
assert(manifest.canonical_product_contract?.namespace === "/api/product/v1/*", "BAD_CANONICAL_PRODUCT_NAMESPACE");
assert(JSON.stringify(manifest.canonical_product_contract?.allowed_methods) === JSON.stringify(["GET","HEAD"]), "BAD_PRODUCT_READ_METHODS");

const reservedTokens = new Map((manifest.wave01_reserved_projection_type_tokens || []).map((x) => [x.token, x.status]));
for (const token of ["FIELD_PORTFOLIO", "DECISION_PRODUCT", "GOVERNED_ACTION_LIST", "EVIDENCE_CASE"]) {
  assert(reservedTokens.has(token), `RESERVED_PROJECTION_TYPE_TOKEN_MISSING:${token}`);
  assert(reservedTokens.get(token) === "RESERVED_TOKEN_NO_CONCRETE_PROJECTION_CONTRACT", `RESERVED_PROJECTION_TOKEN_STATUS_DRIFT:${token}`);
}
assert(
  manifest.wave02_naming_rule === "DO_NOT_TREAT_RESERVED_TYPE_TOKEN_AS_IMPLEMENTED_CONTRACT; DEFINE_CONCRETE_CONTRACT_EXPLICITLY_BEFORE_ROUTE_OR_SITES_BINDING",
  "WAVE02_NAMING_RULE_MISSING",
);
assert(
  manifest.wave01_adoption?.effective_on_protected_main_adoption === "ACCEPTED_FOR_NARROW_READ_ONLY_PRODUCT_PROJECTION_SUCCESSOR_CONSTRUCTION",
  "WAVE01_SUCCESSOR_ADOPTION_MISSING",
);
assert(manifest.wave01_adoption?.command_construction_authorized === false, "WAVE01_COMMAND_BOUNDARY_WIDENED");
assert(manifest.wave01_adoption?.authority_mutation_authorized === false, "WAVE01_AUTHORITY_MUTATION_WIDENED");
assert(JSON.stringify(manifest.canonical_product_contract?.forbidden_projection_methods) === JSON.stringify(["POST","PUT","PATCH","DELETE"]), "BAD_FORBIDDEN_PRODUCT_METHODS");

const expectedLegacy = new Map([
  ["/api/v1/customer/fields", "LEGACY_ACTIVE_READ"],
  ["/api/v1/customer/operations", "LEGACY_ACTIVE_READ"],
  ["/api/v1/customer/reports", "LEGACY_ACTIVE_READ"],
  ["/api/v1/customer/fields/:field_id/confirmed-twin-summary", "LEGACY_DO_NOT_ADOPT"],
  ["/api/v1/customer/fields/:fieldId/memory", "LEGACY_ACTIVE_READ"],
  ["/api/v1/customer/fields/:fieldId/geometry", "LEGACY_COMPAT_READ_SOURCE"],
  ["/api/v1/fields/portfolio", "PRE_FOUI_LEGACY_PROJECTION"],
  ["/api/v1/reports/customer-dashboard/aggregate", "LEGACY_FALLBACK"],
  ["/api/v1/reports/field/:fieldId", "LEGACY_REPORT"],
  ["/api/v1/reports/operation/:operationId", "LEGACY_REPORT"],
]);

const observedLegacy = new Map((manifest.legacy_routes || []).map((x) => [x.route, x]));
for (const [route, classification] of expectedLegacy) {
  const item = observedLegacy.get(route);
  assert(Boolean(item), `MISSING_LEGACY_ROUTE:${route}`);
  assert(item.classification === classification, `BAD_LEGACY_CLASSIFICATION:${route}:${item.classification}`);
  assert(item.new_consumers === "FORBIDDEN", `NEW_CONSUMER_NOT_FORBIDDEN:${route}`);
}

assert(JSON.stringify(manifest.legacy_lifecycle) === JSON.stringify([
  "LEGACY_ACTIVE_READ",
  "DEPRECATED",
  "EMERGENCY_COMPAT_ONLY",
  "REMOVED",
]), "BAD_LEGACY_LIFECYCLE");

for (const rel of manifest.historical_documents || []) {
  assertContains(rel, "lifecycle: HISTORICAL_PRODUCT_CONTRACT", `HISTORICAL_DOC_NOT_MARKED:${rel}`);
  assertContains(rel, "new_product_construction: SUPERSEDED", `HISTORICAL_DOC_NOT_SUPERSEDED:${rel}`);
  assertContains(rel, "compatibility: MAINTENANCE_ONLY", `HISTORICAL_DOC_NOT_MAINTENANCE_ONLY:${rel}`);
}

assertContains(
  "apps/server/src/routes/customer_v1.ts",
  "GEOX_PRODUCT_CONTRACT_LIFECYCLE: LEGACY_P1_P2_CUSTOMER_API",
  "CUSTOMER_ROUTE_LEGACY_MARKER_MISSING",
);
assertContains(
  "apps/server/src/routes/field_portfolio_v1.ts",
  "GEOX_PRODUCT_CONTRACT_LIFECYCLE: PRE_FOUI_LEGACY_PROJECTION",
  "FIELD_PORTFOLIO_LEGACY_MARKER_MISSING",
);

for (const rel of [
  "apps/web/src/api/customerFields.ts",
  "apps/web/src/api/customerOperations.ts",
  "apps/web/src/api/customerReportsCenter.ts",
]) {
  assertContains(rel, "GEOX_PRODUCT_CONTRACT_LIFECYCLE: LEGACY_CONSUMER_ADAPTER", `LEGACY_ADAPTER_MARKER_MISSING:${rel}`);
}
assertContains(
  "apps/web/src/api/customer.ts",
  "GEOX_PRODUCT_CONTRACT_LIFECYCLE: LEGACY_DO_NOT_ADOPT_CONFIRMED_TWIN_SUMMARY",
  "CONFIRMED_TWIN_SUMMARY_DO_NOT_ADOPT_MARKER_MISSING",
);

for (const rel of [
  "apps/web/src/api/customerFieldMemory.ts",
  "apps/web/src/api/customerRoiLedger.ts",
]) {
  assertContains(rel, "GEOX_PRODUCT_CONTRACT_LIFECYCLE: LEGACY_CONSUMER_ADAPTER", `LEGACY_ADAPTER_MARKER_MISSING:${rel}`);
}
assertContains(
  "apps/web/src/api/customerPrescriptions.ts",
  "GEOX_PRODUCT_CONTRACT_LIFECYCLE: LEGACY_DIRECT_DOMAIN_ADAPTER",
  "CUSTOMER_PRESCRIPTION_LEGACY_MARKER_MISSING",
);
assertContains(
  "apps/web/src/api/fieldPortfolio.ts",
  "GEOX_PRODUCT_CONTRACT_LIFECYCLE: PRE_FOUI_LEGACY_PROJECTION_ADAPTER",
  "FIELD_PORTFOLIO_ADAPTER_LEGACY_MARKER_MISSING",
);
assertContains(
  "apps/web/src/api/reports.ts",
  "GEOX_PRODUCT_CONTRACT_LIFECYCLE: LEGACY_REPORT_ADAPTER",
  "REPORTS_ADAPTER_LEGACY_MARKER_MISSING",
);

for (const rel of manifest.legacy_customer_viewmodels || []) {
  assertContains(rel, "GEOX_PRODUCT_CONTRACT_LIFECYCLE:", `LEGACY_CUSTOMER_VIEWMODEL_MARKER_MISSING:${rel}`);
}
assert(
  manifest.legacy_viewmodel_policy === "PROVENANCE_AND_EXISTING_COMPATIBILITY_ONLY; NO_SEMANTIC_COPY_INTO_POST_FOUI_PRODUCT",
  "LEGACY_CUSTOMER_VIEWMODEL_POLICY_MISSING",
);

const consumerPolicy = manifest.legacy_frontend_consumer_allowlist;
assert(consumerPolicy?.policy === "EXISTING_COMPATIBILITY_CONSUMERS_ONLY_NO_NEW_FILES", "LEGACY_CONSUMER_ALLOWLIST_POLICY_MISSING");

const allFrontendFiles = walkFiles("apps/web/src").filter((rel) => /\.(?:ts|tsx|js|jsx)$/.test(rel));
function filesContaining(needle) {
  return allFrontendFiles.filter((rel) => read(rel).includes(needle));
}
function assertOnlyAllowlisted(observed, allowlist, familyCode) {
  const allowed = new Set(allowlist || []);
  for (const rel of observed) {
    assert(allowed.has(rel), `NEW_LEGACY_FRONTEND_CONSUMER_FORBIDDEN:${familyCode}:${rel}`);
  }
  for (const rel of allowed) {
    assert(observed.includes(rel), `LEGACY_ALLOWLIST_DRIFT_MISSING_CONSUMER:${familyCode}:${rel}`);
  }
}

assertOnlyAllowlisted(
  filesContaining("/api/v1/customer/"),
  consumerPolicy.customer_api_family_existing_files,
  "CUSTOMER_API_FAMILY",
);
assertOnlyAllowlisted(
  filesContaining("/api/v1/reports/"),
  consumerPolicy.reports_api_family_existing_files,
  "REPORTS_API_FAMILY",
);
assertOnlyAllowlisted(
  filesContaining("/api/v1/fields/portfolio"),
  consumerPolicy.field_portfolio_existing_files,
  "FIELD_PORTFOLIO",
);

const customerApiFiles = allFrontendFiles.filter((rel) =>
  /^apps\/web\/src\/api\/customer[^/]*\.ts$/.test(rel) && read(rel).includes("/api/v1/")
);
assertOnlyAllowlisted(
  customerApiFiles,
  consumerPolicy.customer_direct_v1_api_existing_files,
  "CUSTOMER_DIRECT_V1_API",
);

assertContains(
  "docs/frontend-productization/GEOX-FRONTEND-CANONICAL-BLUEPRINT-V1.md",
  "## 18. Product data contract succession",
  "BLUEPRINT_SUCCESSION_SECTION_MISSING",
);

const blueprintJson = JSON.parse(read("docs/frontend-productization/GEOX-FRONTEND-CANONICAL-BLUEPRINT-V1.json"));
assert(blueprintJson.product_data_contract_succession?.governing_artifact === "GEOX-PRODUCT-DATA-CONTRACT-SUCCESSION-V1", "BLUEPRINT_SUCCESSION_BINDING_MISSING");
assert(blueprintJson.product_data_contract_succession?.canonical_persistence === "POSTGRESQL", "BLUEPRINT_DATABASE_DRIFT");
assert(blueprintJson.product_data_contract_succession?.canonical_new_product_api_namespace === "/api/product/v1/*", "BLUEPRINT_NAMESPACE_DRIFT");
assert(blueprintJson.product_data_contract_succession?.new_consumer_legacy_api_dependency === "FORBIDDEN", "BLUEPRINT_LEGACY_CONSUMER_POLICY_DRIFT");
assert(blueprintJson.customer_root_redirect?.to === "/customer/overview", "CUSTOMER_ROOT_REDIRECT_DRIFT");
assert(blueprintJson.canonical_navigation?.customer_current?.[0] === "/customer/overview", "CUSTOMER_OVERVIEW_ROUTE_DRIFT");
const customerRouteMap = new Map(blueprintJson.route_decisions?.customer || []);
assert(customerRouteMap.get("/customer/overview") === "CANONICAL_NEW_PRODUCT", "CUSTOMER_OVERVIEW_NOT_CANONICAL");
assert(customerRouteMap.get("/customer/dashboard") === "LEGACY_COMPAT_ALIAS", "CUSTOMER_DASHBOARD_NOT_LEGACY_ALIAS");

for (const watched of [
  "apps/server/src/product_projection/**",
  "apps/server/src/routes/product*",
  "apps/server/src/modules/product/**",
  "scripts/governance_acceptance/*FOUI*",
  ".github/workflows/foui-*",
]) {
  assert((blueprintJson.watched_paths || []).includes(watched), `BLUEPRINT_WATCHED_PATH_MISSING:${watched}`);
}
assert(
  blueprintJson.foui?.read_only_successor_construction_authorized_on_adoption === true,
  "BLUEPRINT_READ_ONLY_SUCCESSOR_AUTHORIZATION_MISSING",
);
assertContains(
  "docs/product_projection/GEOX-FOUI-PROJECTION-CONTRACT-WAVE-01-V1.md",
  "Successor governance: upon protected-main adoption",
  "WAVE01_SUCCESSOR_GOVERNANCE_NOTE_MISSING",
);

const successionMd = read("docs/frontend-productization/GEOX-PRODUCT-DATA-CONTRACT-SUCCESSION-V1.md");
for (const invariant of [
  "missing authority-backed value",
  "current_state_substitution_forbidden = true",
  "NO second GEOX business database",
].filter(Boolean)) {
  if (invariant === "NO second GEOX business database") {
    assert(successionMd.includes("No second GEOX business database"), "SECOND_DATABASE_TEXT_BOUNDARY_MISSING");
  } else {
    assert(successionMd.includes(invariant), `SUCCESSION_INVARIANT_MISSING:${invariant}`);
  }
}

const forbiddenCanonicalLegacyBindings = [
  "Sites -> /api/v1/customer/",
  "Sites -> /api/v1/reports/",
  "Sites -> /api/v1/fields/portfolio",
];
for (const bad of forbiddenCanonicalLegacyBindings) {
  assert(!successionMd.includes(bad), `CANONICAL_DOC_CONTAINS_FORBIDDEN_BINDING:${bad}`);
}

console.log(JSON.stringify({
  schema_version: "geox_foui_product_api_succession_acceptance_v1",
  status: "PASS",
  canonical_persistence: "POSTGRESQL",
  canonical_product_contract: "FOUI_PRODUCT_PROJECTION",
  canonical_namespace: "/api/product/v1/*",
  legacy_routes_checked: expectedLegacy.size,
  historical_documents_checked: (manifest.historical_documents || []).length,
  legacy_frontend_customer_family_consumers_checked: (manifest.legacy_frontend_consumer_allowlist?.customer_api_family_existing_files || []).length,
  legacy_frontend_report_family_consumers_checked: (manifest.legacy_frontend_consumer_allowlist?.reports_api_family_existing_files || []).length,
  legacy_customer_viewmodels_checked: (manifest.legacy_customer_viewmodels || []).length,
  runtime_behavior_change: false,
  database_schema_change: false,
}, null, 2));
