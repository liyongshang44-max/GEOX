const { assert, env, fetchJson, requireOk } = require('./_common.cjs');

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function waitExportDone(base, token, jobId) {
  let exportJobJson = null;
  for (let i = 0; i < 40; i += 1) {
    await sleep(250);
    const exportStatus = await fetchJson(`${base}/api/v1/evidence-export/jobs/${encodeURIComponent(jobId)}`, { method: 'GET', token });
    exportJobJson = requireOk(exportStatus, 'evidence export status');
    const jobStatus = String(exportJobJson.job?.status ?? '').toUpperCase();
    if (jobStatus === 'DONE') return exportJobJson;
    assert.notStrictEqual(jobStatus, 'ERROR', `evidence export job failed: ${exportStatus.text}`);
  }
  assert.fail('evidence export job should finish as DONE');
}

async function exportFacts(base, token, fromTsMs, toTsMs, fieldId) {
  const exportCreate = await fetchJson(`${base}/api/v1/evidence-export/jobs`, {
    method: 'POST',
    token,
    body: {
      scope_type: 'FIELD',
      scope_id: fieldId,
      from_ts_ms: fromTsMs,
      to_ts_ms: toTsMs,
      export_format: 'JSON',
      export_language: 'zh-CN'
    }
  });
  const exportCreateJson = requireOk(exportCreate, 'evidence export create');
  const exportJobId = String(exportCreateJson.job_id ?? '');
  assert.ok(exportJobId, 'evidence export job_id missing');
  await waitExportDone(base, token, exportJobId);

  const exportDownload = await fetch(`${base}/api/v1/evidence-export/jobs/${encodeURIComponent(exportJobId)}/download`, {
    method: 'GET',
    headers: token ? { authorization: `Bearer ${token}` } : {}
  });
  const exportText = await exportDownload.text();
  assert.strictEqual(exportDownload.ok, true, `evidence export download status=${exportDownload.status} body=${exportText}`);
  const exportBundle = JSON.parse(exportText);
  return Array.isArray(exportBundle?.facts) ? exportBundle.facts : [];
}

function countReceiptsByCommand(items, commandId) {
  return items.filter((item) => {
    const payload = item?.receipt?.payload ?? {};
    const payloadCommandId = String(payload.command_id ?? payload.meta?.command_id ?? payload.act_task_id ?? '').trim();
    return payloadCommandId === commandId;
  }).length;
}

