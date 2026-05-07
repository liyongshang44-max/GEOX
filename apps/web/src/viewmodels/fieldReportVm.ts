import type { FieldReportDetailV1 } from "../api/reports";
import { customerFieldMemoryLabel, customerRoiLabel, labelAcceptanceStatus, labelFinalStatus, labelOperationType, labelRiskLevel, sanitizeCustomerText } from "../lib/customerLabels";
import { getCustomerEmptyState } from "../lib/customerEmptyStates";

export type FieldReportPageVm = {
  generatedAtText: string;
  field: { fieldId: string; fieldName: string; cropText: string; stageText: string; updatedAtText: string };
  risk: { levelLabel: string; tone: "neutral" | "warning" | "danger"; reasons: string[] };
  diagnosis: { headline: string; evidenceLines: string[]; dataQualityText: string; latestObservationText: string };
  recommendations: Array<{ title: string; summary: string; href?: string }>;
  recentOperations: Array<{ operationId: string; title: string; statusText: string; acceptanceText: string; evidenceText: string; updatedAtText: string; href: string }>;
  roiSummary: ({ title: string; lines: string[] } | { title: string; description: string }) & { displayText: string };
  fieldMemory: ({ title: string; lines: string[] } | { title: string; description: string }) & { displayText: string };
  exportHref: string;
  hero: {
    title: string;
    subtitle: string;
  };
  landOverview: Array<{ label: string; value: string }>;
  diagnosticCards: Array<{ title: string; value: string; detail: string }>;
  currentStatus: {
    summary: string;
    reasons: string[];
  };
  recentOperationsTop5: Array<{
    id: string;
    title: string;
    statusText: string;
    acceptanceText: string;
    generatedAtText: string;
    href: string;
  }>;
  prescriptionCards: Array<{ title: string; value: string; detail: string }>;
  deviceMonitoring: Array<{ label: string; value: string }>;
  header: { title: string; subtitle: string; fieldId: string };
  overview: { riskText: string; openAlertsText: string; pendingAcceptanceText: string; totalOperationsText: string; latestOperationText: string; estimatedCostText: string; actualCostText: string };
  explain: { human: string; topReasonsText: string[] };
  deviceSummary: { totalText: string; onlineText: string; offlineText: string; lastUpdateText: string };
  nextAction: { title: string; explainText: string; objectiveText: string; priorityText: string } | null;
};

function formatDateTime(value: string | null | undefined, fallback = "--"): string {
  if (!value) return fallback;
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return fallback;
  return new Date(ms).toLocaleString("zh-CN", { hour12: false });
}

function formatCurrency(value: number | null | undefined): string {
  const num = Number(value ?? 0);
  return new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY", maximumFractionDigits: 2 }).format(Number.isFinite(num) ? num : 0);
}

function formatCount(value: number | null | undefined): string {
  const num = Number(value ?? 0);
  return Number.isFinite(num) ? String(num) : "0";
}

