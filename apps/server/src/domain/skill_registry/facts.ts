import { randomUUID, createHash } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { z } from "zod";

const SKILL_CATEGORY_VALUES = ["AGRONOMY", "OPS", "CONTROL", "OBSERVABILITY", "DEVICE", "ACCEPTANCE"] as const;
const SKILL_STATUS_VALUES = ["DRAFT", "ACTIVE", "DISABLED", "DEPRECATED"] as const;
const SCOPE_TYPE_VALUES = ["GLOBAL", "TENANT", "FIELD", "DEVICE", "PROGRAM"] as const;
const ROLLOUT_MODE_VALUES = ["DIRECT", "CANARY", "DRY_RUN"] as const;
const RESULT_STATUS_VALUES = ["SUCCESS", "FAILED", "SKIPPED", "TIMEOUT"] as const;
const TRIGGER_STAGE_VALUES = ["before_recommendation", "after_recommendation", "before_dispatch", "before_acceptance", "after_acceptance"] as const;
const DEVICE_TYPE_VALUES = ["PUMP", "DRONE", "SENSOR", "HUMAN", "UNKNOWN"] as const;
const BINDING_STATUS_VALUES = ["ACTIVE", "DISABLED"] as const;

const SkillCategorySchema = z.enum(SKILL_CATEGORY_VALUES);
const SkillStatusSchema = z.enum(SKILL_STATUS_VALUES);
const ScopeTypeSchema = z.enum(SCOPE_TYPE_VALUES);
const RolloutModeSchema = z.enum(ROLLOUT_MODE_VALUES);
const ResultStatusSchema = z.enum(RESULT_STATUS_VALUES);
const TriggerStageSchema = z.enum(TRIGGER_STAGE_VALUES);
const DeviceTypeSchema = z.enum(DEVICE_TYPE_VALUES);
const BindingStatusSchema = z.enum(BINDING_STATUS_VALUES);

const TenantTripleSchema = z.object({
  tenant_id: z.string().min(1),
  project_id: z.string().min(1),
  group_id: z.string().min(1),
});

const SkillDefinitionPayloadSchema = TenantTripleSchema.extend({
  skill_id: z.string().min(1),
  version: z.string().min(1),
  display_name: z.string().min(1),
  category: SkillCategorySchema,
  status: SkillStatusSchema,
  trigger_stage: TriggerStageSchema,
  scope_type: ScopeTypeSchema,
  rollout_mode: RolloutModeSchema,
  input_schema_digest: z.string().min(1),
  output_schema_digest: z.string().min(1),
  device_type: DeviceTypeSchema.optional(),
  crop_code: z.string().trim().min(1).optional(),
});

const SkillBindingPayloadSchema = TenantTripleSchema.extend({
  binding_id: z.string().min(1),
  skill_id: z.string().min(1),
  version: z.string().min(1),
  category: SkillCategorySchema,
  status: BindingStatusSchema,
  scope_type: ScopeTypeSchema,
  rollout_mode: RolloutModeSchema,
  trigger_stage: TriggerStageSchema,
  bind_target: z.string().min(1),
  crop_code: z.string().trim().min(1).nullable().optional(),
  device_type: DeviceTypeSchema.nullable().optional(),
  priority: z.number().int().default(0),
  config_patch: z.record(z.any()).optional(),
  effective: z.boolean().optional(),
  overridden_by: z.string().min(1).nullable().optional(),
});

const SkillRunPayloadSchema = TenantTripleSchema.extend({
  run_id: z.string().min(1),
  lifecycle_version: z.number().int().positive().default(2),
  skill_id: z.string().min(1),
  version: z.string().min(1),
  category: SkillCategorySchema,
  status: SkillStatusSchema,
  result_status: ResultStatusSchema,
  trigger_stage: TriggerStageSchema,
  scope_type: ScopeTypeSchema,
  rollout_mode: RolloutModeSchema,
  bind_target: z.string().min(1),
  operation_id: z.string().min(1).nullable().optional(),
  operation_plan_id: z.string().min(1).nullable().optional(),
  field_id: z.string().min(1).nullable().optional(),
  device_id: z.string().min(1).nullable().optional(),
  input_digest: z.string().min(1),
  output_digest: z.string().min(1),
  error_code: z.string().min(1).nullable().optional(),
  duration_ms: z.number().int().nonnegative().optional(),
});

export type SkillDefinitionFactPayload = z.infer<typeof SkillDefinitionPayloadSchema>;
export type SkillBindingFactPayload = z.infer<typeof SkillBindingPayloadSchema>;
export type SkillRunFactPayload = z.infer<typeof SkillRunPayloadSchema>;

