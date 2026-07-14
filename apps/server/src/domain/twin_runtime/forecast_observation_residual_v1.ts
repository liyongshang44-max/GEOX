// apps/server/src/domain/twin_runtime/forecast_observation_residual_v1.ts
// Purpose: project one historical root-zone storage Forecast point into the existing H=1 root-zone-mean VWC observation domain and build the frozen DT-02 Forecast Residual object.
// Boundary: pure fixed-point projection, residual math, contract construction and validation only; no observation selection, assimilation, persistence, State mutation, clock, filesystem, environment, or network.

import {
  WATER_AMOUNT_SCALE_V1,
  WATER_VARIANCE_SCALE_V1,
  divideFixedUnitsV1,
  formatFixedDecimalV1,
  parseFixedDecimalV1,
  squareScale6ToScale12V1,
  sqrtScale12ToScale6V1,
} from "../soil_water/fixed_point_water_decimal_v1.js";
import { computeMemberDeterminismHashV1, deriveSemanticObjectIdV1 } from "./canonical_identity_v1.js";
import type { ContinuationScopeV1 } from "./continuation_operation_identity_v1.js";
import type { Cap04ForecastPointV1 } from "./forecast_scenario_contracts_v1.js";
import type { Cap05NonLineageEnvelopeV1 } from "./feedback_canonical_contracts_v1.js";

export const CAP05_FORECAST_RESIDUAL_OBJECT_TYPE_V1 = "twin_forecast_residual_v1" as const;
export const CAP05_FORECAST_RESIDUAL_CONTRACT_ID_V1 = "MCFT_CAP_05_FORECAST_OBSERVATION_RESIDUAL_V1" as const;
export const CAP05_FORECAST_RESIDUAL_TRANSACTION_VARIANT_V1 = "C_FORECAST_RESIDUAL_COMMIT" as const;
export const CAP05_FORECAST_OBSERVATION_PROJECTION_METHOD_ID_V1 = "FORECAST_STORAGE_TO_ROOT_ZONE_MEAN_VWC_H1_V1" as const;
export const CAP05_FORECAST_OBSERVATION_VARIANCE_METHOD_ID_V1 = "STORAGE_VARIANCE_DIVIDED_BY_ROOT_ZONE_DEPTH_SQUARED_V1" as const;
export const CAP05_FORECAST_RESIDUAL_FORMULA_ID_V1 = "ACTUAL_MINUS_PREDICTED_V1" as const;
export const CAP05_NORMALIZED_RESIDUAL_FORMULA_ID_V1 = "RESIDUAL_DIVIDED_BY_SQRT_PREDICTED_PLUS_OBSERVATION_VARIANCE_V1" as const;
export const CAP05_FORECAST_ASSIMILATION_RELATION_POLICY_V1 = "DISTINCT_UNLESS_EXPLICIT_EQUIVALENCE_PROOF_V1" as const;

export type Cap05ForecastObservationProjectionV1 = {
  projection_method_id: typeof CAP05_FORECAST_OBSERVATION_PROJECTION_METHOD_ID_V1;
  variance_projection_method_id: typeof CAP05_FORECAST_OBSERVATION_VARIANCE_METHOD_ID_V1;
  observation_operator_id: "POINT_200MM_TO_ROOT_ZONE_MEAN_H1_WITH_REPRESENTATIVENESS_V1";
  observation_operator_h: "1.000000";
  direct_state_equivalence: false;
  forecast_run_ref: string;
  forecast_run_hash: string;
  forecast_point_ref: string;
  forecast_point_hash: string;
  forecast_horizon_hour: number;
  forecast_target_time: string;
  root_zone_depth_mm: string;
  predicted_storage_mean_mm: string;
  predicted_storage_variance_mm2: string;
  predicted_observation_value: string;
  predicted_observation_unit: "fraction";
  predicted_observation_variance: string;
  representativeness_variance: string;
  actual_observation_ref: string;
  actual_observation_hash: string;
  actual_observation_value: string;
  actual_observation_unit: "fraction";
  actual_observation_variance: string;
  residual_value: string;
  residual_unit: "fraction";
  total_residual_variance: string;
  normalized_residual: string | null;
  normalization_status: "COMPUTED" | "ZERO_TOTAL_VARIANCE";
  residual_formula_id: typeof CAP05_FORECAST_RESIDUAL_FORMULA_ID_V1;
  normalized_residual_formula_id: typeof CAP05_NORMALIZED_RESIDUAL_FORMULA_ID_V1;
};

