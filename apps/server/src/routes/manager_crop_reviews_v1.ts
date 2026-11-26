// P6-C3: persist a manager's exact question and confirmed source basis.
// This is a business intent, not a native ADR assessment or scientific decision.
import type {FastifyInstance,FastifyRequest,FastifyReply} from 'fastify';
import type {Pool,PoolClient} from 'pg';
import {ManagerAuthorityErrorV1,type ManagerActionV1,type ManagerAuthorizerV1,type ManagerAuthorityV1} from '../auth/manager_authority_v1.js';
import {validManagerPolygonV1} from '../domain/field/manager_polygon_v1.js';
import {digest,sha256,parseSoilCsv} from '../domain/field/soil_csv_p2_v1.js';
const reviews='geox_manager_v1.field_crop_review_p3_v1';
const revisions='geox_manager_v1.field_soil_document_revision_p2_v1';
const confirmations='geox_manager_v1.field_soil_document_confirmation_p2_v1';
const where='tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4';
const id=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(v);
const hex=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const obj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const keys=(v:Record<string,unknown>,ks:string[])=>Object.keys(v).length===ks.length&&ks.every(k=>Object.hasOwn(v,k));
const date=(v:unknown):v is string=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
class Hold extends Error{constructor(public readonly status:number,code:string){super(code);}}
function parseIntent(b:unknown){
 if(!obj(b)||!keys(b,['review_id','crop_codes','target_start_date','target_end_date','documents'])||!id(b.review_id)||!date(b.target_start_date)||!date(b.target_end_date)||b.target_start_date>b.target_end_date||
  !Array.isArray(b.crop_codes)||b.crop_codes.length<2||b.crop_codes.length>5||!b.crop_codes.every((x:unknown)=>typeof x==='string'&&/^[A-Z][A-Z0-9_]{0,63}$/.test(x))||new Set(b.crop_codes).size!==b.crop_codes.length||
  !Array.isArray(b.documents)||b.documents.length>10)throw new Hold(400,'CROP_REVIEW_INTENT_INVALID');
 const docs=b.documents.map(d=>{
  if(!obj(d)||!keys(d,['document_id','revision','candidate_sha256'])||!id(d.document_id)||typeof d.revision!=='number'||!Number.isSafeInteger(d.revision)||d.revision<1||!hex(d.candidate_sha256))throw new Hold(400,'CROP_REVIEW_DOCUMENT_INVALID');
  return {document_id:d.document_id,revision:d.revision,candidate_sha256:d.candidate_sha256};
 }).sort((a,b)=>a.document_id<b.document_id?-1:a.document_id>b.document_id?1:0);
 if(new Set(docs.map(d=>d.document_id)).size!==docs.length)throw new Hold(400,'CROP_REVIEW_DOCUMENT_DUPLICATE');
 return {review_id:b.review_id,question_type:'CROP_SUITABILITY_REVIEW',crop_codes:[...b.crop_codes].sort(),target_start_date:b.target_start_date,target_end_date:b.target_end_date,documents:docs};
}
function projection(row:any){
 if(!row||!obj(row.basis)||!obj(row.result)||digest(row.result)!==row.result_sha256||
  digest({scope:row.basis.scope,actor_id:row.actor_id,intent:row.basis.intent})!==row.intent_sha256||
  row.basis.intent?.review_id!==row.review_id||row.result.action_authority!==false||
  row.result.status!=='PENDING_NATIVE_ASSESSMENT')throw new Hold(409,'CROP_REVIEW_HISTORY_INTEGRITY');
 return {review_id:row.review_id,actor_id:row.actor_id,intent_sha256:row.intent_sha256,basis:row.basis,result:row.result,result_sha256:row.result_sha256,created_at:row.created_at};
}
export function registerManagerCropReviewsV1(app:FastifyInstance,pool:Pool,authority:ManagerAuthorizerV1){
 const path='/api/v1/manager/fields/:field_id/crop-reviews';
 const run=async(req:FastifyRequest,reply:FastifyReply,action:ManagerActionV1,fn:(c:PoolClient,a:ManagerAuthorityV1,scope:string[])=>Promise<unknown>)=>{
  reply.header('cache-control','no-store');
  const fid=(req.params as any)?.field_id;
  if(!id(fid))return reply.code(404).send({ok:false,error:'NOT_FOUND'});
  const token=/^Bearer ([^\s]+)$/i.exec(String(req.headers.authorization??''))?.[1];
  if(!token)return reply.code(401).send({ok:false,error:'MANAGER_CREDENTIAL_REQUIRED'});
  let c:PoolClient|undefined;
  try{
   const a=await authority.authorize(token,fid,action);authority.assertCurrent(a,fid,action);
   const scope=[a.tenant_id,a.project_id,a.group_id,fid],write=action==='REQUEST_CROP_REVIEW';
   c=await pool.connect();await c.query(write?'BEGIN':'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
   await c.query("SET LOCAL lock_timeout='5s'");await c.query("SET LOCAL statement_timeout='15s'");
   // Same field lock as P1/P2; no stale boundary or revision can be selected
   // through a concurrent manager command before the intent commits.
   const field=await c.query('SELECT field_id FROM public.field_index_v1 WHERE '+where+(write?' FOR UPDATE':''),scope);
   if(field.rowCount!==1)throw new Hold(404,'NOT_FOUND');
   const result=await fn(c,a,scope);
   authority.assertCurrent(a,fid,action);await c.query('COMMIT');return reply.send(result);
  }catch(e){
   if(c)await c.query('ROLLBACK').catch(()=>{});
   if(e instanceof Hold||e instanceof ManagerAuthorityErrorV1)return reply.code(e.status).send({ok:false,error:e.message});
   req.log.error({sqlstate:(e as any)?.code??null},'manager crop review transaction failed');return reply.code(500).send({ok:false,error:'CROP_REVIEW_TRANSACTION_FAILED'});
  }finally{c?.release();}
 };
 const cols='review_id,actor_id,intent_sha256,basis,result,result_sha256,created_at';
 app.post(path,{bodyLimit:16384},(req,reply)=>run(req,reply,'REQUEST_CROP_REVIEW',async(c,a,s)=>{
  const intent=parseIntent(req.body),scope={tenant_id:s[0],project_id:s[1],group_id:s[2],field_id:s[3]};
  const intent_sha256=digest({scope,actor_id:a.actor_id,intent});
  const previous=(await c.query('SELECT '+cols+' FROM '+reviews+' WHERE '+where+' AND review_id=$5',[...s,intent.review_id])).rows[0];
  if(previous){
   if(previous.actor_id!==a.actor_id||previous.intent_sha256!==intent_sha256)throw new Hold(409,'CROP_REVIEW_INTENT_CONFLICT');
   return {ok:true,idempotent_replay:true,...projection(previous)};
  }
  const g=(await c.query('SELECT polygon_geojson_json,updated_ts_ms FROM public.field_polygon_v1 WHERE tenant_id=$1 AND field_id=$2 FOR SHARE',[s[0],s[3]])).rows[0];
  if(!g||!validManagerPolygonV1(g.polygon_geojson_json)||!/^\d+$/.test(String(g.updated_ts_ms)))throw new Hold(409,'CROP_REVIEW_CONFIRMED_BOUNDARY_REQUIRED');
  const boundary={geometry:g.polygon_geojson_json,updated_ts_ms:String(g.updated_ts_ms)},boundary_sha256=digest(boundary);
  const cutoff=new Date().toISOString(),documents=[];
  for(const d of intent.documents){
   const r=(await c.query('SELECT document_id,revision,original_name,source_label,original_bytes,original_sha256,candidate_sha256,boundary_sha256,candidates,upload_fact_id,uploaded_at FROM '+revisions+' WHERE '+where+' AND document_id=$5 ORDER BY revision DESC LIMIT 1',[...s,d.document_id])).rows[0];
   if(!r||r.revision!==d.revision||r.candidate_sha256!==d.candidate_sha256||r.boundary_sha256!==boundary_sha256||sha256(r.original_bytes)!==r.original_sha256||digest(r.candidates)!==r.candidate_sha256)throw new Hold(409,'CROP_REVIEW_DOCUMENT_BASIS_CHANGED');
   const confirmed=(await c.query('SELECT candidate_sha256,confirmation_fact_id,confirmed_by,confirmed_at FROM '+confirmations+' WHERE '+where+' AND document_id=$5 AND revision=$6',[...s,d.document_id,d.revision])).rows[0];
   if(!confirmed||confirmed.candidate_sha256!==r.candidate_sha256||!confirmed.confirmation_fact_id||!Number.isFinite(Date.parse(confirmed.confirmed_at))||new Date(confirmed.confirmed_at).toISOString()>cutoff)throw new Hold(409,'CROP_REVIEW_DOCUMENT_NOT_CONFIRMED');
   let parsed:unknown;
   try{parsed=parseSoilCsv(r.original_bytes,boundary.geometry,cutoff.slice(0,10));}catch{throw new Hold(409,'CROP_REVIEW_ORIGINAL_INVALID');}
   if(digest(parsed)!==r.candidate_sha256)throw new Hold(409,'CROP_REVIEW_ORIGINAL_CANDIDATE_MISMATCH');
   documents.push({document_id:r.document_id,revision:r.revision,original_name:r.original_name,source_label:r.source_label,original_sha256:r.original_sha256,candidate_sha256:r.candidate_sha256,boundary_sha256:r.boundary_sha256,upload_fact_id:r.upload_fact_id,uploaded_at:new Date(r.uploaded_at).toISOString(),confirmation_fact_id:confirmed.confirmation_fact_id,confirmed_by:confirmed.confirmed_by,confirmed_at:new Date(confirmed.confirmed_at).toISOString(),candidates:r.candidates,epistemic_class:'ASSERTION',scientific_qualification:'NOT_ESTABLISHED'});
  }
  const basis={schema_version:'geox.manager-crop-review-basis.v1',scope,intent,boundary,boundary_sha256,evidence_cutoff:cutoff,documents,authority_ceiling:'MANAGER_CONFIRMED_REPORT_ASSERTION_ONLY',audit:{grant_source_ref:a.grant_source_ref,mapping_version:a.mapping_version,credential_ref:a.credential_ref}};
  const result={schema_version:'geox.manager-crop-review-intent.v1',status:'PENDING_NATIVE_ASSESSMENT',scientific_qualification:'NOT_ESTABLISHED',assessment_ref:null,action_authority:false,missing_context:documents.length?[]:['NO_CONFIRMED_SOIL_DOCUMENT_SELECTED']};
  const saved=(await c.query('INSERT INTO '+reviews+'(tenant_id,project_id,group_id,field_id,review_id,actor_id,intent_sha256,basis,result,result_sha256,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10,$11::timestamptz) RETURNING '+cols,[...s,intent.review_id,a.actor_id,intent_sha256,JSON.stringify(basis),JSON.stringify(result),digest(result),cutoff])).rows[0];
  return {ok:true,idempotent_replay:false,...projection(saved)};
 }));
 app.get(path,(req,reply)=>run(req,reply,'READ_CROP_REVIEW',async(c,_a,s)=>{
  const rows=(await c.query('SELECT '+cols+' FROM '+reviews+' WHERE '+where+' ORDER BY created_at DESC,review_id ASC LIMIT 101',s)).rows;
  return {ok:true,reviews:rows.slice(0,100).map(r=>{const x=projection(r);return {review_id:x.review_id,created_at:x.created_at,intent:x.basis.intent,status:x.result.status,action_authority:false};}),more_history_available:rows.length>100};
 }));
 app.get(path+'/:review_id',(req,reply)=>run(req,reply,'READ_CROP_REVIEW',async(c,_a,s)=>{
  const review=(req.params as any)?.review_id;if(!id(review))throw new Hold(404,'NOT_FOUND');
  const r=(await c.query('SELECT '+cols+' FROM '+reviews+' WHERE '+where+' AND review_id=$5',[...s,review])).rows[0];
  if(!r)throw new Hold(404,'NOT_FOUND');return {ok:true,...projection(r)};
 }));
}
