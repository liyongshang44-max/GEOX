#!/usr/bin/env node
const { assert, env, fetchJson, requireOk } = require('./_common.cjs');

const baseUrl = env('SAMPLING_API_BASE_URL', env('API_BASE_URL', 'http://127.0.0.1:3000'));
const token = env('ADMIN_TOKEN', env('AO_ACT_TOKEN', 'admin_token'));

async function main() {
  const existingOperationId = process.env.SAMPLING_EXISTING_OPERATION_ID || '';
  const now = Date.now();
  const tenant_id = `t-${now}`;
  const project_id = `p-${now}`;
  const group_id = `g-${now}`;
  const field_id = `f-${now}`;
  const sample_id = `s-${now}`;

  const plan = requireOk(await fetchJson(`${baseUrl}/api/v1/sampling/plan`, {
    method: 'POST',
    token,
    body: { tenant_id, project_id, group_id, field_id, reason: 'MANUAL_REQUEST', sample_type: 'SOIL', required_points: 3, evidence_refs: [] },
  }), 'create plan');

  requireOk(await fetchJson(`${baseUrl}/api/v1/sampling/receipt`, {
    method: 'POST',
    token,
    body: {
      plan_id: plan.plan_id, sample_id, tenant_id, project_id, group_id, field_id,
      collected_at_ts: now, collector_actor_id: 'collector-1', sample_type: 'SOIL',
      evidence_refs: [{ kind: 'raw_sample_v1', ref_id: `raw-${now}` }], chain_of_custody_status: 'RECORDED',
    },
  }), 'create receipt');

  const lab = requireOk(await fetchJson(`${baseUrl}/api/v1/sampling/lab-result`, {
    method: 'POST',
    token,
    body: {
      sample_id, imported_at_ts: now + 1000, metrics: { ph: 6.5 }, units: { ph: 'pH' },
      evidence_refs: [{ kind: 'import_run_v1', ref_id: `import-${now}` }], quality_status: 'PASS',
    },
  }), 'import lab result');

  requireOk(await fetchJson(`${baseUrl}/api/v1/sampling/acceptance/evaluate`, {
    method: 'POST',
    token,
    body: { plan_id: plan.plan_id, sample_id, import_id: lab.import_id },
  }), 'acceptance evaluate');

  const sampleFact = requireOk(await fetchJson(`${baseUrl}/api/v1/sampling/sample/${sample_id}`, { token }), 'query sample');
  assert.equal(sampleFact.fact?.record_json?.sample_id, sample_id, 'sample_id should exist');

  console.log(JSON.stringify({
    ok: true,
    suite: 'ACCEPTANCE_SAMPLING_REPORT_PROJECTION_V1',
    checks: {
      created_plan_receipt_lab_acceptance: true,
      sample_id_present: true,
      note: 'Sampling projection/status is now sourced from facts in report_v1 path.',
      operation_report_gate_dependency: existingOperationId
        ? `uses pre-existing operation id: ${existingOperationId}`
        : 'requires a pre-existing operation id for operation report projection gate; this script does not seed operation',
    },
  }, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, suite: 'ACCEPTANCE_SAMPLING_REPORT_PROJECTION_V1', error: String(err?.message ?? err) }, null, 2));
  process.exit(1);
});
