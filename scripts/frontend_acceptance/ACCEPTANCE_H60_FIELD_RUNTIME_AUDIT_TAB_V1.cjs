// scripts/frontend_acceptance/ACCEPTANCE_H60_FIELD_RUNTIME_AUDIT_TAB_V1.cjs
// Purpose: statically verify H60-K Field Runtime Audit tab without running frontend code or backend calls.

'use strict';

const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.cwd();

const FILES = {
  app: 'apps/web/src/app/App.tsx',
  routeModule: 'apps/web/src/app/routes/operatorFieldRuntimeRoutes.tsx',
  tracePage: 'apps/web/src/features/operator/pages/OperatorTwinTraceReadbackPage.tsx',
  auditAdapter: 'apps/web/src/features/operator/fieldRuntime/fieldRuntimeAuditAdapter.ts',
  auditTabPanel: 'apps/web/src/features/operator/fieldRuntime/FieldRuntimeAuditTabPanel.tsx',
  auditRouteMatrixPanel: 'apps/web/src/features/operator/fieldRuntime/FieldRuntimeAuditRouteMatrixPanel.tsx',
  auditSourceMatrixPanel: 'apps/web/src/features/operator/fieldRuntime/FieldRuntimeAuditSourceMatrixPanel.tsx',
  auditBoundaryMatrixPanel: 'apps/web/src/features/operator/fieldRuntime/FieldRuntimeAuditBoundaryMatrixPanel.tsx',
  auditLegacyBridgePanel: 'apps/web/src/features/operator/fieldRuntime/FieldRuntimeAuditLegacyBridgePanel.tsx',
  traceBridgePanel: 'apps/web/src/features/operator/fieldRuntime/FieldRuntimeTraceReadbackBridgePanel.tsx',
  auditCompletionPanel: 'apps/web/src/features/operator/fieldRuntime/FieldRuntimeAuditCompletionPanel.tsx',
  routePage: 'apps/web/src/features/operator/fieldRuntime/FieldRuntimeRoutePage.tsx',
  layout: 'apps/web/src/features/operator/fieldRuntime/FieldRuntimeLayout.tsx',
  viewModel: 'apps/web/src/features/operator/fieldRuntime/fieldRuntimeViewModel.ts',
  css: 'apps/web/src/styles/operatorFieldRuntime.css',
  doc: 'docs/frontend-productization/H60-FIELD-RUNTIME-AUDIT-TAB.md',
  acceptance: 'scripts/frontend_acceptance/ACCEPTANCE_H60_FIELD_RUNTIME_AUDIT_TAB_V1.cjs',
};

const ALLOWED_CHANGED_FILE_PATTERNS = [
  /^apps\/web\/src\/features\/operator\/fieldRuntime\/.+$/,
  /^apps\/web\/src\/styles\/operatorFieldRuntime\.css$/,
  /^docs\/frontend-productization\/H60-FIELD-RUNTIME-AUDIT-TAB\.md$/,
  /^scripts\/frontend_acceptance\/ACCEPTANCE_H60_FIELD_RUNTIME_AUDIT_TAB_V1\.cjs$/,
];

const FORBIDDEN_CHANGED_FILE_PATTERNS = [
  /^apps\/web\/src\/app\/App\.tsx$/,
  /^apps\/web\/src\/app\/routes\/operatorFieldRuntimeRoutes\.tsx$/,
  /^apps\/web\/src\/features\/operator\/pages\/OperatorTwinTraceReadbackPage\.tsx$/,
  /^apps\/server\//,
  /^migrations\//,
  /^packages\/contracts\//,
  /^fixtures\//,
  /^\.github\//,
  /^package\.json$/,
  /^pnpm-lock\.yaml$/,
  /^pnpm-workspace\.yaml$/,
];

