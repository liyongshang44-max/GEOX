import { apiRequest, withQuery } from "./client";

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

export type OperationReportV1 = {
  type: "operation_report_v1";
  version: "v1";
  generated_at: string;
  identifiers: {
    tenant_id: string;
    project_id: string;
    group_id: string;
    operation_plan_id: string;
    operation_id: string;
    recommendation_id: string | null;
    act_task_id: string | null;
    receipt_id: string | null;
  };
  execution: {
    final_status: string;
    invalid_execution: boolean;
    invalid_reason: string | null;
    dispatched_at: string | null;
    execution_started_at: string | null;
    execution_finished_at: string | null;
    response_time_ms: number | null;
  };
  acceptance: {
    status: "PASS" | "FAIL" | "PENDING" | "NOT_AVAILABLE";
    verdict: string | null;
    missing_evidence: boolean;
    missing_items: string[];
    generated_at: string | null;
  };
  evidence: {
    artifacts_count: number;
    logs_count: number;
    media_count: number;
    metrics_count: number;
    receipt_present: boolean;
    acceptance_present: boolean;
  };
  cost: {
    total: number;
    water: number;
    electric: number;
    chemical: number;
    estimated_total: number;
    estimated_water_cost: number;
    estimated_chemical_cost: number;
    estimated_device_cost: number;
    estimated_labor_cost: number;
    action_type: string | null;
    currency: "CNY";
  };
  sla: {
    dispatch_latency_quality: "VALID" | "MISSING_DATA" | "INVALID_ORDER";
    execution_duration_quality: "VALID" | "MISSING_DATA" | "INVALID_ORDER";
    acceptance_latency_quality: "VALID" | "MISSING_DATA" | "INVALID_ORDER";
    execution_success: boolean;
    acceptance_pass: boolean;
    response_time_ms: number | null;
    dispatch_latency_ms?: number;
    execution_duration_ms?: number;
    acceptance_latency_ms?: number;
    invalid_reasons: Array<
      | "dispatch_latency_missing_start"
      | "dispatch_latency_missing_end"
      | "dispatch_latency_negative_duration"
      | "execution_duration_missing_start"
      | "execution_duration_missing_end"
      | "execution_duration_negative_duration"
      | "acceptance_latency_missing_start"
      | "acceptance_latency_missing_end"
      | "acceptance_latency_negative_duration"
    >;
    pending_acceptance_elapsed_ms: number | null;
    pending_acceptance_over_30m: boolean;
  };
  risk: {
    level: "LOW" | "MEDIUM" | "HIGH";
    reasons: string[];
  };
};

type OperationReportEnvelope = {
  ok: true;
  operation_report_v1: OperationReportV1;
};

type FieldReportEnvelope = {
  ok: true;
  items: OperationReportV1[];
};

export async function fetchOperationReport(operationId: string): Promise<OperationReportV1> {
  const res = await apiRequest<OperationReportEnvelope>(withQuery(`/api/v1/reports/operation/${encodeURIComponent(operationId)}`));
  return res.operation_report_v1;
}

export async function fetchFieldReport(fieldId: string): Promise<OperationReportV1[]> {
  const res = await apiRequest<FieldReportEnvelope>(withQuery(`/api/v1/reports/field/${encodeURIComponent(fieldId)}`));
  return res.items;
}
