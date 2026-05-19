#!/usr/bin/env node
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');
const { assert, env, fetchJson, requireOk, waitForHealth } = require('./_common.cjs');

const id = (p) => `${p}_${randomUUID().replace(/-/g, '').slice(0, 18)}`;
const q = (v) => encodeURIComponent(String(v ?? ''));
const tokenEnv = (name, fallback) => env(name, env('AO_ACT_TOKEN', fallback));
const repoRoot = path.resolve(__dirname, '..', '..');

async function post(base, urlPath, token, body) {
  return fetchJson(`${base}${urlPath}`, { method: 'POST', token, body });
}

async function get(base, urlPath, token) {
  return fetchJson(`${base}${urlPath}`, { method: 'GET', token });
}

function compact(resp) {
  return { ok: resp?.ok, status: resp?.status, body: resp?.json ?? resp?.text ?? null };
}

function readRepo(rel) {
  const fp = path.join(repoRoot, rel);
  return fs.existsSync(fp) ? fs.readFileSync(fp, 'utf8') : '';
}

async function createSenseTask(base, token, runId, priority = 'HIGH') {
  return requireOk(await post(base, '/api/v1/sense/task', token, {
    subjectRef: { projectId: 'projectA', groupId: 'groupA' },
    window: { startTs: Date.now() - 60000, endTs: Date.now() + 3600000 },
    sense_kind: 'inspection',
    sense_focus: 'pest_disease_scouting',
    priority,
    supporting_problem_state_id: `ps_${runId}`,
    supporting_determinism_hash: `det_${runId}`,
    supporting_effective_config_hash: `cfg_${runId}`,
  }), 'AO-SENSE inspection task');
}

async function createInspectionRequest(base, token, scope, field_id, inspection_id, trigger_source = 'MANUAL_SCOUT', requested_target = 'PEST', zone_id = null) {
  return requireOk(await post(base, '/api/v1/inspection/pest-disease/request', token, {
    ...scope,
    inspection_id,
    field_id,
    zone_id,
    trigger_source,
    requested_target,
    crop_code: 'corn',
    crop_stage: 'V8',
    priority: 'HIGH',
    evidence_refs: [],
    reasons: ['formal_pest_disease_e2e'],
  }), 'pest disease inspection request');
}

async function createObservation(base, token, scope, payload) {
  return requireOk(await post(base, '/api/v1/inspection/pest-disease/observation', token, {
    ...scope,
    ...payload,
  }), 'pest disease observation');
}

async function createSenseReceipt(base, token, task_id, observation_fact_id) {
  return requireOk(await post(base, '/api/v1/sense/receipt', token, {
    task_id,
    executed_at_ts: Date.now(),
    result: 'success',
    evidence_refs: [{ kind: 'fact_id', ref_id: observation_fact_id }],
  }), 'AO-SENSE receipt with observation fact_id');
}

async function createSignal(base, token, scope, payload) {
  return requireOk(await post(base, '/api/v1/inspection/pest-disease/signal', token, {
    ...scope,
    ...payload,
  }), 'pest disease signal');
}

async function createAssessmentRaw(base, token, scope, payload) {
  return post(base, '/api/v1/inspection/pest-disease/assessment', token, { ...scope, ...payload });
}

async function createAssessment(base, token, scope, payload, label = 'pest disease assessment') {
  return requireOk(await createAssessmentRaw(base, token, scope, payload), label);
}

async function createReview(base, token, scope, payload) {
  return requireOk(await post(base, '/api/v1/inspection/pest-disease/review', token, { ...scope, ...payload }), 'pest disease review');
}

async function evaluateAcceptance(base, token, payload) {
  return requireOk(await post(base, '/api/v1/inspection/pest-disease/acceptance/evaluate', token, payload), 'pest disease inspection acceptance');
}

async function createReceiptWithoutObservation(base, token, runId) {
  const task = await createSenseTask(base, token, runId, 'NORMAL');
  return requireOk(await post(base, '/api/v1/sense/receipt', token, {
    task_id: task.task_id,
    executed_at_ts: Date.now(),
    result: 'success',
    evidence_refs: [{ kind: 'fact_id', ref_id: `missing_observation_${runId}` }],
  }), 'AO-SENSE receipt without observation');
}

async function queryFactsByInspection(pool, inspection_id) {
  const res = await pool.query(
    `SELECT fact_id, record_json::jsonb AS r
       FROM facts
      WHERE (record_json::jsonb->>'inspection_id') = $1
      ORDER BY occurred_at ASC, fact_id ASC`,
    [inspection_id],
  ).catch(() => ({ rows: [] }));
  return res.rows ?? [];
}

