// Purpose: execute one production-facing Amendment-19 persistence-free canonical tick using the same semantic core intended for the persistent Formal path.
// Boundary: pure caller-supplied orchestration only; no database, persistence, scheduler, lease, provider fetch, filesystem, environment, wall-clock read, Scenario, Recommendation, Action, or Formal epoch effect.

import { composeAssimilatedContinuationPosteriorV1 } from "../../domain/soil_water/assimilated_continuation_posterior_v1.js";
import { normalizeFixedDecimalV1, WATER_AMOUNT_SCALE_V1 } from "../../domain/soil_water/fixed_point_water_decimal_v1.js";
import { executeHourlyWaterBalanceV1, type HourlyWaterBalanceConfigV1 } from "../../domain/soil_water/hourly_water_balance_v1.js";
import { semanticHashV1 } from "../../domain/twin_runtime/canonical_identity_v1.js";
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
import type { Cap04Pure72hForecastMathResultV1 } from "../../domain/twin_runtime/forecast_math_contracts_v1.js";
import type { Cap04ForecastForcingWindowV1 } from "../../domain/twin_runtime/future_forcing_contracts_v1.js";
import { executeCap04Pure72hForecastMathV1 } from "../../domain/twin_runtime/pure_72h_forecast_math_v1.js";
import {
  selectAssimilatedContinuationObservationV2,
  type SelectedAssimilatedObservationV2,
} from "./assimilated_continuation_observation_selector_v2.js";
import { buildCap04BlockedForecastPayloadV1 } from "./blocked_forecast_payload_builder_v1.js";
import {
  resolveContinuationCropStageContextV1,
  type ContinuationCropStageConfigurationContextV1,
  type ResolvedContinuationCropStageContextV1,
} from "./continuation_evidence_window_service_v1.js";
import {
  buildExternalFormalCap04BlockedA2RecordSetV1,
  buildExternalFormalCap04CompletedA1RecordSetV1,
  type ExternalFormalCap04ARecordSetCandidateV1,
} from "./external_formal_cap04_a_record_set_builder_v1.js";
import { buildExternalFormalCap04StateSourceMembersV1 } from "./external_formal_cap04_state_source_builder_v1.js";
import {
  selectExternalFormalCurrentIntervalForcingV1,
  type ExternalFormalCurrentIntervalForcingSelectionV1,
} from "./external_formal_current_interval_forcing_selector_v1.js";
import {
  selectCap04FutureForcingOutcomeV1,
  type Cap04FutureForcingOutcomeV1,
} from "./future_forcing_outcome_classifier_v1.js";
import type { Cap04ARecordSetBuilderSourceMembersV1 } from "./forecast_continuation_record_set_builder_v1.js";
import type { CanonicalReplayEvidenceRecordV1, PreparedNextTickInputV1, TwinScopeKeyV1 } from "./ports.js";

export const EXTERNAL_FORMAL_AMENDMENT19_CANONICAL_TICK_CORE_ID_V1 =
  "MCFT_CAP09_EXTERNAL_FORMAL_AMENDMENT19_CANONICAL_TICK_CORE_V1" as const;
export const EXTERNAL_FORMAL_AMENDMENT19_EVIDENCE_WINDOW_CONTRACT_ID_V1 =
  "MCFT_CAP09_AMENDMENT19_CURRENT_INTERVAL_EVIDENCE_WINDOW_V1" as const;

export type ExternalFormalAmendment19EvidenceWindowV1 = {
  evidence_window_contract_id: typeof EXTERNAL_FORMAL_AMENDMENT19_EVIDENCE_WINDOW_CONTRACT_ID_V1;
  logical_time: string;
  frozen: true;
  runtime_health: "HEALTHY" | "DEGRADED";
  base_continuation_window: {
    logical_time: string;
    window_start_exclusive: string;
    window_end_inclusive: string;
    frozen: true;
    current_interval_forcing: ExternalFormalCurrentIntervalForcingSelectionV1;
    crop_stage_context: ResolvedContinuationCropStageContextV1;
    partial_exact_provider_refs_suppressed: string[];
    limitations: string[];
  };
  observation_selection: SelectedAssimilatedObservationV2;
  dynamics_consumed_evidence_refs: string[];
  assimilation_evaluated_evidence_refs: string[];
  assimilation_applied_evidence_refs: string[];
  context_only_evidence_refs: string[];
  rejected_evidence_refs: string[];
  consumed_evidence_refs: string[];
  semantic_digest: string;
};

