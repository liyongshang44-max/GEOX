import { apiRequestOptional, requestJson, withQuery } from "./client";

export type SkillRuntimeStatus = "DRAFT" | "ACTIVE" | "DISABLED" | "DEPRECATED" | "UNKNOWN" | string;
export type SkillBindingScope = "GLOBAL" | "TENANT" | "FIELD" | "DEVICE" | "PROGRAM" | string;
export type SkillRunStatus = "SUCCESS" | "FAILED" | "RUNNING" | "PENDING" | "SKIPPED" | "TIMEOUT" | string;

const RUNTIME_STATUS_COMPAT: Record<string, SkillRuntimeStatus> = {
  DRAFT: "DRAFT",
  ACTIVE: "ACTIVE",
  ENABLED: "ACTIVE",
  PAUSED: "DISABLED",
  DISABLED: "DISABLED",
  DEPRECATED: "DEPRECATED",
  ARCHIVED: "DEPRECATED",
};

const BINDING_SCOPE_COMPAT: Record<string, SkillBindingScope> = {
  GLOBAL: "GLOBAL",
  TENANT: "TENANT",
  PROJECT: "PROGRAM",
  GROUP: "PROGRAM",
  PROGRAM: "PROGRAM",
  CROP: "FIELD",
  FIELD: "FIELD",
  DEVICE: "DEVICE",
};

export type SkillRuleSwitch = {
  skill_id: string;
  version: string;
  enabled: boolean;
  priority: number;
  scope?: {
    tenant_id?: string;
    crop_code?: string;
  };
};

export type SkillRegistryItem = {
  skill_id: string;
  skill_name?: string | null;
  skill_type?: string | null;
  status: SkillRuntimeStatus;
  current_version?: string | null;
  latest_version?: string | null;
  published_versions?: string[];
  binding_scope?: SkillBindingScope | null;
  last_run?: SkillRunSummary | null;
  updated_ts_ms?: number | null;
};

export type SkillBindingItem = {
  binding_id: string;
  skill_id: string;
  version: string;
  status: SkillRuntimeStatus;
  scope: SkillBindingScope;
  target_id?: string | null;
  crop_code?: string | null;
  priority?: number | null;
  is_default?: boolean;
  updated_ts_ms?: number | null;
  last_run?: SkillRunSummary | null;
};

export type SkillRunSummary = {
  run_id: string;
  skill_id: string;
  version?: string | null;
  status: SkillRunStatus;
  started_ts_ms?: number | null;
  finished_ts_ms?: number | null;
  duration_ms?: number | null;
  trigger_source?: string | null;
  scope?: SkillBindingScope | null;
};

export type SkillRunDetail = SkillRunSummary & {
  request_id?: string | null;
  tenant_id?: string | null;
  project_id?: string | null;
  group_id?: string | null;
  target_id?: string | null;
  input?: Record<string, unknown> | null;
  output?: Record<string, unknown> | null;
  error_code?: string | null;
  error_message?: string | null;
};

function normalizeRuntimeStatus(status: unknown): SkillRuntimeStatus {
  const key = String(status ?? "").trim().toUpperCase();
  return RUNTIME_STATUS_COMPAT[key] ?? (String(status ?? "").trim() || "UNKNOWN");
}

function normalizeScope(scope: unknown): SkillBindingScope {
  const key = String(scope ?? "").trim().toUpperCase();
  return BINDING_SCOPE_COMPAT[key] ?? (String(scope ?? "").trim() || "TENANT");
}

function normalizeList<T>(res: any): T[] {
  if (Array.isArray(res)) return res as T[];
  if (Array.isArray(res?.items)) return res.items as T[];
  if (Array.isArray(res?.data)) return res.data as T[];
  return [];
}

function normalizeSkillRegistryItem(item: SkillRegistryItem): SkillRegistryItem {
  return {
    ...item,
    status: normalizeRuntimeStatus(item.status),
    binding_scope: item.binding_scope == null ? item.binding_scope : normalizeScope(item.binding_scope),
  };
}

function normalizeSkillBindingItem(item: SkillBindingItem): SkillBindingItem {
  return {
    ...item,
    status: normalizeRuntimeStatus(item.status),
    scope: normalizeScope(item.scope),
    last_run: item.last_run ? normalizeSkillRunSummary(item.last_run) : item.last_run,
  };
}

function normalizeSkillRunSummary(item: SkillRunSummary): SkillRunSummary {
  return {
    ...item,
    scope: item.scope == null ? item.scope : normalizeScope(item.scope),
  };
}

async function firstList<T>(paths: string[]): Promise<T[]> {
  for (const path of paths) {
    const res = await apiRequestOptional<any>(path);
    if (res) return normalizeList<T>(res);
  }
  return [];
}

export async function listSkillRules(input?: {
  crop_code?: string;
  tenant_id?: string;
  enabled_only?: boolean;
}): Promise<SkillRuleSwitch[]> {
  return requestJson<SkillRuleSwitch[]>(withQuery("/api/v1/skills/rules", input));
}

export async function switchSkillRule(input: {
  skill_id: string;
  version: string;
  enabled: boolean;
  priority?: number;
  scope?: {
    tenant_id?: string;
    crop_code?: string;
  };
}): Promise<{ ok: true; item: SkillRuleSwitch }> {
  return requestJson<{ ok: true; item: SkillRuleSwitch }>("/api/v1/skills/rules/switch", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function listSkillRegistry(input?: {
  keyword?: string;
  status?: SkillRuntimeStatus;
  scope?: SkillBindingScope;
  limit?: number;
}): Promise<SkillRegistryItem[]> {
  const items = await firstList<SkillRegistryItem>([
    withQuery("/api/v1/skills/registry", input),
    withQuery("/api/v1/skills", input),
  ]);
  return items.map((item) => normalizeSkillRegistryItem(item));
}

export async function listSkillBindings(input?: {
  skill_id?: string;
  scope?: SkillBindingScope;
  status?: SkillRuntimeStatus;
  target_id?: string;
  limit?: number;
}): Promise<SkillBindingItem[]> {
  const items = await firstList<SkillBindingItem>([
    withQuery("/api/v1/skills/bindings", input),
    withQuery("/api/v1/skills/rules", input),
  ]);
  return items.map((item) => normalizeSkillBindingItem(item));
}

export async function listSkillRuns(input?: {
  skill_id?: string;
  status?: SkillRunStatus;
  scope?: SkillBindingScope;
  limit?: number;
}): Promise<SkillRunSummary[]> {
  const items = await firstList<SkillRunSummary>([
    withQuery("/api/v1/skills/runs", input),
    withQuery("/api/v1/skill-runs", input),
  ]);
  return items.map((item) => normalizeSkillRunSummary(item));
}

export async function getSkillRunDetail(runId: string): Promise<SkillRunDetail | null> {
  const id = String(runId ?? "").trim();
  if (!id) return null;
  const res = await apiRequestOptional<any>(`/api/v1/skills/runs/${encodeURIComponent(id)}`)
    ?? await apiRequestOptional<any>(`/api/v1/skill-runs/${encodeURIComponent(id)}`);
  if (!res) return null;
  return normalizeSkillRunSummary((res.item ?? res.run ?? res) as SkillRunDetail) as SkillRunDetail;
}
