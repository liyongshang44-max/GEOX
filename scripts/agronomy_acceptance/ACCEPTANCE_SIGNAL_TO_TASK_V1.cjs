const mqtt = require('mqtt');
const { Pool } = require('pg');
const { assert, env, fetchJson, requireOk } = require('./_common.cjs');

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function publishMqtt(mqttUrl, topic, payload) {
  const client = mqtt.connect(mqttUrl);
  await new Promise((resolve, reject) => {
    client.on('connect', resolve);
    client.on('error', reject);
  });
  await new Promise((resolve, reject) => {
    client.publish(topic, JSON.stringify(payload), { qos: 1 }, (err) => err ? reject(err) : resolve());
  });
  client.end(true);
}

(async () => {
  const base = env('BASE_URL', 'http://127.0.0.1:3001');
  const token = env('AO_ACT_TOKEN', '');
  const tenant_id = env('TENANT_ID', 'tenantA');
  const project_id = env('PROJECT_ID', 'projectA');
  const group_id = env('GROUP_ID', 'groupA');
  const field_id = env('FIELD_ID', 'field_demo_1');
  const season_id = env('SEASON_ID', 'season_demo_1');
  const device_id = env('DEVICE_ID', `device_sig_${Date.now()}`);
  const mqttUrl = env('MQTT_URL', env('GEOX_MQTT_URL', 'mqtt://127.0.0.1:1883'));
  const databaseUrl = env('DATABASE_URL', 'postgres://postgres:postgres@127.0.0.1:5432/geox');

  const reg = await fetchJson(`${base}/api/v1/devices/register`, {
    method: 'POST', token,
    body: { device_id, display_name: device_id }
  });
  const regJson = requireOk(reg, 'register device');
  const credential = String(regJson.credential_secret ?? '');
  assert.ok(credential, 'credential_secret missing');

  const bind = await fetchJson(`${base}/api/v1/devices/${encodeURIComponent(device_id)}/bind-field`, {
    method: 'POST', token,
    body: { field_id }
  });
  requireOk(bind, 'bind field');

  const tsBase = Date.now();
  const topic = `telemetry/${tenant_id}/${device_id}`;
  await publishMqtt(mqttUrl, topic, { metric: 'soil_moisture', value: 24.6, ts_ms: tsBase, credential });
  await publishMqtt(mqttUrl, topic, { metric: 'canopy_temp', value: 33.2, ts_ms: tsBase + 1000, credential });

  const pool = new Pool({ connectionString: databaseUrl });
  let snapshot = null;
  for (let i = 0; i < 20; i += 1) {
    const q = await pool.query('SELECT * FROM agronomy_signal_snapshot_v1 WHERE tenant_id = $1 AND device_id = $2 LIMIT 1', [tenant_id, device_id]);
    snapshot = q.rows?.[0] ?? null;
    if (snapshot && snapshot.soil_moisture_pct != null && snapshot.canopy_temp_c != null) break;
    await sleep(300);
  }
  await pool.end();
  assert.ok(snapshot, 'snapshot row missing');
  assert.notEqual(snapshot.soil_moisture_pct, null, 'soil_moisture_pct missing');
  assert.notEqual(snapshot.canopy_temp_c, null, 'canopy_temp_c missing');

  const gen = await fetchJson(`${base}/api/v1/recommendations/generate`, {
    method: 'POST', token,
    body: { tenant_id, project_id, group_id, field_id, season_id, device_id, image_recognition: { stress_score: 0.55, disease_score: 0.1, pest_risk_score: 0.1, confidence: 0.9 } }
  });
  const genJson = requireOk(gen, 'generate recommendation');
  const recommendation_id = String(genJson.recommendations?.[0]?.recommendation_id ?? '');
  assert.ok(recommendation_id, 'recommendation_id missing');
  console.log(`PASS recommendation_id=${recommendation_id}`);

  const submit = await fetchJson(`${base}/api/v1/recommendations/${encodeURIComponent(recommendation_id)}/submit-approval`, {
    method: 'POST', token, body: { tenant_id, project_id, group_id }
  });
  const submitJson = requireOk(submit, 'submit approval');

  const decide = await fetchJson(`${base}/api/v1/approvals/${encodeURIComponent(submitJson.approval_request_id)}/decide`, {
    method: 'POST', token, body: { tenant_id, project_id, group_id, decision: 'APPROVE', reason: 'signal-to-task acceptance' }
  });
  const decideJson = requireOk(decide, 'approve request');
  const operation_plan_id = String(decideJson.operation_plan_id ?? submitJson.operation_plan_id ?? '');
  const act_task_id = String(decideJson.act_task_id ?? '');
  assert.ok(operation_plan_id, 'operation_plan_id missing');
  assert.ok(act_task_id, 'act_task_id missing');
  console.log(`PASS operation_plan_id=${operation_plan_id}`);
  console.log(`PASS act_task_id=${act_task_id}`);

  const plans = await fetchJson(`${base}/api/v1/operations/plans?tenant_id=${encodeURIComponent(tenant_id)}&project_id=${encodeURIComponent(project_id)}&group_id=${encodeURIComponent(group_id)}&limit=20`, { method: 'GET', token });
  const plansJson = requireOk(plans, 'list plans');
  assert.ok((plansJson.items || []).some((x) => String(x?.operation_plan?.payload?.operation_plan_id ?? '') === operation_plan_id), 'operation plan not in list');

  const dispatch = await fetchJson(`${base}/api/v1/ao-act/tasks/${encodeURIComponent(act_task_id)}/dispatch`, {
    method: 'POST', token,
    body: { tenant_id, project_id, group_id, adapter_hint: 'mqtt', device_id }
  });
  const dispatchJson = requireOk(dispatch, 'dispatch task');

  const claim = await fetchJson(`${base}/api/v1/ao-act/dispatches/claim`, {
    method: 'POST', token,
    body: { tenant_id, project_id, group_id, limit: 1, lease_seconds: 30, executor_id: 'acceptance_executor', act_task_id }
  });
  const claimJson = requireOk(claim, 'executor claim');
  assert.ok(Array.isArray(claimJson.items), 'claim items missing');

  const receipt = await fetchJson(`${base}/api/v1/ao-act/receipts/uplink`, {
    method: 'POST', token,
    body: {
      tenant_id, project_id, group_id,
      task_id: act_task_id,
      act_task_id,
      command_id: act_task_id,
      device_id,
      status: 'executed',
      meta: { idempotency_key: `receipt-${act_task_id}-${Date.now()}` }
    }
  });
  const receiptJson = requireOk(receipt, 'receipt');
  assert.ok(receiptJson.fact_id, 'receipt fact id missing');
  console.log('PASS receipt');
})().catch((e) => {
  console.error('FAIL acceptance', e?.message || e);
  if (e?.stack) console.error(e.stack);
  process.exit(1);
});
