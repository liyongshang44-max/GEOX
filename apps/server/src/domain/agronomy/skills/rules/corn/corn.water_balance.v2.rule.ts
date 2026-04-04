import type { AgronomyRuleSkill } from "../../types";

export const cornWaterRuleV2: AgronomyRuleSkill = {
  id: "corn_water_balance",
  version: "v2",
  enabled: true,
  crop_code: "corn",

  match({ crop_stage, metrics }) {
    return crop_stage === "vegetative" && metrics?.soil_moisture < 25;
  },

  recommend() {
    return {
      action_type: "IRRIGATE",
      expected_effect: { type: "moisture_increase", value: 15 },
      reason_codes: ["LOW_SOIL_MOISTURE_V2"],
      rule_id: "corn_water_balance",
      version: "v2",
    };
  }
};
