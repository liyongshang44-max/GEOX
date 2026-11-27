// Read-only A08 product projection. No scientific calculation, raw knowledge
// payload or automatic grant. The caller must verify the append-only journal.
import {digest} from '../../domain/field/soil_csv_p2_v1.js';
import type {AdrRefV1} from '../../domain/agronomy/adr_review_consumer_v1.js';
import type {ManagerAuthorityV1} from '../../auth/manager_authority_v1.js';
type Obj=Record<string,any>;
const obj=(x:unknown):x is Obj=>!!x&&typeof x==='object'&&!Array.isArray(x);
const code=(x:unknown):x is string=>typeof x==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,255}$/.test(x);
const hash=(x:unknown)=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const ref=(x:unknown,kind:string):x is AdrRefV1=>obj(x)&&Object.keys(x).length===4&&x.kind===kind&&code(x.logical_id)&&code(x.version)&&typeof x.semantic_hash==='string'&&/^sha256:[a-f0-9]{64}$/.test(x.semantic_hash);
const transport=['DIRECTLY_APPLICABLE','APPLICABLE_WITH_GOVERNED_TRANSFORM','CALIBRATION_REQUIRED','BOUNDED_EXTRAPOLATION','UNRESOLVED','CONFLICT','NOT_RELEVANT'];
const scientific=['QUALIFIED','PROHIBITED','REVOKED','UNQUALIFIED'];
const runtime=['ALLOWED','CONDITIONAL','BLOCKED'];
const relevance=['MATERIAL','NOT_RELEVANT'];
const condition=['MATCH','MISMATCH','UNKNOWN','AMBIGUOUS','TRANSFORMABLE','INVALID'];
function need(v:unknown):asserts v{if(!v)throw Error('ADR_RESULT_PROJECTION_INTEGRITY');}
const codes=(v:unknown):string[]=>{need(Array.isArray(v)&&v.length<=1000&&v.every(code));return [...v];};
export type ScientificResultDisplayBindingV1={permission:'ADR_A08_BOUNDED_DISPLAY';request_sha256:string;approval_ref:string;checked_at:string;valid_until:string};
export type ScientificResultDisplayResolverV1=(request:{request_sha256:string;scope:{tenant_id:string;project_id:string;group_id:string;field_id:string|null;actor_id:string;mapping_version:string};review_id:string;basis_sha256:string;journal_sha256:string;assessment_refs:AdrRefV1[]},authority:ManagerAuthorityV1)=>Promise<ScientificResultDisplayBindingV1|null>;
export function projectRecordedScientificResultV1(j:{attempt:string;events:Obj[];prev:string|null},review_id:string,basis_sha256:string){
 const base={schema_version:'geox.manager-scientific-result.v1',review_id,basis_sha256,attempt_id:j.attempt,journal_sha256:j.prev,action_authority:false as const,semantics:'HISTORICAL_RECORDED_APPLICABILITY_NOT_CURRENT_RECOMMENDATION' as const};
 const last=j.events.at(-1),terminal=last?.event==='FINISHED'?last.details:null;
 if(terminal?.status!=='NATIVE_ASSESSMENTS_RECORDED')return {...base,status:terminal?.status??(last?'OUTCOME_RECONCILIATION_REQUIRED':'NOT_REQUESTED'),assessments:[],assessment_refs:[] as AdrRefV1[]};
 need(hash(j.prev)&&terminal.action_authority===false&&Array.isArray(terminal.assessment_refs)&&terminal.assessment_refs.length>0&&terminal.assessment_refs.length<=32&&terminal.assessment_refs.every((x:unknown)=>ref(x,'ApplicabilityAssessment')));
 const receipts=j.events.filter(e=>e.event==='WRITE_RECEIPT'&&e.details.operation==='createApplicabilityAssessment').map(e=>e.details.receipt);
 need(receipts.length===terminal.assessment_refs.length&&new Set(terminal.assessment_refs.map(digest)).size===receipts.length);
 const assessments=terminal.assessment_refs.map((r:AdrRefV1)=>{
  const matches=receipts.filter(x=>obj(x)&&digest(x.ref)===digest(r));need(matches.length===1);
  const x=matches[0],v=x.resource;
  need(hash(x.response_sha256)&&obj(v)&&v.contract_version==='adr.applicability-assessment.v1'&&v.authority_class==='SOURCE_TARGET_TRANSPORT_AUTHORITY'&&transport.includes(v.transport_status)&&scientific.includes(v.scientific_use_status)&&runtime.includes(v.runtime_use)&&relevance.includes(v.decision_relevance));
  need(Array.isArray(v.condition_results)&&v.condition_results.length<=1000);
  const conditions=v.condition_results.map((c:unknown)=>{need(obj(c)&&code(c.semantic_id)&&condition.includes(c.status));return {semantic_id:c.semantic_id,status:c.status};});
  // Only exact machine identifiers and status enums. Never expected/target
  // values, narrative limitations, licensed thresholds or raw receipt.
  return {assessment_ref:r,response_sha256:x.response_sha256,transport_status:v.transport_status,scientific_use_status:v.scientific_use_status,decision_relevance:v.decision_relevance,runtime_use:v.runtime_use,conditions,missing_context_semantic_ids:codes(v.missing_context_semantic_ids),required_calibration_codes:codes(v.required_calibration_codes),unsupported_constraint_codes:codes(v.unsupported_constraint_codes)};
 });
 return {...base,status:'NATIVE_ASSESSMENTS_RECORDED',assessment_refs:terminal.assessment_refs as AdrRefV1[],assessments};
}
export async function buildManagerScientificResultV1(j:{attempt:string;events:Obj[];prev:string|null},review_id:string,basis_sha256:string,a:ManagerAuthorityV1,resolve?:ScientificResultDisplayResolverV1,clock=Date.now){
 // Before rights resolution only existing lifecycle status is exposed. Even
 // machine semantic identifiers can reveal licensed scientific knowledge.
 const last=j.events.at(-1),terminal=last?.event==='FINISHED'?last.details:null;
 const status=terminal?.status??(last?'OUTCOME_RECONCILIATION_REQUIRED':'NOT_REQUESTED');
 const base={schema_version:'geox.manager-scientific-result.v1',review_id,basis_sha256,attempt_id:j.attempt,status,action_authority:false as const,semantics:'HISTORICAL_RECORDED_APPLICABILITY_NOT_CURRENT_RECOMMENDATION' as const};
 if(status!=='NATIVE_ASSESSMENTS_RECORDED')return {...base,display_status:'NO_COMPLETED_ASSESSMENTS',assessments:[]};
 if(!resolve)return {...base,display_status:'DISPLAY_PERMISSION_NOT_ESTABLISHED',assessments:[]};
 need(hash(j.prev)&&Array.isArray(terminal.assessment_refs)&&terminal.assessment_refs.length>0&&terminal.assessment_refs.length<=32&&terminal.assessment_refs.every((x:unknown)=>ref(x,'ApplicabilityAssessment')));
 const req={scope:{tenant_id:a.tenant_id,project_id:a.project_id,group_id:a.group_id,field_id:a.field_id,actor_id:a.actor_id,mapping_version:a.mapping_version},review_id,basis_sha256,journal_sha256:j.prev!,assessment_refs:terminal.assessment_refs as AdrRefV1[]};
 const request_sha256=digest(req);
 const g=await resolve(structuredClone({...req,request_sha256}),a);
 const now=clock(),checked=Date.parse(g?.checked_at??''),until=Date.parse(g?.valid_until??'');
 if(!g||g.permission!=='ADR_A08_BOUNDED_DISPLAY'||g.request_sha256!==request_sha256||!code(g.approval_ref)||!Number.isFinite(checked)||!Number.isFinite(until)||checked>now||now-checked>60000||until<=now||until>checked+60000||a.valid_until_ms<=now)return {...base,display_status:'DISPLAY_PERMISSION_NOT_ESTABLISHED',assessments:[]};
 const result=projectRecordedScientificResultV1(j,review_id,basis_sha256);
 return {...result,display_status:'AUTHORIZED_RECORDED_RESULT',approval_ref:g.approval_ref};
}
