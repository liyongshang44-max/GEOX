import type { OperatorLearningValidationV1 } from "../api/operatorLearningValidation";
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
  backendValidationText: string;
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
  learningValidation?: OperatorLearningValidationV1 | null;
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

function formalEvidenceStatus(roiRows: OperatorRoiLedgerRowVm[], memoryRows: OperatorFieldMemoryRowVm[]): string {
  const trustedRoi = roiRows.some((row) => row.customerVisibleValue === true);
  const formalMemory = memoryRows.some((row) => row.learningGateText === "已通过正式学习门禁");
  if (trustedRoi || formalMemory) return "正式链路证据已通过";
  const hasRawEvidence = roiRows.some((row) => isKnown(row.evidenceRefText)) || memoryRows.some((row) => isKnown(row.evidenceRefsText));
  return hasRawEvidence ? "存在证据信号，待正式门禁确认" : "证据待补充";
}

function acceptanceResult(memoryRows: OperatorFieldMemoryRowVm[], roiRows: OperatorRoiLedgerRowVm[]): string {
  if (memoryRows.some((row) => row.learningGateText === "已通过正式学习门禁")) return "正式验收学习已关联";
  if (roiRows.some((row) => row.customerVisibleValue === true)) return "正式价值验收已关联";
  if (memoryRows.some((row) => isKnown(row.acceptanceIdText))) return "验收记录已关联，但未通过学习门禁";
  return "验收结果待补充";
}

function skillTraceText(skillTrace: OperatorSkillTraceResponse | null | undefined): string {
  if (!skillTrace || skillTrace.notReady) return skillTrace?.message || "技能运行记录查询接口未接入。";
  const rawEntered = (skillTrace.items ?? []).filter((item) => item.enteredLearning === true).length;
  return skillTrace.items.length
    ? `${skillTrace.items.length} 条技能运行记录${rawEntered ? `；${rawEntered} 条仅作为学习信号` : ""}`
    : "暂无技能运行记录";
}

function performanceText(performance: OperatorSkillPerformanceResponse | null | undefined): string {
  if (!performance || performance.notReady) return performance?.message || "技能 / 规则表现查询接口未接入。";
  return performance.items.length ? `${performance.items.length} 条技能 / 规则表现记录，需经过学习门禁后才算生效。` : "暂无技能 / 规则表现更新记录";
}

function detectWeatherExclusion(roiRows: OperatorRoiLedgerRowVm[], memoryRows: OperatorFieldMemoryRowVm[], skillTrace: OperatorSkillTraceResponse | null | undefined): boolean {
  const memoryHit = memoryRows.some((row) => [row.learnedText, row.learningGateText, row.confidenceText, row.deltaText, row.beforeText, row.afterText].some(includesWeatherInterference));
  const roiHit = roiRows.some((row) => [row.assumptionText, row.measuredAllowedText, row.confidenceText, row.calculationMethodText, row.valueGateText].some(includesWeatherInterference));
  const traceHit = (skillTrace?.items ?? []).some((item) => [item.inputSummary, item.outputSummary, item.failureReason].some(includesWeatherInterference));
  return memoryHit || roiHit || traceHit;
}

function hasFormalLearning(memoryRows: OperatorFieldMemoryRowVm[]): boolean {
  return memoryRows.some((row) => row.learningGateText === "已通过正式学习门禁");
}

function hasTrustedValue(roiRows: OperatorRoiLedgerRowVm[]): boolean {
  return roiRows.some((row) => row.customerVisibleValue === true);
}

function rawLearningSignals(memoryRows: OperatorFieldMemoryRowVm[], skillTrace: OperatorSkillTraceResponse | null | undefined): number {
  const memorySignals = memoryRows.filter((row) => /已学习|学到了|已进入学习|证据信号/.test(row.learnedText)).length;
  const traceSignals = (skillTrace?.items ?? []).filter((item) => item.enteredLearning === true).length;
  return memorySignals + traceSignals;
}

function backendValidationText(validation: OperatorLearningValidationV1 | null | undefined, operationId: string): string {
  if (!operationId) return "请选择作业查看学习闭环。";
  if (!validation) return "尚未返回正式学习门禁结果；请选择已完成验收的作业或稍后刷新。";
  return `${validation.learning_validation_status}；正式田块记忆 ${validation.formal_memory_count} 条，可信价值 ${validation.trusted_value_count} 条，原始信号 ${validation.raw_signal_count} 条。`;
}

function backendTone(validation: OperatorLearningValidationV1): OperatorLearningClosureVm["learningEffectiveTone"] {
  if (validation.learning_effective) return "success";
  if (validation.learning_validation_status === "SIMULATED_OR_DEV_ONLY") return "danger";
  if (validation.learning_validation_status === "RAW_SIGNALS_ONLY" || validation.learning_validation_status === "TRUSTED_VALUE_ONLY") return "warning";
  return "neutral";
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
    { label: "查看学习门禁", href: `/operator/learning-closure?${query.toString()}` },
    { label: "查看证据摘要入口", href: `/operator/evidence?operation_id=${encodeURIComponent(operationId)}` },
  ];
}

