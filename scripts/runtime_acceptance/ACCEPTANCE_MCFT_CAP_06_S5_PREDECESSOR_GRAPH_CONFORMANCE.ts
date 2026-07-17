// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S5_PREDECESSOR_GRAPH_CONFORMANCE.ts
// Purpose: prove the append-only controlled V2 profile satisfies the frozen S5 exact authority graph, valid non-zero availability latency, and unchanged S2 calibration mathematics.
// Boundary: deterministic in-memory acceptance only; no database, canonical append, projection, activation, active-config switch, State/checkpoint mutation, route, Web, scheduler, or CAP-07 authority.

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
import {
  CAP04_RUNTIME_CONFIG_PURPOSE_V1,
  validateCap04RuntimeConfigPayloadV1,
} from "../../apps/server/src/domain/twin_runtime/forecast_scenario_runtime_config_v1.js";
import { CAP05_RUNTIME_CONFIG_PURPOSE_V1 } from "../../apps/server/src/domain/twin_runtime/feedback_runtime_config_v1.js";
import { assembleResolvedForecastObservationCaseV1 } from "../../apps/server/src/domain/twin_runtime/resolved_forecast_observation_case_v1.js";
import { Cap04OrCap05ExecutionConfigResolverV1 } from "../../apps/server/src/runtime/twin_runtime/cap04_or_cap05_execution_config_resolver_v1.js";
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
} from "../../apps/server/src/domain/calibration/case_builder_v1.js";
import { runCap06CalibrationGridSearchV1 } from "../../apps/server/src/domain/calibration/grid_search_v1.js";
import {
  CAP06_S1_BASE_DRAINAGE_COEFFICIENT_V1,
  CAP06_S1_HIDDEN_DRAINAGE_COEFFICIENT_V1,
} from "./mcft_cap_06_s1_residual_windows_fixture_v1.js";
import { buildCap05EffectiveRuntimeConfigFromCap04FixtureV1 } from "./mcft_cap_05_effective_runtime_config_fixture_v1.js";
import {
  CAP06_S5_GRAPH_PROFILE_ID_V2,
  buildCap06S5GraphConformantDatasetV2,
  type Cap06S5GraphConformantCaseV2,
} from "./mcft_cap_06_s5_graph_conformant_fixture_v2.js";

function fixed6V1(value: unknown, code: string): string {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(code);
  return formatFixedDecimalV1(parseFixedDecimalV1(String(value), 6, code), 6);
}

function replayConfigV1(item: Cap06S5GraphConformantCaseV2): HourlyWaterBalanceConfigV1 {
  const payload = item.source_runtime_config.payload;
  validateCap04RuntimeConfigPayloadV1(payload);
  return {
    root_zone_depth_mm: fixed6V1(payload.soil_hydraulic_snapshot?.root_zone_depth_mm, "CAP06_S5_GRAPH_ROOT_DEPTH_REQUIRED"),
    wilting_point_storage_mm: fixed6V1(payload.soil_hydraulic_snapshot?.wilting_point_storage_mm, "CAP06_S5_GRAPH_WILTING_REQUIRED"),
    field_capacity_storage_mm: fixed6V1(payload.soil_hydraulic_snapshot?.field_capacity_storage_mm, "CAP06_S5_GRAPH_FIELD_CAPACITY_REQUIRED"),
    saturation_storage_mm: fixed6V1(payload.soil_hydraulic_snapshot?.saturation_storage_mm, "CAP06_S5_GRAPH_SATURATION_REQUIRED"),
    saturation_fraction: fixed6V1(payload.soil_hydraulic_snapshot?.saturation_fraction, "CAP06_S5_GRAPH_SATURATION_FRACTION_REQUIRED"),
    runoff_fraction: fixed6V1(payload.dynamics_parameters?.runoff_fraction, "CAP06_S5_GRAPH_RUNOFF_REQUIRED"),
    drainage_coefficient_per_hour: fixed6V1(payload.dynamics_parameters?.drainage_coefficient_per_hour, "CAP06_S5_GRAPH_DRAINAGE_REQUIRED"),
    structural_process_stddev_mm_per_hour: fixed6V1(payload.process_uncertainty?.structural_process_stddev_mm_per_hour, "CAP06_S5_GRAPH_STRUCTURAL_STDDEV_REQUIRED"),
    rainfall_relative_stddev: fixed6V1(payload.process_uncertainty?.rainfall_relative_stddev, "CAP06_S5_GRAPH_RAINFALL_STDDEV_REQUIRED"),
    crop_et_relative_stddev: fixed6V1(payload.process_uncertainty?.crop_et_relative_stddev, "CAP06_S5_GRAPH_ET_STDDEV_REQUIRED"),
    executed_irrigation_relative_stddev: fixed6V1(payload.process_uncertainty?.executed_irrigation_relative_stddev, "CAP06_S5_GRAPH_IRRIGATION_STDDEV_REQUIRED"),
  };
}

