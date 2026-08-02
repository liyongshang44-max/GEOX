'use strict';
const assert=require('node:assert/strict');
const {member,phaseForOrder}=require('./shared_v1.cjs');
const {loadProduct}=require('./product_loader_v1.cjs');
const {persistenceAdapter,evidenceAuthorities}=require('./persistence_authority_v1.cjs');
const {exactMembers}=require('./corrected_handoff_v1.cjs');
const {
  createFinalFormalEvidenceSourceV1,DATASET_ID,PROFILE_ID,OUTCOME_PROFILE_ID,CONTRACT_DIGEST,HIDDEN_PARAMETER,
}=require('./final_evidence_source_v1.cjs');

function recordObjectV1(value,code){
  const record=typeof value==='string'?JSON.parse(value):value;
  assert.ok(record&&typeof record==='object'&&!Array.isArray(record),code);
  const object=record.payload;
  assert.ok(object&&typeof object==='object'&&!Array.isArray(object),`${code}_PAYLOAD`);
  assert.equal(record.type,object.object_type,`${code}_TYPE`);
  return object;
}
function exactScopeV1(object,scope,code){
  for(const field of ['tenant_id','project_id','group_id','field_id','season_id','zone_id']){
    assert.equal(object[field],scope[field],`${code}:${field}`);
  }
}
function requiredRefV1(value,code){
  assert.equal(typeof value,'string',code);
  assert.ok(value.trim(),code);
  return value;
}
async function buildS6T00T16BindingsV1({pool,p,scope}){
  const from=p.cap08TickLogicalTimeV1(0);
  const to=p.cap08TickLogicalTimeV1(16);
  const rows=await pool.query(
    `SELECT record_json FROM facts
      WHERE record_json->>'type'='twin_runtime_tick_v1'
        AND record_json->'payload'->>'tenant_id'=$1
        AND record_json->'payload'->>'project_id'=$2
        AND record_json->'payload'->>'group_id'=$3
        AND record_json->'payload'->>'field_id'=$4
        AND record_json->'payload'->>'season_id'=$5
        AND record_json->'payload'->>'zone_id'=$6
        AND record_json->'payload'->>'logical_time'>=$7
        AND record_json->'payload'->>'logical_time'<=$8
      ORDER BY record_json->'payload'->>'logical_time',fact_id`,
    [scope.tenant_id,scope.project_id,scope.group_id,scope.field_id,scope.season_id,scope.zone_id,from,to],
  );
  assert.equal(rows.rows.length,17,'S6_T00_T16_TICK_CARDINALITY');
  const ticks=rows.rows.map((row,index)=>{
    const tick=recordObjectV1(row.record_json,`S6_PREFIX_TICK_${index}`);
    assert.equal(tick.object_type,'twin_runtime_tick_v1',`S6_PREFIX_TICK_TYPE:${index}`);
    assert.equal(tick.logical_time,p.cap08TickLogicalTimeV1(index),`S6_PREFIX_TICK_TIME:${index}`);
    exactScopeV1(tick,scope,`S6_PREFIX_TICK_SCOPE:${index}`);
    return tick;
  });
  const refs=ticks.flatMap(tick=>{
    const payload=tick.payload;
    assert.ok(payload&&typeof payload==='object'&&!Array.isArray(payload),'S6_PREFIX_TICK_PAYLOAD');
    return[
      requiredRefV1(payload.evidence_window_ref,'S6_PREFIX_EVIDENCE_REF'),
      requiredRefV1(payload.assimilation_update_ref,'S6_PREFIX_ASSIMILATION_REF'),
    ];
  });
  const children=await pool.query(
    `SELECT record_json FROM facts
      WHERE record_json->'payload'->>'object_id'=ANY($1::text[])
      ORDER BY fact_id`,
    [[...new Set(refs)]],
  );
  const byId=new Map();
  for(const row of children.rows){
    const object=recordObjectV1(row.record_json,'S6_PREFIX_CHILD');
    assert.equal(byId.has(object.object_id),false,'S6_PREFIX_CHILD_DUPLICATE');
    byId.set(object.object_id,object);
  }
  assert.equal(byId.size,new Set(refs).size,'S6_PREFIX_CHILD_CARDINALITY');
  return ticks.map((tick,index)=>{
    const payload=tick.payload;
    const evidence=byId.get(payload.evidence_window_ref);
    const assimilation=byId.get(payload.assimilation_update_ref);
    assert.equal(evidence?.object_type,'twin_evidence_window_v1',`S6_PREFIX_EVIDENCE_TYPE:${index}`);
    assert.equal(assimilation?.object_type,'twin_assimilation_update_v1',`S6_PREFIX_ASSIMILATION_TYPE:${index}`);
    exactScopeV1(evidence,scope,`S6_PREFIX_EVIDENCE_SCOPE:${index}`);
    exactScopeV1(assimilation,scope,`S6_PREFIX_ASSIMILATION_SCOPE:${index}`);
    assert.equal(evidence.logical_time,tick.logical_time,`S6_PREFIX_EVIDENCE_TIME:${index}`);
    assert.equal(assimilation.logical_time,tick.logical_time,`S6_PREFIX_ASSIMILATION_TIME:${index}`);
    return{
      tick_id:`T${String(index).padStart(2,'0')}`,
      logical_time:tick.logical_time,
      tick_ref:tick.object_id,
      tick_hash:tick.determinism_hash,
      evidence_window_ref:evidence.object_id,
      evidence_window_hash:evidence.determinism_hash,
      assimilation_update_ref:assimilation.object_id,
      assimilation_update_hash:assimilation.determinism_hash,
    };
  });
}
function createS6PrefixTransportReaderV1({pool,p}){
  const reader=new p.Cap08S4PersistedChainReaderV1(pool);
  assert.equal(typeof reader.readTupleV1,'function','S6_S4_PREFIX_READER_SEAM_REQUIRED');
  reader.readTupleV1=async input=>({
    tick_bindings:await buildS6T00T16BindingsV1({pool,p,scope:input.scope}),
  });
  return reader;
}
function exactEpisodeV1(episode){
  assert.equal(episode.disposition,'EXACT_COMPLETE','S6_EPISODE_DISPOSITION');
  assert.equal(episode.decision_count,1,'S6_DECISION_COUNT');
  assert.equal(episode.approval_assertion_count,1,'S6_APPROVAL_COUNT');
  assert.equal(episode.approved_plan_count,1,'S6_PLAN_COUNT');
  assert.equal(episode.execution_receipt_count,1,'S6_RECEIPT_COUNT');
  assert.equal(episode.action_feedback_count,1,'S6_FEEDBACK_COUNT');
}
async function executeS6CompositeTickRangeV1({executeBeforeS4,executeS4,executeAfterS4}){
  const results=[];
  for(let index=0;index<=16;index+=1){
    results.push(await executeBeforeS4(index));
  }
  const s4=await executeS4();
  for(let index=17;index<24;index+=1){
    results.push(await executeAfterS4(index));
  }
  return{results,s4};
}
function createTickInputV1({p,fixture,spec,index}){
  const logicalTime=p.cap08TickLogicalTimeV1(index);
  const runtimeConfigRef=fixture.runtime_config_refs_by_logical_time[logicalTime];
  const runtimeConfigHash=fixture.runtime_config_hashes_by_logical_time[logicalTime];
  assert.equal(typeof runtimeConfigRef,'string',`S6_RUNTIME_CONFIG_REF:T${String(index).padStart(2,'0')}`);
  assert.equal(typeof runtimeConfigHash,'string',`S6_RUNTIME_CONFIG_HASH:T${String(index).padStart(2,'0')}`);
  return{
    formal_run_id:spec.formal_run_id,
    scope:spec.scope,
    logical_time:logicalTime,
    created_at:fixture.bootstrap_runtime_config.created_at,
    runtime_config_ref:runtimeConfigRef,
    runtime_config_hash:runtimeConfigHash,
    authorized_future_forcing_binding_ids:['binding_weather','binding_et0'],
    crop_stage_context:fixture.crop_stage_context,
    lease_owner:`mcft-cap08-s6-${spec.operational_run_instance_id}`,
    lease_duration_seconds:300,
  };
}
function createCompletionTickV1({p,pool,handoff,frozen,deferred,normal,receiptTick}){
  const tick=new p.Cap08S3FormalTickServiceV1(
    handoff,
    frozen,
    deferred,
    normal,
    receiptTick,
    new p.Cap08S3DecisionActionProviderServiceV1(pool),
    new p.Cap08S3ReceiptEpisodeGuardV1(pool),
    new p.Cap08S3AuthorityGuardV1(pool),
  );
  return new p.Cap08S3CompletionEvidenceTickServiceV1(
    tick,
    new p.Cap08S3OutcomeCompletionEvidenceServiceV1(pool),
  );
}
async function runProductChainV1({root,pool,spec}){
const p=await loadProduct(root);
const fixture=await p.buildCap08S2FormalProviderFixtureV1(root);
const sourceManifest=p.computeCap08S3SourceManifestV1(root);
const sourceDigest=p.semanticHashV1({
  base_manifest_digest:sourceManifest.manifest_digest,
  final_formal_closure_input_contract_digest:CONTRACT_DIGEST,
  dataset_id:DATASET_ID,
  profile_id:PROFILE_ID,
  outcome_profile_id:OUTCOME_PROFILE_ID,
  hidden_parameter_value:HIDDEN_PARAMETER,
  materializer_profile:'MCFT_CAP08_S6_DIRECT_PRODUCT_SERVICE_ASSEMBLY_V1',
});
const runtimeRepository=new p.PostgresRuntimeRepositoryV1(pool);
const forecastRepository=new p.PostgresForecastScenarioRecoveryRepositoryV1(pool);
const nextTickRepository=new p.PostgresNextTickRepositoryV1(pool);

assert.equal((await nextTickRepository.commitRealityBindingSnapshot(fixture.reality_binding_snapshot)).status,'INSERTED');
for(const config of fixture.runtime_configs){
  assert.equal((await runtimeRepository.commitRuntimeConfig(config)).status,'INSERTED');
}

const evidence=createFinalFormalEvidenceSourceV1({
  pool,
  baseSource:fixture.bootstrap_evidence_source,
  runtimeRepository,
  formalRunId:spec.formal_run_id,
  scope:spec.scope,
  product:p,
});
const frozen=new p.Cap08FrozenEvidenceSourceV1(new p.Cap08S2QualifiedEvidenceSourceV1(evidence));
const ordinaryPersistence=persistenceAdapter(runtimeRepository,forecastRepository);
const baseDeferred=new p.Cap08DeferredScenarioPersistenceV1(ordinaryPersistence);
const baseHandoff=new p.PrepareNextTickInputServiceV1(nextTickRepository);
const baseNormal=new p.Cap04ForecastScenarioSingleTickServiceV1(
  baseHandoff,
  frozen,
  runtimeRepository,
  baseDeferred,
  new p.DirectCap04ExecutionConfigResolverV1(),
);
const baseReceiptTick=new p.Cap08S3ReceiptConsumingForecastScenarioTickServiceV1(
  baseHandoff,
  frozen,
  new p.PostgresActionFeedbackTickSourceV1(pool),
  runtimeRepository,
  baseDeferred,
  new p.DirectCap04ExecutionConfigResolverV1(),
);
const baseCompletionTick=createCompletionTickV1({
  p,pool,handoff:baseHandoff,frozen,deferred:baseDeferred,normal:baseNormal,receiptTick:baseReceiptTick,
});

const s4Service=new p.Cap08S4AppendForwardServiceV1(pool,evidence);
const prefixReader=createS6PrefixTransportReaderV1({pool,p});
assert.ok(Object.prototype.hasOwnProperty.call(s4Service,'chainReader'),'S6_S4_CHAIN_READER_BINDING_REQUIRED');
s4Service.chainReader=prefixReader;

const bootstrapLogicalTime=new Date(Date.parse(p.CAP08_S1_RUNTIME_START_V1)-3_600_000).toISOString();
assert.equal(fixture.bootstrap_runtime_config.logical_time,bootstrapLogicalTime,'S6_B00_CONFIG_TIME');
const bootstrap=await new p.A0BootstrapRuntimeServiceV1(
  runtimeRepository,
  runtimeRepository,
  fixture.bootstrap_evidence_source,
).execute({
  scope:spec.scope,
  logical_time:bootstrapLogicalTime,
  created_at:fixture.bootstrap_runtime_config.created_at,
  runtime_config:fixture.bootstrap_runtime_config,
  hydraulic:fixture.hydraulic,
  soil_hydraulic_config_ref:'soil_hydraulic_config_c8_v1',
  lease_owner:`mcft-cap08-s6-${spec.operational_run_instance_id}`,
  lease_duration_seconds:300,
});
assert.equal(bootstrap.next_tick_logical_time,p.CAP08_S1_RUNTIME_START_V1,'S6_B00_T00_HANDOFF');

const initialHandoff=await baseHandoff.prepareNextTickInput(spec.scope);
assert.equal(initialHandoff.next_logical_tick_time,p.cap08TickLogicalTimeV1(0),'S6_RANGE_START_T00');

let transitionCompletionTick=null;
const range=await executeS6CompositeTickRangeV1({
  executeBeforeS4:index=>baseCompletionTick.executeOneTick(createTickInputV1({p,fixture,spec,index})),
  executeS4:async()=>{
    const s4=await s4Service.execute({
      formal_run_id:spec.formal_run_id,
      scope:spec.scope,
      created_at:fixture.bootstrap_runtime_config.created_at,
      phase_engine_source_digest:sourceDigest,
    });
    assert.equal(s4.status,'COMPLETED');
    const transitionRepository=new p.PostgresCap08S4T17TransitionRepositoryV1(pool);
    const transitionAdapter=new p.Cap08S4T17TransitionPersistenceAdapterV1(
      ordinaryPersistence,
      transitionRepository,
    );
    const transitionDeferred=new p.Cap08DeferredScenarioPersistenceV1(transitionAdapter);
    const t17=p.cap08TickLogicalTimeV1(17);
    const correctedHandoff=new p.Cap08S4T17CorrectedHandoffServiceV1(
      spec.formal_run_id,
      t17,
      baseHandoff,
      transitionRepository,
    );
    const genericTransitionTick=new p.Cap04ForecastScenarioSingleTickServiceV1(
      correctedHandoff,
      frozen,
      runtimeRepository,
      transitionDeferred,
      new p.DirectCap04ExecutionConfigResolverV1(),
    );
    const transitionService=new p.Cap08S4T17TransitionTickServiceV1(
      genericTransitionTick,
      transitionAdapter,
      frozen,
      runtimeRepository,
      transitionRepository,
    );
    const contextResolver={
      async resolve(input){
        const context=await transitionRepository.resolvePersistenceContext({
          formal_run_id:input.formal_run_id,
          scope:input.scope,
          expected_t17_logical_time:input.t17_logical_time,
        });
        return{
          formal_run_id:input.formal_run_id,
          scope:structuredClone(input.scope),
          lineage_id:String(context.corrected_state.lineage_id),
          revision_id:String(context.corrected_state.revision_id),
          t17_logical_time:input.t17_logical_time,
          expected_latest_base:context.expected_latest_base,
          corrected_computation_predecessor:context.corrected_computation_predecessor,
          correction_authority:context.correction_authority,
        };
      },
    };
    const routedNormal=new p.Cap08S4T17ExplicitRoutingTickServiceV1(
      genericTransitionTick,
      transitionService,
      contextResolver,
    );
    const transitionReceiptTick=new p.Cap08S3ReceiptConsumingForecastScenarioTickServiceV1(
      correctedHandoff,
      frozen,
      new p.PostgresActionFeedbackTickSourceV1(pool),
      runtimeRepository,
      transitionDeferred,
      new p.DirectCap04ExecutionConfigResolverV1(),
    );
    transitionCompletionTick=createCompletionTickV1({
      p,
      pool,
      handoff:correctedHandoff,
      frozen,
      deferred:transitionDeferred,
      normal:routedNormal,
      receiptTick:transitionReceiptTick,
    });
    return s4;
  },
  executeAfterS4:index=>{
    assert.ok(transitionCompletionTick,'S6_T17_PRODUCT_BRIDGE_REQUIRED');
    return transitionCompletionTick.executeOneTick(createTickInputV1({p,fixture,spec,index}));
  },
});
const tickResults=range.results;
const s4=range.s4;
const finalHandoff=await baseHandoff.prepareNextTickInput(spec.scope);
const expectedNext=new Date(Date.parse(p.cap08TickLogicalTimeV1(23))+3_600_000).toISOString();
assert.equal(finalHandoff.next_logical_tick_time,expectedNext,'S6_RANGE_FINAL_HANDOFF');
const episode=await new p.Cap08S3EpisodeInspectorV1(pool).inspect({
  formal_run_id:spec.formal_run_id,
  scope:spec.scope,
});
exactEpisodeV1(episode);
assert.equal(tickResults.length,24,'S6_COMPOSITE_RANGE_TICK_COUNT');
assert.ok(s4,'S4_MUST_EXECUTE_BETWEEN_T16_AND_T17');
assert.equal(
  tickResults[17].a_provider_result.transition_status,
  'INSERTED_ATOMIC_TRANSITION',
  'S6_T17_AUTHORITY_BOUND_TRANSITION_REQUIRED',
);
assert.equal(
  tickResults[17].a_provider_result.transition_write_delta,
  10,
  'S6_T17_TRANSITION_WRITE_DELTA',
);

const s3={
  status:'COMPLETED',
  bootstrap_id:'B00',
  bootstrap_counted_as_successful_tick:false,
  bootstrap_logical_time:bootstrapLogicalTime,
  bootstrap,
  range:{
    status:'COMPLETED',
    persisted_start_logical_time:p.cap08TickLogicalTimeV1(0),
    executed_tick_count:24,
    completed_tick_count:24,
    tick_results:tickResults,
    final_handoff:finalHandoff,
    episode_inspection:episode,
    orchestration_class:'S6_FINAL_FORMAL_COMPOSITE_RANGE',
    slice_acceptance_only:false,
    final_formal_run_id:spec.formal_run_id,
  },
  orchestration_class:'S6_FINAL_FORMAL_COMPOSITE_RANGE',
  slice_acceptance_only:false,
  final_formal_run_id:spec.formal_run_id,
  late_append_forward_authorized:true,
  residual_calibration_shadow_authorized:true,
  model_activation_authorized:false,
  mcft_cap_09_authorized:false,
};

const lineageMember=member(s3.bootstrap.record_set,'twin_runtime_lineage_v1');
const lineageId=lineageMember.lineage_id??lineageMember.object_id;
const revisionId=lineageMember.revision_id??lineageMember.payload.initial_revision_id;
assert.match(lineageId,/^lineage_[a-z0-9]{24}$/);
assert.match(revisionId,/^revision_[a-z0-9]{24}$/);
const boundSpec={
  ...spec,
  lineage_id:lineageId,
  revision_id:revisionId,
  canonical_identity_binding:'BOUND_TO_PRODUCT_A0_IDENTITY',
};

const ticks=exactMembers(s3,s4);
assert.equal(ticks[16].state.object_id,s4.corrected_set.state.object_id);
assert.equal(
  member(ticks[17].tick.a_record_set,'twin_state_estimate_v1').payload.previous_posterior_ref,
  s4.corrected_set.state.object_id,
  'T17_MUST_CONSUME_CORRECTED_T16_POSTERIOR',
);

const obligations=[];
for(let order=1;order<=24;order+=1){
  const observationSourceForecast=member(
    ticks[order-1].tick.a_record_set,
    'twin_forecast_run_v1',
  );
  const residualForecast=order===17?s4.corrected_set.forecast:observationSourceForecast;
  const fvoId=`FVO-${String(order).padStart(2,'0')}`;
  const observation=await evidence.buildFvoFromForecastV1({
    fvoId,
    forecast:observationSourceForecast,
  });
  const ordinary=p.CAP08_S5_ORDINARY_ASSIMILATION_ORDERS_V1.includes(order)
    ?member(ticks[order].tick.a_record_set,'twin_assimilation_update_v1')
    :null;
  obligations.push({
    residual_id:`R-${String(order).padStart(2,'0')}`,
    residual_order:order,
    commit_phase:phaseForOrder(order),
    forecast_ref:residualForecast.object_id,
    forecast_hash:residualForecast.determinism_hash,
    observation:{
      fvo_id:fvoId,
      source_record_id:observation.source_record_id,
      source_record_hash:observation.source_record_hash,
      observed_at:observation.role_time.observed_at,
      available_to_runtime_at:observation.available_to_runtime_at,
      quality_status:observation.quality.status==='LIMITED'?'LIMITED':'PASS',
      canonical_value:Number(observation.canonical_payload.value).toFixed(6),
      canonical_unit:'fraction',
    },
    assimilation_update_ref:ordinary?.object_id??null,
    assimilation_update_hash:ordinary?.determinism_hash??null,
  });
}

const auth=evidenceAuthorities(root);
const feedbackRepo=new p.PostgresFeedbackPersistenceRepositoryV1(pool);
const s5=await new p.Cap08S5ResidualCalibrationShadowServiceV1(
  new p.PostgresCap08S5ExactSourceV1(pool,feedbackRepo),
  new p.PostgresCalibrationGovernanceRepositoryV1(pool),
).execute({
  scope:spec.scope,
  formal_run_id:spec.formal_run_id,
  created_at:fixture.bootstrap_runtime_config.created_at,
  predecessor:auth.predecessor,
  prequalification:auth.prequalification,
  obligations:p.validateCap08S5ResidualObligationsV1(obligations),
});
assert.equal(s5.residual_count,24);

  return{p,fixture,sourceDigest,s3,s4,lineageMember,lineageId,revisionId,boundSpec,ticks,evidence,s5};
}
module.exports={
  runProductChainV1,
  createS6PrefixTransportReaderV1,
  buildS6T00T16BindingsV1,
  executeS6CompositeTickRangeV1,
};
