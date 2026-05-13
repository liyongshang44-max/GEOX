import type { OperatorSkillPerformanceResponse, OperatorSkillTraceResponse } from "../api/operatorSkillTrace";
import type { OperatorFieldMemoryRowVm } from "./operatorFieldMemoryVm";
import type { OperatorRoiLedgerRowVm } from "./operatorRoiLedgerVm";

export type OperatorLearningClosureVm = {
  operationIdText: string;
  evidenceStatusText: string;
  acceptanceResultText: string;
  roiEntryText: string;
  fieldMemoryEntryText: string;
  skillTraceText: string;
  performanceText: string;
  learningEffectiveText: string;
  learningExcludedReasonText: string;
  learningEffectiveTone: "success" | "warning" | "danger" | "neutral";
  rows: Array<{ label: string; value: string }>;
  actions: Array<{ label: string; href: string }>;
};

export type OperatorLearningClosureInput = {
  operationId?: string | null;
  fieldId?: string | null;
  roiRows?: OperatorRoiLedgerRowVm[];
  fieldMemoryRows?: OperatorFieldMemoryRowVm[];
  skillTrace?: OperatorSkillTraceResponse | null;
  performance?: OperatorSkillPerformanceResponse | null;
};

function text(value: unknown, fallback = ""): string {
  const raw = String(value ?? "").trim();
  if (!raw || raw === "--" || raw === "undefined" || raw === "null") return fallback;
  return raw;
}

function isKnown(value: string): boolean {
  return Boolean(value && !/待确认|未提供|无引用|暂无|不可用|未接入/.test(value));
}

function includesWeatherInterference(value: unknown): boolean {
  return /降雨|天气|雨水|rainfall|rain|weather/i.test(String(value ?? ""));
}

function evidenceStatus(roiRows: OperatorRoiLedgerRowVm[], memoryRows: OperatorFieldMemoryRowVm[]): string {
  const roiEvidence = roiRows.some((row) => isKnown(row.evidenceRefText));
  const memoryEvidence = memoryRows.some((row) => isKnown(row.evidenceRefsText));
  if (roiEvidence || memoryEvidence) return "证据已关联";
  return "证据待补充";
}

function acceptanceResult(memoryRows: OperatorFieldMemoryRowVm[]): string {
  if (memoryRows.some((row) => isKnown(row.acceptanceIdText))) return "验收记录已关联";
  return "验收结果待补充";
}

function skillTraceText(skillTrace: OperatorSkillTraceResponse | null | undefined): string {
  if (!skillTrace || skillTrace.notReady) return skillTrace?.message || "技能运行记录查询接口未接入。";
  return skillTrace.items.length ? `${skillTrace.items.length} 条技能运行记录` : "暂无技能运行记录";
}

function performanceText(performance: OperatorSkillPerformanceResponse | null | undefined): string {
  if (!performance || performance.notReady) return performance?.message || "技能 / 规则表现查询接口未接入。";
  return performance.items.length ? `${performance.items.length} 条技能 / 规则表现记录，本次作业已进入表现评估链。` : "暂无技能 / 规则表现更新记录";
}

function detectWeatherExclusion(roiRows: OperatorRoiLedgerRowVm[], memoryRows: OperatorFieldMemoryRowVm[], skillTrace: OperatorSkillTraceResponse | null | undefined): boolean {
  const memoryHit = memoryRows.some((row) => [row.learnedText, row.confidenceText, row.deltaText, row.beforeText, row.afterText].some(includesWeatherInterference));
  const roiHit = roiRows.some((row) => [row.assumptionText, row.measuredAllowedText, row.confidenceText, row.calculationMethodText].some(includesWeatherInterference));
  const traceHit = (skillTrace?.items ?? []).some((item) => [item.inputSummary, item.outputSummary, item.failureReason].some(includesWeatherInterference));
  return memoryHit || roiHit || traceHit;
}

