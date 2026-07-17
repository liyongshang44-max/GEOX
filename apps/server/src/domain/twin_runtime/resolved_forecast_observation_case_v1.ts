// apps/server/src/domain/twin_runtime/resolved_forecast_observation_case_v1.ts
// Purpose: validate and assemble one exact canonical CAP-05 Forecast-to-Observation graph into a reusable non-canonical CAP-06 calibration consumption view.
// Boundary: pure read-model assembly only; no repository search, persistence, projection write, calibration/shadow mathematics, State/checkpoint mutation, active-config mutation, Model Activation, route, scheduler, filesystem, environment, network, or canonical identity assignment.

import {
  formatFixedDecimalV1,
  parseFixedDecimalV1,
} from "../soil_water/fixed_point_water_decimal_v1.js";
import { semanticHashV1 } from "./canonical_identity_v1.js";
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
import type { ResolvedCap04ExecutionConfigV1 } from "./runtime_config_execution_view_v1.js";
import type { Cap06CaseBuilderSourceV1 } from "../calibration/case_builder_v1.js";

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
  observation_posterior: CanonicalObjectEnvelopeV1;
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
  observation_posterior: CanonicalObjectEnvelopeV1;
  observation_evidence_window: CanonicalObjectEnvelopeV1;
  assembly_hash: string;
};

function requiredStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

