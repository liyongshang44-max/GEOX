#!/usr/bin/env node
// scripts/frontend_acceptance/ACCEPTANCE_H52_ROUTE_GOVERNANCE_CLEANUP_GATES_V1.cjs
'use strict';

// Purpose: statically verify H52.2 Slice 7 route governance cleanup gates before any legacy route deletion or redirect conversion.
// Boundary: this script reads repository files only; it does not start the app, call APIs, write facts, delete routes, or modify runtime state.

const fs = require('node:fs');

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function ok(condition, message) {
  if (!condition) throw new Error(message);
  console.log('[h52-route-governance-cleanup-gates] ok:', message);
}

const routeInventoryPath = 'docs/frontend-reset/H52.0-FRONTEND-ROUTE-INVENTORY.md';
const iaPath = 'docs/frontend-reset/H52.1-OPERATOR-EVIDENCE-TWIN-IA.md';
const contractPath = 'docs/frontend-reset/H52.1-EVIDENCE-TWIN-VIEW-MODEL-CONTRACT.md';
const acceptancePath = 'docs/frontend-reset/H52.1-WATER-STRESS-LOOP-ACCEPTANCE.md';
const guardrailPath = 'docs/frontend-reset/H52.1-a-IMPLEMENTATION-GUARDRAILS.md';
const appPath = 'apps/web/src/app/App.tsx';
const operatorRoutesPath = 'apps/web/src/app/routes/operatorRoutes.tsx';
const dashboardRoutesPath = 'apps/web/src/app/routes/dashboardRoutes.tsx';
const pagePath = 'apps/web/src/features/operator/pages/OperatorEvidenceTwinPage.tsx';
const adapterPath = 'apps/web/src/features/operator/evidenceTwin/evidenceTwinAdapter.ts';

const routeInventory = read(routeInventoryPath);
const ia = read(iaPath);
const contract = read(contractPath);
const acceptance = read(acceptancePath);
const guardrail = read(guardrailPath);
const app = read(appPath);
const operatorRoutes = read(operatorRoutesPath);
const dashboardRoutes = read(dashboardRoutesPath);
const page = read(pagePath);
const adapter = read(adapterPath);

ok(guardrail.includes('## 1. 每次任务的文档阅读门槛'), 'guardrail defines H52.2 document reading gate');
ok(guardrail.includes('## 10. 旧 route 不得先删'), 'guardrail defines legacy route no-delete-first gate');
ok(guardrail.includes('MIGRATE') && guardrail.includes('LEGACY_VISIBLE_BY_URL_ONLY') && guardrail.includes('DELETE_CANDIDATE'), 'guardrail defines ordered legacy route cleanup states');
ok(guardrail.includes('不删除旧页面') && guardrail.includes('不打开写入口'), 'guardrail preserves no old-page deletion and no write entry invariants');

ok(routeInventory.includes('LEGACY_VISIBLE_BY_URL_ONLY'), 'route inventory defines URL-only legacy route state');
ok(routeInventory.includes('DELETE_CANDIDATE'), 'route inventory defines delete-candidate state after acceptance');
ok(routeInventory.includes('Runtime duplicate') && routeInventory.includes('Shadowed duplicate'), 'route inventory defines duplicate-route cleanup categories');
ok(routeInventory.includes('/app/operator/fields/:fieldId/evidence-twin'), 'route inventory keeps canonical Evidence Twin target route');
ok(routeInventory.includes('/app/operator/fields/:fieldId/evidence-twin/water-stress'), 'route inventory keeps canonical Water Stress target route');
ok(routeInventory.includes('当前 routes 不应立即删除，应迁移或隔离'), 'route inventory forbids immediate legacy route deletion');

ok(ia.includes('/operator/twin/fields/:fieldId/post-irrigation'), 'IA records legacy Operator Twin route family');
ok(ia.includes('/app/operator/fields/:fieldId/evidence-twin'), 'IA records target Evidence Twin route');
ok(ia.includes('正式导航只能指向 `/app/operator/*`'), 'IA defines formal navigation target family');
ok(contract.includes('/app/operator/fields/:fieldId/evidence-twin'), 'view model contract records target Evidence Twin route');
ok(acceptance.includes('旧 `/operator/twin/*` route 与 H52 目标 `/app/operator/*` route 并存'), 'acceptance recognizes legacy and target route coexistence');

