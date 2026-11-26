// Real native Commercial schema and CAP07 trigger; only identity/directory are injected test ports.
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import {Pool} from 'pg';
import {createManagerAuthorizerV1,type FormalIdentityPortV1,type ManagerActionV1,type GeoxLandGrantV1} from '../src/auth/manager_authority_v1.js';
import {registerManagerPilotModuleV1,type ManagerPilotCompositionV1} from '../src/modules/product/registerManagerPilotModuleV1.js';
import type {AdrRefV1} from '../src/domain/agronomy/adr_review_consumer_v1.js';
assert.equal(process.env.P6_TEST_ONLY,'1');
assert.equal(process.env.GITHUB_ACTIONS,'true');
assert.equal(process.env.RUNNER_ENVIRONMENT,'github-hosted');
const adminUrl=new URL(String(process.env.P6_TEST_DATABASE_URL??''));
const runtimeUrl=new URL(String(process.env.P6_TEST_RUNTIME_URL??''));
assert.equal(adminUrl.hostname,'127.0.0.1');assert.equal(adminUrl.pathname,'/geox_p6_bc_native_test');assert.equal(adminUrl.username,'landos');
assert.equal(runtimeUrl.host,adminUrl.host);assert.equal(runtimeUrl.pathname,adminUrl.pathname);assert.equal(runtimeUrl.username,'geox_runtime_v1');
const admin=new Pool({connectionString:adminUrl.href,max:1});
const runtime=new Pool({connectionString:runtimeUrl.href,max:4});
const app=Fastify({logger:false});
const tenant={issuer:'https://directory.fixture.invalid',id:'canonical-t',version:'1'};
const member={...tenant,id:'member'}, issuer='https://idp.fixture.invalid';
const t='p6_native_t',p='p6_native_p',g='p6_native_g',f='p6_native_f';
const issued=new WeakSet<object>();let active=true,allowCreate=false,wrongGroup=false;
const grants=new Set<ManagerActionV1>();
const identity:FormalIdentityPortV1={kind:'FORMAL_PROVIDER_NEUTRAL_IDENTITY',
 async verify(token,requested){assert.deepEqual(requested,tenant);if(token!=='fixture-native'||!active)throw Error('deny');const ctx={};issued.add(ctx);return ctx;},
 authorize(ctx){assert.ok(issued.has(ctx as object));return {issuer,subject:'human-native',principal_kind:'HUMAN',canonical_tenant_ref:tenant,membership_ref:member,membership_status:'ACTIVE',mapping_version:'1',credential_ref:'3'.repeat(64),valid_until:new Date(Date.now()+30000).toISOString()};},
 authorizeResource(ctx){assert.ok(issued.has(ctx as object)&&allowCreate);return {};},
 invalidate(ctx){issued.delete(ctx as object);}
};
const authorityConfig:ManagerPilotCompositionV1={identity,issuer,canonicalTenantRef:tenant,async resolveLandGrant({field_id,action}){
 if(action==='CREATE_FIELD'?!allowCreate:field_id!==f||!grants.has(action))return null;
 const now=Date.now();return {status:'ACTIVE',issuer,subject:'human-native',canonical_tenant_ref:tenant,membership_ref:member,mapping_version:'1',source_ref:{...tenant,id:'grant'},actor_id:'p6_native_actor',tenant_id:t,project_id:p,group_id:wrongGroup?'other':g,field_id,action,checked_at:new Date(now).toISOString(),valid_until:new Date(now+30000).toISOString()} as GeoxLandGrantV1;
}};
const base='/api/v1/manager/fields',soil='/api/v1/fields/'+f+'/soil-documents';
 // Explicit TEST_ONLY native wire transport fixture, not scientific qualification.
 // Real PostgreSQL and manager HTTP routes persist the orchestration journal.
 const authorityRef=(kind:string,logical_id:string)=>({kind,logical_id,version:'1',semantic_hash:'sha256:'+'8'.repeat(64)});
 const nativePath=base+'/'+f+'/crop-reviews/review-1/native-assessment';

