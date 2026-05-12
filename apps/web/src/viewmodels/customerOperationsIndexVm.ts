import type { CustomerOperationListItem, CustomerOperationsListResponse, CustomerOperationsDataScope } from "../api/customerOperations";
import { labelAcceptanceStatus, labelFinalStatus, labelOperationType } from "../lib/customerLabels";
import { getCustomerEmptyState } from "../lib/customerEmptyStates";
import { customerDisplayName, customerSemanticLabel } from "../lib/customerSemanticLabels";

export type CustomerOperationStatusFilter = "ALL" | "IN_PROGRESS" | "WAIT_ACCEPTANCE" | "ACCEPTANCE_PASS" | "ACCEPTANCE_FAIL" | "EVIDENCE_INSUFFICIENT";

export type CustomerOperationsIndexRowVm = { operationId: string; title: string; fieldName: string; operationTypeText: string; statusFilter: Exclude<CustomerOperationStatusFilter, "ALL">; statusText: string; acceptanceText: string; evidenceText: string; updatedAtText: string; href: string; };
export type CustomerOperationsIndexVm = { title: string; subtitle: string; generatedAtText: string; dataScope: CustomerOperationsDataScope; isFallback: boolean; isPreview: boolean; scopeBadgeText: string; dataScopeNote?: string; filters: Array<{ key: CustomerOperationStatusFilter; label: string; count: number }>; rows: CustomerOperationsIndexRowVm[]; emptyState: { title: string; description: string; severity: "neutral" | "info" | "warning" }; };

function toDateTimeText(raw: unknown): string { const text = String(raw ?? "").trim(); if (!text) return "暂无更新时间"; const ms = Date.parse(text); if (!Number.isFinite(ms) || ms <= 0) return "暂无更新时间"; const date = new Date(ms); if (date.getUTCFullYear() <= 1970) return "暂无更新时间"; return date.toLocaleString("zh-CN", { hour12: false }); }
function normalizeStatus(raw: unknown): string { return String(raw ?? "").trim().toUpperCase(); }

function mapStatusFilter(item: CustomerOperationListItem): Exclude<CustomerOperationStatusFilter, "ALL"> {
  const finalStatus = normalizeStatus(item.final_status);
  const acceptanceStatus = normalizeStatus(item.acceptance_status);
  const evidenceStatus = normalizeStatus(item.evidence_status ?? item.evidence_summary_status);
  if (["EVIDENCE_MISSING", "INSUFFICIENT_EVIDENCE", "NO_EVIDENCE"].includes(evidenceStatus) || finalStatus === "EVIDENCE_MISSING") return "EVIDENCE_INSUFFICIENT";
  if (["FAIL", "FAILED", "REJECTED"].includes(acceptanceStatus)) return "ACCEPTANCE_FAIL";
  if (["PASS", "SUCCESS", "SUCCEEDED", "APPROVED"].includes(acceptanceStatus)) return "ACCEPTANCE_PASS";
  if (["PENDING_ACCEPTANCE", "PENDING", "WAITING"].includes(acceptanceStatus) || finalStatus === "PENDING_ACCEPTANCE") return "WAIT_ACCEPTANCE";
  return "IN_PROGRESS";
}

function mapEvidenceText(item: CustomerOperationListItem, statusFilter: Exclude<CustomerOperationStatusFilter, "ALL">): string {
  const evidenceStatus = normalizeStatus(item.evidence_status ?? item.evidence_summary_status);
  const finalStatus = normalizeStatus(item.final_status);
  const acceptanceStatus = normalizeStatus(item.acceptance_status);
  if (["EVIDENCE_MISSING", "INSUFFICIENT_EVIDENCE", "NO_EVIDENCE"].includes(evidenceStatus) || finalStatus === "EVIDENCE_MISSING") return "证据不足，需补齐后复核";
  if (["AVAILABLE", "DONE", "PACK_SUMMARY", "COMPLETE", "COMPLETED"].includes(evidenceStatus)) return "证据已记录";
  if (statusFilter === "ACCEPTANCE_PASS" || ["PASS", "SUCCESS", "SUCCEEDED", "APPROVED"].includes(acceptanceStatus)) return "证据已支持验收";
  if (statusFilter === "ACCEPTANCE_FAIL") return "证据已记录，结果需复核";
  if (statusFilter === "WAIT_ACCEPTANCE") return "等待验收确认";
  return "证据待补充";
}

function mapStatusText(item: CustomerOperationListItem, statusFilter: Exclude<CustomerOperationStatusFilter, "ALL">): string {
  if (statusFilter === "ACCEPTANCE_PASS") return "验收通过";
  if (statusFilter === "ACCEPTANCE_FAIL") return "验收未通过";
  if (statusFilter === "EVIDENCE_INSUFFICIENT") return "证据不足";
  if (statusFilter === "WAIT_ACCEPTANCE") return "等待验收";
  return labelFinalStatus(item.final_status);
}

