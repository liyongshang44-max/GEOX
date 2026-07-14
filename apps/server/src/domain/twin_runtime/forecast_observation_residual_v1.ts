// apps/server/src/domain/twin_runtime/forecast_observation_residual_v1.ts
// Purpose: project one historical root-zone storage Forecast point into the existing H=1 root-zone-mean VWC observation domain and build the frozen DT-02 Forecast Residual object.
// Boundary: pure fixed-point projection, member-reference resolution, residual math, contract construction and validation only; no observation selection, assimilation, persistence, State mutation, clock, filesystem, environment, or network.

import {
  WATER_AMOUNT_SCALE_V1,
  WATER_VARIANCE_SCALE_V1,
  divideFixedUnitsV1,
  formatFixedDecimalV1,
  parseFixedDecimalV1,
  squareScale6ToScale12V1,
  sqrtScale12ToScale6V1,
} from "../soil_water/fixed_point_water_decimal_v1.js";
import {
  computeMemberDeterminismHashV1,
  deriveSemanticObjectIdV1,
  semanticHashV1,
} from "./canonical_identity_v1.js";
import type { ContinuationScopeV1 } from "./continuation_operation_identity_v1.js";
import {
  CAP04_FORECAST_HORIZON_HOURS_V1,
  validateCap04ForecastPointV1,
  type Cap04ForecastPointV1,
} from "./forecast_scenario_contracts_v1.js";
import type { Cap05NonLineageEnvelopeV1 } from "./feedback_canonical_contracts_v1.js";

export const CAP05_FORECAST_RESIDUAL_OBJECT_TYPE_V1 = "twin_forecast_residual_v1" as const;
export const CAP05_FORECAST_RESIDUAL_CONTRACT_ID_V1 = "MCFT_CAP_05_FORECAST_OBSERVATION_RESIDUAL_V1" as const;
export const CAP05_FORECAST_RESIDUAL_TRANSACTION_VARIANT_V1 = "C_FORECAST_RESIDUAL_COMMIT" as const;
export const CAP05_FORECAST_POINT_MEMBER_REF_POLICY_ID_V1 = "GEOX_FORECAST_POINT_SEMANTIC_MEMBER_REF_V1" as const;
export const CAP05_FORECAST_RESIDUAL_MATCHING_POLICY_ID_V1 = "LATEST_COMPLETED_FORECAST_POINT_TARGETING_OBSERVATION_V1" as const;
export const CAP05_FORECAST_RESIDUAL_MATCHING_POLICY_VERSION_V1 = "1" as const;
export const CAP05_FORECAST_OBSERVATION_PROJECTION_METHOD_ID_V1 = "FORECAST_STORAGE_TO_ROOT_ZONE_MEAN_VWC_H1_V1" as const;
export const CAP05_FORECAST_OBSERVATION_PROJECTION_METHOD_VERSION_V1 = "1" as const;
export const CAP05_FORECAST_OBSERVATION_VARIANCE_METHOD_ID_V1 = "STORAGE_VARIANCE_DIVIDED_BY_ROOT_ZONE_DEPTH_SQUARED_V1" as const;
export const CAP05_FORECAST_RESIDUAL_FORMULA_ID_V1 = "ACTUAL_MINUS_PREDICTED_V1" as const;
export const CAP05_NORMALIZED_RESIDUAL_FORMULA_ID_V1 = "RESIDUAL_DIVIDED_BY_SQRT_PREDICTED_PLUS_OBSERVATION_VARIANCE_V1" as const;
export const CAP05_FORECAST_RESIDUAL_NORMALIZATION_BASIS_V1 = "FORECAST_PLUS_EFFECTIVE_OBSERVATION_VARIANCE_V1" as const;
export const CAP05_FORECAST_RESIDUAL_ROUNDING_RULE_ID_V1 = "DECIMAL_HALF_AWAY_FROM_ZERO_V1" as const;
export const CAP05_FORECAST_RESIDUAL_ROUNDING_RULE_VERSION_V1 = "1" as const;
export const CAP05_FORECAST_ASSIMILATION_RELATION_POLICY_V1 = "DISTINCT_UNLESS_EXPLICIT_EQUIVALENCE_PROOF_V1" as const;

export type Cap05ForecastObservationQualityV1 = "PASS" | "LIMITED";

