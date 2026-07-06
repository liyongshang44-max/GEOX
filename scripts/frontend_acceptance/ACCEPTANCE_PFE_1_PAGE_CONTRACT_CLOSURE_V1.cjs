// scripts/frontend_acceptance/ACCEPTANCE_PFE_1_PAGE_CONTRACT_CLOSURE_V1.cjs
'use strict';

// Purpose: statically verify PFE-1 Page Contract Closure artifacts.
// Boundary: this script reads repository files only; it does not start apps, call APIs, connect DBs, or write files.
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();

const pfeFiles = {
  overview: 'docs/frontend-productization/PFE-1-PAGE-CONTRACT-CLOSURE.md',
  register: 'docs/frontend-productization/PFE-1-PAGE-CONTRACT-REGISTER.md',
  template: 'docs/frontend-productization/PFE-1-PAGE-CONTRACT-TEMPLATE.md',
  traceability: 'docs/frontend-productization/PFE-1-PAGE-CONTRACT-TRACEABILITY.md',
  acceptance: 'scripts/frontend_acceptance/ACCEPTANCE_PFE_1_PAGE_CONTRACT_CLOSURE_V1.cjs',
};

const baselineFiles = {
  pfe0Definition: 'docs/frontend-productization/PFE-0-PRODUCT-FRONTEND-DEFINITION.md',
  pfe0Matrix: 'docs/frontend-productization/PFE-0-PAGE-AUDIT-MATRIX.md',
};

const allowedChangedFiles = new Set(Object.values(pfeFiles));
const blockedPrefixes = ['apps/web/src/', 'apps/server/', 'migrations/', 'packages/contracts/', 'fixtures/', '.github/'];
const blockedExactFiles = new Set(['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml']);

const customerContracts = [
  '/customer/dashboard',
  '/customer/fields',
  '/customer/fields/:fieldId',
  '/customer/fields/:fieldId/export',
  '/customer/operations',
  '/customer/operations/:operationId',
  '/customer/operations/:operationId/export',
  '/customer/reports',
  '/customer/export',
];

const operatorContracts = [
  '/operator/twin',
  '/operator/fields',
  '/operator/fields/:fieldId',
  '/operator/fields/:fieldId/state',
  '/operator/fields/:fieldId/evidence',
  '/operator/fields/:fieldId/forecast',
  '/operator/fields/:fieldId/scenario',
  '/operator/fields/:fieldId/residual',
  '/operator/fields/:fieldId/calibration',
  '/operator/fields/:fieldId/health',
  '/operator/fields/:fieldId/audit',
  '/operator/twin/gateway-demo',
  '/operator/pilot',
];

const adminContracts = [
  '/admin/dashboard',
  '/admin/fields',
  '/admin/operations',
  '/admin/devices',
  '/admin/evidence',
  '/admin/skills',
  '/admin/healthz',
];

const urlOnlyCompatibility = [
  '/admin/alerts',
  '/admin/acceptance',
  '/admin/import',
  '/admin/operations/:operationId/debug',
  '/legacy/*',
  '/judge/*',
  '/sim/*',
  '/settings',
  '/dev',
];

const futureProductContractPages = [
  '/operator/evidence',
  '/operator/health',
  '/operator/settings',
  '/customer/evidence-summary',
  '/admin/tenants',
  '/admin/imports',
  '/admin/audit',
  '/admin/config',
  '/admin/health',
];

const doNotBuildPages = [
  'Customer Dispatch',
  'Customer AO-ACT',
  'Customer ROI Ledger',
  'Customer Field Memory',
  'Operator Dispatch Console',
  'Operator AO-ACT Control',
  'Operator Live Device Monitor',
  'Operator Production Gateway Online',
  'Operator Field Pilot Execution',
  'Admin Debug Formal Page',
  'Admin Acceptance Formal Nav Page',
  'Legacy Dev Tools Formal Page',
];

const allContracts = [...customerContracts, ...operatorContracts, ...adminContracts];

const requiredContractFields = [
  'route',
  'classification',
  'surface owner',
  'primary user',
  'page purpose',
  'current status',
  'data source / source owner',
  'allowed user actions',
  'forbidden user actions',
  'must show',
  'must not show',
  'primary states',
  'boundary / nonclaims',
  'locale contract',
  'accessibility contract',
  'responsive contract',
  'empty / loading / error contract',
  'visual / screenshot contract',
  'acceptance owner',
  'implementation phase',
  'PFE-1 decision',
];

const assertions = [];

function repoPath(file) {
  return path.join(root, file);
}

function exists(file) {
  return fs.existsSync(repoPath(file));
}

function read(file) {
  return fs.readFileSync(repoPath(file), 'utf8');
}

function lower(value) {
  return String(value).toLowerCase();
}

