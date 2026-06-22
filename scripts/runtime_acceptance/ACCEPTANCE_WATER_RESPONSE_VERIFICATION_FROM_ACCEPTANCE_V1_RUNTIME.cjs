// scripts/runtime_acceptance/ACCEPTANCE_WATER_RESPONSE_VERIFICATION_FROM_ACCEPTANCE_V1_RUNTIME.cjs

const assert = require('assert');
const { Pool } = require('pg');

const prefix = 'h45_water_response_verification_from_acceptance_';
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:3001';
const scope = {
  tenant_id: process.env.GEOX_TENANT_ID || 'tenantA',
  project_id: process.env.GEOX_PROJECT_ID || 'projectA',
  group_id: process.env.GEOX_GROUP_ID || 'groupA',
  field_id: process.env.THREE_SURFACE_FIELD_ID || 'field_demo_001',
  zone_id: 'zoneA',
};

const requiredTokenEnv = [
  'GEOX_OPERATOR_ACCEPTANCE_TOKEN',
  'GEOX_AGRONOMIST_ACCEPTANCE_TOKEN',
  'GEOX_ACCEPTANCE_TOKEN',
  'GEOX_EXECUTOR_ACCEPTANCE_TOKEN',
  'GEOX_APPROVER_ONLY_TOKEN',
  'GEOX_CLIENT_TOKEN',
  'GEOX_VIEWER_TOKEN',
];

const missingTokenEnv = requiredTokenEnv.filter((name) => !String(process.env[name] || '').trim());
if (missingTokenEnv.length > 0) {
  throw new Error(`H45_REQUIRED_TOKEN_ENV_MISSING: ${missingTokenEnv.join(',')}`);
}

const tokens = {
  operator: process.env.GEOX_OPERATOR_ACCEPTANCE_TOKEN,
  agronomist: process.env.GEOX_AGRONOMIST_ACCEPTANCE_TOKEN,
  admin: process.env.GEOX_ACCEPTANCE_TOKEN,
  executor: process.env.GEOX_EXECUTOR_ACCEPTANCE_TOKEN,
  approver: process.env.GEOX_APPROVER_ONLY_TOKEN,
  client: process.env.GEOX_CLIENT_TOKEN,
  viewer: process.env.GEOX_VIEWER_TOKEN,
};

function id(suffix) {
  return `${prefix}${suffix}`;
}

