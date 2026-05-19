import type { CustomerOperationListItem, CustomerOperationsListResponse, CustomerOperationsDataScope } from "../api/customerOperations";
import { labelOperationType } from "../lib/customerLabels";
import { getCustomerEmptyState } from "../lib/customerEmptyStates";
import { formatCustomerDate } from "../lib/customerSafeText";
import { customerDisplayName, customerSemanticLabel } from "../lib/customerSemanticLabels";
import { labelCustomerAcceptanceVerdict, labelCustomerEvidenceStatus, labelCustomerOperationFinalStatus } from "../lib/customerStatusLabels";

export type CustomerOperationStatusFilter = "ALL" | "IN_PROGRESS" | "WAIT_ACCEPTANCE" | "ACCEPTANCE_PASS" | "ACCEPTANCE_FAIL" | "EVIDENCE_INSUFFICIENT";

export type CustomerOperationsIndexRowVm = {
  operationId: string;
  title: string;
  fieldName: string;
  operationTypeText: string;
  primaryLine: string;
  statusFilter: Exclude<CustomerOperationStatusFilter, "ALL">;
  finalStatusText: string;
  acceptanceText: string;
  evidenceText: string;
  statusLine: string;
  evidenceExplanation?: string;
  completedAtText: string;
  updatedAtText: string;
  href: string;
};

export type CustomerOperationsIndexVm = {
  title: string;
  subtitle: string;
  generatedAtText: string;
  dataScope: CustomerOperationsDataScope;
  isFallback: boolean;
  isPreview: boolean;
  scopeBadgeText: string;
  dataScopeNote?: string;
  filters: Array<{ key: CustomerOperationStatusFilter; label: string; count: number }>;
  rows: CustomerOperationsIndexRowVm[];
  emptyState: { title: string; description: string; severity: "neutral" | "info" | "warning" };
};

function toDateTimeText(raw: unknown): string {
  return formatCustomerDate(raw);
}

function normalizeStatus(raw: unknown): string {
  return String(raw ?? "").trim().replace(/[\s/-]+/g, "_").toUpperCase();
}

function isAcceptancePass(raw: unknown): boolean {
  return ["PASS", "SUCCESS", "SUCCEEDED", "APPROVED"].includes(normalizeStatus(raw));
}

function isAcceptanceFail(raw: unknown): boolean {
  return ["FAIL", "FAILED", "REJECTED"].includes(normalizeStatus(raw));
}

function isWaitingAcceptance(item: CustomerOperationListItem): boolean {
  const acceptanceStatus = normalizeStatus(item.acceptance_status);
  const finalStatus = normalizeStatus(item.final_status);
  return ["PENDING_ACCEPTANCE", "PENDING_ACCEPTANCE_OVER_30M", "PENDING", "WAITING"].includes(acceptanceStatus) || ["PENDING_ACCEPTANCE", "PENDING_ACCEPTANCE_OVER_30M"].includes(finalStatus);
}

function isEvidenceInsufficient(item: CustomerOperationListItem): boolean {
  const evidenceStatus = normalizeStatus(item.evidence_status ?? item.evidence_summary_status);
  const finalStatus = normalizeStatus(item.final_status);
  return ["EVIDENCE_MISSING", "INSUFFICIENT_EVIDENCE", "NO_EVIDENCE", "MISSING"].includes(evidenceStatus) || finalStatus === "EVIDENCE_MISSING";
}

function isEvidenceComplete(raw: unknown): boolean {
  return ["COMPLETE", "COMPLETED", "AVAILABLE", "DONE", "PACK_SUMMARY", "RECORDS_WITHOUT_SUMMARY"].includes(normalizeStatus(raw));
}

function mapStatusFilter(item: CustomerOperationListItem): Exclude<CustomerOperationStatusFilter, "ALL"> {
  if (isEvidenceInsufficient(item) && !isAcceptancePass(item.acceptance_status)) return "EVIDENCE_INSUFFICIENT";
  if (isAcceptanceFail(item.acceptance_status)) return "ACCEPTANCE_FAIL";
  if (isAcceptancePass(item.acceptance_status)) return "ACCEPTANCE_PASS";
  if (isWaitingAcceptance(item)) return "WAIT_ACCEPTANCE";
  return "IN_PROGRESS";
}

function finalStatusText(item: CustomerOperationListItem): string {
  const finalStatus = normalizeStatus(item.final_status);
  if (isAcceptancePass(item.acceptance_status) || ["SUCCESS", "SUCCEEDED", "COMPLETED", "DONE", "VALID", "COMPLETE"].includes(finalStatus)) return "已完成";
  if (isWaitingAcceptance(item)) return "已完成";
  return labelCustomerOperationFinalStatus(item.final_status);
}

function acceptanceText(item: CustomerOperationListItem): string {
  if (isWaitingAcceptance(item)) return "待验收";
  return labelCustomerAcceptanceVerdict(item.acceptance_status);
}

