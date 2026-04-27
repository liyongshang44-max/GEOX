import assert from "node:assert/strict";
import test from "node:test";
import { buildSkillTraceRef, extractSkillTraceRef, normalizeSkillTrace } from "./skill_trace_service.js";

test("normalizeSkillTrace normalizes and keeps supported fields", () => {
  const trace = normalizeSkillTrace({
    skill_id: " irrigation_deficit_skill_v1 ",
    skill_version: " 1.0.0 ",
    trace_id: " trace_123 ",
    confidence: { level: "HIGH", basis: "measured", reasons: ["a", " ", null] },
    evidence_refs: ["ev1", "ev1", "ev2", " "],
  });

  assert.equal(trace?.skill_id, "irrigation_deficit_skill_v1");
  assert.equal(trace?.trace_id, "trace_123");
  assert.deepEqual(trace?.evidence_refs, ["ev1", "ev2"]);
  assert.deepEqual(trace?.confidence?.reasons, ["a"]);
});

test("buildSkillTraceRef prefers trace id and falls back to skill id/version", () => {
  assert.equal(buildSkillTraceRef({ skill_id: "s1", trace_id: "t1" }), "skill_trace:t1");
  assert.equal(buildSkillTraceRef({ skill_id: "s1", skill_version: "1.2.0" }), "skill:s1@1.2.0");
  assert.equal(buildSkillTraceRef({ skill_id: "s1" }), "skill:s1");
});

test("extractSkillTraceRef supports direct ref, wrapper object and raw trace", () => {
  assert.equal(extractSkillTraceRef("skill_trace:t1"), "skill_trace:t1");
  assert.equal(extractSkillTraceRef({ skill_trace_ref: "skill:s1@1.0.0" }), "skill:s1@1.0.0");
  assert.equal(extractSkillTraceRef({ skill_id: "s2", trace_id: "t2" }), "skill_trace:t2");
});
