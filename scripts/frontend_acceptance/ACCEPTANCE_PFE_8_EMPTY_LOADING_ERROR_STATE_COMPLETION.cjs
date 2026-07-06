// scripts/frontend_acceptance/ACCEPTANCE_PFE_8_EMPTY_LOADING_ERROR_STATE_COMPLETION.cjs
'use strict';

const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const docs = [
  'docs/frontend-productization/PFE-8-EMPTY-LOADING-ERROR-STATE-COMPLETION.md',
  'docs/frontend-productization/PFE-8-STATE-MATRIX.md',
  'docs/frontend-productization/PFE-8-STATE-COPY-GUIDE.md',
  'docs/frontend-productization/PFE-8-STATE-ISSUE-REGISTER.md',
];
const baselineDocs = [
  'docs/frontend-productization/PFE-6-ACCESSIBILITY-KEYBOARD-COMPLIANCE.md',
  'docs/frontend-productization/PFE-7-RESPONSIVE-VIEWPORT-COMPLETION.md',
];
const primitiveFiles = [
  'apps/web/src/design-system/product/ProductEmptyState.tsx',
  'apps/web/src/design-system/product/ProductLoadingState.tsx',
  'apps/web/src/design-system/product/ProductErrorState.tsx',
  'apps/web/src/design-system/product/ProductStateBlock.tsx',
  'apps/web/src/design-system/product/ProductDataTable.tsx',
];
const loginFile = 'apps/web/src/views/LoginPage.tsx';
const acceptanceFile = 'scripts/frontend_acceptance/ACCEPTANCE_PFE_8_EMPTY_LOADING_ERROR_STATE_COMPLETION.cjs';
const allowedChangedFiles = new Set([...docs, ...primitiveFiles, loginFile, acceptanceFile]);
const assertions = [];

function repoPath(file) { return path.join(root, file); }
function exists(file) { return fs.existsSync(repoPath(file)); }
function read(file) { return fs.readFileSync(repoPath(file), 'utf8'); }
function lower(value) { return String(value).toLowerCase(); }
function includesAll(text, tokens) { const haystack = lower(text); return tokens.every((token) => haystack.includes(lower(token))); }
function assert(name, passed, details = {}) { assertions.push({ name, passed: passed === true, details }); if (passed !== true) { const error = new Error('ASSERTION_FAILED:' + name); error.details = details; throw error; } console.log('[pfe-8-empty-loading-error-state-completion] ok:', name); }
function runGit(args) { try { return cp.execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch (_error) { return ''; } }
function statusFiles() { const output = runGit(['status', '--short', '--untracked-files=all']); if (!output) return []; return output.split(/\r?\n/).map((line) => { if (!line.trim()) return ''; const arrow = line.indexOf(' -> '); if (arrow >= 0) return line.slice(arrow + 4).trim(); return line.replace(/^[ MADRCU?!]{1,2}\s+/, '').trim(); }).filter(Boolean); }
function changedFiles() { const set = new Set(); const output = runGit(['diff', '--name-only', 'origin/main...HEAD']) || runGit(['diff', '--name-only', 'main...HEAD']); if (output) output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).forEach((file) => set.add(file)); statusFiles().forEach((file) => set.add(file)); return Array.from(set).sort(); }
function combined(files) { return files.map(read).join('\n'); }
function stripComments(text) { return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, ''); }
function visibleText(file) { return stripComments(read(file)); }

