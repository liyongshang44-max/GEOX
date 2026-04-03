import type { AcceptanceInput, AcceptanceResult, AcceptanceSkill } from "../types";

function evaluateFertilizeAcceptance(input: AcceptanceInput): AcceptanceResult {
  const observedAmount = Number(input.observed_parameters?.fertilizer_kg ?? NaN);
  const expectedAmount = Number(input.expected_parameters?.fertilizer_kg ?? NaN);

  if (!Number.isFinite(observedAmount) || observedAmount <= 0) {
    return { pass: false, score: 0, reason: "FERTILIZE_AMOUNT_MISSING" };
  }

  if (Number.isFinite(expectedAmount) && expectedAmount > 0) {
    const ratio = Math.abs(observedAmount - expectedAmount) / expectedAmount;
    if (ratio <= 0.25) return { pass: true, score: 0.92, reason: "FERTILIZE_AMOUNT_WITHIN_RANGE" };
    return { pass: false, score: 0.4, reason: "FERTILIZE_AMOUNT_OUT_OF_RANGE" };
  }

  return { pass: true, score: 0.72, reason: "FERTILIZE_COMPLETED_NO_EXPECTED_BASELINE" };
}

export const FERTILIZE_ACCEPTANCE_V1: AcceptanceSkill = {
  acceptance_id: "acceptance.fertilize.v1",
  action_type: "FERTILIZE",
  version: "1.0.0",
  evaluate: evaluateFertilizeAcceptance,
};
