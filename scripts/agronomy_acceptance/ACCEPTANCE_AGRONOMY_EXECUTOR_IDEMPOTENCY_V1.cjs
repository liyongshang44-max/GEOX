const { assert, env, fetchJson, requireOk } = require('./_common.cjs');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);

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

function countOperationPlanTransitions(items, operationPlanId) {
  return items.filter((item) => {
    const record = item?.record_json ?? {};
    const payload = record?.payload ?? {};
    return String(record?.type ?? '') === 'operation_plan_transition_v1'
      && String(payload?.operation_plan_id ?? '') === String(operationPlanId);
  }).length;
}

function countReceiptFactsByCommandOrTask(items, commandId, actTaskId) {
  return items.filter((item) => {
    const record = item?.record_json ?? {};
    const payload = record?.payload ?? {};
    if (String(record?.type ?? '') !== 'ao_act_receipt_v0') return false;
    const receiptCommandId = String(payload?.command_id ?? payload?.meta?.command_id ?? '').trim();
    const receiptTaskId = String(payload?.act_task_id ?? payload?.task_id ?? '').trim();
    return receiptCommandId === commandId || receiptTaskId === actTaskId;
  }).length;
}

async function runDispatchExecutorOnce({ base, token, tenant_id, project_id, group_id, executorId }) {
  const run = await execFileAsync('pnpm', [
    '--filter', '@geox/executor', 'exec', 'tsx', 'src/run_dispatch_once.ts',
    '--baseUrl', base,
    '--token', token,
    '--tenant_id', tenant_id,
    '--project_id', project_id,
    '--group_id', group_id,
    '--executor_id', executorId,
    '--limit', '10'
  ], { cwd: process.cwd(), env: process.env });

  return {
    code: 0,
    output: `${run.stdout || ''}\n${run.stderr || ''}`
  };
}

(async () => {
  const base = env('BASE_URL', 'http://127.0.0.1:3001');
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
      tenant_id,
      project_id,
      group_id,
      field_id,
      season_id,
      device_id,
      telemetry: { soil_moisture_pct: 19, canopy_temp_c: 34 },
      image_recognition: { stress_score: 0.64, disease_score: 0.42, pest_risk_score: 0.31, confidence: 0.9 }
    }
  });
  const recJson = requireOk(recGen, 'generate');
  const recId = recJson.recommendations?.[0]?.recommendation_id;
  assert.ok(recId, 'recommendation_id missing');

  const submit = await fetchJson(`${base}/api/v1/recommendations/${encodeURIComponent(recId)}/submit-approval`, {
    method: 'POST',
    token,
    body: { tenant_id, project_id, group_id }
  });
  const subJson = requireOk(submit, 'submit approval');
  assert.ok(subJson.approval_request_id, 'approval_request_id missing');
  assert.ok(subJson.operation_plan_id, 'operation_plan_id missing');

  const decide = await fetchJson(`${base}/api/v1/approvals/${encodeURIComponent(subJson.approval_request_id)}/decide`, {
    method: 'POST',
    token,
    body: {
      tenant_id,
      project_id,
      group_id,
      decision: 'APPROVE',
      reason: 'agronomy executor idempotency acceptance'
    }
  });
  const decideJson = requireOk(decide, 'approval decide');
  const actTaskId = String(decideJson.act_task_id ?? '');
  assert.ok(actTaskId, 'act_task_id missing after approve');
  const commandId = actTaskId;

  const executorId = `agronomy_executor_idempotency_${Date.now()}`;
  const run1 = await runDispatchExecutorOnce({ base, token, tenant_id, project_id, group_id, executorId });
  assert.equal(run1.code, 0, `first executor run must succeed; output=${run1.output}`);
  const run1MatchedCommand = run1.output.includes(`command_id=${commandId}`);

  const receiptsAfterRun1 = await fetchJson(`${base}/api/v1/ao-act/receipts?tenant_id=${encodeURIComponent(tenant_id)}&project_id=${encodeURIComponent(project_id)}&group_id=${encodeURIComponent(group_id)}&act_task_id=${encodeURIComponent(actTaskId)}&limit=20`, {
    method: 'GET',
    token
  });
  const receiptsAfterRun1Json = requireOk(receiptsAfterRun1, 'receipts after first executor run');
  const receiptCountAfterRun1 = countReceiptsByCommand(receiptsAfterRun1Json.items ?? [], commandId);

  const factsAfterRun1 = await exportFacts(base, token, chainStartTs, Date.now() + 2_000, field_id);
  const transitionCountAfterRun1 = countOperationPlanTransitions(factsAfterRun1, subJson.operation_plan_id);
  const exportReceiptFactCountAfterRun1 = countReceiptFactsByCommandOrTask(factsAfterRun1, commandId, actTaskId);

  assert.ok(
    run1MatchedCommand || transitionCountAfterRun1 >= 1 || exportReceiptFactCountAfterRun1 >= 1,
    `first executor run should show progress by command log/transition/receipt-fact; run1_matched=${run1MatchedCommand} transition_count=${transitionCountAfterRun1} export_receipt_count=${exportReceiptFactCountAfterRun1}; output=${run1.output}; receipts=${receiptsAfterRun1.text}`
  );

  const run2 = await runDispatchExecutorOnce({ base, token, tenant_id, project_id, group_id, executorId });
  assert.equal(run2.code, 0, `second executor run must succeed as no-op; output=${run2.output}`);
  const dispatchedAgain = run2.output.includes(`dispatching act_task_id=${actTaskId}`) && run2.output.includes(`command_id=${commandId}`);
  assert.equal(dispatchedAgain, false, `same command_id must not be re-dispatched; output=${run2.output}`);
  console.log('PASS duplicate dispatch blocked');
  console.log('PASS same command_id not re-dispatched');

  const receiptsAfterRun2 = await fetchJson(`${base}/api/v1/ao-act/receipts?tenant_id=${encodeURIComponent(tenant_id)}&project_id=${encodeURIComponent(project_id)}&group_id=${encodeURIComponent(group_id)}&act_task_id=${encodeURIComponent(actTaskId)}&limit=20`, {
    method: 'GET',
    token
  });
  const receiptsAfterRun2Json = requireOk(receiptsAfterRun2, 'receipts after second executor run');
  const receiptCountAfterRun2 = countReceiptsByCommand(receiptsAfterRun2Json.items ?? [], commandId);
  assert.strictEqual(
    receiptCountAfterRun2,
    receiptCountAfterRun1,
    `second executor run must not append duplicate receipt; before=${receiptCountAfterRun1} after=${receiptCountAfterRun2}`
  );
  console.log('PASS no duplicate receipt created');

  const factsAfterRun2 = await exportFacts(base, token, chainStartTs, Date.now() + 4_000, field_id);
  const transitionCountAfterRun2 = countOperationPlanTransitions(factsAfterRun2, subJson.operation_plan_id);
  assert.strictEqual(
    transitionCountAfterRun2,
    transitionCountAfterRun1,
    `second executor run must not append operation_plan transitions; before=${transitionCountAfterRun1} after=${transitionCountAfterRun2}`
  );
  console.log('PASS no duplicate operation_plan transition');

  console.log('PASS ACCEPTANCE_AGRONOMY_EXECUTOR_IDEMPOTENCY_V1');
})().catch((e) => {
  console.error('FAIL ACCEPTANCE_AGRONOMY_EXECUTOR_IDEMPOTENCY_V1', e);
  if (e?.stack) console.error(e.stack);
  process.exit(1);
});