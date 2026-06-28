#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

function read(root, rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function assertIncludes(text, token, label) {
  assert.equal(text.includes(token), true, `${label} must include ${token}`);
}

function assertExcludes(text, token, label) {
  assert.equal(text.includes(token), false, `${label} must not include ${token}`);
}

function assertStaticContracts(root) {
  const reportV1 = read(root, 'apps/server/src/projections/report_v1.ts');
  const operationStateProjection = read(root, 'apps/server/src/projections/operation_state_v1.ts');
  const reportsRoute = read(root, 'apps/server/src/routes/reports_v1.ts');
  const projection = read(root, 'apps/server/src/services/inspection/pest_disease_inspection_projection_v1.ts');
  const exportBlocks = read(root, 'apps/web/src/components/customer/CustomerExportBlocks.tsx');
  const reportMainVisual = read(root, 'apps/web/src/viewmodels/customerReportMainVisualVm.ts');

  assertIncludes(operationStateProjection, 'projectOperationStateV1', 'operation state projection');
  assertIncludes(operationStateProjection, 'operation_plan_v1', 'operation state projection');
  assertIncludes(reportV1, 'OperationReportPestDiseaseInspectionV1', 'report v1');
  assertIncludes(reportV1, 'pest_disease_inspection?: OperationReportPestDiseaseInspectionV1', 'report v1');
  assertIncludes(reportV1, '"FORMAL_PEST_DISEASE_INSPECTION"', 'report v1');

  for (const token of [
    'observation_evidence',
    'media_refs',
    'captured_at_ts',
    'geo_point',
    'device_profile',
    'scout_note',
    'incidence_percent',
    'severity_percent',
    'affected_area_percent',
  ]) assertIncludes(projection, token, 'inspection projection');

  assertIncludes(reportsRoute, 'buildPestDiseaseInspectionReportProjectionV1', 'reports route');
  assertIncludes(reportsRoute, 'mergePestDiseaseInspectionIntoReport', 'reports route');
  assertIncludes(reportsRoute, 'scenario_type: "FORMAL_PEST_DISEASE_INSPECTION"', 'reports route');

  assertIncludes(exportBlocks, 'buildCustomerOperationReportMainVisualVm', 'customer export blocks');
  assertIncludes(exportBlocks, 'mainVisual.rows.map', 'customer export blocks');
  assertExcludes(exportBlocks, 'pdiEvidenceBasisRows', 'customer export blocks');
  assertExcludes(exportBlocks, 'operation_report_v1.pest_disease_inspection.observation_evidence', 'customer export blocks');

  assertIncludes(reportMainVisual, 'pest_disease_inspection', 'customer report main visual');
  assertIncludes(reportMainVisual, 'observation_evidence', 'customer report main visual');
  assertIncludes(reportMainVisual, 'INSUFFICIENT_REPORT', 'customer report main visual');
  assertIncludes(reportMainVisual, '正式\\s*report\\s*API\\s*数据', 'customer report main visual');

  const pestMergeStart = reportsRoute.indexOf('function mergePestDiseaseInspectionIntoReport');
  const projectReportStart = reportsRoute.indexOf('export async function projectReportV1');
  const pestBlock = pestMergeStart >= 0 && projectReportStart > pestMergeStart ? reportsRoute.slice(pestMergeStart, projectReportStart) : '';
  assertExcludes(pestBlock, 'as any', 'pest/disease report merge block');
}

function run() {
  const root = path.resolve(__dirname, '..', '..');
  assertStaticContracts(root);
  console.log('PASS acceptance pest disease inspection report projection v1');
}

run();
