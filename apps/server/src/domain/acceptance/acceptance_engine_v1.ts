import { evaluateAcceptance } from "./acceptance_rules_v1.js";
import type { AcceptanceResultV1 } from "./types.js";

export function buildAcceptanceResult(input: {
  operation_plan_id: string;
  hasReceipt: boolean;
  evidenceCount: number;
}): AcceptanceResultV1 {
  const r = evaluateAcceptance(input);

  return {
    acceptance_id: "acc_" + Date.now(),
    operation_plan_id: input.operation_plan_id,
    verdict: r.verdict,
    missing_evidence: r.missing,
    generated_at: new Date().toISOString()
  };
}

export function deriveOperationStatus(input: { receipt: unknown; acceptance: unknown }): string {
  if (input.receipt && !input.acceptance) return "PENDING_ACCEPTANCE";
  return "READY";
}
