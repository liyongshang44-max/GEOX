export type AgronomyRecommendationActionTypeV2 = "IRRIGATE" | "FERTILIZE" | "INSPECT" | "WAIT";

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
};
