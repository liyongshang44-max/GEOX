// scripts/frontend_acceptance/ACCEPTANCE_H60_FIELD_RUNTIME_IA_CONTRACT_V1.cjs
// Purpose: statically verify the H60.0 Field Runtime IA contract without modifying React routes, pages, backend APIs, DB rows, facts, or runtime state.
// Boundary: this script reads repository files and git diff metadata only; it does not start the frontend, call backend APIs, write facts, change routes, modify DB rows, or mutate source files.

'use strict';

const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.cwd();

const FILES = {
  h58Plan: 'docs/frontend-productization/H58.0-FRONTEND-PRODUCTIZATION-PLAN.md',
  h59Doc: 'docs/frontend-productization/H59-OPERATOR-RUNTIME-CONSOLE-SHELL.md',
  h60Contract: 'docs/frontend-productization/H60-FIELD-RUNTIME-CONSOLIDATION.md',
  h60RouteMatrix: 'docs/frontend-productization/H60-FIELD-RUNTIME-ROUTE-MATRIX.md',
  h60Acceptance: 'scripts/frontend_acceptance/ACCEPTANCE_H60_FIELD_RUNTIME_IA_CONTRACT_V1.cjs',
  app: 'apps/web/src/app/App.tsx',
  operatorLayout: 'apps/web/src/layouts/OperatorLayout.tsx',
  operatorRoutes: 'apps/web/src/app/routes/operatorRoutes.tsx',
  p57FreezeFixture: 'fixtures/full_runtime_freeze/P57_EXPECTED_FULL_RUNTIME_FREEZE_REPORT.json',
};

const H60_0_ALLOWED_CHANGED_FILE_PATTERNS = [
  /^docs\/frontend-productization\/H60-FIELD-RUNTIME-CONSOLIDATION\.md$/,
  /^docs\/frontend-productization\/H60-FIELD-RUNTIME-ROUTE-MATRIX\.md$/,
  /^scripts\/frontend_acceptance\/ACCEPTANCE_H60_FIELD_RUNTIME_IA_CONTRACT_V1\.cjs$/,
];

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
  console.log('[h60-field-runtime-ia-contract] ok:', name);
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

