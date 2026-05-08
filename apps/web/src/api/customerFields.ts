import { apiRequestOptional, withQuery } from "./client";
import { fetchCustomerDashboardAggregate, type CustomerDashboardAggregateV1 } from "./customerReports";

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
};

export type CustomerFieldsListResponse = {
  ok?: boolean;
  source: "customer_fields_api" | "dashboard_aggregate_fallback";
  is_fallback: boolean;
  generated_at?: string | null;
  fields: CustomerFieldListItem[];
  data_scope_note?: string;
};

type CustomerFieldsApiEnvelope =
  | { ok?: boolean; fields?: CustomerFieldListItem[]; generated_at?: string | null; data?: unknown }
  | { ok?: boolean; customer_fields?: CustomerFieldListItem[]; generated_at?: string | null }
  | CustomerFieldListItem[];

function normalizeFieldsPayload(payload: unknown): { fields: CustomerFieldListItem[]; generatedAt?: string | null } {
  if (Array.isArray(payload)) return { fields: payload };
  if (!payload || typeof payload !== "object") return { fields: [] };
  const obj = payload as Record<string, unknown>;
  if (Array.isArray(obj.fields)) return { fields: obj.fields as CustomerFieldListItem[], generatedAt: obj.generated_at as string | null | undefined };
  if (Array.isArray(obj.customer_fields)) return { fields: obj.customer_fields as CustomerFieldListItem[], generatedAt: obj.generated_at as string | null | undefined };
  if (obj.data) return normalizeFieldsPayload(obj.data);
  return { fields: [] };
}

function toFallbackFields(aggregate: CustomerDashboardAggregateV1): CustomerFieldListItem[] {
  const byId = new Map<string, CustomerFieldListItem>();

  for (const item of aggregate.top_risk_fields ?? []) {
    const fieldId = String(item.field_id ?? "").trim();
    if (!fieldId) continue;
    byId.set(fieldId, {
      field_id: fieldId,
      field_name: item.field_name ?? null,
      risk_level: item.risk_level ?? "UNKNOWN",
      risk_reasons: item.risk_reasons ?? [],
      updated_at: (aggregate as any).generated_at ?? null,
    });
  }

  for (const item of aggregate.recent_operations ?? []) {
    const fieldId = String((item as any).field_id ?? "").trim();
    if (!fieldId) continue;
    const previous = byId.get(fieldId);
    byId.set(fieldId, {
      field_id: fieldId,
      field_name: (item as any).field_name ?? previous?.field_name ?? null,
      risk_level: previous?.risk_level ?? "UNKNOWN",
      risk_reasons: previous?.risk_reasons ?? [],
      updated_at: (item as any).updated_at ?? (item as any).executed_at ?? (aggregate as any).generated_at ?? previous?.updated_at ?? null,
      recent_operation_id: String((item as any).operation_id ?? (item as any).operation_plan_id ?? "") || null,
      recent_operation_title: (item as any).customer_title ?? (item as any).title ?? null,
    });
  }

  return Array.from(byId.values());
}

export async function fetchCustomerFields(): Promise<CustomerFieldsListResponse> {
  const direct = await apiRequestOptional<CustomerFieldsApiEnvelope>(
    withQuery("/api/v1/customer/fields"),
    undefined,
    { allowedStatuses: [404, 405, 422], silent: true, timeoutMs: 10000 }
  );

  if (direct) {
    const normalized = normalizeFieldsPayload(direct);
    return {
      source: "customer_fields_api",
      is_fallback: false,
      generated_at: normalized.generatedAt ?? new Date().toISOString(),
      fields: normalized.fields,
    };
  }

  const aggregate = await fetchCustomerDashboardAggregate({ timeRange: "30d" });
  return {
    source: "dashboard_aggregate_fallback",
    is_fallback: true,
    generated_at: (aggregate as any).generated_at ?? new Date().toISOString(),
    fields: toFallbackFields(aggregate),
    data_scope_note: "当前展示近期/可见地块，非完整授权列表",
  };
}
