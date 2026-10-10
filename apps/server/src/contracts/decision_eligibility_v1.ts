import { z } from "zod";

import { evidenceScopeV1Schema } from "./canonical_evidence_v1.js";

/**
 * B-07a contract vocabulary only.
 *
 * DecisionEligibilityDecisionV1 answers whether one CandidateDecision may
 * proceed toward Approval/production under the qualified decision-time inputs.
 *
 * It is not Evidence Qualification, Approval, OperationPlan, Task, Receipt,
 * Acceptance, or execution authority.
 *
 * B-07a creates no production eligibility producer.
 */

export const decisionEligibilityVerdictV1Schema = z.enum([
  "PASS",
  "DEGRADED",
  "NEED_EVIDENCE",
  "HUMAN_REVIEW",
  "BLOCK",
]);

export const decisionEligibilityLifecycleStateV1Schema = z.enum([
  "ACTIVE",
  "NOT_YET_ACTIVE",
  "EXPIRED",
  "UNKNOWN",
]);

export const decisionEligibilityCriterionV1Schema = z.enum([
  "QUALIFIED_EVIDENCE",
  "STATE",
  "FORECAST",
  "SCENARIO",
  "CONTEXT",
  "KNOWLEDGE_POLICY",
  "PERMISSION",
  "ACTION_WINDOW",
  "CONSEQUENCE",
  "REVERSIBILITY",
  "REMAINING_UNCERTAINTY",
  "INDEPENDENT_EVIDENCE_SUPPORT",
]);

export const decisionEligibilityCriterionStatusV1Schema = z.enum([
  "SATISFIED",
  "DEGRADED",
  "MISSING",
  "REVIEW_REQUIRED",
  "VIOLATED",
  "UNKNOWN",
]);

export const decisionEligibilityCriterionAssessmentV1Schema = z
  .object({
    criterion: decisionEligibilityCriterionV1Schema,
    status: decisionEligibilityCriterionStatusV1Schema,
    reason_codes: z.array(z.string().min(1)),
    support_refs: z.array(z.string().min(1)),
  })
  .strict();

export const decisionEligibilityInputRefsV1Schema = z
  .object({
    candidate_ref: z.string().min(1),
    evidence_qualification_refs: z.array(z.string().min(1)),
    context_snapshot_ref: z.string().min(1).nullable(),
    crop_stage_state_ref: z.string().min(1).nullable(),
    state_refs: z.array(z.string().min(1)),
    forecast_refs: z.array(z.string().min(1)),
    scenario_refs: z.array(z.string().min(1)),
    knowledge_claim_refs: z.array(z.string().min(1)),
    policy_refs: z.array(z.string().min(1)),
    permission_refs: z.array(z.string().min(1)),
    action_window_refs: z.array(z.string().min(1)),
  })
  .strict();

export const decisionEligibilityDecisionV1Schema = z
  .object({
    schema_version: z.literal("decision_eligibility_decision_v1"),
    eligibility_id: z.string().min(1),
    scope: evidenceScopeV1Schema,
    inputs: decisionEligibilityInputRefsV1Schema,
    criteria: z.array(decisionEligibilityCriterionAssessmentV1Schema).min(1),
    verdict: decisionEligibilityVerdictV1Schema,
    reason_codes: z.array(z.string().min(1)),
    limitations: z.array(z.string().min(1)),
    remaining_uncertainty: z.array(z.string().min(1)),
    lifecycle_state: decisionEligibilityLifecycleStateV1Schema,
    evaluated_at: z.string().datetime({ offset: true }),
    decision_time: z.string().datetime({ offset: true }).nullable(),
    authority_state: z.literal("ELIGIBILITY_ONLY"),
  })
  .strict();

export type DecisionEligibilityVerdictV1 = z.infer<typeof decisionEligibilityVerdictV1Schema>;
export type DecisionEligibilityLifecycleStateV1 = z.infer<typeof decisionEligibilityLifecycleStateV1Schema>;
export type DecisionEligibilityCriterionV1 = z.infer<typeof decisionEligibilityCriterionV1Schema>;
export type DecisionEligibilityCriterionStatusV1 = z.infer<typeof decisionEligibilityCriterionStatusV1Schema>;
export type DecisionEligibilityDecisionV1 = z.infer<typeof decisionEligibilityDecisionV1Schema>;
