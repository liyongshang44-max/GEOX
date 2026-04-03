import type { RuleSkill, RuleSkillInput, RuleSkillResult } from "../../types";

function evaluateCornWaterBalance(input: RuleSkillInput): RuleSkillResult {
  const soilMoisture = Number(input.telemetry?.soil_moisture ?? NaN);
  if (!Number.isFinite(soilMoisture)) {
    return {
      matched: false,
      action_type: "INSPECT",
      reason_codes: ["SOIL_MOISTURE_MISSING"],
      confidence: 0.2,
    };
  }

  if (soilMoisture < 35) {
    return {
      matched: true,
      action_type: "IRRIGATE",
      reason_codes: ["CORN_SOIL_MOISTURE_LOW"],
      confidence: 0.88,
    };
  }

  return {
    matched: false,
    action_type: "INSPECT",
    reason_codes: ["CORN_SOIL_MOISTURE_OK"],
    confidence: 0.6,
  };
}

export const CORN_WATER_BALANCE_RULE_V1: RuleSkill = {
  rule_id: "rule.corn.water_balance.v1",
  crop_code: "corn",
  version: "1.0.0",
  evaluate: evaluateCornWaterBalance,
};
