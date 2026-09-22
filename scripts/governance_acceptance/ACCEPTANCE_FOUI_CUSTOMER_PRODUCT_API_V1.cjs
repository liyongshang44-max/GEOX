'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = process.cwd();

function read(rel) {
  const file = path.join(root, rel);
  assert.ok(fs.existsSync(file), `missing required file: ${rel}`);
  return fs.readFileSync(file, 'utf8');
}

function mustContain(text, needle, label) {
  assert.ok(text.includes(needle), `${label}: missing ${needle}`);
}

function mustNotMatch(text, pattern, label) {
  assert.equal(pattern.test(text), false, `${label}: forbidden pattern ${pattern}`);
}

const baseContract = read('apps/server/src/product_projection/contracts/product_projection_contracts_v1.ts');
const customerContract = read('apps/server/src/product_projection/contracts/customer_product_projection_contracts_v1.ts');
const sourceRegistry = read('apps/server/src/product_projection/contracts/product_projection_source_binding_registry_v1.ts');
const reader = read('apps/server/src/product_projection/readers/postgres_customer_product_projection_reader_v1.ts');
const builder = read('apps/server/src/product_projection/builders/customer_product_projection_builder_v1.ts');
const route = read('apps/server/src/routes/product_customer_v1.ts');
const productModule = read('apps/server/src/modules/product/registerProductModule.ts');
const domainModules = read('apps/server/src/modules/domain/registerDomainModules.ts');
const rootSchema = JSON.parse(read('apps/server/src/product_projection/contracts/product_projection_contracts_v1.schema.json'));
const customerSchema = JSON.parse(read('apps/server/src/product_projection/contracts/customer_product_projection_contracts_v1.schema.json'));

for (const token of ['CUSTOMER_OVERVIEW', 'FIELD_SUMMARY', 'FIELD_WORKSPACE']) {
  mustContain(baseContract, `"${token}"`, 'projection type registry');
  assert.ok(rootSchema.$defs.ProductProjectionEnvelopeV1.properties.projection_type.enum.includes(token), `schema projection type missing ${token}`);
}
for (const def of ['CustomerOverviewProjectionV1', 'FieldSummaryProjectionV1', 'FieldWorkspaceProjectionV1']) {
  mustContain(customerContract, `type ${def}`, `customer contract ${def}`);
  assert.ok(customerSchema.$defs[def], `customer JSON schema missing ${def}`);
}

// Real source path: existing PostgreSQL indexes + exact canonical MCFT runtime read.
// No historical presentation API is allowed underneath the new Product API.
mustContain(reader, 'public.field_index_v1', 'field identity source');
mustContain(reader, 'public.field_season_index_v1', 'field season source');
mustContain(reader, 'public.twin_active_lineage_index_v1', 'MCFT runtime scope source');
mustContain(reader, 'PostgresMcftFieldTwinReadApiV1', 'canonical MCFT read API');
mustContain(reader, 'runtime.root_graph_status !== "COMPLETE_EXACT_GRAPH"', 'exact MCFT root requirement');
mustContain(reader, 'canonicalObject.determinism_hash !== objectHash', 'exact MCFT hash check');
mustContain(reader, 'sameScope(canonicalObject, scope)', 'exact MCFT scope check');

