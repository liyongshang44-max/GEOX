import type { OperatorAcceptanceItem, OperatorAcceptanceResponse, OperatorAcceptanceStatus } from "../api/operatorAcceptance";
import { mapOperatorStatusLabel, replaceOperatorTerms } from "../lib/operatorStatusLabels";

export type OperatorActionButtonStateV1 = {
  canAction: boolean;
  disabledReason: string | null;
  pending: boolean;
  lastError: string | null;
};

export type OperatorAcceptanceRowVm = {
  operationId: string;
  title: string;
  objectText: string;
  acceptanceStatusText: string;
  operationStateText: string;
  statusTone: "danger" | "warning" | "success" | "neutral";
  evidenceText: string;
  failureReasonText: string;
  reviewReasonText: string;
  verdictText: string;
  generatedAtText: string;
  updatedAtText: string;
  sourceText: string;
  canEvaluate: boolean;
  canRequestReview: boolean;
  evaluateButtonState: OperatorActionButtonStateV1;
  reviewButtonState: OperatorActionButtonStateV1;
  disabledReason: string;
  operationHref: string;
};

export type OperatorAcceptanceGroupVm = {
  key: OperatorAcceptanceStatus;
  title: string;
  description: string;
  count: number;
  rows: OperatorAcceptanceRowVm[];
};

export type OperatorAcceptanceVm = {
  title: string;
  lead: string;
  generatedAtText: string;
  dataScopeText: string;
  dataScopeWarning?: string;
  writeReady: boolean;
  totalCount: number;
  groups: OperatorAcceptanceGroupVm[];
  emptyTitle: string;
  emptyDescription: string;
};

const GROUP_ORDER: OperatorAcceptanceStatus[] = ["PENDING", "EVIDENCE_INSUFFICIENT", "FAILED", "REVIEW_REQUIRED", "PASSED"];

const GROUP_META: Record<OperatorAcceptanceStatus, { title: string; description: string }> = {
  PENDING: { title: "待验收作业", description: "已执行或已收到回执，但尚未形成验收结论。" },
  EVIDENCE_INSUFFICIENT: { title: "证据不足", description: "证据不足不能包装成验收通过，需要补证或复核。" },
  FAILED: { title: "验收未通过", description: "验收未通过，必须展示失败原因。" },
  REVIEW_REQUIRED: { title: "需要复核", description: "存在异常、争议或人工复核要求。" },
  PASSED: { title: "验收通过", description: "后端验收结论为通过的作业。" },
  UNKNOWN: { title: "状态待确认", description: "验收状态来源不足，暂不进入正式队列。" },
};

function text(value: unknown, fallback = ""): string {
  const raw = String(value ?? "").trim();
  if (!raw || raw === "--" || raw === "undefined" || raw === "null") return fallback;
  if (/token|secret|credential|private\s*key|password|stack\s*trace|debug\s*json/i.test(raw)) return fallback;
  return replaceOperatorTerms(raw);
}

function dateText(value: unknown): string {
  const raw = text(value);
  if (!raw) return "暂无记录";
  const ms = Date.parse(raw);
  if (!Number.isFinite(ms) || ms <= 0) return "暂无记录";
  return new Date(ms).toLocaleString("zh-CN", { hour12: false });
}

function statusText(value: OperatorAcceptanceStatus): string {
  if (value === "PENDING") return "待验收";
  if (value === "EVIDENCE_INSUFFICIENT") return "证据不足";
  if (value === "FAILED") return "验收未通过";
  if (value === "REVIEW_REQUIRED") return "需要复核";
  if (value === "PASSED") return "验收通过";
  return mapOperatorStatusLabel(value, "acceptance", "状态待确认");
}

function statusTone(value: OperatorAcceptanceStatus): OperatorAcceptanceRowVm["statusTone"] {
  if (value === "FAILED" || value === "EVIDENCE_INSUFFICIENT") return "danger";
  if (value === "PENDING" || value === "REVIEW_REQUIRED") return "warning";
  if (value === "PASSED") return "success";
  return "neutral";
}

function sourceText(value: OperatorAcceptanceItem["source"]): string {
  if (value === "operator_acceptance_api") return "运营验收接口";
  return "报告聚合 fallback";
}

function objectText(item: OperatorAcceptanceItem): string {
  const parts = [text(item.fieldName), text(item.operationName)].filter(Boolean);
  return parts.length ? parts.join(" · ") : "验收对象待确认";
}

function operationHref(operationId: string): string {
  return `/customer/operations/${encodeURIComponent(operationId)}`;
}

