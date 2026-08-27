import {
  decisionEligibilityCriterionAssessmentV1Schema,
  type DecisionEligibilityCriterionV1,
  type DecisionEligibilityCriterionStatusV1,
} from "../../contracts/decision_eligibility_v1.js";
import type { Stage1FormalTriggerGateV1 } from "./stage1_action_boundary_v1.js";

/**
 * B-07b compatibility adapter only.
 *
 * Stage-1 formal-trigger status is a grandfathered precursor. It does not
 * cover the complete Decision Eligibility factor set and therefore cannot
 * directly declare PASS / DEGRADED / NEED_EVIDENCE / HUMAN_REVIEW / BLOCK.
 *
 * This adapter emits precursor classification plus zero or more canonical
 * criterion assessments. It never instantiates DecisionEligibilityDecisionV1.
 */

export type Stage1EligibilityPrecursorClassificationV1 =
  | "FORMAL_TRIGGER_SUPPORTED"
  | "FORMAL_TRIGGER_EVIDENCE_GAP"
  | "NO_FORMAL_TRIGGER_SIGNAL";

export type Stage1EligibilityCriterionAssessmentV1 = {
  criterion: DecisionEligibilityCriterionV1;
  status: DecisionEligibilityCriterionStatusV1;
  reason_codes: string[];
  support_refs: string[];
};

export type Stage1EligibilityPrecursorProjectionV1 = {
  schema_version: "stage1_eligibility_precursor_projection_v1";
  candidate_ref: string;
  source_ref: string;
  source_status: "ELIGIBLE" | "NEEDS_EVIDENCE" | "NOT_ELIGIBLE";
  classification: Stage1EligibilityPrecursorClassificationV1;
  criterion_assessments: Stage1EligibilityCriterionAssessmentV1[];
  reason_codes: string[];
  limitations: string[];
  direct_verdict_authority: "NONE";
};

export type Stage1EligibilityPrecursorProjectionContextV1 = {
  candidate_ref: string;
  source_ref: string;
  canonical_evidence_qualification_refs: string[];
};

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function uniqueText(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return Array.from(new Set(values.map(text).filter(Boolean)));
}

function criterion(
  status: DecisionEligibilityCriterionStatusV1,
  reasonCodes: string[],
  supportRefs: string[],
): Stage1EligibilityCriterionAssessmentV1 {
  return decisionEligibilityCriterionAssessmentV1Schema.parse({
    criterion: "QUALIFIED_EVIDENCE",
    status,
    reason_codes: reasonCodes,
    support_refs: supportRefs,
  });
}

export function projectStage1FormalTriggerEligibilityPrecursorV1(
  gateValue: Stage1FormalTriggerGateV1 | Record<string, unknown>,
  context: Stage1EligibilityPrecursorProjectionContextV1,
): Stage1EligibilityPrecursorProjectionV1 {
  const candidateRef = text(context.candidate_ref);
  const sourceRef = text(context.source_ref);
  if (!candidateRef) throw new Error("B07B_CANDIDATE_REF_REQUIRED");
  if (!sourceRef) throw new Error("B07B_SOURCE_REF_REQUIRED");

  const gate = gateValue && typeof gateValue === "object"
    ? gateValue as Record<string, unknown>
    : {};
  const status = text(gate.status).toUpperCase();
  const reasonCodes = uniqueText(gate.reason_codes);
  const supportRefs = uniqueText(context.canonical_evidence_qualification_refs);

  if (status === "ELIGIBLE") {
    if (reasonCodes.length > 0) {
      throw new Error("B07B_ELIGIBLE_WITH_REASON_CODES_INVALID");
    }
    return {
      schema_version: "stage1_eligibility_precursor_projection_v1",
      candidate_ref: candidateRef,
      source_ref: sourceRef,
      source_status: "ELIGIBLE",
      classification: "FORMAL_TRIGGER_SUPPORTED",
      criterion_assessments: [
        criterion("SATISFIED", [], supportRefs),
      ],
      reason_codes: [],
      limitations: [
        "STAGE1_PRECURSOR_HAS_NO_FINAL_ELIGIBILITY_VERDICT_AUTHORITY",
        "STAGE1_ELIGIBLE_DOES_NOT_MEAN_DECISION_ELIGIBILITY_PASS",
        "STAGE1_FORMAL_TRIGGER_DOES_NOT_COVER_ALL_ELIGIBILITY_FACTORS",
      ],
      direct_verdict_authority: "NONE",
    };
  }

  if (status === "NEEDS_EVIDENCE") {
    if (reasonCodes.length === 0) {
      throw new Error("B07B_NEEDS_EVIDENCE_REASON_CODES_REQUIRED");
    }
    return {
      schema_version: "stage1_eligibility_precursor_projection_v1",
      candidate_ref: candidateRef,
      source_ref: sourceRef,
      source_status: "NEEDS_EVIDENCE",
      classification: "FORMAL_TRIGGER_EVIDENCE_GAP",
      criterion_assessments: [
        criterion("MISSING", reasonCodes, supportRefs),
      ],
      reason_codes: reasonCodes,
      limitations: [
        "STAGE1_PRECURSOR_HAS_NO_FINAL_ELIGIBILITY_VERDICT_AUTHORITY",
        "STAGE1_NEEDS_EVIDENCE_MAPS_TO_CRITERION_ONLY",
        "MISSING_CRITERION_MEANS_REQUIRED_FORMAL_TRIGGER_SUPPORT_INCOMPLETE",
        "FINAL_ACTION_VERDICT_REQUIRES_INDEPENDENT_SUPPORT_AND_OTHER_ELIGIBILITY_FACTORS",
      ],
      direct_verdict_authority: "NONE",
    };
  }

  if (status === "NOT_ELIGIBLE") {
    if (!reasonCodes.includes("NO_FORMAL_STAGE1_SIGNAL")) {
      throw new Error("B07B_NOT_ELIGIBLE_FORMAL_SIGNAL_REASON_REQUIRED");
    }
    return {
      schema_version: "stage1_eligibility_precursor_projection_v1",
      candidate_ref: candidateRef,
      source_ref: sourceRef,
      source_status: "NOT_ELIGIBLE",
      classification: "NO_FORMAL_TRIGGER_SIGNAL",
      criterion_assessments: [],
      reason_codes: reasonCodes,
      limitations: [
        "STAGE1_PRECURSOR_HAS_NO_FINAL_ELIGIBILITY_VERDICT_AUTHORITY",
        "STAGE1_NOT_ELIGIBLE_DOES_NOT_MEAN_DECISION_ELIGIBILITY_BLOCK",
        "NO_FORMAL_TRIGGER_SIGNAL_IS_NOT_A_COMPLETE_ACTION_ELIGIBILITY_ASSESSMENT",
      ],
      direct_verdict_authority: "NONE",
    };
  }

  throw new Error("B07B_UNKNOWN_STAGE1_GATE_STATUS:" + (status || "MISSING"));
}
