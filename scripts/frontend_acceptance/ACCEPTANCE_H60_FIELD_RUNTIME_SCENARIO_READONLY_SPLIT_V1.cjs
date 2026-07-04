// scripts/frontend_acceptance/ACCEPTANCE_H60_FIELD_RUNTIME_SCENARIO_READONLY_SPLIT_V1.cjs
// Purpose: statically verify H60-G Field Runtime Scenario read-only split without running frontend code or touching backend state.
// Boundary: this script reads repository files and git diff metadata only.

'use strict';

const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.cwd();

const FILES = {
  app: 'apps/web/src/app/App.tsx',
  routeModule: 'apps/web/src/app/routes/operatorFieldRuntimeRoutes.tsx',
  legacyScenarioPage: 'apps/web/src/features/operator/pages/OperatorFieldTwinScenarioComparePage.tsx',
  scenarioAdapter: 'apps/web/src/features/operator/fieldRuntime/fieldRuntimeScenarioAdapter.ts',
  scenarioTabPanel: 'apps/web/src/features/operator/fieldRuntime/FieldRuntimeScenarioTabPanel.tsx',
  scenarioStatusPanel: 'apps/web/src/features/operator/fieldRuntime/FieldRuntimeScenarioStatusPanel.tsx',
  scenarioOptionsPanel: 'apps/web/src/features/operator/fieldRuntime/FieldRuntimeScenarioOptionsPanel.tsx',
  scenarioEvidencePanel: 'apps/web/src/features/operator/fieldRuntime/FieldRuntimeScenarioEvidencePanel.tsx',
  scenarioBoundaryPanel: 'apps/web/src/features/operator/fieldRuntime/FieldRuntimeScenarioBoundaryPanel.tsx',
  legacyNotice: 'apps/web/src/features/operator/fieldRuntime/FieldRuntimeLegacyScenarioActionNotice.tsx',
  routePage: 'apps/web/src/features/operator/fieldRuntime/FieldRuntimeRoutePage.tsx',
  layout: 'apps/web/src/features/operator/fieldRuntime/FieldRuntimeLayout.tsx',
  viewModel: 'apps/web/src/features/operator/fieldRuntime/fieldRuntimeViewModel.ts',
  submitPanel: 'apps/web/src/features/operator/components/SubmitScenarioToRecommendationPanel.tsx',
  css: 'apps/web/src/styles/operatorFieldRuntime.css',
  doc: 'docs/frontend-productization/H60-FIELD-RUNTIME-SCENARIO-READONLY-SPLIT.md',
  acceptance: 'scripts/frontend_acceptance/ACCEPTANCE_H60_FIELD_RUNTIME_SCENARIO_READONLY_SPLIT_V1.cjs',
};

const ALLOWED_CHANGED_FILE_PATTERNS = [
  /^apps\/web\/src\/features\/operator\/fieldRuntime\/.+$/,
  /^apps\/web\/src\/features\/operator\/pages\/OperatorFieldTwinScenarioComparePage\.tsx$/,
  /^apps\/web\/src\/styles\/operatorFieldRuntime\.css$/,
  /^docs\/frontend-productization\/H60-FIELD-RUNTIME-SCENARIO-READONLY-SPLIT\.md$/,
  /^scripts\/frontend_acceptance\/ACCEPTANCE_H60_FIELD_RUNTIME_SCENARIO_READONLY_SPLIT_V1\.cjs$/,
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
  /^apps\/web\/src\/features\/operator\/components\/SubmitScenarioToRecommendationPanel\.tsx$/,
];

const CANONICAL_SCENARIO_FILES = [
  FILES.scenarioAdapter,
  FILES.scenarioTabPanel,
  FILES.scenarioStatusPanel,
  FILES.scenarioOptionsPanel,
  FILES.scenarioEvidencePanel,
  FILES.scenarioBoundaryPanel,
  FILES.routePage,
  FILES.layout,
  FILES.viewModel,
];