function replayInputV1(item: Cap06S5GraphConformantCaseV2): Omit<HourlyWaterBalanceInputV1, "config"> {
  return {
    interval_start_exclusive: item.forecast_point.interval_start,
    interval_end_inclusive: item.forecast_point.interval_end,
    previous_storage_mm_decimal: item.forecast_point.previous_storage_mm,
    previous_variance_basis: {
      basis_origin: "CARRIED_FROM_PREVIOUS_CONTINUATION_STATE",
      previous_state_ref: String(item.source_forecast.payload.source_posterior_ref),
      previous_storage_variance_mm2_decimal: "0.000000000000",
    },
    gross_rainfall_mm_decimal: item.forecast_point.gross_precipitation_assumption_mm,
    historical_et0_mm_decimal: item.forecast_point.reference_et0_mm,
    crop_stage_code: item.forecast_point.crop_stage_code,
    kc_decimal: item.forecast_point.kc,
    executed_irrigation_candidates: [],
  };
}

async function main(): Promise<void> {
  const dataset = await buildCap06S5GraphConformantDatasetV2();
  assert.equal(dataset.profile_id, CAP06_S5_GRAPH_PROFILE_ID_V2);
  assert.equal(dataset.cases.length, 24);
  assert.equal(dataset.calibration_window_refs.length, 16);
  assert.equal(dataset.holdout_window_refs.length, 8);
  assert.equal(dataset.source_s1_residual_set_hash, "sha256:7995da1a8c5221c207087b30bb66a60ac2054e0616338f275ffaf72a01857e60");
  assert.equal(dataset.source_s1_case_input_set_hash, "sha256:cb3bd4c273134071e931e8f85765b028ce58986752e94da3902f8563ddba4bb3");

  const resolver = new Cap04OrCap05ExecutionConfigResolverV1();
  const directExecution = resolver.resolveExecutionConfig(dataset.cases[0].source_runtime_config);
  assert.equal(directExecution.source_config_purpose, CAP04_RUNTIME_CONFIG_PURPOSE_V1);
  const inheritedCap05Config = buildCap05EffectiveRuntimeConfigFromCap04FixtureV1(
    dataset.cases[0].source_runtime_config,
  );
  const inheritedExecution = resolver.resolveExecutionConfig(inheritedCap05Config);
  assert.equal(inheritedExecution.source_config_purpose, CAP05_RUNTIME_CONFIG_PURPOSE_V1);
  assert.equal(
    inheritedExecution.payload.dynamics_parameters.drainage_coefficient_per_hour,
    directExecution.payload.dynamics_parameters.drainage_coefficient_per_hour,
  );
  const resolved = dataset.cases.map((item) => assembleResolvedForecastObservationCaseV1({
    case_index: item.case_index,
    residual: item.residual,
    source_forecast: item.source_forecast,
    source_posterior: item.source_state,
    source_forecast_evidence_window: item.source_evidence_window,
    source_runtime_config: item.source_runtime_config,
    resolved_execution_config: resolver.resolveExecutionConfig(item.source_runtime_config),
    residual_runtime_config: item.source_runtime_config,
    resolved_residual_execution_config: resolver.resolveExecutionConfig(item.source_runtime_config),
    actual_observation: item.observation_record,
    assimilation_update: item.assimilation_update,
    observation_posterior: item.observation_posterior,
    observation_evidence_window: item.observation_evidence_window,
  }));
  assert.equal(resolved.length, 24);
  for (let index = 0; index < resolved.length; index += 1) {
    const graph = resolved[index];
    const item = dataset.cases[index];
    assert.equal(graph.case_source.residual_ref, item.residual.object_id);
    assert.equal(graph.observation_posterior.object_id, item.observation_posterior.object_id);
    assert.equal(graph.observation_evidence_window.as_of, item.observation_record.available_to_runtime_at);
    assert.equal(graph.assimilation_update.logical_time, item.observation_record.available_to_runtime_at);
    assert.ok(Date.parse(item.observation_record.observed_at)
      < Date.parse(item.observation_record.available_to_runtime_at));
  }

  const identity: Cap06SourceDatasetIdentityV1 = {
    residual_set_hash: dataset.residual_set_hash,
    case_input_set_hash: dataset.case_input_set_hash,
    calibration_window_hash: dataset.calibration_window_hash,
    holdout_window_hash: dataset.holdout_window_hash,
    window_hash_semantics: CAP06_WINDOW_HASH_SEMANTICS_V1,
    holdout_purpose: CAP06_HOLDOUT_PURPOSE_V1,
    holdout_generalization_claim: CAP06_HOLDOUT_GENERALIZATION_CLAIM_V1,
  };
  const byRef = new Map(resolved.map((item) => [item.case_source.residual_ref, item.case_source]));
  const calibrationWindow = buildCap06CaseWindowV1({
    role: "CALIBRATION",
    orderedResidualRefs: dataset.calibration_window_refs,
    loadedCases: dataset.calibration_window_refs.map((ref) => {
      const source = byRef.get(ref);
      if (!source) throw new Error(`CAP06_S5_GRAPH_CALIBRATION_SOURCE_MISSING:${ref}`);
      return source;
    }),
    sourceDatasetIdentity: identity,
  });
  const holdoutWindow = buildCap06CaseWindowV1({
    role: "HOLDOUT",
    orderedResidualRefs: dataset.holdout_window_refs,
    loadedCases: dataset.holdout_window_refs.map((ref) => {
      const source = byRef.get(ref);
      if (!source) throw new Error(`CAP06_S5_GRAPH_HOLDOUT_SOURCE_MISSING:${ref}`);
      return source;
    }),
    sourceDatasetIdentity: identity,
  });
  buildCap06CaseWindowsV1({ calibration: calibrationWindow, holdout: holdoutWindow });

  const runtimeByRef = new Map(dataset.cases.map((item) => [item.residual.object_id, {
    item,
    input: replayInputV1(item),
    config: replayConfigV1(item),
  }]));
  const predictionPort: Cap06CalibrationPredictionPortV1 = {
    predictCase(caseItem, parameterValue) {
      const runtime = runtimeByRef.get(caseItem.residual_ref);
      if (!runtime) throw new Error(`CAP06_S5_GRAPH_RUNTIME_CASE_MISSING:${caseItem.residual_ref}`);
      assert.equal(runtime.item.forecast_point.assumed_irrigation_mm, "0.000000");
      assert.equal(runtime.config.drainage_coefficient_per_hour, CAP06_S1_BASE_DRAINAGE_COEFFICIENT_V1);
      const result = executeHourlyWaterBalanceV1({
        ...runtime.input,
        config: {
          ...runtime.config,
          drainage_coefficient_per_hour: parameterValue,
        },
      });
      return {
        prediction_vwc: result.published_state.root_zone_vwc_fraction.mean,
        storage_mm: result.mass_balance_trace.next_storage_mm,
        mass_balance_hash: result.mass_balance_trace_hash,
        base_trace_match: parameterValue !== CAP06_BASE_PARAMETER_VALUE_V1
          || result.mass_balance_trace.next_storage_mm === runtime.item.forecast_point.storage_mean_mm,
        physical_invariant_status: "PASS",
        mass_balance_status: result.mass_balance_trace.mass_balance_error_mm === "0.000000" ? "PASS" : "FAIL",
      };
    },
  };
  const attempt = await runCap06CalibrationGridSearchV1({
    calibrationWindow,
    predictionPort,
  });
  assert.equal(attempt.status, "BOUNDED_PARAMETER_DELTA_CANDIDATE");
  assert.equal(attempt.selected_parameter_value, CAP06_S1_HIDDEN_DRAINAGE_COEFFICIENT_V1);
  assert.equal(attempt.canonical_append_allowed, true);
  assert.equal(attempt.objective_surface.length, 21);

  console.log(`S5_GRAPH_CONFORMANCE_RESULT_JSON:${JSON.stringify({
    schema_version: "geox_mcft_cap_06_s5_predecessor_graph_conformance_result_v1",
    status: "PASS",
    profile_id: dataset.profile_id,
    source_s1_residual_set_hash: dataset.source_s1_residual_set_hash,
    source_s1_case_input_set_hash: dataset.source_s1_case_input_set_hash,
    residual_set_hash: dataset.residual_set_hash,
    case_input_set_hash: dataset.case_input_set_hash,
    calibration_window_hash: dataset.calibration_window_hash,
    holdout_window_hash: dataset.holdout_window_hash,
    graph_case_count: resolved.length,
    delayed_availability_case_count: dataset.cases.filter((item) => item.observation_record.observed_at !== item.observation_record.available_to_runtime_at).length,
    selected_parameter_value: attempt.selected_parameter_value,
    canonical_write_count: 0,
    s5_implementation_started: false,
  })}`);
  console.log("MCFT_CAP_06_S5_PREDECESSOR_GRAPH_CONFORMANCE:PASS");
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exitCode = 1;
});
