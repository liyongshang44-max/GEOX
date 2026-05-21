#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = process.cwd();
const files = {
  projection: path.join(root, 'apps/server/src/projections/report_dashboard_v1.ts'),
  reportsDashboardRoute: path.join(root, 'apps/server/src/routes/reports_dashboard_v1.ts'),
  customerRoute: path.join(root, 'apps/server/src/routes/customer_v1.ts'),
};

function read(file) {
  return fs.readFileSync(file, 'utf8');
}
function fail(message) {
  console.error(`[customer-dashboard-projection-trust] FAIL: ${message}`);
  process.exit(1);
}
function assert(condition, message) {
  if (!condition) fail(message);
}
function assertIncludes(source, needle, label) {
  assert(source.includes(needle), `${label} must include ${needle}`);
}
function assertNotIncludes(source, needle, label) {
  assert(!source.includes(needle), `${label} must not include ${needle}`);
}

const projection = read(files.projection);
const reportsDashboardRoute = read(files.reportsDashboardRoute);
const customerRoute = read(files.customerRoute);

// Dashboard aggregate must carry projection trust metadata.
assertIncludes(projection, 'DashboardProjectionSourceV1 = "GUARDED_REPORT" | "STATE_FALLBACK_LIMITED"', 'dashboard projection trust type');
assertIncludes(projection, 'projection_source: DashboardProjectionSourceV1', 'dashboard projection trust fields');
assertIncludes(projection, 'fallback_limited: boolean', 'dashboard projection trust fields');
assertIncludes(projection, 'customer_visible_eligible: boolean', 'dashboard projection trust fields');
assertIncludes(projection, 'blocking_reasons: string[]', 'dashboard projection trust fields');
assertIncludes(projection, 'dashboardTrustFromStateFallbackV1', 'state fallback trust helper');
assertIncludes(projection, 'state_fallback_limited_not_customer_official', 'state fallback blocking reason');

// FromStates fallback must never expose raw operation_state as formal customer status.
assertIncludes(projection, 'projectCustomerDashboardAggregateFromStatesV1', 'state fallback aggregate');
assertIncludes(projection, 'const trust = dashboardTrustFromStateFallbackV1()', 'state fallback aggregate');
assertIncludes(projection, 'function safeStateFinalStatus(): string { return "LIMITED_STATE"; }', 'state fallback final status');
assertIncludes(projection, 'function safeStateAcceptanceStatus', 'state fallback acceptance status');
assertIncludes(projection, '"NEEDS_REVIEW"', 'state fallback acceptance review');
assertIncludes(projection, 'pending_acceptance: 0', 'state fallback pending acceptance must not be raw-derived');
assertIncludes(projection, 'roi_summary: limitedRoiSummary(sortedStates.length)', 'state fallback ROI must be limited');

// Dashboard and Field Report ROI summaries must split trust categories and avoid customer-visible assumption value.
for (const field of ['trusted_value_items', 'hypothesis_items', 'estimated_items', 'insufficient_evidence_items', 'simulated_or_technical_items']) {
  assertIncludes(projection, field, 'ROI summary trust buckets');
}
assertIncludes(projection, 'isTrustedRoiItem', 'ROI trust classifier');
assertIncludes(projection, 'isSimulatedOrTechnicalRoiItem', 'ROI technical/simulated classifier');
assertIncludes(projection, 'has_customer_visible_value: hasValue', 'ROI customer visible value must be trusted-only');
assertIncludes(projection, '暂无可作为客户正式价值结论的记录', 'ROI customer text must avoid weak value claim');
assertNotIncludes(projection, '本地块已有 ${total} 条价值记录', 'Field Report must not treat all ROI items as value records');
assertNotIncludes(projection, '当前共有 ${summary.total_roi_items} 条价值记录', 'Dashboard must not treat all ROI items as value records');

// Guarded report path must use safe status projection and formal pending acceptance only.
assertIncludes(projection, 'safeReportFinalStatus', 'guarded report status projection');
assertIncludes(projection, 'safeReportAcceptanceStatus', 'guarded report acceptance projection');
assertIncludes(projection, 'trust.customer_visible_eligible && upper(report.execution.final_status) === "PENDING_ACCEPTANCE"', 'guarded pending acceptance source');
assertIncludes(projection, 'report_without_guarded_chain_validation', 'weak report blocking reason');

// Customer route must not expose raw operation_state final/acceptance status as official customer state.
assertIncludes(customerRoute, 'STATE_FALLBACK_TRUST', 'customer state fallback trust metadata');
assertIncludes(customerRoute, 'projection_source: "STATE_FALLBACK_LIMITED"', 'customer route state fallback projection source');
assertIncludes(customerRoute, 'fallback_limited: true', 'customer route fallback limited');
assertIncludes(customerRoute, 'customer_visible_eligible: false', 'customer route customer visibility false');
assertIncludes(customerRoute, 'limitedFinalStatusFromState', 'customer route limited final status helper');
assertIncludes(customerRoute, 'limitedAcceptanceStatusFromState', 'customer route limited acceptance status helper');
assertIncludes(customerRoute, 'formalPendingAcceptanceFromState', 'customer route formal pending helper');
assertIncludes(customerRoute, 'final_status: limitedFinalStatusFromState()', 'customer operations final status must be limited');
assertIncludes(customerRoute, 'acceptance_status: limitedAcceptanceStatusFromState()', 'customer operations acceptance status must be needs review');
assertIncludes(customerRoute, 'pending_acceptance_count: Number(agg?.pendingAcceptanceCount ?? 0)', 'customer fields pending count must use limited helper aggregation');
assertNotIncludes(customerRoute, 'final_status: String(state.final_status', 'customer operations must not expose raw state final_status');
assertNotIncludes(customerRoute, 'acceptance_status: String(state.acceptance?.status', 'customer operations must not expose raw state acceptance status');

