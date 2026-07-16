// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S2_CONTRACTS_MATH.ts
// Purpose: prove MCFT-CAP-06 S2 contracts, exact-ref loading, fixed-point search, Candidate/Evaluation profiles, paired shadow policy, and fail-closed negative dispositions against the real S1 24-case Dynamics fixture.
// Boundary: isolated in-memory acceptance only; no database, migration, canonical append, projection, active Config, State, checkpoint, route, Web, scheduler, Model Activation, S3, or CAP-07 authority.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
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
  CAP06_CALIBRATION_CASE_COUNT_V1,
  CAP06_HOLDOUT_CASE_COUNT_V1,
  CAP06_HOLDOUT_GENERALIZATION_CLAIM_V1,
  CAP06_HOLDOUT_PURPOSE_V1,
  CAP06_WINDOW_HASH_SEMANTICS_V1,
  type Cap06SourceDatasetIdentityV1,
  type Cap06CalibrationCaseSourceV1,
  type Cap06CalibrationCaseV1,
  type Cap06CalibrationPredictionPortV1,
  type Cap06PredictionResultV1,
} from "../../apps/server/src/domain/calibration/contracts_v1.js";
import {
  buildCap06CaseWindowV1,
  buildCap06CaseWindowsV1,
  type Cap06CaseBuilderSourceV1,
} from "../../apps/server/src/domain/calibration/case_builder_v1.js";
import {
  CAP06_BEST_SECOND_MSE_MARGIN_EPSILON_SSE_SCALE_18_V1,
  CAP06_OBJECTIVE_MSE_RANGE_EPSILON_SSE_SCALE_18_V1,
  buildCap06ParameterGridV1,
  runCap06CalibrationGridSearchV1,
} from "../../apps/server/src/domain/calibration/grid_search_v1.js";
import { runCap06PairedHistoricalShadowV1 } from "../../apps/server/src/domain/calibration/shadow_evaluation_v1.js";
import {
  buildCap06CalibrationCandidateDraftV1,
  buildCap06ShadowEvaluationDraftV1,
} from "../../apps/server/src/domain/calibration/envelope_profiles_v1.js";
import { createCap06ExactCalibrationLoaderV1 } from "../../apps/server/src/domain/calibration/exact_ref_port_v1.js";
import {
  CAP06_S1_BASE_DRAINAGE_COEFFICIENT_V1,
  CAP06_S1_HIDDEN_DRAINAGE_COEFFICIENT_V1,
  buildCap06S1ControlledDatasetV1,
  type Cap06S1ControlledCaseV1,
} from "./mcft_cap_06_s1_residual_windows_fixture_v1.js";

const S2_RESULT_PREFIX = "S2_RESULT_JSON:";

type AcceptanceRuntimeCaseV1 = {
  source: Cap06CaseBuilderSourceV1;
  replay_input: Omit<HourlyWaterBalanceInputV1, "config">;
  base_config: HourlyWaterBalanceConfigV1;
  expected_base_storage_mm: string;
};

function fixed6V1(value: unknown, code: string): string {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(code);
  return formatFixedDecimalV1(parseFixedDecimalV1(String(value), 6, code), 6);
}

