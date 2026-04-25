import { randomUUID } from "node:crypto";

import type { SkillTraceV1 } from "@geox/contracts";

export function buildSkillTraceV1(input: {
  skill_id?: string;
  skill_version?: string;
  inputs?: Record<string, any>;
  outputs?: Record<string, any>;
  evidence_refs?: string[];
  confidence?: SkillTraceV1["confidence"];
}): SkillTraceV1 {
  const traceConfidence = input.confidence ?? {
    level: "MEDIUM",
    basis: "estimated",
    reasons: ["default_skill_trace_confidence"],
  };

  return {
    skill_id: String(input.skill_id ?? "irrigation_deficit_skill_v1"),
    skill_version: input.skill_version,
    trace_id: `trace_${randomUUID().replace(/-/g, "")}`,
    inputs: input.inputs ?? {},
    outputs: input.outputs ?? {},
    confidence: traceConfidence,
    evidence_refs: Array.isArray(input.evidence_refs) ? input.evidence_refs : [],
  };
}
