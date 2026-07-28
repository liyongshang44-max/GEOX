#!/usr/bin/env node
'use strict';
const {buildSyntheticPerRunSourceV1}=require('../../governance_acceptance/mcft_cap08_s6_witness/synthetic_fixture_v1.cjs');
const {sha}=require('./identity_v1.cjs');
function makeMember(plan,role,type,ref,phase,time){
  return {
    formal_run_id:plan.formal_run_id,
    ...plan.scope,
    lineage_id:plan.lineage_id,
    revision_id:plan.revision_id,
    member_role:role,
    object_type:type,
    object_ref:ref,
    object_hash:`sha256:${sha({type,ref,phase,time})}`,
    phase_id:phase,
    logical_time:time,
  };
}
function buildSyntheticOrchestratorInputV1(plan){
  const base=buildSyntheticPerRunSourceV1({
    exact_subject_sha:plan.exact_subject_sha,
    run_label:plan.run_label,
    formal_run_id:plan.formal_run_id,
    operational_run_instance_id:plan.operational_run_instance_id,
    ...plan.scope,
    lineage_id:plan.lineage_id,
    revision_id:plan.revision_id,
    artifact_digest:`sha256:${sha(`artifact-${plan.run_label}`)}`,
    object_set_ref:`urn:synthetic:${plan.run_label}`,
  });
  const members=[];
  members.push(makeMember(plan,'BOOTSTRAP_ROOT','twin_runtime_lineage_v1',base.sequence.bootstrap_root_ref,'B00','2026-06-01T00:00:00.000Z'));
  members.push(makeMember(plan,'BOOTSTRAP_STATE','twin_state_estimate_v1',base.states[0].ref,'B00','2026-06-01T00:00:00.000Z'));
  for(let index=0;index<24;index+=1){
    const tick=`T${String(index).padStart(2,'0')}`;
    const time=`2026-06-01T${String(index).padStart(2,'0')}:00:00.000Z`;
    members.push(
      makeMember(plan,'RUNTIME_TICK','twin_runtime_tick_v1',base.sequence.tick_member_refs[index],tick,time),
      makeMember(plan,'POSTERIOR_STATE','twin_state_estimate_v1',base.states[index+1].ref,tick,time),
      makeMember(plan,'FORECAST_RUN','twin_forecast_run_v1',base.forecasts[index].object_ref,tick,time),
      makeMember(plan,'SCENARIO_SET','twin_scenario_set_v1',base.scenario_sets[index].object_ref,tick,time),
    );
  }
  for(let order=1;order<=24;order+=1){
    const id=String(order).padStart(2,'0');
    const phase=order===1||order===16?'T16':order===24?'G00':`T${id}`;
    const time=`2026-06-02T${String(order%24).padStart(2,'0')}:00:00.000Z`;
    members.push(
      makeMember(plan,'FORECAST_VERIFICATION_OBSERVATION','forecast_verification_observation_v1',`FVO-${id}`,phase,time),
      makeMember(plan,'FORECAST_RESIDUAL','twin_forecast_residual_v1',base.residuals[order-1].object_ref,phase,time),
    );
  }
  members.push(
    makeMember(plan,'DECISION_RECORD','twin_decision_v1',base.decision_action.decisions[0].ref,'T05','2026-06-01T05:00:00.000Z'),
    makeMember(plan,'APPROVAL_ASSERTION','approval_assertion_v1',base.decision_action.approval.ref,'T06','2026-06-01T06:00:00.000Z'),
    makeMember(plan,'APPROVED_PLAN','approved_plan_v1',base.decision_action.plan.ref,'T06','2026-06-01T06:00:00.000Z'),
    makeMember(plan,'EXECUTION_RECEIPT','execution_receipt_v1',base.decision_action.receipt.ref,'T07','2026-06-01T07:00:00.000Z'),
    makeMember(plan,'ACTION_FEEDBACK','twin_action_feedback_v1',base.decision_action.feedback.ref,'T08','2026-06-01T08:00:00.000Z'),
    makeMember(plan,'CALIBRATION_CANDIDATE','twin_calibration_candidate_v1',base.candidate_governance.candidates[0].ref,'G01','2026-06-02T01:00:00.000Z'),
    makeMember(plan,'SHADOW_EVALUATION','twin_shadow_evaluation_v1',base.shadow_governance.evaluations[0].ref,'G02','2026-06-02T02:00:00.000Z'),
  );
  base.phase_events=base.phase_events.map((item,index)=>({...item,event_ref:`SELECTOR-EVENT-T08-${index}`}));
  const events=plan.phases.flatMap((phase,index)=>phase.phase_order.map((provider,sequence)=>({
    run_label:plan.run_label,
    formal_run_id:plan.formal_run_id,
    operational_run_instance_id:plan.operational_run_instance_id,
    phase_id:phase.phase_id,
    phase:provider,
    sequence,
    event_ref:`EVENT-${index}-${sequence}`,
  })));
  return {
    selectorData:base,
    canonicalMembers:members,
    events,
    databaseInstanceDigest:`sha256:${sha(`database-${plan.run_label}`)}`,
    artifactRef:`synthetic://orchestrator/${plan.run_label}`,
    artifactDigest:`sha256:${sha(`artifact-${plan.run_label}`)}`,
  };
}
module.exports={buildSyntheticOrchestratorInputV1};
