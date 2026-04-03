import type { AcceptanceInput, AcceptanceResult, AcceptanceSkill } from "../types";

function evaluateIrrigationAcceptance(input: AcceptanceInput): AcceptanceResult {
  const observedDuration = Number(input.observed_parameters?.duration_min ?? NaN);
  const expectedDuration = Number(input.expected_parameters?.duration_min ?? NaN);

  if (!Number.isFinite(observedDuration) || observedDuration <= 0) {
    return { pass: false, score: 0, reason: "IRRIGATION_DURATION_MISSING" };
  }

  if (Number.isFinite(expectedDuration) && expectedDuration > 0) {
    const ratio = Math.abs(observedDuration - expectedDuration) / expectedDuration;
    if (ratio <= 0.3) return { pass: true, score: 0.9, reason: "IRRIGATION_DURATION_WITHIN_RANGE" };
    return { pass: false, score: 0.45, reason: "IRRIGATION_DURATION_OUT_OF_RANGE" };
  }

  return { pass: true, score: 0.75, reason: "IRRIGATION_COMPLETED_NO_EXPECTED_BASELINE" };
}

export const IRRIGATION_ACCEPTANCE_V1: AcceptanceSkill = {
  acceptance_id: "acceptance.irrigation.v1",
  action_type: "IRRIGATE",
  version: "1.0.0",
  evaluate: evaluateIrrigationAcceptance,
};
