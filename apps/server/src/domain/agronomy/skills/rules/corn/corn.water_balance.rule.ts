import type { AgronomyRuleSkill } from "../../types";

export const cornWaterRule: AgronomyRuleSkill = {
  id: "corn_water_balance_v1",
  crop_code: "corn",

  match({ crop_stage, metrics }) {
    return (
      crop_stage === "vegetative" &&
      metrics?.soil_moisture < 20
    );
  },

  recommend({ field_id }) {
    return {
      action_type: "IRRIGATE",
      expected_effect: {
        type: "moisture_increase",
        value: 10
      },
      reason_codes: ["LOW_SOIL_MOISTURE"]
    };
  }
};