const SKILL_CATEGORY_COMPAT: Record<string, SkillDefinitionFactPayload["category"]> = {
  AGRONOMY: "AGRONOMY",
  OPS: "OPS",
  OPERATION: "OPS",
  CONTROL: "CONTROL",
  OBSERVABILITY: "OBSERVABILITY",
  DEVICE: "DEVICE",
  ACCEPTANCE: "ACCEPTANCE",
};

const SKILL_STATUS_COMPAT: Record<string, SkillDefinitionFactPayload["status"]> = {
  DRAFT: "DRAFT",
  ACTIVE: "ACTIVE",
  ENABLED: "ACTIVE",
  PAUSED: "DISABLED",
  DISABLED: "DISABLED",
  DEPRECATED: "DEPRECATED",
  ARCHIVED: "DEPRECATED",
};

const BINDING_STATUS_COMPAT: Record<string, SkillBindingFactPayload["status"]> = {
  ACTIVE: "ACTIVE",
  ENABLED: "ACTIVE",
  DISABLED: "DISABLED",
  PAUSED: "DISABLED",
};

const SCOPE_TYPE_COMPAT: Record<string, SkillDefinitionFactPayload["scope_type"]> = {
  GLOBAL: "GLOBAL",
  TENANT: "TENANT",
  PROJECT: "PROGRAM",
  GROUP: "PROGRAM",
  PROGRAM: "PROGRAM",
  CROP: "FIELD",
  FIELD: "FIELD",
  DEVICE: "DEVICE",
};

const ROLLOUT_MODE_COMPAT: Record<string, SkillDefinitionFactPayload["rollout_mode"]> = {
  DIRECT: "DIRECT",
  CANARY: "CANARY",
  DRY_RUN: "DRY_RUN",
  DRYRUN: "DRY_RUN",
  SHADOW: "DRY_RUN",
};

const TRIGGER_STAGE_COMPAT: Record<string, SkillDefinitionFactPayload["trigger_stage"]> = {
  before_recommendation: "before_recommendation",
  BEFORE_RECOMMENDATION: "before_recommendation",
  after_recommendation: "after_recommendation",
  AFTER_RECOMMENDATION: "after_recommendation",
  before_approval: "after_recommendation",
  BEFORE_APPROVAL: "after_recommendation",
  before_dispatch: "before_dispatch",
  BEFORE_DISPATCH: "before_dispatch",
  before_acceptance: "before_acceptance",
  BEFORE_ACCEPTANCE: "before_acceptance",
  after_acceptance: "after_acceptance",
  AFTER_ACCEPTANCE: "after_acceptance",
};

const DEVICE_TYPE_COMPAT: Record<string, NonNullable<SkillDefinitionFactPayload["device_type"]>> = {
  PUMP: "PUMP",
  DRONE: "DRONE",
  SENSOR: "SENSOR",
  HUMAN: "HUMAN",
  UNKNOWN: "UNKNOWN",
};

function compatEnum<T extends string>(value: unknown, compat: Record<string, T>): T | undefined {
  if (typeof value !== "string") return undefined;
  const key = value.trim();
  if (!key) return undefined;
  return compat[key] ?? compat[key.toUpperCase()];
}

function normalizeCategory(value: unknown): SkillDefinitionFactPayload["category"] {
  return compatEnum(value, SKILL_CATEGORY_COMPAT) ?? "AGRONOMY";
}

function normalizeSkillStatus(value: unknown): SkillDefinitionFactPayload["status"] {
  return compatEnum(value, SKILL_STATUS_COMPAT) ?? "DRAFT";
}

function normalizeBindingStatus(value: unknown): SkillBindingFactPayload["status"] {
  return compatEnum(value, BINDING_STATUS_COMPAT) ?? "ACTIVE";
}

function normalizeScopeType(value: unknown): SkillDefinitionFactPayload["scope_type"] {
  return compatEnum(value, SCOPE_TYPE_COMPAT) ?? "TENANT";
}

function normalizeRolloutMode(value: unknown): SkillDefinitionFactPayload["rollout_mode"] {
  return compatEnum(value, ROLLOUT_MODE_COMPAT) ?? "DIRECT";
}

function normalizeTriggerStage(value: unknown): SkillDefinitionFactPayload["trigger_stage"] {
  return compatEnum(value, TRIGGER_STAGE_COMPAT) ?? "before_dispatch";
}

