import type { OperatorEvidenceItem, OperatorEvidenceJobStatus, OperatorEvidenceResponse, OperatorEvidenceScopeStatus, OperatorEvidenceStorageMode } from "../api/operatorEvidence";
import { mapOperatorStatusLabel, replaceOperatorTerms } from "../lib/operatorStatusLabels";

export type OperatorEvidenceRowVm = {
  jobId: string;
  title: string;
  objectText: string;
  statusText: string;
  statusTone: "danger" | "warning" | "success" | "neutral";
  manifestText: string;
  checksumText: string;
  artifactText: string;
  formatText: string;
  scopeText: string;
  storageText: string;
  downloadText: string;
  downloadUrl?: string | null;
  createdAtText: string;
  completedAtText: string;
  failureReasonText: string;
  sourceText: string;
  operationHref?: string | null;
};

export type OperatorEvidenceVm = {
  title: string;
  lead: string;
  generatedAtText: string;
  dataScopeText: string;
  dataScopeWarning?: string;
  exportReady: boolean;
  totalCount: number;
  rows: OperatorEvidenceRowVm[];
  failedRows: OperatorEvidenceRowVm[];
  missingChecksumRows: OperatorEvidenceRowVm[];
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
  if (!Number.isFinite(ms) || ms <= 0) return "暂无记录";
  return new Date(ms).toLocaleString("zh-CN", { hour12: false });
}

function statusText(value: OperatorEvidenceJobStatus): string {
  if (value === "PENDING") return "等待导出";
  if (value === "RUNNING") return "导出中";
  if (value === "DONE") return "已完成";
  if (value === "FAILED") return "导出失败";
  return mapOperatorStatusLabel(value, "evidence", "状态待确认");
}

function statusTone(value: OperatorEvidenceJobStatus): OperatorEvidenceRowVm["statusTone"] {
  if (value === "FAILED") return "danger";
  if (value === "PENDING" || value === "RUNNING") return "warning";
  if (value === "DONE") return "success";
  return "neutral";
}

function storageText(value: OperatorEvidenceStorageMode): string {
  if (value === "OBJECT_STORE") return "对象存储";
  if (value === "LOCAL") return "本地存储（路径已隐藏）";
  if (value === "INLINE") return "内联摘要";
  if (value === "NOT_READY") return "存储模式未接入";
  return "存储模式待确认";
}

function scopeStatusText(value: OperatorEvidenceScopeStatus): string {
  if (value === "READY") return "已接入";
  if (value === "NOT_READY") return "未接入";
  return "状态待确认";
}

function sourceText(value: OperatorEvidenceItem["source"]): string {
  if (value === "operator_evidence_api") return "运营证据接口";
  if (value === "evidence_export_jobs") return "证据导出任务 fallback";
  return "报告聚合 fallback";
}

function operationHref(operationId: unknown): string | null {
  const id = String(operationId ?? "").trim();
  return id ? `/customer/operations/${encodeURIComponent(id)}` : null;
}

function buildRow(item: OperatorEvidenceItem): OperatorEvidenceRowVm {
  const scope = [text(item.scopeType, "导出范围未接入"), text(item.scopeId, "对象未接入"), scopeStatusText(item.scopeStatus)].join(" · ");
  return {
    jobId: item.jobId,
    title: `证据导出任务 ${item.jobId}`,
    objectText: text(item.operationId, "作业范围未接入"),
    statusText: statusText(item.status),
    statusTone: statusTone(item.status),
    manifestText: text(item.manifestText, "证据清单暂无摘要"),
    checksumText: text(item.sha256, "暂无文件校验值"),
    artifactText: text(item.artifactText, "证据对象标识未提供"),
    formatText: text(item.format, "导出格式未提供"),
    scopeText: scope,
    storageText: storageText(item.storageMode),
    downloadText: text(item.downloadStatus, "下载状态待确认"),
    downloadUrl: String(item.downloadUrl ?? "").trim() || null,
    createdAtText: dateText(item.createdAt),
    completedAtText: dateText(item.completedAt),
    failureReasonText: text(item.failureReason, item.status === "FAILED" ? "失败原因待补充" : "无失败原因"),
    sourceText: sourceText(item.source),
    operationHref: operationHref(item.operationId),
  };
}

function dataScopeText(response: OperatorEvidenceResponse): string {
  if (response.dataScope === "OFFICIAL_OPERATOR_API") return "正式运营证据中心";
  if (response.dataScope === "FALLBACK_LIMITED") return "有限 fallback 证据中心";
  if (response.dataScope === "ERROR_EMPTY") return "证据中心暂不可用";
  return "暂无证据导出任务";
}

export function buildOperatorEvidenceVm(response: OperatorEvidenceResponse): OperatorEvidenceVm {
  const rows = (response.items ?? []).map(buildRow);
  return {
    title: "证据中心",
    lead: "查看证据包状态、证据清单、文件校验值、证据对象标识、存储模式与失败原因。",
    generatedAtText: dateText(response.generated_at),
    dataScopeText: dataScopeText(response),
    dataScopeWarning: response.dataScope === "FALLBACK_LIMITED" ? replaceOperatorTerms(response.message || "当前展示有限 fallback 证据数据，非完整 operator evidence。") : undefined,
    exportReady: response.exportReady,
    totalCount: rows.length,
    rows,
    failedRows: rows.filter((row) => row.statusText === "导出失败"),
    missingChecksumRows: rows.filter((row) => row.checksumText === "暂无文件校验值"),
    emptyTitle: "暂无证据导出任务",
    emptyDescription: "当前没有证据导出任务、证据清单或文件校验值可展示。",
  };
}
