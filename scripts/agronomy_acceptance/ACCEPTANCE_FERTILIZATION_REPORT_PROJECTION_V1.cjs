const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..', '..');

function read(rel) {
  const file = path.join(root, rel);
  assert.equal(fs.existsSync(file), true, `missing required file: ${rel}`);
  return fs.readFileSync(file, 'utf8');
}

function assertAll(text, needles, label) {
  const missing = needles.filter((x) => !text.includes(x));
  assert.deepEqual(missing, [], `${label} missing: ${missing.join(', ')}`);
}

function assertRegex(text, patterns, label) {
  const missing = patterns.filter((pattern) => !pattern.test(text)).map(String);
  assert.deepEqual(missing, [], `${label} missing patterns: ${missing.join(', ')}`);
}

(function main() {
  const projection = read('apps/server/src/services/fertilization/fertilization_projection_v1.ts');
  const reports = read('apps/server/src/routes/reports_v1.ts');
  const reportV1 = read('apps/server/src/projections/report_v1.ts');
  const manifest = read('apps/server/src/services/scenarios/formal_scenario_manifest_v1.ts');
  const lanes = read('apps/server/src/services/scenarios/formal_scenario_lanes_v1.ts');

  const requiredReportFields = [
    'assessment_id',
    'trigger_source',
    'SAMPLING_LAB',
    'SENSING_RISK',
    'MANUAL_AGRONOMIST',
    'CROP_STAGE_WINDOW',
    'evidence_tier',
    'FORMAL',
    'WARNING',
    'MANUAL_REVIEW',
    'fertilization_recommendation_id',
    'fertilization_prescription_id',
    'nutrient',
    'material_type',
    'zone_rates',
    'planned_n_kg_ha',
    'actual_n_kg_ha',
    'coverage_percent',
    'deviation_percent',
    'PASS',
    'FAIL',
    'NEEDS_REVIEW',
    'MISSING',
    'customer_visible_eligible',
    'blocking_reasons',
  ];

  assertAll(projection, [
    'export type FertilizationReportProjectionV1',
    'buildFertilizationReportProjectionV1',
    'nitrogen_need_assessment_v1',
    'fertilization_recommendation_v1',
    'fertilization_prescription_v1',
    'fertilization_acceptance_v1',
    'fertilization_sensing_review_only',
    'fertilization_warning_only',
    'fertilization_salinity_risk',
    'fertilization_zone_deviation_large',
    ...requiredReportFields,
  ], 'fertilization projection');

  assertAll(reports, [
    'buildFertilizationReportProjectionV1',
    'mergeFertilizationIntoReport',
    'fertilization',
    'FORMAL_FERTILIZATION',
    'formal_scenario',
    'operation_report_v1',
    '/api/v1/reports/operation/:operation_id',
    '/api/v1/reports/field/:field_id',
  ], 'reports route integration');

  assertAll(manifest, ['FORMAL_FERTILIZATION'], 'formal scenario manifest');
  assertAll(lanes, ['FORMAL_FERTILIZATION', 'Formal fertilization positive lane', 'Formal fertilization negative agronomy lanes', 'Formal fertilization zone deviation lane'], 'formal scenario lanes');

  assertRegex(projection, [
    /acceptance_status:\s*"PASS"\s*\|\s*"FAIL"\s*\|\s*"NEEDS_REVIEW"\s*\|\s*"MISSING"/,
    /trigger_source:\s*"SAMPLING_LAB"\s*\|\s*"SENSING_RISK"\s*\|\s*"MANUAL_AGRONOMIST"\s*\|\s*"CROP_STAGE_WINDOW"\s*\|\s*null/,
    /evidence_tier:\s*"FORMAL"\s*\|\s*"WARNING"\s*\|\s*"MANUAL_REVIEW"\s*\|\s*null/,
    /zone_rates:\s*FertilizationReportZoneRateV1\[\]/,
    /customer_visible_eligible:\s*Boolean\(/,
  ], 'fertilization projection schema and logic');

  // report_v1 remains the base projection contract; route-level enrichment is allowed as extension.
  assertAll(reportV1, ['OperationReportV1', 'formal_scenario', 'sampling'], 'base report projection still present');

  console.log('PASS acceptance fertilization report projection v1', {
    projection_file: 'apps/server/src/services/fertilization/fertilization_projection_v1.ts',
    reports_route: 'apps/server/src/routes/reports_v1.ts',
    scenario_type: 'FORMAL_FERTILIZATION',
    report_fields_checked: requiredReportFields.length,
  });
})();
