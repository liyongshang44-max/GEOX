// apps/server/src/runtime/twin_runtime/forecast_scenario_state_source_builder_v1.ts
// Purpose: construct the four deterministic CAP-04 A1 source-member templates from current Evidence, hourly Dynamics and observation Assimilation under one pinned CAP-04 Runtime Config.
// Boundary: pure canonical construction only; no Forecast math, Scenario math, persistence, lease, projection, route, scheduler, filesystem, network, environment, or wall clock.

import type { HourlyWaterBalanceResultV1 } from "../../domain/soil_water/hourly_water_balance_v1.js";
import type { AssimilatedContinuationPosteriorV1 } from "../../domain/soil_water/assimilated_continuation_posterior_v1.js";
import {
  computeMemberDeterminismHashV1,
  deriveSemanticObjectIdV1,
  semanticHashV1,
} from "../../domain/twin_runtime/canonical_identity_v1.js";
import type { CanonicalObjectEnvelopeV1 } from "../../domain/twin_runtime/canonical_object_contracts_v1.js";
import {
  validateCap04RuntimeConfigPayloadV1,
  type Cap04RuntimeConfigPayloadV1,
} from "../../domain/twin_runtime/forecast_scenario_runtime_config_v1.js";
import type { AssimilatedContinuationEvidenceWindowV2 } from "./assimilated_continuation_evidence_window_v2.js";
import type { Cap04ARecordSetBuilderSourceMembersV1 } from "./forecast_continuation_record_set_builder_v1.js";
import type { PreparedNextTickInputV1, TwinScopeKeyV1 } from "./ports.js";

export type BuildCap04StateSourceMembersInputV1 = {
  scope: TwinScopeKeyV1;
  logical_time: string;
  created_at: string;
  handoff: PreparedNextTickInputV1;
  runtime_config: CanonicalObjectEnvelopeV1;
  evidence_window: AssimilatedContinuationEvidenceWindowV2;
  dynamics: HourlyWaterBalanceResultV1;
  assimilation: AssimilatedContinuationPosteriorV1;
};

const SOURCE_TYPES_V1 = [
  "twin_evidence_window_v1",
  "twin_state_transition_v1",
  "twin_assimilation_update_v1",
  "twin_state_estimate_v1",
] as const;

type SourceTypeV1 = (typeof SOURCE_TYPES_V1)[number];

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

function exactScopeV1(actual: {
  tenant_id: string;
  project_id: string;
  group_id: string | null;
  field_id: string;
  season_id: string | null;
  zone_id: string | null;
}, expected: TwinScopeKeyV1, code: string): void {
  for (const field of ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"] as const) {
    if (actual[field] !== expected[field]) throw new Error(`${code}:${field}`);
  }
}

function uniqueSortedV1(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => typeof value === "string" && value.trim()))]
    .sort((left, right) => left.localeCompare(right));
}

function decimalNumberV1(value: { value: string }, code: string): number {
  const number = Number(value.value);
  if (!Number.isFinite(number)) throw new Error(code);
  return number;
}

