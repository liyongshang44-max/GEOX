// scripts/runtime_acceptance/ACCEPTANCE_TASK_FROM_READY_OPERATION_PLAN_RUNTIME_V1.cjs
const assert = require('assert');
const { Pool } = require('pg');
const { randomUUID } = require('crypto');

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3001';
const OPERATOR_TOKEN = process.env.GEOX_ACCEPTANCE_TOKEN || 'set-via-env-or-external-secret-file-admin';
const APPROVER_TOKEN = process.env.GEOX_APPROVER_ACCEPTANCE_TOKEN || 'set-via-env-or-external-secret-file-approver';
const CLIENT_TOKEN = process.env.GEOX_CLIENT_ACCEPTANCE_TOKEN || 'set-via-env-or-external-secret-file-client';
const prefix = 'h40_task_from_ready_operation_plan_acceptance_';
const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgres://landos:landos_pwd@127.0.0.1:5433/landos' });
const scope = {
  tenant_id: process.env.GEOX_TENANT_ID || 'tenantA',
  project_id: process.env.GEOX_PROJECT_ID || 'projectA',
  group_id: process.env.GEOX_GROUP_ID || 'groupA',
  field_id: process.env.THREE_SURFACE_FIELD_ID || 'field_demo_001',
  zone_id: 'zoneA',
};

async function q(sql, args = []) { return pool.query(sql, args); }
async function insertFact(factId, type, payload) {
  await q('INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1,NOW(),$2,$3::jsonb)', [factId, 'h40_runtime_acceptance', { type, payload }]);
}
async function seed(plan, status = 'READY', opts = {}) {
  const req = 'req_' + plan;
  const dec = 'dec_' + plan;
  const rec = 'rec_' + plan;
  await insertFact('fact_op_' + plan, 'operation_plan_v1', {
    ...scope,
    operation_plan_id: plan,
    approval_request_id: req,
    approval_decision: 'APPROVE',
    approval_decision_fact_id: dec,
    recommendation_id: rec,
    recommendation_fact_id: 'fact_' + rec,
    act_task_id: opts.act_task_id ?? null,
    receipt_fact_id: null,
    status,
  });
  await q(
    `INSERT INTO public.operation_plan_index_v1 (operation_plan_id,tenant_id,project_id,group_id,field_id,zone_id,spatial_scope_json,recommendation_id,recommendation_fact_id,approval_request_id,approval_decision,approval_decision_fact_id,status,act_task_id,receipt_fact_id,source_fact_id,created_ts,updated_ts)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12,$13,$14,NULL,$15,$16,$16)
     ON CONFLICT (operation_plan_id) DO UPDATE SET status=EXCLUDED.status, act_task_id=EXCLUDED.act_task_id, receipt_fact_id=NULL, updated_ts=EXCLUDED.updated_ts`,
    [plan, scope.tenant_id, scope.project_id, scope.group_id, scope.field_id, scope.zone_id, JSON.stringify({ zone_id: scope.zone_id }), rec, 'fact_' + rec, req, 'APPROVE', dec, status, opts.act_task_id ?? null, 'fact_op_' + plan, Date.now()],
  );
  if (!opts.noApproval) {
    await insertFact('fact_ar_' + plan, 'approval_request_v1', {
      ...scope,
      request_id: req,
      status: opts.approvalStatus || 'APPROVED',
      proposal: {
        action_type: 'IRRIGATE',
        target: { kind: 'field', ref: scope.field_id },
        time_window: { start_ts: 1, end_ts: 2 },
        parameter_schema: { keys: [{ name: 'duration_sec', type: 'number', min: 1 }] },
        parameters: { duration_sec: 30 },
        constraints: { max_mm: 10 },
        meta: { no_direct_execution: true, skip_auto_task_issue: true, allow_auto_task_issue: false },
      },
    });
  }
  return { plan, req };
}
async function post(plan, key = 'stable', token = OPERATOR_TOKEN, overrides = {}) {
  const r = await fetch(`${BASE}/api/v1/actions/task/from-operation-plan`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ ...scope, ...overrides, operation_plan_id: plan, operator_id: 'operator_demo', idempotency_key: key, projection_reason: 'project ready operation plan into AO-ACT task' }),
  });
  let j = {};
  try { j = await r.json(); } catch {}
  return { r, j };
}
async function count(type, plan) {
  const r = await q(`SELECT count(*)::int c FROM facts WHERE (record_json::jsonb->>'type')=$1 AND record_json::jsonb::text LIKE $2`, [type, `%${plan}%`]);
  return r.rows[0].c;
}

