import type { Pool } from "pg";
import type { AgronomyRuleSkill } from "./types";
import { ruleSkills } from "./index";
import { listFallbackSkillSwitches, type SkillSwitch } from "./runtime_config";
import { appendSkillBindingFact } from "../../skill_registry/facts";
import { projectSkillRegistryReadV1, querySkillRegistryReadV1 } from "../../../projections/skill_registry_read_v1";

type ResolvedRuleSkill = AgronomyRuleSkill & { __priority: number };

export type SkillBindingRecord = {
  id: string;
  skill_id: string;
  version: string;
  tenant_id: string | null;
  project_id: string | null;
  group_id: string | null;
  crop_code: string | null;
  enabled: boolean;
  priority: number;
  category: string | null;
  scope_type: string | null;
  rollout_mode: string | null;
  trigger_stage: string | null;
  bind_target: string | null;
  device_type: string | null;
  updated_at: string;
};

export type SkillBindingSource = "tenant+crop" | "tenant+*" | "*+crop" | "global" | "fallback_config";

let bindingsPool: Pool | null = null;

function normalizeScopeValue(input?: string): string | null {
  const normalized = typeof input === "string" ? input.trim() : "";
  return normalized ? normalized : null;
}

function resolveSource(tenant_id: string, crop_code: string, row: Pick<SkillBindingRecord, "tenant_id" | "crop_code">): SkillBindingSource | null {
  if (row.tenant_id === tenant_id && row.crop_code === crop_code) return "tenant+crop";
  if (row.tenant_id === tenant_id && row.crop_code === null) return "tenant+*";
  if (row.tenant_id === null && row.crop_code === crop_code) return "*+crop";
  if (row.tenant_id === null && row.crop_code === null) return "global";
  return null;
}

const sourceOrder: SkillBindingSource[] = ["tenant+crop", "tenant+*", "*+crop", "global", "fallback_config"];

function pickBySkill(rows: Array<SkillBindingRecord & { source: SkillBindingSource }>): Array<SkillBindingRecord & { source: SkillBindingSource }> {
  const grouped = new Map<string, Array<SkillBindingRecord & { source: SkillBindingSource }>>();
  for (const row of rows) {
    const bucket = grouped.get(row.skill_id) ?? [];
    bucket.push(row);
    grouped.set(row.skill_id, bucket);
  }

  const picked: Array<SkillBindingRecord & { source: SkillBindingSource }> = [];
  for (const [, bucket] of grouped) {
    bucket.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      if (b.updated_at !== a.updated_at) return b.updated_at.localeCompare(a.updated_at);
      return b.version.localeCompare(a.version);
    });
    picked.push(bucket[0]);
  }
  return picked;
}

export function configureSkillBindingsPool(pool: Pool): void {
  bindingsPool = pool;
}

function toBindingRecord(row: any): SkillBindingRecord {
  return {
    id: String(row.fact_id ?? ""),
    skill_id: String(row.skill_id ?? ""),
    version: String(row.version ?? ""),
    tenant_id: String(row.tenant_id ?? "") || null,
    project_id: String(row.project_id ?? "") || null,
    group_id: String(row.group_id ?? "") || null,
    crop_code: String(row.crop_code ?? "") || null,
    enabled: String(row.status ?? "").toUpperCase() === "ENABLED",
    priority: Number.isFinite(Number(row.payload_json?.priority)) ? Number(row.payload_json?.priority) : 0,
    category: String(row.category ?? "") || null,
    scope_type: String(row.scope_type ?? "") || null,
    rollout_mode: String(row.rollout_mode ?? "") || null,
    trigger_stage: String(row.trigger_stage ?? "") || null,
    bind_target: String(row.bind_target ?? "") || null,
    device_type: String(row.device_type ?? "") || null,
    updated_at: new Date(Number(row.updated_at_ts_ms ?? Date.now())).toISOString(),
  };
}

