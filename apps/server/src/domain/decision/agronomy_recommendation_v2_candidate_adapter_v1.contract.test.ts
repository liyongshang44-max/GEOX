import assert from "node:assert/strict";
import test from "node:test";

import { projectAgronomyRecommendationV2CandidateV1 } from "./agronomy_recommendation_v2_candidate_adapter_v1.js";

const scope = {
  tenant_id: "tenantA",
  project_id: "projectA",
  group_id: "groupA",
  field_id: "fieldA",
  season_id: "seasonA",
  zone_id: null,
};

const context = {
  candidate_id: "candidate_rule_001",
  source_ref: "rule_engine:recommendation:rec_001",
  scope,
  evidence_qualification_refs: ["evidence_qualification_v1:eq1"],
  context_snapshot_ref: "context_snapshot_v1:ctx1",
  crop_stage_state_ref: "qualified_crop_stage_state_v1:stage1",
  calculation_result_refs: ["calculation_result_v1:calc1"],
  interpretation_refs: [],
  created_at: "2026-08-27T17:00:00.000Z",
  decision_time: "2026-08-27T16:59:00.000Z",
};

function recommendation(overrides: Record<string, unknown> = {}) {
  return {
    recommendation_id: "rec_001",
    crop_code: "corn",
    crop_stage: "seedling",
    rule_id: "corn_water_balance_v2",
    action_type: "IRRIGATE",
    confidence: 0.8,
    reasons: ["SOIL_DEFICIT"],
    reason_codes: ["SOIL_DEFICIT"],
    expected_effect: [
      { metric: "soil_moisture", direction: "increase", value: 0.04 },
    ],
    evidence_basis: {
      snapshot_id: "legacy_snapshot_1",
      telemetry_refs: ["telemetry:soil_moisture"],
    },
    skill_trace: {
      skill_id: "corn_water_balance_v2",
      trace_id: "trace_001",
      confidence: {
        level: "MEDIUM",
        basis: "estimated",
        reasons: ["rule_skill_match"],
      },
      evidence_refs: ["fact:legacy_skill_evidence_1"],
    },
    ...overrides,
  };
}

test("B-06g AgronomyRecommendationV2 projects only to CandidateDecision", () => {
  const projected = projectAgronomyRecommendationV2CandidateV1(recommendation(), context);

  assert.equal(projected.authority_state, "CANDIDATE_ONLY");
  assert.equal(projected.source_class, "LEGACY_RECOMMENDATION");
  assert.equal(projected.proposed_action.action_type, "IRRIGATE");
  assert.equal(projected.proposed_action.target.ref, "fieldA");
  assert.deepEqual(projected.proposed_action.parameters_hint, {});
  assert.equal(projected.confidence, 0.8);
  assert.deepEqual(projected.reasons, ["SOIL_DEFICIT"]);
  assert.equal("approval_request_id" in projected, false);
  assert.equal("operation_plan_id" in projected, false);
});

test("B-06g runtime action allowlist matches AgronomyRecommendationV2 contract", () => {
  for (const action_type of ["IRRIGATE", "FERTILIZE", "INSPECT", "WAIT"]) {
    const projected = projectAgronomyRecommendationV2CandidateV1(
      recommendation({ action_type, recommendation_id: "rec_" + action_type }),
      { ...context, candidate_id: "candidate_" + action_type, source_ref: "rule:" + action_type },
    );
    assert.equal(projected.proposed_action.action_type, action_type);
  }

  for (const action_type of ["SPRAY", "EXECUTE", "OTHER", ""]) {
    assert.throws(
      () => projectAgronomyRecommendationV2CandidateV1(recommendation({ action_type }), context),
      /B06G_RULE_ENGINE_ACTION_NOT_ALLOWED|B06G_REQUIRED_SOURCE_FIELD_MISSING:action_type/,
    );
  }
});

test("B-06g legacy crop/stage labels never become canonical stage or context authority", () => {
  const projected = projectAgronomyRecommendationV2CandidateV1(
    recommendation({ crop_code: "corn", crop_stage: "seedling" }),
    context,
  );

  assert.equal(projected.basis.crop_stage_state_ref, "qualified_crop_stage_state_v1:stage1");
  assert.equal(projected.basis.context_snapshot_ref, "context_snapshot_v1:ctx1");
  assert.equal(projected.limitations.includes("LEGACY_RULE_ENGINE_CROP_STAGE_NOT_CANONICAL_STAGE_AUTHORITY"), true);
  assert.equal(projected.limitations.includes("LEGACY_RULE_ENGINE_CROP_CODE_NOT_CANONICAL_CONTEXT_AUTHORITY"), true);
  assert.equal("crop_stage" in projected.proposed_action.parameters_hint, false);
  assert.equal("crop_code" in projected.proposed_action.parameters_hint, false);
});

