// Fixture only: actual Fastify + native PG16; external identity/directory are injected test ports.
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import {Pool} from 'pg';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createManagerAuthorizerV1,type FormalIdentityPortV1,type ManagerActionV1,type GeoxLandGrantV1} from '../src/auth/manager_authority_v1.js';
import {registerManagerSoilDocumentsV1} from '../src/routes/manager_soil_documents_v1.js';
import {runProductManagerMigrationV1} from '../src/infra/product_manager_migration_v1.js';
const root=process.cwd();
assert.equal(process.env.P6_TEST_ONLY,'1');
const url=new URL(String(process.env.P6_TEST_DATABASE_URL??''));
assert.equal(url.hostname,'127.0.0.1');assert.equal(url.pathname,'/geox_p6_soil_test');assert.equal(url.username,'postgres');
const admin=new Pool({connectionString:url.href,max:1});
const login=(u:string,p:string)=>{const x=new URL(url);x.username=u;x.password=p;return x.href;};
const runtime=new Pool({connectionString:login('geox_runtime_v1','p6_fixture_runtime_only'),max:2});
const app=Fastify({logger:false});
const tenant={issuer:'https://directory.fixture.invalid',id:'canonical-t',version:'1'};
const membership={...tenant,id:'member'};
const issuer='https://idp.fixture.invalid';
let active=true,stale=false,wrongGroup=false,allowUpload=true,allowConfirm=true,allowCreate=false,wrongMember=false,unavailable=false;
let now=Date.now();
const issued=new WeakSet<object>();
const assertion=()=>({issuer,subject:'human-1',principal_kind:'HUMAN',canonical_tenant_ref:tenant,membership_ref:membership,membership_status:'ACTIVE',mapping_version:'1',credential_ref:'1'.repeat(64),valid_until:new Date(now+30000).toISOString()});
const identity:FormalIdentityPortV1={kind:'FORMAL_PROVIDER_NEUTRAL_IDENTITY',
 async verify(token,requested){assert.deepEqual(requested,tenant);if(token!=='fixture-valid'||!active)throw Error('deny');const context={};issued.add(context);return context;},
 authorize(ctx){if(!issued.has(ctx as object))throw Error('deny');return assertion();},
 authorizeResource(ctx){if(!issued.has(ctx as object)||!allowCreate)throw Error('deny');return {};},
 invalidate(ctx){issued.delete(ctx as object);}
};
const authority=createManagerAuthorizerV1({identity,issuer,canonicalTenantRef:tenant,clock:()=>now,
 async resolveLandGrant({field_id,action}){
  if(unavailable)throw Error('offline');
  if(field_id!==null&&field_id!=='f'||action==='UPLOAD_SOIL_DOCUMENT'&&!allowUpload||action==='CONFIRM_SOIL_DOCUMENT'&&!allowConfirm)return null;
  const checked=now-(stale?61000:0);
  return {status:'ACTIVE',issuer,subject:'human-1',canonical_tenant_ref:tenant,membership_ref:wrongMember?{...membership,id:'other'}:membership,mapping_version:'1',source_ref:{...tenant,id:'grant'},actor_id:'a',tenant_id:'t',project_id:'p',group_id:wrongGroup?'other':'g',field_id,action,checked_at:new Date(checked).toISOString(),valid_until:new Date(checked+30000).toISOString()} as GeoxLandGrantV1;
 }});
