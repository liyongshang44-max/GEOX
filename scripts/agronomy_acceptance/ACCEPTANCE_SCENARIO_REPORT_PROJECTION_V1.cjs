#!/usr/bin/env node
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

function read(rel) {
  return readFileSync(resolve(__dirname, '..', '..', rel), 'utf8');
}

const reportProjection = read('apps/server/src/projections/report_v1.ts');
const dashboardProjection = read('apps/server/src/projections/report_dashboard_v1.ts');

const checks = {
  formal_irrigation_formal_scenario_projected:
    /formal_scenario:\s*\{[\s\S]*scenario_type:[\s\S]*formal_chain_status:[\s\S]*evidence_status:/m.test(reportProjection) &&
    /scenarioType[\s\S]*FORMAL_IRRIGATION/m.test(reportProjection),

  device_anomaly_fail_safe_manual_takeover_or_none:
    reportProjection.includes('const failSafeStatus') &&
    reportProjection.includes(': "NONE";') &&
    reportProjection.includes('const manualTakeoverStatus') &&
    reportProjection.includes('fail_safe: {') &&
    reportProjection.includes('status: failSafeStatus') &&
    reportProjection.includes('manual_takeover: {') &&
    reportProjection.includes('status: manualTakeoverStatus'),

  formal_variable_operation_has_zone_matrix:
    /zone_matrix\?:\s*Array<\{[\s\S]*zone_acceptance_result:[\s\S]*operation_rollup_policy:/m.test(reportProjection) &&
    /const\s+zoneMatrix:\s+NonNullable<OperationReportV1\["zone_matrix"\]>/m.test(reportProjection),

  dashboard_recent_operations_has_formal_summary:
    /recent_operations:[\s\S]*scenario_type\?:\s*string;[\s\S]*formal_chain_status\?:\s*string;[\s\S]*evidence_status\?:\s*string;[\s\S]*fail_safe_status\?:\s*string;[\s\S]*manual_takeover_status\?:\s*string;[\s\S]*zone_rollup_status\?:\s*string;[\s\S]*customer_visible_eligible\?:\s*boolean;[\s\S]*needs_review\?:\s*boolean;/m.test(dashboardProjection) &&
    /scenario_type:\s*report\.formal_scenario\?\.scenario_type/m.test(dashboardProjection),

  success_like_not_customer_visible_must_need_review:
    /needs_review:\s*customerVisibleEligible\s*\?\s*needsReview\s*:\s*true/m.test(reportProjection),
};

const output = {
  ok: Object.values(checks).every(Boolean),
  suite: 'ACCEPTANCE_SCENARIO_REPORT_PROJECTION_V1',
  checks,
};

process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
if (!output.ok) process.exit(1);
