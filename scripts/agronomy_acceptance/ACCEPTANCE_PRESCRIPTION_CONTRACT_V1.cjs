const { assert, env, fetchJson, requireOk } = require('./_common.cjs');

(async () => {
  const base = env('BASE_URL', 'http://127.0.0.1:3001');
  const token = env('AO_ACT_TOKEN', '');
  const tenant_id = env('TENANT_ID', 'tenantA');
  const project_id = env('PROJECT_ID', 'projectA');
  const group_id = env('GROUP_ID', 'groupA');
  const field_id = env('FIELD_ID', 'field_demo_1');
  const season_id = env('SEASON_ID', 'season_demo_1');

  const gen = await fetchJson(`${base}/api/v1/recommendations/generate`, {
    method: 'POST',
    token,
    body: {
      tenant_id,
      project_id,
      group_id,
      field_id,
      season_id,
      device_id: env('DEVICE_ID', `device_prescription_${Date.now()}`),
      image_recognition: { stress_score: 0.72, disease_score: 0.1, pest_risk_score: 0.1, confidence: 0.95 },
    },
  });
  const genJson = requireOk(gen, 'generate recommendation for prescription');
  const recommendation_id = String(genJson.recommendations?.[0]?.recommendation_id ?? '').trim();
  assert.ok(recommendation_id, 'recommendation_id missing');

  const fromRecommendationBody = {
    recommendation_id,
    tenant_id,
    project_id,
    group_id,
    field_id,
    season_id,
    crop_id: env('CROP_ID', 'corn'),
    zone_id: null,
  };

  const create = await fetchJson(`${base}/api/v1/prescriptions/from-recommendation`, {
    method: 'POST',
    token,
    body: fromRecommendationBody,
  });
  const createJson = requireOk(create, 'create prescription from recommendation');
  const prescription = createJson.prescription;
  const prescription_id = String(prescription?.prescription_id ?? '').trim();
  assert.ok(prescription_id, 'prescription_id missing');

  const checkShape = Boolean(
    prescription &&
    prescription.recommendation_id === recommendation_id &&
    prescription.tenant_id === tenant_id &&
    prescription.field_id === field_id &&
    prescription.operation_type &&
    prescription.operation_amount &&
    prescription.risk &&
    Array.isArray(prescription.evidence_refs) &&
    prescription.approval_requirement &&
    prescription.acceptance_conditions &&
    prescription.status
  );

  const createAgain = await fetchJson(`${base}/api/v1/prescriptions/from-recommendation`, {
    method: 'POST',
    token,
    body: fromRecommendationBody,
  });
  const createAgainJson = requireOk(createAgain, 'idempotent create prescription from recommendation');

  const readById = await fetchJson(`${base}/api/v1/prescriptions/${encodeURIComponent(prescription_id)}`, { method: 'GET', token });
  const readByIdJson = requireOk(readById, 'read prescription by id');

  const readByRecommendation = await fetchJson(`${base}/api/v1/prescriptions/by-recommendation/${encodeURIComponent(recommendation_id)}`, { method: 'GET', token });
  const readByRecommendationJson = requireOk(readByRecommendation, 'read prescription by recommendation');

  const submitApproval = await fetchJson(`${base}/api/v1/prescriptions/${encodeURIComponent(prescription_id)}/submit-approval`, {
    method: 'POST',
    token,
    body: { tenant_id, project_id, group_id },
  });
  const submitApprovalJson = requireOk(submitApproval, 'submit prescription approval');
  const approval_request_id = String(submitApprovalJson.approval_request_id ?? '').trim();

  const latestStatus = String(submitApprovalJson.prescription?.status ?? '').trim();

  const out = {
    ok: true,
    prescription_id,
    recommendation_id,
    approval_request_id,
    checks: {
      created: Boolean(prescription_id),
      idempotent: String(createAgainJson.prescription?.prescription_id ?? '') === prescription_id,
      read_by_id: String(readByIdJson.prescription?.prescription_id ?? '') === prescription_id,
      read_by_recommendation: String(readByRecommendationJson.prescription?.prescription_id ?? '') === prescription_id,
      approval_submitted: Boolean(approval_request_id) && latestStatus === 'APPROVAL_REQUESTED',
      contract_shape_valid: checkShape,
    },
  };

  console.log(JSON.stringify(out, null, 2));

  assert.equal(out.checks.created, true, 'created failed');
  assert.equal(out.checks.idempotent, true, 'idempotent failed');
  assert.equal(out.checks.read_by_id, true, 'read by id failed');
  assert.equal(out.checks.read_by_recommendation, true, 'read by recommendation failed');
  assert.equal(out.checks.approval_submitted, true, 'approval submit failed');
  assert.equal(out.checks.contract_shape_valid, true, 'contract shape failed');
})().catch((e) => {
  console.error(JSON.stringify({ ok: false, error: e?.message ?? String(e) }, null, 2));
  if (e?.stack) console.error(e.stack);
  process.exit(1);
});
