const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..', '..');
const servicePath = path.join(root, 'apps/server/src/services/fertilization/fertilization_service_v1.ts');
const routePath = path.join(root, 'apps/server/src/routes/v1/fertilization.ts');
const registerPath = path.join(root, 'apps/server/src/routes/registerCoreV1Routes.ts');

function read(file) {
  assert.equal(fs.existsSync(file), true, `missing required file: ${file}`);
  return fs.readFileSync(file, 'utf8');
}

function assertAll(text, required, label) {
  const missing = required.filter((x) => !text.includes(x));
  assert.deepEqual(missing, [], `${label} missing required entries: ${missing.join(', ')}`);
}

function assertRegex(text, pattern, label) {
  assert.equal(pattern.test(text), true, `${label}: pattern missing ${pattern}`);
}

(function main() {
  const service = read(servicePath);
  const route = read(routePath);
  const register = read(registerPath);

  const requiredRoutes = [
    'app.post("/api/v1/fertilization/nitrogen-assessment"',
    'app.post("/api/v1/fertilization/recommendation"',
    'app.post("/api/v1/fertilization/prescription"',
    'app.post("/api/v1/fertilization/acceptance/evaluate"',
    'app.get("/api/v1/fertilization/assessment/:assessment_id"',
    'app.get("/api/v1/fertilization/prescription/:fertilization_prescription_id"',
  ];

  const requiredFactWrites = [
    'type: "nitrogen_need_assessment_v1"',
    'type: "fertilization_recommendation_v1"',
    'type: "fertilization_prescription_v1"',
    'type: "fertilization_acceptance_v1"',
    'INSERT INTO facts',
    'api_v1_fertilization',
  ];

  const requiredSamplingLabRules = [
    'trigger_source === "SAMPLING_LAB"',
    'MISSING_OR_INVALID:sample_id',
    'MISSING_OR_INVALID:lab_import_id',
    'lab_result_import_v1',
    'quality_status',
    'LAB_RESULT_QUALITY_STATUS_NOT_PASS',
    'sampling_acceptance_v1',
    'SAMPLING_ACCEPTANCE_PASS_REQUIRED',
    'MISSING_NITROGEN_METRIC',
    'evidence_tier = "FORMAL"',
    'LOW_N_RISK',
    'SUFFICIENT',
    'NEEDS_REVIEW',
  ];

  const requiredSensingRiskRules = [
    'trigger_source === "SENSING_RISK"',
    'SENSING_RISK_REQUIRES_SIGNAL_REFS',
    'evidence_tier = "WARNING"',
    'status = "NEEDS_REVIEW"',
    'SENSING_RISK_CANNOT_BE_LOW_N_RISK',
  ];

  const requiredManualRules = [
    'trigger_source === "MANUAL_AGRONOMIST"',
    'normalizeEvidenceRefs(input.evidence_refs, true)',
    'evidence_tier = "MANUAL_REVIEW"',
    'MANUAL_REVIEW_CANNOT_DIRECTLY_CONFIRM_LOW_N_RISK',
  ];

  const requiredRecommendationRules = [
    'assessment.status === "LOW_N_RISK" && assessment.evidence_tier === "FORMAL"',
    'CUSTOMER_VISIBLE_RECOMMENDATION_REQUIRES_FORMAL_LOW_N_RISK',
    'customer_visible_eligible = requestedCustomerVisible && formalLowN',
  ];

  const requiredPrescriptionRules = [
    'fertilization_recommendation_id',
    'PRESCRIPTION_REQUIRES_CUSTOMER_VISIBLE_RECOMMENDATION',
    'PRESCRIPTION_ZONE_RATES_REQUIRED',
    'PLANNED_N_KG_HA_NEGATIVE',
    'PLANNED_N_KG_HA_EXCEEDS_MAX',
    'manual_approval_required: input.manual_approval_required !== false',
    'status: "READY_FOR_APPROVAL"',
  ];

  const requiredAcceptanceRules = [
    'fertilization_acceptance_v1',
    'zone_applications',
    'zone_results',
    'actual_n_kg_ha',
    'coverage_percent',
    'deviation_percent',
    'ZONE_N_DEVIATION_EXCEEDED',
    'ALL_REQUIRED_ZONES_PASS',
  ];

  const requiredAuthRules = [
    'fields.write',
    'prescription.write',
    'acceptance.evaluate',
    'security.admin',
    'fields.read',
    'prescription.read',
    'acceptance.read',
    'ao_act.index.read',
    'tenantFromBodyOrAuthV1',
    'tenantFromQueryOrAuthV1',
    'requireTenantMatchOr404',
    'NOT_FOUND',
    'requireFieldAllowedOr404V1',
  ];

  assertAll(route, requiredRoutes, 'fertilization route endpoints');
  assertAll(service, requiredFactWrites, 'fertilization service fact writes');
  assertAll(service, requiredSamplingLabRules, 'SAMPLING_LAB rules');
  assertAll(service, requiredSensingRiskRules, 'SENSING_RISK rules');
  assertAll(service, requiredManualRules, 'MANUAL_AGRONOMIST rules');
  assertAll(service, requiredRecommendationRules, 'recommendation rules');
  assertAll(service, requiredPrescriptionRules, 'prescription rules');
  assertAll(service, requiredAcceptanceRules, 'acceptance rules');
  assertAll(route, requiredAuthRules, 'route auth and isolation rules');

  assertAll(register, ['registerFertilizationV1Routes', './v1/fertilization.js'], 'core route registration');

  assertRegex(service, /WHERE \(record_json::jsonb->>'type'\) = 'lab_result_import_v1'[\s\S]*record_json::jsonb->>'sample_id'[\s\S]*record_json::jsonb->>'import_id'/, 'SAMPLING_LAB lab result lookup');
  assertRegex(service, /WHERE \(record_json::jsonb->>'type'\) = 'sampling_acceptance_v1'[\s\S]*UPPER\(COALESCE\(record_json::jsonb->>'verdict', ''\)\) = 'PASS'/, 'SAMPLING_LAB sampling acceptance PASS lookup');
  assertRegex(service, /if \(requestedCustomerVisible && !formalLowN\)/, 'customer-visible recommendation guard');
  assertRegex(service, /if \(recommendation\.customer_visible_eligible !== true\)/, 'prescription requires customer-visible recommendation guard');
  assertRegex(service, /if \(planned_n_kg_ha < 0\)/, 'negative N rate guard');
  assertRegex(service, /planned_n_kg_ha > max_n_kg_ha/, 'max N rate guard');

  console.log('PASS acceptance fertilization api v1', {
    servicePath,
    routePath,
    registerPath,
    requiredRoutes: requiredRoutes.length,
    requiredAuthRules: requiredAuthRules.length,
    samplingLabRules: requiredSamplingLabRules.length,
    sensingRiskRules: requiredSensingRiskRules.length,
    prescriptionRules: requiredPrescriptionRules.length,
  });
})();
