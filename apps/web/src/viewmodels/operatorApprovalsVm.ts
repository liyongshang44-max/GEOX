import type { OperatorApprovalItem, OperatorApprovalsResponse, OperatorApprovalRiskLevel, OperatorApprovalStatus } from "../api/operatorApprovals";
import { mapOperatorStatusLabel, replaceOperatorTerms } from "../lib/operatorStatusLabels";

export type OperatorActionButtonStateV1 = {
  canAction: boolean;
  disabledReason: string | null;
  pending: boolean;
  lastError: string | null;
};

export type OperatorApprovalTechnicalRefsVm = {
  approvalRequestIdText: string;
  prescriptionIdText: string;
  recommendationIdText: string;
  sourceText: string;
};

export type OperatorApprovalRowVm = {
  approvalRequestId: string;
  title: string;
  description: string;
  objectText: string;
  statusText: string;
  riskText: string;
  riskTone: "danger" | "warning" | "neutral";
  requestedByText: string;
  approverText: string;
  updatedAtText: string;
  prescriptionText: string;
  prescriptionHref?: string | null;
  recommendationText: string;
  nextActionText: string;
  blockedReasonText: string;
  canApprove: boolean;
  permissionReason: string;
  permissionAllowed: boolean;
  selfApprovalRisk: boolean;
  actionButtonState: OperatorActionButtonStateV1;
  technicalRefs: OperatorApprovalTechnicalRefsVm;
};

export type OperatorApprovalDedupeSectionDiagnosticsVm = {
  duplicateCount: number;
  duplicateIds: string[];
};

export type OperatorApprovalDedupeDiagnosticsVm = {
  duplicateCount: number;
  duplicateIds: string[];
  bySection: Record<string, OperatorApprovalDedupeSectionDiagnosticsVm>;
};

export type OperatorApprovalsVm = {
  title: string;
  lead: string;
  generatedAtText: string;
  dataScopeText: string;
  dataScopeWarning?: string;
  writeReady: boolean;
  pending: OperatorApprovalRowVm[];
  highRiskPrescriptions: OperatorApprovalRowVm[];
  noPermission: OperatorApprovalRowVm[];
  selfApprovalRisk: OperatorApprovalRowVm[];
  history: OperatorApprovalRowVm[];
  dedupeDiagnostics: OperatorApprovalDedupeDiagnosticsVm;
  totalCount: number;
  emptyTitle: string;
  emptyDescription: string;
};

function isTechnicalId(value: unknown): boolean {
  const raw = String(value ?? "").trim();
  return /^(rec|prc|apr|act|opl|ft_op|ft_field)_[A-Za-z0-9_-]+$/i.test(raw)
    || /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw);
}

function text(value: unknown, fallback = ""): string {
  const raw = String(value ?? "").trim();
  if (!raw || raw === "--" || raw === "undefined" || raw === "null") return fallback;
  if (/token|secret|credential|private\s*key|password|stack\s*trace|debug\s*json/i.test(raw)) return fallback;
  return replaceOperatorTerms(raw);
}

function businessText(value: unknown, fallback = ""): string {
  if (isTechnicalId(value)) return fallback;
  return text(value, fallback);
}

function dateText(value: unknown): string {
  const raw = text(value);
  if (!raw) return "暂无更新时间";
  const ms = Date.parse(raw);
  if (!Number.isFinite(ms) || ms <= 0) return "暂无更新时间";
  return new Date(ms).toLocaleString("zh-CN", { hour12: false });
}

function statusText(value: OperatorApprovalStatus): string {
  if (value === "PENDING") return "待审批";
  if (value === "APPROVED") return "已通过";
  if (value === "REJECTED") return "已拒绝";
  if (value === "RETURNED") return "已退回";
  return mapOperatorStatusLabel(value, "approval", "状态待确认");
}

function riskText(value: OperatorApprovalRiskLevel, selfApprovalRisk: boolean): string {
  if (selfApprovalRisk) return "存在自审批风险，审批动作已阻断";
  if (value === "HIGH") return "高风险";
  if (value === "MEDIUM") return "中风险";
  if (value === "LOW") return "低风险";
  return "风险待确认";
}

function riskTone(value: OperatorApprovalRiskLevel, selfApprovalRisk: boolean): OperatorApprovalRowVm["riskTone"] {
  if (selfApprovalRisk) return "danger";
  if (value === "HIGH") return "danger";
  if (value === "MEDIUM") return "warning";
  return "neutral";
}

