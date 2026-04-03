import type { RuleSkill, RuleSkillInput, RuleSkillResult } from "../../types";

function evaluateTomatoFertilize(input: RuleSkillInput): RuleSkillResult {
  const stage = String(input.crop_stage ?? "").toLowerCase();
  const humidity = Number(input.telemetry?.humidity ?? NaN);

  if (stage === "flowering" || stage === "fruiting") {
    if (Number.isFinite(humidity) && humidity < 45) {
      return {
        matched: true,
        action_type: "FERTILIZE",
        reason_codes: ["TOMATO_FRUIT_STAGE_NEEDS_FERTILIZE"],
        confidence: 0.8,
      };
    }

    return {
      matched: true,
      action_type: "FERTILIZE",
      reason_codes: ["TOMATO_STAGE_PRIORITY_FERTILIZE"],
      confidence: 0.7,
    };
  }

  return {
    matched: false,
    action_type: "INSPECT",
    reason_codes: ["TOMATO_STAGE_NOT_MATCHED"],
    confidence: 0.55,
  };
}

export const TOMATO_FERTILIZE_RULE_V1: RuleSkill = {
  rule_id: "rule.tomato.fertilize.v1",
  crop_code: "tomato",
  version: "1.0.0",
  evaluate: evaluateTomatoFertilize,
};
