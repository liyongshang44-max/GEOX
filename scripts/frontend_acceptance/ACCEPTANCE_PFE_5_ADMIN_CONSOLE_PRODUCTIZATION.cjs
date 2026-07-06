// scripts/frontend_acceptance/ACCEPTANCE_PFE_5_ADMIN_CONSOLE_PRODUCTIZATION.cjs
'use strict';

const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const docs = [
  'docs/frontend-productization/PFE-5-ADMIN-CONSOLE-PRODUCTIZATION.md',
  'docs/frontend-productization/PFE-5-ADMIN-SURFACE-REVIEW.md',
];
const baselineFiles = [
  'docs/frontend-productization/PFE-1-PAGE-CONTRACT-REGISTER.md',
  'docs/frontend-productization/PFE-2-DESIGN-SYSTEM-V1-COMPLETION.md',
  'apps/web/src/design-system/product/index.ts',
];
const adminSources = [
  'apps/web/src/layouts/AdminLayout.tsx',
  'apps/web/src/features/admin/pages/AdminDashboardPage.tsx',
  'apps/web/src/features/admin/pages/AdminFieldsPage.tsx',
  'apps/web/src/features/admin/pages/AdminOperationsPage.tsx',
  'apps/web/src/features/admin/pages/AdminDevicesPage.tsx',
  'apps/web/src/features/admin/pages/AdminEvidencePage.tsx',
  'apps/web/src/features/admin/pages/AdminSkillsPage.tsx',
  'apps/web/src/features/admin/pages/AdminHealthzPage.tsx',
  'apps/web/src/styles/adminControlPlane.css',
];
const acceptanceFile = 'scripts/frontend_acceptance/ACCEPTANCE_PFE_5_ADMIN_CONSOLE_PRODUCTIZATION.cjs';
const allowedChangedFiles = new Set([...docs, ...adminSources, acceptanceFile]);
const assertions = [];

function repoPath(file) { return path.join(root, file); }
function exists(file) { return fs.existsSync(repoPath(file)); }
function read(file) { return fs.readFileSync(repoPath(file), 'utf8'); }
function lower(value) { return String(value).toLowerCase(); }
function join(parts) { return parts.join(''); }
function includesAll(text, tokens) { const haystack = lower(text); return tokens.every((token) => haystack.includes(lower(token))); }
function assert(name, passed, details = {}) { assertions.push({ name, passed: passed === true, details }); if (passed !== true) { const error = new Error('ASSERTION_FAILED:' + name); error.details = details; throw error; } console.log('[pfe-5-admin-console-productization] ok:', name); }
function runGit(args) { try { return cp.execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch (_error) { return ''; } }
function statusFiles() { const output = runGit(['status', '--short', '--untracked-files=all']); if (!output) return []; return output.split(/\r?\n/).map((line) => { if (!line.trim()) return ''; const arrow = line.indexOf(' -> '); if (arrow >= 0) return line.slice(arrow + 4).trim(); return line.replace(/^[ MADRCU?!]{1,2}\s+/, '').trim(); }).filter(Boolean); }
function changedFiles() { const set = new Set(); const output = runGit(['diff', '--name-only', 'origin/main...HEAD']) || runGit(['diff', '--name-only', 'main...HEAD']); if (output) output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).forEach((file) => set.add(file)); statusFiles().forEach((file) => set.add(file)); return Array.from(set).sort(); }
function combined(files) { return files.map(read).join('\n'); }
function assertNoText(text, tokens, name) { const haystack = lower(text); const violations = tokens.filter((token) => haystack.includes(lower(token))); assert(name, violations.length === 0, { violations }); }

