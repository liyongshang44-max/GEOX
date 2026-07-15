// apps/server/src/runtime/twin_runtime/cap05_inherited_cap04_execution_config_resolver_v1.ts
// Purpose: validate one complete canonical CAP-05 effective feedback Runtime Config and derive a separate non-canonical CAP-04 execution payload view for reused State, Forecast and Scenario mathematics.
// Boundary: pure deterministic validation and projection only; never constructs or mutates a CanonicalObjectEnvelopeV1, never assigns object_id or determinism_hash to the execution view, and performs no persistence, active binding, model activation, calibration, route, scheduler, filesystem, environment or network operation.

import { validateCanonicalObjectV1, type CanonicalObjectEnvelopeV1 } from "../../domain/twin_runtime/canonical_object_contracts_v1.js";
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
import {
  CAP05_INHERITED_CAP04_EXECUTION_VIEW_RESOLUTION_POLICY_ID_V1,
  type Cap04ExecutionConfigResolverPortV1,
  type ResolvedCap04ExecutionConfigV1,
} from "../../domain/twin_runtime/runtime_config_execution_view_v1.js";
import { validateCap05ReceiptConsumingRuntimePoliciesV1 } from "./action_feedback_tick_selector_v1.js";
import {
  CAP05_EFFECTIVE_RUNTIME_CONFIG_PROFILE_ID_V1,
} from "./effective_feedback_runtime_config_v1.js";
import { validateCap05ForecastResidualRuntimePoliciesV1 } from "./forecast_residual_outcome_tick_service_v1.js";

export class Cap05InheritedCap04ExecutionConfigResolverV1
implements Cap04ExecutionConfigResolverPortV1 {
  resolveExecutionConfig(
    canonicalConfig: CanonicalObjectEnvelopeV1,
  ): ResolvedCap04ExecutionConfigV1 {
    validateCanonicalObjectV1(canonicalConfig);
    if (canonicalConfig.object_type !== "twin_runtime_config_v1") {
      throw new Error("CAP05_EXECUTION_CONFIG_RUNTIME_CONFIG_OBJECT_TYPE_REQUIRED");
    }

    const payload = canonicalConfig.payload as unknown as Cap05RuntimeConfigPayloadV1 & Record<string, unknown>;
    validateCap05RuntimeConfigPayloadV1(payload);
    if (payload.config_purpose !== CAP05_RUNTIME_CONFIG_PURPOSE_V1) {
      throw new Error("CAP05_EXECUTION_CONFIG_PURPOSE_MISMATCH");
    }
    if (payload.config_selection_mode !== CAP05_CONFIG_SELECTION_MODE_V1) {
      throw new Error("CAP05_EXECUTION_CONFIG_SELECTION_MODE_MISMATCH");
    }
    if (payload.executable_profile_id !== CAP05_EFFECTIVE_RUNTIME_CONFIG_PROFILE_ID_V1) {
      throw new Error("CAP05_EXECUTION_CONFIG_PROFILE_MISMATCH");
    }
    validateCap05ReceiptConsumingRuntimePoliciesV1(payload);
    validateCap05ForecastResidualRuntimePoliciesV1(payload);

    const {
      config_purpose: _purpose,
      config_selection_mode: _selectionMode,
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
      forecast_residual_normalization_policy_id: _normalization,
      ...inherited
    } = payload;

    const executionPayload = {
      ...structuredClone(inherited),
      config_purpose: CAP04_RUNTIME_CONFIG_PURPOSE_V1,
      config_selection_mode: CAP04_CONFIG_SELECTION_MODE_V1,
    } as unknown as Cap04RuntimeConfigPayloadV1;
    validateCap04RuntimeConfigPayloadV1(executionPayload);

    return {
      source_config_ref: canonicalConfig.object_id,
      source_config_hash: canonicalConfig.determinism_hash,
      source_config_purpose: CAP05_RUNTIME_CONFIG_PURPOSE_V1,
      payload: executionPayload,
      resolution_policy_id: CAP05_INHERITED_CAP04_EXECUTION_VIEW_RESOLUTION_POLICY_ID_V1,
    };
  }
}
