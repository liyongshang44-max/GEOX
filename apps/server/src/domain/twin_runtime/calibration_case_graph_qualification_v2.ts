// apps/server/src/domain/twin_runtime/calibration_case_graph_qualification_v2.ts
// Purpose: classify exact repository-history Forecast Residual case graphs while preserving the distinct Forecast-time and Residual-time Runtime Config authorities.
// Boundary: pure deterministic qualification only; no database, filesystem, clock, environment, persistence, parameter replay, Candidate, Evaluation, Model Activation, or Runtime authority mutation.

import { semanticHashV1 } from "./canonical_identity_v1.js";

export const CAP06_REPOSITORY_HISTORY_TRACK_V2 = "REPOSITORY_HISTORY_QUALIFICATION_TRACK" as const;
export const CAP06_REQUIRED_MATCHED_CASE_COUNT_V2 = 24 as const;
export const CAP06_CALIBRATION_CASE_COUNT_V2 = 16 as const;
export const CAP06_HOLDOUT_CASE_COUNT_V2 = 8 as const;

export type Cap06ScopeV2 = {
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  season_id: string;
  zone_id: string;
};

export type Cap06RefHashV2 = {
  ref: string;
  hash: string;
};

export type Cap06ResolvedForecastPointV2 = Cap06RefHashV2 & {
  horizon_hour: number;
  target_time: string;
};

export type Cap06ResidualCaseV2 = {
  residual_ref: string;
  residual_hash: string;
  scope: Cap06ScopeV2;
  context_lineage_ref: string;
  context_revision_ref: string;
  forecast_run: Cap06RefHashV2;
  forecast_point: Cap06ResolvedForecastPointV2;
  forecast_issued_at: string;
  forecast_target_time: string;
  observation: Cap06RefHashV2 & {
    observed_at: string;
    available_to_runtime_at: string;
    quality: "PASS" | "LIMITED";
    unit: string;
  };
  residual_runtime_config: Cap06RefHashV2;
  root_zone_geometry: Cap06RefHashV2;
  observation_operator_basis: Record<string, unknown>;
};

export type Cap06ResolvedCaseGraphV2 = {
  residual: Cap06ResidualCaseV2;
  forecast: Cap06RefHashV2 & {
    scope: Cap06ScopeV2;
    context_lineage_ref: string;
    context_revision_ref: string;
    status: string;
    issued_at: string;
    as_of: string;
    source_posterior: Cap06RefHashV2;
    forecast_runtime_config: Cap06RefHashV2;
    evidence_window: Cap06RefHashV2;
    forcing_cycle_key: string;
    forcing_window_hash: string;
    weather_snapshot: Cap06RefHashV2;
    et0_snapshot: Cap06RefHashV2;
    crop_stage_context: Cap06RefHashV2;
    points: readonly Cap06ResolvedForecastPointV2[];
  };
  source_posterior: Cap06RefHashV2 & {
    scope: Cap06ScopeV2;
    context_lineage_ref: string;
    context_revision_ref: string;
    forecast_runtime_config: Cap06RefHashV2;
  };
  forecast_runtime_config: Cap06RefHashV2 & {
    model_component_basis: unknown;
    effective_parameter_bundle_basis: unknown;
    runtime_replay_numeric_policy_basis: unknown;
  };
  residual_runtime_config: Cap06RefHashV2 & {
    residual_policy_basis: unknown;
  };
  evidence_window: Cap06RefHashV2 & {
    evidence_cutoff_at: string;
  };
  observation: Cap06RefHashV2 & {
    observed_at: string;
    available_to_runtime_at: string;
    quality: "PASS" | "LIMITED";
    unit: string;
  };
  weather_snapshot: Cap06RefHashV2;
  et0_snapshot: Cap06RefHashV2;
  crop_stage_context: Cap06RefHashV2;
  root_zone_geometry: Cap06RefHashV2;
};

export type Cap06CaseExclusionClassV2 =
  | "POLICY_EXCLUSION"
  | "AVAILABILITY_ORDER_INVALID"
  | "INVALID_CASE_GRAPH";

