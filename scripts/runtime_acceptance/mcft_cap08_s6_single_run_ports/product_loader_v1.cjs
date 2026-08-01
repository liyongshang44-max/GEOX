'use strict';
const assert=require('node:assert/strict');
const {product}=require('./shared_v1.cjs');
const {createS6S4AtomicPersistenceRepositoryV1}=require('./s6_s4_atomic_persistence_repository_v1.cjs');

async function loadProduct(root){
  const modules=await Promise.all([
    product(root,'apps/server/src/domain/soil_water/hourly_water_balance_v1.ts'),
    product(root,'apps/server/src/domain/twin_runtime/canonical_identity_v1.ts'),
    product(root,'apps/server/src/domain/twin_runtime/canonical_json_v1.ts'),
    product(root,'apps/server/src/domain/twin_runtime/cap08_phase_engine_contracts_v1.ts'),
    product(root,'apps/server/src/domain/twin_runtime/cap08_s2_formal_provider_contracts_v1.ts'),
    product(root,'apps/server/src/domain/twin_runtime/cap08_s3_formal_provider_contracts_v1.ts'),
    product(root,'apps/server/src/domain/twin_runtime/cap08_s3_completion_tuple_v1.ts'),
    product(root,'apps/server/src/domain/twin_runtime/cap08_s4_append_forward_contracts_v1.ts'),
    product(root,'apps/server/src/domain/twin_runtime/cap08_t17_transition_contracts_v1.ts'),
    product(root,'apps/server/src/domain/twin_runtime/cap08_t17_transition_witness_identity_v1.ts'),
    product(root,'apps/server/src/domain/twin_runtime/runtime_config_execution_view_v1.ts'),
    product(root,'apps/server/src/persistence/twin_runtime/postgres_action_feedback_tick_source_v1.ts'),
    product(root,'apps/server/src/persistence/twin_runtime/postgres_cap08_s4_t17_transition_repository_v1.ts'),
    product(root,'apps/server/src/runtime/twin_runtime/cap08_s2_qualified_evidence_source_v1.ts'),
    product(root,'apps/server/src/runtime/twin_runtime/cap08_s3_authority_guard_v1.ts'),
    product(root,'apps/server/src/runtime/twin_runtime/cap08_s3_completion_evidence_tick_service_v1.ts'),
    product(root,'apps/server/src/runtime/twin_runtime/cap08_s3_decision_action_provider_service_v1.ts'),
    product(root,'apps/server/src/runtime/twin_runtime/cap08_s3_episode_inspector_v1.ts'),
    product(root,'apps/server/src/runtime/twin_runtime/cap08_s3_formal_tick_service_v1.ts'),
    product(root,'apps/server/src/runtime/twin_runtime/cap08_s3_outcome_completion_evidence_service_v1.ts'),
    product(root,'apps/server/src/runtime/twin_runtime/cap08_s3_receipt_consuming_tick_service_v1.ts'),
    product(root,'apps/server/src/runtime/twin_runtime/cap08_s3_receipt_episode_guard_v1.ts'),
    product(root,'apps/server/src/runtime/twin_runtime/a0_bootstrap_runtime_service_v1.ts'),
    product(root,'apps/server/src/runtime/twin_runtime/cap08_deferred_scenario_persistence_v1.ts'),
    product(root,'apps/server/src/runtime/twin_runtime/cap08_frozen_evidence_source_v1.ts'),
    product(root,'apps/server/src/runtime/twin_runtime/cap08_s4_t17_routing_persistence_v1.ts'),
    product(root,'apps/server/src/runtime/twin_runtime/forecast_scenario_single_tick_service_v1.ts'),
    product(root,'apps/server/src/runtime/twin_runtime/next_tick_input_service_v1.ts'),
    product(root,'apps/server/src/persistence/twin_runtime/postgres_forecast_scenario_recovery_repository_v1.ts'),
    product(root,'apps/server/src/persistence/twin_runtime/postgres_next_tick_repository_v1.ts'),
    product(root,'apps/server/src/persistence/twin_runtime/postgres_runtime_repository_v1.ts'),
    product(root,'apps/server/src/runtime/twin_runtime/cap08_s4_append_forward_service_v1.ts'),
    product(root,'apps/server/src/runtime/twin_runtime/cap08_s4_persisted_chain_reader_v1.ts'),
    product(root,'apps/server/src/persistence/twin_runtime/postgres_feedback_persistence_repository_v1.ts'),
    product(root,'apps/server/src/persistence/twin_runtime/postgres_cap08_s5_exact_source_v1.ts'),
    product(root,'apps/server/src/persistence/calibration/postgres_calibration_governance_repository_v1.ts'),
    product(root,'apps/server/src/runtime/twin_runtime/cap08_s5_residual_calibration_shadow_service_v1.ts'),
    product(root,'apps/server/src/domain/twin_runtime/cap08_s5_residual_calibration_shadow_contracts_v1.ts'),
    product(root,'scripts/runtime_acceptance/mcft_cap08_s2_formal_provider_fixture_v1.ts'),
    product(root,'scripts/runtime_acceptance/mcft_cap08_s3_source_manifest_v1.ts'),
  ]);
  const p=Object.assign({},...modules);
  const routingByPool=new WeakMap();

  const ProductDeferred=p.Cap08DeferredScenarioPersistenceV1;
  assert.equal(typeof ProductDeferred,'function','S6_DEFERRED_PRODUCT_SERVICE_REQUIRED');
  p.Cap08DeferredScenarioPersistenceV1=class S6Cap08DeferredScenarioPersistenceV1 extends ProductDeferred{
    constructor(canonical){
      const forecastRepository=canonical?.__cap08_forecast_repository;
      const pool=forecastRepository?.pool;
      assert.ok(pool,'S6_T17_TRANSITION_POOL_BINDING_REQUIRED');
      const transitionRepository=new p.PostgresCap08S4T17TransitionRepositoryV1(pool);
      const routing=new p.Cap08S4T17RoutingPersistenceV1(canonical,transitionRepository);
      super(routing);
      this.__cap08_s4_t17_routing=routing;
      routingByPool.set(pool,routing);
    }
  };

  const ProductS4Service=p.Cap08S4AppendForwardServiceV1;
  assert.equal(typeof ProductS4Service,'function','S6_S4_PRODUCT_SERVICE_REQUIRED');
  p.Cap08S4AppendForwardServiceV1=class S6CompositeCap08S4AppendForwardServiceV1 extends ProductS4Service{
    constructor(pool,evidenceSource){
      super(pool,evidenceSource);
      this.__cap08_pool=pool;
      assert.ok(Object.prototype.hasOwnProperty.call(this,'repository'),'S6_S4_PERSISTENCE_REPOSITORY_SEAM_REQUIRED');
      this.repository=createS6S4AtomicPersistenceRepositoryV1({pool,p});
      assert.ok(Object.prototype.hasOwnProperty.call(this,'resolver'),'S6_S4_RESOLVER_SEAM_REQUIRED');
      assert.ok(Object.prototype.hasOwnProperty.call(this.resolver,'repository'),'S6_S4_RESOLVER_REPOSITORY_SEAM_REQUIRED');
      this.resolver.repository=this.repository;
    }
    async execute(input){
      const result=await super.execute(input);
      const routing=routingByPool.get(this.__cap08_pool);
      assert.ok(routing,'S6_T17_ROUTING_INSTANCE_REQUIRED');
      const expected=await routing.captureExpectedLatestBase(input.scope);
      routing.armTransition({
        formal_run_id:input.formal_run_id,
        scope:input.scope,
        lineage_id:result.authority.lineage_id,
        revision_id:result.authority.revision_id,
        t17_logical_time:result.t17_predecessor.next_logical_tick_time,
        expected_latest_base:expected,
        corrected_computation_predecessor:{
          state:{ref:result.t17_predecessor.previous_posterior_ref,hash:result.t17_predecessor.previous_posterior_hash},
          checkpoint:{ref:result.t17_predecessor.previous_checkpoint_ref,hash:result.t17_predecessor.previous_checkpoint_hash},
          forecast_result:{ref:result.t17_predecessor.previous_forecast_result_ref,hash:result.t17_predecessor.previous_forecast_result_hash},
          successful_forecast:{ref:result.t17_predecessor.latest_successful_forecast_ref,hash:result.t17_predecessor.latest_successful_forecast_hash},
          scenario_set:{ref:result.t17_predecessor.previous_scenario_set_ref,hash:result.t17_predecessor.previous_scenario_set_hash},
          previous_tick_sequence:result.t17_predecessor.previous_tick_sequence,
        },
        correction_authority:{
          authority_ref:result.authority.authority_ref,
          authority_hash:result.authority.determinism_hash,
        },
      });
      result.t17_transition_routing_armed=true;
      return result;
    }
  };
  return p;
}

module.exports={loadProduct};
