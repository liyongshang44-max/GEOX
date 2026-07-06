// scripts/frontend_acceptance/ACCEPTANCE_PFE_13_FRONTEND_PRODUCT_V1_FREEZE.cjs
'use strict';

const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const docs = [
  'docs/frontend-productization/PFE-13-FRONTEND-PRODUCT-V1-FREEZE.md',
  'docs/frontend-productization/PFE-13-FREEZE-MANIFEST.json',
  'docs/frontend-productization/PFE-13-ROUTE-INVENTORY.json',
  'docs/frontend-productization/PFE-13-FORMAL-SURFACES.md',
  'docs/frontend-productization/PFE-13-FREEZE-CHECKLIST.md',
  'docs/frontend-productization/PFE-13-FROZEN-ISSUE-REGISTER.md',
];
const baselineDocs = [
  'docs/frontend-productization/PFE-6-ACCESSIBILITY-KEYBOARD-COMPLIANCE.md',
  'docs/frontend-productization/PFE-7-RESPONSIVE-VIEWPORT-COMPLETION.md',
  'docs/frontend-productization/PFE-8-EMPTY-LOADING-ERROR-STATE-COMPLETION.md',
  'docs/frontend-productization/PFE-9-VISUAL-REGRESSION-SCREENSHOT-BASELINE.md',
  'docs/frontend-productization/PFE-10-PERFORMANCE-BUDGET-BUNDLE-HYGIENE.md',
  'docs/frontend-productization/PFE-11-PRODUCT-COPY-I18N-COMPLETION.md',
  'docs/frontend-productization/PFE-12-DEMO-MODE-RELEASE-CANDIDATE.md',
];
const evidenceFiles = [
  'docs/frontend-productization/PFE-9-SCREENSHOT-MANIFEST.json',
  'docs/frontend-productization/PFE-10-BUNDLE-BUDGET.json',
  'docs/frontend-productization/PFE-12-DEMO-MANIFEST.json',
  'scripts/frontend_acceptance/CHECK_PFE_10_WEB_BUNDLE_BUDGET.cjs',
  'scripts/frontend_acceptance/ACCEPTANCE_PFE_11_PRODUCT_COPY_I18N_COMPLETION.cjs',
  'scripts/frontend_acceptance/ACCEPTANCE_PFE_12_DEMO_MODE_RELEASE_CANDIDATE.cjs',
];
const acceptanceFile = 'scripts/frontend_acceptance/ACCEPTANCE_PFE_13_FRONTEND_PRODUCT_V1_FREEZE.cjs';
const allowedChangedFiles = new Set([...docs, acceptanceFile]);
const assertions = [];

function repoPath(file) { return path.join(root, file); }
function exists(file) { return fs.existsSync(repoPath(file)); }
function read(file) { return fs.readFileSync(repoPath(file), 'utf8'); }
function lower(value) { return String(value).toLowerCase(); }
function includesAll(text, tokens) { const haystack = lower(text); return tokens.every((token) => haystack.includes(lower(token))); }
function assert(name, passed, details = {}) { assertions.push({ name, passed: passed === true, details }); if (passed !== true) { const error = new Error('ASSERTION_FAILED:' + name); error.details = details; throw error; } console.log('[pfe-13-frontend-product-v1-freeze] ok:', name); }
function runGit(args) { try { return cp.execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch (_error) { return ''; } }
function statusFiles() { const output = runGit(['status', '--short', '--untracked-files=all']); if (!output) return []; return output.split(/\r?\n/).map((line) => { if (!line.trim()) return ''; const arrow = line.indexOf(' -> '); if (arrow >= 0) return line.slice(arrow + 4).trim(); return line.replace(/^[ MADRCU?!]{1,2}\s+/, '').trim(); }).filter(Boolean); }
function changedFiles() { const set = new Set(); const output = runGit(['diff', '--name-only', 'origin/main...HEAD']) || runGit(['diff', '--name-only', 'main...HEAD']); if (output) output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).forEach((file) => set.add(file)); statusFiles().forEach((file) => set.add(file)); return Array.from(set).sort(); }
function parseJson(file) { return JSON.parse(read(file)); }
function docsText() { return docs.filter((file) => file.endsWith('.md')).map(read).join('\n'); }

