import type { OperatorRoiLedgerItem, OperatorRoiLedgerResponse, OperatorRoiValueKind } from "../api/operatorRoiLedger";
import { replaceOperatorTerms } from "../lib/operatorStatusLabels";

export type OperatorRoiTechnicalRefsVm = {
  roiIdText: string;
  operationIdText: string;
  prescriptionIdText: string;
  evidenceRefText: string;
  calculationMethodText: string;
  sourceText: string;
};

export type OperatorRoiLedgerRowVm = {
  roiId: string;
  operationIdText: string;
  prescriptionIdText: string;
  evidenceRefText: string;
  calculationMethodText: string;
  confidenceText: string;
  assumptionText: string;
  createdAtText: string;
  valueKindText: string;
  valueKindTone: "success" | "warning" | "danger" | "neutral";
  metricText: string;
  valueText: string;
  sourceText: string;
  measuredAllowedText: string;
  technicalRefs: OperatorRoiTechnicalRefsVm;
  operationHref?: string | null;
};

export type OperatorRoiLedgerVm = {
  title: string;
  lead: string;
  generatedAtText: string;
  dataScopeText: string;
  dataScopeWarning?: string;
  filterText: string;
  needsOperationSelection: boolean;
  operationSelectionTitle: string;
  operationSelectionDescription: string;
  operationSelectionItems: string[];
  totalCount: number;
  measuredRows: OperatorRoiLedgerRowVm[];
  estimatedRows: OperatorRoiLedgerRowVm[];
  assumptionRows: OperatorRoiLedgerRowVm[];
  insufficientRows: OperatorRoiLedgerRowVm[];
  rows: OperatorRoiLedgerRowVm[];
  emptyTitle: string;
  emptyDescription: string;
};

function text(value: unknown, fallback = ""): string {
  const raw = String(value ?? "").trim();
  if (!raw || raw === "--" || raw === "undefined" || raw === "null") return fallback;
  return replaceOperatorTerms(raw);
}

function dateText(value: unknown): string {
  const raw = text(value);
  if (!raw) return "暂无记录";
  const ms = Date.parse(raw);
  if (!Number.isFinite(ms) || ms <= 0) return raw;
  return new Date(ms).toLocaleString("zh-CN", { hour12: false });
}

function valueKindText(kind: OperatorRoiValueKind, baselinePresent: boolean, actualPresent: boolean): string {
  if (kind === "MEASURED") return baselinePresent && actualPresent ? "实测" : "实测条件不足";
  if (kind === "ESTIMATED") return "估算";
  if (kind === "ASSUMPTION") return "基于假设";
  return "类型待确认";
}

function valueKindTone(kind: OperatorRoiValueKind, baselinePresent: boolean, actualPresent: boolean): OperatorRoiLedgerRowVm["valueKindTone"] {
  if (kind === "MEASURED" && baselinePresent && actualPresent) return "success";
  if (kind === "ESTIMATED" || kind === "ASSUMPTION") return "warning";
  if (kind === "MEASURED" && (!baselinePresent || !actualPresent)) return "danger";
  return "neutral";
}

function sourceText(source: OperatorRoiLedgerItem["source"]): string {
  if (source === "operator_roi_ledger_api") return "运营 ROI 明细接口";
  if (source === "customer_roi_ledger_api") return "客户 ROI 接口 fallback";
  return "作业报告内嵌 ROI fallback";
}

function operationHref(operationId: unknown): string | null {
  const id = String(operationId ?? "").trim();
  return id ? `/customer/operations/${encodeURIComponent(id)}` : null;
}

function measuredAllowedText(item: OperatorRoiLedgerItem): string {
  if (item.valueKind !== "MEASURED") return "非实测项，需按估算/假设口径解读。";
  if (!item.baselinePresent) return "缺少基线，不显示“实测收益”。";
  if (!item.actualPresent) return "缺少实际结果，不显示“实测收益”。";
  return "基线与实际结果已提供，可按实测口径解读。";
}

