const { randomUUID } = require('node:crypto');
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
          receipt_id: `receipt_${suffix}`,
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

  const byPrescriptionResp = await fetchJson(
    `${base}/api/v1/as-executed/by-prescription/${encodeURIComponent(prescription_id)}?tenant_id=${encodeURIComponent(tenant_id)}&project_id=${encodeURIComponent(project_id)}&group_id=${encodeURIComponent(group_id)}`,
    { method: 'GET', token },
  );
  const byPrescriptionJson = requireOk(byPrescriptionResp, 'read by prescription');

  const asExecuted = createJson.as_executed;
  const asApplied = createJson.as_applied;

  const plannedFromPrescription =
    asExecuted?.planned?.source === 'prescription' &&
    asExecuted?.planned?.operation_type === 'IRRIGATION' &&
    Number(asExecuted?.planned?.amount) === 25 &&
    String(asExecuted?.planned?.unit || '').toUpperCase() === 'L';

  const deviationComputed =
    Number(asExecuted?.deviation?.amount_delta) === -5 &&
    Math.abs(Number(asExecuted?.deviation?.amount_delta_percent) + 20) < 0.0001;

  const byPrescriptionHasRecord = Array.isArray(byPrescriptionJson.records)
    && byPrescriptionJson.records.some((r) => r?.as_executed?.as_executed_id === asExecuted?.as_executed_id);

  const checks = {
    as_executed_created: Boolean(asExecuted?.as_executed_id),
    as_applied_created: Boolean(asApplied?.as_applied_id),
    prescription_linked: String(asExecuted?.prescription_id || '') === prescription_id,
    planned_from_prescription: Boolean(plannedFromPrescription),
    deviation_computed_when_amount_available: Boolean(deviationComputed),
    read_by_prescription: Boolean(byPrescriptionHasRecord),
    idempotent: Boolean(createAgainJson.idempotent === true),
    as_applied_references_as_executed: String(asApplied?.application?.as_executed_id || '') === String(asExecuted?.as_executed_id || ''),
  };

  Object.entries(checks).forEach(([k, v]) => assert.equal(v, true, `check failed: ${k}`));

  process.stdout.write(`${JSON.stringify({ ok: true, checks }, null, 2)}\n`);
  await pool.end();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
