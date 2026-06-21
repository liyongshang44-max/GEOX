// scripts/runtime_acceptance/ACCEPTANCE_RECOMMENDATION_APPROVAL_REQUEST_RUNTIME_V1.cjs
const { Pool } = require('pg');
const crypto = require('crypto');
const assert = (c,m,x)=>{ if(!c){ console.error('FAIL:',m,x||''); process.exit(1);} console.log('ok -',m); };
const DATABASE_URL = process.env.DATABASE_URL || 'postgres://landos:landos_pwd@127.0.0.1:5433/landos';
const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3001';
const OPERATOR_TOKEN = process.env.GEOX_OPERATOR_ACCEPTANCE_TOKEN || 'set-via-env-or-external-secret-file-pdi-writeonly';
const CLIENT_TOKEN = process.env.GEOX_CLIENT_ACCEPTANCE_TOKEN || 'set-via-env-or-external-secret-file-client';
const RUN = `h36_recommendation_approval_request_acceptance_${Date.now()}_${crypto.randomUUID().slice(0,8)}`;
const scope = { tenant_id: process.env.GEOX_TENANT_ID || 'tenantA', project_id: process.env.GEOX_PROJECT_ID || 'projectA', group_id: process.env.GEOX_GROUP_ID || 'groupA', field_id: process.env.THREE_SURFACE_FIELD_ID || 'field_demo_001', zone_id: 'zoneA' };
async function cleanup(pool){ await pool.query('DELETE FROM facts WHERE record_json::text LIKE $1 OR source = $2', [`%${RUN}%`, RUN]).catch(()=>{}); }
async function fetchJson(path, body, token = OPERATOR_TOKEN){ const r = await fetch(`${BASE_URL}${path}`, { method:'POST', headers:{'content-type':'application/json', authorization:`Bearer ${token}`}, body: JSON.stringify(body) }); const json = await r.json().catch(()=>({})); return { status:r.status, json }; }
function body(key, patch={}){ return { ...scope, operator_id:'operator_demo', submission_reason:`${RUN} request approval`, idempotency_key:key, time_window:{ start_ts:1760000000000, end_ts:1760003600000 }, ...patch }; }
async function insertFact(pool, recId, patch={}){ const payload = { version:'v1', ...scope, recommendation_id: recId, source:'ROOT_ZONE_SCENARIO_SELECTION', source_option_id:'IRRIGATE_DAY0', source_submission_id:`${RUN}_submission`, status:'CANDIDATE', human_approval_required:true, no_direct_execution:true, approval_created:false, operation_plan_created:false, task_created:false, dispatch_created:false, roi_created:false, field_memory_created:false, recommendation_kind:'IRRIGATION_CANDIDATE_FROM_SCENARIO', proposed_action:{ action_type:'IRRIGATE', total_irrigation_mm: 12, total_effective_irrigation_mm: 10 }, evidence_refs:[`${RUN}:evidence`], created_at:new Date().toISOString(), ...patch };
  const fact = `fact_${RUN}_${crypto.randomUUID()}`; await pool.query('INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, NOW(), $2, $3::jsonb)', [fact, RUN, JSON.stringify({ type:'decision_recommendation_v1', payload })]); return fact; }
