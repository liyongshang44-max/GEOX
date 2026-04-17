import type { AgronomyRuleSkill } from "../../types.js";

export const tomatoFertilizeRule: AgronomyRuleSkill = {
  id: "tomato_fertilize",
  version: "v1",
  enabled: true,
  crop_code: "tomato",

  match({ crop_stage }) {
    return crop_stage === "fruiting";
  },

  recommend({ field_id }) {
    return {
      action_type: "FERTILIZE",
      parameters: { field_id },
      expected_effect: {
        type: "growth_boost",
        value: 15
      },
      reason_codes: ["FRUITING_STAGE"],
      rule_id: "tomato_fertilize",
      version: "v1",
    };
  }
};
