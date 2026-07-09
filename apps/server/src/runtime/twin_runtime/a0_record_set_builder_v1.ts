// apps/server/src/runtime/twin_runtime/a0_record_set_builder_v1.ts
// Purpose: compose one deterministic nine-object A0 bootstrap record set from a frozen Evidence Window, immutable Runtime Config, and S3B posterior mathematics.
// Boundary: pure construction and validation only; no filesystem, database, lease acquisition, environment, scheduler, network, wall-clock reads, propagation, Scenario, Recommendation, or action logic.

import {
  computeA0RecordSetDeterminismHashV1,
  computeMemberDeterminismHashV1,
  deriveA0IdentityV1,
  deriveSemanticObjectIdV1,
  type A0SemanticSeedInputV1,
} from "../../domain/twin_runtime/canonical_identity_v1.js";
import {
  validateA0RecordSetV1,
  type A0RecordSetV1,
  type CanonicalObjectEnvelopeV1,
} from "../../domain/twin_runtime/canonical_object_contracts_v1.js";
import type { SoilHydraulicBoundsV1 } from "../../domain/twin_runtime/physical_bounds_v1.js";
import {
  buildRootZoneWaterPosteriorV1,
  type BootstrapWaterModelConfigV1,
} from "../../domain/soil_water/root_zone_water_posterior_v1.js";
import type { FrozenEvidenceWindowV1 } from "./evidence_window_builder_v1.js";
import type { TwinScopeKeyV1 } from "./ports.js";

export const A0_OPERATION_VARIANT_V1 = "A0_BOOTSTRAP_STATE_COMMIT" as const;
export const A0_BLOCKED_FORECAST_REASON_CODES_V1: readonly string[] = [
  "MCFT_06_PROPAGATION_NOT_ESTABLISHED",
  "SUCCESSFUL_FORECAST_NOT_AUTHORIZED_FOR_MCFT_CAP_01",
];

export type BuildA0RecordSetInputV1 = {
  scope: TwinScopeKeyV1;
  logical_time: string;
  created_at: string;
  runtime_config: CanonicalObjectEnvelopeV1;
  evidence_window: FrozenEvidenceWindowV1;
  hydraulic: SoilHydraulicBoundsV1;
  soil_hydraulic_config_ref: string;
};

type MemberBuildInputV1 = {
  type: CanonicalObjectEnvelopeV1["object_type"];
  object_id: string;
  idempotency_key: string;
  payload: Record<string, unknown>;
  scope: TwinScopeKeyV1;
  logical_time: string;
  created_at: string;
  source_refs: readonly string[];
  evidence_refs: readonly string[];
  runtime_config: CanonicalObjectEnvelopeV1;
  limitations: readonly string[];
  lineage_id?: string;
  revision_id?: string;
};

function requireStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value) throw new Error(code);
  return value;
}

function addOneHourIsoV1(logicalTime: string): string {
  const parsed = Date.parse(logicalTime);
  if (!Number.isFinite(parsed)) throw new Error("LOGICAL_TIME_INVALID");
  return new Date(parsed + 60 * 60 * 1000).toISOString();
}

function buildMemberV1(input: MemberBuildInputV1): CanonicalObjectEnvelopeV1 {
  const member: CanonicalObjectEnvelopeV1 = {
    object_id: input.object_id,
    object_type: input.type,
    schema_version: "v1",
    ...input.scope,
    logical_time: input.logical_time,
    as_of: input.logical_time,
    source_refs: [...input.source_refs].sort(),
    evidence_refs: [...input.evidence_refs].sort(),
    runtime_config_ref: input.runtime_config.object_id,
    runtime_config_hash: input.runtime_config.determinism_hash,
    idempotency_key: input.idempotency_key,
    determinism_hash: "",
    limitations: [...input.limitations],
    created_at: input.created_at,
    payload: input.payload,
    ...(input.lineage_id ? { lineage_id: input.lineage_id } : {}),
    ...(input.revision_id ? { revision_id: input.revision_id } : {}),
  };
  member.determinism_hash = computeMemberDeterminismHashV1(member as unknown as Record<string, unknown>);
  return member;
}

