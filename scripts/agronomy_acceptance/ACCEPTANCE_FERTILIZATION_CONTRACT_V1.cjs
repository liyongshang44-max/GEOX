const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..', '..');
const contractTs = path.join(root, 'apps/server/src/domain/fertilization/fertilization_contract_v1.ts');
const contractDoc = path.join(root, 'docs/contracts/FERTILIZATION_DOMAIN_CONTRACT_V1.md');
const acceptanceSkills = path.join(root, 'apps/server/src/domain/acceptance/skills.ts');

function read(file) {
  assert.equal(fs.existsSync(file), true, `missing required file: ${file}`);
  return fs.readFileSync(file, 'utf8');
}

function hasAll(text, required) {
  return required.every((x) => text.includes(x));
}

function assertAll(text, required, label) {
  const missing = required.filter((x) => !text.includes(x));
  assert.deepEqual(missing, [], `${label} missing required entries: ${missing.join(', ')}`);
}

(function main() {
  const ts = read(contractTs);
  const md = read(contractDoc);
  const skills = fs.existsSync(acceptanceSkills) ? fs.readFileSync(acceptanceSkills, 'utf8') : '';

  const requiredFactTypes = [
    'nitrogen_need_assessment_v1',
    'fertilization_recommendation_v1',
    'fertilization_prescription_v1',
    'fertilization_acceptance_v1',
  ];

  const requiredAssessmentFields = [
    'assessment_id',
    'tenant_id',
    'project_id',
    'group_id',
    'field_id',
    'season_id',
    'crop_code',
    'trigger_source',
    'evidence_tier',
    'sample_id',
    'lab_import_id',
    'skill_signal_refs',
    'skill_id',
    'skill_run_id',
    'skill_trace_id',
    'signal_type',
    'sensing_state_refs',
    'fertility_state',
    'salinity_risk_state',
    'canopy_stress_state',
    'sample_type',
    'nitrate_n_mg_kg',
    'ammonium_n_mg_kg',
    'total_n_percent',
    'organic_matter_percent',
    'tissue_n_percent',
    'ec_ds_m',
    'canopy_temp_c',
    'status',
    'reasons',
    'evidence_refs',
    'created_at_ts',
  ];

  const requiredRecommendationFields = [
    'fertilization_recommendation_id',
    'assessment_id',
    'tenant_id',
    'project_id',
    'group_id',
    'field_id',
    'recommendation_type',
    'NITROGEN',
    'suggested_total_n_kg_ha',
    'zone_rates',
    'zone_id',
    'n_kg_ha',
    'confidence',
    'HIGH',
    'MEDIUM',
    'LOW',
    'reason',
    'risk_flags',
    'customer_visible_eligible',
    'evidence_refs',
    'source_skill_refs',
    'skill_id',
    'skill_run_id',
    'output_ref',
    'created_at_ts',
  ];

  const requiredPrescriptionFields = [
    'fertilization_prescription_id',
    'fertilization_recommendation_id',
    'assessment_id',
    'tenant_id',
    'project_id',
    'group_id',
    'field_id',
    'nutrient',
    'material_type',
    'planned_n_kg_ha',
    'max_n_kg_ha',
    'kgN/ha',
    'required',
    'manual_approval_required',
    'customer_visible_eligible',
    'READY_FOR_APPROVAL',
    'SUBMITTED_FOR_APPROVAL',
    'APPROVED',
    'REJECTED',
  ];

  const requiredAcceptanceFields = [
    'fertilization_acceptance_id',
    'fertilization_prescription_id',
    'tenant_id',
    'project_id',
    'group_id',
    'field_id',
    'operation_plan_id',
    'act_task_id',
    'receipt_id',
    'as_applied_id',
    'acceptance_status',
    'zone_results',
    'planned_n_kg_ha',
    'actual_n_kg_ha',
    'coverage_percent',
    'deviation_percent',
    'PASS',
    'FAIL',
    'NEEDS_REVIEW',
    'MISSING',
    'operation_rollup_policy',
    'ALL_REQUIRED_ZONES_PASS',
    'NEEDS_REVIEW_ON_MISSING_ZONE',
    'evaluated_at_ts',
  ];

  const requiredTriggerAndStatusEnums = [
    'SAMPLING_LAB',
    'SENSING_RISK',
    'MANUAL_AGRONOMIST',
    'CROP_STAGE_WINDOW',
    'FORMAL',
    'WARNING',
    'MANUAL_REVIEW',
    'SUFFICIENT',
    'LOW_N_RISK',
    'NEEDS_REVIEW',
    'INVALID',
    'SOIL',
    'TISSUE',
  ];

  const requiredHardRules = [
    'SkillRun SUCCESS ≠ nitrogen_need_assessment LOW_N_RISK',
    'lab_result_imported ≠ nitrogen need confirmed',
    'fertility_state LOW ≠ formal fertilization recommendation',
    'nitrogen_need_assessment LOW_N_RISK ≠ fertilization recommendation approved',
    'fertilization_recommendation ≠ fertilization prescription',
    'fertilization_prescription ≠ approved operation',
    'receipt success ≠ fertilization acceptance PASS',
    'operation-level average 不得掩盖 zone-level over/under application',
    'fertilization acceptance PASS 不得直接写 ROI / Field Memory / customer success',
  ];

  const requiredBoundaryNotes = [
    'AcceptanceSkill skill_id=fertilization_acceptance_v1 is only an acceptance_signal producer and is not the formal fertilization_acceptance_v1 fact writer.',
    'Fertilization AGRONOMY Skill output may be diagnosis_signal or recommendation_candidate',
  ];

  assertAll(ts, requiredFactTypes, 'fertilization_contract_v1.ts fact types');
  assertAll(md, requiredFactTypes, 'FERTILIZATION_DOMAIN_CONTRACT_V1.md fact types');

  assertAll(ts, requiredAssessmentFields, 'fertilization_contract_v1.ts assessment fields');
  assertAll(md, requiredAssessmentFields, 'FERTILIZATION_DOMAIN_CONTRACT_V1.md assessment fields');
  assertAll(ts, requiredRecommendationFields, 'fertilization_contract_v1.ts recommendation fields');
  assertAll(md, requiredRecommendationFields, 'FERTILIZATION_DOMAIN_CONTRACT_V1.md recommendation fields');
  assertAll(ts, requiredPrescriptionFields, 'fertilization_contract_v1.ts prescription fields');
  assertAll(md, requiredPrescriptionFields, 'FERTILIZATION_DOMAIN_CONTRACT_V1.md prescription fields');
  assertAll(ts, requiredAcceptanceFields, 'fertilization_contract_v1.ts acceptance fields');
  assertAll(md, requiredAcceptanceFields, 'FERTILIZATION_DOMAIN_CONTRACT_V1.md acceptance fields');

  assertAll(ts, requiredTriggerAndStatusEnums, 'fertilization_contract_v1.ts enums');
  assertAll(md, requiredTriggerAndStatusEnums, 'FERTILIZATION_DOMAIN_CONTRACT_V1.md enums');
  assertAll(ts, requiredHardRules, 'fertilization_contract_v1.ts hard rules');
  assertAll(md, requiredHardRules, 'FERTILIZATION_DOMAIN_CONTRACT_V1.md hard rules');
  assertAll(ts, requiredBoundaryNotes, 'fertilization_contract_v1.ts skill boundary notes');
  assertAll(md, requiredBoundaryNotes, 'FERTILIZATION_DOMAIN_CONTRACT_V1.md skill boundary notes');

  if (skills.includes('skill_id: "fertilization_acceptance_v1"')) {
    assert.equal(
      hasAll(ts, ['acceptance_skill_id_collision', 'not the formal fertilization_acceptance_v1 fact writer']),
      true,
      'existing AcceptanceSkill fertilization_acceptance_v1 collision must be documented in TS contract boundary note',
    );
    assert.equal(
      md.includes('is not the formal `fertilization_acceptance_v1` fact writer'),
      true,
      'existing AcceptanceSkill fertilization_acceptance_v1 collision must be documented in contract doc',
    );
  }

  assert.equal(ts.includes('FERTILIZATION_DOMAIN_HARD_RULES_V1'), true, 'missing FERTILIZATION_DOMAIN_HARD_RULES_V1 export');
  assert.equal(ts.includes('FERTILIZATION_FACT_TYPES_V1'), true, 'missing FERTILIZATION_FACT_TYPES_V1 export');
  assert.equal(ts.includes('type: "nitrogen_need_assessment_v1"'), true, 'missing formal nitrogen_need_assessment_v1 fact envelope');
  assert.equal(ts.includes('type: "fertilization_recommendation_v1"'), true, 'missing formal fertilization_recommendation_v1 fact envelope');
  assert.equal(ts.includes('type: "fertilization_prescription_v1"'), true, 'missing formal fertilization_prescription_v1 fact envelope');
  assert.equal(ts.includes('type: "fertilization_acceptance_v1"'), true, 'missing formal fertilization_acceptance_v1 fact envelope');

  console.log('PASS acceptance fertilization contract v1', {
    contractTs,
    contractDoc,
    requiredFactTypes: requiredFactTypes.length,
    requiredHardRules: requiredHardRules.length,
    assessmentFieldsChecked: requiredAssessmentFields.length,
    recommendationFieldsChecked: requiredRecommendationFields.length,
    prescriptionFieldsChecked: requiredPrescriptionFields.length,
    acceptanceFieldsChecked: requiredAcceptanceFields.length,
    skillBoundaryCollisionDocumented: skills.includes('skill_id: "fertilization_acceptance_v1"'),
  });
})();
