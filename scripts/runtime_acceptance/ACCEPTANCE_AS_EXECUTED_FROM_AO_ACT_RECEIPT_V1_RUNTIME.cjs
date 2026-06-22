#!/usr/bin/env node
// scripts/runtime_acceptance/ACCEPTANCE_AS_EXECUTED_FROM_AO_ACT_RECEIPT_V1_RUNTIME.cjs
const assert = require('assert');
const { Pool } = require('pg');
const crypto = require('crypto');
const PREFIX = 'h42_as_executed_from_ao_act_receipt_v1_acceptance_';
const DATABASE_URL = process.env.DATABASE_URL || 'postgres://landos:landos_pwd@127.0.0.1:5433/landos';
const BASE = process.env.BASE_URL || process.env.THREE_SURFACE_BASE_URL || 'http://127.0.0.1:3001';
const TOK = process.env.GEOX_EXECUTOR_ACCEPTANCE_TOKEN || process.env.GEOX_ACCEPTANCE_TOKEN || 'set-via-env-or-external-secret-file-executor';
const APPROVER = process.env.GEOX_APPROVER_ONLY_TOKEN || 'set-via-env-or-external-secret-file-approver';
const CLIENT = process.env.GEOX_CLIENT_TOKEN || 'set-via-env-or-external-secret-file-client';
const scope = { tenant_id: process.env.GEOX_TENANT_ID || 'tenantA', project_id: process.env.GEOX_PROJECT_ID || 'projectA', group_id: process.env.GEOX_GROUP_ID || 'groupA', field_id: process.env.THREE_SURFACE_FIELD_ID || 'field_demo_001', zone_id: 'zoneA' };
const pool = new Pool({ connectionString: DATABASE_URL });
const id = s => PREFIX + s + '_' + crypto.randomUUID().replace(/-/g,'');
function receiptPayload(plan, task, rid, extra={}) { return { ...scope, version:'v1', operation_plan_id:plan, act_task_id:task, ao_act_receipt_id:rid, executor_id:{kind:'human',id:'exec',namespace:'acceptance'}, execution_time:{start_ts:1,end_ts:2}, execution_coverage:{kind:'field',ref:'field'}, resource_usage:{}, evidence_refs:[{kind:'operator_photo',ref:'evidence://h42'}], logs_refs:[{kind:'executor_log',ref:'log://h42'}], status:'EXECUTED', constraint_check:{violated:false,violations:[]}, observed_parameters:{duration_sec:120}, meta:{source:'AO_ACT_TASK_V0', no_acceptance_created:true, no_effect_judgement:true, no_roi_created:true, no_field_memory_created:true}, created_at_ts:1, ...extra }; }
async function fact(type,payload){ const fid=id('fact'); await pool.query('INSERT INTO facts (fact_id,occurred_at,source,record_json) VALUES ($1,NOW(),$2,$3::jsonb)',[fid,PREFIX,{type,payload}]); return fid; }
async function idx(plan,task,receiptFact){ const now = Date.now(); await pool.query(`INSERT INTO operation_plan_index_v1 (operation_plan_id,tenant_id,project_id,group_id,field_id,zone_id,spatial_scope_json,status,act_task_id,receipt_fact_id,source_fact_id,created_ts,updated_ts) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,'RECEIPT_RECORDED',$8,$9,$9,$10,$10) ON CONFLICT (operation_plan_id) DO UPDATE SET act_task_id=EXCLUDED.act_task_id, receipt_fact_id=EXCLUDED.receipt_fact_id, source_fact_id=EXCLUDED.source_fact_id, updated_ts=EXCLUDED.updated_ts`,[plan,scope.tenant_id,scope.project_id,scope.group_id,scope.field_id,scope.zone_id,JSON.stringify({zone_id:scope.zone_id}),task,receiptFact,now]); }
async function post(body, token=TOK){ const r=await fetch(BASE+'/api/v1/as-executed/from-ao-act-receipt-v1',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+token},body:JSON.stringify(body)}); let json=null; try{json=await r.json()}catch{} return {status:r.status,json}; }
function body(plan,task,rid,extra={}){ return {...scope,operation_plan_id:plan,act_task_id:task,receipt_id:rid,idempotency_key:'stable-key',...extra}; }
async function counts(task,rid){ const ae=await pool.query('SELECT count(*)::int c FROM as_executed_record_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND task_id=$4 AND receipt_id=$5',[scope.tenant_id,scope.project_id,scope.group_id,task,rid]); const am=await pool.query('SELECT count(*)::int c FROM as_applied_map_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND task_id=$4 AND receipt_id=$5',[scope.tenant_id,scope.project_id,scope.group_id,task,rid]); return {ae:ae.rows[0].c, am:am.rows[0].c}; }
async function neg(name, mut, expected){ const plan=id(name+'plan'), task=id(name+'task'), rid=id(name+'receipt'); let payload=receiptPayload(plan,task,rid); if (mut) payload=mut(payload) || payload; const fid=await fact(name==='not_v1'?'ao_act_receipt_v0':'ao_act_receipt_v1',payload); if(name!=='missing_index') await idx(plan,task,name==='idx_mismatch'?id('otherfact'):fid); const r=await post(body(plan,task,rid, name==='scope_mismatch'?{field_id:'wrong_field'}:{})); assert.equal(r.json?.status, expected, name); }
(async()=>{ const made=[]; try{
  const plan=id('plan'), task=id('task'), rid=id('receipt'); const fid=await fact('ao_act_receipt_v1', receiptPayload(plan,task,rid)); made.push(plan,task,rid); await idx(plan,task,fid);
  let r=await post(body(plan,task,rid)); assert.equal(r.status,200); assert.equal(r.json?.status,'AS_EXECUTED_RECORDED'); assert.equal(r.json?.as_executed_created,true); assert.equal(r.json?.as_applied_created,true); assert.equal(r.json?.acceptance_created,false); assert.equal(r.json?.evidence_artifact_created,false); assert.equal(r.json?.roi_created,false); assert.equal(r.json?.field_memory_created,false);
  let c=await counts(task,fid); assert.equal(c.ae,1); assert.equal(c.am,1);
  r=await post(body(plan,task,rid)); assert.equal(r.json?.status,'REJECTED_DUPLICATE'); assert.equal(r.json?.duplicate,true); c=await counts(task,fid); assert.equal(c.ae,1); assert.equal(c.am,1);
  r=await post(body(id('missingplan'),id('missingtask'),id('missingreceipt'))); assert.equal(r.json?.status,'REJECTED_RECEIPT_NOT_FOUND');
  await neg('not_v1', null, 'REJECTED_RECEIPT_NOT_V1');
  await neg('missing_index', null, 'REJECTED_OPERATION_PLAN_NOT_FOUND');
  await neg('idx_mismatch', null, 'REJECTED_OPERATION_PLAN_RECEIPT_MISMATCH');
  await neg('scope_mismatch', null, 'REJECTED_SCOPE_MISMATCH');
  await neg('no_acceptance', p=>{p.meta.no_acceptance_created=false;}, 'REJECTED_RECEIPT_NOT_H41');
  await neg('no_effect', p=>{p.meta.no_effect_judgement=false;}, 'REJECTED_RECEIPT_NOT_H41');
  await neg('no_evidence', p=>{p.evidence_refs=[];}, 'REJECTED_RECEIPT_NOT_H41');
  await neg('no_logs', p=>{p.logs_refs=[];}, 'REJECTED_RECEIPT_NOT_H41');
  r=await post(body(plan,task,rid), APPROVER); assert([401,403].includes(r.status));
  r=await post(body(plan,task,rid), CLIENT); assert([401,403].includes(r.status));
  for (const t of ['acceptance_result_v1','evidence_artifact_v1','roi_ledger_v1','field_memory_v1']) { const q=await pool.query("SELECT count(*)::int c FROM facts WHERE (record_json::jsonb->>'type')=$1 AND record_json::jsonb::text LIKE $2",[t,'%'+PREFIX+'%']); assert.equal(q.rows[0].c,0,t); }
  console.log('ACCEPTANCE_AS_EXECUTED_FROM_AO_ACT_RECEIPT_V1_RUNTIME passed');
} finally {
  await pool.query("DELETE FROM as_applied_map_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND (task_id LIKE $4 OR receipt_id LIKE $4)",[scope.tenant_id,scope.project_id,scope.group_id,PREFIX+'%']).catch(()=>{});
  await pool.query("DELETE FROM as_executed_record_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND (task_id LIKE $4 OR receipt_id LIKE $4)",[scope.tenant_id,scope.project_id,scope.group_id,PREFIX+'%']).catch(()=>{});
  await pool.query("DELETE FROM operation_plan_index_v1 WHERE operation_plan_id LIKE $1 OR act_task_id LIKE $1 OR receipt_fact_id LIKE $1",[PREFIX+'%']).catch(()=>{});
  await pool.query("DELETE FROM facts WHERE source=$1 OR fact_id LIKE $2 OR record_json::jsonb::text LIKE $2",[PREFIX,'%'+PREFIX+'%']).catch(()=>{});
  await pool.end();
}})().catch(e=>{ console.error(e); process.exit(1); });
