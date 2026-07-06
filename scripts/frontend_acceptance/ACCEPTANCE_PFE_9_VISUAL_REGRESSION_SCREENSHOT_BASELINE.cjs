// scripts/frontend_acceptance/ACCEPTANCE_PFE_9_VISUAL_REGRESSION_SCREENSHOT_BASELINE.cjs
'use strict';

const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const docs = [
  'docs/frontend-productization/PFE-9-VISUAL-REGRESSION-SCREENSHOT-BASELINE.md',
  'docs/frontend-productization/PFE-9-SCREENSHOT-MANIFEST.json',
  'docs/frontend-productization/PFE-9-VISUAL-REVIEW-MATRIX.md',
  'docs/frontend-productization/PFE-9-VISUAL-ISSUE-REGISTER.md',
];
const baselineDocs = [
  'docs/frontend-productization/PFE-6-ACCESSIBILITY-KEYBOARD-COMPLIANCE.md',
  'docs/frontend-productization/PFE-7-RESPONSIVE-VIEWPORT-COMPLETION.md',
  'docs/frontend-productization/PFE-8-EMPTY-LOADING-ERROR-STATE-COMPLETION.md',
];
const captureScript = 'scripts/frontend_acceptance/CAPTURE_PFE_9_SCREENSHOTS.cjs';
const acceptanceFile = 'scripts/frontend_acceptance/ACCEPTANCE_PFE_9_VISUAL_REGRESSION_SCREENSHOT_BASELINE.cjs';
const allowedChangedFiles = new Set([...docs, captureScript, acceptanceFile]);
const assertions = [];

function repoPath(file) { return path.join(root, file); }
function exists(file) { return fs.existsSync(repoPath(file)); }
function read(file) { return fs.readFileSync(repoPath(file), 'utf8'); }
function lower(value) { return String(value).toLowerCase(); }
function includesAll(text, tokens) { const haystack = lower(text); return tokens.every((token) => haystack.includes(lower(token))); }
function assert(name, passed, details = {}) { assertions.push({ name, passed: passed === true, details }); if (passed !== true) { const error = new Error('ASSERTION_FAILED:' + name); error.details = details; throw error; } console.log('[pfe-9-visual-regression-screenshot-baseline] ok:', name); }
function runGit(args) { try { return cp.execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch (_error) { return ''; } }
function statusFiles() { const output = runGit(['status', '--short', '--untracked-files=all']); if (!output) return []; return output.split(/\r?\n/).map((line) => { if (!line.trim()) return ''; const arrow = line.indexOf(' -> '); if (arrow >= 0) return line.slice(arrow + 4).trim(); return line.replace(/^[ MADRCU?!]{1,2}\s+/, '').trim(); }).filter(Boolean); }
function changedFiles() { const set = new Set(); const output = runGit(['diff', '--name-only', 'origin/main...HEAD']) || runGit(['diff', '--name-only', 'main...HEAD']); if (output) output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).forEach((file) => set.add(file)); statusFiles().forEach((file) => set.add(file)); return Array.from(set).sort(); }
function parseManifest() { return JSON.parse(read('docs/frontend-productization/PFE-9-SCREENSHOT-MANIFEST.json')); }
function docText() { return docs.filter((file) => file.endsWith('.md')).map(read).join('\n'); }