const proof=(x:string)=>console.log('PASS '+x);
const request=(method:'GET'|'POST',path:string,body?:unknown,token='fixture-valid')=>app.inject({method,url:path,headers:token?{authorization:'Bearer '+token}:{},...(body===undefined?{}:{payload:body as any})});
const path='/api/v1/fields/f/soil-documents';
const csv='sample_id,sampled_on,latitude_deg,longitude_deg,depth_top_cm,depth_bottom_cm,analyte,value,unit,method\ns1,2026-01-01,1,1,0,10,ph_water,6.4,pH,water_1_1\n';
const upload={document_id:'doc',original_name:'soil.csv',source_label:'TEST_ONLY',original_base64:Buffer.from(csv).toString('base64'),previous_original_sha256:null,previous_revision:0};
const count=async()=> (await admin.query("SELECT (SELECT count(*)::int FROM public.facts) AS facts,(SELECT count(*)::int FROM geox_manager_v1.field_soil_document_revision_p2_v1) AS revisions,(SELECT count(*)::int FROM geox_manager_v1.field_soil_document_confirmation_p2_v1) AS confirmations")).rows[0];
try{
 const empty=await admin.query("SELECT to_regclass('public.facts') IS NULL AS empty,NOT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='geox_manager_v1') AS no_product");
 assert.deepEqual(empty.rows[0],{empty:true,no_product:true});
 // Native base table definitions, scope columns and polygon type aligned for this fixture only.
 const init=readFileSync(resolve(root,'docker/postgres/init/001_schema.sql'),'utf8');
 for(const table of ['facts','field_index_v1','field_polygon_v1']){
  const match=init.match(new RegExp('CREATE TABLE IF NOT EXISTS '+table+' \\([\\s\\S]*?\\n\\);'));
  assert.ok(match);await admin.query(match[0]);
 }
 await admin.query("ALTER TABLE public.field_index_v1 ADD COLUMN project_id text, ADD COLUMN group_id text; ALTER TABLE public.field_polygon_v1 ALTER COLUMN polygon_geojson_json TYPE jsonb USING polygon_geojson_json::jsonb");
 await admin.query("CREATE ROLE geox_runtime_v1 LOGIN PASSWORD 'p6_fixture_runtime_only' NOSUPERUSER NOCREATEDB NOCREATEROLE; CREATE ROLE geox_product_migrator_v1 LOGIN NOINHERIT PASSWORD 'p6_fixture_migrator_only' NOSUPERUSER NOCREATEDB NOCREATEROLE");
 await admin.query("GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO geox_runtime_v1");
 await admin.query("INSERT INTO public.field_index_v1(tenant_id,field_id,field_name,project_id,group_id) VALUES('t','f','fixture','p','g')");
 const poly={type:'Polygon',coordinates:[[[0,0],[2,0],[2,2],[0,2],[0,0]]]};
 await admin.query("INSERT INTO public.field_polygon_v1(tenant_id,field_id,polygon_geojson_json,updated_ts_ms) VALUES('t','f',$1,1)",[JSON.stringify(poly)]);
 await admin.query(readFileSync(resolve(root,'apps/server/db/migrations/product/provision_manager_schema_v1.sql'),'utf8'));
 await runProductManagerMigrationV1({migrationDatabaseUrl:login('geox_product_migrator_v1','p6_fixture_migrator_only'),subjectCommit:'2dec58a2eba30b00a86e0e4ad86cca60a112ac1b',repositoryRoot:root});
 registerManagerSoilDocumentsV1(app,runtime,authority);await app.ready();
 const before=await count();
 assert.equal((await request('POST',path,upload,'')).statusCode,401);
 assert.equal((await request('POST',path,upload,'bad')).statusCode,403);
 active=false;assert.equal((await request('POST',path,upload)).statusCode,403);active=true;
 stale=true;assert.equal((await request('POST',path,upload)).statusCode,403);stale=false;
 wrongMember=true;assert.equal((await request('POST',path,upload)).statusCode,403);wrongMember=false;
 wrongGroup=true;assert.equal((await request('POST',path,upload)).statusCode,404);wrongGroup=false;
 unavailable=true;assert.equal((await request('POST',path,upload)).statusCode,503);unavailable=false;
 allowUpload=false;assert.equal((await request('POST',path,upload)).statusCode,403);allowUpload=true;
 assert.equal((await request('POST',path,{...upload,tenant_id:'other'})).statusCode,400);
 assert.deepEqual(await count(),before);proof('DENIALS_NO_MUTATION');
 await assert.rejects(authority.authorize('fixture-valid',null,'CREATE_FIELD'),/DENIED/);
 allowCreate=true;const create=await authority.authorize('fixture-valid',null,'CREATE_FIELD');
 assert.throws(()=>authority.assertCurrent(create,'f','UPLOAD_SOIL_DOCUMENT'),/DENIED/);
 const read=await authority.authorize('fixture-valid','f','READ_SOIL_DOCUMENT');
 assert.throws(()=>authority.assertCurrent({...read},'f','READ_SOIL_DOCUMENT'),/DENIED/);
 now+=31000;assert.throws(()=>authority.assertCurrent(read,'f','READ_SOIL_DOCUMENT'),/DENIED/);
 now=Date.now();proof('CREATE_FIELD_INDEPENDENT_AND_CONTEXT_NONFORGEABLE');
 const outside={...upload,original_base64:Buffer.from(csv.replace(',1,1,',',4,4,')).toString('base64')};
 assert.equal((await request('POST',path,outside)).statusCode,400);
 assert.deepEqual(await count(),before);
 const u=await request('POST',path,upload);assert.equal(u.statusCode,200,u.body);
 const doc=u.json();assert.equal(doc.revision,1);assert.equal(doc.candidates[0].scientific_qualification,'NOT_ESTABLISHED');
 const replay=await request('POST',path,upload);assert.equal(replay.statusCode,200);assert.equal(replay.json().idempotent_replay,true);
 const original=await request('GET',path+'/doc/1/original');assert.equal(original.statusCode,200);assert.equal(original.json().original_base64,upload.original_base64);
 allowConfirm=false;assert.equal((await request('POST',path+'/doc/confirm',{revision:1,candidate_sha256:doc.candidate_sha256,confirm:true})).statusCode,403);allowConfirm=true;
 assert.equal((await request('POST',path+'/doc/confirm',{revision:1,candidate_sha256:'0'.repeat(64),confirm:true})).statusCode,409);
 const confirm=await request('POST',path+'/doc/confirm',{revision:1,candidate_sha256:doc.candidate_sha256,confirm:true});assert.equal(confirm.statusCode,200,confirm.body);
 const list=await request('GET',path);assert.equal(list.statusCode,200,list.body);assert.equal(list.json().documents[0].current_context_eligible,true);
 assert.deepEqual(await count(),{facts:2,revisions:1,confirmations:1});proof('UPLOAD_REPLAY_CONFIRM_AND_ORIGINAL_READBACK');
 await admin.query("UPDATE public.field_polygon_v1 SET updated_ts_ms=2 WHERE tenant_id='t' AND field_id='f'");
 const changed=await request('GET',path);assert.equal(changed.json().documents[0].status,'BOUNDARY_CHANGED_REVIEW_REQUIRED');
 assert.equal(changed.json().documents[0].current_context_eligible,false);
 assert.equal((await request('POST',path+'/doc/confirm',{revision:1,candidate_sha256:doc.candidate_sha256,confirm:true})).statusCode,409);
 proof('BOUNDARY_CHANGE_INVALIDATES_CURRENT_CONTEXT_NOT_HISTORY');
 const rows=await admin.query("SELECT record_json FROM public.facts");
 assert.ok(rows.rows.every(x=>x.record_json.payload.credential_ref==='1'.repeat(64)&&!JSON.stringify(x).includes('fixture-valid')));
 proof('FACT_AUDIT_WITHOUT_BEARER');
 console.log('P6_B_C1_SOIL_HTTP_FIXTURE=PASS');
}finally{await app.close();await runtime.end();await admin.end();}
