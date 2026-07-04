// scripts/frontend_acceptance/ACCEPTANCE_H65_ADMIN_CONSOLE_CLEANUP_V1.cjs
'use strict';

const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();

const files = {
  app: 'apps/web/src/app/App.tsx',
  layout: 'apps/web/src/layouts/AdminLayout.tsx',
  css: 'apps/web/src/styles/adminShell.css',
  doc: 'docs/frontend-productization/H65-ADMIN-CONSOLE-CLEANUP.md',
  acceptance: 'scripts/frontend_acceptance/ACCEPTANCE_H65_ADMIN_CONSOLE_CLEANUP_V1.cjs',
};

const allow = [
  /^apps\/web\/src\/layouts\/AdminLayout\.tsx$/,
  /^apps\/web\/src\/app\/App\.tsx$/,
  /^apps\/web\/src\/styles\/adminShell\.css$/,
  /^apps\/web\/src\/lib\/adminLabels\.ts$/,
  /^apps\/web\/src\/features\/admin\/pages\//,
  /^docs\/frontend-productization\/H65-ADMIN-CONSOLE-CLEANUP\.md$/,
  /^scripts\/frontend_acceptance\/ACCEPTANCE_H65_ADMIN_CONSOLE_CLEANUP_V1\.cjs$/,
];

const block = [
  /^apps\/web\/src\/layouts\/CustomerLayout\.tsx$/,
  /^apps\/web\/src\/lib\/customerLabels\.ts$/,
  /^apps\/web\/src\/views\/CustomerDashboardPage\.tsx$/,
  /^apps\/web\/src\/features\/customer\//,
  /^apps\/web\/src\/features\/operator\//,
  /^apps\/web\/src\/layouts\/OperatorLayout\.tsx$/,
  /^apps\/server\//,
  /^migrations\//,
  /^packages\/contracts\//,
  /^fixtures\//,
  /^\.github\//,
  /^package\.json$/,
  /^pnpm-lock\.yaml$/,
  /^pnpm-workspace\.yaml$/,
];

const readableNavLabels = ['Dashboard', 'Fields', 'Operations', 'Devices', 'Evidence', 'Runtime Health', 'Config'];
const assertions = [];

function read(file) { return fs.readFileSync(path.join(root, file), 'utf8'); }
function exists(file) { return fs.existsSync(path.join(root, file)); }
function hasAll(content, tokens) { return tokens.every((token) => content.includes(token)); }
function lacksAll(content, tokens) { return tokens.every((token) => !content.includes(token)); }
function assert(name, passed, details = {}) {
  assertions.push({ name, passed: passed === true, details });
  if (passed !== true) {
    const error = new Error('ASSERTION_FAILED:' + name);
    error.details = details;
    throw error;
  }
  console.log('[h65-admin-cleanup] ok:', name);
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
function runtimeChangedFiles(diff) {
  return diff.filter((file) => (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.css')) && !file.includes('/frontend_acceptance/'));
}
function extractAdminNavLabels(layout) {
  return [...layout.matchAll(/label: "([^"]+)"/g)].map((match) => match[1]);
}
function isReadableAsciiLabel(label) {
  return /^[A-Za-z][A-Za-z ]*$/.test(label);
}

try {
  Object.entries(files).forEach(([key, file]) => assert(key + '_exists', exists(file), { file }));
  const diff = changedFiles();
  assert('changed_files_allowlist', diff.length === 0 || diff.every((file) => matchesAny(file, allow)), { diff });
  assert('blocked_files_unchanged', diff.every((file) => !matchesAny(file, block)), { diff });

  const app = read(files.app);
  const layout = read(files.layout);
  const css = read(files.css);
  const doc = read(files.doc);

  assert('admin_layout_independent_shell', lacksAll(layout, ['AppShell', '../app/AppShell', 'return <AppShell']) && hasAll(layout, [
    'adminShell',
    'adminShellSidebar',
    'adminShellNav',
    'adminShellTopbar',
    'adminLayoutMain',
    'Admin Console',
    'Internal governance surface',
    'Read-only shell boundary',
  ]), { file: files.layout });

  assert('admin_layout_imports_css', layout.includes('adminShell.css'), { file: files.layout });
  assert('admin_nav_productized_routes', hasAll(layout, ['/admin/dashboard', '/admin/fields', '/admin/operations', '/admin/devices', '/admin/evidence', '/admin/healthz', '/admin/skills']), { file: files.layout });

  const navLabels = extractAdminNavLabels(layout);
  assert('admin_nav_readable_labels', readableNavLabels.every((label) => navLabels.includes(label)) && navLabels.every(isReadableAsciiLabel), { navLabels, readableNavLabels });

  assert('admin_nav_no_url_only_or_cross_shell_routes', lacksAll(layout, ['/admin/import', '/admin/operations/:operationId/debug', '/legacy/admin', '/customer', '/operator']), { file: files.layout });
  assert('app_admin_route_topology_preserved', hasAll(app, ['path="/admin/*"', 'RequireSession', 'AdminShell', 'path="dashboard"', 'path="fields"', 'path="operations"', 'path="devices"', 'path="alerts"', 'path="evidence"', 'path="skills"', 'path="acceptance"', 'path="healthz"', 'path="import"', 'path="operations/:operationId/debug"']), { file: files.app });

  const runtimeFiles = runtimeChangedFiles(diff);
  const runtimeText = runtimeFiles.map((file) => read(file)).join('\n');
  assert('no_backend_or_write_surface', lacksAll(runtimeText, ['POST', 'PUT', 'PATCH', 'DELETE', '/api/control', '/api/control/ao_act', 'createAoActTask', 'dispatchTask', 'writeFact', 'approve', 'approval', 'roiWriter', 'fieldMemoryWriter']), { runtimeFiles });
  assert('css_has_admin_shell_classes', hasAll(css, ['.adminShell', '.adminShellSidebar', '.adminShellNav', '.adminShellNavItem', '.adminShellTopbar', '.adminShellTitle', '.adminLayoutMain']), { file: files.css });
  assert('css_no_cross_shell_or_status_leak', lacksAll(css, ['customerShell', 'operatorShell', 'risk-red', 'danger', 'dispatch-active', 'ao-act-ready']), { file: files.css });
  assert('doc_records_h65_scope', hasAll(doc, ['H65 cleans Admin Console only.', 'AdminLayout no longer delegates to AppShell.', 'AdminLayout owns independent Admin Console shell.', 'Admin route topology remains unchanged.', 'Alerts / acceptance / import / debug remain URL-only', 'H65 does not change Customer Portal.', 'H65 does not change Operator Runtime Console.', 'H65 does not modify backend, DB, contracts, fixtures, packages.']), { file: files.doc });

  console.log(JSON.stringify({ ok: true, acceptance: 'ACCEPTANCE_H65_ADMIN_CONSOLE_CLEANUP_V1', changed_files_checked: diff, assertions }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, acceptance: 'ACCEPTANCE_H65_ADMIN_CONSOLE_CLEANUP_V1', error: error.message, details: error.details || null, assertions }, null, 2));
  process.exit(1);
}
