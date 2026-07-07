// scripts/frontend_acceptance/ACCEPTANCE_PFA_0_PAGE_QUALITY_AUDIT.cjs
'use strict';

const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const mustExist = [
  'docs/frontend-acceptance/PFA-0-PAGE-QUALITY-AUDIT.md',
  'docs/frontend-acceptance/PFA-0-REVIEW-MANIFEST.json',
  'docs/frontend-acceptance/PFA-0-ROUTE-REVIEW-MATRIX.md',
  'docs/frontend-acceptance/PFA-0-ROUTE-REVIEW-MATRIX.json',
  'docs/frontend-acceptance/PFA-0-ISSUE-REGISTER.md',
  'docs/frontend-acceptance/PFA-0-REVIEW-RUBRIC.md',
  'docs/frontend-acceptance/PFA-POST-FREEZE-TASK-LINE.md',
  'docs/frontend-productization/PFE-13-ROUTE-INVENTORY.json',
  'scripts/frontend_acceptance/CAPTURE_PFA_0_PAGE_REVIEW.cjs',
  'scripts/frontend_acceptance/ACCEPTANCE_PFA_0_PAGE_QUALITY_AUDIT.cjs',
];
const allowed = new Set(mustExist.filter((f) => f.startsWith('docs/frontend-acceptance/') || f.startsWith('scripts/frontend_acceptance/ACCEPTANCE_PFA_0') || f.startsWith('scripts/frontend_acceptance/CAPTURE_PFA_0')));
const required = ['surface','route','concreteAuditPath','localeCoverage','zhCnStatus','enUsStatus','viewportsReviewed','routeHealth','boundarySafety','roleSeparation','i18nConsistency','visualHierarchy','tableReadability','denseContentHandling','demoDataQuality','responsiveSanity','demoReadiness','highestSeverity','issueIds','remediationPhase','pfa1Required'];
const assertions = [];

