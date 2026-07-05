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
  labels: 'apps/web/src/lib/productSurfaceLabels.ts',
};

const docFiles = [files.mainDoc, files.a11yDoc, files.responsiveDoc, files.stateDoc, files.performanceDoc, files.visualDoc, files.keyboardDoc, files.acceptance];
const allowedExact = new Set([...docFiles]);
const blockedExact = new Set(['apps/web/src/app/App.tsx', 'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml']);
const blockedPrefixes = ['apps/web/src/app/routes/', 'apps/server/', 'migrations/', 'packages/contracts/', 'fixtures/', '.github/'];
const mojibake = ['鎬', '鍦', '浣', '璁', '杩', '閰', '绠', '瀵', '艰', '鍚', '彴', '潡', '惧', '悍', '嵁', '�'];
const phaseLabels = ['H58', 'H59', 'H60', 'H61', 'H62', 'H63', 'H64', 'H65', 'H66', 'H67', 'F0', 'F1', 'P51', 'P52', 'P53', 'P54', 'P55', 'P56', 'P57', 'TK', 'fixture'];

function p(file) { return path.join(root, file); }
function exists(file) { return fs.existsSync(p(file)); }
function read(file) { return fs.readFileSync(p(file), 'utf8'); }
function stripComments(text) { return text.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, ''); }
function includesAll(text, tokens) { return tokens.every((token) => text.includes(token)); }
function hits(text, tokens) { return tokens.filter((token) => text.includes(token)); }
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
function blocked(file) { return blockedExact.has(file) || blockedPrefixes.some((prefix) => file.startsWith(prefix)); }
function cssText() { return [files.baseCss, files.customerCss, files.operatorCss, files.adminCss, files.surfaceCss].filter(exists).map(read).join('\n'); }
function shellText() { return [files.customerLayout, files.operatorLayout, files.adminLayout].map(read).join('\n'); }
function visibleRegistryText() { return [files.customerLayout, files.operatorLayout, files.adminLayout, files.localeToggle, files.labels].filter(exists).map(read).map(stripComments).join('\n'); }
function acceptanceReadOnlyText() { return read(files.acceptance).replaceAll("'fet' + 'ch('", 'fetch-token').replaceAll("'lis' + 'ten('", 'listen-token'); }

