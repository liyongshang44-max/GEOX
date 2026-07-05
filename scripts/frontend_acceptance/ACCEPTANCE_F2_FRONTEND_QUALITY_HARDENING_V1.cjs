// scripts/frontend_acceptance/ACCEPTANCE_F2_FRONTEND_QUALITY_HARDENING_V1.cjs
'use strict';

const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const assertions = [];

const files = {
  mainDoc: 'docs/frontend-productization/F2-FRONTEND-QUALITY-HARDENING.md',
  a11yDoc: 'docs/frontend-productization/F2-ACCESSIBILITY-BASELINE.md',
  responsiveDoc: 'docs/frontend-productization/F2-RESPONSIVE-VIEWPORT-SMOKE.md',
  stateDoc: 'docs/frontend-productization/F2-EMPTY-LOADING-ERROR-STATE-REGISTER.md',
  performanceDoc: 'docs/frontend-productization/F2-PERFORMANCE-BUDGET.md',
  visualDoc: 'docs/frontend-productization/F2-VISUAL-SMOKE-CHECKLIST.md',
  keyboardDoc: 'docs/frontend-productization/F2-KEYBOARD-FOCUS-GATE.md',
  acceptance: 'scripts/frontend_acceptance/ACCEPTANCE_F2_FRONTEND_QUALITY_HARDENING_V1.cjs',
  customerLayout: 'apps/web/src/layouts/CustomerLayout.tsx',
  operatorLayout: 'apps/web/src/layouts/OperatorLayout.tsx',
  adminLayout: 'apps/web/src/layouts/AdminLayout.tsx',
  localeToggle: 'apps/web/src/components/common/LocaleToggle.tsx',
  baseCss: 'apps/web/src/styles/base.css',
  customerCss: 'apps/web/src/styles/customerShell.css',
  operatorCss: 'apps/web/src/styles/operatorShell.css',
  adminCss: 'apps/web/src/styles/adminShell.css',
  surfaceCss: 'apps/web/src/styles/surfacePrimitives.css',
  operatorFieldCss: 'apps/web/src/styles/operatorFieldRuntime.css',
  operatorReplayCss: 'apps/web/src/styles/operatorReplayDemo.css',
  operatorPilotCss: 'apps/web/src/styles/operatorPilotReadiness.css',
  labels: 'apps/web/src/lib/productSurfaceLabels.ts',
  customerLabels: 'apps/web/src/lib/customerLabels.ts',
};

const requiredDocs = [files.mainDoc, files.a11yDoc, files.responsiveDoc, files.stateDoc, files.performanceDoc, files.visualDoc, files.keyboardDoc, files.acceptance];
const allowedExact = new Set([
  files.mainDoc, files.a11yDoc, files.responsiveDoc, files.stateDoc, files.performanceDoc, files.visualDoc, files.keyboardDoc,
  files.acceptance,
  'scripts/frontend_acceptance/lib/frontendQualityScan.js',
  files.customerLayout, files.operatorLayout, files.adminLayout,
  files.customerLabels, files.labels,
  files.customerCss, files.operatorCss, files.adminCss, files.surfaceCss, files.operatorFieldCss, files.operatorReplayCss, files.operatorPilotCss,
]);
const allowedPrefixes = [
  'apps/web/src/components/common/',
  'apps/web/src/components/layout/',
  'apps/web/src/features/customer/pages/',
  'apps/web/src/features/admin/pages/',
  'apps/web/src/features/operator/fieldRuntime/',
  'apps/web/src/features/operator/replayDemo/',
  'apps/web/src/features/operator/pilotReadiness/',
];
const allowedOperatorExact = new Set([
  'apps/web/src/features/operator/pages/OperatorTwinOverviewPage.tsx',
  'apps/web/src/features/operator/pages/OperatorGatewayDemoViewerPage.tsx',
]);
const allowedCustomerExact = new Set([
  'apps/web/src/features/fields/pages/FieldReportPage.tsx',
  'apps/web/src/features/fields/pages/FieldReportExportPage.tsx',
  'apps/web/src/features/operations/pages/OperationReportPage.tsx',
]);
const blockedExact = new Set(['apps/web/src/app/App.tsx', 'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml']);
const blockedPrefixes = ['apps/web/src/app/routes/', 'apps/server/', 'migrations/', 'packages/contracts/', 'fixtures/', '.github/'];
const mojibake = ['鎬', '鍦', '浣', '璁', '杩', '閰', '绠', '瀵', '艰', '鍚', '彴', '潡', '惧', '悍', '嵁', '�'];
const fakeClaims = ['Live Device: Connected', 'Production Gateway: Online', 'Field Pilot: Started', 'Controlled Execution: Enabled', 'AO-ACT Dispatch: Enabled', 'live monitoring active', 'field pilot execution active', 'dispatch enabled', 'ROI computed', 'Field Memory learned', '实时设备：已连接', '生产网关：在线', '田间试点：已开始', '受控执行：已启用', '实时监控已启用', '派发已启用', 'ROI 已计算', 'Field Memory 已学习'];
const customerLeak = ['Dispatch', 'AO-ACT', 'ROI Ledger', 'Field Memory', 'Debug', 'Dev Tools', 'operator workbench', 'admin-only'];
const adminPollution = ['legacy dev tools', 'Dev Tools', 'fixture', 'temporary route'];
const operatorLeak = ['dispatch enabled', 'AO-ACT enabled', 'ROI computed', 'Field Memory learned', 'production gateway online', 'live monitoring active'];

