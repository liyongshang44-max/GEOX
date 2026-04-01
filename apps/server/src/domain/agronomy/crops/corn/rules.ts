export type AgronomyContext = {
  cropStage: string;
  soilMoisture?: number;
};

export type AgronomyRule = {
  ruleId: string;
  cropCode: string;
  cropStage: string;
  actionType: "IRRIGATE" | "FERTILIZE" | "SPRAY" | "INSPECT";
  priority: "low" | "medium" | "high";
  reasonCodes: string[];
  expectedEffect: {
    type: string;
    value: number;
  };
  riskIfNotExecute: string;
  matches: (ctx: AgronomyContext) => boolean;
};

export const cornRules: AgronomyRule[] = [
  {
    ruleId: "corn_vegetative_irrigate_low_soil_moisture",
    cropCode: "corn",
    cropStage: "vegetative",
    actionType: "IRRIGATE",
    priority: "medium",
    reasonCodes: ["soil_moisture_low"],
    expectedEffect: {
      type: "soil_moisture_recovery",
      value: 15
    },
    riskIfNotExecute: "vegetative_growth_slowdown",
    matches: (ctx) => ctx.cropStage === "vegetative" && (ctx.soilMoisture ?? 100) < 35
  },
  {
    ruleId: "corn_flowering_irrigate_very_low_soil_moisture",
    cropCode: "corn",
    cropStage: "flowering",
    actionType: "IRRIGATE",
    priority: "high",
    reasonCodes: ["soil_moisture_very_low"],
    expectedEffect: {
      type: "flowering_water_stress_relief",
      value: 20
    },
    riskIfNotExecute: "pollination_failure_risk",
    matches: (ctx) => ctx.cropStage === "flowering" && (ctx.soilMoisture ?? 100) < 25
  }
];
