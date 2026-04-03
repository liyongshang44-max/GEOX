import type { CropSkill } from "../../types";

export const CORN_CROP_SKILL: CropSkill = {
  crop_code: "corn",
  resolveStage(input) {
    const days = Number(input.days_after_sowing ?? NaN);
    if (!Number.isFinite(days) || days < 15) return "seedling";
    if (days < 45) return "vegetative";
    if (days < 75) return "flowering";
    return "fruiting";
  },
  thresholds: {
    soil_moisture_min: 35,
    soil_moisture_max: 55,
  },
};
