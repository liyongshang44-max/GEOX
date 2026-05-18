const assert = require('node:assert/strict');

const baseUrl = process.env.SAMPLING_API_BASE_URL || process.env.API_BASE_URL || 'http://127.0.0.1:3000';
const token = process.env.ADMIN_TOKEN || process.env.AO_ACT_TOKEN || 'admin_token';
const tenantScope = {
  tenant_id: process.env.TENANT_ID || 'tenantA',
  project_id: process.env.PROJECT_ID || 'projectA',
  group_id: process.env.GROUP_ID || 'groupA',
};

async function postJson(path, body, withAuth = true) {
  const headers = { 'content-type': 'application/json' };
  if (withAuth) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}

async function main() {
  const mode = 'live';
  const health = await fetch(`${baseUrl}/api/v1/health`, { method: 'GET' }).catch(() => null);
  if (!health || !health.ok) throw new Error(`live API unavailable at ${baseUrl}`);

  const checks = {
    plan_created: false,
    receipt_requires_existing_plan: false,
    receipt_requires_evidence_refs: false,
    lab_result_requires_existing_sample: false,
    lab_result_requires_evidence_refs: false,
    invalid_quality_status_blocked: false,
    sample_lookup_works: false,
    missing_auth_rejected: false,
    cross_tenant_hidden_404: false,
  };

  const now = Date.now();
  const ids = {
    field_id: `f-${now}`,
    sample_id: `s-${now}`,
  };
  const scopedBody = { ...tenantScope, ...ids };

  const missingAuth = await postJson('/api/v1/sampling/plan', {
    ...scopedBody,
    reason: 'BASELINE',
    sample_type: 'SOIL',
    required_points: 3,
    evidence_refs: [],
  }, false);
  assert.equal(missingAuth.status, 401, 'missing authorization should be rejected with 401');
  checks.missing_auth_rejected = true;

  const crossTenant = await postJson('/api/v1/sampling/plan', {
    ...scopedBody,
    tenant_id: `${tenantScope.tenant_id}_other`,
    reason: 'BASELINE',
    sample_type: 'SOIL',
    required_points: 3,
    evidence_refs: [],
  });
  assert.equal(crossTenant.status, 404, 'cross-tenant scope should return 404');
  checks.cross_tenant_hidden_404 = true;

  const planRes = await postJson('/api/v1/sampling/plan', {
    ...scopedBody,
    reason: 'BASELINE',
    sample_type: 'SOIL',
    required_points: 3,
    evidence_refs: [],
  });
  assert.equal(planRes.status, 200, 'plan create should succeed');
  assert.equal(planRes.json?.ok, true, 'plan create ok=true');
  assert.ok(planRes.json?.plan_id, 'plan_id required');
  checks.plan_created = true;

  const badPlanReceipt = await postJson('/api/v1/sampling/receipt', {
    plan_id: 'missing-plan-id',
    sample_id: `${ids.sample_id}-x`,
    ...scopedBody,
    collected_at_ts: now,
    collector_actor_id: 'collector-1',
    sample_type: 'SOIL',
    evidence_refs: [{ kind: 'raw_sample_v1', ref_id: 'raw-1' }],
    chain_of_custody_status: 'RECORDED',
  });
  assert.ok(badPlanReceipt.status >= 400 && badPlanReceipt.status < 500, 'receipt requires existing plan');
  checks.receipt_requires_existing_plan = true;

  const receiptNoEvidence = await postJson('/api/v1/sampling/receipt', {
    plan_id: planRes.json.plan_id,
    sample_id: `${ids.sample_id}-no-evi`,
    ...scopedBody,
    collected_at_ts: now,
    collector_actor_id: 'collector-1',
    sample_type: 'SOIL',
    evidence_refs: [],
    chain_of_custody_status: 'RECORDED',
  });
  assert.ok(receiptNoEvidence.status >= 400 && receiptNoEvidence.status < 500, 'receipt requires evidence_refs');
  checks.receipt_requires_evidence_refs = true;

  const goodReceipt = await postJson('/api/v1/sampling/receipt', {
    plan_id: planRes.json.plan_id,
    sample_id: ids.sample_id,
    ...scopedBody,
    collected_at_ts: now,
    collector_actor_id: 'collector-1',
    sample_type: 'SOIL',
    evidence_refs: [{ kind: 'raw_sample_v1', ref_id: 'raw-1' }],
    chain_of_custody_status: 'RECORDED',
  });
  assert.equal(goodReceipt.status, 200, 'good receipt should succeed');

  const labMissingSample = await postJson('/api/v1/sampling/lab-result', {
    sample_id: 'missing-sample',
    imported_at_ts: now,
    metrics: { ph: 6.5 },
    units: { ph: 'pH' },
    evidence_refs: [{ kind: 'import_run_v1', ref_id: 'import-1' }],
    quality_status: 'PASS',
  });
  assert.ok(labMissingSample.status >= 400 && labMissingSample.status < 500, 'lab result requires existing sample');
  checks.lab_result_requires_existing_sample = true;

  const labNoEvidence = await postJson('/api/v1/sampling/lab-result', {
    sample_id: ids.sample_id,
    imported_at_ts: now,
    metrics: { ph: 6.7 },
    units: { ph: 'pH' },
    evidence_refs: [],
    quality_status: 'PASS',
  });
  assert.ok(labNoEvidence.status >= 400 && labNoEvidence.status < 500, 'lab result requires evidence_refs');
  checks.lab_result_requires_evidence_refs = true;

  const labInvalidQuality = await postJson('/api/v1/sampling/lab-result', {
    sample_id: ids.sample_id,
    imported_at_ts: now,
    metrics: { ph: 6.9 },
    units: { ph: 'pH' },
    evidence_refs: [{ kind: 'import_run_v1', ref_id: 'import-2' }],
    quality_status: 'BAD',
  });
  assert.ok(labInvalidQuality.status >= 400 && labInvalidQuality.status < 500, 'invalid quality status blocked');
  checks.invalid_quality_status_blocked = true;

  const sampleLookup = await fetch(`${baseUrl}/api/v1/sampling/sample/${ids.sample_id}`, { method: 'GET', headers: { authorization: `Bearer ${token}` } });
  assert.equal(sampleLookup.status, 200, 'sample lookup should succeed for created sample');
  checks.sample_lookup_works = true;

  const acceptanceMissingPlan = await postJson('/api/v1/sampling/acceptance/evaluate', {
    plan_id: 'missing-plan-id',
    sample_id: ids.sample_id,
  });
  assert.equal(acceptanceMissingPlan.status, 404, 'acceptance evaluate must return 404 when plan does not exist');
  checks.acceptance_requires_existing_plan = true;

  console.log(JSON.stringify({ ok: true, suite: 'ACCEPTANCE_SAMPLING_API_V1', mode, checks }, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, suite: 'ACCEPTANCE_SAMPLING_API_V1', error: String(err && err.message ? err.message : err) }, null, 2));
  process.exit(1);
});
