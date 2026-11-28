// Bounded A01/A07 provider for the no-soil E2E01 review. A caller supplies an
// independently admitted run and explicit target/decision mapping, never a request-created grant.
import type {Pool} from 'pg';
import type {ManagerAuthorityV1,ManagerAuthorizerV1} from '../../auth/manager_authority_v1.js';
import {digest} from '../field/soil_csv_p2_v1.js';
import {loadManagerNativeReviewBasisV1,readManagerNativeReviewJournalV1} from '../../routes/manager_native_review_v1.js';
import {prepareNativeReviewPlanV1,type NativeReviewPlanRequestV1} from './adr_native_review_workflow_v1.js';
import type {AdrPrincipalV1,AdrRefV1,AdrWriteInputV1,AdrReviewOperationV1,AdrReviewBindingV1} from './adr_review_consumer_v1.js';
import type {ManagerNativeReviewConfigV1} from '../../routes/manager_native_review_v1.js';
type Obj=Record<string,any>;
type Scope={tenant_id:string;project_id:string;group_id:string;field_id:string;actor_id:string;mapping_version:string};
type Mapping={manager_scope:Scope;review_id:string;basis_sha256:string;intent:Obj;target_binding_ref:string;decision_mapping_ref:string;target_ref:Obj;deployment_ref:AdrRefV1;runtime_profile_ref:AdrRefV1;knowledge_release_ref:AdrRefV1;decision_type:string;objective_code:string;use_purpose:string;decision_horizon:{duration:string};decision_deadline:string;crop_action_bindings:{crop_code:string;action_code:string}[]};
type Admission={approval_ref:string;valid_until_ms:number;mapping:Mapping;a01:AdrPrincipalV1;a07:AdrPrincipalV1;runtime_authorization_ref:AdrRefV1};
const same=(a:unknown,b:unknown)=>digest(a)===digest(b);
const requireThat=(x:unknown)=>{if(!x)throw Error('E2E01_NATIVE_REVIEW_ADMISSION_DENIED');};
const scopeOf=(a:ManagerAuthorityV1)=>({tenant_id:a.tenant_id,project_id:a.project_id,group_id:a.group_id,field_id:a.field_id,actor_id:a.actor_id,mapping_version:a.mapping_version});
const wireRef=(x:unknown,kind:string):x is AdrRefV1=>!!x&&typeof x==='object'&&Object.keys(x).length===4&&(x as AdrRefV1).kind===kind&&typeof (x as AdrRefV1).logical_id==='string'&&typeof (x as AdrRefV1).version==='string'&&/^sha256:[a-f0-9]{64}$/.test((x as AdrRefV1).semantic_hash);
export function createBoundedNativeReviewAdmissionV1(config:{
 pool:Pool;authority:()=>ManagerAuthorizerV1;readRunAdmission:()=>Promise<Admission|null>;
 createA01Authorization:(input:{principal:AdrPrincipalV1;request:AdrWriteInputV1;request_sha256:string;approval_ref:string;basis_sha256:string})=>Promise<AdrRefV1>;
 getCredential:(ref:string)=>Promise<string>;baseUrl:string;transport:typeof fetch;
}):ManagerNativeReviewConfigV1{
 const used=new Set<string>();
 const current=(a:ManagerAuthorityV1,r:Admission)=>{
  config.authority().assertCurrent(a,r.mapping.manager_scope.field_id,'REQUEST_CROP_REVIEW');
  requireThat(same(scopeOf(a),r.mapping.manager_scope)&&Number.isFinite(r.valid_until_ms)&&r.valid_until_ms>Date.now()&&typeof r.approval_ref==='string'&&r.approval_ref.length>0);
  requireThat(r.a01.type==='SERVICE_ACCOUNT'&&r.a07.type==='SERVICE_ACCOUNT'&&r.a01.principal_id!==r.a07.principal_id&&r.a01.organization_id===r.mapping.target_ref.organization_id&&r.a07.organization_id===r.a01.organization_id&&r.a01.tenant_id===a.tenant_id&&r.a07.tenant_id===a.tenant_id&&r.a01.program_ids.length===1&&same(r.a01.program_ids,r.a07.program_ids)&&wireRef(r.runtime_authorization_ref,'AuthorizationDecisionAudit'));
 };
 const admission=async(a:ManagerAuthorityV1)=>{const r=await config.readRunAdmission();requireThat(r);current(a,r!);return structuredClone(r!);};
 const recheck=async(a:ManagerAuthorityV1,r:Admission)=>requireThat(same(await admission(a),r));
 const rawPlan=(r:Admission)=>{const m=r.mapping;return {basis_sha256:m.basis_sha256,target_binding_ref:m.target_binding_ref,decision_mapping_ref:m.decision_mapping_ref,target_ref:m.target_ref,deployment_ref:m.deployment_ref,runtime_profile_ref:m.runtime_profile_ref,knowledge_release_ref:m.knowledge_release_ref,decision_type:m.decision_type,objective_code:m.objective_code,use_purpose:m.use_purpose,use_class:'ADVISORY',decision_authority_mode:'RUNTIME_ONLY',decision_horizon:m.decision_horizon,decision_deadline:m.decision_deadline,crop_action_bindings:m.crop_action_bindings,datum_bindings:[]};};
 async function readState(a:ManagerAuthorityV1,r:Admission){
  const m=r.mapping,s=m.manager_scope,c=await config.pool.connect();
  try{
   await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');await c.query("SET LOCAL statement_timeout='5s'");
   const row=await loadManagerNativeReviewBasisV1(c,a,m.review_id,false);
   requireThat(row.actor_id===a.actor_id&&row.result.basis_sha256===m.basis_sha256&&same(row.basis.intent,m.intent)&&Array.isArray(row.basis.documents)&&row.basis.documents.length===0);
   const j=await readManagerNativeReviewJournalV1(c,[s.tenant_id,s.project_id,s.group_id,s.field_id],m.review_id,m.basis_sha256);
   requireThat(j.events.every(e=>e.actor_id===a.actor_id));
   const {credential_ref:_credential,...audit}=row.basis.audit;
   await c.query('COMMIT');return {j,basis:{...row.basis,audit}};
  }catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{c.release();}
 }
 return {async resolvePlan(req:NativeReviewPlanRequestV1,a){
  const r=await admission(a),{j,basis}=await readState(a,r);
  requireThat(j.events.length===0&&req.attempt_id===j.attempt&&req.basis_sha256===r.mapping.basis_sha256&&same(req.basis,basis));
  const raw=rawPlan(r);prepareNativeReviewPlanV1(req,raw);await recheck(a,r);return raw;
 },consumer:{baseUrl:config.baseUrl,transport:config.transport,getCredential:config.getCredential,async resolveBinding({manager:a,operation,request,request_sha256}):Promise<AdrReviewBindingV1|null>{
  try{
   requireThat(operation==='createDecisionProblem'||operation==='executeKnowledgeRetrieval');
   const r=await admission(a),{j,basis}=await readState(a,r),m=r.mapping;
   const started=j.events[0],last=j.events.at(-1),plan=started?.details.plan;
   requireThat(started?.event==='STARTED'&&last?.event==='WRITE_INTENT'&&last.details.operation===operation&&same(last.details.request,request)&&last.details.request_sha256===request_sha256&&request_sha256===digest({operation,request})&&started.details.plan_sha256===digest(plan));
   const expected=prepareNativeReviewPlanV1({basis_sha256:m.basis_sha256,basis,attempt_id:j.attempt,evaluation_time:plan.evaluation_time},rawPlan(r));
   requireThat(same(plan,expected)&&plan.datums.length===0);
   const isA01=operation==='createDecisionProblem';
   if(isA01){requireThat(j.events.length===2&&same(request,plan.problem));}
   else{
    const prior=j.events[2]?.details.receipt;
    requireThat(j.events.length===4&&j.events[1].details.operation==='createDecisionProblem'&&same(j.events[1].details.request,plan.problem)&&j.events[2].event==='WRITE_RECEIPT'&&j.events[2].details.operation==='createDecisionProblem'&&wireRef(prior?.ref,'DecisionProblem')&&prior.ref.logical_id===plan.problem.logical_id&&same(prior.principal,r.a01)&&prior.request_sha256===digest({operation:'createDecisionProblem',request:plan.problem}));
    requireThat(same(request,{logical_id:j.attempt+':retrieval',version:'1',idempotency_key:j.attempt+':retrieval:1',resource:{contract_version:'adr.knowledge-retrieval-result.v1',decision_problem_ref:prior.ref,deployment_ref:m.deployment_ref,config:{}}}));
   }
   await recheck(a,r);
   // One authorization issuance per operation for this exact durable attempt.
   const key=j.attempt+':'+operation;requireThat(!used.has(key));used.add(key);
   const principal=isA01?r.a01:r.a07;
   const authorization_ref=isA01?await config.createA01Authorization({principal,request,request_sha256,approval_ref:r.approval_ref,basis_sha256:m.basis_sha256}):r.runtime_authorization_ref;
   requireThat(wireRef(authorization_ref,'AuthorizationDecisionAudit'));await recheck(a,r);
   return {request_sha256,authority_scope:{...scopeOf(a),field_id:a.field_id!,credential_ref:a.credential_ref},principal,authorization_ref,credential_ref:isA01?'A01':'A07',valid_until_ms:Math.min(a.valid_until_ms,r.valid_until_ms)};
  }catch{return null;}
 }}};
}
