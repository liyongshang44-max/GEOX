#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const files = {
  inventory: path.join(root, 'apps/server/src/routes/api_route_inventory_v1.ts'),
  inventoryDoc: path.join(root, 'docs/audit/API_ROUTE_INVENTORY.md'),
  openapi: path.join(root, 'apps/server/src/routes/openapi_v1.ts'),
  overlay: path.join(root, 'apps/server/src/routes/openapi_sales_critical_overlay_v1.ts'),
  selfcheck: path.join(root, 'apps/server/scripts/p1_3_openapi_alignment_selfcheck.mjs'),
  apiContract: path.join(root, 'docs/contracts/v2/API_GOVERNANCE_AND_OPENAPI_V2.md'),
  errorContract: path.join(root, 'docs/contracts/v2/GEOX_STANDARD_ERROR_ENVELOPE_V2.md'),
};

function read(file) { return fs.readFileSync(file, 'utf8'); }
function fail(message) {
  console.error(`[api-governance-baseline-v2] FAIL: ${message}`);
  process.exit(1);
}
function mustHave(source, needle, label) {
  if (!source.includes(needle)) fail(`${label} missing ${needle}`);
}

const inventory = read(files.inventory);
const inventoryDoc = read(files.inventoryDoc);
const openapi = read(files.openapi);
const overlay = read(files.overlay);
const selfcheck = read(files.selfcheck);
const apiContract = read(files.apiContract);
const errorContract = read(files.errorContract);
const combinedOpenapi = `${openapi}\n${overlay}`;

const requiredInventoryFields = ['owner', 'audience', 'boundary', 'source_model', 'auth_scope', 'error_model', 'contract_ref', 'gate_maturity'];
for (const field of requiredInventoryFields) {
  mustHave(inventory, `${field}:`, `inventory field ${field}`);
  mustHave(inventoryDoc, `\`${field}\``, `inventory doc field ${field}`);
}

const salesCriticalInventoryRoutes = [
  '/api/v1/customer/reports',
  '/api/v1/customer/fields',
  '/api/v1/customer/operations',
  '/api/v1/reports/operation/:operation_id',
  '/api/v1/reports/field/:field_id',
  '/api/v1/reports/customer-dashboard/*',
  '/api/v1/actions/*',
  '/api/v1/acceptance/*',
  '/api/v1/sense/*',
  '/api/v1/inspection/pest-disease/*',
  '/api/v1/evidence-export/*',
  '/api/v1/devices/:device_id/*',
  '/api/v1/fail-safe/*',
  '/api/v1/manual-takeover/*',
  '/api/v1/manual-takeovers',
];
for (const route of salesCriticalInventoryRoutes) {
  mustHave(inventory, `route_path: "${route}"`, `inventory sales critical route ${route}`);
}

const chunks = inventory.split('entry({').slice(1).map((chunk) => chunk.split('}),')[0]);
function valueOf(chunk, field) {
  const marker = `${field}: `;
  const start = chunk.indexOf(marker);
  if (start < 0) return '';
  const rest = chunk.slice(start + marker.length).trim();
  if (rest.startsWith('"')) return rest.slice(1).split('"')[0];
  return rest.split(/[ ,}]/)[0];
}
for (const chunk of chunks) {
  const route = valueOf(chunk, 'route_path') || 'unknown-route';
  const boundary = valueOf(chunk, 'boundary');
  const audience = valueOf(chunk, 'audience');
  const errorModel = valueOf(chunk, 'error_model');
  const contractRef = valueOf(chunk, 'contract_ref');
  const authScope = valueOf(chunk, 'auth_scope');
  for (const field of requiredInventoryFields) {
    if (!chunk.includes(`${field}:`)) fail(`inventory entry ${route} missing ${field}`);
  }
  if (boundary === 'official' && audience !== 'system') {
    if (!authScope) fail(`official route ${route} missing auth_scope`);
    if (!contractRef) fail(`official route ${route} missing contract_ref`);
    if (errorModel === 'LEGACY_COMPAT') fail(`official route ${route} uses legacy error model`);
  }
}

const salesCriticalOpenApiPaths = [
  '/api/v1/customer/reports',
  '/api/v1/customer/fields',
  '/api/v1/customer/operations',
  '/api/v1/reports/operation/{operation_id}',
  '/api/v1/reports/field/{field_id}',
  '/api/v1/actions/task',
  '/api/v1/actions/receipt',
  '/api/v1/actions/execute',
  '/api/v1/sense/task',
  '/api/v1/sense/receipt',
  '/api/v1/acceptance/evaluate',
  '/api/v1/evidence-export/jobs',
  '/api/v1/inspection/pest-disease/{inspection_id}',
  '/api/v1/devices/{device_id}/status',
  '/api/v1/fail-safe/events',
  '/api/v1/manual-takeovers',
];
for (const route of salesCriticalOpenApiPaths) mustHave(combinedOpenapi, route, `OpenAPI sales critical path ${route}`);

mustHave(openapi, 'bearerAuth', 'OpenAPI security scheme');
mustHave(openapi, 'OperationReportV1', 'OpenAPI operation report schema');
mustHave(openapi, 'ActionTaskRequest', 'OpenAPI action task request schema');
mustHave(openapi, 'ActionTaskResponse', 'OpenAPI action task response schema');
mustHave(openapi, 'SenseTaskRequest', 'OpenAPI sense task request schema');
mustHave(openapi, 'SenseReceiptResponse', 'OpenAPI sense receipt response schema');
mustHave(overlay, 'SALES_CRITICAL_OPENAPI_OVERLAY_V1', 'sales critical overlay export');
mustHave(overlay, 'PestDiseaseInspectionDetailResponseV1', 'sales critical PDI response schema marker');
mustHave(overlay, 'DeviceStatusResponseV1', 'sales critical device status response schema marker');

mustHave(selfcheck, 'salesCriticalRoutePatterns', 'OpenAPI selfcheck sales critical matcher');
mustHave(selfcheck, 'openapi_sales_critical_overlay_v1.ts', 'OpenAPI selfcheck overlay source');
mustHave(selfcheck, 'sales_critical_missing_openapi_path', 'OpenAPI selfcheck sales critical missing path error');
mustHave(selfcheck, 'sales_critical_warn_only', 'OpenAPI selfcheck no sales critical warn-only error');

mustHave(apiContract, 'Sales-critical API hard gate', 'API governance contract sales critical section');
mustHave(apiContract, '/customer/*', 'API governance customer path');
mustHave(apiContract, '/evidence-export/*', 'API governance evidence export path');
mustHave(apiContract, 'must not remain WARN-only', 'API governance no warn-only rule');

mustHave(errorContract, 'GEOX Standard Error Envelope V2', 'error envelope title');
mustHave(errorContract, '"ok": false', 'error envelope ok false');
mustHave(errorContract, 'error.code', 'error envelope code');
mustHave(errorContract, 'error.message', 'error envelope message');
mustHave(errorContract, 'error.category', 'error envelope category');
mustHave(errorContract, 'error.retryable', 'error envelope retryable');
mustHave(errorContract, 'contract_ref', 'error envelope contract ref');

console.log('[api-governance-baseline-v2] PASS');
