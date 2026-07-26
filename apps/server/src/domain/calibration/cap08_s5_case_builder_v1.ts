// Purpose: build the exact MCFT-CAP-08.S5 16/8 case windows while preserving signed no-drainage cases as non-exciting calibration evidence.
// Boundary: pure deterministic validation and derivation only; no replay execution, persistence, projection, Candidate/Shadow append, active Config, clock, route, scheduler, or Model Activation authority.

import {
  compareIsoInstantV1,
  parseFixedDecimalV1,
} from "../soil_water/fixed_point_water_decimal_v1.js";
import { semanticHashV1 } from "../twin_runtime/canonical_identity_v1.js";
import {
  CAP06_CALIBRATION_CASE_COUNT_V1,
  CAP06_HOLDOUT_CASE_COUNT_V1,
  CAP06_WINDOW_HASH_SEMANTICS_V1,
  type Cap06CalibrationCaseSourceV1,
  type Cap06CalibrationCaseV1,
  type Cap06RealityScopeV1,
  type Cap06SourceDatasetIdentityV1,
  type Cap06WetnessRegimeV1,
} from "./contracts_v1.js";
import type {
  Cap06BuiltCaseWindowV1,
  Cap06CaseBuilderSourceV1,
  Cap06CaseWindowRoleV1,
} from "./case_builder_v1.js";

export const CAP08_S5_CALIBRATION_CASE_BUILDER_ID_V1 =
  "MCFT_CAP_08_S5_SIGNED_EXCESS_H1_CASE_BUILDER_V1" as const;
export const CAP08_S5_NO_POSITIVE_EXCESS_REGIME_V1 = "NO_POSITIVE_EXCESS" as const;

export type Cap08S5WetnessRegimeV1 =
  | Cap06WetnessRegimeV1
  | typeof CAP08_S5_NO_POSITIVE_EXCESS_REGIME_V1;

export type Cap08S5CalibrationCaseV1 = Omit<Cap06CalibrationCaseV1, "wetness_regime"> & {
  wetness_regime: Cap08S5WetnessRegimeV1;
  drainage_excitation_eligible: boolean;
};

export type Cap08S5BuiltCaseWindowV1 = Omit<
  Cap06BuiltCaseWindowV1,
  "schema_version" | "case_builder_id" | "cases" | "determinism_hash"
> & {
  schema_version: "geox_mcft_cap08_s5_case_window_v1";
  case_builder_id: typeof CAP08_S5_CALIBRATION_CASE_BUILDER_ID_V1;
  cases: Cap08S5CalibrationCaseV1[];
  no_positive_excess_case_count: number;
  no_positive_excess_case_refs: string[];
  determinism_hash: string;
};

export type Cap08S5BuiltCaseWindowsV1 = {
  schema_version: "geox_mcft_cap08_s5_case_windows_v1";
  calibration: Cap08S5BuiltCaseWindowV1;
  holdout: Cap08S5BuiltCaseWindowV1;
  future_leakage_count: 0;
  calibration_holdout_ref_intersection_count: 0;
  candidate_as_of: string;
  minimum_holdout_availability: string;
  source_s1_residual_set_hash: string;
  source_s1_case_input_set_hash: string;
  calibration_window_ref_membership_hash: string;
  holdout_window_ref_membership_hash: string;
  window_hash_semantics: typeof CAP06_WINDOW_HASH_SEMANTICS_V1;
  holdout_purpose: Cap06SourceDatasetIdentityV1["holdout_purpose"];
  holdout_generalization_claim: Cap06SourceDatasetIdentityV1["holdout_generalization_claim"];
  no_positive_excess_calibration_case_count: number;
  no_positive_excess_holdout_case_count: number;
  determinism_hash: string;
};

function requiredStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

function exactInstantV1(value: unknown, code: string): string {
  const text = requiredStringV1(value, code);
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== text) throw new Error(code);
  return text;
}

function scopeKeyV1(scope: Cap06RealityScopeV1): string {
  return [
    scope.tenant_id,
    scope.project_id,
    scope.group_id,
    scope.field_id,
    scope.season_id,
    scope.zone_id,
  ].join("\u001f");
}