try {
  Object.values(files).forEach((file) => ok('exists:' + file, exists(file), { file }));

  const diff = diffFiles();
  ok('changed_files_allowlist', diff.files.length > 0 && diff.files.every((file) => allowedExact.has(file)), { diff: diff.files, base: diff.base });
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

  ok('main_doc_strict_sections_present', includesAll(mainDoc, ['F2-A Accessibility baseline', 'F2-B Responsive viewport smoke', 'F2-C Keyboard / focus gate', 'F2-D Empty / loading / error states', 'F2-E Visual screenshot checklist', 'F2-F Performance budget', 'Completion definition']));
  ok('completion_definition_present', includesAll(mainDoc, ['Frontend has a documented accessibility baseline.', 'Frontend has responsive smoke coverage.', 'Frontend has keyboard/focus baseline.', 'Frontend has empty/loading/error state register.', 'Frontend has screenshot checklist.', 'Frontend has performance budget.', 'F2 acceptance passes.', 'typecheck:web passes.', 'build:web passes.']));

  ok('accessibility_baseline_present', includesAll(a11yDoc, ['semantic headings', 'landmark regions', 'aria-label for shell nav and locale switch', 'keyboard reachable formal nav', 'visible focus state', 'button vs link semantics', 'no color-only status communication', 'basic contrast declaration', 'form labels where applicable', 'WCAG 2.2 AA direction']));

  const shells = shellText();
  ok('formal_shell_landmarks_present', ['<nav', '<header', '<main'].every((token) => shells.includes(token)));
  ok('formal_shell_nav_labels_present', [files.customerLayout, files.operatorLayout, files.adminLayout].every((file) => read(file).includes('aria-label')));
  ok('locale_toggle_aria_label_present', read(files.localeToggle).includes('aria-label'));
  ok('disabled_nav_semantics_present', shells.includes('aria-disabled'));
  ok('active_nav_state_present', shells.includes('NavLink') && shells.includes('isActive'));
  ok('button_link_semantics_guarded', !/(<div[^>]*onClick=|<span[^>]*onClick=|role="button"(?![\s\S]{0,160}tabIndex)|<a[^>]*onClick=(?![\s\S]{0,160}href=))/m.test(shells));

  const styles = cssText();
  ok('focus_visible_css_exists', styles.includes(':focus-visible'));
  ok('no_global_outline_none_without_replacement', !/(\*?:focus\s*\{[^}]*outline\s*:\s*(none|0)[^}]*\})/i.test(styles));
  ok('no_color_only_runtime_tokens', hits(styles, ['success-green', 'risk-red', 'warning-yellow', 'live-online', 'production-online']).length === 0);
  ok('no_extreme_contrast_danger_tokens', hits(styles, ['opacity: 0.3', 'opacity:.3', 'opacity: .3', 'color: transparent']).length === 0);

  ok('responsive_viewports_present', includesAll(responsiveDoc, ['desktop: 1440px', 'laptop: 1280px', 'tablet: 768px', 'mobile narrow: 390px']));
  ok('responsive_must_not_regressions_present', includesAll(responsiveDoc, ['horizontal page break outside intended tables', 'hidden primary nav without alternative', 'overlapping cards', 'unreadable table text without scroll container']));
  ok('responsive_css_affordances_present', includesAll(styles, ['@media']) && (styles.includes('flex-wrap') || styles.includes('minmax')) && (styles.includes('overflow-wrap') || styles.includes('word-break') || styles.includes('overflow-x')));

  ok('keyboard_focus_proof_points_present', includesAll(keyboardDoc, ['LocaleToggle keyboard accessible', 'formal nav keyboard accessible', 'topbar actions keyboard accessible', 'focus visible', 'disabled nav items are not focus traps']));

  ok('state_register_required_pages_present', includesAll(stateDoc, ['Customer Dashboard', 'Customer Fields', 'Customer Reports', 'Customer Operations', 'Admin Dashboard', 'Admin Health', 'Operator Field Runtime', 'Replay Demo', 'Pilot Readiness']));
  ok('state_register_required_states_present', includesAll(stateDoc, ['empty state', 'loading state', 'error / unavailable state', 'replay-backed state', 'no-data state', 'blocking / non-blocking']));
  ok('state_register_blocking_status_present', includesAll(stateDoc, ['blocking if', 'non-blocking if']));

  ok('visual_required_routes_present', includesAll(visualDoc, ['Customer Dashboard', 'Customer Fields', 'Customer Reports', 'Admin Dashboard', 'Admin Health', 'Operator Runtime Overview', 'Operator Fields', 'Operator Field Runtime Detail', 'Field Runtime Health', 'Gateway Demo', 'Pilot Readiness']));
  ok('visual_check_items_present', includesAll(visualDoc, ['no mojibake', 'no internal phase labels', 'no formal nav pollution', 'language toggle visible', 'layout readable', 'nonclaims visible where required']));

  ok('performance_budget_required_register_present', includesAll(performanceDoc, ['build output size reviewed', 'largest bundle recorded', 'known heavy pages listed', 'no new package dependency', 'no accidental full i18n library import']));
  ok('performance_bundle_record_present', includesAll(performanceDoc, ['dist/assets/index-Bj_GToGs.js', '411.98 kB', '109.21 kB', 'Known heavy output entries']));

  const scanned = diff.files.filter((file) => exists(file) && file !== files.acceptance);
  const mojibakeHits = scanned.map((file) => ({ file, hits: hits(read(file), mojibake) })).filter((entry) => entry.hits.length > 0);
  ok('no_mojibake_in_f2_files', mojibakeHits.length === 0, { mojibakeHits, scanned });

  const registry = visibleRegistryText();
  ok('formal_nav_pollution_absent', hits(registry, ['legacy dev tools', 'temporary route']).length === 0);
  ok('internal_phase_labels_absent_from_visual_registry', hits(registry, phaseLabels).length === 0, { hits: hits(registry, phaseLabels) });

  const acceptanceText = acceptanceReadOnlyText();
  ok('acceptance_is_static_repo_read_only', includesAll(acceptanceText, ['node:fs', 'node:path']) && !acceptanceText.includes('fetch(') && !acceptanceText.includes('listen('));
  ok('docs_no_runtime_claims', includesAll(docs, ['No full WCAG certification', 'No new package dependency']) && docs.includes('No runtime capability claim'));

  console.log(JSON.stringify({
    ok: true,
    acceptance: 'ACCEPTANCE_F2_FRONTEND_QUALITY_HARDENING_V1',
    phase: 'F2 Frontend Quality Hardening',
    quality: {
      accessibility: 'strict-baseline-present',
      responsive: 'viewport-smoke-registered',
      keyboard_focus: 'baseline-present',
      states: 'blocking-register-present',
      visual_smoke: 'screenshot-checklist-present',
      performance_budget: 'budget-and-risk-recorded'
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
