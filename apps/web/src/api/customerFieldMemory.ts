import { apiRequestWithPolicy, withQuery } from "./client";

export type CustomerFieldMemoryDataScope = "OFFICIAL_CUSTOMER_API" | "COMPAT_MEMORY_API" | "FALLBACK_EMBEDDED_REPORT" | "NO_MEMORY" | "ERROR_EMPTY";

export type CustomerFieldMemoryItem = {
  title?: string | null;
  summary_text?: string | null;
  text?: string | null;
  customer_text?: string | null;
  learned_text?: string | null;
  memory_code?: string | null;
  memory_type?: string | null;
  confidence?: { score?: number | string | null; label?: string | null } | null;
  confidence_score?: number | string | null;
  generated_at?: string | null;
  updated_at?: string | null;
  technical_ref?: string | null;
  source_ref?: string | null;
};

export type CustomerFieldMemoryResponse = {
  source: "customer_field_memory_api" | "field_memory_compat_api" | "operation_field_memory_api" | "generic_field_memory_api" | "embedded_report_fallback" | "no_memory" | "empty_error_state";
  dataScope: CustomerFieldMemoryDataScope;
  generated_at?: string | null;
  items: CustomerFieldMemoryItem[];
  message?: string;
};

type FieldMemoryApiEnvelope =
  | CustomerFieldMemoryItem[]
  | { ok?: boolean; items?: CustomerFieldMemoryItem[]; entries?: CustomerFieldMemoryItem[]; memories?: CustomerFieldMemoryItem[]; memory?: unknown; field_memory?: unknown; generated_at?: string | null; data?: unknown };

function cleanId(value: unknown): string {
  const text = String(value ?? "").trim();
  if (!text || text === "--" || text === "暂无记录" || text === "待生成") return "";
  return text;
}

function normalizeItems(payload: unknown): { items: CustomerFieldMemoryItem[]; generatedAt?: string | null } {
  if (Array.isArray(payload)) return { items: payload.filter((item): item is CustomerFieldMemoryItem => Boolean(item && typeof item === "object")) };
  if (!payload || typeof payload !== "object") return { items: [] };
  const obj = payload as Record<string, unknown>;
  if (Array.isArray(obj.items)) return { items: obj.items as CustomerFieldMemoryItem[], generatedAt: obj.generated_at as string | null | undefined };
  if (Array.isArray(obj.entries)) return { items: obj.entries as CustomerFieldMemoryItem[], generatedAt: obj.generated_at as string | null | undefined };
  if (Array.isArray(obj.memories)) return { items: obj.memories as CustomerFieldMemoryItem[], generatedAt: obj.generated_at as string | null | undefined };
  if (obj.memory) return normalizeItems(obj.memory);
  if (obj.field_memory) return normalizeItems(obj.field_memory);
  if (obj.data) return normalizeItems(obj.data);
  const hasReadable = [obj.summary_text, obj.text, obj.customer_text, obj.learned_text, obj.title].some((value) => String(value ?? "").trim());
  return hasReadable ? { items: [obj as CustomerFieldMemoryItem], generatedAt: obj.generated_at as string | null | undefined } : { items: [] };
}

async function fetchMemoryPath(path: string, source: CustomerFieldMemoryResponse["source"], dataScope: CustomerFieldMemoryDataScope, query?: Record<string, string>): Promise<CustomerFieldMemoryResponse | null> {
  const result = await apiRequestWithPolicy<FieldMemoryApiEnvelope>(
    withQuery(path, query),
    undefined,
    { allowedStatuses: [404, 405, 422, 403], silent: true, timeoutMs: 10000 }
  );
  if (!result.ok) return null;
  const normalized = normalizeItems(result.data);
  return {
    source,
    dataScope: normalized.items.length ? dataScope : "NO_MEMORY",
    generated_at: normalized.generatedAt ?? new Date().toISOString(),
    items: normalized.items,
    message: normalized.items.length ? undefined : "暂无田块记忆。",
  };
}

function collectEmbeddedMemoryItems(embeddedMemory: unknown): CustomerFieldMemoryItem[] {
  if (!embeddedMemory || typeof embeddedMemory !== "object") return [];
  const obj = embeddedMemory as Record<string, unknown>;
  const buckets = [
    obj.items,
    obj.entries,
    obj.memories,
    obj.field_response_memory,
    obj.device_reliability_memory,
    obj.skill_performance_memory,
  ];
  const rows = buckets.flatMap((bucket) => Array.isArray(bucket) ? bucket : []).filter((item): item is CustomerFieldMemoryItem => Boolean(item && typeof item === "object"));
  if (rows.length) return rows;
  const summary = obj.summary_text ?? obj.text ?? obj.customer_text ?? obj.learned_text;
  return String(summary ?? "").trim() ? [{ summary_text: String(summary), generated_at: String(obj.generated_at ?? obj.updated_at ?? "") || null }] : [];
}

export async function fetchCustomerFieldMemory(args: { fieldId?: unknown; operationId?: unknown; embeddedMemory?: unknown }): Promise<CustomerFieldMemoryResponse> {
  const fieldId = cleanId(args.fieldId);
  const operationId = cleanId(args.operationId);

  try {
    if (fieldId) {
      const official = await fetchMemoryPath(`/api/v1/customer/fields/${encodeURIComponent(fieldId)}/memory`, "customer_field_memory_api", "OFFICIAL_CUSTOMER_API");
      if (official && official.items.length) return official;

      const compatField = await fetchMemoryPath(`/api/v1/fields/${encodeURIComponent(fieldId)}/memory`, "field_memory_compat_api", "COMPAT_MEMORY_API");
      if (compatField && compatField.items.length) return compatField;
    }

    if (operationId) {
      const operationMemory = await fetchMemoryPath(`/api/v1/operations/${encodeURIComponent(operationId)}/field-memory`, "operation_field_memory_api", "COMPAT_MEMORY_API");
      if (operationMemory && operationMemory.items.length) return operationMemory;
    }

    const genericQuery: Record<string, string> = {};
    if (fieldId) genericQuery.field_id = fieldId;
    if (operationId) genericQuery.operation_id = operationId;
    if (fieldId || operationId) {
      const genericMemory = await fetchMemoryPath("/api/v1/field-memory", "generic_field_memory_api", "COMPAT_MEMORY_API", genericQuery);
      if (genericMemory && genericMemory.items.length) return genericMemory;
    }

    const embeddedItems = collectEmbeddedMemoryItems(args.embeddedMemory);
    if (embeddedItems.length) {
      return {
        source: "embedded_report_fallback",
        dataScope: "FALLBACK_EMBEDDED_REPORT",
        generated_at: new Date().toISOString(),
        items: embeddedItems,
        message: "当前展示报告内嵌田块记忆摘要。",
      };
    }

    return { source: "no_memory", dataScope: "NO_MEMORY", generated_at: new Date().toISOString(), items: [], message: "暂无田块记忆。" };
  } catch {
    return { source: "empty_error_state", dataScope: "ERROR_EMPTY", generated_at: new Date().toISOString(), items: [], message: "田块记忆暂不可用，请稍后刷新。" };
  }
}