function configFromCaseV1(caseItem: Cap06S1ControlledCaseV1): HourlyWaterBalanceConfigV1 {
  const payload = caseItem.source_runtime_config.payload;
  validateCap04RuntimeConfigPayloadV1(payload);
  return {
    root_zone_depth_mm: fixed6V1(payload.soil_hydraulic_snapshot?.root_zone_depth_mm, "S2_ROOT_DEPTH_REQUIRED"),
    wilting_point_storage_mm: fixed6V1(payload.soil_hydraulic_snapshot?.wilting_point_storage_mm, "S2_WILTING_STORAGE_REQUIRED"),
    field_capacity_storage_mm: fixed6V1(payload.soil_hydraulic_snapshot?.field_capacity_storage_mm, "S2_FIELD_CAPACITY_REQUIRED"),
    saturation_storage_mm: fixed6V1(payload.soil_hydraulic_snapshot?.saturation_storage_mm, "S2_SATURATION_STORAGE_REQUIRED"),
    saturation_fraction: fixed6V1(payload.soil_hydraulic_snapshot?.saturation_fraction, "S2_SATURATION_FRACTION_REQUIRED"),
    runoff_fraction: fixed6V1(payload.dynamics_parameters?.runoff_fraction, "S2_RUNOFF_REQUIRED"),
    drainage_coefficient_per_hour: fixed6V1(payload.dynamics_parameters?.drainage_coefficient_per_hour, "S2_DRAINAGE_REQUIRED"),
    structural_process_stddev_mm_per_hour: fixed6V1(payload.process_uncertainty?.structural_process_stddev_mm_per_hour, "S2_STRUCTURAL_STDDEV_REQUIRED"),
    rainfall_relative_stddev: fixed6V1(payload.process_uncertainty?.rainfall_relative_stddev, "S2_RAINFALL_STDDEV_REQUIRED"),
    crop_et_relative_stddev: fixed6V1(payload.process_uncertainty?.crop_et_relative_stddev, "S2_ET_STDDEV_REQUIRED"),
    executed_irrigation_relative_stddev: fixed6V1(payload.process_uncertainty?.executed_irrigation_relative_stddev, "S2_IRRIGATION_STDDEV_REQUIRED"),
  };
}

function subtractScale6V1(left: string, right: string): string {
  return formatFixedDecimalV1(
    parseFixedDecimalV1(left, 6) - parseFixedDecimalV1(right, 6),
    6,
  );
}

function buildRuntimeCaseV1(caseItem: Cap06S1ControlledCaseV1): AcceptanceRuntimeCaseV1 {
  const residual = caseItem.residual;
  const payload = residual.payload;
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
  const capacitySpan = subtractScale6V1(
    baseConfig.saturation_storage_mm,
    baseConfig.field_capacity_storage_mm,
  );
  const excess = subtractScale6V1(
    baseReplay.mass_balance_trace.storage_before_drainage_mm,
    baseConfig.field_capacity_storage_mm,
  );
  const source: Cap06CaseBuilderSourceV1 = {
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
    source_forecast_point_ref: payload.forecast_point_ref,
    source_forecast_point_hash: payload.forecast_point_hash,
    source_posterior_ref: String(forecastPayload.source_posterior_ref),
    source_posterior_hash: String(forecastPayload.source_posterior_hash),
    source_runtime_config_ref: caseItem.source_runtime_config.object_id,
    source_runtime_config_hash: caseItem.source_runtime_config.determinism_hash,
    source_runtime_config_logical_time: caseItem.source_runtime_config.logical_time,
    actual_observation_ref: payload.actual_observation_ref,
    actual_observation_hash: payload.actual_observation_hash,
    forecast_issued_at: payload.forecast_issued_at,
    forecast_as_of: caseItem.source_forecast.as_of,
    forecast_evidence_cutoff: caseItem.source_evidence_window.as_of,
    forecast_target_time: payload.forecast_target_time,
    observation_observed_at: payload.actual_observation_observed_at,
    observation_available_to_runtime_at: payload.observation_available_to_runtime_at,
    actual_observation_vwc: payload.actual_observation_value,
    base_prediction_vwc: payload.predicted_observation_value,
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
      forecast_point_ref: payload.forecast_point_ref,
      forecast_point_hash: payload.forecast_point_hash,
      observation_ref: payload.actual_observation_ref,
      observation_hash: payload.actual_observation_hash,
    }),
  };
  return {
    source,
    replay_input: replayInput,
    base_config: baseConfig,
    expected_base_storage_mm: caseItem.forecast_point.storage_mean_mm,
  };
}

