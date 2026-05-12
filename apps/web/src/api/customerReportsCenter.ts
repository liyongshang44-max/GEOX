import { apiRequestWithPolicy, withQuery } from "./client";
import { fetchCustomerDashboardAggregate, type CustomerDashboardAggregateV1 } from "./customerReports";
import type { CustomerScopeV1 } from "./session";

export type CustomerReportsDataScope = "OFFICIAL_CUSTOMER_API" | "FALLBACK_RECENT_ONLY" | "ERROR_EMPTY";

export type CustomerReportCenterItem = {
  report_id?: string | null;
  report_type: "OVERVIEW" | "FIELD" | "OPERATION" | "EVIDENCE_VALUE" | string;
  title: string;
  subtitle?: string | null;
  href?: string | null;
  field_id?: string | null;
  field_name?: string | null;
  operation_id?: string | null;
  operation_title?: string | null;
  updated_at?: string | null;
  status_text?: string | null;
  capability_status?: "AVAILABLE" | "PENDING" | "UNAVAILABLE" | string | null;
};

export type CustomerReportsCenterResponse = {
  ok?: boolean;
  source: "customer_reports_api" | "dashboard_aggregate_fallback" | "empty_error_state";
  dataScope: CustomerReportsDataScope;
  is_fallback: boolean;
  generated_at?: string | null;
  scope?: CustomerScopeV1;
  report_count?: number;
  reports: CustomerReportCenterItem[];
  data_scope_note?: string;
};

type CustomerReportsApiEnvelope =
  | { ok?: boolean; reports?: CustomerReportCenterItem[]; generated_at?: string | null; scope?: CustomerScopeV1; report_count?: number; data?: unknown }
  | { ok?: boolean; customer_reports?: CustomerReportCenterItem[]; generated_at?: string | null; scope?: CustomerScopeV1; report_count?: number }
  | CustomerReportCenterItem[];

function normalizeReportsPayload(payload: unknown): { reports: CustomerReportCenterItem[]; generatedAt?: string | null; scope?: CustomerScopeV1; reportCount?: number } {
  if (Array.isArray(payload)) return { reports: payload };
  if (!payload || typeof payload !== "object") return { reports: [] };
  const obj = payload as Record<string, unknown>;
  if (Array.isArray(obj.reports)) return { reports: obj.reports as CustomerReportCenterItem[], generatedAt: obj.generated_at as string | null | undefined, scope: obj.scope as CustomerScopeV1 | undefined, reportCount: typeof obj.report_count === "number" ? obj.report_count : undefined };
  if (Array.isArray(obj.customer_reports)) return { reports: obj.customer_reports as CustomerReportCenterItem[], generatedAt: obj.generated_at as string | null | undefined, scope: obj.scope as CustomerScopeV1 | undefined, reportCount: typeof obj.report_count === "number" ? obj.report_count : undefined };
  if (obj.data) return normalizeReportsPayload(obj.data);
  return { reports: [] };
}

function toFallbackReports(aggregate: CustomerDashboardAggregateV1): CustomerReportCenterItem[] {
  const generatedAt = (aggregate as any).generated_at ?? new Date().toISOString();
  const reports: CustomerReportCenterItem[] = [{ report_type: "OVERVIEW", title: "经营总览报告", subtitle: "基于当前客户驾驶舱可见数据生成", href: "/customer/export", updated_at: generatedAt, status_text: "可导出", capability_status: "AVAILABLE" }];
  const fieldSeen = new Set<string>();
  for (const item of aggregate.top_risk_fields ?? []) {
    const fieldId = String((item as any).field_id ?? "").trim();
    if (!fieldId || fieldSeen.has(fieldId)) continue;
    fieldSeen.add(fieldId);
    reports.push({ report_type: "FIELD", title: `${String((item as any).field_name ?? "地块")} · 地块报告`, subtitle: "基于当前可见风险地块生成", href: `/customer/fields/${encodeURIComponent(fieldId)}`, field_id: fieldId, field_name: (item as any).field_name ?? null, updated_at: generatedAt, status_text: "可查看", capability_status: "AVAILABLE" });
  }
  const operationSeen = new Set<string>();
  for (const item of aggregate.recent_operations ?? []) {
    const operationId = String((item as any).operation_id ?? (item as any).operation_plan_id ?? "").trim();
    if (!operationId || operationSeen.has(operationId)) continue;
    operationSeen.add(operationId);
    const title = String((item as any).customer_title ?? (item as any).title ?? "作业");
    reports.push({ report_type: "OPERATION", title: `${title} · 作业报告`, subtitle: "基于当前近期作业生成", href: `/customer/operations/${encodeURIComponent(operationId)}`, operation_id: operationId, operation_title: title, field_id: String((item as any).field_id ?? "") || null, field_name: (item as any).field_name ?? null, updated_at: (item as any).updated_at ?? (item as any).executed_at ?? generatedAt, status_text: "可查看", capability_status: "AVAILABLE" });
  }
  reports.push({ report_type: "EVIDENCE_VALUE", title: "证据与价值报告", subtitle: "证据包生成能力待接入", href: null, updated_at: generatedAt, status_text: "待接入", capability_status: "PENDING" });
  return reports;
}

export async function fetchCustomerReportsCenter(): Promise<CustomerReportsCenterResponse> {
  try {
    const direct = await apiRequestWithPolicy<CustomerReportsApiEnvelope>(withQuery("/api/v1/customer/reports"), undefined, { allowedStatuses: [404, 405, 422], silent: true, timeoutMs: 10000 });
    if (direct.ok) {
      const normalized = normalizeReportsPayload(direct.data);
      return { source: "customer_reports_api", dataScope: "OFFICIAL_CUSTOMER_API", is_fallback: false, generated_at: normalized.generatedAt ?? new Date().toISOString(), scope: normalized.scope, report_count: normalized.reportCount ?? normalized.reports.length, reports: normalized.reports };
    }
    const aggregate = await fetchCustomerDashboardAggregate({ timeRange: "30d" });
    const reports = toFallbackReports(aggregate);
    return { source: "dashboard_aggregate_fallback", dataScope: "FALLBACK_RECENT_ONLY", is_fallback: true, generated_at: (aggregate as any).generated_at ?? new Date().toISOString(), report_count: reports.length, reports, data_scope_note: "当前仅展示驾驶舱与近期可见对象对应报告入口，非全部报告列表" };
  } catch {
    return { source: "empty_error_state", dataScope: "ERROR_EMPTY", is_fallback: true, generated_at: new Date().toISOString(), report_count: 0, reports: [], data_scope_note: "报告中心暂不可用，请稍后刷新" };
  }
}