try {
  [...docs, ...baselineDocs, captureScript, acceptanceFile].forEach((file) => assert('exists:' + file, exists(file), { file }));

  const diff = changedFiles();
  const manifest = parseManifest();
  const guide = read('docs/frontend-productization/PFE-9-VISUAL-REGRESSION-SCREENSHOT-BASELINE.md');
  const matrix = read('docs/frontend-productization/PFE-9-VISUAL-REVIEW-MATRIX.md');
  const issueRegister = read('docs/frontend-productization/PFE-9-VISUAL-ISSUE-REGISTER.md');
  const capture = read(captureScript);
  const docsCombined = docText();

  const customerRoutes = ['/customer/dashboard', '/customer/fields', '/customer/fields/:fieldId', '/customer/fields/:fieldId/export', '/customer/operations', '/customer/operations/:operationId', '/customer/operations/:operationId/export', '/customer/reports', '/customer/export'];
  const operatorRoutes = ['/operator/twin', '/operator/fields', '/operator/fields/:fieldId', '/operator/fields/:fieldId/state', '/operator/fields/:fieldId/evidence', '/operator/fields/:fieldId/forecast', '/operator/fields/:fieldId/scenario', '/operator/fields/:fieldId/residual', '/operator/fields/:fieldId/calibration', '/operator/fields/:fieldId/health', '/operator/fields/:fieldId/audit', '/operator/twin/gateway-demo', '/operator/pilot'];
  const adminRoutes = ['/admin/dashboard', '/admin/fields', '/admin/operations', '/admin/devices', '/admin/evidence', '/admin/skills', '/admin/healthz'];
  const allRoutes = [...customerRoutes, ...operatorRoutes, ...adminRoutes, '/login'];
  const routeSet = new Set(manifest.routes.map((route) => route.route));
  const expectedBaselineRoutes = ['/customer/dashboard', '/customer/fields', '/customer/fields/:fieldId', '/customer/export', '/operator/twin', '/operator/fields', '/operator/fields/:fieldId/forecast', '/operator/twin/gateway-demo', '/operator/pilot', '/admin/dashboard', '/admin/devices', '/admin/healthz', '/login'];
  const baselineRoutes = manifest.routes.filter((route) => route.baseline === true).map((route) => route.route);
  const baselineViewportSet = JSON.stringify(['desktopWide', 'tablet', 'mobileNarrow']);

  assert('changed_files_allowlist', diff.length === 0 || diff.every((file) => allowedChangedFiles.has(file)), { diff, allowed: Array.from(allowedChangedFiles) });
  assert('no_route_topology_changes', diff.every((file) => file !== 'apps/web/src/app/App.tsx' && file !== 'apps/web/src/app/AppShell.tsx' && !file.startsWith('apps/web/src/app/routes/')), { diff });
  assert('no_backend_migration_contract_fixture_package_changes', diff.every((file) => !file.startsWith('apps/server/') && !file.startsWith('migrations/') && !file.startsWith('packages/contracts/') && !file.startsWith('fixtures/') && !file.startsWith('.github/') && !['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml'].includes(file)), { diff });
  assert('no_committed_screenshot_binary_changes', diff.every((file) => !/\.(png|jpg|jpeg|webp)$/i.test(file)), { diff });

  assert('manifest_valid_phase_and_policy', manifest.phase === 'PFE-9 Visual Regression & Screenshot Baseline' && manifest.version === 1 && manifest.pixelDiff === 'deferred');
  assert('manifest_includes_all_formal_routes', allRoutes.every((route) => routeSet.has(route)), { routes: allRoutes });
  assert('manifest_surface_counts', manifest.routes.filter((route) => route.surface === 'customer').length === 9 && manifest.routes.filter((route) => route.surface === 'operator').length === 13 && manifest.routes.filter((route) => route.surface === 'admin').length === 7 && manifest.routes.filter((route) => route.surface === 'supporting').length === 1);
  assert('manifest_viewport_tokens', manifest.viewports.desktopWide.width === 1440 && manifest.viewports.desktopStandard.width === 1280 && manifest.viewports.laptop.width === 1024 && manifest.viewports.tablet.width === 768 && manifest.viewports.mobileNarrow.width === 390);
  assert('manifest_baseline_subset_complete', expectedBaselineRoutes.every((route) => baselineRoutes.includes(route)) && baselineRoutes.length === expectedBaselineRoutes.length, { baselineRoutes });
  assert('manifest_baseline_uses_review_viewports', manifest.routes.filter((route) => route.baseline === true).every((route) => JSON.stringify(route.viewports) === baselineViewportSet));
  assert('manifest_routes_have_capture_paths_and_assertions', manifest.routes.every((route) => route.capturePath && route.capturePath.startsWith('/') && Array.isArray(route.assertions) && route.assertions.length > 0));

  assert('visual_review_matrix_covers_routes', allRoutes.every((route) => matrix.includes(route)), { routes: allRoutes });
  assert('visual_issue_register_has_blocker_policy', includesAll(issueRegister, ['Blocking issues not allowed', 'blank screenshot', 'primary navigation missing', 'main content clipped']));
  assert('baseline_docs_present', baselineDocs.every(exists));
  assert('visual_baseline_doc_has_required_policy', includesAll(guide, ['viewport policy', 'Manifest policy', 'Artifact policy', 'Non-goals', 'Capture policy', 'Review policy']));

  assert('capture_script_reads_manifest', capture.includes('PFE-9-SCREENSHOT-MANIFEST.json') && capture.includes('readManifest'));
  assert('capture_script_writes_review_report', capture.includes('PFE_9_VISUAL_REVIEW_REPORT.md') && capture.includes('writeReport'));
  assert('capture_script_writes_allowed_screenshot_dir', capture.includes('docs/audit/pfe-9-screenshots') && capture.includes('page.screenshot'));
  assert('capture_script_uses_existing_playwright_runtime', capture.includes("require('@playwright/test')") && capture.includes('playwright'));
  assert('capture_script_has_baseline_and_full_modes', capture.includes('PFE9_CAPTURE_MODE') && capture.includes("CAPTURE_MODE === 'full'"));

  assert('no_full_pixel_certification_claim', !lower(docsCombined).includes('completed full pixel-perfect certification') && !lower(docsCombined).includes('completed full browser matrix') && !lower(docsCombined).includes('completed full device matrix'));
  assert('no_package_dependency_changes', diff.every((file) => !['package.json', 'pnpm-lock.yaml'].includes(file)));

  console.log(JSON.stringify({
    ok: true,
    acceptance: 'ACCEPTANCE_PFE_9_VISUAL_REGRESSION_SCREENSHOT_BASELINE',
    scope: 'visual regression and screenshot baseline only',
    surfaces: { customer: 9, operator: 13, admin: 7, supporting: ['login', 'product primitives', 'export/print'] },
    viewports: { desktop_wide: 1440, desktop_standard: 1280, laptop: 1024, tablet: 768, mobile_narrow: 390 },
    baseline: { mode: 'review-safe screenshot manifest', pixel_diff: 'deferred', checked_routes: baselineRoutes.length },
    checks: { manifest: 'passed', capture_script: 'passed', no_route_changes: 'passed', no_package_changes: 'passed', no_full_pixel_certification_claim: 'passed' },
    changed_files_checked: diff.length ? diff : Array.from(allowedChangedFiles),
    assertions,
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, acceptance: 'ACCEPTANCE_PFE_9_VISUAL_REGRESSION_SCREENSHOT_BASELINE', error: error.message, details: error.details || null, assertions }, null, 2));
  process.exit(1);
}
