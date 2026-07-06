// scripts/frontend_acceptance/ACCEPTANCE_PFE_3_CUSTOMER_PORTAL_PRODUCTIZATION.cjs
'use strict';

const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();

const docs = [
  'docs/frontend-productization/PFE-3-CUSTOMER-PORTAL-PRODUCTIZATION.md',
  'docs/frontend-productization/PFE-3-CUSTOMER-PORTAL-SURFACE-REVIEW.md',
];

const customerSources = [
  'apps/web/src/features/customer/pages/CustomerDashboardPage.tsx',
  'apps/web/src/features/customer/pages/CustomerDashboardExportPage.tsx',
  'apps/web/src/views/CustomerFieldsIndexPage.tsx',
  'apps/web/src/features/fields/pages/FieldReportPage.tsx',
  'apps/web/src/features/fields/pages/FieldReportExportPage.tsx',
  'apps/web/src/features/customer/pages/CustomerOperationsIndexPage.tsx',
  'apps/web/src/features/operations/pages/OperationReportPage.tsx',
  'apps/web/src/features/customer/pages/CustomerReportExportPage.tsx',
  'apps/web/src/features/customer/pages/CustomerReportsCenterPage.tsx',
];

const supportFiles = [
  'apps/web/src/styles.css',
  'apps/web/src/design-system/product/index.ts',
  'docs/frontend-productization/PFE-1-PAGE-CONTRACT-REGISTER.md',
  'docs/frontend-productization/PFE-2-DESIGN-SYSTEM-V1-COMPLETION.md',
];

const acceptanceFile = 'scripts/frontend_acceptance/ACCEPTANCE_PFE_3_CUSTOMER_PORTAL_PRODUCTIZATION.cjs';
const allowedChangedFiles = new Set([...docs, ...customerSources, 'apps/web/src/styles.css', acceptanceFile]);
const assertions = [];

function repoPath(file) { return path.join(root, file); }
function exists(file) { return fs.existsSync(repoPath(file)); }
function read(file) { return fs.readFileSync(repoPath(file), 'utf8'); }
function lower(value) { return String(value).toLowerCase(); }
function join(parts) { return parts.join(''); }
function includesAll(text, tokens) { const haystack = lower(text); return tokens.every((token) => haystack.includes(lower(token))); }
function assert(name, passed, details = {}) { assertions.push({ name, passed: passed === true, details }); if (passed !== true) { const error = new Error('ASSERTION_FAILED:' + name); error.details = details; throw error; } console.log('[pfe-3-customer-portal-productization] ok:', name); }
function runGit(args) { try { return cp.execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch (_error) { return ''; } }
function statusFiles() { const output = runGit(['status', '--short', '--untracked-files=all']); if (!output) return []; return output.split(/\r?\n/).map((line) => { if (!line.trim()) return ''; const arrow = line.indexOf(' -> '); if (arrow >= 0) return line.slice(arrow + 4).trim(); return line.replace(/^[ MADRCU?!]{1,2}\s+/, '').trim(); }).filter(Boolean); }
function changedFiles() { const set = new Set(); const output = runGit(['diff', '--name-only', 'origin/main...HEAD']) || runGit(['diff', '--name-only', 'main...HEAD']); if (output) output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).forEach((file) => set.add(file)); statusFiles().forEach((file) => set.add(file)); return Array.from(set).sort(); }
function combinedCustomerSource() { return customerSources.map(read).join('\n'); }
function assertNoText(text, tokens, name) { const haystack = lower(text); const violations = tokens.filter((token) => haystack.includes(lower(token))); assert(name, violations.length === 0, { violations }); }