try {
  [...docs, ...baselineDocs, ...evidenceFiles, acceptanceFile].forEach((file) => assert('exists:' + file, exists(file), { file }));

  const diff = changedFiles();
  const manifest = parseJson('docs/frontend-productization/PFE-13-FREEZE-MANIFEST.json');
  const inventory = parseJson('docs/frontend-productization/PFE-13-ROUTE-INVENTORY.json');
  const checklist = read('docs/frontend-productization/PFE-13-FREEZE-CHECKLIST.md');
  const register = read('docs/frontend-productization/PFE-13-FROZEN-ISSUE-REGISTER.md');
  const allDocs = docsText();
  const flags = {
    frozen: manifest.frozen,
    productionLaunch: manifest.productionLaunch,
    commercialLaunch: manifest.commercialLaunch,
    liveDeviceConnected: manifest.liveDeviceConnected,
    productionGatewayOnline: manifest.productionGatewayOnline,
    fieldPilotStarted: manifest.fieldPilotStarted,
    aoActDispatchEnabled: manifest.aoActDispatchEnabled,
  };
  const requiredBaselines = ['PFE-6', 'PFE-7', 'PFE-8', 'PFE-9', 'PFE-10', 'PFE-11', 'PFE-12'];
  const customerRoutes = ['/customer/dashboard', '/customer/fields', '/customer/fields/:fieldId', '/customer/fields/:fieldId/export', '/customer/operations', '/customer/operations/:operationId', '/customer/operations/:operationId/export', '/customer/reports', '/customer/export'];
  const operatorRoutes = ['/operator/twin', '/operator/fields', '/operator/fields/:fieldId', '/operator/fields/:fieldId/state', '/operator/fields/:fieldId/evidence', '/operator/fields/:fieldId/forecast', '/operator/fields/:fieldId/scenario', '/operator/fields/:fieldId/residual', '/operator/fields/:fieldId/calibration', '/operator/fields/:fieldId/health', '/operator/fields/:fieldId/audit', '/operator/twin/gateway-demo', '/operator/pilot'];
  const adminRoutes = ['/admin/dashboard', '/admin/fields', '/admin/operations', '/admin/devices', '/admin/evidence', '/admin/skills', '/admin/healthz'];

  assert('changed_files_allowlist', diff.length === 0 || diff.every((file) => allowedChangedFiles.has(file)), { diff, allowed: Array.from(allowedChangedFiles) });
  assert('no_route_topology_changes', diff.every((file) => file !== 'apps/web/src/app/App.tsx' && file !== 'apps/web/src/app/AppShell.tsx' && !file.startsWith('apps/web/src/app/routes/')), { diff });
  assert('no_web_runtime_source_changes', diff.every((file) => !file.startsWith('apps/web/src/features/') && !file.startsWith('apps/web/src/layouts/') && !file.startsWith('apps/web/src/styles/') && !file.startsWith('apps/web/src/design-system/')), { diff });
  assert('no_server_migration_contract_fixture_changes', diff.every((file) => !file.startsWith('apps/server/') && !file.startsWith('migrations/') && !file.startsWith('packages/contracts/') && !file.startsWith('fixtures/')), { diff });
  assert('no_package_or_workspace_changes', diff.every((file) => !['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'apps/web/package.json'].includes(file)), { diff });
  assert('no_ci_workflow_changes', diff.every((file) => !file.startsWith('.github/')), { diff });
  assert('no_dist_or_audit_binary_changes', diff.every((file) => !file.startsWith('apps/web/dist/') && !/docs\/audit\/.*\.(png|jpg|jpeg|webp)$/i.test(file)), { diff });

  assert('freeze_manifest_valid', manifest.phase === 'PFE-13 Frontend Product v1 Freeze' && manifest.version === 1 && manifest.freezeMode === 'governed-frontend-product-v1' && manifest.productLine === 'PFE');
  assert('freeze_manifest_flags_valid', flags.frozen === true && flags.productionLaunch === false && flags.commercialLaunch === false && flags.liveDeviceConnected === false && flags.productionGatewayOnline === false && flags.fieldPilotStarted === false && flags.aoActDispatchEnabled === false, flags);
  assert('freeze_manifest_surface_counts', manifest.surfaces?.customer === 9 && manifest.surfaces?.operator === 13 && manifest.surfaces?.admin === 7);
  assert('freeze_manifest_required_baselines', Array.isArray(manifest.requiredBaselines) && requiredBaselines.every((label) => manifest.requiredBaselines.join('\n').includes(label)));
  assert('freeze_manifest_change_policy', manifest.postFreezeChangePolicy?.routeChangeRequiresNewPhase === true && manifest.postFreezeChangePolicy?.capabilityChangeRequiresNewPhase === true && manifest.postFreezeChangePolicy?.visualChangeRequiresRegressionEvidence === true && manifest.postFreezeChangePolicy?.copyChangeRequiresI18nGate === true && manifest.postFreezeChangePolicy?.bundleChangeRequiresBudgetCheck === true);

  assert('surface_inventory_customer_complete', Array.isArray(inventory.customer) && inventory.customer.length === 9 && customerRoutes.every((route) => inventory.customer.includes(route)));
  assert('surface_inventory_operator_complete', Array.isArray(inventory.operator) && inventory.operator.length === 13 && operatorRoutes.every((route) => inventory.operator.includes(route)));
  assert('surface_inventory_admin_complete', Array.isArray(inventory.admin) && inventory.admin.length === 7 && adminRoutes.every((route) => inventory.admin.includes(route)));
  assert('surface_inventory_supporting_complete', Array.isArray(inventory.supporting) && inventory.supporting.includes('/login') && inventory.supporting.includes('LocaleToggle') && inventory.supporting.includes('PFE-12 demo / RC baseline'));
  assert('surface_inventory_schema_present', Array.isArray(inventory.evidenceSchema) && ['role owner', 'status', 'source baseline', 'post-freeze change rule'].every((item) => inventory.evidenceSchema.includes(item)));

  assert('freeze_checklist_has_required_fields', includesAll(checklist, ['area', 'requirement', 'evidence file', 'acceptance command', 'status', 'blocker if failed']));
  assert('freeze_checklist_has_core_requirements', includesAll(checklist, ['PFE-6', 'PFE-7', 'PFE-8', 'PFE-9', 'PFE-10', 'PFE-11', 'PFE-12', 'Customer 9', 'Operator 13', 'Admin 7', 'post-freeze change policy']));
  assert('frozen_issue_register_has_blocker_policy', includesAll(register, ['Blocking issues not allowed', 'missing formal route inventory', 'missing PFE baseline doc', 'bundle budget failed', 'copy / i18n gate failed']));
  assert('frozen_issue_register_defers_later_work', includesAll(register, ['pixel diff', 'Lighthouse score', 'RUM', 'full browser / device matrix', 'native translation review']));
  assert('baseline_docs_present', baselineDocs.every(exists));
  assert('evidence_files_present', evidenceFiles.every(exists));
  assert('pfe13_docs_have_freeze_policy', includesAll(allDocs, ['PFE-13', 'freeze', 'post-freeze change policy', 'static acceptance', 'governed frontend product baseline']));
  assert('no_positive_flag_claim_in_docs', !lower(allDocs).includes('productionlaunch=true') && !lower(allDocs).includes('commerciallaunch=true') && !lower(allDocs).includes('livedeviceconnected=true') && !lower(allDocs).includes('productiongatewayonline=true') && !lower(allDocs).includes('fieldpilotstarted=true') && !lower(allDocs).includes('aoactdispatchenabled=true'));

  console.log(JSON.stringify({
    ok: true,
    acceptance: 'ACCEPTANCE_PFE_13_FRONTEND_PRODUCT_V1_FREEZE',
    scope: 'frontend product v1 freeze only',
    freeze: flags,
    surfaces: { customer: 9, operator: 13, admin: 7, supporting: manifest.surfaces.supporting },
    checks: { freeze_manifest: 'passed', surface_inventory: 'passed', freeze_checklist: 'passed', issue_register: 'passed', baseline_chain: 'passed', no_route_changes: 'passed', no_package_changes: 'passed', no_backend_changes: 'passed', no_runtime_source_changes: 'passed' },
    changed_files_checked: diff.length ? diff : Array.from(allowedChangedFiles),
    assertions,
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, acceptance: 'ACCEPTANCE_PFE_13_FRONTEND_PRODUCT_V1_FREEZE', error: error.message, details: error.details || null, assertions }, null, 2));
  process.exit(1);
}
