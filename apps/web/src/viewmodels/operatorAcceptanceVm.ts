import type { OperatorAcceptanceItem, OperatorAcceptanceResponse, OperatorAcceptanceStatus } from "../api/operatorAcceptance";
import { mapOperatorStatusLabel, replaceOperatorTerms } from "../lib/operatorStatusLabels";

export type OperatorActionButtonStateV1 = {
  canAction: boolean;
  disabledReason: string | null;
  pending: boolean;
  lastError: string | null;
};

export type OperatorAcceptanceTechnicalRefsVm = {
  operationIdText: string;
  acceptanceIdText: string;
  operationStateText: string;
  sourceText: string;
};

export type OperatorAcceptanceRowVm = {
  operationId: string;
  title: string;
  objectText: string;
  acceptanceStatusText: string;
  operationStateText: string;
  statusTone: "danger" | "warning" | "success" | "neutral";
  evidenceText: string;
  reasonText: string;
  nextActionText: string;
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
  technicalRefs: OperatorAcceptanceTechnicalRefsVm;
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
  PENDING: { title: "待验收", description: "已执行或已收到回执，但尚未形成验收结论。" },
  EVIDENCE_INSUFFICIENT: { title: "证据不足", description: "证据不足，不能包装成验收通过，需要补证或复核。" },
  FAILED: { title: "验收失败", description: "已经形成未通过结论，需要复核或返工。" },
  REVIEW_REQUIRED: { title: "需要复核", description: "存在异常、争议或人工复核要求。" },
  PASSED: { title: "验收通过", description: "后端验收结论为通过的作业。" },
  UNKNOWN: { title: "状态待确认", description: "验收状态来源不足，暂不进入正式队列。" },
};

function isTechnicalId(value: unknown): boolean {
  const raw = String(value ?? "").trim();
  return /^(rec|prc|apr|act|opl|ft_op|ft_field|acceptance|acc)_[A-Za-z0-9_-]+$/i.test(raw)
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
  if (!raw) return "暂无记录";
  const ms = Date.parse(raw);
  if (!Number.isFinite(ms) || ms <= 0) return "暂无记录";
  return new Date(ms).toLocaleString("zh-CN", { hour12: false });
}

function includesIrrigation(item: OperatorAcceptanceItem): boolean {
  const haystack = [item.operationName, item.fieldName, item.reviewReason, item.failureReason].map((x) => String(x ?? "")).join(" ");
  return /IRRIGATE|IRRIGATION|灌溉/i.test(haystack);
}

function titleText(item: OperatorAcceptanceItem): string {
  if (includesIrrigation(item)) return "灌溉作业";
  const base = businessText(item.operationName, "验收作业");
  if (base === "灌溉") return "灌溉作业";
  return base;
}

function statusText(value: OperatorAcceptanceStatus): string {
  if (value === "PENDING") return "待验收";
  if (value === "EVIDENCE_INSUFFICIENT") return "证据不足";
  if (value === "FAILED") return "验收失败";
  if (value === "REVIEW_REQUIRED") return "需要复核";
  if (value === "PASSED") return "验收通过";
  return mapOperatorStatusLabel(value, "acceptance", "状态待确认");
}

function verdictText(item: OperatorAcceptanceItem): string {
  if (item.acceptanceStatus === "EVIDENCE_INSUFFICIENT") return "暂不能通过";
  if (item.acceptanceStatus === "FAILED") return "未通过";
  if (item.acceptanceStatus === "PENDING") return "尚未形成验收结论";
  if (item.acceptanceStatus === "REVIEW_REQUIRED") return "待复核";
  if (item.acceptanceStatus === "PASSED") return "已通过";
  return mapOperatorStatusLabel(item.acceptanceVerdict, "acceptance", text(item.acceptanceVerdict, "验收结论待生成"));
}

function reasonText(item: OperatorAcceptanceItem): string {
  if (item.acceptanceStatus === "EVIDENCE_INSUFFICIENT" || item.evidenceInsufficient) return "缺少验收所需证据";
  if (item.acceptanceStatus === "FAILED") return text(item.failureReason, "已形成未通过结论，失败原因待补充");
  if (item.acceptanceStatus === "PENDING") return "已执行或已收到回执，但尚未形成验收结论";
  if (item.acceptanceStatus === "REVIEW_REQUIRED") return text(item.reviewReason, "存在异常或争议，需要人工复核");
  if (item.acceptanceStatus === "PASSED") return "验收结论已通过";
  return "验收原因待确认";
}

