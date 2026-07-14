// apps/server/src/domain/twin_runtime/feedback_canonical_contracts_v1.ts
// Purpose: define the pure MCFT-CAP-05 canonical Human Decision and Action Feedback contracts on the frozen DT-02 NON_LINEAGE_CONTEXT envelope.
// Boundary: deterministic contract construction and validation only; no persistence, approval workflow, dispatch, State mutation, clock, filesystem, environment, or network.

import { computeMemberDeterminismHashV1, deriveSemanticObjectIdV1, semanticHashV1 } from "./canonical_identity_v1.js";
import type { ContinuationScopeV1 } from "./continuation_operation_identity_v1.js";
import type { Cap04ScenarioOptionIdV1, Cap04ScenarioSetEnvelopeV1 } from "./forecast_scenario_contracts_v1.js";
import {
  WATER_AMOUNT_SCALE_V1,
  formatFixedDecimalV1,
  multiplyFixedUnitsV1,
  parseFixedDecimalV1,
} from "../soil_water/fixed_point_water_decimal_v1.js";

export const CAP05_DECISION_OBJECT_TYPE_V1 = "twin_decision_record_v1" as const;
export const CAP05_ACTION_FEEDBACK_OBJECT_TYPE_V1 = "twin_action_feedback_v1" as const;
export const CAP05_DECISION_CONTRACT_ID_V1 = "MCFT_CAP_05_HUMAN_DECISION_V1" as const;
export const CAP05_ACTION_FEEDBACK_CONTRACT_ID_V1 = "MCFT_CAP_05_ACTION_FEEDBACK_V1" as const;
export const CAP05_DECISION_TRANSACTION_VARIANT_V1 = "G_HUMAN_DECISION_LINK_COMMIT" as const;
export const CAP05_ACTION_FEEDBACK_TRANSACTION_VARIANT_V1 = "H_ACTION_FEEDBACK_COMMIT" as const;
export const CAP05_SCENARIO_OPTION_MEMBER_REF_POLICY_V1 = "GEOX_SCENARIO_OPTION_MEMBER_REF_BY_OPTION_ID_V1" as const;
export const CAP05_DECISION_SECOND_WRITE_POLICY_V1 = "IMMUTABLE_CONFLICT_V1" as const;
export const CAP05_ACTION_FEEDBACK_ELIGIBILITY_POLICY_V1 = "EXECUTED_OR_PARTIAL_VALIDATED_USABLE_EXACT_SCOPE_V1" as const;
export const CAP05_ACTION_FEEDBACK_QUALITY_MAPPING_POLICY_V1 = "PASS_LIMITED_TO_USABLE_FAIL_TO_UNUSABLE_V1" as const;
export const CAP05_TARGET_EQUIVALENT_IRRIGATION_POLICY_V1 = "ACTUAL_AMOUNT_TIMES_SPATIAL_COVERAGE_V1" as const;

export type Cap05NonLineageEnvelopeV1<TObjectType extends string, TPayload extends Record<string, unknown>> = {
  object_id: string;
  object_type: TObjectType;
  schema_version: "v1";
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  season_id: string;
  zone_id: string;
  logical_time: string;
  as_of: string;
  source_refs: string[];
  evidence_refs: string[];
  runtime_config_ref: string;
  runtime_config_hash: string;
  idempotency_key: string;
  determinism_hash: string;
  limitations: string[];
  created_at: string;
  context_lineage_ref: string;
  context_revision_ref: string;
  supersedes_ref?: string | null;
  payload: TPayload;
};

export type Cap05DecisionPayloadV1 = {
  record_set_contract_id: typeof CAP05_DECISION_CONTRACT_ID_V1;
  transaction_variant: typeof CAP05_DECISION_TRANSACTION_VARIANT_V1;
  scenario_set_ref: string;
  scenario_set_hash: string;
  scenario_logical_time: string;
  selected_option_ref: string;
  selected_option_hash: string;
  selected_option_id: Cap04ScenarioOptionIdV1;
  decision_request_evidence_ref: string;
  decision_request_evidence_hash: string;
  actor_class: "HUMAN";
  actor_ref: string;
  decision_status: "SELECTED";
  decided_at: string;
  second_write_policy_id: typeof CAP05_DECISION_SECOND_WRITE_POLICY_V1;
  member_reference_policy_id: typeof CAP05_SCENARIO_OPTION_MEMBER_REF_POLICY_V1;
};