const req=(method:'GET'|'POST'|'PUT',url:string,body?:unknown,token='fixture-native')=>app.inject({method,url,headers:token?{authorization:'Bearer '+token}:{},...(body===undefined?{}:{payload:body as any})});
const proof=(x:string)=>console.log('PASS '+x);
const cnt=async()=> (await admin.query("SELECT (SELECT count(*)::int FROM public.field_index_v1 WHERE tenant_id=$1) AS fields,(SELECT count(*)::int FROM public.facts WHERE record_json->'entity'->>'tenant_id'=$1) AS facts,(SELECT count(*)::int FROM geox_manager_v1.field_soil_document_revision_p2_v1 WHERE tenant_id=$1) AS revisions,(SELECT count(*)::int FROM geox_manager_v1.field_soil_document_confirmation_p2_v1 WHERE tenant_id=$1) AS confirmations",[t])).rows[0];
const nativeDigest=async()=> (await admin.query("SELECT encode(sha256(convert_to(coalesce((SELECT jsonb_agg(to_jsonb(f) ORDER BY fact_id)::text FROM public.facts f WHERE record_json->'entity'->>'tenant_id' IS DISTINCT FROM $1),'[]') || '|' || coalesce((SELECT jsonb_agg(to_jsonb(f) ORDER BY tenant_id,field_id)::text FROM public.field_index_v1 f WHERE tenant_id<>$1),'[]'),'UTF8')),'hex') AS digest",[t])).rows[0].digest;
try{
 const u=(await runtime.query("SELECT current_user::text AS u,current_database() AS d")).rows[0];assert.deepEqual(u,{u:'geox_runtime_v1',d:'geox_p6_bc_native_test'});
 const coverage=(await admin.query("SELECT to_regclass('public.twin_fact_visibility_index_v1') IS NOT NULL AS cap07,to_regclass('geox_manager_v1.migration_ledger_v1') IS NOT NULL AS product")).rows[0];assert.deepEqual(coverage,{cap07:true,product:true});
 const before=await nativeDigest();assert.deepEqual(await cnt(),{fields:0,facts:0,revisions:0,confirmations:0});

 let nativeCalls=0,planEnabled=false;
 const target={organization_id:'fixture-adr-org',tenant_id:'fixture-adr-tenant',field_id:'fixture-adr-field'};
 const deployment=authorityRef('Deployment','fixture-deployment'),release=authorityRef('KnowledgeRelease','fixture-release'),candidate=authorityRef('QualifiedKnowledge','fixture-knowledge');
 let problemRef:AdrRefV1|null=null;
 authorityConfig.adrNativeReview={
  async resolvePlan(x){
   if(!planEnabled)return null;
   const d=x.basis.documents[0],row=d.candidates[0];
   return {basis_sha256:x.basis_sha256,target_binding_ref:'fixture-target',decision_mapping_ref:'fixture-decision',target_ref:target,deployment_ref:deployment,knowledge_release_ref:release,decision_type:'FIXTURE_REVIEW',objective_code:'FIXTURE',use_purpose:'FIXTURE',use_class:'FIXTURE',decision_authority_mode:'EXTERNAL_POLICY',decision_horizon:{duration:'P1Y'},decision_deadline:new Date(Date.now()+86400000).toISOString(),crop_action_bindings:x.basis.intent.crop_codes.map((crop_code:string)=>({crop_code,action_code:crop_code})),datum_bindings:[{document_id:d.document_id,revision:d.revision,row_number:row.row_number,mapping_ref:'fixture-mapping',semantic_id:'fixture.soil.ph',geometry_ref:'fixture-point',sample_day_start:row.sampled_on+'T00:00:00Z',sample_day_end:row.sampled_on+'T23:59:59.999Z'}]};
  },
  consumer:{baseUrl:'https://adr.fixture.invalid/',async resolveBinding(x){
   const a=x.manager;
   return {request_sha256:x.request_sha256,authority_scope:{actor_id:a.actor_id,tenant_id:a.tenant_id,project_id:a.project_id,group_id:a.group_id,field_id:a.field_id!,mapping_version:a.mapping_version,credential_ref:a.credential_ref},principal:{principal_id:'fixture-adr-principal',type:'SERVICE_ACCOUNT',organization_id:target.organization_id,tenant_id:target.tenant_id,program_ids:['fixture-program']},authorization_ref:authorityRef('AuthorizationDecisionAudit','fixture-auth'),credential_ref:'fixture-credential',valid_until_ms:a.valid_until_ms};
  },async getCredential(){return 'fixture-only-adr-secret';},async transport(url,init){
   nativeCalls++;const b=JSON.parse(String(init?.body)),res=b.resource,path=new URL(String(url)).pathname;
   const journal=(await admin.query("SELECT count(*)::int AS n FROM geox_manager_v1.field_native_assessment_p3p_v1 WHERE tenant_id=$1",[t])).rows[0].n;
   assert.equal(journal,nativeCalls*2); // STARTED + prior receipts + current intent are committed.
   let kind:string;
   if(path==='/v1/decision-problems'){kind='DecisionProblem';problemRef=authorityRef(kind,b.logical_id);}
   else if(path==='/v1/context-data')kind='ContextDatum';
   else if(path==='/v1/context-manifests'){kind='ContextManifest';const d=res.decision_problem_ref;res.decision_problem_ref={kind:d.kind,logicalId:d.logical_id,version:d.version,semanticHash:d.semantic_hash};res.target_ref=target;res.datum_refs=res.datum_refs.map((d:AdrRefV1)=>({datum_id:d.logical_id,semantic_hash:d.semantic_hash}));res.resolved_reference_receipts=[];}
   else if(path==='/v1/knowledge-retrieval-results'){kind='KnowledgeRetrievalResult';res.knowledge_release_ref=release;res.candidate_refs=[candidate];}
   else {assert.equal(path,'/v1/applicability-assessments');kind='ApplicabilityAssessment';res.decision_problem_ref=problemRef;res.authority_class='SOURCE_TARGET_TRANSPORT_AUTHORITY';res.transport_status='UNRESOLVED';res.scientific_use_status='UNQUALIFIED';}
   return new Response(JSON.stringify({ref:authorityRef(kind,b.logical_id),resource:res}),{status:201});
  }}
 };

 registerManagerPilotModuleV1(app,runtime,authorityConfig);await app.ready();
 const create={field_id:f,name:'native fixture land',area_ha:2};
 assert.equal((await req('POST',base,create,'')).statusCode,401);
 assert.equal((await req('POST',base,create)).statusCode,403);
 allowCreate=true;
 const made=await req('POST',base,create);assert.equal(made.statusCode,200,made.body);assert.equal(made.json().field_access_grant_issued,false);
 const repeat=await req('POST',base,create);assert.equal(repeat.statusCode,200,repeat.body);assert.equal(repeat.json().idempotent_replay,true);
 assert.equal((await req('POST',base,{...create,name:'different intent'})).statusCode,409);
 wrongGroup=true;assert.equal((await req('POST',base,create)).statusCode,404);wrongGroup=false;
 assert.deepEqual(await cnt(),{fields:1,facts:1,revisions:0,confirmations:0});
 proof('CREATE_NEW_FIELD_WITH_INDEPENDENT_GRANT_AND_EXACT_REPLAY');
 const field=(await admin.query('SELECT tenant_id,project_id,group_id,updated_ts_ms FROM public.field_index_v1 WHERE tenant_id=$1 AND field_id=$2',[t,f])).rows[0];assert.equal(field.project_id,p);assert.equal(field.group_id,g);
 const geo={type:'Polygon',coordinates:[[[0,0],[2,0],[2,2],[0,2],[0,0]]]};
 const update={name:'updated native fixture',area_ha:3,polygon_geojson:geo,expected_updated_ts_ms:Number(field.updated_ts_ms)};
 assert.equal((await req('PUT',base+'/'+f,update)).statusCode,403);
 grants.add('UPDATE_FIELD');wrongGroup=true;assert.equal((await req('PUT',base+'/'+f,update)).statusCode,404);wrongGroup=false;
 const updated=await req('PUT',base+'/'+f,update);assert.equal(updated.statusCode,200,updated.body);
 assert.equal((await req('PUT',base+'/'+f,update)).statusCode,409);
 assert.equal((await req('GET',base+'/'+f+'/geometry')).statusCode,403);
 grants.add('READ_FIELD_GEOMETRY');
 const read=await req('GET',base+'/'+f+'/geometry');assert.equal(read.statusCode,200,read.body);assert.deepEqual(read.json().geometry,geo);
 proof('FIELD_UPDATE_VERSION_AND_GEOMETRY_EXACT_SCOPE');
 const csv='sample_id,sampled_on,latitude_deg,longitude_deg,depth_top_cm,depth_bottom_cm,analyte,value,unit,method\ns1,2026-01-01,1,1,0,10,ph_water,6.4,pH,water_1_1\n';
 const upload={document_id:'doc',original_name:'soil.csv',source_label:'TEST_ONLY',original_base64:Buffer.from(csv).toString('base64'),previous_original_sha256:null,previous_revision:0};
 assert.equal((await req('POST',soil,upload)).statusCode,403);
 grants.add('UPLOAD_SOIL_DOCUMENT');
 const uploaded=await req('POST',soil,upload);assert.equal(uploaded.statusCode,200,uploaded.body);
 const doc=uploaded.json(),confirm={revision:1,candidate_sha256:doc.candidate_sha256,confirm:true};
 assert.equal((await req('POST',soil+'/doc/confirm',confirm)).statusCode,403);
 grants.add('CONFIRM_SOIL_DOCUMENT');const confirmed=await req('POST',soil+'/doc/confirm',confirm);assert.equal(confirmed.statusCode,200,confirmed.body);
 grants.add('READ_SOIL_DOCUMENT');const list=await req('GET',soil);assert.equal(list.statusCode,200,list.body);assert.equal(list.json().documents[0].current_context_eligible,true);
 const original=await req('GET',soil+'/doc/1/original');assert.equal(original.statusCode,200,original.body);assert.equal(original.json().original_base64,upload.original_base64);
 proof('P1_P2_NATIVE_HTTP_CHAIN');
 const reviewPath=base+'/'+f+'/crop-reviews';
 const intent={review_id:'review-1',crop_codes:['CORN','SOYBEAN'],target_start_date:'2027-04-01',target_end_date:'2027-10-01',documents:[{document_id:'doc',revision:1,candidate_sha256:doc.candidate_sha256}]};
 const reviewCount=async()=>Number((await admin.query('SELECT count(*) FROM geox_manager_v1.field_crop_review_p3_v1 WHERE tenant_id=$1',[t])).rows[0].count);
 assert.equal((await req('POST',reviewPath,intent,'')).statusCode,401);
 assert.equal((await req('POST',reviewPath,intent)).statusCode,403);
 grants.add('REQUEST_CROP_REVIEW');
 wrongGroup=true;assert.equal((await req('POST',reviewPath,intent)).statusCode,404);wrongGroup=false;
 assert.equal((await req('POST',reviewPath,{...intent,documents:[{...intent.documents[0],candidate_sha256:'0'.repeat(64)}]})).statusCode,409);
 assert.equal(await reviewCount(),0);
 const asked=await req('POST',reviewPath,intent);assert.equal(asked.statusCode,200,asked.body);const saved=asked.json();
 assert.equal(saved.result.status,'PENDING_NATIVE_ASSESSMENT');assert.equal(saved.result.action_authority,false);assert.equal(saved.basis.documents[0].candidates[0].epistemic_class,'ASSERTION');
 assert.equal(saved.basis.documents[0].confirmation_fact_id,confirmed.json().confirmation_fact_id);
 assert.match(saved.result.basis_sha256,/^[a-f0-9]{64}$/);assert.equal(saved.basis.audit.credential_ref,undefined);assert.equal(saved.result.qualification_gaps_not_evaluated,true);
 const repeated=await req('POST',reviewPath,{...intent,crop_codes:['SOYBEAN','CORN']});assert.equal(repeated.statusCode,200,repeated.body);assert.equal(repeated.json().idempotent_replay,true);
 assert.equal((await req('POST',reviewPath,{...intent,target_end_date:'2027-11-01'})).statusCode,409);
 assert.equal((await req('GET',reviewPath)).statusCode,403);
 grants.add('READ_CROP_REVIEW');
 const history=await req('GET',reviewPath+'/review-1');assert.equal(history.statusCode,200,history.body);assert.deepEqual(history.json().basis,saved.basis);
 const listReview=await req('GET',reviewPath);assert.equal(listReview.statusCode,200,listReview.body);assert.equal(listReview.json().reviews.length,1);
 assert.equal(await reviewCount(),1);
 proof('P3_NATIVE_DURABLE_INTENT_WITH_EXACT_CONFIRMED_BASIS');

 const initialNative=await req('GET',nativePath);assert.equal(initialNative.statusCode,200,initialNative.body);assert.equal(initialNative.json().status,'NOT_REQUESTED');
 const unready=await req('POST',nativePath,{});assert.equal(unready.statusCode,409,unready.body);assert.equal(unready.json().error,'ADR_FORMAL_PLAN_REQUIRED');assert.equal(nativeCalls,0);
 assert.equal((await req('POST',nativePath,{authorization_ref:'fake'})).statusCode,400);
 planEnabled=true;
 const executed=await req('POST',nativePath,{});assert.equal(executed.statusCode,200,executed.body);
 assert.equal(executed.json().status,'NATIVE_ASSESSMENTS_RECORDED');assert.equal(executed.json().assessment_refs.length,1);assert.equal(executed.json().receipts.length,5);assert.equal(executed.json().action_authority,false);assert.equal(executed.json().scientific_result_content_display_authority,'NOT_ESTABLISHED');
 assert.equal(nativeCalls,5);
 const nativeAgain=await req('POST',nativePath,{});assert.deepEqual(nativeAgain.json(),executed.json());assert.equal(nativeCalls,5);
 const nativeRead=await req('GET',nativePath);assert.deepEqual(nativeRead.json(),executed.json());
 const journal=await admin.query("SELECT analysis_id,result FROM geox_manager_v1.field_native_assessment_p3p_v1 WHERE tenant_id=$1 ORDER BY analysis_id",[t]);
 assert.equal(journal.rowCount,12);assert.equal(journal.rows[0].result.event,'STARTED');assert.equal(journal.rows.at(-1)?.result.event,'FINISHED');
 assert.ok(!JSON.stringify(journal.rows).includes('fixture-only-adr-secret'));
 proof('P3P_DURABLE_NATIVE_WIRE_ORCHESTRATION_FIXTURE_NO_SCIENTIFIC_AUTHORITY');


 const later=await req('PUT',base+'/'+f,{polygon_geojson:{type:'Polygon',coordinates:[[[0,0],[3,0],[3,3],[0,3],[0,0]]]},expected_updated_ts_ms:updated.json().updated_ts_ms});assert.equal(later.statusCode,200,later.body);
 const stale=await req('GET',soil);assert.equal(stale.statusCode,200,stale.body);assert.equal(stale.json().documents[0].current_context_eligible,false);
 assert.equal((await req('POST',soil+'/doc/confirm',confirm)).statusCode,409);
 assert.equal((await req('POST',reviewPath,{...intent,review_id:'new-after-boundary-change'})).statusCode,409);
 const oldReview=await req('GET',reviewPath+'/review-1');assert.equal(oldReview.statusCode,200,oldReview.body);assert.deepEqual(oldReview.json().basis,saved.basis);
 assert.equal(await reviewCount(),1);
 proof('P3_CHANGED_BOUNDARY_REJECTS_NEW_BASIS_PRESERVES_HISTORY');
 const oldNative=await req('GET',nativePath);assert.equal(oldNative.statusCode,200,oldNative.body);assert.deepEqual(oldNative.json(),executed.json());assert.equal(nativeCalls,5);
 active=false;assert.equal((await req('GET',soil)).statusCode,403);
 assert.deepEqual(await cnt(),{fields:1,facts:5,revisions:1,confirmations:1});
 const audit=await admin.query("SELECT f.record_json, (SELECT count(*)::int FROM public.twin_fact_visibility_index_v1 v WHERE v.fact_id=f.fact_id) AS visibility FROM public.facts f WHERE f.record_json->'entity'->>'tenant_id'=$1",[t]);
 assert.equal(audit.rowCount,5);assert.ok(audit.rows.every(x=>x.visibility===1&&x.record_json.payload.credential_ref==='3'.repeat(64)&&!JSON.stringify(x).includes('fixture-native')));
 assert.equal(await nativeDigest(),before);
 proof('NATIVE_CAP07_VISIBILITY_AND_UNRELATED_DATA_PRESERVED');
 console.log('P6_NATIVE_P1_P2_HTTP=PASS');
}finally{await app.close();await runtime.end();await admin.end();}