function sourceText(value: OperatorApprovalItem["source"]): string {
  if (value === "operator_approvals_api") return "运营审批接口";
  return "审批接口 fallback";
}

function includesIrrigation(item: OperatorApprovalItem): boolean {
  const haystack = [item.title, item.description, item.operationName].map((x) => String(x ?? "")).join(" ");
  return /IRRIGATE|IRRIGATION|灌溉/i.test(haystack);
}

function approvalTitle(item: OperatorApprovalItem): string {
  if (includesIrrigation(item) && item.prescriptionId) return "灌溉处方审批";
  if (includesIrrigation(item)) return "灌溉审批";
  const base = businessText(item.title, "审批事项");
  if (base === "灌溉") return "灌溉处方审批";
  return base;
}

function objectText(item: OperatorApprovalItem): string {
  const field = businessText(item.fieldName, "对象地块待确认");
  const operation = businessText(item.operationName, includesIrrigation(item) ? "灌溉作业" : "作业待确认");
  return `${field} / ${operation}`;
}

function prescriptionHref(item: OperatorApprovalItem): string | null {
  if (item.prescriptionId) return null;
  return null;
}

function buildActionButtonState(item: OperatorApprovalItem): OperatorActionButtonStateV1 {
  if (item.selfApprovalRisk) {
    return { canAction: false, disabledReason: "发起人与审批人相同", pending: false, lastError: null };
  }
  if (item.status !== "PENDING") {
    return { canAction: false, disabledReason: "审批请求当前状态不可再次处理。", pending: false, lastError: null };
  }
  if (!item.permissionAllowed) {
    return { canAction: false, disabledReason: text(item.permissionReason, "当前身份无审批权限。"), pending: false, lastError: null };
  }
  return { canAction: true, disabledReason: null, pending: false, lastError: null };
}

function nextActionText(item: OperatorApprovalItem, actionButtonState: OperatorActionButtonStateV1): string {
  if (item.selfApprovalRisk) return "请由其他具备审批权限的人员处理";
  if (item.status !== "PENDING") return "无需处理，审批事项已进入历史记录";
  if (!actionButtonState.canAction) return "请确认当前账号权限，或转交具备审批权限的人员处理";
  return "请复核处方、风险和对象后选择通过、拒绝或退回补充";
}

function buildTechnicalRefs(item: OperatorApprovalItem): OperatorApprovalTechnicalRefsVm {
  return {
    approvalRequestIdText: text(item.approvalRequestId, "审批记录待确认"),
    prescriptionIdText: text(item.prescriptionId, "未关联处方 ID"),
    recommendationIdText: text(item.recommendationId, "未关联建议 ID"),
    sourceText: sourceText(item.source),
  };
}

function buildRow(item: OperatorApprovalItem): OperatorApprovalRowVm {
  const actionButtonState = buildActionButtonState(item);
  return {
    approvalRequestId: item.approvalRequestId,
    title: approvalTitle(item),
    description: businessText(item.description, "建议或处方等待运营审批。"),
    objectText: objectText(item),
    statusText: statusText(item.status),
    riskText: riskText(item.riskLevel, item.selfApprovalRisk),
    riskTone: riskTone(item.riskLevel, item.selfApprovalRisk),
    requestedByText: businessText(item.requestedBy, "发起人待确认"),
    approverText: businessText(item.approver, "审批人待确认"),
    updatedAtText: dateText(item.updatedAt || item.createdAt),
    prescriptionText: item.prescriptionId ? "处方记录已关联" : "未关联正式处方",
    prescriptionHref: prescriptionHref(item),
    recommendationText: item.recommendationId ? "建议记录已关联" : "未关联建议",
    nextActionText: nextActionText(item, actionButtonState),
    blockedReasonText: actionButtonState.disabledReason ?? "",
    canApprove: actionButtonState.canAction,
    permissionReason: actionButtonState.disabledReason ? `当前不可操作：${actionButtonState.disabledReason}` : text(item.permissionReason, item.canApprove ? "具备审批权限" : "当前不可审批"),
    permissionAllowed: item.permissionAllowed,
    selfApprovalRisk: item.selfApprovalRisk,
    actionButtonState,
    technicalRefs: buildTechnicalRefs(item),
  };
}