export type Cap05DecisionEnvelopeV1 = Cap05NonLineageEnvelopeV1<
  typeof CAP05_DECISION_OBJECT_TYPE_V1,
  Cap05DecisionPayloadV1
>;

export type Cap05ExecutionStatusV1 = "EXECUTED" | "PARTIALLY_EXECUTED" | "EXECUTION_UNCERTAIN" | "NOT_EXECUTED";
export type Cap05ValidationStatusV1 = "NOT_YET_VALIDATED" | "VALIDATED" | "REJECTED" | "VALIDATED_WITH_LIMITATIONS";
export type Cap05SourceQualityV1 = "PASS" | "LIMITED" | "FAIL";
export type Cap05DispatchDispositionV1 = "NOT_OBSERVED" | "NOT_APPLICABLE" | "EXTERNALLY_RECORDED";

export type Cap05ActionFeedbackPayloadV1 = {
  record_set_contract_id: typeof CAP05_ACTION_FEEDBACK_CONTRACT_ID_V1;
  transaction_variant: typeof CAP05_ACTION_FEEDBACK_TRANSACTION_VARIANT_V1;
  origin_kind: "EXTERNAL_EVIDENCE" | "AO_ACT";
  decision_ref: string;
  decision_hash: string;
  approved_plan_evidence_ref: string;
  approved_plan_evidence_hash: string;
  task_ref: string | null;
  receipt_ref: string | null;
  as_executed_ref: string | null;
  acceptance_ref: string | null;
  dispatch_disposition: Cap05DispatchDispositionV1;
  event_id: string;
  source_record_id: string;
  binding_id: string;
  origin_source_id: string;
  target_scope: ContinuationScopeV1;
  execution_status: Cap05ExecutionStatusV1;
  validation_status: Cap05ValidationStatusV1;
  source_quality: Cap05SourceQualityV1;
  eligible_for_state_input: boolean;
  actual_amount_mm: string;
  spatial_coverage_fraction: string;
  target_scope_equivalent_irrigation_mm: string;
  execution_start: string;
  execution_end: string;
  ingested_at: string;
  available_to_runtime_at: string;
  eligibility_policy_id: typeof CAP05_ACTION_FEEDBACK_ELIGIBILITY_POLICY_V1;
  quality_mapping_policy_id: typeof CAP05_ACTION_FEEDBACK_QUALITY_MAPPING_POLICY_V1;
  target_equivalent_irrigation_policy_id: typeof CAP05_TARGET_EQUIVALENT_IRRIGATION_POLICY_V1;
  source_execution_status_trace: Cap05ExecutionStatusV1;
};

export type Cap05ActionFeedbackEnvelopeV1 = Cap05NonLineageEnvelopeV1<
  typeof CAP05_ACTION_FEEDBACK_OBJECT_TYPE_V1,
  Cap05ActionFeedbackPayloadV1
>;

export type BuildCap05DecisionInputV1 = {
  scope: ContinuationScopeV1;
  scenario_set: Cap04ScenarioSetEnvelopeV1;
  selected_option_id: Cap04ScenarioOptionIdV1;
  decision_request_evidence_ref: string;
  decision_request_evidence_hash: string;
  actor_ref: string;
  decided_at: string;
  context_lineage_ref: string;
  context_revision_ref: string;
  created_at: string;
};

