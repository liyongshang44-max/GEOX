export const FieldMemoryTypeValuesV1 = [
  "FIELD_RESPONSE_MEMORY",
  "DEVICE_RELIABILITY_MEMORY",
  "SKILL_PERFORMANCE_MEMORY",
  "AGRONOMY_DECISION_MEMORY",
  "EXECUTION_QUALITY_MEMORY",
  "SEASON_OUTCOME_MEMORY",
] as const;

export type FieldMemoryTypeV1 = typeof FieldMemoryTypeValuesV1[number];

export const FieldMemoryLaneValuesV1 = [
  "FORMAL_FIELD_MEMORY",
  "TECHNICAL_SKILL_MEMORY",
  "TECHNICAL_EXECUTION_MEMORY",
  "SIMULATED_DEV_MEMORY",
  "DIAGNOSTIC_NOTE",
] as const;

export type FieldMemoryLaneV1 = typeof FieldMemoryLaneValuesV1[number];

export const FieldMemoryTrustLevelValuesV1 = [
  "FORMAL_ACCEPTED",
  "TECHNICAL_SIGNAL",
  "SIMULATED_DEV_ONLY",
  "INSUFFICIENT_FORMAL_EVIDENCE",
] as const;

export type FieldMemoryTrustLevelV1 = typeof FieldMemoryTrustLevelValuesV1[number];

export type FieldMemoryV1 = {
  memory_id: string;
  tenant_id: string;
  project_id: string;
  group_id: string;
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
  weather_interference_detected?: boolean;
  learning_excluded_reason?: string;

  /** PR-4 base-contract memory lane. Object existence is not formal learning. */
  memory_lane?: FieldMemoryLaneV1;
  trust_level?: FieldMemoryTrustLevelV1;
  formal_acceptance_id?: string | null;
  source_lane?: string | null;
  customer_visible_memory?: boolean;
  learning_eligible?: boolean;
  trust_reasons?: string[];

  occurred_at: string;
  created_at: string;
};