export function dedupeApprovalRowsById(
  rows: OperatorApprovalRowVm[],
  sectionKey: string,
): { rows: OperatorApprovalRowVm[]; duplicateCount: number; duplicateIds: string[] } {
  const seen = new Set<string>();
  const duplicateIds = new Set<string>();
  const deduped: OperatorApprovalRowVm[] = [];
  let duplicateCount = 0;

  for (const row of rows) {
    const approvalRequestId = String(row.approvalRequestId ?? "").trim();
    const dedupeKey = approvalRequestId || `__missing_approval_request_id__:${sectionKey}`;
    if (seen.has(dedupeKey)) {
      duplicateCount += 1;
      duplicateIds.add(approvalRequestId || "__missing_approval_request_id__");
      continue;
    }
    seen.add(dedupeKey);
    deduped.push(row);
  }

  return { rows: deduped, duplicateCount, duplicateIds: [...duplicateIds] };
}

function dataScopeText(response: OperatorApprovalsResponse): string {
  if (response.dataScope === "OFFICIAL_OPERATOR_API") return "正式运营审批中心";
  if (response.dataScope === "FALLBACK_LIMITED") return "有限 fallback 审批列表";
  if (response.dataScope === "ERROR_EMPTY") return "审批中心暂不可用";
  return "暂无审批事项";
}

function buildDedupeDiagnostics(sections: Record<string, ReturnType<typeof dedupeApprovalRowsById>>): OperatorApprovalDedupeDiagnosticsVm {
  const bySection: Record<string, OperatorApprovalDedupeSectionDiagnosticsVm> = {};
  const duplicateIds = new Set<string>();
  let duplicateCount = 0;

  for (const [sectionKey, result] of Object.entries(sections)) {
    duplicateCount += result.duplicateCount;
    for (const duplicateId of result.duplicateIds) duplicateIds.add(duplicateId);
    bySection[sectionKey] = { duplicateCount: result.duplicateCount, duplicateIds: result.duplicateIds };
  }

  return { duplicateCount, duplicateIds: [...duplicateIds], bySection };
}

export function buildOperatorApprovalsVm(response: OperatorApprovalsResponse): OperatorApprovalsVm {
  const rowItems = (response.items ?? []).map((item) => ({ item, row: buildRow(item) }));
  const pendingBase = rowItems.filter(({ item }) => item.status === "PENDING").map(({ row }) => row);
  const highRiskPrescriptionsBase = rowItems.filter(({ item }) => item.status === "PENDING" && item.riskLevel === "HIGH" && Boolean(item.prescriptionId)).map(({ row }) => row);
  const noPermissionBase = pendingBase.filter((row) => !row.actionButtonState.canAction && !row.selfApprovalRisk);
  const selfApprovalRiskBase = pendingBase.filter((row) => row.selfApprovalRisk);
  const historyBase = rowItems.filter(({ item }) => item.status !== "PENDING").map(({ row }) => row);

  const pending = dedupeApprovalRowsById(pendingBase, "pending");
  const highRiskPrescriptions = dedupeApprovalRowsById(highRiskPrescriptionsBase, "highRiskPrescriptions");
  const noPermission = dedupeApprovalRowsById(noPermissionBase, "noPermission");
  const selfApprovalRisk = dedupeApprovalRowsById(selfApprovalRiskBase, "selfApprovalRisk");
  const history = dedupeApprovalRowsById(historyBase, "history");
  const dedupeDiagnostics = buildDedupeDiagnostics({ pending, highRiskPrescriptions, noPermission, selfApprovalRisk, history });

  return {
    title: "审批中心",
    lead: "集中查看待审批事项、高风险处方、权限阻断、自审批风险与审批历史。",
    generatedAtText: dateText(response.generated_at),
    dataScopeText: dataScopeText(response),
    dataScopeWarning: response.dataScope === "FALLBACK_LIMITED" ? text(response.message, "当前展示有限 fallback 审批数据，非完整运营审批中心。") : undefined,
    writeReady: response.writeReady,
    pending: pending.rows,
    highRiskPrescriptions: highRiskPrescriptions.rows,
    noPermission: noPermission.rows,
    selfApprovalRisk: selfApprovalRisk.rows,
    history: history.rows,
    dedupeDiagnostics,
    totalCount: pending.rows.length + history.rows.length,
    emptyTitle: "暂无审批事项",
    emptyDescription: "当前没有待审批、高风险处方、自审批风险或审批历史记录。",
  };
}
