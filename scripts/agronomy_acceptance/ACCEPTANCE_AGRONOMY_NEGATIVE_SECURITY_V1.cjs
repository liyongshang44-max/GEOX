const { assert, env, fetchJson } = require('./_common.cjs');
(async () => {
  const base = env('BASE_URL', 'http://127.0.0.1:3001');
  const token = env('AO_ACT_TOKEN', '');
  const tenant_id = env('TENANT_ID', 'tenantA');
  const crossTenant = env('CROSS_TENANT_ID', 'tenantB');
  const field_id = env('FIELD_ID', 'field_demo_1');

  const listNoAuth = await fetchJson(`${base}/api/v1/agronomy/recommendations?tenant_id=${encodeURIComponent(tenant_id)}`, {});
  assert.equal(listNoAuth.status, 401, `recommendation list without token must be 401; got ${listNoAuth.status}`);

  assert.ok(token, 'AO_ACT_TOKEN is required for authenticated negative checks');

  const fakeRecommendationId = `rec_not_exist_${Date.now()}`;
  const submitFake = await fetchJson(`${base}/api/v1/recommendations/${encodeURIComponent(fakeRecommendationId)}/submit-approval`, {
    method: 'POST',
    token,
    body: { tenant_id, project_id: env('PROJECT_ID', 'P_DEFAULT'), group_id: env('GROUP_ID', 'G_DEFAULT') }
  });
  assert.equal(submitFake.status, 404, `submit approval on non-existent recommendation must fail; got ${submitFake.status}`);
  assert.ok(['RECOMMENDATION_NOT_FOUND', 'NOT_FOUND'].includes(String(submitFake.json?.error ?? '')), `unexpected submit fake error=${submitFake.text}`);

  const project_id = env('PROJECT_ID', 'P_DEFAULT');
  const group_id = env('GROUP_ID', 'G_DEFAULT');
  const device_id = env('DEVICE_ID', 'device_demo_1');
  const generate = await fetchJson(`${base}/api/v1/recommendations/generate`, {
    method: 'POST',
    token,
    body: {
      tenant_id,
      project_id,
      group_id,
      field_id,
      season_id: env('SEASON_ID', 'season_demo_1'),
      device_id,
      telemetry: { soil_moisture_pct: 22, canopy_temp_c: 34 },
      image_recognition: { stress_score: 0.8, disease_score: 0.2, pest_risk_score: 0.1, confidence: 0.92 }
    }
  });
  assert.equal(generate.status, 200, `generate recommendation failed; status=${generate.status} body=${generate.text}`);
  const recommendationId = String(generate.json?.recommendations?.[0]?.recommendation_id ?? '').trim();
  assert.ok(recommendationId, `recommendation_id missing from generate response: ${generate.text}`);

  const submitPending = await fetchJson(`${base}/api/v1/recommendations/${encodeURIComponent(recommendationId)}/submit-approval`, {
    method: 'POST',
    token,
    body: { tenant_id, project_id, group_id }
  });
  assert.equal(submitPending.status, 200, `submit approval failed; status=${submitPending.status} body=${submitPending.text}`);
  const approval_request_id = String(submitPending.json?.approval_request_id ?? '').trim();
  const operation_plan_id = String(submitPending.json?.operation_plan_id ?? '').trim();
  assert.ok(approval_request_id, `approval_request_id missing: ${submitPending.text}`);
  assert.ok(operation_plan_id, `operation_plan_id missing: ${submitPending.text}`);

  const taskBeforeApproval = await fetchJson(`${base}/api/v1/ao-act/tasks`, {
    method: 'POST',
    token,
    body: {
      tenant_id,
      project_id,
      group_id,
      approval_request_id,
        operation_plan_id,
      issuer: { kind: 'human', id: 'negative_acceptance', namespace: 'agronomy_acceptance' },
      action_type: 'IRRIGATE',
      target: { kind: 'field', ref: field_id },
      time_window: { start_ts: Date.now(), end_ts: Date.now() + 15 * 60 * 1000 },
      parameter_schema: { keys: [{ name: 'duration_s', type: 'number', min: 1, max: 7200 }] },
      parameters: { duration_s: 180 },
      constraints: { approval_required: true },
      meta: { device_id, source: 'negative_acceptance' }
    }
  });
  assert.equal(taskBeforeApproval.status, 403, `unapproved recommendation must not create AO-ACT task; got ${taskBeforeApproval.status}; body=${taskBeforeApproval.text}`);
  assert.equal(String(taskBeforeApproval.json?.error ?? ''), 'APPROVAL_REQUEST_NOT_APPROVED', `unexpected task create error=${taskBeforeApproval.text}`);

  const pendingPlan = await fetchJson(`${base}/api/v1/operations/plans/${encodeURIComponent(operation_plan_id)}?tenant_id=${encodeURIComponent(tenant_id)}&project_id=${encodeURIComponent(project_id)}&group_id=${encodeURIComponent(group_id)}`, { token });
  assert.equal(pendingPlan.status, 200, `operation plan read failed; got ${pendingPlan.status} body=${pendingPlan.text}`);
  const planPayload = pendingPlan.json?.item?.plan?.record_json?.payload ?? {};
const planStatus = String(planPayload.status ?? '');
assert.equal(planStatus, 'CREATED', `unapproved operation plan should remain CREATED; got ${planStatus}`);
assert.equal(String(planPayload.act_task_id ?? ''), '', `unapproved operation plan should not carry act_task_id; body=${pendingPlan.text}`);

  const dispatchWithoutApprovedTask = await fetchJson(`${base}/api/v1/ao-act/tasks/${encodeURIComponent(`act_not_approved_${Date.now()}`)}/dispatch`, {
    method: 'POST',
    token,
    body: { tenant_id, project_id, group_id, adapter_hint: 'mqtt', device_id }
  });
  assert.equal(dispatchWithoutApprovedTask.status, 404, `dispatch must fail before approval chain creates task; got ${dispatchWithoutApprovedTask.status}`);

  const cross = await fetchJson(`${base}/api/v1/agronomy/inputs/${encodeURIComponent(field_id)}?tenant_id=${encodeURIComponent(crossTenant)}`, { token });
  assert.equal(cross.status, 404, `cross tenant should be hidden; got ${cross.status}`);
  const unapproved = await fetchJson(`${base}/api/v1/simulators/irrigation/execute`, { method: 'POST', token, body: { tenant_id, project_id: env('PROJECT_ID', 'P_DEFAULT'), group_id: env('GROUP_ID', 'G_DEFAULT'), act_task_id: 'act_not_approved_1' } });
  assert.equal(unapproved.status, 403, `unapproved dispatch must fail; got ${unapproved.status}`);
  console.log('PASS negative security acceptance');
})().catch((e) => { console.error('FAIL negative security acceptance', e.message); process.exit(1); });


