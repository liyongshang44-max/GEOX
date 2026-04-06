import { apiRequestOptional, requestJson, withQuery } from "./client";

export type SkillRuntimeStatus = "ACTIVE" | "DISABLED" | "DRAFT" | "ARCHIVED" | "UNKNOWN" | string;
export type SkillBindingScope = "GLOBAL" | "TENANT" | "PROJECT" | "GROUP" | "CROP" | "FIELD" | "DEVICE" | string;
export type SkillRunStatus = "SUCCESS" | "FAILED" | "RUNNING" | "PENDING" | "SKIPPED" | string;

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

function normalizeList<T>(res: any): T[] {
  if (Array.isArray(res)) return res as T[];
  if (Array.isArray(res?.items)) return res.items as T[];
  if (Array.isArray(res?.data)) return res.data as T[];
  return [];
}

async function firstList<T>(paths: string[]): Promise<T[]> {
  for (const path of paths) {
    const res = await apiRequestOptional<any>(path);
    if (res) return normalizeList<T>(res);
  }
  return [];
}

export async function listSkillRegistry(input?: {
  keyword?: string;
  status?: SkillRuntimeStatus;
  scope?: SkillBindingScope;
  limit?: number;
}): Promise<SkillRegistryItem[]> {
  return firstList<SkillRegistryItem>([
    withQuery("/api/v1/skills/registry", input),
    withQuery("/api/v1/skills", input),
  ]);
}

export async function listSkillBindings(input?: {
  skill_id?: string;
  scope?: SkillBindingScope;
  status?: SkillRuntimeStatus;
  target_id?: string;
  limit?: number;
}): Promise<SkillBindingItem[]> {
  return firstList<SkillBindingItem>([
    withQuery("/api/v1/skills/bindings", input),
    withQuery("/api/v1/skills/rules", input),
  ]);
}

export async function listSkillRuns(input?: {
  skill_id?: string;
  status?: SkillRunStatus;
  scope?: SkillBindingScope;
  limit?: number;
}): Promise<SkillRunSummary[]> {
  return firstList<SkillRunSummary>([
    withQuery("/api/v1/skills/runs", input),
    withQuery("/api/v1/skill-runs", input),
  ]);
}

export async function getSkillRunDetail(runId: string): Promise<SkillRunDetail | null> {
  const id = String(runId ?? "").trim();
  if (!id) return null;
  const res = await apiRequestOptional<any>(`/api/v1/skills/runs/${encodeURIComponent(id)}`)
    ?? await apiRequestOptional<any>(`/api/v1/skill-runs/${encodeURIComponent(id)}`);
  if (!res) return null;
  return (res.item ?? res.run ?? res) as SkillRunDetail;
}
