const { assert, env, fetchJson, requireOk } = require('./_common.cjs');
(async () => {
  const base = env('BASE_URL', 'http://127.0.0.1:3000');
  const token = env('AO_ACT_TOKEN', '');
  const tenant_id = env('TENANT_ID', 'tenantA');
  const project_id = env('PROJECT_ID', 'P_DEFAULT');
  const group_id = env('GROUP_ID', 'G_DEFAULT');
  const recGen = await fetchJson(`${base}/api/v1/recommendations/generate`, {
    method: 'POST', token,
    body: {
      tenant_id, project_id, group_id,
      field_id: env('FIELD_ID', 'field_demo_1'),
      season_id: env('SEASON_ID', 'season_demo_1'),
      device_id: env('DEVICE_ID', 'device_demo_1'),
      telemetry: { soil_moisture_pct: 20, canopy_temp_c: 33 },
      image_recognition: { stress_score: 0.55, disease_score: 0.75, pest_risk_score: 0.2, confidence: 0.9 }
    }
  });
  const recJson = requireOk(recGen, 'generate');
  const recId = recJson.recommendations?.[0]?.recommendation_id;
  assert.ok(recId, 'recommendation_id missing');
  const submit = await fetchJson(`${base}/api/v1/recommendations/${encodeURIComponent(recId)}/submit-approval`, { method: 'POST', token, body: { tenant_id, project_id, group_id } });
  const subJson = requireOk(submit, 'submit approval');
  assert.ok(subJson.approval_request_id, 'approval_request_id missing');
  console.log('PASS e2e acceptance (up to approval mapping)', { recommendation_id: recId, approval_request_id: subJson.approval_request_id });
})().catch((e) => { console.error('FAIL e2e acceptance', e.message); process.exit(1); });