for (const text of [reader, builder, route]) {
  mustNotMatch(text, /\/api\/v1\/customer\//, 'legacy customer API dependency');
  mustNotMatch(text, /\/api\/v1\/reports\//, 'legacy report API dependency');
  mustNotMatch(text, /\/api\/v1\/fields\/portfolio/, 'legacy portfolio API dependency');
}

// Physical read-only boundary.
for (const [label, text] of [['reader', reader], ['builder', builder], ['route', route]]) {
  mustNotMatch(text, /\bINSERT\s+INTO\b|\bUPDATE\s+(?:public\.)?[A-Za-z0-9_]+\s+SET\b|\bDELETE\s+FROM\b|\bCREATE\s+TABLE\b|\bALTER\s+TABLE\b|\bDROP\s+TABLE\b|\bTRUNCATE\b/i, `${label} database write`);
}
mustNotMatch(route, /\bapp\.(?:post|put|patch|delete)\s*\(/, 'product command route');
for (const exactRoute of [
  'app.get("/api/product/v1/overview"',
  'app.get("/api/product/v1/fields"',
  'app.get("/api/product/v1/fields/:fieldRef"',
]) mustContain(route, exactRoute, 'canonical product route');

// Server-side scope only.
mustContain(route, 'auth.role !== "client"', 'customer role restriction');
mustContain(route, 'resolveCustomerScope(auth)', 'server-side customer allowlist');
mustContain(route, 'PRODUCT_SCOPE_QUERY_FORBIDDEN', 'scope query rejection');
mustContain(route, 'auth.scope.allowed_field_ids.includes(fieldRef)', 'field allowlist detail guard');
mustContain(route, 'cache-control", "no-store"', 'current projection cache boundary');

// Product fail-closed semantics.
mustContain(builder, 'MULTIPLE_RUNTIME_SCOPES_NO_FIELD_AGGREGATION', 'no field aggregation inference');
mustContain(builder, 'A non-authoritative', 'non-authority season selection guard');
mustContain(builder, 'summary: null', 'no invented condition label');
mustContain(builder, 'FIELD_ATTENTION_NOT_PROJECTED_IN_FIRST_SLICE', 'attention unavailable boundary');
mustContain(builder, 'ACTION_CASE_PRODUCT_VIEW_NOT_PROJECTED_IN_FIRST_SLICE', 'action case unavailable boundary');
mustContain(builder, 'OUTCOME_NOT_PROJECTED_IN_FIRST_SLICE', 'outcome unavailable boundary');
mustContain(customerContract, 'CUSTOMER_PRODUCT_OWNED_AUTHORITY_FIELD_FORBIDDEN', 'forbidden product authority field guard');

for (const forbidden of ['risk_score', 'severity', 'priority']) {
  // The contract may mention these strings only in the negative forbidden-key validator.
  assert.ok(customerContract.includes(`"${forbidden}"`), `missing forbidden-key proof for ${forbidden}`);
}
mustNotMatch(builder, /\brisk_score\b|\bseverity\b|\bpriority\b/, 'builder product-owned risk/severity/priority');

// Source binding registry.
for (const needle of [
  '"FIELD_IDENTITY_BASIS"',
  '"FIELD_SEASON_BASIS"',
  '"FIELD_CURRENT_STATE"',
  'GEOX_FIELD_INDEX_IDENTITY_V1',
  'GEOX_FIELD_SEASON_INDEX_V1',
  'assertCustomerFieldProjectionSourceBindingsV1',
]) mustContain(sourceRegistry, needle, 'customer source binding registry');

// Minimal server registration only.
mustContain(productModule, 'registerProductCustomerV1Routes', 'product module route registration');
mustContain(domainModules, 'registerProductModule(app, pool);', 'domain module registration');

// Root schema still preserves authority ceiling.
assert.equal(rootSchema.$defs.ProductProjectionEnvelopeV1.properties.authority_ceiling.const, 'NON_AUTHORITATIVE_PRODUCT_PROJECTION_ONLY');
assert.equal(rootSchema.$defs.ProductProjectionEnvelopeV1.properties.non_authoritative.const, true);

// Optional PR-diff guard. Dedicated CI passes --base-ref to prove this slice did not cross into
// migrations, packages, MCFT runtime, external-evidence runtime, database bootstrap, or lockfiles.
const baseArgIndex = process.argv.indexOf('--base-ref');
if (baseArgIndex >= 0) {
  const baseRef = process.argv[baseArgIndex + 1];
  assert.ok(baseRef, '--base-ref requires a value');
  const changed = execFileSync('git', ['diff', '--name-only', `${baseRef}...HEAD`], { cwd: root, encoding: 'utf8' })
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean);

  const allowed = [
    /^\.github\/workflows\/foui-customer-product-api-v1\.yml$/,
    /^apps\/server\/src\/modules\/domain\/registerDomainModules\.ts$/,
    /^apps\/server\/src\/modules\/product\//,
    /^apps\/server\/src\/product_projection\//,
    /^apps\/server\/src\/routes\/product_customer_v1\.ts$/,
    /^docs\/product_projection\//,
    /^docs\/architecture\/semantic_convergence\/GEOX-BLINE-ACTIVE-RUNTIME-SURFACE-DISPOSITION-V1\.json$/,
    /^docs\/frontend-productization\/GEOX-PRODUCT-DATA-CONTRACT-SUCCESSION-V1\.(?:md|json)$/,
    /^scripts\/governance_acceptance\/ACCEPTANCE_FOUI_CUSTOMER_PRODUCT_API_V1\.cjs$/,
    /^scripts\/governance_acceptance\/FOUI_CUSTOMER_PRODUCT_API_NEGATIVE_V1\.ts$/,
  ];
  for (const file of changed) {
    assert.ok(allowed.some((pattern) => pattern.test(file)), `PRODUCT_API_SCOPE_ESCAPE:${file}`);
  }

  for (const forbiddenPrefix of [
    'apps/server/db/migrations/',
    'apps/server/src/external_evidence/',
    'apps/server/src/persistence/external_evidence/',
    'apps/server/src/persistence/twin_runtime/',
    'apps/server/src/runtime/twin_runtime/',
    'package.json',
    'pnpm-lock.yaml',
  ]) {
    assert.equal(changed.some((file) => file === forbiddenPrefix || file.startsWith(forbiddenPrefix)), false, `MCFT_OR_SHARED_DEPENDENCY_PATH_TOUCHED:${forbiddenPrefix}`);
  }
}

console.log(JSON.stringify({
  schema_version: 'geox_foui_customer_product_api_acceptance_v1',
  status: 'PASS',
  database: 'POSTGRESQL_EXISTING_SCHEMA',
  product_api_namespace: '/api/product/v1/*',
  routes: 3,
  database_writes: 0,
  legacy_api_dependencies: 0,
  mcft_runtime_mutations: 0,
  migrations: 0,
}, null, 2));
