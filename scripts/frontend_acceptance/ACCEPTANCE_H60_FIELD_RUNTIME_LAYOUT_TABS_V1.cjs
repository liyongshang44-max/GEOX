// scripts/frontend_acceptance/ACCEPTANCE_H60_FIELD_RUNTIME_LAYOUT_TABS_V1.cjs
// Purpose: statically verify H60-C Field Runtime layout, tabs, boundary banner, static ViewModel, and CSS ownership.
// Boundary: this script reads repository files and git diff metadata only.

'use strict';

const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.cwd();

const FILES = {
  app: 'apps/web/src/app/App.tsx',
  routeModule: 'apps/web/src/app/routes/operatorFieldRuntimeRoutes.tsx',
  runtimeNonclaims: 'apps/web/src/features/operator/fieldRuntime/runtimeNonclaims.ts',
  viewModel: 'apps/web/src/features/operator/fieldRuntime/fieldRuntimeViewModel.ts',
  routePage: 'apps/web/src/features/operator/fieldRuntime/FieldRuntimeRoutePage.tsx',
  layout: 'apps/web/src/features/operator/fieldRuntime/FieldRuntimeLayout.tsx',
  tabs: 'apps/web/src/features/operator/fieldRuntime/FieldRuntimeTabs.tsx',
  banner: 'apps/web/src/features/operator/fieldRuntime/FieldRuntimeBoundaryBanner.tsx',
  stub: 'apps/web/src/features/operator/fieldRuntime/FieldRuntimeTabStub.tsx',
  css: 'apps/web/src/styles/operatorFieldRuntime.css',
  doc: 'docs/frontend-productization/H60-FIELD-RUNTIME-LAYOUT-TABS.md',
  acceptance: 'scripts/frontend_acceptance/ACCEPTANCE_H60_FIELD_RUNTIME_LAYOUT_TABS_V1.cjs',
};

const H60C_ALLOWED_CHANGED_FILE_PATTERNS = [
  /^apps\/web\/src\/app\/routes\/operatorFieldRuntimeRoutes\.tsx$/,
  /^apps\/web\/src\/features\/operator\/fieldRuntime\/runtimeNonclaims\.ts$/,
  /^apps\/web\/src\/features\/operator\/fieldRuntime\/fieldRuntimeViewModel\.ts$/,
  /^apps\/web\/src\/features\/operator\/fieldRuntime\/FieldRuntimeRoutePage\.tsx$/,
  /^apps\/web\/src\/features\/operator\/fieldRuntime\/FieldRuntimeLayout\.tsx$/,
  /^apps\/web\/src\/features\/operator\/fieldRuntime\/FieldRuntimeTabs\.tsx$/,
  /^apps\/web\/src\/features\/operator\/fieldRuntime\/FieldRuntimeBoundaryBanner\.tsx$/,
  /^apps\/web\/src\/features\/operator\/fieldRuntime\/FieldRuntimeTabStub\.tsx$/,
  /^apps\/web\/src\/features\/operator\/fieldRuntime\/FieldRuntimeRoutePlaceholder\.tsx$/,
  /^apps\/web\/src\/styles\/operatorFieldRuntime\.css$/,
  /^docs\/frontend-productization\/H60-FIELD-RUNTIME-LAYOUT-TABS\.md$/,
  /^scripts\/frontend_acceptance\/ACCEPTANCE_H60_FIELD_RUNTIME_LAYOUT_TABS_V1\.cjs$/,
];

const FIELD_RUNTIME_FILES = [
  FILES.routeModule,
  FILES.runtimeNonclaims,
  FILES.viewModel,
  FILES.routePage,
  FILES.layout,
  FILES.tabs,
  FILES.banner,
  FILES.stub,
];

const TSX_MAIN_INTERFACE_FILES = [
  FILES.routePage,
  FILES.layout,
  FILES.tabs,
  FILES.banner,
  FILES.stub,
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
  console.log('[h60-field-runtime-layout-tabs] ok:', name);
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

function extractFunctionBlock(content, functionName) {
  const marker = `function ${functionName}`;
  const markerIndex = content.indexOf(marker);
  if (markerIndex < 0) return '';
  const firstBraceIndex = content.indexOf('{', markerIndex);
  if (firstBraceIndex < 0) return '';
  let depth = 0;
  for (let index = firstBraceIndex; index < content.length; index += 1) {
    if (content[index] === '{') depth += 1;
    if (content[index] === '}') depth -= 1;
    if (depth === 0) return content.slice(markerIndex, index + 1);
  }
  return '';
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
      return output.split(/\r?\n/g).map((line) => line.trim()).filter(Boolean);
    } catch (_error) {
      // Try the next read-only diff command.
    }
  }
  return [];
}

function isAllowedH60CChangedFile(filePath) {
  return H60C_ALLOWED_CHANGED_FILE_PATTERNS.some((pattern) => pattern.test(filePath));
}