export type ExecuteExternalFormalAmendment19CanonicalTickInputV1 = {
  scope: TwinScopeKeyV1;
  logical_time: string;
  evidence_snapshot_time: string;
  created_at: string;
  handoff: PreparedNextTickInputV1;
  runtime_config: CanonicalObjectEnvelopeV1;
  candidate_records: readonly CanonicalReplayEvidenceRecordV1[];
  crop_stage_context: ContinuationCropStageConfigurationContextV1;
};

export type ExternalFormalAmendment19CanonicalTickResultV1 = {
  core_id: typeof EXTERNAL_FORMAL_AMENDMENT19_CANONICAL_TICK_CORE_ID_V1;
  operation_variant: "A1" | "A2";
  current_interval_forcing: ExternalFormalCurrentIntervalForcingSelectionV1;
  runtime_health: "HEALTHY" | "DEGRADED";
  evidence_window: ExternalFormalAmendment19EvidenceWindowV1;
  source_members: Cap04ARecordSetBuilderSourceMembersV1;
  forcing_outcome: Cap04FutureForcingOutcomeV1;
  forecast_authority: ExternalFormalCompletedForecastAuthorityViewV1 | ExternalFormalBlockedForecastAuthorityViewV1;
  record_set_candidate: ExternalFormalCap04ARecordSetCandidateV1;
  record_set: Cap04ARecordSetV1;
  runtime_mode: typeof MCFT_CAP09_EXTERNAL_FORMAL_RUNTIME_MODE_V1;
  model_parameter_authority: typeof MCFT_CAP09_EXTERNAL_FORMAL_MODEL_PARAMETER_AUTHORITY_V1;
  provider_wait_required: false;
  canonical_persistence_authorized: false;
  provider_request_count: 0;
  database_write_count: 0;
  scheduler_write_count: 0;
  scenario_write_count: 0;
  recommendation_write_count: 0;
  action_write_count: 0;
};

type ScopeLikeV1 = {
  tenant_id: string;
  project_id: string;
  group_id: string | null;
  field_id: string;
  season_id: string | null;
  zone_id: string | null;
};

function requiredStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

function canonicalIsoV1(value: unknown, code: string): string {
  const text = requiredStringV1(value, code);
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== text) throw new Error(code);
  return text;
}

function canonicalHourV1(value: unknown, code: string): string {
  const text = canonicalIsoV1(value, code);
  if (!text.endsWith(":00:00.000Z")) throw new Error(code);
  return text;
}

function addHoursV1(value: string, hours: number): string {
  return new Date(Date.parse(value) + hours * 3_600_000).toISOString();
}

function exactScopeV1(actual: ScopeLikeV1, expected: TwinScopeKeyV1, code: string): void {
  for (const field of ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"] as const) {
    if (actual[field] !== expected[field]) throw new Error(`${code}:${field}`);
  }
}

function uniqueSortedV1(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => typeof value === "string" && value.trim()))]
    .sort((left, right) => left.localeCompare(right));
}

function dynamicsConfigV1(
  payload: ReturnType<ExternalFormalCap04ExecutionConfigResolverV1["resolveExecutionConfig"]>["payload"],
): HourlyWaterBalanceConfigV1 {
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
  if (typeof mean?.value !== "string" || typeof variance?.value !== "string") {
    throw new Error("AMENDMENT19_CANONICAL_CORE_STATE_DECIMAL_BASIS_REQUIRED");
  }
  return { storage_mean_mm_decimal: mean.value, storage_variance_mm2_decimal: variance.value };
}

