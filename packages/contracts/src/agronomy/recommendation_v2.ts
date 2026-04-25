export type AgronomyRecommendationActionTypeV2 = "IRRIGATE" | "FERTILIZE" | "INSPECT" | "WAIT";

export type SkillTraceConfidenceV1 = {
  level: "HIGH" | "MEDIUM" | "LOW";
  basis: "measured" | "estimated" | "assumed";
  reasons?: string[];
};

export type SkillTraceV1 = {
  skill_id: string;
  skill_version?: string;
  trace_id?: string;
  inputs?: Record<string, any>;
  outputs?: Record<string, any>;
  confidence?: SkillTraceConfidenceV1;
  evidence_refs?: string[];
};

export type AgronomyRecommendationV2 = {
  recommendation_id: string;
  crop_code: string;
  crop_stage: string;
  rule_id: string;
  action_type: AgronomyRecommendationActionTypeV2;
  confidence: number;

  reasons: string[];
  expected_effect: {
    metric: string;
    direction: "increase" | "decrease" | "stabilize";
    value?: number;
    unit?: string;
  }[];

  evidence_basis: {
    snapshot_id?: string;
    telemetry_refs?: string[];
  };

  // Optional, for backward compatibility. Added in Step5.5 for skill trace alignment.
  skill_trace?: SkillTraceV1;
};
