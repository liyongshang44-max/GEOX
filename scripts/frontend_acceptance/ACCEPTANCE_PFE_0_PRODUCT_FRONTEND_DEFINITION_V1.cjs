// scripts/frontend_acceptance/ACCEPTANCE_PFE_0_PRODUCT_FRONTEND_DEFINITION_V1.cjs
'use strict';

// Purpose: statically verify the PFE-0 Product Frontend Definition and Page Audit Matrix.
// Boundary: this script reads repository files only; it does not start apps, call APIs, connect DBs, or write files.
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

// Purpose: resolve all checks from the repository root used by the caller.
const root = process.cwd();

// Purpose: define the only files PFE-0 is allowed to add or change.
const pfeFiles = {
  definition: 'docs/frontend-productization/PFE-0-PRODUCT-FRONTEND-DEFINITION.md',
  matrix: 'docs/frontend-productization/PFE-0-PAGE-AUDIT-MATRIX.md',
  acceptance: 'scripts/frontend_acceptance/ACCEPTANCE_PFE_0_PRODUCT_FRONTEND_DEFINITION_V1.cjs',
};

// Purpose: define the source-of-truth files that PFE-0 must audit rather than replace.
const sourceFiles = {
  app: 'apps/web/src/app/App.tsx',
  operatorFieldRuntimeRoutes: 'apps/web/src/app/routes/operatorFieldRuntimeRoutes.tsx',
  fieldsRoutes: 'apps/web/src/app/routes/fieldsRoutes.tsx',
  customerOperationsRoutes: 'apps/web/src/app/routes/customerOperationsRoutes.tsx',
  h67Manifest: 'docs/frontend-productization/H67-FRONTEND-ROUTE-SURFACE-MANIFEST.md',
  f0aPageGap: 'docs/frontend-productization/F0-A-PAGE-GAP-REGISTER.md',
  f0bFreeze: 'docs/frontend-productization/F0-B-FRONTEND-PRODUCTIZATION-FREEZE.md',
};

// Purpose: preserve the PFE-0 file allowlist.
const allowedChangedFiles = new Set(Object.values(pfeFiles));

// Purpose: block all runtime, backend, migration, contract, fixture, and workflow changes.
const blockedPrefixes = ['apps/web/src/', 'apps/server/', 'migrations/', 'packages/contracts/', 'fixtures/', '.github/'];

// Purpose: block package and workspace changes.
const blockedExactFiles = new Set(['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml']);

// Purpose: keep structured assertion records for JSON output.
const assertions = [];

// Purpose: resolve a repository-relative path to an absolute local path.
function repoPath(file) {
  return path.join(root, file);
}

// Purpose: test whether a repository file exists.
function exists(file) {
  return fs.existsSync(repoPath(file));
}

// Purpose: read a repository file as UTF-8 text.
function read(file) {
  return fs.readFileSync(repoPath(file), 'utf8');
}

// Purpose: normalize values for case-insensitive checks.
function lower(value) {
  return String(value).toLowerCase();
}

// Purpose: require all tokens to appear in a text block.
function includesAll(text, tokens) {
  const haystack = lower(text);
  return tokens.every((token) => haystack.includes(lower(token)));
}

// Purpose: escape literal route strings before building regular expressions.
function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Purpose: find the markdown table row for a route or named surface.
function findMatrixRow(matrix, routeOrSurface) {
  const exact = new RegExp('^\\|\\s*' + escapeRegExp(routeOrSurface) + '\\s*\\|', 'm');
  return matrix.split(/\r?\n/).find((line) => exact.test(line)) || '';
}

// Purpose: record and enforce an assertion.
function assert(name, passed, details = {}) {
  assertions.push({ name, passed: passed === true, details });
  if (passed !== true) {
    const error = new Error('ASSERTION_FAILED:' + name);
    error.details = details;
    throw error;
  }
  console.log('[pfe-0-product-frontend-definition] ok:', name);
}

// Purpose: execute git commands for static diff inspection while tolerating non-git environments.
function tryGit(args) {
  try {
    return cp.execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch (_error) {
    return '';
  }
}

// Purpose: parse git status paths, including untracked local files.
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

// Purpose: collect branch diff files plus local working-tree files when available.
function changedFiles() {
  const found = new Set();
  const diffCandidates = [
    ['diff', '--name-only', 'origin/main...HEAD'],
    ['diff', '--name-only', 'main...HEAD'],
  ];
  for (const args of diffCandidates) {
    const output = tryGit(args);
    if (output) {
      output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).forEach((file) => found.add(file));
      break;
    }
  }
  statusFiles().forEach((file) => found.add(file));
  return Array.from(found).sort();
}

