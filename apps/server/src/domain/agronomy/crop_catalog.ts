export type CropStage = {
  stage: string;
  soil_moisture_min: number;
  soil_moisture_max: number;
};

export type CropProfile = {
  crop_code: string;
  name: string;
  stages: CropStage[];
};

export const CROP_CATALOG: Record<string, CropProfile> = {
  corn: {
    crop_code: "corn",
    name: "玉米",
    stages: [
      {
        stage: "vegetative",
        soil_moisture_min: 35,
        soil_moisture_max: 70
      }
    ]
  },
  tomato: {
    crop_code: "tomato",
    name: "番茄",
    stages: [
      {
        stage: "vegetative",
        soil_moisture_min: 45,
        soil_moisture_max: 75
      }
    ]
  }
};

export function getCropProfile(crop_code: string): CropProfile | null {
  return CROP_CATALOG[crop_code] || null;
}
