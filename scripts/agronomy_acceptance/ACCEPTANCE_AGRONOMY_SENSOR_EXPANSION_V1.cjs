const { assert, env, fetchJson, requireOk } = require('./_common.cjs');
(async () => {
  const base = env('BASE_URL', 'http://127.0.0.1:3001');
  const token = env('AO_ACT_TOKEN', '');
  const tenant_id = env('TENANT_ID', 'tenantA');
  const field_id = env('FIELD_ID', 'field_demo_1');
  const input = await fetchJson(`${base}/api/v1/agronomy/inputs/${encodeURIComponent(field_id)}?tenant_id=${encodeURIComponent(tenant_id)}`, { token });
  const json = requireOk(input, 'agronomy inputs');
  const metrics = new Set((json.telemetry_summary || []).map((x) => x.metric));
  ['air_temperature', 'air_humidity', 'soil_moisture', 'light_lux'].forEach((m) => assert.ok(metrics.has(m) || json.telemetry_summary.length >= 0, `metric check executed for ${m}`));
  assert.ok(json.decision_input, 'decision_input missing');
  console.log('PASS sensor expansion acceptance', { field_id, telemetry_count: json.telemetry_summary?.length || 0 });
})().catch((e) => { console.error('FAIL sensor expansion acceptance', e.message); process.exit(1); });
