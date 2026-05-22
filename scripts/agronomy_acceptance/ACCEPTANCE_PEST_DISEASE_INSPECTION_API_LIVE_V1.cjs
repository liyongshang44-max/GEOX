#!/usr/bin/env node
const { randomUUID } = require('node:crypto');
const { assert, env, fetchJson, requireOk, waitForHealth } = require('./_common.cjs');

const id = (p) => `${p}_${randomUUID().replace(/-/g, '').slice(0, 18)}`;
const q = (v) => encodeURIComponent(String(v ?? ''));

const base = env('BASE_URL', process.env.API_BASE_URL || 'http://127.0.0.1:3001');
const adminToken = env('ADMIN_TOKEN', env('AO_ACT_TOKEN', env('TOKEN', 'admin_token')));
const invalidToken = env('INVALID_TOKEN', 'definitely_invalid_token');
const readOnlyToken = env('READ_ONLY_TOKEN', env('CLIENT_TOKEN', 'set-via-env-or-external-secret-file-client'));
const writeOnlyToken = env('WRITE_ONLY_TOKEN', '');
const nonAcceptanceToken = env('NON_ACCEPTANCE_TOKEN', readOnlyToken);
const otherTenantToken = env('OTHER_TENANT_TOKEN', '');
const scope = {
  tenant_id: env('TENANT_ID', 'tenantA'),
  project_id: env('PROJECT_ID', 'projectA'),
  group_id: env('GROUP_ID', 'groupA'),
};

function mergeScope(body) { return { ...scope, ...body }; }
async function post(path, token, body) { return fetchJson(`${base}${path}`, { method: 'POST', token, body }); }
async function get(path, token) { return fetchJson(`${base}${path}`, { method: 'GET', token }); }
function expectStatus(resp, statuses, label) {
  assert.equal(statuses.includes(resp.status), true, `${label} expected ${statuses.join('/')} got ${resp.status} body=${resp.text}`);
  return true;
}
function expectBad(resp, label) { return expectStatus(resp, [400], label); }
function expectDenied(resp, label) { return expectStatus(resp, [401, 403], label); }
function expectTenantDenied(resp, label) { return expectStatus(resp, [403, 404], label); }

