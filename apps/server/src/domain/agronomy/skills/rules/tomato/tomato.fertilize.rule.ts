import type { AgronomyRuleSkill } from "../../types";

export const tomatoFertilizeRule: AgronomyRuleSkill = {
  id: "tomato_fertilize_v1",
  crop_code: "tomato",

  match({ crop_stage }) {
    return crop_stage === "fruiting";
  },

  recommend() {
    return {
      action_type: "FERTILIZE",
      expected_effect: {
        type: "growth_boost",
        value: 15
      },
      reason_codes: ["FRUITING_STAGE"]
    };
  }
};
