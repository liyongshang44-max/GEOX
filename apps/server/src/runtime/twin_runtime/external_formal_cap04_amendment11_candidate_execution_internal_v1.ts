// apps/server/src/runtime/twin_runtime/external_formal_cap04_candidate_execution_service_v1.ts
// Purpose: orchestrate one production persistence-free External Formal CAP04 candidate tick from explicit caller-supplied authority/evidence through frozen compatibility math to honest External A1/A2 canonical candidates.
// Boundary: no database, persistence, lease, provider fetch, filesystem, environment, scheduler, route, wall-clock read, Scenario creation, Recommendation, Action, model activation, or O00 execution.

import { composeAssimilatedContinuationPosteriorV1 } from "../../domain/soil_water/assimilated_continuation_posterior_v1.js";
import { normalizeFixedDecimalV1, WATER_AMOUNT_SCALE_V1 } from "../../domain/soil_water/fixed_point_water_decimal_v1.js";
import { executeHourlyWaterBalanceV1, type HourlyWaterBalanceConfigV1 } from "../../domain/soil_water/hourly_water_balance_v1.js";
import { computeMemberDeterminismHashV1 } from "../../domain/twin_runtime/canonical_identity_v1.js";
import { executeCap04Pure72hForecastMathV1 } from "../../domain/twin_runtime/pure_72h_forecast_math_v1.js";
import type { Cap04Pure72hForecastMathResultV1 } from "../../domain/twin_runtime/forecast_math_contracts_v1.js";
import type { Cap04ForecastForcingWindowV1 } from "../../domain/twin_runtime/future_forcing_contracts_v1.js";
import type { CanonicalObjectEnvelopeV1 } from "../../domain/twin_runtime/canonical_object_contracts_v1.js";
import { ExternalFormalCap04ExecutionConfigResolverV1 } from "../../domain/twin_runtime/external_formal_cap04_execution_config_resolver_v1.js";
import {
  MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_FORCING_BINDING_IDS_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
} from "../../domain/twin_runtime/external_formal_evidence_binding_profile_v1.js";
import {
  MCFT_CAP09_EXTERNAL_FORMAL_MODEL_PARAMETER_AUTHORITY_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_RUNTIME_MODE_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1,
  validateExternalFormalRuntimeConfigPayloadV1,
  type ExternalFormalRuntimeConfigPayloadV1,
} from "../../domain/twin_runtime/external_formal_runtime_config_v1.js";
import {
  buildExternalFormalBlockedForecastAuthorityV1,
  buildExternalFormalCompletedForecastAuthorityV1,
  type ExternalFormalBlockedForecastAuthorityViewV1,
  type ExternalFormalCompletedForecastAuthorityViewV1,
} from "../../domain/twin_runtime/external_formal_cap04_forecast_authority_v1.js";
import type { Cap04ARecordSetV1 } from "../../domain/twin_runtime/forecast_scenario_record_set_identity_v1.js";
import { buildAssimilatedContinuationEvidenceWindowV2, finalizeAssimilatedContinuationEvidenceWindowV2 } from "./assimilated_continuation_evidence_window_v2.js";
import type { ContinuationCropStageConfigurationContextV1 } from "./continuation_evidence_window_service_v1.js";
import { buildExternalFormalCap04StateSourceMembersV1 } from "./external_formal_cap04_state_source_builder_v1.js";
import {
  projectSignedEt0ToNonnegativeWaterLossDemandV1,
  type ExternalFormalEt0ConsumptionProjectionV1,
} from "./external_formal_et0_consumption_projection_v1.js";
import { validateExternalFormalCap04InputAuthorityV1, type ExternalFormalCap04InputAuthorityV1 } from "./external_formal_cap04_input_authority_v1.js";
import { selectCap04FutureForcingOutcomeV1, type Cap04FutureForcingOutcomeV1 } from "./future_forcing_outcome_classifier_v1.js";
import { buildCap04BlockedForecastPayloadV1 } from "./blocked_forecast_payload_builder_v1.js";
import {
  buildExternalFormalCap04BlockedA2RecordSetV1,
  buildExternalFormalCap04CompletedA1RecordSetV1,
  type ExternalFormalCap04ARecordSetCandidateV1,
} from "./external_formal_cap04_a_record_set_builder_v1.js";
import type { Cap04ARecordSetBuilderSourceMembersV1 } from "./forecast_continuation_record_set_builder_v1.js";
import type { CanonicalReplayEvidenceRecordV1, PreparedNextTickInputV1, TwinScopeKeyV1 } from "./ports.js";

