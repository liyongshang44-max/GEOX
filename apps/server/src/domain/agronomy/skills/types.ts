export type CropStage =
  | "seedling"
  | "vegetative"
  | "flowering"
  | "fruiting"
  | "reproductive";

export interface CropSkill {
  id: string;
  version: string;
  enabled: boolean;

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

export interface RuleResult {
  action_type: string;
  parameters?: any;

  expected_effect?: {
    type: string;
    value: number;
  };

  reason_codes: string[];

  rule_id: string;
  version: string;
}

export interface AgronomyRuleSkill {
  id: string;
  version: string;
  enabled: boolean;

  crop_code: string;

  match(input: {
    crop_stage: CropStage;
    metrics: any;
  }): boolean;

  recommend(input: {
    field_id: string;
    crop_stage: CropStage;
    metrics: any;
  }): RuleResult;
}

export interface AcceptanceSkill {
  id: string;
  version: string;
  enabled: boolean;

  action_type: string;

  validate(input: {
    evidence: any;
  }): {
    verdict: "PASS" | "FAIL" | "PENDING";
    reason?: string;
  };
}
