// P6-C3/P3P: product orchestration of the exact native ADR P02 chain.
// No local scientific evaluator, role issuer, deployment creator or result promotion.
import type {ManagerAuthorityV1} from '../../auth/manager_authority_v1.js';
import {digest} from '../field/soil_csv_p2_v1.js';
import {createAdrReviewConsumerV1,AdrReviewConsumerErrorV1,type AdrRefV1,type AdrWriteReceiptV1,type AdrReviewOperationV1,type AdrWriteInputV1,type AdrWriteRequirementsV1} from './adr_review_consumer_v1.js';
type Obj=Record<string,any>;
const object=(x:unknown):x is Obj=>!!x&&typeof x==='object'&&!Array.isArray(x);
const text=(x:unknown):x is string=>typeof x==='string'&&x.length>0&&x.length<=512&&x.trim()===x&&!/[\x00-\x1f\x7f]/.test(x);
const hash=(x:unknown)=>typeof x==='string'&&/^sha256:[a-f0-9]{64}$/.test(x);
const exact=(o:unknown,k:string[])=>object(o)&&Object.keys(o).length===k.length&&k.every(x=>Object.hasOwn(o,x));
const ref=(x:unknown,kind?:string):x is AdrRefV1=>exact(x,['kind','logical_id','version','semantic_hash'])&&object(x)&&text(x.kind)&&(!kind||x.kind===kind)&&text(x.logical_id)&&text(x.version)&&hash(x.semantic_hash);
const same=(a:unknown,b:unknown)=>digest(a)===digest(b);
function insist(x:unknown,code:string):asserts x{if(!x)throw new AdrReviewConsumerErrorV1(code);}
const instant=(v:unknown):v is string=>typeof v==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?(?:Z|[+-]\d\d:\d\d)$/.test(v)&&Number.isFinite(Date.parse(v));
const canonicalInstant=(v:string)=>new Date(v).toISOString();
const targetKeys=['organization_id','tenant_id','farm_id','field_id','season_id','zone_id'];
export type NativeReviewPlanRequestV1={basis_sha256:string;basis:Obj;attempt_id:string;evaluation_time:string};
export type NativeReviewPlanResolverV1=(request:NativeReviewPlanRequestV1,manager:ManagerAuthorityV1)=>Promise<unknown>;
export type NativeReviewConsumerV1=ReturnType<typeof createAdrReviewConsumerV1>;
export type NativeReviewEventTypeV1='STARTED'|'WRITE_INTENT'|'WRITE_RECEIPT'|'FINISHED';
export type NativeReviewAppendV1=(event:NativeReviewEventTypeV1,details:Obj)=>Promise<void>;
export type NativeReviewPlanV1={
 target:Obj;target_binding_ref:string;decision_mapping_ref:string;deployment_ref:AdrRefV1;knowledge_release_ref:AdrRefV1;
 problem:AdrWriteInputV1;datums:AdrWriteInputV1[];mapping_refs:string[];evaluation_time:string;attempt_id:string;basis_sha256:string;
};
function input(attempt:string,suffix:string,resource:AdrWriteInputV1['resource']):AdrWriteInputV1{
 const logical_id=attempt+':'+suffix;
 return {logical_id,version:'1',idempotency_key:logical_id+':1',resource};
}
function dayInterval(row:Obj,m:Obj,cutoff:string){
 // A CSV sample date is not an observation instant. Require explicit governed
 // day/offset mapping; no default timezone, midnight point, or current-time substitution.
 insist(typeof row.sampled_on==='string'&&instant(m.sample_day_start)&&instant(m.sample_day_end),'ADR_SOURCE_DAY_MAPPING_REQUIRED');
 const patternStart=/^(\d{4}-\d\d-\d\d)T00:00:00(?:\.000)?(Z|[+-]\d\d:\d\d)$/;
 const patternEnd=/^(\d{4}-\d\d-\d\d)T23:59:59\.999(Z|[+-]\d\d:\d\d)$/;
 const a=patternStart.exec(m.sample_day_start),b=patternEnd.exec(m.sample_day_end);
 insist(a&&b&&a[1]===row.sampled_on&&b[1]===row.sampled_on&&a[2]===b[2]&&Date.parse(m.sample_day_end)-Date.parse(m.sample_day_start)===86399999&&Date.parse(m.sample_day_end)<=Date.parse(cutoff),'ADR_SOURCE_DAY_MAPPING_INVALID');
 return {start:canonicalInstant(m.sample_day_start),end:canonicalInstant(m.sample_day_end)};
}
function decimal(n:number):string{
 insist(typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<=1000000,'ADR_SOURCE_DECIMAL_INVALID');
 // P2 parser accepts at most 8 decimal places, and source depth conversion
 // is exactly cm -> mm, not a scientific or spatial extrapolation.
 return n.toFixed(8).replace(/\.?0+$/,'')||'0';
}
export function prepareNativeReviewPlanV1(req:NativeReviewPlanRequestV1,raw:unknown):NativeReviewPlanV1{
 insist(object(raw),'ADR_FORMAL_PLAN_REQUIRED');const p=structuredClone(raw);
 insist(exact(p,['basis_sha256','target_binding_ref','decision_mapping_ref','target_ref','deployment_ref','knowledge_release_ref','decision_type','objective_code','use_purpose','use_class','decision_authority_mode','decision_horizon','decision_deadline','crop_action_bindings','datum_bindings'])&&p.basis_sha256===req.basis_sha256&&text(p.target_binding_ref)&&text(p.decision_mapping_ref),'ADR_FORMAL_PLAN_BASIS_MISMATCH');
 const t=p.target_ref;
 insist(object(t)&&Object.keys(t).every(k=>targetKeys.includes(k))&&Object.values(t).every(text)&&text(t.organization_id)&&text(t.tenant_id)&&text(t.field_id),'ADR_TARGET_CORRESPONDENCE_REQUIRED');
 insist(ref(p.deployment_ref,'Deployment')&&ref(p.knowledge_release_ref,'KnowledgeRelease'),'ADR_RELEASE_DEPLOYMENT_REQUIRED');
 insist([p.decision_type,p.objective_code,p.use_purpose,p.use_class].every(text)&&['ADR_POLICY','EXTERNAL_POLICY','RUNTIME_ONLY'].includes(p.decision_authority_mode)&&exact(p.decision_horizon,['duration'])&&text(p.decision_horizon.duration)&&instant(p.decision_deadline)&&Date.parse(p.decision_deadline)>=Date.parse(req.evaluation_time),'ADR_DECISION_MAPPING_INVALID');
 const intent=req.basis.intent;
 insist(object(intent)&&Array.isArray(intent.crop_codes)&&Array.isArray(p.crop_action_bindings)&&p.crop_action_bindings.length===intent.crop_codes.length,'ADR_CROP_ACTION_MAPPING_REQUIRED');
 const cropMap=p.crop_action_bindings;
 insist(cropMap.every((m:unknown)=>exact(m,['crop_code','action_code'])&&object(m)&&text(m.crop_code)&&text(m.action_code))&&same(cropMap.map((m:Obj)=>m.crop_code).sort(),[...intent.crop_codes].sort())&&new Set(cropMap.map((m:Obj)=>m.action_code)).size===cropMap.length,'ADR_CROP_ACTION_MAPPING_INVALID');
 insist(Array.isArray(req.basis.documents)&&Array.isArray(p.datum_bindings),'ADR_SOURCE_MAPPING_REQUIRED');
 const rows=new Map<string,{d:Obj;row:Obj}>();
 for(const d of req.basis.documents){
  insist(object(d)&&text(d.document_id)&&Number.isSafeInteger(d.revision)&&text(d.confirmation_fact_id)&&Array.isArray(d.candidates)&&d.epistemic_class==='ASSERTION'&&d.scientific_qualification==='NOT_ESTABLISHED','ADR_SOURCE_BASIS_INVALID');
  for(const row of d.candidates){
   insist(object(row)&&Number.isSafeInteger(row.row_number)&&row.epistemic_class==='ASSERTION'&&row.provenance_class==='USER'&&row.scientific_qualification==='NOT_ESTABLISHED'&&row.laboratory_identity_verified===false,'ADR_SOURCE_BASIS_INVALID');
   const key=d.document_id+':'+d.revision+':'+row.row_number;
   insist(!rows.has(key),'ADR_SOURCE_DUPLICATE');rows.set(key,{d,row});
  }
 }
 // A04 requires nonempty data; a truly empty selected-document set can use A01/A07 only.
 // A malformed selected document or an incomplete mapping still fails closed.
 insist((rows.size>0||req.basis.documents.length===0)&&rows.size<=100&&p.datum_bindings.length===rows.size,'ADR_CONTEXT_SOURCE_COVERAGE_REQUIRED');
 const datums:AdrWriteInputV1[]=[],mapping_refs:string[]=[],seen=new Set<string>();
 for(const m of p.datum_bindings){
  insist(exact(m,['document_id','revision','row_number','mapping_ref','semantic_id','geometry_ref','sample_day_start','sample_day_end'])&&text(m.mapping_ref)&&text(m.semantic_id)&&text(m.geometry_ref),'ADR_SOURCE_MAPPING_INVALID');
  const key=m.document_id+':'+m.revision+':'+m.row_number;const found=rows.get(key);
  insist(found&&!seen.has(key),'ADR_SOURCE_MAPPING_MISMATCH');seen.add(key);
  const {d,row}=found;
  insist(typeof row.unit==='string'&&text(row.method)&&typeof row.value==='number'&&typeof row.depth_top_cm==='number'&&typeof row.depth_bottom_cm==='number'&&row.depth_top_cm>=0&&row.depth_bottom_cm>row.depth_top_cm,'ADR_SOURCE_VALUE_INVALID');
  const interval=dayInterval(row,m,req.evaluation_time);
  const source={document_id:d.document_id,revision:d.revision,original_sha256:d.original_sha256,candidate_sha256:d.candidate_sha256,confirmation_fact_id:d.confirmation_fact_id,row};
  datums.push(input(req.attempt_id,'datum-'+digest(key).slice(0,32),{
   contract_version:'adr.context-datum.v1',semantic_id:m.semantic_id,value:{type:'DECIMAL',decimal:decimal(row.value)},unit:row.unit,
   epistemic_class:'ASSERTION',provenance_class:'USER',effective_interval:interval,available_at:req.evaluation_time,
   spatial_support:{type:'POINT',geometry_ref:m.geometry_ref},vertical_support:{from_mm:decimal(row.depth_top_cm*10),to_mm:decimal(row.depth_bottom_cm*10)},
   temporal_support:{type:'DAY'},uncertainty:{type:'UNKNOWN',reason_code:'MANAGER_REPORT_UNCERTAINTY_NOT_ESTABLISHED'},
   source:{provider_id:'GEOX_MANAGER_SOIL_DOCUMENT',source_ref:'geox:'+d.confirmation_fact_id+':row:'+row.row_number,content_hash:'sha256:'+digest(source)}
  }));
  mapping_refs.push(m.mapping_ref);
 }
 datums.sort((a,b)=>a.logical_id.localeCompare(b.logical_id));
 const problem=input(req.attempt_id,'problem',{
  contract_version:'adr.decision-problem.v1',decision_type:p.decision_type,target_ref:t,logical_time:req.evaluation_time,decision_horizon:p.decision_horizon,
  objective:{code:p.objective_code},action_space:cropMap.map((m:Obj)=>m.action_code).sort(),
  constraints:[{type:'GEOX_MANAGER_TARGET_DATE_INTERVAL',start_date:intent.target_start_date,end_date:intent.target_end_date}],
  use_purpose:p.use_purpose,use_class:p.use_class,decision_authority_mode:p.decision_authority_mode,decision_deadline:canonicalInstant(p.decision_deadline)
 });
 return {target:t,target_binding_ref:p.target_binding_ref,decision_mapping_ref:p.decision_mapping_ref,deployment_ref:p.deployment_ref,knowledge_release_ref:p.knowledge_release_ref,problem,datums,mapping_refs:[...new Set(mapping_refs)].sort(),evaluation_time:req.evaluation_time,attempt_id:req.attempt_id,basis_sha256:req.basis_sha256};
}
const coreRef=(v:unknown):AdrRefV1|null=>{
 // ADR A04 public materializer carries the DecisionProblem ref in native camel case.
 if(ref(v))return v;
 if(exact(v,['kind','logicalId','version','semanticHash'])&&object(v)){
  const x={kind:v.kind,logical_id:v.logicalId,version:v.version,semantic_hash:v.semanticHash};if(ref(x))return x;
 }
 return null;
};
const sameRef=(v:unknown,expected:AdrRefV1)=>{const x=coreRef(v);return !!x&&same(x,expected);};
const statuses=new Set(['DIRECTLY_APPLICABLE','APPLICABLE_WITH_GOVERNED_TRANSFORM','CALIBRATION_REQUIRED','BOUNDED_EXTRAPOLATION','UNRESOLVED','CONFLICT','NOT_RELEVANT']);
export async function executeNativeReviewPlanV1(manager:ManagerAuthorityV1,plan:NativeReviewPlanV1,consumer:NativeReviewConsumerV1,append:NativeReviewAppendV1){
 const requirements:AdrWriteRequirementsV1={target:{organization_id:plan.target.organization_id,tenant_id:plan.target.tenant_id}};
 const attempt=plan.attempt_id,assessments:AdrRefV1[]=[];
 let invoked=false;
 const write=async(op:AdrReviewOperationV1,i:AdrWriteInputV1,check:(receipt:AdrWriteReceiptV1)=>void,reqs=requirements)=>{
  // Durable request intent precedes the remote write. Failure to persist stops execution.
  await append('WRITE_INTENT',{operation:op,request:i,request_sha256:digest({operation:op,request:i})});
  invoked=true;
  const result=await consumer.write(manager,op,i,reqs);
  check(result);
  await append('WRITE_RECEIPT',{operation:op,receipt:result});
  return result;
 };
 try{
  const problem=await write('createDecisionProblem',plan.problem,r=>{
   insist(same(r.resource.target_ref,plan.problem.resource.target_ref)&&r.resource.logical_time===plan.evaluation_time&&same(r.resource.action_space,plan.problem.resource.action_space),'ADR_PROBLEM_RECEIPT_MISMATCH');
  });
  const datums:AdrRefV1[]=[];
  for(const datum of plan.datums){
   const d=await write('createContextDatum',datum,r=>{
    for(const k of ['semantic_id','value','unit','epistemic_class','provenance_class','effective_interval','available_at','spatial_support','vertical_support','temporal_support','uncertainty','source'])
     insist(same(r.resource[k],datum.resource[k]),'ADR_DATUM_RECEIPT_MISMATCH');
   });datums.push(d.ref);
  }
  const manifest=datums.length?await write('createContextManifest',input(attempt,'manifest',{contract_version:'adr.context-manifest.v1',decision_problem_ref:problem.ref,evidence_cutoff:plan.evaluation_time,datum_refs:datums,resolved_reference_receipt_refs:[]}),r=>{
   const expected=datums.map(d=>({datum_id:d.logical_id,semantic_hash:d.semantic_hash})).sort((a,b)=>a.datum_id.localeCompare(b.datum_id));
   const returned=r.resource.datum_refs;
   insist(sameRef(r.resource.decision_problem_ref,problem.ref)&&r.resource.evidence_cutoff===plan.evaluation_time&&same(r.resource.target_ref,plan.target)&&Array.isArray(returned)&&same([...returned].sort((a,b)=>String(a.datum_id).localeCompare(String(b.datum_id))),expected)&&Array.isArray(r.resource.resolved_reference_receipts)&&r.resource.resolved_reference_receipts.length===0,'ADR_MANIFEST_RECEIPT_MISMATCH');
  }):null;
  const retrieval=await write('executeKnowledgeRetrieval',input(attempt,'retrieval',{contract_version:'adr.knowledge-retrieval-result.v1',decision_problem_ref:problem.ref,deployment_ref:plan.deployment_ref,config:{}}),r=>{
   insist(sameRef(r.resource.decision_problem_ref,problem.ref)&&sameRef(r.resource.deployment_ref,plan.deployment_ref)&&sameRef(r.resource.knowledge_release_ref,plan.knowledge_release_ref)&&Array.isArray(r.resource.candidate_refs)&&r.resource.candidate_refs.every(c=>ref(c)&&['QualifiedKnowledge','DerivedKnowledge'].includes(c.kind))&&new Set(r.resource.candidate_refs.map(c=>digest(c))).size===r.resource.candidate_refs.length,'ADR_RETRIEVAL_RECEIPT_MISMATCH');
  });
  const candidates=retrieval.resource.candidate_refs as AdrRefV1[];
  if(!manifest){
   await append('FINISHED',{status:'NATIVE_RETRIEVAL_RECORDED_CONTEXT_REQUIRED',error_code:'NO_CONFIRMED_SOIL_DOCUMENT_SELECTED',retrieval_ref:retrieval.ref,retrieved_candidate_count:candidates.length,assessment_refs:[],action_authority:false});return;
  }
  // All retrieved candidates are evaluated, never a local top-K scientific filter.
  if(candidates.length>32){
   await append('FINISHED',{status:'HOLD_RETRIEVAL_CANDIDATE_LIMIT',retrieval_ref:retrieval.ref,assessment_refs:[],action_authority:false});return;
  }
  for(const candidate of candidates){
   const assessment=await write('createApplicabilityAssessment',input(attempt,'assessment-'+digest(candidate).slice(0,32),{contract_version:'adr.applicability-assessment.v1',knowledge_retrieval_result_ref:retrieval.ref,knowledge_ref:candidate,context_manifest_ref:manifest.ref}),r=>{
    insist(sameRef(r.resource.knowledge_retrieval_result_ref,retrieval.ref)&&sameRef(r.resource.knowledge_ref,candidate)&&sameRef(r.resource.context_manifest_ref,manifest.ref)&&sameRef(r.resource.decision_problem_ref,problem.ref)&&r.resource.authority_class==='SOURCE_TARGET_TRANSPORT_AUTHORITY'&&statuses.has(String(r.resource.transport_status))&&['QUALIFIED','PROHIBITED','REVOKED','UNQUALIFIED'].includes(String(r.resource.scientific_use_status)),'ADR_ASSESSMENT_RECEIPT_MISMATCH');
   },{...requirements,same_runtime_authority:{principal:retrieval.principal,authorization_ref:retrieval.authorization_ref}});assessments.push(assessment.ref);
  }
  await append('FINISHED',{status:candidates.length?'NATIVE_ASSESSMENTS_RECORDED':'NO_RETRIEVED_KNOWLEDGE',retrieval_ref:retrieval.ref,assessment_refs:assessments,action_authority:false});
 }catch(e){
  // A timeout, invalid native receipt, or interrupted persistence must not be
  // treated as scientific failure or automatically retried. Retain partial refs.
  const code=e instanceof AdrReviewConsumerErrorV1?e.code:'ADR_REVIEW_INTERRUPTED';
  await append('FINISHED',{status:invoked?'OUTCOME_RECONCILIATION_REQUIRED':'HOLD_BEFORE_INVOCATION',error_code:code,assessment_refs:assessments,action_authority:false});
 }
}
