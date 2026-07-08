// scripts/frontend_acceptance/ACCEPTANCE_PFA_3_RESPONSIVE_SHELL_OVERFLOW.cjs
'use strict';

const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.cwd();
const MATRIX_PATH = 'docs/frontend-acceptance/PFA-3-ROUTE-VIEWPORT-MATRIX.json';
const INVENTORY_PATH = 'docs/frontend-productization/PFE-13-ROUTE-INVENTORY.json';
const REQUIRED_DOCS = [
  'docs/frontend-acceptance/PFA-3-RESPONSIVE-CONTRACT.md',
  MATRIX_PATH,
  'docs/frontend-acceptance/PFA-3-OVERFLOW-EXCEPTION-REGISTER.md',
  'docs/frontend-acceptance/PFA-3-ISSUE-CLOSURE.md',
  'docs/frontend-acceptance/PFA-3-RUNTIME-EVIDENCE.md',
];
const REQUIRED_SOURCE = [
  'apps/web/src/components/layout/ProductMobileNavigation.tsx',
  'apps/web/src/design-system/product/ProductHorizontalScrollRegion.tsx',
  'apps/web/src/design-system/product/ProductDataTable.tsx',
  'apps/web/src/design-system/product/ProductPageShell.tsx',
  'apps/web/src/design-system/product/index.ts',
  'apps/web/src/layouts/CustomerLayout.tsx',
  'apps/web/src/layouts/OperatorLayout.tsx',
  'apps/web/src/layouts/AdminLayout.tsx',
  'apps/web/src/styles/productDesignSystem.css',
  'apps/web/src/styles/responsive.css',
  'scripts/frontend_acceptance/AUDIT_PFA_3_RUNTIME_RESPONSIVE_SHELL_OVERFLOW.cjs',
];
const ALLOWED_EXACT = new Set([
  ...REQUIRED_DOCS,
  ...REQUIRED_SOURCE,
  'scripts/frontend_acceptance/ACCEPTANCE_PFA_3_RESPONSIVE_SHELL_OVERFLOW.cjs',
  'apps/web/src/features/customer/pages/CustomerDashboardPage.tsx',
  'apps/web/src/styles/customerShell.css',
  'apps/web/src/styles/operatorShell.css',
  'apps/web/src/styles/adminShell.css',
  'apps/web/src/styles/operatorFieldRuntime.css',
  'apps/web/src/styles/operatorReplayDemo.css',
  'apps/web/src/styles/operatorPilotReadiness.css',
  'apps/web/src/lib/productSurfaceLabels.ts',
  'apps/web/src/lib/productCopy/localeContract.ts',
]);
const ALLOWED_PREFIXES = [
  'apps/web/src/features/operator/fieldRuntime/',
  'apps/web/src/features/operator/replayDemo/',
  'apps/web/src/features/operator/pilotReadiness/',
];
const FORBIDDEN_PREFIXES = [
  'apps/server/',
  'migrations/',
  'packages/contracts/',
  'fixtures/',
  '.github/',
  'apps/web/src/api/',
  'apps/web/src/app/routes/',
  'apps/web/src/viewmodels/',
  'apps/web/dist/',
  'docs/audit/',
];
const FORBIDDEN_EXACT = new Set([
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'apps/web/package.json',
]);
const assertions = [];

