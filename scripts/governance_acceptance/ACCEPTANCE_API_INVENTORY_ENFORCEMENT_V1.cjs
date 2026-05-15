#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const inventoryPath = path.join(root, 'apps/server/src/routes/api_route_inventory_v1.ts');

function assert(cond, msg) {
  if (!cond) {
    console.error(`[ACCEPTANCE_API_INVENTORY_ENFORCEMENT_V1] FAIL: ${msg}`);
    process.exit(1);
  }
}

function rel(file) {
  return path.relative(root, file).replace(/\\/g, '/');
}

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.git', 'dist', 'build', 'coverage', '.next'].includes(entry.name)) continue;
      walk(full, out);
    } else if (/\.(ts|tsx|js|cjs|mjs)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function getAppRoutePaths() {
  const routeFiles = walk(path.join(root, 'apps/server/src/routes'))
    .filter((file) => rel(file) !== 'apps/server/src/routes/api_route_inventory_v1.ts');
  const routeRegex = /\.\s*(get|post|put|patch|delete|all)\s*\(\s*[`'"]([^`'"]+)/g;
  const routes = [];
  for (const file of routeFiles) {
    const text = read(file);
    let match;
    while ((match = routeRegex.exec(text)) !== null) {
      const method = match[1].toUpperCase();
      const routePath = match[2];
      if (!routePath.startsWith('/api')) continue;
      routes.push({ file: rel(file), method, path: routePath });
    }
  }
  return routes;
}

function inventoryPrefixes(text) {
  const matches = [...text.matchAll(/path_prefix:\s*"([^"]+)"/g)].map((m) => m[1]);
  return Array.from(new Set(matches));
}

function pathCovered(routePath, prefixes) {
  return prefixes.some((prefix) => routePath === prefix || routePath.startsWith(`${prefix}/`) || routePath.startsWith(`${prefix}:`) || routePath.startsWith(prefix.replace(/\/[^/]+$/, '')));
}

assert(fs.existsSync(inventoryPath), 'API_ROUTE_INVENTORY source file must exist');
const inventory = read(inventoryPath);
assert(inventory.includes('export const API_ROUTE_INVENTORY'), 'API_ROUTE_INVENTORY must be exported');
for (const required of [
  '/api/v1/reports',
  '/api/v1/actions',
  '/api/v1/approvals',
  '/api/v1/recommendations',
  '/api/v1/sensing',
  '/api/v1/sense',
  '/api/v1/devices',
  '/api/v1/alerts',
  '/api/v1/skills',
  '/api/v1/field-programs',
  '/api/admin',
  '/api/debug',
]) {
  assert(inventory.includes(`path_prefix: "${required}"`), `API_ROUTE_INVENTORY missing ${required}`);
}
assert(inventory.includes('audience: "customer"'), 'inventory must mark customer audience routes');
assert(inventory.includes('boundary: "official"'), 'inventory must mark official routes');
assert(inventory.includes('guarded_projection: true'), 'customer official API must require guarded projection');
assert(inventory.includes('customer_navigation_allowed: false'), 'inventory must explicitly block non-customer navigation');
assert(inventory.includes('write_requires_backend_validation: true'), 'operator write APIs must require backend validation');
assert(inventory.includes('audit_required: true'), 'operator/admin write APIs must require audit');

const prefixes = inventoryPrefixes(inventory);
const uncovered = getAppRoutePaths().filter((r) => !pathCovered(r.path, prefixes));
assert(uncovered.length === 0, `new /api route must be registered in API_ROUTE_INVENTORY:\n${uncovered.map((r) => `${r.file} ${r.method} ${r.path}`).join('\n')}`);

const reportsRoute = path.join(root, 'apps/server/src/routes/reports_v1.ts');
assert(fs.existsSync(reportsRoute), 'reports_v1 route must exist');
const reportsText = read(reportsRoute);
for (const route of ['/api/v1/reports/customer-dashboard/aggregate', '/api/v1/reports/field/', '/api/v1/reports/operation/']) {
  assert(reportsText.includes(route), `customer official API route missing ${route}`);
}
for (const guard of ['projectReportV1', 'projectFieldReportDetailV1', 'projectOperationStateV1', 'requireAoActScopeV0', 'enforceFieldScopeOrDeny', 'enforceOperationFieldScope']) {
  assert(reportsText.includes(guard), `customer official API must pass guarded projection/scope: ${guard}`);
}

const webFiles = walk(path.join(root, 'apps/web/src'));
const navOffenders = [];
for (const file of webFiles) {
  const text = read(file);
  if (!text.includes('/api/admin') && !text.includes('/api/debug') && !text.includes('/api/internal')) continue;
  navOffenders.push(rel(file));
}
assert(navOffenders.length === 0, `admin/debug/internal routes must not enter customer navigation/frontend API:\n${navOffenders.join('\n')}`);

console.log('[ACCEPTANCE_API_INVENTORY_ENFORCEMENT_V1] PASSED');
