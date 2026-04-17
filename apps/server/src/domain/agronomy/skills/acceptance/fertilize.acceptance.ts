import type { AcceptanceSkill } from "../types.js";

export const fertilizeAcceptance: AcceptanceSkill = {
  id: "fertilize_acceptance",
  version: "v1",
  enabled: true,
  action_type: "FERTILIZE",
  validate({ evidence }) {
    const amount = Number(evidence?.fertilizer_kg ?? NaN);
    if (!Number.isFinite(amount) || amount <= 0) {
      return { verdict: "PENDING", reason: "MISSING_FERTILIZER_EVIDENCE" };
    }

    if (amount > 0 && amount <= 500) {
      return { verdict: "PASS", reason: "FERTILIZE_EVIDENCE_VALID" };
    }

    return { verdict: "FAIL", reason: "FERTILIZE_AMOUNT_OUT_OF_RANGE" };
  },
};
