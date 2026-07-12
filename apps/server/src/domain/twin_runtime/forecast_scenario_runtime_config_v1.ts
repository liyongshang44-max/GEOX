// apps/server/src/domain/twin_runtime/forecast_scenario_runtime_config_v1.ts
// Purpose: compile and validate the immutable CAP-04 Forecast/Scenario Runtime Config while inheriting the active CAP-03 V2 observation-aware dynamics authority.
// Boundary: pure deterministic config construction only; no active-config pointer, persistence, Forecast math, Scenario math, model activation, clock, filesystem or network.

import { computeMemberDeterminismHashV1, deriveSemanticObjectIdV1 } from "./canonical_identity_v1.js";
import type { CanonicalObjectEnvelopeV1 } from "./canonical_object_contracts_v1.js";
import type { ContinuationScopeV1 } from "./continuation_operation_identity_v1.js";
import {
  ASSIMILATED_CONTINUATION_CONFIG_PURPOSE_V2,
  compileAssimilatedContinuationRuntimeConfigV2,
  validateAssimilatedContinuationRuntimeConfigPayloadV2,
  type AssimilatedContinuationRuntimeConfigPayloadV2,
} from "./assimilated_continuation_runtime_config_v2.js";
import { ASSIMILATED_CONTINUATION_RECORD_SET_CONTRACT_ID_V2 } from "./assimilated_continuation_contracts_v2.js";
import {
  CAP04_BLOCKED_FORECAST_CONTRACT_ID_V1,
  CAP04_COMPLETED_FORECAST_CONTRACT_ID_V1,
  CAP04_FORECAST_HORIZON_HOURS_V1,
  CAP04_FORECAST_STEP_HOURS_V1,
  CAP04_SCENARIO_OPTION_IDS_V1,
  CAP04_SCENARIO_POLICY_ID_V1,
  CAP04_THREE_SCENARIO_SET_CONTRACT_ID_V1,
} from "./forecast_scenario_contracts_v1.js";

export const CAP04_RUNTIME_CONFIG_PURPOSE_V1 =
  "FORECAST_AND_THREE_SCENARIO_CONTINUATION_RUNTIME_V1" as const;
export const CAP04_FORECAST_METHOD_ID_V1 = "ROOT_ZONE_WATER_BALANCE_72H_FIXED_POINT_V1" as const;
export const CAP04_FORECAST_METHOD_VERSION_V1 = "1" as const;
export const CAP04_FUTURE_FORCING_PAIR_POLICY_ID_V1 = "JOINT_MATCHING_FORCING_CYCLE_V1" as const;
export const CAP04_FUTURE_FORCING_POLICY_ID_V1 = "EXACT_72_HOUR_ASSUMPTION_WINDOW_V1" as const;
export const CAP04_FUTURE_FORCING_FALLBACK_POLICY_ID_V1 = "NO_CROSS_SNAPSHOT_STITCHING_V1" as const;
export const CAP04_FUTURE_FORCING_FRESHNESS_POLICY_ID_V1 = "LATEST_AVAILABLE_COMPLETE_PAIR_AT_T_V1" as const;
export const CAP04_UNCERTAINTY_PROPAGATION_METHOD_ID_V1 = "ADDITIVE_STORAGE_VARIANCE_ZERO_COVARIANCE_V1" as const;
export const CAP04_FORECAST_INTERVAL_METHOD_ID_V1 = "NORMAL_95_PERCENT_Z_1_96_V1" as const;
export const CAP04_PHYSICAL_BOUND_POLICY_ID_V1 = "ROOT_ZONE_STORAGE_ZERO_TO_SATURATION_V1" as const;
export const CAP04_DECIMAL_SCALE_POLICY_ID_V1 = "MCFT_CAP_04_FIXED_POINT_SCALE_V1" as const;
export const CAP04_ROUNDING_POLICY_ID_V1 = "DECIMAL_HALF_AWAY_FROM_ZERO_V1" as const;
export const CAP04_CONFIG_SELECTION_MODE_V1 = "EXPLICIT_REF_HASH_PIN_ONLY" as const;
export const CAP04_APPLICATION_EFFICIENCY_COMPONENT_REF_V1 = "mcft_component_scenario_application_efficiency_v1" as const;
export const CAP04_APPLICATION_EFFICIENCY_POLICY_ID_V1 = "CONTROLLED_SCENARIO_APPLICATION_EFFICIENCY_V1" as const;
export const CAP04_STRESS_THRESHOLD_COMPONENT_REF_V1 = "mcft_component_available_water_stress_threshold_v1" as const;
export const CAP04_STRESS_THRESHOLD_POLICY_ID_V1 = "CONTROLLED_AWF_STRESS_THRESHOLD_V1" as const;

