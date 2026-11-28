import type {FastifyInstance} from 'fastify';
import type {Pool,PoolClient} from 'pg';
import {ManagerAuthorityErrorV1,type ManagerAuthorizerV1} from '../auth/manager_authority_v1.js';
import {loadManagerNativeReviewBasisV1,readManagerNativeReviewJournalV1} from './manager_native_review_v1.js';
import {buildManagerAdrEvidenceV1,type CustomerEvidenceResolverV1} from '../product_projection/customer/manager_adr_evidence_v1.js';
export function registerManagerAdrEvidenceV1(app:FastifyInstance,pool:Pool,authority:ManagerAuthorizerV1,resolve?:CustomerEvidenceResolverV1){
 app.get('/api/v1/manager/fields/:field_id/crop-reviews/:review_id/knowledge-evidence',async(req,reply)=>{
  reply.header('cache-control','no-store');
  const {field_id,review_id}=req.params as {field_id:string;review_id:string};
  if(![field_id,review_id].every(x=>/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(x)))return reply.code(404).send({ok:false,error:'NOT_FOUND'});
  if(Object.keys((req.query as object)??{}).length)return reply.code(400).send({ok:false,error:'QUERY_INVALID'});
  const token=/^Bearer ([^\s]+)$/i.exec(String(req.headers.authorization??''))?.[1];
  if(!token)return reply.code(401).send({ok:false,error:'MANAGER_CREDENTIAL_REQUIRED'});
  let c:PoolClient|undefined;
  try{
   const a=await authority.authorize(token,field_id,'READ_CROP_REVIEW');
   const s=[a.tenant_id,a.project_id,a.group_id,field_id];
   c=await pool.connect();await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
   await c.query("SET LOCAL statement_timeout='15s'");
   const row=await loadManagerNativeReviewBasisV1(c,a,review_id,false);
   const j=await readManagerNativeReviewJournalV1(c,s,review_id,row.result.basis_sha256);
   await c.query('COMMIT');c.release();c=undefined;
   authority.assertCurrent(a,field_id,'READ_CROP_REVIEW');
   const result=await buildManagerAdrEvidenceV1(j,review_id,row.result.basis_sha256,row.basis.intent.crop_codes,a,resolve);
   authority.assertCurrent(a,field_id,'READ_CROP_REVIEW');
   return reply.send({ok:true,...result});
  }catch(e){
   if(c)await c.query('ROLLBACK').catch(()=>{});
   if(e instanceof ManagerAuthorityErrorV1)return reply.code(e.status).send({ok:false,error:e.message});
   if(e instanceof Error&&(e as any).status===404&&e.message==='NOT_FOUND')return reply.code(404).send({ok:false,error:'NOT_FOUND'});
   return reply.code(503).send({ok:false,error:'ADR_EVIDENCE_UNAVAILABLE'});
  }finally{c?.release();}
 });
}
