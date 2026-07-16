// apps/server/src/persistence/twin_runtime/postgres_cap06_repository_history_case_graph_reader_v1.ts
// Purpose: resolve each canonical Forecast Residual into the exact MCFT-CAP-06 S0 qualification graph using append-only facts and canonical A-record-set references.
// Boundary: read-only PostgreSQL adapter only; no fact append, projection mutation, Runtime execution, parameter replay, Candidate, Evaluation, Model Activation, active-config switch, route, Web, scheduler, or CAP-07 authority.

import type { Pool, PoolClient } from "pg";
import { computeMemberDeterminismHashV1 } from "../../domain/twin_runtime/canonical_identity_v1.js";
import type { CanonicalObjectEnvelopeV1 } from "../../domain/twin_runtime/canonical_object_contracts_v1.js";
import {
  validateCap04CanonicalForecastRunPayloadV1,
  type Cap04CanonicalCompletedForecastRunPayloadV1,
} from "../../domain/twin_runtime/forecast_canonical_authority_v1.js";
import { computeCap04AMemberDeterminismHashV1 } from "../../domain/twin_runtime/forecast_scenario_member_hash_v1.js";
import {
  buildCap05ForecastPointMemberRefV1,
  validateCap05ForecastResidualV1,
  type Cap05ForecastResidualEnvelopeV1,
} from "../../domain/twin_runtime/forecast_observation_residual_v1.js";
import {
  validateCap05RuntimeConfigPayloadV1,
  type Cap05RuntimeConfigPayloadV1,
} from "../../domain/twin_runtime/feedback_runtime_config_v1.js";
import type {
  Cap06ResolvedCaseGraphV1,
  Cap06ScopeV1,
} from "../../domain/twin_runtime/calibration_case_graph_qualification_v1.js";

function requiredStringV1(value: unknown, code: string): string {
  // Reject absent or blank semantic authorities before any graph relation is evaluated.
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

function requiredRecordV1(value: unknown, code: string): Record<string, unknown> {
  // Canonical payload traversal is allowed only through non-array objects.
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
  return value as Record<string, unknown>;
}

function requiredArrayV1(value: unknown, code: string): unknown[] {
  // Cardinality-sensitive graph fields must be arrays, never scalar coercions.
  if (!Array.isArray(value)) throw new Error(code);
  return value;
}

function canonicalInstantV1(value: unknown, code: string): string {
  // Preserve exact canonical ISO text rather than normalizing ambiguous timestamps.
  const text = requiredStringV1(value, code);
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== text) throw new Error(code);
  return text;
}

function parseFactPayloadV1(value: unknown, code: string): Record<string, unknown> {
  // Facts remain opaque at storage level; this adapter explicitly opens only the canonical payload envelope.
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  const envelope = requiredRecordV1(parsed, code);
  return requiredRecordV1(envelope.payload, code);
}

function exactScopeV1(object: Record<string, unknown>, expected: Cap06ScopeV1, code: string): void {
  // Qualification scope is the complete frozen six-part scope.
  for (const field of ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"] as const) {
    if (object[field] !== expected[field]) throw new Error(`${code}:${field}`);
  }
}

function exactContextV1(object: Record<string, unknown>, lineageId: string, revisionId: string, code: string): void {
  // Canonical A-record-set members use lineage_id/revision_id while Residuals expose context refs separately.
  if (object.lineage_id !== lineageId || object.revision_id !== revisionId) throw new Error(code);
}

function exactCap04MemberHashV1(object: CanonicalObjectEnvelopeV1, code: string): void {
  // CAP-04 A members use the CAP-04 non-recursive member-hash authority, not the A0 hash function.
  if (computeCap04AMemberDeterminismHashV1(object) !== object.determinism_hash) throw new Error(code);
}

function exactStandardObjectHashV1(object: Record<string, unknown>, code: string): void {
  // Runtime Config and C Residual identities use the standard semantic member hash.
  if (computeMemberDeterminismHashV1(object) !== object.determinism_hash) throw new Error(code);
}