try {
  [...docs, ...baselineFiles, ...adminSources, acceptanceFile].forEach((file) => assert('exists:' + file, exists(file), { file }));

  const diff = changedFiles();
  const docText = combined(docs);
  const source = combined(adminSources);
  const layout = read('apps/web/src/layouts/AdminLayout.tsx');
  const pfe1 = read('docs/frontend-productization/PFE-1-PAGE-CONTRACT-REGISTER.md');
  const pfe2AndIndex = read('docs/frontend-productization/PFE-2-DESIGN-SYSTEM-V1-COMPLETION.md') + '\n' + read('apps/web/src/design-system/product/index.ts');
  const routes = ['/admin/dashboard', '/admin/fields', '/admin/operations', '/admin/devices', '/admin/evidence', '/admin/skills', '/admin/healthz'];

  assert('changed_files_allowlist', diff.length === 0 || diff.every((file) => allowedChangedFiles.has(file)), { diff, allowed: Array.from(allowedChangedFiles) });
  assert('no_route_topology_changes', diff.every((file) => file !== 'apps/web/src/app/App.tsx' && !file.startsWith('apps/web/src/app/routes/')), { diff });
  assert('no_customer_operator_backend_contract_fixture_package_changes', diff.every((file) => !file.startsWith('apps/web/src/features/customer/') && !file.startsWith('apps/web/src/features/operator/') && !file.startsWith('apps/server/') && !file.startsWith('migrations/') && !file.startsWith('packages/contracts/') && !file.startsWith('fixtures/') && !file.startsWith('.github/') && !['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml'].includes(file)), { diff });

  assert('pfe1_admin_contracts_present', routes.every((route) => pfe1.includes(route)), { routes });
  assert('pfe2_primitives_present', includesAll(pfe2AndIndex, ['ProductPageShell', 'ProductPageHeader', 'ProductBoundaryBanner', 'ProductSectionCard', 'ProductMetricTile', 'ProductStatusBadge', 'ProductDataTable', 'ProductScopeBar']));
  assert('pfe5_docs_cover_all_admin_surfaces', routes.every((route) => docText.includes(route)), { routes });
  assert('admin_layout_landmark_corrected', layout.includes('<div className="adminLayoutMain"') && !layout.includes('<main className="adminLayoutMain"'));
  assert('admin_pages_own_product_page_shell', adminSources.filter((file) => file.includes('/pages/')).every((file) => read(file).includes('ProductPageShell')));
  assert('admin_sources_use_product_primitives', includesAll(source, ['ProductPageShell', 'ProductPageHeader', 'ProductBoundaryBanner', 'ProductSectionCard', 'ProductMetricTile', 'ProductStatusBadge', 'ProductDataTable', 'ProductScopeBar']));

  assert('dashboard_governance_overview_present', includesAll(read('apps/web/src/features/admin/pages/AdminDashboardPage.tsx'), ['Admin governance overview', 'URL-only compatibility', 'Future Admin contracts remain deferred']));
  assert('fields_governance_readback_present', includesAll(read('apps/web/src/features/admin/pages/AdminFieldsPage.tsx'), ['Field governance readback', 'Not customer report framing', 'No uncontrolled mutation']));
  assert('operations_non_dispatch_governance_present', includesAll(read('apps/web/src/features/admin/pages/AdminOperationsPage.tsx'), ['Operation governance is not dispatch', 'Blocked/degraded', 'No dispatch button']));
  assert('devices_not_live_readback_present', includesAll(read('apps/web/src/features/admin/pages/AdminDevicesPage.tsx'), ['Device inventory is not live monitoring', 'Live device: not connected', 'Production gateway: not online']));
  assert('evidence_governance_not_writer_present', includesAll(read('apps/web/src/features/admin/pages/AdminEvidencePage.tsx'), ['Evidence governance is not facts writing', 'Not facts writer', 'Source identity visible']));
  assert('skills_config_debt_present', includesAll(read('apps/web/src/features/admin/pages/AdminSkillsPage.tsx'), ['/admin/config not promoted', 'Route naming debt', 'Skills readback is not execution']));
  assert('healthz_health_debt_present', includesAll(read('apps/web/src/features/admin/pages/AdminHealthzPage.tsx'), ['/admin/health not promoted', 'Healthz is readback', 'not production readiness proof']));

  const urlOnlyRoutes = ['/admin/alerts', '/admin/acceptance', '/admin/import', '/admin/operations/:operationId/debug'];
  assert('url_only_routes_not_promoted_to_admin_nav', urlOnlyRoutes.every((route) => !layout.includes(route)), { urlOnlyRoutes });
  const futureRoutes = ['/admin/tenants', '/admin/imports', '/admin/audit'];
  assert('future_admin_pages_remain_deferred', futureRoutes.every((route) => !source.includes(route)) && source.includes('/admin/config not promoted') && source.includes('/admin/health not promoted'), { futureRoutes });

  const blockedClients = [join(['dispatch', 'Client']), join(['create', 'Ao', 'Act']), join(['write', 'Facts']), join(['write', 'Roi']), join(['write', 'Field', 'Memory']), join(['device', 'ControlClient'])];
  const blockedClaims = [join(['Dispatch ', 'Ready']), join(['AO-ACT ', 'Ready']), join(['Production Gateway ', 'Online']), join(['Live Device ', 'Connected']), join(['Field Pilot ', 'Started']), join(['Autonomous ', 'Operation']), join(['Write ', 'Facts']), join(['Write ', 'ROI']), join(['Write ', 'Field Memory']), join(['Create ', 'AO-ACT'])];
  assertNoText(source, blockedClients, 'admin_source_has_no_forbidden_mutation_clients');
  assertNoText(source, blockedClaims, 'admin_source_has_no_forbidden_live_or_production_claims');

  console.log(JSON.stringify({ ok: true, acceptance: 'ACCEPTANCE_PFE_5_ADMIN_CONSOLE_PRODUCTIZATION', scope: 'Admin Console productization only', surfaces: { admin: 7 }, landmark: { adminLayoutMain: 'div', pageMain: 'ProductPageShell' }, changed_files_checked: diff.length ? diff : Array.from(allowedChangedFiles), assertions }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, acceptance: 'ACCEPTANCE_PFE_5_ADMIN_CONSOLE_PRODUCTIZATION', error: error.message, details: error.details || null, assertions }, null, 2));
  process.exit(1);
}
