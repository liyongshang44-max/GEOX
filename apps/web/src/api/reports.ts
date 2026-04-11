import { apiRequest, withQuery } from "./client";
import type {
  OperationReportFieldListResponseV1,
  OperationReportSingleResponseV1,
  OperationReportV1,
} from "../../../server/src/projections/report_v1";

export type { OperationReportV1 };

export type ReportCodeTone = "success" | "warning" | "danger" | "info" | "neutral";

const REPORT_CODE_MAP: Record<string, { label: string; tone: ReportCodeTone }> = {
  PENDING_ACCEPTANCE: { label: "待验收", tone: "warning" },
  INVALID_EXECUTION: { label: "执行无效", tone: "danger" },
  SUCCESS: { label: "已完成", tone: "success" },
  SUCCEEDED: { label: "已完成", tone: "success" },
  FAILED: { label: "执行失败", tone: "danger" },
  ERROR: { label: "错误", tone: "danger" },
  EVIDENCE_MISSING: { label: "证据缺失", tone: "warning" },
  NOT_EXECUTED: { label: "未执行", tone: "neutral" },
  RUNNING: { label: "执行中", tone: "info" },
  PENDING: { label: "待处理", tone: "warning" },
  PASS: { label: "通过", tone: "success" },
  FAIL: { label: "未通过", tone: "danger" },
  NOT_AVAILABLE: { label: "不可用", tone: "neutral" },
  LOW: { label: "低", tone: "success" },
  MEDIUM: { label: "中", tone: "warning" },
  HIGH: { label: "高", tone: "danger" },
};

export function mapReportCode(raw: unknown): { raw: string; label: string; tone: ReportCodeTone } {
  const key = String(raw ?? "").trim().toUpperCase();
  if (!key) return { raw: "UNKNOWN", label: "未知", tone: "neutral" };
  const hit = REPORT_CODE_MAP[key];
  if (hit) return { raw: key, ...hit };
  return { raw: key, label: key, tone: "neutral" };
}

function unwrapOperationReport(payload: OperationReportSingleResponseV1 | OperationReportV1): OperationReportV1 {
  if ("operation_report_v1" in payload) return payload.operation_report_v1;
  return payload;
}

function unwrapFieldReports(payload: OperationReportFieldListResponseV1 | OperationReportV1[]): OperationReportV1[] {
  if (Array.isArray(payload)) return payload;
  return payload.items;
}

type CustomerDashboardAggregateEnvelope = {
  ok: true;
  aggregate: CustomerDashboardAggregate;
};

export type CustomerDashboardAggregate = {
  generatedAt: string;
  totals: {
    total: number;
    completed: number;
    incomplete: number;
  };
  recentExecutions: Array<{
    operationId: string;
    title: string;
    statusCode: string;
    finishedAt: string | null;
  }>;
  risk: {
    high: number;
    medium: number;
    low: number;
    topSignals: string[];
  };
  cost: {
    currentTotal: number;
    baselineTotal: number | null;
    trend: "UP" | "DOWN" | "FLAT" | "NO_DATA";
    currency: "CNY";
  };
};

function normalizeStatus(status: string): string {
  return String(status ?? "").trim().toUpperCase();
}

function pushReason(counter: Record<string, number>, key: string): void {
  counter[key] = Number(counter[key] ?? 0) + 1;
}

