'use strict';
const {readJson}=require('./shared_v1.cjs');
function persistenceAdapter(runtimeRepository,forecastRepository){
  return{
    __cap08_runtime_repository:runtimeRepository,
    __cap08_forecast_repository:forecastRepository,
    acquireLease:runtimeRepository.acquireLease.bind(runtimeRepository),
    lookupARecordSet:forecastRepository.lookupARecordSet.bind(forecastRepository),
    commitARecordSet:forecastRepository.commitARecordSet.bind(forecastRepository),
    readARecordSet:forecastRepository.readARecordSet.bind(forecastRepository),
    lookupScenarioSet:forecastRepository.lookupScenarioSet.bind(forecastRepository),
    commitScenarioSet:forecastRepository.commitScenarioSet.bind(forecastRepository),
    readScenarioSet:forecastRepository.readScenarioSet.bind(forecastRepository),
    readScenarioSetBySourceForecast:forecastRepository.readScenarioSetBySourceForecast.bind(forecastRepository),
    detectPendingScenario:forecastRepository.detectPendingScenario.bind(forecastRepository),
    rebuildForecastProjections:forecastRepository.rebuildForecastProjections.bind(forecastRepository),
    rebuildScenarioProjections:forecastRepository.rebuildScenarioProjections.bind(forecastRepository),
  };
}

function evidenceAuthorities(root){
  const consumption=readJson(root,'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S5-PREDECESSOR-CONSUMPTION-V1.json');
  return{
    predecessor:{
      effective_status:consumption.historical_s4_effective_status,
      effective_next_slice:'S5',
      status_context:'mcft-cap-08/s4-exact-sha-attestation',
      retention_class:'R1_180_DAYS',
      merge_subject_sha:consumption.historical_s4_subject_sha,
      candidate_head_sha:'a8c8abccbe2ab25dad5f0fa4a9653269f6c4acc4',
      candidate_tree_sha:'4c14fc80a291e6f4fd8cb61a13a8ba2926aa0e1a',
      merge_tree_sha:'4c14fc80a291e6f4fd8cb61a13a8ba2926aa0e1a',
      candidate_to_merge_tree_delta:0,
      exact_sha_workflow_run_id:consumption.historical_s4_workflow_run_id,
      artifact_id:consumption.historical_s4_artifact_id,
      artifact_digest:'sha256:07bfabbe6ac0a108768cb6c8b83000cf28a133483bc6c59a07757ca5ba55625c',
      semantic_artifact_digest:consumption.historical_s4_semantic_artifact_digest,
      artifact_readback_verified:true,
    },
    prequalification:{
      effective_status:'REPLAY_DATASET_V2_PREQUALIFICATION_EFFECTIVE',
      status_context:consumption.required_status_context,
      subject_sha:consumption.source_merge_subject_sha,
      workflow_run_id:consumption.source_exact_sha_workflow_run_id,
      artifact_id:consumption.source_artifact_id,
      artifact_digest:consumption.source_artifact_digest,
      semantic_artifact_digest:consumption.source_semantic_artifact_digest,
      database_semantic_digest:consumption.source_database_semantic_digest,
      retention_level:consumption.required_retention_level,
      readback_verified:consumption.source_artifact_readback_verified,
      locked_version_delete_denied:consumption.source_locked_version_delete_denied,
      residual_count:24,
      calibration_case_count:16,
      holdout_case_count:8,
      objective_case_count:15,
      diagnostic_only_case_count:1,
      selected_parameter_value:'0.034000',
      selected_parameter_delta:'0.004000',
      sensitive_case_count:7,
      sensitive_wetness_regimes:['HIGH_EXCESS','MID_EXCESS'],
      candidate_append_count:0,
      shadow_append_count:0,
      s5_formal_candidate_authorized:true,
      s6_implementation_authorized:false,
    },
  };
}

module.exports={persistenceAdapter,evidenceAuthorities};
