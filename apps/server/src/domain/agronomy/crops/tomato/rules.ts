export type AgronomyContext = {
  cropStage: string;
  nutrientDeficit?: boolean;
  soilDry?: boolean;
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

export const tomatoRules: AgronomyRule[] = [
  {
    ruleId: "tomato_vegetative_fertilize_nutrient_deficit",
    cropCode: "tomato",
    cropStage: "vegetative",
    actionType: "FERTILIZE",
    priority: "medium",
    reasonCodes: ["nutrient_deficit_placeholder"],
    expectedEffect: {
      type: "vegetative_nutrition_support",
      value: 10
    },
    riskIfNotExecute: "leaf_area_expansion_limited",
    matches: (ctx) => ctx.cropStage === "vegetative" && Boolean(ctx.nutrientDeficit)
  },
  {
    ruleId: "tomato_fruiting_irrigate_soil_dry",
    cropCode: "tomato",
    cropStage: "fruiting",
    actionType: "IRRIGATE",
    priority: "high",
    reasonCodes: ["soil_dry"],
    expectedEffect: {
      type: "fruit_set_water_support",
      value: 12
    },
    riskIfNotExecute: "fruit_crack_and_size_reduction_risk",
    matches: (ctx) => ctx.cropStage === "fruiting" && Boolean(ctx.soilDry)
  }
];
