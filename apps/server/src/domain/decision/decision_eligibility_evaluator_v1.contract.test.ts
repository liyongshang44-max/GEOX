import assert from "node:assert/strict";
import test from "node:test";

import { evaluateDecisionEligibilityV1 } from "./decision_eligibility_evaluator_v1.js";

const scope = {
  tenant_id: "tenantA",
  project_id: "projectA",
  group_id: "groupA",
  field_id: "fieldA",
  season_id: "seasonA",
  zone_id: null,
};

const inputs = {
  candidate_ref: "candidate_decision_v1:candidate_001",
  evidence_qualification_refs: ["evidence_qualification_v1:eq1"],
  context_snapshot_ref: "context_snapshot_v1:ctx1",
  crop_stage_state_ref: "qualified_crop_stage_state_v1:stage1",
  state_refs: ["qualified_state_v1:state1"],
  forecast_refs: ["forecast_v1:forecast1"],
  scenario_refs: [],
  knowledge_claim_refs: ["knowledge_claim_v1:claim1"],
  policy_refs: ["policy_v1:eligibility_irrigation_v1"],
  permission_refs: ["permission_v1:operator1"],
  action_window_refs: ["action_window_v1:window1"],
};

function assessment(
  criterion: any,
  status: any = "SATISFIED",
  reason_codes: string[] = [],
) {
  return {
    criterion,
    status,
    reason_codes,
    support_refs: ["support:" + criterion],
  };
}

const required = [
  "QUALIFIED_EVIDENCE",
  "CONTEXT",
  "STATE",
  "PERMISSION",
  "ACTION_WINDOW",
] as const;

function base(overrides: Record<string, unknown> = {}) {
  return {
    eligibility_id: "eligibility_001",
    scope,
    inputs,
    criteria: required.map((criterion) => assessment(criterion)),
    policy: {
      policy_ref: "policy_v1:eligibility_irrigation_v1",
      required_criteria: [...required],
    },
    lifecycle_state: "ACTIVE",
    evaluated_at: "2026-08-28T02:10:00+08:00",
    decision_time: "2026-08-28T02:09:00+08:00",
    ...overrides,
  } as any;
}

test("B-07d all satisfied required criteria produce PASS but not Approval", () => {
  const result = evaluateDecisionEligibilityV1(base());

  assert.equal(result.verdict, "PASS");
  assert.equal(result.authority_state, "ELIGIBILITY_ONLY");
  assert.equal(result.limitations.includes("ELIGIBILITY_PASS_IS_NOT_APPROVAL"), true);
  assert.equal("approved" in result, false);
  assert.equal("approval_request_id" in result, false);
  assert.equal("operation_plan_id" in result, false);
  assert.equal("task_id" in result, false);
});

test("B-07d deterministic precedence is BLOCK > HUMAN_REVIEW > NEED_EVIDENCE > DEGRADED > PASS", () => {
  const cases = [
    { status: "DEGRADED", verdict: "DEGRADED" },
    { status: "UNKNOWN", verdict: "NEED_EVIDENCE" },
    { status: "MISSING", verdict: "NEED_EVIDENCE" },
    { status: "REVIEW_REQUIRED", verdict: "HUMAN_REVIEW" },
    { status: "VIOLATED", verdict: "BLOCK" },
  ];

  for (const c of cases) {
    const result = evaluateDecisionEligibilityV1(base({
      criteria: [
        ...required.slice(0, -1).map((criterion) => assessment(criterion)),
        assessment("ACTION_WINDOW", c.status, ["TEST_" + c.status]),
      ],
    }));
    assert.equal(result.verdict, c.verdict);
  }

  const precedence = evaluateDecisionEligibilityV1(base({
    criteria: [
      assessment("QUALIFIED_EVIDENCE", "MISSING", ["MISSING_EVIDENCE"]),
      assessment("CONTEXT", "REVIEW_REQUIRED", ["CONTEXT_REVIEW"]),
      assessment("STATE", "VIOLATED", ["NO_IRRIGATION_REQUIREMENT"]),
      assessment("PERMISSION", "SATISFIED"),
      assessment("ACTION_WINDOW", "DEGRADED", ["WINDOW_LIMITED"]),
    ],
  }));
  assert.equal(precedence.verdict, "BLOCK");
});

test("B-07d missing required criterion fails closed", () => {
  assert.throws(
    () => evaluateDecisionEligibilityV1(base({
      criteria: required
        .filter((criterion) => criterion !== "PERMISSION")
        .map((criterion) => assessment(criterion)),
    })),
    /B07D_REQUIRED_CRITERION_MISSING:PERMISSION/,
  );
});

