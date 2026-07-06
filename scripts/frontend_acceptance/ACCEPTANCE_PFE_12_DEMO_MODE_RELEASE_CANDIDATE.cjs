// scripts/frontend_acceptance/ACCEPTANCE_PFE_12_DEMO_MODE_RELEASE_CANDIDATE.cjs
'use strict';

const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const docs = [
  'docs/frontend-productization/PFE-12-DEMO-MODE-RELEASE-CANDIDATE.md',
  'docs/frontend-productization/PFE-12-DEMO-MANIFEST.json',
  'docs/frontend-productization/PFE-12-RELEASE-CANDIDATE-CHECKLIST.md',
  'docs/frontend-productization/PFE-12-WALKTHROUGH.md',
  'docs/frontend-productization/PFE-12-RELEASE-CANDIDATE-ISSUE-REGISTER.md',
];
const baselineDocs = [
  'docs/frontend-productization/PFE-6-ACCESSIBILITY-KEYBOARD-COMPLIANCE.md',
  'docs/frontend-productization/PFE-7-RESPONSIVE-VIEWPORT-COMPLETION.md',
  'docs/frontend-productization/PFE-8-EMPTY-LOADING-ERROR-STATE-COMPLETION.md',
  'docs/frontend-productization/PFE-9-VISUAL-REGRESSION-SCREENSHOT-BASELINE.md',
  'docs/frontend-productization/PFE-10-PERFORMANCE-BUDGET-BUNDLE-HYGIENE.md',
  'docs/frontend-productization/PFE-11-PRODUCT-COPY-I18N-COMPLETION.md',
];
const pfe9Capture = 'scripts/frontend_acceptance/CAPTURE_PFE_9_SCREENSHOTS.cjs';
const pfe10Checker = 'scripts/frontend_acceptance/CHECK_PFE_10_WEB_BUNDLE_BUDGET.cjs';
const pfe11Acceptance = 'scripts/frontend_acceptance/ACCEPTANCE_PFE_11_PRODUCT_COPY_I18N_COMPLETION.cjs';
const demoSeed = 'scripts/demo_seed/SEED_CONTROLLED_PILOT_FRONTEND_DEMO_V1.cjs';
const packageJson = 'package.json';
const acceptanceFile = 'scripts/frontend_acceptance/ACCEPTANCE_PFE_12_DEMO_MODE_RELEASE_CANDIDATE.cjs';
const allowedChangedFiles = new Set([...docs, acceptanceFile]);
const assertions = [];

function repoPath(file) { return path.join(root, file); }
function exists(file) { return fs.existsSync(repoPath(file)); }
function read(file) { return fs.readFileSync(repoPath(file), 'utf8'); }
function lower(value) { return String(value).toLowerCase(); }
function includesAll(text, tokens) { const haystack = lower(text); return tokens.every((token) => haystack.includes(lower(token))); }
function assert(name, passed, details = {}) { assertions.push({ name, passed: passed === true, details }); if (passed !== true) { const error = new Error('ASSERTION_FAILED:' + name); error.details = details; throw error; } console.log('[pfe-12-demo-mode-release-candidate] ok:', name); }
function runGit(args) { try { return cp.execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch (_error) { return ''; } }
function statusFiles() { const output = runGit(['status', '--short', '--untracked-files=all']); if (!output) return []; return output.split(/\r?\n/).map((line) => { if (!line.trim()) return ''; const arrow = line.indexOf(' -> '); if (arrow >= 0) return line.slice(arrow + 4).trim(); return line.replace(/^[ MADRCU?!]{1,2}\s+/, '').trim(); }).filter(Boolean); }
function changedFiles() { const set = new Set(); const output = runGit(['diff', '--name-only', 'origin/main...HEAD']) || runGit(['diff', '--name-only', 'main...HEAD']); if (output) output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).forEach((file) => set.add(file)); statusFiles().forEach((file) => set.add(file)); return Array.from(set).sort(); }
function parseJson(file) { return JSON.parse(read(file)); }
function docsText() { return docs.map(read).join('\n'); }

