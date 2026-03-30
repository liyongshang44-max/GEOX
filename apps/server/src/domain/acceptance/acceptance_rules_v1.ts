export function evaluateAcceptance(input: {
  hasReceipt: boolean;
  evidenceCount: number;
}): {
  verdict: "PASS" | "FAIL" | "PENDING";
  missing: string[];
} {
  const missing: string[] = [];

  if (!input.hasReceipt) missing.push("receipt_missing");
  if (input.evidenceCount < 1) missing.push("evidence_missing");

  if (missing.length === 0) {
    return { verdict: "PASS", missing: [] };
  }

  if (missing.includes("receipt_missing")) {
    return { verdict: "FAIL", missing };
  }

  return { verdict: "PENDING", missing };
}
