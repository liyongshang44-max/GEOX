import { getCropProfile } from "./crop_catalog.js";

type Input = {
  crop_code: string;
  soil_moisture: number;
};

type Output = {
  should_irrigate: boolean;
  reason: string;
};

export function evaluateAgronomy(input: Input): Output {
  const crop = getCropProfile(input.crop_code);

  if (!crop) {
    return {
      should_irrigate: false,
      reason: "unknown_crop"
    };
  }

  const stage = crop.stages[0]; // 先固定第一阶段

  if (input.soil_moisture < stage.soil_moisture_min) {
    return {
      should_irrigate: true,
      reason: "soil_moisture_below_optimal"
    };
  }

  return {
    should_irrigate: false,
    reason: "within_optimal_range"
  };
}