export type Cap06CaseExclusionReasonV2 =
  | "SCOPE_MISMATCH"
  | "CONTEXT_LINEAGE_MISMATCH"
  | "CONTEXT_REVISION_MISMATCH"
  | "OBSERVATION_QUALITY_NOT_PASS"
  | "OBSERVATION_UNIT_NOT_VWC_FRACTION"
  | "FORECAST_NOT_COMPLETED"
  | "FORECAST_HORIZON_NOT_H1"
  | "FORECAST_TARGET_OBSERVATION_TIME_MISMATCH"
  | "FORECAST_ISSUED_NOT_BEFORE_OBSERVATION_AVAILABILITY"
  | "FORECAST_AS_OF_NOT_BEFORE_OBSERVATION_AVAILABILITY"
  | "EVIDENCE_CUTOFF_AFTER_FORECAST_AS_OF"
  | "RESIDUAL_FORECAST_RUN_REF_HASH_MISMATCH"
  | "FORECAST_POINT_CARDINALITY_INVALID"
  | "RESIDUAL_FORECAST_POINT_REF_HASH_MISMATCH"
  | "RESIDUAL_OBSERVATION_REF_HASH_MISMATCH"
  | "RESIDUAL_RUNTIME_CONFIG_REF_HASH_MISMATCH"
  | "FORECAST_RUNTIME_CONFIG_REF_HASH_MISMATCH"
  | "POSTERIOR_RUNTIME_CONFIG_REF_HASH_MISMATCH"
  | "FORECAST_SOURCE_POSTERIOR_REF_HASH_MISMATCH"
  | "FORECAST_EVIDENCE_WINDOW_REF_HASH_MISMATCH"
  | "WEATHER_SNAPSHOT_REF_HASH_MISMATCH"
  | "ET0_SNAPSHOT_REF_HASH_MISMATCH"
  | "CROP_STAGE_CONTEXT_REF_HASH_MISMATCH"
  | "FORCING_CYCLE_KEY_REQUIRED"
  | "FORCING_WINDOW_HASH_REQUIRED"
  | "ROOT_ZONE_GEOMETRY_REF_HASH_MISMATCH"
  | "RESOLVED_OBSERVATION_TIME_MISMATCH"
  | "RESOLVED_OBSERVATION_AVAILABILITY_MISMATCH"
  | "RESOLVED_OBSERVATION_QUALITY_MISMATCH"
  | "RESOLVED_OBSERVATION_UNIT_MISMATCH"
  | "DUPLICATE_FORECAST_TARGET_TIME"
  | "CONFLICTING_SEMANTIC_DUPLICATE";

export type Cap06QualifiedCaseV2 = {
  residual_ref: string;
  residual_hash: string;
  forecast_ref: string;
  forecast_hash: string;
  forecast_point_ref: string;
  forecast_point_hash: string;
  observation_ref: string;
  observation_hash: string;
  forecast_target_time: string;
  observation_available_to_runtime_at: string;
  forecast_runtime_config_ref: string;
  forecast_runtime_config_hash: string;
  residual_runtime_config_ref: string;
  residual_runtime_config_hash: string;
  model_component_hash: string;
  effective_parameter_bundle_hash: string;
  observation_operator_hash: string;
  geometry_hash: string;
  runtime_replay_numeric_policy_hash: string;
  residual_policy_hash: string;
};

export type Cap06ExcludedCaseV2 = {
  residual_ref: string;
  residual_hash: string;
  exclusion_class: Cap06CaseExclusionClassV2;
  reasons: readonly Cap06CaseExclusionReasonV2[];
};

export type Cap06DatasetQualificationStatusV2 =
  | "READY_FOR_CALIBRATION_ASSESSMENT"
  | "INSUFFICIENT_MATCHED_PAIRS"
  | "CONFIG_OR_MODEL_HETEROGENEITY"
  | "AVAILABILITY_ORDER_INVALID"
  | "INVALID_CASE_GRAPH";