export type BuildCap05ActionFeedbackInputV1 = {
  scope: ContinuationScopeV1;
  decision_ref: string;
  decision_hash: string;
  approved_plan_evidence_ref: string;
  approved_plan_evidence_hash: string;
  origin_kind: "EXTERNAL_EVIDENCE" | "AO_ACT";
  task_ref?: string | null;
  receipt_ref?: string | null;
  as_executed_ref?: string | null;
  acceptance_ref?: string | null;
  dispatch_disposition: Cap05DispatchDispositionV1;
  event_id: string;
  source_record_id: string;
  binding_id: string;
  origin_source_id: string;
  execution_status: Cap05ExecutionStatusV1;
  validation_status: Cap05ValidationStatusV1;
  source_quality: Cap05SourceQualityV1;
  eligible_for_state_input: boolean;
  actual_amount_mm: string;
  spatial_coverage_fraction: string;
  execution_start: string;
  execution_end: string;
  ingested_at: string;
  available_to_runtime_at: string;
  runtime_config_ref: string;
  runtime_config_hash: string;
  context_lineage_ref: string;
  context_revision_ref: string;
  created_at: string;
};

function requiredStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

function canonicalInstantV1(value: unknown, code: string): string {
  const text = requiredStringV1(value, code);
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== text) throw new Error(code);
  return text;
}

type Cap05ScopeLikeV1 = {
  tenant_id: unknown;
  project_id: unknown;
  group_id: unknown;
  field_id: unknown;
  season_id: unknown;
  zone_id: unknown;
};

function exactScopeV1(scope: Cap05ScopeLikeV1): ContinuationScopeV1 {
  return {
    tenant_id: requiredStringV1(scope?.tenant_id, "CAP05_SCOPE_TENANT_REQUIRED"),
    project_id: requiredStringV1(scope?.project_id, "CAP05_SCOPE_PROJECT_REQUIRED"),
    group_id: requiredStringV1(scope?.group_id, "CAP05_SCOPE_GROUP_REQUIRED"),
    field_id: requiredStringV1(scope?.field_id, "CAP05_SCOPE_FIELD_REQUIRED"),
    season_id: requiredStringV1(scope?.season_id, "CAP05_SCOPE_SEASON_REQUIRED"),
    zone_id: requiredStringV1(scope?.zone_id, "CAP05_SCOPE_ZONE_REQUIRED"),
  };
}

function sameScopeV1(left: Cap05ScopeLikeV1, right: Cap05ScopeLikeV1): boolean {
  return JSON.stringify(exactScopeV1(left)) === JSON.stringify(exactScopeV1(right));
}

function validateEnvelopeBaseV1(object: Cap05NonLineageEnvelopeV1<string, Record<string, unknown>>): void {
  requiredStringV1(object.object_id, "CAP05_OBJECT_ID_REQUIRED");
  requiredStringV1(object.object_type, "CAP05_OBJECT_TYPE_REQUIRED");
  if (object.schema_version !== "v1") throw new Error("CAP05_SCHEMA_VERSION_MISMATCH");
  exactScopeV1(object);
  canonicalInstantV1(object.logical_time, "CAP05_LOGICAL_TIME_INVALID");
  canonicalInstantV1(object.as_of, "CAP05_AS_OF_INVALID");
  canonicalInstantV1(object.created_at, "CAP05_CREATED_AT_INVALID");
  requiredStringV1(object.runtime_config_ref, "CAP05_RUNTIME_CONFIG_REF_REQUIRED");
  requiredStringV1(object.runtime_config_hash, "CAP05_RUNTIME_CONFIG_HASH_REQUIRED");
  requiredStringV1(object.idempotency_key, "CAP05_IDEMPOTENCY_KEY_REQUIRED");
  requiredStringV1(object.determinism_hash, "CAP05_DETERMINISM_HASH_REQUIRED");
  requiredStringV1(object.context_lineage_ref, "CAP05_CONTEXT_LINEAGE_REF_REQUIRED");
  requiredStringV1(object.context_revision_ref, "CAP05_CONTEXT_REVISION_REF_REQUIRED");
  if (!Array.isArray(object.source_refs) || !Array.isArray(object.evidence_refs) || !Array.isArray(object.limitations)) throw new Error("CAP05_ENVELOPE_ARRAYS_REQUIRED");
  if ("lineage_id" in object || "revision_id" in object || "fact_id" in object) throw new Error("CAP05_NON_LINEAGE_ENVELOPE_VIOLATION");
  const expectedHash = computeMemberDeterminismHashV1(object as unknown as Record<string, unknown>);
  if (object.determinism_hash !== expectedHash) throw new Error("CAP05_SEMANTIC_HASH_MISMATCH");
}

