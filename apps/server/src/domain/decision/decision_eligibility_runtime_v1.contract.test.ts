import assert from "node:assert/strict";
import test from "node:test";

import { runDecisionEligibilityRuntimeV1 } from "./decision_eligibility_runtime_v1.js";

const candidate = {
  schema_version: "candidate_decision_v1",
  candidate_id: "candidate_001",
  scope: {
    tenant_id: "tenantA",
    project_id: "projectA",
    group_id: "groupA",
    field_id: "fieldA",
    season_id: "seasonA",
    zone_id: null,
  },
  source_ref: "recommendation_v1:rec1",
  source_class: "LEGACY_RECOMMENDATION",
  proposed_action: {
    action_type: "IRRIGATE",
    target: { kind: "field", ref: "fieldA" },
    parameters_hint: {},
    action_spec_ref: null,
  },
  basis: {
    evidence_qualification_refs: [
      "evidence_qualification_v1:eq_soil",
      "evidence_qualification_v1:eq_weather",
    ],
    context_snapshot_ref: "context_snapshot_v1:ctx1",
    crop_stage_state_ref: "qualified_crop_stage_state_v1:stage1",
    calculation_result_refs: ["calculation_result_v1:calc1"],
    interpretation_refs: ["interpretation_v1:int1"],
    legacy_source_refs: ["recommendation_v1:rec1"],
  },
  confidence: 0.8,
  reasons: ["IRRIGATION_REQUIREMENT"],
  limitations: [],
  decision_time: "2026-08-28T02:20:00+08:00",
  created_at: "2026-08-28T02:20:10+08:00",
  authority_state: "CANDIDATE_ONLY",
} as const;

const canonical_inputs = {
  evidence_qualification_refs: [
    "evidence_qualification_v1:eq_soil",
    "evidence_qualification_v1:eq_weather",
    "evidence_qualification_v1:eq_pressure",
  ],
  state_refs: ["qualified_state_v1:state1"],
  forecast_refs: ["forecast_v1:forecast1"],
  scenario_refs: [],
  knowledge_claim_refs: ["knowledge_claim_v1:claim1"],
  policy_refs: ["policy_v1:eligibility_irrigation_v1"],
  permission_refs: ["permission_v1:operator1"],
  action_window_refs: ["action_window_v1:window1"],
};

const criteria = [
  {
    criterion: "QUALIFIED_EVIDENCE",
    status: "SATISFIED",
    reason_codes: [],
    support_refs: ["evidence_qualification_v1:eq_pressure"],
  },
  {
    criterion: "CONTEXT",
    status: "SATISFIED",
    reason_codes: [],
    support_refs: ["context_snapshot_v1:ctx1", "qualified_crop_stage_state_v1:stage1"],
  },
  {
    criterion: "STATE",
    status: "SATISFIED",
    reason_codes: [],
    support_refs: ["calculation_result_v1:calc1"],
  },
  {
    criterion: "PERMISSION",
    status: "SATISFIED",
    reason_codes: [],
    support_refs: ["permission_v1:operator1"],
  },
  {
    criterion: "ACTION_WINDOW",
    status: "SATISFIED",
    reason_codes: [],
    support_refs: ["action_window_v1:window1"],
  },
] as const;

const policy = {
  policy_ref: "policy_v1:eligibility_irrigation_v1",
  required_criteria: [
    "QUALIFIED_EVIDENCE",
    "CONTEXT",
    "STATE",
    "PERMISSION",
    "ACTION_WINDOW",
  ],
  applicable_action_types: ["IRRIGATE"],
} as const;

function base(overrides: Record<string, unknown> = {}) {
  return {
    eligibility_id: "eligibility_001",
    candidate,
    canonical_inputs,
    criteria,
    policy,
    lifecycle_state: "ACTIVE",
    evaluated_at: "2026-08-28T02:21:00+08:00",
    ...overrides,
  } as any;
}

test("B-07e runtime derives candidate identity/scope/context/stage/decision_time from CandidateDecision", () => {
  const result = runDecisionEligibilityRuntimeV1(base());

  assert.equal(result.inputs.candidate_ref, "candidate_decision_v1:candidate_001");
  assert.deepEqual(result.scope, candidate.scope);
  assert.equal(result.inputs.context_snapshot_ref, candidate.basis.context_snapshot_ref);
  assert.equal(result.inputs.crop_stage_state_ref, candidate.basis.crop_stage_state_ref);
  assert.equal(result.decision_time, candidate.decision_time);
  assert.equal(result.verdict, "PASS");
  assert.equal(result.authority_state, "ELIGIBILITY_ONLY");
});

