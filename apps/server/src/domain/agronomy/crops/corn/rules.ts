import type { AgronomyContext, AgronomyRule } from "../../types";

export const cornRules: AgronomyRule[] = [
  {
    ruleId: "corn_vegetative_irrigation_v1",
    cropCode: "corn",
    cropStage: "vegetative",
    actionType: "IRRIGATE",
    priority: "high",
    reasonCodes: ["soil_moisture_below_optimal"],
    expectedEffect: {
      type: "moisture_increase",
      value: 10,
    },
    riskIfNotExecute: "土壤含水继续下降，可能抑制玉米营养生长期长势并造成后续减产风险。",
    matches: (ctx: AgronomyContext) => {
      const moisture = ctx.currentMetrics.soil_moisture;
      return typeof moisture === "number" && moisture < 25;
    },
  },
  {
    ruleId: "corn_flowering_irrigation_critical_v1",
    cropCode: "corn",
    cropStage: "reproductive",
    actionType: "IRRIGATE",
    priority: "high",
    reasonCodes: ["soil_moisture_critical_during_flowering"],
    expectedEffect: {
      type: "moisture_increase",
      value: 12,
    },
    riskIfNotExecute: "开花期缺水会直接影响授粉与结实，存在明显减产风险。",
    matches: (ctx: AgronomyContext) => {
      const moisture = ctx.currentMetrics.soil_moisture;
      return typeof moisture === "number" && moisture < 28;
    },
  },
];
