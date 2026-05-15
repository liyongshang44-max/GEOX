#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const inventoryPath = path.join(root, 'apps/server/src/routes/api_route_inventory_v1.ts');
const reportsRoute = path.join(root, 'apps/server/src/routes/reports_v1.ts');
const dashboardRoute = path.join(root, 'apps/server/src/routes/reports_dashboard_v1.ts');
const sensingRoute = path.join(root, 'apps/server/src/routes/sensing_fact_envelope_v1.ts');
const senseRoute = path.join(root, 'apps/server/src/routes/v1/sense.ts');

function fail(msg) {
  console.error(`[ACCEPTANCE_API_INVENTORY_ENFORCEMENT_V1] FAIL: ${msg}`);
  process.exit(1);
}
function assert(cond, msg) { if (!cond) fail(msg); }
function read(file) { return fs.readFileSync(file, 'utf8'); }

assert(fs.existsSync(inventoryPath), 'API_ROUTE_INVENTORY source file must exist');
const inventory = read(inventoryPath);
assert(inventory.includes('export const API_ROUTE_INVENTORY'), 'API_ROUTE_INVENTORY must be exported');
assert(!inventory.includes('path_prefix'), 'API_ROUTE_INVENTORY must not rely on prefix-only path_prefix entries');
for (const marker of ['route_path:', 'route_group:', 'path_match:', 'ApiRouteInventoryPathMatchV1', 'path_match: "exact"', 'path_match: "group"']) {
  assert(inventory.includes(marker), `route/group-level inventory missing marker ${marker}`);
}

for (const required of [
  '/api/v1/reports/customer-dashboard/aggregate',
  '/api/v1/reports/field/:field_id',
  '/api/v1/reports/operation/:operation_id',
  '/api/v1/sensing/raw-samples',
  '/api/v1/sensing/series',
  '/api/v1/sense/task',
  '/api/v1/sense/receipt',
  '/api/v1/sense/tasks',
  '/api/v1/sense/receipts',
  '/api/v1/sense/next-task',
  '/api/v1/actions/*',
  '/api/v1/approvals/*',
  '/api/v1/recommendations/*',
]) {
  assert(inventory.includes(`route_path: "${required}"`), `API_ROUTE_INVENTORY missing route/group ${required}`);
}
for (const requiredGroup of [
  'customer-reports.dashboard',
  'customer-reports.field',
  'customer-reports.operation',
  'sensing.raw-samples',
  'sensing.series',
  'ao-sense.task',
  'ao-sense.receipt',
]) {
  assert(inventory.includes(`route_group: "${requiredGroup}"`), `API_ROUTE_INVENTORY missing route_group ${requiredGroup}`);
}
for (const marker of ['audience: "customer"','boundary: "official"','guarded_projection: true','customer_navigation_allowed: false','write_requires_backend_validation: true','audit_required: true']) {
  assert(inventory.includes(marker), `inventory missing marker ${marker}`);
}

for (const file of [reportsRoute, dashboardRoute, sensingRoute, senseRoute]) {
  assert(fs.existsSync(file), `protected route file missing: ${file}`);
}
const reportsText = read(reportsRoute);
const dashboardText = read(dashboardRoute);
const sensingText = read(sensingRoute);
const senseText = read(senseRoute);

assert(dashboardText.includes('/api/v1/reports/customer-dashboard/aggregate'), 'customer dashboard aggregate route missing');
assert(reportsText.includes('/api/v1/reports/field/'), 'customer field report route missing');
assert(reportsText.includes('/api/v1/reports/operation/'), 'customer operation report route missing');
assert(sensingText.includes('/api/v1/sensing/raw-samples'), 'sensing raw-samples route missing');
assert(sensingText.includes('/api/v1/sensing/series'), 'sensing series route missing');
for (const route of ['/api/v1/sense/task', '/api/v1/sense/receipt', '/api/v1/sense/tasks', '/api/v1/sense/receipts', '/api/v1/sense/next-task']) {
  assert(senseText.includes(route), `AO-SENSE v1 route missing ${route}`);
}
for (const guard of ['projectReportV1','projectFieldReportDetailV1','projectOperationStateV1','requireAoActScopeV0','enforceFieldScopeOrDeny','enforceOperationFieldScope']) {
  assert(reportsText.includes(guard) || dashboardText.includes(guard), `customer official API must pass guarded projection/scope: ${guard}`);
}

const reportClient = path.join(root, 'apps/web/src/api/reports.ts');
assert(fs.existsSync(reportClient), 'customer report client must exist');
const reportClientText = read(reportClient);
assert(reportClientText.includes('/api/v1/reports/customer-dashboard/aggregate'), 'Customer dashboard must use official customer aggregate API');
assert(reportClientText.includes('/api/v1/reports/field/'), 'Field report must use official customer field report API');
assert(reportClientText.includes('/api/v1/reports/operation/'), 'Operation report must use official customer operation report API');

console.log('[ACCEPTANCE_API_INVENTORY_ENFORCEMENT_V1] PASSED');
