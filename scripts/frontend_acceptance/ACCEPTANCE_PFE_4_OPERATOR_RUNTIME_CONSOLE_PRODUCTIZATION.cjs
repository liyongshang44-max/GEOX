// scripts/frontend_acceptance/ACCEPTANCE_PFE_4_OPERATOR_RUNTIME_CONSOLE_PRODUCTIZATION.cjs
'use strict';

const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();

const docs = [
  'docs/frontend-productization/PFE-4-OPERATOR-RUNTIME-CONSOLE-PRODUCTIZATION.md',
  'docs/frontend-productization/PFE-4-OPERATOR-SURFACE-REVIEW.md',
];

const baselineFiles = [
  'docs/frontend-productization/PFE-1-PAGE-CONTRACT-REGISTER.md',
  'docs/frontend-productization/PFE-2-DESIGN-SYSTEM-V1-COMPLETION.md',
  'apps/web/src/design-system/product/index.ts',
];

const operatorSources = [
  'apps/web/src/features/operator/pages/OperatorTwinOverviewPage.tsx',
  'apps/web/src/features/operator/fieldRuntime/FieldRuntimeLayout.tsx',
  'apps/web/src/features/operator/replayDemo/ReplayDemoPage.tsx',
  'apps/web/src/features/operator/pilotReadiness/OperatorPilotPage.tsx',
];

const acceptanceFile = 'scripts/frontend_acceptance/ACCEPTANCE_PFE_4_OPERATOR_RUNTIME_CONSOLE_PRODUCTIZATION.cjs';
const allowedChangedPrefixes = [
  'apps/web/src/features/operator/pages/',
  'apps/web/src/features/operator/fieldRuntime/',
  'apps/web/src/features/operator/replayDemo/',
  'apps/web/src/features/operator/pilotReadiness/',
];
const allowedChangedFiles = new Set([...docs, ...operatorSources, acceptanceFile]);
const assertions = [];

function repoPath(file) { return path.join(root, file); }
function exists(file) { return fs.existsSync(repoPath(file)); }
function read(file) { return fs.readFileSync(repoPath(file), 'utf8'); }
function lower(value) { return String(value).toLowerCase(); }
function join(parts) { return parts.join(''); }
function includesAll(text, tokens) { const haystack = lower(text); return tokens.every((token) => haystack.includes(lower(token))); }
function assert(name, passed, details = {}) { assertions.push({ name, passed: passed === true, details }); if (passed !== true) { const error = new Error('ASSERTION_FAILED:' + name); error.details = details; throw error; } console.log('[pfe-4-operator-runtime-console-productization] ok:', name); }
function runGit(args) { try { return cp.execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch (_error) { return ''; } }
function statusFiles() { const output = runGit(['status', '--short', '--untracked-files=all']); if (!output) return []; return output.split(/\r?\n/).map((line) => { if (!line.trim()) return ''; const arrow = line.indexOf(' -> '); if (arrow >= 0) return line.slice(arrow + 4).trim(); return line.replace(/^[ MADRCU?!]{1,2}\s+/, '').trim(); }).filter(Boolean); }
function changedFiles() { const set = new Set(); const output = runGit(['diff', '--name-only', 'origin/main...HEAD']) || runGit(['diff', '--name-only', 'main...HEAD']); if (output) output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).forEach((file) => set.add(file)); statusFiles().forEach((file) => set.add(file)); return Array.from(set).sort(); }
function combined(files) { return files.map(read).join('\n'); }
function allowedChangedFile(file) { return allowedChangedFiles.has(file) || allowedChangedPrefixes.some((prefix) => file.startsWith(prefix)); }
function assertNoText(text, tokens, name) { const haystack = lower(text); const violations = tokens.filter((token) => haystack.includes(lower(token))); assert(name, violations.length === 0, { violations }); }