function uniqueValueV1(values: readonly string[], code: string): string {
  const unique = [...new Set(values)];
  if (unique.length !== 1) throw new Error(`${code}:${unique.length}`);
  return unique[0];
}

function orderedUniquePairsV1(
  pairs: readonly { ref: string; hash: string }[],
  code: string,
): { refs: string[]; hashes: string[] } {
  const owners = new Map<string, string>();
  const refs: string[] = [];
  const hashes: string[] = [];
  for (const pair of pairs) {
    const existing = owners.get(pair.ref);
    if (existing && existing !== pair.hash) throw new Error(`${code}:${pair.ref}`);
    if (existing) continue;
    owners.set(pair.ref, pair.hash);
    refs.push(pair.ref);
    hashes.push(pair.hash);
  }
  return { refs, hashes };
}

function classifyRegimeV1(input: {
  excess_above_field_capacity_mm: string;
  saturation_minus_field_capacity_mm: string;
}): { regime: Cap08S5WetnessRegimeV1; excitationEligible: boolean } {
  const excess = parseFixedDecimalV1(
    input.excess_above_field_capacity_mm,
    6,
    "CAP08_S5_EXCESS_ABOVE_FIELD_CAPACITY_REQUIRED",
  );
  const span = parseFixedDecimalV1(
    input.saturation_minus_field_capacity_mm,
    6,
    "CAP08_S5_SATURATION_CAPACITY_SPAN_REQUIRED",
  );
  if (span <= 0n) throw new Error("CAP08_S5_SATURATION_CAPACITY_SPAN_NOT_POSITIVE");
  if (excess <= 0n) {
    return { regime: CAP08_S5_NO_POSITIVE_EXCESS_REGIME_V1, excitationEligible: false };
  }
  if (excess * 100n < span * 10n) return { regime: "LOW_EXCESS", excitationEligible: true };
  if (excess * 100n < span * 30n) return { regime: "MID_EXCESS", excitationEligible: true };
  return { regime: "HIGH_EXCESS", excitationEligible: true };
}

function validateCaseV1(caseItem: Cap06CaseBuilderSourceV1): Cap08S5CalibrationCaseV1 {
  if (!Number.isSafeInteger(caseItem.case_index) || caseItem.case_index < 0) {
    throw new Error("CAP08_S5_CASE_INDEX_INVALID");
  }
  for (const [key, value] of Object.entries(caseItem.scope)) {
    requiredStringV1(value, `CAP08_S5_SCOPE_${key.toUpperCase()}_REQUIRED`);
  }
  const forecastIssuedAt = exactInstantV1(caseItem.forecast_issued_at, "CAP08_S5_FORECAST_ISSUED_AT_INVALID");
  const forecastAsOf = exactInstantV1(caseItem.forecast_as_of, "CAP08_S5_FORECAST_AS_OF_INVALID");
  const forecastEvidenceCutoff = exactInstantV1(
    caseItem.forecast_evidence_cutoff,
    "CAP08_S5_FORECAST_EVIDENCE_CUTOFF_INVALID",
  );
  const forecastTargetTime = exactInstantV1(caseItem.forecast_target_time, "CAP08_S5_FORECAST_TARGET_TIME_INVALID");
  const observationObservedAt = exactInstantV1(
    caseItem.observation_observed_at,
    "CAP08_S5_OBSERVATION_OBSERVED_AT_INVALID",
  );
  const observationAvailableAt = exactInstantV1(
    caseItem.observation_available_to_runtime_at,
    "CAP08_S5_OBSERVATION_AVAILABLE_AT_INVALID",
  );
  if (forecastTargetTime !== observationObservedAt) {
    throw new Error(`CAP08_S5_TARGET_OBSERVATION_TIME_MISMATCH:${caseItem.residual_ref}`);
  }
  if (compareIsoInstantV1(forecastIssuedAt, observationAvailableAt) >= 0
    || compareIsoInstantV1(forecastAsOf, observationAvailableAt) >= 0) {
    throw new Error(`CAP08_S5_FUTURE_LEAKAGE:${caseItem.residual_ref}`);
  }
  if (compareIsoInstantV1(forecastEvidenceCutoff, forecastAsOf) > 0) {
    throw new Error(`CAP08_S5_EVIDENCE_CUTOFF_AFTER_FORECAST_AS_OF:${caseItem.residual_ref}`);
  }
  parseFixedDecimalV1(caseItem.actual_observation_vwc, 9, "CAP08_S5_ACTUAL_OBSERVATION_VWC_REQUIRED");
  parseFixedDecimalV1(caseItem.base_prediction_vwc, 9, "CAP08_S5_BASE_PREDICTION_VWC_REQUIRED");
  for (const value of [
    caseItem.residual_ref,
    caseItem.residual_hash,
    caseItem.source_forecast_ref,
    caseItem.source_forecast_hash,
    caseItem.source_forecast_point_ref,
    caseItem.source_forecast_point_hash,
    caseItem.source_posterior_ref,
    caseItem.source_posterior_hash,
    caseItem.source_runtime_config_ref,
    caseItem.source_runtime_config_hash,
    caseItem.actual_observation_ref,
    caseItem.actual_observation_hash,
    caseItem.context_lineage_ref,
    caseItem.context_revision_ref,
    caseItem.model_component_hash,
    caseItem.effective_parameter_bundle_hash,
    caseItem.observation_operator_hash,
    caseItem.geometry_hash,
    caseItem.runtime_replay_numeric_policy_hash,
    caseItem.case_input_hash,
  ]) requiredStringV1(value, `CAP08_S5_CASE_IDENTITY_REQUIRED:${caseItem.residual_ref}`);
  const classification = classifyRegimeV1(caseItem);
  return {
    ...structuredClone(caseItem),
    wetness_regime: classification.regime,
    drainage_excitation_eligible: classification.excitationEligible,
  };
}

