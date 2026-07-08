// scripts/frontend_acceptance/ACCEPTANCE_PFA_2_LOCALE_CONTRACT.cjs
'use strict';

const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const assertions = [];
const requiredFiles = [
  'docs/frontend-acceptance/PFA-2-LOCALE-CONTRACT.md',
  'docs/frontend-acceptance/PFA-2-ROUTE-LOCALE-MATRIX.json',
  'docs/frontend-acceptance/PFA-2-TERM-GLOSSARY.md',
  'docs/frontend-acceptance/PFA-2-LOCALE-EXCEPTION-REGISTER.md',
  'docs/frontend-acceptance/PFA-2-RUNTIME-EVIDENCE.md',
  'docs/frontend-acceptance/PFA-2-ISSUE-CLOSURE.md',
  'scripts/frontend_acceptance/ACCEPTANCE_PFA_2_LOCALE_CONTRACT.cjs',
  'scripts/frontend_acceptance/AUDIT_PFA_2_RUNTIME_LOCALE_CONTRACT.cjs',
  'scripts/frontend_acceptance/AUDIT_PFA_2_RUNTIME_LOCALE_MAIN.cjs',
  'scripts/frontend_acceptance/AUDIT_PFA_2_RUNTIME_LOCALE_SUPPORT_V3.cjs',
  'apps/web/src/lib/locale.tsx',
  'apps/web/src/lib/productSurfaceLabels.ts',
  'apps/web/src/lib/productCopy/localeContract.ts',
  'apps/web/src/components/common/LocaleToggle.tsx',
  'apps/web/src/features/operator/replayDemo/replayDemoLocaleCopy.ts',
  'apps/web/src/features/admin/pages/AdminGovernanceLocalePage.tsx',
  'apps/web/src/features/admin/pages/adminDevicesLocaleConfig.ts',
  'apps/web/src/views/LoginPage.tsx',
];

const allowedExact = new Set([
  'apps/web/src/lib/locale.tsx',
  'apps/web/src/lib/productSurfaceLabels.ts',
  'apps/web/src/components/common/LocaleToggle.tsx',
  'apps/web/src/components/common/RuntimeTextGuard.tsx',
  'apps/web/src/layouts/CustomerLayout.tsx',
  'apps/web/src/layouts/OperatorLayout.tsx',
  'apps/web/src/layouts/AdminLayout.tsx',
  'apps/web/src/views/LoginPage.tsx',
  'apps/web/src/features/fields/pages/FieldReportPage.tsx',
  'apps/web/src/features/fields/pages/FieldReportExportPage.tsx',
  'apps/web/src/features/operations/pages/OperationReportPage.tsx',
]);
const allowedPrefixes = [
  'docs/frontend-acceptance/PFA-2-',
  'scripts/frontend_acceptance/ACCEPTANCE_PFA_2_',
  'scripts/frontend_acceptance/AUDIT_PFA_2_',
  'apps/web/src/lib/productCopy/',
  'apps/web/src/design-system/product/',
  'apps/web/src/features/customer/pages/',
  'apps/web/src/features/operator/pages/',
  'apps/web/src/features/operator/fieldRuntime/',
  'apps/web/src/features/operator/replayDemo/',
  'apps/web/src/features/operator/pilotReadiness/',
  'apps/web/src/features/admin/pages/',
];
const forbiddenExact = new Set([
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'apps/web/package.json',
  'apps/web/src/api/client.ts',
  'apps/web/src/app/App.tsx',
]);
const forbiddenPrefixes = [
  'apps/server/',
  'migrations/',
  'packages/contracts/',
  'fixtures/',
  '.github/',
  'apps/web/src/app/routes/',
  'apps/web/src/api/',
  'apps/web/dist/',
  'docs/audit/',
];
const governedProps = ['title','lead','subtitle','description','header','label','caption','nonclaim','placeholder','ariaLabel','emptyState','errorState','loadingState'];