function p(file) { return path.join(root, file); }
function exists(file) { return fs.existsSync(p(file)); }
function read(file) { return fs.readFileSync(p(file), 'utf8'); }
function lower(text) { return text.toLowerCase(); }
function includesAll(text, tokens) { return tokens.every((token) => text.includes(token)); }
function hits(text, tokens) { return tokens.filter((token) => text.includes(token)); }
function hitsI(text, tokens) { const haystack = lower(text); return tokens.filter((token) => haystack.includes(lower(String(token)))); }
function stripComments(text) { return text.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, ''); }
function ok(name, passed, details = {}) {
  assertions.push({ name, passed: passed === true, details });
  if (passed !== true) {
    const error = new Error('ASSERTION_FAILED:' + name);
    error.details = details;
    throw error;
  }
  console.log('[f2-frontend-quality-hardening] ok:', name);
}
function execGit(args) {
  return cp.execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}
function diffBase() {
  const candidates = [['merge-base', 'origin/main', 'HEAD'], ['merge-base', 'main', 'HEAD']];
  for (const args of candidates) {
    try { const value = execGit(args); if (value) return value; } catch (_error) {}
  }
  return 'HEAD~1';
}
function diffFiles() {
  const base = diffBase();
  let output = '';
  try { output = execGit(['diff', '--name-only', `${base}...HEAD`]); } catch (_error) { output = ''; }
  return { base, files: output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean) };
}
function allowed(file) {
  return allowedExact.has(file) || allowedOperatorExact.has(file) || allowedCustomerExact.has(file) || allowedPrefixes.some((prefix) => file.startsWith(prefix));
}
function blocked(file) { return blockedExact.has(file) || blockedPrefixes.some((prefix) => file.startsWith(prefix)); }
function cssText() { return [files.baseCss, files.customerCss, files.operatorCss, files.adminCss, files.surfaceCss, files.operatorFieldCss, files.operatorReplayCss, files.operatorPilotCss].filter(exists).map(read).join('\n'); }
function shellText() { return [files.customerLayout, files.operatorLayout, files.adminLayout].map(read).join('\n'); }
function productText() { return [files.customerLayout, files.operatorLayout, files.adminLayout, files.localeToggle, files.labels, files.customerLabels].filter(exists).map(read).map(stripComments).join('\n'); }
function customerText() { return [files.customerLayout, files.customerLabels].filter(exists).map(read).map(stripComments).join('\n'); }
function adminText() { return [files.adminLayout, files.labels].filter(exists).map(read).map(stripComments).join('\n'); }
function operatorText() { return [files.operatorLayout, files.labels].filter(exists).map(read).map(stripComments).join('\n'); }

