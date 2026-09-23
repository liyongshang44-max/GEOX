import assert from "node:assert/strict";
import test from "node:test";

import { runIrrigationRequirementSkillV1 } from "../agronomy/skills/irrigation/irrigation_requirement_skill_v1.js";
import { evaluateAgronomyJudgeV2 } from "../judge/agronomy_judge_v2.js";
import { buildJudgeResultV2 } from "../judge/judge_result_v2.js";
import type { AgronomyEvidenceDependencyShadowBindingV1 } from "./agronomy_evidence_dependency_shadow_binding_v1.js";
import { projectAgronomyQualifiedEvidenceCriterionShadowV1 } from "./agronomy_qualified_evidence_criterion_shadow_v1.js";
import {
  projectDecisionRecommendationCandidateCriterionShadowBindingV1,
} from "./decision_recommendation_candidate_criterion_shadow_binding_v1.js";
import {
  deriveIrrigateStateCalculationIdentityV1,
  projectIrrigateStateCalculationShadowBindingV1,
} from "./irrigate_state_calculation_shadow_binding_v1.js";

const input = {
  tenant_id: "tenantA",
  project_id: "projectA",
  group_id: "groupA",
  field_id: "fieldA",
  season_id: "seasonA",
  device_id: "deviceA",
  recommendation_id: "rec_A",
  soil_moisture: 0.18,
  target_soil_moisture: 0.22,
  root_zone_depth_mm: 300,
  rain_forecast_mm_72h: 0,
  et0_mm_72h: 5,
  crop_stage: "vegetative",
  application_efficiency: 0.85,
};

function evidenceBinding(): AgronomyEvidenceDependencyShadowBindingV1 {
  return {
    schema_version: "agronomy_evidence_dependency_shadow_binding_v1",
    authority_mode: "SHADOW_NON_AUTHORITATIVE",
    binding_state: "BOUND",
    evidence_judge_id: "ej1",
    evidence_judge_ref: "judge_result_v2:ej1",
    requested_field_id: "fieldA",
    persisted_field_id: "fieldA",
    request_legacy_verdict: "PASS",
    persisted_legacy_verdict: "PASS",
    legacy_verdict_match: true,
    canonical_sufficiency_status: "SUFFICIENT",
    semantic_comparison_state: "MATCH",
    canonical_evidence_qualification_refs: [
      "evidence_qualification_v1:eq1",
      "evidence_qualification_v1:eq2",
    ],
    canonical_evidence_qualification_refs_state: "AVAILABLE_FROM_PERSISTED_CANONICAL_SHADOW",
    criterion_shadow_provenance_readiness: "READY_FOR_CRITERION_SHADOW",
    target_boundary: "B07_QUALIFIED_EVIDENCE_CRITERION_THEN_DECISION_ELIGIBILITY",
    migration_readiness: "NOT_READY_FOR_CRITERION_CUTOVER",
    reason_codes: ["READY"],
    limitations: ["SHADOW_ONLY"],
    legacy_consumer_unchanged: true,
    consumer_migration_performed: false,
    authority_removal_permitted: false,
  };
}

const requirementInputs = {
  tenant_id: input.tenant_id,
  project_id: input.project_id,
  group_id: input.group_id,
  field_id: input.field_id,
  soil_moisture: input.soil_moisture,
  target_soil_moisture: input.target_soil_moisture,
  root_zone_depth_mm: input.root_zone_depth_mm,
  rain_forecast_mm_72h: input.rain_forecast_mm_72h,
  et0_mm_72h: input.et0_mm_72h,
  crop_stage: input.crop_stage,
  application_efficiency: input.application_efficiency,
  evidence_refs: ["legacy:must_not_promote"],
};