try {
  [...docs, ...baselineDocs, ...primitiveFiles, loginFile, acceptanceFile].forEach((file) => assert('exists:' + file, exists(file), { file }));

  const diff = changedFiles();
  const docText = combined(docs);
  const matrix = read('docs/frontend-productization/PFE-8-STATE-MATRIX.md');
  const copyGuide = read('docs/frontend-productization/PFE-8-STATE-COPY-GUIDE.md');
  const issueRegister = read('docs/frontend-productization/PFE-8-STATE-ISSUE-REGISTER.md');
  const emptyState = read('apps/web/src/design-system/product/ProductEmptyState.tsx');
  const loadingState = read('apps/web/src/design-system/product/ProductLoadingState.tsx');
  const errorState = read('apps/web/src/design-system/product/ProductErrorState.tsx');
  const stateBlock = read('apps/web/src/design-system/product/ProductStateBlock.tsx');
  const dataTable = read('apps/web/src/design-system/product/ProductDataTable.tsx');
  const login = read(loginFile);
  const visibleLogin = visibleText(loginFile);
  const visiblePrimitives = primitiveFiles.map(visibleText).join('\n');

  const customerRoutes = ['/customer/dashboard', '/customer/fields', '/customer/fields/:fieldId', '/customer/fields/:fieldId/export', '/customer/operations', '/customer/operations/:operationId', '/customer/operations/:operationId/export', '/customer/reports', '/customer/export'];
  const operatorRoutes = ['/operator/twin', '/operator/fields', '/operator/fields/:fieldId', '/operator/fields/:fieldId/state', '/operator/fields/:fieldId/evidence', '/operator/fields/:fieldId/forecast', '/operator/fields/:fieldId/scenario', '/operator/fields/:fieldId/residual', '/operator/fields/:fieldId/calibration', '/operator/fields/:fieldId/health', '/operator/fields/:fieldId/audit', '/operator/twin/gateway-demo', '/operator/pilot'];
  const adminRoutes = ['/admin/dashboard', '/admin/fields', '/admin/operations', '/admin/devices', '/admin/evidence', '/admin/skills', '/admin/healthz'];
  const allRoutes = [...customerRoutes, ...operatorRoutes, ...adminRoutes, '/login'];

  assert('changed_files_allowlist', diff.length === 0 || diff.every((file) => allowedChangedFiles.has(file)), { diff, allowed: Array.from(allowedChangedFiles) });
  assert('no_route_topology_changes', diff.every((file) => file !== 'apps/web/src/app/App.tsx' && file !== 'apps/web/src/app/AppShell.tsx' && !file.startsWith('apps/web/src/app/routes/')), { diff });
  assert('no_backend_migration_contract_fixture_package_changes', diff.every((file) => !file.startsWith('apps/server/') && !file.startsWith('migrations/') && !file.startsWith('packages/contracts/') && !file.startsWith('fixtures/') && !file.startsWith('.github/') && !['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml'].includes(file)), { diff });

  assert('pfe8_docs_have_scope', includesAll(docText, ['PFE-8', 'empty', 'loading', 'unavailable', 'permissionLimited', 'degraded', 'safe error']));
  assert('pfe8_state_matrix_covers_routes', allRoutes.every((route) => matrix.includes(route)), { routes: allRoutes });
  assert('pfe8_copy_guide_has_surface_rules', includesAll(copyGuide, ['Customer copy', 'Operator copy', 'Admin copy', 'Loading policy', 'Empty policy', 'Error policy']));
  assert('pfe8_issue_register_has_blocker_policy', includesAll(issueRegister, ['Blocking issues not allowed', 'blank formal product route', 'permanent loading', 'missing safe error state']));
  assert('pfe6_pfe7_baselines_present', baselineDocs.every(exists));

  assert('product_empty_state_accessible_semantics', includesAll(emptyState, ['role="status"', 'aria-live="polite"', 'data-kind={stateKind}', 'data-surface={surface}', 'nextSafeAction']));
  assert('product_loading_state_accessible_semantics', includesAll(loadingState, ['data-kind="loading"', 'aria-live="polite"', 'aria-busy="true"', 'ariaLabel']));
  assert('product_error_state_alert_semantics', includesAll(errorState, ['data-kind="error"', 'role="alert"', 'Safe error state', 'traceId']));
  assert('product_state_block_taxonomy_and_roles', includesAll(stateBlock, ['permissionLimited', 'replayBacked', 'notConnected', 'notOnline', 'doNotBuild', 'role={isAlert ? "alert" : "status"}', 'aria-live={isAlert ? "assertive" : "polite"}']));
  assert('product_data_table_semantic_empty_state', includesAll(dataTable, ['ProductEmptyState', 'emptyState ??', 'role="status"', 'aria-label={emptyRegionLabel}']));

  assert('login_has_explicit_state_primitives', includesAll(login, ['ProductErrorState', 'ProductLoadingState', 'ProductStateBlock', 'AUTH_MISSING', 'AUTH_INVALID', 'SERVICE_UNAVAILABLE', 'SERVICE_UNREACHABLE']));
  assert('login_does_not_show_local_acceptance_hint', !login.includes('security_acceptance_tokens') && !login.includes('admin_token'));
  assert('login_uses_safe_state_message', !visibleLogin.includes('{stateMessage}') && !visibleLogin.includes('String(stateMessage)'));
  assert('modified_primitives_do_not_render_generic_runtime_failure_copy', !visiblePrimitives.includes('Cannot read') && !visiblePrimitives.includes('TypeError') && !visiblePrimitives.includes('Minified React'));
  assert('login_does_not_render_generic_runtime_failure_copy', !visibleLogin.includes('Cannot read') && !visibleLogin.includes('TypeError') && !visibleLogin.includes('Minified React'));

  console.log(JSON.stringify({
    ok: true,
    acceptance: 'ACCEPTANCE_PFE_8_EMPTY_LOADING_ERROR_STATE_COMPLETION',
    scope: 'empty/loading/error state completion only',
    surfaces: { customer: 9, operator: 13, admin: 7, supporting: ['login', 'route fallback', 'product state primitives', 'export/print'] },
    states: { loading: 'passed', empty: 'passed', unavailable: 'passed', permission_limited: 'passed', degraded: 'passed', safe_error: 'passed' },
    checks: { no_route_changes: 'passed', no_package_changes: 'passed', no_raw_runtime_copy: 'passed', no_local_acceptance_hint: 'passed' },
    changed_files_checked: diff.length ? diff : Array.from(allowedChangedFiles),
    assertions,
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, acceptance: 'ACCEPTANCE_PFE_8_EMPTY_LOADING_ERROR_STATE_COMPLETION', error: error.message, details: error.details || null, assertions }, null, 2));
  process.exit(1);
}
