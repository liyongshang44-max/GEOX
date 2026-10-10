import {
  candidateDecisionV1Schema,
  type CandidateDecisionV1,
} from "../../contracts/canonical_decision_v1.js";
import type {
  DecisionEligibilityCriterionV1,
  DecisionEligibilityDecisionV1,
  DecisionEligibilityLifecycleStateV1,
} from "../../contracts/decision_eligibility_v1.js";
import {
  evaluateDecisionEligibilityV1,
  type DecisionEligibilityPolicyV1,
} from "./decision_eligibility_evaluator_v1.js";

/**
 * B-07e canonical domain runtime seam.
 *
 * This is the only registered consumer of the B-07d final evaluator.
 * It validates CandidateDecision identity/scope/basis continuity and then
 * delegates deterministic verdict aggregation to evaluateDecisionEligibilityV1.
 *
 * It does not expose an HTTP route and does not create Approval, Plan, Task,
 * execution, or MCFT authority.
 */

export type DecisionEligibilityRuntimePolicyV1 = DecisionEligibilityPolicyV1 & {
  applicable_action_types: string[];
};

export type DecisionEligibilityRuntimeCanonicalInputsV1 = {
  evidence_qualification_refs: string[];
  state_refs: string[];
  forecast_refs: string[];
  scenario_refs: string[];
  knowledge_claim_refs: string[];
  policy_refs: string[];
  permission_refs: string[];
  action_window_refs: string[];
};

export type RunDecisionEligibilityRuntimeInputV1 = {
  eligibility_id: string;
  candidate: CandidateDecisionV1 | Record<string, unknown>;
  canonical_inputs: DecisionEligibilityRuntimeCanonicalInputsV1;
  criteria: DecisionEligibilityDecisionV1["criteria"];
  policy: DecisionEligibilityRuntimePolicyV1;
  lifecycle_state: DecisionEligibilityLifecycleStateV1;
  evaluated_at: string;
};

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function uniqueText(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return Array.from(new Set(values.map(text).filter(Boolean)));
}

function candidateRef(candidate: CandidateDecisionV1): string {
  return "candidate_decision_v1:" + candidate.candidate_id;
}

function assertCandidateEvidenceContinuity(
  candidate: CandidateDecisionV1,
  runtimeEvidenceRefs: string[],
): void {
  const runtime = new Set(runtimeEvidenceRefs);
  for (const ref of candidate.basis.evidence_qualification_refs) {
    if (!runtime.has(ref)) {
      throw new Error("B07E_CANDIDATE_EVIDENCE_REF_MISSING_FROM_RUNTIME_INPUTS:" + ref);
    }
  }
}

function assertPolicyActionApplicability(
  candidate: CandidateDecisionV1,
  applicableActionTypes: string[],
): void {
  const applicable = uniqueText(applicableActionTypes);
  if (applicable.length === 0) {
    throw new Error("B07E_POLICY_APPLICABLE_ACTION_TYPES_EMPTY");
  }
  if (!applicable.includes(candidate.proposed_action.action_type)) {
    throw new Error(
      "B07E_POLICY_NOT_APPLICABLE_TO_CANDIDATE_ACTION:"
      + candidate.proposed_action.action_type,
    );
  }
}

function assertEvaluationTime(candidate: CandidateDecisionV1, evaluatedAt: string): void {
  const evaluatedMs = Date.parse(evaluatedAt);
  const createdMs = Date.parse(candidate.created_at);
  if (!Number.isFinite(evaluatedMs)) {
    throw new Error("B07E_EVALUATED_AT_INVALID");
  }
  if (evaluatedMs < createdMs) {
    throw new Error("B07E_EVALUATION_PRECEDES_CANDIDATE_CREATION");
  }

  if (candidate.decision_time) {
    const decisionMs = Date.parse(candidate.decision_time);
    if (Number.isFinite(decisionMs) && evaluatedMs < decisionMs) {
      throw new Error("B07E_EVALUATION_PRECEDES_CANDIDATE_DECISION_TIME");
    }
  }
}