function sourceFact(overrides: Record<string, unknown> = {}) {
  const requirement = runIrrigationRequirementSkillV1(requirementInputs);
  const payload = {
    tenant_id: input.tenant_id,
    project_id: input.project_id,
    group_id: input.group_id,
    field_id: input.field_id,
    season_id: input.season_id,
    device_id: input.device_id,
    recommendation_id: input.recommendation_id,
    action_type: "IRRIGATE",
    status: "proposed",
    confidence: 0.8,
    reason_codes: ["SOIL_WATER_DEFICIT"],
    evidence_refs: ["legacy:evidence:must_not_promote"],
    suggested_action: {
      action_type: "irrigation.start",
      parameters: { amount: requirement.gross_irrigation_requirement_mm, unit: "mm" },
    },
    skill_trace: {
      skill_id: "irrigation_requirement_skill_v1",
      skill_version: "v1",
      trace_id: "skill_trace_rec_A",
      inputs: requirementInputs,
      outputs: {
        requirement,
      },
      evidence_refs: ["legacy:must_not_promote"],
    },
    ...overrides,
  };
  return {
    fact_id: "499d91b8-f7c2-4469-a0b7-a0474e4f7d4e",
    occurred_at: "2026-08-28T10:37:28.204Z",
    source: "api/v1/recommendations/generate",
    record_json: {
      type: "decision_recommendation_v1",
      payload,
    },
  };
}

function candidateShadow(fact = sourceFact()) {
  const evidence = evidenceBinding();
  const criterion = projectAgronomyQualifiedEvidenceCriterionShadowV1(evidence);
  return projectDecisionRecommendationCandidateCriterionShadowBindingV1(
    input,
    [fact],
    evidence,
    criterion,
  );
}

function judge(overrides: Record<string, unknown> = {}) {
  const evaluated = evaluateAgronomyJudgeV2({
    ...input,
    evidence_refs: ["legacy:judge:evidence"],
  });
  const built = buildJudgeResultV2(evaluated);
  return {
    ...built,
    ...overrides,
  };
}

test("B-09ae calculation identity is deterministic from same source fact and calculator", () => {
  const a = deriveIrrigateStateCalculationIdentityV1({
    tenant_id: "tenantA",
    project_id: "projectA",
    group_id: "groupA",
    source_fact_id: "fact-1",
  });
  const b = deriveIrrigateStateCalculationIdentityV1({
    tenant_id: "tenantA",
    project_id: "projectA",
    group_id: "groupA",
    source_fact_id: "fact-1",
  });
  const c = deriveIrrigateStateCalculationIdentityV1({
    tenant_id: "tenantA",
    project_id: "projectA",
    group_id: "groupA",
    source_fact_id: "fact-2",
  });
  assert.deepEqual(a, b);
  assert.notEqual(a.calculation_id, c.calculation_id);
  assert.match(a.calculation_id, /^calculation_sfsha256_[a-f0-9]{64}$/);
});

test("B-09ae exact same-source Judge inputs bind CalculationResult and existing B-07c STATE", () => {
  const fact = sourceFact();
  const candidate = candidateShadow(fact);
  assert.equal(candidate.binding_state, "BOUND");

  const out = projectIrrigateStateCalculationShadowBindingV1(
    input,
    [fact],
    judge(),
    candidate,
  );

  assert.equal(out.binding_state, "BOUND");
  assert.equal(out.calculation_binding_state, "BOUND_TO_SAME_SOURCE");
  assert.equal(out.judge_congruence_state, "EXACT_MATCH");
  assert.equal(out.state_criterion_binding_state, "BOUND_TO_SAME_CANDIDATE");
  assert.equal(out.state_criterion_assessment?.criterion, "STATE");
  assert.equal(out.state_criterion_assessment?.status, "SATISFIED");
  assert.deepEqual(out.state_criterion_assessment?.support_refs, [out.calculation_result_ref]);
  assert.deepEqual(out.shadow_candidate_calculation_result_refs, [out.calculation_result_ref]);
  assert.equal(out.calculation_result?.calculator_ref, "irrigation_requirement_skill_v1");
  assert.deepEqual(out.calculation_result?.evidence_qualification_refs, [
    "evidence_qualification_v1:eq1",
    "evidence_qualification_v1:eq2",
  ]);
  assert.equal(JSON.stringify(out.calculation_result).includes("legacy:must_not_promote"), false);
  assert.equal(out.calculation_result?.context_snapshot_ref, null);
  assert.equal(out.calculation_result?.decision_time, null);
  assert.equal(out.decision_eligibility_runtime_connected, false);
});

