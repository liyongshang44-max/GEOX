#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const files = {
  inventory: path.join(root, 'apps/server/src/routes/api_route_inventory_v1.ts'),
  inventoryDoc: path.join(root, 'docs/audit/API_ROUTE_INVENTORY.md'),
  openapi: path.join(root, 'apps/server/src/routes/openapi_v1.ts'),
  openapiSelfcheck: path.join(root, 'apps/server/scripts/p1_3_openapi_alignment_selfcheck.mjs'),
  errorEnvelope: path.join(root, 'docs/contracts/v2/GEOX_STANDARD_ERROR_ENVELOPE_V2.md'),
};

function read(file) { return fs.readFileSync(file, 'utf8'); }
function fail(message) { console.error(`[api-governance-baseline-v2] FAIL: ${message}`); process.exit(1); }
function assert(condition, message) { if (!condition) fail(message); }
function assertIncludes(source, needle, label) { assert(source.includes(needle), `${label} must include ${needle}`); }

const inventory = read(files.inventory);
const inventoryDoc = read(files.inventoryDoc);
const openapi = read(files.openapi);
const openapiSelfcheck = read(files.openapiSelfcheck);
const errorEnvelope = read(files.errorEnvelope);

const requiredInventoryFields = ['owner', 'audience', 'boundary', 'source_model', 'auth_scope', 'error_model', 'contract_ref', 'gate_maturity'];
const allowedFieldConstants = ['standardError', 'contractBase', 'customerContract', 'evidenceContract', 'stateContract', 'aoBoundaryContract', 'roiMemoryContract', 'devtoolsContract'];
for (const field of requiredInventoryFields) {
  assertIncludes(inventory, `${field}:`, `api route inventory field ${field}`);
  assertIncludes(inventoryDoc, `\`${field}\``, `api route inventory doc field ${field}`);
}

for (const value of ['ci_enforced', 'release_gate_candidate', 'inventory_baseline', 'legacy_exempt', 'debug_exempt']) {
  assertIncludes(inventory, `"${value}"`, 'gate_maturity enum/value');
  assertIncludes(inventoryDoc, `\`${value}\``, 'gate_maturity doc');
}

assertIncludes(inventory, 'GEOX_STANDARD_ERROR_ENVELOPE_V2', 'inventory standard error envelope');
assertIncludes(inventory, 'docs/contracts/v2/API_GOVERNANCE_AND_OPENAPI_V2.md', 'inventory API governance contract ref');
assertIncludes(inventory, 'docs/contracts/v2/REPORTING_AND_CUSTOMER_API_CONTRACT_V2.md', 'inventory reporting contract ref');
assertIncludes(inventory, 'docs/contracts/v2/EVIDENCE_AND_ACCEPTANCE_CONTRACT_V2.md', 'inventory evidence contract ref');
assertIncludes(inventory, 'docs/contracts/v2/AO_ACT_AND_AO_SENSE_BOUNDARY_CONTRACT_V2.md', 'inventory AO boundary contract ref');
assertIncludes(inventory, 'docs/contracts/v2/ROI_AND_FIELD_MEMORY_TRUST_LANE_CONTRACT_V2.md', 'inventory ROI/memory contract ref');

const requiredRoutes = [
  '/api/v1/customer/reports', '/api/v1/customer/fields', '/api/v1/customer/operations',
  '/api/v1/reports/operation/:operation_id', '/api/v1/reports/field/:field_id', '/api/v1/reports/customer-dashboard/*',
  '/api/v1/operator/*', '/api/v1/actions/*', '/api/v1/approvals/*', '/api/v1/approval-requests', '/api/v1/approval-requests/*',
  '/api/v1/acceptance/*', '/api/v1/sense/*', '/api/v1/sensing/*', '/api/v1/inspection/pest-disease/*',
  '/api/v1/roi-ledger/*', '/api/v1/field-memory/*', '/api/v1/field-programs', '/api/v1/field-programs/*',
  '/api/v1/evidence-reports', '/api/v1/evidence-reports/*', '/api/v1/skills', '/api/v1/skills/*', '/api/v1/skills-rules/*',
  '/api/v1/devices/:device_id/simulator/*', '/api/v1/devices/:device_id/*', '/api/v1/devices/*'
];
for (const route of requiredRoutes) assertIncludes(inventory, `route_path: "${route}"`, `inventory route ${route}`);

