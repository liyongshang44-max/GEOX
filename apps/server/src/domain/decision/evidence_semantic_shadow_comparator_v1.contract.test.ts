import assert from "node:assert/strict";
import test from "node:test";

import {
  compareEvidenceJudgeToCanonicalEvidenceShadowV1,
  compareStage1GateToCanonicalEvidenceShadowV1,
} from "./evidence_semantic_shadow_comparator_v1.js";

const judgeContext = {
  comparison_id: "cmp_evidence_judge_001",
  legacy_producer_id: "evidence-judge-v2" as const,
  canonical_owner_ref: "evidence_qualification_v1:batch1",
  legacy_ref: "judge_result_v2:legacy1",
  canonical_ref: "evidence_judge_canonical_sufficiency_shadow_v1:shadow1",
  scope_ref: "field:fieldA",
  decision_time: "2026-08-28T04:30:00+08:00",
  comparison_basis_refs: ["judge_result_v2:legacy1", "evidence_qualification_v1:batch1"],
};

const stage1Context = {
  ...judgeContext,
  comparison_id: "cmp_stage1_001",
  legacy_producer_id: "stage1-formal-gate" as const,
  legacy_ref: "stage1_gate:legacy1",
};

function canonical(status: "SUFFICIENT" | "NEEDS_EVIDENCE" | "UNKNOWN") {
  return {
    schema_version: "evidence_judge_canonical_sufficiency_shadow_v1",
    authority_mode: "SHADOW_NON_AUTHORITATIVE",
    qualification_role: "STAGE1_FORMAL_EVIDENCE",
    status,
    counts: {
      total: 2,
      role_eligible: status === "SUFFICIENT" ? 1 : 0,
      role_limited: 0,
      role_ineligible: status === "NEEDS_EVIDENCE" ? 2 : 0,
      role_unknown: status === "UNKNOWN" ? 2 : 0,
    },
    reason_codes: [],
    canonical_reason_codes: [],
    limitations: ["B04E_SHADOW_NON_AUTHORITATIVE"],
  };
}

test("B-09b Evidence Judge PASS matches canonical SUFFICIENT at coarse sufficiency level", () => {
  const result = compareEvidenceJudgeToCanonicalEvidenceShadowV1(
    { judge_kind: "EVIDENCE", verdict: "PASS" },
    canonical("SUFFICIENT"),
    judgeContext,
  );

  assert.equal(result.comparison_state, "MATCH");
  assert.deepEqual(result.divergences, []);
  assert.equal(result.authority_state, "SHADOW_ONLY");
  assert.equal(result.authority_removal_permitted, false);
  assert.equal(
    result.limitations.includes("MATCH_DOES_NOT_PROVE_FIELD_LEVEL_SEMANTIC_EQUIVALENCE"),
    true,
  );
});

test("B-09b known legacy Evidence Judge failures match canonical NEEDS_EVIDENCE coarsely", () => {
  for (const verdict of ["DEVICE_OFFLINE", "SENSOR_DRIFT", "STALE_DATA", "INSUFFICIENT_EVIDENCE"]) {
    const result = compareEvidenceJudgeToCanonicalEvidenceShadowV1(
      { judge_kind: "EVIDENCE", verdict },
      canonical("NEEDS_EVIDENCE"),
      { ...judgeContext, comparison_id: "cmp_" + verdict },
    );
    assert.equal(result.comparison_state, "MATCH");
  }
});

test("B-09b independent canonical support creates explicit divergence from legacy rejection", () => {
  const result = compareEvidenceJudgeToCanonicalEvidenceShadowV1(
    { judge_kind: "EVIDENCE", verdict: "SENSOR_DRIFT" },
    canonical("SUFFICIENT"),
    judgeContext,
  );

  assert.equal(result.comparison_state, "DIVERGENT");
  assert.equal(
    result.divergences[0]?.code,
    "LEGACY_REJECTS_WHILE_INDEPENDENT_CANONICAL_EVIDENCE_REMAINS_SUFFICIENT",
  );
  assert.equal(result.authority_removal_permitted, false);
});

test("B-09b legacy PASS versus canonical NEEDS_EVIDENCE is divergent", () => {
  const result = compareEvidenceJudgeToCanonicalEvidenceShadowV1(
    { judge_kind: "EVIDENCE", verdict: "PASS" },
    canonical("NEEDS_EVIDENCE"),
    judgeContext,
  );
  assert.equal(result.comparison_state, "DIVERGENT");
  assert.equal(
    result.divergences[0]?.code,
    "LEGACY_CANONICAL_EVIDENCE_SUFFICIENCY_DISAGREE",
  );
});