export const EXTERNAL_FORMAL_CAP04_CANDIDATE_EXECUTION_SERVICE_ID_V1 =
  "MCFT_CAP09_EXTERNAL_FORMAL_CAP04_CANDIDATE_EXECUTION_SERVICE_V1" as const;
export const EXTERNAL_FORMAL_EXACT_INTERVAL_AVAILABILITY_CUTOFF_OFFSET_MINUTES_V1 = 432 as const;

export type ExecuteExternalFormalCap04CandidateInputV1 = {
  scope: TwinScopeKeyV1;
  logical_time: string;
  created_at: string;
  handoff: PreparedNextTickInputV1;
  runtime_config: CanonicalObjectEnvelopeV1;
  candidate_records: readonly CanonicalReplayEvidenceRecordV1[];
  crop_stage_context: ContinuationCropStageConfigurationContextV1;
  /** Amendment-11 successor seam. Historical callers may omit this and retain the frozen T+432 behavior. */
  evidence_snapshot_time?: string;
};

export type ExternalFormalCap04CandidateExecutionResultV1 = {
  service_id: typeof EXTERNAL_FORMAL_CAP04_CANDIDATE_EXECUTION_SERVICE_ID_V1;
  operation_variant: "A1" | "A2";
  input_authority: ExternalFormalCap04InputAuthorityV1;
  source_members: Cap04ARecordSetBuilderSourceMembersV1;
  forcing_outcome: Cap04FutureForcingOutcomeV1;
  forecast_authority: ExternalFormalCompletedForecastAuthorityViewV1 | ExternalFormalBlockedForecastAuthorityViewV1;
  record_set_candidate: ExternalFormalCap04ARecordSetCandidateV1;
  record_set: Cap04ARecordSetV1;
  runtime_mode: typeof MCFT_CAP09_EXTERNAL_FORMAL_RUNTIME_MODE_V1;
  model_parameter_authority: typeof MCFT_CAP09_EXTERNAL_FORMAL_MODEL_PARAMETER_AUTHORITY_V1;
  historical_et0_consumption_projection: ExternalFormalEt0ConsumptionProjectionV1;
  evidence_snapshot_time: string;
  evidence_snapshot_source: "CALLER_SUPPLIED" | "HISTORICAL_FIXED_432_DEFAULT";
  canonical_persistence_authorized: false;
  provider_request_count: 0;
  database_write_count: 0;
  scenario_write_count: 0;
  recommendation_write_count: 0;
  action_write_count: 0;
};

type ScopeLikeV1 = { tenant_id: string; project_id: string; group_id: string | null; field_id: string; season_id: string | null; zone_id: string | null };
type EvidenceSnapshotV1 = { time: string; source: "CALLER_SUPPLIED" | "HISTORICAL_FIXED_432_DEFAULT" };

function requiredStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}
function canonicalHourV1(value: unknown, code: string): string {
  const text = requiredStringV1(value, code);
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== text || !text.endsWith(":00:00.000Z")) throw new Error(code);
  return text;
}
function canonicalIsoV1(value: unknown, code: string): string {
  const text = requiredStringV1(value, code);
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== text) throw new Error(code);
  return text;
}
function exactScopeV1(actual: ScopeLikeV1, expected: TwinScopeKeyV1, code: string): void {
  for (const field of ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"] as const) {
    if (actual[field] !== expected[field]) throw new Error(`${code}:${field}`);
  }
}
function finiteNumberV1(value: unknown, code: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(code);
  return value;
}
function sortedUniqueStringsV1(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => value.trim()))].sort();
}
function exactIntervalAvailabilityCutoffV1(logicalTime: string): string {
  return new Date(Date.parse(logicalTime) + EXTERNAL_FORMAL_EXACT_INTERVAL_AVAILABILITY_CUTOFF_OFFSET_MINUTES_V1 * 60_000).toISOString();
}
function resolveEvidenceSnapshotV1(logicalTime: string, createdAt: string, supplied: string | undefined): EvidenceSnapshotV1 {
  if (supplied === undefined) {
    return { time: exactIntervalAvailabilityCutoffV1(logicalTime), source: "HISTORICAL_FIXED_432_DEFAULT" };
  }
  const snapshot = canonicalIsoV1(supplied, "EXTERNAL_CAP04_SERVICE_EVIDENCE_SNAPSHOT_TIME_INVALID");
  if (Date.parse(snapshot) < Date.parse(logicalTime)) throw new Error("EXTERNAL_CAP04_SERVICE_EVIDENCE_SNAPSHOT_BEFORE_LOGICAL_TIME");
  if (Date.parse(snapshot) > Date.parse(createdAt)) throw new Error("EXTERNAL_CAP04_SERVICE_EVIDENCE_SNAPSHOT_AFTER_CREATED_AT");
  return { time: snapshot, source: "CALLER_SUPPLIED" };
}

function dynamicsConfigV1(payload: ReturnType<ExternalFormalCap04ExecutionConfigResolverV1["resolveExecutionConfig"]>["payload"]): HourlyWaterBalanceConfigV1 {
  return {
    root_zone_depth_mm: payload.soil_hydraulic_snapshot.root_zone_depth_mm.toFixed(6),
    wilting_point_storage_mm: payload.soil_hydraulic_snapshot.wilting_point_storage_mm.toFixed(6),
    field_capacity_storage_mm: payload.soil_hydraulic_snapshot.field_capacity_storage_mm.toFixed(6),
    saturation_storage_mm: payload.soil_hydraulic_snapshot.saturation_storage_mm.toFixed(6),
    saturation_fraction: payload.soil_hydraulic_snapshot.saturation_fraction.toFixed(6),
    runoff_fraction: payload.dynamics_parameters.runoff_fraction.toFixed(6),
    drainage_coefficient_per_hour: payload.dynamics_parameters.drainage_coefficient_per_hour.toFixed(6),
    structural_process_stddev_mm_per_hour: payload.process_uncertainty.structural_process_stddev_mm_per_hour.toFixed(6),
    rainfall_relative_stddev: payload.process_uncertainty.rainfall_relative_stddev.toFixed(6),
    crop_et_relative_stddev: payload.process_uncertainty.crop_et_relative_stddev.toFixed(6),
    executed_irrigation_relative_stddev: payload.process_uncertainty.executed_irrigation_relative_stddev.toFixed(6),
  };
}

function stateBasisV1(state: CanonicalObjectEnvelopeV1) {
  const basis = state.payload.computation_basis as Record<string, unknown> | undefined;
  const mean = basis?.storage_mean_mm_decimal as { value?: unknown } | undefined;
  const variance = basis?.storage_variance_mm2_decimal as { value?: unknown } | undefined;
  if (typeof mean?.value !== "string" || typeof variance?.value !== "string") throw new Error("EXTERNAL_CAP04_SERVICE_STATE_DECIMAL_BASIS_REQUIRED");
  return { storage_mean_mm_decimal: mean.value, storage_variance_mm2_decimal: variance.value };
}