export type Cap05ForecastObservationProjectionV1 = {
  projection_method_id: typeof CAP05_FORECAST_OBSERVATION_PROJECTION_METHOD_ID_V1;
  projection_method_version: typeof CAP05_FORECAST_OBSERVATION_PROJECTION_METHOD_VERSION_V1;
  variance_projection_method_id: typeof CAP05_FORECAST_OBSERVATION_VARIANCE_METHOD_ID_V1;
  forecast_point_member_ref_policy_id: typeof CAP05_FORECAST_POINT_MEMBER_REF_POLICY_ID_V1;
  observation_operator_id: "POINT_200MM_TO_ROOT_ZONE_MEAN_H1_WITH_REPRESENTATIVENESS_V1";
  observation_operator_version: "1";
  observation_operator_h: "1.000000";
  direct_state_equivalence: false;
  forecast_run_ref: string;
  forecast_run_hash: string;
  forecast_issued_at: string;
  forecast_point_ref: string;
  forecast_point_hash: string;
  forecast_horizon_hour: number;
  forecast_target_time: string;
  root_zone_geometry_ref: string;
  root_zone_geometry_hash: string;
  root_zone_depth_mm: string;
  predicted_storage_mean_mm: string;
  predicted_storage_variance_mm2: string;
  predicted_observation_value: string;
  predicted_observation_unit: "fraction";
  predicted_observation_variance: string;
  actual_observation_ref: string;
  actual_observation_hash: string;
  actual_observation_observed_at: string;
  actual_observation_quality: Cap05ForecastObservationQualityV1;
  actual_observation_value: string;
  actual_observation_unit: "fraction";
  actual_observation_variance: string;
  representativeness_variance: string;
  residual_value: string;
  residual_unit: "fraction";
  total_residual_variance: string;
  normalized_residual: string;
  normalization_status: "COMPUTED";
  normalization_basis: typeof CAP05_FORECAST_RESIDUAL_NORMALIZATION_BASIS_V1;
  residual_formula_id: typeof CAP05_FORECAST_RESIDUAL_FORMULA_ID_V1;
  normalized_residual_formula_id: typeof CAP05_NORMALIZED_RESIDUAL_FORMULA_ID_V1;
  rounding_rule_id: typeof CAP05_FORECAST_RESIDUAL_ROUNDING_RULE_ID_V1;
  rounding_rule_version: typeof CAP05_FORECAST_RESIDUAL_ROUNDING_RULE_VERSION_V1;
  projection_input_hash: string;
  projection_trace_hash: string;
};

export type Cap05ForecastResidualPayloadV1 = Cap05ForecastObservationProjectionV1 & {
  record_set_contract_id: typeof CAP05_FORECAST_RESIDUAL_CONTRACT_ID_V1;
  transaction_variant: typeof CAP05_FORECAST_RESIDUAL_TRANSACTION_VARIANT_V1;
  match_status: "MATCHED";
  matching_policy_id: typeof CAP05_FORECAST_RESIDUAL_MATCHING_POLICY_ID_V1;
  matching_policy_version: typeof CAP05_FORECAST_RESIDUAL_MATCHING_POLICY_VERSION_V1;
  observation_available_to_runtime_at: string;
  runtime_config_ref: string;
  runtime_config_hash: string;
  assimilation_update_ref: string | null;
  assimilation_update_hash: string | null;
  forecast_assimilation_relation_policy_id: typeof CAP05_FORECAST_ASSIMILATION_RELATION_POLICY_V1;
  equivalence_proof_ref: string | null;
  equivalence_claimed: false;
};

export type Cap05ForecastResidualEnvelopeV1 = Cap05NonLineageEnvelopeV1<
  typeof CAP05_FORECAST_RESIDUAL_OBJECT_TYPE_V1,
  Cap05ForecastResidualPayloadV1
>;

export type ResolveCap05ForecastPointMemberInputV1 = {
  forecast_run_ref: string;
  forecast_issued_at: string;
  forecast_points: readonly Cap04ForecastPointV1[];
  forecast_point_ref: string;
};

export type ProjectCap05ForecastObservationInputV1 = {
  forecast_run_ref: string;
  forecast_run_hash: string;
  forecast_issued_at: string;
  forecast_point_ref: string;
  forecast_point: Cap04ForecastPointV1;
  root_zone_geometry_ref: string;
  root_zone_geometry_hash: string;
  root_zone_depth_mm: string;
  actual_observation_ref: string;
  actual_observation_hash: string;
  actual_observation_observed_at: string;
  actual_observation_quality: Cap05ForecastObservationQualityV1;
  actual_observation_value: string;
  actual_observation_variance: string;
  representativeness_variance: string;
};

export type BuildCap05ForecastResidualInputV1 = ProjectCap05ForecastObservationInputV1 & {
  scope: ContinuationScopeV1;
  runtime_config_ref: string;
  runtime_config_hash: string;
  context_lineage_ref: string;
  context_revision_ref: string;
  observation_available_to_runtime_at: string;
  assimilation_update_ref?: string | null;
  assimilation_update_hash?: string | null;
  created_at: string;
};

function requiredStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

function canonicalInstantV1(value: unknown, code: string): string {
  const text = requiredStringV1(value, code);
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== text) throw new Error(code);
  return text;
}

function canonicalHourV1(value: unknown, code: string): string {
  const text = canonicalInstantV1(value, code);
  if (!text.endsWith(":00:00.000Z")) throw new Error(code);
  return text;
}

function addHoursV1(value: string, hours: number): string {
  return new Date(Date.parse(value) + hours * 3_600_000).toISOString();
}

function exactScopeV1(scope: ContinuationScopeV1): ContinuationScopeV1 {
  return {
    tenant_id: requiredStringV1(scope?.tenant_id, "CAP05_RESIDUAL_SCOPE_TENANT_REQUIRED"),
    project_id: requiredStringV1(scope?.project_id, "CAP05_RESIDUAL_SCOPE_PROJECT_REQUIRED"),
    group_id: requiredStringV1(scope?.group_id, "CAP05_RESIDUAL_SCOPE_GROUP_REQUIRED"),
    field_id: requiredStringV1(scope?.field_id, "CAP05_RESIDUAL_SCOPE_FIELD_REQUIRED"),
    season_id: requiredStringV1(scope?.season_id, "CAP05_RESIDUAL_SCOPE_SEASON_REQUIRED"),
    zone_id: requiredStringV1(scope?.zone_id, "CAP05_RESIDUAL_SCOPE_ZONE_REQUIRED"),
  };
}

