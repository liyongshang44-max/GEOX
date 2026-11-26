// P6-C1: P2 domain routes, opt-in by trusted composition only; NOT registered by default.
import type {FastifyInstance,FastifyRequest,FastifyReply} from 'fastify';
import type {Pool,PoolClient} from 'pg';
import {ManagerAuthorityErrorV1,type ManagerAuthorizerV1,type ManagerActionV1,type ManagerAuthorityV1} from '../auth/manager_authority_v1.js';
import {validManagerPolygonV1} from '../domain/field/manager_polygon_v1.js';
import {decodeOriginal,parseSoilCsv,digest,sha256,InputError} from '../domain/field/soil_csv_p2_v1.js';
const R='geox_manager_v1.field_soil_document_revision_p2_v1', C='geox_manager_v1.field_soil_document_confirmation_p2_v1';
const where='tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4';
const fail=(r:FastifyReply,n:number,error:string)=>r.code(n).send({ok:false,error});
const obj=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==='object'&&!Array.isArray(x);
const id=(x:unknown):x is string=>typeof x==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(x);
const hex=(x:unknown):x is string=>typeof x==='string'&&/^[0-9a-f]{64}$/.test(x);
const text=(x:unknown,max:number):x is string=>typeof x==='string'&&x.length>0&&x.length<=max&&x.trim()===x&&!/[\x00-\x1f\x7f]/.test(x);
class Hold extends Error{constructor(public status:number,code:string){super(code);}}
type A={a:ManagerAuthorityV1;fid:string;scope:string[];entity:{tenant_id:string;project_id:string;group_id:string;field_id:string}};
async function transaction(req:FastifyRequest,reply:FastifyReply,pool:Pool,authority:ManagerAuthorizerV1,action:ManagerActionV1,fn:(c:PoolClient,a:A,boundary:any)=>Promise<unknown>){
 reply.header('cache-control','no-store');
 const fid=(req.params as any)?.field_id;
 if(!id(fid))return fail(reply,404,'NOT_FOUND');
 const token=/^Bearer ([^\s]+)$/i.exec(String(req.headers.authorization??''))?.[1];
 if(!token)return fail(reply,401,'MANAGER_CREDENTIAL_REQUIRED');
 let c:PoolClient|undefined;
 try{
  const a=await authority.authorize(token,fid,action);
  authority.assertCurrent(a,fid,action);
  const scope=[a.tenant_id,a.project_id,a.group_id,fid],write=action!=='READ_SOIL_DOCUMENT';
  const context={a,fid,scope,entity:{tenant_id:a.tenant_id,project_id:a.project_id,group_id:a.group_id,field_id:fid}};
  c=await pool.connect();
  await c.query(write?'BEGIN':'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  await c.query("SET LOCAL lock_timeout='5s'");
  await c.query("SET LOCAL statement_timeout='15s'");
  const f=(await c.query('SELECT field_id FROM public.field_index_v1 WHERE '+where+(write?' FOR UPDATE':''),scope)).rows[0];
  if(!f)throw new Hold(404,'NOT_FOUND');
  const g=(await c.query('SELECT polygon_geojson_json,updated_ts_ms FROM public.field_polygon_v1 WHERE tenant_id=$1 AND field_id=$2'+(write?' FOR SHARE':''),[a.tenant_id,fid])).rows[0];
  if(!g||!validManagerPolygonV1(g.polygon_geojson_json)||!/^\d+$/.test(String(g.updated_ts_ms)))throw new Hold(409,'P2_CONFIRMED_BOUNDARY_REQUIRED');
  const result=await fn(c,context,{geometry:g.polygon_geojson_json,updated_ts_ms:String(g.updated_ts_ms)});
  authority.assertCurrent(a,fid,action);
  await c.query('COMMIT');return reply.send(result);
 }catch(e){if(c)await c.query('ROLLBACK').catch(()=>{});if(e instanceof ManagerAuthorityErrorV1||e instanceof Hold)return fail(reply,e.status,e.message);if(e instanceof InputError)return fail(reply,400,e.message);req.log.error({sqlstate:(e as any)?.code??null},'manager soil transaction failed');return fail(reply,500,'P2_TRANSACTION_FAILED');}finally{c?.release();}
}
const metadata=(r:any)=>({document_id:r.document_id,revision:r.revision,original_name:r.original_name,source_label:r.source_label,original_sha256:r.original_sha256,candidate_sha256:r.candidate_sha256,boundary_sha256:r.boundary_sha256,previous_original_sha256:r.previous_original_sha256,upload_fact_id:r.upload_fact_id,uploaded_by:r.uploaded_by,uploaded_at:r.uploaded_at,candidates:r.candidates});
const metadataCols='document_id,revision,original_name,source_label,original_sha256,candidate_sha256,boundary_sha256,previous_original_sha256,upload_fact_id,uploaded_by,uploaded_at,candidates';
async function appendFact(c:PoolClient,a:A,kind:string,fid:string,payload:object,ts:string){
 await c.query('INSERT INTO public.facts(fact_id,occurred_at,source,record_json) VALUES($1,$2::timestamptz,$3,$4::jsonb)',[fid,ts,'control',JSON.stringify({type:kind,entity:a.entity,payload:{...payload,actor_id:a.a.actor_id,credential_ref:a.a.credential_ref,grant_source_ref:a.a.grant_source_ref,mapping_version:a.a.mapping_version}})]);
}
export function registerManagerSoilDocumentsV1(app:FastifyInstance,pool:Pool,authority:ManagerAuthorizerV1){
 if(!authority||typeof authority.authorize!=='function'||typeof authority.assertCurrent!=='function')throw new Error('MANAGER_AUTHORITY_REQUIRED');
 const path='/api/v1/fields/:field_id/soil-documents';
 const run=(req:FastifyRequest,reply:FastifyReply,action:ManagerActionV1,fn:(c:PoolClient,a:A,g:any)=>Promise<unknown>)=>transaction(req,reply,pool,authority,action,fn);
 app.post(path,{bodyLimit:100000},(req,reply)=>run(req,reply,'UPLOAD_SOIL_DOCUMENT',async(c,a,g)=>{
  const b=req.body;if(!obj(b)||Object.keys(b).some(k=>!['document_id','original_name','source_label','original_base64','previous_original_sha256','previous_revision'].includes(k))||!id(b.document_id)||!text(b.original_name,128)||!/^[-\p{L}\p{N}_. ()]+\.csv$/iu.test(b.original_name)||!text(b.source_label,200)||!(b.previous_original_sha256===null||hex(b.previous_original_sha256))||typeof b.previous_revision!=='number'||!Number.isSafeInteger(b.previous_revision)||b.previous_revision<0)throw new InputError('P2_UPLOAD_BODY_INVALID');
  const bytes=decodeOriginal(b.original_base64),rawHash=sha256(bytes),boundary=digest(g);
  const prev=(await c.query('SELECT '+metadataCols+' FROM '+R+' WHERE '+where+' AND document_id=$5 ORDER BY revision DESC LIMIT 1',[...a.scope,b.document_id])).rows[0];
  if(prev&&prev.original_sha256===rawHash&&prev.original_name===b.original_name&&prev.source_label===b.source_label&&prev.previous_original_sha256===b.previous_original_sha256&&prev.revision-1===b.previous_revision&&prev.boundary_sha256===boundary)return {ok:true,idempotent_replay:true,...metadata(prev)};
  if((prev?.original_sha256??null)!==b.previous_original_sha256||(prev?.revision??0)!==b.previous_revision)throw new Hold(409,'P2_REVISION_CONFLICT');
  if(prev&&prev.original_sha256===rawHash&&prev.boundary_sha256===boundary)throw new Hold(409,'P2_UNCHANGED_ORIGINAL');
  const candidates=parseSoilCsv(bytes,g.geometry,new Date().toISOString().slice(0,10)),candidateHash=digest(candidates),revision=(prev?.revision??0)+1;
  const fact='soil_doc_'+digest([...a.scope,b.document_id,revision,rawHash]),ts=new Date().toISOString();
  await appendFact(c,a,'field_soil_document_uploaded_p2_v1',fact,{document_id:b.document_id,revision,original_name:b.original_name,source_label:b.source_label,original_sha256:rawHash,candidate_sha256:candidateHash,boundary_sha256:boundary,previous_original_sha256:b.previous_original_sha256,scientific_qualification:'NOT_ESTABLISHED'},ts);
  const r=(await c.query('INSERT INTO '+R+'(tenant_id,project_id,group_id,field_id,document_id,revision,original_name,source_label,original_bytes,original_sha256,candidate_sha256,boundary_sha256,candidates,previous_original_sha256,upload_fact_id,uploaded_by,uploaded_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::bytea,$10,$11,$12,$13::jsonb,$14,$15,$16,$17::timestamptz) RETURNING '+metadataCols,[...a.scope,b.document_id,revision,b.original_name,b.source_label,bytes,rawHash,candidateHash,boundary,JSON.stringify(candidates),b.previous_original_sha256,fact,a.a.actor_id,ts])).rows[0];
  return {ok:true,idempotent_replay:false,...metadata(r)};
 }));
 app.post(path+'/:document_id/confirm',{bodyLimit:4096},(req,reply)=>run(req,reply,'CONFIRM_SOIL_DOCUMENT',async(c,a,g)=>{
  const d=(req.params as any).document_id,b=req.body;
  if(!id(d)||!obj(b)||Object.keys(b).some(k=>!['revision','candidate_sha256','confirm'].includes(k))||typeof b.revision!=='number'||!Number.isSafeInteger(b.revision)||b.revision<1||!hex(b.candidate_sha256)||b.confirm!==true)throw new InputError('P2_CONFIRM_BODY_INVALID');
  const r=(await c.query('SELECT '+metadataCols+',original_bytes FROM '+R+' WHERE '+where+' AND document_id=$5 ORDER BY revision DESC LIMIT 1',[...a.scope,d])).rows[0];
  if(!r)throw new Hold(404,'NOT_FOUND');
  if(r.revision!==b.revision||r.candidate_sha256!==b.candidate_sha256||digest(r.candidates)!==r.candidate_sha256||sha256(r.original_bytes)!==r.original_sha256||r.boundary_sha256!==digest(g))throw new Hold(409,'P2_CONFIRM_EXACT_BASIS_MISMATCH');
  const prev=(await c.query('SELECT candidate_sha256,confirmation_fact_id,confirmed_by,confirmed_at FROM '+C+' WHERE '+where+' AND document_id=$5 AND revision=$6',[...a.scope,d,b.revision])).rows[0];
  if(prev){if(prev.candidate_sha256!==r.candidate_sha256)throw new Hold(409,'P2_CONFIRM_CONFLICT');return {ok:true,idempotent_replay:true,...prev};}
  const fact='soil_confirm_'+digest([...a.scope,d,b.revision,b.candidate_sha256]),ts=new Date().toISOString();
  await appendFact(c,a,'field_soil_document_confirmed_p2_v1',fact,{document_id:d,revision:b.revision,upload_fact_id:r.upload_fact_id,original_sha256:r.original_sha256,candidate_sha256:r.candidate_sha256,boundary_sha256:r.boundary_sha256,confirmation_meaning:'MANAGER_CONFIRMED_REPORT_ASSERTION',scientific_qualification:'NOT_ESTABLISHED'},ts);
  const row=(await c.query('INSERT INTO '+C+'(tenant_id,project_id,group_id,field_id,document_id,revision,candidate_sha256,confirmation_fact_id,confirmed_by,confirmed_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::timestamptz) RETURNING candidate_sha256,confirmation_fact_id,confirmed_by,confirmed_at',[...a.scope,d,b.revision,b.candidate_sha256,fact,a.a.actor_id,ts])).rows[0];
  return {ok:true,idempotent_replay:false,...row};
 }));
 app.get(path,(req,reply)=>run(req,reply,'READ_SOIL_DOCUMENT',async(c,a,g)=>{
  const rows=(await c.query('SELECT '+metadataCols.split(',').map(k=>'r.'+k).join(',')+',c.confirmation_fact_id,c.confirmed_by,c.confirmed_at,c.candidate_sha256 AS confirmed_sha256,r.original_bytes FROM '+R+' r LEFT JOIN '+C+' c USING(tenant_id,project_id,group_id,field_id,document_id,revision) WHERE r.tenant_id=$1 AND r.project_id=$2 AND r.group_id=$3 AND r.field_id=$4 ORDER BY r.document_id,r.revision DESC LIMIT 1001',a.scope)).rows;
  if(rows.length>1000)throw new Hold(409,'P2_DOCUMENT_PAGINATION_REQUIRED');
  const seen=new Set<string>();
  return {ok:true,field_id:a.fid,authority_ceiling:'MANAGER_CONFIRMED_REPORT_ASSERTION_ONLY',scientific_qualification:'NOT_ESTABLISHED',documents:rows.map(r=>{
   const latest=!seen.has(r.document_id);seen.add(r.document_id);
   const current=latest&&r.boundary_sha256===digest(g)&&r.confirmed_sha256===r.candidate_sha256&&digest(r.candidates)===r.candidate_sha256&&sha256(r.original_bytes)===r.original_sha256&&!!r.confirmation_fact_id;
   return {...metadata(r),latest_revision:latest,confirmation_fact_id:r.confirmation_fact_id,confirmed_by:r.confirmed_by,confirmed_at:r.confirmed_at,current_context_eligible:current,status:!latest?'HISTORICAL':r.boundary_sha256!==digest(g)?'BOUNDARY_CHANGED_REVIEW_REQUIRED':current?'MANAGER_CONFIRMED_ASSERTION':'PENDING_CONFIRMATION'};
  })};
 }));
 app.get(path+'/:document_id/:revision/original',(req,reply)=>run(req,reply,'READ_SOIL_DOCUMENT',async(c,a)=>{
  const p=req.params as any;if(!id(p.document_id)||! /^(?:[1-9]\d{0,8})$/.test(p.revision))throw new Hold(404,'NOT_FOUND');
  const r=(await c.query('SELECT original_name,original_bytes,original_sha256 FROM '+R+' WHERE '+where+' AND document_id=$5 AND revision=$6',[...a.scope,p.document_id,Number(p.revision)])).rows[0];
  if(!r)throw new Hold(404,'NOT_FOUND');if(sha256(r.original_bytes)!==r.original_sha256)throw new Hold(409,'P2_ORIGINAL_INTEGRITY_FAILURE');
  return {ok:true,original_name:r.original_name,original_sha256:r.original_sha256,original_base64:r.original_bytes.toString('base64')};
 }));
}