function recordV1(value: unknown, code: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
  return value as Record<string, unknown>;
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

function exactScopeV1(
  object: Pick<CanonicalObjectEnvelopeV1, "tenant_id" | "project_id" | "group_id" | "field_id" | "season_id" | "zone_id">,
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

function validateExactCanonicalV1(input: {
  object: CanonicalObjectEnvelopeV1;
  type: string;
  residual: Cap05ForecastResidualEnvelopeV1;
  code: string;
  ref?: string;
  hash?: string;
  lineage?: string;
  revision?: string;
}): void {
  validateCanonicalObjectV1(input.object);
  if (input.object.object_type !== input.type
    || (input.ref !== undefined && input.object.object_id !== input.ref)
    || (input.hash !== undefined && input.object.determinism_hash !== input.hash)) {
    throw new Error(input.code);
  }
  exactScopeV1(input.object, input.residual, `${input.code}_SCOPE`);
  if ((input.lineage !== undefined && input.object.lineage_id !== input.lineage)
    || (input.revision !== undefined && input.object.revision_id !== input.revision)) {
    throw new Error(`${input.code}_CONTEXT`);
  }
}

function buildCaseInputHashV1(input: ResolvedForecastObservationCaseInputV1 & {
  source_forecast_point_hash: string;
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
    actual_observation_hash: input.actual_observation.source_record_hash,
    assimilation_update_ref: input.assimilation_update.object_id,
    assimilation_update_hash: input.assimilation_update.determinism_hash,
    observation_posterior_ref: input.observation_posterior.object_id,
    observation_posterior_hash: input.observation_posterior.determinism_hash,
    observation_evidence_window_ref: input.observation_evidence_window.object_id,
    observation_evidence_window_hash: input.observation_evidence_window.determinism_hash,
  });
}

export function assembleResolvedForecastObservationCaseV1(
  input: ResolvedForecastObservationCaseInputV1,
): ResolvedForecastObservationCaseV1 {
  if (!Number.isSafeInteger(input.case_index) || input.case_index < 0) {
    throw new Error("CAP06_GRAPH_CASE_INDEX_INVALID");
  }
  validateCap05ForecastResidualV1(input.residual);
  const residual = input.residual.payload;
  const lineage = requiredStringV1(
    input.residual.context_lineage_ref,
    "CAP06_GRAPH_CONTEXT_LINEAGE_REQUIRED",
  );
  const revision = requiredStringV1(
    input.residual.context_revision_ref,
    "CAP06_GRAPH_CONTEXT_REVISION_REQUIRED",
  );

  validateExactCanonicalV1({
    object: input.source_forecast,
    type: "twin_forecast_run_v1",
    ref: residual.forecast_run_ref,
    hash: residual.forecast_run_hash,
    residual: input.residual,
    lineage,
    revision,
    code: "CAP06_GRAPH_FORECAST_MISMATCH",
  });
  const forecastPayload = input.source_forecast.payload as unknown as Cap04CanonicalCompletedForecastRunPayloadV1;
  validateCap04CanonicalForecastRunPayloadV1(forecastPayload);
  if (forecastPayload.status !== "COMPLETED"
    || forecastPayload.issued_at !== residual.forecast_issued_at) {
    throw new Error("CAP06_GRAPH_COMPLETED_FORECAST_MISMATCH");
  }
  const forecastPoint = resolveCap05ForecastPointMemberV1({
    forecast_run_ref: input.source_forecast.object_id,
    forecast_issued_at: forecastPayload.issued_at,
    forecast_points: forecastPayload.points,
    forecast_point_ref: residual.forecast_point_ref,
  });
  if (forecastPoint.determinism_hash !== residual.forecast_point_hash
    || forecastPoint.target_time !== residual.forecast_target_time) {
    throw new Error("CAP06_GRAPH_FORECAST_POINT_MISMATCH");
  }

  validateExactCanonicalV1({
    object: input.source_posterior,
    type: "twin_state_estimate_v1",
    ref: forecastPayload.source_posterior_ref,
    hash: forecastPayload.source_posterior_hash,
    residual: input.residual,
    lineage,
    revision,
    code: "CAP06_GRAPH_SOURCE_POSTERIOR_MISMATCH",
  });
  const sourcePosteriorPayload = recordV1(
    input.source_posterior.payload,
    "CAP06_GRAPH_SOURCE_POSTERIOR_PAYLOAD_REQUIRED",
  );
  validateExactCanonicalV1({
    object: input.source_forecast_evidence_window,
    type: "twin_evidence_window_v1",
    ref: requiredStringV1(
      sourcePosteriorPayload.evidence_window_ref,
      "CAP06_GRAPH_FORECAST_EVIDENCE_REF_REQUIRED",
    ),
    residual: input.residual,
    lineage,
    revision,
    code: "CAP06_GRAPH_FORECAST_EVIDENCE_WINDOW_MISMATCH",
  });

  validateExactCanonicalV1({
    object: input.source_runtime_config,
    type: "twin_runtime_config_v1",
    ref: residual.runtime_config_ref,
    hash: residual.runtime_config_hash,
    residual: input.residual,
    code: "CAP06_GRAPH_RUNTIME_CONFIG_MISMATCH",
  });
  if (forecastPayload.runtime_config_ref !== input.source_runtime_config.object_id
    || forecastPayload.runtime_config_hash !== input.source_runtime_config.determinism_hash
    || input.resolved_execution_config.source_config_ref !== input.source_runtime_config.object_id
    || input.resolved_execution_config.source_config_hash !== input.source_runtime_config.determinism_hash) {
    throw new Error("CAP06_GRAPH_EXECUTION_CONFIG_SOURCE_MISMATCH");
  }

  const observation = input.actual_observation;
  if (requiredStringV1(observation.source_record_id, "CAP06_GRAPH_OBSERVATION_REF_REQUIRED")
      !== residual.actual_observation_ref
    || requiredStringV1(observation.source_record_hash, "CAP06_GRAPH_OBSERVATION_HASH_REQUIRED")
      !== residual.actual_observation_hash) {
    throw new Error("CAP06_GRAPH_OBSERVATION_IDENTITY_MISMATCH");
  }
  const observedAt = exactInstantV1(
    observation.observed_at,
    "CAP06_GRAPH_OBSERVATION_OBSERVED_AT_INVALID",
  );
  const availableAt = exactInstantV1(
    observation.available_to_runtime_at,
    "CAP06_GRAPH_OBSERVATION_AVAILABLE_AT_INVALID",
  );
  if (observedAt !== residual.actual_observation_observed_at
    || observedAt !== residual.forecast_target_time
    || availableAt !== residual.observation_available_to_runtime_at
    || Date.parse(availableAt) < Date.parse(observedAt)
    || observation.quality_status !== residual.actual_observation_quality
    || observation.canonical_unit !== "fraction"
    || fixed6V1(observation.canonical_value, "CAP06_GRAPH_OBSERVATION_VALUE_INVALID")
      !== residual.actual_observation_value) {
    throw new Error("CAP06_GRAPH_OBSERVATION_SEMANTICS_MISMATCH");
  }

  validateExactCanonicalV1({
    object: input.assimilation_update,
    type: "twin_assimilation_update_v1",
    ref: requiredStringV1(residual.assimilation_update_ref, "CAP06_GRAPH_ASSIMILATION_REF_REQUIRED"),
    hash: requiredStringV1(residual.assimilation_update_hash, "CAP06_GRAPH_ASSIMILATION_HASH_REQUIRED"),
    residual: input.residual,
    code: "CAP06_GRAPH_ASSIMILATION_MISMATCH",
  });
  const assimilationPayload = recordV1(
    input.assimilation_update.payload,
    "CAP06_GRAPH_ASSIMILATION_PAYLOAD_REQUIRED",
  );
  if (assimilationPayload.selected_observation_ref !== observation.source_record_id
    || assimilationPayload.model_parameter_change_applied !== false) {
    throw new Error("CAP06_GRAPH_ASSIMILATION_OBSERVATION_MISMATCH");
  }

  validateExactCanonicalV1({
    object: input.observation_posterior,
    type: "twin_state_estimate_v1",
    ref: requiredStringV1(
      assimilationPayload.posterior_state_ref,
      "CAP06_GRAPH_OBSERVATION_POSTERIOR_REF_REQUIRED",
    ),
    residual: input.residual,
    code: "CAP06_GRAPH_OBSERVATION_POSTERIOR_MISMATCH",
  });
  const observationPosteriorPayload = recordV1(
    input.observation_posterior.payload,
    "CAP06_GRAPH_OBSERVATION_POSTERIOR_PAYLOAD_REQUIRED",
  );
  if (observationPosteriorPayload.assimilation_update_ref !== input.assimilation_update.object_id) {
    throw new Error("CAP06_GRAPH_OBSERVATION_POSTERIOR_ASSIMILATION_MISMATCH");
  }
  validateExactCanonicalV1({
    object: input.observation_evidence_window,
    type: "twin_evidence_window_v1",
    ref: requiredStringV1(
      observationPosteriorPayload.evidence_window_ref,
      "CAP06_GRAPH_OBSERVATION_EVIDENCE_REF_REQUIRED",
    ),
    residual: input.residual,
    code: "CAP06_GRAPH_OBSERVATION_EVIDENCE_WINDOW_MISMATCH",
  });
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

  const forecastAsOf = exactInstantV1(input.source_forecast.as_of, "CAP06_GRAPH_FORECAST_AS_OF_INVALID");
  const forecastEvidenceCutoff = exactInstantV1(
    input.source_forecast_evidence_window.as_of,
    "CAP06_GRAPH_FORECAST_EVIDENCE_CUTOFF_INVALID",
  );
  if (Date.parse(forecastEvidenceCutoff) > Date.parse(forecastAsOf)
    || Date.parse(forecastAsOf) >= Date.parse(availableAt)
    || Date.parse(residual.forecast_issued_at) >= Date.parse(availableAt)
    || Date.parse(input.observation_evidence_window.as_of) > Date.parse(availableAt)
    || Date.parse(input.assimilation_update.as_of) > Date.parse(availableAt)
    || Date.parse(input.observation_posterior.as_of) > Date.parse(availableAt)) {
    throw new Error("CAP06_GRAPH_FUTURE_LEAKAGE_DETECTED");
  }

  const execution = input.resolved_execution_config.payload;
  const fieldCapacity = fixed6V1(
    execution.soil_hydraulic_snapshot.field_capacity_storage_mm,
    "CAP06_GRAPH_FIELD_CAPACITY_REQUIRED",
  );
  const saturation = fixed6V1(
    execution.soil_hydraulic_snapshot.saturation_storage_mm,
    "CAP06_GRAPH_SATURATION_REQUIRED",
  );
  const storageBeforeDrainage = add6V1(
    forecastPoint.storage_mean_mm,
    forecastPoint.drainage_mm,
    forecastPoint.saturation_overflow_mm,
  );
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
    source_forecast_point_ref: residual.forecast_point_ref,
    source_forecast_point_hash: forecastPoint.determinism_hash,
    source_posterior_ref: input.source_posterior.object_id,
    source_posterior_hash: input.source_posterior.determinism_hash,
    source_runtime_config_ref: input.source_runtime_config.object_id,
    source_runtime_config_hash: input.source_runtime_config.determinism_hash,
    source_runtime_config_logical_time: input.source_runtime_config.logical_time,
    actual_observation_ref: observation.source_record_id,
    actual_observation_hash: observation.source_record_hash,
    forecast_issued_at: residual.forecast_issued_at,
    forecast_as_of: forecastAsOf,
    forecast_evidence_cutoff: forecastEvidenceCutoff,
    forecast_target_time: residual.forecast_target_time,
    observation_observed_at: observedAt,
    observation_available_to_runtime_at: availableAt,
    actual_observation_vwc: residual.actual_observation_value,
    base_prediction_vwc: residual.predicted_observation_value,
    excess_above_field_capacity_mm: subtract6V1(storageBeforeDrainage, fieldCapacity),
    saturation_minus_field_capacity_mm: subtract6V1(saturation, fieldCapacity),
    context_lineage_ref: lineage,
    context_revision_ref: revision,
    model_component_hash: semanticHashV1({ model_component_refs: execution.model_component_refs }),
    effective_parameter_bundle_hash: semanticHashV1({
      soil_hydraulic_snapshot: execution.soil_hydraulic_snapshot,
      dynamics_parameters: execution.dynamics_parameters,
    }),
    observation_operator_hash: semanticHashV1(
      execution.observation_assimilation.observation_operator,
    ),
    geometry_hash: execution.reality_binding_hash,
    runtime_replay_numeric_policy_hash: semanticHashV1({
      decimal_scale_policy_id: execution.decimal_scale_policy_id,
      rounding_policy_id: execution.rounding_policy_id,
      water_amount_scale: 6,
      water_variance_scale: 12,
    }),
    case_input_hash: buildCaseInputHashV1({
      ...input,
      source_forecast_point_hash: forecastPoint.determinism_hash,
    }),
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
    observation_posterior: structuredClone(input.observation_posterior),
    observation_evidence_window: structuredClone(input.observation_evidence_window),
    assembly_hash: semanticHashV1(assemblyBasis),
  };
}