function exactObservationQualityV1(value: unknown): Cap05ForecastObservationQualityV1 {
  if (value !== "PASS" && value !== "LIMITED") throw new Error("CAP05_RESIDUAL_MATCHED_OBSERVATION_QUALITY_UNUSABLE");
  return value;
}

function positiveHorizonV1(value: unknown): number {
  if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > CAP04_FORECAST_HORIZON_HOURS_V1) {
    throw new Error("CAP05_FORECAST_POINT_HORIZON_INVALID");
  }
  return Number(value);
}

export function buildCap05ForecastPointMemberRefV1(forecastRunRef: string, horizonHour: number): string {
  return `${requiredStringV1(forecastRunRef, "CAP05_FORECAST_RUN_REF_REQUIRED")}#/points/${positiveHorizonV1(horizonHour)}`;
}

export function resolveCap05ForecastPointMemberV1(input: ResolveCap05ForecastPointMemberInputV1): Cap04ForecastPointV1 {
  const forecastRunRef = requiredStringV1(input.forecast_run_ref, "CAP05_FORECAST_RUN_REF_REQUIRED");
  const issuedAt = canonicalHourV1(input.forecast_issued_at, "CAP05_FORECAST_ISSUED_AT_INVALID");
  const memberRef = requiredStringV1(input.forecast_point_ref, "CAP05_FORECAST_POINT_REF_REQUIRED");
  const prefix = `${forecastRunRef}#/points/`;
  if (!memberRef.startsWith(prefix)) throw new Error("CAP05_FORECAST_POINT_MEMBER_REF_RUN_MISMATCH");
  const horizonText = memberRef.slice(prefix.length);
  if (!/^[1-9]\d*$/.test(horizonText)) throw new Error("CAP05_FORECAST_POINT_MEMBER_REF_INVALID");
  const horizon = positiveHorizonV1(Number(horizonText));
  if (memberRef !== buildCap05ForecastPointMemberRefV1(forecastRunRef, horizon)) throw new Error("CAP05_FORECAST_POINT_MEMBER_REF_INVALID");
  const matches = input.forecast_points.filter((point) => point.horizon_hour === horizon);
  if (matches.length !== 1) throw new Error("CAP05_FORECAST_POINT_MEMBER_CARDINALITY");
  validateCap04ForecastPointV1(matches[0], issuedAt, horizon);
  return structuredClone(matches[0]);
}

function projectionInputBasisV1(value: Omit<Cap05ForecastObservationProjectionV1, "projection_input_hash" | "projection_trace_hash" | "predicted_observation_value" | "predicted_observation_variance" | "residual_value" | "total_residual_variance" | "normalized_residual" | "normalization_status">): Record<string, unknown> {
  return {
    projection_method_id: value.projection_method_id,
    projection_method_version: value.projection_method_version,
    variance_projection_method_id: value.variance_projection_method_id,
    forecast_point_member_ref_policy_id: value.forecast_point_member_ref_policy_id,
    observation_operator_id: value.observation_operator_id,
    observation_operator_version: value.observation_operator_version,
    observation_operator_h: value.observation_operator_h,
    direct_state_equivalence: value.direct_state_equivalence,
    forecast_run_ref: value.forecast_run_ref,
    forecast_run_hash: value.forecast_run_hash,
    forecast_issued_at: value.forecast_issued_at,
    forecast_point_ref: value.forecast_point_ref,
    forecast_point_hash: value.forecast_point_hash,
    forecast_horizon_hour: value.forecast_horizon_hour,
    forecast_target_time: value.forecast_target_time,
    root_zone_geometry_ref: value.root_zone_geometry_ref,
    root_zone_geometry_hash: value.root_zone_geometry_hash,
    root_zone_depth_mm: value.root_zone_depth_mm,
    predicted_storage_mean_mm: value.predicted_storage_mean_mm,
    predicted_storage_variance_mm2: value.predicted_storage_variance_mm2,
    actual_observation_ref: value.actual_observation_ref,
    actual_observation_hash: value.actual_observation_hash,
    actual_observation_observed_at: value.actual_observation_observed_at,
    actual_observation_quality: value.actual_observation_quality,
    actual_observation_value: value.actual_observation_value,
    actual_observation_variance: value.actual_observation_variance,
    representativeness_variance: value.representativeness_variance,
    normalization_basis: value.normalization_basis,
    residual_formula_id: value.residual_formula_id,
    normalized_residual_formula_id: value.normalized_residual_formula_id,
    rounding_rule_id: value.rounding_rule_id,
    rounding_rule_version: value.rounding_rule_version,
  };
}

