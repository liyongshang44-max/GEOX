import assert from "node:assert/strict";
import test from "node:test";

import {
  projectAgronomyEvidenceDependencyShadowBindingV1,
} from "./agronomy_evidence_dependency_shadow_binding_v1.js";

const scope = {
  tenant_id: "tenantA",
  project_id: "projectA",
  group_id: "groupA",
  field_id: "fieldA",
  evidence_judge_id: "evidence-1",
  evidence_judge_verdict: "PASS",
};

function evidenceJudge(overrides: Record<string, unknown> = {}) {
  return {
    judge_id: "evidence-1",
    judge_kind: "EVIDENCE",
    tenant_id: "tenantA",
    project_id: "projectA",
    group_id: "groupA",
    field_id: "fieldA",
    season_id: null,
    device_id: "deviceA",
    recommendation_id: null,
    prescription_id: null,
    task_id: null,
    receipt_id: null,
    as_executed_id: null,
    as_applied_id: null,
    verdict: "PASS",
    severity: "LOW",
    reasons: [],
    inputs: {},
    outputs: {
      canonical_evidence_sufficiency_shadow_v1: {
        schema_version: "evidence_judge_canonical_sufficiency_shadow_v1",
        authority_mode: "SHADOW_NON_AUTHORITATIVE",
        qualification_role: "STAGE1_FORMAL_EVIDENCE",
        status: "NEEDS_EVIDENCE",
        counts: { total: 0, role_eligible: 0, role_limited: 0, role_ineligible: 0, role_unknown: 0 },
        reason_codes: ["NO_CANONICAL_EVIDENCE_QUALIFICATIONS"],
        canonical_reason_codes: [],
        canonical_evidence_qualification_refs: [],
        canonical_evidence_qualification_refs_state: "EMPTY_NO_CANONICAL_QUALIFICATIONS",
        canonical_evidence_qualification_ref_basis: "QUALIFICATION_ID_DIRECT",
        limitations: ["fixture"],
      },
      semantic_shadow_comparison_v1: {
        schema_version: "semantic_shadow_comparison_v1",
        comparison_id: "cmp-1",
        semantic_id: "evidence.qualification",
        legacy_producer_id: "evidence-judge-v2",
        canonical_owner_ref: "evidence.qualification:canonical-evidence-qualification-shadow",
        scope_ref: "tenant:tenantA/project:projectA/group:groupA/field:fieldA",
        decision_time: "2026-08-28T06:00:00.000Z",
        comparable_dimensions: ["VERDICT", "EVIDENCE_BASIS", "AUTHORITY_CLASS"],
        comparison_state: "DIVERGENT",
        divergences: [{
          dimension: "VERDICT",
          code: "LEGACY_CANONICAL_EVIDENCE_SUFFICIENCY_DISAGREE",
          legacy_ref: "judge_result_v2:evidence-1",
          canonical_ref: "judge_result_v2:evidence-1#outputs.canonical_evidence_sufficiency_shadow_v1",
        }],
        comparison_basis_refs: ["judge_result_v2:evidence-1"],
        limitations: ["fixture"],
        authority_removal_permitted: false,
        authority_state: "SHADOW_ONLY",
      },
    },
    confidence: { level: "HIGH", basis: "measured", reasons: ["fixture"] },
    evidence_refs: [],
    source_refs: [],
    created_at: "2026-08-28T06:00:00.000Z",
    created_ts_ms: 1787896800000,
    ...overrides,
  } as any;
}

test("B-09f binds evidence_judge_id to persisted Judge and exposes DIVERGENT only as shadow", () => {
  const binding = projectAgronomyEvidenceDependencyShadowBindingV1(
    scope,
    evidenceJudge(),
  );

  assert.equal(binding.binding_state, "BOUND");
  assert.equal(binding.evidence_judge_ref, "judge_result_v2:evidence-1");
  assert.equal(binding.legacy_verdict_match, true);
  assert.equal(binding.canonical_sufficiency_status, "NEEDS_EVIDENCE");
  assert.equal(binding.semantic_comparison_state, "DIVERGENT");
  assert.deepEqual(binding.canonical_evidence_qualification_refs, []);
  assert.equal(
    binding.canonical_evidence_qualification_refs_state,
    "EMPTY_NO_CANONICAL_QUALIFICATIONS",
  );
  assert.equal(binding.criterion_shadow_provenance_readiness, "READY_FOR_CRITERION_SHADOW");
  assert.equal(binding.migration_readiness, "NOT_READY_FOR_CRITERION_CUTOVER");
  assert.equal(binding.legacy_consumer_unchanged, true);
  assert.equal(binding.consumer_migration_performed, false);
  assert.equal(binding.authority_removal_permitted, false);
});