function externalRuntimeV1(
  config: CanonicalObjectEnvelopeV1,
  logicalTime: string,
): ExternalFormalRuntimeConfigPayloadV1 {
  if (config.object_type !== "twin_runtime_config_v1") {
    throw new Error("AMENDMENT19_CANONICAL_CORE_RUNTIME_CONFIG_OBJECT_TYPE_REQUIRED");
  }
  exactScopeV1(config, { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 }, "AMENDMENT19_CANONICAL_CORE_RUNTIME_CONFIG_SCOPE_MISMATCH");
  if (config.logical_time !== logicalTime || config.as_of !== logicalTime) {
    throw new Error("AMENDMENT19_CANONICAL_CORE_RUNTIME_CONFIG_TIME_MISMATCH");
  }
  validateExternalFormalRuntimeConfigPayloadV1(config.payload);
  const payload = config.payload as unknown as ExternalFormalRuntimeConfigPayloadV1;
  if (payload.config_role !== "HOURLY_CAP04" || payload.effective_logical_time !== logicalTime) {
    throw new Error("AMENDMENT19_CANONICAL_CORE_HOURLY_RUNTIME_CONFIG_REQUIRED");
  }
  return payload;
}

function availableBySnapshotV1(record: CanonicalReplayEvidenceRecordV1, snapshot: string): boolean {
  const availableAt = canonicalIsoV1(record.available_to_runtime_at, "AMENDMENT19_CANONICAL_CORE_RECORD_AVAILABLE_AT_INVALID");
  const rawIngested = record.role_time?.ingested_at;
  const ingestedAt = rawIngested === undefined
    ? availableAt
    : canonicalIsoV1(rawIngested, "AMENDMENT19_CANONICAL_CORE_RECORD_INGESTED_AT_INVALID");
  return availableAt <= snapshot && ingestedAt <= snapshot;
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
  if (window === null) throw new Error("AMENDMENT19_CANONICAL_CORE_COMPATIBILITY_FORCING_WINDOW_REQUIRED");
  const normalizedWindow = rebindRuntimeConfigAuthorityV1(
    structuredClone(window),
    runtimeConfig.object_id,
    runtimeConfig.determinism_hash,
  ) as Cap04ForecastForcingWindowV1;
  return {
    ...structuredClone(result),
    forecast_payload: {
      ...structuredClone(result.forecast_payload),
      forcing_window_authority: normalizedWindow,
    },
  };
}

