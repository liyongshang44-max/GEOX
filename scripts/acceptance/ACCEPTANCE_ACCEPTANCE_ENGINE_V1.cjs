#!/usr/bin/env node

function requiredEnv(name) {
  const v = String(process.env[name] ?? '').trim();
  if (!v) throw new Error(`MISSING_ENV:${name}`);
  return v;
}

const base = String(process.env.GEOX_BASE_URL || 'http://127.0.0.1:3000').trim();
const token = requiredEnv('AO_ACT_TOKEN');
const tenant_id = requiredEnv('GEOX_TENANT_ID');
const project_id = requiredEnv('GEOX_PROJECT_ID');
const group_id = requiredEnv('GEOX_GROUP_ID');

async function api(path, opts = {}) {
  const headers = {
    'content-type': 'application/json',
    authorization: `Bearer ${token}`,
    ...(opts.headers || {}),
  };
  for (const k of Object.keys(headers)) {
    if (headers[k] === undefined || headers[k] === null) delete headers[k];
  }
  const r = await fetch(`${base}${path}`, {
    ...opts,
    headers,
  });
  const text = await r.text();
  const json = text ? JSON.parse(text) : {};
  if (!r.ok) throw new Error(`${path} -> ${r.status} ${text}`);
  return json;
}

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function waitEvidenceJobDone(job_id, timeoutMs = 60000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const detail = await api(`/api/v1/evidence-export/jobs/${encodeURIComponent(job_id)}`, { method: 'GET' });
    const item = detail?.item ?? {};
    const status = String(item.status ?? '').toUpperCase();
    if (status === 'DONE') return item;
    if (status === 'ERROR') throw new Error(`EVIDENCE_JOB_ERROR:${JSON.stringify(item)}`);
    await sleep(500);
  }
  throw new Error(`EVIDENCE_JOB_TIMEOUT:${job_id}`);
}

(async () => {
  const seed = Date.now();
  const act_task_id = `act_accept_${seed}`;
  const operation_plan_id = `op_accept_${seed}`;

  const expectedDuration = 10;
  const actualDuration = 8; // ratio=0.8 => PASSED
  const now = Date.now();

  const taskRecord = {
    type: 'ao_act_task_v0',
    payload: {
      tenant_id,
      project_id,
      group_id,
      act_task_id,
      operation_plan_id,
      action_type: 'IRRIGATE',
      parameters: { duration_min: expectedDuration },
      created_at_ts: now,
    },
    entity: { tenant_id, project_id, group_id },
  };

  const receiptRecord = {
    type: 'ao_act_receipt_v0',
    payload: {
      tenant_id,
      project_id,
      group_id,
      operation_plan_id,
      act_task_id,
      execution_time: { start_ts: now, end_ts: now + actualDuration * 60 * 1000 },
      observed_parameters: { duration_min: actualDuration },
      created_at_ts: now + 1,
    },
    entity: { tenant_id, project_id, group_id },
  };

  await api('/api/raw', {
    method: 'POST',
    body: JSON.stringify({ source: 'system', record_json: taskRecord }),
  });

  await api('/api/raw', {
    method: 'POST',
    body: JSON.stringify({ source: 'system', record_json: receiptRecord }),
  });

  const evaluation = await api('/api/v1/acceptance/evaluate', {
    method: 'POST',
    body: JSON.stringify({ tenant_id, project_id, group_id, act_task_id }),
  });

  if (evaluation?.ok !== true) throw new Error('ACCEPTANCE_API_NOT_OK');
  if (evaluation?.result !== 'PASSED') throw new Error(`UNEXPECTED_RESULT:${evaluation?.result}`);

  const results = await api(`/api/v1/acceptance/results?tenant_id=${encodeURIComponent(tenant_id)}&project_id=${encodeURIComponent(project_id)}&group_id=${encodeURIComponent(group_id)}&act_task_id=${encodeURIComponent(act_task_id)}&limit=5`, {
    method: 'GET',
  });

  const first = Array.isArray(results?.items) ? results.items[0] : null;
  if (!first) throw new Error('MISSING_ACCEPTANCE_RESULT_V1');
  const payload = first?.record_json?.payload ?? {};
  if (String(payload?.result ?? '') !== 'PASSED') throw new Error(`READBACK_RESULT_MISMATCH:${payload?.result}`);
  if (typeof payload?.metrics?.actual_duration !== 'number') throw new Error('MISSING_METRICS_ACTUAL_DURATION');

  const evJob = await api('/api/v1/evidence-export/jobs', {
    method: 'POST',
    body: JSON.stringify({
      scope_type: 'TENANT',
      from_ts_ms: now - 30_000,
      to_ts_ms: Date.now() + 30_000,
      export_format: 'JSON',
      export_language: 'en-US',
    }),
  });

  const job_id = String(evJob?.job_id ?? '').trim();
  if (!job_id) throw new Error('MISSING_EVIDENCE_JOB_ID');

  const done = await waitEvidenceJobDone(job_id, 90_000);
  const downloadPath = String(done?.evidence_pack?.files?.find((f) => f?.download_part === 'bundle')?.download_path ?? '').trim();
  if (!downloadPath) throw new Error('MISSING_EVIDENCE_BUNDLE_DOWNLOAD_PATH');

  const bundle = await api(downloadPath, { method: 'GET', headers: { 'content-type': null } });
  const acceptanceRows = Array.isArray(bundle?.acceptance_results) ? bundle.acceptance_results : [];
  const hit = acceptanceRows.find((row) => String(row?.record_json?.payload?.act_task_id ?? '') === act_task_id);
  if (!hit) throw new Error('EVIDENCE_BUNDLE_MISSING_ACCEPTANCE_RESULT');

  console.log('PASS ACCEPTANCE_ACCEPTANCE_ENGINE_V1', {
    act_task_id,
    acceptance_fact_id: first.fact_id,
    result: payload.result,
    score: payload.score,
    metrics: payload.metrics,
    evidence_job_id: job_id,
  });
})().catch((e) => {
  console.error('FAIL ACCEPTANCE_ACCEPTANCE_ENGINE_V1', e?.message || e);
  process.exit(1);
});
