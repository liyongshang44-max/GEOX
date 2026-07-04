// scripts/frontend_acceptance/ACCEPTANCE_H64_CUSTOMER_PORTAL_CLEANUP_V1.cjs
'use strict';

const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();

const files = {
  app: 'apps/web/src/app/App.tsx',
  layout: 'apps/web/src/layouts/CustomerLayout.tsx',
  labels: 'apps/web/src/lib/customerLabels.ts',
  dashboard: 'apps/web/src/views/CustomerDashboardPage.tsx',
  doc: 'docs/frontend-productization/H64-CUSTOMER-PORTAL-CLEANUP.md',
  acceptance: 'scripts/frontend_acceptance/ACCEPTANCE_H64_CUSTOMER_PORTAL_CLEANUP_V1.cjs',
};

const allow = [
  /^apps\/web\/src\/layouts\/CustomerLayout\.tsx$/,
  /^apps\/web\/src\/lib\/customerLabels\.ts$/,
  /^apps\/web\/src\/styles\/customerShell\.css$/,
  /^apps\/web\/src\/views\/CustomerDashboardPage\.tsx$/,
  /^apps\/web\/src\/viewmodels\/customerDashboardVm\.ts$/,
  /^apps\/web\/src\/components\/cockpit\//,
  /^apps\/web\/src\/components\/customer\//,
  /^docs\/frontend-productization\/H64-CUSTOMER-PORTAL-CLEANUP\.md$/,
  /^scripts\/frontend_acceptance\/ACCEPTANCE_H64_CUSTOMER_PORTAL_CLEANUP_V1\.cjs$/,
];