function nextActionText(item: OperatorAcceptanceItem): string {
  if (item.acceptanceStatus === "EVIDENCE_INSUFFICIENT" || item.evidenceInsufficient) return "补充证据或发起复核";
  if (item.acceptanceStatus === "FAILED") return "复核失败原因，安排返工或补救";
  if (item.acceptanceStatus === "PENDING") return "执行验收或发起复核";
  if (item.acceptanceStatus === "REVIEW_REQUIRED") return "由具备权限的人员完成复核";
  if (item.acceptanceStatus === "PASSED") return "归档验收结果并同步作业报告";
  return "确认验收状态后再处理";
}

function evidenceText(item: OperatorAcceptanceItem): string {
  if (item.acceptanceStatus === "EVIDENCE_INSUFFICIENT" || item.evidenceInsufficient) return "证据不足";
  if (item.acceptanceStatus === "FAILED") return "证据已参与验收，但结论未通过";
  if (item.acceptanceStatus === "PENDING") return "待验收复核";
  if (item.acceptanceStatus === "PASSED") return "证据支持验收结论";
  if (item.acceptanceStatus === "REVIEW_REQUIRED") return "证据或结论需要复核";
  return "证据状态待确认";
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
  const parts = [businessText(item.fieldName), businessText(item.operationName)].filter(Boolean);
  return parts.length ? parts.join(" / ") : "验收对象待确认";
}

function operationHref(operationId: string): string {
  return `/customer/operations/${encodeURIComponent(operationId)}`;
}

function buildEvaluateButtonState(item: OperatorAcceptanceItem, writeReady: boolean): OperatorActionButtonStateV1 {
  if (!writeReady) return { canAction: false, disabledReason: "验收写操作未 ready，当前只读。", pending: false, lastError: null };
  if (item.evidenceInsufficient || item.acceptanceStatus === "EVIDENCE_INSUFFICIENT") return { canAction: false, disabledReason: "证据不足，不能包装成验收通过，需要补证或复核。", pending: false, lastError: null };
  if (item.acceptanceStatus === "FAILED") return { canAction: false, disabledReason: "已经形成未通过结论，需要复核或返工。", pending: false, lastError: null };
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

function buildTechnicalRefs(item: OperatorAcceptanceItem): OperatorAcceptanceTechnicalRefsVm {
  return {
    operationIdText: text(item.operationId, "作业 ID 待确认"),
    acceptanceIdText: text(item.acceptanceId, "验收记录 ID 待确认"),
    operationStateText: text(item.operationStateStatus, "作业状态未提供"),
    sourceText: sourceText(item.source),
  };
}

function buildRow(item: OperatorAcceptanceItem, writeReady: boolean): OperatorAcceptanceRowVm {
  const evaluateButtonState = buildEvaluateButtonState(item, writeReady);
  const reviewButtonState = buildReviewButtonState(item, writeReady);
  return {
    operationId: item.operationId,
    title: titleText(item),
    objectText: objectText(item),
    acceptanceStatusText: statusText(item.acceptanceStatus),
    operationStateText: text(item.operationStateStatus, "作业状态未提供"),
    statusTone: statusTone(item.acceptanceStatus),
    evidenceText: evidenceText(item),
    reasonText: reasonText(item),
    nextActionText: nextActionText(item),
    failureReasonText: text(item.failureReason, item.acceptanceStatus === "FAILED" ? "失败原因待补充" : "无失败原因"),
    reviewReasonText: text(item.reviewReason, item.acceptanceStatus === "REVIEW_REQUIRED" ? "复核原因待补充" : "无复核原因"),
    verdictText: verdictText(item),
    generatedAtText: dateText(item.generatedAt),
    updatedAtText: dateText(item.updatedAt),
    sourceText: sourceText(item.source),
    canEvaluate: evaluateButtonState.canAction,
    canRequestReview: reviewButtonState.canAction,
    evaluateButtonState,
    reviewButtonState,
    disabledReason: disabledReason(item, writeReady),
    operationHref: operationHref(item.operationId),
    technicalRefs: buildTechnicalRefs(item),
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
    emptyDescription: "当前没有待验收、证据不足、验收失败、需要复核或验收通过记录。",
  };
}
