// scripts/frontend_acceptance/ACCEPTANCE_H67_1_FRONTEND_VISUAL_SMOKE_CLEANUP_V1.cjs
'use strict';

const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const files = {
  operatorLayout: 'apps/web/src/layouts/OperatorLayout.tsx',
  runtimeNonclaims: 'apps/web/src/features/operator/fieldRuntime/runtimeNonclaims.ts',
  boundaryPanel: 'apps/web/src/features/operator/fieldRuntime/FieldRuntimeReadOnlyBoundaryPanel.tsx',
  pilotPage: 'apps/web/src/features/operator/pilotReadiness/OperatorPilotPage.tsx',
  pilotVm: 'apps/web/src/features/operator/pilotReadiness/pilotReadinessViewModel.ts',
  runtimeCss: 'apps/web/src/styles/operatorFieldRuntime.css',
  acceptance: 'scripts/frontend_acceptance/ACCEPTANCE_H67_1_FRONTEND_VISUAL_SMOKE_CLEANUP_V1.cjs',
};

const allow = [
  /^apps\/web\/src\/layouts\/OperatorLayout\.tsx$/,
  /^apps\/web\/src\/features\/operator\/fieldRuntime\/runtimeNonclaims\.ts$/,
  /^apps\/web\/src\/features\/operator\/fieldRuntime\/FieldRuntimeReadOnlyBoundaryPanel\.tsx$/,
  /^apps\/web\/src\/features\/operator\/pilotReadiness\/OperatorPilotPage\.tsx$/,
  /^apps\/web\/src\/features\/operator\/pilotReadiness\/pilotReadinessViewModel\.ts$/,
  /^apps\/web\/src\/styles\/operatorFieldRuntime\.css$/,
  /^scripts\/frontend_acceptance\/ACCEPTANCE_H67_1_FRONTEND_VISUAL_SMOKE_CLEANUP_V1\.cjs$/,
];

const block = [
  /^apps\/web\/src\/app\/App\.tsx$/,
  /^apps\/web\/src\/app\/routes\//,
  /^apps\/server\//,
  /^migrations\//,
  /^packages\/contracts\//,
  /^fixtures\//,
  /^package\.json$/,
  /^pnpm-lock\.yaml$/,
];

const assertions = [];
function read(file) { return fs.readFileSync(path.join(root, file), 'utf8'); }
function exists(file) { return fs.existsSync(path.join(root, file)); }
function assert(name, passed, details = {}) {
  assertions.push({ name, passed: passed === true, details });
  if (passed !== true) {
    const error = new Error('ASSERTION_FAILED:' + name);
    error.details = details;
    throw error;
  }
  console.log('[h67.1-visual-smoke] ok:', name);
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

try {
  Object.values(files).forEach((file) => assert('exists:' + file, exists(file), { file }));
  const diff = changedFiles();
  assert('changed_files_allowlist', diff.every((file) => matchesAny(file, allow)), { diff });
  assert('blocked_files_unchanged', diff.every((file) => !matchesAny(file, block)), { diff });

  const operatorLayout = read(files.operatorLayout);
  assert('operator_fields_nav_canonical', operatorLayout.includes('key: "fields"') && operatorLayout.includes('to: "/operator/fields"') && operatorLayout.includes('pathname.startsWith("/operator/fields")'), { file: files.operatorLayout });
  assert('operator_fields_nav_not_preserved', !operatorLayout.includes('Field Runtime list is planned') && !operatorLayout.includes('status: "route-preserved",\n  },\n  {\n    key: "evidence"'), { file: files.operatorLayout });

  const runtimeNonclaims = read(files.runtimeNonclaims);
  assert('field_runtime_nonclaim_product_wording', runtimeNonclaims.includes('Controlled Execution: Disabled') && !runtimeNonclaims.includes('AO-ACT Dispatch: Disabled'), { file: files.runtimeNonclaims });

  const boundaryPanel = read(files.boundaryPanel);
  assert('field_runtime_boundary_no_visible_phase', boundaryPanel.includes('No-write product boundary') && !boundaryPanel.includes('H60-D no-write boundary') && !boundaryPanel.includes('No AO-ACT task'), { file: files.boundaryPanel });

  const pilotPage = read(files.pilotPage);
  assert('pilot_page_product_headings', pilotPage.includes('Pilot Planning Gate') && pilotPage.includes('Readiness Review Gate') && !pilotPage.includes('P53 Pilot Planning Gate') && !pilotPage.includes('P54 Readiness Review Gate') && !pilotPage.includes('P53/P54'), { file: files.pilotPage });

  const pilotVm = read(files.pilotVm);
  assert('pilot_vm_product_labels', pilotVm.includes('Planning result') && pilotVm.includes('Readiness result') && pilotVm.includes('Runtime Health Service Gate') && !pilotVm.includes('label: "P53') && !pilotVm.includes('label: "P54') && !pilotVm.includes('label: "p55'), { file: files.pilotVm });

  const runtimeCss = read(files.runtimeCss);
  assert('runtime_health_table_readable', runtimeCss.includes('operatorFieldRuntime__healthReadModels .operatorFieldRuntime__healthTableHeader') && runtimeCss.includes('min-width: 900px') && runtimeCss.includes('overflow-wrap: anywhere'), { file: files.runtimeCss });

  console.log(JSON.stringify({ ok: true, acceptance: 'ACCEPTANCE_H67_1_FRONTEND_VISUAL_SMOKE_CLEANUP_V1', changed_files_checked: diff, assertions }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, acceptance: 'ACCEPTANCE_H67_1_FRONTEND_VISUAL_SMOKE_CLEANUP_V1', error: error.message, details: error.details || null, assertions }, null, 2));
  process.exit(1);
}