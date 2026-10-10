import {
  decisionEligibilityCriterionAssessmentV1Schema,
  type DecisionEligibilityCriterionV1,
  type DecisionEligibilityCriterionStatusV1,
} from "../../contracts/decision_eligibility_v1.js";

/**
 * B-07c compatibility adapter only.
 *
 * Agronomy Judge V2 mixes irrigation requirement calculation semantics and
 * an Evidence Judge override. It is a grandfathered eligibility precursor,
 * not final action-level Decision Eligibility authority.
 *
 * This adapter supports only IRRIGATE candidates and emits criterion-level
 * compatibility semantics. It never instantiates DecisionEligibilityDecisionV1.
 */

export type AgronomyJudgeEligibilityPrecursorClassificationV1 =
  | "IRRIGATION_REQUIREMENT_PRESENT"
  | "IRRIGATION_REQUIREMENT_ABSENT"
  | "AGRONOMY_EVIDENCE_GAP";

export type AgronomyJudgeEligibilityCriterionAssessmentV1 = {
  criterion: DecisionEligibilityCriterionV1;
  status: DecisionEligibilityCriterionStatusV1;
  reason_codes: string[];
  support_refs: string[];
};

export type AgronomyJudgeEligibilityPrecursorProjectionV1 = {
  schema_version: "agronomy_judge_eligibility_precursor_projection_v1";
  candidate_ref: string;
  candidate_action_type: "IRRIGATE";
  source_ref: string;
  source_verdict: "WATER_DEFICIT" | "PASS" | "BLOCKED";
  classification: AgronomyJudgeEligibilityPrecursorClassificationV1;
  criterion_assessments: AgronomyJudgeEligibilityCriterionAssessmentV1[];
  reason_codes: string[];
  limitations: string[];
  direct_verdict_authority: "NONE";
};

export type AgronomyJudgeEligibilityPrecursorProjectionContextV1 = {
  candidate_ref: string;
  candidate_action_type: string;
  source_ref: string;
  canonical_evidence_qualification_refs: string[];
  calculation_result_refs: string[];
};

const EVIDENCE_BLOCKING_VERDICTS = new Set([
  "DEVICE_OFFLINE",
  "INSUFFICIENT_EVIDENCE",
  "STALE_DATA",
]);

const DOWNSTREAM_AUTHORITY_KEYS = [
  "approval_request_id",
  "approval_decision_id",
  "operation_plan_id",
  "task_id",
  "act_task_id",
  "dispatch_id",
  "receipt_id",
  "receipt_fact_id",
  "as_executed_id",
  "as_applied_id",
] as const;

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function uniqueText(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return Array.from(new Set(values.map(text).filter(Boolean)));
}

function hasAuthorityValue(value: unknown): boolean {
  if (value == null || value === false || value === "") return false;
  return true;
}

function assertNoDownstreamAuthority(source: Record<string, unknown>): void {
  for (const key of DOWNSTREAM_AUTHORITY_KEYS) {
    if (hasAuthorityValue(source[key])) {
      throw new Error("B07C_SOURCE_ALREADY_CARRIES_DOWNSTREAM_AUTHORITY:" + key);
    }
  }
}

function criterion(
  criterionName: DecisionEligibilityCriterionV1,
  status: DecisionEligibilityCriterionStatusV1,
  reasonCodes: string[],
  supportRefs: string[],
): AgronomyJudgeEligibilityCriterionAssessmentV1 {
  return decisionEligibilityCriterionAssessmentV1Schema.parse({
    criterion: criterionName,
    status,
    reason_codes: reasonCodes,
    support_refs: supportRefs,
  });
}

