// P6-C3: durable manager crop-question capture on the existing P3 table.
 // ADR remains the sole scientific authority. No local TEST_ONLY roles or ledger publications.
import type {FastifyInstance,FastifyRequest,FastifyReply} from 'fastify';
import type {Pool,PoolClient} from 'pg';
import {ManagerAuthorityErrorV1,type ManagerAuthorizerV1,type ManagerActionV1,type ManagerAuthorityV1} from '../auth/manager_authority_v1.js';
import {validManagerPolygonV1} from '../domain/field/manager_polygon_v1.js';
import {digest,sha256,parseSoilCsv} from '../domain/field/soil_csv_p2_v1.js';
const T='geox_manager_v1.field_crop_review_p3_v1';
const R='geox_manager_v1.field_soil_document_revision_p2_v1',C='geox_manager_v1.field_soil_document_confirmation_p2_v1';
const where='tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4';
const ident=(x:unknown):x is string=>typeof x==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(x);
const hex=(x:unknown):x is string=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const plain=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==='object'&&!Array.isArray(x);
class Hold extends Error{constructor(public status:number,code:string){super(code);}}
const deny=(r:FastifyReply,n:number,error:string)=>r.code(n).send({ok:false,error});
const scope=(a:ManagerAuthorityV1,fid:string)=>({tenant_id:a.tenant_id,project_id:a.project_id,group_id:a.group_id,field_id:fid});
type Context={a:ManagerAuthorityV1;fid:string;s:ReturnType<typeof scope>;values:string[]};
function checkRecord(row:any,ctx:Context){
 if(!row?.basis||!row?.result||row.basis.actor_id!==ctx.a.actor_id||digest(row.basis.scope)!==digest(ctx.s)||
   row.basis.review_id!==row.review_id||digest(row.basis.intent)!==row.intent_sha256||
   digest(row.basis)!==row.result.basis_sha256||digest(row.result)!==row.result_sha256||
   row.result.status!=='ADR_NOT_SUBMITTED'||row.result.action_authority!==false||row.result.recommendation!==null||
   row.result.decision_problem_ref!==null||row.result.context_manifest_ref!==null)
   throw new Hold(409,'P3_STORED_REVIEW_INTEGRITY');
}
function response(row:any,replay:boolean){return {ok:true,idempotent_replay:replay,review_id:row.review_id,basis:row.basis,result:row.result,history_semantics:'CAPTURE_TIME_BASIS_NOT_CURRENT_STATE'};}
async function withAuthority(req:FastifyRequest,reply:FastifyReply,pool:Pool,authority:ManagerAuthorizerV1,action:ManagerActionV1,fn:(c:PoolClient,ctx:Context)=>Promise<unknown>){
 reply.header('cache-control','no-store');
 const fid=(req.params as any)?.field_id;
 if(!ident(fid))return deny(reply,404,'NOT_FOUND');
 const token=/^Bearer ([^\s]+)$/i.exec(String(req.headers.authorization??''))?.[1];
 if(!token)return deny(reply,401,'MANAGER_CREDENTIAL_REQUIRED');
 let c:PoolClient|undefined;
 try {
  const a=await authority.authorize(token,fid,action);authority.assertCurrent(a,fid,action);
  const s=scope(a,fid),values=Object.values(s),write=action==='CREATE_CROP_REVIEW';
  c=await pool.connect();await c.query(write?'BEGIN':'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  await c.query("SET LOCAL lock_timeout='5s'");await c.query("SET LOCAL statement_timeout='15s'");
  const f=(await c.query('SELECT field_id FROM public.field_index_v1 WHERE '+where+(write?' FOR UPDATE':''),values)).rows[0];
  if(!f)throw new Hold(404,'NOT_FOUND');
  const out=await fn(c,{a,fid,s,values});
  authority.assertCurrent(a,fid,action);await c.query('COMMIT');return reply.send(out);
 }catch(e){if(c)await c.query('ROLLBACK').catch(()=>{});if(e instanceof Hold||e instanceof ManagerAuthorityErrorV1)return deny(reply,e.status,e.message);req.log.error({sqlstate:(e as any)?.code??null},'manager crop review failed');return deny(reply,500,'P3_CAPTURE_FAILED');}
 finally{c?.release();}
}
function confirmationMatches(fact:any,ctx:Context,row:any){
 return fact?.type==='field_soil_document_confirmed_p2_v1'&&digest(fact.entity)===digest(ctx.s)&&
 fact.payload?.document_id===row.document_id&&fact.payload?.revision===row.revision&&fact.payload?.candidate_sha256===row.candidate_sha256&&
 fact.payload?.original_sha256===row.original_sha256&&fact.payload?.boundary_sha256===row.boundary_sha256&&fact.payload?.upload_fact_id===row.upload_fact_id&&
 fact.payload?.actor_id===row.confirmed_by&&fact.payload?.confirmation_meaning==='MANAGER_CONFIRMED_REPORT_ASSERTION'&&fact.payload?.scientific_qualification==='NOT_ESTABLISHED';
}
export function registerManagerCropReviewV1(app:FastifyInstance,pool:Pool,authority:ManagerAuthorizerV1){
 if(!authority||typeof authority.authorize!=='function'||typeof authority.assertCurrent!=='function')throw Error('MANAGER_AUTHORITY_REQUIRED');
 const path='/api/v1/fields/:field_id/crop-reviews';
 app.post(path,{bodyLimit:4096},(req,reply)=>withAuthority(req,reply,pool,authority,'CREATE_CROP_REVIEW',async(c,ctx)=>{
  const b=req.body;
  if(!plain(b)||Object.keys(b).sort().join(',')!=='candidate_sha256,crops,document_id,review_id,revision,season_year'||
   !ident(b.review_id)||!ident(b.document_id)||!hex(b.candidate_sha256)||typeof b.revision!=='number'||!Number.isSafeInteger(b.revision)||b.revision<1||
   typeof b.season_year!=='number'||!Number.isSafeInteger(b.season_year)||b.season_year<2026||b.season_year>2100||
   !Array.isArray(b.crops)||b.crops.length!==2||!b.crops.includes('corn')||!b.crops.includes('soybean'))throw new Hold(400,'P3_REVIEW_BODY_INVALID');
  // Exact predecessor P3 crop scope. No claim that other crops are scientifically covered.
  const intent={review_id:b.review_id,document_id:b.document_id,revision:b.revision,candidate_sha256:b.candidate_sha256,crops:[...b.crops].sort(),season_year:b.season_year},ih=digest(intent);
  const old=(await c.query('SELECT * FROM '+T+' WHERE '+where+' AND review_id=$5',[...ctx.values,b.review_id])).rows[0];
  if(old){if(old.actor_id!==ctx.a.actor_id)throw new Hold(404,'NOT_FOUND');checkRecord(old,ctx);if(old.intent_sha256!==ih)throw new Hold(409,'P3_REVIEW_CONFLICT');return response(old,true);}
  const g=(await c.query('SELECT polygon_geojson_json,updated_ts_ms FROM public.field_polygon_v1 WHERE tenant_id=$1 AND field_id=$2 FOR SHARE',[ctx.a.tenant_id,ctx.fid])).rows[0];
  if(!g||!validManagerPolygonV1(g.polygon_geojson_json)||!/^\d+$/.test(String(g.updated_ts_ms)))throw new Hold(409,'P3_BOUNDARY_REQUIRED');
  const row=(await c.query('SELECT r.*,c.confirmation_fact_id,c.confirmed_at,c.confirmed_by,c.candidate_sha256 AS confirmed_sha256 FROM '+R+' r LEFT JOIN '+C+' c USING(tenant_id,project_id,group_id,field_id,document_id,revision) WHERE r.tenant_id=$1 AND r.project_id=$2 AND r.group_id=$3 AND r.field_id=$4 AND r.document_id=$5 ORDER BY r.revision DESC LIMIT 1',[...ctx.values,b.document_id])).rows[0];
  if(!row||row.revision!==b.revision||row.candidate_sha256!==b.candidate_sha256||row.confirmed_sha256!==row.candidate_sha256||!row.confirmation_fact_id||
     row.boundary_sha256!==digest({geometry:g.polygon_geojson_json,updated_ts_ms:String(g.updated_ts_ms)})||sha256(row.original_bytes)!==row.original_sha256||digest(row.candidates)!==row.candidate_sha256)
     throw new Hold(409,'P3_CONFIRMED_CURRENT_DOCUMENT_REQUIRED');
  const confirm=(await c.query('SELECT record_json FROM public.facts WHERE fact_id=$1',[row.confirmation_fact_id])).rows[0]?.record_json;
  if(!confirmationMatches(confirm,ctx,row))throw new Hold(409,'P3_CONFIRMATION_FACT_MISMATCH');
  const at=new Date().toISOString();
  if(digest(parseSoilCsv(row.original_bytes,g.polygon_geojson_json,at.slice(0,10)))!==row.candidate_sha256)throw new Hold(409,'P3_REPARSE_MISMATCH');
  const document={document_id:row.document_id,revision:row.revision,original_sha256:row.original_sha256,candidate_sha256:row.candidate_sha256,boundary_sha256:row.boundary_sha256,confirmation_fact_id:row.confirmation_fact_id,confirmed_at:new Date(row.confirmed_at).toISOString(),confirmed_by:row.confirmed_by,candidates:row.candidates};
  if(Date.parse(document.confirmed_at)>Date.parse(at))throw new Hold(409,'P3_EVIDENCE_TIME_INVALID');
  const basis={scope:ctx.s,actor_id:ctx.a.actor_id,review_id:b.review_id,crops:intent.crops,season_year:intent.season_year,at,intent,document,
    grant:{credential_ref:ctx.a.credential_ref,source_ref:ctx.a.grant_source_ref,mapping_version:ctx.a.mapping_version}};
  const result={schema:'geox.manager.crop-review-intent.v1',status:'ADR_NOT_SUBMITTED',basis_sha256:digest(basis),
    missing_authorities:['ADR_PRINCIPAL_BINDING','ADR_EXACT_DECISION_AND_CONTEXT_WRITE_AUTHORIZATIONS','ADR_QUALIFIED_CROP_KNOWLEDGE_RELEASE_AND_DEPLOYMENT'],
    decision_problem_ref:null,context_manifest_ref:null,datum_refs:[],a07:'NOT_RUN',a08:'NOT_RUN',
    scientific_qualification:'NOT_ESTABLISHED',recommendation:null,economic_ranking:null,action_authority:false};
  const saved=(await c.query('INSERT INTO '+T+'(tenant_id,project_id,group_id,field_id,review_id,actor_id,intent_sha256,basis,result,result_sha256,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10,$11::timestamptz) RETURNING *',[...ctx.values,b.review_id,ctx.a.actor_id,ih,JSON.stringify(basis),JSON.stringify(result),digest(result),at])).rows[0];
  checkRecord(saved,ctx);return response(saved,false);
 }));
 app.get(path,(req,reply)=>withAuthority(req,reply,pool,authority,'READ_CROP_REVIEW',async(c,ctx)=>{
  const rows=(await c.query('SELECT * FROM '+T+' WHERE '+where+' AND actor_id=$5 ORDER BY created_at,review_id LIMIT 101',[...ctx.values,ctx.a.actor_id])).rows;
  if(rows.length>100)throw new Hold(409,'P3_REVIEW_PAGINATION_REQUIRED');
  return {ok:true,field_id:ctx.fid,history_semantics:'CAPTURE_TIME_BASIS_NOT_CURRENT_STATE',reviews:rows.map(r=>{checkRecord(r,ctx);return {review_id:r.review_id,basis:r.basis,result:r.result,created_at:r.created_at};})};
 }));
}
