// apps/server/src/runtime/twin_runtime/cap05_feedback_config_execution_view_v1.ts
// Purpose: derive a non-canonical in-memory CAP-04 execution payload view from one canonical CAP-05 feedback Runtime Config while preserving the canonical CAP-05 ref/hash authority.
// Boundary: validation and in-memory adaptation only; no persistence, new canonical Config, hash mutation, active binding, model activation, route, scheduler, calibration, or CAP-06 Runtime authority.

import type { CanonicalObjectEnvelopeV1 } from "../../domain/twin_runtime/canonical_object_contracts_v1.js";
import {
  CAP05_CONFIG_SELECTION_MODE_V1,
  CAP05_RUNTIME_CONFIG_PURPOSE_V1,
  validateCap05RuntimeConfigPayloadV1,
  type Cap05RuntimeConfigPayloadV1,
} from "../../domain/twin_runtime/feedback_runtime_config_v1.js";
import {
  CAP04_CONFIG_SELECTION_MODE_V1,
  CAP04_RUNTIME_CONFIG_PURPOSE_V1,
  validateCap04RuntimeConfigPayloadV1,
  type Cap04RuntimeConfigPayloadV1,
} from "../../domain/twin_runtime/forecast_scenario_runtime_config_v1.js";
import type { RuntimeConfigRepositoryPortV1 } from "./ports.js";

export const CAP05_FEEDBACK_CONFIG_EXECUTION_VIEW_ID_V1 =
  "MCFT_CAP_05_FEEDBACK_CONFIG_TO_CAP_04_EXECUTION_VIEW_V1" as const;

function deriveInheritedCap04PayloadV1(
  payload: Cap05RuntimeConfigPayloadV1,
): Cap04RuntimeConfigPayloadV1 {
  const {
    cap05_contract_ids: _contracts,
    selected_option_member_reference_policy_id: _memberRef,
    decision_second_write_policy_id: _decisionWrite,
    approval_plan_binding_policy_id: _approvalPlan,
    evidence_availability_policy_id: _availability,
    action_feedback_eligibility_policy_id: _eligibility,
    action_feedback_quality_mapping_policy_id: _quality,
    action_feedback_adapter_id: _adapter,
    single_execution_event_guard_policy_id: _singleEvent,
    target_equivalent_irrigation_policy_id: _targetEquivalent,
    forecast_observation_projection_method_id: _projection,
    forecast_observation_variance_method_id: _variance,
    forecast_residual_formula_id: _residual,
    normalized_residual_formula_id: _normalized,
    forecast_assimilation_relation_policy_id: _relation,
    feedback_cycle_projection_policy_id: _cycle,
    dispatch_disposition_policy_id: _dispatch,
    cap05_limitations: _limitations,
    executable_profile_id: _profile,
    action_feedback_state_input_policy_id: _stateInput,
    action_feedback_quality_mapping_policy_id: _qualityAlias,
    evidence_cutoff_policy_id: _cutoff,
    late_receipt_policy_id: _late,
    execution_interval_policy_id: _interval,
    multiple_execution_event_policy_id: _multiple,
    spatial_overlap_policy_id: _overlap,
    actual_amount_semantics_policy_id: _amount,
    effective_irrigation_policy_id: _effective,
    volume_to_depth_policy_id: _volume,
    action_feedback_adapter_policy_id: _adapterPolicy,
    forecast_residual_matching_policy_id: _matching,
    forecast_point_member_ref_policy_id: _forecastPoint,
    forecast_observation_projection_version: _projectionVersion,
    forecast_residual_normalization_policy_id: _normalizationPolicy,
    config_purpose: _purpose,
    config_selection_mode: _selectionMode,
    ...inherited
  } = payload as Cap05RuntimeConfigPayloadV1 & Record<string, unknown>;

  const view = {
    ...structuredClone(inherited),
    config_purpose: CAP04_RUNTIME_CONFIG_PURPOSE_V1,
    config_selection_mode: CAP04_CONFIG_SELECTION_MODE_V1,
  } as Cap04RuntimeConfigPayloadV1;
  validateCap04RuntimeConfigPayloadV1(view);
  return view;
}

export function deriveCap05FeedbackConfigExecutionViewV1(
  canonicalConfig: CanonicalObjectEnvelopeV1,
): CanonicalObjectEnvelopeV1 {
  if (canonicalConfig.object_type !== "twin_runtime_config_v1") {
    throw new Error("CAP05_EXECUTION_VIEW_RUNTIME_CONFIG_OBJECT_TYPE_REQUIRED");
  }
  const payload = canonicalConfig.payload as unknown as Cap05RuntimeConfigPayloadV1;
  validateCap05RuntimeConfigPayloadV1(payload);
  if (payload.config_purpose !== CAP05_RUNTIME_CONFIG_PURPOSE_V1) {
    throw new Error("CAP05_EXECUTION_VIEW_CONFIG_PURPOSE_MISMATCH");
  }
  if (payload.config_selection_mode !== CAP05_CONFIG_SELECTION_MODE_V1) {
    throw new Error("CAP05_EXECUTION_VIEW_CONFIG_SELECTION_MODE_MISMATCH");
  }
  return {
    ...structuredClone(canonicalConfig),
    payload: deriveInheritedCap04PayloadV1(payload) as unknown as Record<string, unknown>,
  };
}

export class Cap05FeedbackExecutionRuntimeConfigRepositoryV1
implements RuntimeConfigRepositoryPortV1 {
  constructor(private readonly delegate: RuntimeConfigRepositoryPortV1) {}

  commitRuntimeConfig(config: CanonicalObjectEnvelopeV1): Promise<{
    status: "INSERTED" | "EXISTING_IDEMPOTENT_SUCCESS";
    object_id: string;
    fact_id: string;
  }> {
    return this.delegate.commitRuntimeConfig(config);
  }

  async readRuntimeConfig(objectId: string): Promise<CanonicalObjectEnvelopeV1 | null> {
    const canonicalConfig = await this.delegate.readRuntimeConfig(objectId);
    if (!canonicalConfig) return null;
    return deriveCap05FeedbackConfigExecutionViewV1(canonicalConfig);
  }
}