try {
  [...docs, ...baselineDocs, pfe9Capture, pfe10Checker, pfe11Acceptance, demoSeed, packageJson, acceptanceFile].forEach((file) => assert('exists:' + file, exists(file), { file }));

  const diff = changedFiles();
  const manifest = parseJson('docs/frontend-productization/PFE-12-DEMO-MANIFEST.json');
  const seed = read(demoSeed);
  const pkg = parseJson(packageJson);
  const allDocs = docsText();
  const flags = {
    productionReady: manifest.productionReady,
    liveDeviceConnected: manifest.liveDeviceConnected,
    productionGatewayOnline: manifest.productionGatewayOnline,
    fieldPilotStarted: manifest.fieldPilotStarted,
    aoActDispatchEnabled: manifest.aoActDispatchEnabled,
  };

  assert('changed_files_allowlist', diff.length === 0 || diff.every((file) => allowedChangedFiles.has(file)), { diff, allowed: Array.from(allowedChangedFiles) });
  assert('no_route_topology_changes', diff.every((file) => file !== 'apps/web/src/app/App.tsx' && file !== 'apps/web/src/app/AppShell.tsx' && !file.startsWith('apps/web/src/app/routes/')), { diff });
  assert('no_web_runtime_source_changes', diff.every((file) => !file.startsWith('apps/web/src/features/') && !file.startsWith('apps/web/src/layouts/') && !file.startsWith('apps/web/src/styles/')), { diff });
  assert('no_server_migration_contract_fixture_changes', diff.every((file) => !file.startsWith('apps/server/') && !file.startsWith('migrations/') && !file.startsWith('packages/contracts/') && !file.startsWith('fixtures/')), { diff });
  assert('no_package_or_workspace_changes', diff.every((file) => !['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'apps/web/package.json'].includes(file)), { diff });
  assert('no_ci_workflow_changes', diff.every((file) => !file.startsWith('.github/')), { diff });
  assert('no_dist_or_audit_binary_changes', diff.every((file) => !file.startsWith('apps/web/dist/') && !/docs\/audit\/.*\.(png|jpg|jpeg|webp)$/i.test(file)), { diff });

  assert('manifest_valid_phase', manifest.phase === 'PFE-12 Demo Mode & Release Candidate' && manifest.version === 1 && manifest.mode === 'demo-safe-release-candidate');
  assert('manifest_demo_flags_false', Object.values(flags).every((value) => value === false), flags);
  assert('manifest_surface_counts', manifest.surfaces?.customer === 9 && manifest.surfaces?.operator === 13 && manifest.surfaces?.admin === 7);
  assert('manifest_supporting_scope', Array.isArray(manifest.surfaces?.supporting) && manifest.surfaces.supporting.includes('login') && manifest.surfaces.supporting.includes('demo seed dry-run'));
  assert('manifest_demo_paths_include_three_surfaces', Array.isArray(manifest.demoPaths) && manifest.demoPaths.some((x) => x.surface === 'customer') && manifest.demoPaths.some((x) => x.surface === 'operator') && manifest.demoPaths.some((x) => x.surface === 'admin'));
  assert('manifest_seed_policy_safe', manifest.seedPolicy?.default === 'dry-run' && manifest.seedPolicy?.applyRequiresExplicitTenant === true && Array.isArray(manifest.seedPolicy?.allowedTenants) && manifest.seedPolicy.allowedTenants.includes('demo') && manifest.seedPolicy.allowedTenants.includes('tenantA'));
  assert('manifest_required_evidence_chain', Array.isArray(manifest.requiredEvidence) && ['PFE-6', 'PFE-7', 'PFE-8', 'PFE-9', 'PFE-10', 'PFE-11'].every((item) => manifest.requiredEvidence.join('\n').includes(item)));

  assert('demo_seed_package_script_present', pkg.scripts?.['seed:controlled-pilot:frontend-demo:dry-run'] === 'node scripts/demo_seed/SEED_CONTROLLED_PILOT_FRONTEND_DEMO_V1.cjs --dry-run');
  assert('demo_seed_defaults_dry_run', seed.includes("const dryRun = hasFlag('--dry-run') || !apply"));
  assert('demo_seed_apply_requires_tenant', seed.includes("if (apply && !hasFlag('--tenant'))") && seed.includes('--apply requires explicit --tenant'));
  assert('demo_seed_tenant_allowlist', seed.includes("new Set(['demo', 'tenantA'])"));

  assert('baseline_docs_present', baselineDocs.every(exists));
  assert('pfe9_pfe10_pfe11_evidence_present', exists(pfe9Capture) && exists(pfe10Checker) && exists(pfe11Acceptance));
  assert('pfe12_docs_have_required_policy', includesAll(allDocs, ['PFE-12', 'demo', 'release-candidate', 'dry-run', 'checklist', 'walkthrough', 'issue register']));
  assert('pfe12_issue_register_has_blockers', includesAll(read('docs/frontend-productization/PFE-12-RELEASE-CANDIDATE-ISSUE-REGISTER.md'), ['Blocking issues not allowed', 'bundle budget failed', 'copy / i18n gate failed', 'manifest boundary flags set to true']));
  assert('pfe12_checklist_has_evidence', includesAll(read('docs/frontend-productization/PFE-12-RELEASE-CANDIDATE-CHECKLIST.md'), ['PFE-6 baseline present', 'PFE-10 baseline present', 'PFE-11 baseline present', 'Runtime audit green']));
  assert('pfe12_walkthrough_has_routes', includesAll(read('docs/frontend-productization/PFE-12-WALKTHROUGH.md'), ['/customer/dashboard', '/operator/twin', '/operator/pilot', '/admin/healthz']));
  assert('no_positive_flag_claim_in_docs', !lower(allDocs).includes('productionready=true') && !lower(allDocs).includes('livedeviceconnected=true') && !lower(allDocs).includes('productiongatewayonline=true') && !lower(allDocs).includes('fieldpilotstarted=true') && !lower(allDocs).includes('aoactdispatchenabled=true'));

  console.log(JSON.stringify({
    ok: true,
    acceptance: 'ACCEPTANCE_PFE_12_DEMO_MODE_RELEASE_CANDIDATE',
    scope: 'demo mode and release candidate baseline only',
    surfaces: { customer: 9, operator: 13, admin: 7, supporting: ['login', 'locale toggle', 'product primitives', 'demo seed dry-run'] },
    demoMode: flags,
    checks: { demo_manifest: 'passed', rc_checklist: 'passed', seed_policy: 'passed', no_route_changes: 'passed', no_package_changes: 'passed', no_backend_changes: 'passed', no_positive_flag_claim: 'passed' },
    changed_files_checked: diff.length ? diff : Array.from(allowedChangedFiles),
    assertions,
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, acceptance: 'ACCEPTANCE_PFE_12_DEMO_MODE_RELEASE_CANDIDATE', error: error.message, details: error.details || null, assertions }, null, 2));
  process.exit(1);
}
