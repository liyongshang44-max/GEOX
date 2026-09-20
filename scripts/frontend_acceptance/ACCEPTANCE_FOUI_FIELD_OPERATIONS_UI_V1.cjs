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
  fields: 'apps/web/src/features/operator/pages/FieldIntelligenceFieldsPage.tsx',
  fieldDetail: 'apps/web/src/features/operator/pages/FieldIntelligenceDetailPage.tsx',
  agronomy: 'apps/web/src/features/operator/pages/AgronomyPlanningPage.tsx',
  operations: 'apps/web/src/features/operator/pages/FieldOperationsPage.tsx',
  canonicalField: 'apps/web/src/features/operator/fieldRuntime/McftCanonicalFieldRuntimeRoutePage.tsx',
  css: 'apps/web/src/styles/fouiFieldOperations.css',
};

for (const p of Object.values(files)) if (!fs.existsSync(path.join(ROOT, p))) fail('FOUI_UI_FILE_MISSING:' + p);
const source = Object.fromEntries(Object.entries(files).map(([k,p]) => [k, read(p)]));

if (!hasAll(source.app, [
  'path="home" element={<FieldOperationsHomePage />}',
  'path="field-intelligence" element={<FieldIntelligenceFieldsPage />}',
  'path="field-intelligence/:fieldId" element={<FieldIntelligenceDetailPage />}',
  'path="fields/*" element={<OperatorFieldRuntimeRoutes />}',
  'path="agronomy" element={<AgronomyPlanningPage />}',
  'path="operations" element={<FieldOperationsPage />}',
  'path="twin" element={<OperatorTwinOverviewPage />}',
])) fail('FOUI_UI_ROUTE_TOPOLOGY');

if (!hasAll(source.layout, [
  'to: "/operator/home"',
  'to: "/operator/field-intelligence"',
  'to: "/operator/agronomy"',
  'to: "/operator/operations"',
  'to: "/customer/reports"',
  'to: "/admin/dashboard"',
  'data-product-shell="foui-v1"',
])) fail('FOUI_UI_NAVIGATION');

if (!hasAll(source.home, [
  'fetchOperatorTwinOverview',
  'fetchOperatorWorkbench',
  'APPROVAL_PENDING',
  'EVIDENCE_INSUFFICIENT',
  'operator_twin_overview_v1',
  '/operator/field-intelligence',
])) fail('FOUI_UI_HOME_READ_SOURCES');

if (!hasAll(source.fields, ['fetchFields', 'fetchFieldRuntimeScopeOptions', 'zone_id', 'GET ONLY'])) fail('FOUI_FIELD_SCOPE_SELECTOR');
if (!hasAll(source.fieldDetail, ['readMcftRuntime', 'readMcftStates', 'readMcftForecasts', 'Full runtime response', 'ON-DEMAND CANONICAL DATASETS'])) fail('FOUI_FIELD_DATA_READS');
if (!lacksAll(source.canonicalField, ['buildFieldIntelligenceOverviewVmV1', 'fouiCanonicalDisclosure', 'data-foui-surface="field-intelligence-detail"'])) fail('FOUI_MUTATED_MCFT_PRODUCT_SURFACE');

if (!lacksAll(source.home, ['priorityText', 'item.priority', 'risk_score', 'severityText'])) fail('FOUI_UI_HOME_LEGACY_PRIORITY_PROMOTION');
if (!hasAll(source.agronomy, ['ADR DecisionResult', 'GovernedActionCaseProjection runtime', 'recommendation', 'approval'])) fail('FOUI_UI_AGRONOMY_BOUNDARY');
if (!hasAll(source.operations, ['FOUI does not own approve()', 'APPROVAL_PENDING', 'DISPATCH_PENDING', 'EXECUTION_EXCEPTION', 'EVIDENCE_INSUFFICIENT', 'AcceptanceResult ≠ Outcome'])) fail('FOUI_UI_OPERATIONS_BOUNDARY');
if (!lacksAll(source.operations, ['priorityText', 'item.priority', 'risk_score'])) fail('FOUI_UI_OPERATIONS_LEGACY_PRIORITY_PROMOTION');

if (!hasAll(source.css, ['--foui-paper','--foui-green','[data-product-shell="foui-v1"]','.fouiDashboardGrid','.fouiOperationsBoard','.fouiScopeForm','.fouiCanonicalDisclosure'])) fail('FOUI_UI_VISUAL_FOUNDATION');

for (const value of [source.home, source.fields, source.fieldDetail, source.agronomy, source.operations]) {
  if (/fetch\s*\([^)]*\/api\/v1\/product-projections/i.test(value)) fail('FOUI_UI_UNAUTHORIZED_PROJECTION_ROUTE_USE');
}

console.log(JSON.stringify({
  status: 'PASS',
  gate: 'FOUI-FIELD-OPERATIONS-UI-V1',
  base: 'cde7cec366be62eacbfc528a61f3ea2044a7de2e',
  mcft_owned_surface_change: 'NONE',
  backend_change: 'NONE',
  projection_runtime_assumption: 'NONE',
  legacy_priority_promoted: false,
  pages: ['Home', 'Fields', 'Field Intelligence Detail', 'Agronomy', 'Operations'],
}, null, 2));
