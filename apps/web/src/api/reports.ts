import { apiRequest } from "./client";

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
};

export function mapReportCode(raw: unknown): { raw: string; label: string; tone: ReportCodeTone } {
  const key = String(raw ?? "").trim().toUpperCase();
  if (!key) return { raw: "UNKNOWN", label: "未知", tone: "neutral" };
  const hit = REPORT_CODE_MAP[key];
  if (hit) return { raw: key, ...hit };
  return { raw: key, label: key, tone: "neutral" };
}

export type OperationReport = {
  operation_id?: string;
  operation_plan_id?: string;
  field_id?: string;
  summary?: {
    title?: string;
    action_type?: string;
    final_status?: string;
    started_at?: string;
    finished_at?: string;
    operator?: string;
  };
  execution_result?: {
    final_status?: string;
    error_code?: string;
    reason_codes?: string[];
    output?: Record<string, unknown>;
  };
  acceptance?: {
    verdict?: string;
    accepted_by?: string;
    accepted_at?: string;
    notes?: string;
  };
  evidence?: {
    count?: number;
    completeness?: string;
    latest_at?: string;
    items?: Array<{ id?: string; type?: string; url?: string; label?: string }>;
  };
  cost?: {
    estimated?: number;
    actual?: number;
    currency?: string;
  };
  sla?: {
    target_minutes?: number;
    actual_minutes?: number;
    status?: string;
  };
  risk?: {
    level?: string;
    flags?: string[];
    advice?: string;
  };
};

export type FieldReport = {
  field_id?: string;
  field_name?: string;
  operation_reports?: OperationReport[];
  risk_summary?: {
    high?: number;
    medium?: number;
    low?: number;
    top_flags?: string[];
  };
  cost_summary?: {
    estimated_total?: number;
    actual_total?: number;
    currency?: string;
  };
};

export async function fetchOperationReport(operationId: string): Promise<OperationReport> {
  return apiRequest<OperationReport>(`/api/v1/reports/operation/${encodeURIComponent(operationId)}`);
}

export async function fetchFieldReport(fieldId: string): Promise<FieldReport> {
  return apiRequest<FieldReport>(`/api/v1/reports/field/${encodeURIComponent(fieldId)}`);
}
