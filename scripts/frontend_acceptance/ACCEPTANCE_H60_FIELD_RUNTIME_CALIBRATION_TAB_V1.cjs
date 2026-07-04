// scripts/frontend_acceptance/ACCEPTANCE_H60_FIELD_RUNTIME_CALIBRATION_TAB_V1.cjs
// Purpose: statically verify H60-I Field Runtime Calibration tab migration without running frontend code or backend calls.

'use strict';

const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = process.cwd();

const FILES = {
  app: 'apps/web/src/app/App.tsx',
  routeModule: 'apps/web/src/app/routes/operatorFieldRuntimeRoutes.tsx',
  legacyCalibrationPage: 'apps/web/src/features/operator/pages/OperatorFieldTwinCalibrationPage.tsx',
  calibrationAdapter: 'apps/web/src/features/operator/fieldRuntime/fieldRuntimeCalibrationAdapter.ts',
  calibrationTabPanel: 'apps/web/src/features/operator/fieldRuntime/FieldRuntimeCalibrationTabPanel.tsx',
  calibrationViewPanel: 'apps/web/src/features/operator/fieldRuntime/FieldRuntimeCalibrationViewPanel.tsx',
  routePage: 'apps/web/src/features/operator/fieldRuntime/FieldRuntimeRoutePage.tsx',
  layout: 'apps/web/src/features/operator/fieldRuntime/FieldRuntimeLayout.tsx',
  viewModel: 'apps/web/src/features/operator/fieldRuntime/fieldRuntimeViewModel.ts',
  doc: 'docs/frontend-productization/H60-FIELD-RUNTIME-CALIBRATION-TAB.md',
  acceptance: 'scripts/frontend_acceptance/ACCEPTANCE_H60_FIELD_RUNTIME_CALIBRATION_TAB_V1.cjs',
};

