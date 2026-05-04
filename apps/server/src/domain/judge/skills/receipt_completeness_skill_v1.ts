import { buildJudgeSkillTraceV1 } from "./judge_skill_trace_v1";

type ReceiptCompletenessCode = "PASS" | "FAIL" | "INSUFFICIENT_EVIDENCE";

type Receipt = {
  status?: string | null;
  evidence_refs?: unknown[] | null;
};

export type ReceiptCompletenessSkillV1Input = {
  receipt?: Receipt | null;
};

export type ReceiptCompletenessSkillV1Output = {
  code: ReceiptCompletenessCode;
  reason: string;
};

export function runReceiptCompletenessSkillV1(input: ReceiptCompletenessSkillV1Input) {
  const receipt = input.receipt;

  let output: ReceiptCompletenessSkillV1Output;

  if (!receipt) {
    output = {
      code: "INSUFFICIENT_EVIDENCE",
      reason: "receipt is missing",
    };
  } else if (receipt.status !== "executed") {
    output = {
      code: "FAIL",
      reason: "receipt status is not executed",
    };
  } else if (!Array.isArray(receipt.evidence_refs) || receipt.evidence_refs.length === 0) {
    output = {
      code: "INSUFFICIENT_EVIDENCE",
      reason: "receipt evidence_refs is missing or empty",
    };
  } else {
    output = {
      code: "PASS",
      reason: "receipt is executed and has evidence references",
    };
  }

  const trace = buildJudgeSkillTraceV1({
    skill_id: "receipt_completeness_skill_v1",
    skill_version: "v1",
    skill_category: "EXECUTION",
    inputs: { receipt },
    outputs: output,
    confidence: {
      level: "HIGH",
      basis: "measured",
      reasons: ["Direct checks on receipt existence, status, and evidence references."],
    },
    evidence_refs: Array.isArray(receipt?.evidence_refs) ? receipt.evidence_refs : [],
  });

  return { output, trace };
}
