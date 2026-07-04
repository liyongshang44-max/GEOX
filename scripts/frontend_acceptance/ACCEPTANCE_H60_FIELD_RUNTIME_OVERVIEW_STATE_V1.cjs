// scripts/frontend_acceptance/ACCEPTANCE_H60_FIELD_RUNTIME_OVERVIEW_STATE_V1.cjs
// Purpose: statically verify H60-D Field Runtime Overview / State consolidation without running frontend code or touching backend state.
// Boundary: this script reads repository files and git diff metadata only.

'use strict';

const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.cwd();

const FILES = {
  app: 'apps/web/src/app/App.tsx',
  routeModule: 'apps/web/src/app/routes/operatorFieldRuntimeRoutes.tsx',
  workspacePage: 'apps/web/src/features/operator/pages/OperatorFieldTwinWorkspacePage.tsx',
  adapter: 'apps/web/src/features/operator/fieldRuntime/fieldRuntimeWorkspaceAdapter.ts',
  viewModel: 'apps/web/src/features/operator/fieldRuntime/fieldRuntimeViewModel.ts',
  routePage: 'apps/web/src/features/operator/fieldRuntime/FieldRuntimeRoutePage.tsx',
  layout: 'apps/web/src/features/operator/fieldRuntime/FieldRuntimeLayout.tsx',
  tabs: 'apps/web/src/features/operator/fieldRuntime/FieldRuntimeTabs.tsx',
  overviewPanel: 'apps/web/src/features/operator/fieldRuntime/FieldRuntimeOverviewPanel.tsx',
  statePanel: 'apps/web/src/features/operator/fieldRuntime/FieldRuntimeStatePanel.tsx',
  evidencePanel: 'apps/web/src/features/operator/fieldRuntime/FieldRuntimeEvidenceSummaryPanel.tsx',
  coveragePanel: 'apps/web/src/features/operator/fieldRuntime/FieldRuntimeCoverageSummaryPanel.tsx',
  dataGapPanel: 'apps/web/src/features/operator/fieldRuntime/FieldRuntimeDataGapPanel.tsx',
  boundaryPanel: 'apps/web/src/features/operator/fieldRuntime/FieldRuntimeReadOnlyBoundaryPanel.tsx',
  css: 'apps/web/src/styles/operatorFieldRuntime.css',
  h60cDoc: 'docs/frontend-productization/H60-FIELD-RUNTIME-LAYOUT-TABS.md',
  h60dDoc: 'docs/frontend-productization/H60-FIELD-RUNTIME-OVERVIEW-STATE.md',
  acceptance: 'scripts/frontend_acceptance/ACCEPTANCE_H60_FIELD_RUNTIME_OVERVIEW_STATE_V1.cjs',
};

