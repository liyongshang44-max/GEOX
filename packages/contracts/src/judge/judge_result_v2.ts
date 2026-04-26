export type JudgeKindV2 = "EVIDENCE" | "AGRONOMY" | "EXECUTION";

export type JudgeVerdictV2 =
  | "PASS"
  | "WARN"
  | "FAIL"
  | "BLOCKED"
  | "INSUFFICIENT_EVIDENCE"
  | "CONFLICTED"
  | "STALE_DATA"
  | "DEVICE_OFFLINE"
  | "SENSOR_DRIFT"
  | "WATER_DEFICIT";

export type JudgeResultV2 = {
  judge_id: string;
  judge_kind: JudgeKindV2;

  tenant_id: string;
  project_id: string;
  group_id: string;

  field_id?: string | null;
  season_id?: string | null;
  device_id?: string | null;

  recommendation_id?: string | null;
  prescription_id?: string | null;
  task_id?: string | null;
  receipt_id?: string | null;
  as_executed_id?: string | null;
  as_applied_id?: string | null;

  verdict: JudgeVerdictV2;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  reasons: string[];

  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;

  confidence: {
    level: "HIGH" | "MEDIUM" | "LOW";
    basis: "measured" | "estimated" | "assumed";
    reasons: string[];
  };

  evidence_refs: unknown[];
  source_refs: unknown[];

  created_at: string;
  created_ts_ms: number;
};
