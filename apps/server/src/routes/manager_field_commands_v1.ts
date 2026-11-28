// Bounded P1 domain commands on native field/fact tables. No default registration or implicit grants.
import type {FastifyInstance,FastifyRequest,FastifyReply} from 'fastify';
import type {Pool,PoolClient} from 'pg';
import {ManagerAuthorityErrorV1,type ManagerAuthorizerV1,type ManagerAuthorityV1,type ManagerActionV1} from '../auth/manager_authority_v1.js';
import {validManagerPolygonV1} from '../domain/field/manager_polygon_v1.js';
import {digest,sha256} from '../domain/field/soil_csv_p2_v1.js';
const id=(x:unknown):x is string=>typeof x==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(x);
const obj=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==='object'&&!Array.isArray(x);
const name=(x:unknown):x is string=>typeof x==='string'&&x.length>0&&x.length<=256&&x.trim()===x&&!/[\x00-\x1f\x7f]/.test(x);
const area=(x:unknown):x is number|null=>x===null||typeof x==='number'&&Number.isFinite(x)&&x>0&&x<=1000000;
const fail=(r:FastifyReply,status:number,error:string)=>r.code(status).send({ok:false,error});
class Hold extends Error{constructor(public status:number,code:string){super(code);}}
const requireInput=(ok:unknown,code:string):void=>{if(!ok)throw new Hold(400,code);};
function scoped(a:ManagerAuthorityV1,fid:string){return [a.tenant_id,a.project_id,a.group_id,fid];}
const scopeWhere='tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4';
function entity(a:ManagerAuthorityV1,fid:string){return {tenant_id:a.tenant_id,project_id:a.project_id,group_id:a.group_id,field_id:fid};}
function audit(a:ManagerAuthorityV1){return {actor_id:a.actor_id,credential_ref:a.credential_ref,grant_source_ref:a.grant_source_ref,mapping_version:a.mapping_version};}
async function append(c:PoolClient,fact:string,ts:number,record:object){
 const r=await c.query('INSERT INTO public.facts(fact_id,occurred_at,source,record_json) VALUES($1,$2::timestamptz,$3,$4::jsonb) ON CONFLICT(fact_id) DO NOTHING RETURNING fact_id',[fact,new Date(ts).toISOString(),'control',JSON.stringify(record)]);
 if(r.rowCount!==1)throw new Hold(409,'FIELD_FACT_CONFLICT');
}
async function transaction(req:FastifyRequest,reply:FastifyReply,pool:Pool,authority:ManagerAuthorizerV1,action:ManagerActionV1,field:string|null,fn:(c:PoolClient,a:ManagerAuthorityV1)=>Promise<unknown>){
 reply.header('cache-control','no-store');
 if(action!=='CREATE_FIELD'&&!id(field))return fail(reply,404,'NOT_FOUND');
 const token=/^Bearer ([^\s]+)$/i.exec(String(req.headers.authorization??''))?.[1];
 if(!token)return fail(reply,401,'MANAGER_CREDENTIAL_REQUIRED');
 let c:PoolClient|undefined;
 try {
  const a=await authority.authorize(token,field,action);
  authority.assertCurrent(a,field,action);
  c=await pool.connect();
  await c.query(action==='READ_FIELD_GEOMETRY'?'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY':'BEGIN');
  await c.query("SET LOCAL lock_timeout='5s'");
  await c.query("SET LOCAL statement_timeout='15s'");
  const result=await fn(c,a);
  authority.assertCurrent(a,field,action);
  await c.query('COMMIT');
  return reply.send(result);
 }catch(e){if(c)await c.query('ROLLBACK').catch(()=>{});if(e instanceof Hold||e instanceof ManagerAuthorityErrorV1)return fail(reply,e.status,e.message);req.log.error({sqlstate:(e as any)?.code??null},'manager field command failed');return fail(reply,500,'MANAGER_FIELD_TRANSACTION_FAILED');}finally{c?.release();}
}
export function registerManagerFieldCommandsV1(app:FastifyInstance,pool:Pool,authority:ManagerAuthorizerV1){
 if(!authority||typeof authority.authorize!=='function'||typeof authority.assertCurrent!=='function')throw Error('MANAGER_AUTHORITY_REQUIRED');
 // A distinct domain command path avoids collision with legacy AO-ACT token routes.
 const path='/api/v1/manager/fields';
 app.post(path,{bodyLimit:4096},(req,reply)=>transaction(req,reply,pool,authority,'CREATE_FIELD',null,async(c,a)=>{
  const b=req.body;
  if(!obj(b)||Object.keys(b).some(k=>!['field_id','name','area_ha'].includes(k))||!id(b.field_id)||!name(b.name)||!(b.area_ha===undefined||area(b.area_ha)))throw new Hold(400,'P1_CREATE_BODY_INVALID');
  const fid=b.field_id,n=b.name,ar=b.area_ha===undefined?null:b.area_ha as number|null,ts=Date.now();
  const fact='field_'+sha256('field_created_v1|'+a.tenant_id+'|'+fid);
  const inserted=await c.query("INSERT INTO public.field_index_v1(tenant_id,project_id,group_id,field_id,name,field_name,area_ha,area_m2,status,created_ts_ms,updated_ts_ms) VALUES($1,$2,$3,$4,$5,$5,$6,$7,'ACTIVE',$8,$8) ON CONFLICT(tenant_id,field_id) DO NOTHING RETURNING field_id",[...scoped(a,fid),n,ar,ar===null?null:ar*10000,ts]);
  if(inserted.rowCount!==1){
   const row=(await c.query('SELECT field_id FROM public.field_index_v1 WHERE '+scopeWhere+' FOR UPDATE',scoped(a,fid))).rows[0];
   if(!row)throw new Hold(404,'NOT_FOUND');
   const original=(await c.query('SELECT record_json FROM public.facts WHERE fact_id=$1',[fact])).rows[0]?.record_json;
   if(original?.type!=='field_created_v1'||digest(original.entity)!==digest(entity(a,fid))||original.payload?.name!==n||original.payload?.area_ha!==ar||original.payload?.actor_id!==a.actor_id)throw new Hold(409,'FIELD_CREATE_INTENT_CONFLICT');
   return {ok:true,field_id:fid,creation_fact_id:fact,idempotent_replay:true,field_access_grant_issued:false};
  }
  await append(c,fact,ts,{type:'field_created_v1',entity:entity(a,fid),payload:{name:n,area_ha:ar,status:'ACTIVE',created_ts_ms:ts,...audit(a)}});
  return {ok:true,field_id:fid,creation_fact_id:fact,idempotent_replay:false,field_access_grant_issued:false};
 }));
 app.put(path+'/:field_id',{bodyLimit:65536},(req,reply)=>{
  const fid=(req.params as any)?.field_id;
  return transaction(req,reply,pool,authority,'UPDATE_FIELD',fid,async(c,a)=>{
   const b=req.body;
   if(!obj(b)||Object.keys(b).some(k=>!['name','area_ha','polygon_geojson','expected_updated_ts_ms'].includes(k))||!Number.isSafeInteger(b.expected_updated_ts_ms)||Number(b.expected_updated_ts_ms)<0||!['name','area_ha','polygon_geojson'].some(k=>k in b))throw new Hold(400,'P1_UPDATE_BODY_INVALID');
   requireInput(!('name'in b)||name(b.name),'P1_NAME_INVALID');
   requireInput(!('area_ha'in b)||area(b.area_ha),'P1_AREA_INVALID');
   requireInput(!('polygon_geojson'in b)||validManagerPolygonV1(b.polygon_geojson),'P1_POLYGON_INVALID');
   const row=(await c.query('SELECT updated_ts_ms FROM public.field_index_v1 WHERE '+scopeWhere+' FOR UPDATE',scoped(a,fid))).rows[0];
   if(!row)throw new Hold(404,'NOT_FOUND');
   const old=Number(row.updated_ts_ms??0);
   if(!Number.isSafeInteger(old)||old!==b.expected_updated_ts_ms)throw new Hold(409,'FIELD_UPDATE_VERSION_CONFLICT');
   const ts=Math.max(Date.now(),old+1),poly='polygon_geojson'in b?JSON.stringify(b.polygon_geojson):null;
   const fact='field_update_'+digest([...scoped(a,fid),a.actor_id,old,b]);
   const changes=Object.keys(b).filter(k=>k!=='expected_updated_ts_ms').sort();
   // The original init schema may have text geojson_json; target-column inference preserves its actual type.
   const setUpdatedAt=(await c.query("SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='field_index_v1' AND column_name='updated_at'")).rowCount===1;
   const args=[...scoped(a,fid),'name'in b?b.name:null,'area_ha'in b,'area_ha'in b?b.area_ha:null,poly,ts];
   const changed=await c.query('UPDATE public.field_index_v1 SET name=COALESCE($5,name),field_name=COALESCE($5,field_name),area_ha=CASE WHEN $6::boolean THEN $7 ELSE area_ha END,area_m2=CASE WHEN $6::boolean THEN $7::numeric*10000 ELSE area_m2 END,geojson_json=COALESCE($8,geojson_json),updated_ts_ms=$9::bigint'+(setUpdatedAt?',updated_at=$10::timestamptz':'')+' WHERE '+scopeWhere,setUpdatedAt?[...args,new Date(ts).toISOString()]:args);
   if(changed.rowCount!==1)throw new Hold(409,'FIELD_UPDATE_SCOPE_CHANGED');
   if(poly!==null){
    const legacy=(await c.query("SELECT data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='field_polygon_v1' AND column_name='geojson'")).rows[0]?.data_type;
    if(legacy!==undefined&&!['text','json','jsonb'].includes(legacy))throw new Hold(409,'FIELD_POLYGON_SCHEMA_UNSUPPORTED');
    const cols='tenant_id,field_id,polygon_geojson_json,updated_ts_ms';
    if(legacy===undefined)await c.query('INSERT INTO public.field_polygon_v1('+cols+') VALUES($1,$2,$3,$4) ON CONFLICT(tenant_id,field_id) DO UPDATE SET polygon_geojson_json=EXCLUDED.polygon_geojson_json,updated_ts_ms=EXCLUDED.updated_ts_ms',[a.tenant_id,fid,poly,ts]);
    else await c.query('INSERT INTO public.field_polygon_v1('+cols+',geojson) VALUES($1,$2,$3,$4,$5) ON CONFLICT(tenant_id,field_id) DO UPDATE SET polygon_geojson_json=EXCLUDED.polygon_geojson_json,updated_ts_ms=EXCLUDED.updated_ts_ms,geojson=EXCLUDED.geojson',[a.tenant_id,fid,poly,ts,poly]);
   }
   await append(c,fact,ts,{type:'field_updated_v1',entity:entity(a,fid),payload:{name:'name'in b?b.name:null,area_ha:'area_ha'in b?b.area_ha:null,status:null,polygon_geojson:poly,changed_fields:changes,previous_updated_ts_ms:old,updated_ts_ms:ts,...audit(a)}});
   return {ok:true,field_id:fid,update_fact_id:fact,updated_ts_ms:ts};
  });
 });
 app.get(path+'/:field_id/geometry',(req,reply)=>{
  const fid=(req.params as any)?.field_id;
  return transaction(req,reply,pool,authority,'READ_FIELD_GEOMETRY',fid,async(c,a)=>{
   const row=(await c.query('SELECT p.polygon_geojson_json,p.updated_ts_ms,f.updated_ts_ms AS field_updated_ts_ms FROM public.field_index_v1 f LEFT JOIN public.field_polygon_v1 p ON p.tenant_id=f.tenant_id AND p.field_id=f.field_id WHERE f.tenant_id=$1 AND f.project_id=$2 AND f.group_id=$3 AND f.field_id=$4',scoped(a,fid))).rows[0];
   if(!row)throw new Hold(404,'NOT_FOUND');
   let geometry=row.polygon_geojson_json;
   if(typeof geometry==='string'){try{geometry=JSON.parse(geometry);}catch{throw new Hold(422,'FIELD_GEOMETRY_INVALID');}}
   // An authorized newly registered field has no polygon yet. Return its
   // actual optimistic-concurrency version so a manager can confirm the first
   // boundary without an admin DB query. Existing invalid geometry still fails.
   if(geometry==null&&row.updated_ts_ms==null)return {ok:true,field_id:fid,geometry:null,geometry_updated_ts_ms:null,field_updated_ts_ms:Number(row.field_updated_ts_ms)};
   if(!validManagerPolygonV1(geometry))throw new Hold(422,'EMPTY_OR_UNSUPPORTED_PILOT_GEOMETRY');
   return {ok:true,field_id:fid,geometry,geometry_updated_ts_ms:Number(row.updated_ts_ms),field_updated_ts_ms:Number(row.field_updated_ts_ms)};
  });
 });
}
