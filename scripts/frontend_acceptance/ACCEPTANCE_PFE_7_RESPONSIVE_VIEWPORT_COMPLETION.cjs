// scripts/frontend_acceptance/ACCEPTANCE_PFE_7_RESPONSIVE_VIEWPORT_COMPLETION.cjs
'use strict';

const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const docs = [
  'docs/frontend-productization/PFE-7-RESPONSIVE-VIEWPORT-COMPLETION.md',
  'docs/frontend-productization/PFE-7-VIEWPORT-MATRIX.md',
  'docs/frontend-productization/PFE-7-ROUTE-VIEWPORT-WALKTHROUGH.md',
  'docs/frontend-productization/PFE-7-RESPONSIVE-ISSUE-REGISTER.md',
];
const sourceBaselineDocs = [
  'docs/frontend-productization/PFE-6-ACCESSIBILITY-KEYBOARD-COMPLIANCE.md',
  'docs/frontend-productization/PFE-6-ACCESSIBILITY-MATRIX.md',
];
const styleFiles = [
  'apps/web/src/styles.css',
  'apps/web/src/styles/responsive.css',
  'apps/web/src/styles/productDesignSystem.css',
  'apps/web/src/styles/accessibility.css',
  'apps/web/src/styles/customerShell.css',
  'apps/web/src/styles/customerDashboard.css',
  'apps/web/src/styles/operatorFieldRuntime.css',
  'apps/web/src/styles/operatorReplayDemo.css',
  'apps/web/src/styles/operatorPilotReadiness.css',
  'apps/web/src/styles/adminShell.css',
  'apps/web/src/styles/adminControlPlane.css',
  'apps/web/src/styles/reportPrint.css',
];
const changedStyleFiles = [
  'apps/web/src/styles.css',
  'apps/web/src/styles/responsive.css',
  'apps/web/src/styles/customerShell.css',
  'apps/web/src/styles/customerDashboard.css',
  'apps/web/src/styles/adminShell.css',
];
const acceptanceFile = 'scripts/frontend_acceptance/ACCEPTANCE_PFE_7_RESPONSIVE_VIEWPORT_COMPLETION.cjs';
const allowedChangedFiles = new Set([
  ...docs,
  acceptanceFile,
  'apps/web/src/styles.css',
  'apps/web/src/styles/responsive.css',
  'apps/web/src/styles/customerShell.css',
  'apps/web/src/styles/customerDashboard.css',
  'apps/web/src/styles/adminShell.css',
]);
const assertions = [];

function repoPath(file) { return path.join(root, file); }
function exists(file) { return fs.existsSync(repoPath(file)); }
function read(file) { return fs.readFileSync(repoPath(file), 'utf8'); }
function lower(value) { return String(value).toLowerCase(); }
function includesAll(text, tokens) { const haystack = lower(text); return tokens.every((token) => haystack.includes(lower(token))); }
function assert(name, passed, details = {}) { assertions.push({ name, passed: passed === true, details }); if (passed !== true) { const error = new Error('ASSERTION_FAILED:' + name); error.details = details; throw error; } console.log('[pfe-7-responsive-viewport-completion] ok:', name); }
function runGit(args) { try { return cp.execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch (_error) { return ''; } }
function statusFiles() { const output = runGit(['status', '--short', '--untracked-files=all']); if (!output) return []; return output.split(/\r?\n/).map((line) => { if (!line.trim()) return ''; const arrow = line.indexOf(' -> '); if (arrow >= 0) return line.slice(arrow + 4).trim(); return line.replace(/^[ MADRCU?!]{1,2}\s+/, '').trim(); }).filter(Boolean); }
function changedFiles() { const set = new Set(); const output = runGit(['diff', '--name-only', 'origin/main...HEAD']) || runGit(['diff', '--name-only', 'main...HEAD']); if (output) output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).forEach((file) => set.add(file)); statusFiles().forEach((file) => set.add(file)); return Array.from(set).sort(); }
function combined(files) { return files.map(read).join('\n'); }
function regexViolations(files, regex) { return files.flatMap((file) => { const text = read(file); const matches = text.match(regex); return matches ? [{ file, matches }] : []; }); }

