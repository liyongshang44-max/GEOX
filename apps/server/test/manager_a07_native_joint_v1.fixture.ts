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
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {sha as privateSha,sealOwnerDisplayApproval,ownerDisplaySchema,createOwnerDisplayApprovalLoader,createIsolatedPrivateCredentialBinding,createPrivateLoopbackTransport} from '../../../scripts/product/e2e01/adr-private-admission.mjs';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {once} from 'node:events';
import {digest} from '../src/domain/field/soil_csv_p2_v1.ts';
import {assertCompletedRecovery} from '../../../scripts/product/e2e01/adr-formal-run-admission.mjs';
import {readManagerNativeReviewJournalV1} from '../src/routes/manager_native_review_v1.ts';
import {createBoundedNativeReviewAdmissionV1} from '../src/domain/agronomy/e2e01_native_review_admission_v1.ts';
import {createE2E01CustomerDisplayAdmissionV1} from '../src/product_projection/customer/e2e01_customer_display_admission_v1.ts';
import {exerciseManagerBrowserRecovery} from './manager_browser_recovery_v1.fixture.mjs';
assert.equal(process.env.GITHUB_EVENT_NAME,'pull_request');
assert.equal(process.versions.node.split('.')[0],'24');
assert.ok(!process.env.ADR_PILOT_BOOTSTRAP_PACKAGE_B64&&!process.env.ADR_PILOT_TOKEN_BINDINGS_JSON&&!process.env.ADR_PILOT_STATE_PATH&&!process.env.ADR_PILOT_SNAPSHOT_DIR);
const root=resolve(process.env.ADR_NATIVE_SOURCE??'');
assert.equal(execFileSync('git',['-C',root,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),'a7a058a6d4b6cce97727af3553cc21d9d79d572b');
const imp=(p:string)=>import(pathToFileURL(join(root,p)).href);
const {createDeploymentEnvironment,baseDeployment,publishAuthorizedDeployment,createRuntimeReadAuthorization}=await imp('acceptance/deployment/fixture.mjs');
const {PERMISSIONS,publishRoleAssignment,publishBuiltinRoleAssignment,authorizeDecisionProblemCreation,recordAuthorizationDecision}=await imp('packages/authorization/src/index.mjs');
const {audit}=await imp('acceptance/context-manifest/fixtures.mjs');
const {createInspectionAuthorization}=await imp('acceptance/workbench/fixture.mjs');
const {createAuthorityRecoveryCheckpoint,restoreAuthorityRecoveryCheckpoint}=await imp('packages/recovery-operations/src/index.mjs');
const {publishRightsGrant,publishRightsRevocation}=await imp('packages/rights-authority/src/index.mjs');
const {licensedPublicationFixture}=await imp('acceptance/derived-knowledge/fixture.mjs');
const {initializePilotRuntime,createPilotHttpServer}=await imp('deploy/adr-pilot-host/server.mjs');
const {boundedMemberDisplay,customerEvidenceMemberHash,customerEvidenceRequestHash}=await imp('deploy/adr-pilot-host/customer-evidence.mjs');
const {toWireRef}=await imp('acceptance/v0.3-pilot-release/fixture.mjs');
const owner={principalId:'fixture-joint-rights-owner',type:'USER',organizationId:'org-a',tenantId:'tenant-a'};
const env=createDeploymentEnvironment('geox-joint-test-only',{},{sourceFixture:licensedPublicationFixture('geox-joint',owner)});
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
const ownerAudit=(id:string,at:string)=>({eventId:id,occurredAt:at,actor:{id:owner.principalId,type:owner.type}});
const stamp=new Date().toISOString();
const policy=env.ledger.resolve(q.artifact.semanticPayload.rightsSnapshot.policyRef);
const rights=publishRightsGrant({ledger:env.ledger,logicalId:'grant.geox-joint-test-only',version:'1',rightsPolicyRef:policy.ref,subjectRef:q.artifact.ref,grantee:{organizationId:'org-a',tenantId:'tenant-a',principalId:runtimeActor.principalId,principalType:runtimeActor.type},rules:[{operation:'DISPLAY_EXCERPT',purposes:['GEOX_CUSTOMER_EVIDENCE'],jurisdictions:['US'],obligations:['RETAIN_SOURCE_ATTRIBUTION_LICENSE_ADAPTATION_NOTICE']}],validFrom:stamp,validUntil:new Date(Date.now()+600000).toISOString(),grantorPrincipal:owner,audit:ownerAudit('joint-rights-grant',stamp)});
const item=boundedMemberDisplay(env.ledger,k,use,'CORN');
let privateCredentials:ReturnType<typeof createIsolatedPrivateCredentialBinding>|undefined;
const dir=await mkdtemp(join(tmpdir(),'geox-a07-joint-'));
let host:any;
const base='/api/v1/manager/fields',reviewPath=base+'/'+f+'/crop-reviews/review-no-soil',nativePath=reviewPath+'/native-assessment',evidencePath=reviewPath+'/knowledge-evidence';
const req=(method:'GET'|'POST'|'PUT',url:string,body?:any)=>app.inject({method,url,headers:{authorization:'Bearer fixture-native'},...(body===undefined?{}:{payload:body})});
try{
 const initialCheckpoint=createAuthorityRecoveryCheckpoint({ledger:env.ledger,capturedAt:new Date().toISOString()});
 process.env.ADR_PILOT_BOOTSTRAP_PACKAGE_B64=Buffer.from(JSON.stringify({checkpoint:initialCheckpoint,metadata:{mode:'TEST_ONLY_GEOX_JOINT_BROWSER',idempotency:{},workbenchAccess:{}}})).toString('base64');
 const native=await initializePilotRuntime({statePath:join(dir,'state.json'),snapshotDir:join(dir,'snapshots'),allowSyntheticBootstrap:false});
 delete process.env.ADR_PILOT_BOOTSTRAP_PACKAGE_B64;assert.equal(native.ready,true);
 privateCredentials=createIsolatedPrivateCredentialBinding({runtime:native,a01:actor,a07:runtimeActor,validUntilMs:Date.now()+600000});
 let mode='active',boundRequest:any=null,readCount=0;const writes:any[]=[];
 host=createPilotHttpServer(native);host.listen(0,'127.0.0.1');await once(host,'listening');
 const origin='http://127.0.0.1:'+host.address().port;
 assert.equal((await (await fetch(origin+'/ready')).json()).bootstrapMode,'TEST_ONLY_GEOX_JOINT_BROWSER');
 for(const path of ['/v1/applicability-assessments','/v1/decision-problems']){
  const denied=await fetch(origin+path,{method:'POST',headers:{authorization:'Bearer '+privateCredentials!.getCredential('A07'),'content-type':'application/json'},body:'{}'});
  assert.equal(denied.status,404);assert.equal((await denied.json()).code,'HTTP_OPERATION_NOT_ALLOWED');
 }
 const privateTransport=createPrivateLoopbackTransport({port:host.address().port,logicalOrigin:'https://adr.fixture.invalid'});
 const transport:typeof fetch=async(url,init)=>{
  const u=new URL(String(url));assert.equal(u.origin,'https://adr.fixture.invalid');
  const r=await privateTransport(url,init);
  if(u.pathname!=='/v1/customer-evidence/resolve'){writes.push({path:u.pathname,status:r.status});if(r.status!==201)console.log('TEST_ONLY_NATIVE_HOST_REJECTION',r.status,(await r.clone().json()).code);}
  return r;
 };
 let runAdmission:any=null;
 authorityConfig.adrNativeReview=createBoundedNativeReviewAdmissionV1({pool:runtime,authority:()=>managerAuthority,async readRunAdmission(){return runAdmission;},baseUrl:'https://adr.fixture.invalid/',transport,async createA01Authorization({request,request_sha256,approval_ref,basis_sha256}){
  const decision=authorizeDecisionProblemCreation({principal:actor,roleAssignments:[native.ledger.resolve(assignment.ref)],authorizationScope:{...scope,resourceId:request.logical_id}});assert.equal(decision.allowed,true);
  const ref=recordAuthorizationDecision({ledger:native.ledger,decision,audit:{...audit(actor,'joint-actual-problem-auth'),details:{request_sha256,approval_ref,basis_sha256}}}).ref;
  native.persist();return toWireRef(ref);
 },async getCredential(ref){const token=privateCredentials!.getCredential(ref);assert.ok(token);return token;}});
 const binding={manager_scope:{tenant_id:t,project_id:p,group_id:g,field_id:f,actor_id:'p6_native_actor',mapping_version:'1'},review_id:'review-no-soil',principal:wirePrincipal(runtimeActor),deployment_ref:toWireRef(deployment.ref),runtime_profile_ref:toWireRef(env.profile.ref),knowledge_release_ref:toWireRef(env.release.ref),member:{knowledge_ref:toWireRef(k),crop_code:'CORN' as const,jurisdiction:'US',inspection_ref:toWireRef(inspection.recorded.ref),rights_policy_ref:toWireRef(policy.ref),evaluator_principal:owner,projection_sha256:customerEvidenceMemberHash(item)}};
 let managerAuthority:ReturnType<typeof registerManagerPilotModuleV1>;
 const ownerEnd=rights.semanticPayload.validUntil;
 const approvalPath=join(dir,'test-only-owner-approval.json'),revocationPath=join(dir,'REVOKED'),managerPolicyPath=join(dir,'test-only-policy.json');
 const policyBytes='TEST_ONLY_MANAGER_POLICY';await writeFile(managerPolicyPath,policyBytes);
 const ownerMaterial=sealOwnerDisplayApproval({schema:ownerDisplaySchema,decision:'AUTHORIZE_BOUNDED_DISPLAY_ADMISSION',status:'ACTIVE',owner_subject:owner.principalId,owner_authentication_sha256:privateSha('TEST_ONLY_OWNER'),checkpoint_sha256:privateSha('TEST_ONLY_CHECKPOINT'),manager_policy_sha256:privateSha(policyBytes),binding,viewer_jurisdiction:'US',purpose:'GEOX_CUSTOMER_EVIDENCE',approved_at:new Date().toISOString(),valid_until:ownerEnd});
 const bytes=JSON.stringify(ownerMaterial);await writeFile(approvalPath,bytes);
 const loadApproval=createOwnerDisplayApprovalLoader({approvalPath,revocationPath,managerPolicyPath,expectedFileSha256:privateSha(bytes),managerPolicySha256:privateSha(policyBytes),checkpointSha256:privateSha('TEST_ONLY_CHECKPOINT'),ownerSubject:owner.principalId,binding,rightsEnd:ownerEnd});
 const admission=createE2E01CustomerDisplayAdmissionV1({pool:runtime,authority:()=>managerAuthority,binding,baseUrl:'https://adr.fixture.invalid/',transport,nativeRequestHash:customerEvidenceRequestHash,async getCredential(){return privateCredentials!.getCredential('A07');},readOwnerApproval:loadApproval});
 native.resolveCustomerEvidenceGrant=async(input:any)=>{
  const grant=await admission.resolveGrant(input);
  if(grant){if(boundRequest)assert.deepEqual(input.request,boundRequest);else boundRequest=structuredClone(input.request);readCount++;}
  return grant;
 };
 authorityConfig.resolveAdrCustomerEvidence=admission.resolve;
 managerAuthority=registerManagerPilotModuleV1(app,runtime,authorityConfig);await app.ready();
 allowCreate=true;let made=await req('POST',base,{field_id:f,name:'TEST_ONLY joint field',area_ha:2});assert.equal(made.statusCode,200,made.body);allowCreate=false;
 for(const a of ['READ_FIELD_GEOMETRY','UPDATE_FIELD','REQUEST_CROP_REVIEW','READ_CROP_REVIEW'] as const)grants.add(a);
 const boundary=await req('GET',base+'/'+f+'/geometry');assert.equal(boundary.statusCode,200,boundary.body);
 const updated=await req('PUT',base+'/'+f,{polygon_geojson:{type:'Polygon',coordinates:[[[0,0],[2,0],[2,2],[0,2],[0,0]]]},expected_updated_ts_ms:boundary.json().field_updated_ts_ms});assert.equal(updated.statusCode,200,updated.body);
 const saved=await req('POST',base+'/'+f+'/crop-reviews',{review_id:'review-no-soil',crop_codes:['CORN','SOYBEAN'],target_start_date:'2027-04-01',target_end_date:'2027-10-01',documents:[]});assert.equal(saved.statusCode,200,saved.body);
 const basisRow=(await admin.query("SELECT basis,result FROM geox_manager_v1.field_crop_review_p3_v1 WHERE tenant_id=$1 AND review_id=$2",[t,'review-no-soil'])).rows[0];
 runAdmission={approval_ref:'TEST_ONLY:joint-run',valid_until_ms:Date.parse(ownerEnd),a01:wirePrincipal(actor),a07:wirePrincipal(runtimeActor),runtime_authorization_ref:toWireRef(retrievalAuth),mapping:{manager_scope:binding.manager_scope,review_id:binding.review_id,basis_sha256:basisRow.result.basis_sha256,intent:basisRow.basis.intent,target_binding_ref:'TEST_ONLY:joint-target',decision_mapping_ref:'TEST_ONLY:joint-decision',target_ref:target,deployment_ref:binding.deployment_ref,runtime_profile_ref:binding.runtime_profile_ref,knowledge_release_ref:binding.knowledge_release_ref,decision_type:decisionType,objective_code:'FIXTURE_TRANSPORT_ONLY',use_purpose:use,decision_horizon:{duration:'P1Y'},decision_deadline:new Date(Date.now()+86400000).toISOString(),crop_action_bindings:basisRow.basis.intent.crop_codes.map((crop_code:string)=>({crop_code,action_code:crop_code}))}};
 await exerciseManagerBrowserRecovery(app,f,nativePath,{item,alreadySaved:true,async negative(which:string){
  if(which==='expired'){await writeFile(revocationPath,'TEST_ONLY_REVOKED');return;}
  if(which==='restore'){await rm(revocationPath);return;}
  if(which==='revoked'){
   assert.ok(boundRequest);
   const replay=await fetch(origin+'/v1/customer-evidence/resolve',{method:'POST',headers:{authorization:'Bearer '+privateCredentials!.getCredential('A07'),'content-type':'application/json'},body:JSON.stringify(boundRequest)});
   assert.equal(replay.status,403);assert.ok(!(await replay.text()).includes(item.summary));
   const forged=await admission.resolve(boundRequest,{...binding.manager_scope,action:'READ_CROP_REVIEW',valid_until_ms:Date.now()+10000} as any,binding.principal);
   assert.equal(forged,null);
   // Reopen actual persisted ADR state before Rights revocation. The formal
   // recovery validator sees the real product journal and native ledger delta.
   const saved=JSON.parse(await (await import('node:fs/promises')).readFile(join(dir,'state.json'),'utf8'));
   restoreAuthorityRecoveryCheckpoint(saved.checkpoint);
   const pc=await runtime.connect();try{
    await pc.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const jr=await readManagerNativeReviewJournalV1(pc,[t,p,g,f],'review-no-soil',basisRow.result.basis_sha256);
    const proof=assertCompletedRecovery({frozen:initialCheckpoint,restored:saved.checkpoint,journal:jr,expectedMember:toWireRef(k),coreRef:(r:any)=>({kind:r.kind,logicalId:r.logical_id,version:r.version,semanticHash:r.semantic_hash})});
    assert.equal(proof.retrieval_ref.logical_id,boundRequest.retrieval_ref.logical_id);
    await pc.query('COMMIT');
   }finally{pc.release();}
   const at=new Date().toISOString();publishRightsRevocation({ledger:native.ledger,logicalId:'revoke.geox-joint-test-only',version:'1',rightsGrantRef:rights.ref,effectiveAt:at,reasonCodes:['TEST_ONLY'],revokerPrincipal:owner,audit:ownerAudit('joint-rights-revoke',at)});return;
  }
  throw Error('unexpected negative mode');
 }});
 assert.deepEqual(writes,[{path:'/v1/decision-problems',status:201},{path:'/v1/knowledge-retrieval-results',status:201}]);
 assert.ok(readCount>=2&&boundRequest);
 const foreign=await fetch(origin+'/v1/customer-evidence/resolve',{method:'POST',headers:{authorization:'Bearer '+privateCredentials!.getCredential('A01'),'content-type':'application/json'},body:JSON.stringify(boundRequest)});
 assert.equal(foreign.status,404);assert.ok(!(await foreign.text()).includes(item.summary));
 wrongGroup=true;const denied=await req('GET',evidencePath);assert.equal(denied.statusCode,404);assert.ok(!denied.body.includes(item.summary));wrongGroup=false;
 console.log(JSON.stringify({status:'A07_JOINT_BROWSER_TEST_ONLY_PASS',adr_subject:'a7a058a6d4b6cce97727af3553cc21d9d79d572b',geox_subject:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),retrieval_ref:boundRequest.retrieval_ref,knowledge_release_ref:boundRequest.knowledge_release_ref,basis_sha256:boundRequest.basis_sha256,journal_sha256:boundRequest.journal_sha256,knowledge_ref:item.knowledge_ref,rights_grant_ref:toWireRef(rights.ref),read_count:readCount,identity_mode:'TEST_ONLY_SESSION_AND_MANAGER_IDENTITY_PORT',action_authority:false,public_release:false}));
}finally{
 privateCredentials?.close();
 if(host)await new Promise<void>(ok=>host.close(()=>ok()));
 delete process.env.ADR_PILOT_BOOTSTRAP_PACKAGE_B64;delete process.env.ADR_PILOT_TOKEN_BINDINGS_JSON;
 await app.close();await runtime.end();await admin.end();await rm(dir,{recursive:true,force:true});
}
