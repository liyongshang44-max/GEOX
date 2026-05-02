export type SkillCategoryV1 =
  | "sensing"
  | "agronomy"
  | "device"
  | "acceptance"
  | "roi"
  | "other";

export type SkillRiskLevelV1 = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type SkillRolloutModeV1 = "all" | "allowlist" | "canary" | "shadow";

export type SkillFallbackPolicyV1 = {
  mode: "none" | "static_default" | "delegate_skill";
  delegate_skill_id?: string | null;
  reason?: string | null;
};

export type SkillAuditPolicyV1 = {
  level: "minimal" | "standard" | "strict";
  retention_days?: number | null;
  include_input_snapshot?: boolean;
  include_output_snapshot?: boolean;
};

export type SkillContractV1 = {
  skill_id: string;
  skill_version: string;
  skill_category: SkillCategoryV1;
  // Optional schema references for lightweight adapters.
  input_schema_ref?: string;
  output_schema_ref?: string;
  input_schema: Record<string, unknown>;
  output_schema: Record<string, unknown>;
  capabilities: string[];
  risk_level: SkillRiskLevelV1;
  // Optional runtime binding gate constraints.
  binding_conditions?: Record<string, unknown>;
  required_evidence: string[];
  tenant_scope: string[];
  crop_scope: string[];
  device_scope: string[];
  binding_priority: number;
  enabled: boolean;
  rollout_mode: SkillRolloutModeV1;
  fallback_policy: SkillFallbackPolicyV1;
  audit_policy: SkillAuditPolicyV1;
};
