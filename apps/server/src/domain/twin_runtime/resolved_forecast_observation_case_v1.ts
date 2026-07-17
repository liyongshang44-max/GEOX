// apps/server/src/domain/twin_runtime/resolved_forecast_observation_case_v1.ts
// Purpose: validate and assemble one exact canonical CAP-05 Forecast-to-Observation graph into a reusable non-canonical CAP-06 calibration consumption view.
// Boundary: pure read-model assembly only; no repository search, persistence, projection write, calibration/shadow mathematics, State/checkpoint mutation, active-config mutation, Model Activation, route, scheduler, filesystem, environment, network, or canonical identity assignment.

import {
  formatFixedDecimalV1,
  parseFixedDecimalV1,
} from "../soil_water/fixed_point_water_decimal_v1.js";
import {
  semanticHashV1,
} from "./canonical_identity_v1.js";
import {
  validateCanonicalObjectV1,
  type CanonicalObjectEnvelopeV1,
} from "./canonical_object_contracts_v1.js";
import {
  validateCap04CanonicalForecastRunPayloadV1,
  type Cap04CanonicalCompletedForecastRunPayloadV1,
} from "./forecast_canonical_authority_v1.js";
import {
  resolveCap05ForecastPointMemberV1,
  validateCap05ForecastResidualV1,
  type Cap05ForecastResidualEnvelopeV1,
} from "./forecast_observation_residual_v1.js";
import type {
  ResolvedCap04ExecutionConfigV1,
} from "./runtime_config_execution_view_v1.js";
import type {
  Cap06CaseBuilderSourceV1,
} from "../calibration/case_builder_v1.js";

export const RESOLVED_FORECAST_OBSERVATION_CASE_SCHEMA_V1 =
  "geox_resolved_forecast_observation_case_v1" as const;
export const RESOLVED_FORECAST_OBSERVATION_CASE_ASSEMBLER_ID_V1 =
  "MCFT_CAP_06_EXACT_FORECAST_OBSERVATION_GRAPH_ASSEMBLER_V1" as const;

export type ResolvedObservationEvidenceV1 = {
  source_record_id: string;
  source_record_hash: string;
  observed_at: string;
  available_to_runtime_at: string;
  quality_status: "PASS" | "LIMITED";
  canonical_value: string | number;
  canonical_unit: "fraction";
  observation_variance: string | number;
  representativeness_variance: string | number;
  [key: string]: unknown;
};

export type ResolvedForecastObservationCaseInputV1 = {
  case_index: number;
  residual: Cap05ForecastResidualEnvelopeV1;
  source_forecast: CanonicalObjectEnvelopeV1;
  source_posterior: CanonicalObjectEnvelopeV1;
  source_forecast_evidence_window: CanonicalObjectEnvelopeV1;
  source_runtime_config: CanonicalObjectEnvelopeV1;
  resolved_execution_config: ResolvedCap04ExecutionConfigV1;
  actual_observation: ResolvedObservationEvidenceV1;
  assimilation_update: CanonicalObjectEnvelopeV1;
  observation_evidence_window: CanonicalObjectEnvelopeV1;
};

