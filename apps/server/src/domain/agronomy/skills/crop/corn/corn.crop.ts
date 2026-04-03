import type { CropSkill } from "../../types";

export const cornCrop: CropSkill = {
  crop_code: "corn",

  resolveStage({ days_after_sowing }) {
    if (!days_after_sowing) return "seedling";

    if (days_after_sowing < 10) return "seedling";
    if (days_after_sowing < 40) return "vegetative";
    return "reproductive";
  },

  thresholds: {
    soil_moisture_min: 20,
    soil_moisture_max: 40
  }
};