function enteredLearning(memoryRows: OperatorFieldMemoryRowVm[], skillTrace: OperatorSkillTraceResponse | null | undefined): boolean {
  if (memoryRows.some((row) => /已学习|学到了|已进入学习/.test(row.learnedText))) return true;
  if ((skillTrace?.items ?? []).some((item) => item.enteredLearning === true)) return true;
  return false;
}

function actionLinks(operationId: string, fieldId: string): Array<{ label: string; href: string }> {
  if (!operationId) return [];
  const query = new URLSearchParams({ operation_id: operationId });
  if (fieldId) query.set("field_id", fieldId);
  return [
    { label: "查看作业", href: `/customer/operations/${encodeURIComponent(operationId)}` },
    { label: "查看技能运行记录", href: `/customer/operations/${encodeURIComponent(operationId)}#operation-skill-trace` },
    { label: "查看田块记忆", href: `/operator/field-memory?${query.toString()}` },
    { label: "查看价值记录", href: `/operator/roi-ledger?${query.toString()}` },
    { label: "查看证据摘要入口", href: `/operator/evidence?operation_id=${encodeURIComponent(operationId)}` },
  ];
}

export function buildOperatorLearningClosureVm(input: OperatorLearningClosureInput): OperatorLearningClosureVm {
  const operationId = text(input.operationId, "");
  const explicitFieldId = text(input.fieldId, "");
  const roiRows = input.roiRows ?? [];
  const memoryRows = input.fieldMemoryRows ?? [];
  const fieldId = explicitFieldId || text(input.skillTrace?.items.find((item) => item.fieldId)?.fieldId, "");
  const weatherExcluded = detectWeatherExclusion(roiRows, memoryRows, input.skillTrace);
  const didLearn = enteredLearning(memoryRows, input.skillTrace);
  const learningExcludedReasonText = weatherExcluded
    ? "因降雨干扰，本次结果未进入灌溉效果学习。"
    : didLearn
      ? "未发现学习排除原因。"
      : "暂无进入学习的明确证据。";
  const learningEffectiveText = !operationId
    ? "需选择作业后判断"
    : weatherExcluded
      ? "未生效"
      : didLearn
        ? "已生效"
        : "待确认";
  const learningEffectiveTone: OperatorLearningClosureVm["learningEffectiveTone"] = !operationId
    ? "neutral"
    : weatherExcluded
      ? "warning"
      : didLearn
        ? "success"
        : "neutral";
  const vm: OperatorLearningClosureVm = {
    operationIdText: operationId || "未选择作业",
    evidenceStatusText: operationId ? evidenceStatus(roiRows, memoryRows) : "需选择作业后追溯证据",
    acceptanceResultText: operationId ? acceptanceResult(memoryRows) : "需选择作业后追溯验收",
    roiEntryText: operationId ? `${roiRows.length} 条价值记录` : "需选择作业后追溯价值记录",
    fieldMemoryEntryText: operationId ? `${memoryRows.length} 条田块记忆` : "需选择作业后追溯田块记忆",
    skillTraceText: operationId ? skillTraceText(input.skillTrace) : "需选择作业后追溯技能运行记录",
    performanceText: operationId ? performanceText(input.performance) : "需选择作业后追溯技能 / 规则表现",
    learningEffectiveText,
    learningExcludedReasonText: operationId ? learningExcludedReasonText : "未选择作业，暂不判断学习排除原因。",
    learningEffectiveTone,
    rows: [],
    actions: actionLinks(operationId, fieldId),
  };
  vm.rows = [
    { label: "作业编号", value: vm.operationIdText },
    { label: "证据状态", value: vm.evidenceStatusText },
    { label: "验收结果", value: vm.acceptanceResultText },
    { label: "价值记录", value: vm.roiEntryText },
    { label: "田块记忆", value: vm.fieldMemoryEntryText },
    { label: "技能运行记录", value: vm.skillTraceText },
    { label: "技能 / 规则表现", value: vm.performanceText },
    { label: "学习是否生效", value: vm.learningEffectiveText },
    { label: "学习排除原因", value: vm.learningExcludedReasonText },
  ];
  return vm;
}