async function count(pool,type){ const r=await pool.query("SELECT count(*)::int AS n FROM facts WHERE record_json->>'type'=$1 AND record_json::text LIKE $2", [type, `%${RUN}%`]); return Number(r.rows[0].n); }
async function probeCount(pool){ const r=await pool.query('SELECT count(*)::int AS n FROM facts WHERE record_json::text LIKE $1 OR source = $2', [`%${RUN}%`, RUN]); return Number(r.rows[0].n); }
async function submit(recId,key,patch={},token=OPERATOR_TOKEN){ return fetchJson(`/api/v1/operator/recommendations/${encodeURIComponent(recId)}/request-approval`, body(key, patch), token); }
(async()=>{ const pool=new Pool({ connectionString:DATABASE_URL }); try { await cleanup(pool);
  const rec = `${RUN}_rec_success`; await insertFact(pool, rec);
  const clientDenied = await submit(rec, `${RUN}_key_client_denied`, {}, CLIENT_TOKEN); assert([401,403,404].includes(clientDenied.status) || clientDenied.json?.ok === false, 'viewer/client token cannot request approval', clientDenied);
  assert(await count(pool,'approval_request_v1') === 0, 'unauthorized client creates no approval request');
  const res = await submit(rec, `${RUN}_key_success`); assert(res.json.status === 'SUBMITTED_TO_APPROVAL_REQUEST', 'operator role token can submit request approval', res);
  assert(await count(pool,'operator_recommendation_approval_request_submission_v1') === 1, 'one submission fact created');
  assert(await count(pool,'approval_request_v1') === 1, 'one approval request fact created');
  for (const t of ['approval_decision_v1','operation_plan_v1','ao_act_task_v0','roi_ledger_v1','field_memory_v1']) assert(await count(pool,t) === 0, `no ${t} fact created`);
  const dup = await submit(rec, `${RUN}_key_success`); assert(dup.json.status === 'REJECTED_DUPLICATE' && dup.json.duplicate === true, 'duplicate rejected'); assert(await count(pool,'approval_request_v1') === 1, 'duplicate creates no approval request');
  const cases = [
    ['non_candidate',{status:'APPROVED'},'REJECTED_RECOMMENDATION_NOT_CANDIDATE',{}],
    ['scope_mismatch',{field_id:'other_field'},'REJECTED_RECOMMENDATION_NOT_FOUND',{}],
    ['approval_created',{approval_created:true},'REJECTED_DOWNSTREAM_ALREADY_CREATED',{}],
    ['operation_plan_created',{operation_plan_created:true},'REJECTED_DOWNSTREAM_ALREADY_CREATED',{}],
    ['task_created',{task_created:true},'REJECTED_DOWNSTREAM_ALREADY_CREATED',{}],
    ['direct_false',{no_direct_execution:false},'REJECTED_DIRECT_EXECUTION_FORBIDDEN',{}],
    ['missing_source_option',{source_option_id:''},'REJECTED_RECOMMENDATION_NOT_CANDIDATE',{}],
    ['missing_evidence',{evidence_refs:[]},'REJECTED_RECOMMENDATION_NOT_CANDIDATE',{}],
    ['missing_amount',{proposed_action:{ action_type:'IRRIGATE', total_effective_irrigation_mm: 1 }},'REJECTED_RECOMMENDATION_NOT_CANDIDATE',{}],
    ['zero_amount',{proposed_action:{ action_type:'IRRIGATE', total_irrigation_mm: 0, total_effective_irrigation_mm: 0 }},'REJECTED_RECOMMENDATION_NOT_CANDIDATE',{}],
    ['zone_omitted',{},'REJECTED_RECOMMENDATION_NOT_FOUND',{ zone_id: undefined }],
  ];
  for (const [name,patch,expected,bodyPatch] of cases){ const id=`${RUN}_rec_${name}`; await insertFact(pool,id,patch); const before=await count(pool,'approval_request_v1'); const out=await submit(id, `${RUN}_key_${name}`, bodyPatch); assert(out.json.status===expected, `${name} rejected as ${expected}`, out); assert(await count(pool,'approval_request_v1')===before, `${name} creates no approval_request_v1`); }
  const miss=`${RUN}_rec_missing_window`; await insertFact(pool, miss); let before=await count(pool,'approval_request_v1'); let out=await submit(miss, `${RUN}_key_missing_window`, { time_window: undefined }); assert(out.json.status==='REJECTED_INVALID_INPUT', 'missing time_window rejected', out); assert(await count(pool,'approval_request_v1')===before, 'missing time_window creates no approval_request_v1');
  const inv=`${RUN}_rec_invalid_window`; await insertFact(pool, inv); before=await count(pool,'approval_request_v1'); out=await submit(inv, `${RUN}_key_invalid_window`, { time_window:{ start_ts:2, end_ts:1 } }); assert(out.json.status==='REJECTED_INVALID_INPUT', 'invalid time_window rejected', out); assert(await count(pool,'approval_request_v1')===before, 'invalid time_window creates no approval_request_v1');
  await cleanup(pool); assert(await probeCount(pool) === 0, 'runtime cleanup removed all H36 probe facts');
  console.log('PASS recommendation approval request runtime acceptance');
 } finally { await cleanup(pool); await pool.end(); } })().catch(e=>{ console.error(e); process.exit(1); });