export async function listSkillBindings(input?: {
  crop_code?: string;
  tenant_id?: string;
  project_id?: string;
  group_id?: string;
  enabled_only?: boolean;
}): Promise<SkillBindingRecord[]> {
  if (!bindingsPool || !input?.tenant_id || !input?.project_id || !input?.group_id) {
    return listFallbackSkillSwitches(input).map((item, index) => ({
      id: `fallback_${index}`,
      skill_id: item.skill_id,
      version: item.version,
      tenant_id: item.scope?.tenant_id ?? null,
      project_id: null,
      group_id: null,
      crop_code: item.scope?.crop_code ?? null,
      enabled: item.enabled,
      priority: item.priority,
      category: null,
      scope_type: "TENANT",
      rollout_mode: "DIRECT",
      trigger_stage: null,
      bind_target: item.scope?.tenant_id ?? "*",
      device_type: null,
      updated_at: new Date(0).toISOString(),
    }));
  }

  await projectSkillRegistryReadV1(bindingsPool, {
    tenant_id: input.tenant_id,
    project_id: input.project_id,
    group_id: input.group_id,
  });

  const rows = await querySkillRegistryReadV1(bindingsPool, {
    tenant_id: input.tenant_id,
    project_id: input.project_id,
    group_id: input.group_id,
    crop_code: input.crop_code,
    fact_type: "skill_binding_v1",
  });

  const records = rows.map((row) => toBindingRecord(row));
  return input.enabled_only ? records.filter((x) => x.enabled) : records;
}

export async function switchSkillBinding(input: {
  skill_id: string;
  version: string;
  enabled: boolean;
  priority?: number;
  category?: string;
  scope?: { tenant_id?: string; project_id?: string; group_id?: string; crop_code?: string; scope_type?: string; bind_target?: string; device_type?: string; trigger_stage?: string; rollout_mode?: string };
}): Promise<SkillBindingRecord> {
  if (!bindingsPool) throw new Error("SKILL_BINDINGS_DB_UNAVAILABLE");

  const tenant_id = normalizeScopeValue(input.scope?.tenant_id);
  const project_id = normalizeScopeValue(input.scope?.project_id);
  const group_id = normalizeScopeValue(input.scope?.group_id);
  if (!tenant_id || !project_id || !group_id) throw new Error("TENANT_TRIPLE_REQUIRED");

  const appended = await appendSkillBindingFact(bindingsPool, {
    tenant_id,
    project_id,
    group_id,
    skill_id: input.skill_id,
    version: input.version,
    category: (input.category ?? "AGRONOMY") as any,
    status: input.enabled ? "ENABLED" : "DISABLED",
    scope_type: (input.scope?.scope_type ?? "TENANT") as any,
    rollout_mode: (input.scope?.rollout_mode ?? "DIRECT") as any,
    trigger_stage: (input.scope?.trigger_stage ?? "before_recommendation") as any,
    bind_target: input.scope?.bind_target ?? tenant_id,
    crop_code: input.scope?.crop_code ?? null,
    device_type: (input.scope?.device_type ?? null) as any,
    priority: Number.isFinite(Number(input.priority)) ? Number(input.priority) : 0,
  });

  await projectSkillRegistryReadV1(bindingsPool, { tenant_id, project_id, group_id });

  return {
    id: appended.fact_id,
    skill_id: appended.payload.skill_id,
    version: appended.payload.version,
    tenant_id,
    project_id,
    group_id,
    crop_code: appended.payload.crop_code ?? null,
    enabled: appended.payload.status === "ENABLED",
    priority: appended.payload.priority,
    category: appended.payload.category,
    scope_type: appended.payload.scope_type,
    rollout_mode: appended.payload.rollout_mode,
    trigger_stage: appended.payload.trigger_stage,
    bind_target: appended.payload.bind_target,
    device_type: appended.payload.device_type ?? null,
    updated_at: appended.occurred_at,
  };
}