async function createRequest(runId, overrides = {}, token = adminToken) {
  return requireOk(await post('/api/v1/inspection/pest-disease/request', token, mergeScope({
    inspection_id: `inspection_${runId}`,
    field_id: `field_${runId}`,
    trigger_source: 'MANUAL_SCOUT',
    requested_target: 'PEST',
    priority: 'HIGH',
    evidence_refs: [],
    reasons: ['api_live_gate'],
    ...overrides,
  })), 'inspection request');
}
async function createObservation(runId, overrides = {}, token = adminToken) {
  return requireOk(await post('/api/v1/inspection/pest-disease/observation', token, mergeScope({
    observation_id: `obs_${runId}`,
    inspection_id: `inspection_${runId}`,
    field_id: `field_${runId}`,
    captured_at_ts: Date.now(),
    geo_point: { lat: 35.12, lng: -120.21 },
    device_profile: { device_model: 'PHONE_CAMERA', device_type: 'PHONE', capabilities: ['rgb_photo'] },
    media_refs: [{ kind: 'IMAGE', ref_id: `img_${runId}` }],
    plant_part: 'LEAF',
    target_type: 'PEST',
    evidence_quality: 'COMPLETE',
    evidence_refs: [],
    ...overrides,
  })), 'inspection observation');
}
async function createSignal(runId, overrides = {}, token = adminToken) {
  return requireOk(await post('/api/v1/inspection/pest-disease/signal', token, mergeScope({
    signal_id: `signal_${runId}`,
    inspection_id: `inspection_${runId}`,
    observation_id: `obs_${runId}`,
    field_id: `field_${runId}`,
    skill_id: 'pest_disease_api_live_signal_v1',
    skill_run_id: `skillrun_${runId}`,
    signal_type: 'PEST_SIGNAL',
    confidence: 'MEDIUM',
    reason_codes: ['API_LIVE'],
    missing_inputs: [],
    uncertainty_notes: [],
    evidence_refs: [],
    ...overrides,
  })), 'inspection signal');
}
async function createAssessment(runId, overrides = {}, token = adminToken) {
  return requireOk(await post('/api/v1/inspection/pest-disease/assessment', token, mergeScope({
    assessment_id: `assessment_${runId}`,
    inspection_id: `inspection_${runId}`,
    field_id: `field_${runId}`,
    target_type: 'PEST',
    assessment_status: 'CONFIRMED',
    severity: 'MEDIUM',
    confidence: 'MEDIUM',
    evidence_tier: 'FORMAL',
    review_required: true,
    customer_visible_eligible: true,
    observation_refs: [`obs_${runId}`],
    skill_signal_refs: [{ skill_id: 'pest_disease_api_live_signal_v1', skill_run_id: `skillrun_${runId}`, signal_id: `signal_${runId}` }],
    evidence_refs: [],
    reasons: ['api_live_assessment'],
    ...overrides,
  })), 'inspection assessment');
}
async function createReview(runId, overrides = {}, token = adminToken) {
  return requireOk(await post('/api/v1/inspection/pest-disease/review', token, mergeScope({
    review_id: `review_${runId}`,
    inspection_id: `inspection_${runId}`,
    assessment_id: `assessment_${runId}`,
    field_id: `field_${runId}`,
    review_status: 'APPROVED',
    reviewer_actor_id: 'api_live_reviewer',
    reviewed_at_ts: Date.now(),
    review_note: 'API live gate review approved.',
    evidence_refs: [],
    ...overrides,
  })), 'inspection review');
}
async function evaluateAcceptance(runId, overrides = {}, token = adminToken) {
  return requireOk(await post('/api/v1/inspection/pest-disease/acceptance/evaluate', token, {
    assessment_id: `assessment_${runId}`,
    evidence_refs: [],
    reasons: ['api_live_acceptance'],
    ...overrides,
  }), 'inspection acceptance evaluate');
}
async function getInspection(runId, token = adminToken, inspectionId = `inspection_${runId}`) {
  return requireOk(await get(`/api/v1/inspection/pest-disease/${q(inspectionId)}`, token), 'inspection get');
}

async function positiveChain() {
  const runId = id('pdi_api_live');
  const req = await createRequest(runId);
  const obs = await createObservation(runId);
  const sig = await createSignal(runId);
  const ass = await createAssessment(runId);
  const review = await createReview(runId);
  const acc = await evaluateAcceptance(runId);
  const detail = await getInspection(runId);
  return {
    runId,
    request_created: req.record?.type === 'pest_disease_inspection_request_v1',
    observation_created: obs.record?.type === 'pest_disease_observation_v1',
    signal_created: sig.record?.type === 'pest_disease_signal_v1',
    assessment_created: ass.record?.type === 'pest_disease_inspection_assessment_v1',
    review_created: review.record?.review_status === 'APPROVED',
    acceptance_pass: acc.record?.verdict === 'PASS',
    get_inspection_returns_chain: detail.inspection_id === `inspection_${runId}` && detail.observations?.length > 0 && detail.assessments?.length > 0 && detail.reviews?.length > 0 && detail.acceptances?.length > 0,
  };
}

async function authBoundary() {
  const writePath = '/api/v1/inspection/pest-disease/request';
  const body = mergeScope({ inspection_id: id('auth_req'), field_id: 'field_auth', trigger_source: 'MANUAL_SCOUT', requested_target: 'PEST' });
  expectDenied(await post(writePath, '', body), 'missing token denied');
  expectDenied(await post(writePath, invalidToken, body), 'invalid token denied');
  expectDenied(await post(writePath, readOnlyToken, body), 'read-only token denied for write endpoint');

  const runId = id('auth_accept');
  await createRequest(runId);
  await createObservation(runId);
  await createAssessment(runId, { skill_signal_refs: [], confidence: 'HIGH', review_required: false, customer_visible_eligible: true });
  expectDenied(await post('/api/v1/inspection/pest-disease/acceptance/evaluate', nonAcceptanceToken, { assessment_id: `assessment_${runId}` }), 'non-acceptance token denied for acceptance evaluate');

  let readWriteScopeDistinctionSupported = false;
  if (writeOnlyToken) {
    const readResp = await get(`/api/v1/inspection/pest-disease/${q(`inspection_${runId}`)}`, writeOnlyToken);
    expectDenied(readResp, 'write-only token denied for read endpoint');
    readWriteScopeDistinctionSupported = true;
  }
  return { ok: true, read_write_scope_distinction_supported: readWriteScopeDistinctionSupported };
}