// Purpose: decide whether a changed file is forbidden in PFE-0.
function isBlocked(file) {
  return blockedExactFiles.has(file) || blockedPrefixes.some((prefix) => file.startsWith(prefix));
}

// Purpose: assert that a matrix row exists and has the expected classification.
function assertClassification(matrix, routeOrSurface, classification) {
  const row = findMatrixRow(matrix, routeOrSurface);
  assert('matrix_row_exists:' + routeOrSurface, row.length > 0, { routeOrSurface });
  assert('matrix_classification:' + routeOrSurface, lower(row).includes(lower('| ' + classification + ' |')), { routeOrSurface, classification, row });
}

// Purpose: assert that a set of routes or named surfaces is present in the matrix.
function assertMatrixIncludesAll(matrix, values, label) {
  const missing = values.filter((value) => !matrix.includes(value));
  assert('matrix_includes_' + label, missing.length === 0, { missing });
}

// Purpose: prove the gate does not grow network, server, DB, or write behavior.
function assertStaticReadOnlyAcceptance(acceptanceText) {
  const forbiddenTokenParts = [
    ['fet', 'ch('],
    ['.lis', 'ten('],
    ['new Web', 'Socket'],
    ['pg.', 'Client'],
    ['Po', 'ol('],
    ['write', 'FileSync('],
    ['append', 'FileSync('],
  ];
  const forbiddenTokens = forbiddenTokenParts.map((parts) => parts.join(''));
  const violations = forbiddenTokens.filter((token) => acceptanceText.includes(token));
  assert('acceptance_is_static_repo_read_only', violations.length === 0, { violations });
}

