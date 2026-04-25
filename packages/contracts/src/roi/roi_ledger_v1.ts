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

  field_id?: string | null;
  season_id?: string | null;
  zone_id?: string | null;

  roi_type: RoiTypeV1;
  baseline: Record<string, unknown>;
  actual: Record<string, unknown>;
  delta: Record<string, unknown>;
  confidence: Record<string, unknown>;
  evidence_refs: unknown[];
  calculation_method: string;
  assumptions: Record<string, unknown>;
  uncertainty_notes?: string | null;

  created_at: string;
  updated_at: string;
};
