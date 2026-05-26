#!/usr/bin/env node
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

function read(rel) {
  return readFileSync(resolve(__dirname, '..', '..', rel), 'utf8');
}
function has(src, text) {
  return src.includes(text);
}
function hasAll(src, terms) {
  return terms.every((term) => has(src, term));
}

const reportProjection = read('apps/server/src/projections/report_v1.ts');
const dashboardProjection = read('apps/server/src/projections/report_dashboard_v1.ts');

const checks = {
  formal_irrigation_formal_scenario_projected:
    hasAll(reportProjection, ['formal_scenario: {', 'scenario_type:', 'formal_chain_status:', 'evidence_status:', 'FORMAL_IRRIGATION', 'const scenarioType: OperationReportFormalScenarioTypeV1']),

  device_anomaly_fail_safe_manual_takeover_or_none:
    hasAll(reportProjection, ['const failSafeStatus', ': "NONE";', 'const manualTakeoverStatus', 'fail_safe: {', 'status: failSafeStatus', 'manual_takeover: {', 'status: manualTakeoverStatus']),

  formal_variable_operation_has_zone_matrix:
    hasAll(reportProjection, ['zone_matrix?: Array<{', 'zone_acceptance_result:', 'operation_rollup_policy:', 'const zoneMatrix: NonNullable<OperationReportV1["zone_matrix"]>']),

  dashboard_recent_operations_has_formal_summary:
    hasAll(dashboardProjection, ['recent_operations:', 'scenario_type?: string;', 'formal_chain_status?: string;', 'evidence_status?: string;', 'fail_safe_status?: string;', 'manual_takeover_status?: string;', 'zone_rollup_status?: string;', 'customer_visible_eligible?: boolean;', 'needs_review?: boolean;', 'scenario_type:', 'formal_chain_status:', 'evidence_status:', 'fail_safe_status:', 'manual_takeover_status:', 'zone_rollup_status:', 'customer_visible_eligible:', 'needs_review:']),

  success_like_not_customer_visible_must_need_review:
    has(reportProjection, 'needs_review: customerVisibleEligible ? needsReview : true'),
};

const output = {
  ok: Object.values(checks).every(Boolean),
  suite: 'ACCEPTANCE_SCENARIO_REPORT_PROJECTION_V1',
  checks,
};

process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
if (!output.ok) process.exit(1);
