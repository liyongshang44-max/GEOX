#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const files = {
  reportsRoute: path.join(root, 'apps/server/src/routes/reports_v1.ts'),
  hook: path.join(root, 'apps/server/src/routes/operation_report_chain_hook_v1.ts'),
  projector: path.join(root, 'apps/server/src/projections/guarded_operation_report_projector_v1.ts'),
  guardedReport: path.join(root, 'apps/server/src/projections/guarded_report_v1.ts'),
};

function read(file) { return fs.readFileSync(file, 'utf8'); }
function fail(message) { console.error(`[report-guard-route-coverage] FAIL: ${message}`); process.exit(1); }
function assert(condition, message) { if (!condition) fail(message); }
function assertIncludes(source, needle, label) { assert(source.includes(needle), `${label} must include ${needle}`); }
function assertNotIncludes(source, needle, label) { assert(!source.includes(needle), `${label} must not include ${needle}`); }

const reportsRoute = read(files.reportsRoute);
const hook = read(files.hook);
const projector = read(files.projector);
const guardedReport = read(files.guardedReport);

// Operation report route must actively use guarded projector, not rely only on onSend hook.
assertIncludes(reportsRoute, 'buildGuardedOperationReportV1', 'reports_v1 operation report route');
assertIncludes(reportsRoute, 'const guardedOperationReport = await buildGuardedOperationReportV1({ pool, report: enrichedReport })', 'reports_v1 operation report main outlet');
assertIncludes(reportsRoute, 'operation_report_v1: guardedOperationReport', 'reports_v1 operation report response payload');
assertNotIncludes(reportsRoute, 'operation_report_v1: enrichedReport }', 'reports_v1 unguarded operation report response');

// Projector owns the canonical operation report guard sequence.
assertIncludes(projector, 'export async function buildGuardedOperationReportV1', 'guarded operation report projector');
assertIncludes(projector, 'enrichOperationReportChainV1({ pool: params.pool, report })', 'guarded operation report projector chain enrich');
assertIncludes(projector, 'enrichOperationReportValueChainRoiV1(compatible)', 'guarded operation report projector value chain ROI enrich');
assertIncludes(projector, 'applyGuardedOperationReportV1(withValueChainRoi)', 'guarded operation report projector final guard');
assertIncludes(projector, 'ensureGuardedOperationReportContractV1', 'guarded operation report projector contract check');

// onSend hook remains defense-in-depth and reuses projector rather than duplicating the guard chain.
assertIncludes(hook, 'buildGuardedOperationReportV1', 'operation report hook projector reuse');
assertIncludes(hook, 'return { ...parsed, operation_report_v1: guarded }', 'operation report hook guarded response');
assertNotIncludes(hook, 'enrichOperationReportValueChainRoiV1', 'operation report hook duplicate value chain logic');
assertNotIncludes(hook, 'applyGuardedOperationReportV1', 'operation report hook duplicate guard logic');

// Hook allowlist must cover current official customer report surfaces.
const requiredHookPredicates = [
  'isOperationReportPath',
  'isDashboardAggregatePath',
  'isFieldPortfolioPath',
  'isFieldReportPath',
  'isCustomerOperationsPath',
  'isCustomerReportsPath',
  'isCustomerFieldsPath',
];
for (const predicate of requiredHookPredicates) assertIncludes(hook, predicate, 'operation report hook allowlist');

// Guard implementations for customer-facing report surfaces must remain present.
for (const fn of [
  'applyGuardedOperationReportV1',
  'applyGuardedDashboardAggregateV1',
  'applyGuardedFieldReportV1',
  'applyGuardedCustomerOperationsResponseV1',
  'applyGuardedCustomerReportsResponseV1',
  'applyGuardedCustomerFieldsResponseV1',
]) assertIncludes(guardedReport, fn, 'guarded report projection functions');

console.log('[report-guard-route-coverage] PASS');
