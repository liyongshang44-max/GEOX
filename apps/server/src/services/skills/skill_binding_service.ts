import type { Pool } from "pg";

import { appendSkillBindingFact } from "../../domain/skill_registry/facts.js";
import { projectSkillRegistryReadV1, querySkillBindingProjectionV1 } from "../../projections/skill_registry_read_v1.js";
import { asObject, boolLike } from "./skill_trace_service.js";
import type { TenantTriple } from "./skill_trace_service.js";

export type SkillBindingInput = TenantTriple & Record<string, unknown>;

export function validateSkillBindingInput(body: Record<string, unknown>): { skill_id: string; version: string; category: string; bind_target: string } {
  const skill_id = String(body.skill_id ?? "").trim();
  const version = String(body.version ?? "").trim();
  const category = String(body.category ?? "").trim().toUpperCase();
  const bind_target = String(body.bind_target ?? "default").trim();
  if (!skill_id || !version || !category || !bind_target) {
    throw new Error("INVALID_BODY:skill_id/version/category/bind_target are required");
  }
  return { skill_id, version, category, bind_target };
}

export async function appendSkillBinding(pool: Pool, input: SkillBindingInput) {
  const checked = validateSkillBindingInput(input);
  const scope_type = String(input.scope_type ?? "TENANT").trim().toUpperCase();
  const trigger_stage = String(input.trigger_stage ?? "before_dispatch").trim();
  const rollout_mode = String(input.rollout_mode ?? "DIRECT").trim().toUpperCase();

  return appendSkillBindingFact(pool, {
    ...input,
    ...checked,
    binding_id: typeof input.binding_id === "string" ? input.binding_id : undefined,
    status: boolLike(input.enabled, true) ? "ACTIVE" : "DISABLED",
    scope_type: scope_type as any,
    rollout_mode: rollout_mode as any,
    trigger_stage: trigger_stage as any,
    crop_code: typeof input.crop_code === "string" ? input.crop_code : null,
    device_type: typeof input.device_type === "string" ? input.device_type.trim().toUpperCase() : null,
    priority: Number.isFinite(Number(input.priority)) ? Number(input.priority) : 0,
    config_patch: asObject(input.config_patch) ?? undefined,
  } as any);
}

export async function getSkillBindingProjection(pool: Pool, tenant: TenantTriple, filters: Record<string, unknown>) {
  await projectSkillRegistryReadV1(pool, tenant);
  return querySkillBindingProjectionV1(pool, {
    ...tenant,
    category: typeof filters.category === "string" ? filters.category : undefined,
    status: typeof filters.status === "string" ? filters.status : undefined,
    crop_code: typeof filters.crop_code === "string" ? filters.crop_code : undefined,
    device_type: typeof filters.device_type === "string" ? filters.device_type : undefined,
    trigger_stage: typeof filters.trigger_stage === "string" ? filters.trigger_stage : undefined,
    bind_target: typeof filters.bind_target === "string" ? filters.bind_target : undefined,
  });
}

export async function resolveDeviceSkillBindingForTask(
  pool: Pool,
  tenant: TenantTriple,
  input: {
    action_type: string;
    device_type: string;
    adapter_type: string;
    required_capabilities: string[];
  },
): Promise<{ skill_binding_fact_id: string; skill_binding_id: string; device_skill_id: string; version: string } | null> {
  const actionType = String(input.action_type ?? "").trim().toUpperCase();
  const deviceType = String(input.device_type ?? "").trim().toUpperCase();
  const adapterType = String(input.adapter_type ?? "").trim().toLowerCase();
  const required = new Set((input.required_capabilities ?? []).map((x) => String(x ?? "").trim()).filter(Boolean));
  if (!(actionType === "IRRIGATE" && deviceType === "IRRIGATION_CONTROLLER" && adapterType === "irrigation_simulator" && required.has("device.irrigation.valve.open"))) {
    return null;
  }

  const projection = await getSkillBindingProjection(pool, tenant, { status: "ACTIVE" });
  const candidate = (projection.items_effective ?? []).find((item) => String(item.skill_id) === "mock_valve_control_skill_v1");
  if (!candidate) return null;
  return {
    skill_binding_fact_id: String(candidate.fact_id),
    skill_binding_id: String(candidate.binding_id),
    device_skill_id: String(candidate.skill_id),
    version: String(candidate.version),
  };
}
