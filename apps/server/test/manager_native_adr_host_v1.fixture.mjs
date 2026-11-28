// Real upstream ADR HTTP host, ledger, and native scientific engine, with TEST_ONLY
// authority fixtures. No production endpoint, data, token or scientific entitlement.
import assert from 'node:assert/strict';
import {buildManagerScientificResultV1} from '../src/product_projection/customer/manager_scientific_result_v1.ts';
import {execFileSync} from 'node:child_process';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {once} from 'node:events';
import {createManagerAuthorizerV1} from '../src/auth/manager_authority_v1.ts';
import {prepareNativeReviewPlanV1,executeNativeReviewPlanV1} from '../src/domain/agronomy/adr_native_review_workflow_v1.ts';
import {createAdrReviewConsumerV1} from '../src/domain/agronomy/adr_review_consumer_v1.ts';
import {digest} from '../src/domain/field/soil_csv_p2_v1.ts';
assert.equal(process.env.P6_TEST_ONLY,'1');
assert.equal(process.env.GITHUB_ACTIONS,'true');
assert.equal(process.env.RUNNER_ENVIRONMENT,'github-hosted');
assert.equal(process.env.GITHUB_EVENT_NAME,'pull_request');
assert.equal(process.versions.node.split('.')[0],'24');
assert.ok(!process.env.ADR_PILOT_BOOTSTRAP_PACKAGE_B64&&!process.env.ADR_PILOT_TOKEN_BINDINGS_JSON&&!process.env.ADR_PILOT_STATE_PATH&&!process.env.ADR_PILOT_SNAPSHOT_DIR);
const root=resolve(process.env.ADR_NATIVE_SOURCE??'');
assert.equal(execFileSync('git',['-C',root,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),'d63c3058d6b95873e811445920f7302ded980ef3');
const imp=p=>import(pathToFileURL(join(root,p)).href);
const {createDeploymentEnvironment,baseDeployment,publishAuthorizedDeployment,createRuntimeReadAuthorization}=await imp('acceptance/deployment/fixture.mjs');
const {PERMISSIONS,publishRoleAssignment,authorizeDecisionProblemCreation,recordAuthorizationDecision}=await imp('packages/authorization/src/index.mjs');
const {writeAuthorization,audit}=await imp('acceptance/context-manifest/fixtures.mjs');
const {createAuthorityRecoveryCheckpoint}=await imp('packages/recovery-operations/src/index.mjs');
const {initializePilotRuntime,createPilotHttpServer}=await imp('deploy/adr-pilot-host/server.mjs');
const {toWireRef}=await imp('acceptance/v0.3-pilot-release/fixture.mjs');
const env=createDeploymentEnvironment('geox-p6-native-contract');
const decisionType='FIXTURE_NATIVE_MANAGER_REVIEW';
const original=baseDeployment(env);
const deployment=publishAuthorizedDeployment(env,{logicalId:'deployment.geox-p6-native-contract',deployment:{...original,deploymentScope:{...original.deploymentScope,decisionTypes:[decisionType]}}});
const target={organization_id:'org-a',tenant_id:'tenant-a',field_id:'field-1'};
const actor={principalId:'fixture-geox-manager-proxy',type:'SERVICE_ACCOUNT',organizationId:'org-a',tenantId:'tenant-a',programIds:['pilot-a']};
const runtimeActor=env.runtimePrincipal;
const wirePrincipal=x=>({principal_id:x.principalId,type:x.type,organization_id:x.organizationId,tenant_id:x.tenantId,program_ids:x.programIds});
const row={row_number:2,sample_id:'fixture-point',sampled_on:'2026-08-19',latitude_deg:1,longitude_deg:1,depth_top_cm:0,depth_bottom_cm:10,analyte:'ph_water',value:6.4,unit:'pH',method:'water_1_1',epistemic_class:'ASSERTION',provenance_class:'USER',scientific_qualification:'NOT_ESTABLISHED',laboratory_identity_verified:false};
const basis={intent:{crop_codes:['FIXTURE_A','FIXTURE_B'],target_start_date:'2026-08-21',target_end_date:'2026-09-01'},documents:[{document_id:'fixture-doc',revision:1,original_sha256:'1'.repeat(64),candidate_sha256:digest([row]),confirmation_fact_id:'fixture-confirmation',epistemic_class:'ASSERTION',scientific_qualification:'NOT_ESTABLISHED',candidates:[row]}]};
const request={basis_sha256:digest(basis),basis,attempt_id:'geox-native-fixture',evaluation_time:'2026-08-20T10:00:00.000Z'};
const plan=prepareNativeReviewPlanV1(request,{basis_sha256:request.basis_sha256,target_binding_ref:'TEST_ONLY:target',decision_mapping_ref:'TEST_ONLY:decision',target_ref:target,deployment_ref:toWireRef(deployment.ref),runtime_profile_ref:toWireRef(env.profile.ref),knowledge_release_ref:toWireRef(env.release.ref),decision_type:decisionType,objective_code:'FIXTURE_TRANSPORT_ONLY',use_purpose:'CORN_IRRIGATION_APPLICABILITY',use_class:'ADVISORY',decision_authority_mode:'RUNTIME_ONLY',decision_horizon:{duration:'P12D'},decision_deadline:'2026-08-21T00:00:00Z',crop_action_bindings:basis.intent.crop_codes.map(crop_code=>({crop_code,action_code:crop_code})),datum_bindings:[{document_id:'fixture-doc',revision:1,row_number:2,mapping_ref:'TEST_ONLY:soil-report-mapping',semantic_id:'fixture.soil.ph',geometry_ref:'fixture-sample-point',sample_day_start:'2026-08-19T00:00:00Z',sample_day_end:'2026-08-19T23:59:59.999Z'}]});
const scope={organizationId:actor.organizationId,tenantId:actor.tenantId,resourceType:'DECISION_PROBLEM'};
const assignment=publishRoleAssignment({ledger:env.ledger,logicalId:'role.geox-p6-fixture-problem',version:'1',principal:actor,role:'TEST_ONLY_DECISION_PROBLEM_CREATOR',roleDefinitionVersion:'1',permissions:[PERMISSIONS.DECISION_PROBLEM_CREATE],scope,audit:audit(actor,'geox-fixture-problem-role')});
const decision=authorizeDecisionProblemCreation({principal:actor,roleAssignments:[assignment],authorizationScope:{...scope,resourceId:plan.problem.logical_id}});
assert.equal(decision.allowed,true);
const problemAuth=recordAuthorizationDecision({ledger:env.ledger,decision,audit:audit(actor,'geox-fixture-problem-auth')}).ref;
const emptyBasis={...basis,documents:[]};
const emptyRequest={...request,basis:emptyBasis,basis_sha256:digest(emptyBasis),attempt_id:'geox-native-empty-fixture'};
const emptyPlan=prepareNativeReviewPlanV1(emptyRequest,{basis_sha256:emptyRequest.basis_sha256,target_binding_ref:'TEST_ONLY:target',decision_mapping_ref:'TEST_ONLY:decision',target_ref:target,deployment_ref:toWireRef(deployment.ref),runtime_profile_ref:toWireRef(env.profile.ref),knowledge_release_ref:toWireRef(env.release.ref),decision_type:decisionType,objective_code:'FIXTURE_TRANSPORT_ONLY',use_purpose:'CORN_IRRIGATION_APPLICABILITY',use_class:'ADVISORY',decision_authority_mode:'RUNTIME_ONLY',decision_horizon:{duration:'P12D'},decision_deadline:'2026-08-21T00:00:00Z',crop_action_bindings:basis.intent.crop_codes.map(crop_code=>({crop_code,action_code:crop_code})),datum_bindings:[]});
const emptyDecision=authorizeDecisionProblemCreation({principal:actor,roleAssignments:[assignment],authorizationScope:{...scope,resourceId:emptyPlan.problem.logical_id}});
assert.equal(emptyDecision.allowed,true);
const emptyProblemAuth=recordAuthorizationDecision({ledger:env.ledger,decision:emptyDecision,audit:audit(actor,'geox-fixture-empty-problem-auth')}).ref;
const datumAuth=writeAuthorization(env.ledger,plan.datums[0].logical_id,'CONTEXT_DATUM',actor).recorded.ref;
const manifestAuth=writeAuthorization(env.ledger,plan.attempt_id+':manifest','CONTEXT_MANIFEST',actor).recorded.ref;
const retrievalAuth=createRuntimeReadAuthorization(env,deployment.ref.logicalId,{deployment:deployment.semanticPayload}).recorded.ref;
const auths={createDecisionProblem:problemAuth,createContextDatum:datumAuth,createContextManifest:manifestAuth,executeKnowledgeRetrieval:retrievalAuth,createApplicabilityAssessment:retrievalAuth};
const tokenMap={'fixture-context-only':wirePrincipal(actor),'fixture-runtime-only':wirePrincipal(runtimeActor)};
const tenant={issuer:'fixture-directory',id:'fixture-tenant',version:'1'},membership={...tenant,id:'fixture-member'};
const issued=new WeakSet();
const authority=createManagerAuthorizerV1({issuer:'https://fixture.invalid',canonicalTenantRef:tenant,identity:{kind:'FORMAL_PROVIDER_NEUTRAL_IDENTITY',async verify(token){assert.equal(token,'fixture-manager');const c={};issued.add(c);return c;},authorize(c){assert.ok(issued.has(c));return {issuer:'https://fixture.invalid',subject:'fixture-human',principal_kind:'HUMAN',canonical_tenant_ref:tenant,membership_ref:membership,membership_status:'ACTIVE',mapping_version:'1',credential_ref:'3'.repeat(64),valid_until:new Date(Date.now()+55000).toISOString()};},authorizeResource(){throw Error('not used');},invalidate(c){issued.delete(c);}},async resolveLandGrant({assertion,field_id,action}){if(field_id!=='fixture-field'||action!=='REQUEST_CROP_REVIEW')return null;return {status:'ACTIVE',issuer:assertion.issuer,subject:assertion.subject,canonical_tenant_ref:tenant,membership_ref:membership,mapping_version:'1',source_ref:membership,actor_id:'fixture-actor',tenant_id:'fixture-tenant',project_id:'fixture-project',group_id:'fixture-group',field_id,action,checked_at:new Date().toISOString(),valid_until:new Date(Date.now()+50000).toISOString()};}});
const dir=await mkdtemp(join(tmpdir(),'geox-p6-adr-native-'));
const statePath=join(dir,'state.json'),snapshotDir=join(dir,'snapshots');
let server;
try{
 process.env.ADR_PILOT_TOKEN_BINDINGS_JSON=JSON.stringify(tokenMap);
 process.env.ADR_PILOT_BOOTSTRAP_PACKAGE_B64=Buffer.from(JSON.stringify({checkpoint:createAuthorityRecoveryCheckpoint({ledger:env.ledger,capturedAt:new Date().toISOString()}),metadata:{mode:'TEST_ONLY_NATIVE_GEOX_CONTRACT',idempotency:{},workbenchAccess:{}}})).toString('base64');
 const runtime=await initializePilotRuntime({statePath,snapshotDir,allowSyntheticBootstrap:false});
 delete process.env.ADR_PILOT_BOOTSTRAP_PACKAGE_B64;
 assert.equal(runtime.ready,true);
 server=createPilotHttpServer(runtime);server.listen(0,'127.0.0.1');await once(server,'listening');
 const base='http://127.0.0.1:'+server.address().port;
 const ready=await (await fetch(base+'/ready')).json();assert.equal(ready.bootstrapMode,'TEST_ONLY_NATIVE_GEOX_CONTRACT');
 const manager=await authority.authorize('fixture-manager','fixture-field','REQUEST_CROP_REVIEW');
 const events=[],httpStatuses=[];
 const consumer=createAdrReviewConsumerV1({baseUrl:'https://adr.fixture.invalid/',authority,async resolveBinding({manager:a,operation,request_sha256,request}){
  const isRuntime=operation==='executeKnowledgeRetrieval'||operation==='createApplicabilityAssessment';
  return {request_sha256,authority_scope:{actor_id:a.actor_id,tenant_id:a.tenant_id,project_id:a.project_id,group_id:a.group_id,field_id:a.field_id,mapping_version:a.mapping_version,credential_ref:a.credential_ref},principal:wirePrincipal(isRuntime?runtimeActor:actor),authorization_ref:toWireRef(operation==='createDecisionProblem'&&request.logical_id===emptyPlan.problem.logical_id?emptyProblemAuth:auths[operation]),credential_ref:isRuntime?'fixture-runtime-only':'fixture-context-only',valid_until_ms:a.valid_until_ms};
 },async getCredential(ref){assert.ok(Object.hasOwn(tokenMap,ref));return ref;},async transport(url,init){
  // Only the fixture transport converts the pinned dummy HTTPS origin to the
  // native host's loopback address. Production Consumer keeps default TLS.
  const u=new URL(url);assert.equal(u.origin,'https://adr.fixture.invalid');
  const response=await fetch(base+u.pathname,init);httpStatuses.push(response.status);
  if(response.status!==201){const diagnostic=await response.clone().json().catch(()=>({}));console.log('TEST_ONLY_NATIVE_HOST_REJECTION',response.status,diagnostic.code??'UNKNOWN');}
  return response;
 }});
 await executeNativeReviewPlanV1(manager,plan,consumer,async(event,details)=>{events.push({event,details});});
 const end=events.at(-1);assert.equal(end?.event,'FINISHED');assert.equal(end.details.status,'NATIVE_ASSESSMENTS_RECORDED',JSON.stringify(end.details));
 assert.equal(end.details.action_authority,false);assert.ok(end.details.assessment_refs.length>0);
 assert.ok(httpStatuses.length>=5&&httpStatuses.every(s=>s===201));
 const receipts=events.filter(x=>x.event==='WRITE_RECEIPT');assert.equal(receipts.length,httpStatuses.length);
 const datum=receipts.find(x=>x.details.operation==='createContextDatum').details.receipt.resource;assert.equal(datum.epistemic_class,'ASSERTION');assert.equal(datum.provenance_class,'USER');assert.equal(datum.spatial_support.type,'POINT');assert.equal(datum.uncertainty.type,'UNKNOWN');
 const final=receipts.filter(x=>x.details.operation==='createApplicabilityAssessment');assert.ok(final.every(x=>x.details.receipt.resource.authority_class==='SOURCE_TARGET_TRANSPORT_AUTHORITY'));
 assert.ok(final.every(x=>!['DIRECTLY_APPLICABLE','APPLICABLE_WITH_GOVERNED_TRANSFORM'].includes(x.details.receipt.resource.transport_status)),'fixture missing crop context must not become direct applicability');
 const j={attempt:plan.attempt_id,events,prev:digest(events)};
 const hidden=await buildManagerScientificResultV1(j,'fixture-review',request.basis_sha256,manager);assert.equal(hidden.display_status,'DISPLAY_PERMISSION_NOT_ESTABLISHED');assert.deepEqual(hidden.assessments,[]);
 const display=async({request_sha256})=>({permission:'ADR_A08_BOUNDED_DISPLAY',request_sha256,approval_ref:'TEST_ONLY:display',checked_at:new Date().toISOString(),valid_until:new Date(Date.now()+10000).toISOString()});
 const visible=await buildManagerScientificResultV1(j,'fixture-review',request.basis_sha256,manager,display);
 assert.equal(visible.display_status,'AUTHORIZED_RECORDED_RESULT');assert.equal(visible.action_authority,false);assert.equal(visible.assessments.length,final.length);
 for(const [index,item] of visible.assessments.entries()){
  const raw=final[index].details.receipt.resource;
  assert.equal(item.transport_status,raw.transport_status);assert.equal(item.scientific_use_status,raw.scientific_use_status);assert.equal(item.runtime_use,raw.runtime_use);
  assert.deepEqual(item.missing_context_semantic_ids,raw.missing_context_semantic_ids);
  assert.ok(item.conditions.every(c=>Object.keys(c).sort().join(',')==='semantic_id,status'));
 }
 const wrong=await buildManagerScientificResultV1(j,'fixture-review',request.basis_sha256,manager,async(x)=>({...await display(x),request_sha256:'0'.repeat(64)}));assert.equal(wrong.display_status,'DISPLAY_PERMISSION_NOT_ESTABLISHED');
 console.log('PASS REAL_ADR_A08_RIGHTS_GATED_PRODUCT_PROJECTION_TEST_ONLY');
 const emptyEvents=[],priorCalls=httpStatuses.length;
 await executeNativeReviewPlanV1(manager,emptyPlan,consumer,async(event,details)=>{emptyEvents.push({event,details});});
 assert.equal(httpStatuses.length-priorCalls,2);
 assert.deepEqual(emptyEvents.filter(x=>x.event==='WRITE_RECEIPT').map(x=>x.details.operation),['createDecisionProblem','executeKnowledgeRetrieval']);
 assert.equal(emptyEvents.at(-1).details.status,'NATIVE_RETRIEVAL_RECORDED_CONTEXT_REQUIRED');
 assert.deepEqual(emptyEvents.at(-1).details.assessment_refs,[]);
 assert.equal(emptyEvents.at(-1).details.action_authority,false);
 console.log('PASS ACTUAL_ADR_A01_A07_WITHOUT_SOIL_CONTEXT_TEST_ONLY');
 const persisted=JSON.parse(await readFile(statePath,'utf8'));assert.equal(persisted.metadata.mode,'TEST_ONLY_NATIVE_GEOX_CONTRACT');assert.equal(Object.keys(persisted.metadata.idempotency).length,httpStatuses.length);
 await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));server=undefined;
 const restored=await initializePilotRuntime({statePath,snapshotDir,allowSyntheticBootstrap:false});assert.equal(restored.ready,true);
 for(const e of emptyEvents.filter(x=>x.event==='WRITE_RECEIPT')){const x=e.details.receipt.ref;const core={kind:x.kind,logicalId:x.logical_id,version:x.version,semanticHash:x.semantic_hash};assert.equal(restored.ledger.resolve(core).ref.semanticHash,x.semantic_hash);}
 for(const x of end.details.assessment_refs){const core={kind:x.kind,logicalId:x.logical_id,version:x.version,semanticHash:x.semantic_hash};assert.equal(restored.ledger.resolve(core).ref.semanticHash,x.semantic_hash);}
 console.log('PASS ACTUAL_PINNED_ADR_NATIVE_HTTP_A01_A02_A04_A07_A08_AND_RESTART_TEST_ONLY');
}finally{
 if(server)await new Promise(resolve=>server.close(resolve));
 delete process.env.ADR_PILOT_BOOTSTRAP_PACKAGE_B64;delete process.env.ADR_PILOT_TOKEN_BINDINGS_JSON;
 await rm(dir,{recursive:true,force:true});
}
