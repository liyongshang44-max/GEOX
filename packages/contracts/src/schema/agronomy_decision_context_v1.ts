export type AgronomyDecisionContextV1 = {
  type: "agronomy_decision_context_v1";
  schema_version: "1.0.0";
  occurred_at: string;
  entity: {
    tenant_id: string;
    field_id: string;
    season_id?: string | null;
    device_id?: string | null;
    observation_id?: string | null;
    telemetry_id?: string | null;
  };
  payload: {
    readiness: {
      has_inference: boolean;
      has_minimum_telemetry: boolean;
      confidence_ok: boolean;
    };
    stress_signals: string[];
    inference_summary?: {
      inference_id?: string | null;
      model_name?: string | null;
      model_version?: string | null;
      confidence?: number | null;
      pest_detected?: boolean | null;
      disease_detected?: boolean | null;
      labels?: Array<{ label: string; confidence: number }>;
    } | null;
    telemetry_summary?: {
      air_temperature?: number | null;
      air_humidity?: number | null;
      soil_moisture?: number | null;
      light_lux?: number | null;
    } | null;
  };
  refs?: {
    evidence_refs?: string[];
  };
};