export function aggregateCustomerDashboardReports(items: OperationReportV1[]): CustomerDashboardAggregate {
  const reports = Array.isArray(items) ? items : [];
  const sorted = reports
    .slice()
    .sort((a, b) => Date.parse(String(b.execution?.execution_finished_at ?? b.generated_at ?? "0")) - Date.parse(String(a.execution?.execution_finished_at ?? a.generated_at ?? "0")));

  const completed = reports.filter((x) => ["SUCCESS", "SUCCEEDED"].includes(normalizeStatus(x.execution?.final_status ?? ""))).length;
  const reasonCounter: Record<string, number> = {};

  reports.forEach((item) => {
    if (item.acceptance?.missing_evidence) pushReason(reasonCounter, "missing_evidence");
    if (item.sla?.pending_acceptance_over_30m) pushReason(reasonCounter, "acceptance_timeout");
    if (["FAILED", "ERROR"].includes(normalizeStatus(item.execution?.final_status ?? ""))) pushReason(reasonCounter, "execution_failure");
    if (item.execution?.invalid_execution) pushReason(reasonCounter, "invalid_execution");
  });

  const totals = {
    total: reports.length,
    completed,
    incomplete: Math.max(0, reports.length - completed),
  };

  const mid = reports.length > 1 ? Math.floor(reports.length / 2) : 0;
  const currentSlice = mid > 0 ? sorted.slice(0, mid) : sorted;
  const baselineSlice = mid > 0 ? sorted.slice(mid) : [];
  const currentTotal = currentSlice.reduce((sum, item) => sum + Number(item.cost?.actual_total ?? item.cost?.estimated_total ?? 0), 0);
  const baselineTotal = baselineSlice.length
    ? baselineSlice.reduce((sum, item) => sum + Number(item.cost?.actual_total ?? item.cost?.estimated_total ?? 0), 0)
    : null;
  const trend = baselineTotal == null
    ? "NO_DATA"
    : currentTotal > baselineTotal
      ? "UP"
      : currentTotal < baselineTotal
        ? "DOWN"
        : "FLAT";

  return {
    generatedAt: new Date().toISOString(),
    totals,
    recentExecutions: sorted.slice(0, 5).map((item) => ({
      operationId: String(item.identifiers?.operation_id ?? item.identifiers?.operation_plan_id ?? ""),
      title: String(item.identifiers?.operation_plan_id ?? item.identifiers?.operation_id ?? "作业"),
      statusCode: String(item.execution?.final_status ?? "UNKNOWN"),
      finishedAt: item.execution?.execution_finished_at ?? null,
    })),
    risk: {
      high: reports.filter((x) => normalizeStatus(x.risk?.level ?? "") === "HIGH").length,
      medium: reports.filter((x) => normalizeStatus(x.risk?.level ?? "") === "MEDIUM").length,
      low: reports.filter((x) => normalizeStatus(x.risk?.level ?? "") === "LOW").length,
      topSignals: Object.entries(reasonCounter)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([key]) => key),
    },
    cost: {
      currentTotal,
      baselineTotal,
      trend,
      currency: "CNY",
    },
  };
}

export async function fetchOperationReport(operationId: string): Promise<OperationReportV1> {
  const res = await apiRequest<OperationReportSingleResponseV1 | OperationReportV1>(withQuery(`/api/v1/reports/operation/${encodeURIComponent(operationId)}`));
  return unwrapOperationReport(res);
}

export async function fetchFieldReport(fieldId: string): Promise<OperationReportV1[]> {
  const res = await apiRequest<OperationReportFieldListResponseV1 | OperationReportV1[]>(withQuery(`/api/v1/reports/field/${encodeURIComponent(fieldId)}`));
  return unwrapFieldReports(res);
}

export async function fetchCustomerDashboardAggregate(params: { fieldId?: string; limit?: number } = {}): Promise<CustomerDashboardAggregate> {
  const fieldId = String(params.fieldId ?? "").trim();
  if (fieldId) {
    const reports = await fetchFieldReport(fieldId);
    const aggregate = aggregateCustomerDashboardReports(reports);
    if (Number.isFinite(params.limit) && (params.limit ?? 0) > 0) {
      aggregate.recentExecutions = aggregate.recentExecutions.slice(0, Number(params.limit));
    }
    return aggregate;
  }

  const res = await apiRequest<CustomerDashboardAggregateEnvelope>(withQuery("/api/v1/reports/customer-dashboard/aggregate"));
  return res.aggregate;
}