export function buildCap05ScenarioOptionMemberRefV1(scenarioSetRef: string, optionId: Cap04ScenarioOptionIdV1): string {
  return `geox-semantic-member://twin_scenario_set_v1/${requiredStringV1(scenarioSetRef, "CAP05_SCENARIO_SET_REF_REQUIRED")}/options/by-option-id/${optionId}`;
}

export function resolveCap05ScenarioOptionMemberV1(
  scenarioSet: Cap04ScenarioSetEnvelopeV1,
  selectedOptionRef: string,
): { option_id: Cap04ScenarioOptionIdV1; option_hash: string } {
  const prefix = `geox-semantic-member://twin_scenario_set_v1/${scenarioSet.object_id}/options/by-option-id/`;
  if (!selectedOptionRef.startsWith(prefix)) throw new Error("CAP05_SCENARIO_MEMBER_REF_INVALID");
  const optionId = selectedOptionRef.slice(prefix.length) as Cap04ScenarioOptionIdV1;
  const matches = scenarioSet.payload.options.filter((option) => option.option_id === optionId);
  if (matches.length !== 1) throw new Error("CAP05_SCENARIO_MEMBER_CARDINALITY");
  const assumedIrrigationMm = optionId === "NO_ACTION" ? 0 : optionId === "IRRIGATE_NOW_15MM" ? 15 : 25;
const expectedRequestedAmount = `${assumedIrrigationMm}.000000`;
if (matches[0].requested_irrigation_mm !== expectedRequestedAmount) throw new Error("CAP05_SCENARIO_MEMBER_AMOUNT_MISMATCH");
return {
  option_id: optionId,
  option_hash: semanticHashV1({
    scenario_set_ref: scenarioSet.object_id,
    scenario_set_hash: scenarioSet.determinism_hash,
    option_id: optionId,
    assumed_irrigation_mm: assumedIrrigationMm,
  }),
};
}

export function buildCap05DecisionV1(input: BuildCap05DecisionInputV1): Cap05DecisionEnvelopeV1 {
  const scope = exactScopeV1(input.scope);
  if (!sameScopeV1(scope, input.scenario_set)) throw new Error("CAP05_DECISION_SCENARIO_SCOPE_MISMATCH");
  const selectedOptionRef = buildCap05ScenarioOptionMemberRefV1(input.scenario_set.object_id, input.selected_option_id);
  const resolved = resolveCap05ScenarioOptionMemberV1(input.scenario_set, selectedOptionRef);
  const decidedAt = canonicalInstantV1(input.decided_at, "CAP05_DECISION_DECIDED_AT_INVALID");
  const payload: Cap05DecisionPayloadV1 = {
    record_set_contract_id: CAP05_DECISION_CONTRACT_ID_V1,
    transaction_variant: CAP05_DECISION_TRANSACTION_VARIANT_V1,
    scenario_set_ref: input.scenario_set.object_id,
    scenario_set_hash: input.scenario_set.determinism_hash,
    scenario_logical_time: input.scenario_set.logical_time,
    selected_option_ref: selectedOptionRef,
    selected_option_hash: resolved.option_hash,
    selected_option_id: resolved.option_id,
    decision_request_evidence_ref: requiredStringV1(input.decision_request_evidence_ref, "CAP05_DECISION_REQUEST_REF_REQUIRED"),
    decision_request_evidence_hash: requiredStringV1(input.decision_request_evidence_hash, "CAP05_DECISION_REQUEST_HASH_REQUIRED"),
    actor_class: "HUMAN",
    actor_ref: requiredStringV1(input.actor_ref, "CAP05_DECISION_ACTOR_REF_REQUIRED"),
    decision_status: "SELECTED",
    decided_at: decidedAt,
    second_write_policy_id: CAP05_DECISION_SECOND_WRITE_POLICY_V1,
    member_reference_policy_id: CAP05_SCENARIO_OPTION_MEMBER_REF_POLICY_V1,
  };
  const identityBasis = { object_type: CAP05_DECISION_OBJECT_TYPE_V1, scope, scenario_set_ref: payload.scenario_set_ref, selected_option_ref: payload.selected_option_ref };
  const object: Cap05DecisionEnvelopeV1 = {
    object_id: deriveSemanticObjectIdV1("twin_decision_record", identityBasis),
    object_type: CAP05_DECISION_OBJECT_TYPE_V1,
    schema_version: "v1",
    ...scope,
    logical_time: input.scenario_set.logical_time,
    as_of: decidedAt,
    source_refs: [payload.scenario_set_ref, payload.selected_option_ref].sort(),
    evidence_refs: [payload.decision_request_evidence_ref],
    runtime_config_ref: input.scenario_set.runtime_config_ref ?? requiredStringV1(input.scenario_set.payload.runtime_config_ref, "CAP05_DECISION_RUNTIME_CONFIG_REF_REQUIRED"),
    runtime_config_hash: input.scenario_set.runtime_config_hash ?? requiredStringV1(input.scenario_set.payload.runtime_config_hash, "CAP05_DECISION_RUNTIME_CONFIG_HASH_REQUIRED"),
    idempotency_key: deriveSemanticObjectIdV1("decision_key", identityBasis),
    determinism_hash: "",
    limitations: ["HUMAN_DECISION_LINK_ONLY", "NO_RECOMMENDATION", "NO_DISPATCH", "NO_STATE_MUTATION"],
    created_at: canonicalInstantV1(input.created_at, "CAP05_DECISION_CREATED_AT_INVALID"),
    context_lineage_ref: requiredStringV1(input.context_lineage_ref, "CAP05_DECISION_CONTEXT_LINEAGE_REQUIRED"),
    context_revision_ref: requiredStringV1(input.context_revision_ref, "CAP05_DECISION_CONTEXT_REVISION_REQUIRED"),
    supersedes_ref: null,
    payload,
  };
  object.determinism_hash = computeMemberDeterminismHashV1(object as unknown as Record<string, unknown>);
  validateCap05DecisionV1(object);
  return object;
}

