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
  const recommendation_id = `rec_as_exec_${suffix}`;
  const prescription_id = `prc_as_exec_${suffix}`;
  const task_id = `act_as_exec_${suffix}`;
  const receipt_fact_id = `fact_receipt_${suffix}`;
  const payload_receipt_id = `receipt_${suffix}`;

  await pool.query(
    `INSERT INTO prescription_contract_v1
      (prescription_id, recommendation_id, tenant_id, project_id, group_id, field_id, season_id, crop_id, zone_id, operation_type, spatial_scope, timing_window, operation_amount, device_requirements, risk, evidence_refs, approval_requirement, acceptance_conditions, status, created_at, updated_at, created_by)
     VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8,$9,'IRRIGATION','{}'::jsonb,'{}'::jsonb,$10::jsonb,'{}'::jsonb,'{}'::jsonb,'[]'::jsonb,'{}'::jsonb,'{}'::jsonb,'READY_FOR_APPROVAL',NOW(),NOW(),'acceptance_as_executed_as_applied_v1')
     ON CONFLICT (tenant_id, project_id, group_id, recommendation_id)
     DO UPDATE SET updated_at = NOW(), operation_amount = EXCLUDED.operation_amount`,
    [
      prescription_id,
      recommendation_id,
      tenant_id,
      project_id,
      group_id,
      `field_${suffix}`,
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
      'scripts/agronomy_acceptance/as_executed_as_applied_v1',
      {
        type: 'ao_act_receipt_v1',
        payload: {
          tenant_id,
          project_id,
          group_id,
          act_task_id: task_id,
          receipt_id: payload_receipt_id,
          recommendation_id,
          parameters: { prescription_id },
          executor_id: { kind: 'human', id: `executor_${suffix}` },
          status: 'executed',
          execution_time: { start_ts: Date.now() - 10000, end_ts: Date.now() - 5000 },
          execution_coverage: { kind: 'field', ref: `field_${suffix}` },
          resource_usage: { water_l: 20 },
          observed_parameters: { amount: 20, coverage_percent: 80, prescription_id },
          logs_refs: [{ kind: 'log', ref: `log_${suffix}` }],
          evidence_refs: [`ev_${suffix}`],
        },
      },
    ],
  );

  const healthz = await fetchJson(`${base}/api/admin/healthz`, { method: 'GET', token });
  const healthz_ok = Boolean(healthz.ok && healthz.json?.ok === true);

  const openapi = await fetchJson(`${base}/api/v1/openapi.json`, { method: 'GET', token });
  const openapi_contains_as_executed_paths = Boolean(
    openapi.ok &&
    openapi.json?.paths?.['/api/v1/as-executed/from-receipt'] &&
    openapi.json?.paths?.['/api/v1/as-executed/{as_executed_id}'] &&
    openapi.json?.paths?.['/api/v1/as-executed/by-task/{task_id}'] &&
    openapi.json?.paths?.['/api/v1/as-executed/by-receipt/{receipt_id}'] &&
    openapi.json?.paths?.['/api/v1/as-executed/by-prescription/{prescription_id}']
  );

  const createResp = await fetchJson(`${base}/api/v1/as-executed/from-receipt`, {
    method: 'POST',
    token,
    body: { task_id, receipt_id: receipt_fact_id, tenant_id, project_id, group_id },
  });
  const createJson = requireOk(createResp, 'create as-executed and as-applied');

  const createAgainResp = await fetchJson(`${base}/api/v1/as-executed/from-receipt`, {
    method: 'POST',
    token,
    body: { task_id, receipt_id: receipt_fact_id, tenant_id, project_id, group_id },
  });
  const createAgainJson = requireOk(createAgainResp, 'idempotent create as-executed and as-applied');

  const asExecuted = createJson.as_executed;
  const asApplied = createJson.as_applied;
  const as_executed_id = String(asExecuted?.as_executed_id ?? '').trim();

  const readByIdResp = await fetchJson(
    `${base}/api/v1/as-executed/${encodeURIComponent(as_executed_id)}?tenant_id=${encodeURIComponent(tenant_id)}&project_id=${encodeURIComponent(project_id)}&group_id=${encodeURIComponent(group_id)}`,
    { method: 'GET', token },
  );
  const readByIdJson = requireOk(readByIdResp, 'read as-executed by id');

  const readByTaskResp = await fetchJson(
    `${base}/api/v1/as-executed/by-task/${encodeURIComponent(task_id)}?tenant_id=${encodeURIComponent(tenant_id)}&project_id=${encodeURIComponent(project_id)}&group_id=${encodeURIComponent(group_id)}`,
    { method: 'GET', token },
  );
  const readByTaskJson = requireOk(readByTaskResp, 'read as-executed by task');

  const readByReceiptResp = await fetchJson(
    `${base}/api/v1/as-executed/by-receipt/${encodeURIComponent(payload_receipt_id)}?tenant_id=${encodeURIComponent(tenant_id)}&project_id=${encodeURIComponent(project_id)}&group_id=${encodeURIComponent(group_id)}`,
    { method: 'GET', token },
  );
  const readByReceiptJson = requireOk(readByReceiptResp, 'read as-executed by receipt');

  const readByPrescriptionResp = await fetchJson(
    `${base}/api/v1/as-executed/by-prescription/${encodeURIComponent(prescription_id)}?tenant_id=${encodeURIComponent(tenant_id)}&project_id=${encodeURIComponent(project_id)}&group_id=${encodeURIComponent(group_id)}`,
    { method: 'GET', token },
  );
  const readByPrescriptionJson = requireOk(readByPrescriptionResp, 'read by prescription');

  const plannedFromPrescription =
    asExecuted?.planned?.source === 'prescription' &&
    asExecuted?.planned?.operation_type === 'IRRIGATION' &&
    Number(asExecuted?.planned?.amount) === 25 &&
    String(asExecuted?.planned?.unit || '').toUpperCase() === 'L';

  const as_executed_shape_valid = Boolean(
    asExecuted &&
    asExecuted.as_executed_id &&
    asExecuted.task_id === task_id &&
    String(asExecuted.receipt_id || '') === payload_receipt_id &&
    asExecuted.executed?.status === 'CONFIRMED' &&
    Array.isArray(asExecuted.evidence_refs)
  );

  const as_applied_shape_valid = Boolean(
    asApplied &&
    asApplied.as_applied_id &&
    asApplied.task_id === task_id &&
    String(asApplied.receipt_id || '') === payload_receipt_id &&
    asApplied.geometry &&
    asApplied.coverage &&
    asApplied.application
  );

  const checks = {
    created: Boolean(asExecuted?.as_executed_id && asApplied?.as_applied_id),
    idempotent: Boolean(createAgainJson.idempotent === true),
    read_by_id: Boolean(readByIdJson.as_executed?.as_executed_id === as_executed_id),
    read_by_task: Boolean(Array.isArray(readByTaskJson.as_executed) && readByTaskJson.as_executed.some((r) => r?.as_executed_id === as_executed_id)),
    read_by_receipt: Boolean(Array.isArray(readByReceiptJson.as_executed) && readByReceiptJson.as_executed.some((r) => r?.as_executed_id === as_executed_id)),
    read_by_prescription: Boolean(Array.isArray(readByPrescriptionJson.records) && readByPrescriptionJson.records.some((r) => r?.as_executed?.as_executed_id === as_executed_id)),
    as_executed_shape_valid,
    as_applied_shape_valid,
    receipt_not_treated_as_execution_fact: as_executed_id !== receipt_fact_id,
    prescription_linked: String(asExecuted?.prescription_id || '') === prescription_id,
    planned_from_prescription: Boolean(plannedFromPrescription),
    openapi_contains_as_executed_paths,
    healthz_ok,
  };

  Object.entries(checks).forEach(([k, v]) => assert.equal(v, true, `check failed: ${k}`));

  process.stdout.write(`${JSON.stringify({ ok: true, checks }, null, 2)}\n`);
  await pool.end();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
