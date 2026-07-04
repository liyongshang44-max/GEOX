// scripts/frontend_acceptance/ACCEPTANCE_H67_FRONTEND_RELEASE_READINESS_V1.cjs
'use strict';

const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();

const files = {
  h58Plan: 'docs/frontend-productization/H58.0-FRONTEND-PRODUCTIZATION-PLAN.md',
  h58Routes: 'docs/frontend-productization/H58.0-ROUTE-OWNERSHIP-MATRIX.md',
  h67Readiness: 'docs/frontend-productization/H67-FRONTEND-RELEASE-READINESS.md',
  h67Manifest: 'docs/frontend-productization/H67-FRONTEND-ROUTE-SURFACE-MANIFEST.md',
  h67Checklist: 'docs/frontend-productization/H67-FRONTEND-RELEASE-CHECKLIST.md',
  h67Acceptance: 'scripts/frontend_acceptance/ACCEPTANCE_H67_FRONTEND_RELEASE_READINESS_V1.cjs',
  h61Acceptance: 'scripts/frontend_acceptance/ACCEPTANCE_H61_REPLAY_DEMO_PRODUCTIZATION_V1.cjs',
  h62Acceptance: 'scripts/frontend_acceptance/ACCEPTANCE_H62_RUNTIME_HEALTH_PRODUCT_SURFACE_V1.cjs',
  h63Acceptance: 'scripts/frontend_acceptance/ACCEPTANCE_H63_OPERATOR_PILOT_V1.cjs',
  h64Acceptance: 'scripts/frontend_acceptance/ACCEPTANCE_H64_CUSTOMER_PORTAL_CLEANUP_V1.cjs',
  h65Acceptance: 'scripts/frontend_acceptance/ACCEPTANCE_H65_ADMIN_CONSOLE_CLEANUP_V1.cjs',
  h66Acceptance: 'scripts/frontend_acceptance/ACCEPTANCE_H66_DESIGN_SYSTEM_HARDENING_V1.cjs',
  app: 'apps/web/src/app/App.tsx',
  operatorRoutes: 'apps/web/src/app/routes/operatorFieldRuntimeRoutes.tsx',
  operatorLayout: 'apps/web/src/layouts/OperatorLayout.tsx',
  customerLayout: 'apps/web/src/layouts/CustomerLayout.tsx',
  adminLayout: 'apps/web/src/layouts/AdminLayout.tsx',
  customerLabels: 'apps/web/src/lib/customerLabels.ts',
  fieldsRoutes: 'apps/web/src/app/routes/fieldsRoutes.tsx',
  customerOperationsRoutes: 'apps/web/src/app/routes/customerOperationsRoutes.tsx',
  operatorGatewayDemoPage: 'apps/web/src/features/operator/pages/OperatorGatewayDemoViewerPage.tsx',
  operatorPilotPage: 'apps/web/src/features/operator/pilotReadiness/OperatorPilotPage.tsx',
  pilotReadinessVm: 'apps/web/src/features/operator/pilotReadiness/pilotReadinessViewModel.ts',
  fieldRuntimeVm: 'apps/web/src/features/operator/fieldRuntime/fieldRuntimeViewModel.ts',
  operatorFieldRuntimeCss: 'apps/web/src/styles/operatorFieldRuntime.css',
  operatorReplayCss: 'apps/web/src/styles/operatorReplayDemo.css',
  operatorShellCss: 'apps/web/src/styles/operatorShell.css',
  operatorPilotCss: 'apps/web/src/styles/operatorPilotReadiness.css',
  customerShellCss: 'apps/web/src/styles/customerShell.css',
  adminShellCss: 'apps/web/src/styles/adminShell.css',
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

const fieldRuntimeFiles = [
  'apps/web/src/features/operator/fieldRuntime/FieldRuntimeLayout.tsx',
  'apps/web/src/features/operator/fieldRuntime/FieldRuntimeRoutePage.tsx',
  'apps/web/src/features/operator/fieldRuntime/fieldRuntimeViewModel.ts',
  'apps/web/src/features/operator/fieldRuntime/FieldRuntimeTabStub.tsx',
];

const allow = [
  /^docs\/frontend-productization\/H67-FRONTEND-RELEASE-READINESS\.md$/,
  /^docs\/frontend-productization\/H67-FRONTEND-ROUTE-SURFACE-MANIFEST\.md$/,
  /^docs\/frontend-productization\/H67-FRONTEND-RELEASE-CHECKLIST\.md$/,
  /^docs\/frontend-productization\/README\.md$/,
  /^scripts\/frontend_acceptance\/ACCEPTANCE_H67_FRONTEND_RELEASE_READINESS_V1\.cjs$/,
  /^scripts\/frontend_acceptance\/lib\/frontendReleaseReadiness\.js$/,
];

const block = [
  /^apps\/web\/src\//,
  /^apps\/server\//,
  /^migrations\//,
  /^packages\/contracts\//,
  /^fixtures\//,
  /^\.github\//,
  /^package\.json$/,
  /^pnpm-lock\.yaml$/,
  /^pnpm-workspace\.yaml$/,
];

const mojibakePatterns = [/\uFFFD/, /[\u9500\u9366\u6D63\u7481\u6769\u95B0\u5F74\u5F6C\u6F61\u60E7\u608D\u5D4C]/];
const phaseTokens = ['H58', 'H59', 'H60', 'H61', 'H62', 'H63', 'H64', 'H65', 'H66', 'P51', 'P52', 'P53', 'P54', 'P55', 'P56', 'P57', 'TK13', 'fixture', 'acceptance count'];
const navPollution = ['fixture', 'acceptance', 'debug', 'Dev Tools', 'ROI Ledger', 'Field Memory', 'Dispatch', 'AO-ACT'];

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
  console.log('[h67-release-readiness] ok:', name);
}
function changedFiles() {
  for (const args of [['diff', '--name-only', 'origin/main...HEAD'], ['diff', '--name-only', 'main...HEAD']]) {
    try {
      return cp.execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
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
function containsMojibake(text) { return mojibakePatterns.some((pattern) => pattern.test(text)); }

try {
  Object.values(files).forEach((file) => assert('exists:' + file, exists(file), { file }));
  replayDemoFiles.forEach((file) => assert('exists:' + file, exists(file), { file }));
  fieldRuntimeFiles.forEach((file) => assert('exists:' + file, exists(file), { file }));

  const diff = changedFiles();
  assert('changed_files_allowlist', diff.every((file) => matchesAny(file, allow)), { diff });
  assert('blocked_files_unchanged', diff.every((file) => !matchesAny(file, block)), { diff });
  assert('no_runtime_source_modifications', diff.every((file) => !file.startsWith('apps/web/src/')), { diff });

  const app = read(files.app);
  const operatorRoutes = read(files.operatorRoutes);
  const operatorLayout = read(files.operatorLayout);
  const customerLayout = read(files.customerLayout);
  const adminLayout = read(files.adminLayout);
  const manifest = read(files.h67Manifest);
  const readiness = read(files.h67Readiness);
  const checklist = read(files.h67Checklist);

  assert('upstream_productization_docs_present', hasAll(read(files.h58Plan), ['H58.0 Frontend Productization Plan']) && hasAll(read(files.h58Routes), ['H58.0 Route Ownership Matrix']), {});
  assert('h67_docs_record_scope', hasAll(readiness, ['H67 is the frontend release readiness gate', 'does not add product surfaces', 'does not change route topology', 'does not modify runtime source', 'Replay-backed demo remains replay-backed', 'No production gateway online claim']), { file: files.h67Readiness });
  assert('h67_manifest_records_three_surfaces', hasAll(manifest, ['Operator Runtime Console', 'Customer Portal', 'Admin Console', '/operator/twin', '/customer/dashboard', '/admin/dashboard']), { file: files.h67Manifest });
  assert('h67_checklist_records_release_gate', hasAll(checklist, ['H58 frontend productization plan present', 'H67 release readiness gate pass', 'typecheck:web pass', 'build:web pass']), { file: files.h67Checklist });

  assert('route_topology_frozen', hasAll(app, ['path="/operator/*"', 'path="/customer/*"', 'path="/admin/*"', 'RequireSession']), { file: files.app });
  assert('operator_field_runtime_routes_present', hasAll(operatorRoutes, ['path=":fieldId"', 'path=":fieldId/evidence"', 'path=":fieldId/state"', 'path=":fieldId/forecast"', 'path=":fieldId/scenario"', 'path=":fieldId/residual"', 'path=":fieldId/calibration"', 'path=":fieldId/health"', 'path=":fieldId/audit"']), { file: files.operatorRoutes });

  assert('operator_surface_release_ready', hasAll(operatorLayout, ['Operator Runtime Console', 'Pilot Readiness', 'Replay-backed Demo', 'Live Device: Not connected', 'Production Gateway: Not online', 'Field Pilot: Not started', 'Controlled Execution: Disabled', 'Read-only runtime review']) && hasAll(app, ['path="twin/gateway-demo"', 'path="fields/*"', 'path="twin"']), { files: [files.operatorLayout, files.app] });

  assert('customer_surface_release_ready', hasAll(customerLayout, ['CUSTOMER_NAV_ITEMS', 'navDashboard', 'navFields', 'navOperations', 'navReports', 'navExport', '<main className="customerLayoutMain">{children}</main>']) && lacksAll(customerLayout, ['Evidence Summary', 'Dispatch', 'ROI Ledger', 'Field Memory', 'debug']), { file: files.customerLayout });
  assert('customer_routes_present', hasAll(app, ['path="export"', 'path="fields/:fieldId/export"', 'path="operations/:operationId/export"', 'path="reports"']), { file: files.app });

  assert('admin_surface_release_ready', !adminLayout.includes('AppShell') && hasAll(adminLayout, ['Dashboard', 'Fields', 'Operations', 'Devices', 'Evidence', 'Runtime Health', 'Config', '/admin/dashboard', '/admin/fields', '/admin/operations', '/admin/devices', '/admin/evidence', '/admin/healthz', '/admin/skills']) && lacksAll(adminLayout, ['/admin/import', '/admin/operations/:operationId/debug', '/admin/acceptance']), { file: files.adminLayout });
  assert('admin_route_guarded', app.includes('path="/admin/*"') && app.includes('<RequireSession><AdminShell /></RequireSession>'), { file: files.app });

  const mojibakeFiles = [
    files.operatorLayout,
    files.customerLayout,
    files.adminLayout,
    files.customerLabels,
    files.operatorFieldRuntimeCss,
    files.operatorReplayCss,
    files.operatorShellCss,
    files.operatorPilotCss,
    files.customerShellCss,
    files.adminShellCss,
    ...fieldRuntimeFiles,
    ...replayDemoFiles,
    files.operatorPilotPage,
    files.pilotReadinessVm,
  ];
  const mojibakeText = mojibakeFiles.map((file) => stripCommentsAndDataAttrs(read(file))).join('\n');
  assert('no_mojibake', !containsMojibake(mojibakeText), { mojibakeFiles });

  const phaseVisibleFiles = [
    files.operatorLayout,
    files.customerLayout,
    files.adminLayout,
    ...fieldRuntimeFiles,
  ];
  const phaseVisibleText = phaseVisibleFiles.map((file) => stripCommentsAndDataAttrs(read(file))).join('\n');
  assert('no_visible_engineering_phase_labels', lacksAll(phaseVisibleText, phaseTokens), { phaseVisibleFiles, phaseTokens });

  const navText = [files.operatorLayout, files.customerLayout, files.adminLayout].map((file) => stripCommentsAndDataAttrs(read(file))).join('\n');
  assert('no_formal_nav_pollution', lacksAll(navText, navPollution), { navPollution });

  const nonclaimText = [operatorLayout, read(files.fieldRuntimeVm), manifest, readiness].join('\n');
  assert('nonclaim_consistency', hasAll(nonclaimText, ['Replay-backed Demo', 'Live Device: Not connected', 'Production Gateway: Not online', 'Field Pilot: Not started', 'Controlled Execution: Disabled', 'read-only', 'Replay-backed demo remains replay-backed', 'No real-device deployment is claimed']), {});

  const result = {
    ok: true,
    acceptance: 'ACCEPTANCE_H67_FRONTEND_RELEASE_READINESS_V1',
    surfaces: {
      operator: 'pass',
      customer: 'pass',
      admin: 'pass',
    },
    route_topology: 'frozen',
    write_surface: 'not_introduced',
    release_readiness: 'frontend_runtime_console_v1_ready',
    changed_files_checked: diff,
    assertions,
  };
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    acceptance: 'ACCEPTANCE_H67_FRONTEND_RELEASE_READINESS_V1',
    error: error.message,
    details: error.details || null,
    assertions,
  }, null, 2));
  process.exit(1);
}
