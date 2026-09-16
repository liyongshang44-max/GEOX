import assert from "node:assert/strict";
import test from "node:test";

import type { AgronomyEvidenceDependencyShadowBindingV1 } from "./agronomy_evidence_dependency_shadow_binding_v1.js";
import { projectAgronomyQualifiedEvidenceCriterionShadowV1 } from "./agronomy_qualified_evidence_criterion_shadow_v1.js";

function binding(overrides: Partial<AgronomyEvidenceDependencyShadowBindingV1> = {}): AgronomyEvidenceDependencyShadowBindingV1 {
  return {
    schema_version: "agronomy_evidence_dependency_shadow_binding_v1",
    authority_mode: "SHADOW_NON_AUTHORITATIVE",
    binding_state: "BOUND",
    evidence_judge_id: "evidence-1",
    evidence_judge_ref: "judge_result_v2:evidence-1",
    requested_field_id: "fieldA",
    persisted_field_id: "fieldA",
    request_legacy_verdict: "PASS",
    persisted_legacy_verdict: "PASS",
    legacy_verdict_match: true,
    canonical_sufficiency_status: "SUFFICIENT",
    semantic_comparison_state: "MATCH",
    canonical_evidence_qualification_refs: [
      "evidence_qualification_v1:raw_sample:rs1:1000",
    ],
    canonical_evidence_qualification_refs_state: "AVAILABLE_FROM_PERSISTED_CANONICAL_SHADOW",
    criterion_shadow_provenance_readiness: "READY_FOR_CRITERION_SHADOW",
    target_boundary: "B07_QUALIFIED_EVIDENCE_CRITERION_THEN_DECISION_ELIGIBILITY",
    migration_readiness: "NOT_READY_FOR_CRITERION_CUTOVER",
    reason_codes: ["fixture"],
    limitations: ["fixture"],
    legacy_consumer_unchanged: true,
    consumer_migration_performed: false,
    authority_removal_permitted: false,
    ...overrides,
  };
}

test("B-09h SUFFICIENT projects QUALIFIED_EVIDENCE=SATISFIED with exact canonical refs", () => {
  const projected = projectAgronomyQualifiedEvidenceCriterionShadowV1(binding());

  assert.equal(projected.projection_state, "CRITERION_PROJECTED");
  assert.equal(projected.criterion_assessment?.criterion, "QUALIFIED_EVIDENCE");
  assert.equal(projected.criterion_assessment?.status, "SATISFIED");
  assert.deepEqual(projected.criterion_assessment?.support_refs, [
    "evidence_qualification_v1:raw_sample:rs1:1000",
  ]);
  assert.equal(projected.authority_mode, "SHADOW_NON_AUTHORITATIVE");
  assert.equal(projected.direct_verdict_authority, "NONE");
  assert.equal(projected.decision_eligibility_runtime_connected, false);
});

test("B-09h NEEDS_EVIDENCE with existing canonical refs projects MISSING, not BLOCK", () => {
  const projected = projectAgronomyQualifiedEvidenceCriterionShadowV1(binding({
    canonical_sufficiency_status: "NEEDS_EVIDENCE",
    semantic_comparison_state: "DIVERGENT",
  }));

  assert.equal(projected.projection_state, "CRITERION_PROJECTED");
  assert.equal(projected.criterion_assessment?.status, "MISSING");
  assert.deepEqual(projected.criterion_assessment?.support_refs, [
    "evidence_qualification_v1:raw_sample:rs1:1000",
  ]);
  assert.deepEqual(projected.criterion_assessment?.reason_codes, [
    "NO_ROLE_ELIGIBLE_CANONICAL_EVIDENCE",
  ]);
  assert.equal(projected.semantic_comparison_state, "DIVERGENT");
  assert.equal(projected.reason_codes.includes("LEGACY_CANONICAL_DIVERGENCE_PRESERVED"), true);
  assert.equal("verdict" in projected, false);
});