function buildRow(item: CustomerOperationListItem): CustomerOperationsIndexRowVm {
  const operationId = String(item.operation_id ?? item.operation_plan_id ?? "").trim();
  const statusFilter = mapStatusFilter(item);
  const operationTypeText = labelOperationType(item.operation_type);
  return {
    operationId,
    title: customerDisplayName(item.customer_title || item.title, `${operationTypeText}作业`),
    fieldName: customerDisplayName(item.field_name, "未命名地块"),
    operationTypeText,
    statusFilter,
    statusText: mapStatusText(item, statusFilter),
    acceptanceText: labelAcceptanceStatus(item.acceptance_status),
    evidenceText: mapEvidenceText(item, statusFilter),
    updatedAtText: toDateTimeText(item.updated_at ?? item.executed_at ?? item.generated_at),
    href: operationId ? `/customer/operations/${encodeURIComponent(operationId)}` : "/customer/operations",
  };
}

function scopeReasonText(raw: unknown): string | undefined {
  const text = String(raw ?? "").trim();
  if (!text) return undefined;
  return customerSemanticLabel(text, text);
}

function scopeCopy(response: CustomerOperationsListResponse): { subtitle: string; badge: string; note?: string; isPreview: boolean } {
  const mode = String(response.scope?.scope_mode ?? "").toUpperCase();
  if (mode === "INTERNAL_PREVIEW") return { subtitle: "当前展示可见经营范围内的作业。", badge: "经营范围预览", note: scopeReasonText(response.scope?.reason), isPreview: true };
  if (mode === "DENIED") return { subtitle: "暂无授权地块，因此暂无可见作业。", badge: "暂无授权地块", note: scopeReasonText(response.scope?.reason) || "当前账户未授权任何地块", isPreview: false };
  if (mode === "CLIENT_ALLOWLIST") return { subtitle: "查看授权范围内作业、验收进展与报告入口。", badge: `授权作业 ${response.operation_count ?? response.operations.length} 个`, isPreview: false };
  if (response.dataScope === "FALLBACK_RECENT_ONLY") return { subtitle: "当前展示近期可见作业，完整列表待同步。", badge: "近期作业", note: customerSemanticLabel(response.data_scope_note, "当前仅展示近期作业，非全部作业列表"), isPreview: true };
  if (response.dataScope === "ERROR_EMPTY") return { subtitle: "作业列表暂不可用，请稍后刷新。", badge: "暂不可用", note: customerSemanticLabel(response.data_scope_note, "作业列表暂不可用，请稍后刷新"), isPreview: true };
  return { subtitle: "查看授权范围内作业、验收进展与报告入口。", badge: "正式列表", isPreview: false };
}

export function filterCustomerOperations(rows: CustomerOperationsIndexRowVm[], status: CustomerOperationStatusFilter): CustomerOperationsIndexRowVm[] { if (status === "ALL") return rows; return rows.filter((row) => row.statusFilter === status); }

export function buildCustomerOperationsIndexVm(response: CustomerOperationsListResponse): CustomerOperationsIndexVm {
  const rows = (response.operations ?? []).map(buildRow).filter((row) => row.operationId);
  const countByStatus = (status: CustomerOperationStatusFilter) => status === "ALL" ? rows.length : rows.filter((row) => row.statusFilter === status).length;
  const scope = scopeCopy(response);
  return { title: "作业列表", subtitle: scope.subtitle, generatedAtText: toDateTimeText(response.generated_at), dataScope: response.dataScope, isFallback: response.dataScope !== "OFFICIAL_CUSTOMER_API", isPreview: scope.isPreview, scopeBadgeText: scope.badge, dataScopeNote: scope.note, filters: [{ key: "ALL", label: "全部", count: countByStatus("ALL") }, { key: "IN_PROGRESS", label: "执行中", count: countByStatus("IN_PROGRESS") }, { key: "WAIT_ACCEPTANCE", label: "待验收", count: countByStatus("WAIT_ACCEPTANCE") }, { key: "ACCEPTANCE_PASS", label: "验收通过", count: countByStatus("ACCEPTANCE_PASS") }, { key: "ACCEPTANCE_FAIL", label: "验收未通过", count: countByStatus("ACCEPTANCE_FAIL") }, { key: "EVIDENCE_INSUFFICIENT", label: "证据不足", count: countByStatus("EVIDENCE_INSUFFICIENT") }], rows, emptyState: response.scope?.scope_mode === "DENIED" ? getCustomerEmptyState("NO_AUTHORIZED_FIELDS") : getCustomerEmptyState("NO_RECENT_OPERATIONS") };
}
