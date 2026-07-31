'use strict';
const {product}=require('./shared_v1.cjs');
async function loadProduct(root){
  const modules=await Promise.all([
    product(root,'apps/server/src/domain/soil_water/hourly_water_balance_v1.ts'),
    product(root,'apps/server/src/domain/twin_runtime/canonical_identity_v1.ts'),
    product(root,'apps/server/src/domain/twin_runtime/cap08_phase_engine_contracts_v1.ts'),
    product(root,'apps/server/src/domain/twin_runtime/cap08_s2_formal_provider_contracts_v1.ts'),
    product(root,'apps/server/src/domain/twin_runtime/cap08_s3_formal_provider_contracts_v1.ts'),
    product(root,'apps/server/src/domain/twin_runtime/runtime_config_execution_view_v1.ts'),
    product(root,'apps/server/src/persistence/twin_runtime/postgres_action_feedback_tick_source_v1.ts'),
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
  return Object.assign({},...modules);
}

module.exports={loadProduct};
