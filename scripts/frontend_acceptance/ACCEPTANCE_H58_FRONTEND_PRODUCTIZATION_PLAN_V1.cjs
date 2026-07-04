// scripts/frontend_acceptance/ACCEPTANCE_H58_FRONTEND_PRODUCTIZATION_PLAN_V1.cjs
// Purpose: statically verify the H58 frontend productization plan, route ownership matrix, and runtime nonclaim contract.
// Boundary: this script reads repository files only; it does not start the frontend, call backend APIs, write facts, change routes, modify DB rows, or mutate source files.

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.cwd();

const FILES = {
  plan: 'docs/frontend-productization/H58.0-FRONTEND-PRODUCTIZATION-PLAN.md',
  routeMatrix: 'docs/frontend-productization/H58.0-ROUTE-OWNERSHIP-MATRIX.md',
  h52RouteInventory: 'docs/frontend-reset/H52.0-FRONTEND-ROUTE-INVENTORY.md',
  h52OperatorIa: 'docs/frontend-reset/H52.1-OPERATOR-EVIDENCE-TWIN-IA.md',
  p57FreezeFixture: 'fixtures/full_runtime_freeze/P57_EXPECTED_FULL_RUNTIME_FREEZE_REPORT.json',
  app: 'apps/web/src/app/App.tsx',
  operatorLayout: 'apps/web/src/layouts/OperatorLayout.tsx',
  customerLayout: 'apps/web/src/layouts/CustomerLayout.tsx',
  adminLayout: 'apps/web/src/layouts/AdminLayout.tsx',
  operatorRoutes: 'apps/web/src/app/routes/operatorRoutes.tsx',
};

const assertions = [];

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function exists(relativePath) {
  return fs.existsSync(path.join(ROOT, relativePath));
}

function assert(name, condition, details = {}) {
  const passed = condition === true;
  assertions.push({ name, passed, details });
  if (!passed) {
    const error = new Error('ASSERTION_FAILED:' + name);
    error.details = details;
    throw error;
  }
  console.log('[h58-frontend-productization-plan] ok:', name);
}

function containsAll(content, tokens) {
  return tokens.every((token) => content.includes(token));
}

