const assert = require('node:assert/strict');
const { Pool } = require('pg');
const { waitForHealth } = require('./_common.cjs');

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
async function postJsonWithAuth(path, body, authHeader) {
  const headers = { 'content-type': 'application/json' };
  if (authHeader != null) headers.authorization = authHeader;
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
  await waitForHealth(baseUrl);

  const checks = {
    plan_created: false,
    receipt_requires_existing_plan: false,
    receipt_requires_evidence_refs: false,
    lab_result_requires_existing_sample: false,
    lab_result_requires_evidence_refs: false,
    invalid_quality_status_blocked: false,
    sample_lookup_works: false,
    duplicate_sample_id_rejected_409: false,
    legacy_receipt_duplicate_blocked_409: false,
    concurrent_duplicate_sample_id_serialized: false,
    concurrent_acceptance_identity_stable: false,
    shared_import_id_is_chain_local: false,
    sample_id_reuse_across_plans_allowed: false,
    ambiguous_sample_locator_requires_exact_receipt_ref: false,
    auth_missing_rejected_401: false,
    auth_invalid_rejected_401: false,
    tenant_boundary_rejected_404: false,
  };

  const now = Date.now();
  const ids = {
    field_id: `f-${now}`,
    sample_id: `s-${now}`,
  };
  const scopedBody = { ...tenantScope, ...ids };

  const crossTenantPlan = await postJson('/api/v1/sampling/plan', {
    ...scopedBody,
    tenant_id: `${tenantScope.tenant_id}_other`,
    reason: 'MANUAL_REQUEST',
    sample_type: 'SOIL',
    required_points: 3,
    evidence_refs: [],
  });
  assert.equal(crossTenantPlan.status, 404, 'cross-tenant scope should return 404');
  checks.tenant_boundary_rejected_404 = true;

  const planRes = await postJson('/api/v1/sampling/plan', {
    ...scopedBody,
    reason: 'MANUAL_REQUEST',
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

  const duplicateReceipt = await postJson('/api/v1/sampling/receipt', {
    plan_id: planRes.json.plan_id,
    sample_id: ids.sample_id,
    ...scopedBody,
    collected_at_ts: now + 1,
    collector_actor_id: 'collector-duplicate',
    sample_type: 'SOIL',
    evidence_refs: [{ kind: 'raw_sample_v1', ref_id: 'raw-duplicate' }],
    chain_of_custody_status: 'RECORDED',
  });
  assert.equal(duplicateReceipt.status, 409, 'duplicate sample_id must fail closed with 409');
  assert.equal(duplicateReceipt.json?.error, 'DUPLICATE:sample_id', 'duplicate sample_id error code mismatch');
  checks.duplicate_sample_id_rejected_409 = true;

  const legacySampleId = `${ids.sample_id}-legacy-format`;
  const legacyFactId = `legacy_sr_${now}`;
  const databaseUrl = process.env.DATABASE_URL;
  assert.ok(databaseUrl, 'DATABASE_URL required for legacy receipt regression');
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    await pool.query(
      `INSERT INTO facts (fact_id, occurred_at, source, record_json)
       VALUES ($1, now(), 'sampling-legacy-regression', $2::jsonb)
       ON CONFLICT (fact_id) DO UPDATE SET record_json = EXCLUDED.record_json, occurred_at = now()`,
      [
        legacyFactId,
        JSON.stringify({
          type: 'sample_receipt_v1',
          schema_version: '1',
          sample_id: legacySampleId,
          plan_id: planRes.json.plan_id,
          tenant_id: tenantScope.tenant_id,
          project_id: tenantScope.project_id,
          group_id: tenantScope.group_id,
          field_id: ids.field_id,
          collected_at_ts: now - 1,
          collector_actor_id: 'legacy-collector',
          sample_type: 'SOIL',
          evidence_refs: [{ kind: 'raw_sample_v1', ref_id: 'legacy-raw' }],
          chain_of_custody_status: 'RECORDED',
        }),
      ],
    );

    const legacyDuplicate = await postJson('/api/v1/sampling/receipt', {
      ...scopedBody,
      plan_id: planRes.json.plan_id,
      sample_id: legacySampleId,
      collected_at_ts: now + 2,
      collector_actor_id: 'collector-after-legacy',
      sample_type: 'SOIL',
      evidence_refs: [{ kind: 'raw_sample_v1', ref_id: 'raw-after-legacy' }],
      chain_of_custody_status: 'RECORDED',
    });
    assert.equal(legacyDuplicate.status, 409, 'legacy receipt must block deterministic duplicate creation');
    assert.equal(legacyDuplicate.json?.error, 'DUPLICATE:sample_id', 'legacy receipt duplicate error code mismatch');
    checks.legacy_receipt_duplicate_blocked_409 = true;
  } finally {
    await pool.query('DELETE FROM facts WHERE fact_id = $1', [legacyFactId]).catch(() => undefined);
    await pool.end();
  }

  const concurrentSampleId = `${ids.sample_id}-concurrent`;
  const concurrentReceiptBody = {
    ...scopedBody,
    plan_id: planRes.json.plan_id,
    sample_id: concurrentSampleId,
    collected_at_ts: now + 10,
    collector_actor_id: 'collector-concurrent',
    sample_type: 'SOIL',
    evidence_refs: [{ kind: 'raw_sample_v1', ref_id: 'raw-concurrent' }],
    chain_of_custody_status: 'RECORDED',
  };
  const concurrentReceipts = await Promise.all([
    postJson('/api/v1/sampling/receipt', concurrentReceiptBody),
    postJson('/api/v1/sampling/receipt', concurrentReceiptBody),
  ]);
  const concurrentReceiptStatuses = concurrentReceipts.map((x) => x.status).sort((a, b) => a - b);
  assert.deepEqual(concurrentReceiptStatuses, [200, 409], 'concurrent duplicate receipt creation must serialize to one success and one 409');
  const concurrentReceiptConflict = concurrentReceipts.find((x) => x.status === 409);
  const concurrentReceiptSuccess = concurrentReceipts.find((x) => x.status === 200);
  assert.equal(concurrentReceiptConflict?.json?.error, 'DUPLICATE:sample_id', 'concurrent duplicate receipt must use DUPLICATE:sample_id');
  assert.ok(concurrentReceiptSuccess?.json?.fact_id, 'concurrent receipt winner fact_id required');
  checks.concurrent_duplicate_sample_id_serialized = true;

  const sharedImportId = `shared-import-${now}`;
  const concurrentLab = await postJson('/api/v1/sampling/lab-result', {
    sample_id: concurrentSampleId,
    sample_receipt_fact_id: concurrentReceiptSuccess.json.fact_id,
    import_id: sharedImportId,
    imported_at_ts: now + 20,
    metrics: { ph: 6.6, nitrate_n_mg_kg: 2.4 },
    units: { ph: 'pH', nitrate_n_mg_kg: 'mg/kg' },
    evidence_refs: [{ kind: 'import_run_v1', ref_id: 'import-concurrent' }],
    quality_status: 'PASS',
  });
  assert.equal(concurrentLab.status, 200, 'lab result after concurrent receipt serialization must succeed');

  const concurrentAcceptanceBody = {
    plan_id: planRes.json.plan_id,
    sample_id: concurrentSampleId,
    import_id: concurrentLab.json?.import_id,
  };
  const concurrentAcceptances = await Promise.all([
    postJson('/api/v1/sampling/acceptance/evaluate', concurrentAcceptanceBody),
    postJson('/api/v1/sampling/acceptance/evaluate', concurrentAcceptanceBody),
  ]);
  assert.deepEqual(concurrentAcceptances.map((x) => x.status), [200, 200], 'concurrent exact-chain acceptance evaluation must succeed idempotently');
  assert.ok(concurrentAcceptances[0].json?.fact_id, 'concurrent acceptance fact_id required');
  assert.equal(concurrentAcceptances[1].json?.fact_id, concurrentAcceptances[0].json?.fact_id, 'concurrent acceptance must converge on one fact_id');
  assert.equal(concurrentAcceptances[1].json?.acceptance_id, concurrentAcceptances[0].json?.acceptance_id, 'concurrent acceptance must converge on one acceptance_id');
  assert.deepEqual(
    concurrentAcceptances.map((x) => x.json?.idempotent).sort(),
    [false, true],
    'concurrent exact-chain acceptance must have one creator and one idempotent observer',
  );
  checks.concurrent_acceptance_identity_stable = true;

  const sharedImportSecondSampleId = `${ids.sample_id}-shared-import-second`;
  const sharedImportSecondReceipt = await postJson('/api/v1/sampling/receipt', {
    ...scopedBody,
    plan_id: planRes.json.plan_id,
    sample_id: sharedImportSecondSampleId,
    collected_at_ts: now + 30,
    collector_actor_id: 'collector-shared-import-second',
    sample_type: 'SOIL',
    evidence_refs: [{ kind: 'raw_sample_v1', ref_id: 'raw-shared-import-second' }],
    chain_of_custody_status: 'RECORDED',
  });
  assert.equal(sharedImportSecondReceipt.status, 200, 'second sample for shared import identity must succeed');
  const sharedImportSecondLab = await postJson('/api/v1/sampling/lab-result', {
    sample_id: sharedImportSecondSampleId,
    sample_receipt_fact_id: sharedImportSecondReceipt.json?.fact_id,
    import_id: sharedImportId,
    imported_at_ts: now + 40,
    metrics: { ph: 6.8, nitrate_n_mg_kg: 2.2 },
    units: { ph: 'pH', nitrate_n_mg_kg: 'mg/kg' },
    evidence_refs: [{ kind: 'import_run_v1', ref_id: 'import-shared-second' }],
    quality_status: 'PASS',
  });
  assert.equal(sharedImportSecondLab.status, 200, 'same business import_id on a different exact sample chain must not collide');
  assert.notEqual(sharedImportSecondLab.json?.fact_id, concurrentLab.json?.fact_id, 'shared business import_id across different exact chains must produce distinct fact identities');
  checks.shared_import_id_is_chain_local = true;

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

  const reusePlan = await postJson('/api/v1/sampling/plan', {
    ...scopedBody,
    reason: 'MANUAL_REQUEST',
    sample_type: 'SOIL',
    required_points: 2,
    evidence_refs: [],
  });
  assert.equal(reusePlan.status, 200, 'second plan for same business sample id must succeed');
  const reusedSampleReceipt = await postJson('/api/v1/sampling/receipt', {
    ...scopedBody,
    plan_id: reusePlan.json?.plan_id,
    sample_id: ids.sample_id,
    collected_at_ts: now + 50,
    collector_actor_id: 'collector-reused-sample-id',
    sample_type: 'SOIL',
    evidence_refs: [{ kind: 'raw_sample_v1', ref_id: 'raw-reused-sample-id' }],
    chain_of_custody_status: 'RECORDED',
  });
  assert.equal(reusedSampleReceipt.status, 200, 'same sample_id on a different exact plan must be allowed');
  assert.notEqual(reusedSampleReceipt.json?.fact_id, goodReceipt.json?.fact_id, 'same sample_id on different plans must have distinct receipt fact identities');
  checks.sample_id_reuse_across_plans_allowed = true;

  const ambiguousLab = await postJson('/api/v1/sampling/lab-result', {
    sample_id: ids.sample_id,
    imported_at_ts: now + 60,
    metrics: { ph: 6.4 },
    units: { ph: 'pH' },
    evidence_refs: [{ kind: 'import_run_v1', ref_id: 'import-ambiguous-sample' }],
    quality_status: 'PASS',
  });
  assert.equal(ambiguousLab.status, 409, 'sample_id-only lab import must fail when more than one receipt matches');
  assert.equal(ambiguousLab.json?.error, 'AMBIGUOUS:sample_receipt_v1', 'ambiguous sample locator must expose receipt ambiguity');

  const exactReceiptLab = await postJson('/api/v1/sampling/lab-result', {
    sample_id: ids.sample_id,
    sample_receipt_fact_id: goodReceipt.json?.fact_id,
    import_id: `exact-receipt-import-${now}`,
    imported_at_ts: now + 70,
    metrics: { ph: 6.4 },
    units: { ph: 'pH' },
    evidence_refs: [{ kind: 'import_run_v1', ref_id: 'import-exact-receipt' }],
    quality_status: 'PASS',
  });
  assert.equal(exactReceiptLab.status, 200, 'exact sample_receipt_fact_id must resolve lab import despite business-id ambiguity');
  assert.equal(exactReceiptLab.json?.sample_receipt_fact_id, goodReceipt.json?.fact_id, 'lab result must echo the exact receipt fact binding');
  checks.ambiguous_sample_locator_requires_exact_receipt_ref = true;

  const noAuth = await postJsonWithAuth('/api/v1/sampling/plan', {
    ...scopedBody,
    reason: 'MANUAL_REQUEST',
    sample_type: 'SOIL',
    required_points: 1,
    evidence_refs: [],
  }, null);
  assert.equal(noAuth.status, 401, 'missing authorization must be 401');
  checks.auth_missing_rejected_401 = true;

  const badAuth = await postJsonWithAuth('/api/v1/sampling/plan', {
    ...scopedBody,
    reason: 'MANUAL_REQUEST',
    sample_type: 'SOIL',
    required_points: 1,
    evidence_refs: [],
  }, 'Bearer invalid_token_for_sampling_acceptance');
  assert.equal(badAuth.status, 401, 'invalid token must be 401');
  checks.auth_invalid_rejected_401 = true;

  const scopedIds = {
    tenant_id: process.env.GEOX_TENANT_ID || 'tenantA',
    project_id: process.env.GEOX_PROJECT_ID || 'projectA',
    group_id: process.env.GEOX_GROUP_ID || 'groupA',
    field_id: `f-scope-${now}`,
    sample_id: `s-scope-${now}`,
  };
  const scopedPlan = await postJson('/api/v1/sampling/plan', {
    ...scopedIds,
    reason: 'MANUAL_REQUEST',
    sample_type: 'SOIL',
    required_points: 2,
    evidence_refs: [],
  });
  assert.equal(scopedPlan.status, 200, 'scoped plan create should succeed');
  const crossTenantReceipt = await postJson('/api/v1/sampling/receipt', {
    plan_id: scopedPlan.json.plan_id,
    sample_id: `${scopedIds.sample_id}-cross`,
    tenant_id: `${scopedIds.tenant_id}-other`,
    project_id: scopedIds.project_id,
    group_id: scopedIds.group_id,
    field_id: scopedIds.field_id,
    collected_at_ts: now,
    collector_actor_id: 'collector-cross-tenant',
    sample_type: 'SOIL',
    evidence_refs: [{ kind: 'raw_sample_v1', ref_id: 'raw-cross' }],
    chain_of_custody_status: 'RECORDED',
  });
  assert.equal(crossTenantReceipt.status, 404, 'cross-tenant scope must be 404');
  checks.tenant_boundary_rejected_404 = true;

  for (const [name, value] of Object.entries(checks)) {
    assert.equal(value, true, `check must be true: ${name}`);
  }

  console.log(JSON.stringify({ ok: true, suite: 'ACCEPTANCE_SAMPLING_API_V1', mode, checks }, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, suite: 'ACCEPTANCE_SAMPLING_API_V1', error: String(err && err.message ? err.message : err) }, null, 2));
  process.exit(1);
});