function projectionTraceBasisV1(value: Omit<Cap05ForecastObservationProjectionV1, "projection_trace_hash">): Record<string, unknown> {
  return {
    projection_input_hash: value.projection_input_hash,
    predicted_observation_value: value.predicted_observation_value,
    predicted_observation_variance: value.predicted_observation_variance,
    residual_value: value.residual_value,
    total_residual_variance: value.total_residual_variance,
    normalized_residual: value.normalized_residual,
    normalization_status: value.normalization_status,
  };
}

function computeProjectionMathV1(input: {
  root_zone_depth_mm: string;
  predicted_storage_mean_mm: string;
  predicted_storage_variance_mm2: string;
  actual_observation_value: string;
  actual_observation_variance: string;
  representativeness_variance: string;
}): {
  predicted_observation_value: string;
  predicted_observation_variance: string;
  residual_value: string;
  total_residual_variance: string;
  normalized_residual: string;
} {
  const rootDepthUnits = parseFixedDecimalV1(input.root_zone_depth_mm, WATER_AMOUNT_SCALE_V1, "CAP05_ROOT_ZONE_DEPTH_INVALID");
  if (rootDepthUnits <= 0n) throw new Error("CAP05_ROOT_ZONE_DEPTH_POSITIVE_REQUIRED");
  const storageMeanUnits = parseFixedDecimalV1(input.predicted_storage_mean_mm, WATER_AMOUNT_SCALE_V1, "CAP05_FORECAST_STORAGE_MEAN_INVALID");
  const storageVarianceUnits = parseFixedDecimalV1(input.predicted_storage_variance_mm2, WATER_VARIANCE_SCALE_V1, "CAP05_FORECAST_STORAGE_VARIANCE_INVALID");
  if (storageVarianceUnits < 0n) throw new Error("CAP05_FORECAST_STORAGE_VARIANCE_NEGATIVE");
  const actualObservationUnits = parseFixedDecimalV1(input.actual_observation_value, WATER_AMOUNT_SCALE_V1, "CAP05_ACTUAL_OBSERVATION_INVALID");
  const effectiveObservationVarianceUnits = parseFixedDecimalV1(input.actual_observation_variance, WATER_VARIANCE_SCALE_V1, "CAP05_ACTUAL_OBSERVATION_VARIANCE_INVALID");
  const representativenessVarianceUnits = parseFixedDecimalV1(input.representativeness_variance, WATER_VARIANCE_SCALE_V1, "CAP05_REPRESENTATIVENESS_VARIANCE_INVALID");
  if (effectiveObservationVarianceUnits < 0n || representativenessVarianceUnits < 0n) throw new Error("CAP05_OBSERVATION_VARIANCE_NEGATIVE");
  if (representativenessVarianceUnits > effectiveObservationVarianceUnits) throw new Error("CAP05_REPRESENTATIVENESS_VARIANCE_EXCEEDS_EFFECTIVE_OBSERVATION_VARIANCE");

  const predictedObservationUnits = divideFixedUnitsV1(
    storageMeanUnits,
    WATER_AMOUNT_SCALE_V1,
    rootDepthUnits,
    WATER_AMOUNT_SCALE_V1,
    WATER_AMOUNT_SCALE_V1,
  );
  const rootDepthSquaredUnits = squareScale6ToScale12V1(rootDepthUnits);
  const predictedVarianceUnits = divideFixedUnitsV1(
    storageVarianceUnits,
    WATER_VARIANCE_SCALE_V1,
    rootDepthSquaredUnits,
    WATER_VARIANCE_SCALE_V1,
    WATER_VARIANCE_SCALE_V1,
  );
  const residualUnits = actualObservationUnits - predictedObservationUnits;
  const totalVarianceUnits = predictedVarianceUnits + effectiveObservationVarianceUnits;
  if (totalVarianceUnits <= 0n) throw new Error("CAP05_TOTAL_RESIDUAL_VARIANCE_NON_POSITIVE");
  const standardDeviationUnits = sqrtScale12ToScale6V1(totalVarianceUnits);
  if (standardDeviationUnits <= 0n) throw new Error("CAP05_TOTAL_RESIDUAL_STANDARD_DEVIATION_NON_POSITIVE");
  const normalizedResidualUnits = divideFixedUnitsV1(
    residualUnits,
    WATER_AMOUNT_SCALE_V1,
    standardDeviationUnits,
    WATER_AMOUNT_SCALE_V1,
    WATER_AMOUNT_SCALE_V1,
  );
  return {
    predicted_observation_value: formatFixedDecimalV1(predictedObservationUnits, WATER_AMOUNT_SCALE_V1),
    predicted_observation_variance: formatFixedDecimalV1(predictedVarianceUnits, WATER_VARIANCE_SCALE_V1),
    residual_value: formatFixedDecimalV1(residualUnits, WATER_AMOUNT_SCALE_V1),
    total_residual_variance: formatFixedDecimalV1(totalVarianceUnits, WATER_VARIANCE_SCALE_V1),
    normalized_residual: formatFixedDecimalV1(normalizedResidualUnits, WATER_AMOUNT_SCALE_V1),
  };
}

