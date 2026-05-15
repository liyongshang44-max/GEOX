#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const inventoryPath = path.join(root, 'apps/server/src/routes/api_route_inventory_v1.ts');
const reportsRoute = path.join(root, 'apps/server/src/routes/reports_v1.ts');
const dashboardRoute = path.join(root, 'apps/server/src/routes/reports_dashboard_v1.ts');

function fail(msg) {
  console.error(`[ACCEPTANCE_API_INVENTORY_ENFORCEMENT_V1] FAIL: ${msg}`);
  process.exit(1);
}
function assert(cond, msg) { if (!cond) fail(msg); }
function rel(file) { return path.relative(root, file).replace(/\\/g, '/'); }
function read(file) { return fs.readFileSync(file, 'utf8'); }
function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.git', 'dist', 'build', 'coverage', '.next'].includes(entry.name)) continue;
      walk(full, out);
    } else if (/\.(ts|tsx|js|cjs|mjs)$/.test(entry.name)) out.push(full);
  }
  return out;
}
function routePaths() {
  const routeRegex = /\.\s*(get|post|put|patch|delete|all)\s*\(\s*[`'"]([^`'"]+)/g;
  const routes = [];
  for (const file of walk(path.join(root, 'apps/server/src/routes')).filter((f) => rel(f) !== 'apps/server/src/routes/api_route_inventory_v1.ts')) {
    const text = read(file);
    let m;
    while ((m = routeRegex.exec(text)) !== null) {
      if (m[2].startsWith('/api')) routes.push({ file: rel(file), method: m[1].toUpperCase(), path: m[2] });
    }
  }
  return routes;
}
function routeInventoryEntries(text) {
  const entryMatches = [...text.matchAll(/\{[\s\S]*?id:\s*"([^"]+)"[\s\S]*?route_path:\s*"([^"]+)"[\s\S]*?route_group:\s*"([^"]+)"[\s\S]*?path_match:\s*"([^"]+)"[\s\S]*?\}/g)];
  return entryMatches.map((m) => ({ id: m[1], route_path: m[2], route_group: m[3], path_match: m[4] }));
}
function routeToRegex(routePath) {
  const escaped = routePath
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/:[A-Za-z0-9_]+/g, '[^/]+')
    .replace(/\\\*/g, '.*');
  return new RegExp(`^${escaped}$`);
}
function covered(routePath, entries) {
  return entries.some((entry) => {
    if (entry.path_match === 'exact') return routeToRegex(entry.route_path).test(routePath);
    if (entry.path_match === 'group') {
      const base = entry.route_path.replace(/\/\*$/, '');
      return routePath === base || routePath.startsWith(`${base}/`) || routeToRegex(entry.route_path).test(routePath);
    }
    return false;
  });
}

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
  '/api/admin/*',
  '/api/debug/*',
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

const entries = routeInventoryEntries(inventory);
assert(entries.length >= 15, 'API_ROUTE_INVENTORY must contain route/group-level entries, not only coarse prefixes');
const uncovered = routePaths().filter((r) => !covered(r.path, entries));
assert(uncovered.length === 0, `new /api route must be registered in API_ROUTE_INVENTORY route/group entries:\n${uncovered.map((r) => `${r.file} ${r.method} ${r.path}`).join('\n')}`);

assert(fs.existsSync(reportsRoute), 'reports_v1 route must exist');
assert(fs.existsSync(dashboardRoute), 'reports_dashboard_v1 route must exist');
const reportsText = read(reportsRoute);
const dashboardText = read(dashboardRoute);
assert(dashboardText.includes('/api/v1/reports/customer-dashboard/aggregate'), 'customer dashboard aggregate route missing');
assert(reportsText.includes('/api/v1/reports/field/'), 'customer field report route missing');
assert(reportsText.includes('/api/v1/reports/operation/'), 'customer operation report route missing');
for (const guard of ['projectReportV1','projectFieldReportDetailV1','projectOperationStateV1','requireAoActScopeV0','enforceFieldScopeOrDeny','enforceOperationFieldScope']) {
  assert(reportsText.includes(guard) || dashboardText.includes(guard), `customer official API must pass guarded projection/scope: ${guard}`);
}

const adminPrefix = '/api/' + 'admin';
const debugPrefix = '/api/' + 'debug';
const internalPrefix = '/api/' + 'internal';
const customerSurfaceFiles = [
  'apps/web/src/api/reports.ts',
  'apps/web/src/layouts/CustomerLayout.tsx',
  'apps/web/src/views/CustomerDashboardPage.tsx',
  'apps/web/src/views/FieldReportPage.tsx',
  'apps/web/src/views/OperationReportPage.tsx',
  ...walk(path.join(root, 'apps/web/src/components/customer')).map(rel),
].map((p) => path.join(root, p));
const navOffenders = [];
for (const file of customerSurfaceFiles) {
  if (!fs.existsSync(file)) continue;
  const text = read(file);
  if (text.includes(adminPrefix) || text.includes(debugPrefix) || text.includes(internalPrefix)) navOffenders.push(rel(file));
}
assert(navOffenders.length === 0, `admin/debug/internal routes must not enter customer navigation/frontend API:\n${navOffenders.join('\n')}`);

console.log('[ACCEPTANCE_API_INVENTORY_ENFORCEMENT_V1] PASSED');
