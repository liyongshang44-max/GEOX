#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const {sha}=require('./identity_v1.cjs');

function unique(values){
  return [...new Set(values.filter(Boolean))].sort();
}

function canonicalSet(source,refs){
  const filtered=unique(refs);
  const available=new Set(source.closure_member_manifest.members.map((member)=>member.object_ref));
  for(const ref of filtered){
    assert.equal(available.has(ref),true,`OBJECT_SET_MEMBER_NOT_IN_CLOSURE_MANIFEST:${ref}`);
  }
  return filtered;
}

function refsForV1(contract,source){
  const id=contract.object_set_id;
  const decision=source.decision_action;

  if(id==='PER_RUN_BOOTSTRAP_TICK_PHASE_MEMBERS'){
    return canonicalSet(source,[
      source.sequence.bootstrap_root_ref,
      ...source.sequence.tick_member_refs,
    ]);
  }
  if(id==='PER_RUN_STATE_CHAIN_MEMBERS'){
    return canonicalSet(source,source.states.map((item)=>item.ref));
  }
  if(id==='PER_RUN_STATE_TRANSITION_MEMBERS'||id==='PER_RUN_ASSIMILATION_POSTERIOR_MEMBERS'){
    return canonicalSet(source,source.transitions.flatMap((item)=>[
      item.posterior_ref,
      item.selected_observation_ref,
    ]));
  }
  if(id==='PER_RUN_EVIDENCE_SELECTION_MEMBERS'){
    return canonicalSet(source,['FVO-03','FVO-04']);
  }
  if(id==='PER_RUN_FORECAST_MEMBERS'){
    return canonicalSet(source,source.forecasts.map((item)=>item.object_ref));
  }
  if(id==='PER_RUN_SCENARIO_MEMBERS'){
    return canonicalSet(source,source.scenario_sets.map((item)=>item.object_ref));
  }
  if(id==='PER_RUN_DECISION_ACTION_MEMBERS'){
    return canonicalSet(source,[
      ...decision.decisions.map((item)=>item.ref),
      decision.approval.ref,
      decision.plan.ref,
      decision.receipt.ref,
      decision.outcome.ref,
      decision.feedback?.ref,
      decision.t08_state_ref,
    ]);
  }
  if(id==='PER_RUN_LATE_APPEND_FORWARD_MEMBERS'){
    return canonicalSet(source,[
      source.late_append_forward.source_observation_ref,
      source.late_append_forward.corrected_state_ref,
      source.late_append_forward.t17_state_ref,
    ]);
  }
  if(id==='PER_RUN_RESIDUAL_MEMBERS'||id==='PER_RUN_RESIDUAL_CALIBRATION_MEMBERS'){
    return canonicalSet(source,source.residuals.map((item)=>item.object_ref));
  }
  if(id==='PER_RUN_CANDIDATE_GOVERNANCE_MEMBERS'){
    return canonicalSet(source,source.candidate_governance.candidates.map((item)=>item.ref));
  }
  if(id==='PER_RUN_SHADOW_GOVERNANCE_MEMBERS'){
    return canonicalSet(source,source.shadow_governance.evaluations.map((item)=>item.ref));
  }
  if(id==='PER_RUN_OPERATIONAL_PHASE_EVENTS'){
    return unique([
      ...source.phase_events.map((item)=>item.event_ref),
      ...source.residual_phase.residual_refs.map((ref)=>`OPERATIONAL-${source.residual_phase.phase}-${ref}`),
    ]);
  }
  if(id==='PER_RUN_RECOVERY_EVENTS'){
    return unique([source.recovery.t11.event_ref,source.recovery.t12.event_ref]);
  }
  if(id==='PER_RUN_OPERATOR_READ_MODEL_OUTPUT'){
    return unique(source.read_model.surfaces.map((item)=>`READ_MODEL-${item.name}-${item.content_hash}`));
  }
  throw new Error(`UNSUPPORTED_OBJECT_SET:${id}`);
}

function buildProofObjectSetV1(contract,source){
  const memberRefs=refsForV1(contract,source);
  assert.ok(memberRefs.length>0,`EMPTY_OBJECT_SET:${contract.object_set_id}`);
  const body={
    schema_version:'geox_mcft_cap08_s6_proof_object_set_v1',
    object_set_id:contract.object_set_id,
    counting_domain:contract.counting_domain,
    formal_run_id:source.provenance.formal_run_id,
    run_label:source.provenance.run_label,
    member_count:memberRefs.length,
    member_refs:memberRefs,
  };
  const objectSetRef=`urn:sha256:${sha(body)}`;
  return {
    ...body,
    object_set_ref:objectSetRef,
    selector_observed_ref:`urn:sha256:${sha({
      selector:contract.selector_id,
      object_set_ref:objectSetRef,
      member_refs:memberRefs,
    })}`,
  };
}

module.exports={unique,canonicalSet,refsForV1,buildProofObjectSetV1};
