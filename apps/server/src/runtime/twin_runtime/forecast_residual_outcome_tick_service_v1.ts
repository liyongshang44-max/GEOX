// apps/server/src/runtime/twin_runtime/forecast_residual_outcome_tick_service_v1.ts
// Purpose: execute one existing CAP-04 A1/B outcome tick, match its exact observation to one historical post-receipt Forecast point, and append one idempotent C_FORECAST_RESIDUAL_COMMIT.
// Boundary: one caller-requested tick plus one C commit only; no range loop, restart/backfill, scheduler, route, web, Recommendation, AO-ACT, causal attribution, calibration, model activation, CAP-06 authority or new transaction family.

import {
  WATER_AMOUNT_SCALE_V1,
  WATER_VARIANCE_SCALE_V1,
  normalizeFixedDecimalV1,
} from "../../domain/soil_water/fixed_point_water_decimal_v1.js";
import type { CanonicalObjectEnvelopeV1 } from "../../domain/twin_runtime/canonical_object_contracts_v1.js";
import {
  buildCap05ForecastResidualV1,
  CAP05_FORECAST_ASSIMILATION_RELATION_POLICY_V1,
  CAP05_FORECAST_OBSERVATION_PROJECTION_METHOD_ID_V1,
  CAP05_FORECAST_OBSERVATION_PROJECTION_METHOD_VERSION_V1,
  CAP05_FORECAST_POINT_MEMBER_REF_POLICY_ID_V1,
  CAP05_FORECAST_RESIDUAL_MATCHING_POLICY_ID_V1,
  CAP05_FORECAST_RESIDUAL_NORMALIZATION_BASIS_V1,
  type Cap05ForecastResidualEnvelopeV1,
} from "../../domain/twin_runtime/forecast_observation_residual_v1.js";
import type { Cap05PersistedObjectV1, Cap05PersistenceResultV1 } from "../../persistence/twin_runtime/postgres_feedback_persistence_repository_v1.js";
import type {
  ExecuteCap04SingleTickInputV1,
  ExecuteCap04SingleTickResultV1,
} from "./forecast_scenario_single_tick_service_v1.js";
import {
  selectHistoricalForecastForResidualV1,
  type Cap05HistoricalForecastResidualCandidateV1,
  type Cap05HistoricalForecastSelectionTraceV1,
} from "./historical_forecast_residual_selector_v1.js";
import type { RuntimeConfigRepositoryPortV1, TwinScopeKeyV1 } from "./ports.js";

export const CAP05_FORECAST_RESIDUAL_OUTCOME_TICK_SERVICE_ID_V1 =
  "CAP05_FORECAST_RESIDUAL_OUTCOME_TICK_SERVICE_V1" as const;
export const CAP05_FORECAST_RESIDUAL_RELATION_TRACE_ID_V1 =
  "FORECAST_RESIDUAL_VS_ASSIMILATION_INNOVATION_TRACE_V1" as const;

export type Cap05ForecastResidualHistoricalSourcePortV1 = {
  loadHistoricalForecastCandidates(input: {
    scope: TwinScopeKeyV1;
    lineage_id: string;
    revision_id: string;
    observation_target_time: string;
    observation_available_to_runtime_at: string;
  }): Promise<readonly Cap05HistoricalForecastResidualCandidateV1[]>;
};

export type Cap05ForecastResidualTickExecutionPortV1 = {
  executeOneTick(input: ExecuteCap04SingleTickInputV1): Promise<ExecuteCap04SingleTickResultV1>;
};

export type Cap05ForecastResidualPersistencePortV1 = {
  lookupByIdempotencyKey(idempotencyKey: string): Promise<Cap05PersistedObjectV1 | null>;
  commitCanonicalObject(input: { object: Cap05ForecastResidualEnvelopeV1 }): Promise<Cap05PersistenceResultV1>;
  readCanonicalObject(objectId: string): Promise<Cap05PersistedObjectV1 | null>;
};

