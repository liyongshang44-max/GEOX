import { irrigationRule } from "./rules/irrigation";
import { inspectionRule } from "./rules/inspection";
import { sprayRule } from "./rules/spray";
import { manualRule } from "./rules/manual";
import type { AcceptanceEvaluationOutput, AcceptanceRule } from "./rules/types";

type EvaluateInput = {
  action_type: string;
  parameters: Record<string, any>;
  telemetry: Record<string, any>;
  acceptance_policy_ref: string | null;
};

const RULE_PACK: Record<string, AcceptanceRule> = {
  [irrigationRule.task_type]: irrigationRule,
  [inspectionRule.task_type]: inspectionRule,
  [sprayRule.task_type]: sprayRule,
  [manualRule.task_type]: manualRule
};

function loadRule(task_type: string): AcceptanceRule {
  return RULE_PACK[String(task_type ?? "").trim().toUpperCase()] ?? manualRule;
}

export function evaluateAcceptanceV1(input: EvaluateInput): AcceptanceEvaluationOutput {
  const rule = loadRule(input.action_type);
  return rule.run({
    parameters: input.parameters ?? {},
    telemetry: input.telemetry ?? {},
    acceptance_policy_ref: input.acceptance_policy_ref ?? null
  });
}
