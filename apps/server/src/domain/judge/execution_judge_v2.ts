import type { JudgeResultV2CreateInput } from "./judge_result_v2.js";

export type ExecutionJudgeEvaluateInput = {
  tenant_id: string;
  project_id: string;
  group_id: string;
  task_id: string;
  receipt_id?: string | null;
  prescription_id?: string | null;
  as_executed_id?: string | null;
  as_applied_id?: string | null;
  field_id?: string | null;
  device_id?: string | null;
  expected_amount?: number | null;
  executed_amount?: number | null;
  tolerance_percent?: number;
  evidence_refs?: unknown[];
  source_refs?: unknown[];
};

export function evaluateExecutionJudgeV2(input: ExecutionJudgeEvaluateInput): JudgeResultV2CreateInput {
  const expectedAmount = Number(input.expected_amount);
  const executedAmount = Number(input.executed_amount);
  const tolerancePercent = Math.max(0, Number(input.tolerance_percent ?? 20));
  const hasComparable = Number.isFinite(expectedAmount) && expectedAmount > 0 && Number.isFinite(executedAmount);

  const deltaPercent = hasComparable
    ? Math.abs(((executedAmount - expectedAmount) / expectedAmount) * 100)
    : null;
  const withinTolerance = hasComparable && deltaPercent !== null ? deltaPercent <= tolerancePercent : false;

  return {
    judge_kind: "EXECUTION",
    tenant_id: input.tenant_id,
    project_id: input.project_id,
    group_id: input.group_id,
    task_id: input.task_id,
    receipt_id: input.receipt_id ?? null,
    prescription_id: input.prescription_id ?? null,
    as_executed_id: input.as_executed_id ?? null,
    as_applied_id: input.as_applied_id ?? null,
    field_id: input.field_id ?? null,
    device_id: input.device_id ?? null,
    verdict: hasComparable ? (withinTolerance ? "PASS" : "FAIL") : "INSUFFICIENT_EVIDENCE",
    severity: hasComparable ? (withinTolerance ? "LOW" : "HIGH") : "MEDIUM",
    reasons: hasComparable
      ? (withinTolerance ? ["execution_within_tolerance"] : ["execution_deviation_exceeds_tolerance"])
      : ["execution_amount_missing"],
    inputs: {
      expected_amount: Number.isFinite(expectedAmount) ? expectedAmount : null,
      executed_amount: Number.isFinite(executedAmount) ? executedAmount : null,
      tolerance_percent: tolerancePercent,
    },
    outputs: {
      delta_percent: deltaPercent,
      within_tolerance: withinTolerance,
    },
    confidence: {
      level: hasComparable ? "HIGH" : "LOW",
      basis: hasComparable ? "measured" : "estimated",
      reasons: hasComparable ? ["expected_vs_executed_compare"] : ["insufficient_execution_signals"],
    },
    evidence_refs: Array.isArray(input.evidence_refs) ? input.evidence_refs : [],
    source_refs: Array.isArray(input.source_refs) ? input.source_refs : [],
  };
}