function buildPreAssimilationEvidenceWindowV1(input: {
  scope: TwinScopeKeyV1;
  logical_time: string;
  evidence_snapshot_time: string;
  candidate_records: readonly CanonicalReplayEvidenceRecordV1[];
  crop_stage_context: ContinuationCropStageConfigurationContextV1;
  crop_stage_context_ref: string;
  crop_stage_context_hash: string;
  saturation_fraction: number;
  current_interval_forcing: ExternalFormalCurrentIntervalForcingSelectionV1;
}): ExternalFormalAmendment19EvidenceWindowV1 {
  const crop = resolveContinuationCropStageContextV1({
    logical_time: input.logical_time,
    context_ref: input.crop_stage_context_ref,
    context_hash: input.crop_stage_context_hash,
    context: input.crop_stage_context,
  });
  const causalRecords = input.candidate_records.filter((record) => availableBySnapshotV1(record, input.evidence_snapshot_time));
  const observationRecords = causalRecords.filter((record) => record.record_type === "soil_moisture_observation_v1");
  const observationSelection = selectAssimilatedContinuationObservationV2({
    scope: input.scope,
    logical_time: input.logical_time,
    saturation_fraction: input.saturation_fraction,
    observation_records: observationRecords,
    authorized_binding_id: MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
  });
  const dynamicsConsumed = uniqueSortedV1(input.current_interval_forcing.source_record_refs);
  const evaluated = uniqueSortedV1(observationSelection.evaluated_observation_refs);
  const rejected = uniqueSortedV1(observationSelection.rejected_observation_refs);
  const reserved = new Set([...dynamicsConsumed, ...evaluated]);
  const contextOnly = uniqueSortedV1(
    causalRecords.map((record) => record.source_record_id).filter((ref) => !reserved.has(ref)),
  );
  const limitations = uniqueSortedV1([
    ...input.current_interval_forcing.limitations,
    input.current_interval_forcing.mode === "PRIOR_STEP_CAUSAL_ASSUMPTION_PAIR"
      ? "MODE_B_ASSUMED_CURRENT_PROCESS_FORCING"
      : "MODE_A_EXACT_PROVIDER_CURRENT_PROCESS_FORCING",
    input.current_interval_forcing.runtime_health === "DEGRADED"
      ? "RUNTIME_HEALTH_DEGRADED"
      : "RUNTIME_HEALTH_HEALTHY",
    "NO_PROVIDER_WAIT",
    "NO_PERSISTENCE_FILL",
    "NO_SOURCE_SUBSTITUTION",
    "NO_TIMESTAMP_RELABEL",
    "NO_RETROACTIVE_STATE_REWRITE",
  ]);
  const base = {
    logical_time: input.logical_time,
    window_start_exclusive: addHoursV1(input.logical_time, -1),
    window_end_inclusive: input.logical_time,
    frozen: true as const,
    current_interval_forcing: structuredClone(input.current_interval_forcing),
    crop_stage_context: crop,
    partial_exact_provider_refs_suppressed: [...input.current_interval_forcing.partial_exact_provider_refs_suppressed],
    limitations,
  };
  const value = {
    evidence_window_contract_id: EXTERNAL_FORMAL_AMENDMENT19_EVIDENCE_WINDOW_CONTRACT_ID_V1,
    logical_time: input.logical_time,
    frozen: true as const,
    runtime_health: input.current_interval_forcing.runtime_health,
    base_continuation_window: base,
    observation_selection: observationSelection,
    dynamics_consumed_evidence_refs: dynamicsConsumed,
    assimilation_evaluated_evidence_refs: evaluated,
    assimilation_applied_evidence_refs: [] as string[],
    context_only_evidence_refs: contextOnly,
    rejected_evidence_refs: rejected,
    consumed_evidence_refs: dynamicsConsumed,
  };
  return { ...value, semantic_digest: semanticHashV1(value) };
}

function finalizeEvidenceWindowV1(
  window: ExternalFormalAmendment19EvidenceWindowV1,
  assimilation: ReturnType<typeof composeAssimilatedContinuationPosteriorV1>,
): ExternalFormalAmendment19EvidenceWindowV1 {
  if (assimilation.selected_observation_ref !== window.observation_selection.selected_observation_ref) {
    throw new Error("AMENDMENT19_CANONICAL_CORE_ASSIMILATION_SELECTED_REF_MISMATCH");
  }
  if (JSON.stringify(assimilation.evaluated_observation_refs) !== JSON.stringify(window.assimilation_evaluated_evidence_refs)) {
    throw new Error("AMENDMENT19_CANONICAL_CORE_ASSIMILATION_EVALUATED_REFS_MISMATCH");
  }
  const applied = uniqueSortedV1(assimilation.applied_observation_refs);
  if (JSON.stringify(applied) !== JSON.stringify(uniqueSortedV1(assimilation.consumed_observation_refs))) {
    throw new Error("AMENDMENT19_CANONICAL_CORE_ASSIMILATION_APPLIED_REFS_MISMATCH");
  }
  const value = {
    evidence_window_contract_id: window.evidence_window_contract_id,
    logical_time: window.logical_time,
    frozen: true as const,
    runtime_health: window.runtime_health,
    base_continuation_window: structuredClone(window.base_continuation_window),
    observation_selection: structuredClone(window.observation_selection),
    dynamics_consumed_evidence_refs: [...window.dynamics_consumed_evidence_refs],
    assimilation_evaluated_evidence_refs: [...assimilation.evaluated_observation_refs],
    assimilation_applied_evidence_refs: applied,
    context_only_evidence_refs: [...window.context_only_evidence_refs],
    rejected_evidence_refs: [...window.rejected_evidence_refs],
    consumed_evidence_refs: uniqueSortedV1([...window.dynamics_consumed_evidence_refs, ...applied]),
  };
  return { ...value, semantic_digest: semanticHashV1(value) };
}