function buildTechnicalRefs(item: OperatorRoiLedgerItem): OperatorRoiTechnicalRefsVm {
  return {
    roiIdText: text(item.roiId, "ROI 记录待确认"),
    operationIdText: text(item.operationId, "作业编号待确认"),
    prescriptionIdText: text(item.prescriptionId, "处方编号待确认"),
    evidenceRefText: text(item.evidenceRef, "证据引用待确认"),
    calculationMethodText: text(item.calculationMethod, "计算方法待确认"),
    sourceText: sourceText(item.source),
  };
}

function buildRow(item: OperatorRoiLedgerItem): OperatorRoiLedgerRowVm {
  const technicalRefs = buildTechnicalRefs(item);
  return {
    roiId: technicalRefs.roiIdText,
    operationIdText: technicalRefs.operationIdText,
    prescriptionIdText: technicalRefs.prescriptionIdText,
    evidenceRefText: technicalRefs.evidenceRefText,
    calculationMethodText: technicalRefs.calculationMethodText,
    confidenceText: text(item.confidenceText, "置信度待确认"),
    assumptionText: text(item.assumptionText, "假设条件待确认"),
    createdAtText: dateText(item.createdAt),
    valueKindText: valueKindText(item.valueKind, item.baselinePresent, item.actualPresent),
    valueKindTone: valueKindTone(item.valueKind, item.baselinePresent, item.actualPresent),
    metricText: text(item.metricText, "价值指标待确认"),
    valueText: text(item.valueText, "数值待确认"),
    sourceText: technicalRefs.sourceText,
    measuredAllowedText: measuredAllowedText(item),
    technicalRefs,
    operationHref: operationHref(item.operationId),
  };
}

function dataScopeText(response: OperatorRoiLedgerResponse): string {
  if (response.dataScope === "OFFICIAL_OPERATOR_API") return "正式运营 ROI 明细";
  if (response.dataScope === "FALLBACK_LIMITED") return "有限 fallback ROI 明细";
  if (response.dataScope === "ERROR_EMPTY") return "ROI 明细暂不可用";
  return "暂无 ROI 明细";
}

function filterText(response: OperatorRoiLedgerResponse): string {
  const parts: string[] = [];
  if (response.filters.fieldId) parts.push(`地块编号：${response.filters.fieldId}`);
  if (response.filters.operationId) parts.push(`作业编号：${response.filters.operationId}`);
  return parts.length ? parts.join(" · ") : "未选择作业；当前仅展示可见价值记录摘要，不进入完整价值链追溯。";
}

const OPERATION_SELECTION_ITEMS = [
  "价值假设",
  "成本预测",
  "执行证据",
  "验收结果",
  "田块记忆",
  "技能 / 规则表现",
];

export function buildOperatorRoiLedgerVm(response: OperatorRoiLedgerResponse): OperatorRoiLedgerVm {
  const rows = (response.items ?? []).map(buildRow);
  const needsOperationSelection = !String(response.filters.operationId ?? "").trim();
  return {
    title: "ROI 明细账",
    lead: "按地块 / 作业追溯 ROI 明细，区分实测、估算、假设与证据不足。",
    generatedAtText: dateText(response.generated_at),
    dataScopeText: dataScopeText(response),
    dataScopeWarning: response.dataScope === "FALLBACK_LIMITED" ? text(response.message, "当前展示有限 fallback ROI 数据，非完整 operator roi-ledger。") : undefined,
    filterText: filterText(response),
    needsOperationSelection,
    operationSelectionTitle: "请选择作业查看价值链",
    operationSelectionDescription: "选择一个作业后，系统将展示：",
    operationSelectionItems: OPERATION_SELECTION_ITEMS,
    totalCount: rows.length,
    rows,
    measuredRows: rows.filter((row) => row.valueKindText === "实测"),
    estimatedRows: rows.filter((row) => row.valueKindText === "估算"),
    assumptionRows: rows.filter((row) => row.valueKindText === "基于假设"),
    insufficientRows: rows.filter((row) => row.valueKindText === "证据不足" || row.valueKindText === "实测条件不足"),
    emptyTitle: needsOperationSelection ? "请选择作业查看价值链" : "暂无 ROI 明细",
    emptyDescription: needsOperationSelection ? "选择一个作业后，系统将展示价值假设、成本预测、执行证据、验收结果、田块记忆和技能 / 规则表现。" : "当前过滤条件下没有 ROI 明细、作业、证据引用或计算方法可展示。",
  };
}