export type Cap06DatasetQualificationV2 = {
  schema_version: "geox_mcft_cap_06_dataset_qualification_v2";
  qualification_id: string;
  source_scope: Cap06ScopeV2;
  qualification_track: typeof CAP06_REPOSITORY_HISTORY_TRACK_V2;
  case_graph_validation_status: "PASS" | "FAIL";
  dataset_qualification_status: Cap06DatasetQualificationStatusV2;
  eligible_forecast_count: number;
  eligible_observation_count: number;
  eligible_matched_pair_count: number;
  eligible_residual_count: number;
  eligible_calibration_count: number;
  eligible_holdout_count: number;
  calibration_window_refs: readonly string[];
  holdout_window_refs: readonly string[];
  model_component_hash_count: number;
  effective_parameter_bundle_hash_count: number;
  observation_operator_hash_count: number;
  geometry_hash_count: number;
  runtime_replay_numeric_policy_hash_count: number;
  residual_policy_hash_count: number;
  eligible_cases: readonly Cap06QualifiedCaseV2[];
  excluded_cases: readonly Cap06ExcludedCaseV2[];
  qualification_limitations: readonly string[];
};

function canonicalInstantV2(value: string, code: string): number {
  // Reject non-canonical instants so ordering cannot depend on locale or parser normalization.
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) throw new Error(code);
  return parsed;
}

function sameScopeV2(left: Cap06ScopeV2, right: Cap06ScopeV2): boolean {
  // Compare the complete frozen six-part scope.
  return left.tenant_id === right.tenant_id
    && left.project_id === right.project_id
    && left.group_id === right.group_id
    && left.field_id === right.field_id
    && left.season_id === right.season_id
    && left.zone_id === right.zone_id;
}

function sameRefHashV2(left: Cap06RefHashV2, right: Cap06RefHashV2): boolean {
  // A graph edge is valid only when both identifier and frozen semantic hash match.
  return left.ref === right.ref && left.hash === right.hash;
}

function requiredStringV2(value: string): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function classifyReasonsV2(reasons: readonly Cap06CaseExclusionReasonV2[]): Cap06CaseExclusionClassV2 {
  const graphReasons = new Set<Cap06CaseExclusionReasonV2>([
    "RESIDUAL_FORECAST_RUN_REF_HASH_MISMATCH",
    "FORECAST_POINT_CARDINALITY_INVALID",
    "RESIDUAL_FORECAST_POINT_REF_HASH_MISMATCH",
    "RESIDUAL_OBSERVATION_REF_HASH_MISMATCH",
    "RESIDUAL_RUNTIME_CONFIG_REF_HASH_MISMATCH",
    "FORECAST_RUNTIME_CONFIG_REF_HASH_MISMATCH",
    "POSTERIOR_RUNTIME_CONFIG_REF_HASH_MISMATCH",
    "FORECAST_SOURCE_POSTERIOR_REF_HASH_MISMATCH",
    "FORECAST_EVIDENCE_WINDOW_REF_HASH_MISMATCH",
    "WEATHER_SNAPSHOT_REF_HASH_MISMATCH",
    "ET0_SNAPSHOT_REF_HASH_MISMATCH",
    "CROP_STAGE_CONTEXT_REF_HASH_MISMATCH",
    "FORCING_CYCLE_KEY_REQUIRED",
    "FORCING_WINDOW_HASH_REQUIRED",
    "ROOT_ZONE_GEOMETRY_REF_HASH_MISMATCH",
    "RESOLVED_OBSERVATION_TIME_MISMATCH",
    "RESOLVED_OBSERVATION_AVAILABILITY_MISMATCH",
    "RESOLVED_OBSERVATION_QUALITY_MISMATCH",
    "RESOLVED_OBSERVATION_UNIT_MISMATCH",
    "DUPLICATE_FORECAST_TARGET_TIME",
    "CONFLICTING_SEMANTIC_DUPLICATE",
  ]);
  if (reasons.some((reason) => graphReasons.has(reason))) return "INVALID_CASE_GRAPH";
  if (reasons.some((reason) => reason.includes("AVAILABILITY") || reason === "EVIDENCE_CUTOFF_AFTER_FORECAST_AS_OF")) {
    return "AVAILABILITY_ORDER_INVALID";
  }
  return "POLICY_EXCLUSION";
}

