// apps/server/src/evidence/twin_runtime/execution_receipt_evidence_contract_v1.ts
// Purpose: validate and normalize one MCFT-CAP-05 irrigation execution Receipt Replay Evidence record before canonical Action Feedback construction.
// Boundary: pure Evidence validation and status mapping only; no database, canonical append, State input, approval, dispatch, clock, filesystem, environment or network authority.

import type { ContinuationScopeV1 } from "../../domain/twin_runtime/continuation_operation_identity_v1.js";
import {
  WATER_AMOUNT_SCALE_V1,
  formatFixedDecimalV1,
  multiplyFixedUnitsV1,
  parseFixedDecimalV1,
} from "../../domain/soil_water/fixed_point_water_decimal_v1.js";
import { semanticHashV1 } from "../../domain/twin_runtime/canonical_identity_v1.js";
import type {
  Cap05ExecutionStatusV1,
  Cap05SourceQualityV1,
  Cap05ValidationStatusV1,
} from "../../domain/twin_runtime/feedback_canonical_contracts_v1.js";
import { assertCap05ReplayEvidenceSourceRecordHashV1 } from "./approval_plan_evidence_contracts_v1.js";

export const CAP05_EXECUTION_RECEIPT_RECORD_TYPE_V1 = "irrigation_execution_receipt_evidence_v1" as const;
export const CAP05_EXECUTION_RECEIPT_STATUS_MAPPING_POLICY_V1 = "FULL_PARTIAL_UNKNOWN_NONE_TO_CANONICAL_EXECUTION_V1" as const;
export const CAP05_EXECUTION_RECEIPT_VALIDATION_MAPPING_POLICY_V1 = "PASSED_LIMITED_FAILED_PENDING_TO_CANONICAL_VALIDATION_V1" as const;
export const CAP05_EXECUTION_RECEIPT_SAME_HOUR_POLICY_V1 = "EXECUTION_START_END_SAME_UTC_HOUR_V1" as const;
export const CAP05_EXECUTION_RECEIPT_UNIT_POLICY_V1 = "DEPTH_MM_ONLY_NO_VOLUME_CONVERSION_V1" as const;

export type Cap05ReceiptExecutionStatusSourceV1 =
  | "FULL"
  | "PARTIAL"
  | "UNKNOWN"
  | "NONE"
  | Cap05ExecutionStatusV1;

export type Cap05ReceiptValidationStatusSourceV1 =
  | "PASSED"
  | "PASSED_WITH_LIMITATIONS"
  | "FAILED"
  | "PENDING"
  | Cap05ValidationStatusV1;

export type Cap05ExecutionReceiptPayloadV1 = {
  approved_plan_ref: string;
  approved_plan_hash: string;
  external_dispatch_ref?: string | null;
  external_dispatch_hash?: string | null;
  event_id: string;
  execution_status: Cap05ReceiptExecutionStatusSourceV1;
  validation_status: Cap05ReceiptValidationStatusSourceV1;
  source_quality: Cap05SourceQualityV1;
  eligible_for_state_input: boolean;
  actual_amount_mm: string | number;
  spatial_coverage_fraction: string | number;
  target_scope_equivalent_irrigation_mm: string | number;
  target_scope: ContinuationScopeV1;
  unit: "mm";
};

export type Cap05ExecutionReceiptEvidenceV1 = ContinuationScopeV1 & {
  dataset_id: string;
  source_record_id: string;
  source_record_hash: string;
  record_type: typeof CAP05_EXECUTION_RECEIPT_RECORD_TYPE_V1;
  action_lifecycle_class: "EXECUTION_RECEIPT";
  evidence_identity_key: string;
  idempotency_key: string;
  ingress_adapter_id: "canonical_replay_evidence_ingress_v1";
  ingress_adapter_version: 1;
  binding_id: string;
  origin_source_id: string;
  origin_source_kind: "CONTROLLED_REPLAY_DATASET";
  source_version: string;
  epistemic_class: "OBSERVED";
  quality: { status: "PASS" | "LIMITED" | "FAIL" };
  limitations: string[];
  available_to_runtime_at: string;
  role_time: {
    execution_start: string;
    execution_end: string;
    ingested_at: string;
    available_to_runtime_at: string;
  };
  source_payload: Cap05ExecutionReceiptPayloadV1;
  canonical_payload: Cap05ExecutionReceiptPayloadV1;
};

