import test from 'node:test';
import assert from 'node:assert/strict';
import {validateEvidencePublicationV1} from '../../product_projection/customer/manager_adr_evidence_v1.js';
import type {ManagerAuthorityV1,ManagerAuthorizerV1} from '../../auth/manager_authority_v1.js';
import {createAdrReviewConsumerV1,type AdrRefV1,type AdrReviewBindingV1} from './adr_review_consumer_v1.js';
import {prepareNativeReviewPlanV1,executeNativeReviewPlanV1,type NativeReviewPlanRequestV1} from './adr_native_review_workflow_v1.js';
const R=(kind:string,id:string):AdrRefV1=>({kind,logical_id:id,version:'1',semantic_hash:'sha256:'+'a'.repeat(64)});
const request:NativeReviewPlanRequestV1={basis_sha256:'b'.repeat(64),attempt_id:'native_fixture',evaluation_time:'2026-11-26T13:00:00.000Z',basis:{intent:{crop_codes:['CORN','SOYBEAN'],target_start_date:'2027-04-01',target_end_date:'2027-10-01'},documents:[{document_id:'d',revision:1,original_sha256:'c'.repeat(64),candidate_sha256:'d'.repeat(64),confirmation_fact_id:'confirm',epistemic_class:'ASSERTION',scientific_qualification:'NOT_ESTABLISHED',candidates:[{row_number:2,sampled_on:'2026-01-01',value:6.4,unit:'pH',method:'water_1_1',depth_top_cm:0,depth_bottom_cm:10,epistemic_class:'ASSERTION',provenance_class:'USER',scientific_qualification:'NOT_ESTABLISHED',laboratory_identity_verified:false}]}]}};
const raw={basis_sha256:request.basis_sha256,target_binding_ref:'fixture-target',decision_mapping_ref:'fixture-decision',target_ref:{organization_id:'org',tenant_id:'adr-t',field_id:'adr-f'},deployment_ref:R('Deployment','dep'),runtime_profile_ref:R('RuntimeProfile','profile'),knowledge_release_ref:R('KnowledgeRelease','release'),decision_type:'FIXTURE_REVIEW',objective_code:'FIXTURE_OBJECTIVE',use_purpose:'FIXTURE',use_class:'FIXTURE',decision_authority_mode:'EXTERNAL_POLICY',decision_horizon:{duration:'P1Y'},decision_deadline:'2027-04-01T00:00:00Z',crop_action_bindings:[{crop_code:'CORN',action_code:'CORN'},{crop_code:'SOYBEAN',action_code:'SOYBEAN'}],datum_bindings:[{document_id:'d',revision:1,row_number:2,mapping_ref:'fixture-soil-mapping',semantic_id:'fixture.soil.ph',geometry_ref:'fixture-point',sample_day_start:'2026-01-01T00:00:00-05:00',sample_day_end:'2026-01-01T23:59:59.999-05:00'}]};
test('source coverage and exact day support; no promotion of manager assertion',()=>{
 const p=prepareNativeReviewPlanV1(request,raw);const d=p.datums[0].resource;
 assert.equal(d.epistemic_class,'ASSERTION');assert.equal(d.provenance_class,'USER');assert.deepEqual(d.vertical_support,{from_mm:'0',to_mm:'100'});assert.deepEqual(d.effective_interval,{start:'2026-01-01T05:00:00.000Z',end:'2026-01-02T04:59:59.999Z'});assert.deepEqual(d.value,{type:'DECIMAL',decimal:'6.4'});
 assert.throws(()=>prepareNativeReviewPlanV1(request,{...raw,datum_bindings:[]}),/ADR_CONTEXT_SOURCE_COVERAGE_REQUIRED/);
 assert.throws(()=>prepareNativeReviewPlanV1(request,{...raw,datum_bindings:[{...raw.datum_bindings[0],sample_day_end:'2026-01-01T00:00:00-05:00'}]}),/ADR_SOURCE_DAY_MAPPING_INVALID/);
 assert.throws(()=>prepareNativeReviewPlanV1(request,{...raw,basis_sha256:'other'}),/ADR_FORMAL_PLAN_BASIS_MISMATCH/);
 assert.throws(()=>prepareNativeReviewPlanV1(request,null),/ADR_FORMAL_PLAN_REQUIRED/);
});
function setup(mode:'success'|'unknown'|'wrong-authority'|'miss'|'wrong-manifest'|'wrong-profile'|'wrong-query'|'wrong-class'|'wrong-problem'|'missing-auth',noSoil=false){
 const plan=prepareNativeReviewPlanV1(noSoil?{...request,basis:{...request.basis,documents:[]}}:request,noSoil?{...raw,datum_bindings:[]}:raw);
 const manager:ManagerAuthorityV1={actor_id:'manager',tenant_id:'t',project_id:'p',group_id:'g',field_id:'f',action:'REQUEST_CROP_REVIEW',credential_ref:'e'.repeat(64),grant_source_ref:{issuer:'fixture',id:'grant',version:'1'},mapping_version:'1',valid_until_ms:Date.now()+40000};
 const authority:ManagerAuthorizerV1={async authorize(){return manager;},assertCurrent(a,f,act){assert.equal(a,manager);assert.equal(f,'f');assert.equal(act,'REQUEST_CROP_REVIEW');}};
 let calls=0,credentials=0;const candidate=R('QualifiedKnowledge','knowledge');
 const c=createAdrReviewConsumerV1({baseUrl:'https://adr.invalid/',authority,async resolveBinding(x){
  if(mode==='missing-auth')return null;
  const b:AdrReviewBindingV1={request_sha256:x.request_sha256,authority_scope:{actor_id:'manager',tenant_id:'t',project_id:'p',group_id:'g',field_id:'f',mapping_version:'1',credential_ref:manager.credential_ref},principal:{principal_id:'adr',type:'SERVICE_ACCOUNT',organization_id:'org',tenant_id:'adr-t',program_ids:['p']},authorization_ref:R('AuthorizationDecisionAudit',mode==='wrong-authority'&&x.operation==='createApplicabilityAssessment'?'other':'auth'),credential_ref:'secret',valid_until_ms:manager.valid_until_ms};return b;
 },async getCredential(){credentials++;return 'fixture';},async transport(url,init){
  calls++;const b=JSON.parse(String(init?.body)),res=b.resource;const path=new URL(String(url)).pathname;
  let kind:string;
  if(path==='/v1/decision-problems'){kind='DecisionProblem';if(mode==='wrong-problem')res.use_purpose='wrong';}
  else if(path==='/v1/context-data')kind='ContextDatum';
  else if(path==='/v1/context-manifests'){kind='ContextManifest';const d=res.decision_problem_ref;res.decision_problem_ref={kind:d.kind,logicalId:d.logical_id,version:d.version,semanticHash:d.semantic_hash};res.target_ref=plan.target;res.datum_refs=res.datum_refs.map((d:AdrRefV1)=>({datum_id:d.logical_id,semantic_hash:d.semantic_hash}));res.resolved_reference_receipts=[];if(mode==='wrong-manifest')res.evidence_cutoff='wrong';}
  else if(path==='/v1/knowledge-retrieval-results'){kind='KnowledgeRetrievalResult';res.knowledge_release_ref=plan.knowledge_release_ref;res.runtime_profile_ref=mode==='wrong-profile'?R('RuntimeProfile','wrong'):plan.runtime_profile_ref;res.authority_class=mode==='wrong-class'?'SCIENTIFIC':'RETRIEVAL_EVIDENCE_NON_SCIENTIFIC';const p=plan.problem.resource;res.query_semantics={decision_type:p.decision_type,use_purpose:mode==='wrong-query'?'wrong':p.use_purpose,use_class:p.use_class,decision_authority_mode:p.decision_authority_mode,objective_code:(p.objective as any).code};res.candidate_refs=mode==='miss'?[]:[candidate];res.miss_diagnostics=mode==='miss'?[{code:'NO_RELEASE_MEMBERS_OF_CONFIGURED_KIND',scope:'RETRIEVAL_ONLY_NON_SCIENTIFIC'}]:[];}
  else {kind='ApplicabilityAssessment';if(mode==='unknown')throw Error('network');res.decision_problem_ref=R('DecisionProblem',plan.problem.logical_id);res.authority_class='SOURCE_TARGET_TRANSPORT_AUTHORITY';res.transport_status='UNRESOLVED';res.scientific_use_status='UNQUALIFIED';}
  return new Response(JSON.stringify({ref:R(kind,b.logical_id),resource:res}),{status:201});
 }});
 return {manager,plan,c,calls:()=>calls,credentials:()=>credentials};
}
test('full five native wire operations retain graph and exact refs; retrieval miss is not assessment',async()=>{
 for(const mode of ['success','miss'] as const){
  const x=setup(mode),events: {event:string;details:Record<string,any>}[]=[];
  await executeNativeReviewPlanV1(x.manager,x.plan,x.c,async(event,details)=>{events.push({event,details});});
  assert.equal(x.calls(),mode==='success'?5:4);
  assert.equal(events.at(-1)?.details.status,mode==='success'?'NATIVE_ASSESSMENTS_RECORDED':'NO_RETRIEVED_KNOWLEDGE');
  assert.equal(events.at(-1)?.details.action_authority,false);assert.equal(events.at(-1)?.details.assessment_refs.length,mode==='success'?1:0);
  for(let i=0;i<events.length-1;i+=2){assert.equal(events[i].event,'WRITE_INTENT');assert.equal(events[i+1].event,'WRITE_RECEIPT');}
 }
});
test('unknown, mismatched graph and A07/A08 authority mismatch stop without retry',async()=>{
 for(const mode of ['unknown','wrong-authority','wrong-manifest'] as const){
  const x=setup(mode),events: {event:string;details:Record<string,any>}[]=[];
  await executeNativeReviewPlanV1(x.manager,x.plan,x.c,async(event,details)=>{events.push({event,details});});
  assert.equal(events.at(-1)?.details.status,'OUTCOME_RECONCILIATION_REQUIRED');assert.equal(events.at(-1)?.details.assessment_refs.length,0);
  assert.equal(x.calls(),mode==='unknown'?5:mode==='wrong-authority'?4:3);assert.equal(x.credentials(),x.calls());
 }
});