const assertions = [];
function read(file) { return fs.readFileSync(path.join(ROOT, file), 'utf8'); }
function exists(file) { return fs.existsSync(path.join(ROOT, file)); }
function normalize(value) { return value.replace(/[\uFEFF]/g, '').replace(/[`'"“”‘’]/g, '').replace(/[，。；、：:]/g, ' ').replace(/\s+/g, ' ').trim(); }
function containsAll(content, tokens) { const normalized = normalize(content); return tokens.every((token) => normalized.includes(normalize(token))); }
function lacksAll(content, tokens) { const normalized = normalize(content); return tokens.every((token) => !normalized.includes(normalize(token))); }
function assert(name, condition, details = {}) { const passed = condition === true; assertions.push({ name, passed, details }); if (!passed) { const error = new Error('ASSERTION_FAILED:' + name); error.details = details; throw error; } console.log('[h60-field-runtime-audit-tab] ok:', name); }
function changedFiles() { for (const args of [['diff', '--name-only', 'origin/main...HEAD'], ['diff', '--name-only', 'main...HEAD']]) { try { return childProcess.execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split(/\r?\n/g).map((line) => line.trim()).filter(Boolean); } catch (_error) {} } return []; }
function matchesAny(filePath, patterns) { return patterns.some((pattern) => pattern.test(filePath)); }
function functionBlock(content, name) { const marker = `function ${name}`; const start = content.indexOf(marker); if (start < 0) return ''; const open = content.indexOf('{', start); let depth = 0; for (let i = open; i < content.length; i += 1) { if (content[i] === '{') depth += 1; if (content[i] === '}') depth -= 1; if (depth === 0) return content.slice(start, i + 1); } return ''; }

function main() {
  for (const [key, file] of Object.entries(FILES)) assert(key + '_exists', exists(file), { file });

  const diff = changedFiles();
  assert('h60k_changed_files_within_allowlist_when_diff_context_exists', diff.length === 0 || diff.every((file) => matchesAny(file, ALLOWED_CHANGED_FILE_PATTERNS)), { changed_files: diff });
  assert('h60k_forbidden_files_not_changed', diff.every((file) => !matchesAny(file, FORBIDDEN_CHANGED_FILE_PATTERNS)), { changed_files: diff });

  const app = read(FILES.app);
  const routeModule = read(FILES.routeModule);
  const routes = functionBlock(app, 'OperatorRoutes');
  const adapter = read(FILES.auditAdapter);
  const panels = [FILES.auditTabPanel, FILES.auditRouteMatrixPanel, FILES.auditSourceMatrixPanel, FILES.auditBoundaryMatrixPanel, FILES.auditLegacyBridgePanel, FILES.traceBridgePanel, FILES.auditCompletionPanel].map(read).join('\n');
  const routePage = read(FILES.routePage);
  const layout = read(FILES.layout);
  const viewModel = read(FILES.viewModel);
  const css = read(FILES.css);
  const doc = read(FILES.doc);

  assert('route_topology_preserved_for_audit_and_trace', containsAll(routeModule, ['tab="audit"', 'FieldRuntimeRoutePage']) && containsAll(routes, ['path="fields/*" element={<OperatorFieldRuntimeRoutes />} />', 'path="twin/traces/:decisionCycleId" element={<OperatorTwinTraceReadbackPage />}']) && lacksAll(app + '\n' + routeModule, ['path="/app/operator/*"', 'replace to="/operator/fields/:fieldId/audit"']), { files: [FILES.app, FILES.routeModule] });
  assert('audit_adapter_is_local_metadata_only', containsAll(adapter, ['field_runtime_audit_v1', 'FieldRuntimeAuditLoadState', 'FieldRuntimeAuditViewModel', 'buildFieldRuntimeAudit', 'canonicalRouteFamily', 'legacyRouteFamily', 'sourceContracts', 'boundaryMatrix', 'legacyRoutes', 'traceBridge', 'completionSummary']) && lacksAll(adapter, ['fetch(', 'axios', 'POST', 'PUT', 'PATCH', 'DELETE', '/api/control', '/api/control/ao_act', '/api/v1/twin-kernel/traces', 'new endpoint', 'server route', 'writeFact', 'roiWriter', 'fieldMemoryWriter', 'createAoActTask', 'modelUpdate']), { file: FILES.auditAdapter });
  assert('route_page_builds_audit_locally_and_loads_expected_read_models', containsAll(routePage, ['loadFieldRuntimeWorkspaceOverview', 'loadFieldRuntimeEvidence', 'loadFieldRuntimeForecast', 'loadFieldRuntimeScenario', 'loadFieldRuntimeResidual', 'loadFieldRuntimeCalibration', 'buildFieldRuntimeAudit', 'decision_cycle_id', 'auditLoadState']), { file: FILES.routePage });
  assert('layout_composes_audit_tab_inside_field_runtime_shell', containsAll(layout, ['FieldRuntimeAuditTabPanel', 'viewModel.routeKey === "audit"', 'auditLoadState', 'FieldRuntimeTabs', 'FieldRuntimeBoundaryBanner', 'data-h60k="field-runtime-audit-tab"']), { file: FILES.layout });
  assert('view_model_marks_audit_available_and_health_not_enabled', containsAll(viewModel, ['key: "audit"', 'status: "available"', 'H60-K audit tab', 'Health route is reserved for H62.', 'not_enabled', 'planned for H62']), { file: FILES.viewModel });
  assert('audit_product_copy_present', containsAll(panels, ['Audit', 'Field Runtime Audit', 'Source Contract Matrix', 'Read Model Matrix', 'Route Ownership', 'Legacy Route Bridge', 'Boundary Matrix', 'Trace Readback Bridge', 'source: field_runtime_audit_v1', 'Audit is displayed for traceability review only.', 'Audit does not create product conclusions.', 'Audit does not rank, recommend, approve, dispatch, or update model state.', 'Health remains not_enabled and planned for H62.']), { files: Object.values(FILES).filter((file) => file.includes('Audit') || file.includes('TraceReadbackBridge')) });
  assert('source_matrix_contains_required_contracts', containsAll(adapter + '\n' + panels, ['operator_field_twin_workspace_v1', 'operator_field_twin_evidence_quality_v1', 'operator_field_twin_forecast_panel_v1', 'forecast_window_v1', 'operator_field_twin_scenario_compare_v1', 'scenario_compare_v1', 'operator_field_twin_post_irrigation_verification_v1', 'operator_twin_h31_h45_closure_v1', 'operator_field_twin_calibration_replay_v1', 'field_runtime_audit_v1']), { file: FILES.auditAdapter });
  assert('boundary_matrix_contains_required_boundaries', containsAll(panels, ['No facts write', 'No recommendation creation', 'No scenario submission in canonical route', 'No approval', 'No dispatch', 'No AO-ACT task', 'No ROI write', 'No Field Memory write', 'No model update', 'No calibration execution', 'No production monitoring claim', 'No product conclusion']), { file: FILES.auditBoundaryMatrixPanel });
  assert('trace_bridge_links_only_to_existing_trace_surface', containsAll(panels, ['FieldRuntimeTraceReadbackBridgePanel', 'decision_cycle_id', '/operator/twin/traces/', 'Trace Readback Bridge only.', 'Full trace readback remains in existing Twin Trace Readback surface.', 'Audit tab does not replace Twin Trace Readback.']) && lacksAll(panels, ['fetchTwinKernelTraceReadModel', 'TwinTraceReadModelV1', 'jsonBlock', 'Raw Readback', 'operatorJsonBlock']), { file: FILES.traceBridgePanel });
  assert('audit_product_titles_avoid_forbidden_surfaces', lacksAll(panels, ['Runtime Health', 'Production Monitoring', 'Risk Audit', 'Recommendation Review', 'Action Review', 'ROI Audit', 'Field Memory Audit', 'Model Learning Audit', 'Best Scenario', 'Recommended Scenario']), { files: [FILES.auditTabPanel] });
  assert('css_defines_h60k_audit_classes_and_avoids_forbidden_language', containsAll(css, ['.operatorFieldRuntime__auditGrid', '.operatorFieldRuntime__auditMatrix', '.operatorFieldRuntime__auditTable', '.operatorFieldRuntime__auditRouteMatrix', '.operatorFieldRuntime__auditSourceMatrix', '.operatorFieldRuntime__auditBoundaryMatrix', '.operatorFieldRuntime__auditLegacyBridge', '.operatorFieldRuntime__traceBridge', '.operatorFieldRuntime__auditCompletion', '.operatorFieldRuntime__auditMetadata']) && lacksAll(css, ['risk-red', 'danger', 'warning', 'success', 'green', 'yellow', 'red', 'priority', 'severity', 'recommended', 'best', 'health-online', 'production-online', 'live-device', 'write-ready', 'model-ready', 'learning-ready', 'roi-ready', 'memory-ready']), { file: FILES.css });
  assert('h60k_doc_records_scope_boundaries_and_next_phase', containsAll(doc, ['H60-K implements Audit tab only', '/operator/fields/:fieldId/audit', 'field_runtime_audit_v1', 'H60-K does not create backend contract', 'H60-K does not fetch full trace readback', 'H60-K does not replace OperatorTwinTraceReadbackPage', 'H60-K only links to existing Twin Trace Readback when decision_cycle_id is provided', 'H60-K does not implement Health', 'Health remains not_enabled / planned for H62', 'Audit is not product conclusion.', 'H61 Replay Demo Productization', 'H62 Runtime Health Product Surface']), { file: FILES.doc });

  console.log(JSON.stringify({ ok: true, acceptance: 'ACCEPTANCE_H60_FIELD_RUNTIME_AUDIT_TAB_V1', scope: 'static H60-K audit tab migration only', changed_files_checked: diff, files_checked: FILES, assertions, next_step: 'H61_REPLAY_DEMO_PRODUCTIZATION_OR_H62_RUNTIME_HEALTH' }, null, 2));
}

try { main(); } catch (error) { console.error(JSON.stringify({ ok: false, acceptance: 'ACCEPTANCE_H60_FIELD_RUNTIME_AUDIT_TAB_V1', error: error.message, details: error.details || null, assertions }, null, 2)); process.exit(1); }