async function tenantBoundary() {
  const wrong = { tenant_id: `${scope.tenant_id}_other` };
  expectTenantDenied(await post('/api/v1/inspection/pest-disease/request', adminToken, mergeScope({ ...wrong, inspection_id: id('tenant_req'), field_id: 'field_tenant', trigger_source: 'MANUAL_SCOUT', requested_target: 'PEST' })), 'request tenant mismatch denied');
  expectTenantDenied(await post('/api/v1/inspection/pest-disease/observation', adminToken, mergeScope({ ...wrong, observation_id: id('tenant_obs'), inspection_id: id('tenant_i'), field_id: 'field_tenant', captured_at_ts: Date.now(), target_type: 'PEST' })), 'observation tenant mismatch denied');
  expectTenantDenied(await post('/api/v1/inspection/pest-disease/assessment', adminToken, mergeScope({ ...wrong, assessment_id: id('tenant_ass'), inspection_id: id('tenant_i'), field_id: 'field_tenant', target_type: 'PEST', assessment_status: 'SUSPECTED', observation_refs: ['obs'], skill_signal_refs: [] })), 'assessment tenant mismatch denied');

  const runId = id('tenant_get');
  await createRequest(runId);
  let authenticated_cross_tenant_get_supported = false;
  if (otherTenantToken) {
    expectTenantDenied(
      await get(`/api/v1/inspection/pest-disease/${q(`inspection_${runId}`)}`, otherTenantToken),
      'GET other tenant denied',
    );
    authenticated_cross_tenant_get_supported = true;
  } else {
    const resp = await get(
      `/api/v1/inspection/pest-disease/${q(`inspection_${runId}`)}`,
      'other_tenant_token_live',
    );
    expectStatus(resp, [401], 'unknown other tenant token denied');
  }
  await waitForHealth(base);
  return { ok: true, authenticated_cross_tenant_get_supported };
}

async function requiredFields() {
  const runId = id('required');
  const requestBase = mergeScope({ inspection_id: `inspection_${runId}`, field_id: `field_${runId}`, trigger_source: 'MANUAL_SCOUT', requested_target: 'PEST' });
  for (const field of ['tenant_id', 'project_id', 'group_id', 'field_id', 'trigger_source', 'requested_target']) {
    const body = { ...requestBase };
    delete body[field];
    expectBad(await post('/api/v1/inspection/pest-disease/request', adminToken, body), `request missing ${field}`);
  }
  const obsBase = mergeScope({ observation_id: `obs_${runId}`, inspection_id: `inspection_${runId}`, field_id: `field_${runId}`, captured_at_ts: Date.now(), target_type: 'PEST', media_refs: [{ kind: 'IMAGE', ref_id: 'img' }] });
  for (const field of ['inspection_id', 'captured_at_ts', 'target_type']) {
    const body = { ...obsBase };
    delete body[field];
    expectBad(await post('/api/v1/inspection/pest-disease/observation', adminToken, body), `observation missing ${field}`);
  }
  expectBad(await post('/api/v1/inspection/pest-disease/signal', adminToken, mergeScope({ signal_id: `signal_${runId}`, inspection_id: `inspection_${runId}`, field_id: `field_${runId}`, signal_type: 'PEST_SIGNAL' })), 'signal missing skill_id and skill_run_id');
  expectBad(await post('/api/v1/inspection/pest-disease/assessment', adminToken, mergeScope({ assessment_id: `assessment_${runId}`, inspection_id: `inspection_${runId}`, field_id: `field_${runId}`, target_type: 'PEST', assessment_status: 'SUSPECTED' })), 'assessment missing observation and skill refs');
  expectBad(await post('/api/v1/inspection/pest-disease/review', adminToken, mergeScope({ review_id: `review_${runId}`, inspection_id: `inspection_${runId}`, field_id: `field_${runId}`, review_status: 'APPROVED' })), 'review missing assessment_id');
  expectBad(await post('/api/v1/inspection/pest-disease/acceptance/evaluate', adminToken, {}), 'acceptance missing assessment_id');
  return true;
}

