export const FieldMemoryTypeValuesV1 = [
  "FIELD_RESPONSE_MEMORY",
  "DEVICE_RELIABILITY_MEMORY",
  "SKILL_PERFORMANCE_MEMORY",
  "AGRONOMY_DECISION_MEMORY",
  "EXECUTION_QUALITY_MEMORY",
  "SEASON_OUTCOME_MEMORY",
] as const;

export type FieldMemoryTypeV1 = typeof FieldMemoryTypeValuesV1[number];

export type FieldMemoryV1 = {
  memory_id: string;
  tenant_id: string;
  field_id: string;
  season_id?: string;
  crop_id?: string;
  memory_type: FieldMemoryTypeV1;
  metric_key: string;
  metric_value?: number;
  metric_unit?: string;
  before_value?: number;
  after_value?: number;
  baseline_value?: number;
  delta_value?: number;
  target_range?: unknown;
  confidence: number;
  source_type: string;
  source_id: string;
  operation_id?: string;
  recommendation_id?: string;
  prescription_id?: string;
  task_id?: string;
  acceptance_id?: string;
  roi_id?: string;
  skill_id?: string;
  skill_trace_ref?: string;
  evidence_refs: unknown[];
  summary_text: string;
  occurred_at: string;
  created_at: string;
};
