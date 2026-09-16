import assert from "node:assert/strict";
import test from "node:test";

import {
  calculationResultV1Schema,
  candidateDecisionV1Schema,
} from "./canonical_decision_v1.js";

const scope = {
  tenant_id: "tenantA",
  project_id: "projectA",
  group_id: "groupA",
  field_id: "fieldA",
  season_id: "seasonA",
  zone_id: null,
};

const calculation = {
  schema_version: "calculation_result_v1" as const,
  calculation_id: "calc_irrigation_001",
  scope,
  calculator_ref: "irrigation_requirement_skill_v1",
  calculator_version: "v1",
  evidence_qualification_refs: ["evidence_qualification_v1:eq1"],
  context_snapshot_ref: "context_snapshot_v1:ctx1",
  crop_stage_state_ref: "qualified_crop_stage_state_v1:stage1",
  outputs: [
    { key: "irrigation_requirement_mm", value: 12, unit: "mm" },
  ],
  trace_refs: ["trace:calc1"],
  assumptions: ["ROOT_ZONE_DEPTH_DECLARED"],
  uncertainty: { level: "MEDIUM" as const, reasons: ["FORECAST_NOT_BOUND_IN_B06A"] },
  limitations: ["B06A_CONTRACT_ONLY"],
  evaluated_at: "2026-08-27T12:00:00.000Z",
  decision_time: "2026-08-27T12:00:00.000Z",
  authority_state: "CALCULATION_ONLY" as const,
};

const candidate = {
  schema_version: "candidate_decision_v1" as const,
  candidate_id: "candidate_irrigation_001",
  scope,
  source_ref: "decision_plan_v0:fact1",
  source_class: "LEGACY_DECISION_PLAN" as const,
  proposed_action: {
    action_type: "IRRIGATE",
    target: { kind: "field", ref: "fieldA" },
    parameters_hint: { water_mm: 12 },
    action_spec_ref: null,
  },
  basis: {
    evidence_qualification_refs: ["evidence_qualification_v1:eq1"],
    context_snapshot_ref: "context_snapshot_v1:ctx1",
    crop_stage_state_ref: null,
    calculation_result_refs: ["calculation_result_v1:calc1"],
    interpretation_refs: [],
    legacy_source_refs: ["fact:decision_plan_v0:1"],
  },
  confidence: 0.72,
  reasons: ["SOIL_WATER_DEFICIT"],
  limitations: ["LEGACY_DECISION_PLAN_ADAPTER_NOT_YET_IMPLEMENTED"],
  decision_time: "2026-08-27T12:00:00.000Z",
  created_at: "2026-08-27T12:00:01.000Z",
  authority_state: "CANDIDATE_ONLY" as const,
};

test("B-06a CalculationResult is calculator-only structured output", () => {
  const parsed = calculationResultV1Schema.parse(calculation);
  assert.equal(parsed.authority_state, "CALCULATION_ONLY");
  assert.equal(parsed.outputs[0]?.key, "irrigation_requirement_mm");
});

test("B-06a CalculationResult cannot smuggle a proposed action or approval", () => {
  const result = calculationResultV1Schema.safeParse({
    ...calculation,
    proposed_action: { action_type: "IRRIGATE" },
    approval_status: "APPROVED",
  });
  assert.equal(result.success, false);
});

test("B-06a CandidateDecision is explicitly candidate-only", () => {
  const parsed = candidateDecisionV1Schema.parse(candidate);
  assert.equal(parsed.authority_state, "CANDIDATE_ONLY");
  assert.equal(parsed.proposed_action.action_type, "IRRIGATE");
});

test("B-06a CandidateDecision cannot become approval, eligibility, plan or task by extra fields", () => {
  for (const extra of [
    { decision_eligibility: "PASS" },
    { approval_status: "APPROVED" },
    { operation_plan_id: "plan1" },
    { task_id: "task1" },
    { execute_now: true },
  ]) {
    const result = candidateDecisionV1Schema.safeParse({ ...candidate, ...extra });
    assert.equal(result.success, false, JSON.stringify(extra));
  }
});

test("B-06a CandidateDecision cannot claim downstream authority state", () => {
  const result = candidateDecisionV1Schema.safeParse({
    ...candidate,
    authority_state: "APPROVED",
  });
  assert.equal(result.success, false);
});

test("B-06a candidate parameters_hint cannot smuggle approval/execution authority", () => {
  for (const key of [
    "approval_status",
    "approved",
    "decision_eligibility",
    "execute_now",
    "execution_mode",
    "task_id",
    "authorization_id",
  ]) {
    const result = candidateDecisionV1Schema.safeParse({
      ...candidate,
      proposed_action: {
        ...candidate.proposed_action,
        parameters_hint: { water_mm: 12, [key]: true },
      },
    });
    assert.equal(result.success, false, key);
    assert.match(
      JSON.stringify(result.error?.issues),
      /B06_CANDIDATE_PARAMETERS_MUST_NOT_CARRY_DOWNSTREAM_AUTHORITY/,
    );
  }
});

test("B-06a legacy recommendation may be represented only as a candidate source class", () => {
  const parsed = candidateDecisionV1Schema.parse({
    ...candidate,
    candidate_id: "candidate_rec_001",
    source_ref: "recommendation_v1:rec1",
    source_class: "LEGACY_RECOMMENDATION",
    authority_state: "CANDIDATE_ONLY",
  });
  assert.equal(parsed.source_class, "LEGACY_RECOMMENDATION");
  assert.equal(parsed.authority_state, "CANDIDATE_ONLY");
});

test("B-06a prescription can only enter as candidate action-spec compatibility", () => {
  const parsed = candidateDecisionV1Schema.parse({
    ...candidate,
    candidate_id: "candidate_prc_001",
    source_ref: "prescription:prc1",
    source_class: "LEGACY_PRESCRIPTION_ACTION_SPEC",
    proposed_action: {
      ...candidate.proposed_action,
      action_spec_ref: "prescription:prc1",
    },
  });
  assert.equal(parsed.source_class, "LEGACY_PRESCRIPTION_ACTION_SPEC");
  assert.equal(parsed.authority_state, "CANDIDATE_ONLY");
});