try {
  requiredDocs.forEach((file) => ok('exists:' + file, exists(file), { file }));
  [files.customerLayout, files.operatorLayout, files.adminLayout, files.localeToggle, files.baseCss, files.customerCss, files.operatorCss, files.adminCss, files.surfaceCss, files.labels].forEach((file) => ok('exists:' + file, exists(file), { file }));

  const diff = diffFiles();
  ok('changed_files_allowlist', diff.files.length > 0 && diff.files.every(allowed), { diff: diff.files, base: diff.base });
  ok('blocked_files_unchanged', diff.files.every((file) => !blocked(file)), { diff: diff.files });
  ok('route_topology_unchanged', diff.files.every((file) => file !== 'apps/web/src/app/App.tsx' && !file.startsWith('apps/web/src/app/routes/')), { diff: diff.files });
  ok('backend_package_unchanged', diff.files.every((file) => !file.startsWith('apps/server/') && !file.startsWith('migrations/') && !file.startsWith('packages/contracts/') && !file.startsWith('fixtures/') && !['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml'].includes(file)), { diff: diff.files });

  const mainDoc = read(files.mainDoc);
  const a11yDoc = read(files.a11yDoc);
  const responsiveDoc = read(files.responsiveDoc);
  const stateDoc = read(files.stateDoc);
  const performanceDoc = read(files.performanceDoc);
  const visualDoc = read(files.visualDoc);
  const keyboardDoc = read(files.keyboardDoc);
  const docs = [mainDoc, a11yDoc, responsiveDoc, stateDoc, performanceDoc, visualDoc, keyboardDoc].join('\n');

  ok('main_doc_required_sections_present', includesAll(mainDoc, ['Phase', 'Purpose', 'Preconditions', 'Allowed files', 'Forbidden files', 'Quality dimensions', 'F2-A Accessibility baseline', 'F2-B Keyboard / focus gate', 'F2-C Responsive viewport smoke', 'F2-D Empty / loading / error states', 'F2-E Visual smoke checklist', 'F2-F Performance budget', 'F2-G Quality gate consolidation', 'Acceptance', 'Non-goals', 'Next phase']));
  ok('main_doc_boundaries_present', includesAll(mainDoc, ['F2 does not create product capability.', 'F2 does not add routes.', 'F2 does not change runtime semantics.', 'F2 does not claim live production readiness.', 'F2 hardens frontend quality only.']));

  const shells = shellText();
  ok('formal_shell_landmarks_present', ['<nav', '<header', '<main'].every((token) => shells.includes(token)), {});
  ok('formal_shell_nav_labels_present', [files.customerLayout, files.operatorLayout, files.adminLayout].every((file) => read(file).includes('aria-label')));
  ok('locale_toggle_aria_label_present', read(files.localeToggle).includes('aria-label'));
  ok('disabled_nav_semantics_present', shells.includes('aria-disabled'));
  ok('active_nav_state_present', shells.includes('NavLink') && shells.includes('isActive'));
  ok('icon_marks_hidden_from_at', shells.includes('aria-hidden="true"'));
  ok('button_link_semantics_guarded', !/(<div[^>]*onClick=|<span[^>]*onClick=|role="button"(?![\s\S]{0,160}tabIndex)|<a[^>]*onClick=(?![\s\S]{0,160}href=))/m.test(shells));
  ok('form_labels_present', read(files.customerLayout).includes('aria-label') && read(files.localeToggle).includes('button'));

  const styles = cssText();
  ok('focus_visible_css_exists', styles.includes(':focus-visible'));
  ok('no_global_outline_none_without_replacement', !/(\*?:focus\s*\{[^}]*outline\s*:\s*(none|0)[^}]*\})/i.test(styles));
  ok('no_color_only_runtime_tokens', hits(styles, ['success-green', 'risk-red', 'warning-yellow', 'live-online', 'production-online']).length === 0, { hits: hits(styles, ['success-green', 'risk-red', 'warning-yellow', 'live-online', 'production-online']) });
  ok('no_extreme_contrast_danger_tokens', hits(styles, ['opacity: 0.3', 'opacity:.3', 'opacity: .3', 'color: transparent']).length === 0);

  ok('responsive_docs_cover_viewports', includesAll(responsiveDoc, ['1440px', '1280px', '768px', '390px', 'nonclaim banner readable', 'LocaleToggle topbar fit']));
  ok('responsive_css_affordances_present', includesAll(styles, ['@media']) && (styles.includes('flex-wrap') || styles.includes('minmax')) && (styles.includes('overflow-wrap') || styles.includes('word-break') || styles.includes('overflow-x')));

  ok('state_register_present', includesAll(stateDoc, ['loading', 'empty', 'error', 'unavailable', 'not authorized', 'not configured', 'read-only boundary', 'no fake data', 'no production outage claim', 'no stack trace exposure']));
  ok('visual_route_checklist_present', includesAll(visualDoc, ['Customer Dashboard', 'Customer Fields', 'Customer Field Report', 'Customer Operations', 'Customer Operation Report', 'Customer Reports', 'Customer Export', 'Admin Dashboard', 'Admin Fields', 'Admin Operations', 'Admin Devices', 'Admin Evidence', 'Admin Health', 'Admin Skills', 'Operator Runtime Overview', 'Field Runtime', 'Replay-backed Gateway Demo', 'Pilot Readiness']));
  ok('performance_budget_present', includesAll(performanceDoc, ['build:web', 'no new dependency', 'no heavyweight dependency', 'no eager import', 'route lazy-loading preserved', 'copy registry does not import API clients', 'LocaleToggle does not import API clients']));
  ok('keyboard_focus_doc_present', includesAll(keyboardDoc, ['Focus visible', 'Keyboard reachability', 'Interaction no-op clarity']));

  const scanned = diff.files.filter((file) => exists(file) && file !== files.acceptance);
  const mojibakeHits = scanned.map((file) => ({ file, hits: hits(read(file), mojibake) })).filter((entry) => entry.hits.length > 0);
  ok('no_mojibake_in_f2_files', mojibakeHits.length === 0, { mojibakeHits, scanned });

  const product = productText();
  ok('no_fake_live_production_claims', hitsI(product, fakeClaims).length === 0, { hits: hitsI(product, fakeClaims) });
  ok('customer_internal_leakage_absent', hitsI(customerText(), customerLeak).length === 0, { hits: hitsI(customerText(), customerLeak) });
  ok('admin_formal_nav_pollution_absent', hitsI(adminText(), adminPollution).length === 0, { hits: hitsI(adminText(), adminPollution) });
  ok('operator_fake_capability_leakage_absent', hitsI(operatorText(), operatorLeak).length === 0, { hits: hitsI(operatorText(), operatorLeak) });

  ok('acceptance_is_static_repo_read_only', includesAll(read(files.acceptance), ['node:fs', 'node:path']) && !read(files.acceptance).includes('fetch(') && !read(files.acceptance).includes('listen('));
  ok('docs_no_runtime_claims', includesAll(docs, ['No full WCAG certification', 'No new package dependency']) && docs.includes('No runtime capability claim'));

  console.log(JSON.stringify({
    ok: true,
    acceptance: 'ACCEPTANCE_F2_FRONTEND_QUALITY_HARDENING_V1',
    phase: 'F2 Frontend Quality Hardening',
    quality: {
      accessibility: 'baseline-present',
      keyboard_focus: 'baseline-present',
      responsive: 'baseline-present',
      states: 'baseline-present',
      visual_smoke: 'baseline-present',
      performance_budget: 'baseline-present'
    },
    route_topology_changed: false,
    backend_changed: false,
    package_changed: false,
    next: 'F0-B Frontend Productization Freeze Declaration',
    changed_files_checked: diff.files,
    assertions
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, acceptance: 'ACCEPTANCE_F2_FRONTEND_QUALITY_HARDENING_V1', error: error.message, details: error.details || null, assertions }, null, 2));
  process.exit(1);
}
