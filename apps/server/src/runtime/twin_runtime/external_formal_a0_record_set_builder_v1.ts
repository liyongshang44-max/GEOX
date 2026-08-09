// apps/server/src/runtime/twin_runtime/external_formal_a0_record_set_builder_v1.ts
// Purpose: construct one deterministic honest External Formal nine-object A0 canonical candidate graph from the B3 External Runtime Config, B1 External Evidence Window, and frozen CAP01 bootstrap mathematics used only as a non-canonical compatibility producer.
// Boundary: pure construction/validation only; no persistence, database, lease, provider fetch, scheduler, wall clock reads, route, recommendation, action, model activation, or O00 execution.

import {
  buildExternalFormalBootstrapPosteriorAuthorityV1,
} from "../../domain/soil_water/external_formal_bootstrap_posterior_authority_v1.js";
import {
  buildRootZoneWaterPosteriorV1,
  type BootstrapWaterModelConfigV1,
} from "../../domain/soil_water/root_zone_water_posterior_v1.js";
import {
  computeA0RecordSetDeterminismHashV1,
  computeMemberDeterminismHashV1,
  deriveA0IdentityV1,
  deriveSemanticObjectIdV1,
  type A0SemanticSeedInputV1,
} from "../../domain/twin_runtime/canonical_identity_v1.js";
import {
  validateA0RecordSetV1,
  validateCanonicalObjectV1,
  type A0RecordSetV1,
  type CanonicalObjectEnvelopeV1,
} from "../../domain/twin_runtime/canonical_object_contracts_v1.js";
import {
  MCFT_CAP09_EXTERNAL_FORMAL_RUNTIME_MODE_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1,
  validateExternalFormalRuntimeConfigPayloadV1,
  type ExternalFormalRuntimeConfigPayloadV1,
} from "../../domain/twin_runtime/external_formal_runtime_config_v1.js";
import {
  MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_SOIL_OBSERVATION_OPERATOR_ID_V1,
} from "../../domain/twin_runtime/external_formal_evidence_binding_profile_v1.js";
import type { SoilHydraulicBoundsV1 } from "../../domain/twin_runtime/physical_bounds_v1.js";
import { A0_BLOCKED_FORECAST_REASON_CODES_V1, A0_OPERATION_VARIANT_V1 } from "./a0_record_set_builder_v1.js";
import type { FrozenEvidenceWindowV1 } from "./evidence_window_builder_v1.js";
import type { TwinScopeKeyV1 } from "./ports.js";

