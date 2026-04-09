import { apiRequestOptional, requestJson, withQuery } from "./client";

export type SkillRuntimeStatus = "DRAFT" | "ACTIVE" | "DISABLED" | "DEPRECATED" | "UNKNOWN" | string;
export type SkillBindingScope = "GLOBAL" | "TENANT" | "FIELD" | "DEVICE" | "PROGRAM" | string;
export type SkillRunStatus = "SUCCESS" | "FAILED" | "RUNNING" | "PENDING" | "SKIPPED" | "TIMEOUT" | string;
export type SkillType = "sensing" | "agronomy" | "device" | "acceptance";

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
  skill_type?: SkillType | null;
  category?: SkillType | null;
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
  const mappedSkillType = (item.skill_type ?? item.category ?? null) as SkillType | null;
  return {
    ...item,
    skill_type: mappedSkillType,
    category: mappedSkillType,
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
  const runId = String((item as any)?.run_id ?? (item as any)?.id ?? "").trim();
  const skillId = String((item as any)?.skill_id ?? (item as any)?.skill ?? "").trim();
  const startedTs = (item as any)?.started_ts_ms ?? (item as any)?.started_at_ts_ms ?? (item as any)?.started_at;
  const finishedTs = (item as any)?.finished_ts_ms ?? (item as any)?.finished_at_ts_ms ?? (item as any)?.finished_at;
  const startedTsMs = Number(startedTs ?? 0);
  const finishedTsMs = Number(finishedTs ?? 0);
  const normalizedStatus = String((item as any)?.status ?? (item as any)?.result_status ?? (item as any)?.final_status ?? "").trim();
  return {
    ...item,
    run_id: runId || String(item.run_id ?? "").trim(),
    skill_id: skillId || String(item.skill_id ?? "").trim(),
    status: normalizedStatus || String(item.status ?? "UNKNOWN"),
    started_ts_ms: Number.isFinite(startedTsMs) && startedTsMs > 0 ? startedTsMs : item.started_ts_ms ?? null,
    finished_ts_ms: Number.isFinite(finishedTsMs) && finishedTsMs > 0 ? finishedTsMs : item.finished_ts_ms ?? null,
    scope: item.scope == null ? normalizeScope((item as any)?.binding_scope ?? (item as any)?.scope) : normalizeScope(item.scope),
  };
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
  const res = await apiRequestOptional<any>(withQuery("/api/v1/skills", input), undefined, { timeoutMs: 5000, dedupe: true, silent: true });
  const items = normalizeList<SkillRegistryItem>(res);
  return items.map((item) => normalizeSkillRegistryItem(item));
}

export async function listSkillBindings(input?: {
  skill_id?: string;
  scope?: SkillBindingScope;
  status?: SkillRuntimeStatus;
  target_id?: string;
  limit?: number;
}): Promise<SkillBindingItem[]> {
  try {
    const res = await apiRequestOptional<any>(withQuery("/api/v1/skills/bindings", input), undefined, { timeoutMs: 5000, dedupe: true, silent: true });
    const items = normalizeList<SkillBindingItem>(res);
    return items.map((item) => normalizeSkillBindingItem(item));
  } catch {
    return [];
  }
}

export async function listSkillRuns(input?: {
  skill_id?: string;
  status?: SkillRunStatus;
  scope?: SkillBindingScope;
  limit?: number;
}): Promise<SkillRunSummary[]> {
  try {
    const res = await apiRequestOptional<any>(withQuery("/api/v1/skill-runs", input), undefined, { timeoutMs: 5000, dedupe: true, silent: true });
    const items = normalizeList<SkillRunSummary>(res);
    if (items.length) return items.map((item) => normalizeSkillRunSummary(item));
  } catch {
    // fallback below
  }
  try {
    const res = await apiRequestOptional<any>(withQuery("/api/v1/skills/runs", input), undefined, { timeoutMs: 5000, dedupe: true, silent: true });
    const items = normalizeList<SkillRunSummary>(res);
    return items.map((item) => normalizeSkillRunSummary(item));
  } catch {
    return [];
  }
}

export async function getSkillRunDetail(runId: string): Promise<SkillRunDetail | null> {
  const id = String(runId ?? "").trim();
  if (!id) return null;
  try {
    const res = await apiRequestOptional<any>(`/api/v1/skills/runs/${encodeURIComponent(id)}`, undefined, { timeoutMs: 5000, dedupe: true, silent: true });
    if (!res) return null;
    return normalizeSkillRunSummary((res.item ?? res.run ?? res) as SkillRunDetail) as SkillRunDetail;
  } catch {
    return null;
  }
}