function commonRecordSetInputV1(
  input: ExecuteExternalFormalAmendment19CanonicalTickInputV1,
  sourceMembers: Cap04ARecordSetBuilderSourceMembersV1,
) {
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
  current_interval_forcing: ExternalFormalCurrentIntervalForcingSelectionV1;
  evidence_window: ExternalFormalAmendment19EvidenceWindowV1;
  source_members: Cap04ARecordSetBuilderSourceMembersV1;
  forcing_outcome: Cap04FutureForcingOutcomeV1;
  forecast_authority: ExternalFormalCompletedForecastAuthorityViewV1 | ExternalFormalBlockedForecastAuthorityViewV1;
  record_set_candidate: ExternalFormalCap04ARecordSetCandidateV1;
}): ExternalFormalAmendment19CanonicalTickResultV1 {
  return {
    core_id: EXTERNAL_FORMAL_AMENDMENT19_CANONICAL_TICK_CORE_ID_V1,
    operation_variant: input.operation_variant,
    current_interval_forcing: input.current_interval_forcing,
    runtime_health: input.current_interval_forcing.runtime_health,
    evidence_window: input.evidence_window,
    source_members: input.source_members,
    forcing_outcome: input.forcing_outcome,
    forecast_authority: input.forecast_authority,
    record_set_candidate: input.record_set_candidate,
    record_set: input.record_set_candidate.record_set,
    runtime_mode: MCFT_CAP09_EXTERNAL_FORMAL_RUNTIME_MODE_V1,
    model_parameter_authority: MCFT_CAP09_EXTERNAL_FORMAL_MODEL_PARAMETER_AUTHORITY_V1,
    provider_wait_required: false,
    canonical_persistence_authorized: false,
    provider_request_count: 0,
    database_write_count: 0,
    scheduler_write_count: 0,
    scenario_write_count: 0,
    recommendation_write_count: 0,
    action_write_count: 0,
  };
}

