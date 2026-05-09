import { apiRequestWithPolicy, withQuery } from "./client";

export type OperatorFieldMemoryDataScope = "OFFICIAL_OPERATOR_API" | "FALLBACK_LIMITED" | "EMPTY" | "PERMISSION_DENIED" | "ERROR_EMPTY";

export type OperatorFieldMemoryItem = {
  memoryId: string;
  fieldId?: string | null;
  operationId?: string | null;
  memoryType?: string | null;
  beforeText?: string | null;
  afterText?: string | null;
  deltaText?: string | null;
  confidenceText?: string | null;
  skillRefs: string[];
  evidenceRefs: string[];
  recommendationId?: string | null;
  taskId?: string | null;
  acceptanceId?: string | null;
  roiId?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  weatherInterferenceDetected?: boolean | null;
  learningExcludedReason?: string | null;
  operatorHint?: string | null;
  source: "operator_field_memory_api" | "field_memory_api" | "operation_field_memory_api";
};

export type OperatorFieldMemoryResponse = {
  source: "operator_field_memory_api" | "fallback_existing_sources" | "permission_denied" | "empty_error_state";
  dataScope: OperatorFieldMemoryDataScope;
  generated_at?: string | null;
  items: OperatorFieldMemoryItem[];
  filters: { fieldId?: string; operationId?: string; memoryType?: string };
  message?: string;
};

type AnyRecord = Record<string, any>;

const ENABLE_OPERATOR_FIELD_MEMORY_API = String((import.meta as any)?.env?.VITE_ENABLE_OPERATOR_FIELD_MEMORY_API ?? "").toLowerCase() === "true";
const ENABLE_GLOBAL_FIELD_MEMORY_FALLBACK = String((import.meta as any)?.env?.VITE_ENABLE_GLOBAL_FIELD_MEMORY_FALLBACK ?? "").toLowerCase() === "true";

function text(value: unknown, fallback = ""): string {
  const raw = String(value ?? "").trim();
  if (!raw || raw === "--" || raw === "undefined" || raw === "null") return fallback;
  return raw;
}

function arrayFrom(payload: unknown, keys: string[]): AnyRecord[] {
  if (Array.isArray(payload)) return payload.filter((item): item is AnyRecord => Boolean(item && typeof item === "object"));
  if (!payload || typeof payload !== "object") return [];
  const obj = payload as AnyRecord;
  for (const key of keys) {
    const value = obj[key];
    if (Array.isArray(value)) return value.filter((item): item is AnyRecord => Boolean(item && typeof item === "object"));
  }
  if (obj.data) return arrayFrom(obj.data, keys);
  if (obj.items) return arrayFrom(obj.items, keys);
  return [];
}

function safeText(value: unknown, fallback = "未提供"): string {
  const raw = text(value, "");
  if (!raw) return fallback;
  if (/secret|token|access[_-]?key|password|credential/i.test(raw)) return "敏感信息已隐藏";
  if (/^[A-Za-z]:\\/.test(raw) || raw.startsWith("/") || raw.includes("file://")) return "本地路径已隐藏";
  if (raw.length > 180) return `${raw.slice(0, 120)}...${raw.slice(-24)}`;
  return raw;
}

function summarizeValue(value: unknown, fallback = "未提供"): string {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return safeText(value, fallback);
  if (Array.isArray(value)) {
    const parts = value.map((item) => summarizeValue(item, "")).filter(Boolean);
    return parts.length ? parts.slice(0, 8).join("；") : fallback;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as AnyRecord)
      .filter(([key]) => !/secret|token|access|password|path/i.test(key))
      .map(([key, val]) => `${key}: ${safeText(val, "")}`)
      .filter(Boolean);
    return entries.length ? entries.slice(0, 8).join("；") : fallback;
  }
  return fallback;
}

