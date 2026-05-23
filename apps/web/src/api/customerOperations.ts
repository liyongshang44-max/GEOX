import { apiRequestWithPolicy, withQuery } from "./client";
import { fetchCustomerDashboardAggregate, type CustomerDashboardAggregateV1 } from "./customerReports";
import type { CustomerScopeV1 } from "./session";

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
  projection_source?: "GUARDED_REPORT" | "STATE_FALLBACK_LIMITED" | string | null;
  fallback_limited?: boolean | null;
  customer_visible_eligible?: boolean | null;
  blocking_reasons?: string[] | null;
  data_trust_status?: "FORMAL" | "LIMITED" | string | null;
  chain_status?: string | null;
  trust_level?: string | null;
  needs_review?: boolean | null;
  is_simulated?: boolean | null;
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
  scope?: CustomerScopeV1;
  operation_count?: number;
  operations: CustomerOperationListItem[];
  data_scope_note?: string;
};

type CustomerOperationsApiEnvelope =
  | { ok?: boolean; operations?: CustomerOperationListItem[]; generated_at?: string | null; scope?: CustomerScopeV1; operation_count?: number; data?: unknown }
  | { ok?: boolean; customer_operations?: CustomerOperationListItem[]; generated_at?: string | null; scope?: CustomerScopeV1; operation_count?: number }
  | CustomerOperationListItem[];

function normalizeOperationsPayload(payload: unknown): { operations: CustomerOperationListItem[]; generatedAt?: string | null; scope?: CustomerScopeV1; operationCount?: number } {
  if (Array.isArray(payload)) return { operations: payload };
  if (!payload || typeof payload !== "object") return { operations: [] };
  const obj = payload as Record<string, unknown>;
  if (Array.isArray(obj.operations)) return { operations: obj.operations as CustomerOperationListItem[], generatedAt: obj.generated_at as string | null | undefined, scope: obj.scope as CustomerScopeV1 | undefined, operationCount: typeof obj.operation_count === "number" ? obj.operation_count : undefined };
  if (Array.isArray(obj.customer_operations)) return { operations: obj.customer_operations as CustomerOperationListItem[], generatedAt: obj.generated_at as string | null | undefined, scope: obj.scope as CustomerScopeV1 | undefined, operationCount: typeof obj.operation_count === "number" ? obj.operation_count : undefined };
  if (obj.data) return normalizeOperationsPayload(obj.data);
  return { operations: [] };
}

function toFallbackOperations(aggregate: CustomerDashboardAggregateV1): CustomerOperationListItem[] {
  const seen = new Set<string>();
  const rows: CustomerOperationListItem[] = [];
  for (const item of aggregate.recent_operations ?? []) {
    const anyItem = item as any;
    const operationId = String(anyItem.operation_id ?? anyItem.operation_plan_id ?? "").trim();
    if (!operationId || seen.has(operationId)) continue;
    seen.add(operationId);
    rows.push({
      operation_id: String(anyItem.operation_id ?? "") || null,
      operation_plan_id: String(anyItem.operation_plan_id ?? operationId) || null,
      field_id: String(anyItem.field_id ?? "") || null,
      field_name: anyItem.field_name ?? null,
      title: anyItem.title ?? null,
      customer_title: anyItem.customer_title ?? null,
      operation_type: anyItem.operation_type ?? null,
      final_status: anyItem.final_status ?? null,
      acceptance_status: anyItem.acceptance_status ?? null,
      evidence_status: anyItem.evidence_status ?? null,
      evidence_summary_status: anyItem.evidence_summary_status ?? null,
      projection_source: anyItem.projection_source ?? null,
      fallback_limited: anyItem.fallback_limited ?? null,
      customer_visible_eligible: anyItem.customer_visible_eligible ?? null,
      blocking_reasons: Array.isArray(anyItem.blocking_reasons) ? anyItem.blocking_reasons : null,
      data_trust_status: anyItem.data_trust_status ?? null,
      chain_status: anyItem.chain_status ?? anyItem.formal_chain_status ?? null,
      trust_level: anyItem.trust_level ?? null,
      needs_review: anyItem.needs_review ?? null,
      is_simulated: anyItem.is_simulated ?? null,
      generated_at: anyItem.generated_at ?? null,
      updated_at: anyItem.updated_at ?? anyItem.executed_at ?? anyItem.generated_at ?? null,
      executed_at: anyItem.executed_at ?? null,
    });
  }
  return rows;
}

export async function fetchCustomerOperations(): Promise<CustomerOperationsListResponse> {
  try {
    const direct = await apiRequestWithPolicy<CustomerOperationsApiEnvelope>(withQuery("/api/v1/customer/operations"), undefined, { allowedStatuses: [404, 405, 422], silent: true, timeoutMs: 10000 });
    if (direct.ok) {
      const normalized = normalizeOperationsPayload(direct.data);
      return { source: "customer_operations_api", dataScope: "OFFICIAL_CUSTOMER_API", is_fallback: false, generated_at: normalized.generatedAt ?? new Date().toISOString(), scope: normalized.scope, operation_count: normalized.operationCount ?? normalized.operations.length, operations: normalized.operations };
    }
    const aggregate = await fetchCustomerDashboardAggregate({ timeRange: "30d" });
    const operations = toFallbackOperations(aggregate);
    return { source: "dashboard_aggregate_fallback", dataScope: "FALLBACK_RECENT_ONLY", is_fallback: true, generated_at: (aggregate as any).generated_at ?? new Date().toISOString(), operation_count: operations.length, operations, data_scope_note: "当前仅展示近期作业，非全部作业列表" };
  } catch {
    return { source: "empty_error_state", dataScope: "ERROR_EMPTY", is_fallback: true, generated_at: new Date().toISOString(), operation_count: 0, operations: [], data_scope_note: "作业列表暂不可用，请稍后刷新" };
  }
}