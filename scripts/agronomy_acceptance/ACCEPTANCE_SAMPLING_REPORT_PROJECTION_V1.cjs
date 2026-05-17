#!/usr/bin/env node
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

function read(rel) {
  return readFileSync(resolve(__dirname, '..', '..', rel), 'utf8');
}

const reportProjection = read('apps/server/src/projections/report_v1.ts');
const dashboardProjection = read('apps/server/src/projections/report_dashboard_v1.ts');

const checks = {
  report_has_sampling_contract_shape:
    /sampling\?:\s*\{[\s\S]*plan_id:[\s\S]*sample_id:[\s\S]*sample_type:[\s\S]*lab_result_status:[\s\S]*acceptance_status:[\s\S]*customer_visible_eligible:[\s\S]*blocking_reasons:/m.test(reportProjection),

  report_maps_sampling_runtime_fields:
    /const\s+samplingRaw\s*=\s*operationStateAny\?\.sampling\s*\?\?\s*operationStateAny\?\.sampling_report\s*\?\?\s*operationStateAny\?\.operation_sampling\s*\?\?\s*\{\}/m.test(reportProjection) &&
    /sampling:\s*\{[\s\S]*plan_id:\s*toText\(samplingRaw\?\.plan_id\)[\s\S]*lab_result_status:\s*samplingLabStatus[\s\S]*acceptance_status:\s*samplingAcceptanceStatus[\s\S]*blocking_reasons:\s*samplingBlockingReasons/m.test(reportProjection),

  dashboard_surfaces_sampling_statuses:
    /sampling_lab_result_status\?:\s*string;/m.test(dashboardProjection) &&
    /sampling_acceptance_status\?:\s*string;/m.test(dashboardProjection) &&
    /sampling_lab_result_status:\s*report\.sampling\?\.lab_result_status\s*\?\?\s*undefined/m.test(dashboardProjection) &&
    /sampling_acceptance_status:\s*report\.sampling\?\.acceptance_status\s*\?\?\s*undefined/m.test(dashboardProjection),
};

const output = {
  ok: Object.values(checks).every(Boolean),
  suite: 'ACCEPTANCE_SAMPLING_REPORT_PROJECTION_V1',
  checks,
};

process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
if (!output.ok) process.exit(1);