try {
  [...docs, ...customerSources, ...supportFiles, acceptanceFile].forEach((file) => assert('exists:' + file, exists(file), { file }));

  const diff = changedFiles();
  const source = combinedCustomerSource();
  const designSystemIndex = read('apps/web/src/design-system/product/index.ts');
  const pfe1 = read('docs/frontend-productization/PFE-1-PAGE-CONTRACT-REGISTER.md');
  const pfe2 = read('docs/frontend-productization/PFE-2-DESIGN-SYSTEM-V1-COMPLETION.md');

  assert('changed_files_allowlist', diff.length === 0 || diff.every((file) => allowedChangedFiles.has(file)), { diff, allowed: Array.from(allowedChangedFiles) });
  assert('no_route_topology_changes', diff.every((file) => file !== 'apps/web/src/app/App.tsx' && !file.startsWith('apps/web/src/app/routes/')), { diff });
  assert('no_operator_admin_backend_contract_fixture_package_changes', diff.every((file) => !file.startsWith('apps/web/src/features/operator/') && !file.startsWith('apps/web/src/features/admin/') && !file.startsWith('apps/server/') && !file.startsWith('migrations/') && !file.startsWith('packages/contracts/') && !file.startsWith('fixtures/') && !file.startsWith('.github/') && !['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml'].includes(file)), { diff });

  assert('pfe1_customer_contracts_present', includesAll(pfe1, ['/customer/dashboard', '/customer/fields', '/customer/operations', '/customer/reports', '/customer/export']));
  assert('pfe2_primitives_present', includesAll(pfe2 + designSystemIndex, ['ProductPageShell', 'ProductPageHeader', 'ProductSectionCard', 'ProductStatusBadge', 'ProductDataTable', 'ProductEmptyState', 'ProductLoadingState', 'ProductErrorState']));
  assert('product_css_imported', read('apps/web/src/styles.css').includes('./styles/productDesignSystem.css'));

  assert('dashboard_productized', includesAll(read(customerSources[0]), ['Reporting-only customer surface', 'Field reports', 'Operation reports', 'ProductMetricTile']));
  assert('dashboard_export_productized', includesAll(read(customerSources[1]), ['PrintReportScaffold', 'Print-safe customer delivery surface', 'ProductLoadingState', 'ProductErrorState']));
  assert('fields_index_productized', includesAll(read(customerSources[2]), ['ProductDataTable', 'Authorized field reports', 'Field report entries']));
  assert('field_report_productized', includesAll(read(customerSources[3]), ['ProductPageShell', 'Customer-safe field report', 'Evidence summary', 'Recent operation reports']));
  assert('field_export_productized', includesAll(read(customerSources[4]), ['PrintReportScaffold', 'Print-safe customer delivery surface', 'ProductLoadingState', 'ProductErrorState']));
  assert('operations_index_productized', includesAll(read(customerSources[5]), ['ProductDataTable', 'Operation reporting only', 'Operation report entries']));
  assert('operation_report_productized', includesAll(read(customerSources[6]), ['ProductPageShell', 'Customer-safe operation report', 'Report sections', 'Timeline summary']));
  assert('customer_export_productized', includesAll(read(customerSources[7]), ['PrintReportScaffold', 'Print-safe customer delivery surface', 'OperationExportBlocks']));
  assert('reports_center_productized', includesAll(read(customerSources[8]), ['Customer-safe report center', 'Reports center', 'ProductSectionCard']));

  const blockedFormalTerms = [
    join(['AO', '-', 'ACT']),
    join(['ROI', ' Ledger']),
    join(['Field', ' Memory']),
    join(['Acceptance', ' Console']),
    join(['Admin', ' Debug']),
    join(['Debug']),
    join(['facts', ' write']),
    join(['recommendation', ' creation']),
  ];
  const blockedActions = [
    join(['create', 'Ao', 'Act']),
    join(['write', 'Roi']),
    join(['write', 'Field', 'Memory']),
    join(['submit', 'Operator', 'Scenario', 'Recommendation']),
    join(['dispatch', 'Client']),
    join(['approval', 'Client']),
    join(['roi', 'Writer']),
    join(['field', 'Memory', 'Writer']),
    join(['model', 'Update']),
    join(['fetch', 'Admin']),
  ];
  const blockedEndpointCopy = [
    join(['POST ', '/']),
    join(['PUT ', '/']),
    join(['PATCH ', '/']),
    join(['DELETE ', '/']),
    join(['/api/', 'control']),
  ];

  assertNoText(source, blockedFormalTerms, 'customer_source_has_no_forbidden_customer_vocabulary');
  assertNoText(source, blockedActions, 'customer_source_has_no_forbidden_action_clients');
  assertNoText(source, blockedEndpointCopy, 'customer_source_has_no_mutation_endpoint_copy');
  assertNoText(source, ['features/operator', 'features/admin', '../operator/', '../admin/'], 'customer_source_has_no_operator_admin_imports');

  console.log(JSON.stringify({ ok: true, acceptance: 'ACCEPTANCE_PFE_3_CUSTOMER_PORTAL_PRODUCTIZATION', scope: 'Customer Portal productization only', changed_files_checked: diff.length ? diff : Array.from(allowedChangedFiles), assertions }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, acceptance: 'ACCEPTANCE_PFE_3_CUSTOMER_PORTAL_PRODUCTIZATION', error: error.message, details: error.details || null, assertions }, null, 2));
  process.exit(1);
}
