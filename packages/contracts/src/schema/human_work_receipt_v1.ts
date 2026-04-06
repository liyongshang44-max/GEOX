import type { AoActReceiptV1 } from "./ao_act_receipt_v1";

export type HumanWorkReceiptExceptionTypeV1 =
  | "NONE"
  | "WEATHER"
  | "MACHINE"
  | "MATERIAL_SHORTAGE"
  | "SAFETY"
  | "FIELD_BLOCKED"
  | "OTHER";

export type HumanWorkReceiptEvidenceRefV1 = {
  artifact_id?: string;
  object_key?: string;
  filename?: string;
  category?: "before" | "during" | "after" | "anomaly" | "other";
  mime_type?: string;
  size_bytes?: number;
  captured_at_ts?: number;
};

export type HumanWorkReceiptV1 = {
  type: "human_work_receipt_v1";
  payload: {
    assignment_id: string;
    act_task_id: string;
    operation_plan_id: string;
    status: "executed" | "not_executed";
    execution_time: {
      start_ts: number;
      end_ts: number;
    };
    labor: {
      duration_minutes: number;
      worker_count: number;
    };
    resource_usage?: {
      fuel_l?: number;
      electric_kwh?: number;
      water_l?: number;
      chemical_ml?: number;
      consumables?: Array<{ name: string; amount: number; unit?: string }>;
    };
    exception?: {
      type: HumanWorkReceiptExceptionTypeV1;
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
    evidence_meta?: HumanWorkReceiptEvidenceRefV1[];
    observed_parameters?: Record<string, unknown>;
    meta?: Record<string, unknown>;
  };
};

export function mapHumanWorkReceiptToAoActReceiptV1(input: HumanWorkReceiptV1): AoActReceiptV1 {
  const payload = input.payload;
  return {
    type: "ao_act_receipt_v1",
    payload: {
      act_task_id: payload.act_task_id,
      executor_id: { kind: "human", id: "human_executor_v1" },
      status: payload.status,
      execution_time: payload.execution_time,
      execution_coverage: payload.location_summary ? { kind: "manual", ref: payload.location_summary.geohash ?? "manual" } : undefined,
      resource_usage: payload.resource_usage,
      logs_refs: (payload.evidence_meta ?? [])
        .map((item) => item.object_key || item.artifact_id || item.filename)
        .filter((v): v is string => typeof v === "string" && v.length > 0),
      evidence_refs: (payload.evidence_meta ?? []).map((item) => {
        if (item.object_key) return `obj:${item.object_key}`;
        if (item.artifact_id) return `artifact:${item.artifact_id}`;
        return item.filename ?? "";
      }).filter(Boolean),
      evidence_artifact_ids: (payload.evidence_meta ?? [])
        .map((item) => item.artifact_id)
        .filter((v): v is string => typeof v === "string" && v.length > 0),
      constraint_check: {
        violated: payload.exception?.type != null && payload.exception.type !== "NONE",
        summary: payload.exception?.code ?? payload.exception?.type ?? "NONE",
      },
      observed_parameters: {
        ...(payload.observed_parameters ?? {}),
        labor: payload.labor,
        exception: payload.exception ?? null,
        location_summary: payload.location_summary ?? null,
        evidence_meta: payload.evidence_meta ?? [],
      },
    },
  };
}