function main() {
  for (const [key, relativePath] of Object.entries(FILES)) {
    assert(key + '_exists', exists(relativePath), { file: relativePath });
  }

  const changedFiles = getChangedFiles();
  assert('h60c_changed_files_within_allowlist_when_diff_context_exists', changedFiles.length === 0 || changedFiles.every(isAllowedH60CChangedFile), {
    changed_files: changedFiles,
    allowed_patterns: H60C_ALLOWED_CHANGED_FILE_PATTERNS.map((pattern) => String(pattern)),
  });

  assert('h60c_does_not_change_app_tsx', !changedFiles.includes(FILES.app), { forbidden_file: FILES.app, changed_files: changedFiles });

  const app = read(FILES.app);
  const routeModule = read(FILES.routeModule);
  const runtimeNonclaims = read(FILES.runtimeNonclaims);
  const viewModel = read(FILES.viewModel);
  const routePage = read(FILES.routePage);
  const layout = read(FILES.layout);
  const tabs = read(FILES.tabs);
  const banner = read(FILES.banner);
  const stub = read(FILES.stub);
  const css = read(FILES.css);
  const doc = read(FILES.doc);
  const operatorRoutesBlock = extractFunctionBlock(app, 'OperatorRoutes');
  const fieldRuntimeBundle = FIELD_RUNTIME_FILES.map(read).join('\n');
  const tsxMainInterfaceBundle = TSX_MAIN_INTERFACE_FILES.map(read).join('\n');

  assert('app_route_topology_preserved_from_h60b', containsAll(app, [
    'import OperatorFieldRuntimeRoutes from "./routes/operatorFieldRuntimeRoutes"',
    'path="/operator/*" element={<OperatorShell />} />',
    '<Route path="fields/*" element={<OperatorFieldRuntimeRoutes />} />',
  ]) && lacksAll(app, [
    'path="/app/operator/*"',
    'to="/operator/fields',
    'replace to="/operator/fields',
  ]), { file: FILES.app });

  assert('legacy_operator_field_routes_remain_preserved', containsAll(operatorRoutesBlock, [
    'path="twin/gateway-demo" element={<OperatorGatewayDemoViewerPage />}',
    'path="twin/fields/:fieldId" element={<OperatorFieldTwinWorkspacePage />}',
    'path="twin/fields/:fieldId/forecast" element={<OperatorFieldTwinForecastPage />}',
    'path="twin/fields/:fieldId/scenarios" element={<OperatorFieldTwinScenarioComparePage />}',
    'path="twin/fields/:fieldId/evidence" element={<OperatorFieldTwinEvidencePage />}',
    'path="twin/fields/:fieldId/calibration" element={<OperatorFieldTwinCalibrationPage />}',
    'path="twin/fields/:fieldId/post-irrigation" element={<OperatorFieldTwinPostIrrigationPage />}',
  ]), { file: FILES.app, scope: 'OperatorRoutes' });

  assert('route_module_uses_field_runtime_route_page_for_all_canonical_routes', containsAll(routeModule, [
    'FieldRuntimeRoutePage',
    'tab="fields"',
    'tab="overview"',
    'tab="evidence"',
    'tab="state"',
    'tab="forecast"',
    'tab="scenario"',
    'tab="residual"',
    'tab="calibration"',
    'tab="health"',
    'tab="audit"',
  ]) && lacksAll(routeModule, [
    'FieldRuntimeRoutePlaceholder',
    'OperatorFieldTwinWorkspacePage',
    'OperatorFieldTwinEvidencePage',
    'OperatorFieldTwinForecastPage',
    'OperatorFieldTwinScenarioComparePage',
    'OperatorFieldTwinCalibrationPage',
    'OperatorFieldTwinPostIrrigationPage',
    'SubmitScenarioToRecommendationPanel',
  ]), { file: FILES.routeModule });

  assert('runtime_nonclaims_are_centralized', containsAll(runtimeNonclaims, [
    'FIELD_RUNTIME_NONCLAIMS',
    'Runtime Mode: Replay-backed Demo',
    'Live Device: Not connected',
    'Production Gateway: Not online',
    'Field Pilot: Not started',
    'AO-ACT Dispatch: Disabled',
    'FIELD_RUNTIME_READ_ONLY_BOUNDARY',
    'Read-only Field Runtime',
  ]), { file: FILES.runtimeNonclaims });

  assert('view_model_defines_tabs_statuses_and_required_boundaries', containsAll(viewModel, [
    'FieldRuntimeViewModel',
    'FieldRuntimeTabKey',
    'FieldRuntimeRouteKey',
    'FieldRuntimeTabStatus',
    'available',
    'limited',
    'not_enabled',
    'Overview',
    'Evidence',
    'State',
    'Forecast',
    'Scenario',
    'Residual',
    'Calibration',
    'Health',
    'Audit',
    'Health route is reserved for H62.',
    'planned for H62',
    'This tab does not claim production monitoring.',
    'Scenario is a projection, not a task.',
    'Scenario is not a recommendation.',
    'No approval / dispatch / AO-ACT.',
    'Forecast is not a recommendation.',
    'Forecast does not create task.',
    'Forecast does not imply action.',
    'Residual is not causal proof.',
    'Residual does not write ROI.',
    'Residual does not write Field Memory.',
    'No model update.',
    'No Field Memory write.',
    'buildFieldRuntimeViewModel',
  ]), { file: FILES.viewModel });

  assert('route_page_builds_static_view_model_and_renders_layout', containsAll(routePage, [
    'useParams',
    'buildFieldRuntimeViewModel',
    'FieldRuntimeLayout',
  ]) && lacksAll(routePage, [
    'fetch(',
    'axios',
  ]), { file: FILES.routePage });

  assert('layout_shell_contains_required_product_structure', containsAll(layout, [
    'FieldRuntimeLayout',
    'Field Runtime',
    '地块运行视图',
    'Field ID',
    'Current route',
    'Runtime Mode',
    'Read-only boundary',
    'Canonical route family: /operator/fields/*',
    'Legacy route family preserved: /operator/twin/fields/*',
    'FieldRuntimeBoundaryBanner',
    'FieldRuntimeTabs',
    'FieldRuntimeTabStub',
    'operatorFieldRuntime.css',
  ]), { file: FILES.layout });

  assert('tabs_component_renders_fixed_tabs_and_statuses', containsAll(tabs, [
    'FieldRuntimeTabs',
    'buildCanonicalFieldRuntimePath',
    'operatorFieldRuntime__tabs',
    'operatorFieldRuntime__tab',
    'operatorFieldRuntime__tab--active',
    'operatorFieldRuntime__tabStatus',
    'data-field-runtime-tab-status',
  ]), { file: FILES.tabs });

  assert('boundary_banner_renders_nonclaims_and_read_only_boundary', containsAll(banner, [
    'FieldRuntimeBoundaryBanner',
    'FIELD_RUNTIME_NONCLAIMS',
    'FIELD_RUNTIME_READ_ONLY_BOUNDARY',
    'operatorFieldRuntime__banner',
    'operatorFieldRuntime__bannerItem',
  ]), { file: FILES.banner });

  assert('tab_stub_renders_phase_status_and_boundary_copy', containsAll(stub, [
    'FieldRuntimeTabStub',
    'operatorFieldRuntime__stub',
    'operatorFieldRuntime__stubHeader',
    'operatorFieldRuntime__boundaryList',
    'Concrete tab content migrates in H60-D through H60-K.',
  ]), { file: FILES.stub });

  assert('field_runtime_main_interface_uses_css_not_inline_styles', lacksAll(tsxMainInterfaceBundle, [
    'style={{',
    'React.CSSProperties',
  ]), { files: TSX_MAIN_INTERFACE_FILES });

  assert('field_runtime_bundle_has_no_writer_or_api_tokens', lacksAll(fieldRuntimeBundle, [
    'fetch(',
    'axios',
    'POST',
    '/api/control',
    '/api/control/ao_act',
    'writeFact',
    'createAoActTask',
    'submitRecommendation',
    'SubmitScenarioToRecommendationPanel',
    'approvalClient',
    'dispatchClient',
    'roiWriter',
    'fieldMemoryWriter',
    'modelUpdate',
  ]), { files: FIELD_RUNTIME_FILES });

  assert('css_defines_required_field_runtime_classes', containsAll(css, [
    '.operatorFieldRuntime',
    '.operatorFieldRuntime__header',
    '.operatorFieldRuntime__banner',
    '.operatorFieldRuntime__tabs',
    '.operatorFieldRuntime__tab',
    '.operatorFieldRuntime__tab--active',
    '.operatorFieldRuntime__tabStatus',
    '.operatorFieldRuntime__tabPanel',
    '.operatorFieldRuntime__stub',
  ]), { file: FILES.css });

  assert('css_avoids_business_risk_color_language', lacksAll(css, [
    'risk-red',
    'danger',
    'warning',
    'success',
    'green',
    'yellow',
    'red',
  ]), { file: FILES.css });

  assert('h60c_doc_records_scope_and_acceptance', containsAll(doc, [
    'H60-C implements Field Runtime layout and tabs only',
    'H60-C does not migrate business content',
    'H60-C does not load API data',
    'H60-C does not change App.tsx route topology',
    'H60-C does not redirect legacy routes',
    'H60-C does not open write surfaces',
    'H60-D through H60-K will migrate concrete tab content',
    'operatorFieldRuntime.css',
    'node scripts/frontend_acceptance/ACCEPTANCE_H60_FIELD_RUNTIME_LAYOUT_TABS_V1.cjs',
  ]), { file: FILES.doc });

  console.log(JSON.stringify({
    ok: true,
    acceptance: 'ACCEPTANCE_H60_FIELD_RUNTIME_LAYOUT_TABS_V1',
    scope: 'static H60-C layout and tabs only',
    changed_files_checked: changedFiles,
    allowed_changed_file_patterns: H60C_ALLOWED_CHANGED_FILE_PATTERNS.map((pattern) => String(pattern)),
    files_checked: FILES,
    assertions,
    next_step: 'H60-D_OVERVIEW_STATE_CONSOLIDATION',
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    acceptance: 'ACCEPTANCE_H60_FIELD_RUNTIME_LAYOUT_TABS_V1',
    error: error.message,
    details: error.details || null,
    assertions,
  }, null, 2));
  process.exit(1);
}
