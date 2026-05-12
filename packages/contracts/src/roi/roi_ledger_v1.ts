export const RoiTypeV1Values = [
  "WATER_SAVED",
  "LABOR_SAVED",
  "EARLY_WARNING_LEAD_TIME",
  "FIRST_PASS_ACCEPTANCE_RATE",
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

export const RecommendationValueTypeV1Values = [
  "YIELD_LOSS_AVOIDED",
  "YIELD_LIFT_EXPECTED",
  "REVENUE_LOSS_AVOIDED",
  "REVENUE_LIFT_EXPECTED",
] as const;

export type RecommendationValueTypeV1 = (typeof RecommendationValueTypeV1Values)[number];

export const OperationRoiStatusV1Values = [
  "HYPOTHESIS_ONLY",
  "PROJECTED",
  "EXECUTED_PENDING_RESPONSE",
  "INTERIM_SUPPORTED",
  "INTERIM_NOT_SUPPORTED",
  "BASELINE_MISSING",
  "EVIDENCE_INSUFFICIENT",
  "EXCLUDED_WEATHER",
  "REALIZED",
] as const;

export type OperationRoiStatusV1 = (typeof OperationRoiStatusV1Values)[number];

export type RecommendationValueHypothesisV1 = {
  value_type: RecommendationValueTypeV1;
  expected_yield_effect: { min?: number; max?: number; unit: "%" | "kg/ha" | "t/ha" } | null;
  expected_revenue_effect: { min?: number; max?: number; currency?: string } | null;
  baseline_source: "HISTORICAL_AVERAGE" | "SEASON_PLAN" | "DEFAULT_ASSUMPTION" | "CUSTOMER_PROVIDED";
  evidence_refs: string[];
  confidence: "LOW" | "MEDIUM" | "HIGH";
  assumptions: Record<string, unknown>;
  uncertainty_notes: string | null;
};

export type PrescriptionValueProjectionV1 = {
  planned_cost: number | null;
  expected_benefit: number | null;
  expected_net_value: number | null;
  expected_roi_ratio: number | null;
  cost_items: Array<{ type: string; amount: number | null; unit: string | null; money_value: number | null }>;
  projection_basis: string;
  confidence: "LOW" | "MEDIUM" | "HIGH";
  assumptions: Record<string, unknown>;
  uncertainty_notes: string | null;
};

export type OperationValueChainRoiV1 = {
  status: OperationRoiStatusV1;
  hypothesis: RecommendationValueHypothesisV1 | null;
  projection: PrescriptionValueProjectionV1 | null;
  interim_evidence: Record<string, unknown> | null;
  ledger_items: unknown[];
  exclusion_reason: string | null;
  customer_safe_text: string;
};

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
