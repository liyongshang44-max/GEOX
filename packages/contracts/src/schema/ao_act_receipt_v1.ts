export type AoActReceiptV1 = {
  type: "ao_act_receipt_v1";
  payload: {
    act_task_id: string;
    executor_id: {
      kind: "human";
      id: string;
    };
    status: "executed" | "not_executed";
    execution_time: {
      start_ts?: number;
      end_ts?: number;
    };
    execution_coverage?: {
      kind: "field" | "point" | "manual";
      ref?: string;
    };
    resource_usage?: {
      water_l?: number;
      electric_kwh?: number;
      chemical_ml?: number;
      fuel_l?: number;
      consumables?: Array<{ name: string; amount: number; unit?: string }>;
    };
    labor?: {
      duration_minutes?: number;
      worker_count?: number;
    };
    exception?: {
      type?: string;
      code?: string;
      detail?: string;
    };
    location_summary?: {
      center?: { lat: number; lon: number };
      path_points?: number;
      distance_m?: number;
      geohash?: string;
      remark?: string;
    };
    evidence_meta?: Array<{
      artifact_id?: string;
      object_key?: string;
      filename?: string;
      category?: string;
      mime_type?: string;
      size_bytes?: number;
      captured_at_ts?: number;
    }>;
    logs_refs?: string[] | Array<{ kind: string; ref: string }>;
    evidence_refs?: string[];
    evidence_artifact_ids?: string[];
    constraint_check?: {
      violated: boolean;
      summary?: string;
    };
    observed_parameters?: Record<string, unknown>;
  };
};
