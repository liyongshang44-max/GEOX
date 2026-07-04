// scripts/frontend_acceptance/ACCEPTANCE_H60_FIELD_RUNTIME_FORECAST_TAB_V1.cjs
// Purpose: statically verify H60-F Field Runtime Forecast tab migration without running frontend code or touching backend state.
// Boundary: this script reads repository files and git diff metadata only.

'use strict';

const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.cwd();

const FILES = {
  app: 'apps/web/src/app/App.tsx',
  routeModule: 'apps/web/src/app/routes/operatorFieldRuntimeRoutes.tsx',
  legacyForecastPage: 'apps/web/src/features/operator/pages/OperatorFieldTwinForecastPage.tsx',
  forecastAdapter: 'apps/web/src/features/operator/fieldRuntime/fieldRuntimeForecastAdapter.ts',
  forecastTabPanel: 'apps/web/src/features/operator/fieldRuntime/FieldRuntimeForecastTabPanel.tsx',
  forecastWindowPanel: 'apps/web/src/features/operator/fieldRuntime/FieldRuntimeForecastWindowPanel.tsx',
  forecastTimelinePanel: 'apps/web/src/features/operator/fieldRuntime/FieldRuntimeForecastTimelinePanel.tsx',
  forecastEvidencePanel: 'apps/web/src/features/operator/fieldRuntime/FieldRuntimeForecastEvidencePanel.tsx',
  forecastBoundaryPanel: 'apps/web/src/features/operator/fieldRuntime/FieldRuntimeForecastBoundaryPanel.tsx',
  routePage: 'apps/web/src/features/operator/fieldRuntime/FieldRuntimeRoutePage.tsx',
  layout: 'apps/web/src/features/operator/fieldRuntime/FieldRuntimeLayout.tsx',
  viewModel: 'apps/web/src/features/operator/fieldRuntime/fieldRuntimeViewModel.ts',
  css: 'apps/web/src/styles/operatorFieldRuntime.css',
  doc: 'docs/frontend-productization/H60-FIELD-RUNTIME-FORECAST-TAB.md',
  acceptance: 'scripts/frontend_acceptance/ACCEPTANCE_H60_FIELD_RUNTIME_FORECAST_TAB_V1.cjs',
};

const ALLOWED_CHANGED_FILE_PATTERNS = [
  /^apps\/web\/src\/features\/operator\/fieldRuntime\/.+$/,
  /^apps\/web\/src\/features\/operator\/pages\/OperatorFieldTwinForecastPage\.tsx$/,
  /^apps\/web\/src\/styles\/operatorFieldRuntime\.css$/,
  /^docs\/frontend-productization\/H60-FIELD-RUNTIME-FORECAST-TAB\.md$/,
  /^scripts\/frontend_acceptance\/ACCEPTANCE_H60_FIELD_RUNTIME_FORECAST_TAB_V1\.cjs$/,
];

const FORBIDDEN_CHANGED_FILE_PATTERNS = [
  /^apps\/web\/src\/app\/App\.tsx$/,
  /^apps\/web\/src\/app\/routes\/operatorFieldRuntimeRoutes\.tsx$/,
  /^apps\/server\//,
  /^migrations\//,
  /^packages\/contracts\//,
  /^fixtures\//,
  /^\.github\//,
  /^package\.json$/,
  /^pnpm-lock\.yaml$/,
  /^pnpm-workspace\.yaml$/,
];

const FORECAST_FILES = [
  FILES.forecastAdapter,
  FILES.forecastTabPanel,
  FILES.forecastWindowPanel,
  FILES.forecastTimelinePanel,
  FILES.forecastEvidencePanel,
  FILES.forecastBoundaryPanel,
  FILES.routePage,
  FILES.layout,
  FILES.viewModel,
];

const PANEL_FILES = [
  FILES.forecastTabPanel,
  FILES.forecastWindowPanel,
  FILES.forecastTimelinePanel,
  FILES.forecastEvidencePanel,
  FILES.forecastBoundaryPanel,
];

const assertions = [];

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function exists(relativePath) {
  return fs.existsSync(path.join(ROOT, relativePath));
}

