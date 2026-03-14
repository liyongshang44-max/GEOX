export type AgronomyInferenceTaskTypeV1 = "detection" | "classification" | "segmentation";

export type AgronomyInferenceLabelV1 = {
  label: string;
  confidence: number;
  bbox?: { x: number; y: number; w: number; h: number } | null;
  mask_ref?: string | null;
};

export type AgronomyInferenceResultV1 = {
  type: "agronomy_inference_result_v1";
  schema_version: "1.0.0";
  occurred_at: string;
  entity: {
    tenant_id: string;
    inference_id: string;
    observation_id: string;
    field_id: string;
    season_id?: string | null;
    device_id?: string | null;
    media_key: string;
  };
  payload: {
    model_name: string;
    model_version: string;
    task_type: AgronomyInferenceTaskTypeV1;
    labels: AgronomyInferenceLabelV1[];
    confidence: number;
    health_score?: number | null; // 0-100
    pest_detected: boolean;
    disease_detected: boolean;
    inference_ts: string;
    raw_output_summary: Record<string, unknown>;
  };
};