export function buildOperatorLearningClosureVm(input: OperatorLearningClosureInput): OperatorLearningClosureVm {
  const operationId = text(input.operationId, "");
  const explicitFieldId = text(input.fieldId, "");
  const roiRows = input.roiRows ?? [];
  const memoryRows = input.fieldMemoryRows ?? [];
  const validation = input.learningValidation ?? null;
  const fieldId = explicitFieldId || text(input.skillTrace?.items.find((item) => item.fieldId)?.fieldId, "");
  const weatherExcluded = detectWeatherExclusion(roiRows, memoryRows, input.skillTrace);
  const formalLearning = hasFormalLearning(memoryRows);
  const trustedValue = hasTrustedValue(roiRows);
  const signalCount = rawLearningSignals(memoryRows, input.skillTrace);

  const localLearningExcludedReasonText = !operationId
    ? "请选择作业查看学习闭环。"
    : weatherExcluded
      ? "因降雨干扰，本次结果未进入灌溉效果学习。"
      : formalLearning
        ? "已通过正式学习门禁。"
        : signalCount > 0
          ? `存在 ${signalCount} 条学习信号，但未通过正式学习门禁。`
          : "暂无通过正式学习门禁的证据。";

  const localLearningEffectiveText = !operationId
    ? "请选择作业查看学习闭环"
    : weatherExcluded
      ? "未生效"
      : formalLearning
        ? "已生效"
        : signalCount > 0 || trustedValue
          ? "待正式门禁确认"
          : "待确认";

  const localLearningEffectiveTone: OperatorLearningClosureVm["learningEffectiveTone"] = !operationId
    ? "neutral"
    : weatherExcluded
      ? "warning"
      : formalLearning
        ? "success"
        : signalCount > 0 || trustedValue
          ? "warning"
          : "neutral";

  const learningEffectiveText = validation
    ? (validation.learning_effective ? "已生效" : "未通过后端学习门禁")
    : localLearningEffectiveText;
  const learningExcludedReasonText = validation
    ? (validation.customer_summary.no_learning_reason ?? validation.customer_summary.learned)
    : localLearningExcludedReasonText;
  const learningEffectiveTone = validation ? backendTone(validation) : localLearningEffectiveTone;

  const vm: OperatorLearningClosureVm = {
    operationIdText: operationId || "未选择作业",
    evidenceStatusText: operationId ? formalEvidenceStatus(roiRows, memoryRows) : "请选择作业查看学习闭环",
    acceptanceResultText: operationId ? acceptanceResult(memoryRows, roiRows) : "请选择作业查看学习闭环",
    roiEntryText: operationId ? `${roiRows.length} 条价值记录；${roiRows.filter((row) => row.customerVisibleValue).length} 条通过正式价值门禁` : "请选择作业查看学习闭环",
    fieldMemoryEntryText: validation
      ? `${validation.raw_counts.field_memory_rows} 条田块记忆；${validation.formal_memory_count} 条通过后端正式学习门禁`
      : operationId ? `${memoryRows.length} 条田块记忆；${memoryRows.filter((row) => row.learningGateText === "已通过正式学习门禁").length} 条正式学习` : "请选择作业查看学习闭环",
    skillTraceText: validation
      ? `${validation.raw_counts.skill_trace_rows} 条技能运行记录；${validation.raw_signal_count} 条仅作为原始信号`
      : operationId ? skillTraceText(input.skillTrace) : "请选择作业查看学习闭环",
    performanceText: operationId ? performanceText(input.performance) : "请选择作业查看学习闭环",
    learningEffectiveText,
    learningExcludedReasonText,
    learningEffectiveTone,
    backendValidationText: backendValidationText(validation, operationId),
    rows: [],
    actions: actionLinks(operationId, fieldId),
  };
  vm.rows = operationId ? [
    { label: "作业编号", value: vm.operationIdText },
    { label: "后端学习门禁", value: vm.backendValidationText },
    { label: "证据状态", value: vm.evidenceStatusText },
    { label: "验收结果", value: vm.acceptanceResultText },
    { label: "价值记录", value: vm.roiEntryText },
    { label: "田块记忆", value: vm.fieldMemoryEntryText },
    { label: "技能运行记录", value: vm.skillTraceText },
    { label: "技能 / 规则表现", value: vm.performanceText },
    { label: "学习是否生效", value: vm.learningEffectiveText },
    { label: "学习排除原因", value: vm.learningExcludedReasonText },
  ] : [
    { label: "学习闭环", value: "请选择作业查看学习闭环" },
  ];
  return vm;
}
