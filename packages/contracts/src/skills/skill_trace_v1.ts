export type SkillTraceConfidenceV1 = {
  level: "HIGH" | "MEDIUM" | "LOW";
  basis: "measured" | "estimated" | "assumed";
  reasons?: string[];
};

export type SkillTraceV1 = {
  skill_id: string;
  skill_category?: string;
  risk_level?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  input_schema_ref?: string;
  output_schema_ref?: string;
  fallback_policy?: Record<string, unknown>;
  audit_policy?: Record<string, unknown>;
  binding_conditions?: Record<string, unknown>;
  skill_version?: string;
  trace_id?: string;
  inputs?: Record<string, any>;
  outputs?: Record<string, any>;
  confidence?: SkillTraceConfidenceV1;
  evidence_refs?: string[];
};