export type BuildExternalFormalA0RecordSetInputV1 = {
  scope: TwinScopeKeyV1;
  logical_time: string;
  created_at: string;
  runtime_config: CanonicalObjectEnvelopeV1;
  evidence_window: FrozenEvidenceWindowV1;
  hydraulic: SoilHydraulicBoundsV1;
  soil_hydraulic_model_prior_ref: string;
  compatibility_bootstrap_model_config: BootstrapWaterModelConfigV1;
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

type ScopeComparableV1 = {
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

function addOneHourIsoV1(logicalTime: string): string {
  return new Date(Date.parse(logicalTime) + 60 * 60 * 1000).toISOString();
}

function exactScopeV1(actual: ScopeComparableV1, expected: TwinScopeKeyV1, code: string): void {
  for (const field of ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"] as const) {
    if (actual[field] !== expected[field]) throw new Error(`${code}:${field}`);
  }
}

function externalScopeV1(): TwinScopeKeyV1 {
  return { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 };
}

function buildMemberV1(input: MemberBuildInputV1): CanonicalObjectEnvelopeV1 {
  const member: CanonicalObjectEnvelopeV1 = {
    object_id: input.object_id,
    object_type: input.type,
    schema_version: "v1",
    ...input.scope,
    logical_time: input.logical_time,
    as_of: input.logical_time,
    source_refs: [...new Set(input.source_refs)].sort(),
    evidence_refs: [...new Set(input.evidence_refs)].sort(),
    runtime_config_ref: input.runtime_config.object_id,
    runtime_config_hash: input.runtime_config.determinism_hash,
    idempotency_key: input.idempotency_key,
    determinism_hash: "",
    limitations: [...new Set(input.limitations)],
    created_at: input.created_at,
    payload: input.payload,
    ...(input.lineage_id ? { lineage_id: input.lineage_id } : {}),
    ...(input.revision_id ? { revision_id: input.revision_id } : {}),
  };
  member.determinism_hash = computeMemberDeterminismHashV1(member as unknown as Record<string, unknown>);
  return member;
}

export function buildExternalFormalA0RecordSetV1(
  input: BuildExternalFormalA0RecordSetInputV1,
): A0RecordSetV1 {
  const logicalTime = canonicalIsoV1(input.logical_time, "EXTERNAL_A0_LOGICAL_TIME_INVALID");
  canonicalIsoV1(input.created_at, "EXTERNAL_A0_CREATED_AT_INVALID");
  exactScopeV1(input.scope, externalScopeV1(), "EXTERNAL_A0_SCOPE_MISMATCH");

  validateCanonicalObjectV1(input.runtime_config);
  if (input.runtime_config.object_type !== "twin_runtime_config_v1") throw new Error("EXTERNAL_A0_RUNTIME_CONFIG_OBJECT_TYPE_REQUIRED");
  exactScopeV1(input.runtime_config, input.scope, "EXTERNAL_A0_RUNTIME_CONFIG_SCOPE_MISMATCH");
  if (input.runtime_config.logical_time !== logicalTime || input.runtime_config.as_of !== logicalTime) {
    throw new Error("EXTERNAL_A0_RUNTIME_CONFIG_TIME_MISMATCH");
  }
  validateExternalFormalRuntimeConfigPayloadV1(input.runtime_config.payload);
  const runtimePayload = input.runtime_config.payload as unknown as ExternalFormalRuntimeConfigPayloadV1;
  if (runtimePayload.config_role !== "A0_BOOTSTRAP") throw new Error("EXTERNAL_A0_BOOTSTRAP_CONFIG_ROLE_REQUIRED");
  if (runtimePayload.runtime_mode !== MCFT_CAP09_EXTERNAL_FORMAL_RUNTIME_MODE_V1) throw new Error("EXTERNAL_A0_RUNTIME_MODE_MISMATCH");
  if (runtimePayload.parent_runtime_config_ref !== null || runtimePayload.parent_runtime_config_hash !== null) {
    throw new Error("EXTERNAL_A0_PARENT_CONFIG_FORBIDDEN");
  }

  if (input.evidence_window.logical_time !== logicalTime
    || input.evidence_window.window_end_inclusive !== logicalTime
    || input.evidence_window.frozen !== true) {
    throw new Error("EXTERNAL_A0_FROZEN_EVIDENCE_WINDOW_REQUIRED");
  }
  if (input.evidence_window.authorized_soil_binding_id !== MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1) {
    throw new Error("EXTERNAL_A0_SOIL_BINDING_AUTHORITY_REQUIRED");
  }
  if (input.evidence_window.assimilation_observation.binding_id !== MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1) {
    throw new Error("EXTERNAL_A0_SELECTED_SOIL_BINDING_MISMATCH");
  }
  if (input.evidence_window.consumed_evidence_refs.length !== 1
    || input.evidence_window.consumed_evidence_refs[0] !== input.evidence_window.assimilation_observation.source_record_id) {
    throw new Error("EXTERNAL_A0_EXACTLY_ONE_CONSUMED_SOIL_OBSERVATION_REQUIRED");
  }

  const realityBindingRef = requiredStringV1(runtimePayload.reality_binding_ref, "EXTERNAL_A0_REALITY_BINDING_REF_REQUIRED");
  const realityBindingHash = requiredStringV1(runtimePayload.reality_binding_hash, "EXTERNAL_A0_REALITY_BINDING_HASH_REQUIRED");
  const modelPriorRef = requiredStringV1(runtimePayload.model_prior.source_ref, "EXTERNAL_A0_MODEL_PRIOR_REF_REQUIRED");
  const soilHydraulicModelPriorRef = requiredStringV1(input.soil_hydraulic_model_prior_ref, "EXTERNAL_A0_SOIL_HYDRAULIC_MODEL_PRIOR_REF_REQUIRED");
  if (soilHydraulicModelPriorRef !== modelPriorRef) throw new Error("EXTERNAL_A0_SOIL_HYDRAULIC_MODEL_PRIOR_REF_MISMATCH");

  const compatibilityPosterior = buildRootZoneWaterPosteriorV1({
    observation_fraction: input.evidence_window.assimilation_observation.canonical_payload.value,
    quality_status: input.evidence_window.assimilation_observation.quality.status,
    hydraulic: input.hydraulic,
    model_config: input.compatibility_bootstrap_model_config,
  });
  const posteriorAuthority = buildExternalFormalBootstrapPosteriorAuthorityV1({
    compatibility_posterior: compatibilityPosterior,
    authorized_soil_binding_id: input.evidence_window.authorized_soil_binding_id,
    selected_observation_ref: input.evidence_window.assimilation_observation.source_record_id,
  });
  const posterior = posteriorAuthority.posterior_candidate;

  const a0IdentityInput: A0SemanticSeedInputV1 = {
    scope: input.scope,
    bootstrap_logical_time: logicalTime,
    reality_binding_hash: realityBindingHash,
    runtime_config_hash: input.runtime_config.determinism_hash,
    evidence_window_semantic_digest: input.evidence_window.semantic_digest,
    model_component_versions: {
      bootstrap_model_component_id: posterior.model_component_id,
      prior_rule_id: posterior.model_versions.prior_rule_id,
      observation_operator_id: MCFT_CAP09_EXTERNAL_FORMAL_SOIL_OBSERVATION_OPERATOR_ID_V1,
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
    bootstrap_logical_time: logicalTime,
    authority_scope_class: runtimePayload.authority_scope_class,
  });
  const revisionId = deriveSemanticObjectIdV1("revision", {
    revision_kind: "INITIAL",
    lineage_id: lineageId,
    bootstrap_logical_time: logicalTime,
    runtime_config_hash: input.runtime_config.determinism_hash,
    reality_binding_hash: realityBindingHash,
  });
  const memberKey = (objectType: string): string => deriveSemanticObjectIdV1("a0_member_key", {
    a0_idempotency_key: identity.a0_idempotency_key,
    object_type: objectType,
  });
  const sourceRefs = [...new Set<string>([
    realityBindingRef,
    modelPriorRef,
    ...input.runtime_config.source_refs,
    ...input.evidence_window.selected_source_refs,
  ])].sort();
  const evidenceRefs = [...input.evidence_window.selected_evidence_refs].sort();
  const limitations: string[] = [
    "EXTERNAL_PUBLIC_RESEARCH_SCOPE",
    "MODEL_PRIOR_FROM_CAP08",
    "NOT_FIELD_CALIBRATED",
    "KBS_SOIL_MEASUREMENT_DEPTH_100MM",
    "NEAR_SITE_POINT_SUPPORT",
    "PARTIAL_ROOT_ZONE_REPRESENTATIVENESS",
    "DIRECT_FIELD_EQUIVALENCE_FALSE",
    "DIRECT_ROOT_ZONE_EQUIVALENCE_FALSE",
    "A0_BOOTSTRAP_ONLY",
    "NO_PROPAGATION_MODEL",
    "NO_SUCCESSFUL_FORECAST",
    "NO_RECOMMENDATION",
    "NO_ACTION_AUTHORITY",
  ];
  const nextTickLogicalTime = addOneHourIsoV1(logicalTime);
  const forecastReasons: string[] = [...A0_BLOCKED_FORECAST_REASON_CODES_V1];
  if (input.evidence_window.coverage.future_weather_assumption_count === 0) forecastReasons.push("FUTURE_WEATHER_ASSUMPTION_NOT_AVAILABLE_AT_TICK");
  if (input.evidence_window.coverage.future_et0_assumption_count === 0) forecastReasons.push("FUTURE_ET0_ASSUMPTION_NOT_AVAILABLE_AT_TICK");

  const lineageContext = { lineage_id: lineageId, revision_id: revisionId };
  const member = (
    type: CanonicalObjectEnvelopeV1["object_type"],
    payload: Record<string, unknown>,
    options: {
      source_refs?: readonly string[];
      evidence_refs?: readonly string[];
      lineage?: boolean;
      extra_limitations?: readonly string[];
    } = {},
  ): CanonicalObjectEnvelopeV1 => buildMemberV1({
    type,
    object_id: ids[type as keyof typeof ids],
    idempotency_key: memberKey(type),
    payload,
    scope: input.scope,
    logical_time: logicalTime,
    created_at: input.created_at,
    source_refs: options.source_refs ?? sourceRefs,
    evidence_refs: options.evidence_refs ?? evidenceRefs,
    runtime_config: input.runtime_config,
    limitations: [...limitations, ...(options.extra_limitations ?? [])],
    ...(options.lineage === false ? {} : lineageContext),
  });

  const members: CanonicalObjectEnvelopeV1[] = [
    member("twin_runtime_lineage_v1", {
      lineage_kind: "INITIAL",
      parent_lineage_ref: null,
      revision_run_ref: null,
      bootstrap_runtime_config_ref: input.runtime_config.object_id,
      bootstrap_reality_binding_ref: realityBindingRef,
      initial_revision_id: revisionId,
      activation_authority_kind: "INITIAL_LINEAGE_DECLARATION",
      activation_authority_ref: ids.twin_runtime_lineage_v1,
      runtime_mode: MCFT_CAP09_EXTERNAL_FORMAL_RUNTIME_MODE_V1,
      authority_scope_class: runtimePayload.authority_scope_class,
    }, { source_refs: [...input.runtime_config.source_refs, realityBindingRef, modelPriorRef], evidence_refs: [] }),
    member("twin_evidence_window_v1", {
      window_rule_id: input.evidence_window.window_rule_id,
      selection_policy_id: input.evidence_window.selection_policy_id,
      window_start_exclusive: input.evidence_window.window_start_exclusive,
      window_end_inclusive: input.evidence_window.window_end_inclusive,
      frozen: true,
      authorized_soil_binding_id: MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
      selected_records: input.evidence_window.selected_records,
      excluded_records: input.evidence_window.excluded_records,
      selected_evidence_refs: evidenceRefs,
      consumed_evidence_refs: [...input.evidence_window.consumed_evidence_refs],
      context_only_evidence_refs: [...input.evidence_window.context_only_evidence_refs],
      assimilation_observation_ref: input.evidence_window.assimilation_observation.source_record_id,
      assimilation_observation_binding_id: input.evidence_window.assimilation_observation.binding_id,
      coverage: input.evidence_window.coverage,
      exclusion_counts: input.evidence_window.exclusion_counts,
      semantic_digest: input.evidence_window.semantic_digest,
    }),
    member("twin_state_transition_v1", {
      transition_kind: "BOOTSTRAP",
      previous_posterior_ref: null,
      bootstrap_prior: {
        prior_kind: posterior.prior.prior_kind,
        mean: posterior.prior.mean,
        variance: posterior.prior.variance,
        stddev: posterior.prior.stddev,
        derivation_rule_id: posterior.model_versions.prior_rule_id,
        source_runtime_config_ref: input.runtime_config.object_id,
        source_model_prior_ref: modelPriorRef,
        source_soil_hydraulic_model_prior_ref: soilHydraulicModelPriorRef,
      },
      process_model_status: "NOT_APPLIED_BOOTSTRAP",
      evidence_window_ref: ids.twin_evidence_window_v1,
      assimilation_update_ref: ids.twin_assimilation_update_v1,
      posterior_state_ref: ids.twin_state_estimate_v1,
    }),
    member("twin_assimilation_update_v1", {
      state_transition_ref: ids.twin_state_transition_v1,
      posterior_state_ref: ids.twin_state_estimate_v1,
      observation_ref: input.evidence_window.assimilation_observation.source_record_id,
      observation_binding_id: MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
      observation_operator_id: MCFT_CAP09_EXTERNAL_FORMAL_SOIL_OBSERVATION_OPERATOR_ID_V1,
      observation_operator_h: 1,
      measurement_depth_mm: 100,
      spatial_support: "NEAR_SITE_POINT_SUPPORT",
      root_zone_representativeness: "PARTIAL",
      direct_field_equivalence: false,
      direct_root_zone_equivalence: false,
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
      compatibility_numeric_digest: posteriorAuthority.compatibility_numeric_digest,
      external_candidate_numeric_digest: posteriorAuthority.external_candidate_numeric_digest,
    }, { evidence_refs: [input.evidence_window.assimilation_observation.source_record_id] }),
    member("twin_state_estimate_v1", {
      state_kind: "POSTERIOR",
      transition_ref: ids.twin_state_transition_v1,
      assimilation_update_ref: ids.twin_assimilation_update_v1,
      evidence_window_ref: ids.twin_evidence_window_v1,
      latent_variable: posterior.latent_variable,
      prior: posterior.prior,
      observation_update: posterior.observation_update,
      posterior: posterior.posterior,
      derived_state: posterior.derived_state,
      unavailable_state: posterior.unavailable_state,
      physical_bounds: posterior.physical_bounds,
      confidence: posterior.confidence,
      use_eligibility: posterior.use_eligibility,
      direct_state_equivalence: posterior.direct_state_equivalence,
      model_versions: posterior.model_versions,
      external_authority: posterior.external_authority,
      numerical_identity_preserved: posteriorAuthority.numerical_identity_preserved,
    }, { extra_limitations: posterior.limitations }),
    member("twin_forecast_run_v1", {
      status: "BLOCKED",
      points: [],
      reason_codes: forecastReasons,
      scenario_eligible: false,
      source_posterior_ref: ids.twin_state_estimate_v1,
      requested_horizon_hours: 72,
      successful_forecast_ref: null,
    }),
    member("twin_runtime_tick_v1", {
      transaction_family: "A_STATE_TICK_COMMIT",
      operation_variant: A0_OPERATION_VARIANT_V1,
      status: "COMPLETED_WITH_LIMITATIONS",
      runtime_mode: MCFT_CAP09_EXTERNAL_FORMAL_RUNTIME_MODE_V1,
      evidence_window_ref: ids.twin_evidence_window_v1,
      state_transition_ref: ids.twin_state_transition_v1,
      assimilation_update_ref: ids.twin_assimilation_update_v1,
      posterior_state_ref: ids.twin_state_estimate_v1,
      forecast_result_ref: ids.twin_forecast_run_v1,
      checkpoint_ref: ids.twin_runtime_checkpoint_v1,
      next_tick_logical_time: nextTickLogicalTime,
    }),
    member("twin_runtime_checkpoint_v1", {
      checkpoint_kind: "INITIAL",
      previous_checkpoint_ref: null,
      last_completed_tick_ref: ids.twin_runtime_tick_v1,
      last_posterior_state_ref: ids.twin_state_estimate_v1,
      forecast_result_ref: ids.twin_forecast_run_v1,
      successful_forecast_ref: null,
      next_tick_logical_time: nextTickLogicalTime,
      handoff_status: "CHECKPOINT_POINTER_READY_PERSISTED_INPUT_RECONSTRUCTION_REQUIRED",
      runtime_mode: MCFT_CAP09_EXTERNAL_FORMAL_RUNTIME_MODE_V1,
    }),
    member("twin_runtime_health_v1", {
      operation_status: "EXTERNAL_A0_CANONICAL_CANDIDATE_WITH_BLOCKED_FORECAST",
      runtime_mode: MCFT_CAP09_EXTERNAL_FORMAL_RUNTIME_MODE_V1,
      tick_ref: ids.twin_runtime_tick_v1,
      checkpoint_ref: ids.twin_runtime_checkpoint_v1,
      active_lineage_ref: ids.twin_runtime_lineage_v1,
      state_ref: ids.twin_state_estimate_v1,
      forecast_result_ref: ids.twin_forecast_run_v1,
      successful_forecast_ref: null,
      limitation_reason_codes: forecastReasons,
    }, { lineage: false }),
  ];

  const forbiddenCanonicalText = JSON.stringify(members);
  if (forbiddenCanonicalText.includes("CONTROLLED_SYNTHETIC_REPLAY_PROXY")
    || forbiddenCanonicalText.includes('"runtime_mode":"REPLAY"')
    || forbiddenCanonicalText.includes('"observation_operator_id":"POINT_200MM_TO_ROOT_ZONE_MEAN_H1_WITH_REPRESENTATIVENESS_V1"')
    || forbiddenCanonicalText.includes('"truth_class":"CONTROLLED_SYNTHETIC"')) {
    throw new Error("EXTERNAL_A0_REPLAY_OR_SYNTHETIC_CANONICAL_MARKER_FORBIDDEN");
  }

  const recordSet: A0RecordSetV1 = {
    a0_identity_input: a0IdentityInput,
    a0_semantic_seed: identity.a0_semantic_seed,
    a0_record_set_id: identity.a0_record_set_id,
    a0_idempotency_key: identity.a0_idempotency_key,
    a0_record_set_determinism_hash: "",
    members,
  };
  recordSet.a0_record_set_determinism_hash = computeA0RecordSetDeterminismHashV1({
    a0_record_set_id: recordSet.a0_record_set_id,
    members: members as unknown as Record<string, unknown>[],
  });
  validateA0RecordSetV1(recordSet);
  return recordSet;
}
