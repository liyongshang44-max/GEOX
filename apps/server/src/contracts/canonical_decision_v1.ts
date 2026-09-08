import { z } from "zod";

import { evidenceScopeV1Schema } from "./canonical_evidence_v1.js";

/**
 * B-06a contract vocabulary only.
 *
 * CalculationResultV1 is calculator output, not a candidate action.
 * CandidateDecisionV1 is a proposal, not Decision Eligibility, Approval,
 * OperationPlan, Task, or execution authority.
 *
 * B-06a creates no production producer for either contract.
 */

export const decisionScalarValueV1Schema = z.union([
  z.number().finite(),
  z.string(),
  z.boolean(),
  z.null(),
]);

const RESERVED_DOWNSTREAM_AUTHORITY_KEY =
  /(^|_)(approval|approved|eligibility|eligible|execute|execution|task|authorization|authorized)(_|$)/i;

export const candidateParametersHintV1Schema = z
  .record(decisionScalarValueV1Schema)
  .superRefine((value, ctx) => {
    for (const key of Object.keys(value)) {
      if (RESERVED_DOWNSTREAM_AUTHORITY_KEY.test(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: "B06_CANDIDATE_PARAMETERS_MUST_NOT_CARRY_DOWNSTREAM_AUTHORITY",
        });
      }
    }
  });

export const calculationOutputV1Schema = z
  .object({
    key: z.string().min(1),
    value: decisionScalarValueV1Schema,
    unit: z.string().min(1).nullable(),
  })
  .strict();

export const calculationUncertaintyV1Schema = z
  .object({
    level: z.enum(["LOW", "MEDIUM", "HIGH", "UNKNOWN"]),
    reasons: z.array(z.string().min(1)),
  })
  .strict();

export const calculationResultV1Schema = z
  .object({
    schema_version: z.literal("calculation_result_v1"),
    calculation_id: z.string().min(1),
    scope: evidenceScopeV1Schema,
    calculator_ref: z.string().min(1),
    calculator_version: z.string().min(1).nullable(),
    evidence_qualification_refs: z.array(z.string().min(1)),
    context_snapshot_ref: z.string().min(1).nullable(),
    crop_stage_state_ref: z.string().min(1).nullable(),
    outputs: z.array(calculationOutputV1Schema).min(1),
    trace_refs: z.array(z.string().min(1)),
    assumptions: z.array(z.string().min(1)),
    uncertainty: calculationUncertaintyV1Schema,
    limitations: z.array(z.string().min(1)),
    evaluated_at: z.string().datetime({ offset: true }),
    decision_time: z.string().datetime({ offset: true }).nullable(),
    authority_state: z.literal("CALCULATION_ONLY"),
  })
  .strict();

export const candidateDecisionSourceClassV1Schema = z.enum([
  "DECISION_RUNTIME",
  "LEGACY_RECOMMENDATION",
  "LEGACY_DECISION_PLAN",
  "LEGACY_PRESCRIPTION_ACTION_SPEC",
  "LEGACY_OPERATION_PLAN_PROPOSAL",
]);

export const candidateTargetV1Schema = z
  .object({
    kind: z.string().min(1),
    ref: z.string().min(1),
  })
  .strict();

export const candidateProposedActionV1Schema = z
  .object({
    action_type: z.string().min(1),
    target: candidateTargetV1Schema,
    parameters_hint: candidateParametersHintV1Schema,
    action_spec_ref: z.string().min(1).nullable(),
  })
  .strict();

export const candidateBasisV1Schema = z
  .object({
    evidence_qualification_refs: z.array(z.string().min(1)),
    context_snapshot_ref: z.string().min(1).nullable(),
    crop_stage_state_ref: z.string().min(1).nullable(),
    calculation_result_refs: z.array(z.string().min(1)),
    interpretation_refs: z.array(z.string().min(1)),
    legacy_source_refs: z.array(z.string().min(1)),
  })
  .strict();

export const candidateDecisionV1Schema = z
  .object({
    schema_version: z.literal("candidate_decision_v1"),
    candidate_id: z.string().min(1),
    scope: evidenceScopeV1Schema,
    source_ref: z.string().min(1),
    source_class: candidateDecisionSourceClassV1Schema,
    proposed_action: candidateProposedActionV1Schema,
    basis: candidateBasisV1Schema,
    confidence: z.number().min(0).max(1).nullable(),
    reasons: z.array(z.string().min(1)),
    limitations: z.array(z.string().min(1)),
    decision_time: z.string().datetime({ offset: true }).nullable(),
    created_at: z.string().datetime({ offset: true }),
    authority_state: z.literal("CANDIDATE_ONLY"),
  })
  .strict();

export type CalculationResultV1 = z.infer<typeof calculationResultV1Schema>;
export type CandidateDecisionSourceClassV1 = z.infer<typeof candidateDecisionSourceClassV1Schema>;
export type CandidateDecisionV1 = z.infer<typeof candidateDecisionV1Schema>;
