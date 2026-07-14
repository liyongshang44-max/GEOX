// apps/server/src/domain/twin_runtime/approved_plan_binding_v1.ts
// Purpose: validate the MCFT-CAP-05 separation and exact linkage of canonical Human Decision, external Approval Assertion Evidence and Approved Plan Snapshot Evidence.
// Boundary: pure deterministic contract logic only; no database, canonical append, approval exercise, dispatch, State mutation, clock, filesystem, environment or network.

import { semanticHashV1 } from "./canonical_identity_v1.js";
import type { Cap05DecisionEnvelopeV1 } from "./feedback_canonical_contracts_v1.js";
import type { ContinuationScopeV1 } from "./continuation_operation_identity_v1.js";
import {
  WATER_AMOUNT_SCALE_V1,
  formatFixedDecimalV1,
  parseFixedDecimalV1,
} from "../soil_water/fixed_point_water_decimal_v1.js";

export const CAP05_APPROVAL_ASSERTION_RECORD_TYPE_V1 = "approval_assertion_evidence_v1" as const;
export const CAP05_APPROVED_PLAN_RECORD_TYPE_V1 = "approved_irrigation_plan_snapshot_v1" as const;
export const CAP05_APPROVAL_SEMANTICS_V1 = "EXTERNAL_OR_HUMAN_EVIDENCE_ASSERTION" as const;
export const CAP05_PLAN_BINDING_POLICY_ID_V1 = "DECISION_ASSERTION_PLAN_EXACT_LINKAGE_V1" as const;
export const CAP05_PLAN_SUPERSESSION_POLICY_ID_V1 = "EXPLICIT_PLAN_REF_HASH_SUPERSESSION_V1" as const;
export const CAP05_PLAN_DISPATCH_DISPOSITION_V1 = "NOT_OBSERVED" as const;

export type Cap05EvidenceQualityV1 = { status: "PASS" | "LIMITED" | "FAIL" };

export type Cap05ApprovalAssertionEvidenceV1 = {
  record_type: typeof CAP05_APPROVAL_ASSERTION_RECORD_TYPE_V1;
  source_record_id: string;
  source_record_hash: string;
  origin_source_kind: "CONTROLLED_REPLAY_DATASET";
  binding_id: string;
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  season_id: string;
  zone_id: string;
  available_to_runtime_at: string;
  quality: Cap05EvidenceQualityV1;
  canonical_payload: {
    approval_semantics: typeof CAP05_APPROVAL_SEMANTICS_V1;
    approval_status: "APPROVED";
    approver_class: "HUMAN";
    approver_ref: string;
    decision_request_ref: string;
    decision_request_hash: string;
    selected_option_ref: string;
    selected_option_hash: string;
    geox_approval_authority_exercised: false;
    geox_approval_request_created: false;
  };
  role_time: {
    approved_at: string;
    asserted_at: string;
    available_to_runtime_at: string;
    ingested_at: string;
  };
};

export type Cap05ApprovedPlanEvidenceV1 = {
  record_type: typeof CAP05_APPROVED_PLAN_RECORD_TYPE_V1;
  source_record_id: string;
  source_record_hash: string;
  origin_source_kind: "CONTROLLED_REPLAY_DATASET";
  binding_id: string;
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  season_id: string;
  zone_id: string;
  available_to_runtime_at: string;
  quality: Cap05EvidenceQualityV1;
  canonical_payload: {
    active_for_decision: boolean;
    plan_status: "APPROVED";
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
    supersedes_plan_ref?: string | null;
    supersedes_plan_hash?: string | null;
  };
  role_time: {
    created_at: string;
    approved_at: string;
    available_to_runtime_at: string;
    ingested_at: string;
    plan_effective_from: string;
    plan_effective_to: string;
  };
};

export type Cap05ValidatedApprovedPlanBindingV1 = {
  policy_id: typeof CAP05_PLAN_BINDING_POLICY_ID_V1;
  supersession_policy_id: typeof CAP05_PLAN_SUPERSESSION_POLICY_ID_V1;
  decision_ref: string;
  decision_hash: string;
  decision_request_ref: string;
  decision_request_hash: string;
  approval_assertion_ref: string;
  approval_assertion_hash: string;
  approved_plan_ref: string;
  approved_plan_hash: string;
  selected_option_ref: string;
  selected_option_hash: string;
  scenario_amount_mm: string;
  approved_amount_mm: string;
  amount_difference_mm: string;
  amount_difference_reason_codes: string[];
  validity: {
    effective_from: string;
    effective_to: string;
  };
  dispatch_disposition: typeof CAP05_PLAN_DISPATCH_DISPOSITION_V1;
  supersession: {
    status: "NO_PREDECESSOR" | "SUPERSEDES_ACTIVE_PLAN";
    supersedes_plan_ref: string | null;
    supersedes_plan_hash: string | null;
  };
  geox_approval_authority_exercised: false;
  geox_approval_request_created: false;
  projection_is_canonical_history: false;
  projection_is_approval_authority: false;
  determinism_hash: string;
};

function requiredStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

function optionalStringV1(value: unknown, code: string): string | null {
  if (value == null) return null;
  return requiredStringV1(value, code);
}

function canonicalInstantV1(value: unknown, code: string): string {
  const text = requiredStringV1(value, code);
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== text) throw new Error(code);
  return text;
}

function exactScopeV1(scope: ContinuationScopeV1, candidate: Record<string, unknown>, prefix: string): void {
  for (const field of ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"] as const) {
    if (candidate[field] !== scope[field]) throw new Error(`${prefix}_SCOPE_MISMATCH:${field}`);
  }
}

function amountUnitsV1(value: unknown, code: string): bigint {
  return parseFixedDecimalV1(typeof value === "number" ? value.toString() : value, WATER_AMOUNT_SCALE_V1, code);
}

function expectedScenarioAmountUnitsV1(decision: Cap05DecisionEnvelopeV1): bigint {
  if (decision.payload.selected_option_id === "NO_ACTION") return 0n;
  if (decision.payload.selected_option_id === "IRRIGATE_NOW_15MM") return 15_000_000n;
  if (decision.payload.selected_option_id === "IRRIGATE_NOW_25MM") return 25_000_000n;
  throw new Error("CAP05_PLAN_DECISION_OPTION_UNSUPPORTED");
}

function exactStringsV1(left: unknown, right: unknown, code: string): void {
  if (requiredStringV1(left, code) !== requiredStringV1(right, code)) throw new Error(code);
}

