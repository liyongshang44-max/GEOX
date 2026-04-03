import type { AgronomyRuleInput } from "@geox/contracts";
import type { AgronomyRule } from "./index";
import { makeRecommendation } from "./helpers";

const TOMATO_EC_THRESHOLD = 1.8;

export const tomatoRules: AgronomyRule[] = [
  {
    rule_id: "tomato_fruiting_low_nutrient_fertilize_v1",
    crop_code: "tomato",
    stages: ["fruiting"],
    evaluate: (input: AgronomyRuleInput) => {
      if (input.crop_stage !== "fruiting") return null;
      if (typeof input.telemetry.ec !== "number" || input.telemetry.ec >= TOMATO_EC_THRESHOLD) return null;

      return makeRecommendation(input, {
        rule_id: "tomato_fruiting_low_nutrient_fertilize_v1",
        action_type: "FERTILIZE",
        confidence: 0.88,
        reasons: [
          "当前作物阶段为结果期",
          "土壤电导率低于目标阈值",
          "需要补充养分以维持坐果稳定",
        ],
        expected_effect: [
          {
            metric: "ec",
            direction: "increase",
            value: 0.4,
            unit: "mS/cm",
          },
        ],
      });
    },
  },
  {
    rule_id: "tomato_flowering_high_temp_inspect_v1",
    crop_code: "tomato",
    stages: ["flowering"],
    evaluate: (input: AgronomyRuleInput) => {
      if (input.crop_stage !== "flowering") return null;
      if (typeof input.telemetry.canopy_temp !== "number" || input.telemetry.canopy_temp <= 32) return null;

      return makeRecommendation(input, {
        rule_id: "tomato_flowering_high_temp_inspect_v1",
        action_type: "INSPECT",
        confidence: 0.8,
        reasons: [
          "当前作物阶段为开花期",
          "冠层温度高于 32°C 阈值",
          "需要巡检判断授粉与热害风险",
        ],
        expected_effect: [
          {
            metric: "flowering_heat_risk",
            direction: "decrease",
          },
        ],
      });
    },
  },
];
