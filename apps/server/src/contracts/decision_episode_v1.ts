import { z } from "zod";

import { evidenceScopeV1Schema } from "./canonical_evidence_v1.js";

/**
 * B-08a contract only.
 *
 * DecisionEpisodeV1 is a trace/projection object. It aggregates typed
 * decision-time and downstream authority references without becoming an
 * authority source itself.
 *
 * It must not create CandidateDecision, Decision Eligibility, Approval,
 * OperationPlan, Task, execution, Acceptance, or device-command authority.
 */

export const decisionEpisodeAuthorityInputsV1Schema = z
  .object({
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

export const decisionEpisodeReasoningRefsV1Schema = z
  .object({
    calculation_result_refs: z.array(z.string().min(1)),
    interpretation_refs: z.array(z.string().min(1)),
    deterministic_reasoning_refs: z.array(z.string().min(1)),
    human_reasoning_refs: z.array(z.string().min(1)),
    llm_reasoning_refs: z.array(z.string().min(1)),
  })
  .strict();

export const decisionEpisodeDecisionAuthorityRefsV1Schema = z
  .object({
    candidate_ref: z.string().min(1),
    eligibility_ref: z.string().min(1),
    approval_request_ref: z.string().min(1).nullable(),
    approval_decision_ref: z.string().min(1).nullable(),
    approved_operation_plan_ref: z.string().min(1).nullable(),
  })
  .strict();

export const decisionEpisodeExecutionRefsV1Schema = z
  .object({
    task_refs: z.array(z.string().min(1)),
    receipt_refs: z.array(z.string().min(1)),
    as_executed_refs: z.array(z.string().min(1)),
    as_applied_refs: z.array(z.string().min(1)),
    acceptance_refs: z.array(z.string().min(1)),
    outcome_evidence_refs: z.array(z.string().min(1)),
    field_memory_refs: z.array(z.string().min(1)),
  })
  .strict();

export const decisionEpisodeV1Schema = z
  .object({
    schema_version: z.literal("decision_episode_v1"),
    episode_id: z.string().min(1),
    scope: evidenceScopeV1Schema,
    decision_time: z.string().datetime({ offset: true }),
    authority_inputs: decisionEpisodeAuthorityInputsV1Schema,
    reasoning_refs: decisionEpisodeReasoningRefsV1Schema,
    decision_authority_refs: decisionEpisodeDecisionAuthorityRefsV1Schema,
    execution_refs: decisionEpisodeExecutionRefsV1Schema,
    source_trace_refs: z.array(z.string().min(1)),
    limitations: z.array(z.string().min(1)),
    assembled_at: z.string().datetime({ offset: true }),
    authority_state: z.literal("TRACE_ONLY"),
  })
  .strict();

export type DecisionEpisodeAuthorityInputsV1 = z.infer<typeof decisionEpisodeAuthorityInputsV1Schema>;
export type DecisionEpisodeReasoningRefsV1 = z.infer<typeof decisionEpisodeReasoningRefsV1Schema>;
export type DecisionEpisodeDecisionAuthorityRefsV1 = z.infer<typeof decisionEpisodeDecisionAuthorityRefsV1Schema>;
export type DecisionEpisodeExecutionRefsV1 = z.infer<typeof decisionEpisodeExecutionRefsV1Schema>;
export type DecisionEpisodeV1 = z.infer<typeof decisionEpisodeV1Schema>;
