import { evaluateAcceptance } from "./acceptance_rules_v1";
import type { AcceptanceResultV1 } from "./types";

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
