import assert from "node:assert/strict";
import test from "node:test";

import type { AgronomyEvidenceDependencyShadowBindingV1 } from "./agronomy_evidence_dependency_shadow_binding_v1.js";
import { projectAgronomyQualifiedEvidenceCriterionShadowV1 } from "./agronomy_qualified_evidence_criterion_shadow_v1.js";
import {
  deriveDecisionRecommendationCandidateIdentityV1,
  projectDecisionRecommendationCandidateCriterionShadowBindingV1,
} from "./decision_recommendation_candidate_criterion_shadow_binding_v1.js";

const input = {
  tenant_id: "tenantA",
  project_id: "projectA",
  group_id: "groupA",
  field_id: "fieldA",
  season_id: "seasonA",
  device_id: "deviceA",
  recommendation_id: "rec_A",
};

function evidenceBinding(overrides: Partial<AgronomyEvidenceDependencyShadowBindingV1> = {}): AgronomyEvidenceDependencyShadowBindingV1 {
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
    ...overrides,
  };
}

function sourceFact(overrides: Record<string, unknown> = {}) {
  const payload = {
    tenant_id: "tenantA",
    project_id: "projectA",
    group_id: "groupA",
    field_id: "fieldA",
    season_id: "seasonA",
    device_id: "deviceA",
    recommendation_id: "rec_A",
    action_type: "IRRIGATE",
    status: "proposed",
    confidence: 0.8,
    reason_codes: ["SOIL_WATER_DEFICIT"],
    evidence_refs: ["legacy:evidence:must_not_promote"],
    snapshot_id: "legacy_snapshot",
    crop_stage: "unknown",
    created_ts: 1787913448197,
    suggested_action: {
      action_type: "irrigation.start",
      parameters: { amount: 12, unit: "mm" },
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

test("B-09j candidate identity is deterministic from scoped immutable source fact, not legacy recommendation id", () => {
  const a = deriveDecisionRecommendationCandidateIdentityV1({
    tenant_id: "tenantA",
    project_id: "projectA",
    group_id: "groupA",
    source_fact_id: "fact-1",
  });
  const b = deriveDecisionRecommendationCandidateIdentityV1({
    tenant_id: "tenantA",
    project_id: "projectA",
    group_id: "groupA",
    source_fact_id: "fact-1",
  });
  const c = deriveDecisionRecommendationCandidateIdentityV1({
    tenant_id: "tenantA",
    project_id: "projectA",
    group_id: "groupA",
    source_fact_id: "fact-2",
  });
  assert.deepEqual(a, b);
  assert.notEqual(a.candidate_id, c.candidate_id);
  assert.match(a.candidate_id, /^candidate_sfsha256_[a-f0-9]{64}$/);
});

test("B-09j binds one scoped decision-engine source fact to B-06c Candidate and B-09h criterion", () => {
  const evidence = evidenceBinding();
  const criterion = projectAgronomyQualifiedEvidenceCriterionShadowV1(evidence);
  const out = projectDecisionRecommendationCandidateCriterionShadowBindingV1(
    input,
    [sourceFact()],
    evidence,
    criterion,
  );

  assert.equal(out.binding_state, "BOUND");
  assert.equal(out.candidate_projection_state, "PROJECTED");
  assert.equal(out.candidate_decision?.authority_state, "CANDIDATE_ONLY");
  assert.equal(out.candidate_decision?.source_ref, sourceFact().fact_id);
  assert.equal(out.candidate_decision?.scope.field_id, "fieldA");
  assert.equal(out.candidate_decision?.basis.context_snapshot_ref, null);
  assert.equal(out.candidate_decision?.basis.crop_stage_state_ref, null);
  assert.deepEqual(out.candidate_decision?.basis.calculation_result_refs, []);
  assert.deepEqual(out.candidate_evidence_qualification_refs, [
    "evidence_qualification_v1:eq1",
    "evidence_qualification_v1:eq2",
  ]);
  assert.deepEqual(out.candidate_evidence_qualification_refs, out.criterion_support_refs);
  assert.equal(out.canonical_evidence_continuity_state, "EXACT_REF_SET_MATCH");
  assert.equal(out.criterion_candidate_binding_state, "BOUND_TO_SAME_CANDIDATE");
  assert.equal(out.candidate_ref, "candidate_decision_v1:" + out.candidate_id);
  assert.equal(out.decision_eligibility_runtime_connected, false);
  assert.equal(out.consumer_migration_performed, false);
  assert.equal(out.authority_removal_permitted, false);
  assert.equal(out.decision_eligibility_input_materialization_state, "NOT_READY_CANONICAL_EVIDENCE_OBJECTS_NOT_BOUND");
  assert.equal(out.candidate_decision?.basis.evidence_qualification_refs.includes("legacy:evidence:must_not_promote"), false);
});

test("B-09j known-empty canonical evidence set can bind MISSING criterion without fabricating support", () => {
  const evidence = evidenceBinding({
    canonical_sufficiency_status: "NEEDS_EVIDENCE",
    canonical_evidence_qualification_refs: [],
    canonical_evidence_qualification_refs_state: "EMPTY_NO_CANONICAL_QUALIFICATIONS",
  });
  const criterion = projectAgronomyQualifiedEvidenceCriterionShadowV1(evidence);
  const out = projectDecisionRecommendationCandidateCriterionShadowBindingV1(
    input,
    [sourceFact()],
    evidence,
    criterion,
  );

  assert.equal(criterion.criterion_assessment?.status, "MISSING");
  assert.equal(out.binding_state, "BOUND");
  assert.deepEqual(out.candidate_evidence_qualification_refs, []);
  assert.deepEqual(out.criterion_support_refs, []);
  assert.equal(out.canonical_evidence_continuity_state, "EXACT_REF_SET_MATCH");
});

test("B-09j recommendation id absence does not guess a candidate", () => {
  const evidence = evidenceBinding();
  const criterion = projectAgronomyQualifiedEvidenceCriterionShadowV1(evidence);
  const out = projectDecisionRecommendationCandidateCriterionShadowBindingV1(
    { ...input, recommendation_id: null },
    [],
    evidence,
    criterion,
  );
  assert.equal(out.binding_state, "NOT_REQUESTED");
  assert.equal(out.candidate_id, null);
  assert.equal(out.candidate_decision, null);
});

test("B-09j duplicate scoped recommendation source fails closed instead of selecting latest", () => {
  const evidence = evidenceBinding();
  const criterion = projectAgronomyQualifiedEvidenceCriterionShadowV1(evidence);
  const out = projectDecisionRecommendationCandidateCriterionShadowBindingV1(
    input,
    [sourceFact(), { ...sourceFact(), fact_id: "duplicate-fact" }],
    evidence,
    criterion,
  );
  assert.equal(out.binding_state, "SOURCE_AMBIGUOUS");
  assert.equal(out.candidate_id, null);
});

test("B-09j only accepts the bounded formal decision-engine recommendation producer", () => {
  const evidence = evidenceBinding();
  const criterion = projectAgronomyQualifiedEvidenceCriterionShadowV1(evidence);
  const out = projectDecisionRecommendationCandidateCriterionShadowBindingV1(
    input,
    [{ ...sourceFact(), source: "jobs/agronomy_agent" }],
    evidence,
    criterion,
  );
  assert.equal(out.binding_state, "SOURCE_PRODUCER_INVALID");
});

test("B-09j source/Agronomy scope mismatch fails closed", () => {
  const evidence = evidenceBinding();
  const criterion = projectAgronomyQualifiedEvidenceCriterionShadowV1(evidence);
  const out = projectDecisionRecommendationCandidateCriterionShadowBindingV1(
    input,
    [sourceFact({ field_id: "fieldB" })],
    evidence,
    criterion,
  );
  assert.equal(out.binding_state, "SOURCE_SCOPE_MISMATCH");
});

test("B-09j requires exact B-09f/B-09h canonical EvidenceQualification ref continuity", () => {
  const evidence = evidenceBinding();
  const criterion = projectAgronomyQualifiedEvidenceCriterionShadowV1(evidence);
  const mismatched = {
    ...criterion,
    canonical_evidence_qualification_refs: ["evidence_qualification_v1:eq_other"],
  };
  const out = projectDecisionRecommendationCandidateCriterionShadowBindingV1(
    input,
    [sourceFact()],
    evidence,
    mismatched,
  );
  assert.equal(out.binding_state, "EVIDENCE_PROVENANCE_MISMATCH");
  assert.equal(out.candidate_decision, null);
});

test("B-09j B-09h NOT_READY remains unbound", () => {
  const evidence = evidenceBinding({
    binding_state: "CANONICAL_SHADOW_UNKNOWN",
    canonical_sufficiency_status: "UNKNOWN",
    criterion_shadow_provenance_readiness: "NOT_READY",
  });
  const criterion = projectAgronomyQualifiedEvidenceCriterionShadowV1(evidence);
  const out = projectDecisionRecommendationCandidateCriterionShadowBindingV1(
    input,
    [sourceFact()],
    evidence,
    criterion,
  );
  assert.equal(out.binding_state, "CRITERION_NOT_READY");
  assert.equal(out.candidate_ref, null);
});

test("B-09j non-candidate source status fails through B-06c without weakening legacy source", () => {
  const evidence = evidenceBinding();
  const criterion = projectAgronomyQualifiedEvidenceCriterionShadowV1(evidence);
  const out = projectDecisionRecommendationCandidateCriterionShadowBindingV1(
    input,
    [sourceFact({ status: "approved" })],
    evidence,
    criterion,
  );
  assert.equal(out.binding_state, "CANDIDATE_PROJECTION_FAILED");
  assert.equal(out.candidate_projection_state, "NOT_PROJECTED");
  assert.equal(out.decision_eligibility_runtime_connected, false);
});