export type Cap04RuntimeConfigPayloadV1 = Omit<
  AssimilatedContinuationRuntimeConfigPayloadV2,
  "config_purpose" | "record_set_contract_id" | "model_component_refs"
> & {
  config_purpose: typeof CAP04_RUNTIME_CONFIG_PURPOSE_V1;
  config_selection_mode: typeof CAP04_CONFIG_SELECTION_MODE_V1;
  effective_logical_time: string;
  record_set_contract_ids: {
    a1_completed: typeof CAP04_COMPLETED_FORECAST_CONTRACT_ID_V1;
    a2_blocked: typeof CAP04_BLOCKED_FORECAST_CONTRACT_ID_V1;
    b_scenario: typeof CAP04_THREE_SCENARIO_SET_CONTRACT_ID_V1;
  };
  forecast_method_id: typeof CAP04_FORECAST_METHOD_ID_V1;
  forecast_method_version: typeof CAP04_FORECAST_METHOD_VERSION_V1;
  forecast_horizon_hours: typeof CAP04_FORECAST_HORIZON_HOURS_V1;
  forecast_step_hours: typeof CAP04_FORECAST_STEP_HOURS_V1;
  future_forcing_pair_policy_id: typeof CAP04_FUTURE_FORCING_PAIR_POLICY_ID_V1;
  future_forcing_policy_id: typeof CAP04_FUTURE_FORCING_POLICY_ID_V1;
  future_forcing_fallback_policy_id: typeof CAP04_FUTURE_FORCING_FALLBACK_POLICY_ID_V1;
  future_forcing_freshness_policy_id: typeof CAP04_FUTURE_FORCING_FRESHNESS_POLICY_ID_V1;
  uncertainty_propagation_method_id: typeof CAP04_UNCERTAINTY_PROPAGATION_METHOD_ID_V1;
  forecast_interval_method_id: typeof CAP04_FORECAST_INTERVAL_METHOD_ID_V1;
  scenario_policy_id: typeof CAP04_SCENARIO_POLICY_ID_V1;
  scenario_option_ids: readonly [...typeof CAP04_SCENARIO_OPTION_IDS_V1];
  scenario_application_efficiency_policy: {
    component_ref: typeof CAP04_APPLICATION_EFFICIENCY_COMPONENT_REF_V1;
    policy_id: typeof CAP04_APPLICATION_EFFICIENCY_POLICY_ID_V1;
    value: "1.000000";
    parameter_class: "CONTROLLED_SYNTHETIC";
    field_calibration_status: "NOT_FIELD_CALIBRATED";
  };
  stress_threshold_policy: {
    component_ref: typeof CAP04_STRESS_THRESHOLD_COMPONENT_REF_V1;
    policy_id: typeof CAP04_STRESS_THRESHOLD_POLICY_ID_V1;
    value: "0.350000";
    comparator: "STRICT_LESS_THAN";
    parameter_class: "CONTROLLED_SYNTHETIC";
    field_calibration_status: "NOT_FIELD_CALIBRATED";
  };
  physical_bound_policy_id: typeof CAP04_PHYSICAL_BOUND_POLICY_ID_V1;
  decimal_scale_policy_id: typeof CAP04_DECIMAL_SCALE_POLICY_ID_V1;
  rounding_policy_id: typeof CAP04_ROUNDING_POLICY_ID_V1;
  model_component_refs: readonly string[];
};