// reports_dashboard route may still use FromStates fallback, but the projection must now return limited/safe payload.
assertIncludes(reportsDashboardRoute, 'projectCustomerDashboardAggregateFromStatesV1', 'reports dashboard route state fallback projection');
assertIncludes(reportsDashboardRoute, 'projectFieldPortfolioSummaryV1', 'reports dashboard route guarded report projection');

const fixture = String.raw`
const mod = await import('./apps/server/src/projections/report_dashboard_v1.ts');
const { projectCustomerDashboardAggregateFromStatesV1, projectCustomerDashboardAggregateV1 } = mod;
function assertRuntime(condition, message) {
  if (!condition) throw new Error(message);
}
const weakState = {
  operation_id: 'op_weak_success',
  operation_plan_id: 'op_weak_success',
  field_id: 'field_1',
  final_status: 'SUCCESS',
  acceptance: { status: 'PASS' },
  reason_codes: [],
  last_event_ts: 1700000000000,
};
const stateAgg = projectCustomerDashboardAggregateFromStatesV1({
  states: [weakState],
  field_ids: ['field_1'],
  field_name_by_id: new Map([['field_1', 'Field 1']]),
});
assertRuntime(stateAgg.projection_source === 'STATE_FALLBACK_LIMITED', 'FromStates fallback must have STATE_FALLBACK_LIMITED source');
assertRuntime(stateAgg.fallback_limited === true, 'FromStates fallback must be fallback_limited');
assertRuntime(stateAgg.customer_visible_eligible === false, 'FromStates fallback must not be customer visible');
assertRuntime(Array.isArray(stateAgg.blocking_reasons) && stateAgg.blocking_reasons.includes('state_fallback_limited_not_customer_official'), 'FromStates fallback must include blocking reason');
assertRuntime(stateAgg.recent_operations[0].final_status !== 'SUCCESS', 'weak operation_state SUCCESS must not appear as recent_operations SUCCESS');
assertRuntime(stateAgg.recent_operations[0].final_status === 'LIMITED_STATE', 'weak operation_state final_status must be LIMITED_STATE');
assertRuntime(stateAgg.recent_operations[0].acceptance_status !== 'PASS', 'weak operation_state acceptance PASS must not appear as PASS');
assertRuntime(stateAgg.roi_summary.has_customer_visible_value === false, 'FromStates ROI must not have customer visible value');
assertRuntime(stateAgg.pending_actions_summary.pending_acceptance === 0, 'FromStates pending_acceptance must not be raw-derived');

const weakReport = {
  identifiers: { operation_id: 'op_report_1', operation_plan_id: 'op_report_1', field_id: 'field_1' },
  generated_at: new Date(1700000000000).toISOString(),
  operation_title: '灌溉作业',
  customer_title: '灌溉作业',
  execution: { final_status: 'SUCCESS', execution_finished_at: new Date(1700000000000).toISOString() },
  acceptance: { status: 'PASS' },
  risk: { level: 'LOW', reasons: [] },
  cost: { estimated_total: 0, actual_total: 0 },
  sla: { execution_duration_ms: null },
  roi_ledger: { items: [{ value_kind: 'ASSUMPTION_BASED', roi_type: 'WATER_SAVED', estimated_money_value: 100, customer_text: 'assumption value', confidence: { level: 'LOW' } }] },
  why: {},
};
const reportAgg = projectCustomerDashboardAggregateV1({ reports: [weakReport] });
assertRuntime(reportAgg.projection_source === 'STATE_FALLBACK_LIMITED', 'weak report without chain validation must be fallback limited');
assertRuntime(reportAgg.recent_operations[0].final_status !== 'SUCCESS', 'weak report SUCCESS must not be exposed as SUCCESS');
assertRuntime(reportAgg.recent_operations[0].acceptance_status !== 'PASS', 'weak report PASS must not be exposed as PASS');
assertRuntime(reportAgg.roi_summary.has_customer_visible_value === false, 'assumption ROI must not have customer visible value');
assertRuntime(reportAgg.roi_summary.hypothesis_items === 1, 'assumption ROI must be counted as hypothesis');
assertRuntime(reportAgg.roi_summary.trusted_value_items === 0, 'assumption ROI must not be trusted value');
`;

const runtime = spawnSync('pnpm', ['--filter', '@geox/server', 'exec', 'tsx', '-e', fixture], {
  cwd: root,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
});
if (runtime.status !== 0) {
  process.stderr.write(runtime.stdout || '');
  process.stderr.write(runtime.stderr || '');
  fail('runtime fixture failed');
}

console.log('[customer-dashboard-projection-trust] PASS');
