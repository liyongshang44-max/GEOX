import { apiRequestWithPolicy, withQuery } from "./client";
import type { CustomerScopeV1 } from "./session";

export type CustomerDataScope = "OFFICIAL_CUSTOMER_API" | "FALLBACK_RECENT_ONLY" | "ERROR_EMPTY";
export type CustomerFieldRiskLevel = "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";

export type CustomerFieldListItem = {
  field_id: string;
  field_name?: string | null;
  risk_level?: CustomerFieldRiskLevel | string | null;
  risk_reasons?: string[] | null;
  updated_at?: string | null;
  crop_name?: string | null;
  stage_name?: string | null;
  recent_operation_id?: string | null;
  recent_operation_title?: string | null;
  open_alerts_count?: number | null;
  pending_acceptance_count?: number | null;
  summary?: string | null;
};

export type CustomerFieldsListResponse = {
  ok?: boolean;
  source: "customer_fields_api" | "dashboard_aggregate_fallback" | "empty_error_state";
  dataScope: CustomerDataScope;
  is_fallback: boolean;
  generated_at?: string | null;
  scope?: CustomerScopeV1;
  field_count?: number;
  fields: CustomerFieldListItem[];
  data_scope_note?: string;
};

type CustomerFieldsApiEnvelope =
  | { ok?: boolean; fields?: CustomerFieldListItem[]; generated_at?: string | null; scope?: CustomerScopeV1; field_count?: number; data?: unknown }
  | { ok?: boolean; customer_fields?: CustomerFieldListItem[]; generated_at?: string | null; scope?: CustomerScopeV1; field_count?: number }
  | CustomerFieldListItem[];

function normalizeFieldsPayload(payload: unknown): { fields: CustomerFieldListItem[]; generatedAt?: string | null; scope?: CustomerScopeV1; fieldCount?: number } {
  if (Array.isArray(payload)) return { fields: payload };
  if (!payload || typeof payload !== "object") return { fields: [] };
  const obj = payload as Record<string, unknown>;
  if (Array.isArray(obj.fields)) return { fields: obj.fields as CustomerFieldListItem[], generatedAt: obj.generated_at as string | null | undefined, scope: obj.scope as CustomerScopeV1 | undefined, fieldCount: typeof obj.field_count === "number" ? obj.field_count : undefined };
  if (Array.isArray(obj.customer_fields)) return { fields: obj.customer_fields as CustomerFieldListItem[], generatedAt: obj.generated_at as string | null | undefined, scope: obj.scope as CustomerScopeV1 | undefined, fieldCount: typeof obj.field_count === "number" ? obj.field_count : undefined };
  if (obj.data) return normalizeFieldsPayload(obj.data);
  return { fields: [] };
}

function emptyCustomerFieldsResponse(note = "正式报告条件不足，地块列表暂不可用，请稍后刷新"): CustomerFieldsListResponse {
  return {
    source: "empty_error_state",
    dataScope: "ERROR_EMPTY",
    is_fallback: true,
    generated_at: new Date().toISOString(),
    field_count: 0,
    fields: [],
    data_scope_note: note,
  };
}

export async function fetchCustomerFields(): Promise<CustomerFieldsListResponse> {
  try {
    const direct = await apiRequestWithPolicy<CustomerFieldsApiEnvelope>(withQuery("/api/v1/customer/fields"), undefined, { allowedStatuses: [404, 405, 422], silent: true, timeoutMs: 10000 });
    if (!direct.ok) {
      return emptyCustomerFieldsResponse();
    }
    const normalized = normalizeFieldsPayload(direct.data);
    return { source: "customer_fields_api", dataScope: "OFFICIAL_CUSTOMER_API", is_fallback: false, generated_at: normalized.generatedAt ?? new Date().toISOString(), scope: normalized.scope, field_count: normalized.fieldCount ?? normalized.fields.length, fields: normalized.fields };
  } catch {
    return emptyCustomerFieldsResponse();
  }
}
