export type AgronomyRecommendationTypeV1 =
  | "irrigation_recommendation_v1"
  | "crop_health_recommendation_v1"
  | "crop_health_alert_v1"
  | "pest_risk_recommendation_v1";

export type AgronomyRecommendationStatusV1 = "proposed" | "approved" | "rejected" | "executed";

export type AgronomyRecommendationV1 = {
  type: "agronomy_recommendation_v1";
  schema_version: "1.0.0";
  occurred_at: string;
  entity: {
    tenant_id: string;
    field_id: string;
    season_id?: string | null;
    device_id?: string | null;
    recommendation_id: string;
  };
  payload: {
    recommendation_type: AgronomyRecommendationTypeV1;
    status: AgronomyRecommendationStatusV1;
    confidence: number;
    model_version: string;
    reason_codes: string[];
    rule_hit: {
      rule_id: string;
      matched: boolean;
      threshold?: number | null;
      actual?: number | null;
    }[];
    evidence_refs: string[];
    suggested_action: {
      action_type: string;
      summary: string;
      parameters: Record<string, unknown>;
    };
    created_ts: number;
  };
};
