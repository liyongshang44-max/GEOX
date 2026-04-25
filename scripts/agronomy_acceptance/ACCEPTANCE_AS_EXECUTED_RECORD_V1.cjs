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
  const task_id = `act_as_executed_${suffix}`;
  const receipt_fact_id = `fact_receipt_${suffix}`;
  const payload_receipt_id = `receipt_${suffix}`;

  await pool.query(
    `INSERT INTO facts (fact_id, occurred_at, source, record_json)
     VALUES ($1, NOW(), $2, $3::jsonb)
     ON CONFLICT (fact_id) DO NOTHING`,
    [
      receipt_fact_id,
      'scripts/agronomy_acceptance/as_executed_record_v1',
      {
        type: 'ao_act_receipt_v1',
        payload: {
          tenant_id,
          project_id,
          group_id,
          act_task_id: task_id,
          receipt_id: payload_receipt_id,
          executor_id: { kind: 'human', id: `executor_${suffix}` },
          status: 'executed',
          execution_time: {
            start_ts: Date.now() - 30_000,
            end_ts: Date.now() - 5_000,
          },
          resource_usage: { water_l: 12.5 },
          labor: { duration_minutes: 16, worker_count: 1 },
          observed_parameters: { pressure_kpa: 100 },
          evidence_refs: ['ev:camera:1'],
          evidence_artifact_ids: ['artifact:1'],
          evidence_meta: [{ object_key: 'bucket/path/demo.jpg', mime_type: 'image/jpeg' }],
          logs_refs: [{ kind: 'device_log', ref: 'log:1' }],
        },
      },
    ],
  );

  const createResp = await fetchJson(`${base}/api/v1/as-executed/from-receipt`, {
    method: 'POST',
    token,
    body: {
      task_id,
      receipt_id: receipt_fact_id,
      tenant_id,
      project_id,
      group_id,
    },
  });
  const createJson = requireOk(createResp, 'create as-executed from receipt');
  const asExecuted = createJson.as_executed;
  const as_executed_id = String(asExecuted?.as_executed_id ?? '').trim();
  assert.ok(as_executed_id, 'as_executed_id missing');

  const createAgainResp = await fetchJson(`${base}/api/v1/as-executed/from-receipt`, {
    method: 'POST',
    token,
    body: {
      task_id,
      receipt_id: receipt_fact_id,
      tenant_id,
      project_id,
      group_id,
    },
  });
  const createAgainJson = requireOk(createAgainResp, 'idempotent as-executed from receipt');

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

  const rowQuery = await pool.query(
    `SELECT as_executed_id, task_id, receipt_id, executed::jsonb AS executed, receipt_refs::jsonb AS receipt_refs
     FROM as_executed_record_v1
     WHERE as_executed_id = $1
       AND tenant_id = $2
       AND project_id = $3
       AND group_id = $4
     LIMIT 1`,
    [as_executed_id, tenant_id, project_id, group_id],
  );

  const dbRow = rowQuery.rows?.[0] || null;
  const shapeValid = Boolean(
    dbRow &&
    dbRow.task_id === task_id &&
    String(dbRow.receipt_id || '') === payload_receipt_id &&
    dbRow.executed &&
    dbRow.executed.status === 'CONFIRMED' &&
    Array.isArray(dbRow.receipt_refs)
  );

  const receiptNotTreatedAsExecutionFact = as_executed_id !== receipt_fact_id;

  const checks = {
    created: Boolean(createJson.as_executed && createJson.idempotent === false),
    idempotent: Boolean(createAgainJson.idempotent === true && createAgainJson.as_executed?.as_executed_id === as_executed_id),
    read_by_id: Boolean(readByIdJson.as_executed?.as_executed_id === as_executed_id),
    read_by_task: Boolean(Array.isArray(readByTaskJson.as_executed) && readByTaskJson.as_executed.some((x) => x.as_executed_id === as_executed_id)),
    read_by_receipt: Boolean(Array.isArray(readByReceiptJson.as_executed) && readByReceiptJson.as_executed.some((x) => x.as_executed_id === as_executed_id)),
    as_executed_shape_valid: shapeValid,
    receipt_not_treated_as_execution_fact: receiptNotTreatedAsExecutionFact,
  };

  Object.entries(checks).forEach(([k, v]) => assert.equal(v, true, `check failed: ${k}`));

  const output = {
    ok: true,
    as_executed_id,
    task_id,
    receipt_id: payload_receipt_id,
    checks,
  };

  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  await pool.end();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
