import type { AcceptanceResultV1 } from "./types.js";

export function buildAcceptanceResult(input: {
  operation_plan_id: string;
  hasReceipt: boolean;
  evidenceCount: number;
}): AcceptanceResultV1 {
  const missing = [
    ...(!input.hasReceipt ? ["receipt"] : []),
    ...(input.evidenceCount <= 0 ? ["formal_evidence"] : []),
    "formal_acceptance_required",
  ];

  return {
    acceptance_id: "acc_" + Date.now(),
    operation_plan_id: input.operation_plan_id,
    verdict: "PENDING",
    summary: "Partial execution signals are not sufficient for formal acceptance; formal acceptance is required.",
    missing_evidence: Array.from(new Set(missing)),
    generated_at: new Date().toISOString()
  };
}

export function deriveOperationStatus(input: { receipt: unknown; acceptance: unknown }): string {
  if (input.receipt && !input.acceptance) return "PENDING_ACCEPTANCE";
  return "READY";
}
