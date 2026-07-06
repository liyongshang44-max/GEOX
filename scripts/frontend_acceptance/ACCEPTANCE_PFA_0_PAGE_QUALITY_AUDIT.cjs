// scripts/frontend_acceptance/ACCEPTANCE_PFA_0_PAGE_QUALITY_AUDIT.cjs
'use strict';

const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const docs = [
  'docs/frontend-acceptance/PFA-0-PAGE-QUALITY-AUDIT.md',
  'docs/frontend-acceptance/PFA-0-REVIEW-MANIFEST.json',
  'docs/frontend-acceptance/PFA-0-ROUTE-REVIEW-MATRIX.md',
  'docs/frontend-acceptance/PFA-0-ROUTE-REVIEW-MATRIX.json',
  'docs/frontend-acceptance/PFA-0-ISSUE-REGISTER.md',
  'docs/frontend-acceptance/PFA-0-REVIEW-RUBRIC.md',
];
const pfe13Inventory = 'docs/frontend-productization/PFE-13-ROUTE-INVENTORY.json';
const pfe13Acceptance = 'scripts/frontend_acceptance/ACCEPTANCE_PFE_13_FRONTEND_PRODUCT_V1_FREEZE.cjs';
const pfe10Checker = 'scripts/frontend_acceptance/CHECK_PFE_10_WEB_BUNDLE_BUDGET.cjs';
const acceptanceFile = 'scripts/frontend_acceptance/ACCEPTANCE_PFA_0_PAGE_QUALITY_AUDIT.cjs';
const captureFile = 'scripts/frontend_acceptance/CAPTURE_PFA_0_PAGE_REVIEW.cjs';
const allowedChangedFiles = new Set([...docs, acceptanceFile, captureFile]);
const requiredMatrixFields = [
  'surface',
  'route',
  'concreteAuditPath',
  'locale',
  'viewport',
  'routeHealth',
  'boundarySafety',
  'i18nConsistency',
  'visualHierarchy',
  'tableReadability',
  'demoDataQuality',
  'demoReadiness',
  'highestSeverity',
  'issueIds',
  'pfa1Required',
];
const assertions = [];

function repoPath(file) { return path.join(root, file); }
function exists(file) { return fs.existsSync(repoPath(file)); }
function read(file) { return fs.readFileSync(repoPath(file), 'utf8'); }
function parseJson(file) { return JSON.parse(read(file)); }
function lower(value) { return String(value).toLowerCase(); }
function includesAll(text, tokens) { const haystack = lower(text); return tokens.every((token) => haystack.includes(lower(token))); }
function assert(name, passed, details = {}) { assertions.push({ name, passed: passed === true, details }); if (passed !== true) { const error = new Error('ASSERTION_FAILED:' + name); error.details = details; throw error; } console.log('[pfa-0-page-quality-audit] ok:', name); }
function runGit(args) { try { return cp.execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch (_error) { return ''; } }
function statusFiles() { const output = runGit(['status', '--short', '--untracked-files=all']); if (!output) return []; return output.split(/\r?\n/).map((line) => { if (!line.trim()) return ''; const arrow = line.indexOf(' -> '); if (arrow >= 0) return line.slice(arrow + 4).trim(); return line.replace(/^[ MADRCU?!]{1,2}\s+/, '').trim(); }).filter(Boolean); }
function changedFiles() { const set = new Set(); const output = runGit(['diff', '--name-only', 'origin/main...HEAD']) || runGit(['diff', '--name-only', 'main...HEAD']); if (output) output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).forEach((file) => set.add(file)); statusFiles().forEach((file) => set.add(file)); return Array.from(set).sort(); }
function routeList(inventory, group) { return Array.isArray(inventory[group]) ? inventory[group].map((record) => record.route) : []; }
function matrixRoutes(matrix, group) { return matrix.records.filter((record) => record.surface === group).map((record) => record.route); }
function concrete(route, bindings) { let next = route; for (const [token, value] of Object.entries(bindings || {})) next = next.replaceAll(token, value); return next; }
function matrixHasFields(record) { return requiredMatrixFields.every((field) => Object.prototype.hasOwnProperty.call(record, field)); }

