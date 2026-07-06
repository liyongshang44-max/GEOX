// scripts/frontend_acceptance/ACCEPTANCE_PFE_11_PRODUCT_COPY_I18N_COMPLETION.cjs
'use strict';

const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const docs = [
  'docs/frontend-productization/PFE-11-PRODUCT-COPY-I18N-COMPLETION.md',
  'docs/frontend-productization/PFE-11-COPY-MATRIX.md',
  'docs/frontend-productization/PFE-11-I18N-COVERAGE-MATRIX.md',
  'docs/frontend-productization/PFE-11-COPY-ISSUE-REGISTER.md',
];
const baselineDocs = [
  'docs/frontend-productization/PFE-6-ACCESSIBILITY-KEYBOARD-COMPLIANCE.md',
  'docs/frontend-productization/PFE-7-RESPONSIVE-VIEWPORT-COMPLETION.md',
  'docs/frontend-productization/PFE-8-EMPTY-LOADING-ERROR-STATE-COMPLETION.md',
  'docs/frontend-productization/PFE-9-VISUAL-REGRESSION-SCREENSHOT-BASELINE.md',
  'docs/frontend-productization/PFE-10-PERFORMANCE-BUDGET-BUNDLE-HYGIENE.md',
];
const localeFile = 'apps/web/src/lib/locale.tsx';
const copyCatalogFile = 'apps/web/src/lib/productSurfaceLabels.ts';
const localeToggleFile = 'apps/web/src/components/common/LocaleToggle.tsx';
const runtimeGuardFile = 'apps/web/src/components/common/RuntimeTextGuard.tsx';
const customerLanguageGateFile = 'scripts/frontend_acceptance/ACCEPTANCE_CUSTOMER_PRODUCT_LANGUAGE_V1.cjs';
const pfe10BundleCheckerFile = 'scripts/frontend_acceptance/CHECK_PFE_10_WEB_BUNDLE_BUDGET.cjs';
const acceptanceFile = 'scripts/frontend_acceptance/ACCEPTANCE_PFE_11_PRODUCT_COPY_I18N_COMPLETION.cjs';
const allowedChangedFiles = new Set([...docs, localeToggleFile, acceptanceFile]);
const assertions = [];

