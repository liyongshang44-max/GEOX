// Explicit manager-pilot read only. Never enumerate all fields by tenant.
import type {FastifyInstance} from 'fastify';
import type {Pool,PoolClient} from 'pg';
import {ManagerAuthorityErrorV1,type ManagerAuthorizerV1} from '../auth/manager_authority_v1.js';

export function registerManagerLandInventoryV1(app:FastifyInstance,pool:Pool,authority:ManagerAuthorizerV1){
 app.get('/api/v1/manager/fields',async(req,reply)=>{
  reply.header('cache-control','no-store');
  const token=/^Bearer ([^\s]+)$/i.exec(String(req.headers.authorization??''))?.[1];
  if(!token)return reply.code(401).send({ok:false,error:'MANAGER_CREDENTIAL_REQUIRED'});
  // The browser cannot select a tenant, grant set, or field filter here.
  if(Object.keys((req.query as object)??{}).length)return reply.code(400).send({ok:false,error:'MANAGER_LAND_INVENTORY_QUERY_INVALID'});
  let c:PoolClient|undefined;
  try{
   if(!authority.listAuthorizedFields||!authority.assertInventoryCurrent)throw new ManagerAuthorityErrorV1(503,'MANAGER_LAND_INVENTORY_PROVIDER_REQUIRED');
   const inventory=await authority.listAuthorizedFields(token);
   authority.assertInventoryCurrent(inventory);
   if(!inventory.fields.length)return reply.send({ok:true,fields:[]});
   const bindings=inventory.fields.map(({tenant_id,project_id,group_id,field_id})=>({tenant_id,project_id,group_id,field_id}));
   c=await pool.connect();await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
   await c.query("SET LOCAL statement_timeout='15s'");
   const result=await c.query(`SELECT f.field_id,COALESCE(f.field_name,f.name) AS name,f.area_ha,f.updated_ts_ms AS field_updated_ts_ms
      FROM jsonb_to_recordset($1::jsonb) AS a(tenant_id text,project_id text,group_id text,field_id text)
      JOIN public.field_index_v1 f ON f.tenant_id=a.tenant_id AND f.project_id=a.project_id AND f.group_id=a.group_id AND f.field_id=a.field_id
      ORDER BY f.field_id`,[JSON.stringify(bindings)]);
   // Missing grants/fields indicate stale or contradictory directory evidence.
   // Do not expose a partial list that silently drops the missing binding.
   if(result.rows.length!==bindings.length)throw new ManagerAuthorityErrorV1(503,'MANAGER_LAND_INVENTORY_SCOPE_UNRESOLVED');
   const fields=result.rows.map(row=>{
    const version=Number(row.field_updated_ts_ms),area=row.area_ha==null?null:Number(row.area_ha);
    if(!Number.isSafeInteger(version)||version<0||area!==null&&!Number.isFinite(area)||typeof row.name!=='string')throw new ManagerAuthorityErrorV1(503,'MANAGER_LAND_INVENTORY_RECORD_INVALID');
    return {field_id:row.field_id,name:row.name,area_ha:area,field_updated_ts_ms:version};
   });
   authority.assertInventoryCurrent(inventory);await c.query('COMMIT');authority.assertInventoryCurrent(inventory);
   return reply.send({ok:true,fields});
  }catch(e){
   if(c)await c.query('ROLLBACK').catch(()=>{});
   if(e instanceof ManagerAuthorityErrorV1)return reply.code(e.status).send({ok:false,error:e.message});
   req.log.error({sqlstate:(e as any)?.code??null},'manager land inventory failed');
   return reply.code(503).send({ok:false,error:'MANAGER_LAND_INVENTORY_UNAVAILABLE'});
  }finally{c?.release();}
 });
}