export type CompileCap04RuntimeConfigInputV1 = {
  scope: ContinuationScopeV1;
  effective_logical_time: string;
  created_at: string;
  parent_runtime_config_ref: string;
  parent_runtime_config_hash: string;
  reality_binding_ref: string;
  reality_binding_hash: string;
  source_matrix_hash: string;
  configuration_matrix_hash: string;
  geometry_semantic_hash: string;
};

function requiredStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}
function recordV1(value: unknown, code: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
  return value as Record<string, unknown>;
}
function exactV1(actual: unknown, expected: unknown, code: string): void {
  if (actual !== expected) throw new Error(code);
}
function exactArrayV1(actual: unknown, expected: readonly string[], code: string): void {
  if (!Array.isArray(actual) || JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(code);
}
function canonicalHourV1(value: unknown): string {
  const text = requiredStringV1(value, "CAP04_CONFIG_EFFECTIVE_TIME_REQUIRED");
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== text || !text.endsWith(":00:00.000Z")) throw new Error("CAP04_CONFIG_EFFECTIVE_TIME_INVALID");
  return text;
}

function validateInheritedPayloadV1(payload: Record<string, unknown>): void {
  const inherited = structuredClone(payload);
  inherited.config_purpose = ASSIMILATED_CONTINUATION_CONFIG_PURPOSE_V2;
  inherited.config_selection_mode = "EXPLICIT_REQUEST_PIN_ONLY";
  inherited.record_set_contract_id = ASSIMILATED_CONTINUATION_RECORD_SET_CONTRACT_ID_V2;
  delete inherited.effective_logical_time;
  delete inherited.record_set_contract_ids;
  delete inherited.forecast_method_id;
  delete inherited.forecast_method_version;
  delete inherited.forecast_horizon_hours;
  delete inherited.forecast_step_hours;
  delete inherited.future_forcing_pair_policy_id;
  delete inherited.future_forcing_policy_id;
  delete inherited.future_forcing_fallback_policy_id;
  delete inherited.future_forcing_freshness_policy_id;
  delete inherited.uncertainty_propagation_method_id;
  delete inherited.forecast_interval_method_id;
  delete inherited.scenario_policy_id;
  delete inherited.scenario_option_ids;
  delete inherited.scenario_application_efficiency_policy;
  delete inherited.stress_threshold_policy;
  delete inherited.physical_bound_policy_id;
  delete inherited.decimal_scale_policy_id;
  delete inherited.rounding_policy_id;
  const modelRefs = Array.isArray(inherited.model_component_refs)
    ? inherited.model_component_refs.filter((ref) => ref !== CAP04_APPLICATION_EFFICIENCY_COMPONENT_REF_V1 && ref !== CAP04_STRESS_THRESHOLD_COMPONENT_REF_V1)
    : inherited.model_component_refs;
  inherited.model_component_refs = modelRefs;
  validateAssimilatedContinuationRuntimeConfigPayloadV2(inherited);
}