async function post(body, token = tokens.operator) {
  const response = await fetch(`${baseUrl}/api/v1/water-response/verify-from-acceptance`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  let json = null;
  try { json = await response.json(); } catch {}
  return { status: response.status, json };
}

async function cleanup(pool) {
  await pool.query(
    `DELETE FROM water_response_verification_index_v1
     WHERE acceptance_id LIKE $1
        OR as_executed_id LIKE $1
        OR task_id LIKE $1
        OR receipt_id LIKE $1
        OR pre_state_id LIKE $1
        OR post_state_id LIKE $1`,
    [`${prefix}%`],
  ).catch(() => {});
  await pool.query(`DELETE FROM facts WHERE fact_id LIKE $1 OR record_json::jsonb::text LIKE $2`, [`${prefix}%`, `%${prefix}%`]).catch(() => {});
  await pool.query(`DELETE FROM root_zone_soil_water_state_index_v1 WHERE state_id LIKE $1`, [`${prefix}%`]).catch(() => {});
  await pool.query(`DELETE FROM as_executed_record_v1 WHERE as_executed_id LIKE $1`, [`${prefix}%`]).catch(() => {});
  await pool.query(`DELETE FROM as_applied_map_v1 WHERE as_applied_id LIKE $1`, [`${prefix}%`]).catch(() => {});
}

async function insertAcceptance(pool, body, verdict = 'PASS', overrides = {}) {
  const payload = {
    version: 'v1',
    ...scope,
    acceptance_id: body.acceptance_id,
    as_executed_id: body.as_executed_id,
    act_task_id: body.task_id,
    task_id: body.task_id,
    receipt_id: body.receipt_id,
    operation_plan_id: body.operation_plan_id,
    verdict,
    formal_gate: { execution_effect_passed: false },
    customer_visible_eligible: false,
    ...overrides,
  };
  await pool.query(
    `INSERT INTO facts(fact_id, occurred_at, source, record_json) VALUES($1, NOW(), 'h45_seed', $2::jsonb)`,
    [body.acceptance_result_fact_id, JSON.stringify({ type: 'acceptance_result_v1', payload })],
  );
}

async function insertAsExecuted(pool, body, executionEndAt = '2026-06-22T01:00:00.000Z') {
  await pool.query(
    `INSERT INTO as_executed_record_v1(
      as_executed_id, tenant_id, project_id, group_id, field_id, task_id, receipt_id,
      prescription_id, executed, evidence_refs
    ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb)`,
    [
      body.as_executed_id,
      scope.tenant_id,
      scope.project_id,
      scope.group_id,
      scope.field_id,
      body.task_id,
      body.receipt_id,
      id(`presc_${body.idempotency_key}`),
      JSON.stringify({ execution_end_at: executionEndAt, applied_amount_mm: 10, action_type: 'IRRIGATION' }),
      JSON.stringify([id('evidence')]),
    ],
  );
}

async function insertState(pool, stateId, computedAt, availableWater, matricPotential, overrides = {}) {
  await pool.query(
    `INSERT INTO root_zone_soil_water_state_index_v1(
      state_id, tenant_id, project_id, group_id, field_id, zone_id,
      root_zone_depth_cm, layer_count, estimated_layer_count, blocked_layer_count,
      weighted_matric_potential_kpa, root_zone_available_water_fraction,
      root_zone_water_potential_class, worst_layer_class, stress_layer_count, limited_layer_count,
      input_status, determinism_hash, computed_at
    ) VALUES($1,$2,$3,$4,$5,$6,60,1,1,0,$7,$8,$9,$10,0,0,$11,$12,$13::timestamptz)`,
    [
      stateId,
      scope.tenant_id,
      scope.project_id,
      scope.group_id,
      overrides.field_id || scope.field_id,
      overrides.zone_id || scope.zone_id,
      matricPotential,
      availableWater,
      overrides.className || 'NORMAL',
      overrides.className || 'NORMAL',
      overrides.input_status || 'OK',
      stateId,
      computedAt,
    ],
  );
}

async function seedCase(pool, suffix, options = {}) {
  const body = {
    ...scope,
    acceptance_id: id(`acc_${suffix}`),
    acceptance_result_fact_id: id(`acc_fact_${suffix}`),
    as_executed_id: id(`ae_${suffix}`),
    task_id: id(`task_${suffix}`),
    receipt_id: id(`receipt_${suffix}`),
    operation_plan_id: id(`op_${suffix}`),
    operator_id: id('operator'),
    idempotency_key: id(`key_${suffix}`),
    pre_state_id: id(`pre_${suffix}`),
    post_state_id: id(`post_${suffix}`),
    verification_reason: 'verify post-irrigation root-zone water response',
  };

  if (!options.skipAcceptance) await insertAcceptance(pool, body, options.verdict || 'PASS', options.acceptanceOverrides || {});
  if (!options.skipAsExecuted) await insertAsExecuted(pool, body, options.executionEndAt || '2026-06-22T01:00:00.000Z');
  if (!options.skipPreState) await insertState(pool, body.pre_state_id, '2026-06-22T00:00:00.000Z', 0.30, -40);
  if (!options.skipPostState) {
    await insertState(
      pool,
      body.post_state_id,
      options.postComputedAt || '2026-06-22T02:00:00.000Z',
      options.postAvailableWater,
      options.postMatricPotential,
      options.postStateOverrides || {},
    );
  }

  return body;
}

async function countFacts(pool, type) {
  const result = await pool.query(
    `SELECT count(*)::int AS c FROM facts WHERE (record_json::jsonb->>'type')=$1 AND record_json::jsonb::text LIKE $2`,
    [type, `%${prefix}%`],
  );
  return result.rows[0].c;
}

async function expectStatus(pool, suffix, expectedStatus, options = {}) {
  const body = await seedCase(pool, suffix, options);
  const result = await post(body, options.token || tokens.operator);
  assert.equal(result.json?.status, expectedStatus, `${suffix} status mismatch`);
  return { body, result };
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await cleanup(pool);

    const successBody = await seedCase(pool, 'success', { postAvailableWater: 0.38, postMatricPotential: -32 });
    const success = await post(successBody, tokens.operator);
    assert.equal(success.json?.status, 'WATER_RESPONSE_VERIFICATION_RECORDED');
    assert.equal(success.json?.response_verdict, 'RESPONDED');
    assert.equal(await countFacts(pool, 'operator_water_response_verification_submission_v1'), 1);
    assert.equal(await countFacts(pool, 'water_response_verification_v1'), 1);

    const verificationFactId = success.json?.water_response_verification_fact_id || success.json?.verification_id;
    assert(verificationFactId, "missing water_response_verification_fact_id or verification_id");

    const indexCount = await pool.query(
      `SELECT count(*)::int AS c
       FROM water_response_verification_index_v1
       WHERE verification_id=$1 OR source_fact_id=$1`,
      [verificationFactId],
    );
    assert.equal(indexCount.rows[0].c, 1);

    const duplicate = await post(successBody, tokens.operator);
    assert.equal(duplicate.json?.status, 'REJECTED_DUPLICATE');
    assert.equal(await countFacts(pool, 'water_response_verification_v1'), 1);

    await expectStatus(pool, 'missing_acceptance', 'REJECTED_ACCEPTANCE_NOT_FOUND', { skipAcceptance: true, postAvailableWater: 0.38, postMatricPotential: -32 });
    await expectStatus(pool, 'not_pass', 'REJECTED_ACCEPTANCE_NOT_PASSED', { verdict: 'FAIL', postAvailableWater: 0.38, postMatricPotential: -32 });
    await expectStatus(pool, 'missing_as_executed', 'REJECTED_AS_EXECUTED_NOT_FOUND', { skipAsExecuted: true, postAvailableWater: 0.38, postMatricPotential: -32 });
    await expectStatus(pool, 'missing_pre_state', 'REJECTED_PRE_STATE_NOT_FOUND', { skipPreState: true, postAvailableWater: 0.38, postMatricPotential: -32 });
    await expectStatus(pool, 'missing_post_state', 'REJECTED_POST_STATE_NOT_FOUND', { skipPostState: true });
    await expectStatus(pool, 'scope_mismatch', 'REJECTED_SCOPE_MISMATCH', { postAvailableWater: 0.38, postMatricPotential: -32, acceptanceOverrides: { as_executed_id: id('wrong_as_executed') } });
    await expectStatus(pool, 'post_before_pre', 'REJECTED_STATE_TIME_ORDER', { postComputedAt: '2026-06-21T23:00:00.000Z', postAvailableWater: 0.38, postMatricPotential: -32 });
    await expectStatus(pool, 'post_before_execution_end_at', 'REJECTED_STATE_TIME_ORDER', { postComputedAt: '2026-06-22T00:30:00.000Z', postAvailableWater: 0.38, postMatricPotential: -32 });

    const noResponse = await seedCase(pool, 'no_response', { postAvailableWater: 0.30, postMatricPotential: -40 });
    assert.equal((await post(noResponse, tokens.operator)).json?.response_verdict, 'NO_RESPONSE_OBSERVED');

    const partial = await seedCase(pool, 'partial_response', { postAvailableWater: 0.32, postMatricPotential: -39 });
    assert.equal((await post(partial, tokens.operator)).json?.response_verdict, 'PARTIAL_RESPONSE');

    const notVerifiable = await seedCase(pool, 'not_verifiable', { postAvailableWater: null, postMatricPotential: -32 });
    assert.equal((await post(notVerifiable, tokens.operator)).json?.response_verdict, 'NOT_VERIFIABLE');

    const operatorBody = await seedCase(pool, 'operator_auth', { postAvailableWater: 0.38, postMatricPotential: -32 });
    assert.equal((await post(operatorBody, tokens.operator)).status, 200);
    const adminBody = await seedCase(pool, 'admin_auth', { postAvailableWater: 0.38, postMatricPotential: -32 });
    assert.equal((await post(adminBody, tokens.admin)).status, 200);
    const agronomistBody = await seedCase(pool, 'agronomist_auth', { postAvailableWater: 0.38, postMatricPotential: -32 });
    assert.equal((await post(agronomistBody, tokens.agronomist)).status, 200);

    const executorBody = await seedCase(pool, 'executor_auth', { postAvailableWater: 0.38, postMatricPotential: -32 });
    assert.equal((await post(executorBody, tokens.executor)).status, 403);
    const approverBody = await seedCase(pool, 'approver_auth', { postAvailableWater: 0.38, postMatricPotential: -32 });
    assert.equal((await post(approverBody, tokens.approver)).status, 403);
    const clientBody = await seedCase(pool, 'client_auth', { postAvailableWater: 0.38, postMatricPotential: -32 });
    assert.equal((await post(clientBody, tokens.client)).status, 403);
    const viewerBody = await seedCase(pool, 'viewer_auth', { postAvailableWater: 0.38, postMatricPotential: -32 });
    assert.equal((await post(viewerBody, tokens.viewer)).status, 403);

    assert.equal(await countFacts(pool, 'roi_ledger_v1'), 0);
    assert.equal(await countFacts(pool, 'field_memory_v1'), 0);
    assert.equal(await countFacts(pool, 'operation_state_v1'), 0);

    console.log('PASS H45 runtime acceptance');
  } finally {
    await cleanup(pool);
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
