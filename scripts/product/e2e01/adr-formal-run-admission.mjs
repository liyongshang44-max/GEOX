// Narrow E2E01 local approval reader. This does not mint an approval or accept
// a conditional display approval as run authority. Exact file pin is supplied
// by the authorized operator outside the application.
import {readFileSync,lstatSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {canonical,sha} from './adr-private-admission.mjs';
const need=(x,c='FORMAL_RUN_ADMISSION_DENIED')=>{if(!x)throw Error(c);};
const same=(a,b)=>canonical(a)===canonical(b);
const hash=x=>typeof x==='string'&&/^sha256:[a-f0-9]{64}$/.test(x);
const keys=(x,k)=>x&&typeof x==='object'&&!Array.isArray(x)&&same(Object.keys(x).sort(),[...k].sort());
export function exactFile(path,max=32*1024*1024){
 const s=lstatSync(path);need(s.isFile()&&!s.isSymbolicLink()&&s.size>0&&s.size<=max,'FORMAL_FILE_IDENTITY');
 return readFileSync(path);
}
function absent(path){try{lstatSync(path);return false;}catch(e){if(e.code==='ENOENT')return true;throw e;}}
// Use the same exact scope construction at approval creation and runtime.
export function buildFormalScope({plan,geoxHead,adrHead,runInputBytes,checkpointBytes,display}){
 const b=plan.business_basis;
 return {geox_subject:geoxHead,adr_subject:adrHead,run_input_sha256:sha(runInputBytes),checkpoint_sha256:plan.native_checkpoint.sha256,checkpoint_file_sha256:sha(checkpointBytes),owner_display_file_sha256:plan.owner_display.file_sha256,owner_display_approval_ref:display.approval_ref,manager_policy_sha256:plan.owner_display.manager_policy_sha256,basis_sha256:b.basis_sha256,boundary_sha256:b.boundary_sha256,result_sha256:b.result_sha256,deployment_ref:plan.formal_refs.deployment,allowed_operations:{A01:plan.services.A01.operations,A07:plan.services.A07.operations},manager_scope:b.manager_scope,review_id:b.intent.review_id,viewer_jurisdiction:'CN',mapping:plan.proposed_mapping,allow_readonly_recovery:true,production_authorized:false,action_authority:false};
}
export function createFormalRunApprovalLoader({runDir,expectedFileSha256,expectedScope,rightsEnd,clock=Date.now}){
 need(resolve(runDir)===runDir&&hash(expectedFileSha256)&&hash(expectedScope.checkpoint_file_sha256)&&hash(expectedScope.run_input_sha256)&&hash(expectedScope.owner_display_file_sha256)&&hash(expectedScope.manager_policy_sha256));
 const fixed=structuredClone(expectedScope),p=join(runDir,'run-approval.json'),revocation=join(runDir,'REVOKED');
 return async()=>{
  try{
   const d=lstatSync(runDir);need(d.isDirectory()&&!d.isSymbolicLink()&&absent(revocation));
   const bytes=exactFile(p,262144);need(sha(bytes)===expectedFileSha256);
   const a=JSON.parse(bytes),{approval_ref,...basis}=a;
   need(keys(a,['schema','decision','status','scope','owner_subject','owner_authentication_sha256','cto_run_authorization_ref','confirmed_at','valid_until','approval_ref'])&&a.schema==='geox.e2e01.formal-run-approval.v1'&&a.status==='ACTIVE'&&a.decision==='AUTHORIZE_E2E01_FORMAL_LOCAL_RUN'&&a.owner_subject==='f55ef0cd-aa5d-4c81-8d75-d5c131a7d7cf'&&hash(a.owner_authentication_sha256)&&hash(a.cto_run_authorization_ref)&&same(a.scope,fixed)&&approval_ref===sha(canonical(basis)));
   const auth=JSON.parse(exactFile(join(runDir,'owner-authentication.json'),262144)),cto=exactFile(join(runDir,'cto-run-authorization.txt'),262144);
   need(sha(cto)===a.cto_run_authorization_ref&&auth.approval_sha256===a.owner_authentication_sha256&&auth.approval_sha256===sha(canonical(auth.basis))&&auth.confirmation==='AUTHORIZE-E2E01-FORMAL-LOCAL-RUN-ONCE'&&auth.credential_values_retained===false&&auth.confirmed_at===a.confirmed_at&&auth.basis.subject===a.owner_subject&&auth.basis.issuer==='https://auth.fdw.localhost:18443/realms/fdw-local'&&auth.basis.client==='geox-adr-owner-local-v1'&&same(auth.basis.scope,fixed)&&auth.basis.cto_run_authorization_ref===a.cto_run_authorization_ref&&auth.basis.valid_until===a.valid_until&&auth.basis.phase==='FORMAL_LOCAL_RUN_ONCE');
   const n=clock(),from=Date.parse(a.confirmed_at),end=Date.parse(a.valid_until);
   need(Number.isFinite(from)&&Number.isFinite(end)&&from<=n&&n<end&&end<=Date.parse(rightsEnd)&&end-from<=3600000&&new Date(from).toISOString()===a.confirmed_at&&new Date(end).toISOString()===a.valid_until);
   return Object.freeze({status:'ACTIVE',decision:a.decision,approval_ref,checkpoint_sha256:fixed.checkpoint_sha256,valid_until:a.valid_until,manager_execution_authorized:true,pilot_authorized:true,service_clients_enabled_authorized:true,viewer_jurisdiction:'CN'});
  }catch{return null;}
 };
}
// No automatic rewind, fallback to .prev, or second write attempt.
export function assertCompletedRecovery({frozen,restored,journal,expectedMember,coreRef}){
 const before=frozen.snapshot,after=restored.snapshot;
 for(const k of ['records','audit','lineage']){
  need(Array.isArray(before[k])&&Array.isArray(after[k])&&before[k].every(x=>after[k].some(y=>same(x,y))), 'FORMAL_RECOVERY_HISTORY_CHANGED');
 }
 const extra=after.records.filter(x=>!before.records.some(y=>same(x.ref,y.ref)));
 const e=journal.events;
 need(e.length===6&&same(e.map(x=>x.event),['STARTED','WRITE_INTENT','WRITE_RECEIPT','WRITE_INTENT','WRITE_RECEIPT','FINISHED'])&&e[1].details.operation==='createDecisionProblem'&&e[2].details.operation==='createDecisionProblem'&&e[3].details.operation==='executeKnowledgeRetrieval'&&e[4].details.operation==='executeKnowledgeRetrieval'&&e[5].details.status==='NATIVE_RETRIEVAL_RECORDED_CONTEXT_REQUIRED'&&e[5].details.action_authority===false&&e[5].details.assessment_refs.length===0,'FORMAL_RECOVERY_OUTCOME_UNKNOWN');
 const a01=e[2].details.receipt,a07=e[4].details.receipt;
 need(same(a07.resource.candidate_refs,[expectedMember])&&same(e[5].details.retrieval_ref,a07.ref)&&same(a07.resource.decision_problem_ref,a01.ref),'FORMAL_RECOVERY_RECEIPT_MISMATCH');
 const refs=[coreRef(a01.authorization_ref),coreRef(a01.ref),coreRef(a07.ref)];
 need(extra.length===3&&refs.every(r=>extra.some(x=>same(x.ref,r)))&&after.audit.length===before.audit.length+3,'FORMAL_RECOVERY_DELTA_MISMATCH');
 return {record_count:after.records.length,audit_count:after.audit.length,retrieval_ref:a07.ref,journal_sha256:journal.prev};
}