function selectBaseConfigV1(cases: readonly Cap06CaseBuilderSourceV1[]): {
  base_config_ref: string;
  base_config_hash: string;
} {
  const byRef = new Map<string, { ref: string; hash: string; logicalTime: string }>();
  for (const item of cases) {
    const logicalTime = exactInstantV1(
      item.source_runtime_config_logical_time,
      "CAP08_S5_SOURCE_CONFIG_LOGICAL_TIME_INVALID",
    );
    const existing = byRef.get(item.source_runtime_config_ref);
    if (existing && (existing.hash !== item.source_runtime_config_hash || existing.logicalTime !== logicalTime)) {
      throw new Error(`CAP08_S5_RUNTIME_CONFIG_IDENTITY_CONFLICT:${item.source_runtime_config_ref}`);
    }
    byRef.set(item.source_runtime_config_ref, {
      ref: item.source_runtime_config_ref,
      hash: item.source_runtime_config_hash,
      logicalTime,
    });
  }
  const selected = [...byRef.values()].sort((left, right) =>
    compareIsoInstantV1(right.logicalTime, left.logicalTime) || left.ref.localeCompare(right.ref))[0];
  if (!selected) throw new Error("CAP08_S5_BASE_CONFIG_REQUIRED");
  return { base_config_ref: selected.ref, base_config_hash: selected.hash };
}