function qualifyOneCaseV2(expectedScope: Cap06ScopeV2, graph: Cap06ResolvedCaseGraphV2): { eligible?: Cap06QualifiedCaseV2; excluded?: Cap06ExcludedCaseV2 } {
  // Collect every failure for a case so qualification output is auditable and non-lossy.
  const reasons: Cap06CaseExclusionReasonV2[] = [];
  const residual = graph.residual;

  if (!sameScopeV2(residual.scope, expectedScope)
    || !sameScopeV2(graph.forecast.scope, expectedScope)
    || !sameScopeV2(graph.source_posterior.scope, expectedScope)) reasons.push("SCOPE_MISMATCH");
  if (residual.context_lineage_ref !== graph.forecast.context_lineage_ref
    || residual.context_lineage_ref !== graph.source_posterior.context_lineage_ref) reasons.push("CONTEXT_LINEAGE_MISMATCH");
  if (residual.context_revision_ref !== graph.forecast.context_revision_ref
    || residual.context_revision_ref !== graph.source_posterior.context_revision_ref) reasons.push("CONTEXT_REVISION_MISMATCH");
  if (residual.observation.quality !== "PASS") reasons.push("OBSERVATION_QUALITY_NOT_PASS");
  if (residual.observation.unit !== "fraction") reasons.push("OBSERVATION_UNIT_NOT_VWC_FRACTION");
  if (graph.forecast.status !== "COMPLETED") reasons.push("FORECAST_NOT_COMPLETED");
  if (residual.forecast_point.horizon_hour !== 1) reasons.push("FORECAST_HORIZON_NOT_H1");
  if (residual.forecast_target_time !== residual.observation.observed_at) reasons.push("FORECAST_TARGET_OBSERVATION_TIME_MISMATCH");

  const forecastIssuedAt = canonicalInstantV2(graph.forecast.issued_at, "CAP06_FORECAST_ISSUED_AT_INVALID");
  const residualIssuedAt = canonicalInstantV2(residual.forecast_issued_at, "CAP06_RESIDUAL_FORECAST_ISSUED_AT_INVALID");
  const forecastAsOf = canonicalInstantV2(graph.forecast.as_of, "CAP06_FORECAST_AS_OF_INVALID");
  const observationAvailableAt = canonicalInstantV2(graph.observation.available_to_runtime_at, "CAP06_OBSERVATION_AVAILABLE_AT_INVALID");
  const evidenceCutoffAt = canonicalInstantV2(graph.evidence_window.evidence_cutoff_at, "CAP06_EVIDENCE_CUTOFF_INVALID");
  if (forecastIssuedAt !== residualIssuedAt || forecastIssuedAt >= observationAvailableAt) reasons.push("FORECAST_ISSUED_NOT_BEFORE_OBSERVATION_AVAILABILITY");
  if (forecastAsOf >= observationAvailableAt) reasons.push("FORECAST_AS_OF_NOT_BEFORE_OBSERVATION_AVAILABILITY");
  if (evidenceCutoffAt > forecastAsOf) reasons.push("EVIDENCE_CUTOFF_AFTER_FORECAST_AS_OF");

  if (!sameRefHashV2(residual.forecast_run, graph.forecast)) reasons.push("RESIDUAL_FORECAST_RUN_REF_HASH_MISMATCH");
  const matchingPoints = graph.forecast.points.filter((point) => point.horizon_hour === 1 && point.target_time === residual.forecast_target_time);
  if (matchingPoints.length !== 1) reasons.push("FORECAST_POINT_CARDINALITY_INVALID");
  else if (!sameRefHashV2(residual.forecast_point, matchingPoints[0])) reasons.push("RESIDUAL_FORECAST_POINT_REF_HASH_MISMATCH");
  if (!sameRefHashV2(residual.observation, graph.observation)) reasons.push("RESIDUAL_OBSERVATION_REF_HASH_MISMATCH");
  if (!sameRefHashV2(residual.residual_runtime_config, graph.residual_runtime_config)) reasons.push("RESIDUAL_RUNTIME_CONFIG_REF_HASH_MISMATCH");
  if (!sameRefHashV2(graph.forecast.forecast_runtime_config, graph.forecast_runtime_config)) reasons.push("FORECAST_RUNTIME_CONFIG_REF_HASH_MISMATCH");
  if (!sameRefHashV2(graph.source_posterior.forecast_runtime_config, graph.forecast_runtime_config)) reasons.push("POSTERIOR_RUNTIME_CONFIG_REF_HASH_MISMATCH");
  if (!sameRefHashV2(graph.forecast.source_posterior, graph.source_posterior)) reasons.push("FORECAST_SOURCE_POSTERIOR_REF_HASH_MISMATCH");
  if (!sameRefHashV2(graph.forecast.evidence_window, graph.evidence_window)) reasons.push("FORECAST_EVIDENCE_WINDOW_REF_HASH_MISMATCH");
  if (!sameRefHashV2(graph.forecast.weather_snapshot, graph.weather_snapshot)) reasons.push("WEATHER_SNAPSHOT_REF_HASH_MISMATCH");
  if (!sameRefHashV2(graph.forecast.et0_snapshot, graph.et0_snapshot)) reasons.push("ET0_SNAPSHOT_REF_HASH_MISMATCH");
  if (!sameRefHashV2(graph.forecast.crop_stage_context, graph.crop_stage_context)) reasons.push("CROP_STAGE_CONTEXT_REF_HASH_MISMATCH");
  if (!requiredStringV2(graph.forecast.forcing_cycle_key)) reasons.push("FORCING_CYCLE_KEY_REQUIRED");
  if (!requiredStringV2(graph.forecast.forcing_window_hash)) reasons.push("FORCING_WINDOW_HASH_REQUIRED");
  if (!sameRefHashV2(residual.root_zone_geometry, graph.root_zone_geometry)) reasons.push("ROOT_ZONE_GEOMETRY_REF_HASH_MISMATCH");
  if (residual.observation.observed_at !== graph.observation.observed_at) reasons.push("RESOLVED_OBSERVATION_TIME_MISMATCH");
  if (residual.observation.available_to_runtime_at !== graph.observation.available_to_runtime_at) reasons.push("RESOLVED_OBSERVATION_AVAILABILITY_MISMATCH");
  if (residual.observation.quality !== graph.observation.quality) reasons.push("RESOLVED_OBSERVATION_QUALITY_MISMATCH");
  if (residual.observation.unit !== graph.observation.unit) reasons.push("RESOLVED_OBSERVATION_UNIT_MISMATCH");

  if (reasons.length > 0) {
    return {
      excluded: {
        residual_ref: residual.residual_ref,
        residual_hash: residual.residual_hash,
        exclusion_class: classifyReasonsV2(reasons),
        reasons: [...new Set(reasons)].sort(),
      },
    };
  }

  return {
    eligible: {
      residual_ref: residual.residual_ref,
      residual_hash: residual.residual_hash,
      forecast_ref: graph.forecast.ref,
      forecast_hash: graph.forecast.hash,
      forecast_point_ref: residual.forecast_point.ref,
      forecast_point_hash: residual.forecast_point.hash,
      observation_ref: graph.observation.ref,
      observation_hash: graph.observation.hash,
      forecast_target_time: residual.forecast_target_time,
      observation_available_to_runtime_at: graph.observation.available_to_runtime_at,
      forecast_runtime_config_ref: graph.forecast_runtime_config.ref,
      forecast_runtime_config_hash: graph.forecast_runtime_config.hash,
      residual_runtime_config_ref: graph.residual_runtime_config.ref,
      residual_runtime_config_hash: graph.residual_runtime_config.hash,
      model_component_hash: semanticHashV1(graph.forecast_runtime_config.model_component_basis),
      effective_parameter_bundle_hash: semanticHashV1(graph.forecast_runtime_config.effective_parameter_bundle_basis),
      observation_operator_hash: semanticHashV1(residual.observation_operator_basis),
      geometry_hash: graph.root_zone_geometry.hash,
      runtime_replay_numeric_policy_hash: semanticHashV1(graph.forecast_runtime_config.runtime_replay_numeric_policy_basis),
      residual_policy_hash: semanticHashV1(graph.residual_runtime_config.residual_policy_basis),
    },
  };
}