function normalize(value) {
  return value
    .replace(/[\uFEFF]/g, '')
    .replace(/[`'"“”‘’]/g, '')
    .replace(/[，。；、：:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function containsAll(content, tokens) {
  const normalized = normalize(content);
  return tokens.every((token) => normalized.includes(normalize(token)));
}

function lacksAll(content, tokens) {
  const normalized = normalize(content);
  return tokens.every((token) => !normalized.includes(normalize(token)));
}

function assert(name, condition, details = {}) {
  const passed = condition === true;
  assertions.push({ name, passed, details });
  if (!passed) {
    const error = new Error('ASSERTION_FAILED:' + name);
    error.details = details;
    throw error;
  }
  console.log('[h60-field-runtime-forecast-tab] ok:', name);
}

function extractFunctionBlock(content, functionName) {
  const marker = `function ${functionName}`;
  const start = content.indexOf(marker);
  if (start < 0) return '';
  const open = content.indexOf('{', start);
  if (open < 0) return '';
  let depth = 0;
  for (let index = open; index < content.length; index += 1) {
    if (content[index] === '{') depth += 1;
    if (content[index] === '}') depth -= 1;
    if (depth === 0) return content.slice(start, index + 1);
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
      const output = childProcess.execFileSync(command, args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      return output.split(/\r?\n/g).map((line) => line.trim()).filter(Boolean);
    } catch (_error) {
      // Try next diff command.
    }
  }
  return [];
}

function matchesAny(filePath, patterns) {
  return patterns.some((pattern) => pattern.test(filePath));
}

function main() {
  for (const [key, relativePath] of Object.entries(FILES)) {
    assert(key + '_exists', exists(relativePath), { file: relativePath });
  }

  const changedFiles = getChangedFiles();
  assert('h60f_changed_files_within_allowlist_when_diff_context_exists', changedFiles.length === 0 || changedFiles.every((filePath) => matchesAny(filePath, ALLOWED_CHANGED_FILE_PATTERNS)), {
    changed_files: changedFiles,
    allowed_patterns: ALLOWED_CHANGED_FILE_PATTERNS.map(String),
  });
  assert('h60f_forbidden_files_not_changed', changedFiles.every((filePath) => !matchesAny(filePath, FORBIDDEN_CHANGED_FILE_PATTERNS)), {
    changed_files: changedFiles,
    forbidden_patterns: FORBIDDEN_CHANGED_FILE_PATTERNS.map(String),
  });

  const app = read(FILES.app);
  const routeModule = read(FILES.routeModule);
  const operatorRoutesBlock = extractFunctionBlock(app, 'OperatorRoutes');
  const legacyForecastPage = read(FILES.legacyForecastPage);
  const forecastAdapter = read(FILES.forecastAdapter);
  const routePage = read(FILES.routePage);
  const layout = read(FILES.layout);
  const viewModel = read(FILES.viewModel);
  const css = read(FILES.css);
  const doc = read(FILES.doc);
  const forecastBundle = FORECAST_FILES.map(read).join('\n');
  const panelBundle = PANEL_FILES.map(read).join('\n');

  assert('route_topology_preserved_for_canonical_and_legacy_forecast', containsAll(routeModule, ['tab="forecast"', 'FieldRuntimeRoutePage']) && containsAll(operatorRoutesBlock, [
    'path="fields/*" element={<OperatorFieldRuntimeRoutes />} />',
    'path="twin/fields/:fieldId/forecast" element={<OperatorFieldTwinForecastPage />}',
  ]) && lacksAll(app + '\n' + routeModule, ['path="/app/operator/*"', 'replace to="/operator/fields']), { files: [FILES.app, FILES.routeModule] });

  assert('legacy_forecast_page_remains_available', containsAll(legacyForecastPage, [
    'export default function OperatorFieldTwinForecastPage',
    'fetchOperatorFieldTwinForecastPanel',
    'data-page="operator-field-twin-forecast-panel"',
    'forecast_window_v1',
  ]), { file: FILES.legacyForecastPage });

  assert('forecast_adapter_reuses_existing_read_only_fetch', containsAll(forecastAdapter, [
    'fetchOperatorFieldTwinForecastPanel',
    'operator_field_twin_forecast_panel_v1',
    'forecast_window_v1',
    'FieldRuntimeForecastLoadState',
    'FieldRuntimeForecastViewModel',
    'loadFieldRuntimeForecast',
    'mapFieldRuntimeForecast',
    'forecastText',
  ]) && lacksAll(forecastAdapter, ['POST', 'PUT', 'PATCH', 'DELETE', '/api/control', '/api/control/ao_act', 'new endpoint', 'server route']), { file: FILES.forecastAdapter });

  assert('route_page_loads_only_expected_read_models', containsAll(routePage, [
    'overview" || tab === "state"',
    'loadFieldRuntimeWorkspaceOverview',
    'tab === "evidence"',
    'loadFieldRuntimeEvidence',
    'tab === "forecast"',
    'loadFieldRuntimeForecast',
    'forecastLoadState',
  ]), { file: FILES.routePage });

  assert('layout_composes_forecast_tab_inside_h60c_shell', containsAll(layout, [
    'FieldRuntimeForecastTabPanel',
    'viewModel.routeKey === "forecast"',
    'forecastLoadState',
    'FieldRuntimeTabs',
    'FieldRuntimeBoundaryBanner',
    'data-h60f="field-runtime-forecast-tab"',
  ]), { file: FILES.layout });

  assert('view_model_marks_forecast_available_and_preserves_future_tabs', containsAll(viewModel, [
    'key: "forecast"',
    'status: "available"',
    'H60-F forecast tab',
    'Forecast content is derived from the existing read-only Operator Field Twin forecast panel.',
    'Forecast window is displayed for review only.',
    'Forecast is not a recommendation.',
    'Forecast does not create task.',
    'Forecast does not imply action.',
    'No scenario comparison is performed.',
    'Scenario route is reserved for H60-G.',
    'Residual route is reserved for H60-H.',
    'Calibration route is reserved for H60-I.',
    'Health route is reserved for H62.',
    'not_enabled',
    'planned for H62',
    'Audit route is reserved for H60-K.',
  ]), { file: FILES.viewModel });

  assert('forecast_panels_contain_required_product_copy', containsAll(panelBundle, [
    'Forecast',
    'Forecast Window',
    'Forecast Timeline',
    'Forecast Evidence',
    'Forecast Boundary',
    'Forecast content is derived from the existing read-only Operator Field Twin forecast panel.',
    'source: operator_field_twin_forecast_panel_v1',
    'Forecast window source: forecast_window_v1',
    'Forecast is displayed for review only.',
    'Forecast is not a recommendation.',
    'Forecast does not create task.',
    'Forecast does not imply action.',
    'No scenario comparison is performed.',
    'No approval / dispatch / AO-ACT task is created.',
    'Forecast window is a read-only availability window.',
    'Forecast window is not an action window.',
    'Full Evidence trace is available in Evidence tab.',
    'Forecast Evidence only lists refs used by forecast window / timeline.',
    'No facts write',
    'No recommendation creation',
    'No scenario comparison',
    'No approval',
    'No dispatch',
    'No AO-ACT task',
    'No ROI write',
    'No Field Memory write',
    'No forecast generation',
    'No backend contract change',
  ]), { files: PANEL_FILES });

  assert('canonical_forecast_bundle_has_no_write_or_mutation_tokens', lacksAll(forecastBundle, [
    'POST',
    'PUT',
    'PATCH',
    'DELETE',
    'writeFact',
    'createFact',
    'submitRecommendation',
    'SubmitScenarioToRecommendationPanel',
    'approvalClient',
    'dispatchClient',
    'createAoActTask',
    'roiWriter',
    'fieldMemoryWriter',
    'modelUpdate',
  ]), { files: FORECAST_FILES });

  assert('canonical_forecast_titles_avoid_legacy_product_language', lacksAll(panelBundle, [
    'Operator Twin Forecast Panel',
    'H22 Forecast Page',
    'Forecast Risk Timeline',
    'Risk Timeline',
    'raw forecast contract',
    'Twin 工作区',
  ]), { files: PANEL_FILES });

  assert('css_defines_h60f_forecast_classes_and_avoids_risk_priority_language', containsAll(css, [
    '.operatorFieldRuntime__forecastGrid',
    '.operatorFieldRuntime__forecastWindow',
    '.operatorFieldRuntime__forecastTimeline',
    '.operatorFieldRuntime__forecastTimelineItem',
    '.operatorFieldRuntime__forecastEvidence',
    '.operatorFieldRuntime__forecastBoundary',
    '.operatorFieldRuntime__forecastReason',
    '.operatorFieldRuntime__forecastRefs',
  ]) && lacksAll(css, ['risk-red', 'danger', 'warning', 'success', 'green', 'yellow', 'red', 'priority', 'severity']), { file: FILES.css });

  assert('h60f_doc_records_scope_boundaries_and_next_phases', containsAll(doc, [
    'H60-F migrates Forecast tab only',
    '/operator/fields/:fieldId/forecast',
    '/operator/twin/fields/:fieldId/forecast',
    'source is existing read-only operator_field_twin_forecast_panel_v1',
    'forecast window source is forecast_window_v1',
    'fetchOperatorFieldTwinForecastPanel',
    'H60-F does not create backend contract',
    'H60-F does not write facts',
    'H60-F does not create recommendation',
    'H60-F does not compare scenarios',
    'H60-F does not approve / dispatch / create AO-ACT',
    'H60-F does not write ROI / Field Memory',
    'Scenario split remains H60-G',
    'Residual remains H60-H',
    'Calibration remains H60-I',
    'Health remains not_enabled / planned for H62',
    'Audit remains H60-K',
    'Forecast is not recommendation.',
    'Forecast window is not action window.',
    'Forecast timeline is not task priority.',
    'Forecast confidence is metadata, not action eligibility.',
  ]), { file: FILES.doc });

  console.log(JSON.stringify({
    ok: true,
    acceptance: 'ACCEPTANCE_H60_FIELD_RUNTIME_FORECAST_TAB_V1',
    scope: 'static H60-F forecast tab migration only',
    changed_files_checked: changedFiles,
    allowed_changed_file_patterns: ALLOWED_CHANGED_FILE_PATTERNS.map(String),
    files_checked: FILES,
    assertions,
    next_step: 'H60-G_SCENARIO_READ_ONLY_SPLIT',
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(JSON.stringify({ ok: false, acceptance: 'ACCEPTANCE_H60_FIELD_RUNTIME_FORECAST_TAB_V1', error: error.message, details: error.details || null, assertions }, null, 2));
  process.exit(1);
}
