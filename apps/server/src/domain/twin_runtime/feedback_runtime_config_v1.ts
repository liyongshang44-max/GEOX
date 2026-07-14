// apps/server/src/domain/twin_runtime/feedback_runtime_config_v1.ts
// Purpose: compile the immutable MCFT-CAP-05 Runtime Config chain by extending the terminal CAP-04 Forecast/Scenario configuration without changing inherited water-model authority.
// Boundary: pure Runtime Config compilation and validation only; no active-config mutation, persistence, model activation, clock, filesystem, environment, or network.

import type { CanonicalObjectEnvelopeV1 } from "./canonical_object_contracts_v1.js";
import { computeMemberDeterminismHashV1, deriveSemanticObjectIdV1 } from "./canonical_identity_v1.js";
import type { ContinuationScopeV1 } from "./continuation_operation_identity_v1.js";
import {
  CAP04_CONFIG_SELECTION_MODE_V1,
  CAP04_RUNTIME_CONFIG_PURPOSE_V1,
  compileCap04RuntimeConfigV1,
  type Cap04RuntimeConfigPayloadV1,
  validateCap04RuntimeConfigPayloadV1,
} from "./forecast_scenario_runtime_config_v1.js";
import {
  CAP05_ACTION_FEEDBACK_CONTRACT_ID_V1,
  CAP05_ACTION_FEEDBACK_ELIGIBILITY_POLICY_V1,
  CAP05_ACTION_FEEDBACK_QUALITY_MAPPING_POLICY_V1,
  CAP05_DECISION_CONTRACT_ID_V1,
  CAP05_DECISION_SECOND_WRITE_POLICY_V1,
  CAP05_SCENARIO_OPTION_MEMBER_REF_POLICY_V1,
  CAP05_TARGET_EQUIVALENT_IRRIGATION_POLICY_V1,
} from "./feedback_canonical_contracts_v1.js";
import { CAP05_ACTION_FEEDBACK_ADAPTER_ID_V1, CAP05_SINGLE_EVENT_GUARD_POLICY_ID_V1 } from "./action_feedback_to_executed_irrigation_v1.js";
import {
  CAP05_FORECAST_ASSIMILATION_RELATION_POLICY_V1,
  CAP05_FORECAST_OBSERVATION_PROJECTION_METHOD_ID_V1,
  CAP05_FORECAST_OBSERVATION_VARIANCE_METHOD_ID_V1,
  CAP05_FORECAST_RESIDUAL_CONTRACT_ID_V1,
  CAP05_FORECAST_RESIDUAL_FORMULA_ID_V1,
  CAP05_NORMALIZED_RESIDUAL_FORMULA_ID_V1,
} from "./forecast_observation_residual_v1.js";

export const CAP05_RUNTIME_CONFIG_PURPOSE_V1 = "HUMAN_DECISION_EXECUTION_FEEDBACK_RUNTIME_V1" as const;
export const CAP05_CONFIG_SELECTION_MODE_V1 = "PERSISTED_PREDECESSOR_CHAIN_ONLY_V1" as const;
export const CAP05_CONFIG_CHAIN_LENGTH_V1 = 8 as const;
export const CAP05_EVIDENCE_AVAILABILITY_POLICY_ID_V1 = "AVAILABLE_TO_RUNTIME_AT_LE_LOGICAL_TIME_AND_FROZEN_WINDOW_MEMBERSHIP_V1" as const;
export const CAP05_APPROVAL_PLAN_BINDING_POLICY_ID_V1 = "DISTINCT_LINKED_APPROVAL_ASSERTION_AND_PLAN_SNAPSHOT_V1" as const;
export const CAP05_FEEDBACK_CYCLE_PROJECTION_POLICY_ID_V1 = "DECISION_APPROVAL_DISPATCH_EXECUTION_OBSERVATION_RESIDUAL_ASSIMILATION_STATE_V1" as const;
export const CAP05_DISPATCH_DISPOSITION_POLICY_ID_V1 = "EXPLICIT_NOT_OBSERVED_NOT_APPLICABLE_OR_EXTERNALLY_RECORDED_V1" as const;
export const CAP05_RUNTIME_CONFIG_LIMITATIONS_V1 = [
  "CONTROLLED_REPLAY_ONLY",
  "NO_RECOMMENDATION",
  "NO_POLICY_EVALUATION",
  "NO_GEOX_APPROVAL_AUTHORITY",
  "NO_GEOX_DISPATCH",
  "NO_CAUSAL_ATTRIBUTION",
  "NO_CALIBRATION_CANDIDATE",
  "NO_MODEL_ACTIVATION",
  "NO_ACTIVE_MODEL_PARAMETER_CHANGE",
  "NO_LIVE_FIELD_CLAIM",
] as const;

