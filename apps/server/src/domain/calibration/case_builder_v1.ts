// apps/server/src/domain/calibration/case_builder_v1.ts
// Purpose: build exact-ref-only MCFT-CAP-06 calibration and holdout case windows with dual-time, graph-context, homogeneity, and base-Config selection validation.
// Boundary: pure deterministic validation and derivation only; no repository search, external forcing retrieval, replay execution, persistence, projection, clock, route, or activation authority.

import {
  compareIsoInstantV1,
  parseFixedDecimalV1,
} from "../soil_water/fixed_point_water_decimal_v1.js";
import { semanticHashV1 } from "../twin_runtime/canonical_identity_v1.js";
import {
  CAP06_CALIBRATION_CASE_BUILDER_ID_V1,
  CAP06_CALIBRATION_CASE_COUNT_V1,
  CAP06_HOLDOUT_CASE_COUNT_V1,
  type Cap06CalibrationCaseSourceV1,
  type Cap06CalibrationCaseV1,
  type Cap06RealityScopeV1,
  type Cap06WetnessRegimeV1,
} from "./contracts_v1.js";

export type Cap06CaseBuilderSourceV1 = Cap06CalibrationCaseSourceV1 & {
  source_runtime_config_logical_time: string;
};

export type Cap06CaseWindowRoleV1 = "CALIBRATION" | "HOLDOUT";

export type Cap06BuiltCaseWindowV1 = {
  schema_version: "geox_mcft_cap_06_case_window_v1";
  role: Cap06CaseWindowRoleV1;
  case_builder_id: typeof CAP06_CALIBRATION_CASE_BUILDER_ID_V1;
  case_builder_version: 1;
  scope: Cap06RealityScopeV1;
  cases: Cap06CalibrationCaseV1[];
  ordered_residual_refs: string[];
  ordered_residual_hashes: string[];
  ordered_observation_refs: string[];
  ordered_observation_hashes: string[];
  ordered_source_runtime_config_refs: string[];
  source_runtime_config_set_hash: string;
  base_config_ref: string;
  base_config_hash: string;
  context_lineage_ref: string;
  context_revision_ref: string;
  model_component_hash: string;
  effective_parameter_bundle_hash: string;
  observation_operator_hash: string;
  geometry_hash: string;
  runtime_replay_numeric_policy_hash: string;
  logical_time: string;
  as_of: string;
  case_input_set_hash: string;
  determinism_hash: string;
};

export type Cap06BuiltCaseWindowsV1 = {
  schema_version: "geox_mcft_cap_06_case_windows_v1";
  calibration: Cap06BuiltCaseWindowV1;
  holdout: Cap06BuiltCaseWindowV1;
  future_leakage_count: 0;
  calibration_holdout_ref_intersection_count: 0;
  candidate_as_of: string;
  minimum_holdout_availability: string;
  determinism_hash: string;
};

function requireNonEmptyStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || value.length === 0) throw new Error(code);
  return value;
}

function requireExactIsoV1(value: unknown, code: string): string {
  const text = requireNonEmptyStringV1(value, code);
  if (new Date(text).toISOString() !== text) throw new Error(code);
  return text;
}