export type Cap05ForecastAssimilationRelationTraceV1 = {
  trace_id: typeof CAP05_FORECAST_RESIDUAL_RELATION_TRACE_ID_V1;
  observation_ref: string;
  observation_hash: string;
  observation_value: string;
  observation_operator_id: "POINT_200MM_TO_ROOT_ZONE_MEAN_H1_WITH_REPRESENTATIVENESS_V1";
  historical_forecast_prediction: string;
  historical_forecast_residual: string;
  current_tick_propagated_prior_prediction: string;
  current_tick_assimilation_innovation: string;
  shared_observation: true;
  predictions_equal: boolean;
  residual_and_innovation_equal: boolean;
  equivalence_claimed: false;
  causal_effect_claimed: false;
};

export type ExecuteCap05ForecastResidualOutcomeTickResultV1 = {
  service_id: typeof CAP05_FORECAST_RESIDUAL_OUTCOME_TICK_SERVICE_ID_V1;
  tick: ExecuteCap04SingleTickResultV1;
  residual_status: Cap05PersistenceResultV1["status"];
  residual: Cap05ForecastResidualEnvelopeV1;
  residual_fact_id: string;
  forecast_selection_trace: Cap05HistoricalForecastSelectionTraceV1;
  relation_trace: Cap05ForecastAssimilationRelationTraceV1;
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

function requiredRecordV1(value: unknown, code: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
  return value as Record<string, unknown>;
}

function requiredFiniteNumberV1(value: unknown, code: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(code);
  return value;
}

function exactMemberV1(
  result: ExecuteCap04SingleTickResultV1,
  objectType: CanonicalObjectEnvelopeV1["object_type"],
): CanonicalObjectEnvelopeV1 {
  const matches = result.a_record_set.members.filter((member) => member.object_type === objectType);
  if (matches.length !== 1) throw new Error(`CAP05_RESIDUAL_OUTCOME_MEMBER_CARDINALITY:${objectType}`);
  return matches[0];
}

function exactScopeV1(object: CanonicalObjectEnvelopeV1, scope: TwinScopeKeyV1, code: string): void {
  if (object.tenant_id !== scope.tenant_id
    || object.project_id !== scope.project_id
    || object.group_id !== scope.group_id
    || object.field_id !== scope.field_id
    || object.season_id !== scope.season_id
    || object.zone_id !== scope.zone_id) throw new Error(code);
}

function exactConfigPolicyV1(
  payload: Record<string, unknown>,
  field: string,
  expected: string,
): void {
  if (payload[field] !== expected) throw new Error(`CAP05_RESIDUAL_OUTCOME_CONFIG_POLICY_MISMATCH:${field}`);
}

export function validateCap05ForecastResidualRuntimePoliciesV1(value: unknown): void {
  const payload = requiredRecordV1(value, "CAP05_RESIDUAL_OUTCOME_RUNTIME_CONFIG_PAYLOAD_REQUIRED");
  exactConfigPolicyV1(payload, "forecast_residual_matching_policy_id", CAP05_FORECAST_RESIDUAL_MATCHING_POLICY_ID_V1);
  exactConfigPolicyV1(payload, "forecast_point_member_ref_policy_id", CAP05_FORECAST_POINT_MEMBER_REF_POLICY_ID_V1);
  exactConfigPolicyV1(payload, "forecast_observation_projection_method_id", CAP05_FORECAST_OBSERVATION_PROJECTION_METHOD_ID_V1);
  exactConfigPolicyV1(payload, "forecast_observation_projection_version", CAP05_FORECAST_OBSERVATION_PROJECTION_METHOD_VERSION_V1);
  exactConfigPolicyV1(payload, "forecast_residual_normalization_policy_id", CAP05_FORECAST_RESIDUAL_NORMALIZATION_BASIS_V1);
  exactConfigPolicyV1(payload, "forecast_assimilation_relation_policy_id", CAP05_FORECAST_ASSIMILATION_RELATION_POLICY_V1);
}

function currentObservationV1(input: {
  tick: ExecuteCap04SingleTickResultV1;
  scope: TwinScopeKeyV1;
  logical_time: string;
}): {
  evidence: CanonicalObjectEnvelopeV1;
  assimilation: CanonicalObjectEnvelopeV1;
  state: CanonicalObjectEnvelopeV1;
  observation_ref: string;
  observation_hash: string;
  observed_at: string;
  available_to_runtime_at: string;
  quality: "PASS" | "LIMITED";
  value: string;
  observation_variance: string;
  representativeness_variance: string;
  predicted_observation: string;
  innovation: string;
  operator_id: "POINT_200MM_TO_ROOT_ZONE_MEAN_H1_WITH_REPRESENTATIVENESS_V1";
} {
  const evidence = exactMemberV1(input.tick, "twin_evidence_window_v1");
  const assimilation = exactMemberV1(input.tick, "twin_assimilation_update_v1");
  const state = exactMemberV1(input.tick, "twin_state_estimate_v1");
  for (const member of [evidence, assimilation, state]) {
    exactScopeV1(member, input.scope, "CAP05_RESIDUAL_OUTCOME_MEMBER_SCOPE_MISMATCH");
    if (member.logical_time !== input.logical_time) throw new Error("CAP05_RESIDUAL_OUTCOME_MEMBER_TIME_MISMATCH");
  }
  if (evidence.lineage_id !== assimilation.lineage_id
    || evidence.lineage_id !== state.lineage_id
    || evidence.revision_id !== assimilation.revision_id
    || evidence.revision_id !== state.revision_id) {
    throw new Error("CAP05_RESIDUAL_OUTCOME_MEMBER_CONTEXT_MISMATCH");
  }
  const selection = requiredRecordV1(
    evidence.payload.observation_selection,
    "CAP05_RESIDUAL_OUTCOME_OBSERVATION_SELECTION_REQUIRED",
  );
  const selected = requiredRecordV1(
    selection.selected_observation,
    "CAP05_RESIDUAL_OUTCOME_SELECTED_OBSERVATION_REQUIRED",
  );
  const observationRef = requiredStringV1(selected.observation_ref, "CAP05_RESIDUAL_OUTCOME_OBSERVATION_REF_REQUIRED");
  const observationHash = requiredStringV1(selected.source_record_hash, "CAP05_RESIDUAL_OUTCOME_OBSERVATION_HASH_REQUIRED");
  const observedAt = canonicalInstantV1(selected.observed_at, "CAP05_RESIDUAL_OUTCOME_OBSERVED_AT_INVALID");
  const availableAt = canonicalInstantV1(selected.available_to_runtime_at, "CAP05_RESIDUAL_OUTCOME_AVAILABLE_AT_INVALID");
  if (observedAt !== input.logical_time) throw new Error("CAP05_RESIDUAL_OUTCOME_OBSERVATION_TARGET_TIME_MISMATCH");
  if (Date.parse(availableAt) > Date.parse(input.logical_time)) throw new Error("CAP05_RESIDUAL_OUTCOME_OBSERVATION_LATE");
  const qualityValue = selected.quality_status
    ?? requiredRecordV1(selected.quality, "CAP05_RESIDUAL_OUTCOME_OBSERVATION_QUALITY_REQUIRED").status;
  if (qualityValue !== "PASS" && qualityValue !== "LIMITED") {
    throw new Error("CAP05_RESIDUAL_OUTCOME_OBSERVATION_QUALITY_UNUSABLE");
  }
  const observationValue = requiredFiniteNumberV1(selected.canonical_value, "CAP05_RESIDUAL_OUTCOME_OBSERVATION_VALUE_REQUIRED");
  const assimilationPayload = assimilation.payload;
  if (assimilationPayload.status !== "APPLIED"
    || assimilationPayload.selected_observation_ref !== observationRef) {
    throw new Error("CAP05_RESIDUAL_OUTCOME_ASSIMILATION_NOT_APPLIED_TO_OBSERVATION");
  }
  const actualObservation = requiredFiniteNumberV1(
    assimilationPayload.actual_observation,
    "CAP05_RESIDUAL_OUTCOME_ASSIMILATION_ACTUAL_REQUIRED",
  );
  if (actualObservation !== observationValue) throw new Error("CAP05_RESIDUAL_OUTCOME_SHARED_OBSERVATION_VALUE_MISMATCH");
  const operator = requiredRecordV1(
    assimilationPayload.observation_operator,
    "CAP05_RESIDUAL_OUTCOME_OBSERVATION_OPERATOR_REQUIRED",
  );
  if (operator.id !== "POINT_200MM_TO_ROOT_ZONE_MEAN_H1_WITH_REPRESENTATIVENESS_V1"
    || operator.h !== 1
    || operator.direct_state_equivalence !== false) {
    throw new Error("CAP05_RESIDUAL_OUTCOME_OBSERVATION_OPERATOR_MISMATCH");
  }
  const observationVariance = requiredFiniteNumberV1(
    assimilationPayload.observation_variance,
    "CAP05_RESIDUAL_OUTCOME_OBSERVATION_VARIANCE_REQUIRED",
  );
  const representativenessVariance = requiredFiniteNumberV1(
    assimilationPayload.representativeness_variance,
    "CAP05_RESIDUAL_OUTCOME_REPRESENTATIVENESS_VARIANCE_REQUIRED",
  );
  if (observationVariance < 0 || representativenessVariance < 0) {
    throw new Error("CAP05_RESIDUAL_OUTCOME_OBSERVATION_VARIANCE_NEGATIVE");
  }
  return {
    evidence,
    assimilation,
    state,
    observation_ref: observationRef,
    observation_hash: observationHash,
    observed_at: observedAt,
    available_to_runtime_at: availableAt,
    quality: qualityValue,
    value: normalizeFixedDecimalV1(String(observationValue), WATER_AMOUNT_SCALE_V1, "CAP05_RESIDUAL_OUTCOME_OBSERVATION_VALUE_INVALID"),
    observation_variance: normalizeFixedDecimalV1(String(observationVariance), WATER_VARIANCE_SCALE_V1, "CAP05_RESIDUAL_OUTCOME_OBSERVATION_VARIANCE_INVALID"),
    representativeness_variance: normalizeFixedDecimalV1(String(representativenessVariance), WATER_VARIANCE_SCALE_V1, "CAP05_RESIDUAL_OUTCOME_REPRESENTATIVENESS_VARIANCE_INVALID"),
    predicted_observation: normalizeFixedDecimalV1(String(requiredFiniteNumberV1(assimilationPayload.predicted_observation, "CAP05_RESIDUAL_OUTCOME_ASSIMILATION_PREDICTION_REQUIRED")), WATER_AMOUNT_SCALE_V1, "CAP05_RESIDUAL_OUTCOME_ASSIMILATION_PREDICTION_INVALID"),
    innovation: normalizeFixedDecimalV1(String(requiredFiniteNumberV1(assimilationPayload.innovation, "CAP05_RESIDUAL_OUTCOME_ASSIMILATION_INNOVATION_REQUIRED")), WATER_AMOUNT_SCALE_V1, "CAP05_RESIDUAL_OUTCOME_ASSIMILATION_INNOVATION_INVALID"),
    operator_id: "POINT_200MM_TO_ROOT_ZONE_MEAN_H1_WITH_REPRESENTATIVENESS_V1",
  };
}

function relationTraceV1(input: {
  observation_ref: string;
  observation_hash: string;
  observation_value: string;
  historical_prediction: string;
  historical_residual: string;
  current_prediction: string;
  current_innovation: string;
}): Cap05ForecastAssimilationRelationTraceV1 {
  return {
    trace_id: CAP05_FORECAST_RESIDUAL_RELATION_TRACE_ID_V1,
    observation_ref: input.observation_ref,
    observation_hash: input.observation_hash,
    observation_value: input.observation_value,
    observation_operator_id: "POINT_200MM_TO_ROOT_ZONE_MEAN_H1_WITH_REPRESENTATIVENESS_V1",
    historical_forecast_prediction: input.historical_prediction,
    historical_forecast_residual: input.historical_residual,
    current_tick_propagated_prior_prediction: input.current_prediction,
    current_tick_assimilation_innovation: input.current_innovation,
    shared_observation: true,
    predictions_equal: input.historical_prediction === input.current_prediction,
    residual_and_innovation_equal: input.historical_residual === input.current_innovation,
    equivalence_claimed: false,
    causal_effect_claimed: false,
  };
}

export class Cap05ForecastResidualOutcomeTickServiceV1 {
  constructor(
    private readonly tickService: Cap05ForecastResidualTickExecutionPortV1,
    private readonly runtimeConfigRepository: RuntimeConfigRepositoryPortV1,
    private readonly historicalForecastSource: Cap05ForecastResidualHistoricalSourcePortV1,
    private readonly residualPersistence: Cap05ForecastResidualPersistencePortV1,
  ) {}

  async executeOneTickAndCommitResidual(
    input: ExecuteCap04SingleTickInputV1,
  ): Promise<ExecuteCap05ForecastResidualOutcomeTickResultV1> {
    const logicalTime = canonicalInstantV1(input.logical_time, "CAP05_RESIDUAL_OUTCOME_LOGICAL_TIME_INVALID");
    const tick = await this.tickService.executeOneTick(input);
    if (!tick.b_record) throw new Error("CAP05_RESIDUAL_OUTCOME_SUCCESSFUL_A1_AND_B_REQUIRED");
    const forecast = exactMemberV1(tick, "twin_forecast_run_v1");
    if (forecast.payload.status !== "COMPLETED"
      || !Array.isArray(forecast.payload.points)
      || forecast.payload.points.length !== 72) {
      throw new Error("CAP05_RESIDUAL_OUTCOME_CURRENT_FORECAST_COMPLETED_REQUIRED");
    }
    const observation = currentObservationV1({ tick, scope: input.scope, logical_time: logicalTime });
    const runtimeConfig = await this.runtimeConfigRepository.readRuntimeConfig(input.runtime_config_ref);
    if (!runtimeConfig
      || runtimeConfig.object_type !== "twin_runtime_config_v1"
      || runtimeConfig.determinism_hash !== input.runtime_config_hash) {
      throw new Error("CAP05_RESIDUAL_OUTCOME_RUNTIME_CONFIG_MISMATCH");
    }
    exactScopeV1(runtimeConfig, input.scope, "CAP05_RESIDUAL_OUTCOME_RUNTIME_CONFIG_SCOPE_MISMATCH");
    validateCap05ForecastResidualRuntimePoliciesV1(runtimeConfig.payload);
    const configPayload = requiredRecordV1(runtimeConfig.payload, "CAP05_RESIDUAL_OUTCOME_RUNTIME_CONFIG_PAYLOAD_REQUIRED");
    const hydraulic = requiredRecordV1(
      configPayload.soil_hydraulic_snapshot,
      "CAP05_RESIDUAL_OUTCOME_SOIL_HYDRAULIC_SNAPSHOT_REQUIRED",
    );
    const rootZoneDepth = normalizeFixedDecimalV1(
      String(requiredFiniteNumberV1(hydraulic.root_zone_depth_mm, "CAP05_RESIDUAL_OUTCOME_ROOT_ZONE_DEPTH_REQUIRED")),
      WATER_AMOUNT_SCALE_V1,
      "CAP05_RESIDUAL_OUTCOME_ROOT_ZONE_DEPTH_INVALID",
    );
    const candidates = await this.historicalForecastSource.loadHistoricalForecastCandidates({
      scope: input.scope,
      lineage_id: requiredStringV1(observation.state.lineage_id, "CAP05_RESIDUAL_OUTCOME_LINEAGE_REQUIRED"),
      revision_id: requiredStringV1(observation.state.revision_id, "CAP05_RESIDUAL_OUTCOME_REVISION_REQUIRED"),
      observation_target_time: observation.observed_at,
      observation_available_to_runtime_at: observation.available_to_runtime_at,
    });
    const selection = selectHistoricalForecastForResidualV1({
      scope: input.scope,
      lineage_id: requiredStringV1(observation.state.lineage_id, "CAP05_RESIDUAL_OUTCOME_LINEAGE_REQUIRED"),
      revision_id: requiredStringV1(observation.state.revision_id, "CAP05_RESIDUAL_OUTCOME_REVISION_REQUIRED"),
      observation_target_time: observation.observed_at,
      observation_available_to_runtime_at: observation.available_to_runtime_at,
      candidates,
    });
    const residual = buildCap05ForecastResidualV1({
      scope: input.scope,
      forecast_run_ref: selection.forecast.object_id,
      forecast_run_hash: selection.forecast.determinism_hash,
      forecast_issued_at: selection.payload.issued_at,
      forecast_point_ref: selection.forecast_point_ref,
      forecast_point: selection.point,
      root_zone_geometry_ref: requiredStringV1(configPayload.reality_binding_ref, "CAP05_RESIDUAL_OUTCOME_GEOMETRY_REF_REQUIRED"),
      root_zone_geometry_hash: requiredStringV1(configPayload.reality_binding_hash, "CAP05_RESIDUAL_OUTCOME_GEOMETRY_HASH_REQUIRED"),
      root_zone_depth_mm: rootZoneDepth,
      actual_observation_ref: observation.observation_ref,
      actual_observation_hash: observation.observation_hash,
      actual_observation_observed_at: observation.observed_at,
      actual_observation_quality: observation.quality,
      actual_observation_value: observation.value,
      actual_observation_variance: observation.observation_variance,
      representativeness_variance: observation.representativeness_variance,
      runtime_config_ref: runtimeConfig.object_id,
      runtime_config_hash: runtimeConfig.determinism_hash,
      context_lineage_ref: requiredStringV1(observation.state.lineage_id, "CAP05_RESIDUAL_OUTCOME_CONTEXT_LINEAGE_REQUIRED"),
      context_revision_ref: requiredStringV1(observation.state.revision_id, "CAP05_RESIDUAL_OUTCOME_CONTEXT_REVISION_REQUIRED"),
      observation_available_to_runtime_at: observation.available_to_runtime_at,
      assimilation_update_ref: observation.assimilation.object_id,
      assimilation_update_hash: observation.assimilation.determinism_hash,
      created_at: input.created_at,
    });
    const committed = await this.residualPersistence.commitCanonicalObject({ object: residual });
    if (committed.object.object_type !== "twin_forecast_residual_v1"
      || committed.object.object_id !== residual.object_id
      || committed.object.determinism_hash !== residual.determinism_hash) {
      throw new Error("CAP05_RESIDUAL_OUTCOME_COMMIT_READBACK_MISMATCH");
    }
    const readback = await this.residualPersistence.readCanonicalObject(residual.object_id);
    if (!readback
      || readback.object_type !== "twin_forecast_residual_v1"
      || readback.determinism_hash !== residual.determinism_hash) {
      throw new Error("CAP05_RESIDUAL_OUTCOME_CANONICAL_READBACK_MISMATCH");
    }
    return {
      service_id: CAP05_FORECAST_RESIDUAL_OUTCOME_TICK_SERVICE_ID_V1,
      tick,
      residual_status: committed.status,
      residual: structuredClone(readback as Cap05ForecastResidualEnvelopeV1),
      residual_fact_id: committed.fact_id,
      forecast_selection_trace: selection.trace,
      relation_trace: relationTraceV1({
        observation_ref: observation.observation_ref,
        observation_hash: observation.observation_hash,
        observation_value: observation.value,
        historical_prediction: residual.payload.predicted_observation_value,
        historical_residual: residual.payload.residual_value,
        current_prediction: observation.predicted_observation,
        current_innovation: observation.innovation,
      }),
    };
  }
}
