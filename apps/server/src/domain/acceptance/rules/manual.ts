import type { AcceptanceRule } from "./types";

export const manualRule: AcceptanceRule = {
  task_type: "MANUAL",
  run(input) {
    const manualApproved = input.telemetry.manual_approved === true || input.parameters.manual_approved === true;
    return {
      result: manualApproved ? "PASSED" : "INCONCLUSIVE",
      rule_id: "acceptance_rule_v1_manual_confirmation",
      score: manualApproved ? 1 : 0,
      metrics: {
        manual_approved: manualApproved ? 1 : 0
      }
    };
  }
};