function includesAll(text, tokens) {
  const haystack = lower(text);
  return tokens.every((token) => haystack.includes(lower(token)));
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function assert(name, passed, details = {}) {
  assertions.push({ name, passed: passed === true, details });
  if (passed !== true) {
    const error = new Error('ASSERTION_FAILED:' + name);
    error.details = details;
    throw error;
  }
  console.log('[pfe-1-page-contract-closure] ok:', name);
}

function tryGit(args) {
  try {
    return cp.execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch (_error) {
    return '';
  }
}

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

function isBlocked(file) {
  return blockedExactFiles.has(file) || blockedPrefixes.some((prefix) => file.startsWith(prefix));
}

function tableRow(register, routeOrSurface) {
  const pattern = new RegExp('^\\|\\s*' + escapeRegExp(routeOrSurface) + '\\s*\\|', 'm');
  return register.split(/\r?\n/).find((line) => pattern.test(line)) || '';
}

function assertContractRow(register, route, classification) {
  const row = tableRow(register, route);
  assert('contract_row_exists:' + route, row.length > 0, { route });
  assert('contract_classification:' + route, includesAll(row, [classification]), { route, classification, row });
  assert('contract_decision_closed:' + route, includesAll(row, ['contract closed']), { route, row });
  assert('contract_forbidden_actions:' + route, includesAll(row, ['dispatch', 'AO-ACT', 'facts write', 'recommendation creation', 'ROI write', 'Field Memory write', 'model update']), { route, row });
  assert('contract_has_owner_phase:' + route, includesAll(row, ['PFE-']), { route, row });
}

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
  Object.values({ ...pfeFiles, ...baselineFiles }).forEach((file) => assert('exists:' + file, exists(file), { file }));

  const overview = read(pfeFiles.overview);
  const register = read(pfeFiles.register);
  const template = read(pfeFiles.template);
  const traceability = read(pfeFiles.traceability);
  const acceptanceText = read(pfeFiles.acceptance);
  const pfe0Matrix = read(baselineFiles.pfe0Matrix);

  const diff = changedFiles();
  assert('changed_files_allowlist', diff.length === 0 || diff.every((file) => allowedChangedFiles.has(file)), { diff, allowed: Array.from(allowedChangedFiles) });
  assert('blocked_files_unchanged', diff.every((file) => !isBlocked(file)), { diff });
  assert('no_apps_web_src_changes', diff.every((file) => !file.startsWith('apps/web/src/')), { diff });
  assert('no_apps_server_changes', diff.every((file) => !file.startsWith('apps/server/')), { diff });
  assert('no_migrations_changes', diff.every((file) => !file.startsWith('migrations/')), { diff });
  assert('no_packages_contracts_changes', diff.every((file) => !file.startsWith('packages/contracts/')), { diff });
  assert('no_fixtures_changes', diff.every((file) => !file.startsWith('fixtures/')), { diff });
  assert('no_package_changes', diff.every((file) => !blockedExactFiles.has(file)), { diff });

  assert('overview_references_pfe0_source_baseline', includesAll(overview, ['PFE-1 follows PFE-0', 'docs/frontend-productization/PFE-0-PAGE-AUDIT-MATRIX.md', 'PFE-1 does not redefine route inventory from memory']));
  assert('overview_records_contract_counts', includesAll(overview, ['Customer Portal: 9', 'Operator Runtime Console: 13', 'Admin Console: 7', 'Total: 29']));
  assert('overview_records_non_goals', includesAll(overview, ['does not redesign pages', 'does not modify frontend source', 'does not change route topology', 'does not change CSS', 'does not implement accessibility', 'does not implement responsive behavior', 'does not implement visual regression']));
  assert('template_includes_required_fields', includesAll(template, requiredContractFields));
  assert('template_includes_non_contract_handling', includesAll(template, ['URL-only compatibility', 'No formal contract', 'Future product-contract page', 'Contract deferred', 'Do-not-build page', 'Explicitly prohibited', 'Not backlog']));
  assert('register_includes_required_fields', includesAll(register, requiredContractFields));
  assert('register_records_shared_quality_contracts', includesAll(register, ['zh-CN product copy required', 'en-US product copy required', 'keyboard reachable controls', 'focus visible', 'no color-only status', 'desktop / laptop / tablet / mobile narrow', 'no raw stack trace', 'screenshot baseline required later']));
  assert('pfe0_matrix_available_as_source_baseline', includesAll(pfe0Matrix, ['/customer/dashboard', '/operator/twin', '/admin/dashboard', 'future product-contract page', 'do-not-build page']));

  customerContracts.forEach((route) => assertContractRow(register, route, route.includes('/export') ? 'export / print secondary surface' : (route.includes(':') ? 'formal sub-surface' : 'formal v1 page')));
  operatorContracts.forEach((route) => assertContractRow(register, route, route.startsWith('/operator/fields/:fieldId') ? 'formal sub-surface' : 'formal v1 page'));
  adminContracts.forEach((route) => assertContractRow(register, route, 'formal v1 page'));

  assert('all_customer_surfaces_have_contracts', customerContracts.every((route) => tableRow(register, route)), { count: customerContracts.length });
  assert('all_operator_surfaces_have_contracts', operatorContracts.every((route) => tableRow(register, route)), { count: operatorContracts.length });
  assert('all_admin_formal_surfaces_have_contracts', adminContracts.every((route) => tableRow(register, route)), { count: adminContracts.length });

  ['/customer/fields/:fieldId/export', '/customer/operations/:operationId/export', '/customer/export'].forEach((route) => {
    const row = tableRow(register, route);
    assert('export_print_specific_contract:' + route, includesAll(row, ['export / print secondary surface', 'print-safe', 'share-safe', 'delivery surface']), { route, row });
  });

  ['/operator/fields/:fieldId/state', '/operator/fields/:fieldId/evidence', '/operator/fields/:fieldId/forecast', '/operator/fields/:fieldId/scenario', '/operator/fields/:fieldId/residual', '/operator/fields/:fieldId/calibration', '/operator/fields/:fieldId/health', '/operator/fields/:fieldId/audit'].forEach((route) => assert('field_runtime_tab_has_separate_contract:' + route, tableRow(register, route).length > 0, { route }));
  assert('forecast_not_recommendation_boundary', includesAll(tableRow(register, '/operator/fields/:fieldId/forecast'), ['forecast ≠ recommendation', 'Forecast tab must state forecast is not recommendation']));
  assert('scenario_not_dispatch_boundary', includesAll(tableRow(register, '/operator/fields/:fieldId/scenario'), ['scenario review ≠ task / dispatch', 'Scenario review is not task creation or dispatch']));
  assert('residual_not_roi_boundary', includesAll(tableRow(register, '/operator/fields/:fieldId/residual'), ['without ROI', 'Verification does not equal ROI']));
  assert('calibration_not_model_update_boundary', includesAll(tableRow(register, '/operator/fields/:fieldId/calibration'), ['without model update', 'Calibration review is not model update']));
  assert('health_not_live_monitoring_boundary', includesAll(tableRow(register, '/operator/fields/:fieldId/health'), ['without live monitoring', 'Health review is not live monitoring']));
  assert('audit_not_business_conclusion_boundary', includesAll(tableRow(register, '/operator/fields/:fieldId/audit'), ['without business conclusion', 'Audit readback is not a business conclusion']));
  assert('gateway_demo_not_live_gateway_boundary', includesAll(tableRow(register, '/operator/twin/gateway-demo'), ['replay-backed', 'Gateway Demo is replay-backed demo, not live gateway']));
  assert('pilot_readiness_not_execution_boundary', includesAll(tableRow(register, '/operator/pilot'), ['readiness', 'Pilot readiness review is not pilot execution']));

  assert('admin_skills_records_route_naming_debt', includesAll(tableRow(register, '/admin/skills'), ['route naming debt', '/admin/config', 'not promoted by PFE-1']));
  assert('admin_healthz_records_route_naming_debt', includesAll(tableRow(register, '/admin/healthz'), ['route naming debt', '/admin/health', 'not promoted by PFE-1']));

  assert('url_only_compatibility_surfaces_preserved', includesAll(register, ['URL-only compatibility surfaces', 'no formal contract', 'no formal nav', 'no page polish obligation', 'no accessibility completion obligation under PFE-1', ...urlOnlyCompatibility]));
  assert('future_product_contract_pages_deferred', includesAll(register, ['Future product-contract pages', 'contract deferred', 'do not implement', 'do not design full UI', ...futureProductContractPages]));
  assert('do_not_build_pages_prohibited_not_backlog', includesAll(register, ['Do-not-build pages', 'explicitly prohibited', 'not backlog', 'not PFE owner phase', ...doNotBuildPages]));

  assert('traceability_references_pfe0', includesAll(traceability, ['PFE-0 page audit matrix', 'PFE-1 references PFE-0 as source baseline']));
  assert('traceability_maps_all_contracts', allContracts.every((route) => traceability.includes(route)), { missing: allContracts.filter((route) => !traceability.includes(route)) });
  assert('traceability_maps_non_contracts', [...urlOnlyCompatibility, ...futureProductContractPages, ...doNotBuildPages].every((surface) => traceability.includes(surface)), {
    missing: [...urlOnlyCompatibility, ...futureProductContractPages, ...doNotBuildPages].filter((surface) => !traceability.includes(surface)),
  });
  assertStaticReadOnlyAcceptance(acceptanceText);

  console.log(JSON.stringify({
    ok: true,
    acceptance: 'ACCEPTANCE_PFE_1_PAGE_CONTRACT_CLOSURE_V1',
    scope: 'static PFE-1 page contract closure only',
    contracts: {
      customer: customerContracts.length,
      operator: operatorContracts.length,
      admin: adminContracts.length,
      total: allContracts.length,
    },
    non_contract_surfaces: {
      url_only_compatibility: urlOnlyCompatibility.length,
      future_product_contract: futureProductContractPages.length,
      do_not_build: doNotBuildPages.length,
    },
    changed_files_checked: diff.length > 0 ? diff : Object.values(pfeFiles),
    assertions,
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    acceptance: 'ACCEPTANCE_PFE_1_PAGE_CONTRACT_CLOSURE_V1',
    error: error.message,
    details: error.details || null,
    assertions,
  }, null, 2));
  process.exit(1);
}
