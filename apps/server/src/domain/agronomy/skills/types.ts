export type CropStage =
  | "seedling"
  | "vegetative"
  | "flowering"
  | "fruiting";

export interface CropSkill {
  crop_code: string;

  resolveStage(input: {
    days_after_sowing?: number;
    metrics?: any;
  }): CropStage;

  thresholds: {
    soil_moisture_min?: number;
    soil_moisture_max?: number;
  };
}

export interface AgronomyRuleSkill {
  id: string;
  crop_code: string;

  match(input: {
    crop_stage: CropStage;
    metrics: any;
  }): boolean;

  recommend(input: {
    field_id: string;
    crop_stage: CropStage;
    metrics: any;
  }): {
    action_type: string;
    parameters?: any;
    expected_effect?: {
      type: string;
      value: number;
    };
    reason_codes?: string[];
  };
}

export interface AcceptanceSkill {
  action_type: string;

  validate(input: {
    evidence: any;
  }): {
    verdict: "PASS" | "FAIL" | "PENDING";
    reason?: string;
  };
}
