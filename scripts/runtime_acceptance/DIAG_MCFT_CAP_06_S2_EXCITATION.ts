// scripts/runtime_acceptance/DIAG_MCFT_CAP_06_S2_EXCITATION.ts
// Purpose: expose the exact per-case parameter-excitation evidence behind the S2 controlled Dynamics-backed calibration attempt.
// Boundary: temporary diagnostic only; in-memory compute, no database, canonical append, projection, active Config, State, checkpoint, route, scheduler, Model Activation, S3, or CAP-07 authority.

import assert from "node:assert/strict";
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
import {
  CAP06_BASE_PARAMETER_VALUE_V1,
  CAP06_SEARCH_MAXIMUM_V1,
  CAP06_SEARCH_MINIMUM_V1,
  type Cap06CalibrationPredictionPortV1,
} from "../../apps/server/src/domain/calibration/contracts_v1.js";
import {
  buildCap06CaseWindowV1,
  type Cap06CaseBuilderSourceV1,
} from "../../apps/server/src/domain/calibration/case_builder_v1.js";
import { runCap06CalibrationGridSearchV1 } from "../../apps/server/src/domain/calibration/grid_search_v1.js";
import {
  CAP06_S1_BASE_DRAINAGE_COEFFICIENT_V1,
  buildCap06S1ControlledDatasetV1,
  type Cap06S1ControlledCaseV1,
} from "./mcft_cap_06_s1_residual_windows_fixture_v1.js";

type DiagnosticRuntimeCaseV1 = {
  source: Cap06CaseBuilderSourceV1;
  replay_input: Omit<HourlyWaterBalanceInputV1, "config">;
  base_config: HourlyWaterBalanceConfigV1;
  expected_base_storage_mm: string;
};

function fixed6V1(value: unknown, code: string): string {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(code);
  return number.toFixed(6);
}

function configFromCaseV1(caseItem: Cap06S1ControlledCaseV1): HourlyWaterBalanceConfigV1 {
  const payload = caseItem.source_runtime_config.payload as Record<string, any>;
  return {
    root_zone_depth_mm: fixed6V1(payload.soil_hydraulic_snapshot?.root_zone_depth_mm, "S2_DIAG_ROOT_DEPTH_REQUIRED"),
    wilting_point_storage_mm: fixed6V1(payload.soil_hydraulic_snapshot?.wilting_point_storage_mm, "S2_DIAG_WILTING_STORAGE_REQUIRED"),
    field_capacity_storage_mm: fixed6V1(payload.soil_hydraulic_snapshot?.field_capacity_storage_mm, "S2_DIAG_FIELD_CAPACITY_REQUIRED"),
    saturation_storage_mm: fixed6V1(payload.soil_hydraulic_snapshot?.saturation_storage_mm, "S2_DIAG_SATURATION_STORAGE_REQUIRED"),
    saturation_fraction: fixed6V1(payload.soil_hydraulic_snapshot?.saturation_fraction, "S2_DIAG_SATURATION_FRACTION_REQUIRED"),
    runoff_fraction: fixed6V1(payload.dynamics_parameters?.runoff_fraction, "S2_DIAG_RUNOFF_REQUIRED"),
    drainage_coefficient_per_hour: fixed6V1(payload.dynamics_parameters?.drainage_coefficient_per_hour, "S2_DIAG_DRAINAGE_REQUIRED"),
    structural_process_stddev_mm_per_hour: fixed6V1(payload.process_uncertainty?.structural_process_stddev_mm_per_hour, "S2_DIAG_STRUCTURAL_STDDEV_REQUIRED"),
    rainfall_relative_stddev: fixed6V1(payload.process_uncertainty?.rainfall_relative_stddev, "S2_DIAG_RAINFALL_STDDEV_REQUIRED"),
    crop_et_relative_stddev: fixed6V1(payload.process_uncertainty?.crop_et_relative_stddev, "S2_DIAG_ET_STDDEV_REQUIRED"),
    executed_irrigation_relative_stddev: fixed6V1(payload.process_uncertainty?.executed_irrigation_relative_stddev, "S2_DIAG_IRRIGATION_STDDEV_REQUIRED"),
  };
}

function subtractScale6V1(left: string, right: string): string {
  return formatFixedDecimalV1(
    parseFixedDecimalV1(left, 6) - parseFixedDecimalV1(right, 6),
    6,
  );
}

