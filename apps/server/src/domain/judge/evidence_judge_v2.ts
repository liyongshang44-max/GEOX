import type { JudgeResultV2CreateInput } from "./judge_result_v2.js";

export type EvidenceJudgeEvaluateInput = {
  tenant_id: string;
  project_id: string;
  group_id: string;
  task_id?: string | null;
  receipt_id?: string | null;
  evidence_refs?: unknown[];
  source_refs?: unknown[];
  min_evidence_count?: number;
};

export function evaluateEvidenceJudgeV2(input: EvidenceJudgeEvaluateInput): JudgeResultV2CreateInput {
  const evidenceRefs = Array.isArray(input.evidence_refs) ? input.evidence_refs : [];
  const sourceRefs = Array.isArray(input.source_refs) ? input.source_refs : [];
  const minEvidenceCount = Number(input.min_evidence_count ?? 1);
  const hasEnoughEvidence = evidenceRefs.length >= Math.max(1, minEvidenceCount);

  return {
    judge_kind: "EVIDENCE",
    tenant_id: input.tenant_id,
    project_id: input.project_id,
    group_id: input.group_id,
    task_id: input.task_id ?? null,
    receipt_id: input.receipt_id ?? null,
    verdict: hasEnoughEvidence ? "PASS" : "INSUFFICIENT_EVIDENCE",
    severity: hasEnoughEvidence ? "LOW" : "HIGH",
    reasons: hasEnoughEvidence ? ["evidence_count_ok"] : ["missing_minimum_evidence"],
    inputs: {
      min_evidence_count: Math.max(1, minEvidenceCount),
      evidence_count: evidenceRefs.length,
      source_count: sourceRefs.length,
    },
    outputs: {
      has_enough_evidence: hasEnoughEvidence,
    },
    confidence: {
      level: hasEnoughEvidence ? "HIGH" : "LOW",
      basis: "measured",
      reasons: ["counted_evidence_refs"],
    },
    evidence_refs: evidenceRefs,
    source_refs: sourceRefs,
  };
}
