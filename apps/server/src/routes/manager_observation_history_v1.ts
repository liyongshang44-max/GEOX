// Reuse #3774 historical reader. No access to live runtime, no new data import.
import type {FastifyInstance} from 'fastify';
import type {Pool} from 'pg';
import {ManagerAuthorityErrorV1,type ManagerAuthorizerV1,type ManagerAuthorityV1} from '../auth/manager_authority_v1.js';
import {PostgresFieldObservationHistoryBuilderV1,type ObservationDisplayGrantV1} from '../product_projection/customer/field_observation_history_v1.js';
import {CustomerProductProjectionReadErrorV1} from '../product_projection/customer/customer_product_projection_builder_v1.js';
export type ManagerObservationHistoryConfigV1={cursorSecret:string;resolveDisplayGrants:(a:ManagerAuthorityV1)=>Promise<readonly ObservationDisplayGrantV1[]>};
export function registerManagerObservationHistoryV1(app:FastifyInstance,pool:Pool,authority:ManagerAuthorizerV1,config?:ManagerObservationHistoryConfigV1){
 app.get('/api/v1/manager/fields/:field_id/observations',async(req,reply)=>{
  reply.header('cache-control','no-store');
  const {field_id}=req.params as {field_id:string};
  if(!/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(field_id))return reply.code(404).send({ok:false,error:'NOT_FOUND'});
  const query=(req.query??{}) as Record<string,unknown>;
  if(Object.keys(query).some(k=>!['limit','cursor'].includes(k)))return reply.code(400).send({ok:false,error:'QUERY_INVALID'});
  const token=/^Bearer ([^\s]+)$/i.exec(String(req.headers.authorization??''))?.[1];
  if(!token)return reply.code(401).send({ok:false,error:'MANAGER_CREDENTIAL_REQUIRED'});
  try{
   const a=await authority.authorize(token,field_id,'READ_FIELD_GEOMETRY');
   const grants=config?structuredClone(await config.resolveDisplayGrants(a)):[];
   if(!Array.isArray(grants)||grants.length>100)throw Error('INVALID_DISPLAY_GRANTS');
   authority.assertCurrent(a,field_id,'READ_FIELD_GEOMETRY');
   const p=await new PostgresFieldObservationHistoryBuilderV1(pool,{grants,cursorSecret:config?.cursorSecret}).build({tenant_id:a.tenant_id,project_id:a.project_id,group_id:a.group_id,allowed_field_ids:[field_id],can_preview_all_fields:false},field_id,query);
   authority.assertCurrent(a,field_id,'READ_FIELD_GEOMETRY');
   // Grant may expire during query; do not return a result beyond that window.
   if(p.items.some(i=>!grants.some(g=>g.dataset_id===i.dataset_id&&g.approval_ref===i.data_use.approval_ref&&Date.parse(g.expires_at)>Date.now())))throw Error('DISPLAY_GRANT_EXPIRED');
   return reply.send({ok:true,status:p.status,items:p.items,next_cursor:p.next_cursor,limitation_reason_codes:p.limitation_reason_codes,current_condition_effect:p.current_condition_effect});
  }catch(e){
   if(e instanceof ManagerAuthorityErrorV1)return reply.code(e.status).send({ok:false,error:e.message});
   if(e instanceof CustomerProductProjectionReadErrorV1)return reply.code(e.statusCode).send({ok:false,error:e.code});
   return reply.code(503).send({ok:false,error:'OBSERVATION_HISTORY_UNAVAILABLE'});
  }
 });
}