test('no selected soil documents: native A01/A07 only, never A02/A04/A08',async()=>{
 for(const mode of ['success','miss'] as const){
  const x=setup(mode,true),events:{event:string;details:Record<string,any>}[]=[];
  assert.deepEqual(x.plan.datums,[]);
  await executeNativeReviewPlanV1(x.manager,x.plan,x.c,async(event,details)=>{events.push({event,details});});
  assert.equal(x.calls(),2);
  assert.deepEqual(events.filter(e=>e.event==='WRITE_RECEIPT').map(e=>e.details.operation),['createDecisionProblem','executeKnowledgeRetrieval']);
  assert.equal(events.at(-1)?.details.status,mode==='success'?'NATIVE_RETRIEVAL_RECORDED_CONTEXT_REQUIRED':'NO_RETRIEVED_KNOWLEDGE');
  assert.equal(events.at(-1)?.details.error_code,'NO_CONFIRMED_SOIL_DOCUMENT_SELECTED');
  assert.equal(events.at(-1)?.details.retrieved_candidate_count,mode==='success'?1:0);
  assert.deepEqual(events.at(-1)?.details.assessment_refs,[]);
  assert.equal(events.at(-1)?.details.action_authority,false);
 }
 assert.throws(()=>prepareNativeReviewPlanV1({...request,basis:{...request.basis,documents:[{...request.basis.documents[0],candidates:[]}]}},{...raw,datum_bindings:[]}),/ADR_CONTEXT_SOURCE_COVERAGE_REQUIRED/);
 assert.throws(()=>prepareNativeReviewPlanV1({...request,basis:{...request.basis,documents:[]}},raw),/ADR_CONTEXT_SOURCE_COVERAGE_REQUIRED/);
});

