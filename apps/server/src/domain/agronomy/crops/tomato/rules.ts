import type { AgronomyContext, AgronomyRule } from "../../types.js";

export const tomatoRules: AgronomyRule[] = [
  {
    ruleId: "tomato_vegetative_fertilize_v1",
    cropCode: "tomato",
    cropStage: "vegetative",
    actionType: "FERTILIZE",
    priority: "medium",
    reasonCodes: ["nutrition_support_needed"],
    expectedEffect: {
      type: "nutrition_boost",
      value: 8,
    },
    riskIfNotExecute: "营养生长期养分补给不足，可能导致长势偏弱并影响后续开花坐果。",
    matches: (_ctx: AgronomyContext) => {
      return true;
    },
  },
  {
    ruleId: "tomato_fruiting_irrigation_v1",
    cropCode: "tomato",
    cropStage: "fruiting",
    actionType: "IRRIGATE",
    priority: "high",
    reasonCodes: ["fruiting_stage_water_stress"],
    expectedEffect: {
      type: "moisture_increase",
      value: 10,
    },
    riskIfNotExecute: "结果期持续缺水会导致果实膨大不足，影响产量与品质。",
    matches: (ctx: AgronomyContext) => {
      const moisture = ctx.currentMetrics.soil_moisture;
      return typeof moisture === "number" && moisture < 30;
    },
  },
];
