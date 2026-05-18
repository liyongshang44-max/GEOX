const { randomUUID } = require('node:crypto');
const { assert, env, fetchJson, requireOk, waitForHealth } = require('./_common.cjs');

const id = (prefix) => `${prefix}_${randomUUID().replace(/-/g, '').slice(0, 10)}`;

function tokenEnv(name, fallback) { return env(name, env('AO_ACT_TOKEN', fallback)); }

async function post(base, path, token, body) {
  try {
    return await fetchJson(`${base}${path}`, { method: 'POST', token, body });
  } catch (err) {
    throw new Error(`POST ${path} fetch failed: ${String(err?.message ?? err)}`);
  }
}

async function postRawAuth(base, path, authHeader, body) {
  const headers = { 'content-type': 'application/json' };
  if (authHeader != null) headers.authorization = authHeader;
  let res;
  try {
    res = await fetch(`${base}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  } catch (err) {
    throw new Error(`POST ${path} fetch failed: ${String(err?.message ?? err)}`);
  }
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch {}
  return { status: res.status, ok: res.ok, json, text };
}

async function createSamplingFormalChain(base, token, scope, field_id, sample_id) {
  const plan = requireOk(await post(base, '/api/v1/sampling/plan', token, {
    ...scope,
    field_id,
    reason: 'NUTRIENT_CHECK',
    sample_type: 'SOIL',
    required_points: 5,
    evidence_refs: [],
  }), 'sampling plan');

  requireOk(await post(base, '/api/v1/sampling/receipt', token, {
    ...scope,
    plan_id: plan.plan_id,
    sample_id,
    field_id,
    collected_at_ts: Date.now(),
    collector_actor_id: 'fertilization_api_live',
    sample_type: 'SOIL',
    evidence_refs: [{ kind: 'raw_sample_v1', ref_id: id('raw') }],
    chain_of_custody_status: 'RECORDED',
  }), 'sampling receipt');

  const lab = requireOk(await post(base, '/api/v1/sampling/lab-result', token, {
    sample_id,
    imported_at_ts: Date.now(),
    metrics: { nitrate_n_mg_kg: 2.1, ammonium_n_mg_kg: 0.8 },
    units: { nitrate_n_mg_kg: 'mg/kg', ammonium_n_mg_kg: 'mg/kg' },
    evidence_refs: [{ kind: 'import_run_v1', ref_id: id('lab') }],
    quality_status: 'PASS',
  }), 'sampling lab result');

  requireOk(await post(base, '/api/v1/sampling/acceptance/evaluate', token, {
    plan_id: plan.plan_id,
    sample_id,
    import_id: lab.import_id,
  }), 'sampling acceptance');

  return { plan, lab };
}

async function main() {
  const base = env('FERTILIZATION_API_BASE_URL', env('API_BASE_URL', env('BASE_URL', 'http://127.0.0.1:3001')));
  const token = tokenEnv('ADMIN_TOKEN', 'admin_token');
  const scope = { tenant_id: env('TENANT_ID', 'tenantA'), project_id: env('PROJECT_ID', 'projectA'), group_id: env('GROUP_ID', 'groupA') };
  await waitForHealth(base);

  const now = Date.now();
  const field_id = id(`field_${now}`);
  const sample_id = id(`sample_${now}`);

  const checks = {
    no_auth_401: false,
    bad_token_401: false,
    cross_tenant_404: false,
    sampling_formal_all_pass_can_create_low_n_risk: false,
    sensing_risk_low_n_risk_blocked_400: false,
    sensing_risk_customer_visible_true_blocked_400: false,
    negative_planned_n_blocked_400: false,
    above_max_planned_n_blocked_400: false,
  };

  const noAuth = await postRawAuth(base, '/api/v1/fertilization/nitrogen-assessment', null, {
    ...scope,
    field_id,
    trigger_source: 'SENSING_RISK',
    sensing_state_refs: [{ state_type: 'fertility_state', ref_id: id('state') }],
    skill_signal_refs: [{ skill_id: 'fertility_inference_v1', skill_run_id: id('run'), signal_type: 'LOW_FERTILITY_SIGNAL' }],
    reasons: ['AUTH_TEST'],
  });
  assert.equal(noAuth.status, 401, `missing auth must be 401; got=${noAuth.status}`);
  checks.no_auth_401 = true;

  const badToken = await postRawAuth(base, '/api/v1/fertilization/nitrogen-assessment', 'Bearer invalid_fertilization_token', {
    ...scope,
    field_id,
    trigger_source: 'SENSING_RISK',
    sensing_state_refs: [{ state_type: 'fertility_state', ref_id: id('state') }],
    skill_signal_refs: [{ skill_id: 'fertility_inference_v1', skill_run_id: id('run'), signal_type: 'LOW_FERTILITY_SIGNAL' }],
    reasons: ['AUTH_TEST_BAD'],
  });
  assert.equal(badToken.status, 401, `bad token must be 401; got=${badToken.status}`);
  checks.bad_token_401 = true;

  const crossTenant = await post(base, '/api/v1/fertilization/nitrogen-assessment', token, {
    ...scope,
    tenant_id: `${scope.tenant_id}_other`,
    field_id,
    trigger_source: 'SENSING_RISK',
    sensing_state_refs: [{ state_type: 'fertility_state', ref_id: id('state') }],
    skill_signal_refs: [{ skill_id: 'fertility_inference_v1', skill_run_id: id('run'), signal_type: 'LOW_FERTILITY_SIGNAL' }],
    reasons: ['CROSS_TENANT_NEGATIVE'],
  });
  assert.equal(crossTenant.status, 404, `cross tenant must be 404; got=${crossTenant.status}`);
  await waitForHealth(base);
  checks.cross_tenant_404 = true;

  const { lab } = await createSamplingFormalChain(base, token, scope, field_id, sample_id);

  const lowN = await post(base, '/api/v1/fertilization/nitrogen-assessment', token, {
    ...scope,
    field_id,
    trigger_source: 'SAMPLING_LAB',
    sample_id,
    lab_import_id: lab.import_id,
    sample_type: 'SOIL',
    status: 'LOW_N_RISK',
    metrics: { nitrate_n_mg_kg: 2.1, ammonium_n_mg_kg: 0.8 },
    reasons: ['LOW_N_LAB_CONFIRMED'],
    evidence_refs: [{ kind: 'lab_result_import_v1', ref_id: lab.import_id }],
  });
  assert.equal(lowN.status, 200, `formal low_n assessment should succeed; got=${lowN.status} body=${lowN.text}`);
  assert.equal(lowN.json?.ok, true, 'formal low_n assessment json.ok=true required');
  checks.sampling_formal_all_pass_can_create_low_n_risk = true;

  const sensingLowN = await post(base, '/api/v1/fertilization/nitrogen-assessment', token, {
    ...scope,
    field_id,
    trigger_source: 'SENSING_RISK',
    status: 'LOW_N_RISK',
    sensing_state_refs: [{ state_type: 'fertility_state', ref_id: id('state') }],
    skill_signal_refs: [{ skill_id: 'fertility_inference_v1', skill_run_id: id('run'), signal_type: 'LOW_FERTILITY_SIGNAL' }],
    reasons: ['SENSING_SHOULD_NOT_LOW_N'],
  });
  assert.equal(sensingLowN.status, 400, `SENSING_RISK status LOW_N_RISK must be 400; got=${sensingLowN.status}`);
  checks.sensing_risk_low_n_risk_blocked_400 = true;

  const lowNAssessmentId = lowN.json?.assessment?.assessment_id;
  assert.ok(lowNAssessmentId, 'assessment.assessment_id is required for recommendation tests');

  const sensing = requireOk(await post(base, '/api/v1/fertilization/nitrogen-assessment', token, {
    ...scope,
    field_id,
    trigger_source: 'SENSING_RISK',
    sensing_state_refs: [{ state_type: 'fertility_state', ref_id: id('state') }],
    skill_signal_refs: [{ skill_id: 'fertility_inference_v1', skill_run_id: id('run'), signal_type: 'LOW_FERTILITY_SIGNAL' }],
    reasons: ['SENSING_REVIEW_ONLY'],
  }), 'sensing assessment');
  const sensingAssessmentId = sensing.assessment.assessment_id;

  const recBadVisible = await post(base, '/api/v1/fertilization/recommendation', token, {
    ...scope,
    field_id,
    assessment_id: sensingAssessmentId,
    recommendation_type: 'NITROGEN',
    suggested_total_n_kg_ha: 20,
    zone_rates: [{ zone_id: 'z1', n_kg_ha: 20, confidence: 'LOW', reason: 'SENSING_REVIEW_ONLY' }],
    risk_flags: [],
    customer_visible_eligible: true,
    evidence_refs: [{ kind: 'nitrogen_need_assessment_v1', ref_id: sensingAssessmentId }],
  });
  assert.equal(recBadVisible.status, 400, `SENSING_RISK assessment + customer_visible_eligible=true must be 400; got=${recBadVisible.status}`);
  checks.sensing_risk_customer_visible_true_blocked_400 = true;

  const recOk = requireOk(await post(base, '/api/v1/fertilization/recommendation', token, {
    ...scope,
    field_id,
    assessment_id: lowNAssessmentId,
    recommendation_type: 'NITROGEN',
    suggested_total_n_kg_ha: 20,
    zone_rates: [{ zone_id: 'z1', n_kg_ha: 20, confidence: 'HIGH', reason: 'LOW_N_LAB_CONFIRMED' }],
    risk_flags: [],
    customer_visible_eligible: true,
    evidence_refs: [{ kind: 'nitrogen_need_assessment_v1', ref_id: lowNAssessmentId }],
  }), 'recommendation create');

  const rxNegative = await post(base, '/api/v1/fertilization/prescription', token, {
    ...scope,
    field_id,
    fertilization_recommendation_id: recOk.recommendation.fertilization_recommendation_id,
    material_type: 'UREA',
    zone_rates: [{ zone_id: 'z1', planned_n_kg_ha: -1, max_n_kg_ha: 25 }],
    evidence_refs: [{ kind: 'fertilization_recommendation_v1', ref_id: recOk.recommendation.fertilization_recommendation_id }],
  });
  assert.equal(rxNegative.status, 400, `negative planned_n_kg_ha must be 400; got=${rxNegative.status}`);
  checks.negative_planned_n_blocked_400 = true;

  const rxAboveMax = await post(base, '/api/v1/fertilization/prescription', token, {
    ...scope,
    field_id,
    fertilization_recommendation_id: recOk.recommendation.fertilization_recommendation_id,
    material_type: 'UREA',
    zone_rates: [{ zone_id: 'z1', planned_n_kg_ha: 30, max_n_kg_ha: 25 }],
    evidence_refs: [{ kind: 'fertilization_recommendation_v1', ref_id: recOk.recommendation.fertilization_recommendation_id }],
  });
  assert.equal(rxAboveMax.status, 400, `planned_n_kg_ha > max_n_kg_ha must be 400; got=${rxAboveMax.status}`);
  checks.above_max_planned_n_blocked_400 = true;

  for (const [k, v] of Object.entries(checks)) assert.equal(v, true, `check failed: ${k}`);
  console.log(JSON.stringify({ ok: true, suite: 'ACCEPTANCE_FERTILIZATION_API_LIVE_V1', checks }, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, suite: 'ACCEPTANCE_FERTILIZATION_API_LIVE_V1', error: String(err?.message ?? err) }, null, 2));
  process.exit(1);
});
