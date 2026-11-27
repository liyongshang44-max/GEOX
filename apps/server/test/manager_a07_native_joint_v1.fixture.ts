// Real native Commercial schema and CAP07 trigger; only identity/directory are injected test ports.
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import {Pool} from 'pg';
import {type FormalIdentityPortV1,type ManagerActionV1,type GeoxLandGrantV1} from '../src/auth/manager_authority_v1.js';
import {registerManagerPilotModuleV1,type ManagerPilotCompositionV1} from '../src/modules/product/registerManagerPilotModuleV1.js';

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
let inventoryMode:'normal'|'unavailable'|'stale'|'other-subject'|'duplicate'|'wrong-action'='normal';
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
authorityConfig.resolveLandInventory=async({assertion})=>{
 if(inventoryMode==='unavailable')throw Error('directory unavailable');
 const now=Date.now(),checked=inventoryMode==='stale'?now-70000:now;
 const grant=await authorityConfig.resolveLandGrant({assertion,field_id:f,action:'READ_FIELD_GEOMETRY'});
 const items=grant?[{...grant,action:inventoryMode==='wrong-action'?'UPDATE_FIELD' as const:grant.action}]:[];
 return {purpose:'LIST_MANAGED_FIELDS',status:'ACTIVE',issuer,subject:inventoryMode==='other-subject'?'other':'human-native',canonical_tenant_ref:tenant,membership_ref:member,mapping_version:'1',source_ref:{...tenant,id:'inventory'},checked_at:new Date(checked).toISOString(),valid_until:new Date(checked+30000).toISOString(),grants:inventoryMode==='duplicate'?[...items,...items]:items};
};