(async () => {
  const run = prefix + randomUUID().slice(0, 8);
  try {
    await q(`CREATE TABLE IF NOT EXISTS public.operation_plan_index_v1 (operation_plan_id text PRIMARY KEY, tenant_id text NOT NULL, project_id text NOT NULL, group_id text NOT NULL, field_id text, zone_id text, spatial_scope_json jsonb, season_id text, program_id text, recommendation_id text, recommendation_fact_id text, approval_request_id text, approval_decision text, approval_decision_fact_id text, status text NOT NULL, act_task_id text, receipt_fact_id text, source_fact_id text, created_ts bigint NOT NULL, updated_ts bigint NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())`);

    const plan = run + '_ready';
    await seed(plan);
    let { r, j } = await post(plan, 'key1');
    assert(r.ok, JSON.stringify(j));
    assert.equal(j.status, 'AO_ACT_TASK_PROJECTED');
    assert.equal(j.task_created, true);
    assert.equal(await count('operator_operation_plan_task_projection_submission_v1', plan), 1);
    assert.equal(await count('ao_act_task_v0', plan), 1);
    let row = (await q('SELECT act_task_id,receipt_fact_id,status FROM operation_plan_index_v1 WHERE operation_plan_id=$1', [plan])).rows[0];
    assert(row.act_task_id);
    assert.equal(row.receipt_fact_id, null);
    assert.equal(row.status, 'READY');
    for (const t of ['operation_plan_transition_v1', 'dispatch_v1', 'ao_act_receipt_v1', 'acceptance_result_v1', 'roi_ledger_v1', 'field_memory_v1']) assert.equal(await count(t, plan), 0, t);

    ({ r, j } = await post(plan, 'key1'));
    assert.equal(j.status, 'REJECTED_DUPLICATE');
    assert.equal(await count('ao_act_task_v0', plan), 1);
    assert.equal(await count('operator_operation_plan_task_projection_submission_v1', plan), 1);

    for (const [suffix, status, opts, expect] of [
      ['created', 'CREATED', {}, 'REJECTED_OPERATION_PLAN_NOT_READY'],
      ['approved', 'APPROVED', {}, 'REJECTED_OPERATION_PLAN_NOT_READY'],
      ['missing', 'READY', { noApproval: true }, 'REJECTED_APPROVAL_REQUEST_NOT_FOUND'],
      ['nonapproved', 'READY', { approvalStatus: 'PENDING' }, 'REJECTED_APPROVAL_REQUEST_NOT_FOUND'],
      ['existing', 'READY', { act_task_id: 'act_existing' }, 'REJECTED_TASK_ALREADY_CREATED'],
    ]) {
      const p = run + '_' + suffix;
      await seed(p, status, opts);
      const out = await post(p, 'key_' + suffix);
      assert.equal(out.j.status, expect, suffix + JSON.stringify(out.j));
      assert.equal(await count('ao_act_task_v0', p), 0, suffix + ' task not created');
      assert.equal(await count('operator_operation_plan_task_projection_submission_v1', p), 0, suffix + ' submission not created');
    }

    const sm = run + '_scope';
    await seed(sm);
    const bad = await post(sm, 'bad_scope', OPERATOR_TOKEN, { field_id: 'wrong_field' });
    assert.equal(bad.j.status, 'REJECTED_OPERATION_PLAN_NOT_FOUND');
    assert.equal(await count('ao_act_task_v0', sm), 0);
    assert.equal(await count('operator_operation_plan_task_projection_submission_v1', sm), 0);

    const denyApprover = run + '_deny_approver';
    await seed(denyApprover);
    const approver = await post(denyApprover, 'deny_approver', APPROVER_TOKEN);
    assert([401, 403].includes(approver.r.status), 'approver-only token must be rejected');
    assert.equal(await count('ao_act_task_v0', denyApprover), 0);
    assert.equal(await count('operator_operation_plan_task_projection_submission_v1', denyApprover), 0);

    const denyClient = run + '_deny_client';
    await seed(denyClient);
    const client = await post(denyClient, 'deny_client', CLIENT_TOKEN);
    assert([401, 403].includes(client.r.status), 'client/viewer token must be rejected');
    assert.equal(await count('ao_act_task_v0', denyClient), 0);
    assert.equal(await count('operator_operation_plan_task_projection_submission_v1', denyClient), 0);

    console.log('[task-from-ready-operation-plan-runtime] PASS');
  } finally {
    await q('DELETE FROM public.operation_plan_index_v1 WHERE operation_plan_id LIKE $1', [prefix + '%']).catch(() => {});
    await q('DELETE FROM facts WHERE source=$1 OR fact_id LIKE $2 OR record_json::jsonb::text LIKE $3', ['h40_runtime_acceptance', prefix + '%', `%${prefix}%`]).catch(() => {});
    await pool.end();
  }
})().catch((e) => { console.error(e); process.exit(1); });
