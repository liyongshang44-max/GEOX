#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = process.cwd();
const files = {
  projection: path.join(root, 'apps/server/src/projections/report_dashboard_v1.ts'),
  guardedReport: path.join(root, 'apps/server/src/projections/guarded_report_v1.ts'),
  reportsDashboardRoute: path.join(root, 'apps/server/src/routes/reports_dashboard_v1.ts'),
  customerRoute: path.join(root, 'apps/server/src/routes/customer_v1.ts'),
};

function read(file) { return fs.readFileSync(file, 'utf8'); }
function fail(message) { console.error(`[customer-dashboard-projection-trust] FAIL: ${message}`); process.exit(1); }
function assert(condition, message) { if (!condition) fail(message); }
function assertIncludes(source, needle, label) { assert(source.includes(needle), `${label} must include ${needle}`); }
function assertNotIncludes(source, needle, label) { assert(!source.includes(needle), `${label} must not include ${needle}`); }

const projection = read(files.projection);
const guardedReport = read(files.guardedReport);
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

// Dashboard and Field Report ROI summaries must use formal trust lane, not measured/confidence-only heuristics.
for (const field of ['trusted_value_items', 'hypothesis_items', 'estimated_items', 'insufficient_evidence_items', 'simulated_or_technical_items']) assertIncludes(projection, field, 'ROI summary trust buckets');
assertIncludes(projection, 'import { isFormalCustomerValueItem }', 'dashboard formal ROI helper import');
assertIncludes(projection, 'function isTrustedRoiItem(item: any): boolean { return isFormalCustomerValueItem(item); }', 'dashboard trusted ROI formal predicate');
assertIncludes(guardedReport, 'export function isFormalCustomerValueItem', 'guarded report formal ROI helper');
assertIncludes(guardedReport, 'item?.trust_level === "FORMAL_ACCEPTED"', 'formal ROI trust level condition');
assertIncludes(guardedReport, 'item?.source_lane === "FORMAL_ACCEPTANCE"', 'formal ROI source lane condition');
assertIncludes(guardedReport, 'formalAcceptanceId(item) != null', 'formal ROI formal acceptance condition');
assertIncludes(guardedReport, 'item?.formal_evidence_passed === true', 'formal ROI evidence condition');
assertIncludes(guardedReport, 'item?.chain_validation_passed === true', 'formal ROI chain condition');
assertIncludes(guardedReport, 'hasFormalFieldMemoryInAggregate', 'field report guard must require formal field memory evidence');
assertIncludes(projection, 'has_customer_visible_value: hasValue', 'ROI customer visible value must be trusted-only');
assertIncludes(projection, '暂无可作为客户正式价值结论的记录', 'ROI customer text must avoid weak value claim');
assertNotIncludes(projection, 'valueKind === "MEASURED" && confidence !== "LOW"', 'dashboard trusted ROI must not be measured/confidence-only');
assertNotIncludes(projection, '本地块已有 ${total} 条价值记录', 'Field Report must not treat all ROI items as value records');
assertNotIncludes(projection, '当前共有 ${summary.total_roi_items} 条价值记录', 'Dashboard must not treat all ROI items as value records');
assertNotIncludes(guardedReport, 'next.roi_summary = { ...(next.roi_summary ?? {}), has_customer_visible_value: false', 'dashboard guard must not unconditionally hide ROI');
assertNotIncludes(guardedReport, 'next.value_summary = { ...(next.value_summary ?? {}), has_customer_visible_value: false', 'field guard must not unconditionally hide ROI');

// Guarded report path must use safe status projection and formal pending acceptance only.
assertIncludes(projection, 'safeReportFinalStatus', 'guarded report status projection');
assertIncludes(projection, 'safeReportAcceptanceStatus', 'guarded report acceptance projection');
assertIncludes(projection, 'trust.customer_visible_eligible && upper((report as any).execution?.final_status) === "PENDING_ACCEPTANCE"', 'guarded pending acceptance source');
assertIncludes(projection, 'report_without_guarded_chain_validation', 'weak report blocking reason');
assertIncludes(projection, 'customerOperationListTrustFromGuardedReportV1', 'customer operations guarded report trust helper');
assertIncludes(projection, 'isCustomerVisibleGuardedOperationReportV1', 'customer operations guarded report visibility helper');

