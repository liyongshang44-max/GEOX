import type { CropSkill } from "../../types";

export const TOMATO_CROP_SKILL_V1: CropSkill = {
  skill_id: "crop.tomato.v1",
  crop_code: "tomato",
  version: "1.0.0",
  display_name: "番茄作物技能",
  supported_stages: ["monitor", "suggest", "acceptance", "review"],
  min_soil_moisture: 28,
  target_soil_moisture: 36,
};
