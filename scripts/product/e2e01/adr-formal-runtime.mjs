// The actual local runtime composition; no test transport/clock or principals.
// It is inert until a separately approved, exact, local formal-run file exists.
import {readFileSync,writeFileSync,lstatSync,existsSync,mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {once} from 'node:events';
import {createHash} from 'node:crypto';
import {createFormalPrivateCredentialBinding,formalMode} from './adr-formal-credential.mjs';
import {createOwnerDisplayApprovalLoader,createPrivateLoopbackTransport,canonical,sha} from './adr-private-admission.mjs';
import {createFormalRunApprovalLoader,buildFormalScope,exactFile,assertCompletedRecovery} from './adr-formal-run-admission.mjs';
import {createBoundedNativeReviewAdmissionV1} from '../../../apps/server/src/domain/agronomy/e2e01_native_review_admission_v1.ts';
import {createE2E01CustomerDisplayAdmissionV1} from '../../../apps/server/src/product_projection/customer/e2e01_customer_display_admission_v1.ts';
import {loadManagerNativeReviewBasisV1,readManagerNativeReviewJournalV1} from '../../../apps/server/src/routes/manager_native_review_v1.ts';
const need=(x,c)=>{if(!x)throw Error(c??'FORMAL_RUNTIME_DENIED');};
const same=(a,b)=>canonical(a)===canonical(b),read=p=>JSON.parse(exactFile(p));
const coreRef=r=>({kind:r.kind,logicalId:r.logical_id,version:r.version,semanticHash:r.semantic_hash});
const wireRef=r=>({kind:r.kind,logical_id:r.logicalId,version:r.version,semantic_hash:r.semanticHash});
const hash=x=>typeof x==='string'&&/^sha256:[a-f0-9]{64}$/.test(x);
const git=(p,...a)=>execFileSync('git',['--no-optional-locks','-C',p,...a],{encoding:'utf8',windowsHide:true}).trim();
const save=(p,x)=>writeFileSync(p,JSON.stringify(x,null,2)+'\n',{flag:'wx',mode:0o600,flush:true});
async function readSecretPipe(){
 // Only a trusted local parent may deliver exact secrets on a private pipe.
 // Never accept secrets from argv, environment, browser or persistent files.
 need(!process.stdin.isTTY,'FORMAL_PRIVATE_PIPE_REQUIRED');
 const chunks=[];let n=0;for await(const c of process.stdin){n+=c.length;need(n<=4096,'FORMAL_PRIVATE_PIPE_SIZE');chunks.push(c);}
 const b=Buffer.concat(chunks);try{return JSON.parse(b.toString('utf8'));}finally{b.fill(0);for(const c of chunks)c.fill(0);}
}
export async function prepareFormalRuntime({pool,authority,policyPath,kit,geoxRoot,args}){
 need(process.platform==='win32'&&process.versions.node.split('.')[0]==='24'&&args.length===4,'FORMAL_WINDOWS_EXACT_ARGUMENTS');
 const [mode,adrArg,runArg,pin]=args;
 need(['--formal-run','--formal-recover-readonly'].includes(mode)&&hash(pin),'FORMAL_EXPLICIT_MODE_REQUIRED');
 const recovery=mode==='--formal-recover-readonly',adr=resolve(adrArg),runDir=resolve(runArg);
 const root=join(process.env.LOCALAPPDATA,'GEOX-ADR-E2E01-FORMAL-ROOT-01');
 need(runDir.startsWith(join(root,'formal-run-'))&&!runDir.slice(join(root,'formal-run-').length).includes('\\')&&!runDir.slice(join(root,'formal-run-').length).includes('/'),'FORMAL_PRIVATE_DIRECTORY_REQUIRED');
 const planPath=join(geoxRoot,'scripts/product/e2e01/adr-formal-run-input.unsigned.json'),plan=read(planPath),b=plan.business_basis,m=plan.proposed_mapping,f=plan.formal_refs;
 const adrHead=git(adr,'rev-parse','HEAD'),geoxHead=git(geoxRoot,'rev-parse','HEAD');
 need(adrHead===plan.source_predecessors.adr&&git(adr,'status','--porcelain','--untracked-files=no')===''&&git(geoxRoot,'status','--porcelain','--untracked-files=no')==='','FORMAL_SOURCE_DRIFT');
 need(execFileSync('docker',['inspect','--format','{{.Id}} {{.State.Status}}','geox-product-e2e01-postgres'],{encoding:'utf8'}).trim()===b.database_container_id+' running'&&execFileSync('docker',['inspect','--format','{{.State.Status}}','geox-v1-postgres'],{encoding:'utf8'}).trim()==='exited'&&execFileSync('docker',['port','geox-product-e2e01-postgres','5432/tcp'],{encoding:'utf8'}).trim()==='127.0.0.1:15435','FORMAL_DATABASE_IDENTITY');
 const cpPath=join(root,'iam-native-rights-v1','checkpoint.json'),cpBytes=exactFile(cpPath),frozen=JSON.parse(cpBytes);
 need(frozen.checkpointHash===plan.native_checkpoint.sha256,'FORMAL_FROZEN_CHECKPOINT');
 const displayPath=join(root,'display-admission-preparation-v1','owner-display-approval.json'),display=read(displayPath);
 need(sha(exactFile(displayPath))===plan.owner_display.file_sha256&&display.approval_ref===plan.owner_display.approval_ref&&sha(exactFile(policyPath))===plan.owner_display.manager_policy_sha256,'FORMAL_OWNER_MATERIAL_DRIFT');
 const binding=display.binding;
 need(same(binding.manager_scope,b.manager_scope)&&binding.review_id===b.intent.review_id&&same(binding.deployment_ref,f.deployment)&&same(binding.runtime_profile_ref,f.profile)&&same(binding.knowledge_release_ref,f.release)&&binding.member.crop_code==='SOYBEAN'&&binding.member.jurisdiction==='CN','FORMAL_DISPLAY_SCOPE');
 const expectedScope=buildFormalScope({plan,geoxHead,adrHead,runInputBytes:exactFile(planPath),checkpointBytes:cpBytes,display});
 const loadPermit=createFormalRunApprovalLoader({runDir,expectedFileSha256:pin,expectedScope,rightsEnd:plan.owner_display.rights_end});
 const permit=await loadPermit();need(permit,'FORMAL_RUN_APPROVAL_REQUIRED');
 const loadDisplay=createOwnerDisplayApprovalLoader({approvalPath:displayPath,expectedFileSha256:plan.owner_display.file_sha256,revocationPath:join(root,'display-admission-preparation-v1','REVOKED'),managerPolicyPath:policyPath,managerPolicySha256:plan.owner_display.manager_policy_sha256,checkpointSha256:frozen.checkpointHash,ownerSubject:display.owner_subject,binding,rightsEnd:plan.owner_display.rights_end});
 const current=async()=>{const a=await loadPermit(),d=await loadDisplay();return a&&d&&same(a,permit)?a:null;};
 need(await current(),'FORMAL_CURRENT_APPROVAL_DENIED');
 const imp=p=>import(pathToFileURL(join(adr,p)).href);
 const {restoreAuthorityRecoveryCheckpoint}=await imp('packages/recovery-operations/src/index.mjs');
 const {initializePilotRuntime,createPilotHttpServer}=await imp('deploy/adr-pilot-host/server.mjs');
 const {customerEvidenceRequestHash,boundedMemberDisplay,customerEvidenceMemberHash}=await imp('deploy/adr-pilot-host/customer-evidence.mjs');
 const {authorizeDecisionProblemCreation,recordAuthorizationDecision}=await imp('packages/authorization/src/index.mjs');
 const original=restoreAuthorityRecoveryCheckpoint(frozen);
 need(original.report.recordCount===83&&original.report.auditEventCount===91,'FORMAL_CHECKPOINT_COUNTS');
 for(const r of Object.values(f))original.ledger.resolve(coreRef(r));
 need(customerEvidenceMemberHash(boundedMemberDisplay(original.ledger,coreRef(binding.member.knowledge_ref),m.use_purpose,'SOYBEAN'))===binding.member.projection_sha256,'FORMAL_MEMBER_PROJECTION');
 const a01={principal_id:plan.services.A01.subject,type:'SERVICE_ACCOUNT',organization_id:m.target_ref.organization_id,tenant_id:m.target_ref.tenant_id,program_ids:[m.program_id]},a07=binding.principal;
 need(a07.principal_id===plan.services.A07.subject,'FORMAL_SERVICE_PRINCIPAL');
 const managerScope=b.manager_scope,s=[managerScope.tenant_id,managerScope.project_id,managerScope.group_id,managerScope.field_id];
 async function actualJournal(){
  const c=await pool.connect();try{
   await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');await c.query("SET LOCAL statement_timeout='5s'");
   const row=await loadManagerNativeReviewBasisV1(c,managerScope,b.intent.review_id,false);
   need(row.actor_id===managerScope.actor_id&&row.result.basis_sha256===b.basis_sha256&&row.result_sha256===b.result_sha256&&row.basis.boundary_sha256===b.boundary_sha256&&same(row.basis.intent,b.intent)&&row.basis.documents.length===0,'FORMAL_BUSINESS_BASIS_DRIFT');
   const p=(await c.query('SELECT polygon_geojson_json,updated_ts_ms FROM public.field_polygon_v1 WHERE tenant_id=$1 AND field_id=$2',[s[0],s[3]])).rows;
   need(p.length===1&&same(row.basis.boundary,{geometry:p[0].polygon_geojson_json,updated_ts_ms:String(p[0].updated_ts_ms)}),'FORMAL_CURRENT_BOUNDARY_DRIFT');
   const j=await readManagerNativeReviewJournalV1(c,s,b.intent.review_id,b.basis_sha256);
   await c.query('COMMIT');return j;
  }catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{c.release();}
 }
 const j=await actualJournal(),statePath=join(runDir,'adr-state.json'),snapshotDir=join(runDir,'snapshots'),started=join(runDir,'STARTED.json'),stopped=join(runDir,'STOPPED.json');
 need(!existsSync(statePath+'.tmp')&&!existsSync(join(runDir,'RUNNING.lock')),'FORMAL_UNKNOWN_PRIOR_STATE');
 const lock=join(runDir,'RUNNING.lock');
 need(!['ADR_PILOT_TOKEN_BINDINGS_JSON','ADR_PILOT_BOOTSTRAP_PACKAGE_B64','ADR_PILOT_SYNTHETIC_BOOTSTRAP'].some(k=>Object.hasOwn(process.env,k)),'FORMAL_ENV_OVERRIDE_FORBIDDEN');
 let credentials,host,native,closed=false;
 if(recovery){
  need(existsSync(started)&&existsSync(stopped)&&existsSync(statePath)&&!existsSync(join(runDir,'RECOVERY-READONLY-COMPLETE.json')),'FORMAL_RECOVERY_REQUIRES_CLEAN_STOP');
  const saved=read(statePath),stop=read(stopped);
  need(saved.metadata.mode===formalMode&&saved.metadata.runAdmissionRef===permit.approval_ref&&stop.state_file_sha256===sha(exactFile(statePath))&&stop.approval_ref===permit.approval_ref,'FORMAL_RECOVERY_STATE_PIN');
  restoreAuthorityRecoveryCheckpoint(saved.checkpoint);
  assertCompletedRecovery({frozen,restored:saved.checkpoint,journal:j,expectedMember:binding.member.knowledge_ref,coreRef});
 }else{
  need(j.events.length===0&&!existsSync(started)&&!existsSync(stopped)&&!existsSync(statePath)&&!existsSync(snapshotDir),'FORMAL_ATTEMPT_ALREADY_EXISTS');
 }
 // Commit a one-time local launch marker BEFORE any runtime credential or state write.
 save(lock,{approval_ref:permit.approval_ref,recovery,pid:process.pid});
 try{
  if(!recovery){
   save(started,{approval_ref:permit.approval_ref,scope:expectedScope});
   save(statePath,{checkpoint:frozen,metadata:{mode:formalMode,runAdmissionRef:permit.approval_ref,idempotency:{},workbenchAccess:{}}});
  }
  native=await initializePilotRuntime({statePath,snapshotDir,allowSyntheticBootstrap:false});
  need(native.ready&&native.metadata.mode===formalMode&&native.metadata.runAdmissionRef===permit.approval_ref,'FORMAL_NATIVE_RUNTIME_UNAVAILABLE');
  const secrets=await readSecretPipe();
  try{credentials=await createFormalPrivateCredentialBinding({runtime:native,expectedPermit:permit,readRunAdmission:current,clientSecrets:secrets,ca:exactFile(join(kit,'.local','secrets','fdw-idp.pem'))});}
  finally{for(const k of Object.keys(secrets??{}))secrets[k]=undefined;}
  host=createPilotHttpServer(native);host.listen(0,'127.0.0.1');await once(host,'listening');
  const origin='https://adr.e2e01.private.invalid',transport=createPrivateLoopbackTransport({port:host.address().port,logicalOrigin:origin});
  const mapping={manager_scope:managerScope,review_id:b.intent.review_id,basis_sha256:b.basis_sha256,intent:b.intent,target_binding_ref:permit.approval_ref+':target',decision_mapping_ref:permit.approval_ref+':decision',target_ref:m.target_ref,deployment_ref:f.deployment,runtime_profile_ref:f.profile,knowledge_release_ref:f.release,decision_type:m.decision_type,objective_code:m.objective_code,use_purpose:m.use_purpose,decision_horizon:m.decision_horizon,decision_deadline:m.decision_deadline,crop_action_bindings:m.crop_action_bindings};
  const runtimeAdmission={approval_ref:permit.approval_ref,valid_until_ms:Date.parse(permit.valid_until),mapping,a01,a07,runtime_authorization_ref:f.runtime_authorization};
  const review=createBoundedNativeReviewAdmissionV1({pool,authority,baseUrl:origin,transport,async readRunAdmission(){return !recovery&&await current()?runtimeAdmission:null;},async createA01Authorization({principal,request,request_sha256,approval_ref,basis_sha256}){
   need(!recovery&&await current()&&same(principal,a01)&&approval_ref===permit.approval_ref&&basis_sha256===b.basis_sha256,'FORMAL_A01_DENIED');
   const actor={principalId:a01.principal_id,type:a01.type,organizationId:a01.organization_id,tenantId:a01.tenant_id,programIds:a01.program_ids};
   const d=authorizeDecisionProblemCreation({principal:actor,roleAssignments:[native.ledger.resolve(coreRef(f.a01_role))],authorizationScope:{organizationId:actor.organizationId,tenantId:actor.tenantId,resourceType:'DECISION_PROBLEM',resourceId:request.logical_id}});
   need(d.allowed,'FORMAL_NATIVE_A01_DENIED');
   const r=recordAuthorizationDecision({ledger:native.ledger,decision:d,audit:{eventId:'e2e01-a01-'+request_sha256.slice(0,40),occurredAt:new Date().toISOString(),actor:{id:actor.principalId,type:actor.type},details:{request_sha256,approval_ref,basis_sha256}}});
   native.persist();return wireRef(r.ref);
  },async getCredential(ref){return credentials.getCredential(ref);}});
  const admission=createE2E01CustomerDisplayAdmissionV1({pool,authority,binding,baseUrl:origin,transport,nativeRequestHash:customerEvidenceRequestHash,async readOwnerApproval(){return await current()?loadDisplay():null;},async getCredential(){return credentials.getCredential('A07');}});
  native.resolveCustomerEvidenceGrant=admission.resolveGrant;
  const stop=async()=>{if(closed)return;closed=true;credentials.close();await new Promise(ok=>host.close(ok));const result=await actualJournal();const saved=read(statePath);restoreAuthorityRecoveryCheckpoint(saved.checkpoint);
   // A stopped incomplete or uncertain attempt never becomes a restartable run.
   const proof=assertCompletedRecovery({frozen,restored:saved.checkpoint,journal:result,expectedMember:binding.member.knowledge_ref,coreRef});
   if(!recovery)save(stopped,{approval_ref:permit.approval_ref,state_file_sha256:sha(exactFile(statePath)),proof});
   else save(join(runDir,'RECOVERY-READONLY-COMPLETE.json'),{approval_ref:permit.approval_ref,state_file_sha256:sha(exactFile(statePath)),proof});
   // Keep the lock on unexpected outcome; only a verified terminal stop releases it.
   const {unlinkSync}=await import('node:fs');unlinkSync(lock);
   console.log(JSON.stringify({status:'FORMAL_RUNTIME_STOPPED_RECONCILED',recovery,...proof}));
  };
  return {composition:{adrNativeReview:review,resolveAdrCustomerEvidence:admission.resolve},recovery,current,stop,stopRequested:()=>existsSync(join(runDir,recovery?'STOP_RECOVERY_REQUESTED':'STOP_REQUESTED')),validUntilMs:Date.parse(permit.valid_until)};
 }catch(e){credentials?.close();if(host)await new Promise(ok=>host.close(ok));throw e;}
}