(async () => {
  const base = env('BASE_URL', 'http://127.0.0.1:3000');
  const token = env('AO_ACT_TOKEN', '');
  const tenant_id = env('TENANT_ID', 'tenantA');
  const project_id = env('PROJECT_ID', 'projectA');
  const group_id = env('GROUP_ID', 'groupA');
  const field_id = env('FIELD_ID', 'field_demo_1');
  const season_id = env('SEASON_ID', 'season_demo_1');
  const device_id = env('DEVICE_ID', 'device_demo_1');

  const chainStartTs = Date.now() - 60_000;

  const recGen = await fetchJson(`${base}/api/v1/recommendations/generate`, {
    method: 'POST',
    token,
    body: {
      tenant_id, project_id, group_id, field_id, season_id, device_id,
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

  const decide = await fetchJson(`${base}/api/v1/approvals/${encodeURIComponent(subJson.approval_request_id)}/decide`, {
    method: 'POST', token,
    body: { tenant_id, project_id, group_id, decision: 'APPROVE', reason: 'duplicate dispatch negative acceptance' }
  });
  const decideJson = requireOk(decide, 'approval decide');
  const actTaskId = String(decideJson.act_task_id ?? '');
  assert.ok(actTaskId, 'act_task_id missing after approve');
  const commandId = actTaskId;

  const dispatch1 = await fetchJson(`${base}/api/v1/ao-act/tasks/${encodeURIComponent(actTaskId)}/dispatch`, {
    method: 'POST', token,
    body: { tenant_id, project_id, group_id, command_id: commandId, adapter_hint: 'mqtt', device_id }
  });
  const dispatch1Json = requireOk(dispatch1, 'initial dispatch');
  assert.ok(dispatch1Json.outbox_fact_id, 'outbox_fact_id missing');
  console.log('PASS initial dispatch succeeded');

  const downlink = await fetchJson(`${base}/api/v1/ao-act/downlinks/published`, {
    method: 'POST', token,
    body: {
      tenant_id, project_id, group_id,
      act_task_id: actTaskId,
      outbox_fact_id: dispatch1Json.outbox_fact_id,
      device_id,
      topic: `downlink/${tenant_id}/${device_id}`,
      payload: { cmd: 'execute' }
    }
  });
  requireOk(downlink, 'downlink published');

  const receipt = await fetchJson(`${base}/api/v1/ao-act/receipts/uplink`, {
    method: 'POST', token,
    body: {
      tenant_id, project_id, group_id,
      task_id: actTaskId,
      act_task_id: actTaskId,
      command_id: commandId,
      device_id,
      status: 'executed',
      observed_parameters: {},
      meta: { idempotency_key: `receipt-${actTaskId}` }
    }
  });
  requireOk(receipt, 'receipt uplink');
  console.log('PASS receipt uplink recorded');

  const receiptsBefore = await fetchJson(`${base}/api/v1/ao-act/receipts?tenant_id=${encodeURIComponent(tenant_id)}&project_id=${encodeURIComponent(project_id)}&group_id=${encodeURIComponent(group_id)}&act_task_id=${encodeURIComponent(actTaskId)}&limit=20`, {
    method: 'GET', token
  });
  const receiptsBeforeJson = requireOk(receiptsBefore, 'receipts before duplicate dispatch');
  const receiptCountBefore = countReceiptsByCommand(receiptsBeforeJson.items ?? [], commandId);

  const factsBefore = await exportFacts(base, token, chainStartTs, Date.now() + 2_000, field_id);
  const transitionCountBefore = factsBefore.filter((item) => {
    const record = item?.record_json ?? {};
    const payload = record?.payload ?? {};
    return String(record?.type ?? '') === 'operation_plan_transition_v1'
      && String(payload?.operation_plan_id ?? '') === String(subJson.operation_plan_id)
      && String(payload?.status ?? '').toUpperCase() === 'RECEIPTED';
  }).length;

  const dispatch2 = await fetchJson(`${base}/api/v1/ao-act/tasks/${encodeURIComponent(actTaskId)}/dispatch`, {
    method: 'POST', token,
    body: { tenant_id, project_id, group_id, command_id: commandId, adapter_hint: 'mqtt', device_id }
  });
  assert.strictEqual(dispatch2.status, 400, `expected duplicate dispatch to be rejected with 400, got ${dispatch2.status}`);
  assert.strictEqual(String(dispatch2.json?.error ?? ''), 'TASK_ALREADY_HAS_RECEIPT', `unexpected duplicate dispatch error=${dispatch2.text}`);
  console.log('PASS duplicate dispatch blocked');

  const receiptsAfter = await fetchJson(`${base}/api/v1/ao-act/receipts?tenant_id=${encodeURIComponent(tenant_id)}&project_id=${encodeURIComponent(project_id)}&group_id=${encodeURIComponent(group_id)}&act_task_id=${encodeURIComponent(actTaskId)}&limit=20`, {
    method: 'GET', token
  });
  const receiptsAfterJson = requireOk(receiptsAfter, 'receipts after duplicate dispatch');
  const receiptCountAfter = countReceiptsByCommand(receiptsAfterJson.items ?? [], commandId);
  assert.strictEqual(receiptCountAfter, receiptCountBefore, `duplicate dispatch should not create duplicate receipt; before=${receiptCountBefore} after=${receiptCountAfter}`);
  console.log('PASS no duplicate receipt created');

  const factsAfter = await exportFacts(base, token, chainStartTs, Date.now() + 4_000, field_id);
  const transitionCountAfter = factsAfter.filter((item) => {
    const record = item?.record_json ?? {};
    const payload = record?.payload ?? {};
    return String(record?.type ?? '') === 'operation_plan_transition_v1'
      && String(payload?.operation_plan_id ?? '') === String(subJson.operation_plan_id)
      && String(payload?.status ?? '').toUpperCase() === 'RECEIPTED';
  }).length;
  assert.strictEqual(transitionCountAfter, transitionCountBefore, `duplicate dispatch should not append operation_plan_transition_v1; before=${transitionCountBefore} after=${transitionCountAfter}`);
  console.log('PASS operation plan transition not duplicated');

  console.log('PASS ACCEPTANCE_AGRONOMY_DUPLICATE_DISPATCH_NEGATIVE_V1');
})().catch((e) => {
  console.error('FAIL ACCEPTANCE_AGRONOMY_DUPLICATE_DISPATCH_NEGATIVE_V1', e);
  if (e?.stack) console.error(e.stack);
  process.exit(1);
});