test("B-09ae changed Judge inputs preserve same-source CalculationResult but do not bind STATE", () => {
  const fact = sourceFact();
  const candidate = candidateShadow(fact);
  const changedJudge = judge({
    inputs: {
      ...judge().inputs,
      rain_forecast_mm_72h: 3,
    },
  });

  const out = projectIrrigateStateCalculationShadowBindingV1(
    input,
    [fact],
    changedJudge,
    candidate,
  );

  assert.equal(out.binding_state, "CALCULATION_BOUND_STATE_NOT_BOUND_JUDGE_INPUT_MISMATCH");
  assert.equal(out.calculation_binding_state, "BOUND_TO_SAME_SOURCE");
  assert.equal(out.judge_congruence_state, "INPUT_MISMATCH");
  assert.deepEqual(out.mismatched_fields, ["rain_forecast_mm_72h"]);
  assert.equal(out.state_criterion_binding_state, "NOT_BOUND");
  assert.equal(out.state_criterion_assessment, null);
});

test("B-09ae Evidence BLOCKED uses existing B-07c QUALIFIED_EVIDENCE path and keeps STATE unbound", () => {
  const fact = sourceFact();
  const candidate = candidateShadow(fact);
  const blocked = buildJudgeResultV2(evaluateAgronomyJudgeV2({
    ...input,
    evidence_judge_verdict: "STALE_DATA",
    evidence_refs: ["legacy:judge:evidence"],
  }));

  const out = projectIrrigateStateCalculationShadowBindingV1(
    input,
    [fact],
    blocked,
    candidate,
  );

  assert.equal(out.binding_state, "CALCULATION_BOUND_STATE_NOT_BOUND_EVIDENCE_BLOCKED");
  assert.equal(out.judge_congruence_state, "EVIDENCE_BLOCKED");
  assert.equal(out.b07c_projection_state, "PROJECTED");
  assert.equal(out.b07c_criterion_assessments[0]?.criterion, "QUALIFIED_EVIDENCE");
  assert.equal(out.b07c_criterion_assessments[0]?.status, "MISSING");
  assert.equal(out.state_criterion_assessment, null);
});

test("B-09ae exact-congruent forged PASS fails closed instead of rewriting Candidate STATE", () => {
  const fact = sourceFact();
  const candidate = candidateShadow(fact);
  const valid = judge();
  const forged = {
    ...valid,
    verdict: "PASS",
    reasons: ["no_irrigation_requirement"],
  };

  const out = projectIrrigateStateCalculationShadowBindingV1(
    input,
    [fact],
    forged,
    candidate,
  );

  assert.equal(out.binding_state, "CALCULATION_BOUND_STATE_NOT_BOUND_SEMANTIC_MISMATCH");
  assert.equal(out.judge_congruence_state, "SEMANTIC_MISMATCH");
  assert.equal(out.state_criterion_binding_state, "NOT_BOUND");
  assert.equal(out.b07c_projection_state, "NOT_PROJECTED");
});

test("B-09ae malformed or non-requirement recommendation skill trace fails closed", () => {
  const bad = sourceFact({
    skill_trace: {
      skill_id: "irrigation_requirement_skill_v1",
      skill_version: "v1",
      inputs: requirementInputs,
      outputs: {
        requirement: {
          requirement_detected: false,
        },
      },
    },
  });
  const candidate = candidateShadow(bad);

  const out = projectIrrigateStateCalculationShadowBindingV1(
    input,
    [bad],
    judge(),
    candidate,
  );

  assert.equal(out.binding_state, "SKILL_TRACE_INVALID");
  assert.equal(out.calculation_result, null);
  assert.equal(out.state_criterion_assessment, null);
});

test("B-09ae re-read source fact must be the exact immutable B-09j source fact", () => {
  const fact = sourceFact();
  const candidate = candidateShadow(fact);
  const wrong = {
    ...fact,
    fact_id: "other-fact",
  };

  const out = projectIrrigateStateCalculationShadowBindingV1(
    input,
    [wrong],
    judge(),
    candidate,
  );

  assert.equal(out.binding_state, "SOURCE_IDENTITY_MISMATCH");
  assert.equal(out.calculation_binding_state, "NOT_BOUND");
});

test("B-09ae Candidate-not-ready remains fully disconnected", () => {
  const fact = sourceFact();
  const candidate = {
    ...candidateShadow(fact),
    binding_state: "CRITERION_NOT_READY" as const,
    candidate_ref: null,
    candidate_decision: null,
  };

  const out = projectIrrigateStateCalculationShadowBindingV1(
    input,
    [fact],
    judge(),
    candidate,
  );

  assert.equal(out.binding_state, "CANDIDATE_NOT_READY");
  assert.equal(out.calculation_result, null);
  assert.equal(out.decision_eligibility_runtime_connected, false);
});
