// Bounded A07 read projection. Trusted resolver invokes native ADR; no local knowledge store.
import {digest} from '../../domain/field/soil_csv_p2_v1.js';
import type {AdrRefV1,AdrPrincipalV1} from '../../domain/agronomy/adr_review_consumer_v1.js';
import type {ManagerAuthorityV1} from '../../auth/manager_authority_v1.js';
type Obj=Record<string,any>;
const obj=(v:unknown):v is Obj=>!!v&&typeof v==='object'&&!Array.isArray(v);
const txt=(v:unknown,n=512):v is string=>typeof v==='string'&&v.length>0&&v.length<=n&&!/[\x00-\x1f\x7f]/.test(v);
const exact=(v:unknown,k:string[]):v is Obj=>obj(v)&&Object.keys(v).length===k.length&&k.every(x=>Object.hasOwn(v,x));
const hex=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const hash=(v:unknown):v is string=>typeof v==='string'&&/^sha256:[a-f0-9]{64}$/.test(v);
const ref=(v:unknown,kind:string):v is AdrRefV1=>exact(v,['kind','logical_id','version','semantic_hash'])&&v.kind===kind&&txt(v.logical_id)&&txt(v.version)&&hash(v.semantic_hash);
function need(v:unknown):asserts v{if(!v)throw Error('ADR_A07_EVIDENCE_INTEGRITY');}
const same=(a:unknown,b:unknown)=>digest(a)===digest(b);
export type CustomerEvidenceRequestV1={retrieval_ref:AdrRefV1;decision_problem_ref:AdrRefV1;deployment_ref:AdrRefV1;runtime_profile_ref:AdrRefV1;knowledge_release_ref:AdrRefV1;candidate_refs:AdrRefV1[];manager_scope:{tenant_id:string;project_id:string;group_id:string;field_id:string;actor_id:string;mapping_version:string};question_crops:string[];basis_sha256:string;journal_sha256:string;review_id:string};
export type CustomerEvidenceResolverV1=(request:CustomerEvidenceRequestV1,authority:ManagerAuthorityV1,principal:AdrPrincipalV1)=>Promise<unknown>;
export function createCustomerEvidenceHttpResolverV1(config:{baseUrl:string;resolveCredential:(input:{request:CustomerEvidenceRequestV1;manager:ManagerAuthorityV1;principal:AdrPrincipalV1})=>Promise<{credential:string;valid_until_ms:number;request_sha256:string;principal:AdrPrincipalV1}|null>;transport?:typeof fetch}):CustomerEvidenceResolverV1{
 const origin=new URL(config.baseUrl);need(origin.protocol==='https:'&&!origin.username&&!origin.password&&origin.pathname==='/'&&!origin.search&&!origin.hash);
 return async(request,manager,principal)=>{
  const d=digest({request,principal,credential_ref:manager.credential_ref});
  const b=await config.resolveCredential({request:structuredClone(request),manager,principal:structuredClone(principal)});
  const current=()=>!!b&&b.request_sha256===d&&same(b.principal,principal)&&Number.isFinite(b.valid_until_ms)&&b.valid_until_ms>Date.now()&&b.valid_until_ms<=manager.valid_until_ms;
  if(!current()||!b||!txt(b.credential,32768)||/\s/.test(b.credential))return null;
  const response=await (config.transport??fetch)(new URL('/v1/customer-evidence/resolve',origin),{method:'POST',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(5000),headers:{authorization:'Bearer '+b.credential,'content-type':'application/json'},body:JSON.stringify(request)});
  if(!response.ok||!current())return null;
  const raw=await response.text();need(raw.length<=500000);return current()?JSON.parse(raw):null;
 };
}
export async function buildManagerAdrEvidenceV1(j:{attempt:string;events:Obj[];prev:string|null},review_id:string,basis_sha256:string,question_crops:string[],a:ManagerAuthorityV1,resolve?:CustomerEvidenceResolverV1,clock=Date.now){
 const base={schema_version:'geox.manager-adr-evidence.v1',review_id,basis_sha256,attempt_id:j.attempt,authority_class:'RETRIEVAL_EVIDENCE_NON_SCIENTIFIC',action_authority:false as const,applicability_authority:false as const};
 const unavailable=(status:string)=>({...base,display_status:status,items:[],coverage_crops:[],missing_crops:[],question_crops});
 const last=j.events.at(-1),terminal=last?.event==='FINISHED'?last.details:null;
 if(!terminal||!['NATIVE_RETRIEVAL_RECORDED_CONTEXT_REQUIRED','NO_RETRIEVED_KNOWLEDGE','NATIVE_ASSESSMENTS_RECORDED'].includes(terminal.status))return unavailable('NO_COMPLETED_RETRIEVAL');
 if(terminal.status==='NO_RETRIEVED_KNOWLEDGE')return unavailable('NO_RETRIEVED_KNOWLEDGE');
 if(!resolve)return unavailable('DISPLAY_PERMISSION_NOT_ESTABLISHED');
 const writes=j.events.filter(e=>e.event==='WRITE_RECEIPT'&&e.details.operation==='executeKnowledgeRetrieval'),problems=j.events.filter(e=>e.event==='WRITE_RECEIPT'&&e.details.operation==='createDecisionProblem');
 need(writes.length===1&&problems.length===1&&hex(j.prev)&&hex(basis_sha256)&&a.field_id&&Array.isArray(question_crops)&&question_crops.length===2&&new Set(question_crops).size===2&&question_crops.every(c=>['CORN','SOYBEAN'].includes(c)));
 const x=writes[0].details.receipt,p=problems[0].details.receipt,v=x.resource;
 need(hex(x.response_sha256)&&ref(x.ref,'KnowledgeRetrievalResult')&&ref(p.ref,'DecisionProblem')&&obj(v)&&v.authority_class==='RETRIEVAL_EVIDENCE_NON_SCIENTIFIC'&&same(v.decision_problem_ref,p.ref)&&ref(v.deployment_ref,'Deployment')&&ref(v.runtime_profile_ref,'RuntimeProfile')&&ref(v.knowledge_release_ref,'KnowledgeRelease')&&Array.isArray(v.candidate_refs)&&v.candidate_refs.length>0&&v.candidate_refs.length<=32&&v.candidate_refs.every((r:unknown)=>ref(r,'QualifiedKnowledge')||ref(r,'DerivedKnowledge'))&&new Set(v.candidate_refs.map(digest)).size===v.candidate_refs.length&&obj(x.principal));
 const req:CustomerEvidenceRequestV1={retrieval_ref:x.ref,decision_problem_ref:p.ref,deployment_ref:v.deployment_ref,runtime_profile_ref:v.runtime_profile_ref,knowledge_release_ref:v.knowledge_release_ref,candidate_refs:v.candidate_refs,manager_scope:{tenant_id:a.tenant_id,project_id:a.project_id,group_id:a.group_id,field_id:a.field_id,actor_id:a.actor_id,mapping_version:a.mapping_version},question_crops,basis_sha256,journal_sha256:j.prev,review_id};
 const raw=await resolve(structuredClone(req),a,structuredClone(x.principal));
 if(raw===null||raw===undefined)return unavailable('DISPLAY_PERMISSION_NOT_ESTABLISHED');
 need(exact(raw,['contract_version','authority_class','display_status','approval_ref','valid_until','request','items','coverage_crops','action_authority','applicability_authority'])&&raw.contract_version==='geox.adr-a07-customer-evidence.v1'&&raw.authority_class===base.authority_class&&raw.display_status==='AUTHORIZED_RECORDED_EVIDENCE'&&raw.action_authority===false&&raw.applicability_authority===false&&same(raw.request,req)&&txt(raw.approval_ref));
 const now=clock(),until=Date.parse(raw.valid_until);
 if(!Number.isFinite(until)||until<=now||until>now+60000||a.valid_until_ms<=now)return unavailable('DISPLAY_PERMISSION_NOT_ESTABLISHED');
 need(Array.isArray(raw.items)&&raw.items.length===req.candidate_refs.length);
 const strings=(v:unknown)=>{need(Array.isArray(v)&&v.length<=64&&v.every(x=>txt(x,1000)));return [...v] as string[];};
 const items=raw.items.map((i:unknown)=>{
  need(exact(i,['knowledge_ref','source_ref','artifact_ref','claim_ref','qualification_ref','artifact_sha256','crop_code','source_title','publication','summary','allowed_use','limitations','conditions','inspection_ref','rights_policy_ref','rights_grant_refs','rights_checked_at'])&&ref(i.knowledge_ref,'QualifiedKnowledge')&&req.candidate_refs.some(r=>same(r,i.knowledge_ref))&&ref(i.source_ref,'Source')&&ref(i.artifact_ref,'SourceArtifact')&&ref(i.claim_ref,'Claim')&&ref(i.qualification_ref,'ScientificQualificationDecision')&&hash(i.artifact_sha256)&&question_crops.includes(i.crop_code)&&txt(i.source_title,500)&&txt(i.summary,1200)&&i.allowed_use===v.query_semantics?.use_purpose&&txt(i.allowed_use)&&ref(i.inspection_ref,'AuthorizationDecisionAudit')&&ref(i.rights_policy_ref,'RightsPolicy')&&Array.isArray(i.rights_grant_refs)&&i.rights_grant_refs.length>0&&i.rights_grant_refs.length<=32&&i.rights_grant_refs.every((r:unknown)=>ref(r,'RightsGrant'))&&Number.isFinite(Date.parse(i.rights_checked_at))&&Date.parse(i.rights_checked_at)<=now&&now-Date.parse(i.rights_checked_at)<=60000);
  need(obj(i.publication)&&Object.keys(i.publication).every(k=>['doi','journal','citation','publisher','year','authors'].includes(k)&&txt(i.publication[k],700)));
  return {knowledge_ref:i.knowledge_ref,source_ref:i.source_ref,artifact_ref:i.artifact_ref,claim_ref:i.claim_ref,qualification_ref:i.qualification_ref,artifact_sha256:i.artifact_sha256,crop_code:i.crop_code as string,source_title:i.source_title,publication:i.publication as Record<string,string>,summary:i.summary,allowed_use:i.allowed_use,limitations:strings(i.limitations),conditions:strings(i.conditions),inspection_ref:i.inspection_ref,rights_policy_ref:i.rights_policy_ref,rights_grant_refs:i.rights_grant_refs,rights_checked_at:i.rights_checked_at};
 });
 need(new Set(items.map(i=>digest(i.knowledge_ref))).size===req.candidate_refs.length);
 const coverage_crops=[...new Set(items.map(i=>i.crop_code))].sort();need(same(raw.coverage_crops,coverage_crops));
 return {...base,display_status:'AUTHORIZED_RECORDED_EVIDENCE',approval_ref:raw.approval_ref,valid_until:raw.valid_until,retrieval_ref:req.retrieval_ref,knowledge_release_ref:req.knowledge_release_ref,items,question_crops,coverage_crops,missing_crops:question_crops.filter(c=>!coverage_crops.includes(c))};
}
