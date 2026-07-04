// scripts/frontend_acceptance/ACCEPTANCE_H61_REPLAY_DEMO_PRODUCTIZATION_V1.cjs
// Purpose: statically verify H61 Replay Demo Productization without starting frontend or backend.

'use strict';

const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = process.cwd();
const FILES = {
  app: 'apps/web/src/app/App.tsx',
  api: 'apps/web/src/api/operatorGatewayDemo.ts',
  page: 'apps/web/src/features/operator/pages/OperatorGatewayDemoViewerPage.tsx',
  viewModel: 'apps/web/src/features/operator/replayDemo/replayDemoViewModel.ts',
  replayPage: 'apps/web/src/features/operator/replayDemo/ReplayDemoPage.tsx',
  hero: 'apps/web/src/features/operator/replayDemo/ReplayDemoHero.tsx',
  boundary: 'apps/web/src/features/operator/replayDemo/ReplayDemoBoundaryBanner.tsx',
  narrative: 'apps/web/src/features/operator/replayDemo/ReplayDemoNarrativePanel.tsx',
  snapshot: 'apps/web/src/features/operator/replayDemo/ReplayDemoSnapshotPanel.tsx',
  gateway: 'apps/web/src/features/operator/replayDemo/ReplayDemoGatewayPathPanel.tsx',
  standards: 'apps/web/src/features/operator/replayDemo/ReplayDemoStandardsPanel.tsx',
  device: 'apps/web/src/features/operator/replayDemo/ReplayDemoDeviceEvidencePanel.tsx',
  ingestion: 'apps/web/src/features/operator/replayDemo/ReplayDemoIngestionPanel.tsx',
  traceability: 'apps/web/src/features/operator/replayDemo/ReplayDemoTraceabilityPanel.tsx',
  hashes: 'apps/web/src/features/operator/replayDemo/ReplayDemoHashesPanel.tsx',
  snapshotIds: 'apps/web/src/features/operator/replayDemo/ReplayDemoSnapshotIdsPanel.tsx',
  boundaryClaims: 'apps/web/src/features/operator/replayDemo/ReplayDemoBoundaryClaimsPanel.tsx',
  css: 'apps/web/src/styles/operatorReplayDemo.css',
  doc: 'docs/frontend-productization/H61-REPLAY-DEMO-PRODUCTIZATION.md',
  acceptance: 'scripts/frontend_acceptance/ACCEPTANCE_H61_REPLAY_DEMO_PRODUCTIZATION_V1.cjs',
};
const ALLOWED = [/^apps\/web\/src\/features\/operator\/pages\/OperatorGatewayDemoViewerPage\.tsx$/, /^apps\/web\/src\/features\/operator\/replayDemo\/.+$/, /^apps\/web\/src\/styles\/operatorReplayDemo\.css$/, /^docs\/frontend-productization\/H61-REPLAY-DEMO-PRODUCTIZATION\.md$/, /^scripts\/frontend_acceptance\/ACCEPTANCE_H61_REPLAY_DEMO_PRODUCTIZATION_V1\.cjs$/];
const FORBIDDEN = [/^apps\/web\/src\/app\/App\.tsx$/, /^apps\/web\/src\/app\/routes\/operatorFieldRuntimeRoutes\.tsx$/, /^apps\/web\/src\/features\/operator\/fieldRuntime\//, /^apps\/server\//, /^migrations\//, /^packages\/contracts\//, /^fixtures\//, /^\.github\//, /^package\.json$/, /^pnpm-lock\.yaml$/, /^pnpm-workspace\.yaml$/];
const assertions = [];
function read(file) { return fs.readFileSync(path.join(ROOT, file), 'utf8'); }
function exists(file) { return fs.existsSync(path.join(ROOT, file)); }
function norm(value) { return value.replace(/[\uFEFF]/g, '').replace(/[`'"“”‘’]/g, '').replace(/[，。；、：:]/g, ' ').replace(/\s+/g, ' ').trim(); }
function has(content, token) { return norm(content).includes(norm(token)); }
function hasAll(content, tokens) { return tokens.every((token) => has(content, token)); }
function lacksAll(content, tokens) { return tokens.every((token) => !has(content, token)); }
function assert(name, condition, details = {}) { assertions.push({ name, passed: condition === true, details }); if (condition !== true) { const error = new Error('ASSERTION_FAILED:' + name); error.details = details; throw error; } console.log('[h61-replay-demo-productization] ok:', name); }
function changedFiles() { for (const args of [['diff', '--name-only', 'origin/main...HEAD'], ['diff', '--name-only', 'main...HEAD']]) { try { return childProcess.execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split(/\r?\n/g).map((line) => line.trim()).filter(Boolean); } catch (_error) {} } return []; }
function matchesAny(file, patterns) { return patterns.some((pattern) => pattern.test(file)); }
function operatorRoutesBlock(app) { const marker = 'function OperatorRoutes'; const start = app.indexOf(marker); if (start < 0) return ''; const open = app.indexOf('{', start); let depth = 0; for (let i = open; i < app.length; i += 1) { if (app[i] === '{') depth += 1; if (app[i] === '}') depth -= 1; if (depth === 0) return app.slice(start, i + 1); } return ''; }
function main() {
  Object.entries(FILES).forEach(([key, file]) => assert(key + '_exists', exists(file), { file }));
  const diff = changedFiles();
  assert('h61_changed_files_within_allowlist_when_diff_context_exists', diff.length === 0 || diff.every((file) => matchesAny(file, ALLOWED)), { changed_files: diff });
  assert('h61_forbidden_files_not_changed', diff.every((file) => !matchesAny(file, FORBIDDEN)), { changed_files: diff });
  const app = read(FILES.app); const routes = operatorRoutesBlock(app); const api = read(FILES.api); const page = read(FILES.page); const replayPage = read(FILES.replayPage); const trace = read(FILES.traceability); const doc = read(FILES.doc); const css = read(FILES.css);
  const replayText = Object.values(FILES).filter((file) => file.includes('/replayDemo/')).map(read).join('\n');
  assert('route_topology_preserved', has(routes, 'path="twin/gateway-demo" element={<OperatorGatewayDemoViewerPage />}') && lacksAll(app, ['/operator/replay-demo', '/operator/runtime-demo', '/operator/live-demo']), { file: FILES.app });
  assert('static_get_only_preserved', hasAll(api, ['fetchP51GatewayViewerSnapshot', 'P51_GATEWAY_VIEWER_SNAPSHOT_URL', '/demo-runtime/p51-gateway-viewer-snapshot.json', 'method: "GET"']), { file: FILES.api });
  assert('operator_page_is_thin_wrapper', hasAll(page, ['ReplayDemoPage', 'return <ReplayDemoPage />']) && lacksAll(page, ['style={{', 'React.CSSProperties']), { file: FILES.page });
  assert('dedicated_panels_are_wired', hasAll(replayPage, ['ReplayDemoHashesPanel', 'ReplayDemoSnapshotIdsPanel', 'ReplayDemoBoundaryClaimsPanel']) && lacksAll(trace, ['Evidence refs', 'Hashes']), { file: FILES.replayPage });
  assert('replay_product_copy_present', hasAll(replayText, ['Replay-backed Gateway Demo', 'Static checked-in snapshot', 'Gateway Path Replay', 'Snapshot Source', 'Standards Mapping', 'Device Evidence Package', 'Ingestion Window', 'Traceability', 'Hashes', 'Evidence refs', 'Nonclaims']), { file: FILES.replayPage });
  assert('first_screen_boundary_present', hasAll(replayText, ['No live device connection', 'No production gateway claim', 'No Runtime Health claim', 'No field pilot claim', 'No AO-ACT dispatch', 'No facts write', 'No recommendation', 'No ROI write', 'No Field Memory write']), { file: FILES.boundary });
  assert('no_inline_styles_in_replay_demo', lacksAll(replayText + '\n' + page, ['style={{', 'React.CSSProperties']), { file: FILES.replayPage });
  assert('metadata_status_mapping_present', hasAll(read(FILES.viewModel), ['available', 'not_available', 'metadata_only', 'replay_backed_demo', 'p51_gateway_viewer_snapshot']), { file: FILES.viewModel });
  assert('css_entry_exists', hasAll(css, ['.operatorReplayDemo', '.operatorReplayDemo__panel', '.operatorReplayDemo__table']), { file: FILES.css });
  assert('doc_records_scope_and_boundaries', hasAll(doc, ['H61 productizes replay-backed demo only', '/operator/twin/gateway-demo', 'source remains checked-in P51 gateway viewer snapshot', 'API remains static GET only', 'H61 does not create backend contract', 'H61 does not change route topology', 'H61 does not implement H62 Runtime Health']), { file: FILES.doc });
  console.log(JSON.stringify({ ok: true, acceptance: 'ACCEPTANCE_H61_REPLAY_DEMO_PRODUCTIZATION_V1', scope: 'static H61 replay demo productization only', changed_files_checked: diff, files_checked: FILES, assertions, next_step: 'H62_RUNTIME_HEALTH_PRODUCT_SURFACE' }, null, 2));
}
try { main(); } catch (error) { console.error(JSON.stringify({ ok: false, acceptance: 'ACCEPTANCE_H61_REPLAY_DEMO_PRODUCTIZATION_V1', error: error.message, details: error.details || null, assertions }, null, 2)); process.exit(1); }
