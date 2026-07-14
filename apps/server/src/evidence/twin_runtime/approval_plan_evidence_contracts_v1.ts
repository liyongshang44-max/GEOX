// apps/server/src/evidence/twin_runtime/approval_plan_evidence_contracts_v1.ts
// Purpose: validate the bounded MCFT-CAP-05 Approval Assertion and Approved Plan Replay Evidence records before Decision binding and append-only persistence.
// Boundary: pure Evidence validation only; no approval exercise, canonical Twin object creation, database, clock, filesystem, environment, route, Recommendation, Task, dispatch or State authority.

import { semanticHashV1 } from "../../domain/twin_runtime/canonical_identity_v1.js";
import type { ContinuationScopeV1 } from "../../domain/twin_runtime/continuation_operation_identity_v1.js";

export const CAP05_APPROVAL_ASSERTION_RECORD_TYPE_V1 = "approval_assertion_evidence_v1" as const;
export const CAP05_APPROVED_PLAN_RECORD_TYPE_V1 = "approved_irrigation_plan_snapshot_v1" as const;
export const CAP05_REPLAY_EVIDENCE_SOURCE_KIND_V1 = "CONTROLLED_REPLAY_DATASET" as const;
export const CAP05_APPROVAL_SEMANTICS_V1 = "EXTERNAL_OR_HUMAN_EVIDENCE_ASSERTION" as const;

export type Cap05DispatchDispositionV1 = "NOT_OBSERVED" | "NOT_APPLICABLE" | "EXTERNALLY_RECORDED";

export type Cap05ReplayEvidenceQualityV1 = {
  status: "PASS" | "LIMITED" | "FAIL";
};

export type Cap05ReplayEvidenceBaseV1<RecordType extends string, Payload extends Record<string, unknown>> = ContinuationScopeV1 & {
  dataset_id: string;
  source_record_id: string;
  source_record_hash: string;
  record_type: RecordType;
  evidence_identity_key: string;
  idempotency_key: string;
  ingress_adapter_id: "canonical_replay_evidence_ingress_v1";
  ingress_adapter_version: 1;
  origin_source_id: string;
  origin_source_kind: typeof CAP05_REPLAY_EVIDENCE_SOURCE_KIND_V1;
  source_version: string;
  available_to_runtime_at: string;
  binding_id: string;
  quality: Cap05ReplayEvidenceQualityV1;
  epistemic_class: "ASSERTED";
  limitations: string[];
  source_payload: Payload;
  canonical_payload: Payload;
  role_time: Record<string, unknown>;
};

export type Cap05ApprovalAssertionPayloadV1 = {
  approval_semantics: typeof CAP05_APPROVAL_SEMANTICS_V1;
  approval_status: "APPROVED";
  approver_class: "HUMAN";
  approver_ref: string;
  decision_request_ref: string;
  decision_request_hash: string;
  selected_option_ref: string;
  selected_option_hash: string;
  geox_approval_request_created: false;
  geox_approval_authority_exercised: false;
};

export type Cap05ApprovalAssertionEvidenceV1 = Cap05ReplayEvidenceBaseV1<
  typeof CAP05_APPROVAL_ASSERTION_RECORD_TYPE_V1,
  Cap05ApprovalAssertionPayloadV1
> & {
  action_lifecycle_class: "APPROVAL_ASSERTION";
  role_time: {
    asserted_at: string;
    approved_at: string;
    ingested_at: string;
    available_to_runtime_at: string;
  };
};

export type Cap05ApprovedPlanPayloadV1 = {
  plan_status: "APPROVED";
  active_for_decision: boolean;
  approval_assertion_ref: string;
  approval_assertion_hash: string;
  decision_request_ref: string;
  decision_request_hash: string;
  selected_option_ref: string;
  selected_option_hash: string;
  scenario_amount_mm: string | number;
  approved_amount_mm: string | number;
  amount_difference_mm: string | number;
  amount_difference_reason_codes: string[];
  target_scope: ContinuationScopeV1;
  supersedes_plan_evidence_ref?: string;
  supersedes_plan_evidence_hash?: string;
};

export type Cap05ApprovedPlanEvidenceV1 = Cap05ReplayEvidenceBaseV1<
  typeof CAP05_APPROVED_PLAN_RECORD_TYPE_V1,
  Cap05ApprovedPlanPayloadV1
> & {
  action_lifecycle_class: "APPROVED_PLAN";
  role_time: {
    created_at: string;
    approved_at: string;
    ingested_at: string;
    available_to_runtime_at: string;
    plan_effective_from: string;
    plan_effective_to: string;
  };
};

export type Cap05ApprovalPlanValidationResultV1 = {
  scenario_amount_mm: string;
  approved_amount_mm: string;
  amount_difference_mm: string;
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

function decimalSixV1(value: unknown, code: string): string {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(code);
    return value.toFixed(6);
  }
  const text = requiredStringV1(value, code);
  if (!/^-?\d+(?:\.\d+)?$/.test(text)) throw new Error(code);
  const number = Number(text);
  if (!Number.isFinite(number)) throw new Error(code);
  return number.toFixed(6);
}

