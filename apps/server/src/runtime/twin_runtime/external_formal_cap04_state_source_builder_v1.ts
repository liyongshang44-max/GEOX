// apps/server/src/runtime/twin_runtime/external_formal_cap04_state_source_builder_v1.ts
// Purpose: construct honest External Formal CAP04 source-member candidates after frozen CAP02/CAP03 compatibility math, without allowing Replay authority markers into canonical State/Evidence/Assimilation semantics.
// Boundary: pure construction/validation only; no persistence, database, provider fetch, scheduler, route, wall clock, recommendation, action, model activation, or O00 execution.

import type { HourlyWaterBalanceResultV1 } from "../../domain/soil_water/hourly_water_balance_v1.js";
import type { AssimilatedContinuationPosteriorV1 } from "../../domain/soil_water/assimilated_continuation_posterior_v1.js";
import { buildExternalFormalAssimilationAuthorityViewV1 } from "../../domain/soil_water/external_formal_assimilation_authority_view_v1.js";
import {
  computeMemberDeterminismHashV1,
  deriveSemanticObjectIdV1,
  semanticHashV1,
} from "../../domain/twin_runtime/canonical_identity_v1.js";
import {
  validateCanonicalObjectV1,
  type CanonicalObjectEnvelopeV1,
} from "../../domain/twin_runtime/canonical_object_contracts_v1.js";
import {
  MCFT_CAP09_EXTERNAL_FORMAL_MODEL_PARAMETER_AUTHORITY_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_RUNTIME_MODE_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1,
  validateExternalFormalRuntimeConfigPayloadV1,
  type ExternalFormalRuntimeConfigPayloadV1,
} from "../../domain/twin_runtime/external_formal_runtime_config_v1.js";
import {
  MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
} from "../../domain/twin_runtime/external_formal_evidence_binding_profile_v1.js";
import {
  validateCap04RuntimeConfigPayloadV1,
  type Cap04RuntimeConfigPayloadV1,
} from "../../domain/twin_runtime/forecast_scenario_runtime_config_v1.js";
import type { AssimilatedContinuationEvidenceWindowV2 } from "./assimilated_continuation_evidence_window_v2.js";
import type { Cap04ARecordSetBuilderSourceMembersV1 } from "./forecast_continuation_record_set_builder_v1.js";
import type { PreparedNextTickInputV1, TwinScopeKeyV1 } from "./ports.js";

export type BuildExternalFormalCap04StateSourceMembersInputV1 = {
  scope: TwinScopeKeyV1;
  logical_time: string;
  created_at: string;
  handoff: PreparedNextTickInputV1;
  runtime_config: CanonicalObjectEnvelopeV1;
  compatibility_execution_config_payload: Cap04RuntimeConfigPayloadV1;
  evidence_window: AssimilatedContinuationEvidenceWindowV2;
  dynamics: HourlyWaterBalanceResultV1;
  compatibility_assimilation: AssimilatedContinuationPosteriorV1;
};

const SOURCE_TYPES_V1 = [
  "twin_evidence_window_v1",
  "twin_state_transition_v1",
  "twin_assimilation_update_v1",
  "twin_state_estimate_v1",
] as const;

type SourceTypeV1 = (typeof SOURCE_TYPES_V1)[number];

