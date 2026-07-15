// apps/server/src/runtime/twin_runtime/effective_feedback_runtime_config_v1.ts
// Purpose: compile the executable MCFT-CAP-05 Runtime Config profile used by receipt consumption, Forecast Residual matching and the bounded eight-tick feedback chain.
// Boundary: pure deterministic configuration compilation only; no persistence, active-config mutation, Runtime execution, route, scheduler, filesystem, environment, calibration, model activation or CAP-06 authority.

import {
  computeMemberDeterminismHashV1,
  deriveSemanticObjectIdV1,
} from "../../domain/twin_runtime/canonical_identity_v1.js";
import type { CanonicalObjectEnvelopeV1 } from "../../domain/twin_runtime/canonical_object_contracts_v1.js";
import {
  CAP05_ACTION_FEEDBACK_ELIGIBILITY_POLICY_V1,
  CAP05_ACTION_FEEDBACK_QUALITY_MAPPING_POLICY_V1,
  CAP05_TARGET_EQUIVALENT_IRRIGATION_POLICY_V1,
} from "../../domain/twin_runtime/feedback_canonical_contracts_v1.js";
import {
  compileCap05RuntimeConfigV1,
  type CompileCap05RuntimeConfigInputV1,
} from "../../domain/twin_runtime/feedback_runtime_config_v1.js";
import {
  CAP05_FORECAST_ASSIMILATION_RELATION_POLICY_V1,
  CAP05_FORECAST_OBSERVATION_PROJECTION_METHOD_ID_V1,
  CAP05_FORECAST_OBSERVATION_PROJECTION_METHOD_VERSION_V1,
  CAP05_FORECAST_POINT_MEMBER_REF_POLICY_ID_V1,
  CAP05_FORECAST_RESIDUAL_MATCHING_POLICY_ID_V1,
  CAP05_FORECAST_RESIDUAL_NORMALIZATION_BASIS_V1,
} from "../../domain/twin_runtime/forecast_observation_residual_v1.js";
import {
  CAP05_ACTION_FEEDBACK_ADAPTER_POLICY_ID_V1,
  CAP05_ACTION_FEEDBACK_AMOUNT_SEMANTICS_POLICY_ID_V1,
  CAP05_ACTION_FEEDBACK_EVIDENCE_CUTOFF_POLICY_ID_V1,
  CAP05_ACTION_FEEDBACK_INTERVAL_POLICY_ID_V1,
  CAP05_ACTION_FEEDBACK_LATE_POLICY_ID_V1,
  CAP05_ACTION_FEEDBACK_MULTIPLE_EVENT_POLICY_ID_V1,
  CAP05_ACTION_FEEDBACK_SPATIAL_OVERLAP_POLICY_ID_V1,
  CAP05_ACTION_FEEDBACK_VOLUME_TO_DEPTH_POLICY_ID_V1,
} from "./action_feedback_tick_selector_v1.js";

export const CAP05_EFFECTIVE_RUNTIME_CONFIG_PROFILE_ID_V1 =
  "MCFT_CAP_05_EXECUTABLE_FEEDBACK_RUNTIME_CONFIG_PROFILE_V1" as const;

export type CompileCap05EffectiveRuntimeConfigChainInputV1 =
  Omit<CompileCap05RuntimeConfigInputV1, "effective_logical_time" | "created_at" | "parent_runtime_config_ref" | "parent_runtime_config_hash"> & {
    first_effective_logical_time: string;
    parent_runtime_config_ref: string;
    parent_runtime_config_hash: string;
    count: number;
  };

function requiredCanonicalHourV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) throw new Error(code);
  const date = new Date(parsed);
  if (date.getUTCMinutes() !== 0 || date.getUTCSeconds() !== 0 || date.getUTCMilliseconds() !== 0) {
    throw new Error(code);
  }
  return value;
}

function requiredStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

function addHoursV1(value: string, hours: number): string {
  return new Date(Date.parse(value) + hours * 3_600_000).toISOString();
}