function repoPath(file) { return path.join(ROOT, file); }
function exists(file) { return fs.existsSync(repoPath(file)); }
function read(file) { return fs.readFileSync(repoPath(file), 'utf8'); }
function json(file) { return JSON.parse(read(file)); }
function runGit(args) {
  try { return cp.execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { return ''; }
}
function statusFiles() {
  const output = runGit(['status', '--short', '--untracked-files=all']);
  if (!output) return [];
  return output.split(/\r?\n/).map((line) => line.includes(' -> ')
    ? line.split(' -> ').pop().trim()
    : line.replace(/^[ MADRCU?!]{1,2}\s+/, '').trim()).filter(Boolean);
}
function changedFiles() {
  const output = runGit(['diff', '--name-only', 'origin/main...HEAD']) || runGit(['diff', '--name-only', 'main...HEAD']);
  return [...new Set([
    ...(output ? output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean) : []),
    ...statusFiles(),
  ])].sort();
}
function assert(name, passed, details = {}) {
  assertions.push({ name, passed: passed === true, details });
  if (passed !== true) {
    const error = new Error(`ASSERTION_FAILED:${name}`);
    error.details = details;
    throw error;
  }
  console.log('[pfa-3-responsive] ok:', name);
}
function allowed(file) { return ALLOWED_EXACT.has(file) || ALLOWED_PREFIXES.some((prefix) => file.startsWith(prefix)); }
function forbidden(file) { return FORBIDDEN_EXACT.has(file) || FORBIDDEN_PREFIXES.some((prefix) => file.startsWith(prefix)); }
function resolvedRecord(matrix, record) { return { ...matrix.resolvedRecordDefaults, ...record }; }
function routeSet(inventory) {
  return [...inventory.customer, ...inventory.operator, ...inventory.admin, inventory.supporting.find((item) => item.route === '/login')]
    .map((item) => item.route)
    .sort();
}
function cssSelectorViolations(css) {
  return [
    ...(css.match(/\[[^\]]*(?:aria-label|title)\s*=\s*["'][^"']+["'][^\]]*\]/gi) || []),
  ];
}
function overflowMaskingViolations(files) {
  const violations = [];
  const selector = '(?:html|body|#root|\\.productPageShell|\\.customerShell|\\.operatorShell|\\.adminShell)';
  const regex = new RegExp(`${selector}\\s*\\{[^}]*overflow-x\\s*:\\s*(?:hidden|clip)`, 'gi');
  for (const file of files) {
    const matches = read(file).match(regex);
    if (matches) violations.push({ file, matches });
  }
  return violations;
}

