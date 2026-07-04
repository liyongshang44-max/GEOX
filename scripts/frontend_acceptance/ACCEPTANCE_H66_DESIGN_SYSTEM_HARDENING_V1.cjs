// scripts/frontend_acceptance/ACCEPTANCE_H66_DESIGN_SYSTEM_HARDENING_V1.cjs
'use strict';

const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const files = {
  operator: 'apps/web/src/layouts/OperatorLayout.tsx',
  customer: 'apps/web/src/layouts/CustomerLayout.tsx',
  admin: 'apps/web/src/layouts/AdminLayout.tsx',
  customerLabels: 'apps/web/src/lib/customerLabels.ts',
  runtimeLayout: 'apps/web/src/features/operator/fieldRuntime/FieldRuntimeLayout.tsx',
  runtimeRoute: 'apps/web/src/features/operator/fieldRuntime/FieldRuntimeRoutePage.tsx',
  runtimeVm: 'apps/web/src/features/operator/fieldRuntime/fieldRuntimeViewModel.ts',
  runtimeStub: 'apps/web/src/features/operator/fieldRuntime/FieldRuntimeTabStub.tsx',
  replayCss: 'apps/web/src/styles/operatorReplayDemo.css',
  surfaceCss: 'apps/web/src/styles/surfacePrimitives.css',
  doc: 'docs/frontend-productization/H66-DESIGN-SYSTEM-HARDENING.md',
  acceptance: 'scripts/frontend_acceptance/ACCEPTANCE_H66_DESIGN_SYSTEM_HARDENING_V1.cjs',
};
const replayDemoFiles = [
  'apps/web/src/features/operator/replayDemo/ReplayDemoHero.tsx',
  'apps/web/src/features/operator/replayDemo/ReplayDemoPage.tsx',
  'apps/web/src/features/operator/replayDemo/ReplayDemoHashesPanel.tsx',
  'apps/web/src/features/operator/replayDemo/ReplayDemoNarrativePanel.tsx',
  'apps/web/src/features/operator/replayDemo/ReplayDemoBoundaryBanner.tsx',
  'apps/web/src/features/operator/replayDemo/ReplayDemoSnapshotIdsPanel.tsx',
  'apps/web/src/features/operator/replayDemo/ReplayDemoIngestionPanel.tsx',
  'apps/web/src/features/operator/replayDemo/ReplayDemoStandardsPanel.tsx',
  'apps/web/src/features/operator/replayDemo/ReplayDemoSnapshotPanel.tsx',
  'apps/web/src/features/operator/replayDemo/ReplayDemoGatewayPathPanel.tsx',
  'apps/web/src/features/operator/replayDemo/ReplayDemoTraceabilityPanel.tsx',
  'apps/web/src/features/operator/replayDemo/ReplayDemoDeviceEvidencePanel.tsx',
  'apps/web/src/features/operator/replayDemo/ReplayDemoBoundaryClaimsPanel.tsx',
];
const pilotReadinessFiles = [
  'apps/web/src/features/operator/pilotReadiness/OperatorPilotPage.tsx',
  'apps/web/src/features/operator/pilotReadiness/pilotReadinessViewModel.ts',
];
const allow = [
  /^apps\/web\/src\/layouts\/OperatorLayout\.tsx$/,
  /^apps\/web\/src\/layouts\/CustomerLayout\.tsx$/,
  /^apps\/web\/src\/layouts\/AdminLayout\.tsx$/,
  /^apps\/web\/src\/features\/operator\/fieldRuntime\//,
  /^apps\/web\/src\/features\/operator\/replayDemo\//,
  /^apps\/web\/src\/features\/operator\/pilotReadiness\//,
  /^apps\/web\/src\/styles\/operatorFieldRuntime\.css$/,
  /^apps\/web\/src\/styles\/operatorReplayDemo\.css$/,
  /^apps\/web\/src\/styles\/operatorPilotReadiness\.css$/,
  /^apps\/web\/src\/styles\/customerShell\.css$/,
  /^apps\/web\/src\/styles\/adminShell\.css$/,
  /^apps\/web\/src\/styles\/surfacePrimitives\.css$/,
  /^docs\/frontend-productization\/H66-DESIGN-SYSTEM-HARDENING\.md$/,
  /^scripts\/frontend_acceptance\/ACCEPTANCE_H66_DESIGN_SYSTEM_HARDENING_V1\.cjs$/,
];
const block = [
  /^apps\/web\/src\/app\/App\.tsx$/,
  /^apps\/web\/src\/app\/routes\//,
  /^apps\/server\//,
  /^migrations\//,
  /^packages\/contracts\//,
  /^fixtures\//,
  /^\.github\//,
  /^package\.json$/,
  /^pnpm-lock\.yaml$/,
  /^pnpm-workspace\.yaml$/,
];
const phaseTokens = ['H60', 'H61', 'H62', 'H63', 'H64', 'H65', 'P51', 'P52', 'P53', 'P54', 'P55', 'P56', 'P57', 'TK13'];
const navPollution = ['fixture', 'acceptance', 'debug', 'Dev Tools', 'ROI Ledger', 'Field Memory', 'Dispatch', 'AO-ACT'];
const writeTokens = ['POST', 'PUT', 'PATCH', 'DELETE', '/api/control', '/api/control/ao_act', 'createAoActTask', 'dispatchTask', 'writeFact', 'approve', 'approval', 'roiWriter', 'fieldMemoryWriter', 'modelUpdate'];
const mojibakeRanges = [/\uFFFD/, /[\u9500\u9366\u6D63\u7481\u6769\u95B0]/];
const cssForbiddenPatterns = [/risk-red/, /danger/, /success/, /\bgreen\b/, /\byellow\b/, /\bred\b/, /dispatch-active/, /ao-act-ready/, /live-online/, /production-online/];
const assertions = [];
function read(file) { return fs.readFileSync(path.join(root, file), 'utf8'); }
function exists(file) { return fs.existsSync(path.join(root, file)); }
function hasAll(text, tokens) { return tokens.every((token) => text.includes(token)); }
function lacksAll(text, tokens) { return tokens.every((token) => !text.includes(token)); }
function assert(name, passed, details = {}) {
  assertions.push({ name, passed: passed === true, details });
  if (passed !== true) {
    const error = new Error('ASSERTION_FAILED:' + name);
    error.details = details;
    throw error;
  }
  console.log('[h66-design-system] ok:', name);
}
function changedFiles() {
  for (const args of [['diff', '--name-only', 'origin/main...HEAD'], ['diff', '--name-only', 'main...HEAD']]) {
    try {
      return cp.execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    } catch (_error) {}
  }
  return [];
}
function matchesAny(file, patterns) { return patterns.some((pattern) => pattern.test(file)); }
function stripCommentsAndDataAttrs(text) {
  return text
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/data-h[\w-]+="[^"]*"/g, '')
    .replace(/data-h[\w-]+='[^']*'/g, '');
}
function stripCssComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '');
}
function hasForbiddenCssToken(text) {
  return cssForbiddenPatterns.some((pattern) => pattern.test(text));
}
function lineMetrics(file) {
  const lines = read(file).split(/\r?\n/);
  return {
    maxLineLength: Math.max(...lines.map((line) => line.length)),
    compressedArrowLines: lines.filter((line) => (line.match(/=>/g) || []).length > 3),
    compressedTernaryLines: lines.filter((line) => (line.match(/\?/g) || []).length > 5),
  };
}
function runtimeChangedFiles(diff) {
  return diff.filter((file) => (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.css')) && !file.includes('/frontend_acceptance/'));
}
try {
  Object.values(files).forEach((file) => assert('exists:' + file, exists(file), { file }));
  replayDemoFiles.forEach((file) => assert('exists:' + file, exists(file), { file }));
  pilotReadinessFiles.forEach((file) => assert('exists:' + file, exists(file), { file }));
  const diff = changedFiles();
  assert('changed_files_allowlist', diff.every((file) => matchesAny(file, allow)), { diff });
  assert('blocked_files_unchanged', diff.every((file) => !matchesAny(file, block)), { diff });
  assert('no_route_topology_change', diff.every((file) => file !== 'apps/web/src/app/App.tsx' && !file.startsWith('apps/web/src/app/routes/')), { diff });
  const runtimeFiles = runtimeChangedFiles(diff);
  const runtimeText = runtimeFiles.map((file) => read(file)).join('\n');
  assert('no_backend_or_write_surface', lacksAll(runtimeText, writeTokens), { runtimeFiles });
  const phaseFiles = [
    files.operator,
    files.customer,
    files.admin,
    files.runtimeLayout,
    files.runtimeRoute,
    files.runtimeVm,
    files.runtimeStub,
  ];
  const mojibakeFiles = [
    files.operator,
    files.customer,
    files.admin,
    files.customerLabels,
    files.runtimeLayout,
    files.runtimeRoute,
    files.runtimeVm,
    files.runtimeStub,
    ...replayDemoFiles,
    ...pilotReadinessFiles,
  ];
  const phaseText = phaseFiles.map((file) => stripCommentsAndDataAttrs(read(file))).join('\n');
  const mojibakeText = mojibakeFiles.map((file) => stripCommentsAndDataAttrs(read(file))).join('\n');
  assert('no_mojibake', !mojibakeRanges.some((pattern) => pattern.test(mojibakeText)), { mojibakeFiles });
  assert('no_visible_phase_copy', lacksAll(phaseText, phaseTokens), { phaseFiles, phaseTokens });
  const navText = [files.operator, files.customer, files.admin].map((file) => stripCommentsAndDataAttrs(read(file))).join('\n');
  assert('formal_nav_guard', lacksAll(navText, [...phaseTokens, ...navPollution]), { phaseTokens, navPollution });
  [files.runtimeLayout, files.runtimeRoute, files.runtimeVm].forEach((file) => {
    const metrics = lineMetrics(file);
    assert('field_runtime_format:' + file, metrics.maxLineLength <= 180 && metrics.compressedArrowLines.length === 0 && metrics.compressedTernaryLines.length === 0, metrics);
  });
  const surfaceCss = read(files.surfaceCss);
  assert('surface_primitives', hasAll(surfaceCss, ['.surfacePanel', '.surfacePanelHeader', '.surfaceGrid', '.surfaceTable', '.surfaceTableRow', '.surfaceMeta', '.surfaceBoundary', '.surfaceBadge']), { file: files.surfaceCss });
  const guardedCssText = stripCssComments(surfaceCss + '\n' + read(files.replayCss));
  assert('css_primitive_guard', !hasForbiddenCssToken(guardedCssText), { cssForbiddenPatterns: cssForbiddenPatterns.map((pattern) => pattern.toString()) });
  const replayCss = read(files.replayCss);
  assert('replay_demo_css_hardened', hasAll(replayCss, ['.operatorReplayDemo__hero', '.operatorReplayDemo__boundaryBanner', '.operatorReplayDemo__grid', '.operatorReplayDemo__panel', '.operatorReplayDemo__panelHeader', '.operatorReplayDemo__meta', '.operatorReplayDemo__table', '.operatorReplayDemo__tableRow', '.operatorReplayDemo__traceability', '.operatorReplayDemo__nonclaims']), { file: files.replayCss });
  console.log(JSON.stringify({ ok: true, acceptance: 'ACCEPTANCE_H66_DESIGN_SYSTEM_HARDENING_V1', changed_files_checked: diff, assertions }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, acceptance: 'ACCEPTANCE_H66_DESIGN_SYSTEM_HARDENING_V1', error: error.message, details: error.details || null, assertions }, null, 2));
  process.exit(1);
}