function refs(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => safeText(typeof item === "object" ? (item as AnyRecord).id ?? (item as AnyRecord).ref ?? (item as AnyRecord).skill_id ?? (item as AnyRecord).evidence_id : item, "")).filter(Boolean).slice(0, 12);
  }
  const single = safeText(value, "");
  return single ? [single] : [];
}

function normalizeItem(row: AnyRecord, index: number, source: OperatorFieldMemoryItem["source"], filters: { fieldId?: string; operationId?: string; memoryType?: string }): OperatorFieldMemoryItem {
  const weatherInterferenceDetected = row.weather_interference_detected == null ? null : Boolean(row.weather_interference_detected);
  const learningExcludedReason = text(row.learning_excluded_reason, "") || null;
  const operatorHint = weatherInterferenceDetected
    ? "该次湿度变化可能受降雨影响，暂不计入灌溉学习。"
    : null;
  return {
    memoryId: safeText(row.memory_id ?? row.field_memory_id ?? row.id, `memory-${index}`),
    fieldId: safeText(row.field_id ?? row.fieldId, filters.fieldId ?? ""),
    operationId: safeText(row.operation_id ?? row.operationId ?? row.operation_plan_id, filters.operationId ?? ""),
    memoryType: safeText(row.memory_type ?? row.type ?? row.category, filters.memoryType ?? "类型待确认"),
    beforeText: summarizeValue(row.before ?? row.before_state ?? row.previous ?? row.from, "before 未提供"),
    afterText: summarizeValue(row.after ?? row.after_state ?? row.current ?? row.to, "after 未提供"),
    deltaText: summarizeValue(row.delta ?? row.change ?? row.diff ?? row.delta_value, "delta 未提供"),
    confidenceText: summarizeValue(row.confidence ?? row.confidence_text ?? row.confidence_score, "confidence 待确认"),
    skillRefs: refs(row.skill_refs ?? row.skill_trace_refs ?? row.skill_runs ?? row.skills),
    evidenceRefs: refs(row.evidence_refs ?? row.evidence_ref ?? row.evidence_ids),
    recommendationId: safeText(row.recommendation_id ?? row.recommendationId, ""),
    taskId: safeText(row.task_id ?? row.act_task_id ?? row.taskId, ""),
    acceptanceId: safeText(row.acceptance_id ?? row.acceptanceId, ""),
    roiId: safeText(row.roi_id ?? row.roi_ledger_id ?? row.roiId, ""),
    createdAt: text(row.created_at ?? row.generated_at, ""),
    updatedAt: text(row.updated_at ?? row.last_updated_at ?? row.generated_at, ""),
    weatherInterferenceDetected,
    learningExcludedReason,
    operatorHint,
    source,
  };
}

function normalizeRows(payload: unknown, source: OperatorFieldMemoryItem["source"], filters: { fieldId?: string; operationId?: string; memoryType?: string }): OperatorFieldMemoryItem[] {
  return arrayFrom(payload, ["items", "memories", "field_memory", "memory", "entries", "data"]).map((row, index) => normalizeItem(row, index, source, filters));
}

function filterItems(items: OperatorFieldMemoryItem[], filters: { fieldId?: string; operationId?: string; memoryType?: string }): OperatorFieldMemoryItem[] {
  return items.filter((item) => {
    if (filters.fieldId && text(item.fieldId) && text(item.fieldId) !== filters.fieldId) return false;
    if (filters.operationId && text(item.operationId) && text(item.operationId) !== filters.operationId) return false;
    if (filters.memoryType && text(item.memoryType).toLowerCase() !== filters.memoryType.toLowerCase()) return false;
    return true;
  });
}

async function fetchOptional(path: string): Promise<{ status: number; data: unknown | null; denied: boolean }> {
  try {
    const result = await apiRequestWithPolicy<unknown>(path, undefined, { allowedStatuses: [401, 403, 404, 405, 422], silent: true, timeoutMs: 10000 });
    return { status: result.status, data: result.ok ? result.data : null, denied: result.status === 401 || result.status === 403 };
  } catch {
    return { status: 0, data: null, denied: false };
  }
}