export function buildCap04StateSourceMembersV1(
  input: BuildCap04StateSourceMembersInputV1,
): Cap04ARecordSetBuilderSourceMembersV1 {
  const logicalTime = canonicalIsoV1(input.logical_time, "CAP04_SOURCE_LOGICAL_TIME_INVALID");
  const createdAt = canonicalIsoV1(input.created_at, "CAP04_SOURCE_CREATED_AT_INVALID");
  if (input.handoff.next_logical_tick_time !== logicalTime) throw new Error("CAP04_SOURCE_HANDOFF_TIME_MISMATCH");
  if (input.evidence_window.logical_time !== logicalTime) throw new Error("CAP04_SOURCE_EVIDENCE_TIME_MISMATCH");
  if (input.dynamics.interval_end_inclusive !== logicalTime) throw new Error("CAP04_SOURCE_DYNAMICS_TIME_MISMATCH");
  if (input.dynamics.mass_balance_trace.mass_balance_error_mm !== "0.000000") throw new Error("CAP04_SOURCE_MASS_BALANCE_NOT_CLOSED");
  if (input.runtime_config.object_type !== "twin_runtime_config_v1") throw new Error("CAP04_SOURCE_RUNTIME_CONFIG_OBJECT_TYPE_REQUIRED");
  exactScopeV1(input.runtime_config, input.scope, "CAP04_SOURCE_RUNTIME_CONFIG_SCOPE_MISMATCH");
  validateCap04RuntimeConfigPayloadV1(input.runtime_config.payload);
  const config = input.runtime_config.payload as unknown as Cap04RuntimeConfigPayloadV1;
  if (config.effective_logical_time !== logicalTime) throw new Error("CAP04_SOURCE_RUNTIME_CONFIG_TIME_MISMATCH");
  if (config.reality_binding_ref !== input.handoff.reality_binding_ref
    || config.reality_binding_hash !== input.handoff.reality_binding_hash) {
    throw new Error("CAP04_SOURCE_REALITY_BINDING_MISMATCH");
  }
  if (input.assimilation.selected_observation_ref !== input.evidence_window.observation_selection.selected_observation_ref) {
    throw new Error("CAP04_SOURCE_ASSIMILATION_OBSERVATION_MISMATCH");
  }

  const identityBasis = {
    scope: structuredClone(input.scope),
    lineage_id: input.handoff.lineage_id,
    revision_id: input.handoff.revision_id,
    logical_time: logicalTime,
    runtime_config_ref: input.runtime_config.object_id,
    runtime_config_hash: input.runtime_config.determinism_hash,
    evidence_window_hash: input.evidence_window.semantic_digest,
    dynamics_hash: input.dynamics.mass_balance_trace_hash,
    assimilation_basis_hash: semanticHashV1(input.assimilation),
  };
  const ids = Object.fromEntries(SOURCE_TYPES_V1.map((type) => [
    type,
    deriveSemanticObjectIdV1(`cap04_source_${type}`, identityBasis),
  ])) as Record<SourceTypeV1, string>;
  const consumedRefs = uniqueSortedV1(input.evidence_window.consumed_evidence_refs);
  const limitations = uniqueSortedV1([
    "CONTROLLED_REPLAY",
    "NOT_FIELD_CALIBRATED",
    "NO_RECOMMENDATION",
    "NO_DECISION",
    ...input.evidence_window.base_continuation_window.crop_stage_context.limitations,
  ]);

  const buildMember = (
    type: SourceTypeV1,
    payload: Record<string, unknown>,
    evidenceRefs = consumedRefs,
  ): CanonicalObjectEnvelopeV1 => {
    const member: CanonicalObjectEnvelopeV1 = {
      object_id: ids[type],
      object_type: type,
      schema_version: "v1",
      ...input.scope,
      logical_time: logicalTime,
      as_of: logicalTime,
      source_refs: uniqueSortedV1([input.handoff.reality_binding_ref]),
      evidence_refs: uniqueSortedV1(evidenceRefs),
      runtime_config_ref: input.runtime_config.object_id,
      runtime_config_hash: input.runtime_config.determinism_hash,
      idempotency_key: deriveSemanticObjectIdV1("cap04_source_member_key", { identityBasis, type }),
      determinism_hash: "",
      limitations: [...limitations],
      created_at: createdAt,
      lineage_id: input.handoff.lineage_id,
      revision_id: input.handoff.revision_id,
      payload,
    };
    member.determinism_hash = computeMemberDeterminismHashV1(member as unknown as Record<string, unknown>);
    return member;
  };

  const posteriorStorage = decimalNumberV1(
    input.assimilation.canonical_decimal_basis.storage_mean_mm_decimal,
    "CAP04_SOURCE_POSTERIOR_STORAGE_INVALID",
  );
  const posteriorStorageVariance = decimalNumberV1(
    input.assimilation.canonical_decimal_basis.storage_variance_mm2_decimal,
    "CAP04_SOURCE_POSTERIOR_STORAGE_VARIANCE_INVALID",
  );
  const posteriorMean = input.assimilation.published_posterior_mean;
  const posteriorVariance = input.assimilation.published_posterior_variance;
  if (!Number.isFinite(posteriorMean) || !Number.isFinite(posteriorVariance) || posteriorVariance < 0) {
    throw new Error("CAP04_SOURCE_POSTERIOR_MOMENTS_INVALID");
  }
  const wiltingStorage = config.soil_hydraulic_snapshot.wilting_point_storage_mm;
  const fieldCapacityStorage = config.soil_hydraulic_snapshot.field_capacity_storage_mm;
  const rawAwf = (posteriorStorage - wiltingStorage) / (fieldCapacityStorage - wiltingStorage);
  const awf = Math.min(1, Math.max(0, rawAwf));
  const depletion = Math.max(0, fieldCapacityStorage - posteriorStorage);

  const evidence = buildMember("twin_evidence_window_v1", {
    evidence_window_contract_id: input.evidence_window.evidence_window_contract_id,
    logical_time: input.evidence_window.logical_time,
    frozen: true,
    base_continuation_window: structuredClone(input.evidence_window.base_continuation_window),
    observation_selection: structuredClone(input.evidence_window.observation_selection),
    dynamics_consumed_evidence_refs: [...input.evidence_window.dynamics_consumed_evidence_refs],
    assimilation_evaluated_evidence_refs: [...input.evidence_window.assimilation_evaluated_evidence_refs],
    assimilation_applied_evidence_refs: [...input.evidence_window.assimilation_applied_evidence_refs],
    context_only_evidence_refs: [...input.evidence_window.context_only_evidence_refs],
    rejected_evidence_refs: [...input.evidence_window.rejected_evidence_refs],
    consumed_evidence_refs: [...input.evidence_window.consumed_evidence_refs],
    semantic_digest: input.evidence_window.semantic_digest,
  });
  const transition = buildMember("twin_state_transition_v1", {
    transition_kind: "CONTINUATION",
    previous_posterior_ref: input.handoff.previous_posterior_ref,
    previous_posterior_hash: input.handoff.previous_posterior_hash,
    process_model_status: "APPLIED",
    process_model_id: "ROOT_ZONE_HOURLY_WATER_BALANCE_V1",
    process_model_version: 1,
    propagation_start: input.evidence_window.base_continuation_window.window_start_exclusive,
    propagation_end: logicalTime,
    previous_state_runtime_config_ref: input.handoff.previous_state_runtime_config_ref,
    current_runtime_config_ref: input.runtime_config.object_id,
    current_runtime_config_hash: input.runtime_config.determinism_hash,
    mass_balance_trace: structuredClone(input.dynamics.mass_balance_trace),
    mass_balance_trace_hash: input.dynamics.mass_balance_trace_hash,
    propagated_prior_storage_mean_mm_decimal: structuredClone(input.dynamics.computation_basis.storage_mean_mm_decimal),
    propagated_prior_storage_variance_mm2_decimal: structuredClone(input.dynamics.computation_basis.storage_variance_mm2_decimal),
    evidence_window_ref: ids.twin_evidence_window_v1,
    assimilation_update_ref: ids.twin_assimilation_update_v1,
    posterior_state_ref: ids.twin_state_estimate_v1,
  });
  const assimilation = buildMember(
    "twin_assimilation_update_v1",
    {
      ...structuredClone(input.assimilation),
      state_transition_ref: ids.twin_state_transition_v1,
      posterior_state_ref: ids.twin_state_estimate_v1,
      runtime_config_ref: input.runtime_config.object_id,
      runtime_config_hash: input.runtime_config.determinism_hash,
      model_parameter_change_applied: false,
    },
    uniqueSortedV1(input.evidence_window.assimilation_evaluated_evidence_refs),
  );
  const state = buildMember("twin_state_estimate_v1", {
    state_kind: "POSTERIOR",
    previous_posterior_ref: input.handoff.previous_posterior_ref,
    transition_ref: ids.twin_state_transition_v1,
    assimilation_update_ref: ids.twin_assimilation_update_v1,
    evidence_window_ref: ids.twin_evidence_window_v1,
    reality_binding_ref: input.handoff.reality_binding_ref,
    reality_binding_hash: input.handoff.reality_binding_hash,
    root_zone_storage_mm: {
      mean: posteriorStorage,
      variance: posteriorStorageVariance,
      stddev: Math.sqrt(posteriorStorageVariance),
    },
    root_zone_vwc_fraction: {
      mean: posteriorMean,
      variance: posteriorVariance,
      stddev: Math.sqrt(posteriorVariance),
    },
    computation_basis: {
      basis_origin: "CAP04_CURRENT_TICK_ASSIMILATED_POSTERIOR",
      previous_state_ref: input.handoff.previous_posterior_ref,
      previous_storage_mean_mm_decimal: structuredClone(input.dynamics.computation_basis.previous_storage_mean_mm_decimal),
      previous_storage_variance_mm2_decimal: structuredClone(input.dynamics.computation_basis.previous_storage_variance_mm2_decimal),
      propagated_prior_storage_mean_mm_decimal: structuredClone(input.dynamics.computation_basis.storage_mean_mm_decimal),
      propagated_prior_storage_variance_mm2_decimal: structuredClone(input.dynamics.computation_basis.storage_variance_mm2_decimal),
      propagated_prior_vwc_decimal: structuredClone(input.assimilation.canonical_decimal_basis.propagated_prior_vwc_decimal),
      propagated_prior_vwc_variance_decimal: structuredClone(input.assimilation.canonical_decimal_basis.propagated_prior_vwc_variance_decimal),
      storage_mean_mm_decimal: structuredClone(input.assimilation.canonical_decimal_basis.storage_mean_mm_decimal),
      storage_variance_mm2_decimal: structuredClone(input.assimilation.canonical_decimal_basis.storage_variance_mm2_decimal),
      posterior_vwc_decimal: structuredClone(input.assimilation.canonical_decimal_basis.posterior_vwc_decimal),
      posterior_vwc_variance_decimal: structuredClone(input.assimilation.canonical_decimal_basis.posterior_vwc_variance_decimal),
      state_correction_vwc: input.assimilation.state_correction_vwc,
      state_correction_storage_mm: input.assimilation.state_correction_storage_mm,
      rounding_rule: "DECIMAL_HALF_AWAY_FROM_ZERO_V1",
    },
    available_water_fraction: Number(awf.toFixed(6)),
    depletion_from_field_capacity_mm: Number(depletion.toFixed(6)),
    mass_balance_trace_hash: input.dynamics.mass_balance_trace_hash,
    confidence: {
      status: "NOT_ESTABLISHED",
      reason_code: "NO_CALIBRATED_CONFIDENCE_MODEL",
    },
    use_eligibility: {
      state_valid: true,
      posterior_chain_eligible: true,
      forecast_source_eligible: true,
      recommendation_input_eligible: false,
      action_input_eligible: false,
    },
  });

  if (transition.payload.evidence_window_ref !== evidence.object_id
    || transition.payload.assimilation_update_ref !== assimilation.object_id
    || transition.payload.posterior_state_ref !== state.object_id
    || assimilation.payload.state_transition_ref !== transition.object_id
    || assimilation.payload.posterior_state_ref !== state.object_id
    || state.payload.transition_ref !== transition.object_id
    || state.payload.assimilation_update_ref !== assimilation.object_id
    || state.payload.evidence_window_ref !== evidence.object_id) {
    throw new Error("CAP04_SOURCE_REFERENCE_GRAPH_MISMATCH");
  }

  return {
    twin_evidence_window_v1: evidence,
    twin_state_transition_v1: transition,
    twin_assimilation_update_v1: assimilation,
    twin_state_estimate_v1: state,
  };
}
