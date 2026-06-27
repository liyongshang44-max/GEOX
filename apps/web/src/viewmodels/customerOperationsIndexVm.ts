import type { CustomerOperationListItem, CustomerOperationsListResponse, CustomerOperationsDataScope } from "../api/customerOperations";
import { labelOperationType } from "../lib/customerLabels";
import { getCustomerEmptyState } from "../lib/customerEmptyStates";
import { formatCustomerDate } from "../lib/customerSafeText";
import { customerDisplayName, customerSemanticLabel } from "../lib/customerSemanticLabels";
import {
  customerGuardedAcceptanceText,
  customerGuardedEvidenceText,
  customerGuardedStatus,
  customerGuardedStatusText,
  isCustomerFormalChainPassed,
} from "../lib/customerTrustGate";

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
  summaryText: string;
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

function isFormalAcceptancePass(item: CustomerOperationListItem): boolean {
  return isCustomerFormalChainPassed(item) && ["PASS", "SUCCESS", "SUCCEEDED", "APPROVED"].includes(normalizeStatus(item.acceptance_status));
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

function mapStatusFilter(item: CustomerOperationListItem): Exclude<CustomerOperationStatusFilter, "ALL"> {
  const guarded = customerGuardedStatus(item);
  if (guarded === "INSUFFICIENT_EVIDENCE" || (isEvidenceInsufficient(item) && !isFormalAcceptancePass(item))) return "EVIDENCE_INSUFFICIENT";
  if (isAcceptanceFail(item.acceptance_status)) return "ACCEPTANCE_FAIL";
  if (isFormalAcceptancePass(item)) return "ACCEPTANCE_PASS";
  if (isWaitingAcceptance(item)) return "WAIT_ACCEPTANCE";
  return "IN_PROGRESS";
}

function finalStatusText(item: CustomerOperationListItem): string {
  if (isWaitingAcceptance(item) && !isCustomerFormalChainPassed(item)) return "待验收";
  return customerGuardedStatusText(item);
}

function acceptanceText(item: CustomerOperationListItem): string {
  if (isWaitingAcceptance(item) && !isCustomerFormalChainPassed(item)) return "待验收";
  return customerGuardedAcceptanceText(item);
}

function evidenceCopy(item: CustomerOperationListItem): { text: string; explanation?: string } {
  if (isEvidenceInsufficient(item) && !isFormalAcceptancePass(item)) return { text: "等待补充证据" };
  const text = customerGuardedEvidenceText(item);
  if (!isCustomerFormalChainPassed(item)) return { text, explanation: "列表主文案以客户信任门禁为准；回执成功或原始状态通过不能单独形成正式结论。" };
  return { text };
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

function buildRow(item: CustomerOperationListItem, isFallback: boolean): CustomerOperationsIndexRowVm {
  const operationId = String(item.operation_id ?? item.operation_plan_id ?? "").trim();
  const statusFilter = isFallback ? "EVIDENCE_INSUFFICIENT" : mapStatusFilter(item);
  const operationTypeText = isPestDiseaseInspectionOperation(item) ? "病虫害巡检" : labelOperationType(item.operation_type);
  const title = buildTitle(operationTypeText, item);
  const fieldName = buildFieldName(item);
  const finalText = isFallback ? "正式报告条件不足" : finalStatusText(item);
  const acceptedText = isFallback ? "列表暂不可用" : acceptanceText(item);
  const evidence = isFallback ? { text: "作业列表暂不可用", explanation: "正式报告条件不足；列表不可使用驾驶舱聚合作为作业结论。" } : evidenceCopy(item);
  const summaryText = isFallback ? customerSemanticLabel(item.summary, "作业列表暂不可用") : customerSemanticLabel(item.summary, "");
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
    summaryText,
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
  if (response.dataScope === "FALLBACK_RECENT_ONLY") return { subtitle: "正式报告条件不足，作业列表暂不可用。", badge: "条件不足", note: customerSemanticLabel(response.data_scope_note, "正式报告条件不足，作业列表暂不可用"), isPreview: true };
  if (response.dataScope === "ERROR_EMPTY") return { subtitle: "正式报告条件不足，作业列表暂不可用，请稍后刷新。", badge: "暂不可用", note: customerSemanticLabel(response.data_scope_note, "正式报告条件不足，作业列表暂不可用，请稍后刷新"), isPreview: true };
  return { subtitle: "查看授权范围内作业、验收进展与报告入口。", badge: "正式列表", isPreview: false };
}

export function filterCustomerOperations(rows: CustomerOperationsIndexRowVm[], status: CustomerOperationStatusFilter): CustomerOperationsIndexRowVm[] {
  if (status === "ALL") return rows;
  return rows.filter((row) => row.statusFilter === status);
}

export function buildCustomerOperationsIndexVm(response: CustomerOperationsListResponse): CustomerOperationsIndexVm {
  const isFallback = response.dataScope !== "OFFICIAL_CUSTOMER_API";
  const rows = (response.operations ?? []).map((item) => buildRow(item, isFallback)).filter((row) => row.operationId);
  const countByStatus = (status: CustomerOperationStatusFilter) => status === "ALL" ? rows.length : rows.filter((row) => row.statusFilter === status).length;
  const scope = scopeCopy(response);
  return {
    title: "作业列表",
    subtitle: scope.subtitle,
    generatedAtText: toDateTimeText(response.generated_at),
    dataScope: response.dataScope,
    isFallback,
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
    emptyState: response.scope?.scope_mode === "DENIED" ? getCustomerEmptyState("NO_AUTHORIZED_FIELDS") : isFallback ? { title: "正式报告条件不足", description: "作业列表暂不可用，请稍后刷新。", severity: "warning" } : getCustomerEmptyState("NO_RECENT_OPERATIONS"),
  };
}
