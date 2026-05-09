import type { OperatorRoiLedgerItem, OperatorRoiLedgerResponse, OperatorRoiValueKind } from "../api/operatorRoiLedger";

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
  operationHref?: string | null;
};

export type OperatorRoiLedgerVm = {
  title: string;
  lead: string;
  generatedAtText: string;
  dataScopeText: string;
  dataScopeWarning?: string;
  filterText: string;
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
  return raw;
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
  const id = text(operationId);
  return id ? `/customer/operations/${encodeURIComponent(id)}` : null;
}

function measuredAllowedText(item: OperatorRoiLedgerItem): string {
  if (item.valueKind !== "MEASURED") return "非实测项，需按估算/假设口径解读。";
  if (!item.baselinePresent) return "无 baseline，不显示“实测收益”。";
  if (!item.actualPresent) return "缺少 actual，不显示“实测收益”。";
  return "baseline 与 actual 已提供，可按实测口径解读。";
}

function buildRow(item: OperatorRoiLedgerItem): OperatorRoiLedgerRowVm {
  return {
    roiId: text(item.roiId, "roi_id 待确认"),
    operationIdText: text(item.operationId, "operation_id 待确认"),
    prescriptionIdText: text(item.prescriptionId, "prescription_id 待确认"),
    evidenceRefText: text(item.evidenceRef, "evidence_ref 待确认"),
    calculationMethodText: text(item.calculationMethod, "calculation method 待确认"),
    confidenceText: text(item.confidenceText, "confidence 待确认"),
    assumptionText: text(item.assumptionText, "assumption 待确认"),
    createdAtText: dateText(item.createdAt),
    valueKindText: valueKindText(item.valueKind, item.baselinePresent, item.actualPresent),
    valueKindTone: valueKindTone(item.valueKind, item.baselinePresent, item.actualPresent),
    metricText: text(item.metricText, "ROI 指标待确认"),
    valueText: text(item.valueText, "数值待确认"),
    sourceText: sourceText(item.source),
    measuredAllowedText: measuredAllowedText(item),
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
  if (response.filters.fieldId) parts.push(`field=${response.filters.fieldId}`);
  if (response.filters.operationId) parts.push(`operation=${response.filters.operationId}`);
  return parts.length ? parts.join(" · ") : "未设置过滤条件，展示当前可见 ROI 明细。";
}

export function buildOperatorRoiLedgerVm(response: OperatorRoiLedgerResponse): OperatorRoiLedgerVm {
  const rows = (response.items ?? []).map(buildRow);
  return {
    title: "ROI 明细账",
    lead: "按 field / operation 追溯 ROI 明细，区分实测、估算、假设与证据不足。",
    generatedAtText: dateText(response.generated_at),
    dataScopeText: dataScopeText(response),
    dataScopeWarning: response.dataScope === "FALLBACK_LIMITED" ? response.message || "当前展示有限 fallback ROI 数据，非完整 operator roi-ledger。" : undefined,
    filterText: filterText(response),
    totalCount: rows.length,
    rows,
    measuredRows: rows.filter((row) => row.valueKindText === "实测"),
    estimatedRows: rows.filter((row) => row.valueKindText === "估算"),
    assumptionRows: rows.filter((row) => row.valueKindText === "基于假设"),
    insufficientRows: rows.filter((row) => row.valueKindText === "证据不足" || row.valueKindText === "实测条件不足"),
    emptyTitle: "暂无 ROI 明细",
    emptyDescription: "当前过滤条件下没有 roi_id、operation_id、evidence_ref 或 calculation method 可展示。",
  };
}
