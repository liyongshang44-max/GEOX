import type { CropSkill } from "../../types.js";

export const tomatoCrop: CropSkill = {
  id: "tomato_crop",
  version: "v1",
  enabled: true,

  crop_code: "tomato",

  resolveStage({ days_after_sowing }) {
    if (!days_after_sowing) return "seedling";

    if (days_after_sowing < 15) return "seedling";
    if (days_after_sowing < 40) return "vegetative";
    if (days_after_sowing < 70) return "flowering";
    return "fruiting";
  },

  thresholds: {
    soil_moisture_min: 25,
    soil_moisture_max: 60
  }
};