function p(f){ return path.join(root, f); }
function read(f){ return fs.readFileSync(p(f), 'utf8'); }
function json(f){ return JSON.parse(read(f)); }
function ok(name, pass, details = {}){ assertions.push({ name, passed: pass === true, details }); if (pass !== true) { const e = new Error('ASSERTION_FAILED:' + name); e.details = details; throw e; } console.log('[pfa-0-page-quality-audit] ok:', name); }
function git(args){ try { return cp.execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore','pipe','ignore'] }).trim(); } catch { return ''; } }
function status(){ const out = git(['status','--short','--untracked-files=all']); if (!out) return []; return out.split(/\r?\n/).map((x) => x.includes(' -> ') ? x.split(' -> ').pop().trim() : x.replace(/^[ MADRCU?!]{1,2}\s+/, '').trim()).filter(Boolean); }
function diff(){ const set = new Set(); const out = git(['diff','--name-only','origin/main...HEAD']) || git(['diff','--name-only','main...HEAD']); if (out) out.split(/\r?\n/).filter(Boolean).forEach((x) => set.add(x.trim())); status().forEach((x) => set.add(x)); return [...set].sort(); }
function routes(inv, group){ return Array.isArray(inv[group]) ? inv[group].map((r) => r.route) : []; }
function expand(matrix, record){ return { ...matrix.defaults, ...record, issueIds: [...new Set([...(matrix.defaults.issueIds || []), ...(record.issueIds || [])])] }; }
function mroutes(records, group){ return records.filter((r) => r.surface === group).map((r) => r.route); }
function concrete(route, map){ let out = route; for (const [k,v] of Object.entries(map || {})) out = out.replaceAll(k, v); return out; }
function hasFields(r){ return required.every((k) => Object.prototype.hasOwnProperty.call(r, k)); }
function noPending(r){ return !JSON.stringify(r).toLowerCase().includes('pending'); }
function localeSplit(r){ return Array.isArray(r.localeCoverage) && r.localeCoverage.includes('zh-CN') && r.localeCoverage.includes('en-US'); }
function actual(r){ return typeof r.route === 'string' && r.route.startsWith('/'); }
function hasText(text, items){ const s = text.toLowerCase(); return items.every((x) => s.includes(String(x).toLowerCase())); }

try {
  mustExist.forEach((f) => ok('exists:' + f, fs.existsSync(p(f)), { file: f }));
  const changed = diff();
  ok('changed_files_allowlist', changed.length === 0 || changed.every((f) => allowed.has(f)), { changed, allowed: [...allowed] });
  ok('no_runtime_source_changes', changed.every((f) => !f.startsWith('apps/web/') && !f.startsWith('apps/server/') && !f.startsWith('.github/') && !f.startsWith('apps/web/dist/') && !f.startsWith('docs/audit/')), { changed });

  const manifest = json('docs/frontend-acceptance/PFA-0-REVIEW-MANIFEST.json');
  const matrix = json('docs/frontend-acceptance/PFA-0-ROUTE-REVIEW-MATRIX.json');
  const inv = json('docs/frontend-productization/PFE-13-ROUTE-INVENTORY.json');
  const issues = read('docs/frontend-acceptance/PFA-0-ISSUE-REGISTER.md');
  const doc = read('docs/frontend-acceptance/PFA-0-PAGE-QUALITY-AUDIT.md');
  const taskLine = read('docs/frontend-acceptance/PFA-POST-FREEZE-TASK-LINE.md');
  const capture = read('scripts/frontend_acceptance/CAPTURE_PFA_0_PAGE_REVIEW.cjs');
  const records = matrix.records.map((record) => expand(matrix, record));
  const actualRecords = records.filter(actual);
  const allViewports = ['desktopReview','laptopReview','mobileSpotCheck'];

  ok('manifest_full_default', manifest.version === 2 && manifest.defaultCaptureMode === 'full');
  ok('manifest_dimensions_complete', ['roleSeparation','denseContentHandling','responsiveSanity'].every((x) => manifest.qualityDimensions.includes(x)));
  ok('matrix_v3', matrix.version === 3 && matrix.recordModel === 'route-review-overrides-v3' && matrix.defaults && Array.isArray(matrix.records));
  ok('matrix_required_fields_after_expansion', records.length === 33 && records.every(hasFields));
  ok('matrix_no_pending_or_capture_gap', records.every((r) => noPending(r) && r.routeHealth !== 'capture-gap-classified'));
  ok('matrix_locale_split', records.every(localeSplit));
  ok('matrix_all_actual_routes_have_all_viewports', actualRecords.length === 30 && actualRecords.every((r) => allViewports.every((v) => r.viewportsReviewed.includes(v))));
  ok('matrix_runtime_evidence', matrix.runtimeEvidence?.screenshots === 180 && matrix.runtimeEvidence?.actualRoutes === 30 && matrix.runtimeEvidence?.runtimeResult === 'pass' && matrix.runtimeEvidence?.pageQualityResult === 'fail');
  ok('matrix_customer_coverage', routes(inv, 'customer').every((r) => mroutes(records, 'customer').includes(r)));
  ok('matrix_operator_coverage', routes(inv, 'operator').every((r) => mroutes(records, 'operator').includes(r)));
  ok('matrix_admin_coverage', routes(inv, 'admin').every((r) => mroutes(records, 'admin').includes(r)));
  ok('matrix_supporting_coverage', ['/login','LocaleToggle','ProductDataTable','Product state primitives'].every((r) => mroutes(records, 'supporting').includes(r)));
  ok('matrix_concrete_paths', actualRecords.filter((r) => r.route.includes(':')).every((r) => r.concreteAuditPath === concrete(r.route, manifest.concreteRouteBindings)));
  ok('matrix_no_open_capture_issue_ids', records.every((r) => !r.issueIds.includes('PFA0-CAP-001') && !r.issueIds.includes('PFA0-CAP-002')));
  ok('matrix_remediation_phases', records.every((r) => /^PFA-[2-6]$/.test(r.remediationPhase)));
  ok('issues_reconciled', hasText(issues, ['180/180 PASS','PFA0-I18N-001','PFA0-RWD-001','PFA0-EXP-001','PFA0-DEN-001','PFA0-CUS-006','PFA0-CAP-001','resolved','PFA0-CAP-002']));
  ok('docs_runtime_vs_quality_split', hasText(doc, ['runtime capture PASS != page-quality PASS','180/180 PASS','page-quality audit: FAIL','PFA-7']));
  ok('task_line_complete', ['PFA-0','PFA-1','PFA-2','PFA-3','PFA-4','PFA-5','PFA-6','PFA-7'].every((x) => taskLine.includes(x)));
  ok('capture_full_default', capture.includes("PFA0_CAPTURE_MODE || 'full'"));
  ok('capture_auth_placeholder_guard', capture.includes('containsAuthPlaceholder') && capture.includes('auth validation placeholder still visible'));
  ok('capture_auth_wide_fail_fast_guard', capture.includes('AUTH_FAILURE_LIMIT') && capture.includes('auth-wide capture failure'));
  ok('capture_waits_for_session_guard', capture.includes('waitForRouteReady') && capture.includes('SESSION_GUARD_TIMEOUT_MS') && capture.includes('session guard did not settle'));
  ok('capture_uses_real_browser_login', capture.includes('createAuthenticatedStorageState') && capture.includes("locator('#token-input')") && capture.includes('context.storageState()'));
  ok('capture_checks_browser_auth_me', capture.includes('browser auth/me') && capture.includes('authorization=') && capture.includes("'/api/v1/auth/me'"));
  ok('capture_pins_runtime_api_base', capture.includes('VITE_API_BASE_URL: WEB_BASE_URL') && capture.includes('VITE_API_BASE: WEB_BASE_URL') && capture.includes('GEOX_WEB_PROXY_TARGET: API_BASE_URL'));
  ok('capture_does_not_hand_inject_session', !capture.includes('async function applySession'));

  console.log(JSON.stringify({ ok: true, acceptance: 'ACCEPTANCE_PFA_0_PAGE_QUALITY_AUDIT', matrixRecords: records.length, actualRoutes: actualRecords.length, assertions }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, acceptance: 'ACCEPTANCE_PFA_0_PAGE_QUALITY_AUDIT', error: error.message, details: error.details || null, assertions }, null, 2));
  process.exit(1);
}
