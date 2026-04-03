import type { AgronomyRuleSkill } from "../../types";

export const CORN_WATER_BALANCE_RULE: AgronomyRuleSkill = {
  id: "corn.water_balance.rule.v1",
  crop_code: "corn",
  match({ crop_stage, metrics }) {
    const soilMoisture = Number(metrics?.soil_moisture ?? NaN);
    if (!Number.isFinite(soilMoisture)) return false;
    if (crop_stage === "seedling") return soilMoisture < 38;
    return soilMoisture < 35;
  },
  recommend({ field_id, crop_stage, metrics }) {
    const soilMoisture = Number(metrics?.soil_moisture ?? NaN);
    return {
      action_type: "IRRIGATE",
      parameters: {
        field_id,
        target_soil_moisture: crop_stage === "seedling" ? 42 : 40,
        current_soil_moisture: Number.isFinite(soilMoisture) ? soilMoisture : null,
      },
      expected_effect: {
        type: "moisture_increase",
        value: 8,
      },
      reason_codes: ["CORN_SOIL_MOISTURE_LOW"],
    };
  },
};
