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
};

export type OperatorLearningClosureInput = {
  operationId?: string | null;
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
  if (!skillTrace || skillTrace.notReady) return skillTrace?.message || "skill trace 查询接口未接入。";
  return skillTrace.items.length ? `${skillTrace.items.length} 条技能运行记录` : "暂无技能运行记录";
}

function performanceText(performance: OperatorSkillPerformanceResponse | null | undefined): string {
  if (!performance || performance.notReady) return performance?.message || "skill trace 查询接口未接入。";
  return performance.items.length ? `${performance.items.length} 条 Skill / Rule Performance` : "暂无 Skill / Rule Performance";
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

export function buildOperatorLearningClosureVm(input: OperatorLearningClosureInput): OperatorLearningClosureVm {
  const operationId = text(input.operationId, "");
  const roiRows = input.roiRows ?? [];
  const memoryRows = input.fieldMemoryRows ?? [];
  const weatherExcluded = detectWeatherExclusion(roiRows, memoryRows, input.skillTrace);
  const didLearn = enteredLearning(memoryRows, input.skillTrace);
  const learningExcludedReasonText = weatherExcluded
    ? "因降雨干扰，本次结果未进入灌溉效果学习。"
    : didLearn
      ? "未发现学习排除原因。"
      : "暂无进入学习的明确证据。";
  const learningEffectiveText = !operationId
    ? "需选择 operation_id 后判断"
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
    operationIdText: operationId || "未选择 operation_id",
    evidenceStatusText: operationId ? evidenceStatus(roiRows, memoryRows) : "需选择 operation_id 后追溯证据",
    acceptanceResultText: operationId ? acceptanceResult(memoryRows) : "需选择 operation_id 后追溯验收",
    roiEntryText: operationId ? `${roiRows.length} 条 ROI 条目` : "需选择 operation_id 后追溯 ROI",
    fieldMemoryEntryText: operationId ? `${memoryRows.length} 条 Field Memory 条目` : "需选择 operation_id 后追溯 Field Memory",
    skillTraceText: operationId ? skillTraceText(input.skillTrace) : "需选择 operation_id 后追溯 Skill Trace",
    performanceText: operationId ? performanceText(input.performance) : "需选择 operation_id 后追溯 Performance",
    learningEffectiveText,
    learningExcludedReasonText: operationId ? learningExcludedReasonText : "未选择 operation_id，暂不判断学习排除原因。",
    learningEffectiveTone,
    rows: [],
  };
  vm.rows = [
    { label: "作业 ID", value: vm.operationIdText },
    { label: "证据状态", value: vm.evidenceStatusText },
    { label: "验收结果", value: vm.acceptanceResultText },
    { label: "ROI 条目", value: vm.roiEntryText },
    { label: "Field Memory 条目", value: vm.fieldMemoryEntryText },
    { label: "Skill Trace", value: vm.skillTraceText },
    { label: "Rule / Skill Performance", value: vm.performanceText },
    { label: "学习是否生效", value: vm.learningEffectiveText },
    { label: "学习排除原因", value: vm.learningExcludedReasonText },
  ];
  return vm;
}