function repoPath(file) { return path.join(root, file); }
function read(file) { return fs.readFileSync(repoPath(file), 'utf8'); }
function parseJson(file) { return JSON.parse(read(file)); }
function runGit(args) {
  try { return cp.execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore','pipe','ignore'] }).trim(); }
  catch { return ''; }
}
function statusFiles() {
  const output = runGit(['status','--short','--untracked-files=all']);
  if (!output) return [];
  return output.split(/\r?\n/).map((line) => line.includes(' -> ') ? line.split(' -> ').pop().trim() : line.replace(/^[ MADRCU?!]{1,2}\s+/, '').trim()).filter(Boolean);
}
function changedFiles() {
  const files = new Set();
  const output = runGit(['diff','--name-only','origin/main...HEAD']) || runGit(['diff','--name-only','main...HEAD']);
  if (output) output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).forEach((file) => files.add(file));
  statusFiles().forEach((file) => files.add(file));
  return [...files].sort();
}
function assert(name, passed, details = {}) {
  assertions.push({ name, passed: passed === true, details });
  if (passed !== true) {
    const error = new Error(`ASSERTION_FAILED:${name}`);
    error.details = details;
    throw error;
  }
  console.log('[pfa-2-locale-contract] ok:', name);
}
function isAllowed(file) { return allowedExact.has(file) || allowedPrefixes.some((prefix) => file.startsWith(prefix)); }
function isForbidden(file) { return forbiddenExact.has(file) || forbiddenPrefixes.some((prefix) => file.startsWith(prefix)); }
function countBy(records, surface) { return records.filter((record) => record.surface === surface).length; }
function listFiles(directory, predicate = () => true) {
  if (!fs.existsSync(directory)) return [];
  const output = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...listFiles(full, predicate));
    else if (predicate(full)) output.push(full);
  }
  return output;
}
function copyPairs(text) {
  const pairs = [];
  const pattern = /\{\s*zh:\s*(["'`])([\s\S]*?)\1\s*,\s*en:\s*(["'`])([\s\S]*?)\3\s*\}/g;
  let match;
  while ((match = pattern.exec(text))) pairs.push({ zh: match[2].trim(), en: match[4].trim() });
  return pairs;
}
function parseExceptionRows(markdown) {
  return markdown.split(/\r?\n/).filter((line) => /^\| PFA2-EX-\d+ \|/.test(line)).map((line) => line.split('|').slice(1,-1).map((value) => value.trim())).map(([id,token,routeSurface,reason,owner,expiryPhase]) => ({ id,token,routeSurface,reason,owner,expiryPhase }));
}
function addedDiffLines(file) {
  const output = runGit(['diff','--unified=0','origin/main...HEAD','--',file]) || runGit(['diff','--unified=0','main...HEAD','--',file]);
  return output.split(/\r?\n/).filter((line) => line.startsWith('+') && !line.startsWith('+++')).map((line) => line.slice(1));
}
function nakedGovernedCopyViolations(files) {
  const violations = [];
  const pattern = new RegExp(`(?:${governedProps.join('|')})\\s*=\\s*["']([^"']+)["']`);
  const neutral = /^(?:GEOX|API|URL|JSON|SHA-256|AO-ACT|ID|Trace ID|\/[^^\s]+|[A-Z0-9_.:-]+)$/;
  for (const file of files.filter((item) => item.endsWith('.tsx'))) {
    for (const line of addedDiffLines(file)) {
      const match = line.match(pattern);
      if (!match) continue;
      const value = match[1].trim();
      if (!neutral.test(value)) violations.push({ file, value, line: line.trim() });
    }
  }
  return violations;
}

try {
  requiredFiles.forEach((file) => assert(`exists:${file}`, fs.existsSync(repoPath(file)), { file }));
  const changed = changedFiles();
  assert('changed_files_within_pfa2_scope', changed.length > 0 && changed.every(isAllowed), { changed });
  assert('forbidden_files_unchanged', changed.every((file) => !isForbidden(file)), { changed });
  assert('no_generated_screenshots_or_binaries', changed.every((file) => !/\.(png|jpe?g|webp|zip|tar|gz)$/i.test(file)), { changed });

  const contract = read('docs/frontend-acceptance/PFA-2-LOCALE-CONTRACT.md');
  const glossary = read('docs/frontend-acceptance/PFA-2-TERM-GLOSSARY.md');
  const exceptionText = read('docs/frontend-acceptance/PFA-2-LOCALE-EXCEPTION-REGISTER.md');
  const runtimeEvidence = read('docs/frontend-acceptance/PFA-2-RUNTIME-EVIDENCE.md');
  const issueClosure = read('docs/frontend-acceptance/PFA-2-ISSUE-CLOSURE.md');
  const matrix = parseJson('docs/frontend-acceptance/PFA-2-ROUTE-LOCALE-MATRIX.json');
  const inventory = parseJson('docs/frontend-productization/PFE-13-ROUTE-INVENTORY.json');
  const records = matrix.records || [];

  assert('matrix_contract_version', matrix.version === 1 && matrix.recordModel === 'route-locale-contract-v1');
  assert('matrix_supported_locales_exact', JSON.stringify(matrix.supportedLocales) === JSON.stringify(['zh-CN','en-US']), { locales: matrix.supportedLocales });
  assert('matrix_actual_route_count', records.length === 30 && matrix.actualRouteCount === 30 && matrix.runtimeRenderCount === 60, { records: records.length });
  assert('matrix_surface_counts', countBy(records,'customer') === 9 && countBy(records,'operator') === 13 && countBy(records,'admin') === 7 && countBy(records,'supporting') === 1);
  assert('matrix_all_required_fields', records.every((record) => matrix.requiredRecordFields.every((field) => Object.prototype.hasOwnProperty.call(record, field))));
  assert('matrix_all_routes_have_owner_and_sources', records.every((record) => typeof record.copyOwner === 'string' && record.copyOwner && Array.isArray(record.copySources) && record.copySources.length));
  assert('matrix_all_routes_have_locale_markers', records.every((record) => record.expectedZhMarkers?.length && record.expectedEnMarkers?.length));
  assert('matrix_forbidden_markers_present', records.every((record) => record.zhForbiddenMarkers?.length && record.enForbiddenMarkers?.length));
  assert('matrix_concrete_paths', records.every((record) => typeof record.concreteAuditPath === 'string' && record.concreteAuditPath.startsWith('/')));
  assert('matrix_status_lifecycle_declared', JSON.stringify(matrix.statusLifecycle) === JSON.stringify(['ready-for-runtime','runtime-pass']), { statusLifecycle: matrix.statusLifecycle });
  assert('matrix_planned_status_forbidden', records.every((record) => record.status !== 'planned'), { statuses: [...new Set(records.map((record) => record.status))] });
  assert('matrix_statuses_valid', records.every((record) => matrix.statusLifecycle.includes(record.status)), { statuses: [...new Set(records.map((record) => record.status))] });
  const claimsClosed = /\|\s*closed\s*\|/i.test(issueClosure);
  assert('closed_issues_require_runtime_pass', !claimsClosed || records.every((record) => record.status === 'runtime-pass'), { claimsClosed, statuses: [...new Set(records.map((record) => record.status))] });
  const inventoryRoutes = [...inventory.customer,...inventory.operator,...inventory.admin,inventory.supporting.find((item) => item.route === '/login')].map((item) => item.route).sort();
  assert('matrix_matches_pfe13_actual_routes', JSON.stringify(records.map((record) => record.route).sort()) === JSON.stringify(inventoryRoutes));

  const exceptions = parseExceptionRows(exceptionText);
  const exceptionIds = new Set(exceptions.map((item) => item.id));
  assert('exceptions_registered', exceptions.length >= 8, { exceptions: exceptions.length });
  assert('exceptions_have_reason_owner_expiry', exceptions.every((item) => item.token && item.routeSurface && item.reason && item.owner && item.expiryPhase));
  assert('matrix_exception_ids_resolve', records.every((record) => record.exceptionIds.every((id) => exceptionIds.has(id))));
  assert('owned_issues_tracked', ['PFA0-I18N-001','PFA0-CUS-001','PFA0-ADM-002'].every((token) => contract.includes(token) && issueClosure.includes(token)));
  assert('deferred_issues_preserved', ['PFA0-RWD-001','PFA0-NAV-001','PFA0-EXP-001','PFA0-DEN-001','PFA0-ADM-003','PFA0-CUS-002','PFA0-CUS-004','PFA0-ADM-001'].every((token) => contract.includes(token) && issueClosure.includes(token)));
  assert('glossary_shared_states_complete', ['Available','Unavailable','Blocked','Read-only','Not connected','Not online','Not started','Disabled','Degraded','Stale','Unknown','Source missing','Evidence unavailable'].every((token) => glossary.includes(token)));

  const localeSource = read('apps/web/src/lib/locale.tsx');
  const toggleSource = read('apps/web/src/components/common/LocaleToggle.tsx');
  const loginSource = read('apps/web/src/views/LoginPage.tsx');
  const customerLayout = read('apps/web/src/layouts/CustomerLayout.tsx');
  const operatorLayout = read('apps/web/src/layouts/OperatorLayout.tsx');
  const adminLayout = read('apps/web/src/layouts/AdminLayout.tsx');
  assert('locale_provider_supports_exact_locales', localeSource.includes('"zh-CN" | "en-US"') && localeSource.includes('["zh-CN", "en-US"]'));
  assert('locale_storage_persistence_preserved', localeSource.includes('LOCALE_STORAGE_KEY') && localeSource.includes('localStorage.setItem') && localeSource.includes('localStorage.getItem'));
  assert('html_lang_synchronization', localeSource.includes('document.documentElement.lang = locale'));
  assert('locale_toggle_contract', toggleSource.includes('useLocale') && toggleSource.includes('setLocale') && toggleSource.includes('aria-pressed') && toggleSource.includes('data-locale-option') && !/(useNavigate|NavLink|<Link|window\.location|history\.pushState|history\.replaceState)/.test(toggleSource));
  assert('login_uses_locale_boundary', loginSource.includes('useLocale') && loginSource.includes('LocaleToggle') && loginSource.includes('LOGIN_COPY'));

  const copyFiles = [
    repoPath('apps/web/src/lib/productSurfaceLabels.ts'),
    ...listFiles(repoPath('apps/web/src/lib/productCopy'), (file) => /\.(ts|tsx)$/.test(file)),
    ...listFiles(repoPath('apps/web/src/features/operator/replayDemo'), (file) => /LocaleCopy\.ts$/.test(file)),
    ...listFiles(repoPath('apps/web/src/features/admin/pages'), (file) => /LocaleConfig\.ts$/.test(file)),
  ];
  const pairs = copyFiles.flatMap((file) => copyPairs(fs.readFileSync(file,'utf8')).map((pair) => ({ ...pair, file: path.relative(root,file).replaceAll('\\','/') })));
  assert('governed_copy_pairs_present', pairs.length >= 60, { pairs: pairs.length });
  assert('governed_copy_pairs_nonempty', pairs.every((pair) => pair.zh && pair.en));
  const identical = pairs.filter((pair) => pair.zh === pair.en && !['GEOX','API','URL','JSON','SHA-256','AO-ACT','ID'].includes(pair.zh));
  assert('no_unregistered_identical_copy_pairs', identical.length === 0, { identical });
  assert('no_third_party_i18n_dependency', !/(i18next|react-intl|formatjs)/i.test(read('apps/web/package.json')));

  const guardExists = fs.existsSync(repoPath('apps/web/src/components/common/RuntimeTextGuard.tsx'));
  const guardSource = guardExists ? read('apps/web/src/components/common/RuntimeTextGuard.tsx') : '';
  const replacementCount = (guardSource.match(/^\s*\[\s*["'`]/gm) || []).length;
  assert('runtime_text_guard_replacement_count_zero', replacementCount === 0, { replacementCount });
  assert('formal_layouts_do_not_import_runtime_text_guard', !customerLayout.includes('RuntimeTextGuard') && !operatorLayout.includes('RuntimeTextGuard') && !adminLayout.includes('RuntimeTextGuard'));
  assert('gateway_demo_complete_locale_catalog_wired', read('apps/web/src/features/operator/replayDemo/ReplayDemoLocalizedPage.tsx').includes('replayDemoLocaleCopy') && read('apps/web/src/features/operator/replayDemo/ReplayDemoBoundaryClaimsPanel.tsx').includes('replayClaimMeaning'));
  assert('admin_metric_values_localized', read('apps/web/src/features/admin/pages/adminDevicesLocaleConfig.ts').includes('value: c("回查", "Readback")') && read('apps/web/src/features/admin/pages/adminDevicesLocaleConfig.ts').includes('value: c("已定义", "Defined")'));
  assert('complete_visible_text_audit_enabled', read('scripts/frontend_acceptance/AUDIT_PFA_2_RUNTIME_LOCALE_SUPPORT_V3.cjs').includes('NodeFilter.SHOW_TEXT') && read('scripts/frontend_acceptance/AUDIT_PFA_2_RUNTIME_LOCALE_MAIN.cjs').includes('missingRequiredCapabilities'));
  assert('pfa3_dashboard_layout_css_removed', !fs.existsSync(repoPath('apps/web/src/design-system/product/CustomerDashboardLocaleLayout.css')) && !read('apps/web/src/design-system/product/index.ts').includes('CustomerDashboardLocaleLayout.css'));
  const naked = nakedGovernedCopyViolations(changed.filter((file) => file.startsWith('apps/web/') && file.endsWith('.tsx')));
  assert('scoped_added_jsx_governed_copy_scanner', naked.length === 0, { violations: naked });

  console.log(JSON.stringify({
    ok: true,
    acceptance: 'ACCEPTANCE_PFA_2_LOCALE_CONTRACT',
    actualRoutes: records.length,
    locales: matrix.supportedLocales.length,
    expectedRuntimeRenders: matrix.runtimeRenderCount,
    matrixStatuses: [...new Set(records.map((record) => record.status))],
    customerRoutes: countBy(records,'customer'),
    operatorRoutes: countBy(records,'operator'),
    adminRoutes: countBy(records,'admin'),
    loginRoutes: countBy(records,'supporting'),
    runtimeTextGuardReplacementCount: replacementCount,
    runtimeEvidenceState: runtimeEvidence.includes('REVALIDATION REQUIRED') ? 'revalidation-required' : 'recorded',
    changedFiles: changed,
    assertions,
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, acceptance: 'ACCEPTANCE_PFA_2_LOCALE_CONTRACT', error: error.message, details: error.details || null, assertions }, null, 2));
  process.exit(1);
}
