#!/usr/bin/env node
// scripts/runtime_acceptance/ACCEPTANCE_OPERATION_PLAN_TRANSITION_RUNTIME_V1.cjs
const { Pool } = require('pg');
const assert = require('assert');
const crypto = require('crypto');
const prefix = 'h39_operation_plan_transition_acceptance_';
const DATABASE_URL = process.env.DATABASE_URL;
const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3001';
const TOKEN = process.env.GEOX_ACCEPTANCE_TOKEN;
const APPROVER_ONLY_TOKEN = process.env.GEOX_APPROVER_ONLY_TOKEN || process.env.GEOX_APPROVER_ACCEPTANCE_TOKEN || 'set-via-env-or-external-secret-file-approver';
const CLIENT_TOKEN = process.env.GEOX_CLIENT_TOKEN || process.env.GEOX_CLIENT_ACCEPTANCE_TOKEN || 'set-via-env-or-external-secret-file-client';
if (!DATABASE_URL) throw new Error('DATABASE_URL required');
if (!TOKEN) throw new Error('GEOX_ACCEPTANCE_TOKEN required');
if (!APPROVER_ONLY_TOKEN) throw new Error('GEOX_APPROVER_ONLY_TOKEN required');
if (!CLIENT_TOKEN) throw new Error('GEOX_CLIENT_TOKEN required');
const pool = new Pool({ connectionString: DATABASE_URL });
const id = () => prefix + crypto.randomUUID().replace(/-/g, '');
async function insertFact(factId, type, payload) { await pool.query('INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, NOW(), $2, $3::jsonb)', [factId, 'h39_operation_plan_transition_acceptance', JSON.stringify({ type, payload })]); }
async function countFacts(type, planId) { const r = await pool.query("SELECT count(*)::int AS n FROM facts WHERE (record_json::jsonb->>'type')=$1 AND (record_json::jsonb#>>'{payload,operation_plan_id}')=$2", [type, planId]); return Number(r.rows[0].n); }
async function post(planId, body, token = TOKEN) { const r = await fetch(`${BASE_URL}/api/v1/operator/operation-plans/${encodeURIComponent(planId)}/transition`, { method:'POST', headers:{ 'content-type':'application/json', Authorization:`Bearer ${token}` }, body: JSON.stringify(body) }); return { statusCode:r.status, json: await r.json().catch(() => ({})) }; }
async function seed(planId, status='CREATED', extra={}) { const factId = 'fact_' + id(); const now = Date.now(); const payload = { tenant_id:'tenantA', project_id:'projectA', group_id:'groupA', operation_plan_id:planId, field_id:'field_demo_001', spatial_scope:{ zone_id:'zoneA' }, approval_decision:'APPROVE', approval_decision_fact_id:'fact_decision_'+planId, act_task_id:null, receipt_fact_id:null, status, created_ts:now, updated_ts:now, ...extra }; await insertFact(factId, 'operation_plan_v1', payload); await pool.query(`INSERT INTO public.operation_plan_index_v1 (operation_plan_id, tenant_id, project_id, group_id, field_id, zone_id, spatial_scope_json, approval_decision, approval_decision_fact_id, status, act_task_id, receipt_fact_id, source_fact_id, created_ts, updated_ts) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12,$13,$14,$15) ON CONFLICT (operation_plan_id) DO UPDATE SET status=EXCLUDED.status, act_task_id=EXCLUDED.act_task_id, receipt_fact_id=EXCLUDED.receipt_fact_id, updated_ts=EXCLUDED.updated_ts`, [planId,'tenantA','projectA','groupA','field_demo_001','zoneA',JSON.stringify({zone_id:'zoneA'}),'APPROVE','fact_decision_'+planId,status,extra.act_task_id??null,extra.receipt_fact_id??null,factId,now,now]); }
const baseBody = (key, source='CREATED', target='APPROVED', patch={}) => ({ tenant_id:'tenantA', project_id:'projectA', group_id:'groupA', field_id:'field_demo_001', zone_id:'zoneA', operator_id:'operator_demo', source_status:source, target_status:target, transition_reason:'plan reviewed and approved for task preparation', idempotency_key:key, ...patch });
(async () => {
  const touched = [];
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS public.operation_plan_index_v1 (operation_plan_id text PRIMARY KEY, tenant_id text NOT NULL, project_id text NOT NULL, group_id text NOT NULL, field_id text, zone_id text, spatial_scope_json jsonb, season_id text, program_id text, recommendation_id text, recommendation_fact_id text, approval_request_id text, approval_decision text, approval_decision_fact_id text, status text NOT NULL, act_task_id text, receipt_fact_id text, source_fact_id text, created_ts bigint NOT NULL, updated_ts bigint NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())`);
    const plan = id(); touched.push(plan); await seed(plan, 'CREATED');
    let res = await post(plan, baseBody(id())); assert.equal(res.json.status, 'OPERATION_PLAN_TRANSITION_RECORDED'); assert.equal(res.json.task_created, false); assert.equal(res.json.no_direct_execution, true);
    assert.equal(await countFacts('operator_operation_plan_transition_submission_v1', plan), 1); assert.equal(await countFacts('operation_plan_transition_v1', plan), 1); let row = await pool.query('SELECT status, act_task_id, receipt_fact_id FROM public.operation_plan_index_v1 WHERE operation_plan_id=$1', [plan]); assert.equal(row.rows[0].status, 'APPROVED'); assert.equal(row.rows[0].act_task_id, null); assert.equal(row.rows[0].receipt_fact_id, null);
    for (const t of ['ao_act_task_v0','dispatch_v1','ao_act_receipt_v1','roi_ledger_v1','field_memory_v1']) assert.equal(await countFacts(t, plan), 0);
    const dupKey = id(); const planDup = id(); touched.push(planDup); await seed(planDup, 'CREATED'); res = await post(planDup, baseBody(dupKey)); assert.equal(res.json.status, 'OPERATION_PLAN_TRANSITION_RECORDED'); res = await post(planDup, baseBody(dupKey)); assert.equal(res.json.status, 'REJECTED_DUPLICATE'); assert.equal(await countFacts('operation_plan_transition_v1', planDup), 1);
    res = await post(plan, baseBody(id(), 'APPROVED', 'READY')); assert.equal(res.json.status, 'OPERATION_PLAN_TRANSITION_RECORDED');
    const badTargets = ['READY','DISPATCHED','ACKED','SUCCEEDED','FAILED']; for (const target of badTargets) { const p=id(); touched.push(p); await seed(p,'CREATED'); res = await post(p, baseBody(id(),'CREATED',target)); assert.notEqual(res.json.status, 'OPERATION_PLAN_TRANSITION_RECORDED'); }
    const mismatch=id(); touched.push(mismatch); await seed(mismatch,'CREATED'); res = await post(mismatch, baseBody(id(),'APPROVED','READY')); assert.equal(res.json.status, 'REJECTED_SOURCE_STATUS_MISMATCH');
    const scope=id(); touched.push(scope); await seed(scope,'CREATED'); res = await post(scope, baseBody(id(),'CREATED','APPROVED',{field_id:'wrong_field'})); assert.equal(res.json.status, 'REJECTED_SCOPE_MISMATCH');
    for (const extra of [{act_task_id:'task_x'},{receipt_fact_id:'receipt_x'}]) { const p=id(); touched.push(p); await seed(p,'CREATED',extra); res = await post(p, baseBody(id())); assert.equal(res.json.status, 'REJECTED_DOWNSTREAM_ALREADY_CREATED'); }
    res = await post(plan, baseBody(id(),'READY','APPROVED'), APPROVER_ONLY_TOKEN); assert([401,403].includes(res.statusCode), 'approver-only token is rejected');
    res = await post(plan, baseBody(id(),'READY','APPROVED'), CLIENT_TOKEN); assert([401,403].includes(res.statusCode), 'client/viewer token is rejected');
    console.log('ACCEPTANCE_OPERATION_PLAN_TRANSITION_RUNTIME_V1 passed');
  } finally {
    await pool.query("DELETE FROM facts WHERE fact_id LIKE 'fact_h39_operation_plan_transition_acceptance_%' OR source='h39_operation_plan_transition_acceptance' OR (record_json::jsonb#>>'{payload,operation_plan_id}') LIKE $1", [prefix+'%']).catch(()=>{});
    await pool.query('DELETE FROM public.operation_plan_index_v1 WHERE operation_plan_id LIKE $1', [prefix+'%']).catch(()=>{});
    await pool.end();
  }
})().catch((e) => { console.error(e); process.exit(1); });