function getChangedFiles() {
  const commands = [
    ['git', ['diff', '--name-only', 'origin/main...HEAD']],
    ['git', ['diff', '--name-only', 'main...HEAD']],
  ];

  for (const [command, args] of commands) {
    try {
      const output = childProcess.execFileSync(command, args, {
        cwd: ROOT,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      return output
        .split(/\r?\n/g)
        .map((line) => line.trim())
        .filter(Boolean);
    } catch (_error) {
      // Try the next read-only diff command.
    }
  }

  return [];
}

function isAllowedH600ChangedFile(filePath) {
  return H60_0_ALLOWED_CHANGED_FILE_PATTERNS.some((pattern) => pattern.test(filePath));
}

function main() {
  for (const [key, relativePath] of Object.entries(FILES)) {
    assert(key + '_exists', exists(relativePath), { file: relativePath });
  }

  const changedFiles = getChangedFiles();
  assert('h60_0_changed_files_within_allowlist_when_diff_context_exists', changedFiles.length === 0 || changedFiles.every(isAllowedH600ChangedFile), {
    changed_files: changedFiles,
    allowed_patterns: H60_0_ALLOWED_CHANGED_FILE_PATTERNS.map((pattern) => String(pattern)),
  });

  const h58Plan = read(FILES.h58Plan);
  const h59Doc = read(FILES.h59Doc);
  const h60Contract = read(FILES.h60Contract);
  const h60RouteMatrix = read(FILES.h60RouteMatrix);
  const app = read(FILES.app);
  const operatorLayout = read(FILES.operatorLayout);
  const operatorRoutes = read(FILES.operatorRoutes);
  const p57FreezeFixture = read(FILES.p57FreezeFixture);

  assert('h58_and_h59_baselines_remain_referenced', containsAll(h58Plan, [
    'H58 Frontend Productization / GEOX Runtime Console v1',
    'Operator Runtime Console',
    'Runtime Mode: Replay-backed Demo',
  ]) && containsAll(h59Doc, [
    'H59 Operator Runtime Console Shell',
    'GEOX Operator Runtime Console',
    'H59 不重写页面、不新增正式 route、不删除旧 route、不改变 backend contract',
  ]), { files: [FILES.h58Plan, FILES.h59Doc] });

  assert('h60_contract_declares_h60_0_scope', containsAll(h60Contract, [
    'H60 Field Runtime Consolidation',
    'H60.0 IA CONTRACT',
    'H60.0 只冻结信息架构、route family 设计、legacy route 策略、ViewModel contract、scenario submission isolation、write boundary 和 acceptance plan',
    'H60.0 不改 React 页面，不新增 route，不重写 route table，不改 CSS，不改 backend，不改 DB，不改 facts writer',
  ]), { file: FILES.h60Contract });

  assert('h60_contract_defines_product_chain_and_tabs', containsAll(h60Contract, [
    'Evidence → State → Forecast → Residual → Calibration → Health → Audit',
    'Overview',
    'Evidence',
    'State',
    'Forecast',
    'Scenario',
    'Residual',
    'Calibration',
    'Health',
    'Audit',
  ]), { file: FILES.h60Contract });

  assert('h60_contract_defines_view_model_contract', containsAll(h60Contract, [
    'type FieldRuntimeViewModel = {',
    'identity: FieldRuntimeIdentity',
    'runtimeMode: RuntimeModeSummary',
    'tabs: FieldRuntimeTabState[]',
    'boundary: FieldRuntimeBoundary',
    'sourceRouteFamily: "canonical_operator_field_runtime" | "legacy_operator_twin_field"',
    'runtimeMode: "Replay-backed Demo"',
    'aoActDispatch: "Disabled"',
  ]), { file: FILES.h60Contract });

  assert('h60_contract_defines_no_write_boundary', containsAll(h60Contract, [
    'readOnly: true',
    'canWriteFacts: false',
    'canCreateRecommendation: boolean',
    'canApprove: false',
    'canDispatch: false',
    'canCreateAoActTask: false',
    'canWriteRoi: false',
    'canWriteFieldMemory: false',
    'Canonical Field Runtime 主链路中 canCreateRecommendation 必须为 false',
  ]), { file: FILES.h60Contract });

  assert('h60_contract_defines_nonclaim_banner_contract', containsAll(h60Contract, [
    'Runtime Mode: Replay-backed Demo',
    'Live Device: Not connected',
    'Production Gateway: Not online',
    'Field Pilot: Not started',
    'AO-ACT Dispatch: Disabled',
    'Read-only Field Runtime',
  ]), { file: FILES.h60Contract });

  assert('h60_contract_defines_scenario_submission_isolation', containsAll(h60Contract, [
    '/operator/fields/:fieldId/scenario',
    'SubmitScenarioToRecommendationPanel',
    'Scenario is a projection, not a task',
    'Scenario is not a recommendation',
    'No approval / dispatch / AO-ACT',
    'legacy / governed action surface',
  ]), { file: FILES.h60Contract });

  assert('h60_contract_defines_language_restrictions', containsAll(h60Contract, [
    'Forecast is not a recommendation',
    'Forecast does not create task',
    'Residual is not causal proof',
    'Residual does not write ROI',
    'Residual does not write Field Memory',
    'model updated',
    'calibration applied',
    'learning completed',
    'This tab does not claim production monitoring',
  ]), { file: FILES.h60Contract });

  assert('h60_route_matrix_defines_canonical_routes_as_designed_only', containsAll(h60RouteMatrix, [
    'H60.0 ROUTE CONTRACT',
    'H60.0 不新增 route，不修改 App.tsx，不修改 React pages',
    '/operator/fields',
    '/operator/fields/:fieldId',
    '/operator/fields/:fieldId/evidence',
    '/operator/fields/:fieldId/state',
    '/operator/fields/:fieldId/forecast',
    '/operator/fields/:fieldId/scenario',
    '/operator/fields/:fieldId/residual',
    '/operator/fields/:fieldId/calibration',
    '/operator/fields/:fieldId/health',
    '/operator/fields/:fieldId/audit',
    'designed_not_implemented',
  ]), { file: FILES.h60RouteMatrix });

  assert('h60_route_matrix_preserves_legacy_routes', containsAll(h60RouteMatrix, [
    '/operator/twin/fields/:fieldId',
    '/operator/twin/fields/:fieldId/forecast',
    '/operator/twin/fields/:fieldId/scenarios',
    '/operator/twin/fields/:fieldId/evidence',
    '/operator/twin/fields/:fieldId/calibration',
    '/operator/twin/fields/:fieldId/post-irrigation',
    'KEEP_LEGACY_ROUTE_RENDERING_WITH_NOTICE',
  ]), { file: FILES.h60RouteMatrix });

  assert('h60_route_matrix_records_route_prohibitions', containsAll(h60RouteMatrix, [
    '/app/operator/* broad wildcard',
    '删除 /operator/twin/fields/:fieldId',
    '删除 /operator/twin/gateway-demo',
    '提升 /operator/workbench 为 Field Runtime 主线',
    '提升 /operator/dispatch 为 Field Runtime 主线',
    '提升 /operator/roi-ledger 为 Field Runtime 主线',
    '提升 /operator/field-memory 为 Field Runtime 主线',
  ]), { file: FILES.h60RouteMatrix });

  assert('app_still_has_no_h60_canonical_routes_in_h60_0', lacksAll(app, [
    'path="fields"',
    'path="fields/:fieldId"',
    'path="fields/:fieldId/evidence"',
    'path="fields/:fieldId/state"',
    'path="fields/:fieldId/forecast"',
    'path="fields/:fieldId/scenario"',
    'path="fields/:fieldId/residual"',
    'path="fields/:fieldId/calibration"',
    'path="fields/:fieldId/health"',
    'path="fields/:fieldId/audit"',
  ]), { file: FILES.app });

  assert('app_preserves_legacy_field_routes_and_no_broad_wildcard', containsAll(app, [
    'path="/operator/*" element={<OperatorShell />} />',
    'path="twin/fields/:fieldId"',
    'path="twin/fields/:fieldId/forecast"',
    'path="twin/fields/:fieldId/scenarios"',
    'path="twin/fields/:fieldId/evidence"',
    'path="twin/fields/:fieldId/calibration"',
    'path="twin/fields/:fieldId/post-irrigation"',
    'path="twin/gateway-demo"',
  ]) && !app.includes('path="/app/operator/*"'), { file: FILES.app });

  assert('operator_runtime_console_shell_remains_h59', containsAll(operatorLayout, [
    'GEOX Operator Runtime Console',
    '操作员运行控制台',
    'Runtime Mode: Replay-backed Demo',
    'Live Device: Not connected',
    'Production Gateway: Not online',
    'AO-ACT Dispatch: Disabled',
  ]), { file: FILES.operatorLayout });

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
    acceptance: 'ACCEPTANCE_H60_FIELD_RUNTIME_IA_CONTRACT_V1',
    scope: 'static H60.0 IA contract only',
    changed_files_checked: changedFiles,
    allowed_changed_file_patterns: H60_0_ALLOWED_CHANGED_FILE_PATTERNS.map((pattern) => String(pattern)),
    files_checked: FILES,
    assertions,
    next_step: 'H60_1_FIELD_RUNTIME_ROUTE_OWNERSHIP',
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    acceptance: 'ACCEPTANCE_H60_FIELD_RUNTIME_IA_CONTRACT_V1',
    error: error.message,
    details: error.details || null,
    assertions,
  }, null, 2));
  process.exit(1);
}
