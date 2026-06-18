// scripts/frontend_acceptance/ACCEPTANCE_FRONTEND_SURFACE_CONTRACT_V1.cjs
// Purpose: verify the GEOX frontend three-surface contract before adding the Operator Twin Workbench.
// Boundary: this acceptance checks route/product-surface separation only; it does not validate agronomy algorithms.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

function readText(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

function assert(condition, message, detail) {
  if (!condition) {
    const suffix = detail === undefined ? '' : `\n${JSON.stringify(detail, null, 2)}`;
    throw new Error(`${message}${suffix}`);
  }
}

function assertIncludes(text, needle, label) {
  assert(text.includes(needle), `missing required token: ${label}`, { needle });
}

function assertNotIncludes(text, needle, label) {
  assert(!text.includes(needle), `forbidden token present: ${label}`, { needle });
}

function extractBetween(text, startToken, endToken, label) {
  const start = text.indexOf(startToken);
  assert(start >= 0, `missing section start: ${label}`, { startToken });
  const end = text.indexOf(endToken, start + startToken.length);
  assert(end >= 0, `missing section end: ${label}`, { endToken });
  return text.slice(start, end);
}

const docPath = 'docs/frontend/GEOX_FRONTEND_SURFACE_CONTRACT_V0_2.md';
const appPath = 'apps/web/src/app/App.tsx';
const packagePath = 'package.json';

assert(fs.existsSync(path.join(ROOT, docPath)), 'frontend surface contract document missing', { docPath });

const doc = readText(docPath);
const app = readText(appPath);
const pkg = JSON.parse(readText(packagePath));

assertIncludes(doc, 'Customer Delivery Portal', 'customer surface name');
assertIncludes(doc, 'Operator Twin Workbench', 'operator surface name');
assertIncludes(doc, 'Admin Control Plane Console', 'admin surface name');
assertIncludes(doc, '???????????????????', 'surface boundary sentence');

assertIncludes(doc, '/customer/*', 'customer path prefix');
assertIncludes(doc, '/operator/*', 'operator path prefix');
assertIncludes(doc, '/admin/*', 'admin path prefix');

assertIncludes(doc, 'Customer pages must not show or provide:', 'customer forbidden section');
assertIncludes(doc, 'Operator pages must not:', 'operator forbidden section');
assertIncludes(doc, 'Admin pages must not:', 'admin forbidden section');

assertIncludes(doc, 'run forecast', 'customer cannot run forecast');
assertIncludes(doc, 'edit scenario', 'customer cannot edit scenario');
assertIncludes(doc, 'submit recommendation', 'customer cannot submit recommendation');
assertIncludes(doc, 'directly create AO-ACT task', 'operator cannot direct create task');
assertIncludes(doc, 'bypass approval', 'operator cannot bypass approval');
assertIncludes(doc, 'present device online status as crop health', 'admin cannot confuse device health with crop health');

assert(pkg.scripts, 'package scripts missing');
assert(
  pkg.scripts['ci:frontend:surface-contract'] === 'node scripts/frontend_acceptance/ACCEPTANCE_FRONTEND_SURFACE_CONTRACT_V1.cjs',
  'package script ci:frontend:surface-contract missing or incorrect',
  { actual: pkg.scripts['ci:frontend:surface-contract'] }
);

assertIncludes(app, 'path="/customer/*"', 'customer top-level route');
assertIncludes(app, 'path="/admin/*"', 'admin top-level route');
assertIncludes(app, 'CustomerLayout', 'customer layout import/use');
assertIncludes(app, 'AdminLayout', 'admin layout import/use');

const customerRoutes = extractBetween(app, 'function CustomerRoutes()', 'function CustomerShell()', 'CustomerRoutes');
assertIncludes(customerRoutes, 'path="dashboard"', 'customer dashboard route');
assertIncludes(customerRoutes, 'path="export"', 'customer export route');
assertIncludes(customerRoutes, 'path="fields/:fieldId"', 'customer field report route');
assertIncludes(customerRoutes, 'path="fields/:fieldId/export"', 'customer field export route');
assertIncludes(customerRoutes, 'path="operations/:operationId"', 'customer operation report route');
assertIncludes(customerRoutes, 'path="operations/:operationId/export"', 'customer operation export route');

[
  'forecast',
  'scenarios',
  'scenario',
  'skills',
  'dispatch',
  'approval',
  'approve',
  'AO-ACT',
  'DevToolsPage',
  'Admin'
].forEach((token) => {
  assertNotIncludes(customerRoutes, token, `customer route must not expose ${token}`);
});

const adminShell = extractBetween(app, 'function AdminShell()', 'export default function App()', 'AdminShell');
[
  'path="dashboard"',
  'path="fields"',
  'path="operations"',
  'path="devices"',
  'path="alerts"',
  'path="evidence"',
  'path="skills"',
  'path="healthz"',
  'path="import"',
  'path="acceptance"'
].forEach((token) => {
  assertIncludes(adminShell, token, `admin route includes ${token}`);
});

[
  'path="twin"',
  'path="forecast"',
  'path="scenarios"',
  'ScenarioCompare',
  'ForecastPanel'
].forEach((token) => {
  assertNotIncludes(adminShell, token, `admin shell must not become twin workbench via ${token}`);
});

if (app.includes('path="/operator/*"')) {
  assertIncludes(app, 'Operator', 'operator surface must use operator-specific naming once /operator exists');
  assert(!app.includes('path="/operator/*" element={<CustomerShell'), 'operator route must not mount CustomerShell');
  assert(!app.includes('path="/operator/*" element={<AdminShell'), 'operator route must not mount AdminShell');
}

console.log('[frontend-surface-contract] PASS');
