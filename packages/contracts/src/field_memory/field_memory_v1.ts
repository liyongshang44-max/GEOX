export type FieldMemoryTypeV1 =
  | "operation_outcome"
  | "execution_reliability"
  | "skill_performance";

export type FieldMemoryMetricV1 = {
  success?: boolean;
  soil_moisture_delta?: number;
  execution_deviation?: number;
  acceptance_passed?: boolean;
};

export type FieldMemorySkillRefV1 = {
  skill_id: string;
  skill_version?: string;
  skill_run_id?: string;
};

export type FieldMemoryV1 = {
  memory_id: string;

  tenant_id: string;
  field_id: string;

  operation_id?: string;
  prescription_id?: string;
  recommendation_id?: string;

  memory_type: FieldMemoryTypeV1;

  summary: string;

  metrics: FieldMemoryMetricV1;

  skill_refs?: FieldMemorySkillRefV1[];

  evidence_refs?: string[];

  created_at: number;
};
