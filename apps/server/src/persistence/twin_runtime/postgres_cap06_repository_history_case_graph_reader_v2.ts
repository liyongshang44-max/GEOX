// apps/server/src/persistence/twin_runtime/postgres_cap06_repository_history_case_graph_reader_v2.ts
// Purpose: resolve each canonical Forecast Residual into the exact MCFT-CAP-06 S0 graph while preserving separate Forecast-time and Residual-time Runtime Config authorities.
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
  Cap06ResolvedCaseGraphV2,
  Cap06ScopeV2,
} from "../../domain/twin_runtime/calibration_case_graph_qualification_v2.js";

function requiredStringV2(value: unknown, code: string): string {
  // Reject absent semantic authorities before following any graph edge.
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

function requiredRecordV2(value: unknown, code: string): Record<string, unknown> {
  // Canonical payload traversal is allowed only through non-array objects.
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
  return value as Record<string, unknown>;
}

function requiredArrayV2(value: unknown, code: string): unknown[] {
  // Cardinality-sensitive graph fields must remain explicit arrays.
  if (!Array.isArray(value)) throw new Error(code);
  return value;
}

function canonicalInstantV2(value: unknown, code: string): string {
  // Preserve exact canonical ISO text rather than normalizing ambiguous timestamps.
  const text = requiredStringV2(value, code);
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== text) throw new Error(code);
  return text;
}

function parseFactPayloadV2(value: unknown, code: string): Record<string, unknown> {
  // Facts remain opaque at storage level; this adapter explicitly opens only the canonical payload envelope.
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  return requiredRecordV2(requiredRecordV2(parsed, code).payload, code);
}

function exactScopeV2(object: Record<string, unknown>, expected: Cap06ScopeV2, code: string): void {
  // Qualification scope is the complete frozen six-part scope.
  for (const field of ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"] as const) {
    if (object[field] !== expected[field]) throw new Error(`${code}:${field}`);
  }
}

function exactContextV2(object: Record<string, unknown>, lineageId: string, revisionId: string, code: string): void {
  // A-record-set members use lineage_id/revision_id while Residuals expose context refs.
  if (object.lineage_id !== lineageId || object.revision_id !== revisionId) throw new Error(code);
}

function exactCap04MemberHashV2(object: CanonicalObjectEnvelopeV1, code: string): void {
  // CAP-04 A members use the CAP-04 non-recursive member-hash authority.
  if (computeCap04AMemberDeterminismHashV1(object) !== object.determinism_hash) throw new Error(code);
}

function exactStandardObjectHashV2(object: Record<string, unknown>, code: string): void {
  // Runtime Config and C Residual identities use the standard semantic member hash.
  if (computeMemberDeterminismHashV1(object) !== object.determinism_hash) throw new Error(code);
}

function selectedRecordByRefV2(
  evidenceWindow: CanonicalObjectEnvelopeV1,
  ref: string,
  role: string,
  code: string,
): Record<string, unknown> {
  // Forecast snapshot refs must resolve to exactly one selected Evidence summary of the expected role.
  const selected = requiredArrayV2(evidenceWindow.payload.selected_records, `${code}:SELECTED_RECORDS_REQUIRED`)
    .map((value) => requiredRecordV2(value, `${code}:SELECTED_RECORD_INVALID`))
    .filter((value) => value.source_record_id === ref && value.role === role);
  if (selected.length !== 1) throw new Error(`${code}:CARDINALITY:${selected.length}`);
  return selected[0];
}

function selectedObservationV2(evidenceWindow: CanonicalObjectEnvelopeV1): Record<string, unknown> {
  // Outcome Observation authority is frozen in the current canonical Evidence Window.
  const selection = requiredRecordV2(
    evidenceWindow.payload.observation_selection,
    "CAP06_CURRENT_EVIDENCE_OBSERVATION_SELECTION_REQUIRED",
  );
  return requiredRecordV2(
    selection.selected_observation,
    "CAP06_CURRENT_EVIDENCE_SELECTED_OBSERVATION_REQUIRED",
  );
}