export function projectCap05ForecastPointToObservationV1(
  input: ProjectCap05ForecastObservationInputV1,
): Cap05ForecastObservationProjectionV1 {
  const forecastRunRef = requiredStringV1(input.forecast_run_ref, "CAP05_FORECAST_RUN_REF_REQUIRED");
  const forecastRunHash = requiredStringV1(input.forecast_run_hash, "CAP05_FORECAST_RUN_HASH_REQUIRED");
  const issuedAt = canonicalHourV1(input.forecast_issued_at, "CAP05_FORECAST_ISSUED_AT_INVALID");
  const point = input.forecast_point;
  const horizon = positiveHorizonV1(point.horizon_hour);
  validateCap04ForecastPointV1(point, issuedAt, horizon);
  const expectedPointRef = buildCap05ForecastPointMemberRefV1(forecastRunRef, horizon);
  if (input.forecast_point_ref !== expectedPointRef) throw new Error("CAP05_FORECAST_POINT_MEMBER_REF_MISMATCH");
  const targetTime = canonicalHourV1(point.target_time, "CAP05_FORECAST_TARGET_TIME_INVALID");
  if (targetTime !== addHoursV1(issuedAt, horizon)) throw new Error("CAP05_FORECAST_POINT_ISSUED_TARGET_MISMATCH");
  const observedAt = canonicalHourV1(input.actual_observation_observed_at, "CAP05_ACTUAL_OBSERVATION_OBSERVED_AT_INVALID");
  if (observedAt !== targetTime) throw new Error("CAP05_RESIDUAL_OBSERVATION_TARGET_TIME_MISMATCH");

  const rootZoneDepth = formatFixedDecimalV1(
    parseFixedDecimalV1(input.root_zone_depth_mm, WATER_AMOUNT_SCALE_V1, "CAP05_ROOT_ZONE_DEPTH_INVALID"),
    WATER_AMOUNT_SCALE_V1,
  );
  const predictedStorageMean = formatFixedDecimalV1(
    parseFixedDecimalV1(point.storage_mean_mm, WATER_AMOUNT_SCALE_V1, "CAP05_FORECAST_STORAGE_MEAN_INVALID"),
    WATER_AMOUNT_SCALE_V1,
  );
  const predictedStorageVariance = formatFixedDecimalV1(
    parseFixedDecimalV1(point.storage_variance_mm2, WATER_VARIANCE_SCALE_V1, "CAP05_FORECAST_STORAGE_VARIANCE_INVALID"),
    WATER_VARIANCE_SCALE_V1,
  );
  const actualObservationValue = formatFixedDecimalV1(
    parseFixedDecimalV1(input.actual_observation_value, WATER_AMOUNT_SCALE_V1, "CAP05_ACTUAL_OBSERVATION_INVALID"),
    WATER_AMOUNT_SCALE_V1,
  );
  const actualObservationVariance = formatFixedDecimalV1(
    parseFixedDecimalV1(input.actual_observation_variance, WATER_VARIANCE_SCALE_V1, "CAP05_ACTUAL_OBSERVATION_VARIANCE_INVALID"),
    WATER_VARIANCE_SCALE_V1,
  );
  const representativenessVariance = formatFixedDecimalV1(
    parseFixedDecimalV1(input.representativeness_variance, WATER_VARIANCE_SCALE_V1, "CAP05_REPRESENTATIVENESS_VARIANCE_INVALID"),
    WATER_VARIANCE_SCALE_V1,
  );
  const math = computeProjectionMathV1({
    root_zone_depth_mm: rootZoneDepth,
    predicted_storage_mean_mm: predictedStorageMean,
    predicted_storage_variance_mm2: predictedStorageVariance,
    actual_observation_value: actualObservationValue,
    actual_observation_variance: actualObservationVariance,
    representativeness_variance: representativenessVariance,
  });
  const withoutHashes: Omit<Cap05ForecastObservationProjectionV1, "projection_input_hash" | "projection_trace_hash"> = {
    projection_method_id: CAP05_FORECAST_OBSERVATION_PROJECTION_METHOD_ID_V1,
    projection_method_version: CAP05_FORECAST_OBSERVATION_PROJECTION_METHOD_VERSION_V1,
    variance_projection_method_id: CAP05_FORECAST_OBSERVATION_VARIANCE_METHOD_ID_V1,
    forecast_point_member_ref_policy_id: CAP05_FORECAST_POINT_MEMBER_REF_POLICY_ID_V1,
    observation_operator_id: "POINT_200MM_TO_ROOT_ZONE_MEAN_H1_WITH_REPRESENTATIVENESS_V1",
    observation_operator_version: "1",
    observation_operator_h: "1.000000",
    direct_state_equivalence: false,
    forecast_run_ref: forecastRunRef,
    forecast_run_hash: forecastRunHash,
    forecast_issued_at: issuedAt,
    forecast_point_ref: expectedPointRef,
    forecast_point_hash: requiredStringV1(point.determinism_hash, "CAP05_FORECAST_POINT_HASH_REQUIRED"),
    forecast_horizon_hour: horizon,
    forecast_target_time: targetTime,
    root_zone_geometry_ref: requiredStringV1(input.root_zone_geometry_ref, "CAP05_ROOT_ZONE_GEOMETRY_REF_REQUIRED"),
    root_zone_geometry_hash: requiredStringV1(input.root_zone_geometry_hash, "CAP05_ROOT_ZONE_GEOMETRY_HASH_REQUIRED"),
    root_zone_depth_mm: rootZoneDepth,
    predicted_storage_mean_mm: predictedStorageMean,
    predicted_storage_variance_mm2: predictedStorageVariance,
    predicted_observation_value: math.predicted_observation_value,
    predicted_observation_unit: "fraction",
    predicted_observation_variance: math.predicted_observation_variance,
    actual_observation_ref: requiredStringV1(input.actual_observation_ref, "CAP05_ACTUAL_OBSERVATION_REF_REQUIRED"),
    actual_observation_hash: requiredStringV1(input.actual_observation_hash, "CAP05_ACTUAL_OBSERVATION_HASH_REQUIRED"),
    actual_observation_observed_at: observedAt,
    actual_observation_quality: exactObservationQualityV1(input.actual_observation_quality),
    actual_observation_value: actualObservationValue,
    actual_observation_unit: "fraction",
    actual_observation_variance: actualObservationVariance,
    representativeness_variance: representativenessVariance,
    residual_value: math.residual_value,
    residual_unit: "fraction",
    total_residual_variance: math.total_residual_variance,
    normalized_residual: math.normalized_residual,
    normalization_status: "COMPUTED",
    normalization_basis: CAP05_FORECAST_RESIDUAL_NORMALIZATION_BASIS_V1,
    residual_formula_id: CAP05_FORECAST_RESIDUAL_FORMULA_ID_V1,
    normalized_residual_formula_id: CAP05_NORMALIZED_RESIDUAL_FORMULA_ID_V1,
    rounding_rule_id: CAP05_FORECAST_RESIDUAL_ROUNDING_RULE_ID_V1,
    rounding_rule_version: CAP05_FORECAST_RESIDUAL_ROUNDING_RULE_VERSION_V1,
  };
  const inputBasis = projectionInputBasisV1(withoutHashes);
  const projectionInputHash = semanticHashV1(inputBasis);
  const withoutTraceHash: Omit<Cap05ForecastObservationProjectionV1, "projection_trace_hash"> = {
    ...withoutHashes,
    projection_input_hash: projectionInputHash,
  };
  return {
    ...withoutTraceHash,
    projection_trace_hash: semanticHashV1(projectionTraceBasisV1(withoutTraceHash)),
  };
}