export async function fetchOperatorFieldMemory(args: { fieldId?: unknown; operationId?: unknown; memoryType?: unknown } = {}): Promise<OperatorFieldMemoryResponse> {
  const fieldId = text(args.fieldId, "");
  const operationId = text(args.operationId, "");
  const memoryType = text(args.memoryType, "");
  const filters = { ...(fieldId ? { fieldId } : {}), ...(operationId ? { operationId } : {}), ...(memoryType ? { memoryType } : {}) };
  const query: Record<string, string> = {};
  if (fieldId) query.field_id = fieldId;
  if (operationId) query.operation_id = operationId;
  if (memoryType) query.memory_type = memoryType;

  if (ENABLE_OPERATOR_FIELD_MEMORY_API) {
    const official = await fetchOptional(withQuery("/api/v1/operator/field-memory", query));
    if (official.denied) {
      return {
        source: "permission_denied",
        dataScope: "PERMISSION_DENIED",
        generated_at: new Date().toISOString(),
        items: [],
        filters,
        message: "当前身份无权查看运营田块记忆明细。",
      };
    }
    const officialItems = filterItems(normalizeRows(official.data, "operator_field_memory_api", filters), filters);
    if (officialItems.length > 0) {
      return {
        source: "operator_field_memory_api",
        dataScope: "OFFICIAL_OPERATOR_API",
        generated_at: new Date().toISOString(),
        items: officialItems,
        filters,
      };
    }
  }

  const fallbackCalls: Promise<{ status: number; data: unknown | null; denied: boolean }>[] = [];
  if (fieldId) fallbackCalls.push(fetchOptional(withQuery(`/api/v1/fields/${encodeURIComponent(fieldId)}/memory`, memoryType ? { memory_type: memoryType } : {})));
  if (operationId) fallbackCalls.push(fetchOptional(withQuery(`/api/v1/operations/${encodeURIComponent(operationId)}/field-memory`, memoryType ? { memory_type: memoryType } : {})));
  if (ENABLE_GLOBAL_FIELD_MEMORY_FALLBACK) fallbackCalls.push(fetchOptional(withQuery("/api/v1/field-memory", query)));

  if (fallbackCalls.length > 0) {
    const fallbackResults = await Promise.all(fallbackCalls);
    if (fallbackResults.some((item) => item.denied)) {
      return {
        source: "permission_denied",
        dataScope: "PERMISSION_DENIED",
        generated_at: new Date().toISOString(),
        items: [],
        filters,
        message: "当前身份无权查看运营田块记忆明细。",
      };
    }

    const fallbackItems = filterItems(fallbackResults.flatMap((result) => normalizeRows(result.data, operationId ? "operation_field_memory_api" : "field_memory_api", filters)), filters)
      .filter((item, index, all) => all.findIndex((x) => x.memoryId === item.memoryId) === index);

    if (fallbackItems.length > 0) {
      return {
        source: "fallback_existing_sources",
        dataScope: "FALLBACK_LIMITED",
        generated_at: new Date().toISOString(),
        items: fallbackItems,
        filters,
        message: "当前展示 field-memory 现有接口包装后的有限运营记忆明细，非完整 operator field-memory。",
      };
    }
  }

  return {
    source: "fallback_existing_sources",
    dataScope: "EMPTY",
    generated_at: new Date().toISOString(),
    items: [],
    filters,
    message: ENABLE_OPERATOR_FIELD_MEMORY_API || ENABLE_GLOBAL_FIELD_MEMORY_FALLBACK || fieldId || operationId
      ? "暂无田块记忆明细。"
      : "田块记忆明细接口未接入，当前不探测未 ready API；可输入 field_id 或 operation_id 查看已有详情 fallback。",
  };
}