const H60D_ALLOWED_CHANGED_FILE_PATTERNS = [
  /^apps\/web\/src\/features\/operator\/fieldRuntime\/.+$/,
  /^apps\/web\/src\/features\/operator\/pages\/OperatorFieldTwinWorkspacePage\.tsx$/,
  /^apps\/web\/src\/styles\/operatorFieldRuntime\.css$/,
  /^docs\/frontend-productization\/H60-FIELD-RUNTIME-OVERVIEW-STATE\.md$/,
  /^scripts\/frontend_acceptance\/ACCEPTANCE_H60_FIELD_RUNTIME_OVERVIEW_STATE_V1\.cjs$/,
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

const CANONICAL_FIELD_RUNTIME_FILES = [
  FILES.adapter,
  FILES.viewModel,
  FILES.routePage,
  FILES.layout,
  FILES.tabs,
  FILES.overviewPanel,
  FILES.statePanel,
  FILES.evidencePanel,
  FILES.coveragePanel,
  FILES.dataGapPanel,
  FILES.boundaryPanel,
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
  console.log('[h60-field-runtime-overview-state] ok:', name);
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

function matchesAny(filePath, patterns) {
  return patterns.some((pattern) => pattern.test(filePath));
}

function main() {
  for (const [key, relativePath] of Object.entries(FILES)) {
    assert(key + '_exists', exists(relativePath), { file: relativePath });
  }

  const changedFiles = getChangedFiles();
  assert('h60d_changed_files_within_allowlist_when_diff_context_exists', changedFiles.length === 0 || changedFiles.every((filePath) => matchesAny(filePath, H60D_ALLOWED_CHANGED_FILE_PATTERNS)), {
    changed_files: changedFiles,
    allowed_patterns: H60D_ALLOWED_CHANGED_FILE_PATTERNS.map((pattern) => String(pattern)),
  });
  assert('h60d_forbidden_files_not_changed', changedFiles.every((filePath) => !matchesAny(filePath, FORBIDDEN_CHANGED_FILE_PATTERNS)), {
    changed_files: changedFiles,
    forbidden_patterns: FORBIDDEN_CHANGED_FILE_PATTERNS.map((pattern) => String(pattern)),
  });

  const app = read(FILES.app);
  const routeModule = read(FILES.routeModule);
  const workspacePage = read(FILES.workspacePage);
  const adapter = read(FILES.adapter);
  const viewModel = read(FILES.viewModel);
  const routePage = read(FILES.routePage);
  const layout = read(FILES.layout);
  const tabs = read(FILES.tabs);
  const overviewPanel = read(FILES.overviewPanel);
  const statePanel = read(FILES.statePanel);
  const evidencePanel = read(FILES.evidencePanel);
  const coveragePanel = read(FILES.coveragePanel);
  const dataGapPanel = read(FILES.dataGapPanel);
  const boundaryPanel = read(FILES.boundaryPanel);
  const css = read(FILES.css);
  const h60dDoc = read(FILES.h60dDoc);
  const operatorRoutesBlock = extractFunctionBlock(app, 'OperatorRoutes');
  const canonicalBundle = CANONICAL_FIELD_RUNTIME_FILES.map(read).join('\n');
  const panelBundle = [overviewPanel, statePanel, evidencePanel, coveragePanel, dataGapPanel, boundaryPanel].join('\n');

  assert('route_topology_preserved', containsAll(routeModule, [
    'FieldRuntimeRoutePage',
    'tab="overview"',
    'tab="state"',
    'tab="fields"',
  ]) && containsAll(operatorRoutesBlock, [
    'path="fields/*" element={<OperatorFieldRuntimeRoutes />} />',
    'path="twin/fields/:fieldId" element={<OperatorFieldTwinWorkspacePage />}',
  ]) && lacksAll(app + '\n' + routeModule, [
    'path="/app/operator/*"',
    'to="/operator/fields',
    'replace to="/operator/fields',
  ]), { files: [FILES.app, FILES.routeModule] });

  assert('legacy_workspace_page_remains_available', containsAll(workspacePage, [
    'export default function OperatorFieldTwinWorkspacePage',
    'fetchOperatorFieldTwinWorkspace',
    'data-page="operator-field-twin-workspace"',
    'OperatorFieldTwinWorkspaceV1',
  ]), { file: FILES.workspacePage });

  assert('workspace_adapter_reuses_existing_read_only_fetch', containsAll(adapter, [
    'fetchOperatorFieldTwinWorkspace',
    'loadFieldRuntimeWorkspaceOverview',
    'mapFieldRuntimeWorkspaceOverview',
    'operator_field_twin_workspace_v1',
    'FieldRuntimeWorkspaceLoadState',
    'FieldRuntimeOverviewViewModel',
    'FieldRuntimeStateViewModel',
  ]) && lacksAll(adapter, [
    'new endpoint',
    '/api/v1/operator/field-runtime',
    '/api/control',
    '/api/control/ao_act',
  ]), { file: FILES.adapter });

  assert('view_model_extends_overview_state_slots', containsAll(viewModel, [
    'FieldRuntimeOverviewViewModel',
    'FieldRuntimeStateViewModel',
    'FieldRuntimeEvidenceSummaryViewModel',
    'FieldRuntimeCoverageSummaryViewModel',
    'FieldRuntimeDataGapViewModel',
    'source: "operator_field_twin_workspace_v1"',
    'Overview content is derived from the existing read-only Operator Field Twin workspace.',
    'State content is derived from the existing read-only Operator Field Twin workspace.',
    'Health route is reserved for H62.',
    'planned for H62',
  ]), { file: FILES.viewModel });

  assert('route_page_loads_overview_state_only_for_field_scoped_routes', containsAll(routePage, [
    'loadFieldRuntimeWorkspaceOverview',
    'shouldLoadWorkspace',
    'tab === "overview" || tab === "state"',
    'fieldId !== "not-selected"',
    'workspaceLoadState',
    'FieldRuntimeLayout',
  ]), { file: FILES.routePage });

  assert('layout_renders_overview_state_content_inside_h60c_shell', containsAll(layout, [
    'FieldRuntimeOverviewPanel',
    'FieldRuntimeStatePanel',
    'FieldRuntimeEvidenceSummaryPanel',
    'FieldRuntimeCoverageSummaryPanel',
    'FieldRuntimeDataGapPanel',
    'FieldRuntimeReadOnlyBoundaryPanel',
    'FieldRuntimeOverviewContent',
    'FieldRuntimeStateContent',
    'data-h60d="field-runtime-overview-state"',
    'FieldRuntimeTabs',
    'FieldRuntimeBoundaryBanner',
  ]), { file: FILES.layout });

  assert('list_route_disables_field_scoped_tab_links', containsAll(tabs, [
    'isListRoute',
    'operatorFieldRuntime__tab--disabled',
    'Select a field first',
    'data-field-runtime-tab-disabled="select-field-first"',
  ]), { file: FILES.tabs });

  assert('overview_state_panels_have_required_product_copy', containsAll(panelBundle, [
    'Field Runtime Overview',
    'State Summary',
    'Evidence Summary',
    'Coverage Summary',
    'Data Gaps',
    'Read-only Boundary',
    'Overview content is derived from the existing read-only Operator Field Twin workspace.',
    'source: operator_field_twin_workspace_v1',
    'No facts are written.',
    'No recommendation is created.',
    'No dispatch or AO-ACT task is created.',
    'Full Evidence trace remains H60-E.',
    'This panel does not generate observation requests, AO-SENSE, or recommendations.',
    'No facts write',
    'No recommendation creation',
    'No approval',
    'No dispatch',
    'No AO-ACT task',
    'No ROI write',
    'No Field Memory write',
  ]), { files: [FILES.overviewPanel, FILES.statePanel, FILES.evidencePanel, FILES.coveragePanel, FILES.dataGapPanel, FILES.boundaryPanel] });

  assert('canonical_bundle_has_no_write_or_mutation_tokens', lacksAll(canonicalBundle, [
    'POST',
    'PUT',
    'PATCH',
    'DELETE',
    '/api/control',
    '/api/control/ao_act',
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
  ]), { files: CANONICAL_FIELD_RUNTIME_FILES });

  assert('product_language_avoids_legacy_titles_in_canonical_panels', lacksAll(panelBundle, [
    'Twin 工作区',
    'Operator Twin Workbench',
    'H31-H45 决策到水分响应闭环',
    'scenario_compare_v1',
  ]), { files: [FILES.overviewPanel, FILES.statePanel, FILES.evidencePanel, FILES.coveragePanel, FILES.dataGapPanel, FILES.boundaryPanel] });

  assert('h60c_shell_preserved', containsAll(layout + '\n' + tabs + '\n' + viewModel, [
    'FieldRuntimeLayout',
    'FieldRuntimeTabs',
    'FieldRuntimeBoundaryBanner',
    'Health route is reserved for H62.',
    'not_enabled',
    'planned for H62',
  ]), { files: [FILES.layout, FILES.tabs, FILES.viewModel] });

  assert('css_defines_h60d_panel_classes_and_avoids_business_risk_language', containsAll(css, [
    '.operatorFieldRuntime__contentGrid',
    '.operatorFieldRuntime__summaryGrid',
    '.operatorFieldRuntime__panel',
    '.operatorFieldRuntime__panelHeader',
    '.operatorFieldRuntime__panelTitle',
    '.operatorFieldRuntime__panelMeta',
    '.operatorFieldRuntime__metricGrid',
    '.operatorFieldRuntime__metricCard',
    '.operatorFieldRuntime__stateVector',
    '.operatorFieldRuntime__coverageMatrix',
    '.operatorFieldRuntime__gapList',
    '.operatorFieldRuntime__boundaryPanel',
    '.operatorFieldRuntime__tab--disabled',
  ]) && lacksAll(css, [
    'risk-red',
    'danger',
    'warning',
    'success',
    'green',
    'yellow',
    'priority',
    'severity',
  ]), { file: FILES.css });

  assert('h60d_doc_records_scope_boundaries_and_next_phases', containsAll(h60dDoc, [
    'H60-D migrates Overview / State only',
    'source: operator_field_twin_workspace_v1',
    '/operator/fields/:fieldId',
    '/operator/fields/:fieldId/state',
    'legacy route remains preserved',
    'H60-D does not create a new backend contract',
    'No facts write',
    'No recommendation creation',
    'No approval',
    'No dispatch',
    'No AO-ACT task',
    'No ROI write',
    'No Field Memory write',
    'Full Evidence trace remains H60-E',
    'Forecast remains H60-F',
    'Scenario split remains H60-G',
    'Residual remains H60-H',
    'Calibration remains H60-I',
    'Audit remains H60-K',
  ]), { file: FILES.h60dDoc });

  console.log(JSON.stringify({
    ok: true,
    acceptance: 'ACCEPTANCE_H60_FIELD_RUNTIME_OVERVIEW_STATE_V1',
    scope: 'static H60-D overview and state consolidation only',
    changed_files_checked: changedFiles,
    allowed_changed_file_patterns: H60D_ALLOWED_CHANGED_FILE_PATTERNS.map((pattern) => String(pattern)),
    files_checked: FILES,
    assertions,
    next_step: 'H60-E_EVIDENCE_TAB',
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    acceptance: 'ACCEPTANCE_H60_FIELD_RUNTIME_OVERVIEW_STATE_V1',
    error: error.message,
    details: error.details || null,
    assertions,
  }, null, 2));
  process.exit(1);
}