export function buildA0RecordSetV1(input: BuildA0RecordSetInputV1): A0RecordSetV1 {
  if (input.runtime_config.object_type !== "twin_runtime_config_v1") throw new Error("RUNTIME_CONFIG_OBJECT_TYPE_REQUIRED");
  if (input.runtime_config.logical_time > input.logical_time) throw new Error("RUNTIME_CONFIG_FROM_FUTURE_FORBIDDEN");
  if (input.evidence_window.logical_time !== input.logical_time || input.evidence_window.window_end_inclusive !== input.logical_time) throw new Error("EVIDENCE_WINDOW_LOGICAL_TIME_MISMATCH");
  if (input.evidence_window.frozen !== true) throw new Error("FROZEN_EVIDENCE_WINDOW_REQUIRED");
  if (input.evidence_window.consumed_evidence_refs.length !== 1 || input.evidence_window.consumed_evidence_refs[0] !== input.evidence_window.assimilation_observation.source_record_id) throw new Error("A0_EXACTLY_ONE_CONSUMED_SOIL_OBSERVATION_REQUIRED");

  const runtimePayload = input.runtime_config.payload;
  const realityBindingRef = requireStringV1(runtimePayload.reality_binding_ref, "REALITY_BINDING_REF_REQUIRED");
  const realityBindingHash = requireStringV1(runtimePayload.reality_binding_hash, "REALITY_BINDING_HASH_REQUIRED");
  const bootstrapModelConfig = runtimePayload.bootstrap_model_config as unknown as BootstrapWaterModelConfigV1;
  const posterior = buildRootZoneWaterPosteriorV1({
    observation_fraction: input.evidence_window.assimilation_observation.canonical_payload.value,
    quality_status: input.evidence_window.assimilation_observation.quality.status,
    hydraulic: input.hydraulic,
    model_config: bootstrapModelConfig,
  });

  const a0IdentityInput: A0SemanticSeedInputV1 = {
    scope: input.scope,
    bootstrap_logical_time: input.logical_time,
    reality_binding_hash: realityBindingHash,
    runtime_config_hash: input.runtime_config.determinism_hash,
    evidence_window_semantic_digest: input.evidence_window.semantic_digest,
    model_component_versions: {
      bootstrap_model_component_id: posterior.model_component_id,
      prior_rule_id: posterior.model_versions.prior_rule_id,
      observation_operator_id: posterior.model_versions.observation_operator_id,
      assimilation_method_id: posterior.model_versions.assimilation_method_id,
      uncertainty_method_id: posterior.model_versions.uncertainty_method_id,
      physical_bound_version: posterior.model_versions.physical_bound_version,
      forecast_policy_version: "MCFT_CAP_01_BLOCKED_PREREQUISITES_V1",
    },
    operation_variant: A0_OPERATION_VARIANT_V1,
  };
  const identity = deriveA0IdentityV1(a0IdentityInput);
  const ids = identity.member_object_ids;
  const lineageId = deriveSemanticObjectIdV1("lineage", {
    lineage_kind: "INITIAL",
    scope: input.scope,
    reality_binding_ref: realityBindingRef,
    reality_binding_hash: realityBindingHash,
    runtime_config_ref: input.runtime_config.object_id,
    runtime_config_hash: input.runtime_config.determinism_hash,
    bootstrap_logical_time: input.logical_time,
  });
  const revisionId = deriveSemanticObjectIdV1("revision", {
    revision_kind: "INITIAL",
    lineage_id: lineageId,
    bootstrap_logical_time: input.logical_time,
    runtime_config_hash: input.runtime_config.determinism_hash,
    reality_binding_hash: realityBindingHash,
  });
  const memberKey = (objectType: string): string => deriveSemanticObjectIdV1("a0_member_key", { a0_idempotency_key: identity.a0_idempotency_key, object_type: objectType });
  const sourceRefs = [...new Set<string>([realityBindingRef, ...input.evidence_window.selected_source_refs])].sort();
  const evidenceRefs = [...input.evidence_window.selected_evidence_refs].sort();
  const limitations: string[] = ["CONTROLLED_SYNTHETIC_REPLAY_PROXY", "NOT_FIELD_CALIBRATED", "A0_BOOTSTRAP_ONLY", "NO_PROPAGATION_MODEL", "NO_SUCCESSFUL_FORECAST"];
  const nextTickLogicalTime = addOneHourIsoV1(input.logical_time);
  const forecastReasons: string[] = [...A0_BLOCKED_FORECAST_REASON_CODES_V1];
  if (input.evidence_window.coverage.future_weather_assumption_count === 0) forecastReasons.push("FUTURE_WEATHER_ASSUMPTION_NOT_AVAILABLE_AT_TICK");
  if (input.evidence_window.coverage.future_et0_assumption_count === 0) forecastReasons.push("FUTURE_ET0_ASSUMPTION_NOT_AVAILABLE_AT_TICK");

  const lineageContext = { lineage_id: lineageId, revision_id: revisionId };
  const member = (type: CanonicalObjectEnvelopeV1["object_type"], payload: Record<string, unknown>, options: { source_refs?: readonly string[]; evidence_refs?: readonly string[]; lineage?: boolean; extra_limitations?: readonly string[] } = {}): CanonicalObjectEnvelopeV1 => buildMemberV1({
    type,
    object_id: ids[type as keyof typeof ids],
    idempotency_key: memberKey(type),
    payload,
    scope: input.scope,
    logical_time: input.logical_time,
    created_at: input.created_at,
    source_refs: options.source_refs ?? sourceRefs,
    evidence_refs: options.evidence_refs ?? evidenceRefs,
    runtime_config: input.runtime_config,
    limitations: [...limitations, ...(options.extra_limitations ?? [])],
    ...(options.lineage === false ? {} : lineageContext),
  });

  const members: CanonicalObjectEnvelopeV1[] = [
    member("twin_runtime_lineage_v1", {
      lineage_kind: "INITIAL", parent_lineage_ref: null, revision_run_ref: null,
      bootstrap_runtime_config_ref: input.runtime_config.object_id,
      bootstrap_reality_binding_ref: realityBindingRef,
      initial_revision_id: revisionId,
      activation_authority_kind: "INITIAL_LINEAGE_DECLARATION",
      activation_authority_ref: ids.twin_runtime_lineage_v1,
    }, { source_refs: [realityBindingRef], evidence_refs: [] }),
    member("twin_evidence_window_v1", {
      window_rule_id: input.evidence_window.window_rule_id,
      selection_policy_id: input.evidence_window.selection_policy_id,
      window_start_exclusive: input.evidence_window.window_start_exclusive,
      window_end_inclusive: input.evidence_window.window_end_inclusive,
      frozen: true,
      selected_records: input.evidence_window.selected_records,
      excluded_records: input.evidence_window.excluded_records,
      selected_evidence_refs: evidenceRefs,
      consumed_evidence_refs: [...input.evidence_window.consumed_evidence_refs],
      context_only_evidence_refs: [...input.evidence_window.context_only_evidence_refs],
      assimilation_observation_ref: input.evidence_window.assimilation_observation.source_record_id,
      coverage: input.evidence_window.coverage,
      exclusion_counts: input.evidence_window.exclusion_counts,
      semantic_digest: input.evidence_window.semantic_digest,
    }),
    member("twin_state_transition_v1", {
      transition_kind: "BOOTSTRAP", previous_posterior_ref: null,
      bootstrap_prior: {
        prior_kind: posterior.prior.prior_kind, mean: posterior.prior.mean, variance: posterior.prior.variance, stddev: posterior.prior.stddev,
        derivation_rule_id: posterior.model_versions.prior_rule_id,
        source_runtime_config_ref: input.runtime_config.object_id,
        source_soil_hydraulic_config_ref: input.soil_hydraulic_config_ref,
      },
      process_model_status: "NOT_APPLIED_BOOTSTRAP",
      evidence_window_ref: ids.twin_evidence_window_v1,
      assimilation_update_ref: ids.twin_assimilation_update_v1,
      posterior_state_ref: ids.twin_state_estimate_v1,
    }),
    member("twin_assimilation_update_v1", {
      state_transition_ref: ids.twin_state_transition_v1, posterior_state_ref: ids.twin_state_estimate_v1,
      observation_ref: input.evidence_window.assimilation_observation.source_record_id,
      observation_operator_id: posterior.model_versions.observation_operator_id,
      assimilation_method_id: posterior.model_versions.assimilation_method_id,
      observation_fraction: posterior.observation_update.observation_fraction,
      quality_status: posterior.observation_update.quality_status,
      quality_weight: posterior.observation_update.quality_weight,
      predicted_observation: posterior.observation_update.predicted_observation,
      innovation: posterior.observation_update.innovation,
      sensor_variance: posterior.observation_update.sensor_variance,
      representativeness_variance: posterior.observation_update.representativeness_variance,
      effective_observation_variance: posterior.observation_update.effective_observation_variance,
      assimilation_gain: posterior.observation_update.assimilation_gain,
      posterior_mean: posterior.posterior.mean,
      posterior_variance: posterior.posterior.variance,
    }, { evidence_refs: [input.evidence_window.assimilation_observation.source_record_id] }),
    member("twin_state_estimate_v1", {
      state_kind: "POSTERIOR", transition_ref: ids.twin_state_transition_v1, assimilation_update_ref: ids.twin_assimilation_update_v1,
      evidence_window_ref: ids.twin_evidence_window_v1, latent_variable: posterior.latent_variable, prior: posterior.prior,
      observation_update: posterior.observation_update, posterior: posterior.posterior, derived_state: posterior.derived_state,
      unavailable_state: posterior.unavailable_state, physical_bounds: posterior.physical_bounds, confidence: posterior.confidence,
      use_eligibility: posterior.use_eligibility, direct_state_equivalence: posterior.direct_state_equivalence, model_versions: posterior.model_versions,
    }, { extra_limitations: posterior.limitations }),
    member("twin_forecast_run_v1", {
      status: "BLOCKED", points: [], reason_codes: forecastReasons, scenario_eligible: false,
      source_posterior_ref: ids.twin_state_estimate_v1, requested_horizon_hours: 72, successful_forecast_ref: null,
    }),
    member("twin_runtime_tick_v1", {
      transaction_family: "A_STATE_TICK_COMMIT", operation_variant: A0_OPERATION_VARIANT_V1, status: "COMPLETED_WITH_LIMITATIONS",
      evidence_window_ref: ids.twin_evidence_window_v1, state_transition_ref: ids.twin_state_transition_v1,
      assimilation_update_ref: ids.twin_assimilation_update_v1, posterior_state_ref: ids.twin_state_estimate_v1,
      forecast_result_ref: ids.twin_forecast_run_v1, checkpoint_ref: ids.twin_runtime_checkpoint_v1,
      next_tick_logical_time: nextTickLogicalTime,
    }),
    member("twin_runtime_checkpoint_v1", {
      checkpoint_kind: "INITIAL", previous_checkpoint_ref: null, last_completed_tick_ref: ids.twin_runtime_tick_v1,
      last_posterior_state_ref: ids.twin_state_estimate_v1, forecast_result_ref: ids.twin_forecast_run_v1,
      successful_forecast_ref: null, next_tick_logical_time: nextTickLogicalTime,
      handoff_status: "CHECKPOINT_POINTER_READY_PERSISTED_INPUT_RECONSTRUCTION_REQUIRED",
    }),
    member("twin_runtime_health_v1", {
      operation_status: "A0_COMMITTED_WITH_BLOCKED_FORECAST", runtime_mode: "REPLAY", tick_ref: ids.twin_runtime_tick_v1,
      checkpoint_ref: ids.twin_runtime_checkpoint_v1, active_lineage_ref: ids.twin_runtime_lineage_v1,
      state_ref: ids.twin_state_estimate_v1, forecast_result_ref: ids.twin_forecast_run_v1,
      successful_forecast_ref: null, limitation_reason_codes: forecastReasons,
    }, { lineage: false }),
  ];

  const recordSet: A0RecordSetV1 = {
    a0_identity_input: a0IdentityInput,
    a0_semantic_seed: identity.a0_semantic_seed,
    a0_record_set_id: identity.a0_record_set_id,
    a0_idempotency_key: identity.a0_idempotency_key,
    a0_record_set_determinism_hash: "",
    members,
  };
  recordSet.a0_record_set_determinism_hash = computeA0RecordSetDeterminismHashV1({ a0_record_set_id: recordSet.a0_record_set_id, members: members as unknown as Record<string, unknown>[] });
  validateA0RecordSetV1(recordSet);
  return recordSet;
}