function validateProjectionV1(payload: Cap05ForecastObservationProjectionV1): void {
  if (payload.projection_method_id !== CAP05_FORECAST_OBSERVATION_PROJECTION_METHOD_ID_V1
    || payload.projection_method_version !== CAP05_FORECAST_OBSERVATION_PROJECTION_METHOD_VERSION_V1
    || payload.variance_projection_method_id !== CAP05_FORECAST_OBSERVATION_VARIANCE_METHOD_ID_V1
    || payload.forecast_point_member_ref_policy_id !== CAP05_FORECAST_POINT_MEMBER_REF_POLICY_ID_V1) {
    throw new Error("CAP05_RESIDUAL_PROJECTION_POLICY_MISMATCH");
  }
  if (payload.observation_operator_id !== "POINT_200MM_TO_ROOT_ZONE_MEAN_H1_WITH_REPRESENTATIVENESS_V1"
    || payload.observation_operator_version !== "1"
    || payload.observation_operator_h !== "1.000000"
    || payload.direct_state_equivalence !== false) {
    throw new Error("CAP05_RESIDUAL_OBSERVATION_OPERATOR_MISMATCH");
  }
  if (payload.normalization_basis !== CAP05_FORECAST_RESIDUAL_NORMALIZATION_BASIS_V1
    || payload.normalization_status !== "COMPUTED"
    || payload.residual_formula_id !== CAP05_FORECAST_RESIDUAL_FORMULA_ID_V1
    || payload.normalized_residual_formula_id !== CAP05_NORMALIZED_RESIDUAL_FORMULA_ID_V1
    || payload.rounding_rule_id !== CAP05_FORECAST_RESIDUAL_ROUNDING_RULE_ID_V1
    || payload.rounding_rule_version !== CAP05_FORECAST_RESIDUAL_ROUNDING_RULE_VERSION_V1) {
    throw new Error("CAP05_RESIDUAL_NORMALIZATION_POLICY_MISMATCH");
  }
  const horizon = positiveHorizonV1(payload.forecast_horizon_hour);
  const issuedAt = canonicalHourV1(payload.forecast_issued_at, "CAP05_FORECAST_ISSUED_AT_INVALID");
  const targetTime = canonicalHourV1(payload.forecast_target_time, "CAP05_FORECAST_TARGET_TIME_INVALID");
  if (targetTime !== addHoursV1(issuedAt, horizon)) throw new Error("CAP05_FORECAST_POINT_ISSUED_TARGET_MISMATCH");
  if (payload.forecast_point_ref !== buildCap05ForecastPointMemberRefV1(payload.forecast_run_ref, horizon)) throw new Error("CAP05_FORECAST_POINT_MEMBER_REF_MISMATCH");
  if (canonicalHourV1(payload.actual_observation_observed_at, "CAP05_ACTUAL_OBSERVATION_OBSERVED_AT_INVALID") !== targetTime) throw new Error("CAP05_RESIDUAL_OBSERVATION_TARGET_TIME_MISMATCH");
  exactObservationQualityV1(payload.actual_observation_quality);
  requiredStringV1(payload.forecast_run_hash, "CAP05_FORECAST_RUN_HASH_REQUIRED");
  requiredStringV1(payload.forecast_point_hash, "CAP05_FORECAST_POINT_HASH_REQUIRED");
  requiredStringV1(payload.root_zone_geometry_ref, "CAP05_ROOT_ZONE_GEOMETRY_REF_REQUIRED");
  requiredStringV1(payload.root_zone_geometry_hash, "CAP05_ROOT_ZONE_GEOMETRY_HASH_REQUIRED");
  requiredStringV1(payload.actual_observation_ref, "CAP05_ACTUAL_OBSERVATION_REF_REQUIRED");
  requiredStringV1(payload.actual_observation_hash, "CAP05_ACTUAL_OBSERVATION_HASH_REQUIRED");

  const math = computeProjectionMathV1({
    root_zone_depth_mm: payload.root_zone_depth_mm,
    predicted_storage_mean_mm: payload.predicted_storage_mean_mm,
    predicted_storage_variance_mm2: payload.predicted_storage_variance_mm2,
    actual_observation_value: payload.actual_observation_value,
    actual_observation_variance: payload.actual_observation_variance,
    representativeness_variance: payload.representativeness_variance,
  });
  if (payload.predicted_observation_value !== math.predicted_observation_value
    || payload.predicted_observation_variance !== math.predicted_observation_variance
    || payload.residual_value !== math.residual_value
    || payload.total_residual_variance !== math.total_residual_variance
    || payload.normalized_residual !== math.normalized_residual) {
    throw new Error("CAP05_RESIDUAL_PROJECTION_MATH_MISMATCH");
  }
  const { projection_input_hash: _inputHash, projection_trace_hash: _traceHash, ...withoutHashes } = payload;
  const expectedInputHash = semanticHashV1(projectionInputBasisV1(withoutHashes));
  if (payload.projection_input_hash !== expectedInputHash) throw new Error("CAP05_RESIDUAL_PROJECTION_INPUT_HASH_MISMATCH");
  const { projection_trace_hash: _discardTrace, ...withoutTraceHash } = payload;
  const expectedTraceHash = semanticHashV1(projectionTraceBasisV1(withoutTraceHash));
  if (payload.projection_trace_hash !== expectedTraceHash) throw new Error("CAP05_RESIDUAL_PROJECTION_TRACE_HASH_MISMATCH");
}

