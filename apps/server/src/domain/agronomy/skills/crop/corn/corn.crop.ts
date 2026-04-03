import type { CropSkill } from "../../types";

export const CORN_CROP_SKILL_V1: CropSkill = {
  skill_id: "crop.corn.v1",
  crop_code: "corn",
  version: "1.0.0",
  display_name: "玉米作物技能",
  supported_stages: ["monitor", "suggest", "acceptance", "review"],
  min_soil_moisture: 35,
  target_soil_moisture: 42,
};