export function validateCap05ApprovedPlanBindingV1(input: {
  decision: Cap05DecisionEnvelopeV1;
  approval_assertion: Cap05ApprovalAssertionEvidenceV1;
  approved_plan: Cap05ApprovedPlanEvidenceV1;
  as_of: string;
  previous_active_plan?: Cap05ValidatedApprovedPlanBindingV1 | null;
}): Cap05ValidatedApprovedPlanBindingV1 {
  const { decision, approval_assertion: assertion, approved_plan: plan } = input;
  const asOf = canonicalInstantV1(input.as_of, "CAP05_PLAN_BINDING_AS_OF_INVALID");
  if (decision.object_type !== "twin_decision_record_v1") throw new Error("CAP05_PLAN_DECISION_TYPE_MISMATCH");
  if (assertion.record_type !== CAP05_APPROVAL_ASSERTION_RECORD_TYPE_V1) throw new Error("CAP05_APPROVAL_ASSERTION_TYPE_MISMATCH");
  if (plan.record_type !== CAP05_APPROVED_PLAN_RECORD_TYPE_V1) throw new Error("CAP05_APPROVED_PLAN_TYPE_MISMATCH");
  if (assertion.source_record_id === plan.source_record_id) throw new Error("CAP05_ASSERTION_PLAN_EVIDENCE_MUST_BE_DISTINCT");
  if (assertion.origin_source_kind !== "CONTROLLED_REPLAY_DATASET" || plan.origin_source_kind !== "CONTROLLED_REPLAY_DATASET") throw new Error("CAP05_PLAN_EVIDENCE_SOURCE_CLASS_FORBIDDEN");
  if (assertion.quality?.status !== "PASS" || plan.quality?.status !== "PASS") throw new Error("CAP05_PLAN_EVIDENCE_QUALITY_PASS_REQUIRED");

  const scope: ContinuationScopeV1 = {
    tenant_id: decision.tenant_id,
    project_id: decision.project_id,
    group_id: decision.group_id,
    field_id: decision.field_id,
    season_id: decision.season_id,
    zone_id: decision.zone_id,
  };
  exactScopeV1(scope, assertion as unknown as Record<string, unknown>, "CAP05_APPROVAL_ASSERTION");
  exactScopeV1(scope, plan as unknown as Record<string, unknown>, "CAP05_APPROVED_PLAN");
  exactScopeV1(scope, plan.canonical_payload.target_scope as unknown as Record<string, unknown>, "CAP05_APPROVED_PLAN_TARGET");

  const assertionPayload = assertion.canonical_payload;
  const planPayload = plan.canonical_payload;
  if (assertionPayload.approval_status !== "APPROVED" || assertionPayload.approval_semantics !== CAP05_APPROVAL_SEMANTICS_V1) throw new Error("CAP05_APPROVAL_ASSERTION_NOT_ACTIVE_APPROVED");
  if (assertionPayload.approver_class !== "HUMAN") throw new Error("CAP05_APPROVAL_ASSERTION_HUMAN_REQUIRED");
  if (assertionPayload.geox_approval_authority_exercised !== false || assertionPayload.geox_approval_request_created !== false) throw new Error("CAP05_GEOX_APPROVAL_AUTHORITY_FORBIDDEN");
  if (planPayload.plan_status !== "APPROVED" || planPayload.active_for_decision !== true) throw new Error("CAP05_APPROVED_PLAN_NOT_ACTIVE_APPROVED");

  exactStringsV1(assertionPayload.decision_request_ref, decision.payload.decision_request_evidence_ref, "CAP05_ASSERTION_DECISION_REQUEST_REF_MISMATCH");
  exactStringsV1(assertionPayload.decision_request_hash, decision.payload.decision_request_evidence_hash, "CAP05_ASSERTION_DECISION_REQUEST_HASH_MISMATCH");
  exactStringsV1(assertionPayload.selected_option_ref, decision.payload.selected_option_ref, "CAP05_ASSERTION_OPTION_REF_MISMATCH");
  exactStringsV1(assertionPayload.selected_option_hash, decision.payload.selected_option_hash, "CAP05_ASSERTION_OPTION_HASH_MISMATCH");
  exactStringsV1(planPayload.approval_assertion_ref, assertion.source_record_id, "CAP05_PLAN_ASSERTION_REF_MISMATCH");
  exactStringsV1(planPayload.approval_assertion_hash, assertion.source_record_hash, "CAP05_PLAN_ASSERTION_HASH_MISMATCH");
  exactStringsV1(planPayload.decision_request_ref, decision.payload.decision_request_evidence_ref, "CAP05_PLAN_DECISION_REQUEST_REF_MISMATCH");
  exactStringsV1(planPayload.decision_request_hash, decision.payload.decision_request_evidence_hash, "CAP05_PLAN_DECISION_REQUEST_HASH_MISMATCH");
  exactStringsV1(planPayload.selected_option_ref, decision.payload.selected_option_ref, "CAP05_PLAN_OPTION_REF_MISMATCH");
  exactStringsV1(planPayload.selected_option_hash, decision.payload.selected_option_hash, "CAP05_PLAN_OPTION_HASH_MISMATCH");

  const expectedScenarioUnits = expectedScenarioAmountUnitsV1(decision);
  const scenarioUnits = amountUnitsV1(planPayload.scenario_amount_mm, "CAP05_PLAN_SCENARIO_AMOUNT_INVALID");
  const approvedUnits = amountUnitsV1(planPayload.approved_amount_mm, "CAP05_PLAN_APPROVED_AMOUNT_INVALID");
  const differenceUnits = amountUnitsV1(planPayload.amount_difference_mm, "CAP05_PLAN_AMOUNT_DIFFERENCE_INVALID");
  if (scenarioUnits !== expectedScenarioUnits) throw new Error("CAP05_PLAN_SCENARIO_AMOUNT_OPTION_MISMATCH");
  if (approvedUnits < 0n || approvedUnits > scenarioUnits) throw new Error("CAP05_PLAN_APPROVED_AMOUNT_OUT_OF_RANGE");
  if (differenceUnits !== approvedUnits - scenarioUnits) throw new Error("CAP05_PLAN_AMOUNT_DIFFERENCE_MISMATCH");
  if (!Array.isArray(planPayload.amount_difference_reason_codes)) throw new Error("CAP05_PLAN_AMOUNT_REASON_CODES_REQUIRED");
  if (differenceUnits !== 0n && planPayload.amount_difference_reason_codes.length === 0) throw new Error("CAP05_PLAN_AMOUNT_DIFFERENCE_REASON_REQUIRED");
  if (planPayload.amount_difference_reason_codes.some((code) => typeof code !== "string" || !code.trim())) throw new Error("CAP05_PLAN_AMOUNT_REASON_CODE_INVALID");

  const assertionApprovedAt = canonicalInstantV1(assertion.role_time.approved_at, "CAP05_ASSERTION_APPROVED_AT_INVALID");
  const assertionAssertedAt = canonicalInstantV1(assertion.role_time.asserted_at, "CAP05_ASSERTION_ASSERTED_AT_INVALID");
  const assertionAvailableAt = canonicalInstantV1(assertion.available_to_runtime_at, "CAP05_ASSERTION_AVAILABLE_AT_INVALID");
  const planCreatedAt = canonicalInstantV1(plan.role_time.created_at, "CAP05_PLAN_CREATED_AT_INVALID");
  const planApprovedAt = canonicalInstantV1(plan.role_time.approved_at, "CAP05_PLAN_APPROVED_AT_INVALID");
  const planAvailableAt = canonicalInstantV1(plan.available_to_runtime_at, "CAP05_PLAN_AVAILABLE_AT_INVALID");
  const effectiveFrom = canonicalInstantV1(plan.role_time.plan_effective_from, "CAP05_PLAN_EFFECTIVE_FROM_INVALID");
  const effectiveTo = canonicalInstantV1(plan.role_time.plan_effective_to, "CAP05_PLAN_EFFECTIVE_TO_INVALID");
  if (assertionApprovedAt > assertionAssertedAt || assertionAssertedAt > assertionAvailableAt) throw new Error("CAP05_ASSERTION_TIME_ORDER_INVALID");
  if (planCreatedAt > planApprovedAt || planApprovedAt > planAvailableAt || planAvailableAt > effectiveTo) throw new Error("CAP05_PLAN_TIME_ORDER_INVALID");
  if (effectiveFrom >= effectiveTo) throw new Error("CAP05_PLAN_VALIDITY_WINDOW_INVALID");
  if (assertionAvailableAt > planApprovedAt) throw new Error("CAP05_PLAN_APPROVED_BEFORE_ASSERTION_AVAILABLE");
  if (assertionAvailableAt > asOf || planAvailableAt > asOf) throw new Error("CAP05_PLAN_EVIDENCE_NOT_AVAILABLE_AS_OF");

  const supersedesPlanRef = optionalStringV1(planPayload.supersedes_plan_ref, "CAP05_PLAN_SUPERSEDES_REF_INVALID");
  const supersedesPlanHash = optionalStringV1(planPayload.supersedes_plan_hash, "CAP05_PLAN_SUPERSEDES_HASH_INVALID");
  if ((supersedesPlanRef == null) !== (supersedesPlanHash == null)) throw new Error("CAP05_PLAN_SUPERSESSION_PAIR_REQUIRED");
  const previous = input.previous_active_plan ?? null;
  if (!supersedesPlanRef && previous) throw new Error("CAP05_PLAN_ACTIVE_PREDECESSOR_MUST_BE_SUPERSEDED");
  if (supersedesPlanRef) {
    if (!previous) throw new Error("CAP05_PLAN_SUPERSESSION_PREDECESSOR_NOT_FOUND");
    if (previous.approved_plan_ref !== supersedesPlanRef || previous.approved_plan_hash !== supersedesPlanHash) throw new Error("CAP05_PLAN_SUPERSESSION_PREDECESSOR_MISMATCH");
    if (previous.decision_ref !== decision.object_id || previous.decision_hash !== decision.determinism_hash) throw new Error("CAP05_PLAN_SUPERSESSION_DECISION_MISMATCH");
    if (previous.validity.effective_from > effectiveFrom) throw new Error("CAP05_PLAN_SUPERSESSION_TIME_REGRESSION");
  }

  const basis = {
    policy_id: CAP05_PLAN_BINDING_POLICY_ID_V1,
    supersession_policy_id: CAP05_PLAN_SUPERSESSION_POLICY_ID_V1,
    decision_ref: decision.object_id,
    decision_hash: decision.determinism_hash,
    decision_request_ref: decision.payload.decision_request_evidence_ref,
    decision_request_hash: decision.payload.decision_request_evidence_hash,
    approval_assertion_ref: assertion.source_record_id,
    approval_assertion_hash: assertion.source_record_hash,
    approved_plan_ref: plan.source_record_id,
    approved_plan_hash: plan.source_record_hash,
    selected_option_ref: decision.payload.selected_option_ref,
    selected_option_hash: decision.payload.selected_option_hash,
    scenario_amount_mm: formatFixedDecimalV1(scenarioUnits, WATER_AMOUNT_SCALE_V1),
    approved_amount_mm: formatFixedDecimalV1(approvedUnits, WATER_AMOUNT_SCALE_V1),
    amount_difference_mm: formatFixedDecimalV1(differenceUnits, WATER_AMOUNT_SCALE_V1),
    amount_difference_reason_codes: [...planPayload.amount_difference_reason_codes],
    validity: { effective_from: effectiveFrom, effective_to: effectiveTo },
    dispatch_disposition: CAP05_PLAN_DISPATCH_DISPOSITION_V1,
    supersession: {
      status: supersedesPlanRef ? "SUPERSEDES_ACTIVE_PLAN" as const : "NO_PREDECESSOR" as const,
      supersedes_plan_ref: supersedesPlanRef,
      supersedes_plan_hash: supersedesPlanHash,
    },
    geox_approval_authority_exercised: false as const,
    geox_approval_request_created: false as const,
    projection_is_canonical_history: false as const,
    projection_is_approval_authority: false as const,
  };
  return { ...basis, determinism_hash: semanticHashV1(basis) };
}
