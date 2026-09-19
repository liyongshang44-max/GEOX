import assert from "node:assert/strict";
import test from "node:test";

import { projectLegacyRecommendationCandidateV1 } from "./legacy_recommendation_candidate_adapter_v1.js";

const scope = {
  tenant_id: "tenantA",
  project_id: "projectA",
  group_id: "groupA",
  field_id: "fieldA",
  season_id: "seasonA",
  zone_id: null,
};

const context = {
  candidate_id: "candidate_legacy_001",
  source_ref: "fact:decision_recommendation_v1:rec1",
  source_type: "decision_recommendation_v1" as const,
  scope,
  evidence_qualification_refs: ["evidence_qualification_v1:eq1"],
  context_snapshot_ref: "context_snapshot_v1:ctx1",
  crop_stage_state_ref: "qualified_crop_stage_state_v1:stage1",
  calculation_result_refs: ["calculation_result_v1:calc1"],
  interpretation_refs: [],
  created_at: "2026-08-27T14:30:00.000Z",
  decision_time: "2026-08-27T14:29:00.000Z",
};

test("B-06c decision_recommendation projects as candidate-only", () => {
  const projected = projectLegacyRecommendationCandidateV1({
    tenant_id: "tenantA",
    project_id: "projectA",
    group_id: "groupA",
    field_id: "fieldA",
    season_id: "seasonA",
    recommendation_id: "rec1",
    action_type: "IRRIGATE",
    status: "proposed",
    reason_codes: ["SOIL_WATER_DEFICIT"],
    confidence: 0.8,
    evidence_refs: ["raw_fact:legacy1"],
    suggested_action: {
      action_type: "irrigation.start",
      parameters: { amount: 12, unit: "mm" },
    },
    created_ts: 1787841000000,
  }, context);

  assert.equal(projected.authority_state, "CANDIDATE_ONLY");
  assert.equal(projected.source_class, "LEGACY_RECOMMENDATION");
  assert.equal(projected.proposed_action.action_type, "IRRIGATE");
  assert.equal(projected.proposed_action.parameters_hint.amount, 12);
  assert.equal(projected.proposed_action.parameters_hint.unit, "mm");
  assert.equal(projected.limitations.includes("LEGACY_SUGGESTED_ACTION_TYPE_NOT_USED_AS_CANONICAL_ACTION_TYPE"), true);
  assert.equal("approval_status" in projected, false);
  assert.equal("operation_plan_id" in projected, false);
  assert.equal("task_id" in projected, false);
});

test("B-06c legacy evidence refs are not upgraded into canonical qualification refs", () => {
  const projected = projectLegacyRecommendationCandidateV1({
    action_type: "IRRIGATE",
    status: "proposed",
    evidence_refs: ["raw_fact:must_not_promote"],
    reason_codes: [],
  }, context);

  assert.deepEqual(projected.basis.evidence_qualification_refs, ["evidence_qualification_v1:eq1"]);
  assert.equal(projected.basis.evidence_qualification_refs.includes("raw_fact:must_not_promote"), false);
  assert.equal(projected.limitations.includes("LEGACY_EVIDENCE_REFS_NOT_PROMOTED_TO_CANONICAL_QUALIFICATION"), true);
});

test("B-06c source carrying downstream plan/task authority fails closed", () => {
  for (const source of [
    { action_type: "IRRIGATE", status: "proposed", operation_plan_id: "plan1" },
    { action_type: "IRRIGATE", status: "proposed", task_created: true },
    { action_type: "IRRIGATE", status: "proposed", receipt_fact_id: "receipt1" },
  ]) {
    assert.throws(
      () => projectLegacyRecommendationCandidateV1(source, context),
      /B06C_SOURCE_ALREADY_CARRIES_DOWNSTREAM_AUTHORITY/,
    );
  }
});

test("B-06c non-candidate decision_recommendation status fails closed", () => {
  for (const status of ["approved", "rejected", "executed", ""]) {
    assert.throws(
      () => projectLegacyRecommendationCandidateV1({
        action_type: "IRRIGATE",
        status,
      }, context),
      /B06C_DECISION_RECOMMENDATION_STATUS_NOT_CANDIDATE/,
    );
  }
});

test("B-06c recommendation_v1 may preserve historical missing status only as candidate compatibility", () => {
  const projected = projectLegacyRecommendationCandidateV1({
    action_type: "INSPECT",
    reason_codes: ["FIELD_INSPECTION"],
  }, {
    ...context,
    candidate_id: "candidate_legacy_002",
    source_ref: "fact:recommendation_v1:rec2",
    source_type: "recommendation_v1",
  });

  assert.equal(projected.authority_state, "CANDIDATE_ONLY");
  assert.equal(projected.proposed_action.action_type, "INSPECT");
  assert.equal(projected.limitations.includes("LEGACY_RECOMMENDATION_STATUS_ABSENT"), true);
});

test("B-06c nested legacy parameters are not promoted into scalar parameters_hint", () => {
  const projected = projectLegacyRecommendationCandidateV1({
    action_type: "IRRIGATE",
    status: "proposed",
    suggested_action: {
      parameters: {
        amount: 10,
        metadata: { source: "legacy" },
        options: ["a", "b"],
      },
    },
  }, context);

  assert.equal(projected.proposed_action.parameters_hint.amount, 10);
  assert.equal("metadata" in projected.proposed_action.parameters_hint, false);
  assert.equal("options" in projected.proposed_action.parameters_hint, false);
  assert.equal(projected.limitations.includes("LEGACY_NESTED_PARAMETERS_NOT_PROMOTED_TO_PARAMETERS_HINT"), true);
});

test("B-06c downstream authority token in scalar parameters_hint is rejected by CandidateDecision schema", () => {
  assert.throws(
    () => projectLegacyRecommendationCandidateV1({
      action_type: "IRRIGATE",
      status: "proposed",
      suggested_action: {
        parameters: {
          amount: 10,
          approved: true,
        },
      },
    }, context),
    /B06_CANDIDATE_PARAMETERS_MUST_NOT_CARRY_DOWNSTREAM_AUTHORITY/,
  );
});

test("B-06c source scope mismatch fails closed", () => {
  assert.throws(
    () => projectLegacyRecommendationCandidateV1({
      tenant_id: "tenantB",
      action_type: "IRRIGATE",
      status: "proposed",
    }, context),
    /B06C_SOURCE_SCOPE_MISMATCH:tenant_id/,
  );
});