function selectedRecordByRefV1(
  evidenceWindow: CanonicalObjectEnvelopeV1,
  ref: string,
  role: string,
  code: string,
): Record<string, unknown> {
  // Evidence snapshot refs must resolve to exactly one selected record with the expected semantic role.
  const selected = requiredArrayV1(evidenceWindow.payload.selected_records, `${code}:SELECTED_RECORDS_REQUIRED`)
    .map((value) => requiredRecordV1(value, `${code}:SELECTED_RECORD_INVALID`))
    .filter((value) => value.source_record_id === ref && value.role === role);
  if (selected.length !== 1) throw new Error(`${code}:CARDINALITY`);
  return selected[0];
}

function selectedObservationV1(evidenceWindow: CanonicalObjectEnvelopeV1): Record<string, unknown> {
  // The outcome Observation authority is the exact selected observation frozen inside the current canonical Evidence Window.
  const selection = requiredRecordV1(
    evidenceWindow.payload.observation_selection,
    "CAP06_CURRENT_EVIDENCE_OBSERVATION_SELECTION_REQUIRED",
  );
  return requiredRecordV1(
    selection.selected_observation,
    "CAP06_CURRENT_EVIDENCE_SELECTED_OBSERVATION_REQUIRED",
  );
}

function configModelBasisV1(payload: Cap05RuntimeConfigPayloadV1): Record<string, unknown> {
  // Freeze model identity separately from parameter values so homogeneity diagnostics remain interpretable.
  return {
    dynamics_model: structuredClone(payload.dynamics_model),
    model_component_refs: structuredClone(payload.model_component_refs),
    forecast_method_id: payload.forecast_method_id,
    forecast_method_version: payload.forecast_method_version,
    uncertainty_propagation_method_id: payload.uncertainty_propagation_method_id,
    forecast_interval_method_id: payload.forecast_interval_method_id,
    observation_assimilation_method_id: payload.observation_assimilation.assimilation_method_id,
  };
}

function configParameterBasisV1(payload: Cap05RuntimeConfigPayloadV1): Record<string, unknown> {
  // Hash only prediction/observation numerical authorities; exclude parent refs, effective time and feedback-only policy aliases.
  return {
    soil_hydraulic_snapshot: structuredClone(payload.soil_hydraulic_snapshot),
    dynamics_parameters: structuredClone(payload.dynamics_parameters),
    process_uncertainty: structuredClone(payload.process_uncertainty),
    observation_measurement_parameters: {
      sensor_measurement_stddev_fraction: payload.observation_assimilation.sensor_measurement_stddev_fraction,
      point_to_zone_representativeness_stddev_fraction:
        payload.observation_assimilation.point_to_zone_representativeness_stddev_fraction,
      quality_weights: structuredClone(payload.observation_assimilation.quality_weights),
      max_squared_normalized_innovation: payload.observation_assimilation.max_squared_normalized_innovation,
      reported_max_absolute_normalized_innovation:
        payload.observation_assimilation.reported_max_absolute_normalized_innovation,
      posterior_clip_policy: payload.observation_assimilation.posterior_clip_policy,
    },
    scenario_application_efficiency_policy: structuredClone(payload.scenario_application_efficiency_policy),
    stress_threshold_policy: structuredClone(payload.stress_threshold_policy),
  };
}

function configNumericBasisV1(payload: Cap05RuntimeConfigPayloadV1): Record<string, unknown> {
  // Numeric policy is distinct from model parameters and must remain exactly homogeneous across all 24 cases.
  return {
    rounding: structuredClone(payload.rounding),
    decimal_scale_policy_id: payload.decimal_scale_policy_id,
    rounding_policy_id: payload.rounding_policy_id,
    physical_bound_policy_id: payload.physical_bound_policy_id,
  };
}

export class PostgresCap06RepositoryHistoryCaseGraphReaderV1 {
  constructor(private readonly pool: Pool) {}