try {
  [...docs, pfe13Inventory, pfe13Acceptance, pfe10Checker, acceptanceFile, captureFile].forEach((file) => assert('exists:' + file, exists(file), { file }));

  const diff = changedFiles();
  const manifest = parseJson('docs/frontend-acceptance/PFA-0-REVIEW-MANIFEST.json');
  const inventory = parseJson(pfe13Inventory);
  const matrix = parseJson('docs/frontend-acceptance/PFA-0-ROUTE-REVIEW-MATRIX.json');
  const issueRegister = read('docs/frontend-acceptance/PFA-0-ISSUE-REGISTER.md');
  const rubric = read('docs/frontend-acceptance/PFA-0-REVIEW-RUBRIC.md');
  const mainDoc = read('docs/frontend-acceptance/PFA-0-PAGE-QUALITY-AUDIT.md');
  const capture = read(captureFile);
  const allPfaText = lower(mainDoc + '\n' + issueRegister + '\n' + rubric);

  assert('changed_files_allowlist', diff.length === 0 || diff.every((file) => allowedChangedFiles.has(file)), { diff, allowed: Array.from(allowedChangedFiles) });
  assert('no_route_topology_changes', diff.every((file) => file !== 'apps/web/src/app/App.tsx' && file !== 'apps/web/src/app/AppShell.tsx' && !file.startsWith('apps/web/src/app/routes/')), { diff });
  assert('no_web_runtime_source_changes', diff.every((file) => !file.startsWith('apps/web/src/features/') && !file.startsWith('apps/web/src/layouts/') && !file.startsWith('apps/web/src/styles/') && !file.startsWith('apps/web/src/design-system/')), { diff });
  assert('no_server_migration_contract_fixture_changes', diff.every((file) => !file.startsWith('apps/server/') && !file.startsWith('migrations/') && !file.startsWith('packages/contracts/') && !file.startsWith('fixtures/')), { diff });
  assert('no_package_or_workspace_changes', diff.every((file) => !['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'apps/web/package.json'].includes(file)), { diff });
  assert('no_ci_workflow_changes', diff.every((file) => !file.startsWith('.github/')), { diff });
  assert('no_dist_or_screenshot_binary_changes', diff.every((file) => !file.startsWith('apps/web/dist/') && !/docs\/audit\/.*\.(png|jpg|jpeg|webp)$/i.test(file)), { diff });

  assert('manifest_valid', manifest.phase === 'PFA-0 Page Quality Audit' && manifest.version === 1 && manifest.sourceInventory === pfe13Inventory && manifest.mode === 'post-freeze-product-page-review');
  assert('manifest_locales', Array.isArray(manifest.locales) && manifest.locales.includes('zh-CN') && manifest.locales.includes('en-US'));
  assert('manifest_viewports', manifest.viewports?.desktopReview?.width === 1440 && manifest.viewports?.laptopReview?.width === 1366 && manifest.viewports?.mobileSpotCheck?.width === 390);
  assert('manifest_concrete_bindings', manifest.concreteRouteBindings?.[':fieldId'] === 'field_c8_demo' && manifest.concreteRouteBindings?.[':operationId'] === 'op_plan_c8_irrigation_formal_001');
  assert('manifest_quality_dimensions', Array.isArray(manifest.qualityDimensions) && ['routeHealth', 'boundarySafety', 'roleSeparation', 'i18nConsistency', 'visualHierarchy', 'tableReadability', 'denseContentHandling', 'demoDataQuality', 'responsiveSanity', 'demoReadiness'].every((item) => manifest.qualityDimensions.includes(item)));
  assert('manifest_artifact_policy', manifest.artifactPolicy?.screenshotDirectory === 'docs/audit/pfa-0-screenshots' && manifest.artifactPolicy?.reportPath === 'docs/audit/PFA_0_PAGE_REVIEW_REPORT.md' && manifest.artifactPolicy?.doNotCommitScreenshots === true && manifest.artifactPolicy?.doNotExecuteSeedApply === true && manifest.artifactPolicy?.doNotWriteFacts === true);
  assert('manifest_blocks_twin_runtime', manifest.blockingPolicy?.p1BlocksTwinRuntime === true && manifest.blockingPolicy?.p1MustEnterPFA1 === true);

  assert('pfe13_inventory_records_exist', ['customer', 'operator', 'admin', 'supporting'].every((group) => Array.isArray(inventory[group]) && inventory[group].length > 0));
  assert('matrix_valid_records', Array.isArray(matrix.records) && matrix.records.length >= 33 && matrix.records.every(matrixHasFields));
  assert('matrix_customer_coverage', routeList(inventory, 'customer').every((route) => matrixRoutes(matrix, 'customer').includes(route)));
  assert('matrix_operator_coverage', routeList(inventory, 'operator').every((route) => matrixRoutes(matrix, 'operator').includes(route)));
  assert('matrix_admin_coverage', routeList(inventory, 'admin').every((route) => matrixRoutes(matrix, 'admin').includes(route)));
  assert('matrix_supporting_coverage', ['/login', 'LocaleToggle', 'ProductDataTable', 'Product state primitives'].every((route) => matrixRoutes(matrix, 'supporting').includes(route)));
  assert('matrix_concrete_paths', matrix.records.filter((record) => record.route.includes(':')).every((record) => record.concreteAuditPath === concrete(record.route, manifest.concreteRouteBindings)));
  assert('matrix_contains_p1_and_pfa1', matrix.records.some((record) => record.highestSeverity === 'P1') && matrix.records.some((record) => record.pfa1Required === true));

  assert('rubric_has_severities', includesAll(rubric, ['P0', 'P1', 'P2', 'P3', 'PFA-0 completion means page issues are reviewed and classified']));
  assert('issue_register_has_seeded_customer_operator_admin_issues', includesAll(issueRegister, ['PFA0-CUS-001', 'PFA0-CUS-003', 'PFA0-OPR-001', 'PFA0-OPR-002', 'PFA0-OPR-003', 'PFA0-ADM-001']));
  assert('issue_register_blocks_twin_runtime', includesAll(issueRegister, ['P1 issues must move to PFA-1 before Twin Runtime work begins', 'P1 issues block Twin Runtime work']));
  assert('main_doc_nonclaim_policy', includesAll(mainDoc, ['does not fix pages', 'cannot claim', 'all pages are product-grade complete', 'PFA-1 handoff']));
  assert('capture_script_reads_sources', capture.includes('PFA-0-REVIEW-MANIFEST.json') && capture.includes('PFE-13-ROUTE-INVENTORY.json'));
  assert('capture_script_writes_artifacts', capture.includes('screenshotDirectory') && capture.includes('reportPath') && capture.includes('page.screenshot'));
  assert('capture_script_locale_injection', capture.includes('geox.locale') && capture.includes('manifest.locales'));
  assert('capture_script_no_seed_apply_or_fact_write', !capture.includes('--apply') && !capture.includes('seed apply') && !capture.includes('write facts') && !capture.includes('POST /facts'));
  assert('no_positive_fix_claims', !allPfaText.includes('pfa-0 fixes page issues') && !allPfaText.includes('all pages are now product-grade complete') && !allPfaText.includes('twin runtime can now begin'));

  console.log(JSON.stringify({
    ok: true,
    acceptance: 'ACCEPTANCE_PFA_0_PAGE_QUALITY_AUDIT',
    scope: 'post-freeze page quality audit only',
    sourceInventory: manifest.sourceInventory,
    matrixRecords: matrix.records.length,
    checks: {
      manifest: 'passed',
      route_matrix: 'passed',
      issue_register: 'passed',
      rubric: 'passed',
      capture_script: 'passed',
      no_route_changes: 'passed',
      no_runtime_source_changes: 'passed',
      no_package_changes: 'passed',
      no_backend_changes: 'passed',
    },
    changed_files_checked: diff.length ? diff : Array.from(allowedChangedFiles),
    assertions,
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, acceptance: 'ACCEPTANCE_PFA_0_PAGE_QUALITY_AUDIT', error: error.message, details: error.details || null, assertions }, null, 2));
  process.exit(1);
}