import {execFileSync} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {once} from 'node:events';
import {digest} from '../src/domain/field/soil_csv_p2_v1.ts';
import {createCustomerEvidenceHttpResolverV1} from '../src/product_projection/customer/manager_adr_evidence_v1.ts';
import {exerciseManagerBrowserRecovery} from './manager_browser_recovery_v1.fixture.mjs';
assert.equal(process.env.GITHUB_EVENT_NAME,'pull_request');
assert.equal(process.versions.node.split('.')[0],'24');
assert.ok(!process.env.ADR_PILOT_BOOTSTRAP_PACKAGE_B64&&!process.env.ADR_PILOT_TOKEN_BINDINGS_JSON&&!process.env.ADR_PILOT_STATE_PATH&&!process.env.ADR_PILOT_SNAPSHOT_DIR);
const root=resolve(process.env.ADR_NATIVE_SOURCE??'');
assert.equal(execFileSync('git',['-C',root,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),'118df952cfc95e7b8327b6ed5f0d7eb591326cb7');
const imp=(p:string)=>import(pathToFileURL(join(root,p)).href);
const {createDeploymentEnvironment,baseDeployment,publishAuthorizedDeployment,createRuntimeReadAuthorization}=await imp('acceptance/deployment/fixture.mjs');
const {PERMISSIONS,publishRoleAssignment,publishBuiltinRoleAssignment,authorizeDecisionProblemCreation,recordAuthorizationDecision}=await imp('packages/authorization/src/index.mjs');
const {audit}=await imp('acceptance/context-manifest/fixtures.mjs');
const {createInspectionAuthorization}=await imp('acceptance/workbench/fixture.mjs');
const {createAuthorityRecoveryCheckpoint}=await imp('packages/recovery-operations/src/index.mjs');
const {publishRightsPolicy,publishRightsGrant,publishRightsRevocation}=await imp('packages/rights-authority/src/index.mjs');
const {initializePilotRuntime,createPilotHttpServer}=await imp('deploy/adr-pilot-host/server.mjs');
const {boundedMemberDisplay,customerEvidenceMemberHash,customerEvidenceRequestHash}=await imp('deploy/adr-pilot-host/customer-evidence.mjs');
const {toWireRef}=await imp('acceptance/v0.3-pilot-release/fixture.mjs');
const env=createDeploymentEnvironment('geox-joint-test-only');
const decisionType='FIXTURE_NATIVE_MANAGER_REVIEW',use='CORN_IRRIGATION_APPLICABILITY',original=baseDeployment(env);
const deployment=publishAuthorizedDeployment(env,{logicalId:'deployment.geox-joint-test-only',deployment:{...original,effectiveInterval:{start:'2026-08-16T00:00:00Z',end:'2030-01-01T00:00:00Z'},deploymentScope:{...original.deploymentScope,decisionTypes:[decisionType]}}});
const actor={principalId:'fixture-geox-joint-proxy',type:'SERVICE_ACCOUNT',organizationId:'org-a',tenantId:'tenant-a',programIds:['pilot-a']},runtimeActor=env.runtimePrincipal;
const wirePrincipal=(x:any)=>({principal_id:x.principalId,type:x.type,organization_id:x.organizationId,tenant_id:x.tenantId,program_ids:x.programIds});
const target={organization_id:'org-a',tenant_id:'tenant-a',field_id:'field-1'};
const scope={organizationId:'org-a',tenantId:'tenant-a',resourceType:'DECISION_PROBLEM'};
const assignment=publishRoleAssignment({ledger:env.ledger,logicalId:'role.geox-joint-test-only.problem',version:'1',principal:actor,role:'TEST_ONLY_DECISION_PROBLEM_CREATOR',roleDefinitionVersion:'1',permissions:[PERMISSIONS.DECISION_PROBLEM_CREATE],scope,audit:audit(actor,'joint-problem-role')});
const retrievalAuth=createRuntimeReadAuthorization(env,deployment.ref.logicalId,{deployment:deployment.semanticPayload}).recorded.ref;
const role=publishBuiltinRoleAssignment({ledger:env.ledger,logicalId:'role.geox-joint-test-only.inspect',version:'1',principal:runtimeActor,role:'AGRONOMY_REVIEWER',scope:{organizationId:'org-a',tenantId:'tenant-a'},audit:audit(actor,'joint-inspection-role')});
const q=env.qualified,k=q.knowledge.ref;
const inspection=createInspectionAuthorization({env},{knowledgeRef:k,principal:runtimeActor,roleAssignments:[role]});assert.equal(inspection.decision.allowed,true);
const owner={principalId:'fixture-joint-rights-owner',type:'USER',organizationId:'org-a',tenantId:'tenant-a'};
const ownerAudit=(id:string,at:string)=>({eventId:id,occurredAt:at,actor:{id:owner.principalId,type:owner.type}});
const stamp=new Date().toISOString();
const policy=publishRightsPolicy({ledger:env.ledger,logicalId:'policy.geox-joint-test-only',version:'1',ownership:q.ownership,ownerPrincipal:owner,basis:{class:'INTERNAL_POLICY',evidenceRefs:[]},audit:ownerAudit('joint-rights-policy',stamp)});
const rights=publishRightsGrant({ledger:env.ledger,logicalId:'grant.geox-joint-test-only',version:'1',rightsPolicyRef:policy.ref,subjectRef:q.artifact.ref,grantee:{organizationId:'org-a',tenantId:'tenant-a',principalId:runtimeActor.principalId,principalType:runtimeActor.type},rules:[{operation:'DISPLAY_EXCERPT',purposes:['GEOX_CUSTOMER_EVIDENCE'],jurisdictions:['US'],obligations:[]}],validFrom:stamp,validUntil:new Date(Date.now()+600000).toISOString(),grantorPrincipal:owner,audit:ownerAudit('joint-rights-grant',stamp)});
const item=boundedMemberDisplay(env.ledger,k,use,'CORN');
const tokens={'fixture-joint-a01':wirePrincipal(actor),'fixture-joint-a07':wirePrincipal(runtimeActor),'fixture-joint-other':{...wirePrincipal(runtimeActor),tenant_id:'other'}};
const dir=await mkdtemp(join(tmpdir(),'geox-a07-joint-'));
let host:any;
const base='/api/v1/manager/fields',reviewPath=base+'/'+f+'/crop-reviews/review-no-soil',nativePath=reviewPath+'/native-assessment',evidencePath=reviewPath+'/knowledge-evidence';
const req=(method:'GET'|'POST'|'PUT',url:string,body?:any)=>app.inject({method,url,headers:{authorization:'Bearer fixture-native'},...(body===undefined?{}:{payload:body})});
try{
 process.env.ADR_PILOT_TOKEN_BINDINGS_JSON=JSON.stringify(tokens);
 process.env.ADR_PILOT_BOOTSTRAP_PACKAGE_B64=Buffer.from(JSON.stringify({checkpoint:createAuthorityRecoveryCheckpoint({ledger:env.ledger,capturedAt:new Date().toISOString()}),metadata:{mode:'TEST_ONLY_GEOX_JOINT_BROWSER',idempotency:{},workbenchAccess:{}}})).toString('base64');
 const native=await initializePilotRuntime({statePath:join(dir,'state.json'),snapshotDir:join(dir,'snapshots'),allowSyntheticBootstrap:false});
 delete process.env.ADR_PILOT_BOOTSTRAP_PACKAGE_B64;assert.equal(native.ready,true);
 let mode='active',boundRequest:any=null,readCount=0;const writes:any[]=[];
 native.resolveCustomerEvidenceGrant=async({request,principal,request_sha256}:any)=>{
  assert.deepEqual(principal,runtimeActor);
  assert.deepEqual(request.manager_scope,{tenant_id:t,project_id:p,group_id:g,field_id:f,actor_id:'p6_native_actor',mapping_version:'1'});
  assert.equal(request.review_id,'review-no-soil');
  // The owner fixture independently binds the actual persisted manager journal, not a fabricated receipt.
  const rows=(await admin.query("SELECT result,result_sha256 FROM geox_manager_v1.field_native_assessment_p3p_v1 WHERE tenant_id=$1 AND result->>'review_id'=$2 ORDER BY analysis_id",[t,request.review_id])).rows;
  assert.equal(rows.at(-1)?.result.event,'FINISHED');assert.equal(rows.at(-1)?.result_sha256,request.journal_sha256);assert.equal(rows[0].result.basis_sha256,request.basis_sha256);
  const a07=rows.find(r=>r.result.event==='WRITE_RECEIPT'&&r.result.details.operation==='executeKnowledgeRetrieval').result.details.receipt;
  assert.deepEqual(a07.ref,request.retrieval_ref);assert.deepEqual(a07.resource.candidate_refs,request.candidate_refs);
  if(boundRequest)assert.deepEqual(request,boundRequest);else boundRequest=structuredClone(request);
  assert.equal(request_sha256,customerEvidenceRequestHash(request,principal));readCount++;
  const n=Date.now(),checked=mode==='expired'?n-61000:n;
  return {status:'ACTIVE',permission:'ADR_A07_CUSTOMER_EVIDENCE_DISPLAY',request_sha256,approval_ref:'TEST_ONLY:joint-owner-display',checked_at:new Date(checked).toISOString(),valid_until:new Date(checked+30000).toISOString(),members:[{knowledge_ref:toWireRef(k),crop_code:'CORN',jurisdiction:'US',inspection_ref:toWireRef(inspection.recorded.ref),rights_policy_ref:toWireRef(policy.ref),evaluator_principal:owner,projection_sha256:customerEvidenceMemberHash(item)}]};
 };
 host=createPilotHttpServer(native);host.listen(0,'127.0.0.1');await once(host,'listening');
 const origin='http://127.0.0.1:'+host.address().port;
 assert.equal((await (await fetch(origin+'/ready')).json()).bootstrapMode,'TEST_ONLY_GEOX_JOINT_BROWSER');
 const transport:typeof fetch=async(url,init)=>{
  const u=new URL(String(url));assert.equal(u.origin,'https://adr.fixture.invalid');
  const r=await fetch(origin+u.pathname,init);
  if(u.pathname!=='/v1/customer-evidence/resolve'){writes.push({path:u.pathname,status:r.status});if(r.status!==201)console.log('TEST_ONLY_NATIVE_HOST_REJECTION',r.status,(await r.clone().json()).code);}
  return r;
 };
 authorityConfig.adrNativeReview={async resolvePlan(x){
  assert.equal(x.basis.documents.length,0);
  return {basis_sha256:x.basis_sha256,target_binding_ref:'TEST_ONLY:joint-target',decision_mapping_ref:'TEST_ONLY:joint-decision',target_ref:target,deployment_ref:toWireRef(deployment.ref),runtime_profile_ref:toWireRef(env.profile.ref),knowledge_release_ref:toWireRef(env.release.ref),decision_type:decisionType,objective_code:'FIXTURE_TRANSPORT_ONLY',use_purpose:use,use_class:'ADVISORY',decision_authority_mode:'RUNTIME_ONLY',decision_horizon:{duration:'P1Y'},decision_deadline:new Date(Date.now()+86400000).toISOString(),crop_action_bindings:x.basis.intent.crop_codes.map((crop_code:string)=>({crop_code,action_code:crop_code})),datum_bindings:[]};
 },consumer:{baseUrl:'https://adr.fixture.invalid/',async resolveBinding({manager:a,operation,request_sha256,request}){
  assert.ok(['createDecisionProblem','executeKnowledgeRetrieval'].includes(operation));
  const isRuntime=operation==='executeKnowledgeRetrieval';
  let auth=retrievalAuth;
  if(!isRuntime){
   const decision=authorizeDecisionProblemCreation({principal:actor,roleAssignments:[native.ledger.resolve(assignment.ref)],authorizationScope:{...scope,resourceId:request.logical_id}});assert.equal(decision.allowed,true);
   auth=recordAuthorizationDecision({ledger:native.ledger,decision,audit:audit(actor,'joint-actual-problem-auth')}).ref;
  }
  return {request_sha256,authority_scope:{actor_id:a.actor_id,tenant_id:a.tenant_id,project_id:a.project_id,group_id:a.group_id,field_id:a.field_id!,mapping_version:a.mapping_version,credential_ref:a.credential_ref},principal:wirePrincipal(isRuntime?runtimeActor:actor),authorization_ref:toWireRef(auth),credential_ref:isRuntime?'fixture-joint-a07':'fixture-joint-a01',valid_until_ms:a.valid_until_ms};
 },async getCredential(ref){assert.ok(Object.hasOwn(tokens,ref));return ref;},transport}};
 authorityConfig.resolveAdrCustomerEvidence=createCustomerEvidenceHttpResolverV1({baseUrl:'https://adr.fixture.invalid/',async resolveCredential({request,manager,principal}){
  assert.deepEqual(principal,wirePrincipal(runtimeActor));
  return {credential:'fixture-joint-a07',valid_until_ms:manager.valid_until_ms,request_sha256:digest({request,principal,credential_ref:manager.credential_ref}),principal};
 },transport});
 registerManagerPilotModuleV1(app,runtime,authorityConfig);await app.ready();
 allowCreate=true;let made=await req('POST',base,{field_id:f,name:'TEST_ONLY joint field',area_ha:2});assert.equal(made.statusCode,200,made.body);allowCreate=false;
 for(const a of ['READ_FIELD_GEOMETRY','UPDATE_FIELD','REQUEST_CROP_REVIEW','READ_CROP_REVIEW'] as const)grants.add(a);
 const boundary=await req('GET',base+'/'+f+'/geometry');assert.equal(boundary.statusCode,200,boundary.body);
 const updated=await req('PUT',base+'/'+f,{polygon_geojson:{type:'Polygon',coordinates:[[[0,0],[2,0],[2,2],[0,2],[0,0]]]},expected_updated_ts_ms:boundary.json().field_updated_ts_ms});assert.equal(updated.statusCode,200,updated.body);
 const saved=await req('POST',base+'/'+f+'/crop-reviews',{review_id:'review-no-soil',crop_codes:['CORN','SOYBEAN'],target_start_date:'2027-04-01',target_end_date:'2027-10-01',documents:[]});assert.equal(saved.statusCode,200,saved.body);
 await exerciseManagerBrowserRecovery(app,f,nativePath,{item,alreadySaved:true,async negative(which:string){
  if(which==='expired'){mode='expired';return;}
  if(which==='restore'){mode='active';return;}
  if(which==='revoked'){
   const at=new Date().toISOString();publishRightsRevocation({ledger:native.ledger,logicalId:'revoke.geox-joint-test-only',version:'1',rightsGrantRef:rights.ref,effectiveAt:at,reasonCodes:['TEST_ONLY'],revokerPrincipal:owner,audit:ownerAudit('joint-rights-revoke',at)});return;
  }
  throw Error('unexpected negative mode');
 }});
 assert.deepEqual(writes,[{path:'/v1/decision-problems',status:201},{path:'/v1/knowledge-retrieval-results',status:201}]);
 assert.ok(readCount>=4&&boundRequest);
 const foreign=await fetch(origin+'/v1/customer-evidence/resolve',{method:'POST',headers:{authorization:'Bearer fixture-joint-other','content-type':'application/json'},body:JSON.stringify(boundRequest)});
 assert.equal(foreign.status,403);assert.ok(!(await foreign.text()).includes(item.summary));
 wrongGroup=true;const denied=await req('GET',evidencePath);assert.equal(denied.statusCode,404);assert.ok(!denied.body.includes(item.summary));wrongGroup=false;
 console.log(JSON.stringify({status:'A07_JOINT_BROWSER_TEST_ONLY_PASS',adr_subject:'118df952cfc95e7b8327b6ed5f0d7eb591326cb7',geox_subject:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),retrieval_ref:boundRequest.retrieval_ref,knowledge_release_ref:boundRequest.knowledge_release_ref,basis_sha256:boundRequest.basis_sha256,journal_sha256:boundRequest.journal_sha256,knowledge_ref:item.knowledge_ref,rights_grant_ref:toWireRef(rights.ref),read_count:readCount,identity_mode:'TEST_ONLY_SESSION_AND_MANAGER_IDENTITY_PORT',action_authority:false,public_release:false}));
}finally{
 if(host)await new Promise<void>(ok=>host.close(()=>ok()));
 delete process.env.ADR_PILOT_BOOTSTRAP_PACKAGE_B64;delete process.env.ADR_PILOT_TOKEN_BINDINGS_JSON;
 await app.close();await runtime.end();await admin.end();await rm(dir,{recursive:true,force:true});
}
