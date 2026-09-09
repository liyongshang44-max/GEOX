import assert from "node:assert/strict";
import test from "node:test";

import {
  buildEvidenceSemanticShadowInventoryV1,
} from "./evidence_semantic_shadow_inventory_v1.js";

const scope = {
  tenant_id: "tenantA",
  project_id: "projectA",
  group_id: "groupA",
  field_id: "fieldA",
};

function comparison(
  state: "MATCH" | "DIVERGENT" | "INCOMPARABLE" | "CANONICAL_MISSING" | "LEGACY_MISSING",
  id: string,
) {
  return {
    schema_version: "semantic_shadow_comparison_v1",
    comparison_id: id,
    semantic_id: "evidence.qualification",
    legacy_producer_id: "evidence-judge-v2",
    canonical_owner_ref: "evidence.qualification:canonical-evidence-qualification-shadow",
    scope_ref: "tenant:tenantA/project:projectA/group:groupA/field:fieldA",
    decision_time: "2026-08-28T05:40:00.000Z",
    comparable_dimensions: ["VERDICT", "EVIDENCE_BASIS", "AUTHORITY_CLASS"],
    comparison_state: state,
    divergences: state === "DIVERGENT"
      ? [{
          dimension: "VERDICT",
          code: "LEGACY_REJECTS_WHILE_INDEPENDENT_CANONICAL_EVIDENCE_REMAINS_SUFFICIENT",
          legacy_ref: "judge_result_v2:j1",
          canonical_ref: "judge_result_v2:j1#canonical",
        }]
      : [],
    comparison_basis_refs: ["judge_result_v2:j1"],
    limitations: ["fixture"],
    authority_removal_permitted: false,
    authority_state: "SHADOW_ONLY",
  };
}

function judge(
  id: string,
  shadow: unknown,
  createdTs = 1787895600000,
) {
  return {
    judge_id: id,
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
    outputs: shadow === undefined ? {} : { semantic_shadow_comparison_v1: shadow },
    confidence: { level: "HIGH", basis: "measured", reasons: ["fixture"] },
    evidence_refs: [],
    source_refs: [],
    created_at: new Date(createdTs).toISOString(),
    created_ts_ms: createdTs,
  } as any;
}

test("B-09d inventory counts only explicitly persisted semantic comparisons", () => {
  const inventory = buildEvidenceSemanticShadowInventoryV1(scope, [
    judge("j_match", comparison("MATCH", "cmp_match")),
    judge("j_div", comparison("DIVERGENT", "cmp_div"), 1787895601000),
    judge("j_inc", comparison("INCOMPARABLE", "cmp_inc"), 1787895602000),
  ]);

  assert.equal(inventory.observed_comparison_count, 3);
  assert.deepEqual(inventory.state_counts, {
    MATCH: 1,
    DIVERGENT: 1,
    INCOMPARABLE: 1,
    CANONICAL_MISSING: 0,
    LEGACY_MISSING: 0,
  });
  assert.equal(inventory.unobserved_legacy_result_count, 0);
  assert.equal(inventory.malformed_comparison_count, 0);
  assert.equal(inventory.authority_state, "SHADOW_ONLY");
  assert.equal(inventory.authority_removal_permitted, false);
  assert.equal(inventory.consumer_migration_permitted, false);
  assert.equal(inventory.removal_readiness, "NOT_AUTHORIZED_BY_INVENTORY");
});

test("B-09d historical rows without comparison remain UNOBSERVED, not fabricated missing/divergent states", () => {
  const inventory = buildEvidenceSemanticShadowInventoryV1(scope, [
    judge("historical_without_shadow", undefined),
  ]);

  assert.equal(inventory.observed_comparison_count, 0);
  assert.equal(inventory.unobserved_legacy_result_count, 1);
  assert.deepEqual(inventory.state_counts, {
    MATCH: 0,
    DIVERGENT: 0,
    INCOMPARABLE: 0,
    CANONICAL_MISSING: 0,
    LEGACY_MISSING: 0,
  });
});

test("B-09d malformed persisted comparison is reported as malformed and unobserved", () => {
  const inventory = buildEvidenceSemanticShadowInventoryV1(scope, [
    judge("bad", { schema_version: "semantic_shadow_comparison_v1", comparison_state: "MATCH" }),
  ]);

  assert.equal(inventory.observed_comparison_count, 0);
  assert.equal(inventory.unobserved_legacy_result_count, 1);
  assert.equal(inventory.malformed_comparison_count, 1);
});

test("B-09d missing states are counted only when a valid persisted comparison explicitly says so", () => {
  const inventory = buildEvidenceSemanticShadowInventoryV1(scope, [
    judge("canonical_missing", comparison("CANONICAL_MISSING", "cmp_cm")),
    judge("legacy_missing", comparison("LEGACY_MISSING", "cmp_lm"), 1787895601000),
  ]);

  assert.equal(inventory.state_counts.CANONICAL_MISSING, 1);
  assert.equal(inventory.state_counts.LEGACY_MISSING, 1);
  assert.equal(inventory.unobserved_legacy_result_count, 0);
});

test("B-09d ignores non-Evidence Judge rows and exposes only bounded trace metadata", () => {
  const evidence = judge("evidence", comparison("DIVERGENT", "cmp_e"));
  const agronomy = {
    ...judge("agronomy", comparison("MATCH", "cmp_a")),
    judge_kind: "AGRONOMY",
  };

  const inventory = buildEvidenceSemanticShadowInventoryV1(scope, [
    agronomy,
    evidence,
  ]);

  assert.equal(inventory.observed_comparison_count, 1);
  assert.equal(inventory.items[0]?.judge_id, "evidence");
  assert.equal(inventory.items[0]?.comparison_state, "DIVERGENT");
  assert.deepEqual(inventory.items[0]?.divergence_codes, [
    "LEGACY_REJECTS_WHILE_INDEPENDENT_CANONICAL_EVIDENCE_REMAINS_SUFFICIENT",
  ]);
  assert.equal("legacy_verdict" in (inventory.items[0] as any), false);
  assert.equal("canonical_value" in (inventory.items[0] as any), false);
  assert.equal("approved" in (inventory as any), false);
  assert.equal("task_id" in (inventory as any), false);
});