  private async readExactCanonicalObjectV1(
    client: PoolClient,
    objectId: string,
    expectedType: string,
    code: string,
  ): Promise<CanonicalObjectEnvelopeV1> {
    // Object identifiers are globally unique canonical identities; duplicate facts fail closed.
    const result = await client.query(
      `SELECT record_json FROM facts
       WHERE record_json->'payload'->>'object_id'=$1
       LIMIT 2`,
      [objectId],
    );
    if (result.rows.length !== 1) throw new Error(`${code}:CARDINALITY:${result.rows.length}`);
    const object = parseFactPayloadV1(result.rows[0].record_json, code) as unknown as CanonicalObjectEnvelopeV1;
    if (object.object_id !== objectId || object.object_type !== expectedType) throw new Error(`${code}:IDENTITY_MISMATCH`);
    return object;
  }

  private async resolveOneV1(input: {
    client: PoolClient;
    scope: Cap06ScopeV1;
    lineage_id: string;
    revision_id: string;
    residual: Cap05ForecastResidualEnvelopeV1;
  }): Promise<Cap06ResolvedCaseGraphV1> {
    // Validate the complete canonical Residual contract before following any source reference.
    validateCap05ForecastResidualV1(input.residual);
    exactScopeV1(input.residual as unknown as Record<string, unknown>, input.scope, "CAP06_RESIDUAL_SCOPE_MISMATCH");
    if (input.residual.context_lineage_ref !== input.lineage_id
      || input.residual.context_revision_ref !== input.revision_id) {
      throw new Error("CAP06_RESIDUAL_CONTEXT_MISMATCH");
    }
    exactStandardObjectHashV1(input.residual as unknown as Record<string, unknown>, "CAP06_RESIDUAL_HASH_MISMATCH");
    const residualPayload = input.residual.payload;

    const forecast = await this.readExactCanonicalObjectV1(
      input.client,
      residualPayload.forecast_run_ref,
      "twin_forecast_run_v1",
      "CAP06_FORECAST_NOT_FOUND",
    );
    exactScopeV1(forecast as unknown as Record<string, unknown>, input.scope, "CAP06_FORECAST_SCOPE_MISMATCH");
    exactContextV1(forecast as unknown as Record<string, unknown>, input.lineage_id, input.revision_id, "CAP06_FORECAST_CONTEXT_MISMATCH");
    exactCap04MemberHashV1(forecast, "CAP06_FORECAST_HASH_RECOMPUTATION_MISMATCH");
    if (forecast.determinism_hash !== residualPayload.forecast_run_hash) throw new Error("CAP06_FORECAST_RESIDUAL_HASH_MISMATCH");
    const forecastPayload = forecast.payload as unknown as Cap04CanonicalCompletedForecastRunPayloadV1;
    validateCap04CanonicalForecastRunPayloadV1(forecastPayload);
    if (forecastPayload.status !== "COMPLETED") throw new Error("CAP06_COMPLETED_FORECAST_REQUIRED");

    const h1Points = forecastPayload.points.filter((point) => point.horizon_hour === 1
      && point.target_time === residualPayload.forecast_target_time);
    if (h1Points.length !== 1) throw new Error("CAP06_FORECAST_H1_POINT_CARDINALITY");
    const h1Point = h1Points[0];
    const pointRef = buildCap05ForecastPointMemberRefV1(forecast.object_id, 1);
    if (pointRef !== residualPayload.forecast_point_ref
      || h1Point.determinism_hash !== residualPayload.forecast_point_hash) {
      throw new Error("CAP06_FORECAST_H1_POINT_IDENTITY_MISMATCH");
    }

    const sourcePosterior = await this.readExactCanonicalObjectV1(
      input.client,
      forecastPayload.source_posterior_ref,
      "twin_state_estimate_v1",
      "CAP06_SOURCE_POSTERIOR_NOT_FOUND",
    );
    exactScopeV1(sourcePosterior as unknown as Record<string, unknown>, input.scope, "CAP06_SOURCE_POSTERIOR_SCOPE_MISMATCH");
    exactContextV1(sourcePosterior as unknown as Record<string, unknown>, input.lineage_id, input.revision_id, "CAP06_SOURCE_POSTERIOR_CONTEXT_MISMATCH");
    exactCap04MemberHashV1(sourcePosterior, "CAP06_SOURCE_POSTERIOR_HASH_RECOMPUTATION_MISMATCH");
    if (sourcePosterior.determinism_hash !== forecastPayload.source_posterior_hash) throw new Error("CAP06_SOURCE_POSTERIOR_HASH_MISMATCH");

    const forecastEvidenceRef = requiredStringV1(
      sourcePosterior.payload.evidence_window_ref,
      "CAP06_FORECAST_EVIDENCE_WINDOW_REF_REQUIRED",
    );
    const forecastEvidence = await this.readExactCanonicalObjectV1(
      input.client,
      forecastEvidenceRef,
      "twin_evidence_window_v1",
      "CAP06_FORECAST_EVIDENCE_WINDOW_NOT_FOUND",
    );
    exactScopeV1(forecastEvidence as unknown as Record<string, unknown>, input.scope, "CAP06_FORECAST_EVIDENCE_SCOPE_MISMATCH");
    exactContextV1(forecastEvidence as unknown as Record<string, unknown>, input.lineage_id, input.revision_id, "CAP06_FORECAST_EVIDENCE_CONTEXT_MISMATCH");
    exactCap04MemberHashV1(forecastEvidence, "CAP06_FORECAST_EVIDENCE_HASH_RECOMPUTATION_MISMATCH");
    const evidenceCutoff = canonicalInstantV1(
      forecastEvidence.payload.window_end_inclusive,
      "CAP06_FORECAST_EVIDENCE_CUTOFF_INVALID",
    );
    if (forecastEvidence.as_of !== evidenceCutoff || forecastEvidence.logical_time !== evidenceCutoff) {
      throw new Error("CAP06_FORECAST_EVIDENCE_CUTOFF_MAPPING_MISMATCH");
    }

    const runtimeConfig = await this.readExactCanonicalObjectV1(
      input.client,
      residualPayload.runtime_config_ref,
      "twin_runtime_config_v1",
      "CAP06_RUNTIME_CONFIG_NOT_FOUND",
    );
    exactScopeV1(runtimeConfig as unknown as Record<string, unknown>, input.scope, "CAP06_RUNTIME_CONFIG_SCOPE_MISMATCH");
    exactStandardObjectHashV1(runtimeConfig as unknown as Record<string, unknown>, "CAP06_RUNTIME_CONFIG_HASH_RECOMPUTATION_MISMATCH");
    if (runtimeConfig.determinism_hash !== residualPayload.runtime_config_hash) throw new Error("CAP06_RESIDUAL_RUNTIME_CONFIG_HASH_MISMATCH");
    const configPayload = runtimeConfig.payload as unknown as Cap05RuntimeConfigPayloadV1;
    validateCap05RuntimeConfigPayloadV1(configPayload);

    if (forecast.runtime_config_ref !== runtimeConfig.object_id
      || forecast.runtime_config_hash !== runtimeConfig.determinism_hash
      || forecastPayload.runtime_config_ref !== runtimeConfig.object_id
      || forecastPayload.runtime_config_hash !== runtimeConfig.determinism_hash
      || sourcePosterior.runtime_config_ref !== runtimeConfig.object_id
      || sourcePosterior.runtime_config_hash !== runtimeConfig.determinism_hash) {
      throw new Error("CAP06_RUNTIME_CONFIG_GRAPH_MISMATCH");
    }

    const configCropStage = requiredRecordV1(configPayload.crop_stage_context, "CAP06_CONFIG_CROP_STAGE_CONTEXT_REQUIRED");
    if (forecastPayload.crop_stage_context_ref !== configCropStage.context_ref
      || forecastPayload.crop_stage_context_hash !== configCropStage.context_hash) {
      throw new Error("CAP06_FORECAST_CROP_STAGE_CONFIG_MISMATCH");
    }

    const weatherRecord = selectedRecordByRefV1(
      forecastEvidence,
      requiredStringV1(forecastPayload.weather_snapshot_ref, "CAP06_WEATHER_REF_REQUIRED"),
      "FUTURE_WEATHER_ASSUMPTION",
      "CAP06_WEATHER_EVIDENCE_NOT_SELECTED",
    );
    if (weatherRecord.source_record_hash !== forecastPayload.weather_snapshot_hash) throw new Error("CAP06_WEATHER_EVIDENCE_HASH_MISMATCH");
    const et0Record = selectedRecordByRefV1(
      forecastEvidence,
      requiredStringV1(forecastPayload.et0_snapshot_ref, "CAP06_ET0_REF_REQUIRED"),
      "FUTURE_ET0_ASSUMPTION",
      "CAP06_ET0_EVIDENCE_NOT_SELECTED",
    );
    if (et0Record.source_record_hash !== forecastPayload.et0_snapshot_hash) throw new Error("CAP06_ET0_EVIDENCE_HASH_MISMATCH");

    const assimilationRef = requiredStringV1(
      residualPayload.assimilation_update_ref,
      "CAP06_RESIDUAL_ASSIMILATION_UPDATE_REQUIRED",
    );
    const assimilationHash = requiredStringV1(
      residualPayload.assimilation_update_hash,
      "CAP06_RESIDUAL_ASSIMILATION_HASH_REQUIRED",
    );
    const assimilation = await this.readExactCanonicalObjectV1(
      input.client,
      assimilationRef,
      "twin_assimilation_update_v1",
      "CAP06_CURRENT_ASSIMILATION_NOT_FOUND",
    );
    exactScopeV1(assimilation as unknown as Record<string, unknown>, input.scope, "CAP06_CURRENT_ASSIMILATION_SCOPE_MISMATCH");
    exactContextV1(assimilation as unknown as Record<string, unknown>, input.lineage_id, input.revision_id, "CAP06_CURRENT_ASSIMILATION_CONTEXT_MISMATCH");
    exactCap04MemberHashV1(assimilation, "CAP06_CURRENT_ASSIMILATION_HASH_RECOMPUTATION_MISMATCH");
    if (assimilation.determinism_hash !== assimilationHash) throw new Error("CAP06_CURRENT_ASSIMILATION_HASH_MISMATCH");

    const transition = await this.readExactCanonicalObjectV1(
      input.client,
      requiredStringV1(assimilation.payload.state_transition_ref, "CAP06_CURRENT_TRANSITION_REF_REQUIRED"),
      "twin_state_transition_v1",
      "CAP06_CURRENT_TRANSITION_NOT_FOUND",
    );
    exactScopeV1(transition as unknown as Record<string, unknown>, input.scope, "CAP06_CURRENT_TRANSITION_SCOPE_MISMATCH");
    exactContextV1(transition as unknown as Record<string, unknown>, input.lineage_id, input.revision_id, "CAP06_CURRENT_TRANSITION_CONTEXT_MISMATCH");
    exactCap04MemberHashV1(transition, "CAP06_CURRENT_TRANSITION_HASH_RECOMPUTATION_MISMATCH");
    if (transition.payload.assimilation_update_ref !== assimilation.object_id) throw new Error("CAP06_CURRENT_TRANSITION_ASSIMILATION_MISMATCH");

    const currentEvidence = await this.readExactCanonicalObjectV1(
      input.client,
      requiredStringV1(transition.payload.evidence_window_ref, "CAP06_CURRENT_EVIDENCE_WINDOW_REF_REQUIRED"),
      "twin_evidence_window_v1",
      "CAP06_CURRENT_EVIDENCE_WINDOW_NOT_FOUND",
    );
    exactScopeV1(currentEvidence as unknown as Record<string, unknown>, input.scope, "CAP06_CURRENT_EVIDENCE_SCOPE_MISMATCH");
    exactContextV1(currentEvidence as unknown as Record<string, unknown>, input.lineage_id, input.revision_id, "CAP06_CURRENT_EVIDENCE_CONTEXT_MISMATCH");
    exactCap04MemberHashV1(currentEvidence, "CAP06_CURRENT_EVIDENCE_HASH_RECOMPUTATION_MISMATCH");
    const selectedObservation = selectedObservationV1(currentEvidence);
    const observationQuality = selectedObservation.quality_status
      ?? requiredRecordV1(selectedObservation.quality, "CAP06_SELECTED_OBSERVATION_QUALITY_REQUIRED").status;
    if (observationQuality !== "PASS" && observationQuality !== "LIMITED") throw new Error("CAP06_SELECTED_OBSERVATION_QUALITY_INVALID");
    const observationUnit = requiredStringV1(
      selectedObservation.canonical_unit
        ?? requiredRecordV1(selectedObservation.canonical_payload, "CAP06_SELECTED_OBSERVATION_PAYLOAD_REQUIRED").unit,
      "CAP06_SELECTED_OBSERVATION_UNIT_REQUIRED",
    );

    const observationRef = requiredStringV1(selectedObservation.observation_ref, "CAP06_SELECTED_OBSERVATION_REF_REQUIRED");
    const observationHash = requiredStringV1(selectedObservation.source_record_hash, "CAP06_SELECTED_OBSERVATION_HASH_REQUIRED");
    const observedAt = canonicalInstantV1(selectedObservation.observed_at, "CAP06_SELECTED_OBSERVATION_TIME_INVALID");
    const observationAvailableAt = canonicalInstantV1(
      selectedObservation.available_to_runtime_at,
      "CAP06_SELECTED_OBSERVATION_AVAILABLE_INVALID",
    );
    if (observationRef !== residualPayload.actual_observation_ref
      || observationHash !== residualPayload.actual_observation_hash
      || observedAt !== residualPayload.actual_observation_observed_at
      || observationAvailableAt !== residualPayload.observation_available_to_runtime_at
      || observationQuality !== residualPayload.actual_observation_quality
      || observationUnit !== residualPayload.actual_observation_unit) {
      throw new Error("CAP06_RESIDUAL_OBSERVATION_GRAPH_MISMATCH");
    }

    const configOperator = requiredRecordV1(
      requiredRecordV1(configPayload.observation_assimilation, "CAP06_CONFIG_OBSERVATION_ASSIMILATION_REQUIRED").observation_operator,
      "CAP06_CONFIG_OBSERVATION_OPERATOR_REQUIRED",
    );
    if (configOperator.id !== residualPayload.observation_operator_id
      || String(configOperator.h) !== residualPayload.observation_operator_h
      || configOperator.direct_state_equivalence !== residualPayload.direct_state_equivalence) {
      throw new Error("CAP06_RESIDUAL_OBSERVATION_OPERATOR_CONFIG_MISMATCH");
    }
    if (configPayload.reality_binding_ref !== residualPayload.root_zone_geometry_ref
      || configPayload.reality_binding_hash !== residualPayload.root_zone_geometry_hash) {
      throw new Error("CAP06_RESIDUAL_GEOMETRY_CONFIG_MISMATCH");
    }

    return {
      residual: {
        residual_ref: input.residual.object_id,
        residual_hash: input.residual.determinism_hash,
        scope: structuredClone(input.scope),
        context_lineage_ref: input.residual.context_lineage_ref,
        context_revision_ref: input.residual.context_revision_ref,
        forecast_run: { ref: forecast.object_id, hash: forecast.determinism_hash },
        forecast_point: {
          ref: pointRef,
          hash: h1Point.determinism_hash,
          horizon_hour: h1Point.horizon_hour,
          target_time: h1Point.target_time,
        },
        forecast_issued_at: residualPayload.forecast_issued_at,
        forecast_target_time: residualPayload.forecast_target_time,
        observation: {
          ref: observationRef,
          hash: observationHash,
          observed_at: observedAt,
          available_to_runtime_at: observationAvailableAt,
          quality: observationQuality,
          unit: observationUnit,
        },
        runtime_config: { ref: runtimeConfig.object_id, hash: runtimeConfig.determinism_hash },
        root_zone_geometry: {
          ref: residualPayload.root_zone_geometry_ref,
          hash: residualPayload.root_zone_geometry_hash,
        },
        observation_operator_basis: {
          operator_id: residualPayload.observation_operator_id,
          operator_version: residualPayload.observation_operator_version,
          operator_h: residualPayload.observation_operator_h,
          direct_state_equivalence: residualPayload.direct_state_equivalence,
          projection_method_id: residualPayload.projection_method_id,
          projection_method_version: residualPayload.projection_method_version,
          variance_projection_method_id: residualPayload.variance_projection_method_id,
        },
      },
      forecast: {
        ref: forecast.object_id,
        hash: forecast.determinism_hash,
        scope: structuredClone(input.scope),
        context_lineage_ref: requiredStringV1(forecast.lineage_id, "CAP06_FORECAST_LINEAGE_REQUIRED"),
        context_revision_ref: requiredStringV1(forecast.revision_id, "CAP06_FORECAST_REVISION_REQUIRED"),
        status: forecastPayload.status,
        issued_at: forecastPayload.issued_at,
        as_of: canonicalInstantV1(forecast.as_of, "CAP06_FORECAST_AS_OF_INVALID"),
        source_posterior: { ref: sourcePosterior.object_id, hash: sourcePosterior.determinism_hash },
        runtime_config: { ref: runtimeConfig.object_id, hash: runtimeConfig.determinism_hash },
        evidence_window: { ref: forecastEvidence.object_id, hash: forecastEvidence.determinism_hash },
        forcing_cycle_key: requiredStringV1(forecastPayload.forcing_cycle_key, "CAP06_FORCING_CYCLE_KEY_REQUIRED"),
        forcing_window_hash: requiredStringV1(forecastPayload.forcing_window_hash, "CAP06_FORCING_WINDOW_HASH_REQUIRED"),
        weather_snapshot: {
          ref: requiredStringV1(forecastPayload.weather_snapshot_ref, "CAP06_WEATHER_REF_REQUIRED"),
          hash: requiredStringV1(forecastPayload.weather_snapshot_hash, "CAP06_WEATHER_HASH_REQUIRED"),
        },
        et0_snapshot: {
          ref: requiredStringV1(forecastPayload.et0_snapshot_ref, "CAP06_ET0_REF_REQUIRED"),
          hash: requiredStringV1(forecastPayload.et0_snapshot_hash, "CAP06_ET0_HASH_REQUIRED"),
        },
        crop_stage_context: {
          ref: forecastPayload.crop_stage_context_ref,
          hash: forecastPayload.crop_stage_context_hash,
        },
        points: forecastPayload.points.map((point) => ({
          ref: buildCap05ForecastPointMemberRefV1(forecast.object_id, point.horizon_hour),
          hash: point.determinism_hash,
          horizon_hour: point.horizon_hour,
          target_time: point.target_time,
        })),
      },
      source_posterior: {
        ref: sourcePosterior.object_id,
        hash: sourcePosterior.determinism_hash,
        scope: structuredClone(input.scope),
        context_lineage_ref: requiredStringV1(sourcePosterior.lineage_id, "CAP06_POSTERIOR_LINEAGE_REQUIRED"),
        context_revision_ref: requiredStringV1(sourcePosterior.revision_id, "CAP06_POSTERIOR_REVISION_REQUIRED"),
        runtime_config: {
          ref: requiredStringV1(sourcePosterior.runtime_config_ref, "CAP06_POSTERIOR_CONFIG_REF_REQUIRED"),
          hash: requiredStringV1(sourcePosterior.runtime_config_hash, "CAP06_POSTERIOR_CONFIG_HASH_REQUIRED"),
        },
      },
      runtime_config: {
        ref: runtimeConfig.object_id,
        hash: runtimeConfig.determinism_hash,
        model_component_basis: configModelBasisV1(configPayload),
        effective_parameter_bundle_basis: configParameterBasisV1(configPayload),
        runtime_replay_numeric_policy_basis: configNumericBasisV1(configPayload),
      },
      evidence_window: {
        ref: forecastEvidence.object_id,
        hash: forecastEvidence.determinism_hash,
        evidence_cutoff_at: evidenceCutoff,
      },
      observation: {
        ref: observationRef,
        hash: observationHash,
        observed_at: observedAt,
        available_to_runtime_at: observationAvailableAt,
        quality: observationQuality,
        unit: observationUnit,
      },
      weather_snapshot: {
        ref: requiredStringV1(weatherRecord.source_record_id, "CAP06_WEATHER_SELECTED_REF_REQUIRED"),
        hash: requiredStringV1(weatherRecord.source_record_hash, "CAP06_WEATHER_SELECTED_HASH_REQUIRED"),
      },
      et0_snapshot: {
        ref: requiredStringV1(et0Record.source_record_id, "CAP06_ET0_SELECTED_REF_REQUIRED"),
        hash: requiredStringV1(et0Record.source_record_hash, "CAP06_ET0_SELECTED_HASH_REQUIRED"),
      },
      crop_stage_context: {
        ref: requiredStringV1(configCropStage.context_ref, "CAP06_CROP_STAGE_REF_REQUIRED"),
        hash: requiredStringV1(configCropStage.context_hash, "CAP06_CROP_STAGE_HASH_REQUIRED"),
      },
      root_zone_geometry: {
        ref: residualPayload.root_zone_geometry_ref,
        hash: residualPayload.root_zone_geometry_hash,
      },
    };
  }