async function enumValidation() {
  const runId = id('enum');
  expectBad(await post('/api/v1/inspection/pest-disease/request', adminToken, mergeScope({ inspection_id: `inspection_${runId}_a`, field_id: `field_${runId}`, trigger_source: 'BAD_TRIGGER', requested_target: 'PEST' })), 'invalid trigger_source');
  expectBad(await post('/api/v1/inspection/pest-disease/request', adminToken, mergeScope({ inspection_id: `inspection_${runId}_b`, field_id: `field_${runId}`, trigger_source: 'MANUAL_SCOUT', requested_target: 'BAD_TARGET' })), 'invalid requested_target');
  const obs = { observation_id: `obs_${runId}`, inspection_id: `inspection_${runId}`, field_id: `field_${runId}`, captured_at_ts: Date.now(), target_type: 'PEST' };
  expectBad(await post('/api/v1/inspection/pest-disease/observation', adminToken, mergeScope({ ...obs, device_profile: { device_model: 'BAD_MODEL', device_type: 'PHONE' } })), 'invalid device model');
  expectBad(await post('/api/v1/inspection/pest-disease/observation', adminToken, mergeScope({ ...obs, device_profile: { device_model: 'PHONE_CAMERA', device_type: 'BAD_TYPE' } })), 'invalid device type');
  expectBad(await post('/api/v1/inspection/pest-disease/observation', adminToken, mergeScope({ ...obs, media_refs: [{ kind: 'BAD_MEDIA', ref_id: 'img' }] })), 'invalid media kind');
  expectBad(await post('/api/v1/inspection/pest-disease/observation', adminToken, mergeScope({ ...obs, plant_part: 'BAD_PART' })), 'invalid plant part');
  expectBad(await post('/api/v1/inspection/pest-disease/signal', adminToken, mergeScope({ signal_id: `signal_${runId}`, inspection_id: `inspection_${runId}`, field_id: `field_${runId}`, skill_id: 'skill', signal_type: 'BAD_SIGNAL' })), 'invalid signal type');
  expectBad(await post('/api/v1/inspection/pest-disease/assessment', adminToken, mergeScope({ assessment_id: `assessment_${runId}`, inspection_id: `inspection_${runId}`, field_id: `field_${runId}`, target_type: 'PEST', assessment_status: 'BAD_STATUS', observation_refs: ['obs'], skill_signal_refs: [] })), 'invalid assessment status');
  expectBad(await post('/api/v1/inspection/pest-disease/review', adminToken, mergeScope({ review_id: `review_${runId}`, inspection_id: `inspection_${runId}`, assessment_id: `assessment_${runId}`, field_id: `field_${runId}`, review_status: 'BAD_REVIEW' })), 'invalid review status');
  return true;
}

