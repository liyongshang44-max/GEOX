import type { CustomerOperationListItem, CustomerOperationsListResponse } from "../api/customerOperations";
import { labelAcceptanceStatus, labelFinalStatus, labelOperationType, sanitizeCustomerText } from "../lib/customerLabels";
import { getCustomerEmptyState } from "../lib/customerEmptyStates";

export type CustomerOperationStatusFilter = "ALL" | "IN_PROGRESS" | "WAIT_ACCEPTANCE" | "ACCEPTANCE_PASS" | "ACCEPTANCE_FAIL" | "EVIDENCE_MISSING";

export type CustomerOperationsIndexRowVm = {
  operationId: string;
  title: string;
  fieldName: string;
  operationTypeText: string;
  statusFilter: Exclude<CustomerOperationStatusFilter, "ALL">;
  statusText: string;
  acceptanceText: string;
  evidenceText: string;
  updatedAtText: string;
  href: string;
};

export type CustomerOperationsIndexVm = {
  title: string;
  subtitle: string;
  generatedAtText: string;
  isFallback: boolean;
  dataScopeNote?: string;
  filters: Array<{ key: CustomerOperationStatusFilter; label: string; count: number }>;
  rows: CustomerOperationsIndexRowVm[];
  emptyState: { title: string; description: string; severity: "neutral" | "info" | "warning" };
};

function toDateTimeText(raw: unknown): string {
  const text = String(raw ?? "").trim();
  if (!text) return "暂无更新时间";
  const ms = Date.parse(text);
  if (!Number.isFinite(ms) || ms <= 0) return "暂无更新时间";
  const date = new Date(ms);
  if (date.getUTCFullYear() <= 1970) return "暂无更新时间";
  return date.toLocaleString("zh-CN", { hour12: false });
}

function normalizeStatus(raw: unknown): string {
  return String(raw ?? "").trim().toUpperCase();
}

function mapStatusFilter(item: CustomerOperationListItem): Exclude<CustomerOperationStatusFilter, "ALL"> {
  const finalStatus = normalizeStatus(item.final_status);
  const acceptanceStatus = normalizeStatus(item.acceptance_status);
  const evidenceStatus = normalizeStatus(item.evidence_status ?? item.evidence_summary_status);

  if (["EVIDENCE_MISSING", "INSUFFICIENT_EVIDENCE", "NO_EVIDENCE"].includes(evidenceStatus) || finalStatus === "EVIDENCE_MISSING") return "EVIDENCE_MISSING";
  if (["FAIL", "FAILED", "REJECTED"].includes(acceptanceStatus)) return "ACCEPTANCE_FAIL";
  if (["PASS", "SUCCESS", "SUCCEEDED", "APPROVED"].includes(acceptanceStatus)) return "ACCEPTANCE_PASS";
  if (["PENDING_ACCEPTANCE", "PENDING", "WAITING"].includes(acceptanceStatus) || finalStatus === "PENDING_ACCEPTANCE") return "WAIT_ACCEPTANCE";
  return "IN_PROGRESS";
}

function mapEvidenceText(item: CustomerOperationListItem): string {
  const evidenceStatus = normalizeStatus(item.evidence_status ?? item.evidence_summary_status);
  const finalStatus = normalizeStatus(item.final_status);
  if (["EVIDENCE_MISSING", "INSUFFICIENT_EVIDENCE", "NO_EVIDENCE"].includes(evidenceStatus) || finalStatus === "EVIDENCE_MISSING") return "证据不足";
  if (["AVAILABLE", "DONE", "PACK_SUMMARY"].includes(evidenceStatus)) return "证据已记录";
  return "证据状态待确认";
}

function buildRow(item: CustomerOperationListItem): CustomerOperationsIndexRowVm {
  const operationId = String(item.operation_id ?? item.operation_plan_id ?? "").trim();
  const statusFilter = mapStatusFilter(item);
  return {
    operationId,
    title: sanitizeCustomerText(item.customer_title || item.title || labelOperationType(item.operation_type), "未命名作业"),
    fieldName: sanitizeCustomerText(item.field_name, "地块名称待补充"),
    operationTypeText: labelOperationType(item.operation_type),
    statusFilter,
    statusText: labelFinalStatus(item.final_status),
    acceptanceText: labelAcceptanceStatus(item.acceptance_status),
    evidenceText: mapEvidenceText(item),
    updatedAtText: toDateTimeText(item.updated_at ?? item.executed_at ?? item.generated_at),
    href: operationId ? `/customer/operations/${encodeURIComponent(operationId)}` : "/customer/operations",
  };
}

export function filterCustomerOperations(rows: CustomerOperationsIndexRowVm[], status: CustomerOperationStatusFilter): CustomerOperationsIndexRowVm[] {
  if (status === "ALL") return rows;
  return rows.filter((row) => row.statusFilter === status);
}

export function buildCustomerOperationsIndexVm(response: CustomerOperationsListResponse): CustomerOperationsIndexVm {
  const rows = (response.operations ?? []).map(buildRow).filter((row) => row.operationId);
  const countByStatus = (status: CustomerOperationStatusFilter) => status === "ALL" ? rows.length : rows.filter((row) => row.statusFilter === status).length;

  return {
    title: "作业列表",
    subtitle: response.is_fallback ? "P1-A Preview：当前仅展示近期作业，非全部作业列表。" : "查看授权范围内作业、验收进展与报告入口。",
    generatedAtText: toDateTimeText(response.generated_at),
    isFallback: response.is_fallback,
    dataScopeNote: response.data_scope_note,
    filters: [
      { key: "ALL", label: "全部", count: countByStatus("ALL") },
      { key: "IN_PROGRESS", label: "执行中", count: countByStatus("IN_PROGRESS") },
      { key: "WAIT_ACCEPTANCE", label: "待验收", count: countByStatus("WAIT_ACCEPTANCE") },
      { key: "ACCEPTANCE_PASS", label: "验收通过", count: countByStatus("ACCEPTANCE_PASS") },
      { key: "ACCEPTANCE_FAIL", label: "验收失败", count: countByStatus("ACCEPTANCE_FAIL") },
      { key: "EVIDENCE_MISSING", label: "证据不足", count: countByStatus("EVIDENCE_MISSING") },
    ],
    rows,
    emptyState: getCustomerEmptyState("NO_RECENT_OPERATIONS"),
  };
}