export function buildCap05ForecastResidualV1(input: BuildCap05ForecastResidualInputV1): Cap05ForecastResidualEnvelopeV1 {
  const scope = exactScopeV1(input.scope);
  const projection = projectCap05ForecastPointToObservationV1(input);
  const availableAt = canonicalInstantV1(input.observation_available_to_runtime_at, "CAP05_RESIDUAL_OBSERVATION_AVAILABLE_INVALID");
  if (Date.parse(availableAt) < Date.parse(projection.actual_observation_observed_at)) throw new Error("CAP05_RESIDUAL_OBSERVATION_AVAILABLE_BEFORE_OBSERVED");
  const assimilationRef = input.assimilation_update_ref ?? null;
  const assimilationHash = input.assimilation_update_hash ?? null;
  if ((assimilationRef === null) !== (assimilationHash === null)) throw new Error("CAP05_RESIDUAL_ASSIMILATION_REF_HASH_PAIR_REQUIRED");
  const payload: Cap05ForecastResidualPayloadV1 = {
    record_set_contract_id: CAP05_FORECAST_RESIDUAL_CONTRACT_ID_V1,
    transaction_variant: CAP05_FORECAST_RESIDUAL_TRANSACTION_VARIANT_V1,
    match_status: "MATCHED",
    matching_policy_id: CAP05_FORECAST_RESIDUAL_MATCHING_POLICY_ID_V1,
    matching_policy_version: CAP05_FORECAST_RESIDUAL_MATCHING_POLICY_VERSION_V1,
    ...projection,
    observation_available_to_runtime_at: availableAt,
    runtime_config_ref: requiredStringV1(input.runtime_config_ref, "CAP05_RESIDUAL_RUNTIME_CONFIG_REF_REQUIRED"),
    runtime_config_hash: requiredStringV1(input.runtime_config_hash, "CAP05_RESIDUAL_RUNTIME_CONFIG_HASH_REQUIRED"),
    assimilation_update_ref: assimilationRef,
    assimilation_update_hash: assimilationHash,
    forecast_assimilation_relation_policy_id: CAP05_FORECAST_ASSIMILATION_RELATION_POLICY_V1,
    equivalence_proof_ref: null,
    equivalence_claimed: false,
  };
  const identityBasis = {
    object_type: CAP05_FORECAST_RESIDUAL_OBJECT_TYPE_V1,
    scope,
    forecast_point_ref: payload.forecast_point_ref,
    observation_ref: payload.actual_observation_ref,
  };
  const sourceRefs = [payload.forecast_run_ref, payload.forecast_point_ref, assimilationRef]
    .filter((value): value is string => Boolean(value))
    .sort();
  const object: Cap05ForecastResidualEnvelopeV1 = {
    object_id: deriveSemanticObjectIdV1("twin_forecast_residual", identityBasis),
    object_type: CAP05_FORECAST_RESIDUAL_OBJECT_TYPE_V1,
    schema_version: "v1",
    ...scope,
    logical_time: payload.forecast_target_time,
    as_of: availableAt,
    source_refs: sourceRefs,
    evidence_refs: [payload.actual_observation_ref],
    runtime_config_ref: payload.runtime_config_ref,
    runtime_config_hash: payload.runtime_config_hash,
    idempotency_key: deriveSemanticObjectIdV1("forecast_residual_key", identityBasis),
    determinism_hash: "",
    limitations: [
      "FORECAST_ERROR_NOT_ASSIMILATION_INNOVATION",
      "FORECAST_ERROR_NOT_CAUSAL_EFFECT",
      "NO_CAUSAL_ATTRIBUTION",
      "NO_CALIBRATION_CANDIDATE",
      "NO_MODEL_ACTIVATION",
    ],
    created_at: canonicalInstantV1(input.created_at, "CAP05_RESIDUAL_CREATED_AT_INVALID"),
    context_lineage_ref: requiredStringV1(input.context_lineage_ref, "CAP05_RESIDUAL_CONTEXT_LINEAGE_REQUIRED"),
    context_revision_ref: requiredStringV1(input.context_revision_ref, "CAP05_RESIDUAL_CONTEXT_REVISION_REQUIRED"),
    payload,
  };
  object.determinism_hash = computeMemberDeterminismHashV1(object as unknown as Record<string, unknown>);
  validateCap05ForecastResidualV1(object);
  return object;
}

