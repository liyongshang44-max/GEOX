'use strict';
const {sha}=require('../mcft_cap08_s6_final_formal_run/identity_v1.cjs');
const {buildSyntheticPerRunSourceV1}=require('../../governance_acceptance/mcft_cap08_s6_witness/synthetic_fixture_v1.cjs');
function hash(x){return`sha256:${sha(x)}`;}
function syntheticContractsV1(){return{authority:{record_status:'SINGLE_RUN_DATABASE_EXECUTION_HARNESS_IMPLEMENTATION_AUTHORIZED',execution_constraints:{single_run_database_execution_authorized:false,database_execution_workflow_authorized:false}},effect:{record_status:'FINAL_FORMAL_RUN_ORCHESTRATOR_IMPLEMENTED_EFFECTIVE'},orchestrator:{record_status:'ORCHESTRATOR_IMPLEMENTED_NOT_EFFECTIVE'},run:{scope:{tenant_id:'tenantA',project_id:'projectA',group_id:'groupA',field_id:'field_c8_demo',season_id:'season_2026_c8_corn',zone_id:'zone_mcft_c8_water_001'},tick_ids:Array.from({length:24},(_,i)=>`T${String(i).padStart(2,'0')}`),post_run_phases:['G00','G01','G02']},s6:{formal_run_contract:{all_providers_enabled_from_start:['E','H','A','B','G','C','D','F'],slice_acceptance_object_reuse_forbidden:true}},dataset:{semantic_digest:hash('dataset')}};}
function bindSyntheticProductIdentityV1(spec){const basis={formal_run_id:spec.formal_run_id,scope:spec.scope,bootstrap_logical_time:'2026-05-31T23:00:00.000Z'};return Object.freeze({...spec,lineage_id:`lineage_${sha({kind:'PRODUCT_A0_LINEAGE',...basis}).slice(0,24)}`,revision_id:`revision_${sha({kind:'PRODUCT_A0_REVISION',...basis}).slice(0,24)}`,canonical_identity_binding:'BOUND_TO_PRODUCT_A0_IDENTITY',materializer_identity_binding_required:false});}
function receipt(spec,role,ref,phase){return{formal_run_id:spec.formal_run_id,...spec.scope,lineage_id:spec.lineage_id,revision_id:spec.revision_id,member_role:role,object_type:`synthetic_${role.toLowerCase()}_v1`,object_ref:ref,object_hash:hash(ref),phase_id:phase,logical_time:'2026-06-01T00:00:00.000Z'};}
function syntheticReceiptsV1(spec,source){
 const stateByRole=new Map(source.states.map(item=>[item.role==='BOOTSTRAP_STATE'?'B00':item.ref,item]));
 const bootstrapState=source.states.find(item=>item.role==='BOOTSTRAP_STATE');
 const posteriorStates=source.states.filter(item=>item.role==='POSTERIOR_STATE');
 const out=[receipt(spec,'BOOTSTRAP_ROOT',source.sequence.bootstrap_root_ref,'B00'),receipt(spec,'BOOTSTRAP_STATE',bootstrapState.ref,'B00')];
 for(let i=0;i<24;i++){
  const t=`T${String(i).padStart(2,'0')}`;
  out.push(
   receipt(spec,'RUNTIME_TICK',source.sequence.tick_member_refs[i],t),
   receipt(spec,'POSTERIOR_STATE',posteriorStates[i].ref,t),
   receipt(spec,'FORECAST_RUN',source.forecasts[i].object_ref,t),
   receipt(spec,'SCENARIO_SET',source.scenario_sets[i].object_ref,t),
  );
 }
 for(let i=1;i<=24;i++){
  const id=String(i).padStart(2,'0'),logical=`FVO-${id}`,phase=i===1?'T16':i===24?'G00':`T${id}`;
  out.push(receipt(spec,'FORECAST_VERIFICATION_OBSERVATION',logical,phase),receipt(spec,'FORECAST_RESIDUAL',source.residuals[i-1].object_ref,phase));
 }
 const d=source.decision_action;
 out.push(
  receipt(spec,'DECISION_RECORD',d.decisions[0].ref,'T05'),
  receipt(spec,'APPROVAL_ASSERTION',d.approval.ref,'T06'),
  receipt(spec,'APPROVED_PLAN',d.plan.ref,'T06'),
  receipt(spec,'EXECUTION_RECEIPT',d.receipt.ref,'T07'),
  receipt(spec,'ACTION_FEEDBACK',d.feedback.ref,'T08'),
  receipt(spec,'CALIBRATION_CANDIDATE',source.candidate_governance.candidates[0].ref,'G01'),
  receipt(spec,'SHADOW_EVALUATION',source.shadow_governance.evaluations[0].ref,'G02'),
 );
 return out;
}
function fakePoolV1(receipts){let calls=0;return{get calls(){return calls;},async query(sql,args){calls++;if(/count\s*\(/i.test(sql))throw new Error('GLOBAL_COUNT_QUERY_FORBIDDEN');const refs=args[0];return{rows:refs.map(ref=>{const r=receipts.find(x=>x.object_ref===ref);return{fact_id:`fact_${ref}`,object:{object_id:r.object_ref,determinism_hash:r.object_hash,tenant_id:r.tenant_id,project_id:r.project_id,group_id:r.group_id,field_id:r.field_id,season_id:r.season_id,zone_id:r.zone_id,formal_run_id:r.formal_run_id}};})};}};}
function fakeCap07RequestV1(){const calls=[];return{calls,async request(input){calls.push(input);const page=input.cursor===null?0:1;return{status:200,cache_control:'no-store',content_hash:hash(`${input.surface}:${input.collection_kind}:${page}:content`),response_hash:hash(`${input.surface}:${input.collection_kind}:${page}:response`),next_cursor:['timeline','states','forecasts','scenarios','residuals','action-lifecycle','model-governance'].includes(input.surface)&&page===0?'cursor-2':null,body:{items:[]}};}};}
function syntheticSelectorSnapshotV1(spec){const base=buildSyntheticPerRunSourceV1({exact_subject_sha:spec.exact_subject_sha,run_label:spec.run_label,formal_run_id:spec.formal_run_id,operational_run_instance_id:spec.operational_run_instance_id,...spec.scope,lineage_id:spec.lineage_id,revision_id:spec.revision_id,artifact_digest:hash('artifact'),object_set_ref:'synthetic://object-set'});delete base.provenance;return base;}
module.exports={hash,syntheticContractsV1,bindSyntheticProductIdentityV1,syntheticReceiptsV1,syntheticSelectorSnapshotV1,fakePoolV1,fakeCap07RequestV1};