try {
  // Purpose: verify all owned artifacts and source-of-truth files exist.
  Object.values({ ...pfeFiles, ...sourceFiles }).forEach((file) => assert('exists:' + file, exists(file), { file }));

  // Purpose: load all files needed for static validation.
  const definition = read(pfeFiles.definition);
  const matrix = read(pfeFiles.matrix);
  const acceptanceText = read(pfeFiles.acceptance);
  const app = read(sourceFiles.app);
  const operatorFieldRuntimeRoutes = read(sourceFiles.operatorFieldRuntimeRoutes);
  const fieldsRoutes = read(sourceFiles.fieldsRoutes);
  const customerOperationsRoutes = read(sourceFiles.customerOperationsRoutes);
  const h67Manifest = read(sourceFiles.h67Manifest);
  const f0aPageGap = read(sourceFiles.f0aPageGap);
  const f0bFreeze = read(sourceFiles.f0bFreeze);

  // Purpose: enforce the PFE-0 no-source-change boundary.
  const diff = changedFiles();
  assert('changed_files_allowlist', diff.length === 0 || diff.every((file) => allowedChangedFiles.has(file)), { diff, allowed: Array.from(allowedChangedFiles) });
  assert('blocked_files_unchanged', diff.every((file) => !isBlocked(file)), { diff });
  assert('no_apps_web_src_changes', diff.every((file) => !file.startsWith('apps/web/src/')), { diff });
  assert('no_apps_server_changes', diff.every((file) => !file.startsWith('apps/server/')), { diff });
  assert('no_migrations_changes', diff.every((file) => !file.startsWith('migrations/')), { diff });
  assert('no_packages_contracts_changes', diff.every((file) => !file.startsWith('packages/contracts/')), { diff });
  assert('no_fixtures_changes', diff.every((file) => !file.startsWith('fixtures/')), { diff });
  assert('no_package_changes', diff.every((file) => !blockedExactFiles.has(file)), { diff });

  // Purpose: validate definition document requirements.
  assert('definition_source_of_truth_priority', includesAll(definition, [
    'PFE-0 does not define routes from memory.',
    'PFE-0 audits the current repository route inventory.',
    'apps/web/src/app/App.tsx',
    'apps/web/src/app/routes/operatorFieldRuntimeRoutes.tsx',
    'apps/web/src/app/routes/fieldsRoutes.tsx',
    'apps/web/src/app/routes/customerOperationsRoutes.tsx',
    'docs/frontend-productization/H67-FRONTEND-ROUTE-SURFACE-MANIFEST.md',
    'docs/frontend-productization/F0-A-PAGE-GAP-REGISTER.md',
    'docs/frontend-productization/F0-B-FRONTEND-PRODUCTIZATION-FREEZE.md',
  ]));
  assert('definition_classification_vocabulary', includesAll(definition, ['formal v1 page', 'formal sub-surface', 'export / print secondary surface', 'URL-only compatibility', 'future product-contract page', 'do-not-build page']));
  assert('definition_non_goals', includesAll(definition, ['PFE-0 is not a page repair phase.', 'PFE-0 is not frontend source refactoring.', 'PFE-0 is not route topology work.', 'PFE-0 is not UI redesign.', 'PFE-0 is not accessibility repair.', 'PFE-0 is not responsive repair.', 'PFE-0 is not Playwright coverage.', 'PFE-0 is not visual regression automation.', 'PFE-0 is not runtime readiness.', 'PFE-0 is not Silicon-Valley-grade completion.']));
  assert('definition_final_pfe_goal', includesAll(definition, ['A role-separated, bilingual, accessible, responsive, visually coherent, regression-testable, demo-ready, boundary-safe enterprise product frontend.', '一个角色分离、支持中英文、可访问、响应式、视觉一致、可回归测试、可演示、边界安全的企业级产品前端。']));
  assert('definition_completion_statement', includesAll(definition, ['The current frontend route/page inventory has been audited, classified, and bounded for the Product Frontend Excellence line.', '当前前端 route / page / surface 已经完成产品前端线的审计、分类和边界冻结。']));

  // Purpose: validate matrix sections and required field schema.
  assert('matrix_sections_present', includesAll(matrix, ['Customer Portal', 'Operator Runtime Console', 'Admin Console', 'Future Product-Contract Pages', 'Do-Not-Build Pages']));
  assert('matrix_schema_fields_present', includesAll(matrix, ['route / surface', 'classification', 'current status', 'owner', 'primary user', 'data source / source owner', 'allowed actions', 'forbidden actions', 'boundary / nonclaims', 'locale status', 'accessibility status', 'responsive status', 'empty/loading/error state status', 'screenshot / visual baseline status', 'release status', 'next PFE owner phase']));

  // Purpose: validate Customer Portal inventory and classifications.
  const customerRoutes = ['/customer/dashboard', '/customer/fields', '/customer/fields/:fieldId', '/customer/fields/:fieldId/export', '/customer/operations', '/customer/operations/:operationId', '/customer/operations/:operationId/export', '/customer/reports', '/customer/export'];
  assertMatrixIncludesAll(matrix, customerRoutes, 'customer_routes');
  assertClassification(matrix, '/customer/dashboard', 'formal v1 page');
  assertClassification(matrix, '/customer/fields', 'formal v1 page');
  assertClassification(matrix, '/customer/fields/:fieldId', 'formal sub-surface');
  assertClassification(matrix, '/customer/fields/:fieldId/export', 'export / print secondary surface');
  assertClassification(matrix, '/customer/operations', 'formal v1 page');
  assertClassification(matrix, '/customer/operations/:operationId', 'formal sub-surface');
  assertClassification(matrix, '/customer/operations/:operationId/export', 'export / print secondary surface');
  assertClassification(matrix, '/customer/reports', 'formal v1 page');
  assertClassification(matrix, '/customer/export', 'export / print secondary surface');

  // Purpose: validate Operator Runtime Console inventory and classifications.
  const operatorRoutes = ['/operator/twin', '/operator/fields', '/operator/fields/:fieldId', '/operator/fields/:fieldId/state', '/operator/fields/:fieldId/evidence', '/operator/fields/:fieldId/forecast', '/operator/fields/:fieldId/scenario', '/operator/fields/:fieldId/residual', '/operator/fields/:fieldId/calibration', '/operator/fields/:fieldId/health', '/operator/fields/:fieldId/audit', '/operator/twin/gateway-demo', '/operator/pilot'];
  assertMatrixIncludesAll(matrix, operatorRoutes, 'operator_routes');
  assertClassification(matrix, '/operator/twin', 'formal v1 page');
  assertClassification(matrix, '/operator/fields', 'formal v1 page');
  operatorRoutes.slice(2, 11).forEach((route) => assertClassification(matrix, route, 'formal sub-surface'));
  assertClassification(matrix, '/operator/twin/gateway-demo', 'formal v1 page');
  assertClassification(matrix, '/operator/pilot', 'formal v1 page');

  // Purpose: validate Admin Console formal and compatibility inventory.
  const adminFormalRoutes = ['/admin/dashboard', '/admin/fields', '/admin/operations', '/admin/devices', '/admin/evidence', '/admin/skills', '/admin/healthz'];
  const adminCompatibilityRoutes = ['/admin/alerts', '/admin/acceptance', '/admin/import', '/admin/operations/:operationId/debug'];
  assertMatrixIncludesAll(matrix, adminFormalRoutes, 'admin_formal_routes');
  assertMatrixIncludesAll(matrix, adminCompatibilityRoutes, 'admin_compatibility_routes');
  adminFormalRoutes.forEach((route) => assertClassification(matrix, route, 'formal v1 page'));
  adminCompatibilityRoutes.forEach((route) => assertClassification(matrix, route, 'URL-only compatibility'));
  ['/legacy/*', '/judge/*', '/sim/*', '/settings', '/dev'].forEach((route) => assertClassification(matrix, route, 'URL-only compatibility'));

  // Purpose: validate future product-contract pages.
  const futurePages = ['/operator/evidence', '/operator/health', '/operator/settings', '/customer/evidence-summary', '/admin/tenants', '/admin/imports', '/admin/audit', '/admin/config', '/admin/health'];
  assertMatrixIncludesAll(matrix, futurePages, 'future_product_contract_pages');
  futurePages.forEach((route) => assertClassification(matrix, route, 'future product-contract page'));

  // Purpose: validate do-not-build formal-surface prohibitions.
  const doNotBuildPages = ['Customer Dispatch', 'Customer AO-ACT', 'Customer ROI Ledger', 'Customer Field Memory', 'Operator Dispatch Console', 'Operator AO-ACT Control', 'Operator Live Device Monitor', 'Operator Production Gateway Online', 'Operator Field Pilot Execution', 'Admin Debug Formal Page', 'Admin Acceptance Formal Nav Page', 'Legacy Dev Tools Formal Page'];
  assertMatrixIncludesAll(matrix, doNotBuildPages, 'do_not_build_pages');
  doNotBuildPages.forEach((surface) => assertClassification(matrix, surface, 'do-not-build page'));

  // Purpose: validate that the matrix is grounded in current route and governance sources.
  assert('source_fields_routes_include_customer_exports', includesAll(fieldsRoutes, ['path="/customer/fields/:fieldId"', 'path="/customer/fields/:fieldId/export"']));
  assert('source_customer_operations_routes_include_export', includesAll(customerOperationsRoutes, ['path="/customer/operations/:operationId"', 'path="/customer/operations/:operationId/export"']));
  assert('source_operator_field_runtime_routes_include_tabs', includesAll(operatorFieldRuntimeRoutes, ['path=":fieldId"', 'path=":fieldId/evidence"', 'path=":fieldId/state"', 'path=":fieldId/forecast"', 'path=":fieldId/scenario"', 'path=":fieldId/residual"', 'path=":fieldId/calibration"', 'path=":fieldId/health"', 'path=":fieldId/audit"']));
  assert('source_app_preserves_admin_compatibility_routes', includesAll(app, ['path="/admin/acceptance"', 'path="/admin/import"', 'path="/admin/operations/:operationId/debug"', 'path="/legacy/admin/acceptance"', 'path="/legacy/admin/import"', 'path="/legacy/dev"']));
  assert('source_h67_manifest_records_boundaries', includesAll(h67Manifest, ['Operator Runtime Console', 'Customer Portal', 'Admin Console', 'URL-only and compatibility routes', '/admin/acceptance', '/admin/import', 'Formal navigation excludes debug, import, and acceptance.']));
  assert('source_f0a_page_gap_records_future_and_do_not_build', includesAll(f0aPageGap, ['Future product-contract pages', 'Do-not-build pages', 'Operator Evidence Overview', 'Operator Runtime Health Overview', 'Operator Settings', 'Customer Evidence Summary', 'Admin Tenants', 'Admin Imports', 'Admin Audit', 'Customer Dispatch', 'Operator AO-ACT Control', 'Legacy Dev Tools Formal Page']));
  assert('source_f0b_freeze_records_runtime_handoff', includesAll(f0bFreeze, ['Frontend Productization is not Runtime Readiness.', 'Runtime readiness moves to R-series.', 'No more H-line frontend expansion without a new product contract.']));
  assertStaticReadOnlyAcceptance(acceptanceText);

  // Purpose: emit a stable machine-readable success payload.
  console.log(JSON.stringify({
    ok: true,
    acceptance: 'ACCEPTANCE_PFE_0_PRODUCT_FRONTEND_DEFINITION_V1',
    scope: 'static PFE-0 product frontend definition and audit only',
    surface_inventory: { customer: 9, operator: 13, admin_formal: 7, admin_compatibility: 4 },
    changed_files_checked: diff.length > 0 ? diff : Object.values(pfeFiles),
    assertions,
  }, null, 2));
} catch (error) {
  // Purpose: emit structured failure output for deterministic debugging.
  console.error(JSON.stringify({
    ok: false,
    acceptance: 'ACCEPTANCE_PFE_0_PRODUCT_FRONTEND_DEFINITION_V1',
    error: error.message,
    details: error.details || null,
    assertions,
  }, null, 2));
  process.exit(1);
}
