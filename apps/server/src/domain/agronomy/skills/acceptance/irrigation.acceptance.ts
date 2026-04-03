import type { AcceptanceSkill } from "../types";

export const irrigationAcceptance: AcceptanceSkill = {
  action_type: "IRRIGATE",

  validate({ evidence }) {
    if (!evidence?.metrics?.length) {
      return {
        verdict: "FAIL",
        reason: "NO_METRICS"
      };
    }

    return { verdict: "PASS" };
  }
};
