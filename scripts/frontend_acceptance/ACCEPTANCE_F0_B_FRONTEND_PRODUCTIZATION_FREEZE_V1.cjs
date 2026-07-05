// scripts/frontend_acceptance/ACCEPTANCE_F0_B_FRONTEND_PRODUCTIZATION_FREEZE_V1.cjs
'use strict';

const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const assertions = [];
const F0B_BASE_HEAD = 'd23f3c36db0ffaf2c6384fbe908dfb636768b29e';

const freezeDoc = 'docs/frontend-productization/F0-B-FRONTEND-PRODUCTIZATION-FREEZE.md';
const acceptance = 'scripts/frontend_acceptance/ACCEPTANCE_F0_B_FRONTEND_PRODUCTIZATION_FREEZE_V1.cjs';
const readme = 'docs/frontend-productization/README.md';

const requiredPriorArtifacts = [
  'docs/frontend-productization/F0-A-FRONTEND-BASELINE-REGISTERS.md',
  'docs/frontend-productization/F0-A-PAGE-GAP-REGISTER.md',
  'docs/frontend-productization/F0-A-LOCALE-READINESS-REGISTER.md',
  'docs/frontend-productization/F0-A-QUALITY-BASELINE-REGISTER.md',
  'docs/frontend-productization/F0-A-RUNTIME-TRANSITION-REGISTER.md',
  'docs/frontend-productization/H67-FRONTEND-RELEASE-READINESS.md',
  'docs/frontend-productization/H67-FRONTEND-ROUTE-SURFACE-MANIFEST.md',
  'docs/frontend-productization/H67-FRONTEND-RELEASE-CHECKLIST.md',
  'scripts/frontend_acceptance/ACCEPTANCE_H67_FRONTEND_RELEASE_READINESS_V1.cjs',
  'docs/frontend-productization/F1-A-LOCALE-INFRASTRUCTURE-HARDENING.md',
  'docs/frontend-productization/F1-B-SHELL-BILINGUAL-INTEGRATION.md',
  'docs/frontend-productization/F1-C-OPERATOR-BILINGUAL-SURFACES.md',
  'docs/frontend-productization/F1-D-CUSTOMER-ADMIN-BILINGUAL-SURFACES.md',
  'scripts/frontend_acceptance/ACCEPTANCE_F1_A_LOCALE_INFRASTRUCTURE_V1.cjs',
  'scripts/frontend_acceptance/ACCEPTANCE_F1_B_SHELL_BILINGUAL_INTEGRATION_V1.cjs',
  'scripts/frontend_acceptance/ACCEPTANCE_F1_C_OPERATOR_BILINGUAL_SURFACES_V1.cjs',
  'scripts/frontend_acceptance/ACCEPTANCE_F1_D_CUSTOMER_ADMIN_BILINGUAL_SURFACES_V1.cjs',
  'docs/frontend-productization/F2-FRONTEND-QUALITY-HARDENING.md',
  'docs/frontend-productization/F2-ACCESSIBILITY-BASELINE.md',
  'docs/frontend-productization/F2-RESPONSIVE-VIEWPORT-SMOKE.md',
  'docs/frontend-productization/F2-EMPTY-LOADING-ERROR-STATE-REGISTER.md',
  'docs/frontend-productization/F2-PERFORMANCE-BUDGET.md',
  'docs/frontend-productization/F2-VISUAL-SMOKE-CHECKLIST.md',
  'docs/frontend-productization/F2-KEYBOARD-FOCUS-GATE.md',
  'scripts/frontend_acceptance/ACCEPTANCE_F2_FRONTEND_QUALITY_HARDENING_V1.cjs',
];

const allowedFiles = new Set([freezeDoc, acceptance, readme]);
const blockedExact = new Set(['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml']);
const blockedPrefixes = ['apps/web/src/', 'apps/server/', 'migrations/', 'packages/contracts/', 'fixtures/', '.github/'];
const mojibake = ['鎬', '鍦', '浣', '璁', '杩', '閰', '绠', '瀵', '艰', '鍚', '彴', '潡', '惧', '悍', '嵁', '�'];
const sensitiveStatusTokens = ['production-ready', 'runtime is complete', 'autonomous', 'deployed', 'gateway is online', 'pilot has started', 'dispatch is enabled', 'computed', 'learned', 'estimation loop active', 'calibration loop active'];
const negativeContext = ['does not claim', 'does not', 'not ', 'not ready', 'not complete', 'not enabled', 'not started', 'cannot declare', 'cannot say', 'must not claim', 'nonclaim'];

