import { apiRequestWithPolicy, withQuery } from "./client";
import { fetchCustomerDashboardAggregate, type CustomerDashboardAggregateV1 } from "./customerReports";

export type CustomerOperationsDataScope = "OFFICIAL_CUSTOMER_API" | "FALLBACK_RECENT_ONLY" | "ERROR_EMPTY";

export type CustomerOperationListItem = {
  operation_id?: string | null;
  operation_plan_id?: string | null;
  field_id?: string | null;
  field_name?: string | null;
  title?: string | null;
  customer_title?: string | null;
  operation_type?: string | null;
  final_status?: string | null;
  acceptance_status?: string | null;
  evidence_status?: string | null;
  evidence_summary_status?: string | null;
  generated_at?: string | null;
  updated_at?: string | null;
  executed_at?: string | null;
};

export type CustomerOperationsListResponse = {
  ok?: boolean;
  source: "customer_operations_api" | "dashboard_aggregate_fallback" | "empty_error_state";
  dataScope: CustomerOperationsDataScope;
  is_fallback: boolean;
  generated_at?: string | null;
  operations: CustomerOperationListItem[];
  data_scope_note?: string;
};

type CustomerOperationsApiEnvelope =
  | { ok?: boolean; operations?: CustomerOperationListItem[]; generated_at?: string | null; data?: unknown }
  | { ok?: boolean; customer_operations?: CustomerOperationListItem[]; generated_at?: string | null }
  | CustomerOperationListItem[];

function normalizeOperationsPayload(payload: unknown): { operations: CustomerOperationListItem[]; generatedAt?: string | null } {
  if (Array.isArray(payload)) return { operations: payload };
  if (!payload || typeof payload !== "object") return { operations: [] };
  const obj = payload as Record<string, unknown>;
  if (Array.isArray(obj.operations)) return { operations: obj.operations as CustomerOperationListItem[], generatedAt: obj.generated_at as string | null | undefined };
  if (Array.isArray(obj.customer_operations)) return { operations: obj.customer_operations as CustomerOperationListItem[], generatedAt: obj.generated_at as string | null | undefined };
  if (obj.data) return normalizeOperationsPayload(obj.data);
  return { operations: [] };
}

function toFallbackOperations(aggregate: CustomerDashboardAggregateV1): CustomerOperationListItem[] {
  const seen = new Set<string>();
  const rows: CustomerOperationListItem[] = [];

  for (const item of aggregate.recent_operations ?? []) {
    const operationId = String((item as any).operation_id ?? (item as any).operation_plan_id ?? "").trim();
    if (!operationId || seen.has(operationId)) continue;
    seen.add(operationId);
    rows.push({
      operation_id: String((item as any).operation_id ?? "") || null,
      operation_plan_id: String((item as any).operation_plan_id ?? operationId) || null,
      field_id: String((item as any).field_id ?? "") || null,
      field_name: (item as any).field_name ?? null,
      title: (item as any).title ?? null,
      customer_title: (item as any).customer_title ?? null,
      operation_type: (item as any).operation_type ?? null,
      final_status: (item as any).final_status ?? null,
      acceptance_status: (item as any).acceptance_status ?? null,
      evidence_status: (item as any).evidence_status ?? null,
      evidence_summary_status: (item as any).evidence_summary_status ?? null,
      generated_at: (item as any).generated_at ?? null,
      updated_at: (item as any).updated_at ?? (item as any).executed_at ?? (item as any).generated_at ?? null,
      executed_at: (item as any).executed_at ?? null,
    });
  }

  return rows;
}

export async function fetchCustomerOperations(): Promise<CustomerOperationsListResponse> {
  try {
    const direct = await apiRequestWithPolicy<CustomerOperationsApiEnvelope>(
      withQuery("/api/v1/customer/operations"),
      undefined,
      { allowedStatuses: [404, 405, 422], silent: true, timeoutMs: 10000 }
    );

    if (direct.ok) {
      const normalized = normalizeOperationsPayload(direct.data);
      return {
        source: "customer_operations_api",
        dataScope: "OFFICIAL_CUSTOMER_API",
        is_fallback: false,
        generated_at: normalized.generatedAt ?? new Date().toISOString(),
        operations: normalized.operations,
      };
    }

    const aggregate = await fetchCustomerDashboardAggregate({ timeRange: "30d" });
    return {
      source: "dashboard_aggregate_fallback",
      dataScope: "FALLBACK_RECENT_ONLY",
      is_fallback: true,
      generated_at: (aggregate as any).generated_at ?? new Date().toISOString(),
      operations: toFallbackOperations(aggregate),
      data_scope_note: "当前仅展示近期作业，非全部作业列表",
    };
  } catch {
    return {
      source: "empty_error_state",
      dataScope: "ERROR_EMPTY",
      is_fallback: true,
      generated_at: new Date().toISOString(),
      operations: [],
      data_scope_note: "作业列表暂不可用，请稍后刷新",
    };
  }
}
