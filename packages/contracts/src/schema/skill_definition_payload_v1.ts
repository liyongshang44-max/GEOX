import { z } from "zod";

export const SkillDefinitionSchemaRefSchema = z.union([
  z.string().min(1),
  z.object({ $ref: z.string().min(1) }).passthrough(),
]);

export const SkillDefinitionIoSchemaSchema = z.union([
  z.record(z.unknown()),
  SkillDefinitionSchemaRefSchema,
]);

export const SkillDefinitionCapabilitiesSchema = z.array(z.string().min(1));
export const SkillDefinitionRiskLevelSchema = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
export const SkillDefinitionRequiredEvidenceSchema = z.array(z.string().min(1));
export const SkillDefinitionScopeSchema = z.array(z.string().min(1));
export const SkillDefinitionFallbackPolicySchema = z.record(z.unknown());
export const SkillDefinitionAuditPolicySchema = z.record(z.unknown());

export const SkillDefinitionPayloadV1Schema = z.object({
  tenant_id: z.string().min(1),
  project_id: z.string().min(1),
  group_id: z.string().min(1),
  skill_id: z.string().min(1),
  version: z.string().min(1),
  skill_version: z.string().min(1),
  display_name: z.string().min(1),
  category: z.enum(["AGRONOMY", "OPS", "CONTROL", "OBSERVABILITY", "DEVICE", "ACCEPTANCE"]),
  status: z.enum(["DRAFT", "ACTIVE", "DISABLED", "DEPRECATED"]),
  trigger_stage: z.enum(["before_recommendation", "after_recommendation", "before_dispatch", "before_acceptance", "after_acceptance"]),
  scope_type: z.enum(["GLOBAL", "TENANT", "FIELD", "DEVICE", "PROGRAM"]),
  rollout_mode: z.enum(["DIRECT", "CANARY", "DRY_RUN"]),
  input_schema_digest: z.string().min(1),
  output_schema_digest: z.string().min(1),
  input_schema: SkillDefinitionIoSchemaSchema.optional(),
  output_schema: SkillDefinitionIoSchemaSchema.optional(),
  capabilities: SkillDefinitionCapabilitiesSchema.optional(),
  risk_level: SkillDefinitionRiskLevelSchema.optional(),
  required_evidence: SkillDefinitionRequiredEvidenceSchema.optional(),
  tenant_scope: SkillDefinitionScopeSchema.optional(),
  crop_scope: SkillDefinitionScopeSchema.optional(),
  device_scope: SkillDefinitionScopeSchema.optional(),
  binding_priority: z.number().int().default(0),
  enabled: z.boolean().default(true),
  fallback_policy: SkillDefinitionFallbackPolicySchema.optional(),
  audit_policy: SkillDefinitionAuditPolicySchema.optional(),
  device_type: z.enum(["PUMP", "DRONE", "SENSOR", "HUMAN", "UNKNOWN"]).optional(),
  crop_code: z.string().trim().min(1).optional(),
});

export type SkillDefinitionPayloadV1 = z.infer<typeof SkillDefinitionPayloadV1Schema>;
