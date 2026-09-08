const { randomUUID } = require('node:crypto');
const { Pool } = require('pg');
const { assert, env, fetchJson } = require('../agronomy_acceptance/_common.cjs');
const { seedFormalIrrigationStage1Evidence } = require('../agronomy_acceptance/_stage1_formal_irrigation_fixture.cjs');

const TASK = 'BLINE_B5D_APPROVAL_EXECUTION_CONTEXT_RUNTIME_V1';

async function main() {
  const base = env('BASE_URL', 'http://127.0.0.1:3000');
  const token = env('AO_ACT_TOKEN', '');
  const databaseUrl = env('DATABASE_URL', '');
  const tenant_id = env('TENANT_ID', 'tenantA');
  const project_id = env('PROJECT_ID', 'projectA');
  const group_id = env('GROUP_ID', 'groupA');

  assert.ok(token, 'AO_ACT_TOKEN required');
  assert.ok(databaseUrl, 'DATABASE_URL required');

  const pool = new Pool({ connectionString: databaseUrl });
  const suffix = `${Date.now()}_${randomUUID().replace(/-/g, '').slice(0, 8)}`;
  const field_id = `field_b5d_${suffix}`;
  const season_id = `season_b5d_${suffix}`;
  const device_id = `device_b5d_${suffix}`;
  const request_id = `apr_b5d_${randomUUID().replace(/-/g, '')}`;
  const now = Date.now();

  const checks = {
    fixture_device_identity_ready: 'FAIL',
    focused_approval_request_seeded: 'FAIL',
    decide_reaches_post_preflight_boundary: 'FAIL',
    historical_missing_adapter_422_eliminated: 'FAIL',
    operation_plan_materialized: 'FAIL',
    operation_plan_device_id_preserved: 'FAIL',
    operation_plan_adapter_type_preserved: 'FAIL',
    operation_plan_device_type_preserved: 'FAIL',
    operation_plan_capability_preserved: 'FAIL',
    downstream_task_blocked_fail_closed: 'FAIL',
    no_ao_act_task_materialized: 'FAIL',
  };

  let decideSnapshot = null;
  let operationPlanSnapshot = null;

  try {
    await seedFormalIrrigationStage1Evidence(pool, {
      tenant_id,
      project_id,
      group_id,
      field_id,
      season_id,
      device_id,
      now_ms: now,
      sample_mode: 'formal',
      pre_soil_moisture: 0.16,
      crop_code: 'corn',
      crop_stage: 'V8',
    });

    const deviceStatusQ = await pool.query(
      `SELECT tenant_id, project_id, group_id, field_id, device_id
         FROM device_status_index_v1
        WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3
          AND field_id=$4 AND device_id=$5
        LIMIT 1`,
      [tenant_id, project_id, group_id, field_id, device_id],
    );
    checks.fixture_device_identity_ready = deviceStatusQ.rowCount === 1 ? 'PASS' : 'FAIL';
    assert.equal(checks.fixture_device_identity_ready, 'PASS', 'focused device identity fixture missing');

    const requestFactId = `fact_b5d_${randomUUID()}`;
    const approvalRequestRecord = {
      type: 'approval_request_v1',
      payload: {
        tenant_id,
        project_id,
        group_id,
        field_id,
        season_id,
        request_id,
        status: 'PENDING',
        actor_id: 'b5d_fixture_actor',
        token_id: 'b5d_fixture_token',
        created_at_ts: now,
        proposal: {
          // Deliberately omit issuer. This is the downstream-only blocker:
          // approval preflight does not consume issuer, while /actions/task
          // requires a structured human issuer and therefore must fail closed.
          action_type: 'IRRIGATE',
          target: { kind: 'field', ref: field_id },
          time_window: { start_ts: now, end_ts: now + 3600000 },
          parameter_schema: {
            keys: [
              { name: 'amount', type: 'number', min: 1, max: 1000 },
              { name: 'coverage_percent', type: 'number', min: 0, max: 100 },
              { name: 'duration_min', type: 'number', min: 1, max: 720 },
            ],
          },
          parameters: { amount: 20, coverage_percent: 90, duration_min: 20 },
          constraints: {},
          meta: {
            field_id,
            season_id,
            device_id,
            task_type: 'IRRIGATION',
          },
        },
      },
    };

    await pool.query(
      `INSERT INTO facts (fact_id, occurred_at, source, record_json)
       VALUES ($1, NOW(), 'acceptance:bline_b5d', $2::jsonb)`,
      [requestFactId, JSON.stringify(approvalRequestRecord)],
    );
    checks.focused_approval_request_seeded = 'PASS';

    const decide = await fetchJson(`${base}/api/v1/approvals/${encodeURIComponent(request_id)}/decide`, {
      method: 'POST',
      token,
      body: {
        tenant_id,
        project_id,
        group_id,
        decision: 'APPROVE',
        reason: 'B5-D focused approval execution-context qualification',
        device_id,
        adapter_type: 'irrigation_simulator',
        device_type: 'IRRIGATION_CONTROLLER',
        required_capabilities: ['device.irrigation.valve.open'],
      },
    });

    decideSnapshot = {
      status: decide.status,
      ok: decide.ok,
      error: decide.json?.error ?? null,
      detail: decide.json?.detail ?? null,
    };

    const historicalLeafStillPresent =
      Number(decide.status) === 422
      && String(decide.json?.error ?? '') === 'CAPABILITY_RESOLUTION_FAILED'
      && Array.isArray(decide.json?.detail?.reasons)
      && decide.json.detail.reasons.includes('missing_adapter_type');

    checks.historical_missing_adapter_422_eliminated = historicalLeafStillPresent ? 'FAIL' : 'PASS';
    assert.equal(
      checks.historical_missing_adapter_422_eliminated,
      'PASS',
      `historical B5-A leaf still present: ${JSON.stringify(decideSnapshot)}`,
    );

    // The focused fixture intentionally blocks only the automatic task issuance.
    // Expected response is the wrapper's fail-closed task-create error, reached
    // after capability preflight and operation-plan materialization.
    const reachedExpectedBoundary =
      Number(decide.status) === 400
      && String(decide.json?.error ?? '') === 'AO_ACT_TASK_CREATE_FAILED';
    checks.decide_reaches_post_preflight_boundary = reachedExpectedBoundary ? 'PASS' : 'FAIL';
    checks.downstream_task_blocked_fail_closed = reachedExpectedBoundary ? 'PASS' : 'FAIL';

    assert.equal(
      checks.decide_reaches_post_preflight_boundary,
      'PASS',
      `decide did not reach expected post-plan downstream blocker: ${JSON.stringify(decideSnapshot)}`,
    );

    const planQ = await pool.query(
      `SELECT fact_id, record_json::jsonb AS record_json
         FROM facts
        WHERE (record_json::jsonb->>'type')='operation_plan_v1'
          AND (record_json::jsonb#>>'{payload,tenant_id}')=$1
          AND (record_json::jsonb#>>'{payload,project_id}')=$2
          AND (record_json::jsonb#>>'{payload,group_id}')=$3
          AND (record_json::jsonb#>>'{payload,approval_request_id}')=$4
        ORDER BY occurred_at DESC, fact_id DESC
        LIMIT 1`,
      [tenant_id, project_id, group_id, request_id],
    );

    assert.equal(planQ.rowCount, 1, 'operation_plan_v1 not materialized');
    const planPayload = planQ.rows[0].record_json?.payload ?? {};
    operationPlanSnapshot = {
      fact_id: String(planQ.rows[0].fact_id ?? ''),
      operation_plan_id: String(planPayload.operation_plan_id ?? ''),
      status: String(planPayload.status ?? ''),
      device_id: planPayload.device_id ?? null,
      adapter_type: planPayload.adapter_type ?? null,
      device_type: planPayload.device_type ?? null,
      required_capabilities: planPayload.required_capabilities ?? null,
    };

    checks.operation_plan_materialized = operationPlanSnapshot.operation_plan_id ? 'PASS' : 'FAIL';
    checks.operation_plan_device_id_preserved = planPayload.device_id === device_id ? 'PASS' : 'FAIL';
    checks.operation_plan_adapter_type_preserved = planPayload.adapter_type === 'irrigation_simulator' ? 'PASS' : 'FAIL';
    checks.operation_plan_device_type_preserved = planPayload.device_type === 'IRRIGATION_CONTROLLER' ? 'PASS' : 'FAIL';
    checks.operation_plan_capability_preserved =
      Array.isArray(planPayload.required_capabilities)
      && planPayload.required_capabilities.includes('device.irrigation.valve.open')
        ? 'PASS'
        : 'FAIL';

    const taskQ = await pool.query(
      `SELECT fact_id
         FROM facts
        WHERE (record_json::jsonb->>'type')='ao_act_task_v0'
          AND (record_json::jsonb#>>'{payload,tenant_id}')=$1
          AND (record_json::jsonb#>>'{payload,project_id}')=$2
          AND (record_json::jsonb#>>'{payload,group_id}')=$3
          AND (
            (record_json::jsonb#>>'{payload,approval_request_id}')=$4
            OR (record_json::jsonb#>>'{payload,operation_plan_id}')=$5
          )`,
      [tenant_id, project_id, group_id, request_id, operationPlanSnapshot.operation_plan_id],
    );

    checks.no_ao_act_task_materialized = Number(taskQ.rowCount ?? 0) === 0 ? 'PASS' : 'FAIL';

    for (const [name, value] of Object.entries(checks)) {
      assert.equal(value, 'PASS', `check failed: ${name}`);
    }

    process.stdout.write(`${JSON.stringify({
      ok: true,
      task: TASK,
      checks,
      ids: { field_id, season_id, device_id, request_id },
      decide: decideSnapshot,
      operation_plan: operationPlanSnapshot,
      boundary: {
        task_creation: 'BLOCKED_BY_FIXTURE / NO TASK MATERIALIZED',
        skill_execution: 'NOT_ENTERED',
        receipt: 'NOT_ENTERED',
        field_memory: 'NOT_ENTERED',
        roi: 'NOT_ENTERED',
      },
    }, null, 2)}\n`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({
    ok: false,
    task: TASK,
    error: String(error?.stack ?? error?.message ?? error),
  }, null, 2)}\n`);
  process.exit(1);
});
