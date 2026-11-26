// P4: link a new exact P3 context to its completed native baseline.
// No scientific result is inferred; reassessment uses the existing P3P route.
import type {FastifyInstance,FastifyRequest,FastifyReply} from 'fastify';
import type {Pool,PoolClient} from 'pg';
import {ManagerAuthorityErrorV1,type ManagerAuthorizerV1,type ManagerAuthorityV1} from '../auth/manager_authority_v1.js';
import {digest} from '../domain/field/soil_csv_p2_v1.js';
import {loadManagerNativeReviewBasisV1,readManagerNativeReviewJournalV1,managerNativeReviewEventIdV1} from './manager_native_review_v1.js';
const table='geox_manager_v1.field_context_followup_p4_v1',journal='geox_manager_v1.field_native_assessment_p3p_v1';
const where='tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4';
const obj=(x:unknown):x is Record<string,any>=>!!x&&typeof x==='object'&&!Array.isArray(x);
const id=(x:unknown):x is string=>typeof x==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(x);
class Hold extends Error{constructor(public readonly status:number,code:string){super(code);}}
function need(v:unknown,code:string,status=409):asserts v{if(!v)throw new Hold(status,code);}
const same=(a:unknown,b:unknown)=>digest(a)===digest(b);
const cols='followup_id,baseline_id,actor_id,result,result_sha256,created_at';
function project(r:any){
 need(r&&obj(r.result)&&digest(r.result)===r.result_sha256&&r.result.schema_version==='geox.manager-context-followup.v1'&&r.result.followup_id===r.followup_id&&r.result.baseline_analysis_id===r.baseline_id&&r.result.actor_id===r.actor_id&&r.result.action_authority===false,'FOLLOWUP_HISTORY_INTEGRITY');
 return {followup_id:r.followup_id,baseline_id:r.baseline_id,result:r.result,result_sha256:r.result_sha256,created_at:r.created_at};
}
function delta(before:any[],after:any[]){
 need(Array.isArray(before)&&Array.isArray(after),'FOLLOWUP_DOCUMENT_BASIS_INVALID');
 const old=new Map(before.map(d=>[d.document_id,d])),next=new Map(after.map(d=>[d.document_id,d]));
 need(old.size===before.length&&next.size===after.length,'FOLLOWUP_DOCUMENT_BASIS_INVALID');
 const changed:{document_id:string;previous_revision:number|null;revision:number;candidate_sha256:string}[]=[];
 for(const [k,d] of old){
  const n=next.get(k);need(n&&n.revision>=d.revision,'FOLLOWUP_BASELINE_DOCUMENT_REMOVED');
  if(n.revision===d.revision)need(same(n,d),'FOLLOWUP_SAME_REVISION_MISMATCH');
  else changed.push({document_id:k,previous_revision:d.revision,revision:n.revision,candidate_sha256:n.candidate_sha256});
 }
 for(const [k,n] of next)if(!old.has(k))changed.push({document_id:k,previous_revision:null,revision:n.revision,candidate_sha256:n.candidate_sha256});
 need(changed.length>0,'FOLLOWUP_NEW_CONFIRMED_EVIDENCE_REQUIRED');
 return changed.sort((a,b)=>a.document_id.localeCompare(b.document_id));
}
export function registerManagerContextFollowupV1(app:FastifyInstance,pool:Pool,authority:ManagerAuthorizerV1){
 const path='/api/v1/manager/fields/:field_id/crop-reviews/:review_id/followups';
 async function run(req:FastifyRequest,reply:FastifyReply,write:boolean,fn:(c:PoolClient,a:ManagerAuthorityV1,s:string[],review:string)=>Promise<unknown>){
  reply.header('cache-control','no-store');
  const {field_id,review_id}=req.params as any;
  if(!id(field_id)||!id(review_id))return reply.code(404).send({ok:false,error:'NOT_FOUND'});
  const token=/^Bearer ([^\s]+)$/i.exec(String(req.headers.authorization??''))?.[1];
  if(!token)return reply.code(401).send({ok:false,error:'MANAGER_CREDENTIAL_REQUIRED'});
  const action=write?'REQUEST_CROP_REVIEW':'READ_CROP_REVIEW';let c:PoolClient|undefined;
  try{
   const a=await authority.authorize(token,field_id,action);authority.assertCurrent(a,field_id,action);
   const s=[a.tenant_id,a.project_id,a.group_id,field_id];
   c=await pool.connect();await c.query(write?'BEGIN':'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
   await c.query("SET LOCAL lock_timeout='5s'");await c.query("SET LOCAL statement_timeout='15s'");
   // Same field row lock used by P1, P2 and P3P reservation.
   if(write)need((await c.query('SELECT field_id FROM public.field_index_v1 WHERE '+where+' FOR UPDATE',s)).rowCount===1,'NOT_FOUND',404);
   const result=await fn(c,a,s,review_id);authority.assertCurrent(a,field_id,action);await c.query('COMMIT');return reply.send(result);
  }catch(e){
   if(c)await c.query('ROLLBACK').catch(()=>{});
   if(e instanceof Hold||e instanceof ManagerAuthorityErrorV1)return reply.code(e.status).send({ok:false,error:e.message});
   // The shared native basis loader uses a separate Hold class; only allow its
   // explicit non-sensitive status/message pair through.
   if(e instanceof Error&&[403,404,409].includes((e as any).status)&&/^(NOT_FOUND|ADR_[A-Z0-9_]+)$/.test(e.message))return reply.code((e as any).status).send({ok:false,error:e.message});
   req.log.error({sqlstate:(e as any)?.code??null},'manager context followup transaction failed');return reply.code(500).send({ok:false,error:'FOLLOWUP_TRANSACTION_FAILED'});
  }finally{c?.release();}
 }
 app.post(path,{bodyLimit:1024},(req,reply)=>run(req,reply,true,async(c,a,s,baseline)=>{
  const b=req.body;
  need(obj(b)&&Object.keys(b).length===2&&id(b.followup_id)&&id(b.successor_review_id)&&b.successor_review_id!==baseline,'FOLLOWUP_INTENT_INVALID',400);
  const old=await loadManagerNativeReviewBasisV1(c,a,baseline,false);
  need(old.actor_id===a.actor_id,'FOLLOWUP_BASELINE_OWNER_REQUIRED',403);
  const prior=(await c.query('SELECT '+cols+' FROM '+table+' WHERE '+where+' AND followup_id=$5',[...s,b.followup_id])).rows[0];
  if(prior){
   const p=project(prior);need(prior.actor_id===a.actor_id&&p.result.baseline_review_id===baseline&&p.result.successor_review_id===b.successor_review_id,'FOLLOWUP_INTENT_CONFLICT');
   return {ok:true,idempotent_replay:true,...p};
  }
  const j=await readManagerNativeReviewJournalV1(c,s,baseline,old.result.basis_sha256),last=j.events.at(-1);
  need(last?.event==='FINISHED'&&['NATIVE_ASSESSMENTS_RECORDED','NO_RETRIEVED_KNOWLEDGE'].includes(last.details.status)&&last.details.action_authority===false,'FOLLOWUP_COMPLETED_NATIVE_BASELINE_REQUIRED');
  const baseline_id=managerNativeReviewEventIdV1(j.attempt,last.sequence);
  const terminal=(await c.query('SELECT created_at,result_sha256 FROM '+journal+' WHERE '+where+' AND analysis_id=$5 AND review_id=$6',[...s,baseline_id,baseline])).rows[0];
  need(terminal&&terminal.result_sha256===j.prev,'FOLLOWUP_BASELINE_RECEIPT_INTEGRITY');
  const successor=await loadManagerNativeReviewBasisV1(c,a,b.successor_review_id,true);
  need(successor.actor_id===a.actor_id,'FOLLOWUP_SUCCESSOR_OWNER_REQUIRED',403);
  need(Date.parse(successor.created_at)>Date.parse(terminal.created_at),'FOLLOWUP_SUCCESSOR_MUST_POSTDATE_BASELINE');
  const i=old.basis.intent,n=successor.basis.intent;
  need(same(i.crop_codes,n.crop_codes)&&i.question_type===n.question_type&&i.target_start_date===n.target_start_date&&i.target_end_date===n.target_end_date,'FOLLOWUP_QUESTION_CHANGED');
  // A changed land boundary is a different review basis, not a context-only followup.
  need(old.basis.boundary_sha256===successor.basis.boundary_sha256,'FOLLOWUP_BOUNDARY_CHANGED');
  const evidence_delta=delta(old.basis.documents,successor.basis.documents);
  const next=await readManagerNativeReviewJournalV1(c,s,b.successor_review_id,successor.result.basis_sha256);
  need(next.events.length===0,'FOLLOWUP_SUCCESSOR_ALREADY_INVOKED');
  const duplicate=await c.query('SELECT followup_id FROM '+table+' WHERE '+where+" AND result->>'successor_review_id'=$5 LIMIT 1",[...s,b.successor_review_id]);
  need(duplicate.rowCount===0,'FOLLOWUP_SUCCESSOR_ALREADY_LINKED');
  const result={schema_version:'geox.manager-context-followup.v1',followup_id:b.followup_id,actor_id:a.actor_id,baseline_review_id:baseline,baseline_analysis_id:baseline_id,baseline_result_sha256:j.prev,baseline_basis_sha256:old.result.basis_sha256,baseline_status:last.details.status,baseline_assessment_refs:last.details.assessment_refs,successor_review_id:b.successor_review_id,successor_basis_sha256:successor.result.basis_sha256,evidence_delta,status:'SUCCESSOR_CONTEXT_LINKED',next_step:'REQUEST_NATIVE_ASSESSMENT',scientific_qualification:'NOT_ESTABLISHED',action_authority:false};
  const saved=(await c.query('INSERT INTO '+table+'(tenant_id,project_id,group_id,field_id,followup_id,baseline_id,actor_id,result,result_sha256,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,transaction_timestamp()) RETURNING '+cols,[...s,b.followup_id,baseline_id,a.actor_id,JSON.stringify(result),digest(result)])).rows[0];
  return {ok:true,idempotent_replay:false,...project(saved)};
 }));
 app.get(path,(req,reply)=>run(req,reply,false,async(c,a,s,baseline)=>{
  await loadManagerNativeReviewBasisV1(c,a,baseline,false);
  const rows=(await c.query('SELECT '+cols+' FROM '+table+' WHERE '+where+" AND result->>'baseline_review_id'=$5 ORDER BY created_at DESC,followup_id LIMIT 101",[...s,baseline])).rows;
  return {ok:true,followups:rows.slice(0,100).map(project),more_history_available:rows.length>100};
 }));
}