function allowedCanonicalSupportRefs(
  candidate: CandidateDecisionV1,
  canonicalInputs: DecisionEligibilityRuntimeCanonicalInputsV1,
): Set<string> {
  return new Set(uniqueText([
    ...canonicalInputs.evidence_qualification_refs,
    ...canonicalInputs.state_refs,
    ...canonicalInputs.forecast_refs,
    ...canonicalInputs.scenario_refs,
    ...canonicalInputs.knowledge_claim_refs,
    ...canonicalInputs.policy_refs,
    ...canonicalInputs.permission_refs,
    ...canonicalInputs.action_window_refs,
    candidate.basis.context_snapshot_ref ?? "",
    candidate.basis.crop_stage_state_ref ?? "",
    ...candidate.basis.calculation_result_refs,
    ...candidate.basis.interpretation_refs,
  ]));
}

function assertCriterionSupportRefsAuthorized(
  candidate: CandidateDecisionV1,
  canonicalInputs: DecisionEligibilityRuntimeCanonicalInputsV1,
  criteria: DecisionEligibilityDecisionV1["criteria"],
): void {
  const allowed = allowedCanonicalSupportRefs(candidate, canonicalInputs);
  for (const assessment of criteria) {
    for (const ref of assessment.support_refs) {
      if (!allowed.has(ref)) {
        throw new Error(
          "B07E_CRITERION_SUPPORT_REF_NOT_CANONICAL_INPUT:"
          + assessment.criterion
          + ":"
          + ref,
        );
      }
    }
  }
}

function assertPolicyCriterionCoverage(
  policy: DecisionEligibilityRuntimePolicyV1,
  criteria: DecisionEligibilityDecisionV1["criteria"],
): void {
  const supplied = new Set<DecisionEligibilityCriterionV1>(
    criteria.map((assessment) => assessment.criterion),
  );
  for (const required of policy.required_criteria) {
    if (!supplied.has(required)) {
      throw new Error("B07E_REQUIRED_CRITERION_MISSING_BEFORE_EVALUATOR:" + required);
    }
  }
}

export function runDecisionEligibilityRuntimeV1(
  input: RunDecisionEligibilityRuntimeInputV1,
): DecisionEligibilityDecisionV1 {
  const parsedCandidate = candidateDecisionV1Schema.safeParse(input.candidate);
  if (!parsedCandidate.success) {
    throw new Error("B07E_INVALID_CANDIDATE_DECISION");
  }
  const candidate = parsedCandidate.data;

  assertEvaluationTime(candidate, input.evaluated_at);
  assertPolicyActionApplicability(candidate, input.policy.applicable_action_types);
  assertCandidateEvidenceContinuity(
    candidate,
    uniqueText(input.canonical_inputs.evidence_qualification_refs),
  );
  assertPolicyCriterionCoverage(input.policy, input.criteria);
  assertCriterionSupportRefsAuthorized(
    candidate,
    input.canonical_inputs,
    input.criteria,
  );

  const inputs: DecisionEligibilityDecisionV1["inputs"] = {
    candidate_ref: candidateRef(candidate),
    evidence_qualification_refs: uniqueText(
      input.canonical_inputs.evidence_qualification_refs,
    ),
    context_snapshot_ref: candidate.basis.context_snapshot_ref,
    crop_stage_state_ref: candidate.basis.crop_stage_state_ref,
    state_refs: uniqueText(input.canonical_inputs.state_refs),
    forecast_refs: uniqueText(input.canonical_inputs.forecast_refs),
    scenario_refs: uniqueText(input.canonical_inputs.scenario_refs),
    knowledge_claim_refs: uniqueText(input.canonical_inputs.knowledge_claim_refs),
    policy_refs: uniqueText(input.canonical_inputs.policy_refs),
    permission_refs: uniqueText(input.canonical_inputs.permission_refs),
    action_window_refs: uniqueText(input.canonical_inputs.action_window_refs),
  };

  return evaluateDecisionEligibilityV1({
    eligibility_id: input.eligibility_id,
    scope: candidate.scope,
    inputs,
    criteria: input.criteria,
    policy: {
      policy_ref: input.policy.policy_ref,
      required_criteria: input.policy.required_criteria,
    },
    lifecycle_state: input.lifecycle_state,
    evaluated_at: input.evaluated_at,
    decision_time: candidate.decision_time,
  });
}
