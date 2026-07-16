// scripts/runtime_acceptance/mcft_cap_06_controlled_compute_fixture_v1.ts
// Purpose: assemble the established S1 controlled graph into the exact S2 case builder, grid-search, paired-shadow, Candidate-draft, and Evaluation-draft engines for downstream Runtime acceptance.
// Boundary: deterministic acceptance fixture composition only; no production persistence, projection, Runtime authority, State, checkpoint, route, scheduler, Model Activation, or alternative calibration mathematics.

import {
  executeHourlyWaterBalanceV1,
  type HourlyWaterBalanceConfigV1,
  type HourlyWaterBalanceInputV1,
} from "../../apps/server/src/domain/soil_water/hourly_water_balance_v1.js";
import {
  formatFixedDecimalV1,
  parseFixedDecimalV1,
} from "../../apps/server/src/domain/soil_water/fixed_point_water_decimal_v1.js";
import { semanticHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import { validateCap04RuntimeConfigPayloadV1 } from "../../apps/server/src/domain/twin_runtime/forecast_scenario_runtime_config_v1.js";
import {
  CAP06_BASE_PARAMETER_VALUE_V1,
  CAP06_HOLDOUT_GENERALIZATION_CLAIM_V1,
  CAP06_HOLDOUT_PURPOSE_V1,
  CAP06_WINDOW_HASH_SEMANTICS_V1,
  type Cap06CalibrationPredictionPortV1,
  type Cap06SourceDatasetIdentityV1,
} from "../../apps/server/src/domain/calibration/contracts_v1.js";
import {
  buildCap06CaseWindowV1,
  buildCap06CaseWindowsV1,
  type Cap06BuiltCaseWindowV1,
  type Cap06CaseBuilderSourceV1,
} from "../../apps/server/src/domain/calibration/case_builder_v1.js";
import { runCap06CalibrationGridSearchV1 } from "../../apps/server/src/domain/calibration/grid_search_v1.js";
import { runCap06PairedHistoricalShadowV1 } from "../../apps/server/src/domain/calibration/shadow_evaluation_v1.js";
import {
  buildCap06CalibrationCandidateDraftV1,
  buildCap06ShadowEvaluationDraftV1,
  type Cap06CalibrationCandidateDraftV1,
  type Cap06ShadowEvaluationDraftV1,
} from "../../apps/server/src/domain/calibration/envelope_profiles_v1.js";
import {
  CAP06_S1_BASE_DRAINAGE_COEFFICIENT_V1,
  CAP06_S1_HIDDEN_DRAINAGE_COEFFICIENT_V1,
  buildCap06S1ControlledDatasetV1,
  type Cap06S1ControlledCaseV1,
  type Cap06S1ControlledDatasetV1,
} from "./mcft_cap_06_s1_residual_windows_fixture_v1.js";

type ControlledRuntimeCaseV1 = {
  source: Cap06CaseBuilderSourceV1;
  replay_input: Omit<HourlyWaterBalanceInputV1, "config">;
  base_config: HourlyWaterBalanceConfigV1;
  expected_base_storage_mm: string;
};

export type Cap06ControlledComputeFixtureV1 = {
  controlled: Cap06S1ControlledDatasetV1;
  sources: Cap06CaseBuilderSourceV1[];
  calibration_window: Cap06BuiltCaseWindowV1;
  holdout_window: Cap06BuiltCaseWindowV1;
  candidate: Cap06CalibrationCandidateDraftV1;
  evaluation: Cap06ShadowEvaluationDraftV1;
};

function fixed6V1(value: unknown, code: string): string {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(code);
  return formatFixedDecimalV1(parseFixedDecimalV1(String(value), 6, code), 6);
}

function subtractScale6V1(left: string, right: string): string {
  return formatFixedDecimalV1(
    parseFixedDecimalV1(left, 6) - parseFixedDecimalV1(right, 6),
    6,
  );
}

function configFromCaseV1(caseItem: Cap06S1ControlledCaseV1): HourlyWaterBalanceConfigV1 {
  const payload = caseItem.source_runtime_config.payload;
  validateCap04RuntimeConfigPayloadV1(payload);
  return {
    root_zone_depth_mm: fixed6V1(
      payload.soil_hydraulic_snapshot?.root_zone_depth_mm,
      "CAP06_FIXTURE_ROOT_DEPTH_REQUIRED",
    ),
    wilting_point_storage_mm: fixed6V1(
      payload.soil_hydraulic_snapshot?.wilting_point_storage_mm,
      "CAP06_FIXTURE_WILTING_STORAGE_REQUIRED",
    ),
    field_capacity_storage_mm: fixed6V1(
      payload.soil_hydraulic_snapshot?.field_capacity_storage_mm,
      "CAP06_FIXTURE_FIELD_CAPACITY_REQUIRED",
    ),
    saturation_storage_mm: fixed6V1(
      payload.soil_hydraulic_snapshot?.saturation_storage_mm,
      "CAP06_FIXTURE_SATURATION_STORAGE_REQUIRED",
    ),
    saturation_fraction: fixed6V1(
      payload.soil_hydraulic_snapshot?.saturation_fraction,
      "CAP06_FIXTURE_SATURATION_FRACTION_REQUIRED",
    ),
    runoff_fraction: fixed6V1(
      payload.dynamics_parameters?.runoff_fraction,
      "CAP06_FIXTURE_RUNOFF_REQUIRED",
    ),
    drainage_coefficient_per_hour: fixed6V1(
      payload.dynamics_parameters?.drainage_coefficient_per_hour,
      "CAP06_FIXTURE_DRAINAGE_REQUIRED",
    ),
    structural_process_stddev_mm_per_hour: fixed6V1(
      payload.process_uncertainty?.structural_process_stddev_mm_per_hour,
      "CAP06_FIXTURE_STRUCTURAL_STDDEV_REQUIRED",
    ),
    rainfall_relative_stddev: fixed6V1(
      payload.process_uncertainty?.rainfall_relative_stddev,
      "CAP06_FIXTURE_RAINFALL_STDDEV_REQUIRED",
    ),
    crop_et_relative_stddev: fixed6V1(
      payload.process_uncertainty?.crop_et_relative_stddev,
      "CAP06_FIXTURE_ET_STDDEV_REQUIRED",
    ),
    executed_irrigation_relative_stddev: fixed6V1(
      payload.process_uncertainty?.executed_irrigation_relative_stddev,
      "CAP06_FIXTURE_IRRIGATION_STDDEV_REQUIRED",
    ),
  };
}

function runtimeCaseV1(caseItem: Cap06S1ControlledCaseV1): ControlledRuntimeCaseV1 {
  const residualPayload = caseItem.residual.payload;
  const forecastPayload = caseItem.source_forecast.payload as Record<string, unknown>;
  const baseConfig = configFromCaseV1(caseItem);
  if (baseConfig.drainage_coefficient_per_hour !== CAP06_S1_BASE_DRAINAGE_COEFFICIENT_V1) {
    throw new Error("CAP06_FIXTURE_BASE_DRAINAGE_MISMATCH");
  }
  const replayInput: Omit<HourlyWaterBalanceInputV1, "config"> = {
    interval_start_exclusive: caseItem.forecast_point.interval_start,
    interval_end_inclusive: caseItem.forecast_point.interval_end,
    previous_storage_mm_decimal: caseItem.forecast_point.previous_storage_mm,
    previous_variance_basis: {
      basis_origin: "CARRIED_FROM_PREVIOUS_CONTINUATION_STATE",
      previous_state_ref: String(forecastPayload.source_posterior_ref),
      previous_storage_variance_mm2_decimal: "0.000000000000",
    },
    gross_rainfall_mm_decimal: caseItem.forecast_point.gross_precipitation_assumption_mm,
    historical_et0_mm_decimal: caseItem.forecast_point.reference_et0_mm,
    crop_stage_code: caseItem.forecast_point.crop_stage_code,
    kc_decimal: caseItem.forecast_point.kc,
    executed_irrigation_candidates: [],
  };
  const baseReplay = executeHourlyWaterBalanceV1({ ...replayInput, config: baseConfig });
  if (baseReplay.mass_balance_trace.next_storage_mm !== caseItem.forecast_point.storage_mean_mm) {
    throw new Error("CAP06_FIXTURE_BASE_REPLAY_MISMATCH");
  }
  const capacitySpan = subtractScale6V1(
    baseConfig.saturation_storage_mm,
    baseConfig.field_capacity_storage_mm,
  );
  const excess = subtractScale6V1(
    baseReplay.mass_balance_trace.storage_before_drainage_mm,
    baseConfig.field_capacity_storage_mm,
  );
  return {
    source: {
      case_index: caseItem.case_index,
      scope: {
        tenant_id: caseItem.source_forecast.tenant_id,
        project_id: caseItem.source_forecast.project_id,
        group_id: caseItem.source_forecast.group_id,
        field_id: caseItem.source_forecast.field_id,
        season_id: caseItem.source_forecast.season_id,
        zone_id: caseItem.source_forecast.zone_id,
      },
      residual_ref: caseItem.residual.object_id,
      residual_hash: caseItem.residual.determinism_hash,
      source_forecast_ref: caseItem.source_forecast.object_id,
      source_forecast_hash: caseItem.source_forecast.determinism_hash,
      source_forecast_point_ref: residualPayload.forecast_point_ref,
      source_forecast_point_hash: residualPayload.forecast_point_hash,
      source_posterior_ref: String(forecastPayload.source_posterior_ref),
      source_posterior_hash: String(forecastPayload.source_posterior_hash),
      source_runtime_config_ref: caseItem.source_runtime_config.object_id,
      source_runtime_config_hash: caseItem.source_runtime_config.determinism_hash,
      source_runtime_config_logical_time: caseItem.source_runtime_config.logical_time,
      actual_observation_ref: residualPayload.actual_observation_ref,
      actual_observation_hash: residualPayload.actual_observation_hash,
      forecast_issued_at: residualPayload.forecast_issued_at,
      forecast_as_of: caseItem.source_forecast.as_of,
      forecast_evidence_cutoff: caseItem.source_evidence_window.as_of,
      forecast_target_time: residualPayload.forecast_target_time,
      observation_observed_at: residualPayload.actual_observation_observed_at,
      observation_available_to_runtime_at: residualPayload.observation_available_to_runtime_at,
      actual_observation_vwc: residualPayload.actual_observation_value,
      base_prediction_vwc: residualPayload.predicted_observation_value,
      excess_above_field_capacity_mm: excess,
      saturation_minus_field_capacity_mm: capacitySpan,
      context_lineage_ref: String(caseItem.residual.context_lineage_ref),
      context_revision_ref: String(caseItem.residual.context_revision_ref),
      model_component_hash: caseItem.model_component_hash,
      effective_parameter_bundle_hash: caseItem.effective_parameter_bundle_hash,
      observation_operator_hash: caseItem.observation_operator_hash,
      geometry_hash: caseItem.geometry_hash,
      runtime_replay_numeric_policy_hash: caseItem.runtime_replay_numeric_policy_hash,
      case_input_hash: semanticHashV1({
        replay_input: replayInput,
        base_config: baseConfig,
        forecast_point_ref: residualPayload.forecast_point_ref,
        forecast_point_hash: residualPayload.forecast_point_hash,
        observation_ref: residualPayload.actual_observation_ref,
        observation_hash: residualPayload.actual_observation_hash,
      }),
    },
    replay_input: replayInput,
    base_config: baseConfig,
    expected_base_storage_mm: caseItem.forecast_point.storage_mean_mm,
  };
}

function predictionPortV1(
  runtimeByResidual: ReadonlyMap<string, ControlledRuntimeCaseV1>,
): Cap06CalibrationPredictionPortV1 {
  return {
    predictCase(caseItem, parameterValue) {
      const runtime = runtimeByResidual.get(caseItem.residual_ref);
      if (!runtime) throw new Error(`CAP06_FIXTURE_RUNTIME_CASE_REQUIRED:${caseItem.residual_ref}`);
      const result = executeHourlyWaterBalanceV1({
        ...runtime.replay_input,
        config: {
          ...runtime.base_config,
          drainage_coefficient_per_hour: parameterValue,
        },
      });
      return {
        prediction_vwc: result.published_state.root_zone_vwc_fraction.mean,
        storage_mm: result.mass_balance_trace.next_storage_mm,
        mass_balance_hash: result.mass_balance_trace_hash,
        base_trace_match: parameterValue !== CAP06_BASE_PARAMETER_VALUE_V1
          || result.mass_balance_trace.next_storage_mm === runtime.expected_base_storage_mm,
        physical_invariant_status: "PASS",
        mass_balance_status: result.mass_balance_trace.mass_balance_error_mm === "0.000000"
          ? "PASS"
          : "FAIL",
      };
    },
  };
}

function sourceIdentityV1(controlled: Cap06S1ControlledDatasetV1): Cap06SourceDatasetIdentityV1 {
  return {
    residual_set_hash: controlled.residual_set_hash,
    case_input_set_hash: controlled.case_input_set_hash,
    calibration_window_hash: controlled.calibration_window_hash,
    holdout_window_hash: controlled.holdout_window_hash,
    window_hash_semantics: CAP06_WINDOW_HASH_SEMANTICS_V1,
    holdout_purpose: CAP06_HOLDOUT_PURPOSE_V1,
    holdout_generalization_claim: CAP06_HOLDOUT_GENERALIZATION_CLAIM_V1,
  };
}

export async function buildCap06ControlledComputeFixtureV1(): Promise<Cap06ControlledComputeFixtureV1> {
  const controlled = await buildCap06S1ControlledDatasetV1();
  if (controlled.cases.length !== 24) throw new Error("CAP06_FIXTURE_CASE_COUNT_INVALID");
  const runtimeCases = controlled.cases.map(runtimeCaseV1);
  const sources = runtimeCases.map((item) => item.source);
  const sourcesByRef = new Map(sources.map((item) => [item.residual_ref, item]));
  const identity = sourceIdentityV1(controlled);
  const calibrationWindow = buildCap06CaseWindowV1({
    role: "CALIBRATION",
    orderedResidualRefs: controlled.calibration_window_refs,
    loadedCases: controlled.calibration_window_refs.map((ref) => {
      const source = sourcesByRef.get(ref);
      if (!source) throw new Error(`CAP06_FIXTURE_CALIBRATION_SOURCE_MISSING:${ref}`);
      return source;
    }),
    sourceDatasetIdentity: identity,
  });
  const holdoutWindow = buildCap06CaseWindowV1({
    role: "HOLDOUT",
    orderedResidualRefs: controlled.holdout_window_refs,
    loadedCases: controlled.holdout_window_refs.map((ref) => {
      const source = sourcesByRef.get(ref);
      if (!source) throw new Error(`CAP06_FIXTURE_HOLDOUT_SOURCE_MISSING:${ref}`);
      return source;
    }),
    sourceDatasetIdentity: identity,
  });
  buildCap06CaseWindowsV1({
    calibration: calibrationWindow,
    holdout: holdoutWindow,
  });
  const predictionPort = predictionPortV1(
    new Map(runtimeCases.map((item) => [item.source.residual_ref, item])),
  );
  const attempt = await runCap06CalibrationGridSearchV1({
    calibrationWindow,
    predictionPort,
  });
  if (attempt.status !== "BOUNDED_PARAMETER_DELTA_CANDIDATE"
    || attempt.selected_parameter_value !== CAP06_S1_HIDDEN_DRAINAGE_COEFFICIENT_V1) {
    throw new Error("CAP06_FIXTURE_POSITIVE_CANDIDATE_REQUIRED");
  }
  const candidate = buildCap06CalibrationCandidateDraftV1({
    calibrationWindow,
    attempt,
  });
  const shadow = await runCap06PairedHistoricalShadowV1({
    holdoutWindow,
    candidateParameterValue: String(candidate.payload.candidate_parameter_value),
    predictionPort,
  });
  if (shadow.evaluation_disposition !== "ELIGIBLE_FOR_HUMAN_ACTIVATION_REVIEW") {
    throw new Error("CAP06_FIXTURE_POSITIVE_SHADOW_REQUIRED");
  }
  const evaluation = buildCap06ShadowEvaluationDraftV1({
    holdoutWindow,
    candidate,
    shadow,
  });
  return {
    controlled,
    sources,
    calibration_window: calibrationWindow,
    holdout_window: holdoutWindow,
    candidate,
    evaluation,
  };
}