function externalRuntimeV1(config: CanonicalObjectEnvelopeV1, logicalTime: string): ExternalFormalRuntimeConfigPayloadV1 {
  if (config.object_type !== "twin_runtime_config_v1") throw new Error("EXTERNAL_CAP04_SERVICE_RUNTIME_CONFIG_OBJECT_TYPE_REQUIRED");
  if (config.logical_time !== logicalTime || config.as_of !== logicalTime) throw new Error("EXTERNAL_CAP04_SERVICE_RUNTIME_CONFIG_TIME_MISMATCH");
  validateExternalFormalRuntimeConfigPayloadV1(config.payload);
  const payload = config.payload as unknown as ExternalFormalRuntimeConfigPayloadV1;
  if (payload.config_role !== "HOURLY_CAP04" || payload.effective_logical_time !== logicalTime) throw new Error("EXTERNAL_CAP04_SERVICE_HOURLY_RUNTIME_CONFIG_REQUIRED");
  return payload;
}

function rebindRuntimeConfigAuthorityV1(value: unknown, runtimeConfigRef: string, runtimeConfigHash: string): unknown {
  if (Array.isArray(value)) return value.map((item) => rebindRuntimeConfigAuthorityV1(item, runtimeConfigRef, runtimeConfigHash));
  if (!value || typeof value !== "object") return value;
  const source = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(source)) {
    if (key === "runtime_config_ref") result[key] = runtimeConfigRef;
    else if (key === "runtime_config_hash") result[key] = runtimeConfigHash;
    else result[key] = rebindRuntimeConfigAuthorityV1(item, runtimeConfigRef, runtimeConfigHash);
  }
  return result;
}

function normalizeCompatibilityForecastRuntimeAuthorityV1(
  result: Cap04Pure72hForecastMathResultV1,
  runtimeConfig: CanonicalObjectEnvelopeV1,
): Cap04Pure72hForecastMathResultV1 {
  const window = result.forecast_payload.forcing_window_authority;
  if (window === null) throw new Error("EXTERNAL_CAP04_SERVICE_COMPATIBILITY_FORCING_WINDOW_REQUIRED");
  const normalizedWindow = rebindRuntimeConfigAuthorityV1(
    structuredClone(window),
    runtimeConfig.object_id,
    runtimeConfig.determinism_hash,
  ) as Cap04ForecastForcingWindowV1;
  return {
    ...structuredClone(result),
    forecast_payload: { ...structuredClone(result.forecast_payload), forcing_window_authority: normalizedWindow },
  };
}

function addHistoricalEt0ProjectionTraceV1(
  sourceMembers: Cap04ARecordSetBuilderSourceMembersV1,
  projection: ExternalFormalEt0ConsumptionProjectionV1,
): Cap04ARecordSetBuilderSourceMembersV1 {
  const traced = structuredClone(sourceMembers);
  const transition = traced.twin_state_transition_v1;
  transition.payload.historical_et0_consumption_projection = {
    policy_id: projection.transformation_ref,
    canonical_signed_et0_mm: projection.canonical_signed_et0_mm,
    model_water_loss_demand_mm: projection.model_water_loss_demand_mm,
    transformation_applied: projection.transformation_applied,
    limitations: [...projection.limitations],
  };
  transition.limitations = sortedUniqueStringsV1([
    ...transition.limitations,
    ...projection.limitations,
  ]);
  transition.determinism_hash = computeMemberDeterminismHashV1(transition as unknown as Record<string, unknown>);
  return traced;
}