function countDistinctV2(values: readonly string[]): number {
  return new Set(values).size;
}

function addDatasetDuplicateExclusionsV2(eligibleCases: Cap06QualifiedCaseV2[], excludedCases: Cap06ExcludedCaseV2[]): Cap06QualifiedCaseV2[] {
  // Duplicate target times and conflicting semantic pairs invalidate affected cases while preserving explicit accounting.
  const targetGroups = new Map<string, Cap06QualifiedCaseV2[]>();
  const semanticGroups = new Map<string, Cap06QualifiedCaseV2[]>();
  for (const item of eligibleCases) {
    targetGroups.set(item.forecast_target_time, [...(targetGroups.get(item.forecast_target_time) ?? []), item]);
    const semanticKey = `${item.forecast_ref}|${item.forecast_point_ref}|${item.observation_ref}`;
    semanticGroups.set(semanticKey, [...(semanticGroups.get(semanticKey) ?? []), item]);
  }
  const invalidRefs = new Map<string, Set<Cap06CaseExclusionReasonV2>>();
  const add = (ref: string, reason: Cap06CaseExclusionReasonV2): void => {
    const reasons = invalidRefs.get(ref) ?? new Set<Cap06CaseExclusionReasonV2>();
    reasons.add(reason);
    invalidRefs.set(ref, reasons);
  };
  for (const group of targetGroups.values()) if (group.length > 1) for (const item of group) add(item.residual_ref, "DUPLICATE_FORECAST_TARGET_TIME");
  for (const group of semanticGroups.values()) {
    if (new Set(group.map((item) => `${item.residual_ref}|${item.residual_hash}`)).size > 1) {
      for (const item of group) add(item.residual_ref, "CONFLICTING_SEMANTIC_DUPLICATE");
    }
  }
  const retained: Cap06QualifiedCaseV2[] = [];
  for (const item of eligibleCases) {
    const reasons = invalidRefs.get(item.residual_ref);
    if (!reasons) retained.push(item);
    else excludedCases.push({
      residual_ref: item.residual_ref,
      residual_hash: item.residual_hash,
      exclusion_class: "INVALID_CASE_GRAPH",
      reasons: [...reasons].sort(),
    });
  }
  return retained;
}