export function executeExternalFormalAmendment19CanonicalTickV1(
  input: ExecuteExternalFormalAmendment19CanonicalTickInputV1,
): ExternalFormalAmendment19CanonicalTickResultV1 {
  const logicalTime = canonicalHourV1(input.logical_time, "AMENDMENT19_CANONICAL_CORE_LOGICAL_TIME_INVALID");
  const snapshot = canonicalIsoV1(input.evidence_snapshot_time, "AMENDMENT19_CANONICAL_CORE_SNAPSHOT_INVALID");
  canonicalIsoV1(input.created_at, "AMENDMENT19_CANONICAL_CORE_CREATED_AT_INVALID");
  if (snapshot !== logicalTime) throw new Error("AMENDMENT19_CANONICAL_CORE_BOUNDARY_SNAPSHOT_MUST_EQUAL_LOGICAL_TIME");
  exactScopeV1(input.scope, { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 }, "AMENDMENT19_CANONICAL_CORE_SCOPE_MISMATCH");
  exactScopeV1(input.handoff, input.scope, "AMENDMENT19_CANONICAL_CORE_HANDOFF_SCOPE_MISMATCH");
  if (input.handoff.next_logical_tick_time !== logicalTime) throw new Error("AMENDMENT19_CANONICAL_CORE_HANDOFF_TIME_MISMATCH");

  const externalRuntime = externalRuntimeV1(input.runtime_config, logicalTime);
  if (input.handoff.reality_binding_ref !== externalRuntime.reality_binding_ref
    || input.handoff.reality_binding_hash !== externalRuntime.reality_binding_hash) {
    throw new Error("AMENDMENT19_CANONICAL_CORE_REALITY_BINDING_MISMATCH");
  }

  const compatibility = new ExternalFormalCap04ExecutionConfigResolverV1()
    .resolveExecutionConfig(input.runtime_config).payload;
  const currentIntervalForcing = selectExternalFormalCurrentIntervalForcingV1({
    scope: input.scope,
    logical_time: logicalTime,
    evidence_snapshot_time: snapshot,
    candidate_records: input.candidate_records,
  });
  if (currentIntervalForcing.provider_wait_required !== false) {
    throw new Error("AMENDMENT19_CANONICAL_CORE_PROVIDER_WAIT_FORBIDDEN");
  }

  const preliminaryEvidence = buildPreAssimilationEvidenceWindowV1({
    scope: input.scope,
    logical_time: logicalTime,
    evidence_snapshot_time: snapshot,
    candidate_records: input.candidate_records,
    crop_stage_context: input.crop_stage_context,
    crop_stage_context_ref: externalRuntime.crop_stage_context_authority.context_ref,
    crop_stage_context_hash: externalRuntime.crop_stage_context_authority.context_hash,
    saturation_fraction: compatibility.soil_hydraulic_snapshot.saturation_fraction,
    current_interval_forcing: currentIntervalForcing,
  });
  const crop = preliminaryEvidence.base_continuation_window.crop_stage_context;
  const dynamics = executeHourlyWaterBalanceV1({
    interval_start_exclusive: currentIntervalForcing.interval_start,
    interval_end_inclusive: currentIntervalForcing.interval_end,
    previous_storage_mm_decimal: input.handoff.previous_storage_mm_decimal,
    previous_variance_basis: input.handoff.previous_variance_basis,
    gross_rainfall_mm_decimal: normalizeFixedDecimalV1(String(currentIntervalForcing.precipitation_mm), WATER_AMOUNT_SCALE_V1),
    historical_et0_mm_decimal: normalizeFixedDecimalV1(
      String(currentIntervalForcing.reference_et0_model_water_loss_demand_mm),
      WATER_AMOUNT_SCALE_V1,
    ),
    crop_stage_code: crop.stage_code,
    kc_decimal: normalizeFixedDecimalV1(String(crop.kc), WATER_AMOUNT_SCALE_V1),
    executed_irrigation_candidates: [],
    config: dynamicsConfigV1(compatibility),
  });
  const assimilation = composeAssimilatedContinuationPosteriorV1({
    prior_mean: Number(dynamics.published_state.root_zone_vwc_fraction.mean),
    prior_variance: Number(dynamics.published_state.root_zone_vwc_fraction.variance),
    selected_observation: preliminaryEvidence.observation_selection.selected_observation as never,
    saturation_fraction: compatibility.soil_hydraulic_snapshot.saturation_fraction,
    root_zone_depth_mm: compatibility.soil_hydraulic_snapshot.root_zone_depth_mm,
    sensor_measurement_stddev_fraction: compatibility.observation_assimilation.sensor_measurement_stddev_fraction,
    point_to_zone_representativeness_stddev_fraction: compatibility.observation_assimilation.point_to_zone_representativeness_stddev_fraction,
    quality_weights: compatibility.observation_assimilation.quality_weights,
  });
  const evidence = finalizeEvidenceWindowV1(preliminaryEvidence, assimilation);

  // The existing External Formal source-member builder consumes a structural evidence-window surface.
  // This cast does not relabel assumptions as rainfall/ET0 observations: the Amendment-19 base window
  // carries current_interval_forcing explicitly and contains no synthetic rainfall_record or historical_et0_record fields.
  const sourceMembers = buildExternalFormalCap04StateSourceMembersV1({
    scope: input.scope,
    logical_time: logicalTime,
    created_at: input.created_at,
    handoff: input.handoff,
    runtime_config: input.runtime_config,
    compatibility_execution_config_payload: compatibility,
    evidence_window: evidence as unknown as Parameters<typeof buildExternalFormalCap04StateSourceMembersV1>[0]["evidence_window"],
    dynamics,
    compatibility_assimilation: assimilation,
  });
  const sourceState = sourceMembers.twin_state_estimate_v1;
  const causalRecords = input.candidate_records.filter((record) => availableBySnapshotV1(record, snapshot));
  const forcingOutcome = selectCap04FutureForcingOutcomeV1({
    scope: input.scope,
    logical_time: logicalTime,
    candidate_records: causalRecords,
    authorized_binding_ids: MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_FORCING_BINDING_IDS_V1,
    crop_stage_context: {
      ref: compatibility.crop_stage_context.context_ref,
      hash: compatibility.crop_stage_context.context_hash,
      crop_stage_code: crop.stage_code,
      kc: crop.kc,
    },
    runtime_config: { ref: input.runtime_config.object_id, hash: input.runtime_config.determinism_hash },
  });

  if (forcingOutcome.status === "FAILED") {
    throw new Error(`AMENDMENT19_CANONICAL_CORE_FUTURE_FORCING_FAILED:${forcingOutcome.reason_codes.join("|")}`);
  }

  if (forcingOutcome.status === "BLOCKED") {
    const compatibilityBlocked = buildCap04BlockedForecastPayloadV1({
      issued_at: logicalTime,
      source_posterior_ref: sourceState.object_id,
      source_posterior_hash: sourceState.determinism_hash,
      runtime_config_ref: input.runtime_config.object_id,
      runtime_config_hash: input.runtime_config.determinism_hash,
      runtime_config_payload: compatibility,
      reason_codes: forcingOutcome.reason_codes,
      limitations: ["AMENDMENT19_CANONICAL_CORE_BLOCKED_FUTURE_FORCING"],
    });
    const forecastAuthority = buildExternalFormalBlockedForecastAuthorityV1({
      compatibility_forecast: compatibilityBlocked,
      runtime_config: input.runtime_config,
    });
    const candidate = buildExternalFormalCap04BlockedA2RecordSetV1({
      ...commonRecordSetInputV1(input, sourceMembers),
      forecast_payload: forecastAuthority.forecast_candidate,
    });
    return resultV1({
      operation_variant: "A2",
      current_interval_forcing: currentIntervalForcing,
      evidence_window: evidence,
      source_members: sourceMembers,
      forcing_outcome: forcingOutcome,
      forecast_authority: forecastAuthority,
      record_set_candidate: candidate,
    });
  }

  const compatibilityForecastMath = executeCap04Pure72hForecastMathV1({
    source_posterior: {
      ref: sourceState.object_id,
      hash: sourceState.determinism_hash,
      logical_time: logicalTime,
      computation_basis: stateBasisV1(sourceState),
    },
    runtime_config: {
      ref: input.runtime_config.object_id,
      hash: input.runtime_config.determinism_hash,
      payload: compatibility,
    },
    forcing_window: forcingOutcome.window,
  });
  const normalizedCompatibilityForecastMath = normalizeCompatibilityForecastRuntimeAuthorityV1(
    compatibilityForecastMath,
    input.runtime_config,
  );
  const forecastAuthority = buildExternalFormalCompletedForecastAuthorityV1({
    compatibility_result: normalizedCompatibilityForecastMath,
    runtime_config: input.runtime_config,
  });
  const candidate = buildExternalFormalCap04CompletedA1RecordSetV1({
    ...commonRecordSetInputV1(input, sourceMembers),
    forecast_payload: forecastAuthority.forecast_candidate,
  });
  return resultV1({
    operation_variant: "A1",
    current_interval_forcing: currentIntervalForcing,
    evidence_window: evidence,
    source_members: sourceMembers,
    forcing_outcome: forcingOutcome,
    forecast_authority: forecastAuthority,
    record_set_candidate: candidate,
  });
}
