import type { AgronomyRuleSkill } from "../../types";

export const TOMATO_FERTILIZE_RULE: AgronomyRuleSkill = {
  id: "tomato.fertilize.rule.v1",
  crop_code: "tomato",
  match({ crop_stage, metrics }) {
    if (crop_stage !== "flowering" && crop_stage !== "fruiting") return false;
    const ec = Number(metrics?.ec ?? NaN);
    if (!Number.isFinite(ec)) return true;
    return ec < 1.8;
  },
  recommend({ field_id, crop_stage, metrics }) {
    const ec = Number(metrics?.ec ?? NaN);
    return {
      action_type: "FERTILIZE",
      parameters: {
        field_id,
        formula: crop_stage === "flowering" ? "NPK_15_15_15" : "NPK_12_6_24",
        target_ec: 2,
        current_ec: Number.isFinite(ec) ? ec : null,
      },
      expected_effect: {
        type: "nutrition_boost",
        value: 0.7,
      },
      reason_codes: ["TOMATO_NUTRITION_SUPPORT"],
    };
  },
};
