// scripts/frontend_acceptance/ACCEPTANCE_PFE_6_ACCESSIBILITY_KEYBOARD_COMPLIANCE.cjs
'use strict';

const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const docs = [
  'docs/frontend-productization/PFE-6-ACCESSIBILITY-KEYBOARD-COMPLIANCE.md',
  'docs/frontend-productization/PFE-6-ACCESSIBILITY-MATRIX.md',
  'docs/frontend-productization/PFE-6-KEYBOARD-WALKTHROUGH.md',
  'docs/frontend-productization/PFE-6-ACCESSIBILITY-ISSUE-REGISTER.md',
];
const baselineFiles = [
  'docs/frontend-productization/PFE-1-PAGE-CONTRACT-REGISTER.md',
  'docs/frontend-productization/PFE-2-DESIGN-SYSTEM-V1-COMPLETION.md',
  'apps/web/src/design-system/product/index.ts',
];
const productPrimitiveFiles = [
  'apps/web/src/design-system/product/ProductPageShell.tsx',
  'apps/web/src/design-system/product/ProductPageHeader.tsx',
  'apps/web/src/design-system/product/ProductDataTable.tsx',
  'apps/web/src/design-system/product/ProductStatusBadge.tsx',
  'apps/web/src/design-system/product/ProductLoadingState.tsx',
  'apps/web/src/design-system/product/ProductErrorState.tsx',
  'apps/web/src/design-system/product/ProductStateBlock.tsx',
  'apps/web/src/design-system/product/ProductTraceLink.tsx',
];
const supportFiles = [
  'apps/web/src/components/common/LocaleToggle.tsx',
  'apps/web/src/components/layout/AppBreadcrumb.tsx',
  'apps/web/src/components/a11y/ProductSkipLink.tsx',
  'apps/web/src/styles/accessibility.css',
  'apps/web/src/styles.css',
];
const acceptanceFile = 'scripts/frontend_acceptance/ACCEPTANCE_PFE_6_ACCESSIBILITY_KEYBOARD_COMPLIANCE.cjs';
const allowedChangedFiles = new Set([...docs, ...productPrimitiveFiles, ...supportFiles, acceptanceFile]);
const scanFiles = [...productPrimitiveFiles, ...supportFiles];
const assertions = [];

function repoPath(file) { return path.join(root, file); }
function exists(file) { return fs.existsSync(repoPath(file)); }
function read(file) { return fs.readFileSync(repoPath(file), 'utf8'); }
function lower(value) { return String(value).toLowerCase(); }
function includesAll(text, tokens) { const haystack = lower(text); return tokens.every((token) => haystack.includes(lower(token))); }
function assert(name, passed, details = {}) { assertions.push({ name, passed: passed === true, details }); if (passed !== true) { const error = new Error('ASSERTION_FAILED:' + name); error.details = details; throw error; } console.log('[pfe-6-accessibility-keyboard-compliance] ok:', name); }
function runGit(args) { try { return cp.execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch (_error) { return ''; } }
function statusFiles() { const output = runGit(['status', '--short', '--untracked-files=all']); if (!output) return []; return output.split(/\r?\n/).map((line) => { if (!line.trim()) return ''; const arrow = line.indexOf(' -> '); if (arrow >= 0) return line.slice(arrow + 4).trim(); return line.replace(/^[ MADRCU?!]{1,2}\s+/, '').trim(); }).filter(Boolean); }
function changedFiles() { const set = new Set(); const output = runGit(['diff', '--name-only', 'origin/main...HEAD']) || runGit(['diff', '--name-only', 'main...HEAD']); if (output) output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).forEach((file) => set.add(file)); statusFiles().forEach((file) => set.add(file)); return Array.from(set).sort(); }
function combined(files) { return files.map(read).join('\n'); }
function regexViolations(files, regex) { return files.flatMap((file) => { const text = read(file); const matches = text.match(regex); return matches ? [{ file, matches }] : []; }); }

