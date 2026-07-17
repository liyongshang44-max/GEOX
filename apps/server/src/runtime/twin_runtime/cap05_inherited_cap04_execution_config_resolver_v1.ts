// apps/server/src/runtime/twin_runtime/cap05_inherited_cap04_execution_config_resolver_v1.ts
// Purpose: validate one complete canonical CAP-05 effective feedback Runtime Config and derive a separate non-canonical CAP-04 execution payload by positively selecting the frozen CAP-04 field set.
// Boundary: pure deterministic validation and positive projection only; never constructs or mutates a CanonicalObjectEnvelopeV1, never assigns object_id or determinism_hash to the execution view, and performs no persistence, active binding, model activation, calibration, route, scheduler, filesystem, environment or network operation.

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

function cloneV1<T>(value: T): T {
  return structuredClone(value);
}

export function projectCap05PayloadToCap04ExecutionPayloadV1(
  payload: Cap05RuntimeConfigPayloadV1,
): Cap04RuntimeConfigPayloadV1 {
  const projected = {
    config_purpose: CAP04_RUNTIME_CONFIG_PURPOSE_V1,
    config_selection_mode: CAP04_CONFIG_SELECTION_MODE_V1,
    parent_runtime_config_ref: payload.parent_runtime_config_ref,
    parent_runtime_config_hash: payload.parent_runtime_config_hash,
    reality_binding_ref: payload.reality_binding_ref,
    reality_binding_hash: payload.reality_binding_hash,
    source_matrix_hash: payload.source_matrix_hash,
    configuration_matrix_hash: payload.configuration_matrix_hash,
    geometry_semantic_hash: payload.geometry_semantic_hash,
    crop_stage_context: cloneV1(payload.crop_stage_context),
    dynamics_model: cloneV1(payload.dynamics_model),
    soil_hydraulic_snapshot: cloneV1(payload.soil_hydraulic_snapshot),
    dynamics_parameters: cloneV1(payload.dynamics_parameters),
    process_uncertainty: cloneV1(payload.process_uncertainty),
    irrigation_input_policy: cloneV1(payload.irrigation_input_policy),
    observation_assimilation: cloneV1(payload.observation_assimilation),
    forecast_block_policy: cloneV1(payload.forecast_block_policy),
    rounding: cloneV1(payload.rounding),
    soil_root_zone_config_refs: cloneV1(
      payload.soil_root_zone_config_refs,
    ) as Cap04RuntimeConfigPayloadV1["soil_root_zone_config_refs"],
    active_model_parameter_change: payload.active_model_parameter_change,
    effective_logical_time: payload.effective_logical_time,
    record_set_contract_ids: cloneV1(payload.record_set_contract_ids),
    forecast_method_id: payload.forecast_method_id,
    forecast_method_version: payload.forecast_method_version,
    forecast_horizon_hours: payload.forecast_horizon_hours,
    forecast_step_hours: payload.forecast_step_hours,
    future_forcing_pair_policy_id: payload.future_forcing_pair_policy_id,
    future_forcing_policy_id: payload.future_forcing_policy_id,
    future_forcing_fallback_policy_id: payload.future_forcing_fallback_policy_id,
    future_forcing_freshness_policy_id: payload.future_forcing_freshness_policy_id,
    uncertainty_propagation_method_id: payload.uncertainty_propagation_method_id,
    forecast_interval_method_id: payload.forecast_interval_method_id,
    scenario_policy_id: payload.scenario_policy_id,
    scenario_option_ids: cloneV1(
      payload.scenario_option_ids,
    ) as Cap04RuntimeConfigPayloadV1["scenario_option_ids"],
    scenario_application_efficiency_policy: cloneV1(
      payload.scenario_application_efficiency_policy,
    ),
    stress_threshold_policy: cloneV1(payload.stress_threshold_policy),
    physical_bound_policy_id: payload.physical_bound_policy_id,
    decimal_scale_policy_id: payload.decimal_scale_policy_id,
    rounding_policy_id: payload.rounding_policy_id,
    model_component_refs: cloneV1(payload.model_component_refs),
  } satisfies Cap04RuntimeConfigPayloadV1;

  validateCap04RuntimeConfigPayloadV1(projected);
  return cloneV1(projected);
}

export class Cap05InheritedCap04ExecutionConfigResolverV1
implements Cap04ExecutionConfigResolverPortV1 {
  resolveExecutionConfig(
    canonicalConfig: CanonicalObjectEnvelopeV1,
  ): ResolvedCap04ExecutionConfigV1 {
    validateCanonicalObjectV1(canonicalConfig);
    if (canonicalConfig.object_type !== "twin_runtime_config_v1") {
      throw new Error("CAP05_EXECUTION_CONFIG_RUNTIME_CONFIG_OBJECT_TYPE_REQUIRED");
    }

    const payload = canonicalConfig.payload as unknown as Cap05RuntimeConfigPayloadV1;
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

    const executionPayload = projectCap05PayloadToCap04ExecutionPayloadV1(payload);

    return {
      source_config_ref: canonicalConfig.object_id,
      source_config_hash: canonicalConfig.determinism_hash,
      source_config_purpose: CAP05_RUNTIME_CONFIG_PURPOSE_V1,
      payload: executionPayload,
      resolution_policy_id: CAP05_INHERITED_CAP04_EXECUTION_VIEW_RESOLUTION_POLICY_ID_V1,
    };
  }
}
