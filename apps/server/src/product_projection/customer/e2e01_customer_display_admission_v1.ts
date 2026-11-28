// Explicit local composition port only. Neither owner approvals nor service credentials
// originate in this module. No default provider, public issuance endpoint or A01/A07 write.
import type {Pool} from 'pg';
import type {ManagerAuthorityV1,ManagerAuthorizerV1} from '../../auth/manager_authority_v1.js';
import type {AdrPrincipalV1,AdrRefV1} from '../../domain/agronomy/adr_review_consumer_v1.js';
import {digest} from '../../domain/field/soil_csv_p2_v1.js';
import {loadManagerNativeReviewBasisV1,readManagerNativeReviewJournalV1} from '../../routes/manager_native_review_v1.js';
import {buildManagerAdrEvidenceV1,createCustomerEvidenceHttpResolverV1,type CustomerEvidenceRequestV1,type CustomerEvidenceResolverV1} from './manager_adr_evidence_v1.js';
type Obj=Record<string,unknown>;
type Scope=CustomerEvidenceRequestV1['manager_scope'];
type Member={knowledge_ref:AdrRefV1;crop_code:'CORN'|'SOYBEAN';jurisdiction:string;inspection_ref:AdrRefV1;rights_policy_ref:AdrRefV1;evaluator_principal:Obj;projection_sha256:string};
type Binding={manager_scope:Scope;review_id:string;principal:AdrPrincipalV1;deployment_ref:AdrRefV1;runtime_profile_ref:AdrRefV1;knowledge_release_ref:AdrRefV1;member:Member};
type Approval={status:'ACTIVE';permission:'ADR_A07_CUSTOMER_EVIDENCE_DISPLAY';approval_ref:string;valid_until:string;binding:Binding};
type Lease={request:CustomerEvidenceRequestV1;manager:ManagerAuthorityV1;approval:Approval;until:number};
const same=(x:unknown,y:unknown)=>digest(x)===digest(y);
const safe=(x:unknown):x is string=>typeof x==='string'&&x.length>0&&x.length<=512&&!/[\x00-\x1f\x7f]/.test(x);
const need=(v:unknown)=>{if(!v)throw Error('E2E01_DISPLAY_ADMISSION_DENIED');};
const wireToCore=(p:AdrPrincipalV1)=>({principalId:p.principal_id,type:p.type,organizationId:p.organization_id,tenantId:p.tenant_id,programIds:p.program_ids});
export function createE2E01CustomerDisplayAdmissionV1(config:{
 pool:Pool;authority:()=>ManagerAuthorizerV1;binding:Binding;
 // Trusted live owner port: validate actual approval, revocation and current policy before returning ACTIVE.
 readOwnerApproval:()=>Promise<Approval|null>;
 // Private server-only transport credential; no client/manager token exchange.
 getCredential:()=>Promise<string|null>;
 nativeRequestHash:(r:CustomerEvidenceRequestV1,p:Obj)=>string;
 baseUrl:string;transport?:typeof fetch;clock?:()=>number;
}){
 const binding=structuredClone(config.binding),core=wireToCore(binding.principal),clock=config.clock??Date.now;
 need(binding.principal.type==='SERVICE_ACCOUNT'&&binding.principal.program_ids.length===1&&binding.member.knowledge_ref.kind==='QualifiedKnowledge'&&/^sha256:[a-f0-9]{64}$/.test(binding.member.projection_sha256));
 const pending=new Map<string,Lease>();
 const key=(r:CustomerEvidenceRequestV1)=>config.nativeRequestHash(r,core);
 function current(manager:ManagerAuthorityV1,request:CustomerEvidenceRequestV1){
  config.authority().assertCurrent(manager,binding.manager_scope.field_id,'READ_CROP_REVIEW');
  const {tenant_id,project_id,group_id,field_id,actor_id,mapping_version}=manager;
  need(same({tenant_id,project_id,group_id,field_id,actor_id,mapping_version},binding.manager_scope)&&same(request.manager_scope,binding.manager_scope)&&request.review_id===binding.review_id&&same(request.deployment_ref,binding.deployment_ref)&&same(request.runtime_profile_ref,binding.runtime_profile_ref)&&same(request.knowledge_release_ref,binding.knowledge_release_ref)&&same(request.candidate_refs,[binding.member.knowledge_ref])&&request.question_crops.includes(binding.member.crop_code)&&manager.valid_until_ms>clock());
 }
 async function approval(){
  const a=await config.readOwnerApproval();
  need(a?.status==='ACTIVE'&&a.permission==='ADR_A07_CUSTOMER_EVIDENCE_DISPLAY'&&safe(a.approval_ref)&&same(a.binding,binding)&&Number.isFinite(Date.parse(a.valid_until))&&Date.parse(a.valid_until)>clock());
  return structuredClone(a!);
 }
 async function verifyJournal(manager:ManagerAuthorityV1,request:CustomerEvidenceRequestV1){
  current(manager,request);
  const c=await config.pool.connect();
  try{
   await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');await c.query("SET LOCAL statement_timeout='5s'");
   const row=await loadManagerNativeReviewBasisV1(c,manager,binding.review_id,false);
   need(row.actor_id===manager.actor_id&&row.result.basis_sha256===request.basis_sha256);
   const s=binding.manager_scope;
   const j=await readManagerNativeReviewJournalV1(c,[s.tenant_id,s.project_id,s.group_id,s.field_id],binding.review_id,row.result.basis_sha256);
   let matched=false;
   // Reconstruct from the same native receipt contract, not caller-supplied IDs.
   await buildManagerAdrEvidenceV1(j,binding.review_id,row.result.basis_sha256,row.basis.intent.crop_codes,manager,async(r,a,p)=>{matched=same(r,request)&&a===manager&&same(p,binding.principal);return null;},clock);
   need(matched);await c.query('COMMIT');
  }catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{c.release();}
  current(manager,request);
 }
 const resolve:CustomerEvidenceResolverV1=async(request,manager,principal)=>{
  let lease:Lease|undefined,hash:string|undefined;
  try{
   need(same(principal,binding.principal));current(manager,request);
   const inner=createCustomerEvidenceHttpResolverV1({baseUrl:config.baseUrl,transport:config.transport,async resolveCredential({request:r,manager:m,principal:p}){
    need(m===manager&&same(r,request)&&same(p,binding.principal));
    const a=await approval();await verifyJournal(m,r);
    const credential=await config.getCredential();need(typeof credential==='string'&&credential.length>0&&credential.length<=32768&&!/\s/.test(credential));
    need(same(await approval(),a));current(m,r);
    const until=Math.min(m.valid_until_ms,Date.parse(a.valid_until),clock()+15000);
    hash=key(r);need(until>clock()&&!pending.has(hash));
    lease={request:structuredClone(r),manager:m,approval:a,until};pending.set(hash,lease);
    return {credential:credential!,valid_until_ms:until,request_sha256:digest({request:r,principal:p,credential_ref:m.credential_ref}),principal:p};
   }});
   const value=await inner(request,manager,principal);
   current(manager,request);if(lease)need(same(await approval(),lease.approval)&&lease.until>clock());
   return value;
  }catch{return null;}finally{if(hash&&lease&&pending.get(hash)===lease)pending.delete(hash);}
 };
 async function resolveGrant({request,principal,request_sha256}:{request:CustomerEvidenceRequestV1;principal:Obj;request_sha256:string}){
  try{
   need(same(principal,core)&&request_sha256===key(request));
   const lease=pending.get(request_sha256);if(!lease)return null;
   pending.delete(request_sha256); // one use; never retry on error or unknown outcome
   need(same(request,lease.request)&&lease.until>clock());current(lease.manager,request);
   await verifyJournal(lease.manager,request);need(same(await approval(),lease.approval));current(lease.manager,request);
   const now=clock();need(lease.until>now);
   return {status:'ACTIVE',permission:'ADR_A07_CUSTOMER_EVIDENCE_DISPLAY',request_sha256,approval_ref:lease.approval.approval_ref,checked_at:new Date(now).toISOString(),valid_until:new Date(lease.until).toISOString(),members:[structuredClone(binding.member)]};
  }catch{return null;}
 }
 return Object.freeze({resolve,resolveGrant});
}