export type Cap05ForecastResidualPayloadV1 = Cap05ForecastObservationProjectionV1 & {
  record_set_contract_id: typeof CAP05_FORECAST_RESIDUAL_CONTRACT_ID_V1;
  transaction_variant: typeof CAP05_FORECAST_RESIDUAL_TRANSACTION_VARIANT_V1;
  match_status: "MATCHED";
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

export type ProjectCap05ForecastObservationInputV1 = {
  forecast_run_ref: string;
  forecast_run_hash: string;
  forecast_point_ref: string;
  forecast_point: Cap04ForecastPointV1;
  root_zone_depth_mm: string;
  actual_observation_ref: string;
  actual_observation_hash: string;
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

function addScale12V1(left: bigint, right: bigint, code: string): bigint {
  const result = left + right;
  if (result < 0n) throw new Error(code);
  return result;
}

export function projectCap05ForecastPointToObservationV1(
  input: ProjectCap05ForecastObservationInputV1,
): Cap05ForecastObservationProjectionV1 {
  const point = input.forecast_point;
  const rootDepthUnits = parseFixedDecimalV1(input.root_zone_depth_mm, WATER_AMOUNT_SCALE_V1, "CAP05_ROOT_ZONE_DEPTH_INVALID");
  if (rootDepthUnits <= 0n) throw new Error("CAP05_ROOT_ZONE_DEPTH_POSITIVE_REQUIRED");
  const storageMeanUnits = parseFixedDecimalV1(point.storage_mean_mm, WATER_AMOUNT_SCALE_V1, "CAP05_FORECAST_STORAGE_MEAN_INVALID");
  const storageVarianceUnits = parseFixedDecimalV1(point.storage_variance_mm2, WATER_VARIANCE_SCALE_V1, "CAP05_FORECAST_STORAGE_VARIANCE_INVALID");
  if (storageVarianceUnits < 0n) throw new Error("CAP05_FORECAST_STORAGE_VARIANCE_NEGATIVE");
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
  const actualObservationUnits = parseFixedDecimalV1(input.actual_observation_value, WATER_AMOUNT_SCALE_V1, "CAP05_ACTUAL_OBSERVATION_INVALID");
  const actualObservationVarianceUnits = parseFixedDecimalV1(input.actual_observation_variance, WATER_VARIANCE_SCALE_V1, "CAP05_ACTUAL_OBSERVATION_VARIANCE_INVALID");
  const representativenessVarianceUnits = parseFixedDecimalV1(input.representativeness_variance, WATER_VARIANCE_SCALE_V1, "CAP05_REPRESENTATIVENESS_VARIANCE_INVALID");
  if (actualObservationVarianceUnits < 0n || representativenessVarianceUnits < 0n) throw new Error("CAP05_OBSERVATION_VARIANCE_NEGATIVE");
  const residualUnits = actualObservationUnits - predictedObservationUnits;
  const totalVarianceUnits = addScale12V1(addScale12V1(predictedVarianceUnits, actualObservationVarianceUnits, "CAP05_TOTAL_VARIANCE_NEGATIVE"), representativenessVarianceUnits, "CAP05_TOTAL_VARIANCE_NEGATIVE");
  const standardDeviationUnits = sqrtScale12ToScale6V1(totalVarianceUnits);
  const normalizedResidualUnits = standardDeviationUnits === 0n
    ? null
    : divideFixedUnitsV1(
      residualUnits,
      WATER_AMOUNT_SCALE_V1,
      standardDeviationUnits,
      WATER_AMOUNT_SCALE_V1,
      WATER_AMOUNT_SCALE_V1,
    );
  return {
    projection_method_id: CAP05_FORECAST_OBSERVATION_PROJECTION_METHOD_ID_V1,
    variance_projection_method_id: CAP05_FORECAST_OBSERVATION_VARIANCE_METHOD_ID_V1,
    observation_operator_id: "POINT_200MM_TO_ROOT_ZONE_MEAN_H1_WITH_REPRESENTATIVENESS_V1",
    observation_operator_h: "1.000000",
    direct_state_equivalence: false,
    forecast_run_ref: requiredStringV1(input.forecast_run_ref, "CAP05_FORECAST_RUN_REF_REQUIRED"),
    forecast_run_hash: requiredStringV1(input.forecast_run_hash, "CAP05_FORECAST_RUN_HASH_REQUIRED"),
    forecast_point_ref: requiredStringV1(input.forecast_point_ref, "CAP05_FORECAST_POINT_REF_REQUIRED"),
    forecast_point_hash: requiredStringV1(point.determinism_hash, "CAP05_FORECAST_POINT_HASH_REQUIRED"),
    forecast_horizon_hour: point.horizon_hour,
    forecast_target_time: canonicalInstantV1(point.target_time, "CAP05_FORECAST_TARGET_TIME_INVALID"),
    root_zone_depth_mm: formatFixedDecimalV1(rootDepthUnits, WATER_AMOUNT_SCALE_V1),
    predicted_storage_mean_mm: formatFixedDecimalV1(storageMeanUnits, WATER_AMOUNT_SCALE_V1),
    predicted_storage_variance_mm2: formatFixedDecimalV1(storageVarianceUnits, WATER_VARIANCE_SCALE_V1),
    predicted_observation_value: formatFixedDecimalV1(predictedObservationUnits, WATER_AMOUNT_SCALE_V1),
    predicted_observation_unit: "fraction",
    predicted_observation_variance: formatFixedDecimalV1(predictedVarianceUnits, WATER_VARIANCE_SCALE_V1),
    representativeness_variance: formatFixedDecimalV1(representativenessVarianceUnits, WATER_VARIANCE_SCALE_V1),
    actual_observation_ref: requiredStringV1(input.actual_observation_ref, "CAP05_ACTUAL_OBSERVATION_REF_REQUIRED"),
    actual_observation_hash: requiredStringV1(input.actual_observation_hash, "CAP05_ACTUAL_OBSERVATION_HASH_REQUIRED"),
    actual_observation_value: formatFixedDecimalV1(actualObservationUnits, WATER_AMOUNT_SCALE_V1),
    actual_observation_unit: "fraction",
    actual_observation_variance: formatFixedDecimalV1(actualObservationVarianceUnits, WATER_VARIANCE_SCALE_V1),
    residual_value: formatFixedDecimalV1(residualUnits, WATER_AMOUNT_SCALE_V1),
    residual_unit: "fraction",
    total_residual_variance: formatFixedDecimalV1(totalVarianceUnits, WATER_VARIANCE_SCALE_V1),
    normalized_residual: normalizedResidualUnits === null ? null : formatFixedDecimalV1(normalizedResidualUnits, WATER_AMOUNT_SCALE_V1),
    normalization_status: normalizedResidualUnits === null ? "ZERO_TOTAL_VARIANCE" : "COMPUTED",
    residual_formula_id: CAP05_FORECAST_RESIDUAL_FORMULA_ID_V1,
    normalized_residual_formula_id: CAP05_NORMALIZED_RESIDUAL_FORMULA_ID_V1,
  };
}

export function buildCap05ForecastResidualV1(input: BuildCap05ForecastResidualInputV1): Cap05ForecastResidualEnvelopeV1 {
  const scope = exactScopeV1(input.scope);
  const projection = projectCap05ForecastPointToObservationV1(input);
  const availableAt = canonicalInstantV1(input.observation_available_to_runtime_at, "CAP05_RESIDUAL_OBSERVATION_AVAILABLE_INVALID");
  const assimilationRef = input.assimilation_update_ref ?? null;
  const assimilationHash = input.assimilation_update_hash ?? null;
  if ((assimilationRef === null) !== (assimilationHash === null)) throw new Error("CAP05_RESIDUAL_ASSIMILATION_REF_HASH_PAIR_REQUIRED");
  const payload: Cap05ForecastResidualPayloadV1 = {
    record_set_contract_id: CAP05_FORECAST_RESIDUAL_CONTRACT_ID_V1,
    transaction_variant: CAP05_FORECAST_RESIDUAL_TRANSACTION_VARIANT_V1,
    match_status: "MATCHED",
    ...projection,
    runtime_config_ref: requiredStringV1(input.runtime_config_ref, "CAP05_RESIDUAL_RUNTIME_CONFIG_REF_REQUIRED"),
    runtime_config_hash: requiredStringV1(input.runtime_config_hash, "CAP05_RESIDUAL_RUNTIME_CONFIG_HASH_REQUIRED"),
    assimilation_update_ref: assimilationRef,
    assimilation_update_hash: assimilationHash,
    forecast_assimilation_relation_policy_id: CAP05_FORECAST_ASSIMILATION_RELATION_POLICY_V1,
    equivalence_proof_ref: null,
    equivalence_claimed: false,
  };
  const identityBasis = { object_type: CAP05_FORECAST_RESIDUAL_OBJECT_TYPE_V1, scope, forecast_point_ref: payload.forecast_point_ref, observation_ref: payload.actual_observation_ref };
  const sourceRefs = [payload.forecast_run_ref, payload.forecast_point_ref, assimilationRef].filter((value): value is string => Boolean(value)).sort();
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
    limitations: ["FORECAST_ERROR_NOT_ASSIMILATION_INNOVATION", "NO_CAUSAL_ATTRIBUTION", "NO_CALIBRATION_CANDIDATE", "NO_MODEL_ACTIVATION"],
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
  if (object.logical_time !== object.payload.forecast_target_time || object.as_of !== canonicalInstantV1(object.as_of, "CAP05_RESIDUAL_AS_OF_INVALID")) throw new Error("CAP05_RESIDUAL_TIME_MAPPING_MISMATCH");
  if (object.payload.record_set_contract_id !== CAP05_FORECAST_RESIDUAL_CONTRACT_ID_V1 || object.payload.transaction_variant !== CAP05_FORECAST_RESIDUAL_TRANSACTION_VARIANT_V1) throw new Error("CAP05_RESIDUAL_CONTRACT_MISMATCH");
  if (object.payload.projection_method_id !== CAP05_FORECAST_OBSERVATION_PROJECTION_METHOD_ID_V1 || object.payload.variance_projection_method_id !== CAP05_FORECAST_OBSERVATION_VARIANCE_METHOD_ID_V1) throw new Error("CAP05_RESIDUAL_PROJECTION_POLICY_MISMATCH");
  if (object.payload.forecast_assimilation_relation_policy_id !== CAP05_FORECAST_ASSIMILATION_RELATION_POLICY_V1 || object.payload.equivalence_claimed !== false || object.payload.equivalence_proof_ref !== null) throw new Error("CAP05_RESIDUAL_EQUIVALENCE_CLAIM_FORBIDDEN");
  if ("assimilation_gain" in object.payload || "posterior_state_ref" in object.payload || "posterior_mean" in object.payload) throw new Error("CAP05_RESIDUAL_ASSIMILATION_AUTHORITY_FORBIDDEN");
  if (!object.source_refs.includes(object.payload.forecast_run_ref) || !object.source_refs.includes(object.payload.forecast_point_ref)) throw new Error("CAP05_RESIDUAL_FORECAST_REFS_MISSING");
  if (!object.evidence_refs.includes(object.payload.actual_observation_ref)) throw new Error("CAP05_RESIDUAL_OBSERVATION_REF_MISSING");
  if (object.runtime_config_ref !== object.payload.runtime_config_ref || object.runtime_config_hash !== object.payload.runtime_config_hash) throw new Error("CAP05_RESIDUAL_RUNTIME_CONFIG_MISMATCH");
  if (object.determinism_hash !== computeMemberDeterminismHashV1(object as unknown as Record<string, unknown>)) throw new Error("CAP05_RESIDUAL_SEMANTIC_HASH_MISMATCH");
}