try {
  [...REQUIRED_DOCS, ...REQUIRED_SOURCE, INVENTORY_PATH].forEach((file) => assert(`exists:${file}`, exists(file), { file }));

  const changed = changedFiles();
  assert('changed_files_within_pfa3_scope', changed.length > 0 && changed.every(allowed), { changed });
  assert('forbidden_files_unchanged', changed.every((file) => !forbidden(file)), { changed });
  assert('no_generated_binaries', changed.every((file) => !/\.(png|jpe?g|webp|zip|tar|gz)$/i.test(file)), { changed });

  const matrix = json(MATRIX_PATH);
  const inventory = json(INVENTORY_PATH);
  const records = matrix.records.map((record) => resolvedRecord(matrix, record));
  const hard = records.filter((record) => record.routeClass !== 'export-deferred');
  const exports = records.filter((record) => record.routeClass === 'export-deferred');
  const inventoryRoutes = routeSet(inventory);
  const matrixRoutes = records.map((record) => record.route).sort();

  assert('matrix_model', matrix.version === 1 && matrix.recordModel === 'route-viewport-contract-v1');
  assert('matrix_derived_from_pfe13', matrix.sourceInventory === INVENTORY_PATH && JSON.stringify(matrixRoutes) === JSON.stringify(inventoryRoutes), { matrixRoutes, inventoryRoutes });
  assert('matrix_counts', records.length === 30 && hard.length === 27 && exports.length === 3, { records: records.length, hard: hard.length, exports: exports.length });
  assert('browser_case_accounting', matrix.hardRouteRenderCount === 162 && matrix.exportSmokeRenderCount === 6 && matrix.shellProbeCount === 12 && matrix.totalBrowserCaseCount === 180);
  assert('formal_locales_exact', JSON.stringify(matrix.supportedLocales) === JSON.stringify(['zh-CN', 'en-US']));
  assert('formal_viewports_exact', JSON.stringify(Object.keys(matrix.formalViewports)) === JSON.stringify(['mobileNarrow', 'laptopReview', 'desktopReview']));
  assert('shell_probe_expectations', matrix.shellProbes.compactTablet?.expectation === 'compact' && matrix.shellProbes.laptopBoundary?.expectation === 'desktop');
  assert('hard_records_complete', hard.every((record) => record.concreteAuditPath?.startsWith('/') && record.locales?.length === 2 && record.viewports?.length === 3 && record.documentOverflowAllowed === false && Array.isArray(record.requiredSelectors) && typeof record.mobileNavigationRequired === 'boolean'));
  assert('hard_statuses_valid', hard.every((record) => ['ready-for-runtime', 'runtime-pass'].includes(record.status)), { statuses: [...new Set(hard.map((record) => record.status))] });
  assert('exports_deferred', exports.every((record) => record.status === 'export-deferred' && record.viewports.length === 1 && record.viewports[0] === 'desktopReview'));
  assert('no_planned_pending_capture_gap', records.every((record) => !['planned', 'pending', 'capture-gap'].includes(record.status)));
  assert('owned_findings_registered', ['PFA0-RWD-001', 'PFA0-NAV-001', 'PFA0-OPR-002', 'PFA0-OPR-005'].every((id) => read('docs/frontend-acceptance/PFA-3-ISSUE-CLOSURE.md').includes(id)));
  const closureClaimsClosed = /\|\s*closed\s*\|/i.test(read('docs/frontend-acceptance/PFA-3-ISSUE-CLOSURE.md'));
  assert('closed_issues_require_runtime_pass', !closureClaimsClosed || hard.every((record) => record.status === 'runtime-pass'), { closureClaimsClosed, statuses: [...new Set(hard.map((record) => record.status))] });

  const mobileNav = read('apps/web/src/components/layout/ProductMobileNavigation.tsx');
  const horizontal = read('apps/web/src/design-system/product/ProductHorizontalScrollRegion.tsx');
  const dataTable = read('apps/web/src/design-system/product/ProductDataTable.tsx');
  const pageShell = read('apps/web/src/design-system/product/ProductPageShell.tsx');
  const layouts = ['CustomerLayout.tsx', 'OperatorLayout.tsx', 'AdminLayout.tsx'].map((file) => read(`apps/web/src/layouts/${file}`));
  const responsive = read('apps/web/src/styles/responsive.css');
  const productCss = read('apps/web/src/styles/productDesignSystem.css');

  assert('mobile_navigation_contract', ['aria-expanded', 'aria-controls', 'Escape', 'pathname', 'triggerRef', 'hidden={!open}', 'data-mobile-navigation'].every((token) => mobileNav.includes(token)));
  assert('all_role_layouts_use_mobile_navigation', layouts.every((text) => text.includes('ProductMobileNavigation') && text.includes('data-layout-key=') && text.includes('data-desktop-sidebar="true"')));
  assert('horizontal_region_contract', ['role="region"', 'aria-label={ariaLabel}', 'tabIndex={0}', 'data-horizontal-scroll-region="true"', 'data-overflow-owner={overflowOwner}'].every((token) => horizontal.includes(token)));
  assert('product_data_table_uses_shared_region', dataTable.includes('ProductHorizontalScrollRegion') && dataTable.includes('overflowOwner'));
  assert('page_shell_stable_hook', pageShell.includes('pageKey?: string') && pageShell.includes('data-page-key={stablePageKey}'));
  assert('responsive_compact_breakpoint', responsive.includes('@media (max-width: 960px)') && responsive.includes('.productShellDesktopSidebar') && responsive.includes('.productMobileNavigation'));
  assert('dashboard_uses_stable_page_key', read('apps/web/src/features/customer/pages/CustomerDashboardPage.tsx').includes('pageKey="customer-dashboard"') && responsive.includes('[data-page-key="customer-dashboard"]'));
  assert('no_localized_css_selectors', cssSelectorViolations(responsive + '\n' + productCss).length === 0, { violations: cssSelectorViolations(responsive + '\n' + productCss) });
  assert('no_root_or_shell_overflow_masking', overflowMaskingViolations(['apps/web/src/styles/responsive.css', 'apps/web/src/styles/productDesignSystem.css', 'apps/web/src/styles/customerShell.css', 'apps/web/src/styles/operatorShell.css', 'apps/web/src/styles/adminShell.css']).length === 0);
  assert('no_break_all', !/word-break\s*:\s*break-all/i.test(responsive + '\n' + productCss));
  assert('technical_token_strategy', responsive.includes('[data-long-token="true"]') && responsive.includes('overflow-wrap: anywhere'));
  assert('ordinary_copy_strategy', responsive.includes('overflow-wrap: break-word') && responsive.includes('word-break: normal'));
  assert('pfa2_locale_contract_preserved', exists('scripts/frontend_acceptance/ACCEPTANCE_PFA_2_LOCALE_CONTRACT.cjs') && read('docs/frontend-acceptance/PFA-2-RUNTIME-EVIDENCE.md').includes('RuntimeTextGuard dependency: 0'));

  console.log(JSON.stringify({
    ok: true,
    acceptance: 'ACCEPTANCE_PFA_3_RESPONSIVE_SHELL_OVERFLOW',
    routes: { total: records.length, hard: hard.length, exports: exports.length },
    browserCases: { hard: matrix.hardRouteRenderCount, exportSmoke: matrix.exportSmokeRenderCount, shellProbes: matrix.shellProbeCount, total: matrix.totalBrowserCaseCount },
    statuses: [...new Set(records.map((record) => record.status))],
    changedFiles: changed,
    assertions,
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, acceptance: 'ACCEPTANCE_PFA_3_RESPONSIVE_SHELL_OVERFLOW', error: error.message, details: error.details || null, assertions }, null, 2));
  process.exit(1);
}
