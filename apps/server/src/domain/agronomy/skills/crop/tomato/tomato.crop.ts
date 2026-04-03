import type { CropSkill } from "../../types";

export const TOMATO_CROP_SKILL: CropSkill = {
  crop_code: "tomato",
  resolveStage(input) {
    const days = Number(input.days_after_sowing ?? NaN);
    if (!Number.isFinite(days) || days < 12) return "seedling";
    if (days < 35) return "vegetative";
    if (days < 60) return "flowering";
    return "fruiting";
  },
  thresholds: {
    soil_moisture_min: 28,
    soil_moisture_max: 45,
  },
};