export type Cap05NormalizedExecutionReceiptV1 = {
  evidence: Cap05ExecutionReceiptEvidenceV1;
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
  dispatch_ref: string | null;
  dispatch_hash: string | null;
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

function exactScopeV1(value: ContinuationScopeV1): ContinuationScopeV1 {
  return {
    tenant_id: requiredStringV1(value?.tenant_id, "CAP05_RECEIPT_TENANT_REQUIRED"),
    project_id: requiredStringV1(value?.project_id, "CAP05_RECEIPT_PROJECT_REQUIRED"),
    group_id: requiredStringV1(value?.group_id, "CAP05_RECEIPT_GROUP_REQUIRED"),
    field_id: requiredStringV1(value?.field_id, "CAP05_RECEIPT_FIELD_REQUIRED"),
    season_id: requiredStringV1(value?.season_id, "CAP05_RECEIPT_SEASON_REQUIRED"),
    zone_id: requiredStringV1(value?.zone_id, "CAP05_RECEIPT_ZONE_REQUIRED"),
  };
}

function assertScopeV1(expected: ContinuationScopeV1, actual: ContinuationScopeV1, code: string): void {
  const left = exactScopeV1(expected);
  const right = exactScopeV1(actual);
  for (const field of ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"] as const) {
    if (left[field] !== right[field]) throw new Error(`${code}:${field}`);
  }
}

function decimalSixV1(value: unknown, code: string): string {
  let decimalText: string;
  if (typeof value === "string") {
    decimalText = value;
  } else if (typeof value === "number" && Number.isFinite(value)) {
    decimalText = value.toString();
  } else {
    throw new Error(code);
  }
  return formatFixedDecimalV1(parseFixedDecimalV1(decimalText, WATER_AMOUNT_SCALE_V1, code), WATER_AMOUNT_SCALE_V1);
}

function computeCoveredAmountV1(actualAmount: string, coverage: string): string {
  const amountUnits = parseFixedDecimalV1(actualAmount, WATER_AMOUNT_SCALE_V1, "CAP05_RECEIPT_AMOUNT_INVALID");
  const coverageUnits = parseFixedDecimalV1(coverage, WATER_AMOUNT_SCALE_V1, "CAP05_RECEIPT_COVERAGE_INVALID");
  if (amountUnits < 0n) throw new Error("CAP05_RECEIPT_AMOUNT_NEGATIVE");
  if (coverageUnits < 0n || coverageUnits > 1_000_000n) throw new Error("CAP05_RECEIPT_COVERAGE_OUT_OF_RANGE");
  return formatFixedDecimalV1(
    multiplyFixedUnitsV1(amountUnits, WATER_AMOUNT_SCALE_V1, coverageUnits, WATER_AMOUNT_SCALE_V1, WATER_AMOUNT_SCALE_V1),
    WATER_AMOUNT_SCALE_V1,
  );
}

export function mapCap05ReceiptExecutionStatusV1(value: Cap05ReceiptExecutionStatusSourceV1): Cap05ExecutionStatusV1 {
  switch (value) {
    case "FULL":
    case "EXECUTED":
      return "EXECUTED";
    case "PARTIAL":
    case "PARTIALLY_EXECUTED":
      return "PARTIALLY_EXECUTED";
    case "UNKNOWN":
    case "EXECUTION_UNCERTAIN":
      return "EXECUTION_UNCERTAIN";
    case "NONE":
    case "NOT_EXECUTED":
      return "NOT_EXECUTED";
    default:
      throw new Error("CAP05_RECEIPT_EXECUTION_STATUS_UNSUPPORTED");
  }
}

export function mapCap05ReceiptValidationStatusV1(value: Cap05ReceiptValidationStatusSourceV1): Cap05ValidationStatusV1 {
  switch (value) {
    case "PASSED":
    case "VALIDATED":
      return "VALIDATED";
    case "PASSED_WITH_LIMITATIONS":
    case "VALIDATED_WITH_LIMITATIONS":
      return "VALIDATED_WITH_LIMITATIONS";
    case "FAILED":
    case "REJECTED":
      return "REJECTED";
    case "PENDING":
    case "NOT_YET_VALIDATED":
      return "NOT_YET_VALIDATED";
    default:
      throw new Error("CAP05_RECEIPT_VALIDATION_STATUS_UNSUPPORTED");
  }
}

export function validateAndNormalizeCap05ExecutionReceiptEvidenceV1(
  record: Cap05ExecutionReceiptEvidenceV1,
  scope: ContinuationScopeV1,
): Cap05NormalizedExecutionReceiptV1 {
  if (record.record_type !== CAP05_EXECUTION_RECEIPT_RECORD_TYPE_V1) throw new Error("CAP05_RECEIPT_RECORD_TYPE_MISMATCH");
  if (record.action_lifecycle_class !== "EXECUTION_RECEIPT") throw new Error("CAP05_RECEIPT_LIFECYCLE_CLASS_MISMATCH");
  assertScopeV1(scope, record, "CAP05_RECEIPT_SCOPE_MISMATCH");
  assertScopeV1(scope, record.canonical_payload.target_scope, "CAP05_RECEIPT_TARGET_SCOPE_MISMATCH");
  requiredStringV1(record.dataset_id, "CAP05_RECEIPT_DATASET_REQUIRED");
  requiredStringV1(record.source_record_id, "CAP05_RECEIPT_SOURCE_RECORD_ID_REQUIRED");
  requiredStringV1(record.source_record_hash, "CAP05_RECEIPT_SOURCE_RECORD_HASH_REQUIRED");
  assertCap05ReplayEvidenceSourceRecordHashV1(record as unknown as Record<string, unknown>);
  requiredStringV1(record.evidence_identity_key, "CAP05_RECEIPT_EVIDENCE_IDENTITY_REQUIRED");
  requiredStringV1(record.idempotency_key, "CAP05_RECEIPT_IDEMPOTENCY_KEY_REQUIRED");
  requiredStringV1(record.binding_id, "CAP05_RECEIPT_BINDING_ID_REQUIRED");
  requiredStringV1(record.origin_source_id, "CAP05_RECEIPT_ORIGIN_SOURCE_REQUIRED");
  if (record.origin_source_kind !== "CONTROLLED_REPLAY_DATASET") throw new Error("CAP05_RECEIPT_SOURCE_KIND_FORBIDDEN");
  if (record.ingress_adapter_id !== "canonical_replay_evidence_ingress_v1" || record.ingress_adapter_version !== 1) {
    throw new Error("CAP05_RECEIPT_INGRESS_ADAPTER_MISMATCH");
  }
  if (record.epistemic_class !== "OBSERVED") throw new Error("CAP05_RECEIPT_EPISTEMIC_CLASS_MISMATCH");
  if (record.quality?.status !== "PASS") throw new Error("CAP05_RECEIPT_STRUCTURAL_QUALITY_PASS_REQUIRED");
  if (semanticHashV1(record.source_payload) !== semanticHashV1(record.canonical_payload)) {
    throw new Error("CAP05_RECEIPT_SOURCE_CANONICAL_PAYLOAD_DIVERGENCE");
  }

  const payload = record.canonical_payload;
  if (payload.unit !== "mm") throw new Error("CAP05_RECEIPT_DEPTH_MM_ONLY_NO_VOLUME_CONVERSION");
  requiredStringV1(payload.approved_plan_ref, "CAP05_RECEIPT_PLAN_REF_REQUIRED");
  requiredStringV1(payload.approved_plan_hash, "CAP05_RECEIPT_PLAN_HASH_REQUIRED");
  requiredStringV1(payload.event_id, "CAP05_RECEIPT_EVENT_ID_REQUIRED");
  if (!(["PASS", "LIMITED", "FAIL"] as const).includes(payload.source_quality)) throw new Error("CAP05_RECEIPT_SOURCE_QUALITY_INVALID");
  if (typeof payload.eligible_for_state_input !== "boolean") throw new Error("CAP05_RECEIPT_ELIGIBILITY_REQUIRED");

  const dispatchRef = payload.external_dispatch_ref ?? null;
  const dispatchHash = payload.external_dispatch_hash ?? null;
  if (Boolean(dispatchRef) !== Boolean(dispatchHash)) throw new Error("CAP05_RECEIPT_DISPATCH_IDENTITY_PAIR_REQUIRED");
  if (dispatchRef) requiredStringV1(dispatchRef, "CAP05_RECEIPT_DISPATCH_REF_REQUIRED");
  if (dispatchHash) requiredStringV1(dispatchHash, "CAP05_RECEIPT_DISPATCH_HASH_REQUIRED");

  const executionStart = canonicalInstantV1(record.role_time.execution_start, "CAP05_RECEIPT_EXECUTION_START_INVALID");
  const executionEnd = canonicalInstantV1(record.role_time.execution_end, "CAP05_RECEIPT_EXECUTION_END_INVALID");
  const ingestedAt = canonicalInstantV1(record.role_time.ingested_at, "CAP05_RECEIPT_INGESTED_AT_INVALID");
  const availableAt = canonicalInstantV1(record.available_to_runtime_at, "CAP05_RECEIPT_AVAILABLE_AT_INVALID");
  if (record.role_time.available_to_runtime_at !== availableAt) throw new Error("CAP05_RECEIPT_ROLE_AVAILABLE_AT_MISMATCH");
  if (executionStart > executionEnd || executionEnd > ingestedAt || ingestedAt > availableAt) {
    throw new Error("CAP05_RECEIPT_ROLE_TIME_ORDER_INVALID");
  }
  if (executionStart.slice(0, 13) !== executionEnd.slice(0, 13)) throw new Error("CAP05_RECEIPT_CROSS_HOUR_EXECUTION_FORBIDDEN");

  const actualAmount = decimalSixV1(payload.actual_amount_mm, "CAP05_RECEIPT_AMOUNT_INVALID");
  const coverage = decimalSixV1(payload.spatial_coverage_fraction, "CAP05_RECEIPT_COVERAGE_INVALID");
  const targetEquivalent = decimalSixV1(payload.target_scope_equivalent_irrigation_mm, "CAP05_RECEIPT_TARGET_EQUIVALENT_INVALID");
  if (computeCoveredAmountV1(actualAmount, coverage) !== targetEquivalent) {
    throw new Error("CAP05_RECEIPT_TARGET_EQUIVALENT_MISMATCH");
  }

  const executionStatus = mapCap05ReceiptExecutionStatusV1(payload.execution_status);
  const validationStatus = mapCap05ReceiptValidationStatusV1(payload.validation_status);
  const eligible = payload.eligible_for_state_input
    && (executionStatus === "EXECUTED" || executionStatus === "PARTIALLY_EXECUTED")
    && (validationStatus === "VALIDATED" || validationStatus === "VALIDATED_WITH_LIMITATIONS")
    && payload.source_quality !== "FAIL";

  return {
    evidence: structuredClone(record),
    execution_status: executionStatus,
    validation_status: validationStatus,
    source_quality: payload.source_quality,
    eligible_for_state_input: eligible,
    actual_amount_mm: actualAmount,
    spatial_coverage_fraction: coverage,
    target_scope_equivalent_irrigation_mm: targetEquivalent,
    execution_start: executionStart,
    execution_end: executionEnd,
    ingested_at: ingestedAt,
    available_to_runtime_at: availableAt,
    dispatch_ref: dispatchRef,
    dispatch_hash: dispatchHash,
  };
}