export function validateCap04RuntimeConfigPayloadV1(value: unknown): asserts value is Cap04RuntimeConfigPayloadV1 {
  const payload = recordV1(value, "CAP04_RUNTIME_CONFIG_PAYLOAD_REQUIRED");
  exactV1(payload.config_purpose, CAP04_RUNTIME_CONFIG_PURPOSE_V1, "CAP04_CONFIG_PURPOSE_MISMATCH");
  exactV1(payload.config_selection_mode, CAP04_CONFIG_SELECTION_MODE_V1, "CAP04_CONFIG_SELECTION_MODE_MISMATCH");
  canonicalHourV1(payload.effective_logical_time);
  for (const field of ["parent_runtime_config_ref", "parent_runtime_config_hash", "reality_binding_ref", "reality_binding_hash", "source_matrix_hash", "configuration_matrix_hash", "geometry_semantic_hash"] as const) requiredStringV1(payload[field], `CAP04_CONFIG_${field.toUpperCase()}_REQUIRED`);
  validateInheritedPayloadV1(payload);
  const contracts = recordV1(payload.record_set_contract_ids, "CAP04_CONFIG_CONTRACT_IDS_REQUIRED");
  exactV1(contracts.a1_completed, CAP04_COMPLETED_FORECAST_CONTRACT_ID_V1, "CAP04_CONFIG_A1_CONTRACT_MISMATCH");
  exactV1(contracts.a2_blocked, CAP04_BLOCKED_FORECAST_CONTRACT_ID_V1, "CAP04_CONFIG_A2_CONTRACT_MISMATCH");
  exactV1(contracts.b_scenario, CAP04_THREE_SCENARIO_SET_CONTRACT_ID_V1, "CAP04_CONFIG_B_CONTRACT_MISMATCH");
  for (const [field, expected] of [
    ["forecast_method_id", CAP04_FORECAST_METHOD_ID_V1],
    ["forecast_method_version", CAP04_FORECAST_METHOD_VERSION_V1],
    ["forecast_horizon_hours", CAP04_FORECAST_HORIZON_HOURS_V1],
    ["forecast_step_hours", CAP04_FORECAST_STEP_HOURS_V1],
    ["future_forcing_pair_policy_id", CAP04_FUTURE_FORCING_PAIR_POLICY_ID_V1],
    ["future_forcing_policy_id", CAP04_FUTURE_FORCING_POLICY_ID_V1],
    ["future_forcing_fallback_policy_id", CAP04_FUTURE_FORCING_FALLBACK_POLICY_ID_V1],
    ["future_forcing_freshness_policy_id", CAP04_FUTURE_FORCING_FRESHNESS_POLICY_ID_V1],
    ["uncertainty_propagation_method_id", CAP04_UNCERTAINTY_PROPAGATION_METHOD_ID_V1],
    ["forecast_interval_method_id", CAP04_FORECAST_INTERVAL_METHOD_ID_V1],
    ["scenario_policy_id", CAP04_SCENARIO_POLICY_ID_V1],
    ["physical_bound_policy_id", CAP04_PHYSICAL_BOUND_POLICY_ID_V1],
    ["decimal_scale_policy_id", CAP04_DECIMAL_SCALE_POLICY_ID_V1],
    ["rounding_policy_id", CAP04_ROUNDING_POLICY_ID_V1],
  ] as const) exactV1(payload[field], expected, `CAP04_CONFIG_${field.toUpperCase()}_MISMATCH`);
  exactArrayV1(payload.scenario_option_ids, CAP04_SCENARIO_OPTION_IDS_V1, "CAP04_CONFIG_SCENARIO_OPTIONS_MISMATCH");
  const efficiency = recordV1(payload.scenario_application_efficiency_policy, "CAP04_CONFIG_EFFICIENCY_POLICY_REQUIRED");
  exactV1(efficiency.component_ref, CAP04_APPLICATION_EFFICIENCY_COMPONENT_REF_V1, "CAP04_CONFIG_EFFICIENCY_COMPONENT_MISMATCH");
  exactV1(efficiency.policy_id, CAP04_APPLICATION_EFFICIENCY_POLICY_ID_V1, "CAP04_CONFIG_EFFICIENCY_POLICY_MISMATCH");
  exactV1(efficiency.value, "1.000000", "CAP04_CONFIG_EFFICIENCY_VALUE_MISMATCH");
  exactV1(efficiency.parameter_class, "CONTROLLED_SYNTHETIC", "CAP04_CONFIG_EFFICIENCY_CLASS_MISMATCH");
  exactV1(efficiency.field_calibration_status, "NOT_FIELD_CALIBRATED", "CAP04_CONFIG_EFFICIENCY_CALIBRATION_MISMATCH");
  const stress = recordV1(payload.stress_threshold_policy, "CAP04_CONFIG_STRESS_POLICY_REQUIRED");
  exactV1(stress.component_ref, CAP04_STRESS_THRESHOLD_COMPONENT_REF_V1, "CAP04_CONFIG_STRESS_COMPONENT_MISMATCH");
  exactV1(stress.policy_id, CAP04_STRESS_THRESHOLD_POLICY_ID_V1, "CAP04_CONFIG_STRESS_POLICY_MISMATCH");
  exactV1(stress.value, "0.350000", "CAP04_CONFIG_STRESS_VALUE_MISMATCH");
  exactV1(stress.comparator, "STRICT_LESS_THAN", "CAP04_CONFIG_STRESS_COMPARATOR_MISMATCH");
  exactV1(stress.parameter_class, "CONTROLLED_SYNTHETIC", "CAP04_CONFIG_STRESS_CLASS_MISMATCH");
  exactV1(stress.field_calibration_status, "NOT_FIELD_CALIBRATED", "CAP04_CONFIG_STRESS_CALIBRATION_MISMATCH");
  if ("scenario_application_efficiency_ref" in payload || "scenario_application_efficiency_hash" in payload || "stress_threshold_ref" in payload || "stress_threshold_hash" in payload) throw new Error("CAP04_CONFIG_DANGLING_POLICY_AUTHORITY_FORBIDDEN");
  const modelRefs = Array.isArray(payload.model_component_refs) ? payload.model_component_refs : [];
  if (!modelRefs.includes(CAP04_APPLICATION_EFFICIENCY_COMPONENT_REF_V1) || !modelRefs.includes(CAP04_STRESS_THRESHOLD_COMPONENT_REF_V1)) throw new Error("CAP04_CONFIG_POLICY_COMPONENT_REFS_REQUIRED");
  if (new Set(modelRefs).size !== modelRefs.length) throw new Error("CAP04_CONFIG_MODEL_COMPONENT_REFS_DUPLICATE");
}