function p(file) { return path.join(root, file); }
function exists(file) { return fs.existsSync(p(file)); }
function read(file) { return fs.readFileSync(p(file), 'utf8'); }
function lower(value) { return String(value).toLowerCase(); }
function includesAll(text, tokens) {
  const haystack = lower(text);
  return tokens.every((token) => haystack.includes(lower(token)));
}
function hits(text, tokens) { return tokens.filter((token) => text.includes(token)); }
function ok(name, passed, details = {}) {
  assertions.push({ name, passed: passed === true, details });
  if (passed !== true) {
    const error = new Error('ASSERTION_FAILED:' + name);
    error.details = details;
    throw error;
  }
  console.log('[f0-b-frontend-productization-freeze] ok:', name);
}
function execGit(args) { return cp.execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
function diffFiles() {
  let output = '';
  try { output = execGit(['diff', '--name-only', `${F0B_BASE_HEAD}...HEAD`]); } catch (_error) {
    try { output = execGit(['diff', '--name-only', 'main...HEAD']); } catch (_fallbackError) { output = ''; }
  }
  return output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}
function blocked(file) { return blockedExact.has(file) || blockedPrefixes.some((prefix) => file.startsWith(prefix)); }
function hasNetworkCallToken(text) { return text.includes('fet' + 'ch(') || text.includes('lis' + 'ten('); }
function positiveStatusViolations(text) {
  return text.split(/\r?\n/).map((line, index) => ({ line, index: index + 1, lowerLine: lower(line) }))
    .flatMap((entry) => sensitiveStatusTokens.filter((token) => entry.lowerLine.includes(lower(token))).map((token) => ({ ...entry, token })))
    .filter((entry) => !negativeContext.some((token) => entry.lowerLine.includes(token)));
}

try {
  [freezeDoc, acceptance, ...requiredPriorArtifacts].forEach((file) => ok('exists:' + file, exists(file), { file }));

  const diff = diffFiles();
  ok('changed_files_allowlist', diff.length > 0 && diff.every((file) => allowedFiles.has(file)), { diff, base: F0B_BASE_HEAD });
  ok('blocked_files_unchanged', diff.every((file) => !blocked(file)), { diff });
  ok('runtime_source_changed_false', diff.every((file) => !file.startsWith('apps/web/src/')), { diff });
  ok('route_topology_changed_false', diff.every((file) => file !== 'apps/web/src/app/App.tsx' && !file.startsWith('apps/web/src/app/routes/')), { diff });
  ok('backend_changed_false', diff.every((file) => !file.startsWith('apps/server/') && !file.startsWith('migrations/') && !file.startsWith('packages/contracts/') && !file.startsWith('fixtures/')), { diff });
  ok('package_changed_false', diff.every((file) => !blockedExact.has(file)), { diff });

  const doc = read(freezeDoc);
  ok('required_sections_present', includesAll(doc, ['Phase', 'Purpose', 'Preconditions', 'Frozen baseline', 'Role-separated surfaces', 'Known page gaps', 'Bilingual baseline', 'Quality-gated baseline', 'Freeze policy', 'No-more-H-line policy', 'Route / nav policy', 'Runtime readiness handoff', 'Nonclaims', 'Acceptance', 'Completion definition', 'Next phase']));
  ok('allowed_freeze_claim_present', doc.includes('GEOX Frontend Runtime Console v1 is frozen as a role-separated, bilingual, replay-backed, quality-gated enterprise frontend baseline.'));
  ok('baseline_keywords_present', includesAll(doc, ['role-separated', 'bilingual', 'replay-backed', 'quality-gated', 'enterprise frontend baseline']));
  ok('role_separated_freeze_present', includesAll(doc, ['Operator Runtime Console frontend shell is frozen for this phase.', 'Customer Portal frontend shell is frozen for this phase.', 'Admin Console frontend shell is frozen for this phase.', 'Each surface has a distinct formal shell.', 'Each surface has its own formal navigation boundary.', 'Legacy/debug/internal routes remain URL-only unless separately productized.']));
  ok('known_page_gaps_registered', includesAll(doc, ['Known page gaps are registered.', 'F0-B does not resolve page gaps.', 'F0-B freezes the fact that page gaps are known, classified, and not hidden.', 'release surfaces present', 'route exists but product page incomplete', 'future product-contract pages', 'do-not-build pages']));
  ok('bilingual_baseline_present', includesAll(doc, ['Locale baseline is implemented.', 'Locale infrastructure exists.', 'Language toggle is integrated into formal shells.', 'Operator formal surfaces are bilingual at product-copy level.', 'Customer and Admin formal surfaces are bilingual at product-copy level.', 'Raw/source identifiers remain untranslated.', 'Backend-returned values remain untranslated.', 'Bilingual baseline does not mean raw evidence translation.', 'Bilingual baseline does not alter route paths, identifiers, hashes, or contract values.']));
  ok('quality_baseline_present', includesAll(doc, ['Quality baseline is documented.', 'accessibility baseline', 'keyboard / focus baseline', 'responsive viewport smoke', 'empty / loading / error state register', 'visual smoke checklist', 'performance budget', 'Quality-gated does not mean legal WCAG certification.', 'Quality-gated does not mean automated visual regression coverage for every browser/device combination.']));
  ok('runtime_handoff_present', includesAll(doc, ['Runtime readiness moves to R-series.', 'R1 Runtime Evidence Stream Readiness', 'R2 Online State Estimation Loop', 'R3 Forecast Calibration & Residual Loop', 'R4 Runtime Health Service Gate', 'R5 Field Pilot Runtime Readiness', 'Frontend Productization is not Runtime Readiness.', 'Runtime readiness begins at R1.']));
  ok('freeze_policy_present', includesAll(doc, ['No more H-line frontend expansion without a new product contract.', 'H58-H67 are closed as frontend productization history.', 'Future frontend product surfaces require a new product contract, new route ownership statement, and new acceptance gate.']));
  ok('new_surface_policy_present', includesAll(doc, ['product contract', 'route ownership statement', 'surface owner', 'formal nav decision', 'nonclaim / boundary copy', 'bilingual copy requirement', 'accessibility / responsive / keyboard / state baseline', 'acceptance gate']));
  ok('route_nav_policy_present', includesAll(doc, ['new product routes', 'new broad wildcard route', 'new /app/* expansion', 'hidden debug route promotion', 'legacy route promotion into formal nav', 'route topology changes without new contract', 'URL-only legacy compatibility', 'do-not-build pages remain forbidden']));
  ok('frontend_runtime_readonly_nonclaim_present', doc.includes('Frontend Runtime Console v1 is replay-backed and read-only for this phase.'));
  ok('forbidden_positive_claims_absent', positiveStatusViolations(doc).length === 0, { violations: positiveStatusViolations(doc) });

  const scanned = diff.filter((file) => exists(file) && file !== acceptance);
  const mojibakeHits = scanned.map((file) => ({ file, hits: hits(read(file), mojibake) })).filter((entry) => entry.hits.length > 0);
  ok('no_mojibake_in_f0b_files', mojibakeHits.length === 0, { mojibakeHits, scanned });

  if (diff.includes(readme)) {
    const readmeText = read(readme);
    ok('readme_guard', readmeText.includes('F0-B') && !readmeText.includes('live production ready') && !readmeText.includes('runtime complete'));
  }

  const acceptanceText = read(acceptance);
  ok('acceptance_is_static_repo_read_only', includesAll(acceptanceText, ['node:fs', 'node:path']) && !hasNetworkCallToken(acceptanceText));

  console.log(JSON.stringify({
    ok: true,
    acceptance: 'ACCEPTANCE_F0_B_FRONTEND_PRODUCTIZATION_FREEZE_V1',
    phase: 'F0-B Frontend Productization Freeze Declaration',
    freeze: {
      operator: 'frozen',
      customer: 'frozen',
      admin: 'frozen',
      page_gaps: 'registered',
      locale: 'baseline-implemented',
      quality: 'quality-gated-baseline',
      runtime_handoff: 'R-series'
    },
    runtime_source_changed: false,
    route_topology_changed: false,
    backend_changed: false,
    package_changed: false,
    next: 'R1 Runtime Evidence Stream Readiness',
    changed_files_checked: diff,
    assertions
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, acceptance: 'ACCEPTANCE_F0_B_FRONTEND_PRODUCTIZATION_FREEZE_V1', error: error.message, details: error.details || null, assertions }, null, 2));
  process.exit(1);
}
