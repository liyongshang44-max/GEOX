import {
  candidateDecisionV1Schema,
  type CandidateDecisionV1,
} from "../../contracts/canonical_decision_v1.js";
import {
  decisionEligibilityDecisionV1Schema,
  type DecisionEligibilityDecisionV1,
} from "../../contracts/decision_eligibility_v1.js";
import {
  decisionEpisodeV1Schema,
  type DecisionEpisodeV1,
} from "../../contracts/decision_episode_v1.js";

export type DecisionEpisodeDownstreamRefsV1 = {
  approval_request_ref?: string | null;
  approval_decision_ref?: string | null;
  approved_operation_plan_ref?: string | null;
  task_refs?: string[];
  receipt_refs?: string[];
  as_executed_refs?: string[];
  as_applied_refs?: string[];
  acceptance_refs?: string[];
  outcome_evidence_refs?: string[];
  field_memory_refs?: string[];
};

export type AssembleDecisionEpisodeInputV1 = {
  episode_id: string;
  candidate: CandidateDecisionV1 | Record<string, unknown>;
  eligibility: DecisionEligibilityDecisionV1 | Record<string, unknown>;
  deterministic_reasoning_refs?: string[];
  human_reasoning_refs?: string[];
  llm_reasoning_refs?: string[];
  downstream?: DecisionEpisodeDownstreamRefsV1;
  source_trace_refs?: string[];
  limitations?: string[];
  assembled_at: string;
};

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function uniqueText(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return Array.from(new Set(values.map(text).filter(Boolean)));
}

function sameScope(
  a: CandidateDecisionV1["scope"],
  b: DecisionEligibilityDecisionV1["scope"],
): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function canonicalCandidateRef(candidate: CandidateDecisionV1): string {
  return "candidate_decision_v1:" + candidate.candidate_id;
}

function requireEpisodeDecisionTime(
  candidate: CandidateDecisionV1,
  eligibility: DecisionEligibilityDecisionV1,
): string {
  const candidateDecisionTime = text(candidate.decision_time);
  const eligibilityDecisionTime = text(eligibility.decision_time);
  if (!candidateDecisionTime) {
    throw new Error("B08C_CANDIDATE_DECISION_TIME_REQUIRED");
  }
  if (!eligibilityDecisionTime) {
    throw new Error("B08C_ELIGIBILITY_DECISION_TIME_REQUIRED");
  }
  if (candidateDecisionTime !== eligibilityDecisionTime) {
    throw new Error("B08C_DECISION_TIME_MISMATCH");
  }
  return candidateDecisionTime;
}

function assertCandidateEligibilityContinuity(
  candidate: CandidateDecisionV1,
  eligibility: DecisionEligibilityDecisionV1,
): void {
  if (!sameScope(candidate.scope, eligibility.scope)) {
    throw new Error("B08C_SCOPE_MISMATCH");
  }

  const expectedCandidateRef = canonicalCandidateRef(candidate);
  if (eligibility.inputs.candidate_ref !== expectedCandidateRef) {
    throw new Error("B08C_ELIGIBILITY_CANDIDATE_REF_MISMATCH");
  }

  if (candidate.basis.context_snapshot_ref !== eligibility.inputs.context_snapshot_ref) {
    throw new Error("B08C_CONTEXT_SNAPSHOT_REF_MISMATCH");
  }
  if (candidate.basis.crop_stage_state_ref !== eligibility.inputs.crop_stage_state_ref) {
    throw new Error("B08C_CROP_STAGE_STATE_REF_MISMATCH");
  }

  const eligibilityEvidence = new Set(eligibility.inputs.evidence_qualification_refs);
  for (const ref of candidate.basis.evidence_qualification_refs) {
    if (!eligibilityEvidence.has(ref)) {
      throw new Error("B08C_CANDIDATE_EVIDENCE_REF_MISSING_FROM_ELIGIBILITY:" + ref);
    }
  }
}

function assertAssembledAt(
  assembledAt: string,
  candidate: CandidateDecisionV1,
  eligibility: DecisionEligibilityDecisionV1,
): void {
  const assembledMs = Date.parse(assembledAt);
  const candidateMs = Date.parse(candidate.created_at);
  const eligibilityMs = Date.parse(eligibility.evaluated_at);
  if (!Number.isFinite(assembledMs)) {
    throw new Error("B08C_ASSEMBLED_AT_INVALID");
  }
  if (assembledMs < candidateMs) {
    throw new Error("B08C_ASSEMBLY_PRECEDES_CANDIDATE_CREATION");
  }
  if (assembledMs < eligibilityMs) {
    throw new Error("B08C_ASSEMBLY_PRECEDES_ELIGIBILITY_EVALUATION");
  }
}

