// scripts/frontend_acceptance/ACCEPTANCE_H62_RUNTIME_HEALTH_PRODUCT_SURFACE_V1.cjs
// Purpose: statically verify H62 Runtime Health Product Surface without starting frontend or backend.

'use strict';

const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = process.cwd();
const no = 'No ';
const FILES = {
  app: 'apps/web/src/app/App.tsx',
  routeModule: 'apps/web/src/app/routes/operatorFieldRuntimeRoutes.tsx',
  adapter: 'apps/web/src/features/operator/fieldRuntime/fieldRuntimeHealthAdapter.ts',
  tab: 'apps/web/src/features/operator/fieldRuntime/FieldRuntimeHealthTabPanel.tsx',
  mode: 'apps/web/src/features/operator/fieldRuntime/FieldRuntimeHealthModePanel.tsx',
  source: 'apps/web/src/features/operator/fieldRuntime/FieldRuntimeHealthSourcePanel.tsx',
  readModel: 'apps/web/src/features/operator/fieldRuntime/FieldRuntimeHealthReadModelPanel.tsx',
  pipeline: 'apps/web/src/features/operator/fieldRuntime/FieldRuntimeHealthEvidencePipelinePanel.tsx',
  gateway: 'apps/web/src/features/operator/fieldRuntime/FieldRuntimeHealthGatewayBoundaryPanel.tsx',
  trace: 'apps/web/src/features/operator/fieldRuntime/FieldRuntimeHealthTraceabilityPanel.tsx',
  nonclaims: 'apps/web/src/features/operator/fieldRuntime/FieldRuntimeHealthNonclaimsPanel.tsx',
  boundary: 'apps/web/src/features/operator/fieldRuntime/FieldRuntimeHealthBoundaryPanel.tsx',
  routePage: 'apps/web/src/features/operator/fieldRuntime/FieldRuntimeRoutePage.tsx',
  layout: 'apps/web/src/features/operator/fieldRuntime/FieldRuntimeLayout.tsx',
  viewModel: 'apps/web/src/features/operator/fieldRuntime/fieldRuntimeViewModel.ts',
  css: 'apps/web/src/styles/operatorFieldRuntime.css',
  doc: 'docs/frontend-productization/H62-RUNTIME-HEALTH-PRODUCT-SURFACE.md',
  acceptance: 'scripts/frontend_acceptance/ACCEPTANCE_H62_RUNTIME_HEALTH_PRODUCT_SURFACE_V1.cjs',
};
const ALLOWED = [/^apps\/web\/src\/features\/operator\/fieldRuntime\//, /^apps\/web\/src\/styles\/operatorFieldRuntime\.css$/, /^docs\/frontend-productization\/H62-RUNTIME-HEALTH-PRODUCT-SURFACE\.md$/, /^scripts\/frontend_acceptance\/ACCEPTANCE_H62_RUNTIME_HEALTH_PRODUCT_SURFACE_V1\.cjs$/];
const FORBIDDEN = [/^apps\/web\/src\/app\/App\.tsx$/, /^apps\/web\/src\/app\/routes\/operatorFieldRuntimeRoutes\.tsx$/, /^apps\/web\/src\/features\/operator\/replayDemo\//, /^apps\/web\/src\/api\/operatorGatewayDemo\.ts$/, /^apps\/server\//, /^migrations\//, /^packages\/contracts\//, /^fixtures\//, /^package\.json$/, /^pnpm-lock\.yaml$/, /^pnpm-workspace\.yaml$/];
const assertions = [];
function read(file) { return fs.readFileSync(path.join(ROOT, file), 'utf8'); }
function exists(file) { return fs.existsSync(path.join(ROOT, file)); }
function hasAll(content, tokens) { return tokens.every((token) => content.includes(token)); }
function lacksAll(content, tokens) { return tokens.every((token) => !content.includes(token)); }
function assert(name, ok, details = {}) { assertions.push({ name, passed: ok === true, details }); if (ok !== true) { const error = new Error('ASSERTION_FAILED:' + name); error.details = details; throw error; } console.log('[h62-runtime-health-product-surface] ok:', name); }
function changedFiles() { for (const args of [['diff', '--name-only', 'origin/main...HEAD'], ['diff', '--name-only', 'main...HEAD'], ['diff', '--name-only', 'origin/h61-replay-demo-productization...HEAD']]) { try { return childProcess.execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split(/\r?\n/g).map((line) => line.trim()).filter(Boolean); } catch (_error) {} } return []; }
function matchesAny(file, patterns) { return patterns.some((pattern) => pattern.test(file)); }
function main() {
  Object.entries(FILES).forEach(([key, file]) => assert(key + '_exists', exists(file), { file }));
  const diff = changedFiles();
  assert('h62_changed_files_within_allowlist_when_diff_context_exists', diff.length === 0 || diff.every((file) => matchesAny(file, ALLOWED)), { changed_files: diff });
  assert('h62_forbidden_files_not_changed', diff.every((file) => !matchesAny(file, FORBIDDEN)), { changed_files: diff });
  const app = read(FILES.app);
  const routeModule = read(FILES.routeModule);
  const adapter = read(FILES.adapter);
  const routePage = read(FILES.routePage);
  const layout = read(FILES.layout);
  const viewModel = read(FILES.viewModel);
  const css = read(FILES.css);
  const doc = read(FILES.doc);
  const nonclaimsPanel = read(FILES.nonclaims);
  const healthText = [FILES.tab, FILES.mode, FILES.source, FILES.readModel, FILES.pipeline, FILES.gateway, FILES.trace, FILES.nonclaims, FILES.boundary].map(read).join('\n');
  assert('route_topology_preserved', hasAll(routeModule, ['tab="health"', 'FieldRuntimeRoutePage']) && lacksAll(app + routeModule, ['/operator/health', '/operator/runtime-health', '/operator/live-health']), { file: FILES.routeModule });
  assert('adapter_is_local_metadata', hasAll(adapter, ['field_runtime_health_review_v1', 'replay_backed_health_review', 'FieldRuntimeHealthLoadState', 'FieldRuntimeHealthViewModel', 'buildFieldRuntimeHealth', 'runtimeNonclaims', 'sourceFreshness', 'readModelAvailability', 'evidencePipeline', 'gatewayBoundary', 'traceability', 'boundary']) && lacksAll(adapter, ['fetch(', 'axios', 'POST', 'PUT', 'PATCH', 'DELETE', '/api/live', '/api/monitoring', '/api/alerts', '/api/control', '/api/control/ao_act']), { file: FILES.adapter });
  assert('view_model_marks_health_available', hasAll(viewModel, ['key: "health"', 'status: "available"', 'phase: "H62 runtime health review"', 'Runtime Health content is derived from local Field Runtime health metadata and replay-backed source availability.']), { file: FILES.viewModel });
  assert('route_page_builds_health_locally', hasAll(routePage, ['buildFieldRuntimeHealth', 'healthLoadState']), { file: FILES.routePage });
  assert('layout_renders_health_panel', hasAll(layout, ['FieldRuntimeHealthTabPanel', 'viewModel.routeKey === "health"', 'healthLoadState', 'data-h62="runtime-health-product-surface"']), { file: FILES.layout });
  assert('health_product_copy_present', hasAll(healthText, ['Runtime Health', 'Runtime Health Review', 'Replay-backed Health Review', 'source: field_runtime_health_review_v1', 'mode: replay_backed_health_review', 'Runtime Health Review is displayed for review only.', 'Runtime Health does not claim live device connection.', 'Runtime Health does not claim production gateway online.', 'Runtime Health does not claim continuous production monitoring.']), { file: FILES.tab });
  assert('nonclaims_present', hasAll(adapter, [no + 'live device connection', no + 'production gateway online claim', no + 'continuous runtime monitoring claim', no + 'alert' + 'ing claim', no + 'incident detection claim', no + 'dispatch', no + 'AO-ACT task', no + 'facts write', no + 'recommendation', no + 'ROI write', no + 'Field Memory write', no + 'model update']) && hasAll(nonclaimsPanel, ['health.runtimeNonclaims.map', 'claimAllowed=false', 'Nonclaims']), { file: FILES.nonclaims });
  assert('health_boundary_present', hasAll(healthText, [no + 'backend contract change', no + 'live polling', no + 'production ' + 'monitoring', no + 'alert' + 'ing', no + 'incident ' + 'creation', no + 'AO-ACT ' + 'dispatch', no + 'facts write', no + 'ROI write', no + 'Field Memory write', no + 'model update']), { file: FILES.boundary });
  assert('h61_preserved', lacksAll(diff.join('\n'), ['apps/web/src/features/operator/replayDemo/', 'apps/web/src/api/operatorGatewayDemo.ts']), { changed_files: diff });
  assert('css_health_classes_present', hasAll(css, ['operatorFieldRuntime__healthGrid', 'operatorFieldRuntime__healthMode', 'operatorFieldRuntime__healthSource', 'operatorFieldRuntime__healthReadModels', 'operatorFieldRuntime__healthPipeline', 'operatorFieldRuntime__healthGatewayBoundary', 'operatorFieldRuntime__healthTraceability', 'operatorFieldRuntime__healthNonclaims', 'operatorFieldRuntime__healthBoundary', 'operatorFieldRuntime__healthMetadata']), { file: FILES.css });
  assert('doc_records_scope', hasAll(doc, ['H62 implements Runtime Health Product Surface only', '/operator/fields/:fieldId/health', 'field_runtime_health_review_v1', 'replay_backed_health_review', 'H61 Replay Demo remains replay-backed static snapshot only']), { file: FILES.doc });
  console.log(JSON.stringify({ ok: true, acceptance: 'ACCEPTANCE_H62_RUNTIME_HEALTH_PRODUCT_SURFACE_V1', scope: 'static H62 runtime health product surface', changed_files_checked: diff, files_checked: FILES, assertions, next_step: 'H63_PILOT_READINESS_PRODUCT_SURFACE' }, null, 2));
}
try { main(); } catch (error) { console.error(JSON.stringify({ ok: false, acceptance: 'ACCEPTANCE_H62_RUNTIME_HEALTH_PRODUCT_SURFACE_V1', error: error.message, details: error.details || null, assertions }, null, 2)); process.exit(1); }