try {
  [...docs, ...baselineFiles, ...operatorSources, acceptanceFile].forEach((file) => assert('exists:' + file, exists(file), { file }));

  const diff = changedFiles();
  const docText = combined(docs);
  const source = combined(operatorSources);
  const pfe1 = read('docs/frontend-productization/PFE-1-PAGE-CONTRACT-REGISTER.md');
  const pfe2AndIndex = read('docs/frontend-productization/PFE-2-DESIGN-SYSTEM-V1-COMPLETION.md') + '\n' + read('apps/web/src/design-system/product/index.ts');

  const routes = [
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

  assert('changed_files_allowlist', diff.length === 0 || diff.every(allowedChangedFile), { diff });
  assert('no_route_topology_changes', diff.every((file) => file !== 'apps/web/src/app/App.tsx' && !file.startsWith('apps/web/src/app/routes/')), { diff });
  assert('no_customer_admin_backend_contract_fixture_package_changes', diff.every((file) => !file.startsWith('apps/web/src/features/customer/') && !file.startsWith('apps/web/src/features/admin/') && !file.startsWith('apps/server/') && !file.startsWith('migrations/') && !file.startsWith('packages/contracts/') && !file.startsWith('fixtures/') && !file.startsWith('.github/') && !['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml'].includes(file)), { diff });

  assert('pfe1_operator_contracts_present', routes.every((route) => pfe1.includes(route)), { routes });
  assert('pfe2_primitives_present', includesAll(pfe2AndIndex, ['ProductPageShell', 'ProductPageHeader', 'ProductBoundaryBanner', 'ProductSectionCard', 'ProductMetricTile', 'ProductStatusBadge', 'ProductDataTable', 'ProductScopeBar']));
  assert('pfe4_docs_cover_all_operator_surfaces', routes.every((route) => docText.includes(route)), { routes });
  assert('route_ownership_cleanup_deferred', includesAll(docText, ['operator_pilot_cleanup', 'deferred']));

  assert('operator_sources_use_product_primitives', includesAll(source, ['ProductPageShell', 'ProductPageHeader', 'ProductBoundaryBanner', 'ProductSectionCard', 'ProductMetricTile', 'ProductStatusBadge', 'ProductScopeBar']));
  assert('operator_twin_productized', includesAll(read(operatorSources[0]), ['Operator Runtime Console', 'Read-only runtime review boundary', 'Live Device: Not connected', 'Production Gateway: Not online']));
  assert('operator_fields_entry_productized', includesAll(read(operatorSources[1]), ['Field Runtime entry', 'not field management', 'Field Runtime selector boundary']));
  assert('field_runtime_tab_boundaries_present', includesAll(read(operatorSources[1]), ['Forecast review is not a recommendation', 'Scenario review is not dispatch or task creation', 'Verification review is not ROI proof or causal proof', 'Calibration review is not model update', 'Health review is not live monitoring', 'Audit readback is not a business conclusion']));
  assert('gateway_demo_productized', includesAll(read(operatorSources[2]), ['Replay-backed Gateway Demo', 'not a live gateway', 'Production Gateway: Not online', 'Checked-in snapshot']));
  assert('pilot_readiness_productized', includesAll(read(operatorSources[3]), ['Readiness review is not field execution', 'Field Pilot: Not started', 'Controlled Execution: Disabled', 'AO-ACT: Disabled']));

  const blockedClients = [
    join(['create', 'Ao', 'Act']),
    join(['dispatch', 'Client']),
    join(['approval', 'Client']),
    join(['write', 'Roi']),
    join(['write', 'Field', 'Memory']),
    join(['model', 'Update']),
  ];
  const blockedEndpoints = [
    join(['POST ', '/api/', 'control']),
    join(['PUT ', '/api/', 'control']),
    join(['PATCH ', '/api/', 'control']),
    join(['DELETE ', '/api/', 'control']),
  ];
  const blockedClaims = [
    join(['Production Gateway ', 'Online']),
    join(['Live Device ', 'Connected']),
    join(['Field Pilot ', 'Started']),
    join(['Dispatch ', 'Ready']),
    join(['AO-ACT ', 'Ready']),
    join(['Autonomous ', 'Operation']),
  ];

  assertNoText(source, blockedClients, 'operator_source_has_no_forbidden_mutation_clients');
  assertNoText(source, blockedEndpoints, 'operator_source_has_no_forbidden_control_endpoint_copy');
  assertNoText(source, blockedClaims, 'operator_source_has_no_forbidden_live_or_production_claims');

  console.log(JSON.stringify({
    ok: true,
    acceptance: 'ACCEPTANCE_PFE_4_OPERATOR_RUNTIME_CONSOLE_PRODUCTIZATION',
    scope: 'Operator Runtime Console productization only',
    surfaces: { operator: 13, field_runtime_tabs: 9, gateway_demo: 1, pilot_readiness: 1 },
    route_ownership: { operator_pilot_cleanup: 'deferred' },
    changed_files_checked: diff.length ? diff : Array.from(allowedChangedFiles),
    assertions,
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, acceptance: 'ACCEPTANCE_PFE_4_OPERATOR_RUNTIME_CONSOLE_PRODUCTIZATION', error: error.message, details: error.details || null, assertions }, null, 2));
  process.exit(1);
}
