import type { OperatorApprovalItem, OperatorApprovalsResponse, OperatorApprovalRiskLevel, OperatorApprovalStatus } from "../api/operatorApprovals";
import { mapOperatorStatusLabel, replaceOperatorTerms } from "../lib/operatorStatusLabels";

export type OperatorActionButtonStateV1 = {
  canAction: boolean;
  disabledReason: string | null;
  pending: boolean;
  lastError: string | null;
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
  canApprove: boolean;
  permissionReason: string;
  permissionAllowed: boolean;
  selfApprovalRisk: boolean;
  actionButtonState: OperatorActionButtonStateV1;
  sourceText: string;
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
  totalCount: number;
  emptyTitle: string;
  emptyDescription: string;
};

function text(value: unknown, fallback = ""): string {
  const raw = String(value ?? "").trim();
  if (!raw || raw === "--" || raw === "undefined" || raw === "null") return fallback;
  if (/token|secret|credential|private\s*key|password|stack\s*trace|debug\s*json/i.test(raw)) return fallback;
  return replaceOperatorTerms(raw);
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

function riskText(value: OperatorApprovalRiskLevel): string {
  if (value === "HIGH") return "高风险";
  if (value === "MEDIUM") return "中风险";
  if (value === "LOW") return "低风险";
  return "风险待确认";
}

function riskTone(value: OperatorApprovalRiskLevel): OperatorApprovalRowVm["riskTone"] {
  if (value === "HIGH") return "danger";
  if (value === "MEDIUM") return "warning";
  return "neutral";
}

function sourceText(value: OperatorApprovalItem["source"]): string {
  if (value === "operator_approvals_api") return "运营审批接口";
  return "审批接口 fallback";
}

function objectText(item: OperatorApprovalItem): string {
  const parts = [text(item.fieldName), text(item.operationName)].filter(Boolean);
  return parts.length ? parts.join(" · ") : "审批对象待确认";
}

function prescriptionHref(item: OperatorApprovalItem): string | null {
  if (item.prescriptionId) return null;
  return null;
}

function buildActionButtonState(item: OperatorApprovalItem): OperatorActionButtonStateV1 {
  if (item.selfApprovalRisk) {
    return {
      canAction: false,
      disabledReason: mapOperatorStatusLabel("SELF_APPROVAL_BLOCKED", "approval"),
      pending: false,
      lastError: null,
    };
  }
  if (item.status !== "PENDING") {
    return {
      canAction: false,
      disabledReason: "审批请求当前状态不可再次处理。",
      pending: false,
      lastError: null,
    };
  }
  if (!item.permissionAllowed) {
    return {
      canAction: false,
      disabledReason: text(item.permissionReason, "当前身份无审批权限。"),
      pending: false,
      lastError: null,
    };
  }
  return {
    canAction: true,
    disabledReason: null,
    pending: false,
    lastError: null,
  };
}

function buildRow(item: OperatorApprovalItem): OperatorApprovalRowVm {
  const actionButtonState = buildActionButtonState(item);
  return {
    approvalRequestId: item.approvalRequestId,
    title: text(item.title, "审批事项"),
    description: text(item.description, "建议或处方等待运营审批。"),
    objectText: objectText(item),
    statusText: statusText(item.status),
    riskText: riskText(item.riskLevel),
    riskTone: riskTone(item.riskLevel),
    requestedByText: text(item.requestedBy, "发起人待确认"),
    approverText: text(item.approver, "审批人待确认"),
    updatedAtText: dateText(item.updatedAt || item.createdAt),
    prescriptionText: text(item.prescriptionId, "未关联正式处方"),
    prescriptionHref: prescriptionHref(item),
    recommendationText: text(item.recommendationId, "未关联建议"),
    canApprove: actionButtonState.canAction,
    permissionReason: text(actionButtonState.disabledReason ?? item.permissionReason, item.canApprove ? "具备审批权限" : "当前不可审批"),
    permissionAllowed: item.permissionAllowed,
    selfApprovalRisk: item.selfApprovalRisk,
    actionButtonState,
    sourceText: sourceText(item.source),
  };
}

function dataScopeText(response: OperatorApprovalsResponse): string {
  if (response.dataScope === "OFFICIAL_OPERATOR_API") return "正式运营审批中心";
  if (response.dataScope === "FALLBACK_LIMITED") return "有限 fallback 审批列表";
  if (response.dataScope === "ERROR_EMPTY") return "审批中心暂不可用";
  return "暂无审批事项";
}

export function buildOperatorApprovalsVm(response: OperatorApprovalsResponse): OperatorApprovalsVm {
  const rows = (response.items ?? []).map(buildRow);
  const pending = rows.filter((row, index) => response.items[index]?.status === "PENDING");
  const highRiskPrescriptions = pending.filter((row, index) => {
    const original = response.items.filter((item) => item.status === "PENDING")[index];
    return original?.riskLevel === "HIGH" && Boolean(original?.prescriptionId);
  });
  const noPermission = pending.filter((row) => !row.actionButtonState.canAction && !row.selfApprovalRisk);
  const selfApprovalRisk = pending.filter((row) => row.selfApprovalRisk);
  const history = rows.filter((row, index) => response.items[index]?.status !== "PENDING");

  return {
    title: "审批中心",
    lead: "集中查看待审批事项、高风险处方、权限阻断、自审批风险与审批历史。",
    generatedAtText: dateText(response.generated_at),
    dataScopeText: dataScopeText(response),
    dataScopeWarning: response.dataScope === "FALLBACK_LIMITED" ? text(response.message, "当前展示有限 fallback 审批数据，非完整运营审批中心。") : undefined,
    writeReady: response.writeReady,
    pending,
    highRiskPrescriptions,
    noPermission,
    selfApprovalRisk,
    history,
    totalCount: rows.length,
    emptyTitle: "暂无审批事项",
    emptyDescription: "当前没有待审批、高风险处方、自审批风险或审批历史记录。",
  };
}