export type ResolvedForecastObservationCaseV1 = {
  schema_version: typeof RESOLVED_FORECAST_OBSERVATION_CASE_SCHEMA_V1;
  assembler_id: typeof RESOLVED_FORECAST_OBSERVATION_CASE_ASSEMBLER_ID_V1;
  canonical_identity_assigned: false;
  case_source: Cap06CaseBuilderSourceV1;
  residual: Cap05ForecastResidualEnvelopeV1;
  source_forecast: CanonicalObjectEnvelopeV1;
  source_forecast_point: Cap04CanonicalCompletedForecastRunPayloadV1["points"][number];
  source_posterior: CanonicalObjectEnvelopeV1;
  source_forecast_evidence_window: CanonicalObjectEnvelopeV1;
  source_runtime_config: CanonicalObjectEnvelopeV1;
  resolved_execution_config: ResolvedCap04ExecutionConfigV1;
  actual_observation: ResolvedObservationEvidenceV1;
  assimilation_update: CanonicalObjectEnvelopeV1;
  observation_evidence_window: CanonicalObjectEnvelopeV1;
  assembly_hash: string;
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

function fixed6V1(value: unknown, code: string): string {
  const text = typeof value === "number" ? String(value) : requiredStringV1(value, code);
  return formatFixedDecimalV1(parseFixedDecimalV1(text, 6, code), 6);
}

function addScale6V1(...values: string[]): string {
  return formatFixedDecimalV1(
    values.reduce((sum, value) => sum + parseFixedDecimalV1(value, 6), 0n),
    6,
  );
}

function subtractScale6V1(left: string, right: string): string {
  return formatFixedDecimalV1(
    parseFixedDecimalV1(left, 6) - parseFixedDecimalV1(right, 6),
    6,
  );
}

function recordV1(value: unknown, code: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
  return value as Record<string, unknown>;
}

function exactScopeV1(
  object: {
    tenant_id: string;
    project_id: string;
    group_id: string | null;
    field_id: string;
    season_id: string | null;
    zone_id: string | null;
  },
  residual: Cap05ForecastResidualEnvelopeV1,
  code: string,
): void {
  for (const field of [
    "tenant_id",
    "project_id",
    "group_id",
    "field_id",
    "season_id",
    "zone_id",
  ] as const) {
    if (object[field] !== residual[field]) throw new Error(`${code}:${field}`);
  }
}

function exactCanonicalV1(
  object: CanonicalObjectEnvelopeV1,
  type: string,
  ref: string,
  hash: string,
  residual: Cap05ForecastResidualEnvelopeV1,
  code: string,
): void {
  validateCanonicalObjectV1(object);
  if (object.object_type !== type
    || object.object_id !== ref
    || object.determinism_hash !== hash) {
    throw new Error(code);
  }
  exactScopeV1(object, residual, `${code}_SCOPE`);
}

function exactContextV1(
  object: CanonicalObjectEnvelopeV1,
  lineageRef: string,
  revisionRef: string,
  code: string,
): void {
  if (object.lineage_id !== lineageRef || object.revision_id !== revisionRef) {
    throw new Error(code);
  }
}

function observationHashV1(observation: ResolvedObservationEvidenceV1): string {
  return requiredStringV1(
    observation.source_record_hash,
    "CAP06_GRAPH_OBSERVATION_HASH_REQUIRED",
  );
}

function buildCaseInputHashV1(input: {
  residual: Cap05ForecastResidualEnvelopeV1;
  source_forecast: CanonicalObjectEnvelopeV1;
  source_forecast_point_hash: string;
  source_posterior: CanonicalObjectEnvelopeV1;
  source_forecast_evidence_window: CanonicalObjectEnvelopeV1;
  source_runtime_config: CanonicalObjectEnvelopeV1;
  resolved_execution_config: ResolvedCap04ExecutionConfigV1;
  actual_observation: ResolvedObservationEvidenceV1;
  assimilation_update: CanonicalObjectEnvelopeV1;
  observation_evidence_window: CanonicalObjectEnvelopeV1;
}): string {
  return semanticHashV1({
    residual_ref: input.residual.object_id,
    residual_hash: input.residual.determinism_hash,
    source_forecast_ref: input.source_forecast.object_id,
    source_forecast_hash: input.source_forecast.determinism_hash,
    source_forecast_point_hash: input.source_forecast_point_hash,
    source_posterior_ref: input.source_posterior.object_id,
    source_posterior_hash: input.source_posterior.determinism_hash,
    source_forecast_evidence_window_ref: input.source_forecast_evidence_window.object_id,
    source_forecast_evidence_window_hash: input.source_forecast_evidence_window.determinism_hash,
    source_runtime_config_ref: input.source_runtime_config.object_id,
    source_runtime_config_hash: input.source_runtime_config.determinism_hash,
    execution_payload: input.resolved_execution_config.payload,
    actual_observation_ref: input.actual_observation.source_record_id,
    actual_observation_hash: observationHashV1(input.actual_observation),
    assimilation_update_ref: input.assimilation_update.object_id,
    assimilation_update_hash: input.assimilation_update.determinism_hash,
    observation_evidence_window_ref: input.observation_evidence_window.object_id,
    observation_evidence_window_hash: input.observation_evidence_window.determinism_hash,
  });
}

export function assembleResolvedForecastObservationCaseV1(
  input: ResolvedForecastObservationCaseInputV1,
): ResolvedForecastObservationCaseV1 {
  if (!Number.isInteger(input.case_index) || input.case_index < 0) {
    throw new Error("CAP06_GRAPH_CASE_INDEX_INVALID");
  }
  validateCap05ForecastResidualV1(input.residual);
  const residualPayload = input.residual.payload;
  const lineageRef = requiredStringV1(
    input.residual.context_lineage_ref,
    "CAP06_GRAPH_CONTEXT_LINEAGE_REQUIRED",
  );
  const revisionRef = requiredStringV1(
    input.residual.context_revision_ref,
    "CAP06_GRAPH_CONTEXT_REVISION_REQUIRED",
  );

  exactCanonicalV1(
    input.source_forecast,
    "twin_forecast_run_v1",
    residualPayload.forecast_run_ref,
    residualPayload.forecast_run_hash,
    input.residual,
    "CAP06_GRAPH_FORECAST_MISMATCH",
  );
  exactContextV1(input.source_forecast, lineageRef, revisionRef, "CAP06_GRAPH_FORECAST_CONTEXT_MISMATCH");
  const forecastPayload = input.source_forecast.payload as unknown as Cap04CanonicalCompletedForecastRunPayloadV1;
  validateCap04CanonicalForecastRunPayloadV1(forecastPayload);
  if (forecastPayload.status !== "COMPLETED") throw new Error("CAP06_GRAPH_COMPLETED_FORECAST_REQUIRED");
  if (forecastPayload.issued_at !== residualPayload.forecast_issued_at) {
    throw new Error("CAP06_GRAPH_FORECAST_ISSUED_TIME_MISMATCH");
  }
  const forecastPoint = resolveCap05ForecastPointMemberV1({
    forecast_run_ref: input.source_forecast.object_id,
    forecast_issued_at: forecastPayload.issued_at,
    forecast_points: forecastPayload.points,
    forecast_point_ref: residualPayload.forecast_point_ref,
  });
  if (forecastPoint.determinism_hash !== residualPayload.forecast_point_hash
    || forecastPoint.target_time !== residualPayload.forecast_target_time) {
    throw new Error("CAP06_GRAPH_FORECAST_POINT_MISMATCH");
  }

  exactCanonicalV1(
    input.source_posterior,
    "twin_state_estimate_v1",
    forecastPayload.source_posterior_ref,
    forecastPayload.source_posterior_hash,
    input.residual,
    "CAP06_GRAPH_SOURCE_POSTERIOR_MISMATCH",
  );
  exactContextV1(input.source_posterior, lineageRef, revisionRef, "CAP06_GRAPH_SOURCE_POSTERIOR_CONTEXT_MISMATCH");
  const posteriorPayload = recordV1(
    input.source_posterior.payload,
    "CAP06_GRAPH_SOURCE_POSTERIOR_PAYLOAD_REQUIRED",
  );
  const forecastEvidenceRef = requiredStringV1(
    posteriorPayload.evidence_window_ref,
    "CAP06_GRAPH_FORECAST_EVIDENCE_WINDOW_REF_REQUIRED",
  );
  validateCanonicalObjectV1(input.source_forecast_evidence_window);
  if (input.source_forecast_evidence_window.object_type !== "twin_evidence_window_v1"
    || input.source_forecast_evidence_window.object_id !== forecastEvidenceRef) {
    throw new Error("CAP06_GRAPH_FORECAST_EVIDENCE_WINDOW_MISMATCH");
  }
  exactScopeV1(
    input.source_forecast_evidence_window,
    input.residual,
    "CAP06_GRAPH_FORECAST_EVIDENCE_WINDOW_SCOPE_MISMATCH",
  );
  exactContextV1(
    input.source_forecast_evidence_window,
    lineageRef,
    revisionRef,
    "CAP06_GRAPH_FORECAST_EVIDENCE_WINDOW_CONTEXT_MISMATCH",
  );

  exactCanonicalV1(
    input.source_runtime_config,
    "twin_runtime_config_v1",
    residualPayload.runtime_config_ref,
    residualPayload.runtime_config_hash,
    input.residual,
    "CAP06_GRAPH_RUNTIME_CONFIG_MISMATCH",
  );
  if (forecastPayload.runtime_config_ref !== input.source_runtime_config.object_id
    || forecastPayload.runtime_config_hash !== input.source_runtime_config.determinism_hash) {
    throw new Error("CAP06_GRAPH_FORECAST_RUNTIME_CONFIG_MISMATCH");
  }
  if (input.resolved_execution_config.source_config_ref !== input.source_runtime_config.object_id
    || input.resolved_execution_config.source_config_hash !== input.source_runtime_config.determinism_hash) {
    throw new Error("CAP06_GRAPH_EXECUTION_CONFIG_SOURCE_MISMATCH");
  }
  const executionPayload = input.resolved_execution_config.payload;

  const observation = input.actual_observation;
  if (requiredStringV1(observation.source_record_id, "CAP06_GRAPH_OBSERVATION_REF_REQUIRED")
      !== residualPayload.actual_observation_ref
    || observationHashV1(observation) !== residualPayload.actual_observation_hash) {
    throw new Error("CAP06_GRAPH_OBSERVATION_IDENTITY_MISMATCH");
  }
  const observationObservedAt = exactInstantV1(
    observation.observed_at,
    "CAP06_GRAPH_OBSERVATION_OBSERVED_AT_INVALID",
  );
  const observationAvailableAt = exactInstantV1(
    observation.available_to_runtime_at,
    "CAP06_GRAPH_OBSERVATION_AVAILABLE_AT_INVALID",
  );
  if (observationObservedAt !== residualPayload.actual_observation_observed_at
    || observationObservedAt !== residualPayload.forecast_target_time
    || observationAvailableAt !== residualPayload.observation_available_to_runtime_at
    || Date.parse(observationAvailableAt) < Date.parse(observationObservedAt)) {
    throw new Error("CAP06_GRAPH_OBSERVATION_DUAL_TIME_MISMATCH");
  }
  if (observation.quality_status !== residualPayload.actual_observation_quality
    || observation.canonical_unit !== "fraction"
    || fixed6V1(observation.canonical_value, "CAP06_GRAPH_OBSERVATION_VALUE_INVALID")
      !== residualPayload.actual_observation_value) {
    throw new Error("CAP06_GRAPH_OBSERVATION_SEMANTICS_MISMATCH");
  }

  const assimilationRef = requiredStringV1(
    residualPayload.assimilation_update_ref,
    "CAP06_GRAPH_ASSIMILATION_REF_REQUIRED",
  );
  const assimilationHash = requiredStringV1(
    residualPayload.assimilation_update_hash,
    "CAP06_GRAPH_ASSIMILATION_HASH_REQUIRED",
  );
  exactCanonicalV1(
    input.assimilation_update,
    "twin_assimilation_update_v1",
    assimilationRef,
    assimilationHash,
    input.residual,
    "CAP06_GRAPH_ASSIMILATION_MISMATCH",
  );
  const assimilationPayload = recordV1(
    input.assimilation_update.payload,
    "CAP06_GRAPH_ASSIMILATION_PAYLOAD_REQUIRED",
  );
  if (assimilationPayload.selected_observation_ref !== observation.source_record_id
    || assimilationPayload.selected_observation_hash !== observation.source_record_hash
    || assimilationPayload.model_parameter_change_applied !== false) {
    throw new Error("CAP06_GRAPH_ASSIMILATION_OBSERVATION_MISMATCH");
  }
  const observationEvidenceRef = requiredStringV1(
    assimilationPayload.evidence_window_ref,
    "CAP06_GRAPH_OBSERVATION_EVIDENCE_WINDOW_REF_REQUIRED",
  );
  const observationEvidenceHash = requiredStringV1(
    assimilationPayload.evidence_window_hash,
    "CAP06_GRAPH_OBSERVATION_EVIDENCE_WINDOW_HASH_REQUIRED",
  );
  exactCanonicalV1(
    input.observation_evidence_window,
    "twin_evidence_window_v1",
    observationEvidenceRef,
    observationEvidenceHash,
    input.residual,
    "CAP06_GRAPH_OBSERVATION_EVIDENCE_WINDOW_MISMATCH",
  );
  const observationWindowPayload = recordV1(
    input.observation_evidence_window.payload,
    "CAP06_GRAPH_OBSERVATION_EVIDENCE_WINDOW_PAYLOAD_REQUIRED",
  );
  const selection = recordV1(
    observationWindowPayload.observation_selection,
    "CAP06_GRAPH_OBSERVATION_SELECTION_REQUIRED",
  );
  if (selection.selected_observation_ref !== observation.source_record_id
    || selection.selected_observation_hash !== observation.source_record_hash) {
    throw new Error("CAP06_GRAPH_OBSERVATION_SELECTION_MISMATCH");
  }

  const forecastAsOf = exactInstantV1(
    input.source_forecast.as_of,
    "CAP06_GRAPH_FORECAST_AS_OF_INVALID",
  );
  const forecastEvidenceCutoff = exactInstantV1(
    input.source_forecast_evidence_window.as_of,
    "CAP06_GRAPH_FORECAST_EVIDENCE_CUTOFF_INVALID",
  );
  if (Date.parse(forecastEvidenceCutoff) > Date.parse(forecastAsOf)
    || Date.parse(forecastAsOf) >= Date.parse(observationAvailableAt)
    || Date.parse(residualPayload.forecast_issued_at) >= Date.parse(observationAvailableAt)
    || Date.parse(input.observation_evidence_window.as_of) > Date.parse(observationAvailableAt)
    || Date.parse(input.assimilation_update.as_of) > Date.parse(observationAvailableAt)) {
    throw new Error("CAP06_GRAPH_FUTURE_LEAKAGE_DETECTED");
  }

  const fieldCapacity = fixed6V1(
    executionPayload.soil_hydraulic_snapshot.field_capacity_storage_mm,
    "CAP06_GRAPH_FIELD_CAPACITY_REQUIRED",
  );
  const saturation = fixed6V1(
    executionPayload.soil_hydraulic_snapshot.saturation_storage_mm,
    "CAP06_GRAPH_SATURATION_REQUIRED",
  );
  const storageBeforeDrainage = addScale6V1(
    forecastPoint.storage_mean_mm,
    forecastPoint.drainage_mm,
    forecastPoint.saturation_overflow_mm,
  );
  const excessAboveFieldCapacity = subtractScale6V1(storageBeforeDrainage, fieldCapacity);
  const saturationMinusFieldCapacity = subtractScale6V1(saturation, fieldCapacity);

  const modelComponentHash = semanticHashV1({
    model_component_refs: executionPayload.model_component_refs,
  });
  const effectiveParameterBundleHash = semanticHashV1({
    soil_hydraulic_snapshot: executionPayload.soil_hydraulic_snapshot,
    dynamics_parameters: executionPayload.dynamics_parameters,
  });
  const observationOperatorHash = semanticHashV1(
    executionPayload.observation_assimilation.observation_operator,
  );
  const runtimeReplayNumericPolicyHash = semanticHashV1({
    decimal_scale_policy_id: executionPayload.decimal_scale_policy_id,
    rounding_policy_id: executionPayload.rounding_policy_id,
    water_amount_scale: 6,
    water_variance_scale: 12,
  });

  const caseInputHash = buildCaseInputHashV1({
    residual: input.residual,
    source_forecast: input.source_forecast,
    source_forecast_point_hash: forecastPoint.determinism_hash,
    source_posterior: input.source_posterior,
    source_forecast_evidence_window: input.source_forecast_evidence_window,
    source_runtime_config: input.source_runtime_config,
    resolved_execution_config: input.resolved_execution_config,
    actual_observation: observation,
    assimilation_update: input.assimilation_update,
    observation_evidence_window: input.observation_evidence_window,
  });

  const caseSource: Cap06CaseBuilderSourceV1 = {
    case_index: input.case_index,
    scope: {
      tenant_id: input.residual.tenant_id,
      project_id: input.residual.project_id,
      group_id: requiredStringV1(input.residual.group_id, "CAP06_GRAPH_SCOPE_GROUP_REQUIRED"),
      field_id: input.residual.field_id,
      season_id: requiredStringV1(input.residual.season_id, "CAP06_GRAPH_SCOPE_SEASON_REQUIRED"),
      zone_id: requiredStringV1(input.residual.zone_id, "CAP06_GRAPH_SCOPE_ZONE_REQUIRED"),
    },
    residual_ref: input.residual.object_id,
    residual_hash: input.residual.determinism_hash,
    source_forecast_ref: input.source_forecast.object_id,
    source_forecast_hash: input.source_forecast.determinism_hash,
    source_forecast_point_ref: residualPayload.forecast_point_ref,
    source_forecast_point_hash: forecastPoint.determinism_hash,
    source_posterior_ref: input.source_posterior.object_id,
    source_posterior_hash: input.source_posterior.determinism_hash,
    source_runtime_config_ref: input.source_runtime_config.object_id,
    source_runtime_config_hash: input.source_runtime_config.determinism_hash,
    source_runtime_config_logical_time: input.source_runtime_config.logical_time,
    actual_observation_ref: observation.source_record_id,
    actual_observation_hash: observation.source_record_hash,
    forecast_issued_at: residualPayload.forecast_issued_at,
    forecast_as_of: forecastAsOf,
    forecast_evidence_cutoff: forecastEvidenceCutoff,
    forecast_target_time: residualPayload.forecast_target_time,
    observation_observed_at: observationObservedAt,
    observation_available_to_runtime_at: observationAvailableAt,
    actual_observation_vwc: residualPayload.actual_observation_value,
    base_prediction_vwc: residualPayload.predicted_observation_value,
    excess_above_field_capacity_mm: excessAboveFieldCapacity,
    saturation_minus_field_capacity_mm: saturationMinusFieldCapacity,
    context_lineage_ref: lineageRef,
    context_revision_ref: revisionRef,
    model_component_hash: modelComponentHash,
    effective_parameter_bundle_hash: effectiveParameterBundleHash,
    observation_operator_hash: observationOperatorHash,
    geometry_hash: executionPayload.reality_binding_hash,
    runtime_replay_numeric_policy_hash: runtimeReplayNumericPolicyHash,
    case_input_hash: caseInputHash,
  };

  const assemblyBasis = {
    schema_version: RESOLVED_FORECAST_OBSERVATION_CASE_SCHEMA_V1,
    assembler_id: RESOLVED_FORECAST_OBSERVATION_CASE_ASSEMBLER_ID_V1,
    canonical_identity_assigned: false as const,
    case_source: caseSource,
  };

  return {
    ...assemblyBasis,
    residual: structuredClone(input.residual),
    source_forecast: structuredClone(input.source_forecast),
    source_forecast_point: structuredClone(forecastPoint),
    source_posterior: structuredClone(input.source_posterior),
    source_forecast_evidence_window: structuredClone(input.source_forecast_evidence_window),
    source_runtime_config: structuredClone(input.source_runtime_config),
    resolved_execution_config: structuredClone(input.resolved_execution_config),
    actual_observation: structuredClone(observation),
    assimilation_update: structuredClone(input.assimilation_update),
    observation_evidence_window: structuredClone(input.observation_evidence_window),
    assembly_hash: semanticHashV1(assemblyBasis),
  };
}