function uniqueValueV1(values: readonly string[], code: string): string {
  const unique = [...new Set(values)];
  if (unique.length !== 1) throw new Error(`${code}:${unique.length}`);
  return unique[0];
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

function classifyWetnessRegimeV1(
  excessAboveFieldCapacityMm: string,
  saturationMinusFieldCapacityMm: string,
): Cap06WetnessRegimeV1 {
  const excess = parseFixedDecimalV1(
    excessAboveFieldCapacityMm,
    6,
    "CAP06_EXCESS_ABOVE_FIELD_CAPACITY_REQUIRED",
  );
  const capacitySpan = parseFixedDecimalV1(
    saturationMinusFieldCapacityMm,
    6,
    "CAP06_SATURATION_CAPACITY_SPAN_REQUIRED",
  );
  if (capacitySpan <= 0n) throw new Error("CAP06_SATURATION_CAPACITY_SPAN_NOT_POSITIVE");
  if (excess <= 0n) throw new Error("CAP06_POSITIVE_EXCESS_REQUIRED");
  if (excess * 100n < capacitySpan * 10n) return "LOW_EXCESS";
  if (excess * 100n < capacitySpan * 30n) return "MID_EXCESS";
  return "HIGH_EXCESS";
}

function sortCasesV1(cases: readonly Cap06CaseBuilderSourceV1[]): Cap06CaseBuilderSourceV1[] {
  return [...cases].sort((left, right) =>
    compareIsoInstantV1(left.forecast_target_time, right.forecast_target_time)
    || compareIsoInstantV1(
      left.observation_available_to_runtime_at,
      right.observation_available_to_runtime_at,
    )
    || left.residual_ref.localeCompare(right.residual_ref));
}

function selectBaseConfigV1(cases: readonly Cap06CaseBuilderSourceV1[]): {
  base_config_ref: string;
  base_config_hash: string;
} {
  const byRef = new Map<string, { ref: string; hash: string; logical_time: string }>();
  for (const caseItem of cases) {
    const logicalTime = requireExactIsoV1(
      caseItem.source_runtime_config_logical_time,
      "CAP06_SOURCE_RUNTIME_CONFIG_LOGICAL_TIME_REQUIRED",
    );
    const existing = byRef.get(caseItem.source_runtime_config_ref);
    if (existing && (
      existing.hash !== caseItem.source_runtime_config_hash
      || existing.logical_time !== logicalTime
    )) {
      throw new Error(`CAP06_RUNTIME_CONFIG_IDENTITY_CONFLICT:${caseItem.source_runtime_config_ref}`);
    }
    byRef.set(caseItem.source_runtime_config_ref, {
      ref: caseItem.source_runtime_config_ref,
      hash: caseItem.source_runtime_config_hash,
      logical_time: logicalTime,
    });
  }
  const candidates = [...byRef.values()].sort((left, right) =>
    compareIsoInstantV1(right.logical_time, left.logical_time)
    || left.ref.localeCompare(right.ref));
  const selected = candidates[0];
  if (!selected) throw new Error("CAP06_BASE_CONFIG_REQUIRED");
  return {
    base_config_ref: selected.ref,
    base_config_hash: selected.hash,
  };
}

function validateCaseV1(caseItem: Cap06CaseBuilderSourceV1): Cap06CalibrationCaseV1 {
  if (!Number.isSafeInteger(caseItem.case_index) || caseItem.case_index < 0) {
    throw new Error("CAP06_CASE_INDEX_INVALID");
  }
  for (const [key, value] of Object.entries(caseItem.scope)) {
    requireNonEmptyStringV1(value, `CAP06_SCOPE_${key.toUpperCase()}_REQUIRED`);
  }
  const forecastIssuedAt = requireExactIsoV1(caseItem.forecast_issued_at, "CAP06_FORECAST_ISSUED_AT_REQUIRED");
  const forecastAsOf = requireExactIsoV1(caseItem.forecast_as_of, "CAP06_FORECAST_AS_OF_REQUIRED");
  const forecastEvidenceCutoff = requireExactIsoV1(
    caseItem.forecast_evidence_cutoff,
    "CAP06_FORECAST_EVIDENCE_CUTOFF_REQUIRED",
  );
  const forecastTargetTime = requireExactIsoV1(
    caseItem.forecast_target_time,
    "CAP06_FORECAST_TARGET_TIME_REQUIRED",
  );
  const observationObservedAt = requireExactIsoV1(
    caseItem.observation_observed_at,
    "CAP06_OBSERVATION_OBSERVED_AT_REQUIRED",
  );
  const observationAvailableAt = requireExactIsoV1(
    caseItem.observation_available_to_runtime_at,
    "CAP06_OBSERVATION_AVAILABILITY_REQUIRED",
  );
  if (forecastTargetTime !== observationObservedAt) {
    throw new Error(`CAP06_TARGET_OBSERVATION_TIME_MISMATCH:${caseItem.residual_ref}`);
  }
  if (compareIsoInstantV1(forecastIssuedAt, observationAvailableAt) >= 0) {
    throw new Error(`CAP06_FORECAST_ISSUED_FUTURE_LEAKAGE:${caseItem.residual_ref}`);
  }
  if (compareIsoInstantV1(forecastAsOf, observationAvailableAt) >= 0) {
    throw new Error(`CAP06_FORECAST_AS_OF_FUTURE_LEAKAGE:${caseItem.residual_ref}`);
  }
  if (compareIsoInstantV1(forecastEvidenceCutoff, forecastAsOf) > 0) {
    throw new Error(`CAP06_EVIDENCE_CUTOFF_AFTER_FORECAST_AS_OF:${caseItem.residual_ref}`);
  }
  parseFixedDecimalV1(caseItem.actual_observation_vwc, 9, "CAP06_ACTUAL_OBSERVATION_VWC_REQUIRED");
  parseFixedDecimalV1(caseItem.base_prediction_vwc, 9, "CAP06_BASE_PREDICTION_VWC_REQUIRED");
  const requiredIdentityValues = [
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
  ];
  for (const value of requiredIdentityValues) {
    requireNonEmptyStringV1(value, `CAP06_CASE_IDENTITY_REQUIRED:${caseItem.residual_ref}`);
  }
  return {
    ...structuredClone(caseItem),
    wetness_regime: classifyWetnessRegimeV1(
      caseItem.excess_above_field_capacity_mm,
      caseItem.saturation_minus_field_capacity_mm,
    ),
  };
}

export function buildCap06CaseWindowV1(input: {
  role: Cap06CaseWindowRoleV1;
  orderedResidualRefs: readonly string[];
  loadedCases: readonly Cap06CaseBuilderSourceV1[];
}): Cap06BuiltCaseWindowV1 {
  const expectedCount = input.role === "CALIBRATION"
    ? CAP06_CALIBRATION_CASE_COUNT_V1
    : CAP06_HOLDOUT_CASE_COUNT_V1;
  if (input.orderedResidualRefs.length !== expectedCount) {
    throw new Error(`CAP06_${input.role}_REF_COUNT_REQUIRED:${input.orderedResidualRefs.length}`);
  }
  if (new Set(input.orderedResidualRefs).size !== input.orderedResidualRefs.length) {
    throw new Error(`CAP06_${input.role}_DUPLICATE_RESIDUAL_REF`);
  }
  const byRef = new Map<string, Cap06CaseBuilderSourceV1>();
  for (const source of input.loadedCases) {
    if (byRef.has(source.residual_ref)) {
      throw new Error(`CAP06_${input.role}_DUPLICATE_LOADED_RESIDUAL:${source.residual_ref}`);
    }
    byRef.set(source.residual_ref, structuredClone(source));
  }
  if (byRef.size !== expectedCount) {
    throw new Error(`CAP06_${input.role}_LOADED_CASE_COUNT_REQUIRED:${byRef.size}`);
  }
  const exactSources = input.orderedResidualRefs.map((ref) => {
    const source = byRef.get(ref);
    if (!source) throw new Error(`CAP06_${input.role}_EXACT_RESIDUAL_MISSING:${ref}`);
    return source;
  });
  const unexpected = [...byRef.keys()].filter((ref) => !input.orderedResidualRefs.includes(ref));
  if (unexpected.length > 0) {
    throw new Error(`CAP06_${input.role}_UNEXPECTED_RESIDUALS:${unexpected.sort().join(",")}`);
  }
  const sorted = sortCasesV1(exactSources);
  const sortedRefs = sorted.map((item) => item.residual_ref);
  if (sortedRefs.some((ref, index) => ref !== input.orderedResidualRefs[index])) {
    throw new Error(`CAP06_${input.role}_ORDER_MISMATCH`);
  }
  const cases = sorted.map(validateCaseV1);
  const targetOwners = new Set<string>();
  for (const caseItem of cases) {
    if (targetOwners.has(caseItem.forecast_target_time)) {
      throw new Error(`CAP06_${input.role}_DUPLICATE_TARGET_TIME:${caseItem.forecast_target_time}`);
    }
    targetOwners.add(caseItem.forecast_target_time);
  }
  const scope = structuredClone(cases[0]?.scope);
  if (!scope) throw new Error(`CAP06_${input.role}_CASES_REQUIRED`);
  uniqueValueV1(cases.map((item) => scopeKeyV1(item.scope)), `CAP06_${input.role}_SCOPE_HETEROGENEITY`);
  const contextLineageRef = uniqueValueV1(
    cases.map((item) => item.context_lineage_ref),
    `CAP06_${input.role}_LINEAGE_HETEROGENEITY`,
  );
  const contextRevisionRef = uniqueValueV1(
    cases.map((item) => item.context_revision_ref),
    `CAP06_${input.role}_REVISION_HETEROGENEITY`,
  );
  const modelComponentHash = uniqueValueV1(
    cases.map((item) => item.model_component_hash),
    `CAP06_${input.role}_MODEL_HETEROGENEITY`,
  );
  const effectiveParameterBundleHash = uniqueValueV1(
    cases.map((item) => item.effective_parameter_bundle_hash),
    `CAP06_${input.role}_PARAMETER_BUNDLE_HETEROGENEITY`,
  );
  const observationOperatorHash = uniqueValueV1(
    cases.map((item) => item.observation_operator_hash),
    `CAP06_${input.role}_OPERATOR_HETEROGENEITY`,
  );
  const geometryHash = uniqueValueV1(
    cases.map((item) => item.geometry_hash),
    `CAP06_${input.role}_GEOMETRY_HETEROGENEITY`,
  );
  const runtimeReplayNumericPolicyHash = uniqueValueV1(
    cases.map((item) => item.runtime_replay_numeric_policy_hash),
    `CAP06_${input.role}_NUMERIC_POLICY_HETEROGENEITY`,
  );
  const observations = orderedUniquePairsV1(
    cases.map((item) => ({ ref: item.actual_observation_ref, hash: item.actual_observation_hash })),
    `CAP06_${input.role}_OBSERVATION_HASH_CONFLICT`,
  );
  const runtimeConfigs = orderedUniquePairsV1(
    cases.map((item) => ({ ref: item.source_runtime_config_ref, hash: item.source_runtime_config_hash })),
    `CAP06_${input.role}_RUNTIME_CONFIG_HASH_CONFLICT`,
  );
  const baseConfig = selectBaseConfigV1(exactSources);
  const logicalTime = cases[cases.length - 1].forecast_target_time;
  const asOf = cases.reduce(
    (latest, item) => compareIsoInstantV1(item.observation_available_to_runtime_at, latest) > 0
      ? item.observation_available_to_runtime_at
      : latest,
    cases[0].observation_available_to_runtime_at,
  );
  const caseInputSetHash = semanticHashV1(cases.map((item) => ({
    residual_ref: item.residual_ref,
    residual_hash: item.residual_hash,
    case_input_hash: item.case_input_hash,
    forecast_point_ref: item.source_forecast_point_ref,
    forecast_point_hash: item.source_forecast_point_hash,
    observation_ref: item.actual_observation_ref,
    observation_hash: item.actual_observation_hash,
  })));
  const semantic = {
    schema_version: "geox_mcft_cap_06_case_window_v1" as const,
    role: input.role,
    case_builder_id: CAP06_CALIBRATION_CASE_BUILDER_ID_V1,
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
    ...baseConfig,
    context_lineage_ref: contextLineageRef,
    context_revision_ref: contextRevisionRef,
    model_component_hash: modelComponentHash,
    effective_parameter_bundle_hash: effectiveParameterBundleHash,
    observation_operator_hash: observationOperatorHash,
    geometry_hash: geometryHash,
    runtime_replay_numeric_policy_hash: runtimeReplayNumericPolicyHash,
    logical_time: logicalTime,
    as_of: asOf,
    case_input_set_hash: caseInputSetHash,
  };
  return {
    ...semantic,
    determinism_hash: semanticHashV1(semantic),
  };
}

export function buildCap06CaseWindowsV1(input: {
  calibration: Cap06BuiltCaseWindowV1;
  holdout: Cap06BuiltCaseWindowV1;
}): Cap06BuiltCaseWindowsV1 {
  if (input.calibration.role !== "CALIBRATION") throw new Error("CAP06_CALIBRATION_WINDOW_REQUIRED");
  if (input.holdout.role !== "HOLDOUT") throw new Error("CAP06_HOLDOUT_WINDOW_REQUIRED");
  if (scopeKeyV1(input.calibration.scope) !== scopeKeyV1(input.holdout.scope)) {
    throw new Error("CAP06_CALIBRATION_HOLDOUT_SCOPE_MISMATCH");
  }
  for (const key of [
    "context_lineage_ref",
    "context_revision_ref",
    "model_component_hash",
    "effective_parameter_bundle_hash",
    "observation_operator_hash",
    "geometry_hash",
    "runtime_replay_numeric_policy_hash",
  ] as const) {
    if (input.calibration[key] !== input.holdout[key]) {
      throw new Error(`CAP06_CALIBRATION_HOLDOUT_CONTEXT_MISMATCH:${key}`);
    }
  }
  const calibrationRefs = new Set(input.calibration.ordered_residual_refs);
  const intersection = input.holdout.ordered_residual_refs.filter((ref) => calibrationRefs.has(ref));
  if (intersection.length > 0) {
    throw new Error(`CAP06_CALIBRATION_HOLDOUT_REF_INTERSECTION:${intersection.join(",")}`);
  }
  const minimumHoldoutTarget = input.holdout.cases[0].forecast_target_time;
  const minimumHoldoutAvailability = input.holdout.cases.reduce(
    (earliest, item) => compareIsoInstantV1(item.observation_available_to_runtime_at, earliest) < 0
      ? item.observation_available_to_runtime_at
      : earliest,
    input.holdout.cases[0].observation_available_to_runtime_at,
  );
  if (compareIsoInstantV1(input.calibration.logical_time, minimumHoldoutTarget) >= 0) {
    throw new Error("CAP06_CALIBRATION_TARGET_NOT_BEFORE_HOLDOUT");
  }
  if (compareIsoInstantV1(input.calibration.as_of, minimumHoldoutAvailability) >= 0) {
    throw new Error("CAP06_CALIBRATION_AVAILABILITY_NOT_BEFORE_HOLDOUT");
  }
  const semantic = {
    schema_version: "geox_mcft_cap_06_case_windows_v1" as const,
    calibration: structuredClone(input.calibration),
    holdout: structuredClone(input.holdout),
    future_leakage_count: 0 as const,
    calibration_holdout_ref_intersection_count: 0 as const,
    candidate_as_of: input.calibration.as_of,
    minimum_holdout_availability: minimumHoldoutAvailability,
  };
  return {
    ...semantic,
    determinism_hash: semanticHashV1(semantic),
  };
}
