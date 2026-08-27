import assert from "node:assert/strict";
import test from "node:test";

import {
  decisionEligibilityDecisionV1Schema,
  decisionEligibilityVerdictV1Schema,
} from "./decision_eligibility_v1.js";

const base = {
  schema_version: "decision_eligibility_decision_v1" as const,
  eligibility_id: "eligibility_001",
  scope: {
    tenant_id: "tenantA",
    project_id: "projectA",
    group_id: "groupA",
    field_id: "fieldA",
    season_id: "seasonA",
    zone_id: null,
  },
  inputs: {
    candidate_ref: "candidate_decision_v1:candidate_001",
    evidence_qualification_refs: ["evidence_qualification_v1:eq1"],
    context_snapshot_ref: "context_snapshot_v1:ctx1",
    crop_stage_state_ref: "qualified_crop_stage_state_v1:stage1",
    state_refs: ["qualified_state_v1:state1"],
    forecast_refs: ["forecast_v1:forecast1"],
    scenario_refs: ["scenario_v1:scenario1"],
    knowledge_claim_refs: ["knowledge_claim_v1:claim1"],
    policy_refs: ["policy_v1:policy1"],
    permission_refs: ["permission_v1:permission1"],
    action_window_refs: ["action_window_v1:window1"],
  },
  criteria: [
    {
      criterion: "QUALIFIED_EVIDENCE" as const,
      status: "SATISFIED" as const,
      reason_codes: [],
      support_refs: ["evidence_qualification_v1:eq1"],
    },
    {
      criterion: "ACTION_WINDOW" as const,
      status: "SATISFIED" as const,
      reason_codes: [],
      support_refs: ["action_window_v1:window1"],
    },
  ],
  verdict: "PASS" as const,
  reason_codes: [],
  limitations: [],
  remaining_uncertainty: [],
  lifecycle_state: "ACTIVE" as const,
  evaluated_at: "2026-08-28T00:30:00+08:00",
  decision_time: "2026-08-28T00:29:00+08:00",
  authority_state: "ELIGIBILITY_ONLY" as const,
};

test("B-07a normative eligibility verdict set is exact", () => {
  for (const verdict of ["PASS", "DEGRADED", "NEED_EVIDENCE", "HUMAN_REVIEW", "BLOCK"]) {
    assert.equal(decisionEligibilityVerdictV1Schema.parse(verdict), verdict);
  }

  for (const invalid of ["EXPIRED", "ELIGIBLE", "NOT_ELIGIBLE", "NEEDS_EVIDENCE", "BLOCKED", "APPROVED"]) {
    assert.throws(() => decisionEligibilityVerdictV1Schema.parse(invalid));
  }
});

test("B-07a EXPIRED belongs to lifecycle rather than verdict", () => {
  const parsed = decisionEligibilityDecisionV1Schema.parse({
    ...base,
    verdict: "NEED_EVIDENCE",
    lifecycle_state: "EXPIRED",
    reason_codes: ["ACTION_WINDOW_EXPIRED"],
  });

  assert.equal(parsed.lifecycle_state, "EXPIRED");
  assert.equal(parsed.verdict, "NEED_EVIDENCE");
  assert.throws(() => decisionEligibilityDecisionV1Schema.parse({
    ...base,
    verdict: "EXPIRED",
  }));
});

test("B-07a degraded evidence can yield DEGRADED without automatic BLOCK", () => {
  const parsed = decisionEligibilityDecisionV1Schema.parse({
    ...base,
    criteria: [
      {
        criterion: "QUALIFIED_EVIDENCE",
        status: "DEGRADED",
        reason_codes: ["RH_INVALID_BUT_INDEPENDENT_WATER_EVIDENCE_REMAINS"],
        support_refs: [
          "evidence_qualification_v1:pressure",
          "evidence_qualification_v1:cumulative_meter",
        ],
      },
      {
        criterion: "INDEPENDENT_EVIDENCE_SUPPORT",
        status: "SATISFIED",
        reason_codes: [],
        support_refs: ["evidence_qualification_v1:pressure"],
      },
    ],
    verdict: "DEGRADED",
    reason_codes: ["REQUIRED_DECISION_CLAIMS_REMAIN_SUPPORTED"],
    limitations: ["ONE_SENSOR_INVALID"],
    remaining_uncertainty: ["RELATIVE_HUMIDITY_UNAVAILABLE"],
  });

  assert.equal(parsed.verdict, "DEGRADED");
  assert.equal(parsed.authority_state, "ELIGIBILITY_ONLY");
});

