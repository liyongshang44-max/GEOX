export type SkillCategoryV1 =
  | "sensing"
  | "agronomy"
  | "device"
  | "acceptance"
  | "roi"
  | "other";

export type SkillCanonicalCategoryV1 =
  | "SENSING"
  | "AGRONOMY"
  | "DEVICE"
  | "ACCEPTANCE"
  | "CONTROL"
  | "OPS"
  | "OBSERVABILITY";

export const SkillCategoryValuesV1: readonly SkillCategoryV1[] = [
  "sensing",
  "agronomy",
  "device",
  "acceptance",
  "roi",
  "other",
] as const;

export const SkillCanonicalCategoryValuesV1: readonly SkillCanonicalCategoryV1[] = [
  "SENSING",
  "AGRONOMY",
  "DEVICE",
  "ACCEPTANCE",
  "CONTROL",
  "OPS",
  "OBSERVABILITY",
] as const;

const SKILL_CATEGORY_CANONICAL_MAP_V1: Record<string, SkillCanonicalCategoryV1> = {
  sensing: "SENSING",
  SENSING: "SENSING",
  agronomy: "AGRONOMY",
  AGRONOMY: "AGRONOMY",
  crop: "AGRONOMY",
  CROP: "AGRONOMY",
  device: "DEVICE",
  DEVICE: "DEVICE",
  acceptance: "ACCEPTANCE",
  ACCEPTANCE: "ACCEPTANCE",
  control: "CONTROL",
  CONTROL: "CONTROL",
  ops: "OPS",
  OPS: "OPS",
  operation: "OPS",
  OPERATION: "OPS",
  roi: "OPS",
  ROI: "OPS",
  observability: "OBSERVABILITY",
  OBSERVABILITY: "OBSERVABILITY",
  other: "OBSERVABILITY",
  OTHER: "OBSERVABILITY",
};

export function normalizeSkillCategoryToCanonicalV1(value: unknown): SkillCanonicalCategoryV1 {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return "OBSERVABILITY";
  return SKILL_CATEGORY_CANONICAL_MAP_V1[raw] ?? SKILL_CATEGORY_CANONICAL_MAP_V1[raw.toUpperCase()] ?? "OBSERVABILITY";
}

export function isLegacySkillCategoryV1(value: unknown): boolean {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  return raw === "roi" || raw === "other";
}

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
  canonical_skill_category?: SkillCanonicalCategoryV1;
  legacy_skill_category?: boolean;
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