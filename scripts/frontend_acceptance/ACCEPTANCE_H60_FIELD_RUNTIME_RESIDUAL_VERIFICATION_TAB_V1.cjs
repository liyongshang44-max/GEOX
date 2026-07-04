// scripts/frontend_acceptance/ACCEPTANCE_H60_FIELD_RUNTIME_RESIDUAL_VERIFICATION_TAB_V1.cjs
// Purpose: statically verify H60-H Field Runtime Residual / Verification tab migration without running frontend code or touching backend state.
// Boundary: this script reads repository files and git diff metadata only.

'use strict';

const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.cwd();

const FILES = {
  app: 'apps/web/src/app/App.tsx',
  routeModule: 'apps/web/src/app/routes/operatorFieldRuntimeRoutes.tsx',
  legacyPostIrrigationPage: 'apps/web/src/features/operator/pages/OperatorFieldTwinPostIrrigationPage.tsx',
  residualAdapter: 'apps/web/src/features/operator/fieldRuntime/fieldRuntimeResidualAdapter.ts',
  residualTabPanel: 'apps/web/src/features/operator/fieldRuntime/FieldRuntimeResidualTabPanel.tsx',
  verificationSummaryPanel: 'apps/web/src/features/operator/fieldRuntime/FieldRuntimeVerificationSummaryPanel.tsx',
  prePostStatePanel: 'apps/web/src/features/operator/fieldRuntime/FieldRuntimePrePostStatePanel.tsx',
  responseDeltaPanel: 'apps/web/src/features/operator/fieldRuntime/FieldRuntimeResponseDeltaPanel.tsx',
  executionEvidencePanel: 'apps/web/src/features/operator/fieldRuntime/FieldRuntimeExecutionEvidencePanel.tsx',
  zoneResponsePanel: 'apps/web/src/features/operator/fieldRuntime/FieldRuntimeZoneResponsePanel.tsx',
  verificationGapPanel: 'apps/web/src/features/operator/fieldRuntime/FieldRuntimeVerificationGapPanel.tsx',
  executionTailPanel: 'apps/web/src/features/operator/fieldRuntime/FieldRuntimeExecutionTailPanel.tsx',
  residualBoundaryPanel: 'apps/web/src/features/operator/fieldRuntime/FieldRuntimeResidualBoundaryPanel.tsx',
  routePage: 'apps/web/src/features/operator/fieldRuntime/FieldRuntimeRoutePage.tsx',
  layout: 'apps/web/src/features/operator/fieldRuntime/FieldRuntimeLayout.tsx',
  viewModel: 'apps/web/src/features/operator/fieldRuntime/fieldRuntimeViewModel.ts',
  css: 'apps/web/src/styles/operatorFieldRuntime.css',
  doc: 'docs/frontend-productization/H60-FIELD-RUNTIME-RESIDUAL-VERIFICATION-TAB.md',
  acceptance: 'scripts/frontend_acceptance/ACCEPTANCE_H60_FIELD_RUNTIME_RESIDUAL_VERIFICATION_TAB_V1.cjs',
};

