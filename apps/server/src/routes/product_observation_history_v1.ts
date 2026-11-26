// Bounded read-only Product extension; legacy Wave-02 routes remain unchanged.
import type {FastifyInstance} from 'fastify';
import type {Pool} from 'pg';
import {enforceRouteRoleAuth,enforceFieldScopeOrDeny} from '../auth/route_role_authz.js';
import {resolveCustomerScope} from '../services/customer/customer_scope_v1.js';
import {PostgresFieldObservationHistoryBuilderV1,type ObservationHistoryOptionsV1} from '../product_projection/customer/field_observation_history_v1.js';
import {CustomerProductProjectionReadErrorV1} from '../product_projection/customer/customer_product_projection_builder_v1.js';
export function registerProductObservationHistoryRoutesV1(app:FastifyInstance,pool:Pool,options:ObservationHistoryOptionsV1={}){
 const builder=new PostgresFieldObservationHistoryBuilderV1(pool,options);
 app.get('/api/product/v1/fields/:fieldRef/observations',async(request,reply)=>{
  try{
   const auth=enforceRouteRoleAuth(request,reply,'fields');if(!auth)return;
   const customer=resolveCustomerScope(auth),fieldRef=String((request.params as {fieldRef?:unknown}).fieldRef??'');
   if(customer.scope_mode==='DENIED'||!fieldRef){reply.code(404).send({error:'NOT_FOUND'});return;}
   if(!enforceFieldScopeOrDeny(auth,fieldRef,reply,{asNotFound:true}))return;
   const projection=await builder.build({tenant_id:String(auth.tenant_id),project_id:String(auth.project_id),group_id:String(auth.group_id),allowed_field_ids:customer.allowed_field_ids,can_preview_all_fields:customer.can_preview_all_fields},fieldRef,request.query as {limit?:unknown;cursor?:unknown});
   const etag='"'+projection.envelope.projection_id+'"';
   reply.header('cache-control','private, no-cache, must-revalidate').header('etag',etag).header('x-geox-product-contract','FOUI_PRODUCT_PROJECTION').header('x-geox-product-authority-ceiling','NON_AUTHORITATIVE_PRODUCT_PROJECTION_ONLY');
   if(request.headers['if-none-match']===etag){reply.code(304).send();return;}
   reply.send({schema_version:'geox.product-api.response.v1',request_id:String(request.id),generated_at:projection.envelope.generated_at,derivation_version:projection.envelope.derivation_version,projection});
  }catch(error){const known=error instanceof CustomerProductProjectionReadErrorV1;reply.header('cache-control','no-store').code(known?error.statusCode:503).send({schema_version:'geox.product-api.error.v1',error:known?error.code:'OBSERVATION_HISTORY_READ_UNAVAILABLE',request_id:String(request.id)});}
 });
}
