export type SkillStage = "monitor" | "suggest" | "approve" | "execute" | "receipt" | "acceptance" | "review";

export type CropSkill = {
  skill_id: string;
  crop_code: string;
  version: string;
  display_name: string;
  supported_stages: SkillStage[];
  min_soil_moisture?: number;
  target_soil_moisture?: number;
};

export type RuleSkillInput = {
  crop_code: string;
  crop_stage: string;
  telemetry?: {
    soil_moisture?: number | null;
    humidity?: number | null;
    temperature?: number | null;
  };
  constraints?: Record<string, unknown>;
};

export type RuleSkillResult = {
  matched: boolean;
  action_type: "IRRIGATE" | "FERTILIZE" | "SPRAY" | "INSPECT";
  reason_codes: string[];
  confidence: number;
};

export type RuleSkill = {
  rule_id: string;
  crop_code: string;
  version: string;
  evaluate: (input: RuleSkillInput) => RuleSkillResult;
};

export type AcceptanceInput = {
  action_type: "IRRIGATE" | "FERTILIZE" | "SPRAY" | "INSPECT";
  observed_parameters?: Record<string, unknown>;
  expected_parameters?: Record<string, unknown>;
};

export type AcceptanceResult = {
  pass: boolean;
  score: number;
  reason: string;
};

export type AcceptanceSkill = {
  acceptance_id: string;
  action_type: "IRRIGATE" | "FERTILIZE";
  version: string;
  evaluate: (input: AcceptanceInput) => AcceptanceResult;
};