test("B-09h known empty qualification set projects MISSING with zero support refs and fabricates nothing", () => {
  const projected = projectAgronomyQualifiedEvidenceCriterionShadowV1(binding({
    canonical_sufficiency_status: "NEEDS_EVIDENCE",
    canonical_evidence_qualification_refs: [],
    canonical_evidence_qualification_refs_state: "EMPTY_NO_CANONICAL_QUALIFICATIONS",
  }));

  assert.equal(projected.projection_state, "CRITERION_PROJECTED");
  assert.equal(projected.criterion_assessment?.status, "MISSING");
  assert.deepEqual(projected.criterion_assessment?.support_refs, []);
  assert.deepEqual(projected.criterion_assessment?.reason_codes, [
    "NO_CANONICAL_EVIDENCE_QUALIFICATIONS",
  ]);
});

test("B-09h canonical UNKNOWN remains NOT_READY and does not instantiate criterion", () => {
  const projected = projectAgronomyQualifiedEvidenceCriterionShadowV1(binding({
    canonical_sufficiency_status: "UNKNOWN",
    criterion_shadow_provenance_readiness: "NOT_READY",
    canonical_evidence_qualification_refs: [],
    canonical_evidence_qualification_refs_state: "UNAVAILABLE",
    semantic_comparison_state: "INCOMPARABLE",
  }));

  assert.equal(projected.projection_state, "NOT_READY");
  assert.equal(projected.criterion_assessment, null);
  assert.equal(projected.semantic_comparison_state, "INCOMPARABLE");
  assert.equal(projected.decision_eligibility_runtime_connected, false);
});

test("B-09h old persisted shadow without canonical ref provenance remains NOT_READY", () => {
  const projected = projectAgronomyQualifiedEvidenceCriterionShadowV1(binding({
    criterion_shadow_provenance_readiness: "NOT_READY",
    canonical_evidence_qualification_refs: [],
    canonical_evidence_qualification_refs_state: "LEGACY_SHADOW_WITHOUT_QUALIFICATION_REFS",
  }));

  assert.equal(projected.projection_state, "NOT_READY");
  assert.equal(projected.criterion_assessment, null);
});

test("B-09h unbound or mismatch dependency never produces a criterion", () => {
  for (const state of [
    "NOT_REQUESTED",
    "EVIDENCE_JUDGE_NOT_FOUND",
    "FIELD_SCOPE_MISMATCH",
    "LEGACY_VERDICT_MISMATCH",
    "BINDING_READ_ERROR",
  ] as const) {
    const projected = projectAgronomyQualifiedEvidenceCriterionShadowV1(binding({
      binding_state: state,
      criterion_shadow_provenance_readiness: "NOT_READY",
    }));
    assert.equal(projected.projection_state, "NOT_READY");
    assert.equal(projected.criterion_assessment, null);
  }
});

test("B-09h refuses internally inconsistent SUFFICIENT provenance", () => {
  const projected = projectAgronomyQualifiedEvidenceCriterionShadowV1(binding({
    canonical_evidence_qualification_refs: [],
    canonical_evidence_qualification_refs_state: "AVAILABLE_FROM_PERSISTED_CANONICAL_SHADOW",
  }));

  assert.equal(projected.projection_state, "NOT_READY");
  assert.equal(projected.criterion_assessment, null);
});

test("B-09h remains candidate-unbound and cannot create final eligibility or downstream authority", () => {
  const projected = projectAgronomyQualifiedEvidenceCriterionShadowV1(binding());

  assert.equal(projected.candidate_binding_state, "NOT_BOUND");
  assert.equal(projected.candidate_ref, null);
  assert.equal(projected.consumer_migration_performed, false);
  assert.equal(projected.authority_removal_permitted, false);
  assert.equal("eligibility_id" in projected, false);
  assert.equal("approval_request_id" in projected, false);
  assert.equal("operation_plan_id" in projected, false);
  assert.equal("task_id" in projected, false);
});