function evidenceCopy(item: CustomerOperationListItem): { text: string; explanation?: string } {
  const rawEvidence = item.evidence_status ?? item.evidence_summary_status;
  if (isEvidenceInsufficient(item) && !isAcceptancePass(item.acceptance_status)) return { text: "等待补充证据" };
  if (isEvidenceComplete(rawEvidence)) return { text: "证据完整" };
  if (isAcceptancePass(item.acceptance_status)) {
    return { text: "证据已支持验收", explanation: "列表未收到完整证据包状态时，以作业报告验收结论为准；详情页可查看证据摘要。" };
  }
  if (isWaitingAcceptance(item)) return { text: "等待验收确认" };
  return { text: labelCustomerEvidenceStatus(rawEvidence) };
}

function buildTitle(operationTypeText: string, item: CustomerOperationListItem): string {
  return operationDisplayTitle(operationTypeText, item);
}

function operationDisplayTitle(operationTypeText: string, item: CustomerOperationListItem): string {
  const raw = String(item.customer_title || item.title || "").trim();
  const normalized = raw.toUpperCase();

  if (normalized === "PEST_DISEASE_INSPECTION" || normalized.includes("PEST_DISEASE_INSPECTION")) {
    return "病虫害巡检";
  }

  return customerDisplayName(raw, `${operationTypeText}作业`);
}

function isPestDiseaseInspectionOperation(item: CustomerOperationListItem): boolean {
  const anyItem = item as any;
  const scenario = normalizeStatus(anyItem.formal_scenario?.scenario_type ?? anyItem.scenario_type);
  const operationType = normalizeStatus(anyItem.operation_type ?? anyItem.prescription?.operation_type ?? anyItem.customer_title ?? anyItem.title);
  return scenario === "FORMAL_PEST_DISEASE_INSPECTION"
    || Boolean(anyItem.pest_disease_inspection)
    || operationType.includes("PEST_DISEASE_INSPECTION");
}

function buildFieldName(item: CustomerOperationListItem): string {
  return customerDisplayName(item.field_name, "未命名地块");
}

function buildRow(item: CustomerOperationListItem): CustomerOperationsIndexRowVm {
  const operationId = String(item.operation_id ?? item.operation_plan_id ?? "").trim();
  const statusFilter = mapStatusFilter(item);
  const operationTypeText = isPestDiseaseInspectionOperation(item) ? "病虫害巡检" : labelOperationType(item.operation_type);
  const title = buildTitle(operationTypeText, item);
  const fieldName = buildFieldName(item);
  const finalText = finalStatusText(item);
  const acceptedText = acceptanceText(item);
  const evidence = evidenceCopy(item);
  const completedAtText = toDateTimeText(item.executed_at ?? item.updated_at ?? item.generated_at);
  return {
    operationId,
    title,
    fieldName,
    operationTypeText,
    primaryLine: `${title} / ${fieldName}`,
    statusFilter,
    finalStatusText: finalText,
    acceptanceText: acceptedText,
    evidenceText: evidence.text,
    statusLine: `${finalText} · ${acceptedText} · ${evidence.text}`,
    evidenceExplanation: evidence.explanation,
    completedAtText,
    updatedAtText: completedAtText,
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

export function filterCustomerOperations(rows: CustomerOperationsIndexRowVm[], status: CustomerOperationStatusFilter): CustomerOperationsIndexRowVm[] {
  if (status === "ALL") return rows;
  return rows.filter((row) => row.statusFilter === status);
}

export function buildCustomerOperationsIndexVm(response: CustomerOperationsListResponse): CustomerOperationsIndexVm {
  const rows = (response.operations ?? []).map(buildRow).filter((row) => row.operationId);
  const countByStatus = (status: CustomerOperationStatusFilter) => status === "ALL" ? rows.length : rows.filter((row) => row.statusFilter === status).length;
  const scope = scopeCopy(response);
  return {
    title: "作业列表",
    subtitle: scope.subtitle,
    generatedAtText: toDateTimeText(response.generated_at),
    dataScope: response.dataScope,
    isFallback: response.dataScope !== "OFFICIAL_CUSTOMER_API",
    isPreview: scope.isPreview,
    scopeBadgeText: scope.badge,
    dataScopeNote: scope.note,
    filters: [
      { key: "ALL", label: "全部", count: countByStatus("ALL") },
      { key: "IN_PROGRESS", label: "执行中", count: countByStatus("IN_PROGRESS") },
      { key: "WAIT_ACCEPTANCE", label: "待验收", count: countByStatus("WAIT_ACCEPTANCE") },
      { key: "ACCEPTANCE_PASS", label: "验收通过", count: countByStatus("ACCEPTANCE_PASS") },
      { key: "ACCEPTANCE_FAIL", label: "验收未通过", count: countByStatus("ACCEPTANCE_FAIL") },
      { key: "EVIDENCE_INSUFFICIENT", label: "证据不足", count: countByStatus("EVIDENCE_INSUFFICIENT") },
    ],
    rows,
    emptyState: response.scope?.scope_mode === "DENIED" ? getCustomerEmptyState("NO_AUTHORIZED_FIELDS") : getCustomerEmptyState("NO_RECENT_OPERATIONS"),
  };
}
