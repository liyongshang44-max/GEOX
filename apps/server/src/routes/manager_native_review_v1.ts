// P3P product-native assessment attempt journal in existing append-only P3P storage.
// An event is not a scientific assessment. Only exact native A08 receipts can be
// projected as assessment refs; no mutation of P3 basis or prior events.
import type {FastifyInstance,FastifyRequest,FastifyReply} from 'fastify';
import type {Pool,PoolClient} from 'pg';
import {ManagerAuthorityErrorV1,type ManagerAuthorizerV1,type ManagerAuthorityV1} from '../auth/manager_authority_v1.js';
import {digest} from '../domain/field/soil_csv_p2_v1.js';
import {createAdrReviewConsumerV1,AdrReviewConsumerErrorV1} from '../domain/agronomy/adr_review_consumer_v1.js';
import {prepareNativeReviewPlanV1,executeNativeReviewPlanV1,type NativeReviewPlanResolverV1,type NativeReviewEventTypeV1} from '../domain/agronomy/adr_native_review_workflow_v1.js';
type Obj=Record<string,any>;
export type ManagerNativeReviewConfigV1={resolvePlan:NativeReviewPlanResolverV1;consumer:Omit<Parameters<typeof createAdrReviewConsumerV1>[0],'authority'>};
const table='geox_manager_v1.field_native_assessment_p3p_v1',reviews='geox_manager_v1.field_crop_review_p3_v1';
const where='tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4';
const id=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(v);
const object=(v:unknown):v is Obj=>!!v&&typeof v==='object'&&!Array.isArray(v);
class Hold extends Error{constructor(public readonly status:number,code:string){super(code);}}
function requireThat(x:unknown,code:string,status=409):asserts x{if(!x)throw new Hold(status,code);}
function scope(a:ManagerAuthorityV1){return [a.tenant_id,a.project_id,a.group_id,a.field_id!];}
const attemptId=(s:string[],review:string)=>'native_'+digest({scope:s,review_id:review});
export const managerNativeReviewEventIdV1=(attempt:string,seq:number)=>attempt+':'+String(seq).padStart(4,'0');
async function tx<T>(pool:Pool,write:boolean,fn:(c:PoolClient)=>Promise<T>):Promise<T>{
 const c=await pool.connect();
 try{
  await c.query(write?'BEGIN':'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  await c.query("SET LOCAL lock_timeout='5s'");await c.query("SET LOCAL statement_timeout='15s'");
  const result=await fn(c);await c.query('COMMIT');return result;
 }catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{c.release();}
}
export async function loadManagerNativeReviewBasisV1(c:PoolClient,a:ManagerAuthorityV1,review:string,lock:boolean){
 const s=scope(a);
 const f=await c.query('SELECT field_id FROM public.field_index_v1 WHERE '+where+(lock?' FOR UPDATE':''),s);requireThat(f.rowCount===1,'NOT_FOUND',404);
 const x=(await c.query('SELECT review_id,actor_id,intent_sha256,basis,result,result_sha256,created_at FROM '+reviews+' WHERE '+where+' AND review_id=$5',[...s,review])).rows[0];
 requireThat(x,'NOT_FOUND',404);
 requireThat(object(x.basis)&&object(x.result)&&x.result.status==='PENDING_NATIVE_ASSESSMENT'&&x.result.action_authority===false&&digest(x.result)===x.result_sha256&&digest(x.basis)===x.result.basis_sha256&&digest({scope:x.basis.scope,actor_id:x.actor_id,intent:x.basis.intent})===x.intent_sha256&&digest(x.basis.scope)===digest({tenant_id:s[0],project_id:s[1],group_id:s[2],field_id:s[3]})&&x.basis.intent?.review_id===review,'ADR_REVIEW_BASIS_INTEGRITY');
 if(lock){
  requireThat(x.actor_id===a.actor_id,'ADR_REVIEW_OWNER_REQUIRED',403);
  const g=(await c.query('SELECT polygon_geojson_json,updated_ts_ms FROM public.field_polygon_v1 WHERE tenant_id=$1 AND field_id=$2 FOR SHARE',[s[0],s[3]])).rows[0];
  requireThat(g&&digest({geometry:g.polygon_geojson_json,updated_ts_ms:String(g.updated_ts_ms)})===x.basis.boundary_sha256,'ADR_REVIEW_BOUNDARY_CHANGED');
  for(const d of x.basis.documents){
   const current=(await c.query('SELECT revision,candidate_sha256,original_sha256,boundary_sha256 FROM geox_manager_v1.field_soil_document_revision_p2_v1 WHERE '+where+' AND document_id=$5 ORDER BY revision DESC LIMIT 1',[...s,d.document_id])).rows[0];
   const confirmation=(await c.query('SELECT confirmation_fact_id,candidate_sha256 FROM geox_manager_v1.field_soil_document_confirmation_p2_v1 WHERE '+where+' AND document_id=$5 AND revision=$6',[...s,d.document_id,d.revision])).rows[0];
   requireThat(current&&current.revision===d.revision&&current.candidate_sha256===d.candidate_sha256&&current.original_sha256===d.original_sha256&&current.boundary_sha256===d.boundary_sha256&&confirmation?.confirmation_fact_id===d.confirmation_fact_id&&confirmation.candidate_sha256===d.candidate_sha256,'ADR_REVIEW_DOCUMENT_CHANGED');
  }
 }
 return x;
}
export async function readManagerNativeReviewJournalV1(c:PoolClient,s:string[],review:string,basis_sha256:string){
 const attempt=attemptId(s,review);
 const rows=(await c.query('SELECT analysis_id,actor_id,result,result_sha256 FROM '+table+' WHERE '+where+' AND review_id=$5 AND left(analysis_id,$6)=$7 ORDER BY analysis_id ASC LIMIT 300',[...s,review,attempt.length+1,attempt+':'])).rows;
 let prev:string|null=null;const list:Obj[]=[];
 for(const [i,row] of rows.entries()){
  const e=row.result;
  requireThat(object(e)&&e.schema_version==='geox.native-assessment-attempt-event.v1'&&e.attempt_id===attempt&&e.review_id===review&&e.basis_sha256===basis_sha256&&e.actor_id===row.actor_id&&e.sequence===i&&row.analysis_id===managerNativeReviewEventIdV1(attempt,i)&&e.previous_sha256===prev&&digest(e)===row.result_sha256&&object(e.details)&&['STARTED','WRITE_INTENT','WRITE_RECEIPT','FINISHED'].includes(e.event)&&(!i?e.event==='STARTED':e.event!=='STARTED')&&!list.some(x=>x.event==='FINISHED'),'ADR_ASSESSMENT_JOURNAL_INTEGRITY');
  prev=row.result_sha256;list.push(e);
 }
 requireThat(rows.length<300,'ADR_ASSESSMENT_JOURNAL_LIMIT');
 return {attempt,events:list,prev};
}
function projection(j:{attempt:string;events:Obj[]}){
 const last=j.events.at(-1);
 const terminal=last?.event==='FINISHED'?last.details:null;
 const receipts=j.events.filter(e=>e.event==='WRITE_RECEIPT').map(e=>({operation:e.details.operation,ref:e.details.receipt.ref,response_sha256:e.details.receipt.response_sha256}));
 // Raw native payloads may include licensed knowledge. Do not expose them or
 // server credentials merely because the manager can read the question.
 return {attempt_id:j.attempt,status:terminal?.status??(last?'OUTCOME_RECONCILIATION_REQUIRED':'NOT_REQUESTED'),error_code:terminal?.error_code??null,assessment_refs:terminal?.assessment_refs??[],receipts,action_authority:false,scientific_result_content_display_authority:'NOT_ESTABLISHED'};
}
async function insert(c:PoolClient,s:string[],a:ManagerAuthorityV1,review:string,basis:string,attempt:string,seq:number,prev:string|null,event:NativeReviewEventTypeV1,details:Obj){
 const result={schema_version:'geox.native-assessment-attempt-event.v1',attempt_id:attempt,review_id:review,basis_sha256:basis,actor_id:a.actor_id,sequence:seq,previous_sha256:prev,event,details};
 const hash=digest(result);
 await c.query('INSERT INTO '+table+'(tenant_id,project_id,group_id,field_id,analysis_id,review_id,actor_id,result,result_sha256,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,transaction_timestamp())',[...s,managerNativeReviewEventIdV1(attempt,seq),review,a.actor_id,JSON.stringify(result),hash]);
}
export function registerManagerNativeReviewV1(app:FastifyInstance,pool:Pool,authority:ManagerAuthorizerV1,config?:ManagerNativeReviewConfigV1){
 const path='/api/v1/manager/fields/:field_id/crop-reviews/:review_id/native-assessment';
 const consumer=config?createAdrReviewConsumerV1({...config.consumer,authority}):null;
 async function run(req:FastifyRequest,reply:FastifyReply,write:boolean){
  reply.header('cache-control','no-store');
  const {field_id,review_id}=req.params as any;
  if(!id(field_id)||!id(review_id))return reply.code(404).send({ok:false,error:'NOT_FOUND'});
  const token=/^Bearer ([^\s]+)$/i.exec(String(req.headers.authorization??''))?.[1];
  if(!token)return reply.code(401).send({ok:false,error:'MANAGER_CREDENTIAL_REQUIRED'});
  const action=write?'REQUEST_CROP_REVIEW':'READ_CROP_REVIEW';
  try{
   const a=await authority.authorize(token,field_id,action),s=scope(a);
   const initial=await tx(pool,false,async c=>{
    const row=await loadManagerNativeReviewBasisV1(c,a,review_id,false);
    if(write)requireThat(row.actor_id===a.actor_id,'ADR_REVIEW_OWNER_REQUIRED',403);
    return {row,j:await readManagerNativeReviewJournalV1(c,s,review_id,row.result.basis_sha256)};
   });
   authority.assertCurrent(a,field_id,action);
   if(!write||initial.j.events.length)return reply.send({ok:true,...projection(initial.j)});
   requireThat(req.body===undefined||object(req.body)&&Object.keys(req.body).length===0,'ADR_NATIVE_REQUEST_BODY_INVALID',400);
   requireThat(config&&consumer,'ADR_FORMAL_PROVIDER_NOT_CONFIGURED',503);
   const basis_sha256=initial.row.result.basis_sha256,attempt=initial.j.attempt;
   const {credential_ref:_credential,...audit}=initial.row.basis.audit;
   const planRequest={basis_sha256,basis:{...initial.row.basis,audit},attempt_id:attempt,evaluation_time:new Date().toISOString()};
   const raw=await config.resolvePlan(structuredClone(planRequest),a);
   const plan=prepareNativeReviewPlanV1(planRequest,raw);
   // Atomic reservation before any remote call. Second request sees journal and
   // cannot invoke; no automatic retry/resume after a crash or unknown outcome.
   const reserved=await tx(pool,true,async c=>{
    authority.assertCurrent(a,field_id,action);
    const row=await loadManagerNativeReviewBasisV1(c,a,review_id,true);requireThat(row.result.basis_sha256===basis_sha256,'ADR_REVIEW_BASIS_CHANGED');
    const j=await readManagerNativeReviewJournalV1(c,s,review_id,basis_sha256);
    if(j.events.length)return false;
    await insert(c,s,a,review_id,basis_sha256,attempt,0,null,'STARTED',{plan,plan_sha256:digest(plan),action_authority:false});
    return true;
   });
   if(reserved){
    let sequence=1;
    // Internal receipt persistence survives credential expiry; it cannot initiate
    // another write. All remote calls still recheck the opaque manager authority.
    await executeNativeReviewPlanV1(a,plan,consumer,async(event,details)=>{
     await tx(pool,true,async c=>{
      const j=await readManagerNativeReviewJournalV1(c,s,review_id,basis_sha256);
      requireThat(j.events.length===sequence&&j.events[0]?.actor_id===a.actor_id&&j.events.at(-1)?.event!=='FINISHED','ADR_ASSESSMENT_JOURNAL_LEASE');
      await insert(c,s,a,review_id,basis_sha256,attempt,sequence,j.prev,event,details);
     });sequence++;
    });
   }
   authority.assertCurrent(a,field_id,action);
   const result=await tx(pool,false,c=>readManagerNativeReviewJournalV1(c,s,review_id,basis_sha256));
   return reply.send({ok:true,...projection(result)});
  }catch(e){
   if(e instanceof Hold||e instanceof ManagerAuthorityErrorV1)return reply.code(e.status).send({ok:false,error:e.message});
   if(e instanceof AdrReviewConsumerErrorV1)return reply.code(409).send({ok:false,error:e.code});
   req.log.error({sqlstate:(e as any)?.code??null},'manager native assessment failed');
   return reply.code(503).send({ok:false,error:'ADR_NATIVE_ASSESSMENT_UNAVAILABLE_OR_RECONCILIATION_REQUIRED'});
  }
 }
 app.post(path,{bodyLimit:1024},(req,reply)=>run(req,reply,true));
 app.get(path,(req,reply)=>run(req,reply,false));
}
