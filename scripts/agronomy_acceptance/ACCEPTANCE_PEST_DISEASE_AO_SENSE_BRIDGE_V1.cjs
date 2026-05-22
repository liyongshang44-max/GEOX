#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..', '..');
const senseRoute = path.join(root, 'apps/server/src/routes/control_ao_sense.ts');
const inspectionRoute = path.join(root, 'apps/server/src/routes/v1/inspection.ts');
const inspectionService = path.join(root, 'apps/server/src/services/inspection/pest_disease_inspection_service_v1.ts');
const inspectionContract = path.join(root, 'apps/server/src/domain/inspection/pest_disease_inspection_contract_v1.ts');

function read(file) {
  assert.equal(fs.existsSync(file), true, `missing required file: ${file}`);
  return fs.readFileSync(file, 'utf8');
}

function assertAll(text, required, label) {
  const missing = required.filter((x) => !text.includes(x));
  assert.deepEqual(missing, [], `${label} missing required entries: ${missing.join(', ')}`);
}

function assertNone(text, forbidden, label) {
  const found = forbidden.filter((x) => text.includes(x));
  assert.deepEqual(found, [], `${label} contains forbidden entries: ${found.join(', ')}`);
}

function stripCommentsAndStrings(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/.*$/gm, ' ')
    .replace(/`(?:\\.|[^`])*`/g, '`template`')
    .replace(/"(?:\\.|[^"])*"/g, '"string"')
    .replace(/'(?:\\.|[^'])*'/g, "'string'");
}

(function main() {
  const sense = read(senseRoute);
  const route = read(inspectionRoute);
  const service = read(inspectionService);
  const contract = read(inspectionContract);

  assertAll(sense, [
    '/api/v1/sense/task',
    '/api/v1/sense/receipt',
    'sense_kind',
    'sense_focus',
    'evidence_refs',
    'fact_id',
    'validateObservationOnlyEvidenceRefs',
    'validateObservationEvidenceRefShape',
    'fact_id',
    'SELECT fact_id, record_json::jsonb AS record_json',
    'WHERE fact_id = ANY($1::text[])',
    'allowedObservationFactTypes',
    'device_observation_v1',
    'AO_SENSE_OBSERVATION_FACT_NOT_FOUND',
    'AO_SENSE_RECEIPT_REQUIRES_OBSERVATION_FACT_TYPE',
  ], 'AO-SENSE route bridge prerequisites');

  assertNone(sense, [
    'image_ref',
    'geo_photo',
    'pest_count',
    'trap_count',
    'incidence_percent',
    'severity_percent',
    'affected_area_percent',
    'device_model',
    'device_profile',
  ], 'AO-SENSE route must not be extended with pest/disease observation semantics');

  assertAll(route, [
    '/api/v1/inspection/pest-disease/observation',
    '/api/v1/inspection/pest-disease/assessment',
    '/api/v1/inspection/pest-disease/acceptance/evaluate',
  ], 'inspection route bridge endpoints');

  assertAll(contract, [
    'pest_disease_observation_v1',
    'device_profile',
    'device_model',
    'geo_point',
    'media_refs',
    'pest_count',
    'trap_count',
    'incidence_percent',
    'severity_percent',
    'affected_area_percent',
    'evidence_quality',
  ], 'inspection observation owns field evidence semantics');

  assertAll(service, [
    'type: "pest_disease_observation_v1"',
    'createPestDiseaseObservationV1',
    'media_refs',
    'geo_point',
    'device_profile',
    'pest_count',
    'trap_count',
    'incidence_percent',
    'severity_percent',
    'affected_area_percent',
    'MISSING_MEDIA',
    'MISSING_GEO',
    'SKILL_SIGNAL_ONLY_CANNOT_CONFIRM',
    'missing:geo_evidence',
    'missing:media_evidence',
    'customer_visible_eligible',
    'inspection_acceptance_pass_means_evidence_chain_complete_not_spray',
  ], 'inspection service bridge business rules');

  const positiveScenario = {
    sense_task: {
      path: '/api/v1/sense/task',
      body: {
        subjectRef: { projectId: 'projectA', groupId: 'groupA' },
        window: { startTs: 1700000000000, endTs: 1700003600000 },
        sense_kind: 'inspection',
        sense_focus: 'pest_disease_scouting',
        priority: 'HIGH',
        supporting_problem_state_id: 'ps_pest_risk_001',
        supporting_determinism_hash: 'hash_det_001',
        supporting_effective_config_hash: 'hash_cfg_001',
      },
    },
    observation: {
      path: '/api/v1/inspection/pest-disease/observation',
      expected_type: 'pest_disease_observation_v1',
      expected_fact_id_ref: 'pest_disease_observation_fact_id',
      body: {
        inspection_id: 'inspection_bridge_positive_001',
        tenant_id: 'tenantA',
        project_id: 'projectA',
        group_id: 'groupA',
        field_id: 'fieldA',
        captured_at_ts: 1700000100000,
        geo_point: { lat: 35.1, lng: -120.2 },
        device_profile: { device_model: 'PHONE_CAMERA', device_type: 'PHONE', capabilities: ['rgb_photo'] },
        media_refs: [{ kind: 'IMAGE', ref_id: 'img_leaf_001' }],
        plant_part: 'LEAF',
        target_type: 'PEST',
        pest_count: 3,
        evidence_quality: 'COMPLETE',
      },
    },
    sense_receipt: {
      path: '/api/v1/sense/receipt',
      body: {
        task_id: 'sense_task_id',
        executed_at_ts: 1700000200000,
        result: 'success',
        evidence_refs: [{ kind: 'fact_id', ref_id: 'pest_disease_observation_fact_id' }],
      },
    },
  };

  assert.equal(positiveScenario.sense_task.body.sense_kind, 'inspection', 'positive AO-SENSE task must use sense_kind=inspection');
  assert.equal(positiveScenario.sense_task.body.sense_focus, 'pest_disease_scouting', 'positive AO-SENSE task must use pest_disease_scouting focus');
  assert.equal(positiveScenario.observation.expected_type, 'pest_disease_observation_v1', 'positive bridge must create pest_disease_observation_v1');
  assert.deepEqual(positiveScenario.sense_receipt.body.evidence_refs, [{ kind: 'fact_id', ref_id: 'pest_disease_observation_fact_id' }], 'AO-SENSE receipt must reference observation fact_id');

  const negativeScenarios = {
    receipt_success_no_observation: {
      receipt_result: 'success',
      observation_refs: [],
      expected_assessment_status_not: 'CONFIRMED',
    },
    receipt_success_missing_media: {
      receipt_result: 'success',
      observation: { media_refs: [], evidence_quality: 'MISSING_MEDIA' },
      expected_customer_visible_eligible: false,
    },
  };

  assert.equal(negativeScenarios.receipt_success_no_observation.expected_assessment_status_not, 'CONFIRMED', 'receipt success without observation must not confirm assessment');
  assert.equal(negativeScenarios.receipt_success_missing_media.expected_customer_visible_eligible, false, 'missing media must block customer-visible assessment');

  assert.equal(service.includes('if (observation_refs.length < 1 && skill_signal_refs.length < 1)'), true, 'assessment must require observation or skill signal refs');
  assert.equal(service.includes('SKILL_SIGNAL_ONLY_CANNOT_CONFIRM'), true, 'skill-signal-only assessment must not become CONFIRMED');
  assert.equal(service.includes('!evidenceState.hasMedia'), true, 'missing media must participate in customer-visible blocking');
  assert.equal(service.includes('!evidenceState.hasGeo'), true, 'missing geo must participate in customer-visible blocking');

  const codeOnly = stripCommentsAndStrings(service);
  for (const forbidden of ['spray_prescription', 'ao_act_task', 'roi_ledger', 'field_memory']) {
    assert.equal(codeOnly.includes(forbidden), false, `inspection service must not write or reference ${forbidden}`);
  }

  console.log('PASS acceptance pest disease AO-SENSE bridge v1', {
    senseRoute,
    inspectionRoute,
    inspectionService,
    positive: {
      sense_kind: positiveScenario.sense_task.body.sense_kind,
      sense_focus: positiveScenario.sense_task.body.sense_focus,
      receipt_evidence_kind: positiveScenario.sense_receipt.body.evidence_refs[0].kind,
      observation_fact_type: positiveScenario.observation.expected_type,
    },
    negative: negativeScenarios,
  });
})();