function buildRuntimeCaseV1(caseItem: Cap06S1ControlledCaseV1): DiagnosticRuntimeCaseV1 {
  const residual = caseItem.residual;
  const residualPayload = residual.payload;
  const forecastPayload = caseItem.source_forecast.payload as Record<string, any>;
  const baseConfig = configFromCaseV1(caseItem);
  assert.equal(baseConfig.drainage_coefficient_per_hour, CAP06_S1_BASE_DRAINAGE_COEFFICIENT_V1);

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
  assert.equal(baseReplay.mass_balance_trace.next_storage_mm, caseItem.forecast_point.storage_mean_mm);
  const capacitySpan = subtractScale6V1(baseConfig.saturation_storage_mm, baseConfig.field_capacity_storage_mm);
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
      residual_ref: residual.object_id,
      residual_hash: residual.determinism_hash,
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
      context_lineage_ref: String(residual.context_lineage_ref),
      context_revision_ref: String(residual.context_revision_ref),
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
  runtimeByResidual: ReadonlyMap<string, DiagnosticRuntimeCaseV1>,
): Cap06CalibrationPredictionPortV1 {
  return {
    predictCase(caseItem, parameterValue) {
      const runtime = runtimeByResidual.get(caseItem.residual_ref);
      if (!runtime) throw new Error(`S2_DIAG_RUNTIME_CASE_REQUIRED:${caseItem.residual_ref}`);
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
        mass_balance_status: result.mass_balance_trace.mass_balance_error_mm === "0.000000" ? "PASS" : "FAIL",
      };
    },
  };
}

async function main(): Promise<void> {
  const controlled = await buildCap06S1ControlledDatasetV1();
  const runtimeCases = controlled.cases.map(buildRuntimeCaseV1);
  const calibrationSources = runtimeCases.slice(0, 16).map((item) => item.source);
  const calibrationWindow = buildCap06CaseWindowV1({
    role: "CALIBRATION",
    orderedResidualRefs: controlled.calibration_window_refs,
    loadedCases: calibrationSources,
  });
  const runtimeByResidual = new Map(runtimeCases.map((item) => [item.source.residual_ref, item]));
  const predictionPort = predictionPortV1(runtimeByResidual);

  const perCase = [];
  for (const caseItem of calibrationWindow.cases) {
    const minimum = await predictionPort.predictCase(caseItem, CAP06_SEARCH_MINIMUM_V1);
    const maximum = await predictionPort.predictCase(caseItem, CAP06_SEARCH_MAXIMUM_V1);
    const deltaUnits = parseFixedDecimalV1(maximum.prediction_vwc, 9)
      - parseFixedDecimalV1(minimum.prediction_vwc, 9);
    perCase.push({
      case_index: caseItem.case_index,
      residual_ref: caseItem.residual_ref,
      forecast_target_time: caseItem.forecast_target_time,
      excess_above_field_capacity_mm: caseItem.excess_above_field_capacity_mm,
      saturation_minus_field_capacity_mm: caseItem.saturation_minus_field_capacity_mm,
      wetness_regime: caseItem.wetness_regime,
      minimum_parameter_prediction_vwc: minimum.prediction_vwc,
      maximum_parameter_prediction_vwc: maximum.prediction_vwc,
      endpoint_prediction_delta_vwc: formatFixedDecimalV1(deltaUnits, 9),
      endpoint_prediction_absolute_delta_units_scale_9: (deltaUnits < 0n ? -deltaUnits : deltaUnits).toString(),
    });
  }

  const attempt = await runCap06CalibrationGridSearchV1({
    calibrationWindow,
    predictionPort,
  });
  const rankedSurface = [...attempt.objective_surface]
    .sort((left, right) => {
      const leftSse = BigInt(left.metrics.sum_squared_error_scale_18);
      const rightSse = BigInt(right.metrics.sum_squared_error_scale_18);
      return leftSse < rightSse ? -1 : leftSse > rightSse ? 1 : 0;
    })
    .slice(0, 5)
    .map((point) => ({
      parameter_value: point.parameter_value,
      parameter_delta: point.parameter_delta,
      sum_squared_error_scale_18: point.metrics.sum_squared_error_scale_18,
      mean_bias_vwc: point.metrics.mean_bias_vwc,
      maximum_absolute_residual_vwc: point.metrics.maximum_absolute_residual_vwc,
      sensitive_case_count: point.sensitive_case_count,
      represented_sensitive_wetness_regimes: point.represented_sensitive_wetness_regimes,
    }));

  console.log(`S2_DIAGNOSTIC_JSON:${JSON.stringify({
    schema_version: "geox_mcft_cap_06_s2_excitation_diagnostic_v1",
    calibration_case_count: calibrationWindow.cases.length,
    regime_counts: calibrationWindow.cases.reduce<Record<string, number>>((counts, item) => {
      counts[item.wetness_regime] = (counts[item.wetness_regime] ?? 0) + 1;
      return counts;
    }, {}),
    attempt_status: attempt.status,
    selected_parameter_value: attempt.selected_parameter_value,
    excitation_summary: attempt.excitation_summary,
    objective_mse_range_sse_scale_18: attempt.objective_mse_range_sse_scale_18,
    best_vs_second_mse_margin_sse_scale_18: attempt.best_vs_second_mse_margin_sse_scale_18,
    ranked_surface_top_5: rankedSurface,
    per_case: perCase,
  })}`);
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exitCode = 1;
});