test("B-07e canonical runtime evidence must retain all CandidateDecision evidence basis refs", () => {
  assert.throws(
    () => runDecisionEligibilityRuntimeV1(base({
      canonical_inputs: {
        ...canonical_inputs,
        evidence_qualification_refs: ["evidence_qualification_v1:eq_soil"],
      },
    })),
    /B07E_CANDIDATE_EVIDENCE_REF_MISSING_FROM_RUNTIME_INPUTS:evidence_qualification_v1:eq_weather/,
  );
});

test("B-07e criterion support refs must come from canonical runtime or Candidate basis refs", () => {
  assert.throws(
    () => runDecisionEligibilityRuntimeV1(base({
      criteria: [
        ...criteria.slice(0, -1),
        {
          criterion: "ACTION_WINDOW",
          status: "SATISFIED",
          reason_codes: [],
          support_refs: ["legacy_raw_fact:1"],
        },
      ],
    })),
    /B07E_CRITERION_SUPPORT_REF_NOT_CANONICAL_INPUT:ACTION_WINDOW:legacy_raw_fact:1/,
  );

  const result = runDecisionEligibilityRuntimeV1(base());
  assert.equal(result.criteria.find((x:any) => x.criterion === "STATE")?.support_refs[0], "calculation_result_v1:calc1");
});

test("B-07e policy must explicitly apply to candidate action", () => {
  assert.throws(
    () => runDecisionEligibilityRuntimeV1(base({
      policy: { ...policy, applicable_action_types: ["FERTILIZE"] },
    })),
    /B07E_POLICY_NOT_APPLICABLE_TO_CANDIDATE_ACTION:IRRIGATE/,
  );

  assert.throws(
    () => runDecisionEligibilityRuntimeV1(base({
      policy: { ...policy, applicable_action_types: [] },
    })),
    /B07E_POLICY_APPLICABLE_ACTION_TYPES_EMPTY/,
  );
});

test("B-07e candidate contract is validated without creating a second CandidateDecision producer", () => {
  assert.throws(
    () => runDecisionEligibilityRuntimeV1(base({
      candidate: { ...candidate, authority_state: "APPROVED" },
    })),
    /B07E_INVALID_CANDIDATE_DECISION/,
  );
});

test("B-07e evaluation cannot predate candidate creation or decision time", () => {
  assert.throws(
    () => runDecisionEligibilityRuntimeV1(base({
      evaluated_at: "2026-08-28T02:20:05+08:00",
    })),
    /B07E_EVALUATION_PRECEDES_CANDIDATE_CREATION/,
  );

  assert.throws(
    () => runDecisionEligibilityRuntimeV1(base({
      evaluated_at: "invalid",
    })),
    /B07E_EVALUATED_AT_INVALID/,
  );
});

test("B-07e required criterion continuity is checked before final evaluator", () => {
  assert.throws(
    () => runDecisionEligibilityRuntimeV1(base({
      criteria: criteria.filter((x) => x.criterion !== "PERMISSION"),
    })),
    /B07E_REQUIRED_CRITERION_MISSING_BEFORE_EVALUATOR:PERMISSION/,
  );
});

test("B-07e evaluator precedence is preserved through runtime seam", () => {
  const result = runDecisionEligibilityRuntimeV1(base({
    criteria: criteria.map((x) =>
      x.criterion === "QUALIFIED_EVIDENCE"
        ? { ...x, status: "DEGRADED", reason_codes: ["ONE_SENSOR_INVALID"] }
        : x,
    ),
  }));

  assert.equal(result.verdict, "DEGRADED");
  assert.equal(result.authority_state, "ELIGIBILITY_ONLY");
});

test("B-07e PASS remains non-Approval and creates no downstream authority", () => {
  const result = runDecisionEligibilityRuntimeV1(base());

  assert.equal(result.verdict, "PASS");
  assert.equal("approved" in result, false);
  assert.equal("approval_request_id" in result, false);
  assert.equal("operation_plan_id" in result, false);
  assert.equal("task_id" in result, false);
});

test("B-07e caller cannot supply alternate scope or candidate_ref fields to the runtime seam", () => {
  const result = runDecisionEligibilityRuntimeV1(base({
    scope: {
      tenant_id: "evil",
      project_id: "evil",
      group_id: "evil",
      field_id: "evil",
      season_id: "evil",
      zone_id: null,
    },
    candidate_ref: "candidate_decision_v1:evil",
  }));

  assert.deepEqual(result.scope, candidate.scope);
  assert.equal(result.inputs.candidate_ref, "candidate_decision_v1:candidate_001");
});