export function compileCap04RuntimeConfigV1(input: CompileCap04RuntimeConfigInputV1): CanonicalObjectEnvelopeV1 {
  const logicalTime = canonicalHourV1(input.effective_logical_time);
  const inheritedConfig = compileAssimilatedContinuationRuntimeConfigV2({
    scope: input.scope,
    logical_time: logicalTime,
    created_at: requiredStringV1(input.created_at, "CAP04_CONFIG_CREATED_AT_REQUIRED"),
    parent_runtime_config_ref: requiredStringV1(input.parent_runtime_config_ref, "CAP04_PARENT_CONFIG_REF_REQUIRED"),
    parent_runtime_config_hash: requiredStringV1(input.parent_runtime_config_hash, "CAP04_PARENT_CONFIG_HASH_REQUIRED"),
    reality_binding_ref: requiredStringV1(input.reality_binding_ref, "CAP04_REALITY_BINDING_REF_REQUIRED"),
    reality_binding_hash: requiredStringV1(input.reality_binding_hash, "CAP04_REALITY_BINDING_HASH_REQUIRED"),
    source_matrix_hash: requiredStringV1(input.source_matrix_hash, "CAP04_SOURCE_MATRIX_HASH_REQUIRED"),
    configuration_matrix_hash: requiredStringV1(input.configuration_matrix_hash, "CAP04_CONFIGURATION_MATRIX_HASH_REQUIRED"),
    geometry_semantic_hash: requiredStringV1(input.geometry_semantic_hash, "CAP04_GEOMETRY_HASH_REQUIRED"),
  });
  const inherited = inheritedConfig.payload as unknown as AssimilatedContinuationRuntimeConfigPayloadV2;
  const { config_purpose: _purpose, record_set_contract_id: _contract, model_component_refs: inheritedModelRefs, ...inheritedPayload } = inherited;
  const payload: Cap04RuntimeConfigPayloadV1 = {
    ...inheritedPayload,
    config_purpose: CAP04_RUNTIME_CONFIG_PURPOSE_V1,
    config_selection_mode: CAP04_CONFIG_SELECTION_MODE_V1,
    effective_logical_time: logicalTime,
    record_set_contract_ids: {
      a1_completed: CAP04_COMPLETED_FORECAST_CONTRACT_ID_V1,
      a2_blocked: CAP04_BLOCKED_FORECAST_CONTRACT_ID_V1,
      b_scenario: CAP04_THREE_SCENARIO_SET_CONTRACT_ID_V1,
    },
    forecast_method_id: CAP04_FORECAST_METHOD_ID_V1,
    forecast_method_version: CAP04_FORECAST_METHOD_VERSION_V1,
    forecast_horizon_hours: CAP04_FORECAST_HORIZON_HOURS_V1,
    forecast_step_hours: CAP04_FORECAST_STEP_HOURS_V1,
    future_forcing_pair_policy_id: CAP04_FUTURE_FORCING_PAIR_POLICY_ID_V1,
    future_forcing_policy_id: CAP04_FUTURE_FORCING_POLICY_ID_V1,
    future_forcing_fallback_policy_id: CAP04_FUTURE_FORCING_FALLBACK_POLICY_ID_V1,
    future_forcing_freshness_policy_id: CAP04_FUTURE_FORCING_FRESHNESS_POLICY_ID_V1,
    uncertainty_propagation_method_id: CAP04_UNCERTAINTY_PROPAGATION_METHOD_ID_V1,
    forecast_interval_method_id: CAP04_FORECAST_INTERVAL_METHOD_ID_V1,
    scenario_policy_id: CAP04_SCENARIO_POLICY_ID_V1,
    scenario_option_ids: [...CAP04_SCENARIO_OPTION_IDS_V1],
    scenario_application_efficiency_policy: {
      component_ref: CAP04_APPLICATION_EFFICIENCY_COMPONENT_REF_V1,
      policy_id: CAP04_APPLICATION_EFFICIENCY_POLICY_ID_V1,
      value: "1.000000",
      parameter_class: "CONTROLLED_SYNTHETIC",
      field_calibration_status: "NOT_FIELD_CALIBRATED",
    },
    stress_threshold_policy: {
      component_ref: CAP04_STRESS_THRESHOLD_COMPONENT_REF_V1,
      policy_id: CAP04_STRESS_THRESHOLD_POLICY_ID_V1,
      value: "0.350000",
      comparator: "STRICT_LESS_THAN",
      parameter_class: "CONTROLLED_SYNTHETIC",
      field_calibration_status: "NOT_FIELD_CALIBRATED",
    },
    physical_bound_policy_id: CAP04_PHYSICAL_BOUND_POLICY_ID_V1,
    decimal_scale_policy_id: CAP04_DECIMAL_SCALE_POLICY_ID_V1,
    rounding_policy_id: CAP04_ROUNDING_POLICY_ID_V1,
    model_component_refs: [...inheritedModelRefs, CAP04_APPLICATION_EFFICIENCY_COMPONENT_REF_V1, CAP04_STRESS_THRESHOLD_COMPONENT_REF_V1],
  };
  validateCap04RuntimeConfigPayloadV1(payload);
  const identityBasis = { object_type: "twin_runtime_config_v1", scope: input.scope, logical_time: logicalTime, payload };
  const config: CanonicalObjectEnvelopeV1 = {
    object_id: deriveSemanticObjectIdV1("twin_runtime_config", identityBasis),
    object_type: "twin_runtime_config_v1",
    schema_version: "v1",
    ...input.scope,
    logical_time: logicalTime,
    as_of: logicalTime,
    source_refs: [payload.parent_runtime_config_ref, payload.reality_binding_ref].sort(),
    evidence_refs: [],
    runtime_config_ref: null,
    runtime_config_hash: null,
    idempotency_key: deriveSemanticObjectIdV1("runtime_config_key", identityBasis),
    determinism_hash: "",
    limitations: [
      "CONTROLLED_SYNTHETIC", "NOT_FIELD_CALIBRATED", "NO_MODEL_ACTIVATION",
      "NO_ACTIVE_MODEL_PARAMETER_CHANGE", "NO_FIELD_CALIBRATED_SCENARIO_APPLICATION_EFFICIENCY",
      "NO_FIELD_CALIBRATED_STRESS_THRESHOLD", "NO_CALIBRATED_FORECAST_PROBABILITY",
      "NO_SCENARIO_ACTION_COMPLIANCE_PROBABILITY",
    ],
    created_at: input.created_at,
    payload: payload as unknown as Record<string, unknown>,
  };
  config.determinism_hash = computeMemberDeterminismHashV1(config as unknown as Record<string, unknown>);
  return config;
}