export type Cap05RuntimeConfigPayloadV1 = Omit<Cap04RuntimeConfigPayloadV1, "config_purpose" | "config_selection_mode"> & {
  config_purpose: typeof CAP05_RUNTIME_CONFIG_PURPOSE_V1;
  config_selection_mode: typeof CAP05_CONFIG_SELECTION_MODE_V1;
  cap05_contract_ids: {
    human_decision: typeof CAP05_DECISION_CONTRACT_ID_V1;
    action_feedback: typeof CAP05_ACTION_FEEDBACK_CONTRACT_ID_V1;
    forecast_residual: typeof CAP05_FORECAST_RESIDUAL_CONTRACT_ID_V1;
  };
  selected_option_member_reference_policy_id: typeof CAP05_SCENARIO_OPTION_MEMBER_REF_POLICY_V1;
  decision_second_write_policy_id: typeof CAP05_DECISION_SECOND_WRITE_POLICY_V1;
  approval_plan_binding_policy_id: typeof CAP05_APPROVAL_PLAN_BINDING_POLICY_ID_V1;
  evidence_availability_policy_id: typeof CAP05_EVIDENCE_AVAILABILITY_POLICY_ID_V1;
  action_feedback_eligibility_policy_id: typeof CAP05_ACTION_FEEDBACK_ELIGIBILITY_POLICY_V1;
  action_feedback_quality_mapping_policy_id: typeof CAP05_ACTION_FEEDBACK_QUALITY_MAPPING_POLICY_V1;
  action_feedback_adapter_id: typeof CAP05_ACTION_FEEDBACK_ADAPTER_ID_V1;
  single_execution_event_guard_policy_id: typeof CAP05_SINGLE_EVENT_GUARD_POLICY_ID_V1;
  target_equivalent_irrigation_policy_id: typeof CAP05_TARGET_EQUIVALENT_IRRIGATION_POLICY_V1;
  forecast_observation_projection_method_id: typeof CAP05_FORECAST_OBSERVATION_PROJECTION_METHOD_ID_V1;
  forecast_observation_variance_method_id: typeof CAP05_FORECAST_OBSERVATION_VARIANCE_METHOD_ID_V1;
  forecast_residual_formula_id: typeof CAP05_FORECAST_RESIDUAL_FORMULA_ID_V1;
  normalized_residual_formula_id: typeof CAP05_NORMALIZED_RESIDUAL_FORMULA_ID_V1;
  forecast_assimilation_relation_policy_id: typeof CAP05_FORECAST_ASSIMILATION_RELATION_POLICY_V1;
  feedback_cycle_projection_policy_id: typeof CAP05_FEEDBACK_CYCLE_PROJECTION_POLICY_ID_V1;
  dispatch_disposition_policy_id: typeof CAP05_DISPATCH_DISPOSITION_POLICY_ID_V1;
  cap05_limitations: readonly string[];
};

export type CompileCap05RuntimeConfigInputV1 = {
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

export type CompileCap05RuntimeConfigChainInputV1 = Omit<CompileCap05RuntimeConfigInputV1, "effective_logical_time" | "created_at"> & {
  first_effective_logical_time: string;
  count?: number;
};

function requiredStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

function canonicalHourV1(value: unknown, code: string): string {
  const text = requiredStringV1(value, code);
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== text || !text.endsWith(":00:00.000Z")) throw new Error(code);
  return text;
}