// Customer route must not expose raw operation_state final/acceptance status as official customer state.
assertIncludes(customerRoute, 'STATE_FALLBACK_TRUST', 'customer state fallback trust metadata');
assertIncludes(customerRoute, 'projection_source: "STATE_FALLBACK_LIMITED"', 'customer route state fallback projection source');
assertIncludes(customerRoute, 'fallback_limited: true', 'customer route fallback limited');
assertIncludes(customerRoute, 'customer_visible_eligible: false', 'customer route customer visibility false');
assertIncludes(customerRoute, 'limitedFinalStatusFromState', 'customer route limited final status helper');
assertIncludes(customerRoute, 'limitedAcceptanceStatusFromState', 'customer route limited acceptance status helper');
assertIncludes(customerRoute, 'formalPendingAcceptanceFromState', 'customer route formal pending helper');
assertIncludes(customerRoute, 'final_status: limitedFinalStatusFromState()', 'customer operations fallback final status must be limited');
assertIncludes(customerRoute, 'acceptance_status: limitedAcceptanceStatusFromState()', 'customer operations fallback acceptance status must be needs review');
assertIncludes(customerRoute, 'pending_acceptance_count: Number(agg?.pendingAcceptanceCount ?? 0)', 'customer fields pending count must use limited helper aggregation');
assertNotIncludes(customerRoute, 'final_status: String(state.final_status', 'customer operations must not expose raw state final_status');
assertNotIncludes(customerRoute, 'acceptance_status: String(state.acceptance?.status', 'customer operations must not expose raw state acceptance status');

// Customer operations must prefer guarded report and keep state as limited fallback.
assertIncludes(customerRoute, 'buildGuardedOperationReportV1', 'customer operations guarded report builder');
assertIncludes(customerRoute, 'projectReportV1', 'customer operations operation report projection');
assertIncludes(customerRoute, 'customerOperationFromGuardedReport', 'customer operations guarded report mapper');
assertIncludes(customerRoute, 'customerOperationFromStateFallback', 'customer operations state fallback mapper');
assertIncludes(customerRoute, 'buildGuardedCustomerOperationItem', 'customer operations guarded/fallback item builder');
assertIncludes(customerRoute, 'customerOperationFromGuardedReport(guarded, params.state, params.fieldNameById) ?? customerOperationFromStateFallback', 'customer operations guarded-first fallback order');
assertIncludes(customerRoute, 'isCustomerVisibleGuardedOperationReportV1(report)', 'customer operations guarded visibility predicate');
assertIncludes(customerRoute, 'projection_source: hasFormalOperation ? "GUARDED_REPORT" : "STATE_FALLBACK_LIMITED"', 'customer operations response trust source');
assertIncludes(customerRoute, 'fallback_limited: !hasFormalOperation', 'customer operations response fallback limited');
assertIncludes(customerRoute, 'data_trust_status: hasFormalOperation ? "FORMAL" : "LIMITED"', 'customer operations response data trust status');

// Customer scope boundary must remain in place.
assertIncludes(customerRoute, 'filterByCustomerScope(await projectOperationStateV1(pool, ctx.tenant), ctx.scope', 'customer operations scope filtering');
assertIncludes(customerRoute, 'resolveCustomerScope(auth)', 'customer scope resolver');
assertIncludes(customerRoute, 'isFieldAllowedByCustomerScope', 'customer field geometry scope guard');

// reports_dashboard route may still use FromStates fallback, but the projection must now return limited/safe payload.
assertIncludes(reportsDashboardRoute, 'projectCustomerDashboardAggregateFromStatesV1', 'reports dashboard route state fallback projection');
assertIncludes(reportsDashboardRoute, 'projectFieldPortfolioSummaryV1', 'reports dashboard route guarded report projection');

