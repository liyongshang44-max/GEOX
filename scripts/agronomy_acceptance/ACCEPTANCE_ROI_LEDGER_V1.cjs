const { Pool } = require('pg');
const { assert, env, fetchJson, requireOk } = require('./_common.cjs');

(async () => {
  const base = env('BASE_URL', 'http://127.0.0.1:3001');
  const token = env('AO_ACT_TOKEN', '');
  const tenant_id = env('TENANT_ID', 'tenantA');
  const project_id = env('PROJECT_ID', 'projectA');
  const group_id = env('GROUP_ID', 'groupA');
  const databaseUrl = env('DATABASE_URL', 'postgres://postgres:postgres@127.0.0.1:5432/geox');
  const pool = new Pool({ connectionString: databaseUrl });

  const suffix = Date.now();
  const recommendation_id = `rec_roi_${suffix}`;
  const prescription_id = `prc_roi_${suffix}`;
  const task_id = `task_roi_${suffix}`;
  const field_id = `field_${suffix}`;
  const receipt_fact_id = `fact_roi_${suffix}`;

  await pool.query(
    `INSERT INTO prescription_contract_v1
      (prescription_id, recommendation_id, tenant_id, project_id, group_id, field_id, season_id, crop_id, zone_id, operation_type, spatial_scope, timing_window, operation_amount, device_requirements, risk, evidence_refs, approval_requirement, acceptance_conditions, status, created_at, updated_at, created_by)
     VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8,$9,'IRRIGATION','{}'::jsonb,'{}'::jsonb,$10::jsonb,'{}'::jsonb,'{}'::jsonb,'[]'::jsonb,'{}'::jsonb,'{}'::jsonb,'READY_FOR_APPROVAL',NOW(),NOW(),'acceptance_roi_ledger_v1')
     ON CONFLICT (tenant_id, project_id, group_id, recommendation_id)
     DO UPDATE SET updated_at = NOW(), operation_amount = EXCLUDED.operation_amount`,
    [
      prescription_id,
      recommendation_id,
      tenant_id,
      project_id,
      group_id,
      field_id,
      `season_${suffix}`,
      'corn',
      `zone_${suffix}`,
      JSON.stringify({ amount: 25, unit: 'L' }),
    ],
  );

  await pool.query(
    `INSERT INTO facts (fact_id, occurred_at, source, record_json)
     VALUES ($1, NOW(), $2, $3::jsonb)
     ON CONFLICT (fact_id) DO NOTHING`,
    [
      receipt_fact_id,
      'scripts/agronomy_acceptance/roi_ledger_v1',
      {
        type: 'ao_act_receipt_v1',
        payload: {
          tenant_id,
          project_id,
          group_id,
          act_task_id: task_id,
          receipt_id: `receipt_roi_${suffix}`,
          recommendation_id,
          parameters: { prescription_id },
          status: 'executed',
          execution_coverage: { kind: 'field', ref: field_id },
          resource_usage: { water_l: 20, electric_kwh: 1.5, chemical_ml: 25 },
          observed_parameters: { amount: 20, coverage_percent: 88, prescription_id },
          labor: { duration_minutes: 12, worker_count: 1 },
          evidence_refs: [{ kind: 'photo', ref: `ev_${suffix}` }],
        },
      },
    ],
  );

  const healthz = await fetchJson(`${base}/api/admin/healthz`, { method: 'GET', token });
  const healthz_ok = Boolean(healthz.ok && healthz.json?.ok === true);

  const openapi = await fetchJson(`${base}/api/v1/openapi.json`, { method: 'GET', token });
  const openapi_contains_roi_ledger_paths = Boolean(
    openapi.ok &&
    openapi.json?.paths?.['/api/v1/roi-ledger/health'] &&
    openapi.json?.paths?.['/api/v1/roi-ledger/from-as-executed'] &&
    openapi.json?.paths?.['/api/v1/roi-ledger/by-as-executed/{as_executed_id}'] &&
    openapi.json?.paths?.['/api/v1/roi-ledger/by-task/{task_id}'] &&
    openapi.json?.paths?.['/api/v1/roi-ledger/by-prescription/{prescription_id}'] &&
    openapi.json?.paths?.['/api/v1/roi-ledger/by-field/{field_id}']
  );

  const asExecutedResp = await fetchJson(`${base}/api/v1/as-executed/from-receipt`, {
    method: 'POST',
    token,
    body: { task_id, receipt_id: receipt_fact_id, tenant_id, project_id, group_id },
  });
  const asExecutedJson = requireOk(asExecutedResp, 'create as-executed first');
  const as_executed_id = String(asExecutedJson?.as_executed?.as_executed_id ?? '').trim();
  assert.ok(as_executed_id, 'missing as_executed_id');

  const createResp = await fetchJson(`${base}/api/v1/roi-ledger/from-as-executed`, {
    method: 'POST',
    token,
    body: { as_executed_id, tenant_id, project_id, group_id },
  });
  const createJson = requireOk(createResp, 'create roi ledger from as-executed');

  const createAgainResp = await fetchJson(`${base}/api/v1/roi-ledger/from-as-executed`, {
    method: 'POST',
    token,
    body: { as_executed_id, tenant_id, project_id, group_id },
  });
  const createAgainJson = requireOk(createAgainResp, 'idempotent roi ledger generation');

  const readByAsExecutedResp = await fetchJson(
    `${base}/api/v1/roi-ledger/by-as-executed/${encodeURIComponent(as_executed_id)}?tenant_id=${encodeURIComponent(tenant_id)}&project_id=${encodeURIComponent(project_id)}&group_id=${encodeURIComponent(group_id)}`,
    { method: 'GET', token },
  );
  const readByAsExecutedJson = requireOk(readByAsExecutedResp, 'read roi ledger by as-executed');

  const readByTaskResp = await fetchJson(
    `${base}/api/v1/roi-ledger/by-task/${encodeURIComponent(task_id)}?tenant_id=${encodeURIComponent(tenant_id)}&project_id=${encodeURIComponent(project_id)}&group_id=${encodeURIComponent(group_id)}`,
    { method: 'GET', token },
  );
  const readByTaskJson = requireOk(readByTaskResp, 'read roi ledger by task');

  const readByPrescriptionResp = await fetchJson(
    `${base}/api/v1/roi-ledger/by-prescription/${encodeURIComponent(prescription_id)}?tenant_id=${encodeURIComponent(tenant_id)}&project_id=${encodeURIComponent(project_id)}&group_id=${encodeURIComponent(group_id)}`,
    { method: 'GET', token },
  );
  const readByPrescriptionJson = requireOk(readByPrescriptionResp, 'read roi ledger by prescription');

  const readByFieldResp = await fetchJson(
    `${base}/api/v1/roi-ledger/by-field/${encodeURIComponent(field_id)}?tenant_id=${encodeURIComponent(tenant_id)}&project_id=${encodeURIComponent(project_id)}&group_id=${encodeURIComponent(group_id)}`,
    { method: 'GET', token },
  );
  const readByFieldJson = requireOk(readByFieldResp, 'read roi ledger by field');

  const ledgers = Array.isArray(createJson.roi_ledgers) ? createJson.roi_ledgers : [];
  const hasWaterOrCost = ledgers.some((x) => x?.roi_type === 'WATER_SAVED' || x?.roi_type === 'COST_IMPACT');
  const hasExecReliability = ledgers.some((x) => x?.roi_type === 'EXECUTION_RELIABILITY');
  const hasBaselineActualDelta = ledgers.some((x) => x?.baseline && x?.actual && x?.delta);
  const hasEvidenceRefs = ledgers.some((x) => Array.isArray(x?.evidence_refs) && x.evidence_refs.length > 0);
  const hasConfidence = ledgers.some((x) =>
    x?.confidence &&
    (x.confidence.level === 'HIGH' || x.confidence.level === 'MEDIUM' || x.confidence.level === 'LOW') &&
    (x.confidence.basis === 'measured' || x.confidence.basis === 'estimated' || x.confidence.basis === 'assumed') &&
    Array.isArray(x.confidence.reasons)
  );
  const roiNotBillingSource = ledgers.every((x) => x?.calculation_method !== 'compute_billing_v1' && x?.roi_type !== 'BILLING_CHARGE');

  const checks = {
    healthz_ok,
    openapi_contains_roi_ledger_paths,
    created_from_as_executed: Boolean(createJson.ok === true && ledgers.length > 0),
    idempotent: Boolean(createAgainJson.ok === true && createAgainJson.idempotent === true),
    water_saved_or_cost_impact_generated: Boolean(hasWaterOrCost),
    execution_reliability_generated: Boolean(hasExecReliability),
    read_by_as_executed: Boolean(Array.isArray(readByAsExecutedJson.roi_ledgers) && readByAsExecutedJson.roi_ledgers.length > 0),
    read_by_task: Boolean(Array.isArray(readByTaskJson.roi_ledgers) && readByTaskJson.roi_ledgers.length > 0),
    read_by_prescription: Boolean(Array.isArray(readByPrescriptionJson.roi_ledgers) && readByPrescriptionJson.roi_ledgers.length > 0),
    read_by_field: Boolean(Array.isArray(readByFieldJson.roi_ledgers) && readByFieldJson.roi_ledgers.length > 0),
    ledger_has_baseline_actual_delta: Boolean(hasBaselineActualDelta),
    ledger_has_evidence_refs: Boolean(hasEvidenceRefs),
    ledger_has_confidence: Boolean(hasConfidence),
    roi_not_used_as_billing_source: Boolean(roiNotBillingSource),
  };

  Object.entries(checks).forEach(([k, v]) => assert.equal(v, true, `check failed: ${k}`));

  process.stdout.write(`${JSON.stringify({ ok: true, checks }, null, 2)}\n`);
  await pool.end();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
