'use strict';
const assert=require('node:assert/strict');
const {member,phaseForOrder}=require('./shared_v1.cjs');
const {loadProduct}=require('./product_loader_v1.cjs');
const {persistenceAdapter,evidenceAuthorities}=require('./persistence_authority_v1.cjs');
const {exactMembers,correctedT17Handoff}=require('./corrected_handoff_v1.cjs');
const {
  createFinalFormalEvidenceSourceV1,DATASET_ID,PROFILE_ID,OUTCOME_PROFILE_ID,CONTRACT_DIGEST,HIDDEN_PARAMETER,
}=require('./final_evidence_source_v1.cjs');
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

assert.equal((await runtimeRepository.commitRealityBindingSnapshot(fixture.reality_binding_snapshot)).status,'INSERTED');
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
const deferred=new p.Cap08DeferredScenarioPersistenceV1(
  persistenceAdapter(runtimeRepository,forecastRepository),
);
const baseHandoff=new p.PrepareNextTickInputServiceV1(nextTickRepository);
const s4Service=new p.Cap08S4AppendForwardServiceV1(pool,evidence);
let s4=null;
const handoff={
  async prepareNextTickInput(scope){
    const base=await baseHandoff.prepareNextTickInput(scope);
    const t17=p.cap08TickLogicalTimeV1(17);
    if(base.next_logical_tick_time===t17&&!s4){
      s4=await s4Service.execute({
        formal_run_id:spec.formal_run_id,
        scope:spec.scope,
        created_at:fixture.bootstrap_runtime_config.created_at,
        phase_engine_source_digest:sourceDigest,
      });
      assert.equal(s4.status,'COMPLETED');
      return correctedT17Handoff(base,s4);
    }
    return base;
  },
};

const normal=new p.Cap04ForecastScenarioSingleTickServiceV1(
  handoff,
  frozen,
  runtimeRepository,
  deferred,
  new p.DirectCap04ExecutionConfigResolverV1(),
);
const receiptTick=new p.Cap08S3ReceiptConsumingForecastScenarioTickServiceV1(
  handoff,
  frozen,
  new p.PostgresActionFeedbackTickSourceV1(pool),
  runtimeRepository,
  deferred,
  new p.DirectCap04ExecutionConfigResolverV1(),
);
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
const range=new p.Cap08S3FormalRangeServiceV1(
  handoff,
  new p.Cap08S3CompletionEvidenceTickServiceV1(
    tick,
    new p.Cap08S3OutcomeCompletionEvidenceServiceV1(pool),
  ),
  new p.Cap08S3EpisodeInspectorV1(pool),
  sourceDigest,
  new p.PostgresCap08S3CompletionAuthorityPairRepositoryV1(pool),
);
const runtime=new p.Cap08S3FormalRuntimeServiceV1(
  new p.A0BootstrapRuntimeServiceV1(
    runtimeRepository,
    runtimeRepository,
    fixture.bootstrap_evidence_source,
  ),
  range,
);
const s3=await runtime.execute({
  formal_run_id:spec.formal_run_id,
  scope:spec.scope,
  created_at:fixture.bootstrap_runtime_config.created_at,
  bootstrap_runtime_config:fixture.bootstrap_runtime_config,
  bootstrap_hydraulic:fixture.hydraulic,
  soil_hydraulic_config_ref:'soil_hydraulic_config_c8_v1',
  runtime_config_refs_by_logical_time:fixture.runtime_config_refs_by_logical_time,
  runtime_config_hashes_by_logical_time:fixture.runtime_config_hashes_by_logical_time,
  authorized_future_forcing_binding_ids:['binding_weather','binding_et0'],
  crop_stage_context:fixture.crop_stage_context,
  lease_owner:`mcft-cap08-s6-${spec.operational_run_instance_id}`,
  lease_duration_seconds:300,
});
assert.equal(s3.range.executed_tick_count,24);
assert.ok(s4,'S4_MUST_EXECUTE_BETWEEN_T16_AND_T17');

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
module.exports={runProductChainV1};