function assertScopeV1(scope: ContinuationScopeV1, candidate: ContinuationScopeV1, code: string): void {
  for (const field of ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"] as const) {
    if (candidate[field] !== scope[field]) throw new Error(`${code}:${field}`);
  }
}

function validateBaseV1(
  record: Cap05ReplayEvidenceBaseV1<string, Record<string, unknown>>,
  scope: ContinuationScopeV1,
  expectedRecordType: string,
): void {
  if (record.record_type !== expectedRecordType) throw new Error("CAP05_REPLAY_EVIDENCE_RECORD_TYPE_MISMATCH");
  assertScopeV1(scope, record, "CAP05_REPLAY_EVIDENCE_SCOPE_MISMATCH");
  requiredStringV1(record.dataset_id, "CAP05_REPLAY_EVIDENCE_DATASET_REQUIRED");
  requiredStringV1(record.source_record_id, "CAP05_REPLAY_EVIDENCE_SOURCE_RECORD_ID_REQUIRED");
  requiredStringV1(record.source_record_hash, "CAP05_REPLAY_EVIDENCE_SOURCE_RECORD_HASH_REQUIRED");
  requiredStringV1(record.evidence_identity_key, "CAP05_REPLAY_EVIDENCE_IDENTITY_KEY_REQUIRED");
  requiredStringV1(record.idempotency_key, "CAP05_REPLAY_EVIDENCE_IDEMPOTENCY_KEY_REQUIRED");
  requiredStringV1(record.binding_id, "CAP05_REPLAY_EVIDENCE_BINDING_ID_REQUIRED");
  requiredStringV1(record.origin_source_id, "CAP05_REPLAY_EVIDENCE_ORIGIN_REQUIRED");
  if (record.origin_source_kind !== CAP05_REPLAY_EVIDENCE_SOURCE_KIND_V1) throw new Error("CAP05_REPLAY_EVIDENCE_SOURCE_KIND_FORBIDDEN");
  if (record.ingress_adapter_id !== "canonical_replay_evidence_ingress_v1" || record.ingress_adapter_version !== 1) {
    throw new Error("CAP05_REPLAY_EVIDENCE_INGRESS_ADAPTER_MISMATCH");
  }
  if (record.quality?.status !== "PASS") throw new Error("CAP05_REPLAY_EVIDENCE_QUALITY_PASS_REQUIRED");
  if (record.epistemic_class !== "ASSERTED") throw new Error("CAP05_REPLAY_EVIDENCE_EPISTEMIC_CLASS_MISMATCH");
  canonicalInstantV1(record.available_to_runtime_at, "CAP05_REPLAY_EVIDENCE_AVAILABLE_AT_INVALID");
  if (semanticHashV1(record.source_payload) !== semanticHashV1(record.canonical_payload)) {
    throw new Error("CAP05_REPLAY_EVIDENCE_SOURCE_CANONICAL_PAYLOAD_DIVERGENCE");
  }
}

export function validateCap05ApprovalAssertionEvidenceV1(
  record: Cap05ApprovalAssertionEvidenceV1,
  scope: ContinuationScopeV1,
): void {
  validateBaseV1(record, scope, CAP05_APPROVAL_ASSERTION_RECORD_TYPE_V1);
  if (record.action_lifecycle_class !== "APPROVAL_ASSERTION") throw new Error("CAP05_APPROVAL_ASSERTION_LIFECYCLE_CLASS_MISMATCH");
  const payload = record.canonical_payload;
  if (payload.approval_semantics !== CAP05_APPROVAL_SEMANTICS_V1) throw new Error("CAP05_APPROVAL_SEMANTICS_MISMATCH");
  if (payload.approval_status !== "APPROVED") throw new Error("CAP05_APPROVAL_STATUS_MISMATCH");
  if (payload.approver_class !== "HUMAN") throw new Error("CAP05_APPROVER_HUMAN_REQUIRED");
  requiredStringV1(payload.approver_ref, "CAP05_APPROVER_REF_REQUIRED");
  requiredStringV1(payload.decision_request_ref, "CAP05_APPROVAL_DECISION_REQUEST_REF_REQUIRED");
  requiredStringV1(payload.decision_request_hash, "CAP05_APPROVAL_DECISION_REQUEST_HASH_REQUIRED");
  requiredStringV1(payload.selected_option_ref, "CAP05_APPROVAL_SELECTED_OPTION_REF_REQUIRED");
  requiredStringV1(payload.selected_option_hash, "CAP05_APPROVAL_SELECTED_OPTION_HASH_REQUIRED");
  if (payload.geox_approval_request_created !== false || payload.geox_approval_authority_exercised !== false) {
    throw new Error("CAP05_GEOX_APPROVAL_AUTHORITY_FORBIDDEN");
  }
  const assertedAt = canonicalInstantV1(record.role_time.asserted_at, "CAP05_APPROVAL_ASSERTED_AT_INVALID");
  const approvedAt = canonicalInstantV1(record.role_time.approved_at, "CAP05_APPROVAL_APPROVED_AT_INVALID");
  const availableAt = canonicalInstantV1(record.available_to_runtime_at, "CAP05_APPROVAL_AVAILABLE_AT_INVALID");
  if (assertedAt > approvedAt || approvedAt > availableAt) throw new Error("CAP05_APPROVAL_ROLE_TIME_ORDER_INVALID");
}