export function buildCap08S5CaseWindowV1(input: {
  role: Cap06CaseWindowRoleV1;
  orderedResidualRefs: readonly string[];
  loadedCases: readonly Cap06CaseBuilderSourceV1[];
  sourceDatasetIdentity: Cap06SourceDatasetIdentityV1;
}): Cap08S5BuiltCaseWindowV1 {
  if (input.sourceDatasetIdentity.window_hash_semantics !== CAP06_WINDOW_HASH_SEMANTICS_V1) {
    throw new Error("CAP08_S5_WINDOW_HASH_SEMANTICS_MISMATCH");
  }
  const expectedCount = input.role === "CALIBRATION"
    ? CAP06_CALIBRATION_CASE_COUNT_V1
    : CAP06_HOLDOUT_CASE_COUNT_V1;
  if (input.orderedResidualRefs.length !== expectedCount
    || new Set(input.orderedResidualRefs).size !== expectedCount) {
    throw new Error(`CAP08_S5_${input.role}_EXACT_REF_SET_REQUIRED`);
  }
  const byRef = new Map<string, Cap06CaseBuilderSourceV1>();
  for (const item of input.loadedCases) {
    if (byRef.has(item.residual_ref)) throw new Error(`CAP08_S5_${input.role}_DUPLICATE_CASE:${item.residual_ref}`);
    byRef.set(item.residual_ref, structuredClone(item));
  }
  if (byRef.size !== expectedCount) throw new Error(`CAP08_S5_${input.role}_LOADED_CASE_COUNT:${byRef.size}`);
  const exactSources = input.orderedResidualRefs.map((ref) => {
    const item = byRef.get(ref);
    if (!item) throw new Error(`CAP08_S5_${input.role}_CASE_MISSING:${ref}`);
    return item;
  });
  const unexpected = [...byRef.keys()].filter((ref) => !input.orderedResidualRefs.includes(ref));
  if (unexpected.length) throw new Error(`CAP08_S5_${input.role}_UNEXPECTED_CASES:${unexpected.sort().join(",")}`);
  const sorted = [...exactSources].sort((left, right) =>
    compareIsoInstantV1(left.forecast_target_time, right.forecast_target_time)
    || compareIsoInstantV1(left.observation_available_to_runtime_at, right.observation_available_to_runtime_at)
    || left.residual_ref.localeCompare(right.residual_ref));
  if (sorted.some((item, index) => item.residual_ref !== input.orderedResidualRefs[index])) {
    throw new Error(`CAP08_S5_${input.role}_ORDER_MISMATCH`);
  }
  const cases = sorted.map(validateCaseV1);
  if (new Set(cases.map((item) => item.forecast_target_time)).size !== expectedCount) {
    throw new Error(`CAP08_S5_${input.role}_DUPLICATE_TARGET_TIME`);
  }
  const scope = structuredClone(cases[0]?.scope);
  if (!scope) throw new Error(`CAP08_S5_${input.role}_CASES_REQUIRED`);
  uniqueValueV1(cases.map((item) => scopeKeyV1(item.scope)), `CAP08_S5_${input.role}_SCOPE_HETEROGENEITY`);
  const contextLineageRef = uniqueValueV1(cases.map((item) => item.context_lineage_ref), `CAP08_S5_${input.role}_LINEAGE_HETEROGENEITY`);
  const contextRevisionRef = uniqueValueV1(cases.map((item) => item.context_revision_ref), `CAP08_S5_${input.role}_REVISION_HETEROGENEITY`);
  const modelComponentHash = uniqueValueV1(cases.map((item) => item.model_component_hash), `CAP08_S5_${input.role}_MODEL_HETEROGENEITY`);
  const effectiveParameterBundleHash = uniqueValueV1(cases.map((item) => item.effective_parameter_bundle_hash), `CAP08_S5_${input.role}_PARAMETER_HETEROGENEITY`);
  const observationOperatorHash = uniqueValueV1(cases.map((item) => item.observation_operator_hash), `CAP08_S5_${input.role}_OPERATOR_HETEROGENEITY`);
  const geometryHash = uniqueValueV1(cases.map((item) => item.geometry_hash), `CAP08_S5_${input.role}_GEOMETRY_HETEROGENEITY`);
  const numericPolicyHash = uniqueValueV1(cases.map((item) => item.runtime_replay_numeric_policy_hash), `CAP08_S5_${input.role}_NUMERIC_HETEROGENEITY`);
  const observations = orderedUniquePairsV1(
    cases.map((item) => ({ ref: item.actual_observation_ref, hash: item.actual_observation_hash })),
    `CAP08_S5_${input.role}_OBSERVATION_HASH_CONFLICT`,
  );
  const runtimeConfigs = orderedUniquePairsV1(
    cases.map((item) => ({ ref: item.source_runtime_config_ref, hash: item.source_runtime_config_hash })),
    `CAP08_S5_${input.role}_CONFIG_HASH_CONFLICT`,
  );
  const windowRefMembershipHash = semanticHashV1(cases.map((item) => item.residual_ref));
  const expectedWindowHash = input.role === "CALIBRATION"
    ? input.sourceDatasetIdentity.calibration_window_hash
    : input.sourceDatasetIdentity.holdout_window_hash;
  if (windowRefMembershipHash !== expectedWindowHash) {
    throw new Error(`CAP08_S5_${input.role}_WINDOW_REF_HASH_MISMATCH`);
  }
  const noPositiveRefs = cases
    .filter((item) => item.wetness_regime === CAP08_S5_NO_POSITIVE_EXCESS_REGIME_V1)
    .map((item) => item.residual_ref);
  const semantic = {
    schema_version: "geox_mcft_cap08_s5_case_window_v1" as const,
    role: input.role,
    case_builder_id: CAP08_S5_CALIBRATION_CASE_BUILDER_ID_V1,
    case_builder_version: 1 as const,
    scope,
    cases,
    ordered_residual_refs: cases.map((item) => item.residual_ref),
    ordered_residual_hashes: cases.map((item) => item.residual_hash),
    ordered_observation_refs: observations.refs,
    ordered_observation_hashes: observations.hashes,
    ordered_source_runtime_config_refs: runtimeConfigs.refs,
    source_runtime_config_set_hash: semanticHashV1(
      runtimeConfigs.refs.map((ref, index) => ({ ref, hash: runtimeConfigs.hashes[index] })),
    ),
    ...selectBaseConfigV1(exactSources),
    context_lineage_ref: contextLineageRef,
    context_revision_ref: contextRevisionRef,
    model_component_hash: modelComponentHash,
    effective_parameter_bundle_hash: effectiveParameterBundleHash,
    observation_operator_hash: observationOperatorHash,
    geometry_hash: geometryHash,
    runtime_replay_numeric_policy_hash: numericPolicyHash,
    logical_time: cases[cases.length - 1].forecast_target_time,
    as_of: cases.reduce(
      (latest, item) => compareIsoInstantV1(item.observation_available_to_runtime_at, latest) > 0
        ? item.observation_available_to_runtime_at
        : latest,
      cases[0].observation_available_to_runtime_at,
    ),
    case_input_set_hash: semanticHashV1(cases.map((item) => ({
      residual_ref: item.residual_ref,
      residual_hash: item.residual_hash,
      case_input_hash: item.case_input_hash,
      forecast_point_ref: item.source_forecast_point_ref,
      forecast_point_hash: item.source_forecast_point_hash,
      observation_ref: item.actual_observation_ref,
      observation_hash: item.actual_observation_hash,
    }))),
    window_ref_membership_hash: windowRefMembershipHash,
    window_residual_set_hash: semanticHashV1(cases.map((item) => ({ ref: item.residual_ref, hash: item.residual_hash }))),
    source_s1_residual_set_hash: input.sourceDatasetIdentity.residual_set_hash,
    source_s1_case_input_set_hash: input.sourceDatasetIdentity.case_input_set_hash,
    source_s1_calibration_window_hash: input.sourceDatasetIdentity.calibration_window_hash,
    source_s1_holdout_window_hash: input.sourceDatasetIdentity.holdout_window_hash,
    window_hash_semantics: input.sourceDatasetIdentity.window_hash_semantics,
    holdout_purpose: input.sourceDatasetIdentity.holdout_purpose,
    holdout_generalization_claim: input.sourceDatasetIdentity.holdout_generalization_claim,
    no_positive_excess_case_count: noPositiveRefs.length,
    no_positive_excess_case_refs: noPositiveRefs,
  };
  return { ...semantic, determinism_hash: semanticHashV1(semantic) };
}

