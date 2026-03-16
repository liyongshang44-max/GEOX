const { assert, env, fetchJson, requireOk } = require('./_common.cjs');

(async () => {
  const base = env('BASE_URL', 'http://127.0.0.1:3000');
  const token = env('AO_ACT_TOKEN', '');
  const tenant_id = env('TENANT_ID', 'tenantA');
  const project_id = env('PROJECT_ID', 'projectA');
  const group_id = env('GROUP_ID', 'groupA');

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

  const submit = await fetchJson(`${base}/api/v1/recommendations/${encodeURIComponent(recId)}/submit-approval`, {
    method: 'POST', token, body: { tenant_id, project_id, group_id }
  });
  const subJson = requireOk(submit, 'submit approval');
  assert.ok(subJson.approval_request_id, 'approval_request_id missing');
  assert.ok(subJson.operation_plan_id, 'operation_plan_id missing');

  const planRead = await fetchJson(`${base}/api/v1/operations/plans/${encodeURIComponent(subJson.operation_plan_id)}?tenant_id=${encodeURIComponent(tenant_id)}&project_id=${encodeURIComponent(project_id)}&group_id=${encodeURIComponent(group_id)}`, {
    method: 'GET', token
  });
  const planReadJson = requireOk(planRead, 'plan read after submit');
  assert.strictEqual(planReadJson.item?.plan?.record_json?.payload?.status, 'APPROVAL_PENDING', 'plan status should be APPROVAL_PENDING before decide');

  const negativeBeforePublish = await fetchJson(`${base}/api/v1/ao-act/receipts/uplink`, {
    method: 'POST', token,
    body: {
      tenant_id, project_id, group_id,
      act_task_id: 'act_missing_demo',
      device_id: 'device_demo_1',
      status: 'executed'
    }
  });
  assert.strictEqual(negativeBeforePublish.status, 404, `expected 404 when uplinking missing task, got ${negativeBeforePublish.status}`);

  const decide = await fetchJson(`${base}/api/v1/approvals/${encodeURIComponent(subJson.approval_request_id)}/decide`, {
    method: 'POST', token,
    body: { tenant_id, project_id, group_id, decision: 'APPROVE', reason: 'e2e bridge acceptance' }
  });
  const decideJson = requireOk(decide, 'approval decide');
  const actTaskId = decideJson.act_task_id;
  assert.ok(actTaskId, 'act_task_id missing after approve');

  const dispatch = await fetchJson(`${base}/api/v1/ao-act/tasks/${encodeURIComponent(actTaskId)}/dispatch`, {
    method: 'POST', token,
    body: { tenant_id, project_id, group_id, adapter_hint: 'mqtt', device_id: env('DEVICE_ID', 'device_demo_1') }
  });
  const dispatchJson = requireOk(dispatch, 'dispatch');
  assert.ok(dispatchJson.outbox_fact_id, 'outbox_fact_id missing');

  const downlink = await fetchJson(`${base}/api/v1/ao-act/downlinks/published`, {
    method: 'POST', token,
    body: {
      tenant_id, project_id, group_id,
      act_task_id: actTaskId,
      outbox_fact_id: dispatchJson.outbox_fact_id,
      device_id: env('DEVICE_ID', 'device_demo_1'),
      topic: `downlink/${tenant_id}/${env('DEVICE_ID', 'device_demo_1')}`,
      payload: { cmd: 'execute' }
    }
  });
  requireOk(downlink, 'downlink published');

  const badUplink = await fetchJson(`${base}/api/v1/ao-act/receipts/uplink`, {
    method: 'POST', token,
    body: {
      tenant_id, project_id, group_id,
      act_task_id: actTaskId,
      device_id: 'device_wrong',
      status: 'executed'
    }
  });
  assert.strictEqual(badUplink.status, 400, `expected 400 for device mismatch uplink, got ${badUplink.status}`);
  assert.strictEqual(badUplink.json?.error, 'DEVICE_ID_MISMATCH', 'expected DEVICE_ID_MISMATCH');

  const uplink = await fetchJson(`${base}/api/v1/ao-act/receipts/uplink`, {
    method: 'POST', token,
    body: {
      tenant_id, project_id, group_id,
      act_task_id: actTaskId,
      device_id: env('DEVICE_ID', 'device_demo_1'),
      status: 'executed',
      observed_parameters: {}
    }
  });
  const uplinkJson = requireOk(uplink, 'receipt uplink');
  assert.ok(uplinkJson.fact_id, 'receipt fact_id missing');

  const planRead2 = await fetchJson(`${base}/api/v1/operations/plans/${encodeURIComponent(subJson.operation_plan_id)}?tenant_id=${encodeURIComponent(tenant_id)}&project_id=${encodeURIComponent(project_id)}&group_id=${encodeURIComponent(group_id)}`, {
    method: 'GET', token
  });
  const planReadJson2 = requireOk(planRead2, 'plan read after receipt');
  assert.strictEqual(planReadJson2.item?.plan?.record_json?.payload?.status, 'RECEIPTED', 'plan status should be RECEIPTED after uplink');
  assert.strictEqual(String(planReadJson2.item?.plan?.record_json?.payload?.act_task_id || ''), String(actTaskId), 'plan should bind to act_task_id');

  const plansList = await fetchJson(`${base}/api/v1/operations/plans?tenant_id=${encodeURIComponent(tenant_id)}&project_id=${encodeURIComponent(project_id)}&group_id=${encodeURIComponent(group_id)}&limit=5`, {
    method: 'GET', token
  });
  const plansListJson = requireOk(plansList, 'plans list');
  assert.ok(Array.isArray(plansListJson.items), 'plans list items must be array');
  assert.ok(plansListJson.items.some((x) => x?.operation_plan?.payload?.operation_plan_id === subJson.operation_plan_id), 'operation plan not found in list');

  console.log('PASS e2e acceptance (recommendation->approval->operation_plan->dispatch bridge->receipt)', {
    recommendation_id: recId,
    approval_request_id: subJson.approval_request_id,
    operation_plan_id: subJson.operation_plan_id,
    act_task_id: actTaskId,
    receipt_fact_id: uplinkJson.fact_id
  });
})().catch((e) => { console.error('FAIL e2e acceptance', e.message); process.exit(1); });
