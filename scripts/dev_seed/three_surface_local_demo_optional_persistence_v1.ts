// Purpose: materialize optional Scenario, Residual, calibration governance, and health pointers for the local demo.
// Boundary: rebuildable projections and pointers only; no Model Activation, active-config switch, or production authority.

import type { PoolClient } from "pg";
import { type DemoBundle, factId, member } from "./three_surface_local_demo_contract_v1.js";

export async function persistOptionalDomain(client: PoolClient, bundle: DemoBundle): Promise<void> {
  const { scope, root } = bundle;
  const health = member(root, "twin_runtime_health_v1");
  const scenarioPayload = bundle.scenario.payload;
  await client.query(
    `INSERT INTO public.twin_scenario_set_projection_v1(
       scenario_set_id,tenant_id,project_id,group_id,field_id,season_id,zone_id,
       lineage_id,revision_id,logical_time,source_forecast_ref,source_forecast_hash,
       source_posterior_ref,source_posterior_hash,runtime_config_ref,runtime_config_hash,
       scenario_policy_id,option_count,determinism_hash,canonical_payload,source_fact_id
     ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20::jsonb,$21)
     ON CONFLICT (scenario_set_id) DO UPDATE SET
       logical_time=EXCLUDED.logical_time,determinism_hash=EXCLUDED.determinism_hash,
       canonical_payload=EXCLUDED.canonical_payload,source_fact_id=EXCLUDED.source_fact_id`,
    [
      bundle.scenario.object_id, scope.tenant_id, scope.project_id, scope.group_id, scope.field_id, scope.season_id, scope.zone_id,
      bundle.scenario.lineage_id, bundle.scenario.revision_id, bundle.scenario.logical_time,
      scenarioPayload.source_forecast_ref, scenarioPayload.source_forecast_hash,
      scenarioPayload.source_posterior_ref, scenarioPayload.source_posterior_hash,
      bundle.scenario.runtime_config_ref, bundle.scenario.runtime_config_hash,
      scenarioPayload.scenario_policy_id, scenarioPayload.option_count,
      bundle.scenario.determinism_hash, JSON.stringify(scenarioPayload), factId(bundle.scenario.object_id),
    ],
  );
  await client.query(
    `INSERT INTO public.twin_scenario_latest_index_v1(
       tenant_id,project_id,group_id,field_id,season_id,zone_id,scenario_set_id,
       source_forecast_ref,source_forecast_hash,logical_time,determinism_hash,source_fact_id
     ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     ON CONFLICT (tenant_id,project_id,group_id,field_id,season_id,zone_id) DO UPDATE SET
       scenario_set_id=EXCLUDED.scenario_set_id,source_forecast_ref=EXCLUDED.source_forecast_ref,
       source_forecast_hash=EXCLUDED.source_forecast_hash,logical_time=EXCLUDED.logical_time,
       determinism_hash=EXCLUDED.determinism_hash,source_fact_id=EXCLUDED.source_fact_id`,
    [
      scope.tenant_id, scope.project_id, scope.group_id, scope.field_id, scope.season_id, scope.zone_id,
      bundle.scenario.object_id, scenarioPayload.source_forecast_ref, scenarioPayload.source_forecast_hash,
      bundle.scenario.logical_time, bundle.scenario.determinism_hash, factId(bundle.scenario.object_id),
    ],
  );

  const residualPayload = bundle.residual.payload;
  await client.query(
    `INSERT INTO public.twin_forecast_residual_projection_v1(
       residual_object_id,tenant_id,project_id,group_id,field_id,season_id,zone_id,logical_time,as_of,
       forecast_run_ref,forecast_run_hash,forecast_point_ref,forecast_point_hash,
       actual_observation_ref,actual_observation_hash,predicted_observation_value,predicted_observation_variance,
       actual_observation_value,actual_observation_variance,representativeness_variance,residual_value,normalized_residual,
       assimilation_update_ref,assimilation_update_hash,determinism_hash,canonical_payload,source_fact_id
     ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26::jsonb,$27)
     ON CONFLICT (residual_object_id) DO UPDATE SET
       logical_time=EXCLUDED.logical_time,determinism_hash=EXCLUDED.determinism_hash,
       canonical_payload=EXCLUDED.canonical_payload,source_fact_id=EXCLUDED.source_fact_id`,
    [
      bundle.residual.object_id, scope.tenant_id, scope.project_id, scope.group_id, scope.field_id, scope.season_id, scope.zone_id,
      bundle.residual.logical_time, bundle.residual.as_of,
      residualPayload.forecast_run_ref, residualPayload.forecast_run_hash,
      residualPayload.forecast_point_ref, residualPayload.forecast_point_hash,
      residualPayload.actual_observation_ref, residualPayload.actual_observation_hash,
      residualPayload.predicted_observation_value, residualPayload.predicted_observation_variance,
      residualPayload.actual_observation_value, residualPayload.actual_observation_variance,
      residualPayload.representativeness_variance, residualPayload.residual_value, residualPayload.normalized_residual,
      residualPayload.assimilation_update_ref, residualPayload.assimilation_update_hash,
      bundle.residual.determinism_hash, JSON.stringify(residualPayload), factId(bundle.residual.object_id),
    ],
  );

  const candidatePayload = bundle.calibration_candidate.payload;
  await client.query(
    `INSERT INTO public.twin_calibration_candidate_projection_v1(
       candidate_object_id,tenant_id,project_id,group_id,field_id,season_id,zone_id,logical_time,as_of,
       candidate_status,base_config_ref,base_config_hash,context_lineage_ref,context_revision_ref,
       parameter_key,base_parameter_value,candidate_parameter_value,parameter_delta,activation_status,
       eligible_for_state_input,eligible_for_runtime_config_use,eligible_for_human_activation_review,
       determinism_hash,canonical_payload,source_fact_id
     ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24::jsonb,$25)
     ON CONFLICT (candidate_object_id) DO UPDATE SET
       logical_time=EXCLUDED.logical_time,determinism_hash=EXCLUDED.determinism_hash,
       canonical_payload=EXCLUDED.canonical_payload,source_fact_id=EXCLUDED.source_fact_id`,
    [
      bundle.calibration_candidate.object_id, scope.tenant_id, scope.project_id, scope.group_id, scope.field_id, scope.season_id, scope.zone_id,
      bundle.calibration_candidate.logical_time, bundle.calibration_candidate.as_of,
      candidatePayload.candidate_status, candidatePayload.base_config_ref, candidatePayload.base_config_hash,
      bundle.calibration_candidate.context_lineage_ref, bundle.calibration_candidate.context_revision_ref,
      candidatePayload.parameter_key, candidatePayload.base_parameter_value, candidatePayload.candidate_parameter_value,
      candidatePayload.parameter_delta, candidatePayload.activation_status,
      candidatePayload.eligible_for_state_input, candidatePayload.eligible_for_runtime_config_use,
      candidatePayload.eligible_for_human_activation_review,
      bundle.calibration_candidate.determinism_hash, JSON.stringify(candidatePayload), factId(bundle.calibration_candidate.object_id),
    ],
  );

  const evaluationPayload = bundle.shadow_evaluation.payload;
  await client.query(
    `INSERT INTO public.twin_shadow_evaluation_projection_v1(
       evaluation_object_id,tenant_id,project_id,group_id,field_id,season_id,zone_id,logical_time,as_of,
       candidate_ref,candidate_hash,evaluation_dataset_hash,evaluation_policy_hash,shadow_replay_engine_id,
       calibration_metric_numeric_policy_hash,evaluation_disposition,eligible_for_human_activation_review,
       determinism_hash,canonical_payload,source_fact_id
     ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19::jsonb,$20)
     ON CONFLICT (evaluation_object_id) DO UPDATE SET
       logical_time=EXCLUDED.logical_time,determinism_hash=EXCLUDED.determinism_hash,
       canonical_payload=EXCLUDED.canonical_payload,source_fact_id=EXCLUDED.source_fact_id`,
    [
      bundle.shadow_evaluation.object_id, scope.tenant_id, scope.project_id, scope.group_id, scope.field_id, scope.season_id, scope.zone_id,
      bundle.shadow_evaluation.logical_time, bundle.shadow_evaluation.as_of,
      evaluationPayload.candidate_ref, evaluationPayload.candidate_hash,
      evaluationPayload.evaluation_dataset_hash, evaluationPayload.evaluation_policy_hash,
      evaluationPayload.shadow_replay_engine_id, evaluationPayload.calibration_metric_numeric_policy_hash,
      evaluationPayload.evaluation_disposition, evaluationPayload.eligible_for_human_activation_review,
      bundle.shadow_evaluation.determinism_hash, JSON.stringify(evaluationPayload), factId(bundle.shadow_evaluation.object_id),
    ],
  );

  await client.query(
    `INSERT INTO public.twin_runtime_health_latest_index_v1(
       tenant_id,project_id,group_id,field_id,season_id,zone_id,health_object_id,operation_status,
       logical_time,determinism_hash,source_fact_id
     ) VALUES($1,$2,$3,$4,$5,$6,$7,'COMPLETED_WITH_LIMITATIONS',$8,$9,$10)
     ON CONFLICT (tenant_id,project_id,group_id,field_id,season_id,zone_id) DO UPDATE SET
       health_object_id=EXCLUDED.health_object_id,operation_status=EXCLUDED.operation_status,
       logical_time=EXCLUDED.logical_time,determinism_hash=EXCLUDED.determinism_hash,source_fact_id=EXCLUDED.source_fact_id`,
    [
      scope.tenant_id, scope.project_id, scope.group_id, scope.field_id, scope.season_id, scope.zone_id,
      health.object_id, health.logical_time, health.determinism_hash, factId(health.object_id),
    ],
  );
}
