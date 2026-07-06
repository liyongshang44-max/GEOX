// scripts/frontend_acceptance/ACCEPTANCE_PFE_2_DESIGN_SYSTEM_V1_COMPLETION.cjs
'use strict';

// Purpose: statically verify PFE-2 Product Design System v1 artifacts.
// Boundary: this script reads repository files only and does not start apps, call APIs, connect DBs, or write files.
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();

const docs = [
  'docs/frontend-productization/PFE-2-DESIGN-SYSTEM-V1-COMPLETION.md',
  'docs/frontend-productization/PFE-2-DESIGN-SYSTEM-INVENTORY.md',
  'docs/frontend-productization/PFE-2-DESIGN-TOKENS.md',
  'docs/frontend-productization/PFE-2-PRODUCT-PRIMITIVES.md',
];

const primitiveFiles = [
  'apps/web/src/design-system/product/index.ts',
  'apps/web/src/design-system/product/ProductPageShell.tsx',
  'apps/web/src/design-system/product/ProductPageHeader.tsx',
  'apps/web/src/design-system/product/ProductSectionCard.tsx',
  'apps/web/src/design-system/product/ProductBoundaryBanner.tsx',
  'apps/web/src/design-system/product/ProductStatusBadge.tsx',
  'apps/web/src/design-system/product/ProductMetricTile.tsx',
  'apps/web/src/design-system/product/ProductDataTable.tsx',
  'apps/web/src/design-system/product/ProductEmptyState.tsx',
  'apps/web/src/design-system/product/ProductLoadingState.tsx',
  'apps/web/src/design-system/product/ProductErrorState.tsx',
  'apps/web/src/design-system/product/ProductStateBlock.tsx',
  'apps/web/src/design-system/product/ProductTraceLink.tsx',
  'apps/web/src/design-system/product/ProductScopeBar.tsx',
];

const pfe1Register = 'docs/frontend-productization/PFE-1-PAGE-CONTRACT-REGISTER.md';
const cssFile = 'apps/web/src/styles/productDesignSystem.css';
const acceptanceFile = 'scripts/frontend_acceptance/ACCEPTANCE_PFE_2_DESIGN_SYSTEM_V1_COMPLETION.cjs';
const allowedChangedFiles = new Set([...docs, ...primitiveFiles, pfe1Register, cssFile, acceptanceFile]);

const blockedPrefixes = ['apps/server/', 'migrations/', 'packages/contracts/', 'fixtures/', '.github/'];
const pagePrefixes = ['apps/web/src/app/', 'apps/web/src/routes/', 'apps/web/src/features/', 'apps/web/src/layouts/'];
const blockedExactFiles = new Set(['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml']);

const primitiveNames = [
  'ProductPageShell',
  'ProductPageHeader',
  'ProductSectionCard',
  'ProductBoundaryBanner',
  'ProductStatusBadge',
  'ProductMetricTile',
  'ProductDataTable',
  'ProductEmptyState',
  'ProductLoadingState',
  'ProductErrorState',
  'ProductStateBlock',
  'ProductTraceLink',
  'ProductScopeBar',
];

const requiredTokens = [
  '--product-surface-bg',
  '--product-surface-panel',
  '--product-surface-border',
  '--product-text-primary',
  '--product-text-secondary',
  '--product-text-muted',
  '--product-focus-ring',
  '--product-radius-sm',
  '--product-radius-md',
  '--product-radius-lg',
  '--product-space-1',
  '--product-space-2',
  '--product-space-3',
  '--product-space-4',
  '--product-space-6',
  '--product-font-size-xs',
  '--product-font-size-sm',
  '--product-font-size-md',
  '--product-font-size-lg',
  '--product-font-size-xl',
  '--product-line-height',
  '--product-shadow-panel',
  '--product-status-neutral',
  '--product-status-readonly',
  '--product-status-replay',
  '--product-status-disabled',
  '--product-status-degraded',
  '--product-status-blocked',
];

const requiredClasses = [
  '.productPageShell',
  '.productPageHeader',
  '.productSectionCard',
  '.productBoundaryBanner',
  '.productStatusBadge',
  '.productMetricTile',
  '.productDataTable',
  '.productEmptyState',
  '.productLoadingState',
  '.productErrorState',
  '.productStateBlock',
  '.productTraceLink',
  '.productScopeBar',
];