function repoPath(file) { return path.join(root, file); }
function exists(file) { return fs.existsSync(repoPath(file)); }
function read(file) { return fs.readFileSync(repoPath(file), 'utf8'); }
function lower(value) { return String(value).toLowerCase(); }
function includesAll(text, tokens) { const haystack = lower(text); return tokens.every((token) => haystack.includes(lower(token))); }
function assert(name, passed, details = {}) { assertions.push({ name, passed: passed === true, details }); if (passed !== true) { const error = new Error('ASSERTION_FAILED:' + name); error.details = details; throw error; } console.log('[pfe-11-product-copy-i18n-completion] ok:', name); }
function runGit(args) { try { return cp.execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch (_error) { return ''; } }
function statusFiles() { const output = runGit(['status', '--short', '--untracked-files=all']); if (!output) return []; return output.split(/\r?\n/).map((line) => { if (!line.trim()) return ''; const arrow = line.indexOf(' -> '); if (arrow >= 0) return line.slice(arrow + 4).trim(); return line.replace(/^[ MADRCU?!]{1,2}\s+/, '').trim(); }).filter(Boolean); }
function changedFiles() { const set = new Set(); const output = runGit(['diff', '--name-only', 'origin/main...HEAD']) || runGit(['diff', '--name-only', 'main...HEAD']); if (output) output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).forEach((file) => set.add(file)); statusFiles().forEach((file) => set.add(file)); return Array.from(set).sort(); }
function count(text, regex) { return (text.match(regex) || []).length; }
function guardEntryCount(text) { const start = text.indexOf('VISIBLE_TEXT_REPLACEMENTS'); if (start < 0) return -1; const end = text.indexOf('];', start); const body = end < 0 ? text.slice(start) : text.slice(start, end); return count(body, /\[\s*["']/g); }
function combinedDocs() { return docs.map(read).join('\n'); }

try {
  [...docs, ...baselineDocs, localeFile, copyCatalogFile, localeToggleFile, runtimeGuardFile, customerLanguageGateFile, pfe10BundleCheckerFile, acceptanceFile].forEach((file) => assert('exists:' + file, exists(file), { file }));

  const diff = changedFiles();
  const locale = read(localeFile);
  const catalog = read(copyCatalogFile);
  const toggle = read(localeToggleFile);
  const guard = read(runtimeGuardFile);
  const copyMatrix = read('docs/frontend-productization/PFE-11-COPY-MATRIX.md');
  const coverageMatrix = read('docs/frontend-productization/PFE-11-I18N-COVERAGE-MATRIX.md');
  const issueRegister = read('docs/frontend-productization/PFE-11-COPY-ISSUE-REGISTER.md');
  const docsText = combinedDocs();
  const zhPairs = count(catalog, /\bzh\s*:/g);
  const enPairs = count(catalog, /\ben\s*:/g);
  const currentGuardEntries = guardEntryCount(guard);

  const routes = [
    '/customer/dashboard', '/customer/fields', '/customer/fields/:fieldId', '/customer/fields/:fieldId/export', '/customer/operations', '/customer/operations/:operationId', '/customer/operations/:operationId/export', '/customer/reports', '/customer/export',
    '/operator/twin', '/operator/fields', '/operator/fields/:fieldId', '/operator/fields/:fieldId/state', '/operator/fields/:fieldId/evidence', '/operator/fields/:fieldId/forecast', '/operator/fields/:fieldId/scenario', '/operator/fields/:fieldId/residual', '/operator/fields/:fieldId/calibration', '/operator/fields/:fieldId/health', '/operator/fields/:fieldId/audit', '/operator/twin/gateway-demo', '/operator/pilot',
    '/admin/dashboard', '/admin/fields', '/admin/operations', '/admin/devices', '/admin/evidence', '/admin/skills', '/admin/healthz', '/login',
  ];

  assert('changed_files_allowlist', diff.length === 0 || diff.every((file) => allowedChangedFiles.has(file)), { diff, allowed: Array.from(allowedChangedFiles) });
  assert('no_route_topology_changes', diff.every((file) => file !== 'apps/web/src/app/App.tsx' && file !== 'apps/web/src/app/AppShell.tsx' && !file.startsWith('apps/web/src/app/routes/')), { diff });
  assert('no_server_migration_contract_fixture_changes', diff.every((file) => !file.startsWith('apps/server/') && !file.startsWith('migrations/') && !file.startsWith('packages/contracts/') && !file.startsWith('fixtures/')), { diff });
  assert('no_package_or_workspace_changes', diff.every((file) => !['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'apps/web/package.json'].includes(file)), { diff });
  assert('no_ci_workflow_changes', diff.every((file) => !file.startsWith('.github/')), { diff });

  assert('docs_have_pfe11_scope', includesAll(docsText, ['PFE-11', 'zh-CN', 'en-US', 'LocaleToggle', 'RuntimeTextGuard', 'copy taxonomy']));
  assert('copy_matrix_covers_formal_routes', routes.every((route) => copyMatrix.includes(route)), { routes });
  assert('coverage_matrix_covers_core_sources', includesAll(coverageMatrix, [localeFile, copyCatalogFile, localeToggleFile, runtimeGuardFile, 'apps/web/src/layouts/CustomerLayout.tsx', 'apps/web/src/layouts/OperatorLayout.tsx', 'apps/web/src/layouts/AdminLayout.tsx']));
  assert('issue_register_records_guard_baseline', issueRegister.includes('8') && includesAll(issueRegister, ['Blocking issues not allowed', 'LocaleToggle inaccessible', 'PFE-10 bundle budget failed']));
  assert('baseline_docs_present', baselineDocs.every(exists));

  assert('locale_supports_two_locales', locale.includes('"zh-CN" | "en-US"') && locale.includes('SUPPORTED_LOCALES') && locale.includes('"zh-CN"') && locale.includes('"en-US"'));
  assert('localized_text_selects_english_for_en_us', locale.includes('locale === "en-US" ? copy.en : copy.zh'));
  assert('locale_provider_exposes_text_helper', locale.includes('text: (zh: string, en: string) => string') && locale.includes('localizedText({ zh, en }, locale)'));

  assert('locale_toggle_uses_locale_context', toggle.includes('useLocale') && toggle.includes('setLocale') && toggle.includes('aria-pressed'));
  assert('locale_toggle_aria_is_localized', toggle.includes('text("语言选择", "Language selector")') && toggle.includes('optionAriaLabel') && toggle.includes('aria-label={optionAriaLabel'));
  assert('locale_toggle_has_no_fixed_group_aria', !toggle.includes('aria-label="Language selector"'));

  assert('copy_catalog_has_surface_groups', includesAll(catalog, ['CUSTOMER_SHELL_LABELS', 'OPERATOR_SHELL_LABELS', 'ADMIN_SHELL_LABELS', 'OPERATOR_FORMAL_SURFACE_COPY']));
  assert('copy_catalog_has_bilingual_volume', zhPairs > 80 && enPairs > 80 && zhPairs === enPairs, { zhPairs, enPairs });
  assert('copy_catalog_has_three_shells', includesAll(catalog, ['GEOX 客户门户', 'GEOX Customer Portal', 'GEOX 操作员运行控制台', 'GEOX Operator Runtime Console', 'GEOX 后台管理', 'GEOX Admin Console']));
  assert('copy_catalog_has_state_boundary_nonclaim_copy', includesAll(catalog, ['loading', 'error', 'empty', 'nonclaims', 'Read-only runtime review']));

  assert('runtime_text_guard_count_not_expanded', currentGuardEntries === 8, { currentGuardEntries });
  assert('customer_product_language_gate_present', exists(customerLanguageGateFile));
  assert('pfe10_bundle_checker_present', exists(pfe10BundleCheckerFile));
  assert('no_new_i18n_dependency', diff.every((file) => !['package.json', 'pnpm-lock.yaml', 'apps/web/package.json'].includes(file)));
  assert('no_overclaim_in_docs', !lower(docsText).includes('complete all localization') && !lower(docsText).includes('translation certification complete') && !lower(docsText).includes('all languages supported'));

  console.log(JSON.stringify({
    ok: true,
    acceptance: 'ACCEPTANCE_PFE_11_PRODUCT_COPY_I18N_COMPLETION',
    scope: 'product copy and zh/en i18n completion only',
    locales: ['zh-CN', 'en-US'],
    surfaces: { customer: 9, operator: 13, admin: 7, supporting: ['login', 'locale toggle', 'product primitives', 'export/print'] },
    checks: { docs: 'passed', locale_provider: 'passed', copy_catalog: 'passed', surface_matrix: 'passed', runtime_text_guard_not_expanded: 'passed', no_package_changes: 'passed', no_route_changes: 'passed' },
    changed_files_checked: diff.length ? diff : Array.from(allowedChangedFiles),
    assertions,
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, acceptance: 'ACCEPTANCE_PFE_11_PRODUCT_COPY_I18N_COMPLETION', error: error.message, details: error.details || null, assertions }, null, 2));
  process.exit(1);
}
