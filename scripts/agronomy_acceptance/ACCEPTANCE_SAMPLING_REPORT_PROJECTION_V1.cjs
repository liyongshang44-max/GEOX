#!/usr/bin/env node
const { assert, env, fetchJson, requireOk, waitForHealth } = require('./_common.cjs');

const baseUrl = env('SAMPLING_API_BASE_URL', env('API_BASE_URL', 'http://127.0.0.1:3000'));
const token = env('ADMIN_TOKEN', env('AO_ACT_TOKEN', 'admin_token'));

async function main() {
  await waitForHealth(baseUrl);

  const operationId = env('SAMPLING_REPORT_OPERATION_ID');
  const scope = {
    tenant_id: env('TENANT_ID', 'tenantA'),
    project_id: env('PROJECT_ID', 'projectA'),
    group_id: env('GROUP_ID', 'groupA'),
  };
  const now = Date.now();
  const field_id = `f-${now}`;
  const sample_id = `s-${now}`;

  const plan = requireOk(await fetchJson(`${baseUrl}/api/v1/sampling/plan`, {
    method: 'POST',
    token,
    body: {
      ...scope,
      field_id,
      reason: 'MANUAL_REQUEST',
      sample_type: 'SOIL',
      required_points: 3,
      evidence_refs: [],
      operation_id: operationId,
    },
  }), 'create plan');

  requireOk(await fetchJson(`${baseUrl}/api/v1/sampling/receipt`, {
    method: 'POST',
    token,
    body: {
      plan_id: plan.plan_id,
      sample_id,
      ...scope,
      field_id,
      collected_at_ts: now,
      collector_actor_id: 'collector-1',
      sample_type: 'SOIL',
      evidence_refs: [{ kind: 'raw_sample_v1', ref_id: `raw-${now}` }],
      chain_of_custody_status: 'RECORDED',
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

  const reportPath = `${baseUrl}/api/v1/reports/operation/${encodeURIComponent(operationId)}?tenant_id=${encodeURIComponent(scope.tenant_id)}&project_id=${encodeURIComponent(scope.project_id)}&group_id=${encodeURIComponent(scope.group_id)}`;
  const operationReport = requireOk(await fetchJson(reportPath, { method: 'GET', token }), 'query operation report');
  const reportJson = operationReport.report_json || operationReport.report?.report_json || operationReport;
  assert.equal(
    reportJson?.formal_scenario?.scenario_type,
    'FORMAL_SAMPLING',
    'operation report formal_scenario.scenario_type must be FORMAL_SAMPLING',
  );

  assert.equal(
    reportJson?.sampling?.plan_id,
    plan.plan_id,
    'operation report sampling.plan_id must match created plan',
  );

  assert.equal(
    reportJson?.sampling?.sample_id,
    sample_id,
    'operation report sampling.sample_id must match created sample',
  );

  assert.equal(
    reportJson?.sampling?.lab_result_status,
    'PASS',
    'operation report sampling.lab_result_status must be PASS',
  );

  assert.equal(
    reportJson?.sampling?.acceptance_status,
    'PASS',
    'operation report sampling.acceptance_status must be PASS',
  );


  const unboundPlan = requireOk(await fetchJson(`${baseUrl}/api/v1/sampling/plan`, {
    method: 'POST',
    token,
    body: {
      ...scope,
      field_id,
      reason: 'MANUAL_REQUEST',
      sample_type: 'SOIL',
      required_points: 3,
      evidence_refs: [],
    },
  }), 'create unbound plan');

  const unboundSampleId = `s-unbound-${now}`;

  requireOk(await fetchJson(`${baseUrl}/api/v1/sampling/receipt`, {
    method: 'POST',
    token,
    body: {
      plan_id: unboundPlan.plan_id,
      sample_id: unboundSampleId,
      ...scope,
      field_id,
      collected_at_ts: now + 2000,
      collector_actor_id: 'collector-2',
      sample_type: 'SOIL',
      evidence_refs: [{ kind: 'raw_sample_v1', ref_id: `raw-unbound-${now}` }],
      chain_of_custody_status: 'RECORDED',
    },
  }), 'create unbound receipt');

  const unboundLab = requireOk(await fetchJson(`${baseUrl}/api/v1/sampling/lab-result`, {
    method: 'POST',
    token,
    body: {
      sample_id: unboundSampleId, imported_at_ts: now + 3000, metrics: { ph: 6.3 }, units: { ph: 'pH' },
      evidence_refs: [{ kind: 'import_run_v1', ref_id: `import-unbound-${now}` }], quality_status: 'PASS',
    },
  }), 'import unbound lab result');

  requireOk(await fetchJson(`${baseUrl}/api/v1/sampling/acceptance/evaluate`, {
    method: 'POST',
    token,
    body: { plan_id: unboundPlan.plan_id, sample_id: unboundSampleId, import_id: unboundLab.import_id },
  }), 'unbound acceptance evaluate');

  const operationReportAfterUnbound = requireOk(await fetchJson(reportPath, {
    method: 'GET',
    token,
  }), 'query operation report after unbound sampling plan');

  const afterJson =
    operationReportAfterUnbound.operation_report_v1
    ?? operationReportAfterUnbound.report_json
    ?? operationReportAfterUnbound.report?.report_json
    ?? operationReportAfterUnbound;

  assert.equal(
    afterJson?.sampling?.plan_id,
    plan.plan_id,
    'operation report must not attach latest unbound sampling plan by field fallback',
  );

  console.log(JSON.stringify({
    ok: true,
    suite: 'ACCEPTANCE_SAMPLING_REPORT_PROJECTION_V1',
    checks: {
      created_plan_receipt_lab_acceptance: true,
      sample_id_present: true,
      operation_report_projection_called: true,
      formal_scenario_sampling: true,
      operation_report_sampling_plan_id_matches: true,
      operation_report_sampling_sample_id_matches: true,
      operation_report_sampling_lab_status_pass: true,
      operation_report_sampling_acceptance_status_pass: true,
      operation_report_does_not_use_field_latest_sampling_fallback: true,
    },
  }, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, suite: 'ACCEPTANCE_SAMPLING_REPORT_PROJECTION_V1', error: String(err?.message ?? err) }, null, 2));
  process.exit(1);
});