type NullableScopeLikeV1 = {
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

function exactScopeV1(actual: NullableScopeLikeV1, expected: TwinScopeKeyV1, code: string): void {
  for (const field of ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"] as const) {
    if (actual[field] !== expected[field]) throw new Error(`${code}:${field}`);
  }
}

function exactExternalScopeV1(scope: TwinScopeKeyV1): void {
  exactScopeV1(scope, { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 }, "EXTERNAL_CAP04_SOURCE_SCOPE_MISMATCH");
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

function assertNoReplayCanonicalMarkerV1(value: unknown, code: string): void {
  const text = JSON.stringify(value);
  for (const marker of [
    "CONTROLLED_SYNTHETIC_REPLAY_PROXY",
    "CONTROLLED_REPLAY",
    "runtime_mode\":\"REPLAY",
    "POINT_200MM_TO_ROOT_ZONE_MEAN_H1_WITH_REPRESENTATIVENESS_V1",
  ]) {
    if (text.includes(marker)) throw new Error(`${code}:${marker}`);
  }
}

export function buildExternalFormalCap04StateSourceMembersV1(
  input: BuildExternalFormalCap04StateSourceMembersInputV1,
): Cap04ARecordSetBuilderSourceMembersV1 {
  const logicalTime = canonicalIsoV1(input.logical_time, "EXTERNAL_CAP04_SOURCE_LOGICAL_TIME_INVALID");
  const createdAt = canonicalIsoV1(input.created_at, "EXTERNAL_CAP04_SOURCE_CREATED_AT_INVALID");
  exactExternalScopeV1(input.scope);
  exactScopeV1(input.handoff, input.scope, "EXTERNAL_CAP04_SOURCE_HANDOFF_SCOPE_MISMATCH");
  if (input.handoff.next_logical_tick_time !== logicalTime) throw new Error("EXTERNAL_CAP04_SOURCE_HANDOFF_TIME_MISMATCH");
  if (input.evidence_window.logical_time !== logicalTime) throw new Error("EXTERNAL_CAP04_SOURCE_EVIDENCE_TIME_MISMATCH");
  if (input.dynamics.mass_balance_trace.mass_balance_error_mm !== "0.000000") throw new Error("EXTERNAL_CAP04_SOURCE_MASS_BALANCE_NOT_CLOSED");

  validateCanonicalObjectV1(input.runtime_config);
  if (input.runtime_config.object_type !== "twin_runtime_config_v1") throw new Error("EXTERNAL_CAP04_SOURCE_RUNTIME_CONFIG_OBJECT_TYPE_REQUIRED");
  exactScopeV1(input.runtime_config, input.scope, "EXTERNAL_CAP04_SOURCE_RUNTIME_CONFIG_SCOPE_MISMATCH");
  validateExternalFormalRuntimeConfigPayloadV1(input.runtime_config.payload);
  const external = input.runtime_config.payload as unknown as ExternalFormalRuntimeConfigPayloadV1;
  if (external.config_role !== "HOURLY_CAP04") throw new Error("EXTERNAL_CAP04_SOURCE_HOURLY_CONFIG_REQUIRED");
  if (external.runtime_mode !== MCFT_CAP09_EXTERNAL_FORMAL_RUNTIME_MODE_V1) throw new Error("EXTERNAL_CAP04_SOURCE_RUNTIME_MODE_MISMATCH");
  if (input.runtime_config.logical_time !== logicalTime || external.effective_logical_time !== logicalTime) {
    throw new Error("EXTERNAL_CAP04_SOURCE_RUNTIME_CONFIG_TIME_MISMATCH");
  }
  if (external.reality_binding_ref !== input.handoff.reality_binding_ref
    || external.reality_binding_hash !== input.handoff.reality_binding_hash) {
    throw new Error("EXTERNAL_CAP04_SOURCE_REALITY_BINDING_MISMATCH");
  }

  validateCap04RuntimeConfigPayloadV1(input.compatibility_execution_config_payload);
  const compatibility = structuredClone(input.compatibility_execution_config_payload);
  if (compatibility.effective_logical_time !== logicalTime) throw new Error("EXTERNAL_CAP04_SOURCE_COMPATIBILITY_TIME_MISMATCH");
  if (compatibility.reality_binding_ref !== external.reality_binding_ref
    || compatibility.reality_binding_hash !== external.reality_binding_hash
    || compatibility.configuration_matrix_hash !== external.configuration_matrix_hash
    || compatibility.geometry_semantic_hash !== external.geometry_semantic_hash) {
    throw new Error("EXTERNAL_CAP04_SOURCE_COMPATIBILITY_AUTHORITY_MISMATCH");
  }

  const crop = input.evidence_window.base_continuation_window.crop_stage_context;
  if (crop.context_ref !== external.crop_stage_context_authority.context_ref
    || crop.context_hash !== external.crop_stage_context_authority.context_hash
    || crop.configuration_matrix_ref !== external.crop_stage_context_authority.configuration_matrix_ref
    || crop.configuration_matrix_hash !== external.crop_stage_context_authority.configuration_matrix_hash) {
    throw new Error("EXTERNAL_CAP04_SOURCE_CROP_AUTHORITY_MISMATCH");
  }
  assertNoReplayCanonicalMarkerV1(crop, "EXTERNAL_CAP04_SOURCE_CROP_REPLAY_LEAKAGE");

  const observationSelection = input.evidence_window.observation_selection;
  if (observationSelection.authorized_binding_id !== MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1) {
    throw new Error("EXTERNAL_CAP04_SOURCE_SOIL_BINDING_AUTHORITY_REQUIRED");
  }
  if (input.compatibility_assimilation.selected_observation_ref !== observationSelection.selected_observation_ref) {
    throw new Error("EXTERNAL_CAP04_SOURCE_ASSIMILATION_OBSERVATION_MISMATCH");
  }
  const assimilationAuthority = buildExternalFormalAssimilationAuthorityViewV1({
    compatibility_posterior: input.compatibility_assimilation,
    evidence_authority: {
      authorized_binding_id: observationSelection.authorized_binding_id,
      selected_observation_ref: observationSelection.selected_observation_ref,
    },
  });
  const externalAssimilation = assimilationAuthority.posterior_candidate;

  const identityBasis = {
    scope: structuredClone(input.scope),
    lineage_id: input.handoff.lineage_id,
    revision_id: input.handoff.revision_id,
    logical_time: logicalTime,
    runtime_config_ref: input.runtime_config.object_id,
    runtime_config_hash: input.runtime_config.determinism_hash,
    evidence_window_hash: input.evidence_window.semantic_digest,
    dynamics_hash: input.dynamics.mass_balance_trace_hash,
    external_assimilation_basis_hash: semanticHashV1(externalAssimilation),
    crop_context_ref: crop.context_ref,
    crop_context_hash: crop.context_hash,
  };
  const ids = Object.fromEntries(SOURCE_TYPES_V1.map((type) => [
    type,
    deriveSemanticObjectIdV1(`external_cap04_source_${type}`, identityBasis),
  ])) as Record<SourceTypeV1, string>;

  const consumedRefs = uniqueSortedV1(input.evidence_window.consumed_evidence_refs);
  const sourceRefs = uniqueSortedV1([
    external.reality_binding_ref,
    external.formal_authorities.site.ref,
    external.formal_authorities.reality.ref,
    external.formal_authorities.source_binding_matrix.ref,
    external.formal_authorities.crop_context.ref,
    external.model_prior.source_ref,
  ]);
  const limitations = uniqueSortedV1([
    MCFT_CAP09_EXTERNAL_FORMAL_RUNTIME_MODE_V1,
    MCFT_CAP09_EXTERNAL_FORMAL_MODEL_PARAMETER_AUTHORITY_V1,
    "NOT_FIELD_CALIBRATED",
    "EXTERNAL_PUBLIC_RESEARCH_SCOPE",
    "NEAR_SITE_POINT_SUPPORT",
    "PARTIAL_ROOT_ZONE_REPRESENTATIVENESS",
    "DIRECT_FIELD_EQUIVALENCE_FALSE",
    "DIRECT_ROOT_ZONE_EQUIVALENCE_FALSE",
    "NO_RECOMMENDATION",
    "NO_DECISION",
    "NO_ACTION",
    ...crop.limitations,
  ]);
  assertNoReplayCanonicalMarkerV1(limitations, "EXTERNAL_CAP04_SOURCE_LIMITATION_REPLAY_LEAKAGE");

  const buildMember = (
    type: SourceTypeV1,
    payload: Record<string, unknown>,
    evidenceRefs = consumedRefs,
  ): CanonicalObjectEnvelopeV1 => {
    assertNoReplayCanonicalMarkerV1(payload, `EXTERNAL_CAP04_SOURCE_PAYLOAD_REPLAY_LEAKAGE:${type}`);
    const member: CanonicalObjectEnvelopeV1 = {
      object_id: ids[type],
      object_type: type,
      schema_version: "v1",
      ...input.scope,
      logical_time: logicalTime,
      as_of: logicalTime,
      source_refs: [...sourceRefs],
      evidence_refs: uniqueSortedV1(evidenceRefs),
      runtime_config_ref: input.runtime_config.object_id,
      runtime_config_hash: input.runtime_config.determinism_hash,
      idempotency_key: deriveSemanticObjectIdV1("external_cap04_source_member_key", { identityBasis, type }),
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
    externalAssimilation.canonical_decimal_basis.storage_mean_mm_decimal,
    "EXTERNAL_CAP04_SOURCE_POSTERIOR_STORAGE_INVALID",
  );
  const posteriorStorageVariance = decimalNumberV1(
    externalAssimilation.canonical_decimal_basis.storage_variance_mm2_decimal,
    "EXTERNAL_CAP04_SOURCE_POSTERIOR_STORAGE_VARIANCE_INVALID",
  );
  const posteriorMean = externalAssimilation.published_posterior_mean;
  const posteriorVariance = externalAssimilation.published_posterior_variance;
  if (!Number.isFinite(posteriorMean) || !Number.isFinite(posteriorVariance) || posteriorVariance < 0) {
    throw new Error("EXTERNAL_CAP04_SOURCE_POSTERIOR_MOMENTS_INVALID");
  }
  const wiltingStorage = compatibility.soil_hydraulic_snapshot.wilting_point_storage_mm;
  const fieldCapacityStorage = compatibility.soil_hydraulic_snapshot.field_capacity_storage_mm;
  const rawAwf = (posteriorStorage - wiltingStorage) / (fieldCapacityStorage - wiltingStorage);
  const awf = Math.min(1, Math.max(0, rawAwf));
  const depletion = Math.max(0, fieldCapacityStorage - posteriorStorage);

  const evidence = buildMember("twin_evidence_window_v1", {
    evidence_window_contract_id: input.evidence_window.evidence_window_contract_id,
    logical_time: input.evidence_window.logical_time,
    frozen: true,
    authority_profile: "EXTERNAL_FORMAL_RUNTIME_AUTHORITY_V1",
    authorized_soil_binding_id: MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
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
    model_parameter_authority: MCFT_CAP09_EXTERNAL_FORMAL_MODEL_PARAMETER_AUTHORITY_V1,
    field_calibration_status: "NOT_FIELD_CALIBRATED",
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
      ...structuredClone(externalAssimilation),
      authorized_soil_binding_id: MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
      model_parameter_authority: MCFT_CAP09_EXTERNAL_FORMAL_MODEL_PARAMETER_AUTHORITY_V1,
      field_calibration_status: "NOT_FIELD_CALIBRATED",
      numerical_identity_preserved_from_compatibility_math: assimilationAuthority.numerical_identity_preserved,
      compatibility_numeric_digest: assimilationAuthority.compatibility_numeric_digest,
      external_candidate_numeric_digest: assimilationAuthority.external_candidate_numeric_digest,
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
    runtime_mode: MCFT_CAP09_EXTERNAL_FORMAL_RUNTIME_MODE_V1,
    authority_scope_class: "EXTERNAL_PUBLIC_RESEARCH_SCOPE",
    previous_posterior_ref: input.handoff.previous_posterior_ref,
    transition_ref: ids.twin_state_transition_v1,
    assimilation_update_ref: ids.twin_assimilation_update_v1,
    evidence_window_ref: ids.twin_evidence_window_v1,
    reality_binding_ref: input.handoff.reality_binding_ref,
    reality_binding_hash: input.handoff.reality_binding_hash,
    crop_stage_context_ref: crop.context_ref,
    crop_stage_context_hash: crop.context_hash,
    observation_authority: {
      binding_id: MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
      operator: structuredClone(externalAssimilation.observation_operator),
      model_parameter_authority: MCFT_CAP09_EXTERNAL_FORMAL_MODEL_PARAMETER_AUTHORITY_V1,
      field_calibration_status: "NOT_FIELD_CALIBRATED",
    },
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
      propagated_prior_vwc_decimal: structuredClone(externalAssimilation.canonical_decimal_basis.propagated_prior_vwc_decimal),
      propagated_prior_vwc_variance_decimal: structuredClone(externalAssimilation.canonical_decimal_basis.propagated_prior_vwc_variance_decimal),
      storage_mean_mm_decimal: structuredClone(externalAssimilation.canonical_decimal_basis.storage_mean_mm_decimal),
      storage_variance_mm2_decimal: structuredClone(externalAssimilation.canonical_decimal_basis.storage_variance_mm2_decimal),
      posterior_vwc_decimal: structuredClone(externalAssimilation.canonical_decimal_basis.posterior_vwc_decimal),
      posterior_vwc_variance_decimal: structuredClone(externalAssimilation.canonical_decimal_basis.posterior_vwc_variance_decimal),
      state_correction_vwc: externalAssimilation.state_correction_vwc,
      state_correction_storage_mm: externalAssimilation.state_correction_storage_mm,
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
    throw new Error("EXTERNAL_CAP04_SOURCE_REFERENCE_GRAPH_MISMATCH");
  }

  const result = {
    twin_evidence_window_v1: evidence,
    twin_state_transition_v1: transition,
    twin_assimilation_update_v1: assimilation,
    twin_state_estimate_v1: state,
  };
  assertNoReplayCanonicalMarkerV1(result, "EXTERNAL_CAP04_SOURCE_GRAPH_REPLAY_LEAKAGE");
  return result;
}