export function buildCap08S5CaseWindowsV1(input: {
  calibration: Cap08S5BuiltCaseWindowV1;
  holdout: Cap08S5BuiltCaseWindowV1;
}): Cap08S5BuiltCaseWindowsV1 {
  if (input.calibration.role !== "CALIBRATION" || input.holdout.role !== "HOLDOUT") {
    throw new Error("CAP08_S5_CALIBRATION_HOLDOUT_ROLE_MISMATCH");
  }
  if (scopeKeyV1(input.calibration.scope) !== scopeKeyV1(input.holdout.scope)) {
    throw new Error("CAP08_S5_CALIBRATION_HOLDOUT_SCOPE_MISMATCH");
  }
  for (const key of [
    "context_lineage_ref",
    "context_revision_ref",
    "model_component_hash",
    "effective_parameter_bundle_hash",
    "observation_operator_hash",
    "geometry_hash",
    "runtime_replay_numeric_policy_hash",
    "source_s1_residual_set_hash",
    "source_s1_case_input_set_hash",
    "source_s1_calibration_window_hash",
    "source_s1_holdout_window_hash",
    "window_hash_semantics",
    "holdout_purpose",
    "holdout_generalization_claim",
  ] as const) {
    if (input.calibration[key] !== input.holdout[key]) {
      throw new Error(`CAP08_S5_CALIBRATION_HOLDOUT_CONTEXT_MISMATCH:${key}`);
    }
  }
  const allCases = [...input.calibration.cases, ...input.holdout.cases];
  const residualSetHash = semanticHashV1(allCases.map((item) => ({ ref: item.residual_ref, hash: item.residual_hash })));
  const caseInputSetHash = semanticHashV1(allCases.map((item) => ({
    residual_ref: item.residual_ref,
    residual_hash: item.residual_hash,
    forecast_point_ref: item.source_forecast_point_ref,
    forecast_point_hash: item.source_forecast_point_hash,
    observation_ref: item.actual_observation_ref,
    observation_hash: item.actual_observation_hash,
  })));
  if (residualSetHash !== input.calibration.source_s1_residual_set_hash
    || caseInputSetHash !== input.calibration.source_s1_case_input_set_hash) {
    throw new Error("CAP08_S5_SOURCE_DATASET_IDENTITY_MISMATCH");
  }
  const calibrationRefs = new Set(input.calibration.ordered_residual_refs);
  const overlap = input.holdout.ordered_residual_refs.filter((ref) => calibrationRefs.has(ref));
  if (overlap.length) throw new Error(`CAP08_S5_CALIBRATION_HOLDOUT_OVERLAP:${overlap.join(",")}`);
  const minimumHoldoutAvailability = input.holdout.cases.reduce(
    (earliest, item) => compareIsoInstantV1(item.observation_available_to_runtime_at, earliest) < 0
      ? item.observation_available_to_runtime_at
      : earliest,
    input.holdout.cases[0].observation_available_to_runtime_at,
  );
  if (compareIsoInstantV1(input.calibration.logical_time, input.holdout.cases[0].forecast_target_time) >= 0
    || compareIsoInstantV1(input.calibration.as_of, minimumHoldoutAvailability) >= 0) {
    throw new Error("CAP08_S5_CALIBRATION_HOLDOUT_FUTURE_LEAKAGE");
  }
  const semantic = {
    schema_version: "geox_mcft_cap08_s5_case_windows_v1" as const,
    calibration: structuredClone(input.calibration),
    holdout: structuredClone(input.holdout),
    future_leakage_count: 0 as const,
    calibration_holdout_ref_intersection_count: 0 as const,
    candidate_as_of: input.calibration.as_of,
    minimum_holdout_availability: minimumHoldoutAvailability,
    source_s1_residual_set_hash: residualSetHash,
    source_s1_case_input_set_hash: caseInputSetHash,
    calibration_window_ref_membership_hash: input.calibration.window_ref_membership_hash,
    holdout_window_ref_membership_hash: input.holdout.window_ref_membership_hash,
    window_hash_semantics: input.calibration.window_hash_semantics,
    holdout_purpose: input.calibration.holdout_purpose,
    holdout_generalization_claim: input.calibration.holdout_generalization_claim,
    no_positive_excess_calibration_case_count: input.calibration.no_positive_excess_case_count,
    no_positive_excess_holdout_case_count: input.holdout.no_positive_excess_case_count,
  };
  return { ...semantic, determinism_hash: semanticHashV1(semantic) };
}

export function asCap06ComputeWindowV1(
  window: Cap08S5BuiltCaseWindowV1,
): Cap06BuiltCaseWindowV1 {
  // The frozen CAP-06 grid/shadow engines consume only the structural case-window
  // fields. CAP-08 preserves that structure and adds an explicit non-exciting
  // regime; the S5 service separately proves those cases are parameter-insensitive.
  return structuredClone(window) as unknown as Cap06BuiltCaseWindowV1;
}