function realPredictionPortV1(
  runtimeByResidual: ReadonlyMap<string, AcceptanceRuntimeCaseV1>,
): Cap06CalibrationPredictionPortV1 {
  return {
    predictCase(caseItem, parameterValue) {
      const runtime = runtimeByResidual.get(caseItem.residual_ref);
      if (!runtime) throw new Error(`S2_RUNTIME_CASE_REQUIRED:${caseItem.residual_ref}`);
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

function exactSourcePortV1(sources: readonly Cap06CaseBuilderSourceV1[]): {
  port: { loadExactCalibrationResiduals(refs: readonly string[]): Promise<readonly Cap06CalibrationCaseSourceV1[]> };
  call_count: () => number;
  requested_refs: () => readonly string[];
} {
  const byRef = new Map(sources.map((item) => [item.residual_ref, structuredClone(item)]));
  let calls = 0;
  let requested: string[] = [];
  return {
    port: {
      async loadExactCalibrationResiduals(refs) {
        calls += 1;
        requested = [...refs];
        return refs.map((ref) => {
          const item = byRef.get(ref);
          if (!item) throw new Error(`S2_EXACT_SOURCE_MISSING:${ref}`);
          return structuredClone(item);
        });
      },
    },
    call_count: () => calls,
    requested_refs: () => requested,
  };
}

function sourceDatasetIdentityV1(
  sources: readonly Cap06CaseBuilderSourceV1[],
  calibrationRefs: readonly string[],
  holdoutRefs: readonly string[],
): Cap06SourceDatasetIdentityV1 {
  return {
    residual_set_hash: semanticHashV1(sources.map((item) => ({
      ref: item.residual_ref,
      hash: item.residual_hash,
    }))),
    case_input_set_hash: semanticHashV1(sources.map((item) => ({
      residual_ref: item.residual_ref,
      residual_hash: item.residual_hash,
      forecast_point_ref: item.source_forecast_point_ref,
      forecast_point_hash: item.source_forecast_point_hash,
      observation_ref: item.actual_observation_ref,
      observation_hash: item.actual_observation_hash,
    }))),
    calibration_window_hash: semanticHashV1(calibrationRefs),
    holdout_window_hash: semanticHashV1(holdoutRefs),
    window_hash_semantics: CAP06_WINDOW_HASH_SEMANTICS_V1,
    holdout_purpose: CAP06_HOLDOUT_PURPOSE_V1,
    holdout_generalization_claim: CAP06_HOLDOUT_GENERALIZATION_CLAIM_V1,
  };
}

function cloneAsNoOpV1(source: Cap06CaseBuilderSourceV1): Cap06CaseBuilderSourceV1 {
  const observationRef = `${source.actual_observation_ref}_noop`;
  const residualRef = `${source.residual_ref}_noop`;
  const actual = source.base_prediction_vwc;
  return {
    ...structuredClone(source),
    residual_ref: residualRef,
    residual_hash: semanticHashV1({ source: source.residual_hash, mode: "NO_OP" }),
    actual_observation_ref: observationRef,
    actual_observation_hash: semanticHashV1({ ref: observationRef, value: actual }),
    actual_observation_vwc: actual,
    case_input_hash: semanticHashV1({ source: source.case_input_hash, mode: "NO_OP", actual }),
  };
}

function syntheticPredictionPortV1(kind: "BOUNDARY" | "FLAT" | "MARGIN" | "EXCITATION"): Cap06CalibrationPredictionPortV1 {
  return {
    predictCase(caseItem, parameterValue): Cap06PredictionResultV1 {
      const actual = parseFixedDecimalV1(caseItem.actual_observation_vwc, 9);
      const parameter = parseFixedDecimalV1(parameterValue, 6);
      const minimum = parseFixedDecimalV1("0.020000", 6);
      const base = parseFixedDecimalV1(CAP06_BASE_PARAMETER_VALUE_V1, 6);
      let prediction = actual;
      if (kind === "BOUNDARY") prediction = actual + (parameter - minimum);
      else if (kind === "FLAT") prediction = actual + (parameter < base ? -10_000n : 10_000n);
      else if (kind === "MARGIN") {
        const isBestTie = parameterValue === "0.033000" || parameterValue === "0.034000";
        prediction = isBestTie ? actual : actual + absoluteBigIntV1(parameter - 33_000n);
      } else prediction = actual + 10_000n;
      return {
        prediction_vwc: formatFixedDecimalV1(prediction, 9),
        storage_mm: "100.000000",
        mass_balance_hash: semanticHashV1({ kind, parameterValue, case: caseItem.residual_ref }),
        base_trace_match: true,
        physical_invariant_status: "PASS",
        mass_balance_status: "PASS",
      };
    },
  };
}

function absoluteBigIntV1(value: bigint): bigint {
  return value < 0n ? -value : value;
}

function wrapPredictionPortV1(
  base: Cap06CalibrationPredictionPortV1,
  mode: "BASE_MISMATCH" | "PHYSICAL" | "MASS" | "NONDETERMINISTIC",
): Cap06CalibrationPredictionPortV1 {
  let toggle = false;
  return {
    async predictCase(caseItem, parameterValue) {
      const result = structuredClone(await base.predictCase(caseItem, parameterValue));
      if (mode === "BASE_MISMATCH" && parameterValue === CAP06_BASE_PARAMETER_VALUE_V1) {
        result.base_trace_match = false;
      }
      if (mode === "PHYSICAL" && parameterValue === CAP06_S1_HIDDEN_DRAINAGE_COEFFICIENT_V1) {
        result.physical_invariant_status = "FAIL";
      }
      if (mode === "MASS" && parameterValue === CAP06_S1_HIDDEN_DRAINAGE_COEFFICIENT_V1) {
        result.mass_balance_status = "FAIL";
      }
      if (mode === "NONDETERMINISTIC") {
        toggle = !toggle;
        const units = parseFixedDecimalV1(result.prediction_vwc, 9);
        result.prediction_vwc = formatFixedDecimalV1(units + (toggle ? 1n : 0n), 9);
      }
      return result;
    },
  };
}

async function main(): Promise<void> {
  const controlled = await buildCap06S1ControlledDatasetV1();
  assert.equal(controlled.cases.length, 24);
  const runtimeCases = controlled.cases.map(buildRuntimeCaseV1);
  const runtimeByResidual = new Map(runtimeCases.map((item) => [item.source.residual_ref, item]));
  const exactSource = exactSourcePortV1(runtimeCases.map((item) => item.source));
  const loader = createCap06ExactCalibrationLoaderV1(exactSource.port);
  assert.deepEqual(Object.keys(loader), ["loadExactCalibrationResiduals"]);

  assert.equal(controlled.residual_set_hash, "sha256:7995da1a8c5221c207087b30bb66a60ac2054e0616338f275ffaf72a01857e60");
  assert.equal(controlled.case_input_set_hash, "sha256:cb3bd4c273134071e931e8f85765b028ce58986752e94da3902f8563ddba4bb3");
  assert.equal(controlled.calibration_window_hash, "sha256:e5403ae258326909d054e92b53d089494d709785d8c48775a8cd142b0f0d191d");
  assert.equal(controlled.holdout_window_hash, "sha256:20bc567b9e75027425c981a24d8889f80327b55226dd29d04a97880bc07a428a");
  const controlledIdentity: Cap06SourceDatasetIdentityV1 = {
    residual_set_hash: controlled.residual_set_hash,
    case_input_set_hash: controlled.case_input_set_hash,
    calibration_window_hash: controlled.calibration_window_hash,
    holdout_window_hash: controlled.holdout_window_hash,
    window_hash_semantics: CAP06_WINDOW_HASH_SEMANTICS_V1,
    holdout_purpose: CAP06_HOLDOUT_PURPOSE_V1,
    holdout_generalization_claim: CAP06_HOLDOUT_GENERALIZATION_CLAIM_V1,
  };

  const calibrationLoaded = await loader.loadExactCalibrationResiduals(controlled.calibration_window_refs);
  const holdoutLoaded = await loader.loadExactCalibrationResiduals(controlled.holdout_window_refs);
  assert.equal(exactSource.call_count(), 2);
  assert.deepEqual(exactSource.requested_refs(), controlled.holdout_window_refs);
  const calibrationWindow = buildCap06CaseWindowV1({
    role: "CALIBRATION",
    orderedResidualRefs: controlled.calibration_window_refs,
    loadedCases: calibrationLoaded as Cap06CaseBuilderSourceV1[],
    sourceDatasetIdentity: controlledIdentity,
  });
  const holdoutWindow = buildCap06CaseWindowV1({
    role: "HOLDOUT",
    orderedResidualRefs: controlled.holdout_window_refs,
    loadedCases: holdoutLoaded as Cap06CaseBuilderSourceV1[],
    sourceDatasetIdentity: controlledIdentity,
  });
  const windows = buildCap06CaseWindowsV1({ calibration: calibrationWindow, holdout: holdoutWindow });
  assert.equal(windows.calibration.cases.length, CAP06_CALIBRATION_CASE_COUNT_V1);
  assert.equal(windows.holdout.cases.length, CAP06_HOLDOUT_CASE_COUNT_V1);
  assert.equal(windows.future_leakage_count, 0);
  assert.equal(windows.calibration_holdout_ref_intersection_count, 0);
  assert.equal(windows.calibration.as_of < windows.minimum_holdout_availability, true);
  assert.equal(windows.source_s1_residual_set_hash, controlled.residual_set_hash);
  assert.equal(windows.source_s1_case_input_set_hash, controlled.case_input_set_hash);
  assert.equal(windows.calibration_window_ref_membership_hash, controlled.calibration_window_hash);
  assert.equal(windows.holdout_window_ref_membership_hash, controlled.holdout_window_hash);
  assert.equal(windows.window_hash_semantics, CAP06_WINDOW_HASH_SEMANTICS_V1);
  assert.equal(windows.holdout_purpose, CAP06_HOLDOUT_PURPOSE_V1);
  assert.equal(windows.holdout_generalization_claim, CAP06_HOLDOUT_GENERALIZATION_CLAIM_V1);

  const grid = buildCap06ParameterGridV1();
  assert.equal(grid.length, 21);
  assert.equal(grid[0], "0.020000");
  assert.equal(grid[10], CAP06_BASE_PARAMETER_VALUE_V1);
  assert.equal(grid[20], "0.040000");
  assert.equal(CAP06_OBJECTIVE_MSE_RANGE_EPSILON_SSE_SCALE_18_V1, 1_000_000n);
  assert.equal(CAP06_BEST_SECOND_MSE_MARGIN_EPSILON_SSE_SCALE_18_V1, 1_000_000n);

  const realPort = realPredictionPortV1(runtimeByResidual);
  const positiveFirst = await runCap06CalibrationGridSearchV1({
    calibrationWindow,
    predictionPort: realPort,
  });
  const positiveSecond = await runCap06CalibrationGridSearchV1({
    calibrationWindow,
    predictionPort: realPort,
  });
  assert.equal(positiveFirst.determinism_hash, positiveSecond.determinism_hash);
  assert.equal(positiveFirst.status, "BOUNDED_PARAMETER_DELTA_CANDIDATE");
  assert.equal(positiveFirst.selected_parameter_value, CAP06_S1_HIDDEN_DRAINAGE_COEFFICIENT_V1);
  assert.equal(positiveFirst.canonical_append_allowed, true);
  assert.equal(positiveFirst.objective_surface.length, 21);
  assert.equal(positiveFirst.excitation_summary?.status, "PASS");
  const candidateDraft = buildCap06CalibrationCandidateDraftV1({
    calibrationWindow,
    attempt: positiveFirst,
  });
  assert.equal(candidateDraft.object_type, "twin_calibration_candidate_v1");
  assert.equal(candidateDraft.lineage_member, false);
  assert.equal(candidateDraft.payload.activation_status, "NOT_ACTIVE");
  assert.equal(candidateDraft.payload.eligible_for_state_input, false);
  assert.equal(candidateDraft.payload.eligible_for_runtime_config_use, false);
  assert.equal(candidateDraft.payload.residual_set_hash_scope, "CALIBRATION_WINDOW_ONLY");
  assert.equal(candidateDraft.payload.source_s1_residual_set_hash, controlled.residual_set_hash);
  assert.equal(candidateDraft.payload.source_s1_case_input_set_hash, controlled.case_input_set_hash);
  assert.equal(candidateDraft.payload.calibration_window_ref_membership_hash, controlled.calibration_window_hash);
  assert.equal(candidateDraft.payload.window_hash_semantics, CAP06_WINDOW_HASH_SEMANTICS_V1);

  const shadowFirst = await runCap06PairedHistoricalShadowV1({
    holdoutWindow,
    candidateParameterValue: String(candidateDraft.payload.candidate_parameter_value),
    predictionPort: realPort,
  });
  const shadowSecond = await runCap06PairedHistoricalShadowV1({
    holdoutWindow,
    candidateParameterValue: String(candidateDraft.payload.candidate_parameter_value),
    predictionPort: realPort,
  });
  assert.equal(shadowFirst.determinism_hash, shadowSecond.determinism_hash);
  assert.equal(shadowFirst.case_results.length, 8);
  assert.equal(shadowFirst.evaluation_disposition, "ELIGIBLE_FOR_HUMAN_ACTIVATION_REVIEW");
  assert.equal(shadowFirst.eligible_for_human_activation_review, true);
  assert.equal(shadowFirst.model_activation_created, false);
  assert.equal(shadowFirst.active_config_switch_performed, false);
  const evaluationDraft = buildCap06ShadowEvaluationDraftV1({
    holdoutWindow,
    candidate: candidateDraft,
    shadow: shadowFirst,
  });
  assert.equal(evaluationDraft.object_type, "twin_shadow_evaluation_v1");
  assert.equal(evaluationDraft.lineage_member, false);
  assert.equal(evaluationDraft.payload.model_activation_created, false);
  assert.equal(evaluationDraft.payload.active_config_switch_performed, false);
  assert.equal(evaluationDraft.payload.source_s1_residual_set_hash, controlled.residual_set_hash);
  assert.equal(evaluationDraft.payload.source_s1_case_input_set_hash, controlled.case_input_set_hash);
  assert.equal(evaluationDraft.payload.holdout_window_ref_membership_hash, controlled.holdout_window_hash);
  assert.equal(evaluationDraft.payload.holdout_purpose, CAP06_HOLDOUT_PURPOSE_V1);
  assert.equal(evaluationDraft.payload.holdout_generalization_claim, CAP06_HOLDOUT_GENERALIZATION_CLAIM_V1);

  const noOpSources = runtimeCases.map((item) => cloneAsNoOpV1(item.source));
  const noOpRuntimeByRef = new Map<string, AcceptanceRuntimeCaseV1>();
  noOpSources.forEach((source, index) => noOpRuntimeByRef.set(source.residual_ref, {
    ...runtimeCases[index],
    source,
  }));
  const noOpCalibrationRefs = noOpSources.slice(0, 16).map((item) => item.residual_ref);
  const noOpHoldoutRefs = noOpSources.slice(16).map((item) => item.residual_ref);
  const noOpIdentity = sourceDatasetIdentityV1(noOpSources, noOpCalibrationRefs, noOpHoldoutRefs);
  const noOpCalibration = buildCap06CaseWindowV1({
    role: "CALIBRATION",
    orderedResidualRefs: noOpCalibrationRefs,
    loadedCases: noOpSources.slice(0, 16),
    sourceDatasetIdentity: noOpIdentity,
  });
  const noOpHoldout = buildCap06CaseWindowV1({
    role: "HOLDOUT",
    orderedResidualRefs: noOpHoldoutRefs,
    loadedCases: noOpSources.slice(16),
    sourceDatasetIdentity: noOpIdentity,
  });
  buildCap06CaseWindowsV1({ calibration: noOpCalibration, holdout: noOpHoldout });
  const noOpPort = realPredictionPortV1(noOpRuntimeByRef);
  const noOpAttempt = await runCap06CalibrationGridSearchV1({
    calibrationWindow: noOpCalibration,
    predictionPort: noOpPort,
  });
  assert.equal(noOpAttempt.status, "NO_OP_BASE_PARAMETER_RETAINED");
  assert.equal(noOpAttempt.selected_parameter_value, CAP06_BASE_PARAMETER_VALUE_V1);
  assert.equal(noOpAttempt.canonical_append_allowed, true);
  const noOpCandidate = buildCap06CalibrationCandidateDraftV1({
    calibrationWindow: noOpCalibration,
    attempt: noOpAttempt,
  });
  const noOpShadow = await runCap06PairedHistoricalShadowV1({
    holdoutWindow: noOpHoldout,
    candidateParameterValue: CAP06_BASE_PARAMETER_VALUE_V1,
    predictionPort: noOpPort,
  });
  assert.equal(noOpShadow.evaluation_disposition, "BASE_PARAMETER_RETAINED");
  assert.deepEqual(noOpShadow.reason_codes, ["NO_OP_CONFIRMED"]);
  assert.equal(noOpCandidate.payload.activation_status, "NOT_ACTIVE");

  const boundary = await runCap06CalibrationGridSearchV1({
    calibrationWindow,
    predictionPort: syntheticPredictionPortV1("BOUNDARY"),
  });
  assert.equal(boundary.status, "SEARCH_BOUNDARY_HIT_INCONCLUSIVE");
  assert.equal(boundary.selected_parameter_value, "0.020000");
  assert.equal(boundary.canonical_append_allowed, false);

  const flat = await runCap06CalibrationGridSearchV1({
    calibrationWindow,
    predictionPort: syntheticPredictionPortV1("FLAT"),
  });
  assert.equal(flat.status, "OBJECTIVE_SURFACE_FLAT");

  const margin = await runCap06CalibrationGridSearchV1({
    calibrationWindow,
    predictionPort: syntheticPredictionPortV1("MARGIN"),
  });
  assert.equal(margin.status, "OBJECTIVE_MARGIN_INSUFFICIENT");

  const excitation = await runCap06CalibrationGridSearchV1({
    calibrationWindow,
    predictionPort: syntheticPredictionPortV1("EXCITATION"),
  });
  assert.equal(excitation.status, "INSUFFICIENT_PARAMETER_EXCITATION");

  const baseMismatch = await runCap06CalibrationGridSearchV1({
    calibrationWindow,
    predictionPort: wrapPredictionPortV1(realPort, "BASE_MISMATCH"),
  });
  assert.equal(baseMismatch.status, "BASE_REPLAY_MISMATCH");

  const nondeterministic = await runCap06CalibrationGridSearchV1({
    calibrationWindow,
    predictionPort: wrapPredictionPortV1(realPort, "NONDETERMINISTIC"),
  });
  assert.equal(nondeterministic.status, "DETERMINISM_FAILURE");

  const physical = await runCap06CalibrationGridSearchV1({
    calibrationWindow,
    predictionPort: wrapPredictionPortV1(realPort, "PHYSICAL"),
  });
  assert.equal(physical.status, "PHYSICAL_INVARIANT_FAILURE");

  const mass = await runCap06CalibrationGridSearchV1({
    calibrationWindow,
    predictionPort: wrapPredictionPortV1(realPort, "MASS"),
  });
  assert.equal(mass.status, "MASS_BALANCE_FAILURE");

  const insufficient = await runCap06CalibrationGridSearchV1({
    calibrationWindow: {
      ...structuredClone(calibrationWindow),
      cases: calibrationWindow.cases.slice(0, 15),
    },
    predictionPort: realPort,
  });
  assert.equal(insufficient.status, "INSUFFICIENT_MATCHED_PAIRS");

  assert.throws(
    () => buildCap06CaseWindowV1({
      role: "CALIBRATION",
      orderedResidualRefs: controlled.calibration_window_refs,
      loadedCases: runtimeCases.slice(0, 16).map((item, index) => index === 3
        ? { ...item.source, context_revision_ref: "conflicting_revision" }
        : item.source),
      sourceDatasetIdentity: controlledIdentity,
    }),
    /CAP06_CALIBRATION_REVISION_HETEROGENEITY/,
  );
  assert.throws(
    () => buildCap06CaseWindowV1({
      role: "CALIBRATION",
      orderedResidualRefs: controlled.calibration_window_refs,
      loadedCases: runtimeCases.slice(0, 16).map((item, index) => index === 2
        ? { ...item.source, forecast_as_of: item.source.observation_available_to_runtime_at }
        : item.source),
      sourceDatasetIdentity: controlledIdentity,
    }),
    /CAP06_FORECAST_AS_OF_FUTURE_LEAKAGE/,
  );
  assert.throws(
    () => buildCap06CaseWindowV1({
      role: "CALIBRATION",
      orderedResidualRefs: controlled.calibration_window_refs,
      loadedCases: runtimeCases.slice(0, 16).map((item) => item.source),
      sourceDatasetIdentity: {
        ...controlledIdentity,
        calibration_window_hash: semanticHashV1(["wrong-window"]),
      },
    }),
    /CAP06_CALIBRATION_WINDOW_REF_MEMBERSHIP_HASH_MISMATCH/,
  );
  assert.throws(
    () => buildCap06CaseWindowsV1({
      calibration: { ...structuredClone(calibrationWindow), source_s1_residual_set_hash: semanticHashV1(["wrong-set"]) },
      holdout: { ...structuredClone(holdoutWindow), source_s1_residual_set_hash: semanticHashV1(["wrong-set"]) },
    }),
    /CAP06_SOURCE_S1_RESIDUAL_SET_HASH_MISMATCH/,
  );

  await assert.rejects(
    () => loader.loadExactCalibrationResiduals([
      controlled.calibration_window_refs[0],
      controlled.calibration_window_refs[0],
    ]),
    /CAP06_EXACT_RESIDUAL_REFS_DUPLICATE/,
  );

  const result = {
    schema_version: "geox_mcft_cap_06_s2_acceptance_result_v1",
    status: "PASS",
    source_profile_id: controlled.profile_id,
    source_residual_count: controlled.cases.length,
    calibration_case_count: calibrationWindow.cases.length,
    holdout_case_count: holdoutWindow.cases.length,
    grid_count: grid.length,
    source_s1_residual_set_hash: windows.source_s1_residual_set_hash,
    source_s1_case_input_set_hash: windows.source_s1_case_input_set_hash,
    calibration_window_ref_membership_hash: windows.calibration_window_ref_membership_hash,
    holdout_window_ref_membership_hash: windows.holdout_window_ref_membership_hash,
    window_hash_semantics: windows.window_hash_semantics,
    holdout_purpose: windows.holdout_purpose,
    holdout_generalization_claim: windows.holdout_generalization_claim,
    objective_mse_range_epsilon_sse_scale_18: CAP06_OBJECTIVE_MSE_RANGE_EPSILON_SSE_SCALE_18_V1.toString(),
    best_second_mse_margin_epsilon_sse_scale_18: CAP06_BEST_SECOND_MSE_MARGIN_EPSILON_SSE_SCALE_18_V1.toString(),
    objective_mse_range_sse_scale_18: positiveFirst.objective_mse_range_sse_scale_18,
    best_vs_second_mse_margin_sse_scale_18: positiveFirst.best_vs_second_mse_margin_sse_scale_18,
    sensitive_case_count: positiveFirst.excitation_summary?.sensitive_case_count ?? 0,
    represented_sensitive_wetness_regimes: positiveFirst.excitation_summary?.represented_sensitive_wetness_regimes ?? [],
    selected_parameter_value: positiveFirst.selected_parameter_value,
    positive_disposition: positiveFirst.status,
    positive_shadow_disposition: shadowFirst.evaluation_disposition,
    no_op_disposition: noOpAttempt.status,
    no_op_shadow_disposition: noOpShadow.evaluation_disposition,
    boundary_disposition: boundary.status,
    flat_disposition: flat.status,
    margin_disposition: margin.status,
    excitation_disposition: excitation.status,
    base_mismatch_disposition: baseMismatch.status,
    determinism_disposition: nondeterministic.status,
    physical_disposition: physical.status,
    mass_balance_disposition: mass.status,
    calibration_window_determinism_hash: calibrationWindow.determinism_hash,
    holdout_window_determinism_hash: holdoutWindow.determinism_hash,
    positive_attempt_determinism_hash: positiveFirst.determinism_hash,
    positive_shadow_determinism_hash: shadowFirst.determinism_hash,
    candidate_draft_determinism_hash: candidateDraft.determinism_hash,
    evaluation_draft_determinism_hash: evaluationDraft.determinism_hash,
    canonical_write_count: 0,
    projection_write_count: 0,
    migration_count: 0,
    model_activation_count: 0,
  };
  console.log("PASS S2 exact-ref-only 16/8 case builder and dual-time isolation");
  console.log("PASS S2 BigInt 21-point grid selected controlled hidden coefficient by real Dynamics replay");
  console.log("PASS S2 no-op, boundary, flat, margin, excitation and fail-closed error dispositions");
  console.log("PASS S2 paired historical shadow eligibility and no-op retention policy");
  console.log("PASS S2 Candidate/Evaluation drafts remain non-lineage, inactive and zero-write");
  const outputDir = path.resolve(process.cwd(), "acceptance-output");
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(
    path.join(outputDir, "MCFT_CAP_06_S2_CONTRACTS_MATH_RESULT.json"),
    `${JSON.stringify(result, null, 2)}\n`,
    "utf8",
  );
  console.log(`${S2_RESULT_PREFIX}${JSON.stringify(result)}`);
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exitCode = 1;
});
