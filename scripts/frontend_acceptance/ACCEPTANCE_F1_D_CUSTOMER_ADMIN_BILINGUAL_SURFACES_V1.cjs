// scripts/frontend_acceptance/ACCEPTANCE_F1_D_CUSTOMER_ADMIN_BILINGUAL_SURFACES_V1.cjs
'use strict';

const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const F1C_ACCEPTED_HEAD = '4386faa1cce604d383f288da5156c6b9a0b95885';

const files = {
  doc: 'docs/frontend-productization/F1-D-CUSTOMER-ADMIN-BILINGUAL-SURFACES.md',
  acceptance: 'scripts/frontend_acceptance/ACCEPTANCE_F1_D_CUSTOMER_ADMIN_BILINGUAL_SURFACES_V1.cjs',
  customerDashboard: 'apps/web/src/views/CustomerDashboardPage.tsx',
  customerFields: 'apps/web/src/views/CustomerFieldsIndexPage.tsx',
  customerOperations: 'apps/web/src/views/CustomerOperationsIndexPage.tsx',
  customerReports: 'apps/web/src/views/CustomerReportsCenterPage.tsx',
  customerExport: 'apps/web/src/views/CustomerReportExportPage.tsx',
  customerDashboardExport: 'apps/web/src/views/CustomerDashboardExportPage.tsx',
  fieldReport: 'apps/web/src/views/FieldReportPage.tsx',
  fieldReportExport: 'apps/web/src/views/FieldReportExportPage.tsx',
  operationReport: 'apps/web/src/views/OperationReportPage.tsx',
  operationReportExport: 'apps/web/src/views/OperationReportExportPage.tsx',
  adminDashboard: 'apps/web/src/features/admin/pages/AdminDashboardPage.tsx',
  adminFields: 'apps/web/src/features/admin/pages/AdminFieldsPage.tsx',
  adminOperations: 'apps/web/src/features/admin/pages/AdminOperationsPage.tsx',
  adminDevices: 'apps/web/src/features/admin/pages/AdminDevicesPage.tsx',
  adminEvidence: 'apps/web/src/features/admin/pages/AdminEvidencePage.tsx',
  adminHealthz: 'apps/web/src/features/admin/pages/AdminHealthzPage.tsx',
  adminSkills: 'apps/web/src/features/admin/pages/AdminSkillsPage.tsx',
};

const allowedExact = new Set([
  files.doc, files.acceptance,
  files.customerDashboard, files.customerFields, files.customerOperations, files.customerReports, files.customerExport, files.customerDashboardExport,
  files.fieldReport, files.fieldReportExport, files.operationReport, files.operationReportExport,
  'apps/web/src/features/customer/pages/CustomerReportExportPage.tsx',
  'apps/web/src/features/fields/pages/FieldReportPage.tsx',
  'apps/web/src/features/fields/pages/FieldReportExportPage.tsx',
  'apps/web/src/features/operations/pages/OperationReportPage.tsx',
  'apps/web/src/features/operations/pages/OperationReportExportPage.tsx',
  files.adminDashboard, files.adminFields, files.adminOperations, files.adminDevices, files.adminEvidence,
  'apps/web/src/features/admin/pages/AdminHealthPage.tsx', files.adminHealthz, files.adminSkills,
  'apps/web/src/lib/customerLabels.ts', 'apps/web/src/lib/productSurfaceLabels.ts', 'apps/web/src/styles/customerShell.css', 'apps/web/src/styles/adminShell.css',
]);
const allowedPrefixes = ['apps/web/src/features/customer/pages/', 'apps/web/src/features/admin/pages/'];
const blockedPrefixes = ['apps/web/src/app/routes/', 'apps/web/src/layouts/', 'apps/web/src/features/operator/', 'apps/web/src/views/DevToolsPage.tsx', 'apps/server/', 'migrations/', 'packages/contracts/', 'fixtures/', '.github/'];
const blockedExact = new Set(['apps/web/src/app/App.tsx', 'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml']);
const cssForbidden = ['live-online', 'production-online', 'dispatch-enabled', 'ao-act-ready', 'roi-ready', 'field-memory-ready', 'risk-red', 'success-green', 'warning-yellow'];
const mojibake = ['鎬', '鍦', '浣', '璁', '杩', '閰', '绠', '瀵', '艰', '鍚', '彴', '潡', '惧', '悍', '嵁', '�'];
const phaseLabels = ['H58', 'H59', 'H60', 'H61', 'H62', 'H63', 'H64', 'H65', 'H66', 'H67', 'F0', 'F1', 'P51', 'P52', 'P53', 'P54', 'P55', 'P56', 'P57', 'TK', 'fixture'];
const assertions = [];