ok(app.includes('<Route path="/operator/*" element={<OperatorShell />} />'), 'App still preserves legacy /operator shell route');
ok(app.includes('path="twin/fields/:fieldId"'), 'App still preserves legacy field workspace route');
ok(app.includes('path="twin/fields/:fieldId/forecast"'), 'App still preserves legacy forecast route');
ok(app.includes('path="twin/fields/:fieldId/scenarios"'), 'App still preserves legacy scenario route');
ok(app.includes('path="twin/fields/:fieldId/evidence"'), 'App still preserves legacy evidence route');
ok(app.includes('path="twin/fields/:fieldId/calibration"'), 'App still preserves legacy calibration route');
ok(app.includes('path="twin/fields/:fieldId/post-irrigation"'), 'App still preserves legacy post-irrigation route');

ok(dashboardRoutes.includes('...renderOperatorRoutes()'), 'dashboard route module still mounts operator route module');
ok(operatorRoutes.includes('key="h52-evidence-twin"'), 'operator route module keeps stable H52 Evidence Twin route key');
ok(operatorRoutes.includes('key="h52-water-stress-loop"'), 'operator route module keeps stable H52 Water Stress route key');
ok(operatorRoutes.includes('path="/app/operator/fields/:fieldId/evidence-twin"'), 'operator route module keeps controlled H52 Evidence Twin alias');
ok(operatorRoutes.includes('path="/app/operator/fields/:fieldId/evidence-twin/water-stress"'), 'operator route module keeps controlled H52 Water Stress alias');
ok(!app.includes('OperatorEvidenceTwinPage'), 'App does not directly import H52 Evidence Twin page');
ok(!app.includes('/app/operator/*'), 'App does not introduce broad /app/operator wildcard before route governance acceptance');

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
  ok(operatorRoutes.includes(legacyRoute), 'legacy route preserved in operator route module: ' + legacyRoute);
}

for (const scriptPath of [
  'scripts/frontend_acceptance/ACCEPTANCE_H52_EVIDENCE_TWIN_ADAPTER_CONTRACT_V1.cjs',
  'scripts/frontend_acceptance/ACCEPTANCE_H52_EVIDENCE_TWIN_PAGE_SKELETON_V1.cjs',
  'scripts/frontend_acceptance/ACCEPTANCE_H52_EVIDENCE_TWIN_ROUTE_ALIAS_V1.cjs',
  'scripts/frontend_acceptance/ACCEPTANCE_H52_WATER_STRESS_STEPPER_NODES_V1.cjs',
  'scripts/frontend_acceptance/ACCEPTANCE_H52_SCENARIO_READ_ONLY_SECTION_V1.cjs',
  'scripts/frontend_acceptance/ACCEPTANCE_H52_VERIFICATION_READ_ONLY_SECTION_V1.cjs',
]) {
  ok(fs.existsSync(scriptPath), 'prior H52.2 slice acceptance exists: ' + scriptPath);
}

ok(page.includes('data-contract="operator_evidence_twin_v1"'), 'Evidence Twin page still exposes final contract marker');
ok(page.includes('data-page="h52-operator-evidence-twin"'), 'Evidence Twin page still exposes H52 page marker');
ok(adapter.includes('legacy_visible_by_url_only: true'), 'adapter still records legacy route as URL-only');
ok(adapter.includes('delete_old_pages_first: false'), 'adapter still forbids deleting old pages first');
ok(adapter.includes('canonical_routes:'), 'adapter still records canonical route set');
ok(adapter.includes('legacy_routes:'), 'adapter still records legacy route set');

ok(!operatorRoutes.includes('SubmitScenarioToRecommendationPanel'), 'route governance does not import scenario submit panel');
ok(!operatorRoutes.includes('submitOperatorScenarioRecommendation'), 'route governance does not import scenario submit API');
ok(!page.includes('apiRequestWithPolicy'), 'Evidence Twin page still performs no API requests');
ok(!page.includes('fetchOperator'), 'Evidence Twin page still does not call Operator Twin fetchers');
ok(!page.includes('<button'), 'Evidence Twin page still contains no button');
ok(!page.includes('提交为建议候选'), 'Evidence Twin page still contains no submit-recommendation copy');

console.log('[h52-route-governance-cleanup-gates] PASS');