function buildEvaluateButtonState(item: OperatorAcceptanceItem, writeReady: boolean): OperatorActionButtonStateV1 {
  if (!writeReady) return { canAction: false, disabledReason: "验收写操作未 ready，当前只读。", pending: false, lastError: null };
  if (item.evidenceInsufficient) return { canAction: false, disabledReason: "证据不足，不能直接包装成验收通过。", pending: false, lastError: null };
  if (!item.canEvaluate) return { canAction: false, disabledReason: text(item.permissionReason, "当前身份无验收操作权限。"), pending: false, lastError: null };
  return { canAction: true, disabledReason: null, pending: false, lastError: null };
}

function buildReviewButtonState(item: OperatorAcceptanceItem, writeReady: boolean): OperatorActionButtonStateV1 {
  if (!writeReady) return { canAction: false, disabledReason: "验收写操作未 ready，当前只读。", pending: false, lastError: null };
  if (!item.canRequestReview) return { canAction: false, disabledReason: text(item.permissionReason, "当前作业暂不能进入复核。"), pending: false, lastError: null };
  return { canAction: true, disabledReason: null, pending: false, lastError: null };
}

function disabledReason(item: OperatorAcceptanceItem, writeReady: boolean): string {
  const evaluateState = buildEvaluateButtonState(item, writeReady);
  const reviewState = buildReviewButtonState(item, writeReady);
  return evaluateState.disabledReason || reviewState.disabledReason || "";
}

function buildRow(item: OperatorAcceptanceItem, writeReady: boolean): OperatorAcceptanceRowVm {
  const evaluateButtonState = buildEvaluateButtonState(item, writeReady);
  const reviewButtonState = buildReviewButtonState(item, writeReady);
  return {
    operationId: item.operationId,
    title: text(item.operationName, "验收作业"),
    objectText: objectText(item),
    acceptanceStatusText: statusText(item.acceptanceStatus),
    operationStateText: text(item.operationStateStatus, "作业状态未提供"),
    statusTone: statusTone(item.acceptanceStatus),
    evidenceText: item.evidenceInsufficient ? "证据不足" : "证据状态来自后端验收/报告字段",
    failureReasonText: text(item.failureReason, item.acceptanceStatus === "FAILED" ? "失败原因待补充" : "无失败原因"),
    reviewReasonText: text(item.reviewReason, item.acceptanceStatus === "REVIEW_REQUIRED" ? "复核原因待补充" : "无复核原因"),
    verdictText: mapOperatorStatusLabel(item.acceptanceVerdict, "acceptance", text(item.acceptanceVerdict, "验收结论待生成")),
    generatedAtText: dateText(item.generatedAt),
    updatedAtText: dateText(item.updatedAt),
    sourceText: sourceText(item.source),
    canEvaluate: evaluateButtonState.canAction,
    canRequestReview: reviewButtonState.canAction,
    evaluateButtonState,
    reviewButtonState,
    disabledReason: disabledReason(item, writeReady),
    operationHref: operationHref(item.operationId),
  };
}

function dataScopeText(response: OperatorAcceptanceResponse): string {
  if (response.dataScope === "OFFICIAL_OPERATOR_API") return "正式运营验收中心";
  if (response.dataScope === "FALLBACK_LIMITED") return "有限 fallback 验收队列";
  if (response.dataScope === "ERROR_EMPTY") return "验收中心暂不可用";
  return "暂无验收事项";
}

export function buildOperatorAcceptanceVm(response: OperatorAcceptanceResponse): OperatorAcceptanceVm {
  const rows = (response.items ?? []).map((item) => buildRow(item, response.writeReady));
  const groups = GROUP_ORDER.map((key) => {
    const meta = GROUP_META[key];
    const filtered = rows.filter((_, index) => response.items[index]?.acceptanceStatus === key);
    return { key, title: meta.title, description: meta.description, count: filtered.length, rows: filtered };
  });

  return {
    title: "验收中心",
    lead: "处理待验收、失败复核、证据不足与已通过验收作业。",
    generatedAtText: dateText(response.generated_at),
    dataScopeText: dataScopeText(response),
    dataScopeWarning: response.dataScope === "FALLBACK_LIMITED" ? replaceOperatorTerms(response.message || "当前展示有限 fallback 验收数据，非完整 operator acceptance。") : undefined,
    writeReady: response.writeReady,
    totalCount: rows.length,
    groups,
    emptyTitle: "暂无验收事项",
    emptyDescription: "当前没有待验收、证据不足、验收未通过、需要复核或验收通过记录。",
  };
}