test("B-07d required criteria must be explicit, nonempty, and unique", () => {
  assert.throws(
    () => evaluateDecisionEligibilityV1(base({
      policy: { policy_ref: "policy_v1:eligibility_irrigation_v1", required_criteria: [] },
    })),
    /B07D_REQUIRED_CRITERIA_EMPTY/,
  );

  assert.throws(
    () => evaluateDecisionEligibilityV1(base({
      policy: {
        policy_ref: "policy_v1:eligibility_irrigation_v1",
        required_criteria: ["STATE", "STATE"],
      },
    })),
    /B07D_REQUIRED_CRITERIA_DUPLICATE/,
  );
});

test("B-07d policy_ref must be represented in canonical policy_refs", () => {
  assert.throws(
    () => evaluateDecisionEligibilityV1(base({
      policy: {
        policy_ref: "policy_v1:unbound",
        required_criteria: [...required],
      },
    })),
    /B07D_POLICY_REF_NOT_IN_CANONICAL_INPUTS/,
  );
});

test("B-07d duplicate criterion assessments fail closed", () => {
  assert.throws(
    () => evaluateDecisionEligibilityV1(base({
      criteria: [
        ...required.map((criterion) => assessment(criterion)),
        assessment("STATE"),
      ],
    })),
    /B07D_DUPLICATE_CRITERION_ASSESSMENT:STATE/,
  );
});

test("B-07d non-required provided criterion still participates in aggregation", () => {
  const result = evaluateDecisionEligibilityV1(base({
    criteria: [
      ...required.map((criterion) => assessment(criterion)),
      assessment("CONSEQUENCE", "VIOLATED", ["UNACCEPTABLE_CONSEQUENCE"]),
    ],
  }));

  assert.equal(result.verdict, "BLOCK");
  assert.equal(result.reason_codes.includes("CRITERION_CONSEQUENCE_VIOLATED"), true);
});

test("B-07d EXPIRED lifecycle requires violated ACTION_WINDOW and cannot PASS", () => {
  assert.throws(
    () => evaluateDecisionEligibilityV1(base({
      lifecycle_state: "EXPIRED",
    })),
    /B07D_EXPIRED_REQUIRES_ACTION_WINDOW_VIOLATED/,
  );

  const result = evaluateDecisionEligibilityV1(base({
    lifecycle_state: "EXPIRED",
    criteria: [
      ...required.filter((criterion) => criterion !== "ACTION_WINDOW").map((criterion) => assessment(criterion)),
      assessment("ACTION_WINDOW", "VIOLATED", ["WINDOW_EXPIRED"]),
    ],
  }));

  assert.equal(result.lifecycle_state, "EXPIRED");
  assert.equal(result.verdict, "BLOCK");
});

test("B-07d NOT_YET_ACTIVE and UNKNOWN lifecycle cannot carry satisfied action window", () => {
  for (const lifecycle_state of ["NOT_YET_ACTIVE", "UNKNOWN"]) {
    assert.throws(
      () => evaluateDecisionEligibilityV1(base({ lifecycle_state })),
      /B07D_NON_ACTIVE_LIFECYCLE_ACTION_WINDOW_CANNOT_BE_SATISFIED/,
    );

    const result = evaluateDecisionEligibilityV1(base({
      lifecycle_state,
      criteria: [
        ...required.filter((criterion) => criterion !== "ACTION_WINDOW").map((criterion) => assessment(criterion)),
        assessment("ACTION_WINDOW", "MISSING", ["WINDOW_NOT_ACTIVE"]),
      ],
    }));
    assert.equal(result.verdict, "NEED_EVIDENCE");
  }
});

test("B-07d remaining uncertainty is derived only from non-final uncertainty statuses", () => {
  const result = evaluateDecisionEligibilityV1(base({
    criteria: [
      assessment("QUALIFIED_EVIDENCE", "DEGRADED", ["ONE_SENSOR_INVALID"]),
      assessment("CONTEXT"),
      assessment("STATE"),
      assessment("PERMISSION"),
      assessment("ACTION_WINDOW"),
    ],
  }));

  assert.equal(result.verdict, "DEGRADED");
  assert.equal(result.remaining_uncertainty.includes("QUALIFIED_EVIDENCE:DEGRADED"), true);
  assert.equal(result.remaining_uncertainty.includes("QUALIFIED_EVIDENCE:ONE_SENSOR_INVALID"), true);
});

test("B-07d evaluated_at and decision_time remain caller supplied deterministic inputs", () => {
  const result = evaluateDecisionEligibilityV1(base());
  assert.equal(result.evaluated_at, "2026-08-28T02:10:00+08:00");
  assert.equal(result.decision_time, "2026-08-28T02:09:00+08:00");
});
