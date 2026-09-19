import type { PrescriptionContractV1 } from "@geox/contracts";
import {
  candidateDecisionV1Schema,
  type CandidateDecisionV1,
} from "../../contracts/canonical_decision_v1.js";
import type { EvidenceScopeV1 } from "../../contracts/canonical_evidence_v1.js";

/**
 * B-06e compatibility adapter only.
 *
 * A legacy prescription is a rich action specification that can carry
 * approval/execution-adjacent metadata. This adapter projects only its
 * pre-approval action-spec semantics into CandidateDecisionV1.
 *
 * It does not submit approval, interpret READY_FOR_APPROVAL as approval,
 * create an OperationPlan/Task, or wire a runtime consumer.
 */

export type PrescriptionCandidateProjectionContextV1 = {
  candidate_id: string;
  source_ref: string;
  scope: EvidenceScopeV1;
  evidence_qualification_refs: string[];
  context_snapshot_ref?: string | null;
  crop_stage_state_ref?: string | null;
  calculation_result_refs?: string[];
  interpretation_refs?: string[];
  legacy_source_refs?: string[];
  created_at: string;
  decision_time?: string | null;
};

const CANDIDATE_COMPATIBLE_STATUSES = new Set(["DRAFT", "READY_FOR_APPROVAL"]);

const DOWNSTREAM_ID_KEYS = [
  "approval_request_id",
  "approval_decision_id",
  "operation_plan_id",
  "act_task_id",
  "task_id",
  "dispatch_id",
  "receipt_fact_id",
] as const;

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function uniqueText(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return Array.from(new Set(values.map(text).filter(Boolean)));
}