function addHoursV1(value: string, hours: number): string {
  return new Date(Date.parse(value) + hours * 3_600_000).toISOString();
}

function assertConstantV1(actual: unknown, expected: unknown, code: string): void {
  if (actual !== expected) throw new Error(code);
}

export function validateCap05RuntimeConfigPayloadV1(payload: Cap05RuntimeConfigPayloadV1): void {
  if (!payload || typeof payload !== "object") throw new Error("CAP05_CONFIG_PAYLOAD_REQUIRED");
  const {
    config_purpose: _purpose,
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
    ...inherited
  } = payload;
  validateCap04RuntimeConfigPayloadV1({
    ...inherited,
    config_purpose: CAP04_RUNTIME_CONFIG_PURPOSE_V1,
    config_selection_mode: CAP04_CONFIG_SELECTION_MODE_V1,
  });
  assertConstantV1(payload.config_purpose, CAP05_RUNTIME_CONFIG_PURPOSE_V1, "CAP05_CONFIG_PURPOSE_MISMATCH");
  assertConstantV1(payload.config_selection_mode, CAP05_CONFIG_SELECTION_MODE_V1, "CAP05_CONFIG_SELECTION_MODE_MISMATCH");
  assertConstantV1(payload.cap05_contract_ids.human_decision, CAP05_DECISION_CONTRACT_ID_V1, "CAP05_DECISION_CONTRACT_ID_MISMATCH");
  assertConstantV1(payload.cap05_contract_ids.action_feedback, CAP05_ACTION_FEEDBACK_CONTRACT_ID_V1, "CAP05_ACTION_FEEDBACK_CONTRACT_ID_MISMATCH");
  assertConstantV1(payload.cap05_contract_ids.forecast_residual, CAP05_FORECAST_RESIDUAL_CONTRACT_ID_V1, "CAP05_FORECAST_RESIDUAL_CONTRACT_ID_MISMATCH");
  assertConstantV1(payload.selected_option_member_reference_policy_id, CAP05_SCENARIO_OPTION_MEMBER_REF_POLICY_V1, "CAP05_MEMBER_REF_POLICY_MISMATCH");
  assertConstantV1(payload.decision_second_write_policy_id, CAP05_DECISION_SECOND_WRITE_POLICY_V1, "CAP05_DECISION_WRITE_POLICY_MISMATCH");
  assertConstantV1(payload.approval_plan_binding_policy_id, CAP05_APPROVAL_PLAN_BINDING_POLICY_ID_V1, "CAP05_APPROVAL_PLAN_POLICY_MISMATCH");
  assertConstantV1(payload.evidence_availability_policy_id, CAP05_EVIDENCE_AVAILABILITY_POLICY_ID_V1, "CAP05_AVAILABILITY_POLICY_MISMATCH");
  assertConstantV1(payload.action_feedback_eligibility_policy_id, CAP05_ACTION_FEEDBACK_ELIGIBILITY_POLICY_V1, "CAP05_ELIGIBILITY_POLICY_MISMATCH");
  assertConstantV1(payload.action_feedback_quality_mapping_policy_id, CAP05_ACTION_FEEDBACK_QUALITY_MAPPING_POLICY_V1, "CAP05_QUALITY_POLICY_MISMATCH");
  assertConstantV1(payload.action_feedback_adapter_id, CAP05_ACTION_FEEDBACK_ADAPTER_ID_V1, "CAP05_ADAPTER_POLICY_MISMATCH");
  assertConstantV1(payload.single_execution_event_guard_policy_id, CAP05_SINGLE_EVENT_GUARD_POLICY_ID_V1, "CAP05_SINGLE_EVENT_POLICY_MISMATCH");
  assertConstantV1(payload.target_equivalent_irrigation_policy_id, CAP05_TARGET_EQUIVALENT_IRRIGATION_POLICY_V1, "CAP05_TARGET_EQUIVALENT_POLICY_MISMATCH");
  assertConstantV1(payload.forecast_observation_projection_method_id, CAP05_FORECAST_OBSERVATION_PROJECTION_METHOD_ID_V1, "CAP05_PROJECTION_POLICY_MISMATCH");
  assertConstantV1(payload.forecast_observation_variance_method_id, CAP05_FORECAST_OBSERVATION_VARIANCE_METHOD_ID_V1, "CAP05_VARIANCE_POLICY_MISMATCH");
  assertConstantV1(payload.forecast_residual_formula_id, CAP05_FORECAST_RESIDUAL_FORMULA_ID_V1, "CAP05_RESIDUAL_FORMULA_MISMATCH");
  assertConstantV1(payload.normalized_residual_formula_id, CAP05_NORMALIZED_RESIDUAL_FORMULA_ID_V1, "CAP05_NORMALIZED_RESIDUAL_FORMULA_MISMATCH");
  assertConstantV1(payload.forecast_assimilation_relation_policy_id, CAP05_FORECAST_ASSIMILATION_RELATION_POLICY_V1, "CAP05_FORECAST_ASSIMILATION_POLICY_MISMATCH");
  assertConstantV1(payload.feedback_cycle_projection_policy_id, CAP05_FEEDBACK_CYCLE_PROJECTION_POLICY_ID_V1, "CAP05_CYCLE_PROJECTION_POLICY_MISMATCH");
  assertConstantV1(payload.dispatch_disposition_policy_id, CAP05_DISPATCH_DISPOSITION_POLICY_ID_V1, "CAP05_DISPATCH_POLICY_MISMATCH");
  if (!Array.isArray(payload.cap05_limitations) || CAP05_RUNTIME_CONFIG_LIMITATIONS_V1.some((value) => !payload.cap05_limitations.includes(value))) throw new Error("CAP05_CONFIG_LIMITATIONS_INCOMPLETE");
}