function main() {
  for (const [key, relativePath] of Object.entries(FILES)) {
    assert(key + '_exists', exists(relativePath), { file: relativePath });
  }

  const plan = read(FILES.plan);
  const routeMatrix = read(FILES.routeMatrix);
  const h52RouteInventory = read(FILES.h52RouteInventory);
  const h52OperatorIa = read(FILES.h52OperatorIa);
  const p57FreezeFixture = read(FILES.p57FreezeFixture);
  const app = read(FILES.app);
  const operatorLayout = read(FILES.operatorLayout);
  const customerLayout = read(FILES.customerLayout);
  const adminLayout = read(FILES.adminLayout);
  const operatorRoutes = read(FILES.operatorRoutes);

  assert('plan_declares_h58_runtime_console_scope', containsAll(plan, [
    'H58 Frontend Productization / GEOX Runtime Console v1',
    'Operator Runtime Console',
    'Customer Portal',
    'Admin Console',
  ]), { file: FILES.plan });

  assert('plan_freezes_main_navigation', containsAll(plan, [
    'Overview',
    'Fields',
    'Evidence',
    'Forecast',
    'Calibration',
    'Health',
    'Pilot',
    'Settings',
  ]), { file: FILES.plan });

  assert('plan_defines_product_hierarchy', containsAll(plan, [
    'Evidence → State → Forecast → Residual → Calibration → Health → Pilot',
    'Field Runtime',
    '地块运行视图',
  ]), { file: FILES.plan });

  assert('plan_preserves_read_only_and_no_write_boundaries', containsAll(plan, [
    'Field Runtime 不得：',
    '写 facts',
    '创建 AO-ACT task',
    '写 ROI',
    '写 Field Memory',
    '把 forecast 说成事实',
    '把 scenario 说成任务',
    '把 residual 说成因果证明',
  ]), { file: FILES.plan });

  assert('plan_records_replay_live_nonclaims', containsAll(plan, [
    'Runtime Mode: Replay-backed Demo',
    'Live Device: Not connected',
    'Production Gateway: Not online',
    'Field Pilot: Not started',
    'AO-ACT Dispatch: Disabled',
  ]), { file: FILES.plan });

  assert('plan_defines_ordered_page_migration', containsAll(plan, [
    'OperatorTwinOverviewPage',
    'OperatorFieldTwinWorkspacePage',
    'OperatorFieldTwinEvidencePage',
    'OperatorFieldTwinForecastPage',
    'OperatorFieldTwinScenarioComparePage',
    'OperatorFieldTwinCalibrationPage',
    'OperatorFieldTwinPostIrrigationPage',
    'OperatorGatewayDemoViewerPage',
    'OperatorTwinTraceReadbackPage',
  ]), { file: FILES.plan });

  assert('route_matrix_declares_ownership_principles', containsAll(routeMatrix, [
    '一个产品面只能有一个正式 shell owner',
    'route table 拥有页面选择权',
    'legacy route 可以存在，但不得进入正式导航',
    '/app/* 是目标 canonical family',
  ]), { file: FILES.routeMatrix });

  assert('route_matrix_defines_three_surface_targets', containsAll(routeMatrix, [
    'Operator Runtime Console',
    'Customer Portal',
    'Admin Console',
    '/customer/*',
    '/admin/*',
    '/operator/*',
    '/app/operator/*',
  ]), { file: FILES.routeMatrix });

  assert('route_matrix_keeps_legacy_url_only_policy', containsAll(routeMatrix, [
    'LEGACY_VISIBLE_BY_URL_ONLY',
    'Product replacement route exists',
    'Reverse reference check passes',
    'User confirms redirect or deletion',
  ]), { file: FILES.routeMatrix });

  assert('route_matrix_defines_behavior_acceptance_scope', containsAll(routeMatrix, [
    '/operator/twin/fields/:fieldId',
    '/app/operator/fields/:fieldId/evidence-twin',
    '/app/operator/fields/:fieldId/evidence-twin/water-stress',
    'no write API is introduced by route migration',
  ]), { file: FILES.routeMatrix });

  assert('h52_baseline_remains_referenced', containsAll(h52RouteInventory, [
    'H52.0 Frontend Route & Entry Inventory',
    'Runtime duplicate',
    'Shadowed duplicate',
    'Layout override',
    'LEGACY_VISIBLE_BY_URL_ONLY',
  ]), { file: FILES.h52RouteInventory });

  assert('h52_operator_ia_still_defines_target_routes', containsAll(h52OperatorIa, [
    '/app/operator/fields/:fieldId/evidence-twin',
    '/app/operator/fields/:fieldId/evidence-twin/water-stress',
    '正式导航只能指向 `/app/operator/*`',
  ]), { file: FILES.h52OperatorIa });

  assert('p57_freeze_fixture_records_replay_demo_nonclaims', containsAll(p57FreezeFixture, [
    '"full_runtime_mode": "replay_backed_production_demo"',
    '"live_device_production_runtime_v1_frozen": false',
    '"real_device_deployed": false',
    '"live_device_claimed": false',
    '"production_gateway_online": false',
    '"live_runtime_monitoring_active": false',
    '"field_pilot_execution_started": false',
    '"ao_act_task_created": false',
    '"dispatch_enabled": false',
  ]), { file: FILES.p57FreezeFixture });

  assert('app_preserves_existing_customer_admin_operator_shells', containsAll(app, [
    'path="/customer/*"',
    'path="/admin/*"',
    'path="/operator/*" element={<OperatorShell />} />',
    'function CustomerShell()',
    'function OperatorShell()',
    'function AdminShell()',
  ]), { file: FILES.app });

  assert('app_preserves_legacy_operator_twin_routes', containsAll(app, [
    'path="twin" element={<OperatorTwinOverviewPage />}',
    'path="twin/production-workflow"',
    'path="twin/gateway-demo"',
    'path="twin/fields/:fieldId"',
    'path="twin/fields/:fieldId/forecast"',
    'path="twin/fields/:fieldId/scenarios"',
    'path="twin/fields/:fieldId/evidence"',
    'path="twin/fields/:fieldId/calibration"',
    'path="twin/fields/:fieldId/post-irrigation"',
  ]), { file: FILES.app });

  assert('app_does_not_introduce_broad_app_operator_wildcard', !app.includes('path="/app/operator/*"'), { file: FILES.app });

  assert('current_operator_layout_is_still_pre_h59_shell', containsAll(operatorLayout, [
    'GEOX 操作员 Twin',
    'Twin 总览',
    'Gateway Demo',
    '操作员数字孪生工作台',
  ]), { file: FILES.operatorLayout });

  assert('customer_layout_override_is_still_known_debt', containsAll(customerLayout, [
    '../views/CustomerFieldsIndexPage',
    '../views/CustomerOperationsIndexPage',
    '../views/CustomerReportsCenterPage',
    'const mainContent = location.pathname === "/customer/fields"',
  ]), { file: FILES.customerLayout });

  assert('admin_layout_still_delegates_to_app_shell_before_h65', containsAll(adminLayout, [
    'import AppShell from "../app/AppShell"',
    'return <AppShell topBar={topBar}>{children}</AppShell>;',
  ]), { file: FILES.adminLayout });

  assert('operator_routes_preserve_h52_aliases_and_old_operator_pages', containsAll(operatorRoutes, [
    '/operator/workbench',
    '/operator/approvals',
    '/operator/dispatch',
    '/operator/acceptance',
    '/operator/evidence',
    '/operator/devices-alerts',
    '/operator/roi-ledger',
    '/operator/field-memory',
    '/app/operator/fields/:fieldId/evidence-twin',
    '/app/operator/fields/:fieldId/evidence-twin/water-stress',
  ]), { file: FILES.operatorRoutes });

  console.log(JSON.stringify({
    ok: true,
    acceptance: 'ACCEPTANCE_H58_FRONTEND_PRODUCTIZATION_PLAN_V1',
    scope: 'static frontend productization plan only',
    files_checked: FILES,
    assertions,
    next_step: 'H59_OPERATOR_RUNTIME_CONSOLE_SHELL',
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    acceptance: 'ACCEPTANCE_H58_FRONTEND_PRODUCTIZATION_PLAN_V1',
    error: error.message,
    details: error.details || null,
    assertions,
  }, null, 2));
  process.exit(1);
}