function optionalRef(value: string | null | undefined): string | null {
  const normalized = text(value);
  return normalized || null;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function candidateActionType(operationTypeValue: unknown): string {
  const operationType = text(operationTypeValue).toUpperCase();
  if (operationType === "IRRIGATION") return "IRRIGATE";
  if (operationType === "FERTILIZATION") return "FERTILIZE";
  if (operationType === "SPRAYING") return "SPRAY";
  if (operationType === "INSPECTION") return "INSPECT";
  throw new Error("B06E_UNSUPPORTED_PRESCRIPTION_OPERATION_TYPE:" + (operationType || "MISSING"));
}

function assertCandidateCompatibleStatus(value: unknown): "DRAFT" | "READY_FOR_APPROVAL" {
  const status = text(value).toUpperCase();
  if (!CANDIDATE_COMPATIBLE_STATUSES.has(status)) {
    throw new Error("B06E_PRESCRIPTION_STATUS_NOT_PRE_APPROVAL:" + (status || "MISSING"));
  }
  return status as "DRAFT" | "READY_FOR_APPROVAL";
}

function assertNoDownstreamIdentity(source: Record<string, unknown>): void {
  for (const key of DOWNSTREAM_ID_KEYS) {
    if (text(source[key])) {
      throw new Error("B06E_PRESCRIPTION_ALREADY_CARRIES_DOWNSTREAM_ID:" + key);
    }
  }
}

function assertScopeCompatibility(source: Record<string, unknown>, scope: EvidenceScopeV1): void {
  for (const key of ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"] as const) {
    const sourceValue = text(source[key]);
    const canonicalValue = text(scope[key]);

    if (sourceValue && sourceValue !== canonicalValue) {
      throw new Error("B06E_PRESCRIPTION_SCOPE_MISMATCH:" + key);
    }

    if (["tenant_id", "project_id", "group_id", "field_id"].includes(key) && !sourceValue) {
      throw new Error("B06E_PRESCRIPTION_REQUIRED_SCOPE_MISSING:" + key);
    }
  }
}

function finiteNumberOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function actionParameters(
  source: Record<string, unknown>,
  status: "DRAFT" | "READY_FOR_APPROVAL",
): {
  parameters: Record<string, string | number | boolean | null>;
  limitations: string[];
} {
  const amount = record(source.operation_amount);
  const parameters: Record<string, string | number | boolean | null> = {};
  const limitations: string[] = [];

  const numericAmount = finiteNumberOrNull(amount.amount);
  const unit = text(amount.unit);
  const rate = finiteNumberOrNull(amount.rate);
  const rateUnit = text(amount.rate_unit);

  if (numericAmount != null && numericAmount > 0 && unit && unit.toLowerCase() !== "pending") {
    parameters.amount = numericAmount;
    parameters.unit = unit;
  } else {
    limitations.push("PRESCRIPTION_AMOUNT_INCOMPLETE_NOT_PROMOTED");
  }

  if (rate != null) parameters.rate = rate;
  if (rateUnit) parameters.rate_unit = rateUnit;

  if (status === "DRAFT") {
    limitations.push("PRESCRIPTION_DRAFT_INCOMPLETE_ACTION_SPEC");
  }

  if (Object.keys(record(amount.parameters)).length > 0) {
    limitations.push("LEGACY_NESTED_OPERATION_PARAMETERS_NOT_PROMOTED");
  }

  return { parameters, limitations };
}

export function projectPrescriptionActionSpecCandidateV1(
  sourceValue: PrescriptionContractV1 | Record<string, unknown>,
  context: PrescriptionCandidateProjectionContextV1,
): CandidateDecisionV1 {
  const source = record(sourceValue);
  const prescriptionId = text(source.prescription_id);
  if (!prescriptionId) {
    throw new Error("B06E_PRESCRIPTION_ID_REQUIRED");
  }

  assertScopeCompatibility(source, context.scope);
  assertNoDownstreamIdentity(source);

  const status = assertCandidateCompatibleStatus(source.status);
  const actionType = candidateActionType(source.operation_type);
  const approvalRequirement = record(source.approval_requirement);

  if (approvalRequirement.auto_execute_allowed === true) {
    throw new Error("B06E_PRESCRIPTION_AUTO_EXECUTE_CAPABILITY_FORBIDDEN");
  }

  const { parameters, limitations: parameterLimitations } = actionParameters(source, status);
  const legacyEvidenceRefs = uniqueText(source.evidence_refs);
  const recommendationId = text(source.recommendation_id);
  const skillTraceId = text(source.skill_trace_id);

  const limitations = [
    "B06E_PRESCRIPTION_ACTION_SPEC_COMPATIBILITY_PROJECTION",
    "PRESCRIPTION_STATUS_DOES_NOT_GRANT_APPROVAL",
    "PRESCRIPTION_TIMING_DEVICE_APPROVAL_ACCEPTANCE_METADATA_NOT_PROMOTED",
    "LEGACY_PRESCRIPTION_AMOUNT_IS_ACTION_SPEC_NOT_CALCULATION_RESULT",
    ...parameterLimitations,
  ];

  if (legacyEvidenceRefs.length > 0) {
    limitations.push("LEGACY_EVIDENCE_REFS_NOT_PROMOTED_TO_CANONICAL_QUALIFICATION");
  }

  if (approvalRequirement.required === true) {
    limitations.push("PRESCRIPTION_REQUIRES_APPROVAL_NOT_APPROVED");
  } else {
    limitations.push("PRESCRIPTION_APPROVAL_NOT_REQUIRED_STILL_HAS_NO_EXECUTION_AUTHORITY");
  }

  return candidateDecisionV1Schema.parse({
    schema_version: "candidate_decision_v1",
    candidate_id: context.candidate_id,
    scope: context.scope,
    source_ref: context.source_ref,
    source_class: "LEGACY_PRESCRIPTION_ACTION_SPEC",
    proposed_action: {
      action_type: actionType,
      target: {
        kind: "field",
        ref: text(context.scope.field_id),
      },
      parameters_hint: parameters,
      action_spec_ref: context.source_ref,
    },
    basis: {
      evidence_qualification_refs: uniqueText(context.evidence_qualification_refs),
      context_snapshot_ref: optionalRef(context.context_snapshot_ref),
      crop_stage_state_ref: optionalRef(context.crop_stage_state_ref),
      calculation_result_refs: uniqueText(context.calculation_result_refs),
      interpretation_refs: uniqueText(context.interpretation_refs),
      legacy_source_refs: uniqueText([
        context.source_ref,
        recommendationId ? "recommendation:" + recommendationId : "",
        skillTraceId ? "skill_trace:" + skillTraceId : "",
        ...legacyEvidenceRefs,
        ...(context.legacy_source_refs ?? []),
      ]),
    },
    confidence: null,
    reasons: [],
    limitations: uniqueText(limitations),
    decision_time: context.decision_time ?? null,
    created_at: context.created_at,
    authority_state: "CANDIDATE_ONLY",
  });
}
