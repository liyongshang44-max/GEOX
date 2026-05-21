import type { AcceptanceVerdict } from "./types.js";

export function evaluateAcceptance(input: {
  hasReceipt: boolean;
  evidenceCount: number;
  hasFormalEvidence?: boolean;
}): {
  verdict: AcceptanceVerdict;
  missing: string[];
} {
  const missing: string[] = [];

  if (!input.hasReceipt) missing.push("receipt_missing");
  if (input.evidenceCount < 1) missing.push("evidence_missing");
  if (input.evidenceCount > 0 && input.hasFormalEvidence === false) missing.push("formal_evidence_missing");
  missing.push("formal_acceptance_required");

  if (!input.hasReceipt) {
    return { verdict: "PENDING", missing: Array.from(new Set(missing)) };
  }

  if (input.evidenceCount < 1 || input.hasFormalEvidence === false) {
    return { verdict: "INSUFFICIENT_EVIDENCE", missing: Array.from(new Set(missing)) };
  }

  return { verdict: "NEEDS_FORMAL_ACCEPTANCE", missing: Array.from(new Set(missing)) };
}
