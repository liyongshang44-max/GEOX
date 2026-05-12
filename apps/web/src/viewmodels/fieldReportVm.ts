import type { FieldReportDetailV1 } from "../api/customerReports";
import { customerFieldMemoryLabel, customerRoiLabel, labelAcceptanceStatus, labelFinalStatus, labelOperationType, labelRiskLevel, sanitizeCustomerText } from "../lib/customerLabels";
import { getCustomerEmptyState } from "../lib/customerEmptyStates";

export type FieldMapMarkerVm = { device_id: string; lat: number; lon: number; ts_ms?: number | null };
export type FieldMapTrajectorySegmentVm = { id: string; status: "READY" | "DISPATCHED" | "SUCCEEDED" | "FAILED"; color: string; coordinates: Array<[number, number]>; label?: string };
export type FieldMapAcceptancePointVm = { id: string; status: string; lat: number; lon: number };
export type FieldMapLayersVm = { plannedGeoJson: unknown | null; coverageGeoJson: unknown | null; trajectorySegments: FieldMapTrajectorySegmentVm[]; acceptancePoints: FieldMapAcceptancePointVm[]; deviceMarkers: FieldMapMarkerVm[]; hasAnyOperationLayer: boolean; summaryText: string };

export type FieldReportPageVm = {
  generatedAtText: string;
  field: { fieldId: string; fieldName: string; cropText: string; stageText: string; updatedAtText: string };
  risk: { levelLabel: string; tone: "neutral" | "warning" | "danger"; reasons: string[] };
  diagnosis: { headline: string; evidenceLines: string[]; dataQualityText: string; latestObservationText: string };
  recommendations: Array<{ title: string; summary: string; href?: string }>;
  recentOperations: Array<{ operationId: string; title: string; statusText: string; acceptanceText: string; evidenceText: string; updatedAtText: string; href: string }>;
  roiSummary: ({ title: string; lines: string[] } | { title: string; description: string }) & { displayText: string };
  fieldMemory: ({ title: string; lines: string[] } | { title: string; description: string }) & { displayText: string };
  mapLayers: FieldMapLayersVm;
  exportHref: string;
  hero: { title: string; subtitle: string };
  landOverview: Array<{ label: string; value: string }>;
  diagnosticCards: Array<{ title: string; value: string; detail: string }>;
  currentStatus: { summary: string; reasons: string[] };
  recentOperationsTop5: Array<{ id: string; title: string; statusText: string; acceptanceText: string; generatedAtText: string; href: string }>;
  prescriptionCards: Array<{ title: string; value: string; detail: string }>;
  deviceMonitoring: Array<{ label: string; value: string }>;
  header: { title: string; subtitle: string; fieldId: string };
  overview: { riskText: string; openAlertsText: string; pendingAcceptanceText: string; totalOperationsText: string; latestOperationText: string; estimatedCostText: string; actualCostText: string };
  explain: { human: string; topReasonsText: string[] };
  deviceSummary: { totalText: string; onlineText: string; offlineText: string; lastUpdateText: string };
  nextAction: { title: string; explainText: string; objectiveText: string; priorityText: string } | null;
};

function formatDateTime(value: string | null | undefined, fallback = "暂无更新时间"): string {
  if (!value) return fallback;
  const ms = Date.parse(value);
  if (!Number.isFinite(ms) || ms <= 0) return fallback;
  const d = new Date(ms);
  if (d.getUTCFullYear() <= 1970) return fallback;
  return d.toLocaleString("zh-CN", { hour12: false });
}

function formatCurrency(value: number | null | undefined): string {
  const num = Number(value ?? 0);
  return new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY", maximumFractionDigits: 2 }).format(Number.isFinite(num) ? num : 0);
}

function formatCount(value: number | null | undefined): string {
  const num = Number(value ?? 0);
  return Number.isFinite(num) ? String(num) : "0";
}