function p(file) { return path.join(root, file); }
function exists(file) { return fs.existsSync(p(file)); }
function read(file) { return fs.readFileSync(p(file), 'utf8'); }
function ok(name, passed, details = {}) {
  assertions.push({ name, passed: passed === true, details });
  if (!passed) {
    const error = new Error('ASSERTION_FAILED:' + name);
    error.details = details;
    throw error;
  }
  console.log('[f1-d-customer-admin-bilingual-surfaces] ok:', name);
}
function diffFiles() {
  return cp.execFileSync('git', ['diff', '--name-only', `${F1C_ACCEPTED_HEAD}...HEAD`], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}
function allowed(file) { return allowedExact.has(file) || allowedPrefixes.some((prefix) => file.startsWith(prefix)); }
function blocked(file) { return blockedExact.has(file) || blockedPrefixes.some((prefix) => file.startsWith(prefix)); }
function includesAll(text, tokens) { return tokens.every((token) => text.includes(token)); }
function hits(text, tokens) { return tokens.filter((token) => text.includes(token)); }
function stripNonVisible(text) { return text.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/import[\s\S]*?;\n/g, '').replace(/data-[\w-]+="[^"]*"/g, ''); }
function standaloneHits(text, tokens) { return tokens.filter((token) => new RegExp(`(^|[^A-Za-z0-9_])${String(token).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^A-Za-z0-9_]|$)`).test(text)); }
function isUiFile(file) { return (file.endsWith('.tsx') || file.endsWith('.ts')) && !file.startsWith('docs/'); }
function usesLocale(file) { const text = read(file); return text.includes('useLocale') && text.includes('localizedText'); }
function noTemporaryInlineBilingual(file) { return !/[A-Za-z][A-Za-z ]+\s\/\s[\u4e00-\u9fff]/.test(stripNonVisible(read(file))); }

try {
  Object.values(files).forEach((file) => ok('exists:' + file, exists(file), { file }));
  const diff = diffFiles();
  ok('changed_files_allowlist_from_f1c_base', diff.length > 0 && diff.every(allowed), { diff, base: F1C_ACCEPTED_HEAD });
  ok('blocked_files_unchanged', diff.every((file) => !blocked(file)), { diff });
  ok('route_topology_unchanged', diff.every((file) => file !== 'apps/web/src/app/App.tsx' && !file.startsWith('apps/web/src/app/routes/')), { diff });
  ok('operator_unchanged', diff.every((file) => !file.startsWith('apps/web/src/features/operator/') && file !== 'apps/web/src/layouts/OperatorLayout.tsx'), { diff });
  ok('backend_package_unchanged', diff.every((file) => !file.startsWith('apps/server/') && !file.startsWith('migrations/') && !file.startsWith('packages/contracts/') && !file.startsWith('fixtures/') && !['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml'].includes(file)), { diff });

  const fullCustomer = [files.customerDashboard, files.customerFields, files.customerOperations, files.customerReports, files.customerExport, files.customerDashboardExport, files.fieldReport, files.fieldReportExport, files.operationReport, files.operationReportExport];
  const adminPages = [files.adminDashboard, files.adminFields, files.adminOperations, files.adminDevices, files.adminEvidence, files.adminHealthz, files.adminSkills];
  ok('full_scope_customer_pages_use_locale_helpers', fullCustomer.every(usesLocale), { missing: fullCustomer.filter((file) => !usesLocale(file)) });
  ok('formal_admin_pages_use_locale_helpers', adminPages.every(usesLocale), { missing: adminPages.filter((file) => !usesLocale(file)) });
  ok('formal_admin_no_temporary_inline_bilingual_copy', adminPages.every(noTemporaryInlineBilingual), { hits: adminPages.filter((file) => !noTemporaryInlineBilingual(file)) });

  const doc = read(files.doc);
  const changedText = diff.filter(exists).map(read).join('\n');
  const uiText = diff.filter((file) => exists(file) && isUiFile(file)).map((file) => stripNonVisible(read(file))).join('\n');
  ok('customer_bilingual_coverage', includesAll(changedText + doc, ['Dashboard', 'Fields', 'Field Report', 'Operations', 'Operation Report', 'Reports', 'Export', 'No authorized fields', 'Authorized scope', 'Report', 'Download', 'Unavailable', '经营总览', '地块', '地块报告', '作业', '作业报告', '报告', '导出', '暂无授权地块', '授权范围', '下载', '不可用']));
  ok('admin_bilingual_coverage', includesAll(changedText + doc, ['Dashboard', 'Fields', 'Operations', 'Devices', 'Evidence', 'Runtime Health', 'Config', 'Skills', 'Readback', 'Unavailable', 'Internal governance', '总览', '地块', '作业', '设备', '证据', '运行健康', '配置', '技能', '回查', '不可用', '内部治理']));
  ok('raw_source_text_boundary_documented', includesAll(doc, ['route paths', 'source identifiers', 'fact IDs', 'trace IDs', 'commit hashes', 'acceptance script names', 'raw evidence payload', 'raw source labels', 'enum values', 'backend-returned domain object values']));
  ok('no_mojibake_in_f1d_files', diff.filter(exists).filter((file) => file !== files.acceptance).map((file) => ({ file, hits: hits(read(file), mojibake) })).filter((entry) => entry.hits.length > 0).length === 0);
  ok('visible_engineering_phase_labels_absent', standaloneHits(uiText, phaseLabels).length === 0, { hits: standaloneHits(uiText, phaseLabels) });
  ok('css_runtime_status_tokens_absent', hits(diff.filter((file) => file.endsWith('.css') && exists(file)).map(read).join('\n'), cssForbidden).length === 0);
  ok('doc_required_sections_present', includesAll(doc, ['Phase', 'Purpose', 'Preconditions', 'Allowed files', 'Forbidden files', 'Customer surface scope', 'Admin surface scope', 'Customer internal-leakage boundary', 'Admin formal-nav pollution boundary', 'Raw/source text boundary', 'Bilingual copy governance', 'Acceptance', 'Non-goals', 'Next phase']));
  ok('doc_no_partial_slice_language', !/partial slice|legacy Customer report renderers remain|not full F1-D/i.test(doc));

  console.log(JSON.stringify({ ok: true, acceptance: 'ACCEPTANCE_F1_D_CUSTOMER_ADMIN_BILINGUAL_SURFACES_V1', phase: 'F1-D Customer / Admin Formal Surface Bilingualization', surfaces: { customer: 'full-scope-bilingual', admin: 'full-scope-bilingual' }, raw_source_text: 'preserved', route_topology_changed: false, backend_changed: false, package_changed: false, next: 'F2-A Accessibility Baseline', changed_files_checked: diff, assertions }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, acceptance: 'ACCEPTANCE_F1_D_CUSTOMER_ADMIN_BILINGUAL_SURFACES_V1', error: error.message, details: error.details || null, assertions }, null, 2));
  process.exit(1);
}
