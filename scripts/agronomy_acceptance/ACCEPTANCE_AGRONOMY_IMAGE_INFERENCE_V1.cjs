const { assert, env, fetchJson, requireOk } = require('./_common.cjs');
(async () => {
  const base = env('BASE_URL', 'http://127.0.0.1:3001');
  const token = env('AO_ACT_TOKEN', '');
  const tenant_id = env('TENANT_ID', 'tenantA');
  const field_id = env('FIELD_ID', 'field_demo_1');
  const observation_id = env('OBSERVATION_ID', '');
  assert.ok(observation_id, 'set OBSERVATION_ID to an existing agronomy observation');
  const run = await fetchJson(`${base}/api/v1/agronomy/inference/run`, { method: 'POST', token, body: { tenant_id, observation_id, model_version: 'acc-v1' } });
  const runJson = requireOk(run, 'inference run');
  const payload = runJson?.result?.payload ?? {};
  assert.ok(payload.model_version, 'model_version missing');
  assert.ok(Array.isArray(payload.labels), 'labels missing');
  assert.equal(typeof payload.confidence, 'number', 'confidence missing');
  console.log('PASS image inference acceptance', { inference_id: runJson.inference_id, field_id });
})().catch((e) => { console.error('FAIL image inference acceptance', e.message); process.exit(1); });