export function validateCap05ForecastResidualV1(object: Cap05ForecastResidualEnvelopeV1): void {
  if (object.object_type !== CAP05_FORECAST_RESIDUAL_OBJECT_TYPE_V1 || object.schema_version !== "v1") throw new Error("CAP05_RESIDUAL_OBJECT_CONTRACT_MISMATCH");
  exactScopeV1(object);
  const availableAt = canonicalInstantV1(object.payload.observation_available_to_runtime_at, "CAP05_RESIDUAL_OBSERVATION_AVAILABLE_INVALID");
  if (object.logical_time !== object.payload.forecast_target_time || object.as_of !== availableAt) throw new Error("CAP05_RESIDUAL_TIME_MAPPING_MISMATCH");
  if (Date.parse(availableAt) < Date.parse(object.payload.actual_observation_observed_at)) throw new Error("CAP05_RESIDUAL_OBSERVATION_AVAILABLE_BEFORE_OBSERVED");
  if (object.payload.record_set_contract_id !== CAP05_FORECAST_RESIDUAL_CONTRACT_ID_V1
    || object.payload.transaction_variant !== CAP05_FORECAST_RESIDUAL_TRANSACTION_VARIANT_V1
    || object.payload.match_status !== "MATCHED"
    || object.payload.matching_policy_id !== CAP05_FORECAST_RESIDUAL_MATCHING_POLICY_ID_V1
    || object.payload.matching_policy_version !== CAP05_FORECAST_RESIDUAL_MATCHING_POLICY_VERSION_V1) {
    throw new Error("CAP05_RESIDUAL_CONTRACT_MISMATCH");
  }
  validateProjectionV1(object.payload);
  if (object.payload.forecast_assimilation_relation_policy_id !== CAP05_FORECAST_ASSIMILATION_RELATION_POLICY_V1
    || object.payload.equivalence_claimed !== false
    || object.payload.equivalence_proof_ref !== null) {
    throw new Error("CAP05_RESIDUAL_EQUIVALENCE_CLAIM_FORBIDDEN");
  }
  if ("assimilation_gain" in object.payload || "posterior_state_ref" in object.payload || "posterior_mean" in object.payload) {
    throw new Error("CAP05_RESIDUAL_ASSIMILATION_AUTHORITY_FORBIDDEN");
  }
  if ((object.payload.assimilation_update_ref === null) !== (object.payload.assimilation_update_hash === null)) {
    throw new Error("CAP05_RESIDUAL_ASSIMILATION_REF_HASH_PAIR_REQUIRED");
  }
  if (!object.source_refs.includes(object.payload.forecast_run_ref) || !object.source_refs.includes(object.payload.forecast_point_ref)) throw new Error("CAP05_RESIDUAL_FORECAST_REFS_MISSING");
  if (object.payload.assimilation_update_ref && !object.source_refs.includes(object.payload.assimilation_update_ref)) throw new Error("CAP05_RESIDUAL_ASSIMILATION_REF_MISSING");
  if (!object.evidence_refs.includes(object.payload.actual_observation_ref)) throw new Error("CAP05_RESIDUAL_OBSERVATION_REF_MISSING");
  if (object.runtime_config_ref !== object.payload.runtime_config_ref || object.runtime_config_hash !== object.payload.runtime_config_hash) throw new Error("CAP05_RESIDUAL_RUNTIME_CONFIG_MISMATCH");
  if (object.determinism_hash !== computeMemberDeterminismHashV1(object as unknown as Record<string, unknown>)) throw new Error("CAP05_RESIDUAL_SEMANTIC_HASH_MISMATCH");
}
