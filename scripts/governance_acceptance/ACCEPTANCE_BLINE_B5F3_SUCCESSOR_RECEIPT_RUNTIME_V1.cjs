const { Pool } = require('pg');
const { env, fetchJson } = require('../agronomy_acceptance/_common.cjs');

const TASK = 'BLINE_B5F3_SUCCESSOR_RECEIPT_RUNTIME_V1';

function pass(v) {
  return v ? 'PASS' : 'FAIL';
}

function stablePrimitiveObject(value) {
  const out = {};
  for (const key of Object.keys(value ?? {}).sort()) {
    const v = value[key];
    if (['string', 'number', 'boolean'].includes(typeof v)) out[key] = v;
  }
  return out;
}

async function main() {
  const base = env('BASE_URL', 'http://127.0.0.1:3000');
  const token = env('GEOX_EXECUTOR_TOKEN', env('EXECUTOR_TOKEN', ''));
  const databaseUrl = env('DATABASE_URL', '');
  const tenant_id = env('TENANT_ID', 'tenantA');
  const project_id = env('PROJECT_ID', 'projectA');
  const group_id = env('GROUP_ID', 'groupA');
  const taskId = env('B5F3_TASK_ID', '');
  const executorActorId = env('EXECUTOR_ACTOR_ID', 'tok_executor_actor');

  if (!token) throw new Error('B5F3_EXECUTOR_TOKEN_REQUIRED');
  if (!databaseUrl) throw new Error('B5F3_DATABASE_URL_REQUIRED');
  if (!taskId) throw new Error('B5F3_TASK_ID_REQUIRED');

  const pool = new Pool({ connectionString: databaseUrl });
  const checks = {
    exact_successor_task_found: 'FAIL',
    successor_task_schema_non_empty: 'FAIL',
    successor_task_schema_matches_parameters: 'FAIL',
    legacy_receipt_keys_not_canonical: 'FAIL',
    no_preexisting_receipt: 'FAIL',
    receipt_http_success: 'FAIL',
    receipt_fact_materialized: 'FAIL',
    receipt_observed_parameters_exact_successor_subset: 'FAIL',
    receipt_count_exactly_one: 'FAIL',
  };

  try {
    const taskQ = await pool.query(
      `SELECT fact_id, record_json::jsonb AS record_json
         FROM facts
        WHERE (record_json::jsonb->>'type')='ao_act_task_v0'
          AND (record_json::jsonb#>>'{payload,act_task_id}')=$1
          AND (record_json::jsonb#>>'{payload,tenant_id}')=$2
          AND (record_json::jsonb#>>'{payload,project_id}')=$3
          AND (record_json::jsonb#>>'{payload,group_id}')=$4
        ORDER BY occurred_at DESC, fact_id DESC
        LIMIT 1`,
      [taskId, tenant_id, project_id, group_id],
    );

    const taskPayload = taskQ.rows?.[0]?.record_json?.payload ?? null;
    checks.exact_successor_task_found = pass(Boolean(taskPayload));
    if (!taskPayload) throw new Error('B5F3_SUCCESSOR_TASK_NOT_FOUND');

    const schemaKeys = Array.isArray(taskPayload?.parameter_schema?.keys)
      ? taskPayload.parameter_schema.keys
          .map((entry) => String(entry?.name ?? '').trim())
          .filter(Boolean)
      : [];
    const taskParameters = stablePrimitiveObject(taskPayload?.parameters ?? {});
    const parameterKeys = Object.keys(taskParameters);

    checks.successor_task_schema_non_empty = pass(schemaKeys.length > 0);
    checks.successor_task_schema_matches_parameters = pass(
      JSON.stringify([...schemaKeys].sort()) === JSON.stringify([...parameterKeys].sort()),
    );
    checks.legacy_receipt_keys_not_canonical = pass(
      !schemaKeys.includes('coverage_percent') && !schemaKeys.includes('duration_min'),
    );

    if (checks.successor_task_schema_non_empty !== 'PASS') {
      throw new Error('B5F3_SUCCESSOR_TASK_SCHEMA_EMPTY');
    }
    if (checks.successor_task_schema_matches_parameters !== 'PASS') {
      throw new Error(JSON.stringify({
        reason: 'B5F3_TASK_SCHEMA_PARAMETER_DRIFT',
        schemaKeys,
        parameterKeys,
      }));
    }

    const observedParameters = Object.fromEntries(
      schemaKeys
        .filter((name) => Object.prototype.hasOwnProperty.call(taskParameters, name))
        .map((name) => [name, taskParameters[name]]),
    );

    const beforeQ = await pool.query(
      `SELECT COUNT(*)::int AS n
         FROM facts
        WHERE (record_json::jsonb->>'type') IN ('ao_act_receipt_v0','ao_act_receipt_v1')
          AND (record_json::jsonb#>>'{payload,act_task_id}')=$1
          AND (record_json::jsonb#>>'{payload,tenant_id}')=$2
          AND (record_json::jsonb#>>'{payload,project_id}')=$3
          AND (record_json::jsonb#>>'{payload,group_id}')=$4`,
      [taskId, tenant_id, project_id, group_id],
    );
    const beforeCount = Number(beforeQ.rows?.[0]?.n ?? -1);
    checks.no_preexisting_receipt = pass(beforeCount === 0);
    if (beforeCount !== 0) {
      throw new Error(JSON.stringify({ reason: 'B5F3_RECEIPT_ALREADY_EXISTS', task_id: taskId, count: beforeCount }));
    }

    const operationPlanId = String(taskPayload?.operation_plan_id ?? '').trim();
    const fieldRef = String(taskPayload?.target?.ref ?? taskPayload?.field_id ?? '').trim();
    if (!operationPlanId) throw new Error('B5F3_OPERATION_PLAN_ID_MISSING');
    if (!fieldRef) throw new Error('B5F3_FIELD_REF_MISSING');

    const suffix = Date.now();
    const receiptBody = {
      tenant_id,
      project_id,
      group_id,
      operation_plan_id: operationPlanId,
      act_task_id: taskId,
      executor_id: { kind: 'script', id: executorActorId, namespace: 'executor_runtime_v1' },
      execution_time: { start_ts: Date.now() - 20_000, end_ts: Date.now() - 5_000 },
      execution_coverage: { kind: 'field', ref: fieldRef },
      resource_usage: { fuel_l: 0, electric_kwh: 0, water_l: 20, chemical_ml: 0 },
      observed_parameters: observedParameters,
      evidence_refs: [{ kind: 'sensor', ref: `b5f3_sensor_${suffix}` }],
      logs_refs: [
        { kind: 'dispatch_ack', ref: `b5f3_ack_${suffix}` },
        { kind: 'valve_open_confirmation', ref: `b5f3_valve_${suffix}` },
        { kind: 'water_delivery_receipt', ref: `b5f3_water_${suffix}` },
      ],
      status: 'executed',
      constraint_check: { violated: false, violations: [] },
      meta: {
        command_id: taskId,
        idempotency_key: `b5f3_receipt_${taskId}_${suffix}`,
      },
    };

    const receiptResp = await fetchJson(`${base}/api/v1/actions/receipt`, {
      method: 'POST',
      token,
      body: receiptBody,
    });
    checks.receipt_http_success = pass(receiptResp.ok && receiptResp.json?.ok === true);
    if (checks.receipt_http_success !== 'PASS') {
      throw new Error(JSON.stringify({
        reason: 'B5F3_RECEIPT_HTTP_FAILED',
        status: receiptResp.status,
        response: receiptResp.json ?? receiptResp.text,
      }));
    }

    const receiptFactId = String(receiptResp.json?.fact_id ?? '').trim();
    if (!receiptFactId) throw new Error('B5F3_RECEIPT_FACT_ID_MISSING');

    const receiptQ = await pool.query(
      `SELECT fact_id, record_json::jsonb AS record_json
         FROM facts
        WHERE fact_id=$1
          AND (record_json::jsonb->>'type') IN ('ao_act_receipt_v0','ao_act_receipt_v1')
          AND (record_json::jsonb#>>'{payload,act_task_id}')=$2
          AND (record_json::jsonb#>>'{payload,tenant_id}')=$3
          AND (record_json::jsonb#>>'{payload,project_id}')=$4
          AND (record_json::jsonb#>>'{payload,group_id}')=$5
        LIMIT 1`,
      [receiptFactId, taskId, tenant_id, project_id, group_id],
    );
    const receiptPayload = receiptQ.rows?.[0]?.record_json?.payload ?? null;
    checks.receipt_fact_materialized = pass(Boolean(receiptPayload));
    if (!receiptPayload) throw new Error('B5F3_RECEIPT_FACT_NOT_FOUND');

    const persistedObserved = stablePrimitiveObject(receiptPayload?.observed_parameters ?? {});
    checks.receipt_observed_parameters_exact_successor_subset = pass(
      JSON.stringify(persistedObserved) === JSON.stringify(stablePrimitiveObject(observedParameters)),
    );

    const afterQ = await pool.query(
      `SELECT COUNT(*)::int AS n
         FROM facts
        WHERE (record_json::jsonb->>'type') IN ('ao_act_receipt_v0','ao_act_receipt_v1')
          AND (record_json::jsonb#>>'{payload,act_task_id}')=$1
          AND (record_json::jsonb#>>'{payload,tenant_id}')=$2
          AND (record_json::jsonb#>>'{payload,project_id}')=$3
          AND (record_json::jsonb#>>'{payload,group_id}')=$4`,
      [taskId, tenant_id, project_id, group_id],
    );
    const afterCount = Number(afterQ.rows?.[0]?.n ?? -1);
    checks.receipt_count_exactly_one = pass(afterCount === 1);

    const ok = Object.values(checks).every((value) => value === 'PASS');
    process.stdout.write(`${JSON.stringify({
      ok,
      task: TASK,
      checks,
      ids: {
        act_task_id: taskId,
        operation_plan_id: operationPlanId,
        receipt_fact_id: receiptFactId,
      },
      successor_task: {
        schema_keys: schemaKeys,
        parameters: taskParameters,
      },
      receipt: {
        observed_parameters: persistedObserved,
      },
      boundary: {
        acceptance_evaluate: 'NOT_CALLED',
        as_executed: 'NOT_CALLED',
        roi: 'NOT_CALLED',
      },
    }, null, 2)}\n`);
    if (!ok) process.exit(1);
  } finally {
    await pool.end().catch(() => {});
  }
}

main().catch((error) => {
  process.stdout.write(`${JSON.stringify({
    ok: false,
    task: TASK,
    error: String(error?.stack ?? error?.message ?? error),
  }, null, 2)}\n`);
  process.exit(1);
});