test("B-09f does not invent a binding when evidence_judge_id is absent", () => {
  const binding = projectAgronomyEvidenceDependencyShadowBindingV1(
    { ...scope, evidence_judge_id: null },
    null,
  );

  assert.equal(binding.binding_state, "NOT_REQUESTED");
  assert.equal(binding.evidence_judge_ref, null);
  assert.equal(binding.semantic_comparison_state, null);
});

test("B-09f detects caller-injected legacy verdict mismatch without changing authority", () => {
  const binding = projectAgronomyEvidenceDependencyShadowBindingV1(
    { ...scope, evidence_judge_verdict: "STALE_DATA" },
    evidenceJudge(),
  );

  assert.equal(binding.binding_state, "LEGACY_VERDICT_MISMATCH");
  assert.equal(binding.legacy_verdict_match, false);
  assert.equal(binding.request_legacy_verdict, "STALE_DATA");
  assert.equal(binding.persisted_legacy_verdict, "PASS");
  assert.equal(binding.authority_removal_permitted, false);
});

test("B-09f rejects field-scope mismatch in the shadow binding", () => {
  const binding = projectAgronomyEvidenceDependencyShadowBindingV1(
    { ...scope, field_id: "fieldB" },
    evidenceJudge(),
  );

  assert.equal(binding.binding_state, "FIELD_SCOPE_MISMATCH");
  assert.equal(binding.requested_field_id, "fieldB");
  assert.equal(binding.persisted_field_id, "fieldA");
});

test("B-09f preserves canonical UNKNOWN / INCOMPARABLE rather than coercing a criterion", () => {
  const row = evidenceJudge();
  row.outputs.canonical_evidence_sufficiency_shadow_v1.status = "UNKNOWN";
  row.outputs.canonical_evidence_sufficiency_shadow_v1.canonical_evidence_qualification_refs = [];
  row.outputs.canonical_evidence_sufficiency_shadow_v1.canonical_evidence_qualification_refs_state = "UNAVAILABLE";
  row.outputs.semantic_shadow_comparison_v1.comparison_state = "INCOMPARABLE";
  row.outputs.semantic_shadow_comparison_v1.divergences = [{
    dimension: "VERDICT",
    code: "CANONICAL_EVIDENCE_SUFFICIENCY_UNKNOWN",
    legacy_ref: "judge_result_v2:evidence-1",
    canonical_ref: "judge_result_v2:evidence-1#outputs.canonical_evidence_sufficiency_shadow_v1",
  }];

  const binding = projectAgronomyEvidenceDependencyShadowBindingV1(scope, row);

  assert.equal(binding.binding_state, "CANONICAL_SHADOW_UNKNOWN");
  assert.equal(binding.canonical_sufficiency_status, "UNKNOWN");
  assert.equal(binding.semantic_comparison_state, "INCOMPARABLE");
  assert.equal(binding.canonical_evidence_qualification_refs_state, "UNAVAILABLE");
  assert.equal(binding.criterion_shadow_provenance_readiness, "NOT_READY");
  assert.equal("criterion" in (binding as any), false);
  assert.equal("verdict" in (binding as any), false);
});

test("B-09f cannot treat old Evidence Judge rows without B-09c comparison as cutover-ready", () => {
  const row = evidenceJudge();
  delete row.outputs.semantic_shadow_comparison_v1;
  const binding = projectAgronomyEvidenceDependencyShadowBindingV1(scope, row);

  assert.equal(binding.binding_state, "SEMANTIC_COMPARISON_MISSING");
  assert.equal(binding.migration_readiness, "NOT_READY_FOR_CRITERION_CUTOVER");
});

test("B-09f scoped lookup miss remains observational only", () => {
  const binding = projectAgronomyEvidenceDependencyShadowBindingV1(scope, null);

  assert.equal(binding.binding_state, "EVIDENCE_JUDGE_NOT_FOUND");
  assert.equal(binding.evidence_judge_ref, null);
  assert.equal(binding.consumer_migration_performed, false);
});