const ALLOWED_CHANGED_FILE_PATTERNS = [
  /^apps\/web\/src\/features\/operator\/fieldRuntime\/.+$/,
  /^docs\/frontend-productization\/H60-FIELD-RUNTIME-CALIBRATION-TAB\.md$/,
  /^scripts\/frontend_acceptance\/ACCEPTANCE_H60_FIELD_RUNTIME_CALIBRATION_TAB_V1\.cjs$/,
];
const FORBIDDEN_CHANGED_FILE_PATTERNS = [/^apps\/web\/src\/app\/App\.tsx$/, /^apps\/web\/src\/app\/routes\/operatorFieldRuntimeRoutes\.tsx$/, /^apps\/server\//, /^migrations\//, /^packages\/contracts\//, /^fixtures\//, /^\.github\//, /^package\.json$/, /^pnpm-lock\.yaml$/, /^pnpm-workspace\.yaml$/];
const assertions = [];

function read(file) { return fs.readFileSync(path.join(ROOT, file), 'utf8'); }
function exists(file) { return fs.existsSync(path.join(ROOT, file)); }
function normalize(value) { return value.replace(/[\uFEFF]/g, '').replace(/[`'"“”‘’]/g, '').replace(/[，。；、：:]/g, ' ').replace(/\s+/g, ' ').trim(); }
function containsAll(content, tokens) { const normalized = normalize(content); return tokens.every((token) => normalized.includes(normalize(token))); }
function lacksAll(content, tokens) { const normalized = normalize(content); return tokens.every((token) => !normalized.includes(normalize(token))); }
function assert(name, condition, details = {}) { const passed = condition === true; assertions.push({ name, passed, details }); if (!passed) { const error = new Error('ASSERTION_FAILED:' + name); error.details = details; throw error; } console.log('[h60-field-runtime-calibration-tab] ok:', name); }
function changedFiles() { for (const args of [['diff', '--name-only', 'origin/main...HEAD'], ['diff', '--name-only', 'main...HEAD']]) { try { return childProcess.execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split(/\r?\n/g).map((line) => line.trim()).filter(Boolean); } catch (_error) {} } return []; }
function matchesAny(filePath, patterns) { return patterns.some((pattern) => pattern.test(filePath)); }
function functionBlock(content, name) { const marker = `function ${name}`; const start = content.indexOf(marker); if (start < 0) return ''; const open = content.indexOf('{', start); let depth = 0; for (let i = open; i < content.length; i += 1) { if (content[i] === '{') depth += 1; if (content[i] === '}') depth -= 1; if (depth === 0) return content.slice(start, i + 1); } return ''; }

function main() {
  for (const [key, file] of Object.entries(FILES)) assert(key + '_exists', exists(file), { file });
  const diff = changedFiles();
  assert('h60i_changed_files_within_allowlist_when_diff_context_exists', diff.length === 0 || diff.every((file) => matchesAny(file, ALLOWED_CHANGED_FILE_PATTERNS)), { changed_files: diff });
  assert('h60i_forbidden_files_not_changed', diff.every((file) => !matchesAny(file, FORBIDDEN_CHANGED_FILE_PATTERNS)), { changed_files: diff });

  const app = read(FILES.app);
  const routeModule = read(FILES.routeModule);
  const legacyPage = read(FILES.legacyCalibrationPage);
  const adapter = read(FILES.calibrationAdapter);
  const tabPanel = read(FILES.calibrationTabPanel);
  const viewPanel = read(FILES.calibrationViewPanel);
  const routePage = read(FILES.routePage);
  const layout = read(FILES.layout);
  const viewModel = read(FILES.viewModel);
  const doc = read(FILES.doc);
  const routes = functionBlock(app, 'OperatorRoutes');

  assert('route_topology_preserved_for_canonical_and_legacy_calibration', containsAll(routeModule, ['tab="calibration"', 'FieldRuntimeRoutePage']) && containsAll(routes, ['path="fields/*" element={<OperatorFieldRuntimeRoutes />} />', 'path="twin/fields/:fieldId/calibration" element={<OperatorFieldTwinCalibrationPage />}']), { files: [FILES.app, FILES.routeModule] });
  assert('legacy_calibration_page_remains_available', containsAll(legacyPage, ['OperatorFieldTwinCalibrationPage', 'fetchOperatorFieldTwinCalibrationReplay', 'operator_field_twin_calibration_replay_v1']), { file: FILES.legacyCalibrationPage });
  assert('calibration_adapter_reuses_existing_read_only_fetch', containsAll(adapter, ['fetchOperatorFieldTwinCalibrationReplay', 'operator_field_twin_calibration_replay_v1', 'FieldRuntimeCalibrationLoadState', 'FieldRuntimeCalibrationViewModel', 'loadFieldRuntimeCalibration', 'mapFieldRuntimeCalibration']), { file: FILES.calibrationAdapter });
  assert('route_page_loads_calibration_read_model', containsAll(routePage, ['loadFieldRuntimeCalibration', 'tab === "calibration"', 'calibrationLoadState']), { file: FILES.routePage });
  assert('layout_composes_calibration_tab_inside_field_runtime_shell', containsAll(layout, ['FieldRuntimeCalibrationTabPanel', 'viewModel.routeKey === "calibration"', 'calibrationLoadState', 'FieldRuntimeTabs', 'FieldRuntimeBoundaryBanner', 'data-h60i="field-runtime-calibration-tab"']), { file: FILES.layout });
  assert('view_model_marks_calibration_available_and_preserves_future_tabs', containsAll(viewModel, ['key: "calibration"', 'status: "available"', 'H60-I calibration review tab', 'not_enabled', 'planned for H62', 'reserved for H60-K']), { file: FILES.viewModel });
  assert('calibration_runtime_view_contains_product_surface', containsAll(tabPanel + '\n' + viewPanel, ['FieldRuntimeCalibrationViewPanel', 'Calibration Review', 'Calibration Replay', 'Replay Timeline', 'Calibration Inputs', 'Calibration Summary', 'Replay Gaps', 'Calibration Boundary', 'source: operator_field_twin_calibration_replay_v1', 'Review availability metadata', 'Write-readiness metadata only', 'Replay gap status', 'No facts write', 'No calibration execution', 'No model parameter update', 'No learning update', 'No recommendation creation', 'No approval', 'No dispatch', 'No AO-ACT task', 'No ROI write', 'No Field Memory write', 'No backend contract change']), { files: [FILES.calibrationTabPanel, FILES.calibrationViewPanel] });
  assert('canonical_calibration_files_have_no_mutation_surface', lacksAll(adapter + '\n' + tabPanel + '\n' + viewPanel + '\n' + routePage + '\n' + layout + '\n' + viewModel, ['writeFact', 'createFact', 'submitRecommendation', 'SubmitScenarioToRecommendationPanel', 'approvalClient', 'dispatchClient', 'createAoActTask', 'roiWriter', 'fieldMemoryWriter', 'modelUpdate', 'parameterUpdate', 'learningUpdate', 'calibrationUpdate', 'calibrationWriter']), { files: [FILES.calibrationAdapter, FILES.calibrationViewPanel] });
  assert('h60i_doc_records_scope_boundaries_and_next_phase', containsAll(doc, ['H60-I migrates Calibration tab only', '/operator/fields/:fieldId/calibration', '/operator/twin/fields/:fieldId/calibration', 'operator_field_twin_calibration_replay_v1', 'fetchOperatorFieldTwinCalibrationReplay', 'H60-I does not create backend contract', 'H60-I does not migrate Health / Audit', 'H60-K Audit Drawer / Audit Tab']), { file: FILES.doc });

  console.log(JSON.stringify({ ok: true, acceptance: 'ACCEPTANCE_H60_FIELD_RUNTIME_CALIBRATION_TAB_V1', scope: 'static H60-I calibration tab migration only', changed_files_checked: diff, files_checked: FILES, assertions, next_step: 'H60-K_AUDIT_DRAWER_OR_AUDIT_TAB' }, null, 2));
}

try { main(); } catch (error) { console.error(JSON.stringify({ ok: false, acceptance: 'ACCEPTANCE_H60_FIELD_RUNTIME_CALIBRATION_TAB_V1', error: error.message, details: error.details || null, assertions }, null, 2)); process.exit(1); }