export function qualifyCap06DatasetV2(expectedScope: Cap06ScopeV2, graphs: readonly Cap06ResolvedCaseGraphV2[]): Cap06DatasetQualificationV2 {
  const eligibleCases: Cap06QualifiedCaseV2[] = [];
  const excludedCases: Cap06ExcludedCaseV2[] = [];
  for (const graph of graphs) {
    const result = qualifyOneCaseV2(expectedScope, graph);
    if (result.eligible) eligibleCases.push(result.eligible);
    if (result.excluded) excludedCases.push(result.excluded);
  }
  const deduplicatedEligible = addDatasetDuplicateExclusionsV2(eligibleCases, excludedCases)
    .sort((left, right) => left.forecast_target_time.localeCompare(right.forecast_target_time) || left.residual_ref.localeCompare(right.residual_ref));
  excludedCases.sort((left, right) => left.residual_ref.localeCompare(right.residual_ref));

  const modelCount = countDistinctV2(deduplicatedEligible.map((item) => item.model_component_hash));
  const bundleCount = countDistinctV2(deduplicatedEligible.map((item) => item.effective_parameter_bundle_hash));
  const operatorCount = countDistinctV2(deduplicatedEligible.map((item) => item.observation_operator_hash));
  const geometryCount = countDistinctV2(deduplicatedEligible.map((item) => item.geometry_hash));
  const numericCount = countDistinctV2(deduplicatedEligible.map((item) => item.runtime_replay_numeric_policy_hash));
  const residualPolicyCount = countDistinctV2(deduplicatedEligible.map((item) => item.residual_policy_hash));

  const invalidGraph = excludedCases.some((item) => item.exclusion_class === "INVALID_CASE_GRAPH");
  const invalidAvailability = excludedCases.some((item) => item.exclusion_class === "AVAILABILITY_ORDER_INVALID");
  const heterogeneous = deduplicatedEligible.length > 0
    && [modelCount, bundleCount, operatorCount, geometryCount, numericCount, residualPolicyCount].some((count) => count !== 1);

  let datasetStatus: Cap06DatasetQualificationStatusV2;
  if (invalidGraph) datasetStatus = "INVALID_CASE_GRAPH";
  else if (invalidAvailability) datasetStatus = "AVAILABILITY_ORDER_INVALID";
  else if (heterogeneous) datasetStatus = "CONFIG_OR_MODEL_HETEROGENEITY";
  else if (deduplicatedEligible.length < CAP06_REQUIRED_MATCHED_CASE_COUNT_V2) datasetStatus = "INSUFFICIENT_MATCHED_PAIRS";
  else datasetStatus = "READY_FOR_CALIBRATION_ASSESSMENT";

  const selected = datasetStatus === "READY_FOR_CALIBRATION_ASSESSMENT"
    ? deduplicatedEligible.slice(0, CAP06_REQUIRED_MATCHED_CASE_COUNT_V2)
    : [];
  const calibrationCases = selected.slice(0, CAP06_CALIBRATION_CASE_COUNT_V2);
  const holdoutCases = selected.slice(CAP06_CALIBRATION_CASE_COUNT_V2, CAP06_REQUIRED_MATCHED_CASE_COUNT_V2);
  if (selected.length === CAP06_REQUIRED_MATCHED_CASE_COUNT_V2) {
    const maxCalibrationTarget = Math.max(...calibrationCases.map((item) => canonicalInstantV2(item.forecast_target_time, "CAP06_CALIBRATION_TARGET_INVALID")));
    const minHoldoutTarget = Math.min(...holdoutCases.map((item) => canonicalInstantV2(item.forecast_target_time, "CAP06_HOLDOUT_TARGET_INVALID")));
    const maxCalibrationAvailability = Math.max(...calibrationCases.map((item) => canonicalInstantV2(item.observation_available_to_runtime_at, "CAP06_CALIBRATION_AVAILABILITY_INVALID")));
    const minHoldoutAvailability = Math.min(...holdoutCases.map((item) => canonicalInstantV2(item.observation_available_to_runtime_at, "CAP06_HOLDOUT_AVAILABILITY_INVALID")));
    if (!(maxCalibrationTarget < minHoldoutTarget && maxCalibrationAvailability < minHoldoutAvailability)) datasetStatus = "AVAILABILITY_ORDER_INVALID";
  }

  const limitations = [
    "STRUCTURAL_QUALIFICATION_ONLY_NO_PARAMETER_REPLAY_BY_S0",
    "NO_CALIBRATION_GRID_SEARCH_EXECUTED_BY_S0",
    "NO_CANDIDATE_OR_EVALUATION_CANONICALIZED",
  ];
  if (datasetStatus === "INSUFFICIENT_MATCHED_PAIRS") limitations.unshift("CURRENT_CANONICAL_HISTORY_CONTAINS_FEWER_THAN_24_ELIGIBLE_MATCHED_RESIDUAL_CASES");
  const basis = {
    source_scope: expectedScope,
    eligible_residual_refs: deduplicatedEligible.map((item) => item.residual_ref),
    excluded_cases: excludedCases,
    dataset_qualification_status: datasetStatus,
  };

  return {
    schema_version: "geox_mcft_cap_06_dataset_qualification_v2",
    qualification_id: `mcft_cap06_qualification_${semanticHashV1(basis).slice(7, 31)}`,
    source_scope: structuredClone(expectedScope),
    qualification_track: CAP06_REPOSITORY_HISTORY_TRACK_V2,
    case_graph_validation_status: invalidGraph ? "FAIL" : "PASS",
    dataset_qualification_status: datasetStatus,
    eligible_forecast_count: countDistinctV2(deduplicatedEligible.map((item) => item.forecast_ref)),
    eligible_observation_count: countDistinctV2(deduplicatedEligible.map((item) => item.observation_ref)),
    eligible_matched_pair_count: deduplicatedEligible.length,
    eligible_residual_count: deduplicatedEligible.length,
    eligible_calibration_count: datasetStatus === "READY_FOR_CALIBRATION_ASSESSMENT" ? CAP06_CALIBRATION_CASE_COUNT_V2 : 0,
    eligible_holdout_count: datasetStatus === "READY_FOR_CALIBRATION_ASSESSMENT" ? CAP06_HOLDOUT_CASE_COUNT_V2 : 0,
    calibration_window_refs: datasetStatus === "READY_FOR_CALIBRATION_ASSESSMENT" ? calibrationCases.map((item) => item.residual_ref) : [],
    holdout_window_refs: datasetStatus === "READY_FOR_CALIBRATION_ASSESSMENT" ? holdoutCases.map((item) => item.residual_ref) : [],
    model_component_hash_count: modelCount,
    effective_parameter_bundle_hash_count: bundleCount,
    observation_operator_hash_count: operatorCount,
    geometry_hash_count: geometryCount,
    runtime_replay_numeric_policy_hash_count: numericCount,
    residual_policy_hash_count: residualPolicyCount,
    eligible_cases: deduplicatedEligible,
    excluded_cases: excludedCases,
    qualification_limitations: limitations,
  };
}