export function validateCap05ApprovedPlanEvidenceV1(
  record: Cap05ApprovedPlanEvidenceV1,
  scope: ContinuationScopeV1,
): Cap05ApprovalPlanValidationResultV1 {
  validateBaseV1(record, scope, CAP05_APPROVED_PLAN_RECORD_TYPE_V1);
  if (record.action_lifecycle_class !== "APPROVED_PLAN") throw new Error("CAP05_APPROVED_PLAN_LIFECYCLE_CLASS_MISMATCH");
  const payload = record.canonical_payload;
  if (payload.plan_status !== "APPROVED") throw new Error("CAP05_APPROVED_PLAN_STATUS_MISMATCH");
  if (payload.active_for_decision !== true) throw new Error("CAP05_APPROVED_PLAN_ACTIVE_REQUIRED");
  requiredStringV1(payload.approval_assertion_ref, "CAP05_PLAN_ASSERTION_REF_REQUIRED");
  requiredStringV1(payload.approval_assertion_hash, "CAP05_PLAN_ASSERTION_HASH_REQUIRED");
  requiredStringV1(payload.decision_request_ref, "CAP05_PLAN_DECISION_REQUEST_REF_REQUIRED");
  requiredStringV1(payload.decision_request_hash, "CAP05_PLAN_DECISION_REQUEST_HASH_REQUIRED");
  requiredStringV1(payload.selected_option_ref, "CAP05_PLAN_SELECTED_OPTION_REF_REQUIRED");
  requiredStringV1(payload.selected_option_hash, "CAP05_PLAN_SELECTED_OPTION_HASH_REQUIRED");
  assertScopeV1(scope, payload.target_scope, "CAP05_APPROVED_PLAN_TARGET_SCOPE_MISMATCH");
  const scenarioAmount = decimalSixV1(payload.scenario_amount_mm, "CAP05_PLAN_SCENARIO_AMOUNT_INVALID");
  const approvedAmount = decimalSixV1(payload.approved_amount_mm, "CAP05_PLAN_APPROVED_AMOUNT_INVALID");
  const difference = decimalSixV1(payload.amount_difference_mm, "CAP05_PLAN_AMOUNT_DIFFERENCE_INVALID");
  if (Number(scenarioAmount) < 0 || Number(approvedAmount) < 0) throw new Error("CAP05_PLAN_NEGATIVE_AMOUNT_FORBIDDEN");
  if ((Number(approvedAmount) - Number(scenarioAmount)).toFixed(6) !== difference) {
    throw new Error("CAP05_PLAN_AMOUNT_DIFFERENCE_MISMATCH");
  }
  if (difference !== "0.000000" && (!Array.isArray(payload.amount_difference_reason_codes) || payload.amount_difference_reason_codes.length === 0)) {
    throw new Error("CAP05_PLAN_AMOUNT_DIFFERENCE_REASON_REQUIRED");
  }
  for (const code of payload.amount_difference_reason_codes) requiredStringV1(code, "CAP05_PLAN_AMOUNT_DIFFERENCE_REASON_INVALID");
  const createdAt = canonicalInstantV1(record.role_time.created_at, "CAP05_PLAN_CREATED_AT_INVALID");
  const approvedAt = canonicalInstantV1(record.role_time.approved_at, "CAP05_PLAN_APPROVED_AT_INVALID");
  const availableAt = canonicalInstantV1(record.available_to_runtime_at, "CAP05_PLAN_AVAILABLE_AT_INVALID");
  const effectiveFrom = canonicalInstantV1(record.role_time.plan_effective_from, "CAP05_PLAN_EFFECTIVE_FROM_INVALID");
  const effectiveTo = canonicalInstantV1(record.role_time.plan_effective_to, "CAP05_PLAN_EFFECTIVE_TO_INVALID");
  if (createdAt > approvedAt || approvedAt > availableAt || effectiveFrom >= effectiveTo) throw new Error("CAP05_PLAN_ROLE_TIME_ORDER_INVALID");
  if (payload.supersedes_plan_evidence_ref || payload.supersedes_plan_evidence_hash) {
    requiredStringV1(payload.supersedes_plan_evidence_ref, "CAP05_PLAN_SUPERSEDES_REF_REQUIRED");
    requiredStringV1(payload.supersedes_plan_evidence_hash, "CAP05_PLAN_SUPERSEDES_HASH_REQUIRED");
  }
  return { scenario_amount_mm: scenarioAmount, approved_amount_mm: approvedAmount, amount_difference_mm: difference };
}
