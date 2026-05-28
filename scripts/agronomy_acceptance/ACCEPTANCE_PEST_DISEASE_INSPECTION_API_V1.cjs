#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..', '..');
const registerCore = path.join(root, 'apps/server/src/routes/registerCoreV1Routes.ts');
const routeFile = path.join(root, 'apps/server/src/routes/v1/inspection.ts');
const serviceFile = path.join(root, 'apps/server/src/services/inspection/pest_disease_inspection_service_v1.ts');
const contractFile = path.join(root, 'apps/server/src/domain/inspection/pest_disease_inspection_contract_v1.ts');

function read(file) {
  assert.equal(fs.existsSync(file), true, `missing required file: ${file}`);
  return fs.readFileSync(file, 'utf8');
}

function assertAll(text, required, label) {
  const missing = required.filter((x) => !text.includes(x));
  assert.deepEqual(missing, [], `${label} missing required entries: ${missing.join(', ')}`);
}

(function main() {
  const register = read(registerCore);
  const route = read(routeFile);
  const service = read(serviceFile);
  const contract = read(contractFile);

  assertAll(register, [
    'import { registerInspectionV1Routes } from "./v1/inspection.js";',
    'registerInspectionV1Routes(app, pool);',
    'registerAoActV1PrimaryRoutes(app, pool);',
    'registerApprovalsV1PrimaryRoutes(app, pool);',
    'registerDevicesV1PrimaryCompatibilityRoutes(app, pool);',
    'registerSenseV1PrimaryRoutes(app, pool);',
    'registerSamplingV1Routes(app, pool);',
    'registerFertilizationV1Routes(app, pool);',
  ], 'registerCoreV1Routes.ts');

  const endpointStrings = [
    '/api/v1/inspection/pest-disease/request',
    '/api/v1/inspection/pest-disease/observation',
    '/api/v1/inspection/pest-disease/signal',
    '/api/v1/inspection/pest-disease/assessment',
    '/api/v1/inspection/pest-disease/review',
    '/api/v1/inspection/pest-disease/acceptance/evaluate',
    '/api/v1/inspection/pest-disease/:inspection_id',
  ];
  assertAll(route, endpointStrings, 'inspection route endpoints');

  assertAll(route, [
    'requireAoActAnyScopeV0',
    'inspection.write',
    'inspection.read',
    'security.admin',
    'acceptance.evaluate',
    'registerInspectionV1Routes',
  ], 'inspection route auth and registration');
  for (const legacyScope of ['fields.write', 'fields.read', 'ao_act.index.read']) {
    assert.equal(route.includes(legacyScope), false, `PDI route must not use legacy field/AO-ACT scope as inspection auth: ${legacyScope}`);
  }

  const serviceFunctions = [
    'createPestDiseaseInspectionRequestV1',
    'createPestDiseaseObservationV1',
    'createPestDiseaseSignalV1',
    'createPestDiseaseInspectionAssessmentV1',
    'createPestDiseaseInspectionReviewV1',
    'evaluatePestDiseaseInspectionAcceptanceV1',
    'getPestDiseaseInspectionV1',
  ];
  assertAll(service, serviceFunctions, 'inspection service functions');

  const factTypes = [
    'pest_disease_inspection_request_v1',
    'pest_disease_observation_v1',
    'pest_disease_signal_v1',
    'pest_disease_inspection_assessment_v1',
    'pest_disease_inspection_review_v1',
    'pest_disease_inspection_acceptance_v1',
  ];
  assertAll(service, factTypes, 'inspection service fact writes');
  assertAll(contract, factTypes, 'inspection contract fact types');

  assertAll(service, [
    'trigger_source',
    'requested_target',
    'target_type',
    'MISSING_MEDIA',
    'MISSING_GEO',
    'device_profile.device_model',
    'MISSING_SKILL_ID_OR_SKILL_RUN_ID',
    'SKILL_SIGNAL_ONLY_CANNOT_CONFIRM',
    'missing:captured_at_ts',
    'missing:geo_evidence',
    'missing:media_evidence',
    'missing:approved_review',
    'inspection_acceptance_pass_means_evidence_chain_complete_not_spray',
  ], 'inspection service business rules');

  assert.equal(
    service.includes('`MISSING_OR_INVALID:${field}`'),
    true,
    'service must generate MISSING_OR_INVALID field-specific errors',
  );
  assertAll(service, [
    'mustText(body?.tenant_id, "tenant_id")',
    'mustText(body?.project_id, "project_id")',
    'mustText(body?.group_id, "group_id")',
    'mustText(body?.field_id, "field_id")',
    'mustText(body?.inspection_id, "inspection_id")',
    'intMs(body?.captured_at_ts, "captured_at_ts")',
  ], 'inspection service required field validation calls');

  assert.equal(service.includes('INSERT INTO facts'), true, 'service must write append-only facts');
  assert.equal(service.includes('SELECT fact_id, occurred_at, source, record_json::jsonb AS record_json'), true, 'service must read facts');
  assert.equal(service.includes('pest_disease_signal_v1') && !service.includes('confidence=HIGH 直接转 CONFIRMED'), true, 'signal must remain technical signal only');

  const forbiddenRouteRegistrations = [
    '/api/control/inspection',
    '/api/devices/inspection',
  ];
  for (const forbidden of forbiddenRouteRegistrations) {
    assert.equal(route.includes(forbidden), false, `legacy or non-v1 route must not be registered: ${forbidden}`);
  }

  console.log('PASS acceptance pest disease inspection API v1', {
    registerCore,
    routeFile,
    serviceFile,
    endpoints: endpointStrings.length,
    serviceFunctions: serviceFunctions.length,
    factTypes: factTypes.length,
    readWriteScopes: ['inspection.read', 'inspection.write'],
  });
})();
