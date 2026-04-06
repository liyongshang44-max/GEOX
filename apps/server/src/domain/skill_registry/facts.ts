import { randomUUID, createHash } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { z } from "zod";

const SkillCategorySchema = z.enum(["AGRONOMY", "OPS", "CONTROL", "OBSERVABILITY"]);
const SkillStatusSchema = z.enum(["DRAFT", "ACTIVE", "PAUSED", "DEPRECATED"]);
const ScopeTypeSchema = z.enum(["GLOBAL", "TENANT", "FIELD", "DEVICE", "PROGRAM"]);
const RolloutModeSchema = z.enum(["DIRECT", "CANARY", "DRY_RUN"]);
const ResultStatusSchema = z.enum(["SUCCESS", "FAILED", "SKIPPED", "TIMEOUT"]);
const TriggerStageSchema = z.enum(["before_recommendation", "before_approval", "before_dispatch", "before_acceptance", "after_acceptance"]);
const DeviceTypeSchema = z.enum(["PUMP", "DRONE", "SENSOR", "HUMAN", "UNKNOWN"]);
const BindingStatusSchema = z.enum(["ENABLED", "DISABLED"]);

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
});

const SkillRunPayloadSchema = TenantTripleSchema.extend({
  run_id: z.string().min(1),
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
  const payload = SkillDefinitionPayloadSchema.parse({
    ...input,
    crop_code: input.crop_code?.trim().toLowerCase() || undefined,
  });
  const appended = await appendFact(db, "skill_definition_v1", payload);
  return { ...appended, payload };
}

export async function appendSkillBindingFact(db: Pool | PoolClient, input: Omit<SkillBindingFactPayload, "binding_id"> & { binding_id?: string }): Promise<{ fact_id: string; occurred_at: string; payload: SkillBindingFactPayload }> {
  const payload = SkillBindingPayloadSchema.parse({
    ...input,
    binding_id: input.binding_id ?? randomUUID(),
    crop_code: typeof input.crop_code === "string" ? input.crop_code.trim().toLowerCase() : input.crop_code,
  });
  const appended = await appendFact(db, "skill_binding_v1", payload);
  return { ...appended, payload };
}

export async function appendSkillRunFact(db: Pool | PoolClient, input: Omit<SkillRunFactPayload, "run_id"> & { run_id?: string }): Promise<{ fact_id: string; occurred_at: string; payload: SkillRunFactPayload }> {
  const payload = SkillRunPayloadSchema.parse({
    ...input,
    run_id: input.run_id ?? randomUUID(),
  });
  const appended = await appendFact(db, "skill_run_v1", payload);
  return { ...appended, payload };
}