function txt(value: unknown, fallback = ""): string {
  const raw = String(value ?? "").trim();
  return raw || fallback;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function isObject(value: unknown): value is Record<string, any> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isGeoJsonLike(value: unknown): boolean {
  if (!isObject(value)) return false;
  const type = String(value.type ?? "");
  if (type === "FeatureCollection") return Array.isArray(value.features) && value.features.length > 0;
  if (type === "Feature") return isGeoJsonLike(value.geometry);
  return ["Polygon", "MultiPolygon", "LineString", "MultiLineString", "Point", "MultiPoint"].includes(type) && Array.isArray(value.coordinates);
}

function buildFieldMapLayers(report: FieldReportDetailV1): FieldMapLayersVm {
  const reportAny = report as any;
  const mapLayers = reportAny.map_layers ?? reportAny.gis_layers ?? reportAny.spatial_layers ?? {};
  const plannedGeoJson = isGeoJsonLike(mapLayers.planned_geojson) ? mapLayers.planned_geojson : null;
  const coverageGeoJson = isGeoJsonLike(mapLayers.coverage_geojson) ? mapLayers.coverage_geojson : null;
  const trajectorySegments: FieldMapTrajectorySegmentVm[] = [];
  const acceptancePoints: FieldMapAcceptancePointVm[] = [];
  const deviceMarkers: FieldMapMarkerVm[] = [];
  const hasAnyOperationLayer = Boolean(plannedGeoJson || coverageGeoJson || trajectorySegments.length || acceptancePoints.length || deviceMarkers.length);
  const boundary = isGeoJsonLike(reportAny.field?.geometry) ? "地块边界" : "";
  const counts = [boundary, plannedGeoJson ? "计划区域" : "", coverageGeoJson ? "实际覆盖" : ""].filter(Boolean).join("、");
  return { plannedGeoJson, coverageGeoJson, trajectorySegments, acceptancePoints, deviceMarkers, hasAnyOperationLayer, summaryText: counts ? `已接入：${counts}` : "暂无作业空间图层。" };
}

function operationLabel(actionType: unknown, fallback = "建议执行下一步动作"): string {
  const raw = String(actionType ?? "").trim().toUpperCase();
  if (raw.includes("IRRIG")) return "灌溉";
  if (raw.includes("FERT")) return "施肥";
  if (raw.includes("SPRAY")) return "喷药";
  if (raw.includes("INSPECT")) return "巡检";
  return labelOperationType(raw || fallback);
}

function buildCurrentRecommendation(report: FieldReportDetailV1, fieldId: string) {
  const current = (report as any).current_recommendation;
  if (!current || typeof current !== "object") return null;
  const title = operationLabel(current.action_type, "当前建议");
  const explainText = sanitizeCustomerText(current.summary || current.explain_human || "暂无建议说明");
  return {
    title,
    explainText,
    objectiveText: sanitizeCustomerText(asArray(current.reason_codes).join("、") || "暂无目标"),
    priorityText: sanitizeCustomerText(current.priority || "普通"),
    href: `/customer/fields/${encodeURIComponent(fieldId)}`,
  };
}

function buildRecentOperations(report: FieldReportDetailV1, fieldId: string) {
  const reportAny = report as any;
  const rows: any[] = [];
  if (reportAny.recent_operation) rows.push(reportAny.recent_operation);
  for (const item of asArray((report as any).recent_operations)) rows.push(item);
  const seen = new Set<string>();
  return rows.slice(0, 5).map((item, index) => {
    const operationId = txt(item.operation_id ?? item.operation_plan_id, `recent-${index}`);
    if (seen.has(operationId)) return null;
    seen.add(operationId);
    const summary = txt(item.summary, "");
    return {
      operationId,
      title: sanitizeCustomerText(summary || item.customer_title || item.title || operationLabel(item.operation_type, "作业")),
      statusText: labelFinalStatus(item.final_status),
      acceptanceText: labelAcceptanceStatus(item.acceptance_status ?? (summary.includes("已验收") ? "PASS" : null)),
      evidenceText: String(item.final_status ?? "").toUpperCase() === "EVIDENCE_MISSING" ? "证据缺失" : "证据已回传",
      updatedAtText: formatDateTime(item.accepted_at ?? item.generated_at),
      href: operationId && !operationId.startsWith("recent-") ? `/customer/operations/${encodeURIComponent(operationId)}` : `/customer/fields/${encodeURIComponent(fieldId)}`,
    };
  }).filter(Boolean) as FieldReportPageVm["recentOperations"];
}

export function buildFieldReportVm(report: FieldReportDetailV1): FieldReportPageVm {
  const reportAny = report as any;
  const fieldId = report.field.field_id;
  const fieldName = txt(report.field.field_name, "地块名称待补充");
  const cropContext = reportAny.crop_context ?? {};
  const riskObj = reportAny.risk ?? {};
  const diagnosisBasis = reportAny.diagnosis_basis ?? {};
  const mapLayers = buildFieldMapLayers(report);
  const riskLevel = txt(riskObj.level ?? report.overview.current_risk_level, "UNKNOWN");
  const riskText = labelRiskLevel(riskLevel);
  const reasons = (asArray(riskObj.reasons).length ? asArray(riskObj.reasons) : asArray(report.explain.top_reasons)).map((item) => sanitizeCustomerText(item)).filter(Boolean);
  const basisStatus = txt(diagnosisBasis.status, "INSUFFICIENT");
  const basisRefs = asArray(diagnosisBasis.evidence_refs).map((item) => sanitizeCustomerText(item)).filter(Boolean);
  const diagnosisLines = basisRefs.length ? basisRefs : (reasons.length ? reasons : [basisStatus === "NOT_APPLICABLE" ? "当前低风险，暂无新的诊断依据" : "暂无主要依据"]);
  const currentRecommendation = buildCurrentRecommendation(report, fieldId);
  const recentOperations = buildRecentOperations(report, fieldId);
  const nextAction = currentRecommendation ? {
    title: currentRecommendation.title,
    explainText: currentRecommendation.explainText,
    objectiveText: currentRecommendation.objectiveText,
    priorityText: currentRecommendation.priorityText,
  } : null;

  const overview = {
    riskText,
    openAlertsText: formatCount(report.overview.open_alerts_count),
    pendingAcceptanceText: formatCount(report.overview.pending_acceptance_count),
    totalOperationsText: formatCount(report.overview.total_operations_count),
    latestOperationText: formatDateTime(report.overview.latest_operation_at),
    estimatedCostText: formatCurrency(report.overview.estimated_total_cost),
    actualCostText: formatCurrency(report.overview.actual_total_cost),
  };
  const riskTone: "neutral" | "warning" | "danger" = riskText.includes("高") ? "danger" : riskText.includes("中") ? "warning" : "neutral";
  const explainHuman = basisStatus === "NOT_APPLICABLE" && riskLevel === "LOW"
    ? "该地块当前风险较低，暂无新的待处理建议。"
    : sanitizeCustomerText(report.explain.human || "暂无状态解释");

  const roiItems = Number(report.value_summary.total_roi_items ?? 0);
  const roiEmptyState = getCustomerEmptyState("NO_ROI");
  const fieldMemoryEmptyState = getCustomerEmptyState("NO_FIELD_MEMORY");
  const roiLines = [
    customerRoiLabel(report.value_summary.customer_value_text || `本地块已有 ${formatCount(report.value_summary.total_roi_items)} 条价值记录`),
    `节水 ${formatCount(report.value_summary.water_saved_items)} 条、节人工 ${formatCount(report.value_summary.labor_saved_items)} 条、预警 ${formatCount(report.value_summary.early_warning_items)} 条`,
    `可信度/假设：低置信 ${formatCount(report.value_summary.low_confidence_items)} 条，假设型 ${formatCount(report.value_summary.assumption_based_items)} 条`,
  ];
  const fieldMemorySummary = reportAny.field_memory_summary;
  const fieldMemoryAvailable = Boolean(fieldMemorySummary && (Array.isArray(fieldMemorySummary.entries) || Array.isArray(fieldMemorySummary.items) || typeof fieldMemorySummary.summary_text === "string" || fieldMemorySummary.available === true));
  const fieldMemoryLines = fieldMemoryAvailable ? [sanitizeCustomerText(fieldMemorySummary?.summary_text ?? "田块记忆已记录")].filter(Boolean) : [];
  const totalDevices = Number(report.device_summary.total_devices ?? 0);
  const onlineDevices = Number(report.device_summary.online_devices ?? 0);
  const offlineDevices = Number(report.device_summary.offline_devices ?? 0);
  const deviceSummary = {
    totalText: totalDevices > 0 ? formatCount(totalDevices) : "暂无设备状态摘要",
    onlineText: totalDevices > 0 ? formatCount(onlineDevices) : "暂无设备状态摘要",
    offlineText: totalDevices > 0 ? formatCount(offlineDevices) : "暂无设备状态摘要",
    lastUpdateText: formatDateTime(report.device_summary.last_telemetry_at),
  };

  return {
    generatedAtText: formatDateTime(report.generated_at),
    field: {
      fieldId,
      fieldName,
      cropText: cropContext.crop_code ? `作物：${cropContext.crop_code}` : "暂无作物信息",
      stageText: cropContext.crop_stage ? `阶段：${cropContext.crop_stage}` : "暂无阶段信息",
      updatedAtText: formatDateTime(report.device_summary.last_telemetry_at),
    },
    risk: { levelLabel: riskText, tone: riskTone, reasons: diagnosisLines },
    diagnosis: {
      headline: explainHuman,
      evidenceLines: diagnosisLines,
      dataQualityText: basisStatus === "AVAILABLE" ? "诊断依据可用" : basisStatus === "NOT_APPLICABLE" ? "低风险无需诊断" : "诊断依据不足",
      latestObservationText: report.overview.latest_operation_at ? `最近一次作业观测时间：${formatDateTime(report.overview.latest_operation_at)}` : `最近遥测更新时间：${formatDateTime(report.device_summary.last_telemetry_at)}`,
    },
    recommendations: currentRecommendation ? [{ title: currentRecommendation.title, summary: currentRecommendation.explainText, href: currentRecommendation.href }] : [],
    recentOperations,
    roiSummary: roiItems > 0 ? { title: "价值记录摘要", lines: roiLines, displayText: roiLines.join("；") } : { title: customerRoiLabel("ROI_UNAVAILABLE"), description: roiEmptyState.description, displayText: `${customerRoiLabel("ROI_UNAVAILABLE")}：${roiEmptyState.description}` },
    fieldMemory: fieldMemoryAvailable && fieldMemoryLines.length > 0 ? { title: "田块记忆摘要", lines: fieldMemoryLines, displayText: fieldMemoryLines.join("；") } : { title: customerFieldMemoryLabel("FIELD_MEMORY_UNAVAILABLE"), description: fieldMemoryEmptyState.description, displayText: `${customerFieldMemoryLabel("FIELD_MEMORY_UNAVAILABLE")}：${fieldMemoryEmptyState.description}` },
    mapLayers,
    exportHref: `/customer/fields/${encodeURIComponent(fieldId)}/export`,
    hero: { title: fieldName, subtitle: "聚焦当前诊断、最近作业与待处理建议" },
    landOverview: [
      { label: "风险等级", value: riskText },
      { label: "未关闭告警", value: overview.openAlertsText },
      { label: "待验收作业", value: overview.pendingAcceptanceText },
      { label: "作业总数", value: overview.totalOperationsText },
      { label: "最近作业时间", value: overview.latestOperationText },
      { label: "预计总成本", value: overview.estimatedCostText },
      { label: "实际总成本", value: overview.actualCostText },
    ],
    diagnosticCards: [
      { title: "诊断依据", value: basisStatus === "AVAILABLE" ? "可用" : basisStatus === "NOT_APPLICABLE" ? "不适用" : "不足", detail: diagnosisLines.join("；") },
      { title: "当前建议", value: currentRecommendation ? currentRecommendation.title : "暂无待处理建议", detail: currentRecommendation?.explainText ?? "低风险或无未闭环建议时不显示作物特定建议" },
      { title: "最近作业", value: recentOperations[0]?.title ?? "暂无最近作业", detail: recentOperations[0]?.acceptanceText ?? "暂无验收记录" },
      { title: "作物上下文", value: cropContext.status === "AVAILABLE" ? "可用" : "未知", detail: [cropContext.crop_code, cropContext.crop_stage].filter(Boolean).join(" / ") || "作物未知时不显示作物特定建议" },
      { title: "空间范围", value: reportAny.field?.geometry ? "已接入" : "暂无范围", detail: reportAny.field?.geometry_id ?? "暂无 geometry_id" },
    ],
    currentStatus: { summary: explainHuman, reasons: diagnosisLines },
    recentOperationsTop5: recentOperations.map((item) => ({ id: item.operationId || "待生成", title: item.title, statusText: item.statusText, acceptanceText: item.acceptanceText, generatedAtText: item.updatedAtText, href: item.href })),
    prescriptionCards: currentRecommendation ? [
      { title: "建议动作", value: currentRecommendation.title, detail: currentRecommendation.explainText },
      { title: "审批要求", value: "按作业风险审批", detail: "未闭环建议需进入审批/处方/执行链路" },
    ] : [],
    deviceMonitoring: [
      { label: "设备总数", value: formatCount(report.device_summary.total_devices) },
      { label: "在线设备", value: formatCount(report.device_summary.online_devices) },
      { label: "离线设备", value: formatCount(report.device_summary.offline_devices) },
      { label: "最近更新", value: formatDateTime(report.device_summary.last_telemetry_at) },
    ],
    header: { title: fieldName, subtitle: "地块病历摘要", fieldId },
    overview,
    explain: { human: explainHuman, topReasonsText: diagnosisLines },
    deviceSummary,
    nextAction,
  };
}