test('A01 semantics and A07 profile/query/authority mismatches stop; missing binding never becomes a miss',async()=>{
 for(const mode of ['wrong-profile','wrong-query','wrong-class','wrong-problem','missing-auth'] as const){
  const x=setup(mode,true),events:{event:string;details:Record<string,any>}[]=[];
  await executeNativeReviewPlanV1(x.manager,x.plan,x.c,async(event,details)=>{events.push({event,details});});
  assert.equal(x.calls(),mode==='missing-auth'?0:mode==='wrong-problem'?1:2);
  assert.notEqual(events.at(-1)?.details.status,'NO_RETRIEVED_KNOWLEDGE');
  assert.deepEqual(events.at(-1)?.details.assessment_refs,[]);
  assert.equal(events.at(-1)?.details.action_authority,false);
  assert.equal(events.filter(e=>e.event==='WRITE_RECEIPT').length,mode==='wrong-problem'||mode==='missing-auth'?0:1);
 }
 assert.throws(()=>prepareNativeReviewPlanV1(request,{...raw,runtime_profile_ref:R('KnowledgeRelease','bad')}),/ADR_RELEASE_DEPLOYMENT_REQUIRED/);
});

test('customer evidence publication rejects incomplete or altered CC BY presentation',()=>{
 const title='TEST_ONLY publication',url='https://creativecommons.org/licenses/by/4.0/';
 const publication={citation:'TEST_ONLY citation',license:'CC-BY-4.0',license_url:url,attribution:'TEST_ONLY authors, '+title+'. '+url,modification_notice:'The displayed claim summary is a paraphrase/adaptation of the cited publication; it is not the original article or a grant of underlying data or model rights.'};
 assert.deepEqual(validateEvidencePublicationV1(publication,title),publication);
 assert.deepEqual(validateEvidencePublicationV1({citation:'TEST_ONLY'},title),{citation:'TEST_ONLY'});
 for(const changed of [{...publication,license_url:'https://other.invalid/'},{...publication,modification_notice:'Original article'},{...publication,attribution:'Unknown'},{citation:'TEST_ONLY',license:'CC-BY-4.0'}])assert.throws(()=>validateEvidencePublicationV1(changed,title),/ADR_A07_EVIDENCE_INTEGRITY/);
});