export function validateCap05DecisionV1(object: Cap05DecisionEnvelopeV1): void {
  validateEnvelopeBaseV1(object as unknown as Cap05NonLineageEnvelopeV1<string, Record<string, unknown>>);
  if (object.object_type !== CAP05_DECISION_OBJECT_TYPE_V1) throw new Error("CAP05_DECISION_OBJECT_TYPE_MISMATCH");
  const payload = object.payload;
  if (payload.record_set_contract_id !== CAP05_DECISION_CONTRACT_ID_V1 || payload.transaction_variant !== CAP05_DECISION_TRANSACTION_VARIANT_V1) throw new Error("CAP05_DECISION_CONTRACT_MISMATCH");
  if (payload.decision_status !== "SELECTED" || payload.actor_class !== "HUMAN") throw new Error("CAP05_DECISION_HUMAN_SELECTED_REQUIRED");
  if (payload.second_write_policy_id !== CAP05_DECISION_SECOND_WRITE_POLICY_V1) throw new Error("CAP05_DECISION_SECOND_WRITE_POLICY_MISMATCH");
  if (payload.member_reference_policy_id !== CAP05_SCENARIO_OPTION_MEMBER_REF_POLICY_V1) throw new Error("CAP05_DECISION_MEMBER_REF_POLICY_MISMATCH");
  if (object.logical_time !== payload.scenario_logical_time) throw new Error("CAP05_DECISION_LOGICAL_TIME_MISMATCH");
  if (object.as_of !== payload.decided_at) throw new Error("CAP05_DECISION_AS_OF_MISMATCH");
  if (!object.source_refs.includes(payload.scenario_set_ref) || !object.source_refs.includes(payload.selected_option_ref)) throw new Error("CAP05_DECISION_SOURCE_REFS_INCOMPLETE");
  if (!object.evidence_refs.includes(payload.decision_request_evidence_ref)) throw new Error("CAP05_DECISION_EVIDENCE_REF_MISSING");
  if (object.supersedes_ref !== null) throw new Error("CAP05_DECISION_SUPERSESSION_FORBIDDEN_V1");
}