async function forbiddenSideEffects(pool, inspection_id) {
  const facts = await queryFactsByInspection(pool, inspection_id);
  const text = JSON.stringify(facts.map((x) => x.r));
  return {
    spray_prescription: /spray_prescription/i.test(text),
    ao_act_task: /ao_act_task/i.test(text),
    roi_ledger: /roi_ledger/i.test(text),
    field_memory: /field_memory/i.test(text),
  };
}

function reportProjectionSupportsPestDiseaseInspection() {
  const reportRoute = readRepo('apps/server/src/routes/reports_v1.ts');
  const reportProjection = readRepo('apps/server/src/projections/report_v1.ts');
  const customerLabels = readRepo('apps/web/src/lib/customerScenarioLabels.ts');
  return [reportRoute, reportProjection, customerLabels].some((x) => x.includes('FORMAL_PEST_DISEASE_INSPECTION'));
}

async function run() {
  const base = env('BASE_URL', process.env.GEOX_BASE_URL || 'http://127.0.0.1:3001');
  const adminToken = tokenEnv('ADMIN_TOKEN', 'admin_token');
  const operatorToken = tokenEnv('OPERATOR_TOKEN', 'operator_token');
  const pool = new Pool({ connectionString: env('DATABASE_URL', 'postgres://postgres:postgres@127.0.0.1:5432/geox') });
  const scope = { tenant_id: env('TENANT_ID', 'tenantA'), project_id: env('PROJECT_ID', 'projectA'), group_id: env('GROUP_ID', 'groupA') };
  const runId = id('formal_pdi');
  const field_id = `field_${runId}`;

  const checks = {
    ao_sense_inspection_task_created: false,
    observation_has_media_geo_time: false,
    ao_sense_receipt_refs_observation_fact: false,
    skill_signal_only_not_confirmed: false,
    low_confidence_requires_review: false,
    human_review_approved: false,
    inspection_acceptance_pass: false,
    acceptance_pass_does_not_create_spray_prescription: false,
    acceptance_pass_does_not_create_ao_act_task: false,
    operation_report_formal_pest_disease_inspection: false,
  };

  const negative = {
    ao_sense_receipt_success_no_observation_not_confirmed: false,
    image_without_geo_customer_visible_false: false,
    image_without_captured_at_blocked: false,
    skill_signal_only_needs_review_not_confirmed: false,
    confidence_low_review_required: false,
    review_not_approved_customer_visible_false: false,
    acceptance_pass_does_not_create_roi_or_field_memory: false,
  };

  const debug = { runId, field_id, current_gaps: [] };

  try {
    await waitForHealth(base);

    const inspection_id = `inspection_${runId}`;
    await createInspectionRequest(base, adminToken, scope, field_id, inspection_id, 'MANUAL_SCOUT', 'PEST');
    const senseTask = await createSenseTask(base, adminToken, runId);
    checks.ao_sense_inspection_task_created = Boolean(senseTask.task_id);

    const observation = await createObservation(base, adminToken, scope, {
      observation_id: `obs_${runId}`,
      inspection_id,
      field_id,
      captured_at_ts: Date.now(),
      geo_point: { lat: 35.11, lng: -120.22 },
      device_profile: { device_model: 'PHONE_CAMERA', device_type: 'PHONE', capabilities: ['rgb_photo', 'manual_scout'] },
      media_refs: [{ kind: 'IMAGE', ref_id: `leaf_image_${runId}`, checksum: `sha256_${runId}` }],
      scout_note: 'Manual scout observed clustered leaf damage and insects on lower canopy.',
      crop_stage: 'V8',
      plant_part: 'LEAF',
      target_type: 'PEST',
      suspected_issue_code: 'aphid_suspected',
      pest_count: 7,
      incidence_percent: 12,
      severity_percent: 18,
      affected_area_percent: 4,
      evidence_quality: 'COMPLETE',
      evidence_refs: [],
    });
    checks.observation_has_media_geo_time = observation.record?.type === 'pest_disease_observation_v1'
      && Array.isArray(observation.record?.media_refs)
      && observation.record.media_refs.length > 0
      && Boolean(observation.record?.geo_point)
      && Number(observation.record?.captured_at_ts) > 0
      && Boolean(observation.record?.scout_note)
      && observation.record?.severity_percent != null;

    const senseReceipt = await createSenseReceipt(base, adminToken, senseTask.task_id, observation.fact_id);
    checks.ao_sense_receipt_refs_observation_fact = Array.isArray(senseReceipt.record_json?.evidence_refs ?? senseReceipt.record?.evidence_refs)
      ? (senseReceipt.record_json?.evidence_refs ?? senseReceipt.record?.evidence_refs).some((x) => x.kind === 'fact_id' && x.ref_id === observation.fact_id)
      : senseReceipt.fact_id && Boolean(observation.fact_id);

    const signal = await createSignal(base, adminToken, scope, {
      signal_id: `signal_${runId}`,
      inspection_id,
      observation_id: observation.observation_id,
      field_id,
      skill_id: 'pest_scout_signal_v1',
      skill_run_id: `skillrun_${runId}`,
      skill_trace_id: `trace_${runId}`,
      signal_type: 'PEST_SIGNAL',
      candidate_issue_code: 'aphid_suspected',
      confidence: 'MEDIUM',
      reason_codes: ['IMAGE_PATTERN_AND_SCOUT_NOTE'],
      missing_inputs: [],
      uncertainty_notes: ['Requires agronomist review before customer-visible confirmation.'],
      evidence_refs: [{ kind: 'fact_id', ref_id: observation.fact_id }],
    });

    const assessment_id = `assessment_${runId}`;
    const assessment = await createAssessment(base, adminToken, scope, {
      assessment_id,
      inspection_id,
      field_id,
      target_type: 'PEST',
      suspected_issue_code: 'aphid_suspected',
      assessment_status: 'CONFIRMED',
      severity: 'MEDIUM',
      confidence: 'MEDIUM',
      evidence_tier: 'FORMAL',
      review_required: true,
      customer_visible_eligible: true,
      observation_refs: [observation.observation_id],
      skill_signal_refs: [{ skill_id: 'pest_scout_signal_v1', skill_run_id: signal.record?.skill_run_id, signal_id: signal.signal_id }],
      evidence_refs: [{ kind: 'fact_id', ref_id: observation.fact_id }],
      reasons: ['manual_scout_evidence_complete'],
    });
    assert.equal(assessment.record.assessment_status, 'CONFIRMED');
    assert.equal(assessment.record.review_required, true);
    assert.equal(assessment.record.customer_visible_eligible, false, 'confirmed review-required assessment must not be customer visible before approved review');

    const review = await createReview(base, adminToken, scope, {
      review_id: `review_${runId}`,
      inspection_id,
      assessment_id,
      field_id,
      review_status: 'APPROVED',
      reviewer_actor_id: 'formal_pdi_reviewer',
      reviewed_at_ts: Date.now(),
      review_note: 'Formal review approved the inspection evidence chain.',
      evidence_refs: [{ kind: 'fact_id', ref_id: assessment.fact_id }],
    });
    checks.human_review_approved = review.record?.review_status === 'APPROVED';

    const acceptance = await evaluateAcceptance(base, operatorToken, {
      assessment_id,
      evidence_refs: [{ kind: 'fact_id', ref_id: observation.fact_id }, { kind: 'fact_id', ref_id: review.fact_id }],
      reasons: ['formal_inspection_evidence_chain_complete'],
    });
    checks.inspection_acceptance_pass = acceptance.record?.verdict === 'PASS'
      && acceptance.record?.evidence_complete === true
      && acceptance.record?.geo_evidence_present === true
      && acceptance.record?.media_evidence_present === true
      && acceptance.record?.human_review_satisfied === true;

    const sideEffects = await forbiddenSideEffects(pool, inspection_id);
    checks.acceptance_pass_does_not_create_spray_prescription = sideEffects.spray_prescription === false;
    checks.acceptance_pass_does_not_create_ao_act_task = sideEffects.ao_act_task === false;
    negative.acceptance_pass_does_not_create_roi_or_field_memory = sideEffects.roi_ledger === false && sideEffects.field_memory === false;

    const droneInspectionId = `inspection_drone_${runId}`;
    await createInspectionRequest(base, adminToken, scope, field_id, droneInspectionId, 'DRONE_IMAGE', 'DISEASE', 'zone_drone_a');
    const droneObservation = await createObservation(base, adminToken, scope, {
      observation_id: `obs_drone_${runId}`,
      inspection_id: droneInspectionId,
      field_id,
      zone_id: 'zone_drone_a',
      captured_at_ts: Date.now(),
      geo_point: { lat: 35.12, lng: -120.21 },
      device_profile: { device_model: 'DJI_MAVIC_3M', device_type: 'UAV_MULTISPECTRAL', capabilities: ['multispectral_map', 'rgb_photo'] },
      media_refs: [{ kind: 'MULTISPECTRAL_MAP', ref_id: `ms_map_${runId}` }],
      plant_part: 'CANOPY',
      target_type: 'DISEASE',
      suspected_issue_code: 'foliar_disease_suspected',
      severity_percent: 9,
      affected_area_percent: 6,
      evidence_quality: 'COMPLETE',
      evidence_refs: [],
    });
    const droneAssessment = await createAssessment(base, adminToken, scope, {
      assessment_id: `assessment_drone_${runId}`,
      inspection_id: droneInspectionId,
      field_id,
      zone_id: 'zone_drone_a',
      target_type: 'DISEASE',
      suspected_issue_code: 'foliar_disease_suspected',
      assessment_status: 'SUSPECTED',
      severity: 'LOW',
      confidence: 'LOW',
      evidence_tier: 'TECHNICAL',
      review_required: false,
      customer_visible_eligible: true,
      observation_refs: [droneObservation.observation_id],
      skill_signal_refs: [],
      evidence_refs: [{ kind: 'fact_id', ref_id: droneObservation.fact_id }],
      reasons: ['uav_multispectral_suspected_stress'],
    }, 'drone pest disease assessment');
    checks.low_confidence_requires_review = droneAssessment.record?.confidence === 'LOW' && droneAssessment.record?.review_required === true;
    negative.confidence_low_review_required = checks.low_confidence_requires_review;

    const noObsInspectionId = `inspection_noobs_${runId}`;
    await createInspectionRequest(base, adminToken, scope, field_id, noObsInspectionId, 'AO_SENSE', 'PEST');
    await createReceiptWithoutObservation(base, adminToken, `noobs_${runId}`);
    const noObsConfirm = await createAssessmentRaw(base, adminToken, scope, {
      assessment_id: `assessment_noobs_${runId}`,
      inspection_id: noObsInspectionId,
      field_id,
      target_type: 'PEST',
      assessment_status: 'CONFIRMED',
      severity: 'MEDIUM',
      confidence: 'HIGH',
      evidence_tier: 'TECHNICAL',
      review_required: false,
      customer_visible_eligible: true,
      observation_refs: [],
      skill_signal_refs: [],
      evidence_refs: [],
    });
    negative.ao_sense_receipt_success_no_observation_not_confirmed = noObsConfirm.status >= 400 || noObsConfirm.json?.ok === false;

    const missingGeoInspectionId = `inspection_missing_geo_${runId}`;
    await createInspectionRequest(base, adminToken, scope, field_id, missingGeoInspectionId, 'MANUAL_SCOUT', 'DISEASE');
    const missingGeoObs = await createObservation(base, adminToken, scope, {
      observation_id: `obs_missing_geo_${runId}`,
      inspection_id: missingGeoInspectionId,
      field_id,
      captured_at_ts: Date.now(),
      device_profile: { device_model: 'PHONE_CAMERA', device_type: 'PHONE', capabilities: ['rgb_photo'] },
      media_refs: [{ kind: 'IMAGE', ref_id: `img_missing_geo_${runId}` }],
      plant_part: 'LEAF',
      target_type: 'DISEASE',
      evidence_quality: 'COMPLETE',
      evidence_refs: [],
    });
    const missingGeoAssessment = await createAssessment(base, adminToken, scope, {
      assessment_id: `assessment_missing_geo_${runId}`,
      inspection_id: missingGeoInspectionId,
      field_id,
      target_type: 'DISEASE',
      assessment_status: 'SUSPECTED',
      severity: 'LOW',
      confidence: 'MEDIUM',
      evidence_tier: 'TECHNICAL',
      review_required: false,
      customer_visible_eligible: true,
      observation_refs: [missingGeoObs.observation_id],
      skill_signal_refs: [],
      evidence_refs: [{ kind: 'fact_id', ref_id: missingGeoObs.fact_id }],
    }, 'missing geo assessment');
    negative.image_without_geo_customer_visible_false = missingGeoAssessment.record?.customer_visible_eligible === false;

    const missingTimeResp = await post(base, '/api/v1/inspection/pest-disease/observation', adminToken, {
      ...scope,
      observation_id: `obs_missing_time_${runId}`,
      inspection_id: `inspection_missing_time_${runId}`,
      field_id,
      geo_point: { lat: 35.13, lng: -120.23 },
      device_profile: { device_model: 'PHONE_CAMERA', device_type: 'PHONE', capabilities: ['rgb_photo'] },
      media_refs: [{ kind: 'IMAGE', ref_id: `img_missing_time_${runId}` }],
      plant_part: 'LEAF',
      target_type: 'PEST',
      evidence_quality: 'COMPLETE',
    });
    negative.image_without_captured_at_blocked = missingTimeResp.status >= 400 || missingTimeResp.json?.ok === false;

    const signalOnlyInspectionId = `inspection_signal_only_${runId}`;
    await createInspectionRequest(base, adminToken, scope, field_id, signalOnlyInspectionId, 'SENSING_RISK', 'PEST');
    const signalOnly = await createSignal(base, adminToken, scope, {
      signal_id: `signal_only_${runId}`,
      inspection_id: signalOnlyInspectionId,
      field_id,
      skill_id: 'pest_signal_only_v1',
      skill_run_id: `skillrun_only_${runId}`,
      signal_type: 'PEST_SIGNAL',
      confidence: 'HIGH',
      reason_codes: ['MODEL_ONLY'],
      missing_inputs: ['observation_media', 'geo_point'],
      uncertainty_notes: ['No formal observation evidence.'],
      evidence_refs: [],
    });
    const signalOnlyConfirmed = await createAssessmentRaw(base, adminToken, scope, {
      assessment_id: `assessment_signal_confirmed_${runId}`,
      inspection_id: signalOnlyInspectionId,
      field_id,
      target_type: 'PEST',
      assessment_status: 'CONFIRMED',
      severity: 'MEDIUM',
      confidence: 'HIGH',
      evidence_tier: 'WARNING',
      review_required: false,
      customer_visible_eligible: true,
      observation_refs: [],
      skill_signal_refs: [{ skill_id: 'pest_signal_only_v1', skill_run_id: signalOnly.record?.skill_run_id, signal_id: signalOnly.signal_id }],
      evidence_refs: [],
    });
    const signalOnlyNeedsReview = await createAssessment(base, adminToken, scope, {
      assessment_id: `assessment_signal_review_${runId}`,
      inspection_id: signalOnlyInspectionId,
      field_id,
      target_type: 'PEST',
      assessment_status: 'NEEDS_REVIEW',
      severity: 'NEEDS_REVIEW',
      confidence: 'LOW',
      evidence_tier: 'WARNING',
      review_required: false,
      customer_visible_eligible: true,
      observation_refs: [],
      skill_signal_refs: [{ skill_id: 'pest_signal_only_v1', skill_run_id: signalOnly.record?.skill_run_id, signal_id: signalOnly.signal_id }],
      evidence_refs: [],
    }, 'skill signal only needs review assessment');
    negative.skill_signal_only_needs_review_not_confirmed = (signalOnlyConfirmed.status >= 400 || signalOnlyConfirmed.json?.ok === false)
      && signalOnlyNeedsReview.record?.assessment_status === 'NEEDS_REVIEW'
      && signalOnlyNeedsReview.record?.review_required === true;
    checks.skill_signal_only_not_confirmed = negative.skill_signal_only_needs_review_not_confirmed;

    const pendingReviewAssessment = await createAssessment(base, adminToken, scope, {
      assessment_id: `assessment_pending_review_${runId}`,
      inspection_id,
      field_id,
      target_type: 'PEST',
      assessment_status: 'CONFIRMED',
      severity: 'MEDIUM',
      confidence: 'HIGH',
      evidence_tier: 'FORMAL',
      review_required: true,
      customer_visible_eligible: true,
      observation_refs: [observation.observation_id],
      skill_signal_refs: [],
      evidence_refs: [{ kind: 'fact_id', ref_id: observation.fact_id }],
    }, 'pending review assessment');
    negative.review_not_approved_customer_visible_false = pendingReviewAssessment.record?.customer_visible_eligible === false;

    checks.operation_report_formal_pest_disease_inspection = reportProjectionSupportsPestDiseaseInspection();
    if (!checks.operation_report_formal_pest_disease_inspection) {
      debug.current_gaps.push({
        code: 'REPORT_PROJECTION_MISSING_FORMAL_PEST_DISEASE_INSPECTION',
        detail: 'Current report/customer projection does not yet expose FORMAL_PEST_DISEASE_INSPECTION; this is expected to be closed by the report projection/customer labels PR.',
      });
    }

    const allChecks = { ...checks, ...negative };
    console.log(JSON.stringify({ checks, negative, debug }, null, 2));
    const failed = Object.entries(allChecks).filter(([, value]) => value !== true).map(([key]) => key);
    assert.deepEqual(failed, [], `formal pest disease inspection E2E failed checks: ${failed.join(', ')}`);
  } finally {
    await pool.end().catch(() => undefined);
  }
}

run().catch((err) => {
  console.error(err?.stack || err);
  process.exit(1);
});
