#!/usr/bin/env node
const { assert, env, fetchJson, requireOk } = require('./_common.cjs');

const baseUrl = env('SAMPLING_API_BASE_URL', env('API_BASE_URL', 'http://127.0.0.1:3000'));
const token = env('ADMIN_TOKEN', env('AO_ACT_TOKEN', 'admin_token'));
const operationId = env('SAMPLING_REPORT_OPERATION_ID', '');

async function main() {
  if (!operationId) {
    throw new Error('SAMPLING_REPORT_OPERATION_ID not found; run formal scenario seed or provide an existing operation id');
  }

  const scope = { tenant_id: 'tenantA', project_id: 'projectA', group_id: 'groupA' };
  const opReport = await fetchJson(`${baseUrl}/api/v1/reports/operation/${encodeURIComponent(operationId)}?tenant_id=${encodeURIComponent(scope.tenant_id)}&project_id=${encodeURIComponent(scope.project_id)}&group_id=${encodeURIComponent(scope.group_id)}`, { token });
  if (!opReport.ok) {
    throw new Error('SAMPLING_REPORT_OPERATION_ID not found; run formal scenario seed or provide an existing operation id');
  }

  const now = Date.now();
  const field_id = `f-${now}`;
  const sample_id = `s-${now}`;

  const plan = requireOk(await fetchJson(`${baseUrl}/api/v1/sampling/plan`, {
    method: 'POST',
    token,
    body: { ...scope, field_id, reason: 'MANUAL_REQUEST', sample_type: 'SOIL', required_points: 3, evidence_refs: [], operation_id: operationId },
  }), 'create plan');

  requireOk(await fetchJson(`${baseUrl}/api/v1/sampling/receipt`, {
    method: 'POST',
    token,
    body: {
      plan_id: plan.plan_id, sample_id, ...scope, field_id,
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

  const reportPayload = requireOk(await fetchJson(`${baseUrl}/api/v1/reports/operation/${encodeURIComponent(operationId)}?tenant_id=${encodeURIComponent(scope.tenant_id)}&project_id=${encodeURIComponent(scope.project_id)}&group_id=${encodeURIComponent(scope.group_id)}`, { token }), 'query operation report');
  const report = reportPayload.operation_report_v1 || reportPayload.report || {};
  assert.equal(report.formal_scenario?.scenario_type, 'FORMAL_SAMPLING', 'scenario_type should be FORMAL_SAMPLING');
  assert.equal(report.sampling?.plan_id, plan.plan_id, 'sampling.plan_id should match created plan');
  assert.equal(report.sampling?.sample_id, sample_id, 'sampling.sample_id should match created sample');
  assert.equal(report.sampling?.lab_result_status, 'PASS', 'sampling.lab_result_status should be PASS');
  assert.equal(report.sampling?.acceptance_status, 'PASS', 'sampling.acceptance_status should be PASS');

  console.log(JSON.stringify({
    ok: true,
    suite: 'ACCEPTANCE_SAMPLING_REPORT_PROJECTION_V1',
    checks: {
      created_plan_receipt_lab_acceptance: true,
      operation_report_projection_checked: true,
    },
  }, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, suite: 'ACCEPTANCE_SAMPLING_REPORT_PROJECTION_V1', error: String(err?.message ?? err) }, null, 2));
  process.exit(1);
});