  async loadResolvedCaseGraphsV1(input: {
    scope: Cap06ScopeV1;
    lineage_id: string;
    revision_id: string;
  }): Promise<readonly Cap06ResolvedCaseGraphV1[]> {
    // Read every canonical Residual in deterministic event-time/object-id order and resolve the complete graph under one snapshot transaction.
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
      const result = await client.query(
        `SELECT record_json
         FROM facts
         WHERE record_json->>'type'='twin_forecast_residual_v1'
           AND record_json->'payload'->>'tenant_id'=$1
           AND record_json->'payload'->>'project_id'=$2
           AND record_json->'payload'->>'group_id'=$3
           AND record_json->'payload'->>'field_id'=$4
           AND record_json->'payload'->>'season_id'=$5
           AND record_json->'payload'->>'zone_id'=$6
           AND record_json->'payload'->>'context_lineage_ref'=$7
           AND record_json->'payload'->>'context_revision_ref'=$8
         ORDER BY record_json->'payload'->>'logical_time',record_json->'payload'->>'object_id'`,
        [
          input.scope.tenant_id,
          input.scope.project_id,
          input.scope.group_id,
          input.scope.field_id,
          input.scope.season_id,
          input.scope.zone_id,
          requiredStringV1(input.lineage_id, "CAP06_LINEAGE_REQUIRED"),
          requiredStringV1(input.revision_id, "CAP06_REVISION_REQUIRED"),
        ],
      );
      const graphs: Cap06ResolvedCaseGraphV1[] = [];
      for (const row of result.rows) {
        const residual = parseFactPayloadV1(
          row.record_json,
          "CAP06_RESIDUAL_FACT_INVALID",
        ) as unknown as Cap05ForecastResidualEnvelopeV1;
        graphs.push(await this.resolveOneV1({
          client,
          scope: input.scope,
          lineage_id: input.lineage_id,
          revision_id: input.revision_id,
          residual,
        }));
      }
      await client.query("COMMIT");
      return graphs;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
