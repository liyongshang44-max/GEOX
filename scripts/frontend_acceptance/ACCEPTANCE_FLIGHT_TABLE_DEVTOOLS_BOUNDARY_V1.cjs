#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const FILES = {
  runtimeRoute: 'apps/server/src/routes/v1/runtime_features_v1.ts',
  coreRoutes: 'apps/server/src/routes/registerCoreV1Routes.ts',
  runtimeSecurity: 'apps/server/src/runtime/runtime_security_v1.ts',
  devtoolsModule: 'apps/server/src/modules/devtools/registerDevtoolsModule.ts',
  runtimeFeaturesApi: 'apps/web/src/api/runtimeFeatures.ts',
  dashboardRoutes: 'apps/web/src/app/routes/dashboardRoutes.tsx',
};

function read(rel) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) throw new Error(`missing file: ${rel}`);
  return fs.readFileSync(abs, 'utf8');
}

function assertContains(text, re, message, failures) {
  if (!re.test(text)) failures.push(message);
}

function assertNotContains(text, re, message, failures) {
  if (re.test(text)) failures.push(message);
}

const failures = [];
const runtimeRoute = read(FILES.runtimeRoute);
const coreRoutes = read(FILES.coreRoutes);
const runtimeSecurity = read(FILES.runtimeSecurity);
const devtoolsModule = read(FILES.devtoolsModule);
const runtimeFeaturesApi = read(FILES.runtimeFeaturesApi);
const dashboardRoutes = read(FILES.dashboardRoutes);

assertContains(runtimeSecurity, /export\s+function\s+isRuntimeDevtoolsEnabledV1\s*\(/, 'runtime security must expose shared devtools feature helper', failures);
assertContains(devtoolsModule, /isRuntimeDevtoolsEnabledV1/, 'devtools module must reuse runtime security feature helper', failures);
assertNotContains(devtoolsModule, /process\.env\.GEOX_DEVTOOLS_ENABLED/, 'devtools module must not independently read GEOX_DEVTOOLS_ENABLED', failures);

assertContains(runtimeRoute, /\/api\/v1\/runtime\/features/, 'server must expose GET /api/v1/runtime/features', failures);
assertContains(runtimeRoute, /flight_table_enabled:\s*devtoolsEnabled/, 'flight_table_enabled must be derived from backend devtools status', failures);
assertContains(runtimeRoute, /operator_enabled:\s*true/, 'runtime features must expose operator_enabled=true', failures);
assertContains(runtimeRoute, /customer_pages_enabled:\s*true/, 'runtime features must expose customer_pages_enabled=true', failures);
assertContains(coreRoutes, /registerRuntimeFeaturesV1Routes\(app\)/, 'runtime features route must be registered under core v1 routes', failures);

assertContains(runtimeFeaturesApi, /fetchRuntimeFeatures\s*\(/, 'web must have runtime features API client', failures);
assertContains(runtimeFeaturesApi, /\/api\/v1\/runtime\/features/, 'web runtime features client must call /api/v1/runtime/features', failures);
assertContains(dashboardRoutes, /function\s+FlightTableRuntimeGate\s*\(/, 'route must gate FlightTablePage behind runtime features', failures);
assertContains(dashboardRoutes, /fetchRuntimeFeatures\s*\(\)/, 'FlightTable route gate must fetch runtime features before mounting FlightTablePage', failures);
assertContains(dashboardRoutes, /!features\?\.features\.flight_table_enabled/, 'FlightTable route gate must render disabled state when flight_table_enabled=false', failures);
assertContains(dashboardRoutes, /return\s+<FlightTablePage\s*\/?>/, 'FlightTablePage may only mount after the feature gate passes', failures);
assertContains(dashboardRoutes, /飞行台未启用/, 'disabled page must show customer-visible disabled title', failures);
assertContains(dashboardRoutes, /当前 runtime 禁止 devtools/, 'disabled page must explain devtools disabled boundary', failures);

const gateIndex = dashboardRoutes.indexOf('!features?.features.flight_table_enabled');
const mountIndex = dashboardRoutes.indexOf('return <FlightTablePage');
if (!(gateIndex >= 0 && mountIndex > gateIndex)) {
  failures.push('FlightTablePage mount must appear after the disabled feature branch');
}

if (failures.length) {
  console.error('ACCEPTANCE_FLIGHT_TABLE_DEVTOOLS_BOUNDARY_V1 failed');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log('ACCEPTANCE_FLIGHT_TABLE_DEVTOOLS_BOUNDARY_V1 passed');
