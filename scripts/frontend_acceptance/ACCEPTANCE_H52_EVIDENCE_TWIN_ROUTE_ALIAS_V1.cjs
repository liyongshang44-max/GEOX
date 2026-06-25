#!/usr/bin/env node
// scripts/frontend_acceptance/ACCEPTANCE_H52_EVIDENCE_TWIN_ROUTE_ALIAS_V1.cjs
'use strict';

// Purpose: statically verify the controlled H52 Evidence Twin route alias.
// Boundary: this script reads repository files only; it does not start the app, call APIs, write facts, or modify runtime state.

const fs = require('node:fs');

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function ok(condition, message) {
  if (!condition) throw new Error(message);
  console.log('[h52-evidence-twin-route-alias] ok:', message);
}

const operatorRoutesPath = 'apps/web/src/app/routes/operatorRoutes.tsx';
const dashboardRoutesPath = 'apps/web/src/app/routes/dashboardRoutes.tsx';
const appPath = 'apps/web/src/app/App.tsx';
const pagePath = 'apps/web/src/features/operator/pages/OperatorEvidenceTwinPage.tsx';
const adapterPath = 'apps/web/src/features/operator/evidenceTwin/evidenceTwinAdapter.ts';
const routeInventoryPath = 'docs/frontend-reset/H52.0-FRONTEND-ROUTE-INVENTORY.md';
const iaPath = 'docs/frontend-reset/H52.1-OPERATOR-EVIDENCE-TWIN-IA.md';
const guardrailPath = 'docs/frontend-reset/H52.1-a-IMPLEMENTATION-GUARDRAILS.md';

const operatorRoutes = read(operatorRoutesPath);
const dashboardRoutes = read(dashboardRoutesPath);
const app = read(appPath);
const page = read(pagePath);
const adapter = read(adapterPath);
const routeInventory = read(routeInventoryPath);
const ia = read(iaPath);
const guardrail = read(guardrailPath);

ok(routeInventory.includes('/app/operator/fields/:fieldId/evidence-twin'), 'route inventory defines H52 target Evidence Twin route');
ok(routeInventory.includes('/app/operator/fields/:fieldId/evidence-twin/water-stress'), 'route inventory defines H52 target Water Stress route');
ok(ia.includes('正式导航只能指向 `/app/operator/*`'), 'IA defines /app/operator as formal target route family');
ok(guardrail.includes('旧 route 不得先删'), 'guardrail forbids deleting old routes first');

ok(dashboardRoutes.includes('...renderOperatorRoutes()'), 'operator route module is already wired through dashboard routes');
ok(app.includes('{renderDashboardRoutes(expert)}'), 'AppRoutes still consumes dashboard route module');
ok(!app.includes('OperatorEvidenceTwinPage'), 'App.tsx does not directly import the H52 Evidence Twin page');
ok(!app.includes('/app/operator/*'), 'App.tsx does not introduce a broad /app/operator wildcard route');

ok(operatorRoutes.includes('OperatorEvidenceTwinPage'), 'operator route module imports OperatorEvidenceTwinPage');
ok(operatorRoutes.includes('path="/app/operator/fields/:fieldId/evidence-twin"'), 'controlled H52 Evidence Twin route alias exists');
ok(operatorRoutes.includes('path="/app/operator/fields/:fieldId/evidence-twin/water-stress"'), 'controlled H52 Water Stress route alias exists');
ok(operatorRoutes.includes('key="h52-evidence-twin"'), 'Evidence Twin route has stable H52 key');
ok(operatorRoutes.includes('key="h52-water-stress-loop"'), 'Water Stress route has stable H52 key');
ok(operatorRoutes.includes('<RouteErrorBoundary><OperatorEvidenceTwinPage /></RouteErrorBoundary>'), 'H52 aliases are wrapped with RouteErrorBoundary');

for (const legacyRoute of [
  '/operator/workbench',
  '/operator/approvals',
  '/operator/dispatch',
  '/operator/acceptance',
  '/operator/evidence',
  '/operator/devices-alerts',
  '/operator/roi-ledger',
  '/operator/field-memory',
]) {
  ok(operatorRoutes.includes(legacyRoute), 'legacy route preserved: ' + legacyRoute);
}

ok(page.includes('useParams'), 'Evidence Twin page reads route params');
ok(page.includes('fieldIdFromParams'), 'Evidence Twin page normalizes route fieldId');
ok(page.includes('buildOperatorEvidenceTwinEnvelope({ fieldId,'), 'Evidence Twin page passes route fieldId into adapter envelope');
ok(page.includes('data-contract="operator_evidence_twin_v1"'), 'Evidence Twin page keeps target contract marker');
ok(adapter.includes('canonical_route: "/app/operator/fields/"'), 'adapter canonical route still points to /app/operator field Evidence Twin');
ok(adapter.includes('legacy_visible_by_url_only: true'), 'adapter still records legacy route as URL-only');

ok(!operatorRoutes.includes('SubmitScenarioToRecommendationPanel'), 'route alias does not import scenario submit panel');
ok(!operatorRoutes.includes('submitOperatorScenarioRecommendation'), 'route alias does not import scenario submit API');
ok(!page.includes('apiRequestWithPolicy'), 'page still performs no API request');
ok(!page.includes('fetchOperator'), 'page still does not call Operator Twin fetchers');
ok(!page.includes('<button'), 'page still contains no button');
ok(!page.includes('提交为建议候选'), 'page still contains no submit-recommendation copy');

console.log('[h52-evidence-twin-route-alias] PASS');
