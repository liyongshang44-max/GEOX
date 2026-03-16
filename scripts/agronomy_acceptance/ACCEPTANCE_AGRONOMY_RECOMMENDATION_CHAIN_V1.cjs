const { assert, env, fetchJson, requireOk } = require('./_common.cjs');

async function pollJob(base, token, jobId, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const st = await fetchJson(`${base}/api/v1/evidence-export/jobs/${encodeURIComponent(jobId)}`, { token });
    const stJson = requireOk(st, 'evidence export status');
    const job = stJson.job || {};
    if (job.status === 'DONE') return job;
    if (job.status === 'ERROR') throw new Error(`export job failed body=${st.text}`);
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`export job timeout job_id=${jobId}`);
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

  const generateBody = {
    tenant_id,
    project_id,
    group_id,
    field_id,
    season_id,
    device_id,
    telemetry: { soil_moisture_pct: 22, canopy_temp_c: 34 },
    image_recognition: { stress_score: 0.8, disease_score: 0.2, pest_risk_score: 0.1, confidence: 0.92 }
  };

  const gen = await fetchJson(`${base}/api/v1/recommendations/generate`, { method: 'POST', token, body: generateBody });
  const genJson = requireOk(gen, 'generate recommendation chain');
  assert.ok(Array.isArray(genJson.recommendations) && genJson.recommendations.length >= 1, 'recommendations empty');
  const recommendation = genJson.recommendations[0];
  assert.ok(recommendation?.recommendation_id, 'recommendation_id missing');

  const submitBody = {
    tenant_id,
    project_id,
    group_id,
    rationale: 'acceptance recommendation approval chain'
  };
  const submit = await fetchJson(`${base}/api/v1/recommendations/${encodeURIComponent(recommendation.recommendation_id)}/submit-approval`, {
    method: 'POST', token, body: submitBody
  });
  const submitJson = requireOk(submit, 'submit approval from recommendation');
  assert.ok(submitJson.approval_request_id, 'approval_request_id missing');
  assert.ok(submitJson.mapping_fact_id, 'mapping_fact_id missing');

  const exportJob = await fetchJson(`${base}/api/v1/evidence-export/jobs`, {
    method: 'POST',
    token,
    body: {
      scope_type: 'TENANT',
      export_format: 'JSON',
      export_language: 'zh-CN',
      from_ts_ms: 0,
      to_ts_ms: 9999999999999,
    }
  });
  const exportJobJson = requireOk(exportJob, 'create evidence export');
  assert.ok(exportJobJson.job_id, 'job_id missing');

  const job = await pollJob(base, token, exportJobJson.job_id);
  const download = await fetch(`${base}/api/v1/evidence-export/jobs/${encodeURIComponent(exportJobJson.job_id)}/download?part=bundle`, {
    headers: token ? { authorization: `Bearer ${token}` } : {}
  });
  const text = await download.text();
  assert.equal(download.ok, true, `download bundle status=${download.status} body=${text.slice(0, 300)}`);
  assert.ok(text.includes('decision_recommendation_v1'), 'bundle missing decision_recommendation_v1');
  assert.ok(text.includes('decision_recommendation_approval_link_v1'), 'bundle missing decision_recommendation_approval_link_v1');
  assert.ok(text.includes('approval_request_v1'), 'bundle missing approval_request_v1');
  assert.ok(text.includes(recommendation.recommendation_id), 'bundle missing generated recommendation_id');
  assert.ok(text.includes(submitJson.approval_request_id), 'bundle missing approval_request_id');
  console.log('PASS recommendation approval export chain acceptance', {
    recommendation_id: recommendation.recommendation_id,
    approval_request_id: submitJson.approval_request_id,
    job_id: job.job_id || exportJobJson.job_id,
  });
})().catch((e) => {
  console.error('FAIL recommendation approval export chain acceptance', e.message);
  process.exit(1);
});
