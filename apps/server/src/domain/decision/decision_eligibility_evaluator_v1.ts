import {
  decisionEligibilityDecisionV1Schema,
  type DecisionEligibilityCriterionStatusV1,
  type DecisionEligibilityCriterionV1,
  type DecisionEligibilityDecisionV1,
  type DecisionEligibilityLifecycleStateV1,
  type DecisionEligibilityVerdictV1,
} from "../../contracts/decision_eligibility_v1.js";

export type DecisionEligibilityPolicyV1 = {
  policy_ref: string;
  required_criteria: DecisionEligibilityCriterionV1[];
};

export type EvaluateDecisionEligibilityInputV1 = {
  eligibility_id: string;
  scope: DecisionEligibilityDecisionV1["scope"];
  inputs: DecisionEligibilityDecisionV1["inputs"];
  criteria: DecisionEligibilityDecisionV1["criteria"];
  policy: DecisionEligibilityPolicyV1;
  lifecycle_state: DecisionEligibilityLifecycleStateV1;
  evaluated_at: string;
  decision_time: string | null;
};

const STATUS_PRECEDENCE: Record<DecisionEligibilityCriterionStatusV1, number> = {
  SATISFIED: 0,
  DEGRADED: 1,
  UNKNOWN: 2,
  MISSING: 2,
  REVIEW_REQUIRED: 3,
  VIOLATED: 4,
};

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function aggregateVerdict(
  criteria: DecisionEligibilityDecisionV1["criteria"],
): DecisionEligibilityVerdictV1 {
  let highest: DecisionEligibilityCriterionStatusV1 = "SATISFIED";
  for (const assessment of criteria) {
    if (STATUS_PRECEDENCE[assessment.status] > STATUS_PRECEDENCE[highest]) {
      highest = assessment.status;
    }
  }

  if (highest === "VIOLATED") return "BLOCK";
  if (highest === "REVIEW_REQUIRED") return "HUMAN_REVIEW";
  if (highest === "MISSING" || highest === "UNKNOWN") return "NEED_EVIDENCE";
  if (highest === "DEGRADED") return "DEGRADED";
  return "PASS";
}

function assertLifecycleConsistency(
  lifecycle: DecisionEligibilityLifecycleStateV1,
  criteriaByName: Map<DecisionEligibilityCriterionV1, DecisionEligibilityDecisionV1["criteria"][number]>,
): void {
  if (lifecycle === "ACTIVE") return;

  const actionWindow = criteriaByName.get("ACTION_WINDOW");
  if (!actionWindow) {
    throw new Error("B07D_NON_ACTIVE_LIFECYCLE_REQUIRES_ACTION_WINDOW_CRITERION");
  }

  if (lifecycle === "EXPIRED" && actionWindow.status !== "VIOLATED") {
    throw new Error("B07D_EXPIRED_REQUIRES_ACTION_WINDOW_VIOLATED");
  }

  if (
    (lifecycle === "NOT_YET_ACTIVE" || lifecycle === "UNKNOWN")
    && (actionWindow.status === "SATISFIED" || actionWindow.status === "DEGRADED")
  ) {
    throw new Error("B07D_NON_ACTIVE_LIFECYCLE_ACTION_WINDOW_CANNOT_BE_SATISFIED");
  }
}

export function evaluateDecisionEligibilityV1(
  input: EvaluateDecisionEligibilityInputV1,
): DecisionEligibilityDecisionV1 {
  const policyRef = text(input.policy?.policy_ref);
  if (!policyRef) throw new Error("B07D_POLICY_REF_REQUIRED");

  const required = unique(input.policy?.required_criteria ?? []);
  if (required.length === 0) throw new Error("B07D_REQUIRED_CRITERIA_EMPTY");
  if (required.length !== (input.policy?.required_criteria ?? []).length) {
    throw new Error("B07D_REQUIRED_CRITERIA_DUPLICATE");
  }

  if (!(input.inputs.policy_refs ?? []).includes(policyRef)) {
    throw new Error("B07D_POLICY_REF_NOT_IN_CANONICAL_INPUTS");
  }

  const criteriaByName = new Map<
    DecisionEligibilityCriterionV1,
    DecisionEligibilityDecisionV1["criteria"][number]
  >();

  for (const assessment of input.criteria ?? []) {
    if (criteriaByName.has(assessment.criterion)) {
      throw new Error("B07D_DUPLICATE_CRITERION_ASSESSMENT:" + assessment.criterion);
    }
    criteriaByName.set(assessment.criterion, assessment);
  }

  for (const criterion of required) {
    if (!criteriaByName.has(criterion)) {
      throw new Error("B07D_REQUIRED_CRITERION_MISSING:" + criterion);
    }
  }

  assertLifecycleConsistency(input.lifecycle_state, criteriaByName);

  const verdict = aggregateVerdict(input.criteria);
  if (input.lifecycle_state !== "ACTIVE" && verdict === "PASS") {
    throw new Error("B07D_NON_ACTIVE_LIFECYCLE_CANNOT_PASS");
  }

  const nonSatisfied = input.criteria.filter((assessment) => assessment.status !== "SATISFIED");
  const reasonCodes = unique([
    "ELIGIBILITY_POLICY:" + policyRef,
    "ELIGIBILITY_VERDICT:" + verdict,
    ...nonSatisfied.flatMap((assessment) => [
      "CRITERION_" + assessment.criterion + "_" + assessment.status,
      ...assessment.reason_codes,
    ]),
  ].filter(Boolean));

  const remainingUncertainty = unique(
    input.criteria
      .filter((assessment) =>
        assessment.status === "DEGRADED"
        || assessment.status === "MISSING"
        || assessment.status === "UNKNOWN"
        || assessment.status === "REVIEW_REQUIRED"
      )
      .flatMap((assessment) => [
        assessment.criterion + ":" + assessment.status,
        ...assessment.reason_codes.map((reason) => assessment.criterion + ":" + reason),
      ]),
  );

  return decisionEligibilityDecisionV1Schema.parse({
    schema_version: "decision_eligibility_decision_v1",
    eligibility_id: input.eligibility_id,
    scope: input.scope,
    inputs: input.inputs,
    criteria: input.criteria,
    verdict,
    reason_codes: reasonCodes,
    limitations: [
      "B07D_DETERMINISTIC_CRITERION_AGGREGATION",
      "REQUIRED_CRITERIA_DEFINED_BY_EXPLICIT_POLICY_REF",
      "ALL_PROVIDED_CRITERIA_PARTICIPATE_IN_AGGREGATION",
      "ELIGIBILITY_PASS_IS_NOT_APPROVAL",
      "NO_APPROVAL_PLAN_TASK_OR_EXECUTION_AUTHORITY",
    ],
    remaining_uncertainty: remainingUncertainty,
    lifecycle_state: input.lifecycle_state,
    evaluated_at: input.evaluated_at,
    decision_time: input.decision_time,
    authority_state: "ELIGIBILITY_ONLY",
  });
}
