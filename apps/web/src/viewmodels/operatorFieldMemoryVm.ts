import type { OperatorFieldMemoryItem, OperatorFieldMemoryResponse } from "../api/operatorFieldMemory";

export type OperatorFieldMemoryRowVm = {
  memoryId: string;
  memoryTypeText: string;
  objectText: string;
  beforeText: string;
  afterText: string;
  deltaText: string;
  confidenceText: string;
  skillRefsText: string;
  evidenceRefsText: string;
  recommendationIdText: string;
  taskIdText: string;
  acceptanceIdText: string;
  roiIdText: string;
  createdAtText: string;
  updatedAtText: string;
  sourceText: string;
  operationHref?: string | null;
  fieldHref?: string | null;
};

export type OperatorFieldMemoryGroupVm = {
  memoryType: string;
  count: number;
  rows: OperatorFieldMemoryRowVm[];
};

export type OperatorFieldMemoryVm = {
  title: string;
  lead: string;
  generatedAtText: string;
  dataScopeText: string;
  dataScopeWarning?: string;
  permissionDenied: boolean;
  filterText: string;
  totalCount: number;
  groups: OperatorFieldMemoryGroupVm[];
  rows: OperatorFieldMemoryRowVm[];
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

function refsText(value: string[]): string {
  return value.length ? value.join("、") : "无引用";
}

function sourceText(value: OperatorFieldMemoryItem["source"]): string {
  if (value === "operator_field_memory_api") return "运营田块记忆接口";
  if (value === "operation_field_memory_api") return "作业田块记忆 fallback";
  return "田块记忆接口 fallback";
}

function operationHref(operationId: unknown): string | null {
  const id = text(operationId);
  return id ? `/customer/operations/${encodeURIComponent(id)}` : null;
}

function fieldHref(fieldId: unknown): string | null {
  const id = text(fieldId);
  return id ? `/customer/fields/${encodeURIComponent(id)}` : null;
}

function objectText(item: OperatorFieldMemoryItem): string {
  const parts = [item.fieldId ? `field=${item.fieldId}` : "", item.operationId ? `operation=${item.operationId}` : ""].filter(Boolean);
  return parts.length ? parts.join(" · ") : "对象范围待确认";
}

function buildRow(item: OperatorFieldMemoryItem): OperatorFieldMemoryRowVm {
  return {
    memoryId: text(item.memoryId, "memory_id 待确认"),
    memoryTypeText: text(item.memoryType, "memory_type 待确认"),
    objectText: objectText(item),
    beforeText: text(item.beforeText, "before 未提供"),
    afterText: text(item.afterText, "after 未提供"),
    deltaText: text(item.deltaText, "delta 未提供"),
    confidenceText: text(item.confidenceText, "confidence 待确认"),
    skillRefsText: refsText(item.skillRefs),
    evidenceRefsText: refsText(item.evidenceRefs),
    recommendationIdText: text(item.recommendationId, "recommendation_id 待确认"),
    taskIdText: text(item.taskId, "task_id 待确认"),
    acceptanceIdText: text(item.acceptanceId, "acceptance_id 待确认"),
    roiIdText: text(item.roiId, "roi_id 待确认"),
    createdAtText: dateText(item.createdAt),
    updatedAtText: dateText(item.updatedAt),
    sourceText: sourceText(item.source),
    operationHref: operationHref(item.operationId),
    fieldHref: fieldHref(item.fieldId),
  };
}

function dataScopeText(response: OperatorFieldMemoryResponse): string {
  if (response.dataScope === "OFFICIAL_OPERATOR_API") return "正式运营田块记忆";
  if (response.dataScope === "FALLBACK_LIMITED") return "有限 fallback 田块记忆";
  if (response.dataScope === "PERMISSION_DENIED") return "权限不足";
  if (response.dataScope === "ERROR_EMPTY") return "田块记忆暂不可用";
  return "暂无田块记忆明细";
}

function filterText(response: OperatorFieldMemoryResponse): string {
  const parts = [];
  if (response.filters.fieldId) parts.push(`field=${response.filters.fieldId}`);
  if (response.filters.operationId) parts.push(`operation=${response.filters.operationId}`);
  if (response.filters.memoryType) parts.push(`memory_type=${response.filters.memoryType}`);
  return parts.length ? parts.join(" · ") : "未设置过滤条件，展示当前可见运营记忆明细。";
}

function groupByType(rows: OperatorFieldMemoryRowVm[]): OperatorFieldMemoryGroupVm[] {
  const map = new Map<string, OperatorFieldMemoryRowVm[]>();
  for (const row of rows) {
    const key = row.memoryTypeText || "memory_type 待确认";
    map.set(key, [...(map.get(key) ?? []), row]);
  }
  return Array.from(map.entries()).map(([memoryType, groupRows]) => ({ memoryType, count: groupRows.length, rows: groupRows }));
}

export function buildOperatorFieldMemoryVm(response: OperatorFieldMemoryResponse): OperatorFieldMemoryVm {
  const rows = (response.items ?? []).map(buildRow);
  const permissionDenied = response.dataScope === "PERMISSION_DENIED";
  return {
    title: "田块记忆中心",
    lead: "按 field / operation / memory_type 查看田块记忆详情，和客户层摘要保持分离。",
    generatedAtText: dateText(response.generated_at),
    dataScopeText: dataScopeText(response),
    dataScopeWarning: response.dataScope === "FALLBACK_LIMITED" || permissionDenied ? response.message : undefined,
    permissionDenied,
    filterText: filterText(response),
    totalCount: rows.length,
    groups: groupByType(rows),
    rows,
    emptyTitle: permissionDenied ? "权限不足" : "暂无田块记忆明细",
    emptyDescription: permissionDenied ? "当前身份无权查看运营田块记忆明细。" : "当前过滤条件下没有 memory_type、before、after、delta 或证据引用可展示。",
  };
}
