#!/usr/bin/env node
const { randomUUID } = require('crypto');
const { Pool } = require('pg');
const BASE=(process.env.GEOX_BASE_URL||process.env.BASE_URL||'http://127.0.0.1:3001').replace(/\/$/,'');
const FIELD=process.env.GEOX_FIELD_ID||process.env.FIELD_ID||'field_c8_demo';
const tenant_id=process.env.TENANT_ID||'tenantA';
const project_id=process.env.PROJECT_ID||'projectA';
const group_id=process.env.GROUP_ID||'groupA';
const assert=(c,m,d)=>{if(!c) throw new Error(m+(d?' '+JSON.stringify(d):''))};
const factIds=[];
function record(type, payload){ return { type, payload: { tenant_id, project_id, group_id, field_id: FIELD, ...payload } }; }
async function insertFact(pool, type, payload){ const factId=`h26_fact_fallback_${type}_${randomUUID()}`; factIds.push(factId); await pool.query('INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, NOW(), $2, $3::jsonb)', [factId, 'acceptance/operator-field-twin-calibration-fact-fallback', record(type, payload)]); return factId; }
async function main(){
  const connectionString=process.env.DATABASE_URL||process.env.POSTGRES_URL||process.env.PG_URL;
  assert(connectionString, 'DATABASE_URL/POSTGRES_URL/PG_URL required for facts fallback acceptance');
  const pool=new Pool({ connectionString });
  try {
    await insertFact(pool, 'operation_plan_v1', { operation_plan_id: 'h26_plan_positive' });
    await insertFact(pool, 'ao_act_task_v0', { act_task_id: 'h26_task_positive', operation_plan_id: 'h26_plan_positive' });
    await insertFact(pool, 'ao_act_receipt_v1', { receipt_id: 'h26_receipt_positive', act_task_id: 'h26_task_positive', operation_plan_id: 'h26_plan_positive' });
    await insertFact(pool, 'acceptance_result_v1', { acceptance_id: 'h26_acceptance_positive', operation_plan_id: 'h26_plan_positive' });
    const p=new URLSearchParams({tenant_id, project_id, group_id});
    const r=await fetch(`${BASE}/api/v1/operator/twin/fields/${encodeURIComponent(FIELD)}/calibration?${p}`);
    assert(r.ok, 'HTTP failed', { status:r.status, text: await r.text().catch(()=> '') });
    const body=await r.json();
    const q=body.operator_field_twin_calibration_replay_v1;
    assert(q, 'missing replay payload');
    const byStage=new Map((q.replay_timeline_v1?.items||[]).map((item)=>[item.stage,item]));
    for (const stage of ['OPERATION_PLAN','TASK','RECEIPT','ACCEPTANCE']) assert(byStage.get(stage)?.status !== 'NOT_AVAILABLE', 'stage should be replayable from facts fallback '+stage, byStage.get(stage));
    const gapCodes=new Set((q.replay_gaps||[]).map((gap)=>gap.gap_code));
    for (const gap of ['OPERATION_PLAN_NOT_FOUND','AO_ACT_RECEIPT_NOT_FOUND','ACCEPTANCE_RESULT_NOT_FOUND']) assert(!gapCodes.has(gap), 'gap should be absent when fact exists '+gap);
    console.log('[operator-field-twin-calibration-fact-fallback] PASS');
  } finally {
    if (factIds.length) await pool.query('DELETE FROM facts WHERE fact_id = ANY($1::text[])', [factIds]).catch(()=>{});
    await pool.end().catch(()=>{});
  }
}
main().catch(e=>{console.error('[operator-field-twin-calibration-fact-fallback] FAIL'); console.error(e); process.exit(1);});