function resolveFromFallback(input: { crop_code: string; tenant_id: string }): Array<SkillSwitch & { source: SkillBindingSource }> {
  const enabled = listFallbackSkillSwitches({
    crop_code: input.crop_code,
    tenant_id: input.tenant_id,
    enabled_only: true,
  });

  const mapped = enabled
    .map((row) => {
      const source = resolveSource(input.tenant_id, input.crop_code, {
        tenant_id: row.scope?.tenant_id ?? null,
        crop_code: row.scope?.crop_code ?? null,
      });
      return source ? { ...row, source } : null;
    })
    .filter((row): row is SkillSwitch & { source: SkillBindingSource } => Boolean(row));

  for (const source of sourceOrder) {
    const matched = mapped.filter((item) => item.source === source);
    const picked = pickBySkill(matched.map((item) => ({
      id: `fallback_${item.skill_id}_${item.version}_${source}`,
      skill_id: item.skill_id,
      version: item.version,
      tenant_id: item.scope?.tenant_id ?? null,
      project_id: null,
      group_id: null,
      crop_code: item.scope?.crop_code ?? null,
      enabled: item.enabled,
      priority: item.priority,
      category: null,
      scope_type: "TENANT",
      rollout_mode: "DIRECT",
      trigger_stage: null,
      bind_target: item.scope?.tenant_id ?? "*",
      device_type: null,
      updated_at: new Date(0).toISOString(),
      source,
    })));
    if (picked.length > 0) {
      return picked.map((item) => ({
        skill_id: item.skill_id,
        version: item.version,
        enabled: item.enabled,
        priority: item.priority,
        scope: { tenant_id: item.tenant_id ?? undefined, crop_code: item.crop_code ?? undefined },
        source,
      }));
    }
  }

  return [];
}

export async function resolveRuleSkillBindings(input: {
  crop_code: string;
  tenant_id: string;
  project_id?: string;
  group_id?: string;
}): Promise<Array<SkillBindingRecord & { source: SkillBindingSource }>> {
  if (!bindingsPool || !input.project_id || !input.group_id) {
    return resolveFromFallback(input).map((item) => ({
      id: `fallback_${item.skill_id}_${item.version}`,
      skill_id: item.skill_id,
      version: item.version,
      tenant_id: item.scope?.tenant_id ?? null,
      project_id: null,
      group_id: null,
      crop_code: item.scope?.crop_code ?? null,
      enabled: item.enabled,
      priority: item.priority,
      category: null,
      scope_type: "TENANT",
      rollout_mode: "DIRECT",
      trigger_stage: null,
      bind_target: item.scope?.tenant_id ?? "*",
      device_type: null,
      updated_at: new Date(0).toISOString(),
      source: item.source,
    }));
  }

  await projectSkillRegistryReadV1(bindingsPool, {
    tenant_id: input.tenant_id,
    project_id: input.project_id,
    group_id: input.group_id,
  });

  const rows = await querySkillRegistryReadV1(bindingsPool, {
    tenant_id: input.tenant_id,
    project_id: input.project_id,
    group_id: input.group_id,
    fact_type: "skill_binding_v1",
  });

  const withSource = rows
    .map((row) => toBindingRecord(row))
    .filter((row) => row.enabled)
    .map((row) => {
      const source = resolveSource(input.tenant_id, input.crop_code, row);
      return source ? { ...row, source } : null;
    })
    .filter((row): row is SkillBindingRecord & { source: SkillBindingSource } => Boolean(row));

  for (const source of sourceOrder) {
    const bucket = withSource.filter((row) => row.source === source);
    const picked = pickBySkill(bucket);
    if (picked.length > 0) return picked;
  }

  const fallback = resolveFromFallback(input);
  if (fallback.length > 0) {
    return fallback.map((item) => ({
      id: `fallback_${item.skill_id}_${item.version}`,
      skill_id: item.skill_id,
      version: item.version,
      tenant_id: item.scope?.tenant_id ?? null,
      project_id: null,
      group_id: null,
      crop_code: item.scope?.crop_code ?? null,
      enabled: item.enabled,
      priority: item.priority,
      category: null,
      scope_type: "TENANT",
      rollout_mode: "DIRECT",
      trigger_stage: null,
      bind_target: item.scope?.tenant_id ?? "*",
      device_type: null,
      updated_at: new Date(0).toISOString(),
      source: item.source,
    }));
  }

  throw new Error("NO_SKILL_BINDING_FOUND");
}

export async function getRuleSkills(input: {
  crop_code: string;
  tenant_id: string;
  project_id?: string;
  group_id?: string;
}): Promise<ResolvedRuleSkill[]> {
  const resolvedBindings = await resolveRuleSkillBindings(input);
  const resolved = resolvedBindings
    .map((s) => {
      const impl = ruleSkills.find((r) => r.id === s.skill_id && r.version === s.version);
      return impl ? { ...impl, __priority: s.priority } : null;
    })
    .filter((x): x is ResolvedRuleSkill => x !== null);

  resolved.sort((a, b) => b.__priority - a.__priority);
  return resolved;
}