async function businessBoundary() {
  const sigOnly = id('sigonly');
  await createRequest(sigOnly);
  await createSignal(sigOnly, { observation_id: null, skill_id: 'skill_only', skill_run_id: `skillrun_${sigOnly}`, confidence: 'HIGH' });
  expectBad(await post('/api/v1/inspection/pest-disease/assessment', adminToken, mergeScope({ assessment_id: `assessment_${sigOnly}`, inspection_id: `inspection_${sigOnly}`, field_id: `field_${sigOnly}`, target_type: 'PEST', assessment_status: 'CONFIRMED', severity: 'MEDIUM', confidence: 'HIGH', observation_refs: [], skill_signal_refs: [{ skill_id: 'skill_only', skill_run_id: `skillrun_${sigOnly}`, signal_id: `signal_${sigOnly}` }] })), 'skill signal only cannot confirm');

  const noGeo = id('nogeo');
  await createRequest(noGeo);
  const noGeoObs = await createObservation(noGeo, { geo_point: null, evidence_quality: 'COMPLETE' });
  const noGeoAss = await createAssessment(noGeo, { observation_refs: [noGeoObs.observation_id], skill_signal_refs: [], review_required: false, confidence: 'MEDIUM', assessment_status: 'SUSPECTED', customer_visible_eligible: true });
  assert.equal(noGeoAss.record.customer_visible_eligible, false, 'missing geo must block customer visibility');

  const noMedia = id('nomedia');
  await createRequest(noMedia);
  const noMediaObs = await createObservation(noMedia, { media_refs: [], evidence_quality: 'COMPLETE' });
  const noMediaAss = await createAssessment(noMedia, { observation_refs: [noMediaObs.observation_id], skill_signal_refs: [], review_required: false, confidence: 'MEDIUM', assessment_status: 'SUSPECTED', customer_visible_eligible: true });
  assert.equal(noMediaAss.record.customer_visible_eligible, false, 'missing media must block customer visibility');

  const low = id('lowconf');
  await createRequest(low);
  await createObservation(low);
  const lowAss = await createAssessment(low, { skill_signal_refs: [], confidence: 'LOW', review_required: false, assessment_status: 'SUSPECTED', customer_visible_eligible: true });
  assert.equal(lowAss.record.review_required, true, 'LOW confidence must require review');

  const pending = id('pending');
  await createRequest(pending);
  await createObservation(pending);
  const pendingAss = await createAssessment(pending, { skill_signal_refs: [], confidence: 'HIGH', review_required: true, customer_visible_eligible: true });
  assert.equal(pendingAss.record.customer_visible_eligible, false, 'pending review must block customer visibility');
  const pendingDetail = await getInspection(pending);
  assert.equal(pendingDetail.chain_validation.customer_visible_eligible, false, 'GET pending review must not be customer visible');

  const rejected = id('rejected');
  await createRequest(rejected);
  await createObservation(rejected);
  await createAssessment(rejected, { skill_signal_refs: [], confidence: 'HIGH', review_required: true, customer_visible_eligible: true });
  await createReview(rejected, { review_status: 'REJECTED' });
  const rejectedDetail = await getInspection(rejected);
  assert.equal(rejectedDetail.chain_validation.needs_review, true, 'GET rejected review must need review');
  assert.equal(rejectedDetail.chain_validation.customer_visible_eligible, false, 'GET rejected review must not be customer visible');
  assert.equal(rejectedDetail.chain_validation.blocking_reasons.includes('review:rejected'), true, 'GET rejected review must expose review:rejected');

  return true;
}

(async function main() {
  await waitForHealth(base);
  const positive = await positiveChain();
  for (const [key, value] of Object.entries(positive)) {
    if (key !== 'runId') assert.equal(value, true, `positive check failed: ${key}`);
  }
  const auth = await authBoundary();
  const tenant = await tenantBoundary();
  const fields = await requiredFields();
  const enums = await enumValidation();
  const business = await businessBoundary();
  await waitForHealth(base);
  const output = {
    api_live: {
      positive_chain_created: true,
      auth_boundary: auth.ok === true,
      tenant_boundary: tenant.ok === true,
      authenticated_cross_tenant_get_supported: tenant.authenticated_cross_tenant_get_supported,
      required_fields: fields === true,
      enum_validation: enums === true,
      business_boundary: business === true,
      server_healthy_after_negative_paths: true,
      read_write_scope_distinction_supported: auth.read_write_scope_distinction_supported,
    },
    positive,
  };
  console.log(JSON.stringify(output, null, 2));
})().catch((err) => {
  console.error(err?.stack || err);
  process.exit(1);
});