const fixture = String.raw`
(async () => {
const mod = await import('./src/projections/report_dashboard_v1.ts');
const guard = await import('./src/projections/guarded_report_v1.ts');
const { projectCustomerDashboardAggregateFromStatesV1, projectCustomerDashboardAggregateV1, projectFieldReportDetailV1, customerOperationListTrustFromGuardedReportV1, isCustomerVisibleGuardedOperationReportV1 } = mod;
const { applyGuardedDashboardAggregateV1, applyGuardedFieldReportV1, isFormalCustomerValueItem } = guard;
function assertRuntime(condition, message) { if (!condition) throw new Error(message); }
const weakState = { operation_id: 'op_weak_success', operation_plan_id: 'op_weak_success', field_id: 'field_1', final_status: 'SUCCESS', acceptance: { status: 'PASS' }, reason_codes: [], last_event_ts: 1700000000000 };
const stateAgg = projectCustomerDashboardAggregateFromStatesV1({ states: [weakState], field_ids: ['field_1'], field_name_by_id: new Map([['field_1', 'Field 1']]) });
assertRuntime(stateAgg.projection_source === 'STATE_FALLBACK_LIMITED', 'FromStates fallback must have STATE_FALLBACK_LIMITED source');
assertRuntime(stateAgg.fallback_limited === true, 'FromStates fallback must be fallback_limited');
assertRuntime(stateAgg.customer_visible_eligible === false, 'FromStates fallback must not be customer visible');
assertRuntime(Array.isArray(stateAgg.blocking_reasons) && stateAgg.blocking_reasons.includes('state_fallback_limited_not_customer_official'), 'FromStates fallback must include blocking reason');
assertRuntime(stateAgg.recent_operations[0].final_status !== 'SUCCESS', 'weak operation_state SUCCESS must not appear as recent_operations SUCCESS');
assertRuntime(stateAgg.recent_operations[0].final_status === 'LIMITED_STATE', 'weak operation_state final_status must be LIMITED_STATE');
assertRuntime(stateAgg.recent_operations[0].acceptance_status !== 'PASS', 'weak operation_state acceptance PASS must not appear as PASS');
assertRuntime(stateAgg.roi_summary.has_customer_visible_value === false, 'FromStates ROI must not have customer visible value');
assertRuntime(stateAgg.pending_actions_summary.pending_acceptance === 0, 'FromStates pending_acceptance must not be raw-derived');

const asExecutedRoi = { trust_level: 'INTERIM_SUPPORTED', source_lane: 'AS_EXECUTED_SIGNAL', customer_visible_value: false, value_kind: 'MEASURED', roi_type: 'WATER_SAVED', confidence: { level: 'HIGH' } };
const formalRoi = { trust_level: 'FORMAL_ACCEPTED', source_lane: 'FORMAL_ACCEPTANCE', formal_acceptance_id: 'acc_1', formal_evidence_passed: true, chain_validation_passed: true, customer_visible_value: true, value_kind: 'MEASURED', roi_type: 'WATER_SAVED', confidence: { level: 'HIGH' }, customer_text: 'formal water value' };
const assumptionRoi = { trust_level: 'HYPOTHESIS_ONLY', source_lane: 'MANUAL_IMPORT', customer_visible_value: false, value_kind: 'ASSUMPTION_BASED', baseline_type: 'DEFAULT_ASSUMPTION', roi_type: 'WATER_SAVED', estimated_money_value: 100, confidence: { level: 'LOW' } };
assertRuntime(isFormalCustomerValueItem(formalRoi) === true, 'formal ROI helper must accept formal accepted ROI');
assertRuntime(isFormalCustomerValueItem(asExecutedRoi) === false, 'formal ROI helper must reject as-executed ROI');
assertRuntime(isFormalCustomerValueItem(assumptionRoi) === false, 'formal ROI helper must reject assumption/default ROI');

const weakReport = { identifiers: { operation_id: 'op_report_1', operation_plan_id: 'op_report_1', field_id: 'field_1' }, generated_at: new Date(1700000000000).toISOString(), operation_title: '灌溉作业', customer_title: '灌溉作业', execution: { final_status: 'SUCCESS', execution_finished_at: new Date(1700000000000).toISOString() }, acceptance: { status: 'PASS' }, risk: { level: 'LOW', reasons: [] }, cost: { estimated_total: 0, actual_total: 0 }, sla: { execution_duration_ms: null }, roi_ledger: { items: [assumptionRoi] }, why: {} };
const reportAgg = projectCustomerDashboardAggregateV1({ reports: [weakReport] });
assertRuntime(reportAgg.projection_source === 'STATE_FALLBACK_LIMITED', 'weak report without chain validation must be fallback limited');
assertRuntime(reportAgg.recent_operations[0].final_status !== 'SUCCESS', 'weak report SUCCESS must not be exposed as SUCCESS');
assertRuntime(reportAgg.recent_operations[0].acceptance_status !== 'PASS', 'weak report PASS must not be exposed as PASS');
assertRuntime(reportAgg.roi_summary.has_customer_visible_value === false, 'assumption ROI must not have customer visible value');
assertRuntime(reportAgg.roi_summary.hypothesis_items === 1, 'assumption ROI must be counted as hypothesis');
assertRuntime(reportAgg.roi_summary.trusted_value_items === 0, 'assumption ROI must not be trusted value');

const formalMemory = { memory_type: 'FIELD_RESPONSE_MEMORY', memory_lane: 'FORMAL_FIELD_MEMORY', trust_level: 'FORMAL_ACCEPTED', customer_visible_memory: true, learning_eligible: true, formal_acceptance_id: 'acc_1' };
const formalReport = { ...weakReport, chain_validation: { passed: true, helper_or_simulated: false }, status_chain: [{ key: 'acceptance', status: 'DONE' }], fallback_limited: false, customer_visible_eligible: true, blocking_reasons: [], execution: { ...weakReport.execution, final_status: 'SUCCESS' }, acceptance: { status: 'PASS', formal_acceptance: true }, roi_ledger: { items: [formalRoi] }, field_memory: { field_response_memory: [formalMemory] } };
const formalTrust = customerOperationListTrustFromGuardedReportV1(formalReport);
assertRuntime(formalTrust.projection_source === 'GUARDED_REPORT', 'guarded formal report must be GUARDED_REPORT');
assertRuntime(formalTrust.fallback_limited === false, 'guarded formal report must not be fallback limited');
assertRuntime(formalTrust.customer_visible_eligible === true, 'guarded formal report must be customer visible');
assertRuntime(isCustomerVisibleGuardedOperationReportV1(formalReport) === true, 'guarded formal report visibility helper must be true');
const formalAgg = projectCustomerDashboardAggregateV1({ reports: [formalReport] });
assertRuntime(formalAgg.recent_operations[0].projection_source === 'GUARDED_REPORT', 'formal recent operation must be GUARDED_REPORT');
assertRuntime(formalAgg.recent_operations[0].customer_visible_eligible === true, 'formal recent operation must be customer visible');
assertRuntime(formalAgg.recent_operations[0].final_status !== 'LIMITED_STATE', 'formal recent operation must not be LIMITED_STATE');
assertRuntime(formalAgg.recent_operations[0].final_status === 'SUCCESS', 'formal recent operation must expose report execution final_status');
assertRuntime(formalAgg.recent_operations[0].acceptance_status === 'PASS', 'formal recent operation must expose report acceptance status');
assertRuntime(formalAgg.roi_summary.trusted_value_items > 0, 'formal ROI must be trusted dashboard value');
assertRuntime(formalAgg.roi_summary.has_customer_visible_value === true, 'formal ROI must be customer-visible dashboard value');
const guardedFormalAgg = applyGuardedDashboardAggregateV1(formalAgg);
assertRuntime(guardedFormalAgg.roi_summary.has_customer_visible_value === true, 'dashboard guard must preserve formal ROI value');
const asExecutedReport = { ...formalReport, roi_ledger: { items: [asExecutedRoi] } };
const asExecutedAgg = projectCustomerDashboardAggregateV1({ reports: [asExecutedReport] });
assertRuntime(asExecutedAgg.roi_summary.trusted_value_items === 0, 'as-executed ROI must not be trusted dashboard value');
assertRuntime(asExecutedAgg.roi_summary.has_customer_visible_value === false, 'as-executed ROI must not be customer-visible dashboard value');
const fieldReport = projectFieldReportDetailV1({ field_id: 'field_1', reports: [formalReport], open_alerts_count: 0, device_summary: { total_devices: 0, online_devices: 0, offline_devices: 0, last_telemetry_at: null } });
assertRuntime(fieldReport.value_summary.trusted_value_items > 0, 'formal ROI must be trusted field value');
assertRuntime(fieldReport.value_summary.has_customer_visible_value === true, 'formal ROI must be customer-visible field value');
const guardedField = applyGuardedFieldReportV1(fieldReport);
assertRuntime(guardedField.value_summary.has_customer_visible_value === true, 'field guard must preserve formal ROI value');
})();
`;

const runtime = spawnSync('pnpm', ['--filter', '@geox/server', 'exec', 'tsx', '-e', fixture], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
if (runtime.status !== 0) { process.stderr.write(runtime.stdout || ''); process.stderr.write(runtime.stderr || ''); fail('runtime fixture failed'); }

console.log('[customer-dashboard-projection-trust] PASS');
