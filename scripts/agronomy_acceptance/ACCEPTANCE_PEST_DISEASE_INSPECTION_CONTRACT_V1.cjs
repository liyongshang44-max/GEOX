#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..', '..');
const contractTs = path.join(root, 'apps/server/src/domain/inspection/pest_disease_inspection_contract_v1.ts');
const contractDoc = path.join(root, 'docs/contracts/PEST_DISEASE_INSPECTION_DOMAIN_CONTRACT_V1.md');

function read(file) {
  assert.equal(fs.existsSync(file), true, `missing required file: ${file}`);
  return fs.readFileSync(file, 'utf8');
}

function assertAll(text, required, label) {
  const missing = required.filter((x) => !text.includes(x));
  assert.deepEqual(missing, [], `${label} missing required entries: ${missing.join(', ')}`);
}

(function main() {
  const ts = read(contractTs);
  const md = read(contractDoc);

  const requiredFactTypes = [
    'pest_disease_inspection_request_v1',
    'pest_disease_observation_v1',
    'pest_disease_signal_v1',
    'pest_disease_inspection_assessment_v1',
    'pest_disease_inspection_review_v1',
    'pest_disease_inspection_acceptance_v1',
  ];

  const requiredRequestFields = [
    'inspection_id',
    'tenant_id',
    'project_id',
    'group_id',
    'field_id',
    'zone_id',
    'trigger_source',
    'AO_SENSE',
    'MANUAL_SCOUT',
    'DRONE_IMAGE',
    'FIXED_TRAP',
    'SENSING_RISK',
    'CUSTOMER_REQUEST',
    'CROP_STAGE_WINDOW',
    'requested_target',
    'PEST',
    'DISEASE',
    'WEED',
    'UNKNOWN_STRESS',
    'crop_code',
    'crop_stage',
    'requested_at_ts',
    'priority',
    'LOW',
    'NORMAL',
    'HIGH',
    'URGENT',
    'evidence_refs',
    'reasons',
  ];

  const requiredObservationFields = [
    'observation_id',
    'inspection_id',
    'captured_at_ts',
    'geo_point',
    'lat',
    'lng',
    'device_profile',
    'device_id',
    'device_model',
    'PHONE_CAMERA',
    'DJI_MAVIC_3E',
    'DJI_MAVIC_3M',
    'DJI_MAVIC_3T',
    'SENTERA_6X',
    'MICASENSE_REDEDGE_P',
    'FIXED_PEST_TRAP_GENERIC',
    'TRAPVIEW_TRAP',
    'MANUAL_SCOUT',
    'OTHER',
    'device_type',
    'PHONE',
    'UAV_RGB',
    'UAV_MULTISPECTRAL',
    'UAV_THERMAL',
    'FIXED_TRAP',
    'SCOUTING_APP',
    'MANUAL',
    'capabilities',
    'media_refs',
    'IMAGE',
    'VIDEO',
    'MULTISPECTRAL_MAP',
    'THERMAL_IMAGE',
    'TRAP_IMAGE',
    'checksum',
    'scout_note',
    'plant_part',
    'LEAF',
    'STEM',
    'ROOT',
    'FRUIT',
    'CANOPY',
    'TRAP',
    'UNKNOWN',
    'target_type',
    'suspected_issue_code',
    'pest_count',
    'trap_count',
    'incidence_percent',
    'severity_percent',
    'affected_area_percent',
    'evidence_quality',
    'COMPLETE',
    'PARTIAL',
    'MISSING_GEO',
    'MISSING_MEDIA',
    'LOW_QUALITY_IMAGE',
    'created_at_ts',
  ];

  const requiredSignalFields = [
    'signal_id',
    'observation_id',
    'skill_id',
    'skill_run_id',
    'skill_trace_id',
    'signal_type',
    'PEST_SIGNAL',
    'DISEASE_SIGNAL',
    'WEED_SIGNAL',
    'CROP_STRESS_SIGNAL',
    'candidate_issue_code',
    'confidence',
    'reason_codes',
    'missing_inputs',
    'uncertainty_notes',
  ];

  const requiredAssessmentFields = [
    'assessment_id',
    'target_type',
    'assessment_status',
    'CONFIRMED',
    'SUSPECTED',
    'RULED_OUT',
    'NEEDS_REVIEW',
    'INSUFFICIENT_EVIDENCE',
    'severity',
    'NONE',
    'confidence',
    'evidence_tier',
    'FORMAL',
    'TECHNICAL',
    'WARNING',
    'MANUAL_REVIEW',
    'review_required',
    'customer_visible_eligible',
    'observation_refs',
    'skill_signal_refs',
    'blocking_reasons',
  ];

  const requiredReviewFields = [
    'review_id',
    'assessment_id',
    'review_status',
    'NOT_REQUIRED',
    'PENDING',
    'APPROVED',
    'REJECTED',
    'ESCALATED',
    'reviewer_actor_id',
    'reviewed_at_ts',
    'review_note',
  ];

  const requiredAcceptanceFields = [
    'inspection_acceptance_id',
    'verdict',
    'PASS',
    'FAIL',
    'NEEDS_REVIEW',
    'INSUFFICIENT_EVIDENCE',
    'evidence_complete',
    'geo_evidence_present',
    'media_evidence_present',
    'human_review_satisfied',
    'evaluated_at_ts',
  ];

  const requiredHardRules = [
    'pest_disease_inspection_acceptance PASS = 巡检证据链完整，可支撑 assessment',
    'pest_disease_inspection_acceptance PASS ≠ 病虫害一定存在',
    'pest_disease_inspection_acceptance PASS ≠ spray recommendation',
    'pest_disease_inspection_acceptance PASS ≠ spot spray prescription',
    'pest_disease_inspection_acceptance PASS ≠ AO-ACT spray task',
    'SkillRun SUCCESS ≠ pest_disease_inspection_assessment CONFIRMED',
    'pest_disease_observation_v1 ≠ formal pest/disease conclusion',
    'pest_disease_signal_v1 is a technical signal, not a formal assessment',
    'pest_disease_inspection_assessment_v1 ≠ spray recommendation / spot spray prescription / AO-ACT spray task',
  ];

  const requiredBoundaryNotes = [
    'Pest/Disease AGRONOMY or SENSING Skill output may produce pest_disease_signal_v1 only',
    'Inspection Domain owns pest_disease_inspection_assessment_v1 and pest_disease_inspection_acceptance_v1',
    'AO-SENSE may request and receipt inspection tasks',
    'referenced from AO-SENSE receipt by fact_id',
  ];

  assertAll(ts, requiredFactTypes, 'pest disease inspection contract TS fact types');
  assertAll(md, requiredFactTypes, 'pest disease inspection contract doc fact types');

  for (const [required, label] of [
    [requiredRequestFields, 'request fields'],
    [requiredObservationFields, 'observation fields'],
    [requiredSignalFields, 'signal fields'],
    [requiredAssessmentFields, 'assessment fields'],
    [requiredReviewFields, 'review fields'],
    [requiredAcceptanceFields, 'acceptance fields'],
    [requiredHardRules, 'hard rules'],
    [requiredBoundaryNotes, 'boundary notes'],
  ]) {
    assertAll(ts, required, `pest_disease_inspection_contract_v1.ts ${label}`);
    assertAll(md, required, `PEST_DISEASE_INSPECTION_DOMAIN_CONTRACT_V1.md ${label}`);
  }

  assert.equal(ts.includes('PEST_DISEASE_INSPECTION_FACT_TYPES_V1'), true, 'missing PEST_DISEASE_INSPECTION_FACT_TYPES_V1 export');
  assert.equal(ts.includes('PEST_DISEASE_INSPECTION_DOMAIN_HARD_RULES_V1'), true, 'missing PEST_DISEASE_INSPECTION_DOMAIN_HARD_RULES_V1 export');
  assert.equal(ts.includes('PEST_DISEASE_INSPECTION_SKILL_BOUNDARY_NOTE_V1'), true, 'missing PEST_DISEASE_INSPECTION_SKILL_BOUNDARY_NOTE_V1 export');

  for (const factType of requiredFactTypes) {
    assert.equal(ts.includes(`type: "${factType}"`), true, `missing formal fact envelope for ${factType}`);
    assert.equal(ts.includes('schema_version: "1"'), true, 'missing schema_version literal');
  }

  console.log('PASS acceptance pest disease inspection contract v1', {
    contractTs,
    contractDoc,
    requiredFactTypes: requiredFactTypes.length,
    requiredHardRules: requiredHardRules.length,
    requestFieldsChecked: requiredRequestFields.length,
    observationFieldsChecked: requiredObservationFields.length,
    signalFieldsChecked: requiredSignalFields.length,
    assessmentFieldsChecked: requiredAssessmentFields.length,
    reviewFieldsChecked: requiredReviewFields.length,
    acceptanceFieldsChecked: requiredAcceptanceFields.length,
  });
})();
