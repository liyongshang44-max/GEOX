type CropStageProfile = {
  soil_moisture_min: number;
};

type CropProfile = {
  code: string;
  stages: CropStageProfile[];
};

const CROP_CATALOG: Record<string, CropProfile> = {
  corn: {
    code: "corn",
    stages: [{ soil_moisture_min: 35 }]
  }
};

export function getCropProfile(cropCode: string): CropProfile | null {
  const key = String(cropCode ?? "").trim().toLowerCase();
  if (!key) return null;
  return CROP_CATALOG[key] ?? null;
}