function commonRecordSetInputV1(input: ExecuteExternalFormalCap04CandidateInputV1, sourceMembers: Cap04ARecordSetBuilderSourceMembersV1) {
  return {
    scope: input.scope,
    lineage_id: input.handoff.lineage_id,
    revision_id: input.handoff.revision_id,
    logical_time: input.logical_time,
    created_at: input.created_at,
    active_lineage_ref: input.handoff.active_lineage_ref,
    previous_posterior_ref: input.handoff.previous_posterior_ref,
    previous_posterior_hash: input.handoff.previous_posterior_hash,
    previous_checkpoint_ref: input.handoff.previous_checkpoint_ref,
    previous_checkpoint_hash: input.handoff.previous_checkpoint_hash,
    previous_forecast_result_ref: input.handoff.previous_forecast_result_ref,
    previous_forecast_result_hash: input.handoff.previous_forecast_result_hash ?? `sha256:${input.handoff.previous_forecast_result_ref}`,
    previous_successful_forecast_ref: input.handoff.latest_successful_forecast_ref,
    previous_tick_sequence: input.handoff.previous_tick_sequence,
    runtime_config: input.runtime_config,
    source_members: sourceMembers,
  };
}

function resultV1(input: {
  operation_variant: "A1" | "A2";
  input_authority: ExternalFormalCap04InputAuthorityV1;
  source_members: Cap04ARecordSetBuilderSourceMembersV1;
  forcing_outcome: Cap04FutureForcingOutcomeV1;
  forecast_authority: ExternalFormalCompletedForecastAuthorityViewV1 | ExternalFormalBlockedForecastAuthorityViewV1;
  record_set_candidate: ExternalFormalCap04ARecordSetCandidateV1;
  historical_et0_consumption_projection: ExternalFormalEt0ConsumptionProjectionV1;
  evidence_snapshot: EvidenceSnapshotV1;
}): ExternalFormalCap04CandidateExecutionResultV1 {
  return {
    service_id: EXTERNAL_FORMAL_CAP04_CANDIDATE_EXECUTION_SERVICE_ID_V1,
    operation_variant: input.operation_variant,
    input_authority: input.input_authority,
    source_members: input.source_members,
    forcing_outcome: input.forcing_outcome,
    forecast_authority: input.forecast_authority,
    record_set_candidate: input.record_set_candidate,
    record_set: input.record_set_candidate.record_set,
    runtime_mode: MCFT_CAP09_EXTERNAL_FORMAL_RUNTIME_MODE_V1,
    model_parameter_authority: MCFT_CAP09_EXTERNAL_FORMAL_MODEL_PARAMETER_AUTHORITY_V1,
    historical_et0_consumption_projection: structuredClone(input.historical_et0_consumption_projection),
    evidence_snapshot_time: input.evidence_snapshot.time,
    evidence_snapshot_source: input.evidence_snapshot.source,
    canonical_persistence_authorized: false,
    provider_request_count: 0,
    database_write_count: 0,
    scenario_write_count: 0,
    recommendation_write_count: 0,
    action_write_count: 0,
  };
}