test("B-06g snapshot and telemetry refs remain legacy provenance only", () => {
  const projected = projectAgronomyRecommendationV2CandidateV1(recommendation(), context);

  assert.deepEqual(projected.basis.evidence_qualification_refs, ["evidence_qualification_v1:eq1"]);
  assert.equal(projected.basis.legacy_source_refs.includes("legacy_snapshot:legacy_snapshot_1"), true);
  assert.equal(projected.basis.legacy_source_refs.includes("legacy_telemetry:telemetry:soil_moisture"), true);
  assert.equal(projected.basis.evidence_qualification_refs.includes("telemetry:soil_moisture"), false);
  assert.equal(projected.limitations.includes("LEGACY_SNAPSHOT_NOT_PROMOTED_TO_CONTEXT_SNAPSHOT"), true);
  assert.equal(projected.limitations.includes("LEGACY_TELEMETRY_REFS_NOT_PROMOTED_TO_CANONICAL_QUALIFICATION"), true);
});

test("B-06g SkillTrace evidence and confidence do not gain canonical authority", () => {
  const projected = projectAgronomyRecommendationV2CandidateV1(recommendation(), context);

  assert.equal(projected.basis.legacy_source_refs.includes("legacy_skill_evidence:fact:legacy_skill_evidence_1"), true);
  assert.equal(projected.basis.evidence_qualification_refs.includes("fact:legacy_skill_evidence_1"), false);
  assert.equal(projected.basis.legacy_source_refs.includes("skill:corn_water_balance_v2"), true);
  assert.equal(projected.basis.legacy_source_refs.includes("skill_trace:trace_001"), true);
  assert.equal(projected.limitations.includes("LEGACY_SKILL_TRACE_EVIDENCE_NOT_PROMOTED_TO_CANONICAL_QUALIFICATION"), true);
  assert.equal(projected.limitations.includes("LEGACY_SKILL_TRACE_CONFIDENCE_NOT_USED_AS_CANDIDATE_CONFIDENCE"), true);
});

test("B-06g expected_effect does not become parameters or CalculationResult", () => {
  const projected = projectAgronomyRecommendationV2CandidateV1(recommendation(), context);

  assert.deepEqual(projected.proposed_action.parameters_hint, {});
  assert.deepEqual(projected.basis.calculation_result_refs, ["calculation_result_v1:calc1"]);
  assert.equal(projected.limitations.includes("LEGACY_EXPECTED_EFFECT_NOT_PROMOTED_TO_CALCULATION_RESULT"), true);
});

test("B-06g invalid legacy confidence is not promoted", () => {
  for (const confidence of [NaN, -0.1, 1.1, Infinity]) {
    const projected = projectAgronomyRecommendationV2CandidateV1(recommendation({ confidence }), context);
    assert.equal(projected.confidence, null);
    assert.equal(projected.limitations.includes("LEGACY_CONFIDENCE_INVALID_NOT_PROMOTED"), true);
  }
});

test("B-06g required rule-engine source fields fail closed", () => {
  for (const key of ["recommendation_id", "crop_code", "crop_stage", "rule_id"] as const) {
    assert.throws(
      () => projectAgronomyRecommendationV2CandidateV1(recommendation({ [key]: "" }), context),
      new RegExp("B06G_REQUIRED_SOURCE_FIELD_MISSING:" + key),
    );
  }

  assert.throws(
    () => projectAgronomyRecommendationV2CandidateV1(recommendation({ reasons: [] }), context),
    /B06G_RULE_ENGINE_REASONS_REQUIRED/,
  );
});

test("B-06g unexpected downstream authority fields fail closed", () => {
  for (const extra of [
    { approval_request_id: "apr1" },
    { operation_plan_id: "opl1" },
    { act_task_id: "task1" },
    { receipt_fact_id: "receipt1" },
    { task_created: true },
  ]) {
    assert.throws(
      () => projectAgronomyRecommendationV2CandidateV1(recommendation(extra), context),
      /B06G_SOURCE_ALREADY_CARRIES_DOWNSTREAM_AUTHORITY/,
    );
  }
});

test("B-06g canonical field scope is explicit because source recommendation embeds no field scope", () => {
  assert.throws(
    () => projectAgronomyRecommendationV2CandidateV1(
      recommendation(),
      { ...context, scope: { ...scope, field_id: "" } },
    ),
    /B06G_CANONICAL_FIELD_SCOPE_REQUIRED/,
  );

  const projected = projectAgronomyRecommendationV2CandidateV1(recommendation(), context);
  assert.equal(projected.limitations.includes("LEGACY_RULE_ENGINE_SCOPE_NOT_EMBEDDED_CANONICAL_SCOPE_EXPLICIT"), true);
});

test("B-06g contract reasons win over runtime reason_codes extension", () => {
  const projected = projectAgronomyRecommendationV2CandidateV1(
    recommendation({ reasons: ["CONTRACT_REASON"], reason_codes: ["LEGACY_EXTENSION_REASON"] }),
    context,
  );

  assert.deepEqual(projected.reasons, ["CONTRACT_REASON"]);
  assert.equal(projected.limitations.includes("LEGACY_REASON_CODES_EXTENSION_NOT_USED_OVER_CONTRACT_REASONS"), true);
});
