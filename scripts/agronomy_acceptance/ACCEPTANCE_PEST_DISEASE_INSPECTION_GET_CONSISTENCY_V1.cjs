#!/usr/bin/env node
const { randomUUID } = require('node:crypto');
const { assert, env, fetchJson, requireOk, waitForHealth } = require('./_common.cjs');

const id = (p) => `${p}_${randomUUID().replace(/-/g, '').slice(0, 18)}`;
const q = (v) => encodeURIComponent(String(v ?? ''));
const base = env('BASE_URL', process.env.API_BASE_URL || 'http://127.0.0.1:3001');
const adminToken = env('ADMIN_TOKEN', 'admin_token');
const scope = {
  tenant_id: env('TENANT_ID', 'tenantA'),
  project_id: env('PROJECT_ID', 'projectA'),
  group_id: env('GROUP_ID', 'groupA'),
};

async function post(path, body) { return fetchJson(`${base}${path}`, { method: 'POST', token: adminToken, body }); }
async function get(path) { return fetchJson(`${base}${path}`, { method: 'GET', token: adminToken }); }
function withScope(body) { return { ...scope, ...body }; }

async function createChain(runId, reviewStatus = null) {
  await requireOk(await post('/api/v1/inspection/pest-disease/request', withScope({
    inspection_id: `inspection_${runId}`,
    field_id: `field_${runId}`,
    trigger_source: 'MANUAL_SCOUT',
    requested_target: 'PEST',
    priority: 'HIGH',
    evidence_refs: [],
    reasons: ['get_consistency_gate'],
  })), 'request');
  const observation = await requireOk(await post('/api/v1/inspection/pest-disease/observation', withScope({
    observation_id: `obs_${runId}`,
    inspection_id: `inspection_${runId}`,
    field_id: `field_${runId}`,
    captured_at_ts: Date.now(),
    geo_point: { lat: 35.18, lng: -120.31 },
    device_profile: { device_model: 'PHONE_CAMERA', device_type: 'PHONE', capabilities: ['rgb_photo'] },
    media_refs: [{ kind: 'IMAGE', ref_id: `img_${runId}` }],
    scout_note: 'GET consistency gate observation.',
    plant_part: 'LEAF',
    target_type: 'PEST',
    evidence_quality: 'COMPLETE',
    evidence_refs: [],
  })), 'observation');
  const assessment = await requireOk(await post('/api/v1/inspection/pest-disease/assessment', withScope({
    assessment_id: `assessment_${runId}`,
    inspection_id: `inspection_${runId}`,
    field_id: `field_${runId}`,
    target_type: 'PEST',
    suspected_issue_code: 'aphid_suspected',
    assessment_status: 'CONFIRMED',
    severity: 'MEDIUM',
    confidence: 'HIGH',
    evidence_tier: 'FORMAL',
    review_required: true,
    customer_visible_eligible: true,
    observation_refs: [observation.observation_id],
    skill_signal_refs: [],
    evidence_refs: [{ kind: 'fact_id', ref_id: observation.fact_id }],
    reasons: ['complete_observation_requires_human_review'],
  })), 'assessment');
  assert.equal(assessment.record.customer_visible_eligible, false, 'assessment fact must be false before approved review');
  if (reviewStatus) {
    await requireOk(await post('/api/v1/inspection/pest-disease/review', withScope({
      review_id: `review_${runId}`,
      inspection_id: `inspection_${runId}`,
      assessment_id: assessment.assessment_id,
      field_id: `field_${runId}`,
      review_status: reviewStatus,
      reviewer_actor_id: 'get_consistency_reviewer',
      reviewed_at_ts: Date.now(),
      review_note: `GET consistency ${reviewStatus}`,
      evidence_refs: [{ kind: 'fact_id', ref_id: assessment.fact_id }],
    })), `review ${reviewStatus}`);
  }
  return { observation, assessment };
}

async function getInspection(runId) {
  return requireOk(await get(`/api/v1/inspection/pest-disease/${q(`inspection_${runId}`)}`), 'GET inspection');
}

(async function main() {
  await waitForHealth(base);
  const passRun = id('get_consistency_pass');
  const passChain = await createChain(passRun);
  const before = await getInspection(passRun);
  assert.equal(before.chain_validation.customer_visible_eligible, false, 'GET before approved review must not be customer visible');
  assert.equal(before.chain_validation.blocking_reasons.includes('missing:approved_review'), true, 'GET before approved review must block on missing approved review');

  await requireOk(await post('/api/v1/inspection/pest-disease/review', withScope({
    review_id: `review_${passRun}`,
    inspection_id: `inspection_${passRun}`,
    assessment_id: passChain.assessment.assessment_id,
    field_id: `field_${passRun}`,
    review_status: 'APPROVED',
    reviewer_actor_id: 'get_consistency_reviewer',
    reviewed_at_ts: Date.now(),
    review_note: 'Approved after initial assessment false.',
    evidence_refs: [{ kind: 'fact_id', ref_id: passChain.assessment.fact_id }],
  })), 'approved review');
  const acceptance = await requireOk(await post('/api/v1/inspection/pest-disease/acceptance/evaluate', {
    assessment_id: passChain.assessment.assessment_id,
    evidence_refs: [{ kind: 'fact_id', ref_id: passChain.observation.fact_id }],
    reasons: ['get_consistency_acceptance'],
  }), 'acceptance');
  assert.equal(acceptance.record.verdict, 'PASS', 'acceptance must PASS after approved review and complete evidence');
  const after = await getInspection(passRun);
  assert.equal(after.chain_validation.customer_visible_eligible, true, 'GET after approved review and PASS must be customer visible');
  assert.equal(after.chain_validation.blocking_reasons.includes('missing:approved_review'), false, 'GET after approved review must clear missing:approved_review');
  assert.equal(after.acceptances[after.acceptances.length - 1].record_json.verdict, 'PASS', 'GET latest acceptance must be PASS');

  const rejectedRun = id('get_consistency_rejected');
  await createChain(rejectedRun, 'REJECTED');
  const rejected = await getInspection(rejectedRun);
  assert.equal(rejected.chain_validation.customer_visible_eligible, false, 'GET rejected review must not be customer visible');
  assert.equal(rejected.chain_validation.blocking_reasons.includes('review:rejected'), true, 'GET rejected review must include review:rejected');

  const output = {
    get_consistency: {
      assessment_initial_customer_visible_false: true,
      get_initial_customer_visible_false: true,
      approved_review_pass_acceptance: true,
      get_after_approved_review_customer_visible_true: true,
      missing_approved_review_cleared: true,
      latest_acceptance_pass_visible_in_get: true,
      rejected_review_blocks_customer_visibility: true,
    },
    pass_inspection_id: `inspection_${passRun}`,
    rejected_inspection_id: `inspection_${rejectedRun}`,
  };
  console.log(JSON.stringify(output, null, 2));
})().catch((err) => {
  console.error(err?.stack || err);
  process.exit(1);
});
