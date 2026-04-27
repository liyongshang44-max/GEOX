export type SkillTraceConfidenceV1 = {
  level: "HIGH" | "MEDIUM" | "LOW";
  basis: "measured" | "estimated" | "assumed";
  reasons?: string[];
};

export type SkillTraceV1 = {
  skill_id: string;
  skill_version?: string;
  trace_id?: string;
  inputs?: Record<string, any>;
  outputs?: Record<string, any>;
  confidence?: SkillTraceConfidenceV1;
  evidence_refs?: string[];
};
