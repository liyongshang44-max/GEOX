export const RoiTypeV1Values = [
  "WATER_SAVED",
  "FERTILIZER_SAVED",
  "LABOR_SAVED",
  "EARLY_ANOMALY_DETECTED",
  "ACCEPTANCE_PASS_RATE",
  "EXECUTION_RELIABILITY",
  "RISK_REDUCTION",
  "COST_IMPACT",
] as const;

export type RoiTypeV1 = (typeof RoiTypeV1Values)[number];

export const RoiValueKindV1Values = [
  "MEASURED",
  "ESTIMATED",
  "ASSUMPTION_BASED",
  "INSUFFICIENT_EVIDENCE",
] as const;

export type RoiValueKindV1 = (typeof RoiValueKindV1Values)[number];

export const RoiBaselineTypeV1Values = [
  "CUSTOMER_PROVIDED",
  "HISTORICAL_AVERAGE",
  "CONTROL_FIELD",
  "SEASON_PLAN",
  "DEFAULT_ASSUMPTION",
] as const;

export type RoiBaselineTypeV1 = (typeof RoiBaselineTypeV1Values)[number];

export type RoiLedgerV1 = {
  roi_ledger_id: string;
  tenant_id: string;
  project_id: string;
  group_id: string;

  operation_id?: string | null;
  task_id?: string | null;
  prescription_id?: string | null;
  as_executed_id?: string | null;
  as_applied_id?: string | null;
  trace_id?: string | null;

  field_id?: string | null;
  season_id?: string | null;
  zone_id?: string | null;

  roi_type: RoiTypeV1;

  baseline_type: RoiBaselineTypeV1;
  baseline_value: number | null;
  planned_value: number | null;
  actual_value: number | null;
  delta_value: number | null;
  unit: string | null;
  estimated_money_value: number | null;
  currency: string | null;
  source_skill_id: string | null;
  skill_trace_ref: string | null;
  field_memory_refs: unknown[];
  value_kind: RoiValueKindV1;
  baseline: Record<string, unknown>;
  actual: Record<string, unknown>;
  delta: Record<string, unknown>;
  confidence: Record<string, unknown>;
  evidence_refs: unknown[];
  calculation_method: string;
  assumptions: Record<string, unknown>;
  uncertainty_notes?: string | null;
  skill_trace_id?: string | null;
  skill_refs?: Array<{
    skill_id: string;
    skill_version?: string;
    trace_id?: string;
    run_id?: string;
  }>;

  created_at: string;
  updated_at: string;
};
