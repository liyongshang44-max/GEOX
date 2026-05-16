import test from "node:test";
import assert from "node:assert/strict";
import { finalizeRecommendationResponseV1 } from "./decision_engine_v1.js";

test("finalizeRecommendationResponseV1 keeps adjusted recommendations when non-empty", () => {
  const resolved = [{ recommendation_id: "rec_1" }] as any[];
  const adjusted = [{ recommendation_id: "rec_1", requires_manual_review: true }] as any[];
  const result = finalizeRecommendationResponseV1({
    resolvedRecommendations: resolved as any,
    adjustedRecommendations: adjusted as any,
    tenant_id: "t1",
    project_id: "p1",
    group_id: "g1",
  });
  assert.equal(result.length, 1);
  assert.equal((result[0] as any).requires_manual_review, true);
});

test("finalizeRecommendationResponseV1 falls back to resolved when adjustment output is empty", () => {
  let warning = "";
  const resolved = [{ recommendation_id: "rec_1" }] as any[];
  const result = finalizeRecommendationResponseV1({
    resolvedRecommendations: resolved as any,
    adjustedRecommendations: [] as any,
    tenant_id: "t1",
    project_id: "p1",
    group_id: "g1",
    field_id: "f1",
    warn: (message) => { warning = message; },
  });
  assert.equal(result.length, 1);
  assert.equal((result[0] as any).recommendation_id, "rec_1");
  assert.equal(warning, "field_memory_adjustment_empty_fallback_to_resolved");
});