try {
  [...docs, ...sourceBaselineDocs, ...styleFiles, acceptanceFile].forEach((file) => assert('exists:' + file, exists(file), { file }));

  const diff = changedFiles();
  const docText = combined(docs);
  const responsiveCss = read('apps/web/src/styles/responsive.css');
  const stylesCss = read('apps/web/src/styles.css');
  const productCss = read('apps/web/src/styles/productDesignSystem.css') + '\n' + responsiveCss;
  const customerCss = read('apps/web/src/styles/customerShell.css') + '\n' + read('apps/web/src/styles/customerDashboard.css') + '\n' + responsiveCss;
  const operatorCss = read('apps/web/src/styles/operatorFieldRuntime.css') + '\n' + read('apps/web/src/styles/operatorReplayDemo.css') + '\n' + responsiveCss;
  const adminCss = read('apps/web/src/styles/adminShell.css') + '\n' + read('apps/web/src/styles/adminControlPlane.css') + '\n' + responsiveCss;
  const reportPrintCss = read('apps/web/src/styles/reportPrint.css');
  const accessibilityCss = read('apps/web/src/styles/accessibility.css');
  const changedCssText = combined(changedStyleFiles);

  const customerRoutes = ['/customer/dashboard', '/customer/fields', '/customer/fields/:fieldId', '/customer/fields/:fieldId/export', '/customer/operations', '/customer/operations/:operationId', '/customer/operations/:operationId/export', '/customer/reports', '/customer/export'];
  const operatorRoutes = ['/operator/twin', '/operator/fields', '/operator/fields/:fieldId', '/operator/fields/:fieldId/state', '/operator/fields/:fieldId/evidence', '/operator/fields/:fieldId/forecast', '/operator/fields/:fieldId/scenario', '/operator/fields/:fieldId/residual', '/operator/fields/:fieldId/calibration', '/operator/fields/:fieldId/health', '/operator/fields/:fieldId/audit', '/operator/twin/gateway-demo', '/operator/pilot'];
  const adminRoutes = ['/admin/dashboard', '/admin/fields', '/admin/operations', '/admin/devices', '/admin/evidence', '/admin/skills', '/admin/healthz'];
  const allRoutes = [...customerRoutes, ...operatorRoutes, ...adminRoutes];

  assert('changed_files_allowlist', diff.length === 0 || diff.every((file) => allowedChangedFiles.has(file)), { diff, allowed: Array.from(allowedChangedFiles) });
  assert('no_route_topology_changes', diff.every((file) => file !== 'apps/web/src/app/App.tsx' && !file.startsWith('apps/web/src/app/routes/')), { diff });
  assert('no_backend_migration_contract_fixture_package_changes', diff.every((file) => !file.startsWith('apps/server/') && !file.startsWith('migrations/') && !file.startsWith('packages/contracts/') && !file.startsWith('fixtures/') && !file.startsWith('.github/') && !['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml'].includes(file)), { diff });

  assert('pfe7_docs_include_all_routes', allRoutes.every((route) => docText.includes(route)), { routes: allRoutes });
  assert('pfe7_viewport_classes_documented', includesAll(docText, ['1440', '1280', '1024', '768', '390', 'desktop-wide', 'desktop-standard', 'laptop', 'tablet', 'mobile-narrow']));
  assert('pfe6_source_baseline_present', sourceBaselineDocs.every(exists));
  assert('route_viewport_walkthrough_exists', includesAll(read('docs/frontend-productization/PFE-7-ROUTE-VIEWPORT-WALKTHROUGH.md'), ['/customer/dashboard -> /customer/reports -> /customer/export', '/operator/twin -> /operator/fields', '/admin/dashboard -> /admin/devices -> /admin/healthz']));
  assert('responsive_issue_register_exists', includesAll(read('docs/frontend-productization/PFE-7-RESPONSIVE-ISSUE-REGISTER.md'), ['issue id', 'viewport', 'severity', 'later phase owner']));

  assert('responsive_css_imported_last', stylesCss.trim().endsWith('@import "./styles/responsive.css";'));
  assert('responsive_viewport_tokens_present', includesAll(responsiveCss, ['--pfe7-desktop-wide: 1440px', '--pfe7-desktop-standard: 1280px', '--pfe7-laptop: 1024px', '--pfe7-tablet: 768px', '--pfe7-mobile-narrow: 390px']));
  assert('product_page_shell_responsive_coverage', includesAll(productCss, ['.productPageShell__body', '@media (max-width: 1024px)', 'flex-direction: column', '.productPageShell__aside']));
  assert('product_data_table_overflow_coverage', includesAll(productCss, ['.productDataTable__overflow', 'overflow-x: auto', '-webkit-overflow-scrolling: touch', '.productDataTable__table', 'min-width']));
  assert('product_metric_grid_responsive_coverage', includesAll(responsiveCss, ['.customerDashboardKpiRow', '.adminProductMetricGrid', '.operatorProductMetricGrid', 'repeat(auto-fit', '@media (max-width: 768px)']));
  assert('product_scope_bar_responsive_coverage', includesAll(responsiveCss, ['.productScopeBar', '.productScopeBar__item', 'grid-template-columns: 1fr']));
  assert('product_boundary_banner_responsive_coverage', includesAll(responsiveCss, ['.productBoundaryBanner__items', 'flex-wrap: wrap', 'flex-direction: column']));
  assert('customer_dashboard_right_rail_responsive_protection', includesAll(customerCss, ['.customerDashboardRightRail', '.productPageShell__aside .customerDashboardRightRail', 'min-width: 0', 'max-width: 100%']));
  assert('operator_field_runtime_tabs_responsive_strategy', includesAll(operatorCss, ['.operatorFieldRuntime__tabs', '.operatorFieldRuntime__tab', 'flex: 1 1 180px', 'overflow-wrap: anywhere']));
  assert('gateway_demo_grid_responsive_strategy', includesAll(operatorCss, ['.operatorReplayDemo__grid', 'grid-template-columns: 1fr']));
  assert('pilot_readiness_grid_responsive_strategy', includesAll(responsiveCss, ['.operatorPilotReadiness__grid', 'grid-template-columns: 1fr']));
  assert('admin_shell_responsive_strategy', includesAll(adminCss, ['.adminShell', 'grid-template-columns: 1fr', '.adminShellSidebar', '.adminShellNav']));
  assert('admin_control_plane_metric_table_responsive_strategy', includesAll(adminCss, ['.adminProductMetricGrid', 'grid-template-columns: repeat(2', 'grid-template-columns: 1fr', '.productDataTable__overflow']));
  assert('report_print_preserved', includesAll(reportPrintCss, ['@media print', '@page', '.printPage']));
  assert('accessibility_focus_preserved', stylesCss.includes('@import "./styles/accessibility.css";') && includesAll(accessibilityCss, [':focus-visible', '.productSkipLink']));

  const hiddenPageOverflow = regexViolations(changedStyleFiles, /(body|\.app|\.productPageShell|\.customerShell|\.adminShell|\.customerDashboardPage)\s*\{[^}]*overflow-x\s*:\s*hidden/gi);
  const hiddenCriticalClass = regexViolations(changedStyleFiles, /\.(productDataTable|productBoundaryBanner|productStatusBadge|productSkipLink)\s*\{[^}]*display\s*:\s*none/gi);
  assert('no_page_level_overflow_x_hidden_fake_fix', hiddenPageOverflow.length === 0, { hiddenPageOverflow });
  assert('no_display_none_on_product_critical_classes', hiddenCriticalClass.length === 0, { hiddenCriticalClass });

  console.log(JSON.stringify({
    ok: true,
    acceptance: 'ACCEPTANCE_PFE_7_RESPONSIVE_VIEWPORT_COMPLETION',
    scope: 'responsive and viewport completion baseline only',
    viewports: { desktop_wide: 1440, desktop_standard: 1280, laptop: 1024, tablet: 768, mobile_narrow: 390 },
    surfaces: { customer: 9, operator: 13, admin: 7, supporting: ['login', 'shell navigation', 'breadcrumbs', 'product primitives', 'export/print'] },
    checks: { no_route_changes: 'passed', no_package_changes: 'passed', table_overflow: 'passed', shell_stacking: 'passed', metric_grids: 'passed', export_print_preserved: 'passed', accessibility_preserved: 'passed' },
    changed_files_checked: diff.length ? diff : Array.from(allowedChangedFiles),
    assertions,
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, acceptance: 'ACCEPTANCE_PFE_7_RESPONSIVE_VIEWPORT_COMPLETION', error: error.message, details: error.details || null, assertions }, null, 2));
  process.exit(1);
}
