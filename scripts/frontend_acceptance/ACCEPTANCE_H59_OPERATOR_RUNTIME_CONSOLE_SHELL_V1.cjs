// scripts/frontend_acceptance/ACCEPTANCE_H59_OPERATOR_RUNTIME_CONSOLE_SHELL_V1.cjs
// Purpose: statically verify that H59 productizes the Operator shell into the Operator Runtime Console without changing route topology or opening write surfaces.
// Boundary: this script reads repository files only; it does not start the frontend, call backend APIs, write facts, change routes, modify DB rows, or mutate source files.

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.cwd();

const FILES = {
  h58Plan: 'docs/frontend-productization/H58.0-FRONTEND-PRODUCTIZATION-PLAN.md',
  h59Doc: 'docs/frontend-productization/H59-OPERATOR-RUNTIME-CONSOLE-SHELL.md',
  h58Acceptance: 'scripts/frontend_acceptance/ACCEPTANCE_H58_FRONTEND_PRODUCTIZATION_PLAN_V1.cjs',
  h59Acceptance: 'scripts/frontend_acceptance/ACCEPTANCE_H59_OPERATOR_RUNTIME_CONSOLE_SHELL_V1.cjs',
  app: 'apps/web/src/app/App.tsx',
  operatorLayout: 'apps/web/src/layouts/OperatorLayout.tsx',
  operatorRoutes: 'apps/web/src/app/routes/operatorRoutes.tsx',
  p57FreezeFixture: 'fixtures/full_runtime_freeze/P57_EXPECTED_FULL_RUNTIME_FREEZE_REPORT.json',
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
  console.log('[h59-operator-runtime-console-shell] ok:', name);
}

function normalizeForTokenScan(value) {
  return value
    .replace(/[\uFEFF]/g, '')
    .replace(/[`'"“”‘’]/g, '')
    .replace(/[，。；、：:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function containsAll(content, tokens) {
  const normalizedContent = normalizeForTokenScan(content);
  return tokens.every((token) => normalizedContent.includes(normalizeForTokenScan(token)));
}

function lacksAll(content, tokens) {
  const normalizedContent = normalizeForTokenScan(content);
  return tokens.every((token) => !normalizedContent.includes(normalizeForTokenScan(token)));
}

function main() {
  for (const [key, relativePath] of Object.entries(FILES)) {
    assert(key + '_exists', exists(relativePath), { file: relativePath });
  }

  const h58Plan = read(FILES.h58Plan);
  const h59Doc = read(FILES.h59Doc);
  const app = read(FILES.app);
  const operatorLayout = read(FILES.operatorLayout);
  const operatorRoutes = read(FILES.operatorRoutes);
  const p57FreezeFixture = read(FILES.p57FreezeFixture);

  assert('h58_plan_remains_productization_baseline', containsAll(h58Plan, [
    'H58 Frontend Productization / GEOX Runtime Console v1',
    'Operator Runtime Console',
    'Customer Portal',
    'Admin Console',
    'Runtime Mode: Replay-backed Demo',
  ]), { file: FILES.h58Plan });

  assert('h59_doc_declares_shell_only_scope', containsAll(h59Doc, [
    'H59 Operator Runtime Console Shell',
    'GEOX Operator Runtime Console',
    'H59 只改 shell 叙事、主导航、只读边界和 replay/live nonclaim 展示',
    'H59 不重写页面、不新增正式 route、不删除旧 route、不改变 backend contract',
  ]), { file: FILES.h59Doc });

  assert('operator_layout_uses_runtime_console_brand', containsAll(operatorLayout, [
    'GEOX Operator Runtime Console',
    '操作员运行控制台',
    'data-h59="operator-runtime-console-shell"',
    'data-layout="operator-runtime-console-shell"',
  ]), { file: FILES.operatorLayout });

  assert('operator_layout_contains_h58_formal_nav_items', containsAll(operatorLayout, [
    'label: "Overview"',
    'label: "Fields"',
    'label: "Evidence"',
    'label: "Forecast"',
    'label: "Calibration"',
    'label: "Health"',
    'label: "Pilot"',
    'label: "Settings"',
  ]), { file: FILES.operatorLayout });

  assert('operator_layout_uses_disabled_or_preserved_states_for_unimplemented_nav', containsAll(operatorLayout, [
    'status: "route-preserved"',
    'status: "coming-soon"',
    'aria-disabled="true"',
    'data-nav-status={item.status}',
    'Coming soon',
    'Route preserved',
  ]), { file: FILES.operatorLayout });

  assert('operator_layout_nonclaim_banner_visible', containsAll(operatorLayout, [
    'Runtime Mode: Replay-backed Demo',
    'Live Device: Not connected',
    'Production Gateway: Not online',
    'Field Pilot: Not started',
    'AO-ACT Dispatch: Disabled',
    'aria-label="Runtime mode and live-device nonclaims"',
  ]), { file: FILES.operatorLayout });

  assert('operator_layout_removes_old_formal_nav_labels', lacksAll(operatorLayout, [
    'label: "Twin 总览"',
    'label: "Gateway Demo"',
    '操作员数字孪生工作台',
    'GEOX 操作员 Twin',
  ]), { file: FILES.operatorLayout });

  assert('operator_layout_preserves_legacy_route_readback_strings', containsAll(operatorLayout, [
    '/operator/twin',
    '/operator/twin/production-workflow',
    '/operator/twin/gateway-demo',
    '/operator/twin/fields/',
    '/operator/twin/traces/',
  ]), { file: FILES.operatorLayout });

  assert('operator_layout_declares_no_write_boundary', containsAll(operatorLayout, [
    'does not create facts',
    'recommendations',
    'approvals',
    'dispatches',
    'AO-ACT tasks',
    'ROI records',
    'Field Memory records',
  ]), { file: FILES.operatorLayout });

  assert('app_preserves_operator_shell_and_legacy_twin_routes', containsAll(app, [
    'path="/operator/*" element={<OperatorShell />} />',
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

  assert('app_does_not_add_h59_forbidden_routes', lacksAll(app, [
    'path="/app/operator/*"',
    'path="/operator/fields"',
    'path="/operator/health"',
    'path="/operator/pilot"',
  ]), { file: FILES.app });

  assert('operator_routes_preserve_old_operator_url_only_routes_and_h52_aliases', containsAll(operatorRoutes, [
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

  assert('p57_fixture_still_records_replay_backed_nonclaims', containsAll(p57FreezeFixture, [
    '"full_runtime_mode": "replay_backed_production_demo"',
    '"real_device_deployed": false',
    '"live_device_claimed": false',
    '"production_gateway_online": false',
    '"live_runtime_monitoring_active": false',
    '"field_pilot_execution_started": false',
    '"ao_act_task_created": false',
    '"dispatch_enabled": false',
  ]), { file: FILES.p57FreezeFixture });

  console.log(JSON.stringify({
    ok: true,
    acceptance: 'ACCEPTANCE_H59_OPERATOR_RUNTIME_CONSOLE_SHELL_V1',
    scope: 'static operator shell productization only',
    files_checked: FILES,
    assertions,
    next_step: 'H60_FIELD_RUNTIME_CONSOLIDATION',
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    acceptance: 'ACCEPTANCE_H59_OPERATOR_RUNTIME_CONSOLE_SHELL_V1',
    error: error.message,
    details: error.details || null,
    assertions,
  }, null, 2));
  process.exit(1);
}
