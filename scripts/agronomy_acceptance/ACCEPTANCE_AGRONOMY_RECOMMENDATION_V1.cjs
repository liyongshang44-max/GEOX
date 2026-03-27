const { assert, env, fetchJson, requireOk } = require('./_common.cjs');
(async () => {
  const base = env('BASE_URL', 'http://127.0.0.1:3001');
  const token = env('AO_ACT_TOKEN', '');
  const tenant_id = env('TENANT_ID', 'tenantA');
  const body = {
    tenant_id,
    project_id: env('PROJECT_ID', 'P_DEFAULT'),
    group_id: env('GROUP_ID', 'G_DEFAULT'),
    field_id: env('FIELD_ID', 'field_demo_1'),
    season_id: env('SEASON_ID', 'season_demo_1'),
    device_id: env('DEVICE_ID', 'device_demo_1'),
    telemetry: { soil_moisture_pct: 22, canopy_temp_c: 34 },
    image_recognition: { stress_score: 0.8, disease_score: 0.2, pest_risk_score: 0.1, confidence: 0.92 }
  };
  const gen = await fetchJson(`${base}/api/v1/recommendations/generate`, { method: 'POST', token, body });
  const genJson = requireOk(gen, 'generate recommendation');
  assert.ok(Array.isArray(genJson.recommendations) && genJson.recommendations.length >= 1, 'recommendations empty');
  const list = await fetchJson(`${base}/api/v1/agronomy/recommendations?tenant_id=${encodeURIComponent(body.tenant_id)}&project_id=${encodeURIComponent(body.project_id)}&group_id=${encodeURIComponent(body.group_id)}&limit=5`, { token });
  const listJson = requireOk(list, 'recommendation list');
  const item = listJson.items?.[0];
  assert.ok(item?.model_version, 'model_version missing');
  assert.ok(Array.isArray(item?.reason_codes), 'reason_codes missing');
  assert.ok(Array.isArray(item?.evidence_refs), 'evidence_refs missing');
  assert.ok(Array.isArray(item?.rule_hit), 'rule_hit missing');
  console.log('PASS recommendation acceptance', { recommendation_id: item?.recommendation_id || null });
})().catch((e) => { console.error('FAIL recommendation acceptance', e.message); process.exit(1); });
