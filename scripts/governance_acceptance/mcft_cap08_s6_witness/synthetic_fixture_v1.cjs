#!/usr/bin/env node
'use strict';
const crypto=require('node:crypto');
const TICKS=Array.from({length:24},(_,i)=>`T${String(i).padStart(2,'0')}`);
const ORDINARY=['T02','T03','T04','T10','T22'];
const OBS=['FVO-02','FVO-03','FVO-04','FVO-10','FVO-22'];
function h(value){return`sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;}
function exactRef(kind,logical){return`obj_${kind}_${h(`${kind}:${logical}`).slice(7,31)}`;}
function buildSyntheticPerRunSourceV1(context){
  const stateRefs={B00:exactRef('state','B00'),...Object.fromEntries(TICKS.map((tick)=>[tick,exactRef('state',tick)]))};
  const transitions=TICKS.map((tick)=>{
    const index=ORDINARY.indexOf(tick);
    return {
      tick_id:tick,
      ordinary_assimilation:index>=0,
      selected_observation_ref:index>=0?OBS[index]:null,
      trace_predecessor_exact:true,
      posterior_ref:stateRefs[tick],
      posterior_hash:h(`state-${tick}`),
      observation_hash:index>=0?h(`obs-${OBS[index]}`):null,
    };
  });
  const residuals=Array.from({length:24},(_,index)=>{
    const order=index+1;
    const residualId=`R-${String(order).padStart(2,'0')}`;
    return {
      residual_id:residualId,
      object_ref:exactRef('residual',residualId),
      forecast_target_time:`2026-06-${String(1+Math.floor(index/24)).padStart(2,'0')}T${String(index%24).padStart(2,'0')}:00:00.000Z`,
      commit_phase:order===1||order===16?'T16':order===24?'G00':`T${String(order).padStart(2,'0')}`,
      partition:order<=16?'CALIBRATION':'HOLDOUT',
      objective_eligible:order<=16&&order!==10,
      diagnostic_only:order===10,
    };
  });
  const decisionRef=exactRef('decision','T05');
  const approvalRef=exactRef('approval','T06');
  const planRef=exactRef('plan','T06');
  const receiptRef=exactRef('receipt','T07');
  const feedbackRef=exactRef('feedback','T08');
  const candidateRef=exactRef('candidate','G01');
  const shadowRef=exactRef('shadow','G02');
  return {
    provenance:{
      source_classification:'SYNTHETIC_CONTRACT_FIXTURE',
      hard_acceptance_source_eligible:false,
      closure_member_manifest_ref:`synthetic://closure-manifest/${context.run_label}`,
      closure_manifest_generated_by_final_formal_run:false,
      canonical_readback_verified:true,
      global_table_count_used:false,
      global_type_count_used:false,
      unscoped_projection_count_used:false,
      slice_acceptance_object_reuse_count:0,
      cross_run_stitching_count:0,
      exact_subject_sha:context.exact_subject_sha,
      formal_run_id:context.formal_run_id,
      run_label:context.run_label,
      operational_run_instance_id:context.operational_run_instance_id,
      tenant_id:context.tenant_id,
      project_id:context.project_id,
      group_id:context.group_id,
      field_id:context.field_id,
      season_id:context.season_id,
      zone_id:context.zone_id,
      lineage_id:context.lineage_id,
      revision_id:context.revision_id,
      artifact_digest:context.artifact_digest,
      object_set_ref:context.object_set_ref,
    },
    sequence:{
      bootstrap_phase:'B00',
      bootstrap_root_count:1,
      bootstrap_root_ref:exactRef('lineage',context.formal_run_id),
      tick_ids:TICKS,
      tick_member_refs:TICKS.map((tick)=>exactRef('tick',tick)),
    },
    states:[
      {role:'BOOTSTRAP_STATE',ref:stateRefs.B00},
      ...TICKS.map((tick)=>({role:'POSTERIOR_STATE',ref:stateRefs[tick],predecessor_exact:true})),
    ],
    state_chain_historical_hash_rewrite_count:0,
    foreign_state_ref_count:0,
    transitions,
    evidence_quality:{
      limited_quality_downweight_applied:true,
      limited_gain:0.4,
      full_gain:0.8,
      t04_selected_observation_ref:'FVO-04',
      competing_invalid_candidates_selected_count:0,
      invalid_candidate_write_delta:0,
    },
    forecasts:TICKS.map((tick)=>({tick_id:tick,object_ref:exactRef('forecast',tick),status:'SUCCESS',point_count:72})),
    scenario_sets:TICKS.map((tick)=>({
      tick_id:tick,
      object_ref:exactRef('scenario',tick),
      options:['NO_ACTION','IRRIGATE_NOW_15MM','IRRIGATE_NOW_25MM'].map((kind)=>({kind,trajectory_point_count:72})),
    })),
    decision_action:{
      decisions:[{ref:decisionRef,tick:'T05',scenario_tick:'T05',scenario_predecessor_exact:true,decision_after_scenario_commit:true}],
      recommendation_count:0,
      approval:{ref:approvalRef},
      plan:{ref:planRef,approval_ref:approvalRef},
      receipt:{ref:receiptRef,plan_ref:planRef},
      feedback:{ref:feedbackRef},
      t08_state_ref:stateRefs.T08,
      t07_execution_consumption_count:0,
      first_legal_consumption_tick:'T08',
      premature_consumption_count:0,
      outcome:{ref:'FVO-10',tick:'T10',observation_ref:'FVO-10'},
      fvo10:{ref:'FVO-10'},
    },
    phase_events:[
      {tick:'T08',phase:'E',sequence:1},
      {tick:'T08',phase:'H',sequence:2},
      {tick:'T08',phase:'A',sequence:3},
      {tick:'T08',phase:'B',sequence:4},
    ],
    t08_a_consumes_exact_h_ref:true,
    recovery:{
      t11:{fault_tick:'T11',fault_stage:'PRE_COMMIT',canonical_write_delta:0,projection_write_delta:0,pointer_write_delta:0,retry_success_count:1,event_ref:'RECOVERY-T11'},
      t12:{fault_tick:'T12',commit_completed:true,response_lost:true,retry_duplicate_write_count:0,canonical_readback_exact:true,event_ref:'RECOVERY-T12'},
    },
    late_append_forward:{
      correction_tick:'T16',
      append_forward_correction_count:1,
      historical_hash_rewrite_count:0,
      t17_consumes_corrected_posterior:true,
      source_observation:'FVO-01',
      source_observation_ref:'FVO-01',
      corrected_state_ref:stateRefs.T16,
      t17_state_ref:stateRefs.T17,
      ordinary_observation_at_t16:false,
      late_correction_vector_count:12,
      historical_revision_created:false,
    },
    residual_phase:{phase:'T16:C',residual_refs:['R-01','R-16'],same_transaction_family:true,cross_phase_split_count:0},
    residuals,
    candidate_governance:{
      candidates:[{ref:candidateRef,parameter_path:'dynamics_parameters.drainage_coefficient_per_hour',parameter_value:'0.034000',consumed:false}],
      model_activation_count:0,
      active_runtime_config_switch_count:0,
    },
    shadow_governance:{
      evaluations:[{ref:shadowRef,holdout_case_count:8,consumed:false}],
      future_leakage_count:0,
      model_activation_count:0,
      state_pointer_delta:0,
      checkpoint_pointer_delta:0,
    },
    read_model:{
      surfaces:['runtime','timeline','trace','states','forecasts','scenarios','residuals','action-lifecycle','model-governance','health'].map((name)=>({
        name,
        status:200,
        content_hash:h(`content-${name}`),
        response_instance_hash:h(`response-${name}`),
      })),
      timeline_pagination_until_cursor_null:true,
      timeline_complete:true,
      trace_complete:true,
      product_read_write_delta:0,
      canonical_fact_write_delta:0,
      projection_write_delta:0,
    },
  };
}
function syntheticContextV1(runLabel,phase='PER_RUN'){
  return {
    exact_subject_sha:'1111111111111111111111111111111111111111',
    run_label:runLabel,
    formal_run_id:'cap08_s6_synthetic_contract_test',
    operational_run_instance_id:`synthetic-${runLabel.toLowerCase()}`,
    tenant_id:'tenantA',project_id:'projectA',group_id:'groupA',field_id:'fieldA',season_id:'seasonA',zone_id:'zoneA',
    lineage_id:'lineageA',revision_id:'revisionA',database_instance_digest:h(`db-${runLabel}`),
    artifact_ref:`synthetic://witness-producer/${runLabel}`,artifact_digest:h(`artifact-${runLabel}`),
    object_set_ref:`synthetic://object-set/${runLabel}`,selector_observed_ref:`synthetic://selector-observed/${runLabel}`,
    proof_phase:phase,
    phase_instance:phase==='PER_RUN'?runLabel:phase==='CROSS_RUN'?'RUN_A_RUN_B_PAIR':phase==='MERGE_SHA'?'EXACT_MERGE_SHA':'EXACT_LOCKED_R2_ARTIFACT_VERSION',
    execution_class:'SYNTHETIC_PRODUCER_CONTRACT_TEST',
  };
}
module.exports={TICKS,ORDINARY,OBS,h,exactRef,buildSyntheticPerRunSourceV1,syntheticContextV1};
