import { randomUUID, createHash } from "node:crypto";

export type JudgeSkillTraceV1 = {
  skill_id: string;
  skill_version: string;
  skill_category: "SENSING" | "EVIDENCE" | "EXECUTION" | "ACCEPTANCE";
  trace_id: string;
  run_id: string;
  input_digest: string;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  confidence: {
    level: "HIGH" | "MEDIUM" | "LOW";
    basis: "measured" | "estimated" | "assumed";
    reasons: string[];
  };
  evidence_refs: unknown[];
};

function digest(v: unknown) {
  return createHash("sha256").update(JSON.stringify(v ?? {})).digest("hex");
}

export function buildJudgeSkillTraceV1(input: {
  skill_id: string;
  skill_version: string;
  skill_category: JudgeSkillTraceV1["skill_category"];
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  confidence: JudgeSkillTraceV1["confidence"];
  evidence_refs?: unknown[];
}): JudgeSkillTraceV1 {
  return {
    skill_id: input.skill_id,
    skill_version: input.skill_version,
    skill_category: input.skill_category,
    trace_id: `trace_${randomUUID()}`,
    run_id: `run_${randomUUID()}`,
    input_digest: digest(input.inputs),
    inputs: input.inputs,
    outputs: input.outputs,
    confidence: input.confidence,
    evidence_refs: Array.isArray(input.evidence_refs) ? input.evidence_refs : [],
  };
}
