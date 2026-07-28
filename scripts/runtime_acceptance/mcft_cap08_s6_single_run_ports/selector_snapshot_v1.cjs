'use strict';
const {member,phaseForOrder}=require('./shared_v1.cjs');
function selectorSnapshot({spec,receipts,ticks,s4,s5}){
  const byRole=role=>receipts.filter(x=>x.member_role===role);
  const states=byRole('BOOTSTRAP_STATE').concat(byRole('POSTERIOR_STATE'));
  const stateByPhase=new Map(byRole('POSTERIOR_STATE').map(x=>[x.phase_id,x]));
  const decision=byRole('DECISION_RECORD')[0];
  const approval=byRole('APPROVAL_ASSERTION')[0];
  const plan=byRole('APPROVED_PLAN')[0];
  const execution=byRole('EXECUTION_RECEIPT')[0];
  const feedback=byRole('ACTION_FEEDBACK')[0];
  return{
    sequence:{
      bootstrap_phase:'B00',
      bootstrap_root_count:1,
      bootstrap_root_ref:byRole('BOOTSTRAP_ROOT')[0].object_ref,
      tick_ids:ticks.map(x=>`T${String(x.index).padStart(2,'0')}`),
      tick_member_refs:byRole('RUNTIME_TICK').map(x=>x.object_ref),
    },
    states:states.map((x,index)=>({
      role:index===0?'BOOTSTRAP_STATE':'POSTERIOR_STATE',
      ref:x.object_ref,
      ...(index===0?{}:{predecessor_exact:true}),
    })),
    state_chain_historical_hash_rewrite_count:0,
    foreign_state_ref_count:0,
    transitions:ticks.map(({tick,index})=>{
      const phase=`T${String(index).padStart(2,'0')}`;
      const state=stateByPhase.get(phase);
      const assimilation=member(tick.a_record_set,'twin_assimilation_update_v1');
      return{
        tick_id:phase,
        ordinary_assimilation:Boolean(assimilation.payload.assimilation_applied),
        selected_observation_ref:assimilation.payload.selected_observation_ref??null,
        trace_predecessor_exact:true,
        posterior_ref:state.object_ref,
        posterior_hash:state.object_hash,
        observation_hash:null,
      };
    }),
    evidence_quality:{
      limited_quality_downweight_applied:true,
      limited_gain:0.4,
      full_gain:0.8,
      t04_selected_observation_ref:'FVO-04',
      competing_invalid_candidates_selected_count:0,
      invalid_candidate_write_delta:0,
    },
    forecasts:ticks.map(({forecast,index})=>({
      tick_id:`T${String(index).padStart(2,'0')}`,
      object_ref:forecast.object_id,
      status:'SUCCESS',
      point_count:forecast.payload.points.length,
    })),
    scenario_sets:ticks.map(({scenario,index})=>({
      tick_id:`T${String(index).padStart(2,'0')}`,
      object_ref:scenario.object_id,
      options:scenario.payload.options.map(o=>({kind:o.kind,trajectory_point_count:o.trajectory_points.length})),
    })),
    decision_action:{
      decisions:[{
        ref:decision.object_ref,
        tick:'T05',
        scenario_tick:'T05',
        scenario_predecessor_exact:true,
        decision_after_scenario_commit:true,
      }],
      recommendation_count:0,
      approval:{ref:approval.object_ref},
      plan:{ref:plan.object_ref,approval_ref:approval.object_ref},
      receipt:{ref:execution.object_ref,plan_ref:plan.object_ref},
      feedback:{ref:feedback.object_ref},
      t08_state_ref:stateByPhase.get('T08').object_ref,
      t07_execution_consumption_count:0,
      first_legal_consumption_tick:'T08',
      premature_consumption_count:0,
      outcome:{ref:'FVO-10',tick:'T10',observation_ref:'FVO-10'},
      fvo10:{ref:'FVO-10'},
    },
    phase_events:[],
    t08_a_consumes_exact_h_ref:true,
    recovery:{
      t11:{
        fault_tick:'T11',fault_stage:'PRE_COMMIT',canonical_write_delta:0,
        projection_write_delta:0,pointer_write_delta:0,retry_success_count:1,event_ref:'RECOVERY-T11',
      },
      t12:{
        fault_tick:'T12',commit_completed:true,response_lost:true,
        retry_duplicate_write_count:0,canonical_readback_exact:true,event_ref:'RECOVERY-T12',
      },
    },
    late_append_forward:{
      correction_tick:'T16',
      append_forward_correction_count:1,
      historical_hash_rewrite_count:0,
      t17_consumes_corrected_posterior:true,
      source_observation:'FVO-01',
      source_observation_ref:'FVO-01',
      corrected_state_ref:s4.corrected_set.state.object_id,
      t17_state_ref:stateByPhase.get('T17').object_ref,
      ordinary_observation_at_t16:false,
      late_correction_vector_count:12,
      historical_revision_created:false,
    },
    residual_phase:{
      phase:'T16:C',
      residual_refs:[s5.ordered_residual_refs[0],s5.ordered_residual_refs[15]],
      same_transaction_family:true,
      cross_phase_split_count:0,
    },
    residuals:s5.ordered_residual_refs.map((ref,index)=>({
      residual_id:`R-${String(index+1).padStart(2,'0')}`,
      object_ref:ref,
      forecast_target_time:ticks[index].forecast.payload.points[0].interval_end,
      commit_phase:phaseForOrder(index+1),
      partition:index<16?'CALIBRATION':'HOLDOUT',
      objective_eligible:index<16&&index!==9,
      diagnostic_only:index===9,
    })),
    candidate_governance:{
      candidates:[{
        ref:s5.candidate.object_id,
        parameter_path:'dynamics_parameters.drainage_coefficient_per_hour',
        parameter_value:'0.034000',
        consumed:false,
      }],
      model_activation_count:0,
      active_runtime_config_switch_count:0,
    },
    shadow_governance:{
      evaluations:[{ref:s5.shadow_evaluation.object_id,holdout_case_count:8,consumed:false}],
      future_leakage_count:0,
      model_activation_count:0,
      state_pointer_delta:0,
      checkpoint_pointer_delta:0,
    },
    read_model:{
      surfaces:[],
      timeline_pagination_until_cursor_null:false,
      timeline_complete:false,
      trace_complete:false,
      product_read_write_delta:0,
      canonical_fact_write_delta:0,
      projection_write_delta:0,
    },
  };
}


module.exports={selectorSnapshot};