test("B-09g propagates exact persisted canonical EvidenceQualification identities without promoting a criterion", () => {
  const row = evidenceJudge();
  row.outputs.canonical_evidence_sufficiency_shadow_v1.status = "SUFFICIENT";
  row.outputs.canonical_evidence_sufficiency_shadow_v1.canonical_evidence_qualification_refs = [
    "evidence_qualification_v1:raw_sample:rs_1:1787896800000",
    "evidence_qualification_v1:raw_sample:rs_2:1787896800000",
  ];
  row.outputs.canonical_evidence_sufficiency_shadow_v1.canonical_evidence_qualification_refs_state = "AVAILABLE";
  row.outputs.semantic_shadow_comparison_v1.comparison_state = "MATCH";
  row.outputs.semantic_shadow_comparison_v1.divergences = [];

  const binding = projectAgronomyEvidenceDependencyShadowBindingV1(scope, row);

  assert.equal(binding.binding_state, "BOUND");
  assert.deepEqual(binding.canonical_evidence_qualification_refs, [
    "evidence_qualification_v1:raw_sample:rs_1:1787896800000",
    "evidence_qualification_v1:raw_sample:rs_2:1787896800000",
  ]);
  assert.equal(binding.canonical_evidence_qualification_refs_state, "AVAILABLE_FROM_PERSISTED_CANONICAL_SHADOW");
  assert.equal(binding.criterion_shadow_provenance_readiness, "READY_FOR_CRITERION_SHADOW");
  assert.equal(binding.migration_readiness, "NOT_READY_FOR_CRITERION_CUTOVER");
  assert.equal("criterion" in (binding as any), false);
  assert.equal("verdict" in (binding as any), false);
});

test("B-09g old persisted canonical shadows without qualification refs remain not provenance-ready", () => {
  const row = evidenceJudge();
  delete row.outputs.canonical_evidence_sufficiency_shadow_v1.canonical_evidence_qualification_refs;
  delete row.outputs.canonical_evidence_sufficiency_shadow_v1.canonical_evidence_qualification_refs_state;
  delete row.outputs.canonical_evidence_sufficiency_shadow_v1.canonical_evidence_qualification_ref_basis;

  const binding = projectAgronomyEvidenceDependencyShadowBindingV1(scope, row);

  assert.equal(binding.binding_state, "BOUND");
  assert.deepEqual(binding.canonical_evidence_qualification_refs, []);
  assert.equal(binding.canonical_evidence_qualification_refs_state, "LEGACY_SHADOW_WITHOUT_QUALIFICATION_REFS");
  assert.equal(binding.criterion_shadow_provenance_readiness, "NOT_READY");
  assert.equal(binding.migration_readiness, "NOT_READY_FOR_CRITERION_CUTOVER");
});


test("B-09g refuses provenance readiness when persisted ref basis is absent", () => {
  const row = evidenceJudge();
  row.outputs.canonical_evidence_sufficiency_shadow_v1.status = "SUFFICIENT";
  row.outputs.canonical_evidence_sufficiency_shadow_v1.canonical_evidence_qualification_refs = [
    "evidence_qualification_v1:raw_sample:rs_basisless:1787896800000",
  ];
  row.outputs.canonical_evidence_sufficiency_shadow_v1.canonical_evidence_qualification_refs_state = "AVAILABLE";
  delete row.outputs.canonical_evidence_sufficiency_shadow_v1.canonical_evidence_qualification_ref_basis;
  row.outputs.semantic_shadow_comparison_v1.comparison_state = "MATCH";
  row.outputs.semantic_shadow_comparison_v1.divergences = [];

  const binding = projectAgronomyEvidenceDependencyShadowBindingV1(scope, row);

  assert.equal(binding.binding_state, "BOUND");
  assert.deepEqual(binding.canonical_evidence_qualification_refs, []);
  assert.equal(binding.canonical_evidence_qualification_refs_state, "UNAVAILABLE");
  assert.equal(binding.criterion_shadow_provenance_readiness, "NOT_READY");
  assert.equal(binding.migration_readiness, "NOT_READY_FOR_CRITERION_CUTOVER");
});