function ensureWritableTriggerStage(value: unknown, factType: "skill_definition_v1" | "skill_binding_v1" | "skill_run_v1"): void {
  const requestedStage = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (requestedStage === "before_approval") {
    throw new Error(
      `INVALID_TRIGGER_STAGE: before_approval is deprecated for ${factType} writes; use after_recommendation. Allowed values: before_recommendation | before_dispatch | before_acceptance | after_acceptance | after_recommendation`
    );
  }
}

function normalizeDeviceType(value: unknown): SkillDefinitionFactPayload["device_type"] | null | undefined {
  if (value == null) return value as null | undefined;
  const normalized = compatEnum(value, DEVICE_TYPE_COMPAT);
  return normalized ?? "UNKNOWN";
}

async function appendFact(
  db: Pool | PoolClient,
  factType: "skill_definition_v1" | "skill_binding_v1" | "skill_run_v1",
  payload: Record<string, unknown>,
  source = "api/skill_registry/v1"
): Promise<{ fact_id: string; occurred_at: string }> {
  const occurred_at = new Date().toISOString();
  const fact_id = randomUUID();
  const record_json = { type: factType, payload };
  await db.query(
    "INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, $2::timestamptz, $3, $4::jsonb)",
    [fact_id, occurred_at, source, record_json]
  );
  return { fact_id, occurred_at };
}

export function digestJson(input: unknown): string {
  const text = typeof input === "string" ? input : JSON.stringify(input ?? null);
  return createHash("sha256").update(text).digest("hex");
}

export async function appendSkillDefinitionFact(db: Pool | PoolClient, input: SkillDefinitionFactPayload): Promise<{ fact_id: string; occurred_at: string; payload: SkillDefinitionFactPayload }> {
  ensureWritableTriggerStage(input.trigger_stage, "skill_definition_v1");
  const payload = SkillDefinitionPayloadSchema.parse({
    ...input,
    category: normalizeCategory(input.category),
    status: normalizeSkillStatus(input.status),
    trigger_stage: normalizeTriggerStage(input.trigger_stage),
    scope_type: normalizeScopeType(input.scope_type),
    rollout_mode: normalizeRolloutMode(input.rollout_mode),
    device_type: normalizeDeviceType(input.device_type),
    crop_code: input.crop_code?.trim().toLowerCase() || undefined,
  });
  const appended = await appendFact(db, "skill_definition_v1", payload);
  return { ...appended, payload };
}

export async function appendSkillBindingFact(db: Pool | PoolClient, input: Omit<SkillBindingFactPayload, "binding_id"> & { binding_id?: string }): Promise<{ fact_id: string; occurred_at: string; payload: SkillBindingFactPayload }> {
  ensureWritableTriggerStage(input.trigger_stage, "skill_binding_v1");
  const payload = SkillBindingPayloadSchema.parse({
    ...input,
    binding_id: input.binding_id ?? randomUUID(),
    category: normalizeCategory(input.category),
    status: normalizeBindingStatus(input.status),
    scope_type: normalizeScopeType(input.scope_type),
    rollout_mode: normalizeRolloutMode(input.rollout_mode),
    trigger_stage: normalizeTriggerStage(input.trigger_stage),
    crop_code: typeof input.crop_code === "string" ? input.crop_code.trim().toLowerCase() : input.crop_code,
    device_type: normalizeDeviceType(input.device_type),
  });
  const appended = await appendFact(db, "skill_binding_v1", payload);
  return { ...appended, payload };
}

export async function appendSkillRunFact(
  db: Pool | PoolClient,
  input: Omit<SkillRunFactPayload, "run_id" | "lifecycle_version"> & { run_id?: string; lifecycle_version?: number }
): Promise<{ fact_id: string; occurred_at: string; payload: SkillRunFactPayload }> {
  ensureWritableTriggerStage(input.trigger_stage, "skill_run_v1");
  const payload = SkillRunPayloadSchema.parse({
    ...input,
    run_id: input.run_id ?? randomUUID(),
    lifecycle_version: Number.isFinite(Number((input as any).lifecycle_version)) ? Number((input as any).lifecycle_version) : 2,
    category: normalizeCategory(input.category),
    status: normalizeSkillStatus(input.status),
    trigger_stage: normalizeTriggerStage(input.trigger_stage),
    scope_type: normalizeScopeType(input.scope_type),
    rollout_mode: normalizeRolloutMode(input.rollout_mode),
  });
  const appended = await appendFact(db, "skill_run_v1", payload);
  return { ...appended, payload };
}