const allowedStatuses = [
  'available',
  'unavailable',
  'partial',
  'readOnly',
  'replayBacked',
  'notConnected',
  'notOnline',
  'disabled',
  'degraded',
  'blocked',
  'future',
  'urlOnly',
  'doNotBuild',
];

const allowedBoundaryTones = ['neutral', 'readOnly', 'replayBacked', 'disabled', 'degraded', 'blocked'];
const requiredStateKinds = ['empty', 'loading', 'error', 'unavailable', 'degraded', 'permissionLimited', 'replayBacked', 'notConnected', 'notOnline', 'disabled', 'future', 'urlOnly', 'doNotBuild'];

const assertions = [];

function repoPath(file) {
  return path.join(root, file);
}

function exists(file) {
  return fs.existsSync(repoPath(file));
}

function read(file) {
  return fs.readFileSync(repoPath(file), 'utf8');
}

function lower(value) {
  return String(value).toLowerCase();
}

function includesAll(text, tokens) {
  const haystack = lower(text);
  return tokens.every((token) => haystack.includes(lower(token)));
}

function assert(name, passed, details = {}) {
  assertions.push({ name, passed: passed === true, details });
  if (passed !== true) {
    const error = new Error('ASSERTION_FAILED:' + name);
    error.details = details;
    throw error;
  }
  console.log('[pfe-2-design-system-v1-completion] ok:', name);
}

function tryGit(args) {
  try {
    return cp.execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch (_error) {
    return '';
  }
}

function statusFiles() {
  const output = tryGit(['status', '--short', '--untracked-files=all']);
  if (!output) return [];
  return output.split(/\r?\n/).map((line) => {
    if (!line.trim()) return '';
    const renameArrow = line.indexOf(' -> ');
    if (renameArrow >= 0) return line.slice(renameArrow + 4).trim();
    return line.replace(/^[ MADRCU?!]{1,2}\s+/, '').trim();
  }).filter(Boolean);
}

function changedFiles() {
  const found = new Set();
  const output = tryGit(['diff', '--name-only', 'origin/main...HEAD']) || tryGit(['diff', '--name-only', 'main...HEAD']);
  if (output) output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).forEach((file) => found.add(file));
  statusFiles().forEach((file) => found.add(file));
  return Array.from(found).sort();
}

function assertNoText(text, tokens, name) {
  const haystack = lower(text);
  const violations = tokens.filter((token) => haystack.includes(lower(token)));
  assert(name, violations.length === 0, { violations });
}

function joinedPrimitiveSource() {
  return primitiveFiles.map(read).join('\n');
}

function joinParts(parts) {
  return parts.join('');
}