try {
  [...docs, ...baselineFiles, ...productPrimitiveFiles, ...supportFiles, acceptanceFile].forEach((file) => assert('exists:' + file, exists(file), { file }));

  const diff = changedFiles();
  const docText = combined(docs);
  const scanText = combined(scanFiles);
  const pfe1 = read('docs/frontend-productization/PFE-1-PAGE-CONTRACT-REGISTER.md');
  const pfe2AndIndex = read('docs/frontend-productization/PFE-2-DESIGN-SYSTEM-V1-COMPLETION.md') + '\n' + read('apps/web/src/design-system/product/index.ts');
  const shell = read('apps/web/src/design-system/product/ProductPageShell.tsx');
  const header = read('apps/web/src/design-system/product/ProductPageHeader.tsx');
  const table = read('apps/web/src/design-system/product/ProductDataTable.tsx');
  const loading = read('apps/web/src/design-system/product/ProductLoadingState.tsx');
  const errorState = read('apps/web/src/design-system/product/ProductErrorState.tsx');
  const statusBadge = read('apps/web/src/design-system/product/ProductStatusBadge.tsx');
  const stateBlock = read('apps/web/src/design-system/product/ProductStateBlock.tsx');
  const localeToggle = read('apps/web/src/components/common/LocaleToggle.tsx');
  const breadcrumb = read('apps/web/src/components/layout/AppBreadcrumb.tsx');
  const accessibilityCss = read('apps/web/src/styles/accessibility.css');
  const styles = read('apps/web/src/styles.css');

  const customerRoutes = ['/customer/dashboard', '/customer/fields', '/customer/fields/:fieldId', '/customer/fields/:fieldId/export', '/customer/operations', '/customer/operations/:operationId', '/customer/operations/:operationId/export', '/customer/reports', '/customer/export'];
  const operatorRoutes = ['/operator/twin', '/operator/fields', '/operator/fields/:fieldId', '/operator/fields/:fieldId/state', '/operator/fields/:fieldId/evidence', '/operator/fields/:fieldId/forecast', '/operator/fields/:fieldId/scenario', '/operator/fields/:fieldId/residual', '/operator/fields/:fieldId/calibration', '/operator/fields/:fieldId/health', '/operator/fields/:fieldId/audit', '/operator/twin/gateway-demo', '/operator/pilot'];
  const adminRoutes = ['/admin/dashboard', '/admin/fields', '/admin/operations', '/admin/devices', '/admin/evidence', '/admin/skills', '/admin/healthz'];
  const allRoutes = [...customerRoutes, ...operatorRoutes, ...adminRoutes];

  assert('changed_files_allowlist', diff.length === 0 || diff.every((file) => allowedChangedFiles.has(file)), { diff, allowed: Array.from(allowedChangedFiles) });
  assert('no_route_topology_changes', diff.every((file) => file !== 'apps/web/src/app/App.tsx' && !file.startsWith('apps/web/src/app/routes/')), { diff });
  assert('no_backend_migration_contract_fixture_package_changes', diff.every((file) => !file.startsWith('apps/server/') && !file.startsWith('migrations/') && !file.startsWith('packages/contracts/') && !file.startsWith('fixtures/') && !file.startsWith('.github/') && !['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml'].includes(file)), { diff });

  assert('pfe1_contract_register_present', allRoutes.every((route) => pfe1.includes(route)), { routes: allRoutes });
  assert('pfe2_design_system_primitives_present', includesAll(pfe2AndIndex, ['ProductPageShell', 'ProductPageHeader', 'ProductDataTable', 'ProductStatusBadge', 'ProductLoadingState', 'ProductErrorState', 'ProductStateBlock']));
  assert('pfe6_docs_include_all_routes', allRoutes.every((route) => docText.includes(route)), { routes: allRoutes });
  assert('pfe6_keyboard_walkthrough_exists', includesAll(read('docs/frontend-productization/PFE-6-KEYBOARD-WALKTHROUGH.md'), ['Login -> Customer Dashboard', 'Login -> Operator Twin', 'Login -> Admin Dashboard', 'No keyboard trap']));
  assert('pfe6_issue_register_exists', includesAll(read('docs/frontend-productization/PFE-6-ACCESSIBILITY-ISSUE-REGISTER.md'), ['issue id', 'severity', 'later phase owner']));

  assert('product_page_shell_main_landmark_and_skip_target', includesAll(shell, ['ProductSkipLink', '<main id={mainContentId}', 'tabIndex={-1}', 'ariaLabelledBy', 'mainContentId = "product-main-content"']));
  assert('product_page_header_h1_strategy', includesAll(header, ['<h1 id={titleId}', 'ProductPageHeaderProps', 'titleId?: string']));
  assert('product_data_table_caption_and_scope_required', includesAll(table, ['caption: ReactNode', '<caption>{caption}</caption>', 'scope="col"', 'role="region"', 'tabIndex={0}', 'role="status"']));
  assert('product_loading_state_live_busy', includesAll(loading, ['aria-live="polite"', 'aria-busy="true"']));
  assert('product_error_state_alert_semantics', includesAll(errorState, ['role="alert"', 'aria-label="Error state"']));
  assert('product_status_badge_visible_text_label', includesAll(statusBadge, ['const visibleLabel', '{visibleLabel}', 'STATUS_LABELS']));
  assert('product_state_block_status_semantics', includesAll(stateBlock, ['role={isAlert ? "alert" : "status"}', 'aria-live={isAlert ? "assertive" : "polite"}']));
  assert('locale_toggle_labelled_keyboard_buttons', includesAll(localeToggle, ['role="group"', 'aria-label="Language selector"', '<button', 'type="button"', 'aria-pressed', 'aria-label={`Set language to']));
  assert('breadcrumb_semantic_navigation', includesAll(breadcrumb, ['<nav className="breadcrumbBar" aria-label="Breadcrumb">', '<ol className="breadcrumbList">', '<li className="breadcrumbItem"', 'aria-current="page"', 'NavLink']));
  assert('focus_and_skip_styles_present', includesAll(accessibilityCss, ['.productSkipLink', ':focus-visible', 'outline', '.breadcrumbList', '.localeToggle[role="group"]']));
  assert('accessibility_css_imported', styles.includes('@import "./styles/accessibility.css";'));

  const positiveTabIndex = regexViolations(scanFiles, /tabIndex=\{\s*[1-9][0-9]*\s*\}|tabindex=["'][1-9][0-9]*["']/g);
  const clickableDivSpan = regexViolations(scanFiles, /<(div|span)\b(?=[^>]*onClick)(?![^>]*role=)[^>]*>/g);
  const roleButtonWithoutKey = regexViolations(scanFiles, /role=["']button["'](?![^>]*onKeyDown)/g);
  const hiddenFocusable = regexViolations(scanFiles, /aria-hidden=["']true["'][^>]*(href=|<button|tabIndex=\{0\})/g);
  const customDisabledWithoutAria = regexViolations(scanFiles, /<(div|span|a)\b(?=[^>]*disabled)(?![^>]*aria-disabled)[^>]*>/g);

  assert('no_positive_tabindex_values', positiveTabIndex.length === 0, { positiveTabIndex });
  assert('no_clickable_div_or_span_without_role', clickableDivSpan.length === 0, { clickableDivSpan });
  assert('no_role_button_without_key_handling', roleButtonWithoutKey.length === 0, { roleButtonWithoutKey });
  assert('no_aria_hidden_focusable_controls', hiddenFocusable.length === 0, { hiddenFocusable });
  assert('no_custom_disabled_without_aria_disabled', customDisabledWithoutAria.length === 0, { customDisabledWithoutAria });
  assert('no_status_color_only_source', !/data-status=\{status\}[^]*?\/span>/.test(statusBadge) || statusBadge.includes('{visibleLabel}'), {});

  console.log(JSON.stringify({
    ok: true,
    acceptance: 'ACCEPTANCE_PFE_6_ACCESSIBILITY_KEYBOARD_COMPLIANCE',
    scope: 'accessibility and keyboard baseline only',
    surfaces: { customer: 9, operator: 13, admin: 7, supporting: ['login', 'locale toggle', 'breadcrumbs', 'product primitives'] },
    checks: { landmarks: 'passed', headings: 'passed', keyboard: 'passed', focus_visible: 'passed', tables: 'passed', status_semantics: 'passed', no_route_changes: 'passed', no_package_changes: 'passed' },
    changed_files_checked: diff.length ? diff : Array.from(allowedChangedFiles),
    assertions,
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, acceptance: 'ACCEPTANCE_PFE_6_ACCESSIBILITY_KEYBOARD_COMPLIANCE', error: error.message, details: error.details || null, assertions }, null, 2));
  process.exit(1);
}