const ALLOWED_CHANGED_FILE_PATTERNS = [
  /^apps\/web\/src\/features\/operator\/fieldRuntime\/.+$/,
  /^apps\/web\/src\/features\/operator\/pages\/OperatorFieldTwinPostIrrigationPage\.tsx$/,
  /^apps\/web\/src\/styles\/operatorFieldRuntime\.css$/,
  /^docs\/frontend-productization\/H60-FIELD-RUNTIME-RESIDUAL-VERIFICATION-TAB\.md$/,
  /^scripts\/frontend_acceptance\/ACCEPTANCE_H60_FIELD_RUNTIME_RESIDUAL_VERIFICATION_TAB_V1\.cjs$/,
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

const CANONICAL_RESIDUAL_FILES = [
  FILES.residualAdapter,
  FILES.residualTabPanel,
  FILES.verificationSummaryPanel,
  FILES.prePostStatePanel,
  FILES.responseDeltaPanel,
  FILES.executionEvidencePanel,
  FILES.zoneResponsePanel,
  FILES.verificationGapPanel,
  FILES.executionTailPanel,
  FILES.residualBoundaryPanel,
  FILES.routePage,
  FILES.layout,
  FILES.viewModel,
];

const PANEL_FILES = [
  FILES.residualTabPanel,
  FILES.verificationSummaryPanel,
  FILES.prePostStatePanel,
  FILES.responseDeltaPanel,
  FILES.executionEvidencePanel,
  FILES.zoneResponsePanel,
  FILES.verificationGapPanel,
  FILES.executionTailPanel,
  FILES.residualBoundaryPanel,
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
  console.log('[h60-field-runtime-residual-verification-tab] ok:', name);
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
  assert('h60h_changed_files_within_allowlist_when_diff_context_exists', changedFiles.length === 0 || changedFiles.every((filePath) => matchesAny(filePath, ALLOWED_CHANGED_FILE_PATTERNS)), {
    changed_files: changedFiles,
    allowed_patterns: ALLOWED_CHANGED_FILE_PATTERNS.map(String),
  });
  assert('h60h_forbidden_files_not_changed', changedFiles.every((filePath) => !matchesAny(filePath, FORBIDDEN_CHANGED_FILE_PATTERNS)), {
    changed_files: changedFiles,
    forbidden_patterns: FORBIDDEN_CHANGED_FILE_PATTERNS.map(String),
  });

  const app = read(FILES.app);
  const routeModule = read(FILES.routeModule);
  const operatorRoutesBlock = extractFunctionBlock(app, 'OperatorRoutes');
  const legacyPage = read(FILES.legacyPostIrrigationPage);
  const adapter = read(FILES.residualAdapter);
  const routePage = read(FILES.routePage);
  const layout = read(FILES.layout);
  const viewModel = read(FILES.viewModel);
  const css = read(FILES.css);
  const doc = read(FILES.doc);
  const canonicalBundle = CANONICAL_RESIDUAL_FILES.map(read).join('\n');
  const panelBundle = PANEL_FILES.map(read).join('\n');

  assert('route_topology_preserved_for_canonical_and_legacy_residual', containsAll(routeModule, ['tab="residual"', 'FieldRuntimeRoutePage']) && containsAll(operatorRoutesBlock, [
    'path="fields/*" element={<OperatorFieldRuntimeRoutes />} />',
    'path="twin/fields/:fieldId/post-irrigation" element={<OperatorFieldTwinPostIrrigationPage />}',
  ]) && lacksAll(app + '\n' + routeModule, ['path="/app/operator/*"', 'replace to="/operator/fields']), { files: [FILES.app, FILES.routeModule] });

  assert('legacy_post_irrigation_page_remains_available', containsAll(legacyPage, [
    'export default function OperatorFieldTwinPostIrrigationPage',
    'fetchOperatorFieldTwinPostIrrigationVerification',
    'fetchOperatorTwinH31H45Closure',
    'data-page="operator-field-twin-post-irrigation"',
    'operator_field_twin_post_irrigation_verification_v1',
  ]), { file: FILES.legacyPostIrrigationPage });

  assert('residual_adapter_reuses_existing_read_only_fetches', containsAll(adapter, [
    'fetchOperatorFieldTwinPostIrrigationVerification',
    'fetchOperatorTwinH31H45Closure',
    'operator_field_twin_post_irrigation_verification_v1',
    'operator_twin_h31_h45_closure_v1',
    'FieldRuntimeResidualLoadState',
    'FieldRuntimeResidualViewModel',
    'loadFieldRuntimeResidual',
    'mapFieldRuntimeResidual',
  ]) && lacksAll(adapter, ['POST', 'PUT', 'PATCH', 'DELETE', '/api/control', '/api/control/ao_act', 'new endpoint', 'server route', 'writeFact', 'roiWriter', 'fieldMemoryWriter', 'createAoActTask']), { file: FILES.residualAdapter });

  assert('route_page_loads_only_expected_read_models', containsAll(routePage, [
    'overview" || tab === "state"',
    'loadFieldRuntimeWorkspaceOverview',
    'tab === "evidence"',
    'loadFieldRuntimeEvidence',
    'tab === "forecast"',
    'loadFieldRuntimeForecast',
    'tab === "scenario"',
    'loadFieldRuntimeScenario',
    'tab === "residual"',
    'loadFieldRuntimeResidual',
    'residualLoadState',
  ]), { file: FILES.routePage });

  assert('layout_composes_residual_tab_inside_h60c_shell', containsAll(layout, [
    'FieldRuntimeResidualTabPanel',
    'viewModel.routeKey === "residual"',
    'residualLoadState',
    'FieldRuntimeTabs',
    'FieldRuntimeBoundaryBanner',
    'data-h60h="field-runtime-residual-verification-tab"',
  ]), { file: FILES.layout });

  assert('view_model_marks_residual_available_and_preserves_future_tabs', containsAll(viewModel, [
    'key: "residual"',
    'status: "available"',
    'H60-H residual verification tab',
    'Residual content is derived from the existing read-only Operator Field Twin post-irrigation verification read model.',
    'Residual / Verification is displayed for review only.',
    'Residual is not causal proof.',
    'Residual does not write ROI.',
    'Residual does not write Field Memory.',
    'Residual does not create recommendation.',
    'No approval / dispatch / AO-ACT task is created.',
    'Downstream candidate flags are metadata only.',
    'Calibration route is reserved for H60-I.',
    'Health route is reserved for H62.',
    'not_enabled',
    'planned for H62',
    'Audit route is reserved for H60-K.',
  ]), { file: FILES.viewModel });

  assert('residual_panels_contain_required_product_copy', containsAll(panelBundle, [
    'Residual / Verification',
    'Response Verification',
    'Pre/Post State',
    'Response Delta',
    'Execution Evidence',
    'Zone Response',
    'Verification Gaps',
    'Residual Boundary',
    'Residual content is derived from the existing read-only Operator Field Twin post-irrigation verification read model.',
    'source: operator_field_twin_post_irrigation_verification_v1',
    'closure source: operator_twin_h31_h45_closure_v1',
    'Residual / Verification is displayed for review only.',
    'Residual is not causal proof.',
    'Residual does not write ROI.',
    'Residual does not write Field Memory.',
    'No approval / dispatch / AO-ACT task is created.',
    'Downstream candidate metadata',
    'Field Memory candidate metadata only',
    'ROI candidate metadata only',
    'Write-readiness metadata only',
    'No facts write',
    'No recommendation creation',
    'No approval',
    'No dispatch',
    'No AO-ACT task',
    'No ROI write',
    'No Field Memory write',
    'No causal proof claim',
    'No operation plan creation',
    'No backend contract change',
  ]), { files: PANEL_FILES });

  assert('canonical_residual_files_have_no_write_or_mutation_surface', lacksAll(canonicalBundle, [
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
    'calibrationUpdate',
  ]), { files: CANONICAL_RESIDUAL_FILES });

  assert('canonical_residual_titles_avoid_write_ready_product_language', lacksAll(panelBundle, [
    'Field Memory Candidate',
    'ROI Candidate',
    'Write Ready',
    '可写',
    '写入开关',
    'Irrigation Success Proof',
    'Effective Irrigation',
    'H40-H45 Execution Tail',
    'raw residual contract',
    'Twin 工作区',
  ]), { files: PANEL_FILES });

  assert('css_defines_h60h_residual_classes_and_avoids_forbidden_language', containsAll(css, [
    '.operatorFieldRuntime__residualGrid',
    '.operatorFieldRuntime__verificationSummary',
    '.operatorFieldRuntime__prePostState',
    '.operatorFieldRuntime__responseDelta',
    '.operatorFieldRuntime__executionEvidence',
    '.operatorFieldRuntime__zoneResponse',
    '.operatorFieldRuntime__verificationGaps',
    '.operatorFieldRuntime__executionTail',
    '.operatorFieldRuntime__residualBoundary',
    '.operatorFieldRuntime__residualRefs',
    '.operatorFieldRuntime__residualMetadata',
  ]) && lacksAll(css, ['risk-red', 'danger', 'warning', 'success', 'green', 'yellow', 'red', 'priority', 'severity', 'proof', 'effective', 'write-ready', 'roi-ready', 'memory-ready']), { file: FILES.css });

  assert('h60h_doc_records_scope_boundaries_and_next_phases', containsAll(doc, [
    'H60-H migrates Residual / Verification tab only',
    '/operator/fields/:fieldId/residual',
    '/operator/twin/fields/:fieldId/post-irrigation',
    'source is existing read-only operator_field_twin_post_irrigation_verification_v1',
    'closure source is operator_twin_h31_h45_closure_v1',
    'fetchOperatorFieldTwinPostIrrigationVerification',
    'fetchOperatorTwinH31H45Closure',
    'H60-H does not create backend contract',
    'H60-H does not write facts',
    'H60-H does not create recommendation',
    'H60-H does not approve / dispatch / create AO-ACT',
    'H60-H does not write ROI',
    'H60-H does not write Field Memory',
    'H60-H does not claim causal proof',
    'H60-H does not migrate Calibration / Health / Audit',
    'Residual is not causal proof.',
    'Response verification is not ROI.',
    'Response verification is not Field Memory.',
    'Downstream candidate flags are metadata only.',
    'Write-ready flags are metadata only.',
    'Execution tail summary is not Audit drawer.',
    'Calibration remains H60-I.',
    'Health remains not_enabled / planned for H62.',
    'Audit remains H60-K.',
  ]), { file: FILES.doc });

  console.log(JSON.stringify({
    ok: true,
    acceptance: 'ACCEPTANCE_H60_FIELD_RUNTIME_RESIDUAL_VERIFICATION_TAB_V1',
    scope: 'static H60-H residual verification tab migration only',
    changed_files_checked: changedFiles,
    allowed_changed_file_patterns: ALLOWED_CHANGED_FILE_PATTERNS.map(String),
    files_checked: FILES,
    assertions,
    next_step: 'H60-I_CALIBRATION_TAB',
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(JSON.stringify({ ok: false, acceptance: 'ACCEPTANCE_H60_FIELD_RUNTIME_RESIDUAL_VERIFICATION_TAB_V1', error: error.message, details: error.details || null, assertions }, null, 2));
  process.exit(1);
}