export function executeExternalFormalCap04CandidateV1(input: ExecuteExternalFormalCap04CandidateInputV1): ExternalFormalCap04CandidateExecutionResultV1 {
  const logicalTime = canonicalHourV1(input.logical_time, "EXTERNAL_CAP04_SERVICE_LOGICAL_TIME_INVALID");
  const createdAt = canonicalIsoV1(input.created_at, "EXTERNAL_CAP04_SERVICE_CREATED_AT_INVALID");
  const evidenceSnapshot = resolveEvidenceSnapshotV1(logicalTime, createdAt, input.evidence_snapshot_time);
  exactScopeV1(input.scope, { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 }, "EXTERNAL_CAP04_SERVICE_SCOPE_MISMATCH");
  exactScopeV1(input.handoff, input.scope, "EXTERNAL_CAP04_SERVICE_HANDOFF_SCOPE_MISMATCH");
  if (input.handoff.next_logical_tick_time !== logicalTime) throw new Error("EXTERNAL_CAP04_SERVICE_HANDOFF_TIME_MISMATCH");
  const externalRuntime = externalRuntimeV1(input.runtime_config, logicalTime);
  if (input.handoff.reality_binding_ref !== externalRuntime.reality_binding_ref || input.handoff.reality_binding_hash !== externalRuntime.reality_binding_hash) {
    throw new Error("EXTERNAL_CAP04_SERVICE_REALITY_BINDING_MISMATCH");
  }

  const inputAuthority = validateExternalFormalCap04InputAuthorityV1({
    scope: input.scope,
    logical_time: logicalTime,
    runtime_config: input.runtime_config,
    candidate_records: input.candidate_records,
    crop_stage_context: input.crop_stage_context,
  });
  const compatibility = new ExternalFormalCap04ExecutionConfigResolverV1().resolveExecutionConfig(input.runtime_config).payload;
  const preliminary = buildAssimilatedContinuationEvidenceWindowV2({
    scope: input.scope,
    logical_time: logicalTime,
    candidate_records: input.candidate_records,
    saturation_fraction: compatibility.soil_hydraulic_snapshot.saturation_fraction,
    crop_stage_context_ref: externalRuntime.crop_stage_context_authority.context_ref,
    crop_stage_context_hash: externalRuntime.crop_stage_context_authority.context_hash,
    crop_stage_context: input.crop_stage_context,
    authorized_soil_observation_binding_id: MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
    evidence_snapshot_time: evidenceSnapshot.time,
  });
  const base = preliminary.base_continuation_window;
  const historicalEt0Projection = projectSignedEt0ToNonnegativeWaterLossDemandV1(
    finiteNumberV1(base.historical_et0_record.canonical_payload.value, "EXTERNAL_CAP04_SERVICE_HISTORICAL_ET0_REQUIRED"),
    "EXTERNAL_CAP04_SERVICE_HISTORICAL_ET0_REQUIRED",
  );
  const dynamics = executeHourlyWaterBalanceV1({
    interval_start_exclusive: base.window_start_exclusive,
    interval_end_inclusive: base.window_end_inclusive,
    previous_storage_mm_decimal: input.handoff.previous_storage_mm_decimal,
    previous_variance_basis: input.handoff.previous_variance_basis,
    gross_rainfall_mm_decimal: normalizeFixedDecimalV1(String(finiteNumberV1(base.rainfall_record.canonical_payload.value, "EXTERNAL_CAP04_SERVICE_RAINFALL_REQUIRED")), WATER_AMOUNT_SCALE_V1),
    historical_et0_mm_decimal: normalizeFixedDecimalV1(String(historicalEt0Projection.model_water_loss_demand_mm), WATER_AMOUNT_SCALE_V1),
    crop_stage_code: base.crop_stage_context.stage_code,
    kc_decimal: normalizeFixedDecimalV1(String(base.crop_stage_context.kc), WATER_AMOUNT_SCALE_V1),
    executed_irrigation_candidates: [],
    config: dynamicsConfigV1(compatibility),
  });
  const assimilation = composeAssimilatedContinuationPosteriorV1({
    prior_mean: Number(dynamics.published_state.root_zone_vwc_fraction.mean),
    prior_variance: Number(dynamics.published_state.root_zone_vwc_fraction.variance),
    selected_observation: preliminary.observation_selection.selected_observation as never,
    saturation_fraction: compatibility.soil_hydraulic_snapshot.saturation_fraction,
    root_zone_depth_mm: compatibility.soil_hydraulic_snapshot.root_zone_depth_mm,
    sensor_measurement_stddev_fraction: compatibility.observation_assimilation.sensor_measurement_stddev_fraction,
    point_to_zone_representativeness_stddev_fraction: compatibility.observation_assimilation.point_to_zone_representativeness_stddev_fraction,
    quality_weights: compatibility.observation_assimilation.quality_weights,
  });
  const evidence = finalizeAssimilatedContinuationEvidenceWindowV2({ window: preliminary, assimilation });
  const sourceMembers = addHistoricalEt0ProjectionTraceV1(buildExternalFormalCap04StateSourceMembersV1({
    scope: input.scope,
    logical_time: logicalTime,
    created_at: input.created_at,
    handoff: input.handoff,
    runtime_config: input.runtime_config,
    compatibility_execution_config_payload: compatibility,
    evidence_window: evidence,
    dynamics,
    compatibility_assimilation: assimilation,
  }), historicalEt0Projection);
  const sourceState = sourceMembers.twin_state_estimate_v1;
  const forcingOutcome = selectCap04FutureForcingOutcomeV1({
    scope: input.scope,
    logical_time: logicalTime,
    candidate_records: input.candidate_records,
    authorized_binding_ids: MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_FORCING_BINDING_IDS_V1,
    crop_stage_context: {
      ref: compatibility.crop_stage_context.context_ref,
      hash: compatibility.crop_stage_context.context_hash,
      crop_stage_code: base.crop_stage_context.stage_code,
      kc: base.crop_stage_context.kc,
    },
    runtime_config: { ref: input.runtime_config.object_id, hash: input.runtime_config.determinism_hash },
  });

  if (forcingOutcome.status === "FAILED") throw new Error(`EXTERNAL_CAP04_SERVICE_FUTURE_FORCING_FAILED:${forcingOutcome.reason_codes.join("|")}`);

  if (forcingOutcome.status === "BLOCKED") {
    const compatibilityBlocked = buildCap04BlockedForecastPayloadV1({
      issued_at: logicalTime,
      source_posterior_ref: sourceState.object_id,
      source_posterior_hash: sourceState.determinism_hash,
      runtime_config_ref: input.runtime_config.object_id,
      runtime_config_hash: input.runtime_config.determinism_hash,
      runtime_config_payload: compatibility,
      reason_codes: forcingOutcome.reason_codes,
      limitations: ["EXTERNAL_FORMAL_CAP04_CANDIDATE_SERVICE_BLOCKED_PATH"],
    });
    const forecastAuthority = buildExternalFormalBlockedForecastAuthorityV1({ compatibility_forecast: compatibilityBlocked, runtime_config: input.runtime_config });
    const candidate = buildExternalFormalCap04BlockedA2RecordSetV1({ ...commonRecordSetInputV1(input, sourceMembers), forecast_payload: forecastAuthority.forecast_candidate });
    return resultV1({ operation_variant: "A2", input_authority: inputAuthority, source_members: sourceMembers, forcing_outcome: forcingOutcome, forecast_authority: forecastAuthority, record_set_candidate: candidate, historical_et0_consumption_projection: historicalEt0Projection, evidence_snapshot: evidenceSnapshot });
  }

  const compatibilityForecastMath = executeCap04Pure72hForecastMathV1({
    source_posterior: { ref: sourceState.object_id, hash: sourceState.determinism_hash, logical_time: logicalTime, computation_basis: stateBasisV1(sourceState) },
    runtime_config: { ref: input.runtime_config.object_id, hash: input.runtime_config.determinism_hash, payload: compatibility },
    forcing_window: forcingOutcome.window,
  });
  const normalizedCompatibilityForecastMath = normalizeCompatibilityForecastRuntimeAuthorityV1(compatibilityForecastMath, input.runtime_config);
  const forecastAuthority = buildExternalFormalCompletedForecastAuthorityV1({ compatibility_result: normalizedCompatibilityForecastMath, runtime_config: input.runtime_config });
  const candidate = buildExternalFormalCap04CompletedA1RecordSetV1({ ...commonRecordSetInputV1(input, sourceMembers), forecast_payload: forecastAuthority.forecast_candidate });
  return resultV1({ operation_variant: "A1", input_authority: inputAuthority, source_members: sourceMembers, forcing_outcome: forcingOutcome, forecast_authority: forecastAuthority, record_set_candidate: candidate, historical_et0_consumption_projection: historicalEt0Projection, evidence_snapshot: evidenceSnapshot });
}