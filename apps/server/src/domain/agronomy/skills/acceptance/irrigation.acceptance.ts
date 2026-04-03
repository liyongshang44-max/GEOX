import type { AcceptanceSkill } from "../types";

export const IRRIGATION_ACCEPTANCE_SKILL: AcceptanceSkill = {
  action_type: "IRRIGATE",
  validate({ evidence }) {
    const duration = Number(evidence?.duration_min ?? NaN);
    if (!Number.isFinite(duration) || duration <= 0) {
      return { verdict: "PENDING", reason: "MISSING_DURATION_EVIDENCE" };
    }

    const withinWindow = duration >= 5 && duration <= 180;
    if (!withinWindow) return { verdict: "FAIL", reason: "IRRIGATION_DURATION_OUT_OF_RANGE" };
    return { verdict: "PASS", reason: "IRRIGATION_EVIDENCE_VALID" };
  },
};