export function compileCap05RuntimeConfigV1(input: CompileCap05RuntimeConfigInputV1): CanonicalObjectEnvelopeV1 {
  const logicalTime = canonicalHourV1(input.effective_logical_time, "CAP05_CONFIG_EFFECTIVE_TIME_INVALID");
  const inheritedConfig = compileCap04RuntimeConfigV1({
    scope: input.scope,
    effective_logical_time: logicalTime,
    created_at: requiredStringV1(input.created_at, "CAP05_CONFIG_CREATED_AT_REQUIRED"),
    parent_runtime_config_ref: requiredStringV1(input.parent_runtime_config_ref, "CAP05_PARENT_CONFIG_REF_REQUIRED"),
    parent_runtime_config_hash: requiredStringV1(input.parent_runtime_config_hash, "CAP05_PARENT_CONFIG_HASH_REQUIRED"),
    reality_binding_ref: requiredStringV1(input.reality_binding_ref, "CAP05_REALITY_BINDING_REF_REQUIRED"),
    reality_binding_hash: requiredStringV1(input.reality_binding_hash, "CAP05_REALITY_BINDING_HASH_REQUIRED"),
    source_matrix_hash: requiredStringV1(input.source_matrix_hash, "CAP05_SOURCE_MATRIX_HASH_REQUIRED"),
    configuration_matrix_hash: requiredStringV1(input.configuration_matrix_hash, "CAP05_CONFIGURATION_MATRIX_HASH_REQUIRED"),
    geometry_semantic_hash: requiredStringV1(input.geometry_semantic_hash, "CAP05_GEOMETRY_HASH_REQUIRED"),
  });
  const inherited = inheritedConfig.payload as unknown as Cap04RuntimeConfigPayloadV1;
  const { config_purpose: _purpose, config_selection_mode: _selectionMode, ...inheritedPayload } = inherited;
  const payload: Cap05RuntimeConfigPayloadV1 = {
    ...inheritedPayload,
    config_purpose: CAP05_RUNTIME_CONFIG_PURPOSE_V1,
    config_selection_mode: CAP05_CONFIG_SELECTION_MODE_V1,
    cap05_contract_ids: {
      human_decision: CAP05_DECISION_CONTRACT_ID_V1,
      action_feedback: CAP05_ACTION_FEEDBACK_CONTRACT_ID_V1,
      forecast_residual: CAP05_FORECAST_RESIDUAL_CONTRACT_ID_V1,
    },
    selected_option_member_reference_policy_id: CAP05_SCENARIO_OPTION_MEMBER_REF_POLICY_V1,
    decision_second_write_policy_id: CAP05_DECISION_SECOND_WRITE_POLICY_V1,
    approval_plan_binding_policy_id: CAP05_APPROVAL_PLAN_BINDING_POLICY_ID_V1,
    evidence_availability_policy_id: CAP05_EVIDENCE_AVAILABILITY_POLICY_ID_V1,
    action_feedback_eligibility_policy_id: CAP05_ACTION_FEEDBACK_ELIGIBILITY_POLICY_V1,
    action_feedback_quality_mapping_policy_id: CAP05_ACTION_FEEDBACK_QUALITY_MAPPING_POLICY_V1,
    action_feedback_adapter_id: CAP05_ACTION_FEEDBACK_ADAPTER_ID_V1,
    single_execution_event_guard_policy_id: CAP05_SINGLE_EVENT_GUARD_POLICY_ID_V1,
    target_equivalent_irrigation_policy_id: CAP05_TARGET_EQUIVALENT_IRRIGATION_POLICY_V1,
    forecast_observation_projection_method_id: CAP05_FORECAST_OBSERVATION_PROJECTION_METHOD_ID_V1,
    forecast_observation_variance_method_id: CAP05_FORECAST_OBSERVATION_VARIANCE_METHOD_ID_V1,
    forecast_residual_formula_id: CAP05_FORECAST_RESIDUAL_FORMULA_ID_V1,
    normalized_residual_formula_id: CAP05_NORMALIZED_RESIDUAL_FORMULA_ID_V1,
    forecast_assimilation_relation_policy_id: CAP05_FORECAST_ASSIMILATION_RELATION_POLICY_V1,
    feedback_cycle_projection_policy_id: CAP05_FEEDBACK_CYCLE_PROJECTION_POLICY_ID_V1,
    dispatch_disposition_policy_id: CAP05_DISPATCH_DISPOSITION_POLICY_ID_V1,
    cap05_limitations: [...CAP05_RUNTIME_CONFIG_LIMITATIONS_V1],
  };
  validateCap05RuntimeConfigPayloadV1(payload);
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
    limitations: [...CAP05_RUNTIME_CONFIG_LIMITATIONS_V1],
    created_at: input.created_at,
    payload: payload as unknown as Record<string, unknown>,
  };
  config.determinism_hash = computeMemberDeterminismHashV1(config as unknown as Record<string, unknown>);
  return config;
}

export function compileCap05RuntimeConfigChainV1(
  input: CompileCap05RuntimeConfigChainInputV1,
): CanonicalObjectEnvelopeV1[] {
  const count = input.count ?? CAP05_CONFIG_CHAIN_LENGTH_V1;
  if (!Number.isInteger(count) || count < 1 || count > CAP05_CONFIG_CHAIN_LENGTH_V1) throw new Error("CAP05_CONFIG_CHAIN_COUNT_INVALID");
  const firstTime = canonicalHourV1(input.first_effective_logical_time, "CAP05_CONFIG_CHAIN_FIRST_TIME_INVALID");
  const result: CanonicalObjectEnvelopeV1[] = [];
  let parentRef = requiredStringV1(input.parent_runtime_config_ref, "CAP05_CONFIG_CHAIN_PARENT_REF_REQUIRED");
  let parentHash = requiredStringV1(input.parent_runtime_config_hash, "CAP05_CONFIG_CHAIN_PARENT_HASH_REQUIRED");
  for (let index = 0; index < count; index += 1) {
    const logicalTime = addHoursV1(firstTime, index);
    const config = compileCap05RuntimeConfigV1({
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
