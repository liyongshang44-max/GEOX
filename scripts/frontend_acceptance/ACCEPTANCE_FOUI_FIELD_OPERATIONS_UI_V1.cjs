'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.cwd();
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const fail = (code) => { throw new Error(code); };
const hasAll = (src, xs) => xs.every((x) => src.includes(x));
const lacksAll = (src, xs) => xs.every((x) => !src.includes(x));

const files = {
  app: 'apps/web/src/app/App.tsx',
  layout: 'apps/web/src/layouts/OperatorLayout.tsx',
  home: 'apps/web/src/features/operator/pages/FieldOperationsHomePage.tsx',
  agronomy: 'apps/web/src/features/operator/pages/AgronomyPlanningPage.tsx',
  operations: 'apps/web/src/features/operator/pages/FieldOperationsPage.tsx',
  css: 'apps/web/src/styles/fouiFieldOperations.css',
};

for (const p of Object.values(files)) if (!fs.existsSync(path.join(ROOT, p))) fail('FOUI_UI_FILE_MISSING:' + p);

const app = read(files.app);
const layout = read(files.layout);
const home = read(files.home);
const agronomy = read(files.agronomy);
const operations = read(files.operations);
const css = read(files.css);

if (!hasAll(app, [
  'path="home" element={<FieldOperationsHomePage />}',
  'path="fields/*" element={<OperatorFieldRuntimeRoutes />}',
  'path="agronomy" element={<AgronomyPlanningPage />}',
  'path="operations" element={<FieldOperationsPage />}',
  'path="twin" element={<OperatorTwinOverviewPage />}',
  'path="twin/fields/:fieldId" element={<OperatorFieldTwinWorkspacePage />}',
])) fail('FOUI_UI_ROUTE_TOPOLOGY');

if (!hasAll(layout, [
  'to: "/operator/home"',
  'to: "/operator/fields"',
  'to: "/operator/agronomy"',
  'to: "/operator/operations"',
  'to: "/customer/reports"',
  'to: "/admin/dashboard"',
  'data-product-shell="foui-v1"',
])) fail('FOUI_UI_NAVIGATION');

if (!hasAll(home, [
  'fetchOperatorTwinOverview',
  'fetchOperatorWorkbench',
  'APPROVAL_PENDING',
  'EVIDENCE_INSUFFICIENT',
  'operator_twin_overview_v1',
  'to={"/operator/fields" + scopeQuery}',
])) fail('FOUI_UI_HOME_READ_SOURCES');

if (!lacksAll(home, ['priorityText', 'item.priority', 'risk_score', 'severityText'])) fail('FOUI_UI_HOME_LEGACY_PRIORITY_PROMOTION');

if (!hasAll(agronomy, [
  'ADR DecisionResult',
  'GovernedActionCaseProjection runtime',
  'recommendation',
  'approval',
])) fail('FOUI_UI_AGRONOMY_BOUNDARY');

if (!hasAll(operations, [
  'FOUI does not own approve()',
  'APPROVAL_PENDING',
  'DISPATCH_PENDING',
  'EXECUTION_EXCEPTION',
  'EVIDENCE_INSUFFICIENT',
  'AcceptanceResult ≠ Outcome',
])) fail('FOUI_UI_OPERATIONS_BOUNDARY');

if (!lacksAll(operations, ['priorityText', 'item.priority', 'risk_score'])) fail('FOUI_UI_OPERATIONS_LEGACY_PRIORITY_PROMOTION');

if (!hasAll(css, [
  '--foui-paper',
  '--foui-green',
  '[data-product-shell="foui-v1"]',
  '.fouiDashboardGrid',
  '.fouiOperationsBoard',
  '@media (max-width: 760px)',
])) fail('FOUI_UI_VISUAL_FOUNDATION');

for (const source of [home, agronomy, operations]) {
  if (/fetch\s*\([^)]*\/api\/v1\/product-projections/i.test(source)) fail('FOUI_UI_UNAUTHORIZED_PROJECTION_ROUTE_USE');
  if (/\b(POST|PUT|PATCH|DELETE)\b/.test(source) && source.includes('product-projection')) fail('FOUI_UI_PROJECTION_MUTATION');
}

console.log(JSON.stringify({
  status: 'PASS',
  gate: 'FOUI-FIELD-OPERATIONS-UI-V1',
  base: 'cde7cec366be62eacbfc528a61f3ea2044a7de2e',
  mcft_change: 'NONE',
  backend_change: 'NONE',
  projection_runtime_assumption: 'NONE',
  legacy_priority_promoted: false,
  pages: ['Home', 'Fields canonical reuse', 'Agronomy', 'Operations'],
}, null, 2));