function computeTargetEquivalentIrrigationV1(actualAmount: string, coverage: string): string {
  const amountUnits = parseFixedDecimalV1(actualAmount, WATER_AMOUNT_SCALE_V1, "CAP05_ACTION_AMOUNT_INVALID");
  const coverageUnits = parseFixedDecimalV1(coverage, WATER_AMOUNT_SCALE_V1, "CAP05_ACTION_COVERAGE_INVALID");
  if (amountUnits < 0n) throw new Error("CAP05_ACTION_AMOUNT_NEGATIVE");
  if (coverageUnits < 0n || coverageUnits > 1_000_000n) throw new Error("CAP05_ACTION_COVERAGE_OUT_OF_RANGE");
  return formatFixedDecimalV1(
    multiplyFixedUnitsV1(amountUnits, WATER_AMOUNT_SCALE_V1, coverageUnits, WATER_AMOUNT_SCALE_V1, WATER_AMOUNT_SCALE_V1),
    WATER_AMOUNT_SCALE_V1,
  );
}

export function buildCap05ActionFeedbackV1(input: BuildCap05ActionFeedbackInputV1): Cap05ActionFeedbackEnvelopeV1 {
  const scope = exactScopeV1(input.scope);
  const executionStart = canonicalInstantV1(input.execution_start, "CAP05_ACTION_EXECUTION_START_INVALID");
  const executionEnd = canonicalInstantV1(input.execution_end, "CAP05_ACTION_EXECUTION_END_INVALID");
  const ingestedAt = canonicalInstantV1(input.ingested_at, "CAP05_ACTION_INGESTED_AT_INVALID");
  const availableAt = canonicalInstantV1(input.available_to_runtime_at, "CAP05_ACTION_AVAILABLE_AT_INVALID");
  if (executionStart > executionEnd) throw new Error("CAP05_ACTION_EXECUTION_INTERVAL_INVALID");
  if (ingestedAt > availableAt) throw new Error("CAP05_ACTION_AVAILABILITY_PRECEDES_INGESTION");
  const taskRef = input.task_ref ?? null;
  const receiptRef = input.receipt_ref ?? null;
  const asExecutedRef = input.as_executed_ref ?? null;
  const acceptanceRef = input.acceptance_ref ?? null;
  if (!receiptRef && !asExecutedRef) throw new Error("CAP05_ACTION_TRUSTED_EXECUTION_SOURCE_REQUIRED");
  if (input.origin_kind === "AO_ACT" && !taskRef) throw new Error("CAP05_ACTION_AO_ACT_TASK_REF_REQUIRED");
  if (input.origin_kind !== "AO_ACT" && taskRef) throw new Error("CAP05_ACTION_EXTERNAL_TASK_REF_FORBIDDEN");
  if (input.validation_status === "REJECTED" && input.eligible_for_state_input) throw new Error("CAP05_ACTION_REJECTED_NOT_ELIGIBLE");
  if (["NOT_EXECUTED", "EXECUTION_UNCERTAIN"].includes(input.execution_status) && input.eligible_for_state_input) throw new Error("CAP05_ACTION_NON_EXECUTED_NOT_ELIGIBLE");
  if (input.source_quality === "FAIL" && input.eligible_for_state_input) throw new Error("CAP05_ACTION_FAILED_QUALITY_NOT_ELIGIBLE");
  const actualAmount = formatFixedDecimalV1(parseFixedDecimalV1(input.actual_amount_mm, WATER_AMOUNT_SCALE_V1), WATER_AMOUNT_SCALE_V1);
  const coverage = formatFixedDecimalV1(parseFixedDecimalV1(input.spatial_coverage_fraction, WATER_AMOUNT_SCALE_V1), WATER_AMOUNT_SCALE_V1);
  const targetEquivalent = computeTargetEquivalentIrrigationV1(actualAmount, coverage);
  const payload: Cap05ActionFeedbackPayloadV1 = {
    record_set_contract_id: CAP05_ACTION_FEEDBACK_CONTRACT_ID_V1,
    transaction_variant: CAP05_ACTION_FEEDBACK_TRANSACTION_VARIANT_V1,
    origin_kind: input.origin_kind,
    decision_ref: requiredStringV1(input.decision_ref, "CAP05_ACTION_DECISION_REF_REQUIRED"),
    decision_hash: requiredStringV1(input.decision_hash, "CAP05_ACTION_DECISION_HASH_REQUIRED"),
    approved_plan_evidence_ref: requiredStringV1(input.approved_plan_evidence_ref, "CAP05_ACTION_PLAN_REF_REQUIRED"),
    approved_plan_evidence_hash: requiredStringV1(input.approved_plan_evidence_hash, "CAP05_ACTION_PLAN_HASH_REQUIRED"),
    task_ref: taskRef,
    receipt_ref: receiptRef,
    as_executed_ref: asExecutedRef,
    acceptance_ref: acceptanceRef,
    dispatch_disposition: input.dispatch_disposition,
    event_id: requiredStringV1(input.event_id, "CAP05_ACTION_EVENT_ID_REQUIRED"),
    source_record_id: requiredStringV1(input.source_record_id, "CAP05_ACTION_SOURCE_RECORD_ID_REQUIRED"),
    binding_id: requiredStringV1(input.binding_id, "CAP05_ACTION_BINDING_ID_REQUIRED"),
    origin_source_id: requiredStringV1(input.origin_source_id, "CAP05_ACTION_ORIGIN_SOURCE_ID_REQUIRED"),
    target_scope: scope,
    execution_status: input.execution_status,
    validation_status: input.validation_status,
    source_quality: input.source_quality,
    eligible_for_state_input: input.eligible_for_state_input,
    actual_amount_mm: actualAmount,
    spatial_coverage_fraction: coverage,
    target_scope_equivalent_irrigation_mm: targetEquivalent,
    execution_start: executionStart,
    execution_end: executionEnd,
    ingested_at: ingestedAt,
    available_to_runtime_at: availableAt,
    eligibility_policy_id: CAP05_ACTION_FEEDBACK_ELIGIBILITY_POLICY_V1,
    quality_mapping_policy_id: CAP05_ACTION_FEEDBACK_QUALITY_MAPPING_POLICY_V1,
    target_equivalent_irrigation_policy_id: CAP05_TARGET_EQUIVALENT_IRRIGATION_POLICY_V1,
    source_execution_status_trace: input.execution_status,
  };
  const identityBasis = { object_type: CAP05_ACTION_FEEDBACK_OBJECT_TYPE_V1, scope, source_record_id: payload.source_record_id, source_record_semantics: { event_id: payload.event_id, execution_end: payload.execution_end, actual_amount_mm: actualAmount, coverage } };
  const evidenceRefs = [payload.approved_plan_evidence_ref, receiptRef, asExecutedRef, acceptanceRef].filter((value): value is string => Boolean(value)).sort();
  const sourceRefs = [payload.decision_ref, taskRef].filter((value): value is string => Boolean(value)).sort();
  const object: Cap05ActionFeedbackEnvelopeV1 = {
    object_id: deriveSemanticObjectIdV1("twin_action_feedback", identityBasis),
    object_type: CAP05_ACTION_FEEDBACK_OBJECT_TYPE_V1,
    schema_version: "v1",
    ...scope,
    logical_time: executionEnd,
    as_of: availableAt,
    source_refs: sourceRefs,
    evidence_refs: evidenceRefs,
    runtime_config_ref: requiredStringV1(input.runtime_config_ref, "CAP05_ACTION_RUNTIME_CONFIG_REF_REQUIRED"),
    runtime_config_hash: requiredStringV1(input.runtime_config_hash, "CAP05_ACTION_RUNTIME_CONFIG_HASH_REQUIRED"),
    idempotency_key: deriveSemanticObjectIdV1("action_feedback_key", { scope, source_record_id: payload.source_record_id }),
    determinism_hash: "",
    limitations: ["EXECUTION_EVIDENCE_ONLY", "NO_EFFECTIVENESS_CLAIM", "NO_EXECUTION_ACCEPTANCE", "NO_STATE_MUTATION"],
    created_at: canonicalInstantV1(input.created_at, "CAP05_ACTION_CREATED_AT_INVALID"),
    context_lineage_ref: requiredStringV1(input.context_lineage_ref, "CAP05_ACTION_CONTEXT_LINEAGE_REQUIRED"),
    context_revision_ref: requiredStringV1(input.context_revision_ref, "CAP05_ACTION_CONTEXT_REVISION_REQUIRED"),
    payload,
  };
  object.determinism_hash = computeMemberDeterminismHashV1(object as unknown as Record<string, unknown>);
  validateCap05ActionFeedbackV1(object);
  return object;
}

