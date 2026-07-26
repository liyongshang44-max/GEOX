// Purpose: construct and persist the exact 24 MCFT-CAP-08.S5 prequalification Residual roots, build the frozen 16/8 windows, and evaluate the eligibility-aware 21-point surface.
// Boundary: acceptance-only fresh database; Residual persistence is allowed, Candidate/Shadow persistence, active Config, State/checkpoint mutation, Model Activation, production Runtime source, routes and schedulers are forbidden.

import type { Pool } from "pg";

import {
  CAP06_BASE_PARAMETER_VALUE_V1,
  CAP06_MINIMUM_SENSITIVE_CASE_COUNT_V1,
  CAP06_MINIMUM_WETNESS_REGIME_COUNT_V1,
  CAP06_SEARCH_MAXIMUM_V1,
  CAP06_SEARCH_MINIMUM_V1,
  CAP06_SENSITIVITY_EPSILON_VWC_V1,
  type Cap06CalibrationCaseV1,
  type Cap06CalibrationPredictionPortV1,
  type Cap06ParameterSurfacePointV1,
  type Cap06PredictionResultV1,
  type Cap06WetnessRegimeV1,
} from "../../apps/server/src/domain/calibration/contracts_v1.js";
import {
  buildCap06ParameterGridV1,
  CAP06_BEST_SECOND_MSE_MARGIN_EPSILON_SSE_SCALE_18_V1,
  CAP06_OBJECTIVE_MSE_RANGE_EPSILON_SSE_SCALE_18_V1,
} from "../../apps/server/src/domain/calibration/grid_search_v1.js";
import {
  buildCap06ErrorMetricsV1,
  compareCap06AbsoluteMeanBiasV1,
  compareCap06MaximumAbsoluteResidualV1,
  compareCap06MseV1,
  formatCap06VwcMetricV1,
  parseCap06VwcMetricV1,
} from "../../apps/server/src/domain/calibration/fixed_point_metric_v1.js";
import {
  executeHourlyWaterBalanceV1,
  type HourlyWaterBalanceConfigV1,
  type HourlyWaterBalanceInputV1,
} from "../../apps/server/src/domain/soil_water/hourly_water_balance_v1.js";
import {
  formatFixedDecimalV1,
  normalizeFixedDecimalV1,
  parseFixedDecimalV1,
} from "../../apps/server/src/domain/soil_water/fixed_point_water_decimal_v1.js";
import { buildRootZoneObservationOperatorV1 } from "../../apps/server/src/domain/soil_water/root_zone_observation_operator_v1.js";
import type { CanonicalObjectEnvelopeV1 } from "../../apps/server/src/domain/twin_runtime/canonical_object_contracts_v1.js";
import { semanticHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import {
  buildCap05ForecastPointMemberRefV1,
  buildCap05ForecastResidualV1,
  type Cap05ForecastResidualEnvelopeV1,
} from "../../apps/server/src/domain/twin_runtime/forecast_observation_residual_v1.js";
import {
  validateCap04CanonicalForecastRunPayloadV1,
  type Cap04CanonicalCompletedForecastRunPayloadV1,
} from "../../apps/server/src/domain/twin_runtime/forecast_canonical_authority_v1.js";
import {
  DirectCap04ExecutionConfigResolverV1,
  type ResolvedCap04ExecutionConfigV1,
} from "../../apps/server/src/domain/twin_runtime/runtime_config_execution_view_v1.js";
import type { CanonicalReplayEvidenceRecordV1, TwinScopeKeyV1 } from "../../apps/server/src/runtime/twin_runtime/ports.js";
import { PostgresFeedbackPersistenceRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_feedback_persistence_repository_v1.js";
import type { PostgresRuntimeRepositoryV1 } from "./mcft_cap08_s2_g3_acceptance_support_v1.js";

export const CAP08_S5_PREQUALIFICATION_POLICY_ID_V1 =
  "MCFT_CAP_08_S5_BUSINESS_OUTCOME_OBJECTIVE_ELIGIBILITY_V1" as const;
export const CAP08_S5_PREQUALIFICATION_CASE_BUILDER_ID_V1 =
  "MCFT_CAP_08_S5_SIGNED_EXCESS_H1_PREQUALIFICATION_CASE_BUILDER_V1" as const;
export const CAP08_S5_PREQUALIFICATION_REPLAY_ADAPTER_ID_V1 =
  "MCFT_CAP_08_S5_EXACT_H1_PREQUALIFICATION_REPLAY_ADAPTER_V1" as const;
export const CAP08_S5_PREQUALIFICATION_ORDINARY_ASSIMILATION_ORDERS_V1 = [2, 3, 4, 10, 22] as const;

export type Cap08S5PrequalificationWetnessRegimeV1 =
  | Cap06WetnessRegimeV1
  | "NO_POSITIVE_EXCESS";

export type Cap08S5PrequalificationObligationV1 = {
  order: number;
  residual_id: string;
  forecast: CanonicalObjectEnvelopeV1;
  observation: CanonicalReplayEvidenceRecordV1;
  assimilation: CanonicalObjectEnvelopeV1 | null;
};

export type Cap08S5PrequalificationCaseV1 = Omit<Cap06CalibrationCaseV1, "wetness_regime"> & {
  wetness_regime: Cap08S5PrequalificationWetnessRegimeV1;
  drainage_excitation_eligible: boolean;
  objective_eligible: boolean;
  source_forecast_point: Cap04CanonicalCompletedForecastRunPayloadV1["points"][number];
  input_without_config: Omit<HourlyWaterBalanceInputV1, "config">;
  base_config: HourlyWaterBalanceConfigV1;
};

export type Cap08S5PrequalificationWindowV1 = {
  schema_version: "geox_mcft_cap08_s5_prequalification_window_v1";
  role: "CALIBRATION" | "HOLDOUT";
  case_builder_id: typeof CAP08_S5_PREQUALIFICATION_CASE_BUILDER_ID_V1;
  cases: Cap08S5PrequalificationCaseV1[];
  ordered_residual_refs: string[];
  ordered_residual_hashes: string[];
  case_input_set_hash: string;
  window_ref_membership_hash: string;
  no_positive_excess_case_count: number;
  objective_case_count: number;
  diagnostic_only_case_count: number;
  determinism_hash: string;
};

type EvaluatedV1 = {
  surface: Cap06ParameterSurfacePointV1;
  predictions: Cap06PredictionResultV1[];
};

function requiredStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

function recordV1(value: unknown, code: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
  return value as Record<string, unknown>;
}

function fixed6V1(value: unknown, code: string): string {
  const text = typeof value === "number" ? String(value) : requiredStringV1(value, code);
  return formatFixedDecimalV1(parseFixedDecimalV1(text, 6, code), 6);
}

function add6V1(...values: string[]): string {
  return formatFixedDecimalV1(
    values.reduce((sum, value) => sum + parseFixedDecimalV1(value, 6), 0n),
    6,
  );
}

function subtract6V1(left: string, right: string): string {
  return formatFixedDecimalV1(
    parseFixedDecimalV1(left, 6) - parseFixedDecimalV1(right, 6),
    6,
  );
}

function absoluteV1(value: bigint): bigint {
  return value < 0n ? -value : value;
}

function parameterUnitsV1(value: string): bigint {
  return parseFixedDecimalV1(value, 6, "CAP08_S5_PREQUALIFICATION_PARAMETER_INVALID");
}

function parameterDeltaV1(value: string): string {
  return formatFixedDecimalV1(
    parameterUnitsV1(value) - parameterUnitsV1(CAP06_BASE_PARAMETER_VALUE_V1),
    6,
  );
}

function compareBigIntV1(left: bigint, right: bigint): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareSurfaceV1(left: Cap06ParameterSurfacePointV1, right: Cap06ParameterSurfacePointV1): number {
  return compareCap06MseV1(left.metrics, right.metrics)
    || compareCap06AbsoluteMeanBiasV1(left.metrics, right.metrics)
    || compareCap06MaximumAbsoluteResidualV1(left.metrics, right.metrics)
    || compareBigIntV1(absoluteV1(parameterUnitsV1(left.parameter_delta)), absoluteV1(parameterUnitsV1(right.parameter_delta)))
    || compareBigIntV1(parameterUnitsV1(left.parameter_value), parameterUnitsV1(right.parameter_value));
}

function exactScopeV1(object: CanonicalObjectEnvelopeV1, scope: TwinScopeKeyV1, code: string): void {
  for (const field of ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"] as const) {
    if (object[field] !== scope[field]) throw new Error(`${code}:${field}`);
  }
}

function replayConfigV1(resolved: ResolvedCap04ExecutionConfigV1): HourlyWaterBalanceConfigV1 {
  const payload = resolved.payload;
  return {
    root_zone_depth_mm: fixed6V1(payload.soil_hydraulic_snapshot.root_zone_depth_mm, "CAP08_S5_PREQUALIFICATION_ROOT_DEPTH_REQUIRED"),
    wilting_point_storage_mm: fixed6V1(payload.soil_hydraulic_snapshot.wilting_point_storage_mm, "CAP08_S5_PREQUALIFICATION_WILTING_REQUIRED"),
    field_capacity_storage_mm: fixed6V1(payload.soil_hydraulic_snapshot.field_capacity_storage_mm, "CAP08_S5_PREQUALIFICATION_FIELD_CAPACITY_REQUIRED"),
    saturation_storage_mm: fixed6V1(payload.soil_hydraulic_snapshot.saturation_storage_mm, "CAP08_S5_PREQUALIFICATION_SATURATION_REQUIRED"),
    saturation_fraction: fixed6V1(payload.soil_hydraulic_snapshot.saturation_fraction, "CAP08_S5_PREQUALIFICATION_SATURATION_FRACTION_REQUIRED"),
    runoff_fraction: fixed6V1(payload.dynamics_parameters.runoff_fraction, "CAP08_S5_PREQUALIFICATION_RUNOFF_REQUIRED"),
    drainage_coefficient_per_hour: fixed6V1(payload.dynamics_parameters.drainage_coefficient_per_hour, "CAP08_S5_PREQUALIFICATION_DRAINAGE_REQUIRED"),
    structural_process_stddev_mm_per_hour: fixed6V1(payload.process_uncertainty.structural_process_stddev_mm_per_hour, "CAP08_S5_PREQUALIFICATION_STRUCTURAL_REQUIRED"),
    rainfall_relative_stddev: fixed6V1(payload.process_uncertainty.rainfall_relative_stddev, "CAP08_S5_PREQUALIFICATION_RAIN_STDDEV_REQUIRED"),
    crop_et_relative_stddev: fixed6V1(payload.process_uncertainty.crop_et_relative_stddev, "CAP08_S5_PREQUALIFICATION_ET_STDDEV_REQUIRED"),
    executed_irrigation_relative_stddev: fixed6V1(payload.process_uncertainty.executed_irrigation_relative_stddev, "CAP08_S5_PREQUALIFICATION_IRRIGATION_STDDEV_REQUIRED"),
  };
}

function replayInputV1(input: {
  point: Cap04CanonicalCompletedForecastRunPayloadV1["points"][number];
  sourcePosteriorRef: string;
}): Omit<HourlyWaterBalanceInputV1, "config"> {
  if (input.point.horizon_hour !== 1) throw new Error("CAP08_S5_PREQUALIFICATION_H1_REQUIRED");
  if (input.point.assumed_irrigation_mm !== "0.000000") {
    throw new Error("CAP08_S5_PREQUALIFICATION_NO_NEW_IRRIGATION_REQUIRED");
  }
  return {
    interval_start_exclusive: input.point.interval_start,
    interval_end_inclusive: input.point.interval_end,
    previous_storage_mm_decimal: input.point.previous_storage_mm,
    previous_variance_basis: {
      basis_origin: "CARRIED_FROM_PREVIOUS_CONTINUATION_STATE",
      previous_state_ref: input.sourcePosteriorRef,
      previous_storage_variance_mm2_decimal: "0.000000000000",
    },
    gross_rainfall_mm_decimal: input.point.gross_precipitation_assumption_mm,
    historical_et0_mm_decimal: input.point.reference_et0_mm,
    crop_stage_code: input.point.crop_stage_code,
    kc_decimal: input.point.kc,
    executed_irrigation_candidates: [],
  };
}

function classifyWetnessV1(excess: string, span: string): {
  regime: Cap08S5PrequalificationWetnessRegimeV1;
  eligible: boolean;
} {
  const excessUnits = parseFixedDecimalV1(excess, 6);
  const spanUnits = parseFixedDecimalV1(span, 6);
  if (spanUnits <= 0n) throw new Error("CAP08_S5_PREQUALIFICATION_WETNESS_SPAN_INVALID");
  if (excessUnits <= 0n) return { regime: "NO_POSITIVE_EXCESS", eligible: false };
  if (excessUnits * 100n < spanUnits * 10n) return { regime: "LOW_EXCESS", eligible: true };
  if (excessUnits * 100n < spanUnits * 30n) return { regime: "MID_EXCESS", eligible: true };
  return { regime: "HIGH_EXCESS", eligible: true };
}

function baseTraceMatchesV1(
  point: Cap04CanonicalCompletedForecastRunPayloadV1["points"][number],
  result: ReturnType<typeof executeHourlyWaterBalanceV1>,
): boolean {
  const trace = result.mass_balance_trace;
  return trace.previous_storage_mm === point.previous_storage_mm
    && trace.gross_rainfall_mm === point.gross_precipitation_assumption_mm
    && trace.surface_runoff_mm === point.surface_runoff_mm
    && trace.effective_rainfall_mm === point.effective_precipitation_mm
    && trace.requested_crop_et_mm === point.requested_crop_et_mm
    && trace.actual_crop_et_mm === point.actual_crop_et_mm
    && trace.unmet_crop_et_mm === point.unmet_crop_et_mm
    && trace.drainage_mm === point.drainage_mm
    && trace.saturation_overflow_mm === point.saturation_overflow_mm
    && trace.next_storage_mm === point.storage_mean_mm
    && trace.mass_balance_error_mm === point.mass_balance_error_mm;
}

class Cap08S5PrequalificationPredictionPortV1 implements Cap06CalibrationPredictionPortV1 {
  readonly adapter_id = CAP08_S5_PREQUALIFICATION_REPLAY_ADAPTER_ID_V1;
  constructor(private readonly casesByResidual: ReadonlyMap<string, Cap08S5PrequalificationCaseV1>) {}

  predictCase(caseItem: Cap06CalibrationCaseV1, parameterValue: string): Cap06PredictionResultV1 {
    const exact = this.casesByResidual.get(caseItem.residual_ref);
    if (!exact) throw new Error(`CAP08_S5_PREQUALIFICATION_EXACT_CASE_REQUIRED:${caseItem.residual_ref}`);
    const config = {
      ...structuredClone(exact.base_config),
      drainage_coefficient_per_hour: fixed6V1(parameterValue, "CAP08_S5_PREQUALIFICATION_PARAMETER_REQUIRED"),
    };
    const result = executeHourlyWaterBalanceV1({
      ...structuredClone(exact.input_without_config),
      config,
    });
    const isBase = config.drainage_coefficient_per_hour
      === fixed6V1(exact.base_config.drainage_coefficient_per_hour, "CAP08_S5_PREQUALIFICATION_BASE_PARAMETER_REQUIRED");
    return {
      prediction_vwc: result.published_state.root_zone_vwc_fraction.mean,
      storage_mm: result.mass_balance_trace.next_storage_mm,
      mass_balance_hash: result.mass_balance_trace_hash,
      base_trace_match: !isBase || baseTraceMatchesV1(exact.source_forecast_point, result),
      physical_invariant_status: "PASS",
      mass_balance_status: result.mass_balance_trace.mass_balance_error_mm === "0.000000" ? "PASS" : "FAIL",
    };
  }
}

async function deterministicPredictionV1(input: {
  port: Cap06CalibrationPredictionPortV1;
  caseItem: Cap06CalibrationCaseV1;
  parameterValue: string;
}): Promise<Cap06PredictionResultV1> {
  const first = await input.port.predictCase(input.caseItem, input.parameterValue);
  const second = await input.port.predictCase(input.caseItem, input.parameterValue);
  if (semanticHashV1(first) !== semanticHashV1(second)) {
    throw new Error(`CAP08_S5_PREQUALIFICATION_DETERMINISM_FAILURE:${input.caseItem.residual_ref}:${input.parameterValue}`);
  }
  return structuredClone(first);
}

export async function runCap08S5EligibilitySurfaceV1(input: {
  calibrationWindow: Cap08S5PrequalificationWindowV1;
  objectiveIneligibleObservationRefs: readonly string[];
}) {
  if (input.calibrationWindow.role !== "CALIBRATION" || input.calibrationWindow.cases.length !== 16) {
    throw new Error("CAP08_S5_PREQUALIFICATION_EXACT_16_CASE_WINDOW_REQUIRED");
  }
  const cases = input.calibrationWindow.cases;
  const ineligibleRefs = [...input.objectiveIneligibleObservationRefs];
  if (new Set(ineligibleRefs).size !== ineligibleRefs.length) {
    throw new Error("CAP08_S5_PREQUALIFICATION_INELIGIBLE_REFS_NOT_UNIQUE");
  }
  const unmatched = ineligibleRefs.filter((ref) => !cases.some((item) => item.actual_observation_ref === ref));
  if (unmatched.length) throw new Error(`CAP08_S5_PREQUALIFICATION_INELIGIBLE_REF_MISSING:${unmatched.join(",")}`);
  const objectiveEligible = cases.map((item) => !ineligibleRefs.includes(item.actual_observation_ref));
  const objectiveCaseCount = objectiveEligible.filter(Boolean).length;
  if (objectiveCaseCount < 1) throw new Error("CAP08_S5_PREQUALIFICATION_OBJECTIVE_CASES_REQUIRED");
  const port = new Cap08S5PrequalificationPredictionPortV1(
    new Map(cases.map((item) => [item.residual_ref, item])),
  );
  const evaluated: EvaluatedV1[] = [];
  for (const parameterValue of buildCap06ParameterGridV1()) {
    const predictions: Cap06PredictionResultV1[] = [];
    const objectiveResiduals: string[] = [];
    let physicalFailureCount = 0;
    let massBalanceFailureCount = 0;
    let baseReplayMismatchCount = 0;
    for (let index = 0; index < cases.length; index += 1) {
      const prediction = await deterministicPredictionV1({
        port,
        caseItem: cases[index] as unknown as Cap06CalibrationCaseV1,
        parameterValue,
      });
      predictions.push(prediction);
      if (objectiveEligible[index]) {
        objectiveResiduals.push(formatCap06VwcMetricV1(
          parseCap06VwcMetricV1(cases[index].actual_observation_vwc)
            - parseCap06VwcMetricV1(prediction.prediction_vwc),
        ));
      }
      if (prediction.physical_invariant_status !== "PASS") physicalFailureCount += 1;
      if (prediction.mass_balance_status !== "PASS") massBalanceFailureCount += 1;
      if (parameterValue === CAP06_BASE_PARAMETER_VALUE_V1 && !prediction.base_trace_match) {
        baseReplayMismatchCount += 1;
      }
    }
    const metrics = buildCap06ErrorMetricsV1(objectiveResiduals);
    const semantic = {
      parameter_value: parameterValue,
      parameter_delta: parameterDeltaV1(parameterValue),
      metrics,
      sensitive_case_count: 0,
      represented_sensitive_wetness_regimes: [] as Cap06WetnessRegimeV1[],
      physical_failure_count: physicalFailureCount,
      mass_balance_failure_count: massBalanceFailureCount,
      base_replay_mismatch_count: baseReplayMismatchCount,
    };
    evaluated.push({
      surface: { ...semantic, determinism_hash: semanticHashV1(semantic) },
      predictions,
    });
  }
  const minimum = evaluated.find((item) => item.surface.parameter_value === CAP06_SEARCH_MINIMUM_V1);
  const maximum = evaluated.find((item) => item.surface.parameter_value === CAP06_SEARCH_MAXIMUM_V1);
  if (!minimum || !maximum) throw new Error("CAP08_S5_PREQUALIFICATION_GRID_ENDPOINTS_REQUIRED");
  const epsilon = parseCap06VwcMetricV1(CAP06_SENSITIVITY_EPSILON_VWC_V1);
  const sensitiveIndexes: number[] = [];
  for (let index = 0; index < cases.length; index += 1) {
    if (!objectiveEligible[index]) continue;
    const lower = parseCap06VwcMetricV1(minimum.predictions[index].prediction_vwc);
    const upper = parseCap06VwcMetricV1(maximum.predictions[index].prediction_vwc);
    if (absoluteV1(upper - lower) >= epsilon) sensitiveIndexes.push(index);
  }
  const representedRegimes = [...new Set(
    sensitiveIndexes.map((index) => cases[index].wetness_regime)
      .filter((value): value is Cap06WetnessRegimeV1 => value !== "NO_POSITIVE_EXCESS"),
  )].sort();
  for (const item of evaluated) {
    const semantic = {
      ...item.surface,
      sensitive_case_count: sensitiveIndexes.length,
      represented_sensitive_wetness_regimes: representedRegimes,
    };
    item.surface = {
      ...semantic,
      determinism_hash: semanticHashV1({
        parameter_value: semantic.parameter_value,
        parameter_delta: semantic.parameter_delta,
        metrics: semantic.metrics,
        sensitive_case_count: semantic.sensitive_case_count,
        represented_sensitive_wetness_regimes: semantic.represented_sensitive_wetness_regimes,
        physical_failure_count: semantic.physical_failure_count,
        mass_balance_failure_count: semantic.mass_balance_failure_count,
        base_replay_mismatch_count: semantic.base_replay_mismatch_count,
      }),
    };
  }
  const ranked = evaluated.map((item) => item.surface).sort(compareSurfaceV1);
  const selected = ranked[0];
  const second = ranked[1];
  const worst = ranked[ranked.length - 1];
  const baseline = ranked.find((item) => item.parameter_value === CAP06_BASE_PARAMETER_VALUE_V1);
  if (!selected || !second || !worst || !baseline) {
    throw new Error("CAP08_S5_PREQUALIFICATION_GRID_RESULT_CARDINALITY");
  }
  const objectiveRange = BigInt(worst.metrics.sum_squared_error_scale_18)
    - BigInt(selected.metrics.sum_squared_error_scale_18);
  const bestSecondMargin = BigInt(second.metrics.sum_squared_error_scale_18)
    - BigInt(selected.metrics.sum_squared_error_scale_18);
  const excitationPass = sensitiveIndexes.length >= CAP06_MINIMUM_SENSITIVE_CASE_COUNT_V1
    && representedRegimes.length >= CAP06_MINIMUM_WETNESS_REGIME_COUNT_V1;
  let status: string;
  if (baseline.base_replay_mismatch_count > 0) status = "BASE_REPLAY_MISMATCH";
  else if (selected.physical_failure_count > 0) status = "PHYSICAL_INVARIANT_FAILURE";
  else if (selected.mass_balance_failure_count > 0) status = "MASS_BALANCE_FAILURE";
  else if (!excitationPass) status = "INSUFFICIENT_PARAMETER_EXCITATION";
  else if (objectiveRange < CAP06_OBJECTIVE_MSE_RANGE_EPSILON_SSE_SCALE_18_V1) status = "OBJECTIVE_SURFACE_FLAT";
  else if (bestSecondMargin < CAP06_BEST_SECOND_MSE_MARGIN_EPSILON_SSE_SCALE_18_V1) status = "OBJECTIVE_MARGIN_INSUFFICIENT";
  else if (selected.parameter_value === CAP06_SEARCH_MINIMUM_V1 || selected.parameter_value === CAP06_SEARCH_MAXIMUM_V1) status = "SEARCH_BOUNDARY_HIT_INCONCLUSIVE";
  else if (selected.parameter_value === CAP06_BASE_PARAMETER_VALUE_V1) status = "NO_OP_BASE_PARAMETER_RETAINED";
  else status = "BOUNDED_PARAMETER_DELTA_CANDIDATE";
  const result = {
    schema_version: "geox_mcft_cap08_s5_prequalification_surface_v1" as const,
    policy_id: CAP08_S5_PREQUALIFICATION_POLICY_ID_V1,
    case_window_count: cases.length,
    objective_case_count: objectiveCaseCount,
    diagnostic_only_case_count: cases.length - objectiveCaseCount,
    objective_ineligible_observation_refs: ineligibleRefs,
    objective_ineligible_residual_refs: cases.filter((_, index) => !objectiveEligible[index]).map((item) => item.residual_ref),
    status,
    canonical_append_allowed: status === "BOUNDED_PARAMETER_DELTA_CANDIDATE" || status === "NO_OP_BASE_PARAMETER_RETAINED",
    selected_parameter_value: selected.parameter_value,
    selected_parameter_delta: selected.parameter_delta,
    baseline_metrics: baseline.metrics,
    selected_metrics: selected.metrics,
    objective_surface: evaluated.map((item) => item.surface),
    objective_mse_range_sse_scale_18: objectiveRange.toString(),
    best_vs_second_mse_margin_sse_scale_18: bestSecondMargin.toString(),
    excitation_summary: {
      sensitive_case_count: sensitiveIndexes.length,
      minimum_sensitive_case_count: CAP06_MINIMUM_SENSITIVE_CASE_COUNT_V1,
      represented_sensitive_wetness_regimes: representedRegimes,
      minimum_represented_sensitive_wetness_regimes: CAP06_MINIMUM_WETNESS_REGIME_COUNT_V1,
      sensitivity_epsilon_vwc_fraction: CAP06_SENSITIVITY_EPSILON_VWC_V1,
      status: excitationPass ? "PASS" as const : "INSUFFICIENT_PARAMETER_EXCITATION" as const,
    },
    case_input_set_hash: input.calibrationWindow.case_input_set_hash,
    eligibility_policy_hash: semanticHashV1({
      policy_id: CAP08_S5_PREQUALIFICATION_POLICY_ID_V1,
      objective_ineligible_observation_refs: ineligibleRefs,
      case_input_set_hash: input.calibrationWindow.case_input_set_hash,
    }),
  };
  return { ...result, determinism_hash: semanticHashV1(result) };
}

export async function constructCap08S5PrequalificationWindowsV1(input: {
  pool: Pool;
  runtimeRepository: PostgresRuntimeRepositoryV1;
  scope: TwinScopeKeyV1;
  obligations: readonly Cap08S5PrequalificationObligationV1[];
  created_at: string;
}) {
  if (input.obligations.length !== 24) {
    throw new Error(`CAP08_S5_PREQUALIFICATION_OBLIGATION_COUNT:${input.obligations.length}`);
  }
  const persistence = new PostgresFeedbackPersistenceRepositoryV1(input.pool);
  const resolvedCases: Cap08S5PrequalificationCaseV1[] = [];
  const residuals: Cap05ForecastResidualEnvelopeV1[] = [];
  const persistenceStatuses: string[] = [];
  for (let index = 0; index < input.obligations.length; index += 1) {
    const obligation = input.obligations[index];
    const expectedOrder = index + 1;
    if (obligation.order !== expectedOrder
      || obligation.residual_id !== `R-${String(expectedOrder).padStart(2, "0")}`
      || obligation.observation.source_record_id !== `FVO-${String(expectedOrder).padStart(2, "0")}`) {
      throw new Error(`CAP08_S5_PREQUALIFICATION_OBLIGATION_ORDER:${expectedOrder}`);
    }
    const ordinaryRequired = (CAP08_S5_PREQUALIFICATION_ORDINARY_ASSIMILATION_ORDERS_V1 as readonly number[]).includes(expectedOrder);
    if (ordinaryRequired !== (obligation.assimilation !== null)) {
      throw new Error(`CAP08_S5_PREQUALIFICATION_ASSIMILATION_ROLE:${expectedOrder}`);
    }
    exactScopeV1(obligation.forecast, input.scope, "CAP08_S5_PREQUALIFICATION_FORECAST_SCOPE");
    if (obligation.forecast.object_type !== "twin_forecast_run_v1") {
      throw new Error(`CAP08_S5_PREQUALIFICATION_FORECAST_TYPE:${expectedOrder}`);
    }
    const forecastPayload = obligation.forecast.payload as unknown as Cap04CanonicalCompletedForecastRunPayloadV1;
    validateCap04CanonicalForecastRunPayloadV1(forecastPayload);
    if (forecastPayload.status !== "COMPLETED") throw new Error(`CAP08_S5_PREQUALIFICATION_FORECAST_NOT_COMPLETED:${expectedOrder}`);
    const point = forecastPayload.points[0];
    if (!point || point.horizon_hour !== 1
      || point.target_time !== obligation.observation.role_time.observed_at) {
      throw new Error(`CAP08_S5_PREQUALIFICATION_FORECAST_FVO_TIME:${expectedOrder}`);
    }
    if (obligation.assimilation) {
      exactScopeV1(obligation.assimilation, input.scope, "CAP08_S5_PREQUALIFICATION_ASSIMILATION_SCOPE");
      if (obligation.assimilation.object_type !== "twin_assimilation_update_v1") {
        throw new Error(`CAP08_S5_PREQUALIFICATION_ASSIMILATION_TYPE:${expectedOrder}`);
      }
      const payload = recordV1(obligation.assimilation.payload, "CAP08_S5_PREQUALIFICATION_ASSIMILATION_PAYLOAD");
      if (payload.selected_observation_ref !== obligation.observation.source_record_id
        || obligation.assimilation.logical_time !== obligation.observation.available_to_runtime_at) {
        throw new Error(`CAP08_S5_PREQUALIFICATION_ASSIMILATION_OBSERVATION:${expectedOrder}`);
      }
    }
    const runtimeConfig = await input.runtimeRepository.readRuntimeConfig(forecastPayload.runtime_config_ref);
    if (!runtimeConfig || runtimeConfig.determinism_hash !== forecastPayload.runtime_config_hash) {
      throw new Error(`CAP08_S5_PREQUALIFICATION_RUNTIME_CONFIG:${expectedOrder}`);
    }
    const resolvedConfig = new DirectCap04ExecutionConfigResolverV1().resolveExecutionConfig(runtimeConfig);
    const operatorPolicy = resolvedConfig.payload.observation_assimilation;
    const operator = buildRootZoneObservationOperatorV1({
      observation_fraction: Number(obligation.observation.canonical_payload.value),
      quality_status: obligation.observation.quality.status,
      sensor_measurement_stddev_fraction: operatorPolicy.sensor_measurement_stddev_fraction,
      point_to_zone_representativeness_stddev_fraction: operatorPolicy.point_to_zone_representativeness_stddev_fraction,
      quality_weights: operatorPolicy.quality_weights,
    });
    const residual = buildCap05ForecastResidualV1({
      scope: input.scope,
      forecast_run_ref: obligation.forecast.object_id,
      forecast_run_hash: obligation.forecast.determinism_hash,
      forecast_issued_at: forecastPayload.issued_at,
      forecast_point_ref: buildCap05ForecastPointMemberRefV1(obligation.forecast.object_id, 1),
      forecast_point: point,
      root_zone_geometry_ref: resolvedConfig.payload.reality_binding_ref,
      root_zone_geometry_hash: resolvedConfig.payload.reality_binding_hash,
      root_zone_depth_mm: fixed6V1(resolvedConfig.payload.soil_hydraulic_snapshot.root_zone_depth_mm, "CAP08_S5_PREQUALIFICATION_ROOT_DEPTH_REQUIRED"),
      actual_observation_ref: obligation.observation.source_record_id,
      actual_observation_hash: obligation.observation.source_record_hash,
      actual_observation_observed_at: obligation.observation.role_time.observed_at,
      actual_observation_quality: obligation.observation.quality.status,
      actual_observation_value: fixed6V1(obligation.observation.canonical_payload.value, "CAP08_S5_PREQUALIFICATION_OBSERVATION_VALUE"),
      actual_observation_variance: normalizeFixedDecimalV1(String(operator.effective_observation_variance), 12),
      representativeness_variance: normalizeFixedDecimalV1(String(operator.representativeness_variance), 12),
      runtime_config_ref: runtimeConfig.object_id,
      runtime_config_hash: runtimeConfig.determinism_hash,
      context_lineage_ref: requiredStringV1(obligation.forecast.lineage_id, "CAP08_S5_PREQUALIFICATION_LINEAGE_REQUIRED"),
      context_revision_ref: requiredStringV1(obligation.forecast.revision_id, "CAP08_S5_PREQUALIFICATION_REVISION_REQUIRED"),
      observation_available_to_runtime_at: obligation.observation.available_to_runtime_at,
      assimilation_update_ref: obligation.assimilation?.object_id ?? null,
      assimilation_update_hash: obligation.assimilation?.determinism_hash ?? null,
      created_at: input.created_at,
    });
    const persisted = await persistence.commitCanonicalObject({ object: residual });
    const readback = await persistence.readCanonicalObject(residual.object_id);
    if (!readback || readback.determinism_hash !== residual.determinism_hash) {
      throw new Error(`CAP08_S5_PREQUALIFICATION_RESIDUAL_READBACK:${expectedOrder}`);
    }
    residuals.push(residual);
    persistenceStatuses.push(persisted.status);
    const fieldCapacity = fixed6V1(resolvedConfig.payload.soil_hydraulic_snapshot.field_capacity_storage_mm, "CAP08_S5_PREQUALIFICATION_FIELD_CAPACITY_REQUIRED");
    const saturation = fixed6V1(resolvedConfig.payload.soil_hydraulic_snapshot.saturation_storage_mm, "CAP08_S5_PREQUALIFICATION_SATURATION_REQUIRED");
    const storageBeforeDrainage = add6V1(point.storage_mean_mm, point.drainage_mm, point.saturation_overflow_mm);
    const excess = subtract6V1(storageBeforeDrainage, fieldCapacity);
    const span = subtract6V1(saturation, fieldCapacity);
    const wetness = classifyWetnessV1(excess, span);
    const objectiveEligible = obligation.observation.source_record_id !== "FVO-10";
    const caseInputHash = semanticHashV1({
      residual_ref: residual.object_id,
      residual_hash: residual.determinism_hash,
      forecast_ref: obligation.forecast.object_id,
      forecast_hash: obligation.forecast.determinism_hash,
      forecast_point_hash: point.determinism_hash,
      observation_ref: obligation.observation.source_record_id,
      observation_hash: obligation.observation.source_record_hash,
      runtime_config_ref: runtimeConfig.object_id,
      runtime_config_hash: runtimeConfig.determinism_hash,
      assimilation_ref: obligation.assimilation?.object_id ?? null,
      assimilation_hash: obligation.assimilation?.determinism_hash ?? null,
      objective_eligible: objectiveEligible,
    });
    resolvedCases.push({
      case_index: index,
      scope: structuredClone(input.scope),
      residual_ref: residual.object_id,
      residual_hash: residual.determinism_hash,
      source_forecast_ref: obligation.forecast.object_id,
      source_forecast_hash: obligation.forecast.determinism_hash,
      source_forecast_point_ref: residual.payload.forecast_point_ref,
      source_forecast_point_hash: point.determinism_hash,
      source_posterior_ref: forecastPayload.source_posterior_ref,
      source_posterior_hash: forecastPayload.source_posterior_hash,
      source_runtime_config_ref: runtimeConfig.object_id,
      source_runtime_config_hash: runtimeConfig.determinism_hash,
      actual_observation_ref: obligation.observation.source_record_id,
      actual_observation_hash: obligation.observation.source_record_hash,
      forecast_issued_at: forecastPayload.issued_at,
      forecast_as_of: requiredStringV1(obligation.forecast.as_of, "CAP08_S5_PREQUALIFICATION_FORECAST_AS_OF"),
      forecast_evidence_cutoff: requiredStringV1(obligation.forecast.as_of, "CAP08_S5_PREQUALIFICATION_EVIDENCE_CUTOFF"),
      forecast_target_time: point.target_time,
      observation_observed_at: obligation.observation.role_time.observed_at,
      observation_available_to_runtime_at: obligation.observation.available_to_runtime_at,
      actual_observation_vwc: residual.payload.actual_observation_value,
      base_prediction_vwc: residual.payload.predicted_observation_value,
      excess_above_field_capacity_mm: excess,
      saturation_minus_field_capacity_mm: span,
      wetness_regime: wetness.regime,
      context_lineage_ref: requiredStringV1(obligation.forecast.lineage_id, "CAP08_S5_PREQUALIFICATION_LINEAGE_REQUIRED"),
      context_revision_ref: requiredStringV1(obligation.forecast.revision_id, "CAP08_S5_PREQUALIFICATION_REVISION_REQUIRED"),
      model_component_hash: semanticHashV1(resolvedConfig.payload.model_component_refs),
      effective_parameter_bundle_hash: semanticHashV1({
        soil_hydraulic_snapshot: resolvedConfig.payload.soil_hydraulic_snapshot,
        dynamics_parameters: resolvedConfig.payload.dynamics_parameters,
      }),
      observation_operator_hash: semanticHashV1(resolvedConfig.payload.observation_assimilation.observation_operator),
      geometry_hash: resolvedConfig.payload.reality_binding_hash,
      runtime_replay_numeric_policy_hash: semanticHashV1({
        decimal_scale_policy_id: resolvedConfig.payload.decimal_scale_policy_id,
        rounding_policy_id: resolvedConfig.payload.rounding_policy_id,
      }),
      case_input_hash: caseInputHash,
      drainage_excitation_eligible: wetness.eligible,
      objective_eligible: objectiveEligible,
      source_forecast_point: structuredClone(point),
      input_without_config: replayInputV1({ point, sourcePosteriorRef: forecastPayload.source_posterior_ref }),
      base_config: replayConfigV1(resolvedConfig),
    });
  }
  const buildWindow = (role: "CALIBRATION" | "HOLDOUT", cases: Cap08S5PrequalificationCaseV1[]): Cap08S5PrequalificationWindowV1 => {
    const expected = role === "CALIBRATION" ? 16 : 8;
    if (cases.length !== expected) throw new Error(`CAP08_S5_PREQUALIFICATION_${role}_COUNT:${cases.length}`);
    const semantic = {
      schema_version: "geox_mcft_cap08_s5_prequalification_window_v1" as const,
      role,
      case_builder_id: CAP08_S5_PREQUALIFICATION_CASE_BUILDER_ID_V1,
      cases: structuredClone(cases),
      ordered_residual_refs: cases.map((item) => item.residual_ref),
      ordered_residual_hashes: cases.map((item) => item.residual_hash),
      case_input_set_hash: semanticHashV1(cases.map((item) => ({
        residual_ref: item.residual_ref,
        residual_hash: item.residual_hash,
        case_input_hash: item.case_input_hash,
      }))),
      window_ref_membership_hash: semanticHashV1(cases.map((item) => item.residual_ref)),
      no_positive_excess_case_count: cases.filter((item) => item.wetness_regime === "NO_POSITIVE_EXCESS").length,
      objective_case_count: cases.filter((item) => item.objective_eligible).length,
      diagnostic_only_case_count: cases.filter((item) => !item.objective_eligible).length,
    };
    return { ...semantic, determinism_hash: semanticHashV1(semantic) };
  };
  const calibration = buildWindow("CALIBRATION", resolvedCases.slice(0, 16));
  const holdout = buildWindow("HOLDOUT", resolvedCases.slice(16));
  if (calibration.objective_case_count !== 15
    || calibration.diagnostic_only_case_count !== 1
    || calibration.cases.find((item) => item.actual_observation_ref === "FVO-10")?.objective_eligible !== false) {
    throw new Error("CAP08_S5_PREQUALIFICATION_FVO10_ELIGIBILITY_MISMATCH");
  }
  return {
    residuals,
    persistence_statuses: persistenceStatuses,
    residual_insert_count: persistenceStatuses.filter((status) => status === "INSERTED").length,
    calibration,
    holdout,
    residual_set_hash: semanticHashV1(residuals.map((item) => ({ ref: item.object_id, hash: item.determinism_hash }))),
    case_input_set_hash: semanticHashV1(resolvedCases.map((item) => ({
      residual_ref: item.residual_ref,
      residual_hash: item.residual_hash,
      case_input_hash: item.case_input_hash,
    }))),
  };
}
