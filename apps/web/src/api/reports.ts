import { apiRequest, withQuery } from "./client";
import type {
  OperationReportSingleResponseV1,
  OperationReportV1,
} from "../../../server/src/projections/report_v1";
import type {
  CustomerDashboardAggregateV1 as CustomerDashboardAggregateV1Projection,
  FieldReportDetailV1 as FieldReportDetailV1Projection,
} from "../../../server/src/projections/report_dashboard_v1";

export type { OperationReportV1 };
export type CustomerDashboardAggregateV1 = CustomerDashboardAggregateV1Projection;
export type FieldReportDetailV1 = FieldReportDetailV1Projection;
// 历史上的 reports 前端聚合类型已废弃；dashboard 仅消费后端 aggregate v1。
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

type FieldReportDetailEnvelope = {
  ok: true;
  field_report_v1: FieldReportDetailV1;
};

function unwrapFieldReportDetail(payload: FieldReportDetailEnvelope | FieldReportDetailV1): FieldReportDetailV1 {
  if ("field_report_v1" in payload) return payload.field_report_v1;
  return payload;
}

type CustomerDashboardAggregateEnvelope = {
  ok: true;
  aggregate: CustomerDashboardAggregateV1;
};

export async function fetchOperationReport(operationId: string): Promise<OperationReportV1> {
  const res = await apiRequest<OperationReportSingleResponseV1 | OperationReportV1>(withQuery(`/api/v1/reports/operation/${encodeURIComponent(operationId)}`));
  return unwrapOperationReport(res);
}

export async function fetchFieldReport(fieldId: string): Promise<FieldReportDetailV1> {
  const res = await apiRequest<FieldReportDetailEnvelope | FieldReportDetailV1>(
    withQuery(`/api/v1/reports/field/${encodeURIComponent(fieldId)}`)
  );
  return unwrapFieldReportDetail(res);
}

export async function fetchCustomerDashboardAggregate(params: { fieldIds?: string[]; timeRange?: "7d" | "30d" | "season" } = {}): Promise<CustomerDashboardAggregateV1> {
  const fieldIds = Array.isArray(params.fieldIds) ? params.fieldIds.map((x) => String(x ?? "").trim()).filter(Boolean) : [];
  const query: Record<string, string | string[]> = {};
  if (fieldIds.length) query["field_ids[]"] = fieldIds;
  if (params.timeRange) query.time_range = params.timeRange;

  const res = await apiRequest<CustomerDashboardAggregateEnvelope>(withQuery("/api/v1/reports/customer-dashboard/aggregate", query));
  return res.aggregate;
}