export function validateCap05ActionFeedbackV1(object: Cap05ActionFeedbackEnvelopeV1): void {
  validateEnvelopeBaseV1(object as unknown as Cap05NonLineageEnvelopeV1<string, Record<string, unknown>>);
  if (object.object_type !== CAP05_ACTION_FEEDBACK_OBJECT_TYPE_V1) throw new Error("CAP05_ACTION_OBJECT_TYPE_MISMATCH");
  const payload = object.payload;
  if (payload.record_set_contract_id !== CAP05_ACTION_FEEDBACK_CONTRACT_ID_V1 || payload.transaction_variant !== CAP05_ACTION_FEEDBACK_TRANSACTION_VARIANT_V1) throw new Error("CAP05_ACTION_CONTRACT_MISMATCH");
  if (!sameScopeV1(object, payload.target_scope)) throw new Error("CAP05_ACTION_TARGET_SCOPE_MISMATCH");
  if (object.logical_time !== payload.execution_end || object.as_of !== payload.available_to_runtime_at) throw new Error("CAP05_ACTION_TIME_MAPPING_MISMATCH");
  if (!payload.receipt_ref && !payload.as_executed_ref) throw new Error("CAP05_ACTION_TRUSTED_EXECUTION_SOURCE_REQUIRED");
  if (payload.origin_kind === "AO_ACT" && !payload.task_ref) throw new Error("CAP05_ACTION_AO_ACT_TASK_REF_REQUIRED");
  if (payload.origin_kind !== "AO_ACT" && payload.task_ref) throw new Error("CAP05_ACTION_EXTERNAL_TASK_REF_FORBIDDEN");
  if (!object.source_refs.includes(payload.decision_ref)) throw new Error("CAP05_ACTION_DECISION_SOURCE_REF_MISSING");
  if (!object.evidence_refs.includes(payload.approved_plan_evidence_ref)) throw new Error("CAP05_ACTION_PLAN_EVIDENCE_REF_MISSING");
  if (payload.receipt_ref && !object.evidence_refs.includes(payload.receipt_ref)) throw new Error("CAP05_ACTION_RECEIPT_EVIDENCE_REF_MISSING");
  if (payload.target_scope_equivalent_irrigation_mm !== computeTargetEquivalentIrrigationV1(payload.actual_amount_mm, payload.spatial_coverage_fraction)) throw new Error("CAP05_ACTION_TARGET_EQUIVALENT_IRRIGATION_MISMATCH");
  if (payload.eligibility_policy_id !== CAP05_ACTION_FEEDBACK_ELIGIBILITY_POLICY_V1 || payload.quality_mapping_policy_id !== CAP05_ACTION_FEEDBACK_QUALITY_MAPPING_POLICY_V1 || payload.target_equivalent_irrigation_policy_id !== CAP05_TARGET_EQUIVALENT_IRRIGATION_POLICY_V1) throw new Error("CAP05_ACTION_POLICY_MISMATCH");
  if (payload.source_execution_status_trace !== payload.execution_status) throw new Error("CAP05_ACTION_SOURCE_STATUS_TRACE_MISMATCH");
  if (payload.validation_status === "REJECTED" && payload.eligible_for_state_input) throw new Error("CAP05_ACTION_REJECTED_NOT_ELIGIBLE");
  if (["NOT_EXECUTED", "EXECUTION_UNCERTAIN"].includes(payload.execution_status) && payload.eligible_for_state_input) throw new Error("CAP05_ACTION_NON_EXECUTED_NOT_ELIGIBLE");
  if (payload.source_quality === "FAIL" && payload.eligible_for_state_input) throw new Error("CAP05_ACTION_FAILED_QUALITY_NOT_ELIGIBLE");
}