const inventoryEntries = inventory.split('entry({').slice(1).map((chunk) => chunk.split('}),')[0]);
function fieldPresent(chunk, field) {
  const constants = allowedFieldConstants.join('|');
  return new RegExp(`${field}:\\s*("[^"]+"|${constants})`).test(chunk);
}
function entryFor(route) {
  return inventoryEntries.find((chunk) => chunk.includes(`route_path: "${route}"`)) ?? '';
}
for (const chunk of inventoryEntries) {
  const route = /route_path:\s*"([^"]+)"/.exec(chunk)?.[1] ?? 'unknown-route';
  const boundary = /boundary:\s*"([^"]+)"/.exec(chunk)?.[1] ?? '';
  const audience = /audience:\s*"([^"]+)"/.exec(chunk)?.[1] ?? '';
  for (const field of requiredInventoryFields) assert(fieldPresent(chunk, field), `inventory entry ${route} missing ${field}`);
  if (boundary === 'official' && audience !== 'system') {
    assert(!/auth_scope:\s*""/.test(chunk), `official route ${route} missing auth_scope`);
    assert(!/contract_ref:\s*""/.test(chunk), `official route ${route} missing contract_ref`);
    assert(!/error_model:\s*"LEGACY_COMPAT"/.test(chunk), `official route ${route} must not use legacy error model`);
  }
}
assertIncludes(entryFor('/api/v1/approval-requests'), 'gate_maturity: "legacy_exempt"', 'approval-requests root legacy inventory');
assertIncludes(entryFor('/api/v1/approval-requests/*'), 'boundary: "compat"', 'approval-requests group compat inventory');
assertIncludes(entryFor('/api/v1/devices/:device_id/simulator/*'), 'boundary: "debug"', 'device simulator debug inventory');
assertIncludes(entryFor('/api/v1/devices/:device_id/simulator/*'), 'gate_maturity: "debug_exempt"', 'device simulator debug gate maturity');
assertIncludes(entryFor('/api/v1/devices/:device_id/*'), 'gate_maturity: "inventory_baseline"', 'device subroutes inventory baseline');
assertIncludes(entryFor('/api/v1/inspection/pest-disease/*'), 'gate_maturity: "inventory_baseline"', 'PDI inventory baseline until OpenAPI hardened');
assertIncludes(entryFor('/api/v1/acceptance/*'), 'gate_maturity: "inventory_baseline"', 'acceptance inventory baseline until OpenAPI hardened');
assertIncludes(entryFor('/api/v1/skills-rules/*'), 'gate_maturity: "inventory_baseline"', 'skills-rules inventory baseline until OpenAPI hardened');

assertIncludes(errorEnvelope, 'Status: Proposed / Draft', 'error envelope draft status');
assertIncludes(errorEnvelope, 'GEOX Standard Error Envelope V2', 'error envelope title');
assertIncludes(errorEnvelope, '"ok": false', 'error envelope ok false');
assertIncludes(errorEnvelope, '"error"', 'error envelope error object');
assertIncludes(errorEnvelope, 'error.code', 'error envelope code field');
assertIncludes(errorEnvelope, 'error.message', 'error envelope message field');
assertIncludes(errorEnvelope, 'error.category', 'error envelope category field');
assertIncludes(errorEnvelope, 'error.retryable', 'error envelope retryable field');
assertIncludes(errorEnvelope, 'contract_ref', 'error envelope contract ref');
assertIncludes(errorEnvelope, 'does not claim RFC9457 compliance', 'error envelope RFC9457 non-claim');

assertIncludes(openapiSelfcheck, 'inventoryEntries', 'OpenAPI selfcheck reads inventory');
assertIncludes(openapiSelfcheck, 'routeMatchesInventory', 'OpenAPI selfcheck inventory matcher');
assertIncludes(openapiSelfcheck, 'exactMatches', 'OpenAPI selfcheck exact match priority');
assertIncludes(openapiSelfcheck, 'groupMatches', 'OpenAPI selfcheck group match handling');
assertIncludes(openapiSelfcheck, 'sort((a, b) => b.pattern.length - a.pattern.length)', 'OpenAPI selfcheck longest-prefix priority');
assertIncludes(openapiSelfcheck, 'routePatternToRegex', 'OpenAPI selfcheck dynamic route pattern matcher');
assertIncludes(openapiSelfcheck, 'gate_maturity', 'OpenAPI selfcheck uses gate maturity');
assertIncludes(openapiSelfcheck, 'inventory_baseline', 'OpenAPI selfcheck inventory baseline warning handling');
assertIncludes(openapiSelfcheck, 'missing_inventory', 'OpenAPI selfcheck missing inventory fail');
assertIncludes(openapiSelfcheck, 'missing_openapi_path', 'OpenAPI selfcheck missing openapi path classification');
assertIncludes(openapiSelfcheck, 'officialRoutesNoLongerExcluded', 'OpenAPI selfcheck official route exclusion guard');
for (const blockedPattern of ['/api/v1/acceptance/', '/api/v1/reports/customer-dashboard/', '/api/v1/inspection/pest-disease', '/api/v1/roi-ledger', '/api/v1/field-memory']) {
  assertIncludes(openapiSelfcheck, blockedPattern, `OpenAPI selfcheck official no-long-exclusion marker ${blockedPattern}`);
}

assertIncludes(openapi, 'bearerAuth', 'OpenAPI bearer auth exists');
assertIncludes(openapi, 'OperationReportV1', 'OpenAPI operation report schema exists');
assertIncludes(openapi, '/api/v1/reports/operation/{operation_id}', 'OpenAPI operation report path exists');

const webDir = path.join(root, 'apps/web/src');
function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fp = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(fp));
    else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) out.push(fp);
  }
  return out;
}
const frontendLegacyDeps = [];
for (const file of walk(webDir)) {
  const text = read(file);
  if (text.includes('/api/control/') || text.includes('/api/devices/')) frontendLegacyDeps.push(path.relative(root, file));
}
assert(frontendLegacyDeps.length === 0, `legacy/compat route frontend dependency found: ${frontendLegacyDeps.join(', ')}`);

console.log('[api-governance-baseline-v2] PASS');