export function buildFieldReportVm(report: FieldReportDetailV1): FieldReportPageVm {
  const fieldId = report.field.field_id;
  const fieldName = String(report.field.field_name ?? "").trim();
  const title = fieldName || `地块 ${fieldId}`;


  const overview = {
    riskText: labelRiskLevel(report.overview.current_risk_level),
    openAlertsText: formatCount(report.overview.open_alerts_count),
    pendingAcceptanceText: formatCount(report.overview.pending_acceptance_count),
    totalOperationsText: formatCount(report.overview.total_operations_count),
    latestOperationText: formatDateTime(report.overview.latest_operation_at),
    estimatedCostText: formatCurrency(report.overview.estimated_total_cost),
    actualCostText: formatCurrency(report.overview.actual_total_cost),
  };

  const explainSummaryRaw = String(report.explain.human || "");
  const hasInvalidExecution = explainSummaryRaw.toUpperCase().includes("INVALID_EXECUTION") || (report.explain.top_reasons ?? []).some((x) => String(x ?? "").toUpperCase().includes("INVALID_EXECUTION"));
  const explain = {
    human: hasInvalidExecution ? "该地块存在执行异常，建议复核作业证据。" : sanitizeCustomerText(report.explain.human || "暂无状态解释"),
    topReasonsText: hasInvalidExecution
      ? ["执行异常，建议复核作业证据"]
      : ((report.explain.top_reasons ?? []).length ? (report.explain.top_reasons ?? []).map((item) => sanitizeCustomerText(item)) : ["暂无主要依据"]),
  };
  const riskTone: "neutral" | "warning" | "danger" = overview.riskText.includes("高") ? "danger" : (overview.riskText.includes("中") ? "warning" : "neutral");
  const roiItems = Number(report.value_summary.total_roi_items ?? 0);
  const roiEmptyState = getCustomerEmptyState("NO_ROI");
  const fieldMemoryEmptyState = getCustomerEmptyState("NO_FIELD_MEMORY");
  const roiLines = [
    customerRoiLabel(report.value_summary.customer_value_text || `本地块已有 ${formatCount(report.value_summary.total_roi_items)} 条价值记录`),
    `节水 ${formatCount(report.value_summary.water_saved_items)} 条、节人工 ${formatCount(report.value_summary.labor_saved_items)} 条、预警 ${formatCount(report.value_summary.early_warning_items)} 条`,
    `可信度/假设：低置信 ${formatCount(report.value_summary.low_confidence_items)} 条，假设型 ${formatCount(report.value_summary.assumption_based_items)} 条`,
  ];
  const fieldMemorySummary = (report as any).field_memory_summary;
  const fieldMemoryAvailable = Boolean(
    fieldMemorySummary
    && (
      (Array.isArray(fieldMemorySummary.entries) && fieldMemorySummary.entries.length > 0)
      || (Array.isArray(fieldMemorySummary.items) && fieldMemorySummary.items.length > 0)
      || (typeof fieldMemorySummary.summary_text === "string" && fieldMemorySummary.summary_text.trim().length > 0)
      || fieldMemorySummary.available === true
    )
  );
  const fieldMemoryLines = [
    `历史响应摘要：累计作业 ${formatCount(report.overview.total_operations_count)} 次，待验收 ${formatCount(report.overview.pending_acceptance_count)} 次`,
    `设备可靠性摘要：在线 ${formatCount(report.device_summary.online_devices)}/${formatCount(report.device_summary.total_devices)}，离线 ${formatCount(report.device_summary.offline_devices)}`,
    `技能表现摘要：首验通过价值项 ${formatCount(report.value_summary.first_pass_acceptance_items)} 条，低置信 ${formatCount(report.value_summary.low_confidence_items)} 条`,
  ];

  const deviceSummary = {
    totalText: formatCount(report.device_summary.total_devices),
    onlineText: formatCount(report.device_summary.online_devices),
    offlineText: formatCount(report.device_summary.offline_devices),
    lastUpdateText: formatDateTime(report.device_summary.last_telemetry_at),
  };

  const nextAction = report.next_action ? {
    title: labelOperationType(report.next_action.action_type || "建议执行下一步动作"),
    explainText: sanitizeCustomerText(report.next_action.explain_human || "暂无建议说明"),
    objectiveText: sanitizeCustomerText(report.next_action.objective_text || "暂无目标"),
    priorityText: sanitizeCustomerText(report.next_action.priority || "普通"),
  } : null;

  return {
    generatedAtText: formatDateTime(report.generated_at),
    field: {
      fieldId,
      fieldName: fieldName || "未命名地块",
      cropText: "暂无作物信息",
      stageText: "暂无阶段信息",
      updatedAtText: formatDateTime(report.device_summary.last_telemetry_at),
    },
    risk: { levelLabel: overview.riskText, tone: riskTone, reasons: explain.topReasonsText },
    diagnosis: {
      headline: explain.human,
      evidenceLines: explain.topReasonsText,
      dataQualityText: report.value_summary.low_confidence_items > 0 ? "数据质量需复核" : "数据质量可用",
      latestObservationText: report.overview.latest_operation_at
        ? `最近一次作业观测时间：${formatDateTime(report.overview.latest_operation_at)}`
        : `最近遥测更新时间：${formatDateTime(report.device_summary.last_telemetry_at)}`,
    },
    recommendations: nextAction
      ? [{ title: nextAction.title, summary: nextAction.explainText, href: `/customer/fields/${encodeURIComponent(fieldId)}` }]
      : [],
    recentOperations: report.recent_operations.slice(0, 5).map((item) => {
      // customer-boundary-allow: 兼容旧 operation_plan_id，确保历史数据可跳转
      // customer-boundary-allow: 兼容旧 operation_plan_id，确保历史数据可跳转
    const operationId = String(item.operation_plan_id || item.operation_id || "").trim();
      const finalStatusRaw = String(item.final_status || "").toUpperCase();
      const evidenceText = ["EVIDENCE_MISSING", "NOT_AVAILABLE"].includes(finalStatusRaw) ? "证据缺失" : "证据已回传";
      return {
        operationId,
        title: sanitizeCustomerText(item.customer_title || item.title || "作业"),
        statusText: labelFinalStatus(item.final_status),
        acceptanceText: labelAcceptanceStatus(item.acceptance_status),
        evidenceText,
        updatedAtText: formatDateTime(item.generated_at),
        href: operationId ? `/customer/operations/${encodeURIComponent(operationId)}` : "/customer/dashboard",
      };
    }),
    roiSummary: roiItems > 0
      ? {
        title: "价值记录摘要",
        lines: roiLines,
        displayText: roiLines.join("；"),
      }
      : { title: customerRoiLabel("ROI_UNAVAILABLE"), description: roiEmptyState.description, displayText: `${customerRoiLabel("ROI_UNAVAILABLE")}：${roiEmptyState.description}` },
    fieldMemory: fieldMemoryAvailable
      ? {
        title: "地块记忆摘要",
        lines: fieldMemoryLines,
        displayText: fieldMemoryLines.join("；"),
      }
      : { title: customerFieldMemoryLabel("FIELD_MEMORY_UNAVAILABLE"), description: fieldMemoryEmptyState.description, displayText: `${customerFieldMemoryLabel("FIELD_MEMORY_UNAVAILABLE")}：${fieldMemoryEmptyState.description}` },
    exportHref: `/customer/fields/${encodeURIComponent(fieldId)}/export`,
    hero: {
      title,
      subtitle: "聚焦当前诊断、作业与下一步执行建议",
    },
    landOverview: [
      { label: "风险等级", value: overview.riskText },
      { label: "未关闭告警", value: formatCount(report.overview.open_alerts_count) },
      { label: "待验收作业", value: formatCount(report.overview.pending_acceptance_count) },
      { label: "作业总数", value: formatCount(report.overview.total_operations_count) },
      { label: "最近作业时间", value: formatDateTime(report.overview.latest_operation_at) },
      { label: "预计总成本", value: formatCurrency(report.overview.estimated_total_cost) },
      { label: "实际总成本", value: formatCurrency(report.overview.actual_total_cost) },
    ],
    diagnosticCards: [
      { title: "数据可信", value: report.value_summary.low_confidence_items > 0 ? "需复核" : "较可靠", detail: `低置信证据 ${formatCount(report.value_summary.low_confidence_items)} 条` },
      { title: "土壤水分", value: report.value_summary.water_saved_items > 0 ? "有节水证据" : "待补充", detail: `节水相关价值项 ${formatCount(report.value_summary.water_saved_items)} 条` },
      { title: "外部扰动", value: report.overview.open_alerts_count > 0 ? "存在待处理事项" : "暂无明显扰动", detail: `当前未关闭告警 ${formatCount(report.overview.open_alerts_count)} 条` },
      { title: "作物阶段", value: report.next_action?.objective_text ? "按目标推进" : "阶段信息不足", detail: String(report.next_action?.objective_text || "暂无作物阶段目标描述") },
      { title: "历史表现", value: report.overview.total_operations_count > 0 ? "有历史记录" : "暂无历史", detail: `累计作业 ${formatCount(report.overview.total_operations_count)} 次` },
    ],
    currentStatus: {
      summary: explain.human,
      reasons: explain.topReasonsText,
    },
    recentOperationsTop5: report.recent_operations.slice(0, 5).map((item) => {
      // customer-boundary-allow: 兼容旧 operation_plan_id，确保历史数据可跳转
      const operationId = String(item.operation_plan_id || item.operation_id || "").trim();
      return {
        id: operationId || "--",
        title: sanitizeCustomerText(item.customer_title || item.title || operationId || "未命名作业"),
        statusText: labelFinalStatus(item.final_status),
        acceptanceText: labelAcceptanceStatus(item.acceptance_status),
        generatedAtText: formatDateTime(item.generated_at),
        href: operationId ? `/customer/operations/${encodeURIComponent(operationId)}` : "/customer/dashboard",
      };
    }),
    prescriptionCards: [
      { title: "建议动作", value: labelOperationType(report.next_action?.action_type || "IRRIGATE"), detail: "建议优先执行关键风险处置动作" },
      { title: "建议剂量", value: "按当前处方执行", detail: "如有投入品请遵循作业报告中的剂量配置" },
      { title: "时间窗口", value: "24–72 小时内", detail: "建议在下一个可作业窗口完成" },
      { title: "审批要求", value: report.overview.pending_acceptance_count > 0 ? "需负责人确认" : "常规审批", detail: report.overview.pending_acceptance_count > 0 ? `需负责人确认 + 原因：当前待验收作业 ${formatCount(report.overview.pending_acceptance_count)} 项` : "按常规审批流程执行" },
      { title: "验收条件", value: "完成并回传证据", detail: "需提交执行记录、结果照片或监测数据" },
    ],
    deviceMonitoring: [
      { label: "设备总数", value: formatCount(report.device_summary.total_devices) },
      { label: "在线设备", value: formatCount(report.device_summary.online_devices) },
      { label: "离线设备", value: formatCount(report.device_summary.offline_devices) },
      { label: "最近更新", value: formatDateTime(report.device_summary.last_telemetry_at) },
    ],
    header: { title, subtitle: `地块ID：${fieldId}`, fieldId },
    overview,
    explain,
    deviceSummary,
    nextAction,
  };
}
