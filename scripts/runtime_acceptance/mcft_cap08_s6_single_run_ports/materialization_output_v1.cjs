'use strict';
const assert=require('node:assert/strict');
const {digest,member,phaseForOrder,receipt}=require('./shared_v1.cjs');
const {selectorSnapshot}=require('./selector_snapshot_v1.cjs');
async function buildMaterializationOutputV1({adminPool,shared,spec,context}){
  const {p,fixture,s3,s4,lineageMember,lineageId,revisionId,boundSpec,ticks,evidence,s5}=context;
const receipts=[];
const push=(role,type,ref,hash,phase,time)=>{
  receipts.push(receipt(boundSpec,role,type,ref,hash,phase,time));
};
push(
  'BOOTSTRAP_ROOT',lineageMember.object_type,lineageMember.object_id,
  lineageMember.determinism_hash,'B00',lineageMember.logical_time,
);
const bootstrapState=member(s3.bootstrap.record_set,'twin_state_estimate_v1');
push(
  'BOOTSTRAP_STATE',bootstrapState.object_type,bootstrapState.object_id,
  bootstrapState.determinism_hash,'B00',bootstrapState.logical_time,
);
for(const {tick:result,index,tickObject,state,forecast,scenario} of ticks){
  const phase=`T${String(index).padStart(2,'0')}`;
  push('RUNTIME_TICK',tickObject.object_type,tickObject.object_id,tickObject.determinism_hash,phase,tickObject.logical_time);
  push('POSTERIOR_STATE',state.object_type,state.object_id,state.determinism_hash,phase,state.logical_time);
  push('FORECAST_RUN',forecast.object_type,forecast.object_id,forecast.determinism_hash,phase,forecast.logical_time);
  push('SCENARIO_SET',scenario.object_type,scenario.object_id,scenario.determinism_hash,phase,scenario.logical_time);
  if(result.decision){
    push('DECISION_RECORD',result.decision.object_type,result.decision.object_id,result.decision.determinism_hash,'T05',result.decision.logical_time);
  }
  if(result.approval_assertion){
    push('APPROVAL_ASSERTION',result.approval_assertion.record_type,result.approval_assertion.source_record_id,result.approval_assertion.source_record_hash,'T06',result.approval_assertion.available_to_runtime_at);
  }
  if(result.approved_plan){
    push('APPROVED_PLAN',result.approved_plan.record_type,result.approved_plan.source_record_id,result.approved_plan.source_record_hash,'T06',result.approved_plan.available_to_runtime_at);
  }
  if(result.receipt){
    push('EXECUTION_RECEIPT',result.receipt.record_type,result.receipt.source_record_id,result.receipt.source_record_hash,'T07',result.receipt.available_to_runtime_at);
  }
  if(result.action_feedback&&index===8){
    push('ACTION_FEEDBACK',result.action_feedback.object_type,result.action_feedback.object_id,result.action_feedback.determinism_hash,'T08',result.action_feedback.logical_time);
  }
}

const fvos=evidence.allFvos();
assert.equal(fvos.length,24);
for(const fvo of fvos){
  const order=Number(fvo.source_record_id.slice(-2));
  push(
    'FORECAST_VERIFICATION_OBSERVATION',fvo.record_type,fvo.source_record_id,
    fvo.source_record_hash,phaseForOrder(order),fvo.available_to_runtime_at,
  );
}
for(let index=0;index<24;index+=1){
  push(
    'FORECAST_RESIDUAL','twin_forecast_residual_v1',s5.ordered_residual_refs[index],
    s5.ordered_residual_hashes[index],phaseForOrder(index+1),fvos[index].available_to_runtime_at,
  );
}
push(
  'CALIBRATION_CANDIDATE',s5.candidate.object_type,s5.candidate.object_id,
  s5.candidate.determinism_hash,'G01',s5.candidate.logical_time,
);
push(
  'SHADOW_EVALUATION',s5.shadow_evaluation.object_type,s5.shadow_evaluation.object_id,
  s5.shadow_evaluation.determinism_hash,'G02',s5.shadow_evaluation.logical_time,
);
assert.equal(receipts.length,153);

shared.receipts=receipts;
const selector=selectorSnapshot({spec:boundSpec,receipts,ticks,s4,s5});
shared.selector=selector;
const phaseResults=boundSpec.phases.map(phase=>({
  phase_id:phase.phase_id,
  status:'COMPLETE',
  providers_enabled:[...phase.providers_enabled],
}));
assert.deepEqual([...p.CAP08_PHASE_ORDER_V1],['resolve','E','H','A','B','G','C','barrier']);
const operationalEvents=boundSpec.phases.flatMap(phase=>
  p.CAP08_PHASE_ORDER_V1.map((provider,sequence)=>({
    run_label:spec.run_label,
    formal_run_id:spec.formal_run_id,
    operational_run_instance_id:spec.operational_run_instance_id,
    phase_id:phase.phase_id,
    phase:provider,
    sequence,
    event_ref:`urn:sha256:${digest({
      phase:phase.phase_id,
      provider,
      sequence,
      formal_run_id:spec.formal_run_id,
    }).slice(7)}`,
  })),
);
selector.phase_events=operationalEvents
  .filter(x=>x.phase_id==='T08')
  .map(x=>({tick:'T08',phase:x.phase,sequence:x.sequence,event_ref:x.event_ref}));

const databaseRow=(await adminPool.query(
  "SELECT current_database() AS db,current_setting('server_version') AS version",
)).rows[0];
const databaseInstanceDigest=digest({
  database_name:databaseRow.db,
  server_version:databaseRow.version,
  operational_run_instance_id:spec.operational_run_instance_id,
});
const artifactBody={
  schema_version:'geox_mcft_cap08_s6_materialization_semantic_v1',
  exact_subject_sha:spec.exact_subject_sha,
  formal_run_id:spec.formal_run_id,
  run_label:spec.run_label,
  operational_run_instance_id:spec.operational_run_instance_id,
  lineage_id:lineageId,
  revision_id:revisionId,
  database_instance_digest:databaseInstanceDigest,
  receipt_refs:receipts.map(x=>x.object_ref).sort(),
  selector_digest:digest(selector),
};
const artifactDigest=digest(artifactBody);
return{
  formal_run_id:spec.formal_run_id,
  final_formal_run_id:spec.formal_run_id,
  lineage_id:lineageId,
  revision_id:revisionId,
  canonical_identity_binding:'BOUND_TO_PRODUCT_A0_IDENTITY',
  phase_results:phaseResults,
  canonical_receipts:receipts,
  selector_snapshot:selector,
  operational_events:operationalEvents,
  database_instance_digest:databaseInstanceDigest,
  artifact_ref:`urn:mcft-cap08:s6:${spec.run_label}:${spec.exact_subject_sha}`,
  artifact_digest:artifactDigest,
};
}
module.exports={buildMaterializationOutputV1};