export function compileCap05EffectiveRuntimeConfigV1(
  input: CompileCap05RuntimeConfigInputV1,
): CanonicalObjectEnvelopeV1 {
  const base = compileCap05RuntimeConfigV1(input);
  const payload = {
    ...base.payload,
    executable_profile_id: CAP05_EFFECTIVE_RUNTIME_CONFIG_PROFILE_ID_V1,
    action_feedback_state_input_policy_id: CAP05_ACTION_FEEDBACK_ELIGIBILITY_POLICY_V1,
    action_feedback_quality_mapping_policy_id: CAP05_ACTION_FEEDBACK_QUALITY_MAPPING_POLICY_V1,
    evidence_cutoff_policy_id: CAP05_ACTION_FEEDBACK_EVIDENCE_CUTOFF_POLICY_ID_V1,
    late_receipt_policy_id: CAP05_ACTION_FEEDBACK_LATE_POLICY_ID_V1,
    execution_interval_policy_id: CAP05_ACTION_FEEDBACK_INTERVAL_POLICY_ID_V1,
    multiple_execution_event_policy_id: CAP05_ACTION_FEEDBACK_MULTIPLE_EVENT_POLICY_ID_V1,
    spatial_overlap_policy_id: CAP05_ACTION_FEEDBACK_SPATIAL_OVERLAP_POLICY_ID_V1,
    actual_amount_semantics_policy_id: CAP05_ACTION_FEEDBACK_AMOUNT_SEMANTICS_POLICY_ID_V1,
    effective_irrigation_policy_id: CAP05_TARGET_EQUIVALENT_IRRIGATION_POLICY_V1,
    volume_to_depth_policy_id: CAP05_ACTION_FEEDBACK_VOLUME_TO_DEPTH_POLICY_ID_V1,
    action_feedback_adapter_policy_id: CAP05_ACTION_FEEDBACK_ADAPTER_POLICY_ID_V1,
    forecast_residual_matching_policy_id: CAP05_FORECAST_RESIDUAL_MATCHING_POLICY_ID_V1,
    forecast_point_member_ref_policy_id: CAP05_FORECAST_POINT_MEMBER_REF_POLICY_ID_V1,
    forecast_observation_projection_method_id: CAP05_FORECAST_OBSERVATION_PROJECTION_METHOD_ID_V1,
    forecast_observation_projection_version: CAP05_FORECAST_OBSERVATION_PROJECTION_METHOD_VERSION_V1,
    forecast_residual_normalization_policy_id: CAP05_FORECAST_RESIDUAL_NORMALIZATION_BASIS_V1,
    forecast_assimilation_relation_policy_id: CAP05_FORECAST_ASSIMILATION_RELATION_POLICY_V1,
  };
  const scope = {
    tenant_id: base.tenant_id,
    project_id: base.project_id,
    group_id: base.group_id,
    field_id: base.field_id,
    season_id: base.season_id,
    zone_id: base.zone_id,
  };
  const identityBasis = {
    object_type: "twin_runtime_config_v1",
    scope,
    logical_time: base.logical_time,
    payload,
  };
  const config: CanonicalObjectEnvelopeV1 = {
    ...base,
    object_id: deriveSemanticObjectIdV1("twin_runtime_config", identityBasis),
    idempotency_key: deriveSemanticObjectIdV1("runtime_config_key", identityBasis),
    source_refs: [
      requiredStringV1(input.parent_runtime_config_ref, "CAP05_EFFECTIVE_CONFIG_PARENT_REF_REQUIRED"),
      requiredStringV1(input.reality_binding_ref, "CAP05_EFFECTIVE_CONFIG_REALITY_BINDING_REF_REQUIRED"),
    ].sort(),
    determinism_hash: "",
    payload,
  };
  config.determinism_hash = computeMemberDeterminismHashV1(config as unknown as Record<string, unknown>);
  return config;
}

export function compileCap05EffectiveRuntimeConfigChainV1(
  input: CompileCap05EffectiveRuntimeConfigChainInputV1,
): CanonicalObjectEnvelopeV1[] {
  if (!Number.isInteger(input.count) || input.count !== 8) {
    throw new Error("CAP05_EFFECTIVE_CONFIG_CHAIN_EXACTLY_EIGHT_REQUIRED");
  }
  const firstTime = requiredCanonicalHourV1(
    input.first_effective_logical_time,
    "CAP05_EFFECTIVE_CONFIG_CHAIN_FIRST_TIME_INVALID",
  );
  const result: CanonicalObjectEnvelopeV1[] = [];
  let parentRef = requiredStringV1(
    input.parent_runtime_config_ref,
    "CAP05_EFFECTIVE_CONFIG_CHAIN_PARENT_REF_REQUIRED",
  );
  let parentHash = requiredStringV1(
    input.parent_runtime_config_hash,
    "CAP05_EFFECTIVE_CONFIG_CHAIN_PARENT_HASH_REQUIRED",
  );
  for (let index = 0; index < input.count; index += 1) {
    const logicalTime = addHoursV1(firstTime, index);
    const config = compileCap05EffectiveRuntimeConfigV1({
      scope: input.scope,
      effective_logical_time: logicalTime,
      created_at: logicalTime,
      parent_runtime_config_ref: parentRef,
      parent_runtime_config_hash: parentHash,
      reality_binding_ref: input.reality_binding_ref,
      reality_binding_hash: input.reality_binding_hash,
      source_matrix_hash: input.source_matrix_hash,
      configuration_matrix_hash: input.configuration_matrix_hash,
      geometry_semantic_hash: input.geometry_semantic_hash,
    });
    result.push(config);
    parentRef = config.object_id;
    parentHash = config.determinism_hash;
  }
  return result;
}