function modelBasisV2(payload: Cap05RuntimeConfigPayloadV1): Record<string, unknown> {
  // Model identity is separated from parameter values for auditable homogeneity diagnostics.
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

function parameterBasisV2(payload: Cap05RuntimeConfigPayloadV1): Record<string, unknown> {
  // Exclude parent refs and effective time; retain every numerical authority affecting prediction or observation projection.
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

function numericBasisV2(payload: Cap05RuntimeConfigPayloadV1): Record<string, unknown> {
  // Numeric execution policy is a distinct frozen homogeneity dimension.
  return {
    rounding: structuredClone(payload.rounding),
    decimal_scale_policy_id: payload.decimal_scale_policy_id,
    rounding_policy_id: payload.rounding_policy_id,
    physical_bound_policy_id: payload.physical_bound_policy_id,
  };
}

function residualPolicyBasisV2(payload: Record<string, unknown>): Record<string, unknown> {
  // Residual-time Config governs matching, projection and normalization, independently of Forecast-time parameter identity.
  return {
    forecast_residual_matching_policy_id: payload.forecast_residual_matching_policy_id,
    forecast_point_member_ref_policy_id: payload.forecast_point_member_ref_policy_id,
    forecast_observation_projection_method_id: payload.forecast_observation_projection_method_id,
    forecast_observation_projection_version: payload.forecast_observation_projection_version,
    forecast_residual_normalization_policy_id: payload.forecast_residual_normalization_policy_id,
    forecast_assimilation_relation_policy_id: payload.forecast_assimilation_relation_policy_id,
  };
}

export class PostgresCap06RepositoryHistoryCaseGraphReaderV2 {
  constructor(private readonly pool: Pool) {}

  private async readExactObjectV2(
    client: PoolClient,
    objectId: string,
    expectedType: string,
    code: string,
  ): Promise<CanonicalObjectEnvelopeV1> {
    // Canonical object identifiers must resolve to exactly one append-only fact.
    const result = await client.query(
      `SELECT record_json FROM facts
       WHERE record_json->'payload'->>'object_id'=$1
       LIMIT 2`,
      [objectId],
    );
    if (result.rows.length !== 1) throw new Error(`${code}:CARDINALITY:${result.rows.length}`);
    const object = parseFactPayloadV2(result.rows[0].record_json, code) as unknown as CanonicalObjectEnvelopeV1;
    if (object.object_id !== objectId || object.object_type !== expectedType) throw new Error(`${code}:IDENTITY_MISMATCH`);
    return object;
  }

  private async readConfigV2(
    client: PoolClient,
    ref: string,
    hash: string,
    scope: Cap06ScopeV2,
    code: string,
  ): Promise<{ object: CanonicalObjectEnvelopeV1; payload: Cap05RuntimeConfigPayloadV1 }> {
    // Each Config ref/hash is independently resolved; Forecast and Residual Config refs are not assumed equal.
    const object = await this.readExactObjectV2(client, ref, "twin_runtime_config_v1", code);
    exactScopeV2(object as unknown as Record<string, unknown>, scope, `${code}:SCOPE_MISMATCH`);
    exactStandardObjectHashV2(object as unknown as Record<string, unknown>, `${code}:HASH_RECOMPUTATION_MISMATCH`);
    if (object.determinism_hash !== hash) throw new Error(`${code}:HASH_MISMATCH`);
    const payload = object.payload as unknown as Cap05RuntimeConfigPayloadV1;
    validateCap05RuntimeConfigPayloadV1(payload);
    return { object, payload };
  }

  private async resolveOneV2(input: {
    client: PoolClient;
    scope: Cap06ScopeV2;
    lineage_id: string;
    revision_id: string;
    residual: Cap05ForecastResidualEnvelopeV1;
  }): Promise<Cap06ResolvedCaseGraphV2> {
    // Start from a fully validated canonical Residual and follow only frozen ref/hash edges.
    validateCap05ForecastResidualV1(input.residual);
    exactScopeV2(input.residual as unknown as Record<string, unknown>, input.scope, "CAP06_RESIDUAL_SCOPE_MISMATCH");
    if (input.residual.context_lineage_ref !== input.lineage_id
      || input.residual.context_revision_ref !== input.revision_id) throw new Error("CAP06_RESIDUAL_CONTEXT_MISMATCH");
    exactStandardObjectHashV2(input.residual as unknown as Record<string, unknown>, "CAP06_RESIDUAL_HASH_MISMATCH");
    const residualPayload = input.residual.payload;

    const forecast = await this.readExactObjectV2(
      input.client,
      residualPayload.forecast_run_ref,
      "twin_forecast_run_v1",
      "CAP06_FORECAST_NOT_FOUND",
    );
    exactScopeV2(forecast as unknown as Record<string, unknown>, input.scope, "CAP06_FORECAST_SCOPE_MISMATCH");
    exactContextV2(forecast as unknown as Record<string, unknown>, input.lineage_id, input.revision_id, "CAP06_FORECAST_CONTEXT_MISMATCH");
    exactCap04MemberHashV2(forecast, "CAP06_FORECAST_HASH_RECOMPUTATION_MISMATCH");
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
      || h1Point.determinism_hash !== residualPayload.forecast_point_hash) throw new Error("CAP06_FORECAST_H1_POINT_IDENTITY_MISMATCH");

    const sourcePosterior = await this.readExactObjectV2(
      input.client,
      forecastPayload.source_posterior_ref,
      "twin_state_estimate_v1",
      "CAP06_SOURCE_POSTERIOR_NOT_FOUND",
    );
    exactScopeV2(sourcePosterior as unknown as Record<string, unknown>, input.scope, "CAP06_SOURCE_POSTERIOR_SCOPE_MISMATCH");
    exactContextV2(sourcePosterior as unknown as Record<string, unknown>, input.lineage_id, input.revision_id, "CAP06_SOURCE_POSTERIOR_CONTEXT_MISMATCH");
    exactCap04MemberHashV2(sourcePosterior, "CAP06_SOURCE_POSTERIOR_HASH_RECOMPUTATION_MISMATCH");
    if (sourcePosterior.determinism_hash !== forecastPayload.source_posterior_hash) throw new Error("CAP06_SOURCE_POSTERIOR_HASH_MISMATCH");

    const forecastEvidence = await this.readExactObjectV2(
      input.client,
      requiredStringV2(sourcePosterior.payload.evidence_window_ref, "CAP06_FORECAST_EVIDENCE_WINDOW_REF_REQUIRED"),
      "twin_evidence_window_v1",
      "CAP06_FORECAST_EVIDENCE_WINDOW_NOT_FOUND",
    );
    exactScopeV2(forecastEvidence as unknown as Record<string, unknown>, input.scope, "CAP06_FORECAST_EVIDENCE_SCOPE_MISMATCH");
    exactContextV2(forecastEvidence as unknown as Record<string, unknown>, input.lineage_id, input.revision_id, "CAP06_FORECAST_EVIDENCE_CONTEXT_MISMATCH");
    exactCap04MemberHashV2(forecastEvidence, "CAP06_FORECAST_EVIDENCE_HASH_RECOMPUTATION_MISMATCH");
    const evidenceCutoff = canonicalInstantV2(forecastEvidence.payload.window_end_inclusive, "CAP06_FORECAST_EVIDENCE_CUTOFF_INVALID");
    if (forecastEvidence.as_of !== evidenceCutoff || forecastEvidence.logical_time !== evidenceCutoff) throw new Error("CAP06_FORECAST_EVIDENCE_CUTOFF_MAPPING_MISMATCH");

    const forecastConfigRef = requiredStringV2(forecast.runtime_config_ref, "CAP06_FORECAST_CONFIG_REF_REQUIRED");
    const forecastConfigHash = requiredStringV2(forecast.runtime_config_hash, "CAP06_FORECAST_CONFIG_HASH_REQUIRED");
    if (forecastPayload.runtime_config_ref !== forecastConfigRef || forecastPayload.runtime_config_hash !== forecastConfigHash) {
      throw new Error("CAP06_FORECAST_PAYLOAD_CONFIG_MISMATCH");
    }
    const forecastConfig = await this.readConfigV2(
      input.client,
      forecastConfigRef,
      forecastConfigHash,
      input.scope,
      "CAP06_FORECAST_CONFIG_NOT_FOUND",
    );
    if (sourcePosterior.runtime_config_ref !== forecastConfig.object.object_id
      || sourcePosterior.runtime_config_hash !== forecastConfig.object.determinism_hash) throw new Error("CAP06_POSTERIOR_FORECAST_CONFIG_MISMATCH");

    const residualConfig = await this.readConfigV2(
      input.client,
      residualPayload.runtime_config_ref,
      residualPayload.runtime_config_hash,
      input.scope,
      "CAP06_RESIDUAL_CONFIG_NOT_FOUND",
    );

    const configCropStage = requiredRecordV2(forecastConfig.payload.crop_stage_context, "CAP06_CONFIG_CROP_STAGE_CONTEXT_REQUIRED");
    if (forecastPayload.crop_stage_context_ref !== configCropStage.context_ref
      || forecastPayload.crop_stage_context_hash !== configCropStage.context_hash) throw new Error("CAP06_FORECAST_CROP_STAGE_CONFIG_MISMATCH");

    const weatherRecord = selectedRecordByRefV2(
      forecastEvidence,
      requiredStringV2(forecastPayload.weather_snapshot_ref, "CAP06_WEATHER_REF_REQUIRED"),
      "FUTURE_WEATHER_ASSUMPTION",
      "CAP06_WEATHER_EVIDENCE_NOT_SELECTED",
    );
    if (weatherRecord.source_record_hash !== forecastPayload.weather_snapshot_hash) throw new Error("CAP06_WEATHER_EVIDENCE_HASH_MISMATCH");
    const et0Record = selectedRecordByRefV2(
      forecastEvidence,
      requiredStringV2(forecastPayload.et0_snapshot_ref, "CAP06_ET0_REF_REQUIRED"),
      "FUTURE_ET0_ASSUMPTION",
      "CAP06_ET0_EVIDENCE_NOT_SELECTED",
    );
    if (et0Record.source_record_hash !== forecastPayload.et0_snapshot_hash) throw new Error("CAP06_ET0_EVIDENCE_HASH_MISMATCH");

    const assimilation = await this.readExactObjectV2(
      input.client,
      requiredStringV2(residualPayload.assimilation_update_ref, "CAP06_RESIDUAL_ASSIMILATION_UPDATE_REQUIRED"),
      "twin_assimilation_update_v1",
      "CAP06_CURRENT_ASSIMILATION_NOT_FOUND",
    );
    exactScopeV2(assimilation as unknown as Record<string, unknown>, input.scope, "CAP06_CURRENT_ASSIMILATION_SCOPE_MISMATCH");
    exactContextV2(assimilation as unknown as Record<string, unknown>, input.lineage_id, input.revision_id, "CAP06_CURRENT_ASSIMILATION_CONTEXT_MISMATCH");
    exactCap04MemberHashV2(assimilation, "CAP06_CURRENT_ASSIMILATION_HASH_RECOMPUTATION_MISMATCH");
    if (assimilation.determinism_hash !== residualPayload.assimilation_update_hash) throw new Error("CAP06_CURRENT_ASSIMILATION_HASH_MISMATCH");

    const transition = await this.readExactObjectV2(
      input.client,
      requiredStringV2(assimilation.payload.state_transition_ref, "CAP06_CURRENT_TRANSITION_REF_REQUIRED"),
      "twin_state_transition_v1",
      "CAP06_CURRENT_TRANSITION_NOT_FOUND",
    );
    exactScopeV2(transition as unknown as Record<string, unknown>, input.scope, "CAP06_CURRENT_TRANSITION_SCOPE_MISMATCH");
    exactContextV2(transition as unknown as Record<string, unknown>, input.lineage_id, input.revision_id, "CAP06_CURRENT_TRANSITION_CONTEXT_MISMATCH");
    exactCap04MemberHashV2(transition, "CAP06_CURRENT_TRANSITION_HASH_RECOMPUTATION_MISMATCH");
    if (transition.payload.assimilation_update_ref !== assimilation.object_id) throw new Error("CAP06_CURRENT_TRANSITION_ASSIMILATION_MISMATCH");

    const currentEvidence = await this.readExactObjectV2(
      input.client,
      requiredStringV2(transition.payload.evidence_window_ref, "CAP06_CURRENT_EVIDENCE_WINDOW_REF_REQUIRED"),
      "twin_evidence_window_v1",
      "CAP06_CURRENT_EVIDENCE_WINDOW_NOT_FOUND",
    );
    exactScopeV2(currentEvidence as unknown as Record<string, unknown>, input.scope, "CAP06_CURRENT_EVIDENCE_SCOPE_MISMATCH");
    exactContextV2(currentEvidence as unknown as Record<string, unknown>, input.lineage_id, input.revision_id, "CAP06_CURRENT_EVIDENCE_CONTEXT_MISMATCH");
    exactCap04MemberHashV2(currentEvidence, "CAP06_CURRENT_EVIDENCE_HASH_RECOMPUTATION_MISMATCH");
    const selectedObservation = selectedObservationV2(currentEvidence);
    const quality = selectedObservation.quality_status
      ?? requiredRecordV2(selectedObservation.quality, "CAP06_SELECTED_OBSERVATION_QUALITY_REQUIRED").status;
    if (quality !== "PASS" && quality !== "LIMITED") throw new Error("CAP06_SELECTED_OBSERVATION_QUALITY_INVALID");
    const unit = requiredStringV2(
      selectedObservation.canonical_unit
        ?? requiredRecordV2(selectedObservation.canonical_payload, "CAP06_SELECTED_OBSERVATION_PAYLOAD_REQUIRED").unit,
      "CAP06_SELECTED_OBSERVATION_UNIT_REQUIRED",
    );
    const observationRef = requiredStringV2(selectedObservation.observation_ref, "CAP06_SELECTED_OBSERVATION_REF_REQUIRED");
    const observationHash = requiredStringV2(selectedObservation.source_record_hash, "CAP06_SELECTED_OBSERVATION_HASH_REQUIRED");
    const observedAt = canonicalInstantV2(selectedObservation.observed_at, "CAP06_SELECTED_OBSERVATION_TIME_INVALID");
    const observationAvailableAt = canonicalInstantV2(selectedObservation.available_to_runtime_at, "CAP06_SELECTED_OBSERVATION_AVAILABLE_INVALID");
    if (observationRef !== residualPayload.actual_observation_ref
      || observationHash !== residualPayload.actual_observation_hash
      || observedAt !== residualPayload.actual_observation_observed_at
      || observationAvailableAt !== residualPayload.observation_available_to_runtime_at
      || quality !== residualPayload.actual_observation_quality
      || unit !== residualPayload.actual_observation_unit) throw new Error("CAP06_RESIDUAL_OBSERVATION_GRAPH_MISMATCH");

    const residualOperator = requiredRecordV2(
      requiredRecordV2(residualConfig.payload.observation_assimilation, "CAP06_RESIDUAL_CONFIG_OBSERVATION_ASSIMILATION_REQUIRED").observation_operator,
      "CAP06_RESIDUAL_CONFIG_OBSERVATION_OPERATOR_REQUIRED",
    );
    if (residualOperator.id !== residualPayload.observation_operator_id
      || String(residualOperator.h) !== residualPayload.observation_operator_h
      || residualOperator.direct_state_equivalence !== residualPayload.direct_state_equivalence) throw new Error("CAP06_RESIDUAL_OPERATOR_CONFIG_MISMATCH");
    if (residualConfig.payload.reality_binding_ref !== residualPayload.root_zone_geometry_ref
      || residualConfig.payload.reality_binding_hash !== residualPayload.root_zone_geometry_hash
      || forecastConfig.payload.reality_binding_ref !== residualPayload.root_zone_geometry_ref
      || forecastConfig.payload.reality_binding_hash !== residualPayload.root_zone_geometry_hash) throw new Error("CAP06_CASE_GEOMETRY_CONFIG_MISMATCH");

    return {
      residual: {
        residual_ref: input.residual.object_id,
        residual_hash: input.residual.determinism_hash,
        scope: structuredClone(input.scope),
        context_lineage_ref: input.residual.context_lineage_ref,
        context_revision_ref: input.residual.context_revision_ref,
        forecast_run: { ref: forecast.object_id, hash: forecast.determinism_hash },
        forecast_point: { ref: pointRef, hash: h1Point.determinism_hash, horizon_hour: 1, target_time: h1Point.target_time },
        forecast_issued_at: residualPayload.forecast_issued_at,
        forecast_target_time: residualPayload.forecast_target_time,
        observation: {
          ref: observationRef,
          hash: observationHash,
          observed_at: observedAt,
          available_to_runtime_at: observationAvailableAt,
          quality,
          unit,
        },
        residual_runtime_config: { ref: residualConfig.object.object_id, hash: residualConfig.object.determinism_hash },
        root_zone_geometry: { ref: residualPayload.root_zone_geometry_ref, hash: residualPayload.root_zone_geometry_hash },
        observation_operator_basis: {
          operator_id: residualPayload.observation_operator_id,
          operator_version: residualPayload.observation_operator_version,
          operator_h: residualPayload.observation_operator_h,
          direct_state_equivalence: residualPayload.direct_state_equivalence,
          projection_method_id: residualPayload.projection_method_id,
          projection_method_version: residualPayload.projection_method_version,
          variance_projection_method_id: residualPayload.variance_projection_method_id,
          representativeness_variance: residualPayload.representativeness_variance,
        },
      },
      forecast: {
        ref: forecast.object_id,
        hash: forecast.determinism_hash,
        scope: structuredClone(input.scope),
        context_lineage_ref: requiredStringV2(forecast.lineage_id, "CAP06_FORECAST_LINEAGE_REQUIRED"),
        context_revision_ref: requiredStringV2(forecast.revision_id, "CAP06_FORECAST_REVISION_REQUIRED"),
        status: forecastPayload.status,
        issued_at: forecastPayload.issued_at,
        as_of: canonicalInstantV2(forecast.as_of, "CAP06_FORECAST_AS_OF_INVALID"),
        source_posterior: { ref: sourcePosterior.object_id, hash: sourcePosterior.determinism_hash },
        forecast_runtime_config: { ref: forecastConfig.object.object_id, hash: forecastConfig.object.determinism_hash },
        evidence_window: { ref: forecastEvidence.object_id, hash: forecastEvidence.determinism_hash },
        forcing_cycle_key: requiredStringV2(forecastPayload.forcing_cycle_key, "CAP06_FORCING_CYCLE_KEY_REQUIRED"),
        forcing_window_hash: requiredStringV2(forecastPayload.forcing_window_hash, "CAP06_FORCING_WINDOW_HASH_REQUIRED"),
        weather_snapshot: { ref: requiredStringV2(forecastPayload.weather_snapshot_ref, "CAP06_WEATHER_REF_REQUIRED"), hash: requiredStringV2(forecastPayload.weather_snapshot_hash, "CAP06_WEATHER_HASH_REQUIRED") },
        et0_snapshot: { ref: requiredStringV2(forecastPayload.et0_snapshot_ref, "CAP06_ET0_REF_REQUIRED"), hash: requiredStringV2(forecastPayload.et0_snapshot_hash, "CAP06_ET0_HASH_REQUIRED") },
        crop_stage_context: { ref: forecastPayload.crop_stage_context_ref, hash: forecastPayload.crop_stage_context_hash },
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
        context_lineage_ref: requiredStringV2(sourcePosterior.lineage_id, "CAP06_POSTERIOR_LINEAGE_REQUIRED"),
        context_revision_ref: requiredStringV2(sourcePosterior.revision_id, "CAP06_POSTERIOR_REVISION_REQUIRED"),
        forecast_runtime_config: { ref: forecastConfig.object.object_id, hash: forecastConfig.object.determinism_hash },
      },
      forecast_runtime_config: {
        ref: forecastConfig.object.object_id,
        hash: forecastConfig.object.determinism_hash,
        model_component_basis: modelBasisV2(forecastConfig.payload),
        effective_parameter_bundle_basis: parameterBasisV2(forecastConfig.payload),
        runtime_replay_numeric_policy_basis: numericBasisV2(forecastConfig.payload),
      },
      residual_runtime_config: {
        ref: residualConfig.object.object_id,
        hash: residualConfig.object.determinism_hash,
        residual_policy_basis: residualPolicyBasisV2(residualConfig.payload as unknown as Record<string, unknown>),
      },
      evidence_window: { ref: forecastEvidence.object_id, hash: forecastEvidence.determinism_hash, evidence_cutoff_at: evidenceCutoff },
      observation: { ref: observationRef, hash: observationHash, observed_at: observedAt, available_to_runtime_at: observationAvailableAt, quality, unit },
      weather_snapshot: { ref: requiredStringV2(weatherRecord.source_record_id, "CAP06_WEATHER_SELECTED_REF_REQUIRED"), hash: requiredStringV2(weatherRecord.source_record_hash, "CAP06_WEATHER_SELECTED_HASH_REQUIRED") },
      et0_snapshot: { ref: requiredStringV2(et0Record.source_record_id, "CAP06_ET0_SELECTED_REF_REQUIRED"), hash: requiredStringV2(et0Record.source_record_hash, "CAP06_ET0_SELECTED_HASH_REQUIRED") },
      crop_stage_context: { ref: requiredStringV2(configCropStage.context_ref, "CAP06_CROP_STAGE_REF_REQUIRED"), hash: requiredStringV2(configCropStage.context_hash, "CAP06_CROP_STAGE_HASH_REQUIRED") },
      root_zone_geometry: { ref: residualPayload.root_zone_geometry_ref, hash: residualPayload.root_zone_geometry_hash },
    };
  }

  async loadResolvedCaseGraphsV2(input: {
    scope: Cap06ScopeV2;
    lineage_id: string;
    revision_id: string;
  }): Promise<readonly Cap06ResolvedCaseGraphV2[]> {
    // Resolve all Residuals under one repeatable-read, read-only snapshot in deterministic event-time order.
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
          requiredStringV2(input.lineage_id, "CAP06_LINEAGE_REQUIRED"),
          requiredStringV2(input.revision_id, "CAP06_REVISION_REQUIRED"),
        ],
      );
      const graphs: Cap06ResolvedCaseGraphV2[] = [];
      for (const row of result.rows) {
        const residual = parseFactPayloadV2(row.record_json, "CAP06_RESIDUAL_FACT_INVALID") as unknown as Cap05ForecastResidualEnvelopeV1;
        graphs.push(await this.resolveOneV2({
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
