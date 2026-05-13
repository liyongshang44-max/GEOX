import type { OperatorFieldMemoryItem, OperatorFieldMemoryResponse } from "../api/operatorFieldMemory";
import { replaceOperatorTerms } from "../lib/operatorStatusLabels";

export type OperatorFieldMemoryTechnicalRefsVm = {
  memoryIdText: string;
  recommendationIdText: string;
  taskIdText: string;
  acceptanceIdText: string;
  roiIdText: string;
  evidenceRefsText: string;
  skillRefsText: string;
  sourceText: string;
};

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
  learnedText: string;
  technicalRefs: OperatorFieldMemoryTechnicalRefsVm;
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
  needsOperationSelection: boolean;
  operationSelectionTitle: string;
  operationSelectionDescription: string;
  operationSelectionItems: string[];
  totalCount: number;
  groups: OperatorFieldMemoryGroupVm[];
  rows: OperatorFieldMemoryRowVm[];
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

function refsText(value: string[]): string {
  return value.length ? value.map((item) => text(item)).join("、") : "无引用";
}

function sourceText(value: OperatorFieldMemoryItem["source"]): string {
  if (value === "operator_field_memory_api") return "运营田块记忆接口";
  if (value === "operation_field_memory_api") return "作业田块记忆 fallback";
  return "田块记忆接口 fallback";
}

function operationHref(operationId: unknown): string | null {
  const id = String(operationId ?? "").trim();
  return id ? `/customer/operations/${encodeURIComponent(id)}` : null;
}

function fieldHref(fieldId: unknown): string | null {
  const id = String(fieldId ?? "").trim();
  return id ? `/customer/fields/${encodeURIComponent(id)}` : null;
}

function objectText(item: OperatorFieldMemoryItem): string {
  const parts = [item.fieldId ? `地块编号：${item.fieldId}` : "", item.operationId ? `作业编号：${item.operationId}` : ""].filter(Boolean);
  return parts.length ? parts.join(" · ") : "对象范围待确认";
}

function learnedText(item: OperatorFieldMemoryItem): string {
  if (item.learned === false) return text(item.learningExcludedReason, "未纳入学习");
  if (item.learnedWhat) return text(item.learnedWhat);
  if ((item.evidenceRefs ?? []).length === 0) return "无证据，不学习";
  return "已学习：变化前、变化后与变化量已更新";
}

function buildTechnicalRefs(item: OperatorFieldMemoryItem): OperatorFieldMemoryTechnicalRefsVm {
  return {
    memoryIdText: text(item.memoryId, "记忆记录待确认"),
    recommendationIdText: text(item.recommendationId, "建议记录待确认"),
    taskIdText: text(item.taskId, "执行任务待确认"),
    acceptanceIdText: text(item.acceptanceId, "验收记录待确认"),
    roiIdText: text(item.roiId, "价值记录待确认"),
    evidenceRefsText: refsText(item.evidenceRefs),
    skillRefsText: refsText(item.skillRefs),
    sourceText: sourceText(item.source),
  };
}

function buildRow(item: OperatorFieldMemoryItem): OperatorFieldMemoryRowVm {
  const technicalRefs = buildTechnicalRefs(item);
  return {
    memoryId: technicalRefs.memoryIdText,
    memoryTypeText: text(item.memoryType, "记忆类型待确认"),
    objectText: objectText(item),
    beforeText: text(item.beforeText, "变化前状态未提供"),
    afterText: text(item.afterText, "变化后状态未提供"),
    deltaText: text(item.deltaText, "变化量未提供"),
    confidenceText: text(item.confidenceText, "置信度待确认"),
    skillRefsText: technicalRefs.skillRefsText,
    evidenceRefsText: technicalRefs.evidenceRefsText,
    recommendationIdText: technicalRefs.recommendationIdText,
    taskIdText: technicalRefs.taskIdText,
    acceptanceIdText: technicalRefs.acceptanceIdText,
    roiIdText: technicalRefs.roiIdText,
    createdAtText: dateText(item.createdAt),
    updatedAtText: dateText(item.updatedAt),
    sourceText: technicalRefs.sourceText,
    learnedText: learnedText(item),
    technicalRefs,
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
  const parts: string[] = [];
  if (response.filters.fieldId) parts.push(`地块编号：${response.filters.fieldId}`);
  if (response.filters.operationId) parts.push(`作业编号：${response.filters.operationId}`);
  if (response.filters.memoryType) parts.push(`记忆类型：${replaceOperatorTerms(response.filters.memoryType)}`);
  return parts.length ? parts.join(" · ") : "未选择作业；当前仅展示可见田块记忆摘要，不进入完整学习闭环追溯。";
}

function groupByType(rows: OperatorFieldMemoryRowVm[]): OperatorFieldMemoryGroupVm[] {
  const map = new Map<string, OperatorFieldMemoryRowVm[]>();
  for (const row of rows) {
    const key = row.memoryTypeText || "记忆类型待确认";
    map.set(key, [...(map.get(key) ?? []), row]);
  }
  return Array.from(map.entries()).map(([memoryType, groupRows]) => ({ memoryType, count: groupRows.length, rows: groupRows }));
}

const OPERATION_SELECTION_ITEMS = [
  "变化前状态",
  "变化后状态",
  "变化量",
  "执行证据",
  "验收结果",
  "价值记录",
  "技能 / 规则表现",
];

export function buildOperatorFieldMemoryVm(response: OperatorFieldMemoryResponse): OperatorFieldMemoryVm {
  const rows = (response.items ?? []).map(buildRow);
  const permissionDenied = response.dataScope === "PERMISSION_DENIED";
  const needsOperationSelection = !String(response.filters.operationId ?? "").trim();
  return {
    title: "田块记忆中心",
    lead: "按地块 / 作业 / 记忆类型查看田块记忆详情，明确“学到了什么”，并标注证据与排除原因。",
    generatedAtText: dateText(response.generated_at),
    dataScopeText: dataScopeText(response),
    dataScopeWarning: response.dataScope === "FALLBACK_LIMITED" || permissionDenied ? text(response.message) : undefined,
    permissionDenied,
    filterText: filterText(response),
    needsOperationSelection,
    operationSelectionTitle: "请选择作业查看田块记忆链",
    operationSelectionDescription: "选择一个作业后，系统将展示：",
    operationSelectionItems: OPERATION_SELECTION_ITEMS,
    totalCount: rows.length,
    groups: groupByType(rows),
    rows,
    emptyTitle: permissionDenied ? "权限不足" : (needsOperationSelection ? "请选择作业查看田块记忆链" : "暂无田块记忆明细"),
    emptyDescription: permissionDenied ? "当前身份无权查看运营田块记忆明细。" : (needsOperationSelection ? "选择一个作业后，系统将展示变化前状态、变化后状态、变化量、执行证据、验收结果、价值记录和技能 / 规则表现。" : "当前过滤条件下没有田块记忆、变化状态或证据引用可展示。"),
  };
}