const PANEL_FILES = [
  FILES.scenarioTabPanel,
  FILES.scenarioStatusPanel,
  FILES.scenarioOptionsPanel,
  FILES.scenarioEvidencePanel,
  FILES.scenarioBoundaryPanel,
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
  console.log('[h60-field-runtime-scenario-readonly-split] ok:', name);
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
  assert('h60g_changed_files_within_allowlist_when_diff_context_exists', changedFiles.length === 0 || changedFiles.every((filePath) => matchesAny(filePath, ALLOWED_CHANGED_FILE_PATTERNS)), {
    changed_files: changedFiles,
    allowed_patterns: ALLOWED_CHANGED_FILE_PATTERNS.map(String),
  });
  assert('h60g_forbidden_files_not_changed', changedFiles.every((filePath) => !matchesAny(filePath, FORBIDDEN_CHANGED_FILE_PATTERNS)), {
    changed_files: changedFiles,
    forbidden_patterns: FORBIDDEN_CHANGED_FILE_PATTERNS.map(String),
  });

  const app = read(FILES.app);
  const routeModule = read(FILES.routeModule);
  const operatorRoutesBlock = extractFunctionBlock(app, 'OperatorRoutes');
  const legacyPage = read(FILES.legacyScenarioPage);
  const adapter = read(FILES.scenarioAdapter);
  const routePage = read(FILES.routePage);
  const layout = read(FILES.layout);
  const viewModel = read(FILES.viewModel);
  const css = read(FILES.css);
  const doc = read(FILES.doc);
  const legacyNotice = read(FILES.legacyNotice);
  const canonicalBundle = CANONICAL_SCENARIO_FILES.map(read).join('\n');
  const panelBundle = PANEL_FILES.map(read).join('\n');

  assert('route_topology_preserved_for_canonical_and_legacy_scenario', containsAll(routeModule, ['tab="scenario"', 'FieldRuntimeRoutePage']) && containsAll(operatorRoutesBlock, [
    'path="fields/*" element={<OperatorFieldRuntimeRoutes />} />',
    'path="twin/fields/:fieldId/scenarios" element={<OperatorFieldTwinScenarioComparePage />}',
  ]) && lacksAll(app + '\n' + routeModule, ['path="/app/operator/*"', 'replace to="/operator/fields']), { files: [FILES.app, FILES.routeModule] });

  assert('legacy_scenario_page_remains_available_and_guarded', containsAll(legacyPage, [
    'export default function OperatorFieldTwinScenarioComparePage',
    'fetchOperatorFieldTwinScenarioCompare',
    'data-page="operator-field-twin-scenario-compare"',
    'scenario_compare_v1',
    'SubmitScenarioToRecommendationPanel',
    'FieldRuntimeLegacyScenarioActionNotice',
  ]) && containsAll(legacyNotice, [
    'Legacy / governed action surface',
    'not canonical Field Runtime',
    'Canonical Field Runtime Scenario remains read-only',
  ]), { files: [FILES.legacyScenarioPage, FILES.legacyNotice] });

  assert('scenario_adapter_reuses_existing_read_only_fetch', containsAll(adapter, [
    'fetchOperatorFieldTwinScenarioCompare',
    'operator_field_twin_scenario_compare_v1',
    'scenario_compare_v1',
    'FieldRuntimeScenarioLoadState',
    'FieldRuntimeScenarioViewModel',
    'loadFieldRuntimeScenario',
    'mapFieldRuntimeScenario',
    'forecastDeltaText',
  ]) && lacksAll(adapter, [
    'SubmitScenarioToRecommendationPanel',
    'submitOperatorScenarioRecommendation',
    'POST',
    'PUT',
    'PATCH',
    'DELETE',
    '/api/control',
    '/api/control/ao_act',
    'new endpoint',
    'server route',
  ]), { file: FILES.scenarioAdapter });

  assert('route_page_loads_only_expected_read_models', containsAll(routePage, [
    'overview" || tab === "state"',
    'loadFieldRuntimeWorkspaceOverview',
    'tab === "evidence"',
    'loadFieldRuntimeEvidence',
    'tab === "forecast"',
    'loadFieldRuntimeForecast',
    'tab === "scenario"',
    'loadFieldRuntimeScenario',
    'scenarioLoadState',
  ]), { file: FILES.routePage });

  assert('layout_composes_scenario_tab_inside_h60c_shell', containsAll(layout, [
    'FieldRuntimeScenarioTabPanel',
    'viewModel.routeKey === "scenario"',
    'scenarioLoadState',
    'FieldRuntimeTabs',
    'FieldRuntimeBoundaryBanner',
    'data-h60g="field-runtime-scenario-readonly-split"',
  ]), { file: FILES.layout });

  assert('view_model_marks_scenario_available_and_preserves_future_tabs', containsAll(viewModel, [
    'key: "scenario"',
    'status: "available"',
    'H60-G scenario read-only review',
    'Scenario content is derived from the existing read-only Operator Field Twin scenario compare read model.',
    'Scenario Review is displayed for comparison only.',
    'Scenario is not a recommendation.',
    'Scenario does not create recommendation.',
    'No scenario submission exists in canonical Field Runtime.',
    'Legacy scenario submission, if needed, remains isolated under /operator/twin/fields/:fieldId/scenarios.',
    'Residual route is reserved for H60-H.',
    'Calibration route is reserved for H60-I.',
    'Health route is reserved for H62.',
    'not_enabled',
    'planned for H62',
    'Audit route is reserved for H60-K.',
  ]), { file: FILES.viewModel });

  assert('canonical_scenario_files_exclude_submission_surface', lacksAll(canonicalBundle, [
    'SubmitScenarioToRecommendationPanel',
    'submitOperatorScenarioRecommendation',
    'submitRecommendation',
    'recommendation submission',
    'onSubmit',
    '<button',
    '<select',
    '<textarea',
    '<input',
    'approvalClient',
    'dispatchClient',
    'createAoActTask',
    'roiWriter',
    'fieldMemoryWriter',
    'modelUpdate',
  ]), { files: CANONICAL_SCENARIO_FILES });

  assert('scenario_panels_contain_required_product_copy', containsAll(panelBundle, [
    'Scenario',
    'Scenario Review',
    'Scenario Options',
    'Scenario Evidence',
    'Scenario Boundary',
    'Scenario content is derived from the existing read-only Operator Field Twin scenario compare read model.',
    'source: operator_field_twin_scenario_compare_v1',
    'scenario source: scenario_compare_v1',
    'Scenario Review is displayed for comparison only.',
    'Scenario is not a recommendation.',
    'Scenario does not create recommendation.',
    'Scenario does not create task.',
    'Scenario does not imply action.',
    'No scenario submission exists in canonical Field Runtime.',
    'No approval / dispatch / AO-ACT task is created.',
    'No facts write',
    'No recommendation creation',
    'No scenario submission',
    'No operation plan creation',
    'No ROI write',
    'No Field Memory write',
    'No backend contract change',
  ]), { files: PANEL_FILES });

  assert('canonical_scenario_titles_avoid_legacy_product_language', lacksAll(panelBundle, [
    'Scenario Compare Submission',
    'Submit Scenario',
    'Scenario → Recommendation',
    'Operator Twin Scenario Compare',
    'H23 Scenario Page',
    'raw scenario contract',
    'Twin 工作区',
    'Best Scenario',
    'Recommended Scenario',
    'Priority Scenario',
    'Risk Ranking',
  ]), { files: PANEL_FILES });

  assert('css_defines_h60g_scenario_classes_and_avoids_action_ranking_language', containsAll(css, [
    '.operatorFieldRuntime__scenarioGrid',
    '.operatorFieldRuntime__scenarioStatus',
    '.operatorFieldRuntime__scenarioOptions',
    '.operatorFieldRuntime__scenarioOption',
    '.operatorFieldRuntime__scenarioEvidence',
    '.operatorFieldRuntime__scenarioBoundary',
    '.operatorFieldRuntime__scenarioNotice',
    '.operatorFieldRuntime__legacyActionNotice',
    '.operatorFieldRuntime__scenarioRefs',
  ]) && lacksAll(css, ['risk-red', 'danger', 'warning', 'success', 'green', 'yellow', 'red', 'priority', 'severity', 'best', 'recommended']), { file: FILES.css });

  assert('h60g_doc_records_scope_boundaries_and_next_phases', containsAll(doc, [
    'H60-G migrates Scenario tab only',
    '/operator/fields/:fieldId/scenario',
    '/operator/twin/fields/:fieldId/scenarios',
    'Canonical Scenario is read-only',
    'Legacy Scenario may retain SubmitScenarioToRecommendationPanel',
    'source is existing read-only operator_field_twin_scenario_compare_v1',
    'scenario source is scenario_compare_v1',
    'fetchOperatorFieldTwinScenarioCompare',
    'H60-G does not import SubmitScenarioToRecommendationPanel into canonical Field Runtime',
    'H60-G does not call submitOperatorScenarioRecommendation from canonical Field Runtime',
    'H60-G does not write facts',
    'H60-G does not create recommendation in canonical route',
    'H60-G does not approve / dispatch / create AO-ACT',
    'H60-G does not create operation plan',
    'H60-G does not write ROI / Field Memory',
    'Residual remains H60-H',
    'Calibration remains H60-I',
    'Health remains not_enabled / planned for H62',
    'Audit remains H60-K',
    'Scenario is not recommendation.',
    'Scenario options are not ranked.',
    'Scenario option confidence is metadata, not action eligibility.',
    'Scenario delta is displayed as comparison metadata, not task priority.',
    'Legacy scenario submission remains isolated.',
  ]), { file: FILES.doc });

  console.log(JSON.stringify({
    ok: true,
    acceptance: 'ACCEPTANCE_H60_FIELD_RUNTIME_SCENARIO_READONLY_SPLIT_V1',
    scope: 'static H60-G scenario read-only split only',
    changed_files_checked: changedFiles,
    allowed_changed_file_patterns: ALLOWED_CHANGED_FILE_PATTERNS.map(String),
    files_checked: FILES,
    assertions,
    next_step: 'H60-H_RESIDUAL_VERIFICATION_TAB',
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(JSON.stringify({ ok: false, acceptance: 'ACCEPTANCE_H60_FIELD_RUNTIME_SCENARIO_READONLY_SPLIT_V1', error: error.message, details: error.details || null, assertions }, null, 2));
  process.exit(1);
}