const block = [
  /^apps\/web\/src\/app\/App\.tsx$/,
  /^apps\/web\/src\/app\/routes\/fieldsRoutes\.tsx$/,
  /^apps\/web\/src\/app\/routes\/customerOperationsRoutes\.tsx$/,
  /^apps\/web\/src\/features\/operator\//,
  /^apps\/web\/src\/layouts\/OperatorLayout\.tsx$/,
  /^apps\/web\/src\/layouts\/AdminLayout\.tsx$/,
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

function read(file) { return fs.readFileSync(path.join(root, file), 'utf8'); }
function exists(file) { return fs.existsSync(path.join(root, file)); }
function hasAll(text, tokens) { return tokens.every((token) => text.includes(token)); }
function lacksAll(text, tokens) { return tokens.every((token) => !text.includes(token)); }
function matchesAny(file, patterns) { return patterns.some((pattern) => pattern.test(file)); }
function assert(name, passed, details = {}) {
  assertions.push({ name, passed: passed === true, details });
  if (passed !== true) {
    const error = new Error('ASSERTION_FAILED:' + name);
    error.details = details;
    throw error;
  }
  console.log('[h64-customer-cleanup] ok:', name);
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
function shellLabelsBlock(labels) {
  const start = labels.indexOf('export const CUSTOMER_SHELL_LABELS');
  const end = labels.indexOf('export const CUSTOMER_LABELS');
  return start >= 0 && end > start ? labels.slice(start, end) : '';
}

try {
  Object.entries(files).forEach(([key, file]) => assert(key + '_exists', exists(file), { file }));

  const diff = changedFiles();
  assert('changed_files_allowlist', diff.length === 0 || diff.every((file) => matchesAny(file, allow)), { diff });
  assert('blocked_files_unchanged', diff.every((file) => !matchesAny(file, block)), { diff });

  const app = read(files.app);
  const layout = read(files.layout);
  const labels = read(files.labels);
  const dashboard = read(files.dashboard);
  const doc = read(files.doc);
  const shellLabels = shellLabelsBlock(labels);

  assert('layout_has_no_pathname_substitution', lacksAll(layout, [
    'CustomerFieldsIndexPage',
    'CustomerOperationsIndexPage',
    'CustomerReportsCenterPage',
    'mainContent',
    'location.pathname === "/customer/fields" ?',
    'location.pathname === "/customer/operations" ?',
    'location.pathname === "/customer/reports" ?',
  ]), { file: files.layout });

  assert('layout_renders_children_only', layout.includes('<main className="customerLayoutMain">{children}</main>'), { file: files.layout });

  assert('legacy_index_redirects_preserved', hasAll(layout, [
    '/customer/fields/index',
    '/customer/operations/index',
    'to="/customer/fields"',
    'to="/customer/operations"',
  ]), { file: files.layout });

  assert('export_print_shell_preserved', hasAll(layout, [
    'isExportRoute',
    'customerLayoutPrintOnly',
    '/customer/export',
    'endsWith("/export")',
  ]), { file: files.layout });

  assert('customer_nav_routes', hasAll(layout, [
    '/customer/dashboard',
    '/customer/fields',
    '/customer/operations',
    '/customer/reports',
    '/customer/export',
  ]), { file: files.layout });

  assert('customer_nav_no_forbidden_routes', lacksAll(layout, [
    '/customer/evidence-summary',
    '/customer/dispatch',
    '/customer/audit',
    '/customer/admin',
    '/customer/debug',
    '/customer/roi',
    '/customer/field-memory',
    '/customer/approval',
    '/customer/control',
  ]), { file: files.layout });

  assert('customer_shell_copy_safe', lacksAll(layout, [
    '审批',
    '派单',
    '调度',
    'AO-ACT',
    'debug',
    'audit',
    '内部',
    'ROI Ledger',
    'Field Memory',
  ]), { file: files.layout });

  assert('customer_shell_labels_safe', hasAll(shellLabels, [
    'navDashboard: "总览"',
    'navFields: "地块"',
    'navOperations: "作业"',
    'navReports: "报告"',
    'navExport: "导出"',
    'shellRole: "客户门户"',
    'sidebarFooter: "客户可见报告与授权范围"',
  ]) && lacksAll(shellLabels, ['审批', '派单', '调度', 'AO-ACT', 'debug', 'audit', '内部', 'ROI Ledger', 'Field Memory']), { file: files.labels });

  assert('customer_route_table_preserved', hasAll(app, [
    'path="/customer/*"',
    'CustomerShell',
    'path="dashboard"',
    'path="export"',
    'path="fields"',
    'path="fields/:fieldId"',
    'path="fields/:fieldId/export"',
    'path="operations"',
    'path="operations/:operationId"',
    'path="operations/:operationId/export"',
    'path="reports"',
  ]), { file: files.app });

  assert('dashboard_customer_copy_safe', lacksAll(dashboard, [
    'AO-ACT',
    'dispatch',
    '派单',
    '审批',
    'debug',
    'audit',
    'ROI Ledger',
    'Field Memory',
    '内部',
  ]), { file: files.dashboard });

  assert('customer_shell_has_no_write_surface', lacksAll(layout + '\n' + dashboard, [
    'POST',
    'PUT',
    'PATCH',
    'DELETE',
    '/api/control',
    '/api/control/ao_act',
    'createAoActTask',
    'dispatchTask',
    'writeFact',
    'approve',
    'approval',
    'roiWriter',
    'fieldMemoryWriter',
  ]), { files: [files.layout, files.dashboard] });

  assert('doc_records_h64_scope', hasAll(doc, [
    'H64 cleans Customer Portal only.',
    'Customer route table owns page selection.',
    'CustomerLayout no longer substitutes children by pathname.',
    'CustomerLayout remains shell-only.',
    'Evidence Summary route is not introduced in H64.',
    'H64 does not change App route topology.',
    'H64 does not modify backend, DB, contracts, fixtures, packages, Operator Console, or Admin Console.',
  ]), { file: files.doc });

  console.log(JSON.stringify({ ok: true, acceptance: 'ACCEPTANCE_H64_CUSTOMER_PORTAL_CLEANUP_V1', changed_files_checked: diff, assertions }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, acceptance: 'ACCEPTANCE_H64_CUSTOMER_PORTAL_CLEANUP_V1', error: error.message, details: error.details || null, assertions }, null, 2));
  process.exit(1);
}
