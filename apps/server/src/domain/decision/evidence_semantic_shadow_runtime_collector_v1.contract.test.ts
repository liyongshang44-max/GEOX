import assert from "node:assert/strict";
import test from "node:test";

import { collectEvidenceJudgeSemanticShadowComparisonV1 } from "./evidence_semantic_shadow_runtime_collector_v1.js";

function makeJudge(
  verdict: string,
  canonicalStatus: "SUFFICIENT" | "NEEDS_EVIDENCE" | "UNKNOWN",
) {
  return {
    judge_id: "judge_b09c_001",
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
    verdict,
    severity: "LOW",
    reasons: ["legacy_reason"],
    inputs: { now_ts_ms: 1787891400000 },
    outputs: {
      skill_traces: [{ skill_id: "legacy_skill" }],
      canonical_evidence_sufficiency_shadow_v1: {
        schema_version: "evidence_judge_canonical_sufficiency_shadow_v1",
        authority_mode: "SHADOW_NON_AUTHORITATIVE",
        qualification_role: "STAGE1_FORMAL_EVIDENCE",
        status: canonicalStatus,
        counts: {
          total: 2,
          role_eligible: canonicalStatus === "SUFFICIENT" ? 1 : 0,
          role_limited: 0,
          role_ineligible: canonicalStatus === "NEEDS_EVIDENCE" ? 2 : 0,
          role_unknown: canonicalStatus === "UNKNOWN" ? 2 : 0,
        },
        reason_codes: [],
        canonical_reason_codes: [],
        limitations: ["B04E_SHADOW_NON_AUTHORITATIVE"],
      },
    },
    confidence: {
      level: "HIGH",
      basis: "measured",
      reasons: ["fixture"],
    },
    evidence_refs: [],
    source_refs: [],
    created_at: "2026-08-28T04:30:01.000Z",
    created_ts_ms: 1787891401000,
  } as any;
}

test("B-09c collects a runtime MATCH without mutating the legacy Judge result", () => {
  const judge = makeJudge("PASS", "SUFFICIENT");
  const before = structuredClone(judge);
  const comparison = collectEvidenceJudgeSemanticShadowComparisonV1(judge);

  assert.equal(comparison?.comparison_state, "MATCH");
  assert.equal(comparison?.authority_state, "SHADOW_ONLY");
  assert.equal(comparison?.authority_removal_permitted, false);
  assert.equal(comparison?.comparison_id, "b09c:evidence-judge:judge_b09c_001");
  assert.deepEqual(comparison?.comparison_basis_refs, [
    "judge_result_v2:judge_b09c_001",
    "judge_result_v2:judge_b09c_001#outputs.canonical_evidence_sufficiency_shadow_v1",
  ]);
  assert.deepEqual(judge, before);
});

test("B-09c records the independent-canonical-support divergence", () => {
  const comparison = collectEvidenceJudgeSemanticShadowComparisonV1(
    makeJudge("SENSOR_DRIFT", "SUFFICIENT"),
  );

  assert.equal(comparison?.comparison_state, "DIVERGENT");
  assert.equal(
    comparison?.divergences[0]?.code,
    "LEGACY_REJECTS_WHILE_INDEPENDENT_CANONICAL_EVIDENCE_REMAINS_SUFFICIENT",
  );
  assert.equal(comparison?.authority_removal_permitted, false);
});

test("B-09c records canonical UNKNOWN as INCOMPARABLE", () => {
  const comparison = collectEvidenceJudgeSemanticShadowComparisonV1(
    makeJudge("PASS", "UNKNOWN"),
  );

  assert.equal(comparison?.comparison_state, "INCOMPARABLE");
  assert.equal(
    comparison?.divergences[0]?.code,
    "CANONICAL_EVIDENCE_SUFFICIENCY_UNKNOWN",
  );
});

test("B-09c collector failure never mutates or blocks the legacy result", () => {
  const missingShadow = makeJudge("PASS", "SUFFICIENT");
  delete missingShadow.outputs.canonical_evidence_sufficiency_shadow_v1;
  const before = structuredClone(missingShadow);

  assert.equal(
    collectEvidenceJudgeSemanticShadowComparisonV1(missingShadow),
    null,
  );
  assert.deepEqual(missingShadow, before);

  const agronomy = { ...makeJudge("PASS", "SUFFICIENT"), judge_kind: "AGRONOMY" };
  assert.equal(collectEvidenceJudgeSemanticShadowComparisonV1(agronomy), null);
});

test("B-09c comparison carries exact decision scope and no downstream authority", () => {
  const comparison = collectEvidenceJudgeSemanticShadowComparisonV1(
    makeJudge("STALE_DATA", "NEEDS_EVIDENCE"),
  );

  assert.equal(
    comparison?.scope_ref,
    "tenant:tenantA/project:projectA/group:groupA/field:fieldA",
  );
  assert.equal(comparison?.decision_time, "2026-08-28T04:30:00.000Z");
  assert.equal(comparison?.comparison_state, "MATCH");
  assert.equal("approved" in (comparison as any), false);
  assert.equal("task_id" in (comparison as any), false);
  assert.equal("device_command" in (comparison as any), false);
});