function assertDownstreamTraceOrdering(
  downstream: DecisionEpisodeDownstreamRefsV1,
): void {
  const approvalRequest = text(downstream.approval_request_ref);
  const approvalDecision = text(downstream.approval_decision_ref);
  const plan = text(downstream.approved_operation_plan_ref);
  const tasks = uniqueText(downstream.task_refs);
  const receipts = uniqueText(downstream.receipt_refs);
  const asExecuted = uniqueText(downstream.as_executed_refs);
  const asApplied = uniqueText(downstream.as_applied_refs);
  const acceptance = uniqueText(downstream.acceptance_refs);
  const outcomes = uniqueText(downstream.outcome_evidence_refs);

  if (approvalDecision && !approvalRequest) {
    throw new Error("B08C_APPROVAL_DECISION_REQUIRES_REQUEST_REF");
  }
  if (plan && !approvalDecision) {
    throw new Error("B08C_APPROVED_PLAN_REQUIRES_APPROVAL_DECISION_REF");
  }
  if (tasks.length > 0 && !plan) {
    throw new Error("B08C_TASK_TRACE_REQUIRES_APPROVED_PLAN_REF");
  }
  if ((receipts.length > 0 || asExecuted.length > 0 || asApplied.length > 0) && tasks.length === 0) {
    throw new Error("B08C_EXECUTION_TRACE_REQUIRES_TASK_REF");
  }
  if (
    acceptance.length > 0
    && receipts.length === 0
    && asExecuted.length === 0
    && asApplied.length === 0
  ) {
    throw new Error("B08C_ACCEPTANCE_TRACE_REQUIRES_EXECUTION_EVIDENCE_REF");
  }
  if (outcomes.length > 0 && acceptance.length === 0) {
    throw new Error("B08C_OUTCOME_TRACE_REQUIRES_ACCEPTANCE_REF");
  }
}

export function assembleDecisionEpisodeV1(
  input: AssembleDecisionEpisodeInputV1,
): DecisionEpisodeV1 {
  const parsedCandidate = candidateDecisionV1Schema.safeParse(input.candidate);
  if (!parsedCandidate.success) {
    throw new Error("B08C_INVALID_CANDIDATE_DECISION");
  }
  const candidate = parsedCandidate.data;

  const parsedEligibility = decisionEligibilityDecisionV1Schema.safeParse(input.eligibility);
  if (!parsedEligibility.success) {
    throw new Error("B08C_INVALID_DECISION_ELIGIBILITY");
  }
  const eligibility = parsedEligibility.data;

  assertCandidateEligibilityContinuity(candidate, eligibility);
  const decisionTime = requireEpisodeDecisionTime(candidate, eligibility);
  assertAssembledAt(input.assembled_at, candidate, eligibility);

  const downstream = input.downstream ?? {};
  assertDownstreamTraceOrdering(downstream);

  return decisionEpisodeV1Schema.parse({
    schema_version: "decision_episode_v1",
    episode_id: input.episode_id,
    scope: candidate.scope,
    decision_time: decisionTime,
    authority_inputs: {
      evidence_qualification_refs: uniqueText(eligibility.inputs.evidence_qualification_refs),
      context_snapshot_ref: eligibility.inputs.context_snapshot_ref,
      crop_stage_state_ref: eligibility.inputs.crop_stage_state_ref,
      state_refs: uniqueText(eligibility.inputs.state_refs),
      forecast_refs: uniqueText(eligibility.inputs.forecast_refs),
      scenario_refs: uniqueText(eligibility.inputs.scenario_refs),
      knowledge_claim_refs: uniqueText(eligibility.inputs.knowledge_claim_refs),
      policy_refs: uniqueText(eligibility.inputs.policy_refs),
      permission_refs: uniqueText(eligibility.inputs.permission_refs),
      action_window_refs: uniqueText(eligibility.inputs.action_window_refs),
    },
    reasoning_refs: {
      calculation_result_refs: uniqueText(candidate.basis.calculation_result_refs),
      interpretation_refs: uniqueText(candidate.basis.interpretation_refs),
      deterministic_reasoning_refs: uniqueText(input.deterministic_reasoning_refs),
      human_reasoning_refs: uniqueText(input.human_reasoning_refs),
      llm_reasoning_refs: uniqueText(input.llm_reasoning_refs),
    },
    decision_authority_refs: {
      candidate_ref: canonicalCandidateRef(candidate),
      eligibility_ref: "decision_eligibility_decision_v1:" + eligibility.eligibility_id,
      approval_request_ref: text(downstream.approval_request_ref) || null,
      approval_decision_ref: text(downstream.approval_decision_ref) || null,
      approved_operation_plan_ref: text(downstream.approved_operation_plan_ref) || null,
    },
    execution_refs: {
      task_refs: uniqueText(downstream.task_refs),
      receipt_refs: uniqueText(downstream.receipt_refs),
      as_executed_refs: uniqueText(downstream.as_executed_refs),
      as_applied_refs: uniqueText(downstream.as_applied_refs),
      acceptance_refs: uniqueText(downstream.acceptance_refs),
      outcome_evidence_refs: uniqueText(downstream.outcome_evidence_refs),
      field_memory_refs: uniqueText(downstream.field_memory_refs),
    },
    source_trace_refs: uniqueText(input.source_trace_refs),
    limitations: uniqueText([
      "B08C_TRACE_AGGREGATION_ONLY",
      "REFERENCE_EXISTENCE_DOES_NOT_CREATE_OR_REPLACE_AUTHORITY",
      "REAL_MCFT_ADR_LLM_INTEGRATIONS_REMAIN_DISCONNECTED",
      ...(input.limitations ?? []),
    ]),
    assembled_at: input.assembled_at,
    authority_state: "TRACE_ONLY",
  });
}
