import assert from "node:assert/strict";
import test from "node:test";

import type { AgronomyRecommendationV2 } from "@geox/contracts";

import { projectRuleEngineRecommendationCandidateV1 } from "./rule_engine_candidate_adapter_v1.js";

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
  source_ref: "rule_engine:rec_rule_001",
  scope,
  evidence_qualification_refs: ["evidence_qualification_v1:eq1"],
  context_snapshot_ref: "context_snapshot_v1:ctx1",
  crop_stage_state_ref: "qualified_crop_stage_state_v1:stage1",
  calculation_result_refs: ["calculation_result_v1:calc1"],
  interpretation_refs: ["interpretation:rule1"],
  created_at: "2026-08-27T15:00:00.000Z",
  decision_time: "2026-08-27T14:59:00.000Z",
};

function recommendation(overrides: Partial<AgronomyRecommendationV2> = {}): AgronomyRecommendationV2 {
  return {
    recommendation_id: "rec_rule_001",
    crop_code: "corn",
    crop_stage: "vegetative",
    rule_id: "corn_irrigation_v1",
    action_type: "IRRIGATE",
    confidence: 0.8,
    reasons: ["SOIL_WATER_DEFICIT"],
    expected_effect: [
      { metric: "soil_moisture", direction: "increase", value: 0.03, unit: "ratio" },
    ],
    evidence_basis: {
      snapshot_id: "legacy_snapshot_1",
      telemetry_refs: ["telemetry:soil_moisture"],
    },
    ...overrides,
  };
}

test("B-06d Rule Engine recommendation projects as candidate-only", () => {
  const projected = projectRuleEngineRecommendationCandidateV1(recommendation(), context);

  assert.equal(projected.authority_state, "CANDIDATE_ONLY");
  assert.equal(projected.source_class, "LEGACY_RECOMMENDATION");
  assert.equal(projected.proposed_action.action_type, "IRRIGATE");
  assert.equal(projected.proposed_action.target.ref, "fieldA");
  assert.deepEqual(projected.proposed_action.parameters_hint, {});
  assert.equal("approval_status" in projected, false);
  assert.equal("operation_plan_id" in projected, false);
  assert.equal("task_id" in projected, false);
});

test("B-06d legacy telemetry refs are not promoted into EvidenceQualification refs", () => {
  const projected = projectRuleEngineRecommendationCandidateV1(recommendation(), context);

  assert.deepEqual(projected.basis.evidence_qualification_refs, ["evidence_qualification_v1:eq1"]);
  assert.equal(projected.basis.evidence_qualification_refs.includes("telemetry:soil_moisture"), false);
  assert.equal(
    projected.limitations.includes("LEGACY_TELEMETRY_REFS_NOT_PROMOTED_TO_CANONICAL_QUALIFICATION"),
    true,
  );
});

test("B-06d expected effect is not promoted into action parameters", () => {
  const projected = projectRuleEngineRecommendationCandidateV1(recommendation(), context);

  assert.deepEqual(projected.proposed_action.parameters_hint, {});
  assert.equal(
    projected.limitations.includes("LEGACY_EXPECTED_EFFECT_NOT_PROMOTED_TO_ACTION_PARAMETERS"),
    true,
  );
});

test("B-06d legacy crop code/stage remain non-authoritative compatibility metadata", () => {
  const projected = projectRuleEngineRecommendationCandidateV1(recommendation(), context);

  assert.equal(
    projected.limitations.includes("LEGACY_CROP_CODE_NOT_PROMOTED_TO_CANONICAL_CONTEXT_AUTHORITY"),
    true,
  );
  assert.equal(
    projected.limitations.includes("LEGACY_CROP_STAGE_NOT_PROMOTED_TO_CANONICAL_STAGE_AUTHORITY"),
    true,
  );
  assert.equal(projected.basis.context_snapshot_ref, "context_snapshot_v1:ctx1");
  assert.equal(projected.basis.crop_stage_state_ref, "qualified_crop_stage_state_v1:stage1");
});

test("B-06d invalid legacy action type fails closed", () => {
  assert.throws(
    () => projectRuleEngineRecommendationCandidateV1(
      recommendation({ action_type: "EXECUTE" as AgronomyRecommendationV2["action_type"] }),
      context,
    ),
    /B06D_RULE_ACTION_TYPE_INVALID/,
  );
});

test("B-06d invalid legacy confidence fails closed", () => {
  for (const confidence of [-0.1, 1.1, Number.NaN]) {
    assert.throws(
      () => projectRuleEngineRecommendationCandidateV1(recommendation({ confidence }), context),
      /B06D_RULE_CONFIDENCE_INVALID/,
    );
  }
});

test("B-06d missing canonical field scope fails closed", () => {
  assert.throws(
    () => projectRuleEngineRecommendationCandidateV1(recommendation(), {
      ...context,
      scope: { ...scope, field_id: null },
    }),
    /B06D_CANONICAL_FIELD_SCOPE_REQUIRED/,
  );
});

test("B-06d canonical provenance refs are explicit caller inputs", () => {
  const projected = projectRuleEngineRecommendationCandidateV1(recommendation({
    evidence_basis: {
      snapshot_id: "legacy_snapshot_should_not_be_promoted",
      telemetry_refs: [],
    },
  }), {
    ...context,
    evidence_qualification_refs: [],
    context_snapshot_ref: null,
    crop_stage_state_ref: null,
    calculation_result_refs: [],
  });

  assert.deepEqual(projected.basis.evidence_qualification_refs, []);
  assert.equal(projected.basis.context_snapshot_ref, null);
  assert.equal(projected.basis.crop_stage_state_ref, null);
  assert.deepEqual(projected.basis.calculation_result_refs, []);
});

test("B-06d skill trace does not become canonical basis implicitly", () => {
  const projected = projectRuleEngineRecommendationCandidateV1(recommendation({
    skill_trace: {
      skill_id: "rule_skill_v1",
      skill_version: "v1",
      inputs: {},
      outputs: {},
      confidence: { level: "MEDIUM", basis: "estimated", reasons: [] },
      evidence_refs: ["legacy:trace-evidence"],
    },
  }), context);

  assert.equal(
    projected.limitations.includes("LEGACY_SKILL_TRACE_NOT_PROMOTED_TO_CANONICAL_BASIS"),
    true,
  );
  assert.equal(projected.basis.interpretation_refs.includes("legacy:trace-evidence"), false);
});