test("B-09b canonical UNKNOWN is incomparable, never silently matched", () => {
  const result = compareEvidenceJudgeToCanonicalEvidenceShadowV1(
    { judge_kind: "EVIDENCE", verdict: "PASS" },
    canonical("UNKNOWN"),
    judgeContext,
  );
  assert.equal(result.comparison_state, "INCOMPARABLE");
  assert.equal(
    result.divergences[0]?.code,
    "CANONICAL_EVIDENCE_SUFFICIENCY_UNKNOWN",
  );
});

test("B-09b unknown legacy Evidence Judge verdict is incomparable", () => {
  const result = compareEvidenceJudgeToCanonicalEvidenceShadowV1(
    { judge_kind: "EVIDENCE", verdict: "FUTURE_VERDICT" },
    canonical("SUFFICIENT"),
    judgeContext,
  );
  assert.equal(result.comparison_state, "INCOMPARABLE");
  assert.equal(
    result.divergences[0]?.code,
    "LEGACY_COARSE_EVIDENCE_STATE_UNKNOWN",
  );
});

test("B-09b Stage-1 ELIGIBLE and NEEDS_EVIDENCE compare only at coarse evidence sufficiency", () => {
  assert.equal(
    compareStage1GateToCanonicalEvidenceShadowV1(
      { status: "ELIGIBLE", reason_codes: [] },
      canonical("SUFFICIENT"),
      stage1Context,
    ).comparison_state,
    "MATCH",
  );

  assert.equal(
    compareStage1GateToCanonicalEvidenceShadowV1(
      { status: "NEEDS_EVIDENCE", reason_codes: ["STALE_OR_UNKNOWN_FRESHNESS"] },
      canonical("NEEDS_EVIDENCE"),
      stage1Context,
    ).comparison_state,
    "MATCH",
  );

  assert.equal(
    compareStage1GateToCanonicalEvidenceShadowV1(
      { status: "NEEDS_EVIDENCE", reason_codes: ["STALE_OR_UNKNOWN_FRESHNESS"] },
      canonical("SUFFICIENT"),
      stage1Context,
    ).comparison_state,
    "DIVERGENT",
  );
});

test("B-09b Stage-1 NOT_ELIGIBLE is incomparable because it is trigger absence", () => {
  const result = compareStage1GateToCanonicalEvidenceShadowV1(
    { status: "NOT_ELIGIBLE", reason_codes: ["NO_FORMAL_STAGE1_SIGNAL"] },
    canonical("SUFFICIENT"),
    stage1Context,
  );

  assert.equal(result.comparison_state, "INCOMPARABLE");
  assert.equal(
    result.divergences[0]?.code,
    "STAGE1_NOT_ELIGIBLE_IS_TRIGGER_ABSENCE_NOT_EVIDENCE_CONCLUSION",
  );
  assert.equal(result.authority_removal_permitted, false);
});

test("B-09b malformed producer identity fails closed", () => {
  assert.throws(
    () => compareEvidenceJudgeToCanonicalEvidenceShadowV1(
      { judge_kind: "EVIDENCE", verdict: "PASS" },
      canonical("SUFFICIENT"),
      { ...judgeContext, legacy_producer_id: "stage1-formal-gate" },
    ),
    /B09B_EVIDENCE_JUDGE_PRODUCER_ID_REQUIRED/,
  );

  assert.throws(
    () => compareStage1GateToCanonicalEvidenceShadowV1(
      { status: "ELIGIBLE", reason_codes: [] },
      canonical("SUFFICIENT"),
      { ...stage1Context, legacy_producer_id: "evidence-judge-v2" },
    ),
    /B09B_STAGE1_PRODUCER_ID_REQUIRED/,
  );
});

test("B-09b non-Evidence Judge payload fails closed", () => {
  assert.throws(
    () => compareEvidenceJudgeToCanonicalEvidenceShadowV1(
      { judge_kind: "AGRONOMY", verdict: "PASS" },
      canonical("SUFFICIENT"),
      judgeContext,
    ),
    /B09B_EVIDENCE_JUDGE_RESULT_REQUIRED/,
  );
});

test("B-09b every comparison remains shadow-only and cannot create downstream authority", () => {
  const result = compareEvidenceJudgeToCanonicalEvidenceShadowV1(
    { judge_kind: "EVIDENCE", verdict: "PASS", approval_request_id: "ignored" },
    canonical("SUFFICIENT"),
    judgeContext,
  );

  assert.equal(result.authority_state, "SHADOW_ONLY");
  assert.equal(result.authority_removal_permitted, false);
  assert.equal("approved" in result, false);
  assert.equal("task_id" in result, false);
  assert.equal("device_command" in result, false);
});
