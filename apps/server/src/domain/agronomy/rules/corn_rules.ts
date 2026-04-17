import type { AgronomyRuleInput } from "@geox/contracts";
import type { AgronomyRule } from "./index.js";
import { makeRecommendation } from "./helpers.js";

export const cornRules: AgronomyRule[] = [
  {
    rule_id: "corn_vegetative_low_moisture_irrigate_v1",
    crop_code: "corn",
    stages: ["vegetative"],
    evaluate: (input: AgronomyRuleInput) => {
      if (input.crop_stage !== "vegetative") return null;
      if (typeof input.telemetry.soil_moisture !== "number" || input.telemetry.soil_moisture >= 25) return null;

      return makeRecommendation(input, {
        rule_id: "corn_vegetative_low_moisture_irrigate_v1",
        action_type: "IRRIGATE",
        confidence: 0.9,
        reasons: [
          "当前作物阶段为营养生长期",
          "土壤含水率低于 25% 阈值",
          "需要及时灌溉以降低生长受限风险",
        ],
        expected_effect: [
          {
            metric: "soil_moisture",
            direction: "increase",
            value: 8,
            unit: "%",
          },
        ],
      });
    },
  },
  {
    rule_id: "corn_reproductive_heat_inspect_v1",
    crop_code: "corn",
    stages: ["reproductive"],
    evaluate: (input: AgronomyRuleInput) => {
      if (input.crop_stage !== "reproductive") return null;
      if (typeof input.telemetry.canopy_temp !== "number" || input.telemetry.canopy_temp <= 34) return null;

      return makeRecommendation(input, {
        rule_id: "corn_reproductive_heat_inspect_v1",
        action_type: "INSPECT",
        confidence: 0.82,
        reasons: [
          "当前作物阶段为生殖生长期",
          "冠层温度高于 34°C 阈值",
          "需要田间巡检确认热胁迫与水分状态",
        ],
        expected_effect: [
          {
            metric: "heat_stress_risk",
            direction: "decrease",
          },
        ],
      });
    },
  },
];