test("B-07a candidate is referenced, not replaced or approved", () => {
  const parsed = decisionEligibilityDecisionV1Schema.parse(base);

  assert.equal(parsed.inputs.candidate_ref, "candidate_decision_v1:candidate_001");
  assert.equal(parsed.authority_state, "ELIGIBILITY_ONLY");
  assert.equal("candidate" in parsed, false);
  assert.equal("approval" in parsed, false);
  assert.equal("approved" in parsed, false);
  assert.equal("operation_plan" in parsed, false);
  assert.equal("task" in parsed, false);
});

test("B-07a canonical decision inputs remain typed references", () => {
  const parsed = decisionEligibilityDecisionV1Schema.parse(base);

  assert.deepEqual(parsed.inputs.evidence_qualification_refs, ["evidence_qualification_v1:eq1"]);
  assert.equal(parsed.inputs.context_snapshot_ref, "context_snapshot_v1:ctx1");
  assert.equal(parsed.inputs.crop_stage_state_ref, "qualified_crop_stage_state_v1:stage1");
  assert.deepEqual(parsed.inputs.state_refs, ["qualified_state_v1:state1"]);
  assert.deepEqual(parsed.inputs.forecast_refs, ["forecast_v1:forecast1"]);
  assert.deepEqual(parsed.inputs.scenario_refs, ["scenario_v1:scenario1"]);
  assert.deepEqual(parsed.inputs.knowledge_claim_refs, ["knowledge_claim_v1:claim1"]);
  assert.deepEqual(parsed.inputs.policy_refs, ["policy_v1:policy1"]);
  assert.deepEqual(parsed.inputs.permission_refs, ["permission_v1:permission1"]);
  assert.deepEqual(parsed.inputs.action_window_refs, ["action_window_v1:window1"]);
});

test("B-07a criterion vocabulary covers Amendment-01 factors", () => {
  const criteria = [
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
  ];

  for (const criterion of criteria) {
    const parsed = decisionEligibilityDecisionV1Schema.parse({
      ...base,
      criteria: [{
        criterion,
        status: "UNKNOWN",
        reason_codes: ["TEST"],
        support_refs: [],
      }],
      verdict: "HUMAN_REVIEW",
    });
    assert.equal(parsed.criteria[0]?.criterion, criterion);
  }
});

test("B-07a strict schema rejects downstream authority contamination", () => {
  for (const extra of [
    { approval_request_id: "apr1" },
    { approved: true },
    { operation_plan_id: "opl1" },
    { task_id: "task1" },
    { execution_authorized: true },
    { device_command: "START" },
  ]) {
    assert.throws(() => decisionEligibilityDecisionV1Schema.parse({
      ...base,
      ...extra,
    }));
  }
});

test("B-07a strict input refs reject raw evidence shortcuts", () => {
  assert.throws(() => decisionEligibilityDecisionV1Schema.parse({
    ...base,
    inputs: {
      ...base.inputs,
      raw_evidence_refs: ["raw_fact:1"],
    },
  }));
});

test("B-07a criteria are required and authority state is fixed", () => {
  assert.throws(() => decisionEligibilityDecisionV1Schema.parse({
    ...base,
    criteria: [],
  }));

  assert.throws(() => decisionEligibilityDecisionV1Schema.parse({
    ...base,
    authority_state: "APPROVED",
  }));
});

test("B-07a timestamps require offset-aware ISO datetimes", () => {
  assert.throws(() => decisionEligibilityDecisionV1Schema.parse({
    ...base,
    evaluated_at: "2026-08-28T00:30:00",
  }));
});
