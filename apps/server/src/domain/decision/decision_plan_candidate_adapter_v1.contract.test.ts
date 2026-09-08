import assert from "node:assert/strict";
import test from "node:test";

import { projectDecisionPlanCandidateV1 } from "./decision_plan_candidate_adapter_v1.js";

const scope = {
  tenant_id: "tenantA",
  project_id: "projectA",
  group_id: "groupA",
  field_id: "fieldA",
  season_id: "seasonA",
  zone_id: null,
};

const context = {
  candidate_id: "candidate_plan_001",
  source_ref: "fact:decision_plan_v0:plan1",
  scope,
  evidence_qualification_refs: ["evidence_qualification_v1:eq1"],
  context_snapshot_ref: "context_snapshot_v1:ctx1",
  crop_stage_state_ref: "qualified_crop_stage_state_v1:stage1",
  calculation_result_refs: ["calculation_result_v1:calc1"],
  interpretation_refs: ["agronomy_interpretation_v1:int1"],
  created_at: "2026-08-27T15:30:00.000Z",
  decision_time: "2026-08-27T15:29:00.000Z",
};

const decisionPlan = {
  type: "decision_plan_v0",
  payload: {
    subject_ref: { groupId: "groupA" },
    proposed_action: {
      action_type: "IRRIGATE",
      target: { kind: "field", ref: "fieldA" },
      parameters_hint: { water_mm: 12 },
    },
    based_on: {
      evidence_refs: [{ fact_id: "raw_fact_1" }],
    },
    decision_scope: "proposal",
    confidence: 0.7,
    created_at_ts: 1787844600000,
    meta: {},
  },
};

test("B-06d decision_plan_v0 projects only as CandidateDecision", () => {
  const projected = projectDecisionPlanCandidateV1(decisionPlan, context);

  assert.equal(projected.authority_state, "CANDIDATE_ONLY");
  assert.equal(projected.source_class, "LEGACY_DECISION_PLAN");
  assert.equal(projected.proposed_action.action_type, "IRRIGATE");
  assert.equal(projected.proposed_action.target.ref, "fieldA");
  assert.equal(projected.proposed_action.parameters_hint.water_mm, 12);
  assert.equal("approval_status" in projected, false);
  assert.equal("operation_plan_id" in projected, false);
  assert.equal("task_id" in projected, false);
});

test("B-06d legacy based_on evidence stays provenance-only", () => {
  const projected = projectDecisionPlanCandidateV1(decisionPlan, context);

  assert.deepEqual(projected.basis.evidence_qualification_refs, ["evidence_qualification_v1:eq1"]);
  assert.equal(projected.basis.evidence_qualification_refs.includes("raw_fact_1"), false);
  assert.equal(projected.basis.legacy_source_refs.includes("raw_fact_1"), true);
  assert.equal(projected.limitations.includes("LEGACY_EVIDENCE_REFS_NOT_PROMOTED_TO_CANONICAL_QUALIFICATION"), true);
});

test("B-06d decision_scope must explicitly remain proposal", () => {
  for (const decision_scope of ["", "approved", "execute", "plan"]) {
    assert.throws(
      () => projectDecisionPlanCandidateV1({
        ...decisionPlan,
        payload: { ...decisionPlan.payload, decision_scope },
      }, context),
      /B06D_DECISION_SCOPE_MUST_BE_PROPOSAL/,
    );
  }
});

test("B-06d execution/status/trigger semantics fail closed", () => {
  for (const extra of [
    { status: "approved" },
    { priority: "high" },
    { trigger: "automatic" },
    { execution_time: "2026-08-27T16:00:00Z" },
    { auto_execute: true },
    { executor: "pump1" },
  ]) {
    assert.throws(
      () => projectDecisionPlanCandidateV1({
        ...decisionPlan,
        payload: { ...decisionPlan.payload, ...extra },
      }, context),
      /B06D_DECISION_PLAN_FORBIDDEN_SEMANTIC/,
    );
  }
});

test("B-06d field and group scope mismatches fail closed", () => {
  assert.throws(
    () => projectDecisionPlanCandidateV1({
      ...decisionPlan,
      payload: {
        ...decisionPlan.payload,
        subject_ref: { groupId: "groupB" },
      },
    }, context),
    /B06D_SUBJECT_GROUP_SCOPE_MISMATCH/,
  );

  assert.throws(
    () => projectDecisionPlanCandidateV1({
      ...decisionPlan,
      payload: {
        ...decisionPlan.payload,
        proposed_action: {
          ...decisionPlan.payload.proposed_action,
          target: { kind: "field", ref: "fieldB" },
        },
      },
    }, context),
    /B06D_TARGET_FIELD_SCOPE_MISMATCH/,
  );
});

test("B-06d nested parameters are not promoted to scalar parameters_hint", () => {
  const projected = projectDecisionPlanCandidateV1({
    ...decisionPlan,
    payload: {
      ...decisionPlan.payload,
      proposed_action: {
        ...decisionPlan.payload.proposed_action,
        parameters_hint: {
          water_mm: 12,
          nested: { source: "legacy" },
          list: [1, 2],
        },
      },
    },
  }, context);

  assert.equal(projected.proposed_action.parameters_hint.water_mm, 12);
  assert.equal("nested" in projected.proposed_action.parameters_hint, false);
  assert.equal("list" in projected.proposed_action.parameters_hint, false);
  assert.equal(projected.limitations.includes("LEGACY_NESTED_PARAMETERS_NOT_PROMOTED_TO_PARAMETERS_HINT"), true);
});

test("B-06d downstream-authority parameter keys remain rejected by CandidateDecision schema", () => {
  assert.throws(
    () => projectDecisionPlanCandidateV1({
      ...decisionPlan,
      payload: {
        ...decisionPlan.payload,
        proposed_action: {
          ...decisionPlan.payload.proposed_action,
          parameters_hint: {
            water_mm: 12,
            approved: true,
          },
        },
      },
    }, context),
    /B06_CANDIDATE_PARAMETERS_MUST_NOT_CARRY_DOWNSTREAM_AUTHORITY/,
  );
});

test("B-06d legacy timestamp is not silently promoted as canonical created_at", () => {
  const projected = projectDecisionPlanCandidateV1(decisionPlan, context);

  assert.equal(projected.created_at, context.created_at);
  assert.equal(projected.limitations.includes("LEGACY_CREATED_AT_TS_NOT_USED_AS_CANONICAL_CREATED_AT"), true);
});

test("B-06d wrong record type or incomplete proposed_action fails closed", () => {
  assert.throws(
    () => projectDecisionPlanCandidateV1({ ...decisionPlan, type: "operation_plan_v1" }, context),
    /B06D_SOURCE_TYPE_NOT_DECISION_PLAN_V0/,
  );

  assert.throws(
    () => projectDecisionPlanCandidateV1({
      ...decisionPlan,
      payload: {
        ...decisionPlan.payload,
        proposed_action: { action_type: "IRRIGATE" },
      },
    }, context),
    /B06D_PROPOSED_ACTION_INCOMPLETE/,
  );
});