export function projectAgronomyJudgeEligibilityPrecursorV1(
  sourceValue: Record<string, unknown>,
  context: AgronomyJudgeEligibilityPrecursorProjectionContextV1,
): AgronomyJudgeEligibilityPrecursorProjectionV1 {
  const candidateRef = text(context.candidate_ref);
  const sourceRef = text(context.source_ref);
  const candidateActionType = text(context.candidate_action_type).toUpperCase();

  if (!candidateRef) throw new Error("B07C_CANDIDATE_REF_REQUIRED");
  if (!sourceRef) throw new Error("B07C_SOURCE_REF_REQUIRED");
  if (candidateActionType !== "IRRIGATE") {
    throw new Error("B07C_ONLY_IRRIGATE_CANDIDATE_SUPPORTED:" + (candidateActionType || "MISSING"));
  }

  const source = record(sourceValue);
  assertNoDownstreamAuthority(source);

  if (text(source.judge_kind).toUpperCase() !== "AGRONOMY") {
    throw new Error("B07C_AGRONOMY_JUDGE_SOURCE_REQUIRED");
  }

  const verdict = text(source.verdict).toUpperCase();
  const reasons = uniqueText(source.reasons);
  const inputs = record(source.inputs);
  const canonicalEvidenceRefs = uniqueText(context.canonical_evidence_qualification_refs);
  const calculationRefs = uniqueText(context.calculation_result_refs);

  if (verdict === "BLOCKED") {
    const evidenceJudgeVerdict = text(inputs.evidence_judge_verdict).toUpperCase();

    if (!reasons.includes("blocked_by_evidence_judge")) {
      throw new Error("B07C_BLOCKED_EVIDENCE_REASON_REQUIRED");
    }
    if (!EVIDENCE_BLOCKING_VERDICTS.has(evidenceJudgeVerdict)) {
      throw new Error("B07C_BLOCKED_EVIDENCE_VERDICT_NOT_RECOGNIZED:" + (evidenceJudgeVerdict || "MISSING"));
    }

    return {
      schema_version: "agronomy_judge_eligibility_precursor_projection_v1",
      candidate_ref: candidateRef,
      candidate_action_type: "IRRIGATE",
      source_ref: sourceRef,
      source_verdict: "BLOCKED",
      classification: "AGRONOMY_EVIDENCE_GAP",
      criterion_assessments: [
        criterion(
          "QUALIFIED_EVIDENCE",
          "MISSING",
          ["AGRONOMY_JUDGE_EVIDENCE_OVERRIDE", evidenceJudgeVerdict],
          canonicalEvidenceRefs,
        ),
      ],
      reason_codes: reasons,
      limitations: [
        "AGRONOMY_JUDGE_BLOCKED_DOES_NOT_MEAN_DECISION_ELIGIBILITY_BLOCK",
        "LEGACY_EVIDENCE_JUDGE_OVERRIDE_MAPS_TO_CRITERION_ONLY",
        "LEGACY_JUDGE_EVIDENCE_REFS_NOT_PROMOTED_TO_CANONICAL_QUALIFICATION",
        "AGRONOMY_JUDGE_PRECURSOR_HAS_NO_FINAL_ELIGIBILITY_VERDICT_AUTHORITY",
      ],
      direct_verdict_authority: "NONE",
    };
  }

  if (verdict === "WATER_DEFICIT") {
    if (!reasons.includes("irrigation_requirement_detected")) {
      throw new Error("B07C_WATER_DEFICIT_REQUIREMENT_REASON_REQUIRED");
    }
    if (calculationRefs.length === 0) {
      throw new Error("B07C_CANONICAL_CALCULATION_RESULT_REQUIRED");
    }

    return {
      schema_version: "agronomy_judge_eligibility_precursor_projection_v1",
      candidate_ref: candidateRef,
      candidate_action_type: "IRRIGATE",
      source_ref: sourceRef,
      source_verdict: "WATER_DEFICIT",
      classification: "IRRIGATION_REQUIREMENT_PRESENT",
      criterion_assessments: [
        criterion(
          "STATE",
          "SATISFIED",
          ["CANONICAL_CALCULATION_SUPPORTS_IRRIGATION_REQUIREMENT"],
          calculationRefs,
        ),
      ],
      reason_codes: reasons,
      limitations: [
        "AGRONOMY_JUDGE_WATER_DEFICIT_DOES_NOT_MEAN_DECISION_ELIGIBILITY_PASS",
        "LEGACY_JUDGE_CALCULATION_OUTPUTS_NOT_PROMOTED_TO_CALCULATION_RESULT",
        "LEGACY_CROP_STAGE_NOT_PROMOTED_TO_CANONICAL_STAGE_AUTHORITY",
        "AGRONOMY_JUDGE_PRECURSOR_HAS_NO_FINAL_ELIGIBILITY_VERDICT_AUTHORITY",
      ],
      direct_verdict_authority: "NONE",
    };
  }

  if (verdict === "PASS") {
    if (!reasons.includes("no_irrigation_requirement")) {
      throw new Error("B07C_PASS_NO_REQUIREMENT_REASON_REQUIRED");
    }
    if (calculationRefs.length === 0) {
      throw new Error("B07C_CANONICAL_CALCULATION_RESULT_REQUIRED");
    }

    return {
      schema_version: "agronomy_judge_eligibility_precursor_projection_v1",
      candidate_ref: candidateRef,
      candidate_action_type: "IRRIGATE",
      source_ref: sourceRef,
      source_verdict: "PASS",
      classification: "IRRIGATION_REQUIREMENT_ABSENT",
      criterion_assessments: [
        criterion(
          "STATE",
          "VIOLATED",
          ["CANONICAL_CALCULATION_DOES_NOT_SUPPORT_IRRIGATION_REQUIREMENT"],
          calculationRefs,
        ),
      ],
      reason_codes: reasons,
      limitations: [
        "AGRONOMY_JUDGE_PASS_DOES_NOT_MEAN_DECISION_ELIGIBILITY_PASS",
        "STATE_VIOLATION_IS_CRITERION_ONLY_NOT_FINAL_BLOCK",
        "LEGACY_JUDGE_CALCULATION_OUTPUTS_NOT_PROMOTED_TO_CALCULATION_RESULT",
        "LEGACY_CROP_STAGE_NOT_PROMOTED_TO_CANONICAL_STAGE_AUTHORITY",
        "AGRONOMY_JUDGE_PRECURSOR_HAS_NO_FINAL_ELIGIBILITY_VERDICT_AUTHORITY",
      ],
      direct_verdict_authority: "NONE",
    };
  }

  throw new Error("B07C_UNKNOWN_AGRONOMY_JUDGE_VERDICT:" + (verdict || "MISSING"));
}