try {
  [...docs, ...primitiveFiles, pfe1Register, cssFile, acceptanceFile].forEach((file) => assert('exists:' + file, exists(file), { file }));

  const diff = changedFiles();
  const overview = read(docs[0]);
  const inventory = read(docs[1]);
  const tokensDoc = read(docs[2]);
  const primitivesDoc = read(docs[3]);
  const register = read(pfe1Register);
  const indexSource = read('apps/web/src/design-system/product/index.ts');
  const statusSource = read('apps/web/src/design-system/product/ProductStatusBadge.tsx');
  const boundarySource = read('apps/web/src/design-system/product/ProductBoundaryBanner.tsx');
  const stateSource = read('apps/web/src/design-system/product/ProductStateBlock.tsx');
  const tableSource = read('apps/web/src/design-system/product/ProductDataTable.tsx');
  const loadingSource = read('apps/web/src/design-system/product/ProductLoadingState.tsx');
  const errorSource = read('apps/web/src/design-system/product/ProductErrorState.tsx');
  const primitiveSource = joinedPrimitiveSource();
  const css = read(cssFile);

  assert('changed_files_allowlist', diff.length === 0 || diff.every((file) => allowedChangedFiles.has(file)), { diff, allowed: Array.from(allowedChangedFiles) });
  assert('blocked_files_unchanged', diff.every((file) => !blockedPrefixes.some((prefix) => file.startsWith(prefix)) && !blockedExactFiles.has(file)), { diff });
  assert('no_route_or_page_changes', diff.every((file) => !pagePrefixes.some((prefix) => file.startsWith(prefix))), { diff });
  assert('no_package_changes', diff.every((file) => !blockedExactFiles.has(file)), { diff });

  assert('pfe1_contract_register_present', includesAll(register, ['/customer/dashboard', '/operator/twin', '/admin/dashboard', 'contract closed']));
  assert('overview_has_required_sections', includesAll(overview, ['Phase', 'Goal', 'Source baseline', 'Non-goals', 'Deliverables', 'Allowed files', 'Forbidden files', 'CSS and token rules', 'Boundary rules', 'Acceptance', 'Completion statement']));
  assert('overview_completion_statement_present', includesAll(overview, ['Product Design System v1 primitives are available for later PFE productization phases']));
  assert('inventory_records_all_primitives', primitiveNames.every((name) => inventory.includes(name)), { missing: primitiveNames.filter((name) => !inventory.includes(name)) });
  assert('tokens_doc_records_required_tokens', requiredTokens.every((token) => tokensDoc.includes(token)), { missing: requiredTokens.filter((token) => !tokensDoc.includes(token)) });
  assert('primitives_doc_records_usage_guidance', includesAll(primitivesDoc, ['Customer Portal', 'Operator Runtime Console', 'Admin Console', 'Export', 'ProductBoundaryBanner', 'ProductTraceLink']));

  assert('index_exports_all_primitives', primitiveNames.every((name) => indexSource.includes('export { ' + name + ' }')), { missing: primitiveNames.filter((name) => !indexSource.includes('export { ' + name + ' }')) });
  assert('css_defines_required_tokens', requiredTokens.every((token) => css.includes(token + ':')), { missing: requiredTokens.filter((token) => !css.includes(token + ':')) });
  assert('css_defines_required_classes', requiredClasses.every((klass) => css.includes(klass)), { missing: requiredClasses.filter((klass) => !css.includes(klass)) });

  assert('status_badge_approved_semantics', allowedStatuses.every((status) => statusSource.includes('"' + status + '"')), { missing: allowedStatuses.filter((status) => !statusSource.includes('"' + status + '"')) });
  assert('boundary_banner_approved_tones', allowedBoundaryTones.every((tone) => boundarySource.includes('"' + tone + '"')), { missing: allowedBoundaryTones.filter((tone) => !boundarySource.includes('"' + tone + '"')) });
  assert('state_block_required_kinds', requiredStateKinds.every((kind) => stateSource.includes('"' + kind + '"')), { missing: requiredStateKinds.filter((kind) => !stateSource.includes('"' + kind + '"')) });

  assert('data_table_has_caption_and_aria_semantics', includesAll(tableSource, ['<caption>', 'scope="col"', 'role="region"', 'tabIndex={0}']));
  assert('loading_state_has_aria_live', includesAll(loadingSource, ['aria-live="polite"', 'aria-busy="true"']));
  assert('error_state_has_safe_message_and_trace_id', includesAll(errorSource, ['message: ReactNode', 'traceId?: string', 'role="alert"']));

  assertNoText(css, ['red', 'green', 'yellow', 'danger', 'success', 'risk-red', 'priority-high', 'dispatch-active', 'ao-act-ready', 'live-online', 'production-online'], 'css_has_no_forbidden_semantic_tokens');
  assertNoText(primitiveSource, ['createRecommendation', 'createAoAct', 'writeRoi', 'writeFieldMemory', 'dispatchActive', 'liveOnline', 'productionOnline'], 'primitive_source_has_no_forbidden_action_semantics');
  assertNoText(read(acceptanceFile), [joinParts(['write', 'FileSync(']), joinParts(['append', 'FileSync(']), joinParts(['fet', 'ch('])], 'acceptance_is_static_repo_read_only');

  console.log(JSON.stringify({
    ok: true,
    acceptance: 'ACCEPTANCE_PFE_2_DESIGN_SYSTEM_V1_COMPLETION',
    scope: 'static PFE-2 Product Design System v1 completion only',
    primitives: primitiveNames.length,
    docs: docs.length,
    css: cssFile,
    changed_files_checked: diff.length > 0 ? diff : Array.from(allowedChangedFiles),
    assertions,
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    acceptance: 'ACCEPTANCE_PFE_2_DESIGN_SYSTEM_V1_COMPLETION',
    error: error.message,
    details: error.details || null,
    assertions,
  }, null, 2));
  process.exit(1);
}
