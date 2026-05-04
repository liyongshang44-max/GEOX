import { buildJudgeSkillTraceV1 } from "./judge_skill_trace_v1";

type ReceiptCompletenessVerdict = "PASS" | "FAIL" | "INSUFFICIENT_EVIDENCE";

type Receipt = {
  status?: string | null;
  evidence_refs?: unknown[] | null;
};

export type ReceiptCompletenessSkillV1Input = {
  receipt?: Receipt | null;
};

export type ReceiptCompletenessSkillV1Output = {
  verdict: ReceiptCompletenessVerdict;
  reasons: string[];
};

export function runReceiptCompletenessSkillV1(input: ReceiptCompletenessSkillV1Input) {
  const receipt = input.receipt;

  let output: ReceiptCompletenessSkillV1Output;

  if (!receipt) {
    output = { verdict: "INSUFFICIENT_EVIDENCE", reasons: ["missing_receipt"] };
  } else if (receipt.status !== "executed") {
    output = { verdict: "FAIL", reasons: ["receipt_not_executed"] };
  } else if (!Array.isArray(receipt.evidence_refs) || receipt.evidence_refs.length === 0) {
    output = { verdict: "INSUFFICIENT_EVIDENCE", reasons: ["missing_receipt_evidence_refs"] };
  } else {
    output = { verdict: "PASS", reasons: ["receipt_completeness_pass"] };
  }

  const trace = buildJudgeSkillTraceV1({
    skill_id: "receipt_completeness_skill_v1",
    skill_version: "v1",
    skill_category: "acceptance",
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
