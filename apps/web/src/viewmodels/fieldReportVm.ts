import type { FieldReportDetailV1 } from "../api/customerReports";
import { customerFieldMemoryLabel, customerRoiLabel, labelOperationType, labelRiskLevel } from "../lib/customerLabels";
import { getCustomerEmptyState } from "../lib/customerEmptyStates";
import { formatCustomerDate, formatCustomerNumber, formatMoneyOrUnavailable } from "../lib/customerSafeText";
import { customerCropLabel, customerDisplayName, customerSemanticLabel, customerSourceLabel, customerStageLabel } from "../lib/customerSemanticLabels";
import { customerGuardedAcceptanceText, customerGuardedEvidenceText, customerGuardedStatusText, customerTrustScopeText, customerValueSummaryText, isTrustedDashboardValueSummary } from "../lib/customerTrustGate";
import { buildFormalScenarioVm } from "../lib/formalScenarioViewModel";

const CROP_UNKNOWN_EXPLANATION = "当前作物季尚未确认。系统可以展示历史作业和地块观测记录，但不会生成作物特定诊断或处方。";
const CROP_UNKNOWN_DIAGNOSIS_LINES = ["已接入土壤水分、天气与设备观测数据。", "当前作物未确认，因此不形成作物特定诊断结论。"];
const PLAN_CANDIDATE_TITLE = "播种前规划候选";
const PLAN_CANDIDATE_DESCRIPTION = "以下候选仅用于种植规划，不代表当前地块已种植该作物。";

export type FieldMapMarkerVm = { device_id: string; lat: number; lon: number; ts_ms?: number | null };
export type FieldMapTrajectorySegmentVm = { id: string; status: "READY" | "DISPATCHED" | "SUCCEEDED" | "FAILED"; color: string; coordinates: Array<[number, number]>; label?: string };
export type FieldMapAcceptancePointVm = { id: string; status: string; lat: number; lon: number };
export type FieldMapLayersVm = { plannedGeoJson: unknown | null; coverageGeoJson: unknown | null; trajectorySegments: FieldMapTrajectorySegmentVm[]; acceptancePoints: FieldMapAcceptancePointVm[]; deviceMarkers: FieldMapMarkerVm[]; hasAnyOperationLayer: boolean; summaryText: string };

export type FieldReportPageVm = {
  generatedAtText: string;
  field: { fieldId: string; fieldName: string; cropText: string; stageText: string; updatedAtText: string };
  cropContext: { statusText: string; cropText: string; stageText: string; sourceText: string; allowCropSpecificPrescription: boolean; isCropConfirmed: boolean; explanationText: string; historicalOperationText: string };
  planningCandidates: { title: string; description: string };
  technicalEvidence: { summary: string; lines: string[] };
  risk: { levelLabel: string; tone: "neutral" | "warning" | "danger"; reasons: string[] };
  diagnosis: { headline: string; evidenceLines: string[]; dataQualityText: string; latestObservationText: string };
  recommendations: Array<{ title: string; summary: string; href?: string }>;
  recentOperations: Array<{ operationId: string; title: string; statusText: string; acceptanceText: string; evidenceText: string; formalScenarioText: string; updatedAtText: string; href: string }>;
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

function formatDateTime(value: string | null | undefined): string { return formatCustomerDate(value); }
function formatCurrency(value: number | null | undefined): string { return formatMoneyOrUnavailable(value); }
function formatCount(value: number | null | undefined): string { return formatCustomerNumber(value, { fallback: "0", maximumFractionDigits: 0 }); }
function txt(value: unknown, fallback = ""): string { const raw = String(value ?? "").trim(); return raw || fallback; }
function asArray(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function isObject(value: unknown): value is Record<string, any> { return Boolean(value && typeof value === "object" && !Array.isArray(value)); }
function upper(value: unknown): string { return String(value ?? "").trim().toUpperCase(); }
function num(value: unknown): number { const n = Number(value ?? 0); return Number.isFinite(n) ? n : 0; }

function isGeoJsonLike(value: unknown): boolean {
  if (!isObject(value)) return false;
  const type = String(value.type ?? "");
  if (type === "FeatureCollection") return Array.isArray(value.features) && value.features.length > 0;
  if (type === "Feature") return isGeoJsonLike(value.geometry);
  return ["Polygon", "MultiPolygon", "LineString", "MultiLineString", "Point", "MultiPoint"].includes(type) && Array.isArray(value.coordinates);
}

function isInternalEvidenceKey(value: unknown): boolean {
  const text = String(value ?? "").trim();
  if (!text) return true;
  return /crop_stage\s*:\s*mock_/i.test(text)
    || /diagnosis\s*:\s*diag_/i.test(text)
    || /\bdiag_[A-Za-z0-9_-]+\b/i.test(text)
    || /stage1_sensing_summary/i.test(text)
    || /stage1_/i.test(text)
    || /skill_trace/i.test(text)
    || /manifest/i.test(text)
    || /checksum/i.test(text)
    || /sha256/i.test(text);
}

function customerEvidenceLine(value: unknown): string {
  if (isInternalEvidenceKey(value)) return "";
  const text = customerSemanticLabel(value, "");
  if (!text) return "";
  return text
    .replace(/crop_stage\s*:\s*[^；,，\s]+/gi, "作物阶段已记录")
    .replace(/crop_code\s*:\s*[^；,，\s]+/gi, "作物信息已记录")
    .replace(/source\s*:\s*remote_sensing/gi, "来源：遥感观测")
    .replace(/source\s*:\s*machinery/gi, "来源：农机作业记录")
    .replace(/remote_sensing/gi, "遥感观测")
    .replace(/machinery/gi, "农机作业记录")
    .replace(/geometry_id\s*[:=]\s*[^；,，\s]+/gi, "地块边界已接入");
}

function buildTechnicalEvidenceLines(reportAny: any): string[] {
  const diagnosisBasis = reportAny.diagnosis_basis ?? {};
  const refs = asArray(diagnosisBasis.evidence_refs).map((item) => String(item ?? "").trim()).filter(Boolean);
  const missing = asArray(reportAny.field_observability_profile?.missing_inputs).map((item) => `缺失输入：${customerSemanticLabel(item, "待补充输入")}`);
  const lines = [...refs, ...missing].map((line) => customerSemanticLabel(line, "技术证据待补充"));
  return lines.length ? lines : ["暂无需要展开的技术证据 key。"];
}

function buildFieldMapLayers(report: FieldReportDetailV1): FieldMapLayersVm {
  const reportAny = report as any;
  const mapLayers = reportAny.map_layers ?? reportAny.gis_layers ?? reportAny.spatial_layers ?? {};
  const plannedGeoJson = isGeoJsonLike(mapLayers.planned_geojson) ? mapLayers.planned_geojson : null;
  const coverageGeoJson = isGeoJsonLike(mapLayers.coverage_geojson) ? mapLayers.coverage_geojson : null;
  const hasBoundary = isGeoJsonLike(reportAny.field?.geometry) || Boolean(reportAny.field?.geometry_id);
  const hasAnyOperationLayer = Boolean(hasBoundary || plannedGeoJson || coverageGeoJson);
  const counts = [hasBoundary ? "地块边界" : "", plannedGeoJson ? "计划区域" : "", coverageGeoJson ? "实际覆盖" : ""].filter(Boolean).join("、");
  return { plannedGeoJson, coverageGeoJson, trajectorySegments: [], acceptancePoints: [], deviceMarkers: [], hasAnyOperationLayer, summaryText: counts ? `已接入：${counts}` : "暂无作业空间图层。" };
}

function operationLabel(actionType: unknown, fallback = "建议执行下一步动作"): string {
  const raw = upper(actionType);
  if (raw.includes("IRRIG")) return "灌溉";
  if (raw.includes("FERT")) return "施肥";
  if (raw.includes("SPRAY")) return "喷药";
  if (raw.includes("INSPECT")) return "巡检";
  return labelOperationType(raw || fallback);
}

function isCropConfirmed(cropContext: any): boolean {
  const status = upper(cropContext?.status);
  const cropCode = upper(cropContext?.crop_code);
  const allowCropSpecific = cropContext?.allowed_actions?.allow_crop_specific_prescription === true;
  if (!cropCode || cropCode === "UNKNOWN" || cropCode === "PRE_PLANT" || cropCode === "FALLOW") return false;
  if (["UNKNOWN", "PRE_PLANT", "PLANTED_UNCONFIRMED", "FALLOW"].includes(status)) return false;
  return status === "PLANTED_CONFIRMED" || status === "AVAILABLE" || allowCropSpecific;
}

function buildCurrentRecommendation(report: FieldReportDetailV1, fieldId: string, cropConfirmed: boolean) {
  if (!cropConfirmed) return null;
  const current = (report as any).current_recommendation;
  if (!current || typeof current !== "object") return null;
  const title = operationLabel(current.action_type, "当前建议");
  const explainText = customerSemanticLabel(current.summary || current.explain_human || "暂无建议说明");
  return { title, explainText, objectiveText: customerSemanticLabel(asArray(current.reason_codes).join("、") || "暂无目标"), priorityText: customerSemanticLabel(current.priority || "普通"), href: `/customer/fields/${encodeURIComponent(fieldId)}` };
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
    const formalVm = buildFormalScenarioVm(item);
    return {
      operationId,
      title: customerDisplayName(summary || item.customer_title || item.title, operationLabel(item.operation_type, "作业")),
      statusText: customerGuardedStatusText(item),
      acceptanceText: customerGuardedAcceptanceText(item),
      evidenceText: customerGuardedEvidenceText(item),
      formalScenarioText: [formalVm.scenarioLabel, formalVm.chainText, formalVm.zoneSummaryText].filter(Boolean).join("｜"),
      updatedAtText: formatDateTime(item.accepted_at ?? item.generated_at ?? item.updated_at),
      href: operationId && !operationId.startsWith("recent-") ? `/customer/operations/${encodeURIComponent(operationId)}` : `/customer/fields/${encodeURIComponent(fieldId)}`,
    };
  }).filter(Boolean) as FieldReportPageVm["recentOperations"];
}

function hasHistoricalIrrigation(recentOperations: FieldReportPageVm["recentOperations"]): boolean {
  return recentOperations.some((item) => item.title.includes("灌溉"));
}

function fieldMemoryFormalAvailable(summary: any): boolean {
  return Boolean(summary?.customer_visible_memory === true || summary?.learning_eligible === true || summary?.memory_lane === "FORMAL_FIELD_MEMORY" || summary?.trust_level === "FORMAL_ACCEPTED");
}

export function buildFieldReportVm(report: FieldReportDetailV1): FieldReportPageVm {
  const reportAny = report as any;
  const fieldId = report.field.field_id;
  const fieldName = customerDisplayName(report.field.field_name, "地块名称待补充");
  const cropContext = reportAny.crop_context ?? {};
  const riskObj = reportAny.risk ?? {};
  const diagnosisBasis = reportAny.diagnosis_basis ?? {};
  const mapLayers = buildFieldMapLayers(report);
  const cropConfirmed = isCropConfirmed(cropContext);
  const riskLevel = txt(riskObj.level ?? report.overview.current_risk_level, "UNKNOWN");
  const riskText = labelRiskLevel(riskLevel);
  const recentOperations = buildRecentOperations(report, fieldId);
  const reasons = (asArray(riskObj.reasons).length ? asArray(riskObj.reasons) : asArray(report.explain.top_reasons)).map((item) => customerEvidenceLine(item)).filter(Boolean);
  const basisStatus = txt(diagnosisBasis.status, "INSUFFICIENT");
  const basisRefs = asArray(diagnosisBasis.evidence_refs).map((item) => customerEvidenceLine(item)).filter(Boolean);
  const diagnosisLines = cropConfirmed ? (basisRefs.length ? basisRefs : (reasons.length ? reasons : [basisStatus === "NOT_APPLICABLE" ? "当前低风险，暂无新的诊断依据" : "暂无主要依据"])) : CROP_UNKNOWN_DIAGNOSIS_LINES;
  const currentRecommendation = buildCurrentRecommendation(report, fieldId, cropConfirmed);
  const nextAction = currentRecommendation ? { title: currentRecommendation.title, explainText: currentRecommendation.explainText, objectiveText: currentRecommendation.objectiveText, priorityText: currentRecommendation.priorityText } : null;
  const historicalOperationText = !cropConfirmed && hasHistoricalIrrigation(recentOperations) ? "该地块存在历史灌溉作业记录。历史作业可用于经营回溯，但当前作物季尚未确认，因此不会作为作物特定处方依据。" : "历史作业仅用于经营回溯；作物季确认前不形成作物特定处方。";

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
  const explainHuman = cropConfirmed ? (basisStatus === "NOT_APPLICABLE" && riskLevel === "LOW" ? "该地块当前风险较低，暂无新的待处理建议。" : customerSemanticLabel(report.explain.human || "暂无状态解释")) : CROP_UNKNOWN_EXPLANATION;

  const valueSummary: any = report.value_summary ?? {};
  const roiItems = num(valueSummary.total_roi_items);
  const trustedRoi = isTrustedDashboardValueSummary(valueSummary);
  const roiEmptyState = getCustomerEmptyState("NO_ROI");
  const fieldMemoryEmptyState = getCustomerEmptyState("NO_FIELD_MEMORY");
  const roiLines = [
    customerValueSummaryText(valueSummary, roiItems, (n) => formatCount(n)),
    `节水 ${formatCount(valueSummary.water_saved_items)} 条、节人工 ${formatCount(valueSummary.labor_saved_items)} 条、预警 ${formatCount(valueSummary.early_warning_items)} 条`,
    trustedRoi ? "已通过正式价值门禁。" : `未通过正式价值门禁：低置信 ${formatCount(valueSummary.low_confidence_items)} 条，假设型 ${formatCount(valueSummary.assumption_based_items)} 条`,
  ];
  const fieldMemorySummary = reportAny.field_memory_summary;
  const fieldMemoryAvailable = fieldMemoryFormalAvailable(fieldMemorySummary);
  const fieldMemoryLines = fieldMemoryAvailable ? [customerSemanticLabel(fieldMemorySummary?.summary_text ?? "正式田块记忆已通过学习门禁")].filter(Boolean) : [];
  const totalDevices = Number(report.device_summary.total_devices ?? 0);
  const onlineDevices = Number(report.device_summary.online_devices ?? 0);
  const offlineDevices = Number(report.device_summary.offline_devices ?? 0);
  const deviceSummary = { totalText: totalDevices > 0 ? formatCount(totalDevices) : "暂无设备状态摘要", onlineText: totalDevices > 0 ? formatCount(onlineDevices) : "暂无设备状态摘要", offlineText: totalDevices > 0 ? formatCount(offlineDevices) : "暂无设备状态摘要", lastUpdateText: formatDateTime(report.device_summary.last_telemetry_at) };
  const cropText = cropConfirmed && cropContext.crop_code ? `作物：${customerCropLabel(cropContext.crop_code)}` : "作物：未确认";
  const stageText = cropConfirmed && cropContext.crop_stage ? `阶段：${customerStageLabel(cropContext.crop_stage)}` : "阶段：未确认";
  const cropDetail = [customerCropLabel(cropContext.crop_code, "作物待确认"), customerStageLabel(cropContext.crop_stage, "阶段待确认"), customerSourceLabel(cropContext.source, "来源待确认")].filter(Boolean).join(" / ");
  const technicalLines = buildTechnicalEvidenceLines(reportAny);

  return {
    generatedAtText: formatDateTime(report.generated_at),
    field: { fieldId, fieldName, cropText, stageText, updatedAtText: formatDateTime(report.device_summary.last_telemetry_at) },
    cropContext: { statusText: cropConfirmed ? "已确认种植" : "未确认", cropText: cropConfirmed ? customerCropLabel(cropContext.crop_code, "作物待确认") : "作物待确认", stageText: cropConfirmed ? customerStageLabel(cropContext.crop_stage, "阶段待确认") : "阶段待确认", sourceText: customerSourceLabel(cropContext.source, "未确认"), allowCropSpecificPrescription: cropConfirmed, isCropConfirmed: cropConfirmed, explanationText: cropConfirmed ? "当前作物季已确认，系统可结合观测数据形成作物相关诊断和建议。" : CROP_UNKNOWN_EXPLANATION, historicalOperationText },
    planningCandidates: { title: PLAN_CANDIDATE_TITLE, description: PLAN_CANDIDATE_DESCRIPTION },
    technicalEvidence: { summary: "技术证据 key 默认折叠，仅用于审计和排障。", lines: technicalLines },
    risk: { levelLabel: riskText, tone: riskTone, reasons: diagnosisLines },
    diagnosis: { headline: explainHuman, evidenceLines: diagnosisLines, dataQualityText: cropConfirmed ? (basisStatus === "AVAILABLE" ? "诊断依据可用" : basisStatus === "NOT_APPLICABLE" ? "低风险无需诊断" : "诊断依据不足") : "作物未确认，不形成作物特定诊断", latestObservationText: report.overview.latest_operation_at ? `最近一次作业观测时间：${formatDateTime(report.overview.latest_operation_at)}` : `最近遥测更新时间：${formatDateTime(report.device_summary.last_telemetry_at)}` },
    recommendations: currentRecommendation ? [{ title: currentRecommendation.title, summary: currentRecommendation.explainText, href: currentRecommendation.href }] : [],
    recentOperations,
    roiSummary: roiItems > 0 ? { title: trustedRoi ? "可信价值记录摘要" : "价值线索摘要", lines: roiLines, displayText: roiLines.join("；") } : { title: customerRoiLabel("ROI_UNAVAILABLE"), description: `${roiEmptyState.description} ${customerTrustScopeText()}`, displayText: `${customerRoiLabel("ROI_UNAVAILABLE")}：${roiEmptyState.description}` },
    fieldMemory: fieldMemoryAvailable && fieldMemoryLines.length > 0 ? { title: "正式田块记忆摘要", lines: fieldMemoryLines, displayText: fieldMemoryLines.join("；") } : { title: customerFieldMemoryLabel("FIELD_MEMORY_UNAVAILABLE"), description: `${fieldMemoryEmptyState.description} 未通过正式学习门禁的技术记忆不作为客户学习闭环。`, displayText: `${customerFieldMemoryLabel("FIELD_MEMORY_UNAVAILABLE")}：${fieldMemoryEmptyState.description}` },
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
      { title: "诊断依据", value: cropConfirmed ? (basisStatus === "AVAILABLE" ? "可用" : basisStatus === "NOT_APPLICABLE" ? "不适用" : "不足") : "作物未确认", detail: diagnosisLines.join("；") },
      { title: "当前建议", value: currentRecommendation ? currentRecommendation.title : "暂无作物特定建议", detail: currentRecommendation?.explainText ?? CROP_UNKNOWN_EXPLANATION },
      { title: "最近作业", value: recentOperations[0]?.title ?? "暂无最近作业", detail: recentOperations[0]?.acceptanceText ?? "暂无验收记录" },
      { title: "作物上下文", value: cropConfirmed ? "已确认" : "待确认", detail: cropDetail || CROP_UNKNOWN_EXPLANATION },
      { title: "空间范围", value: mapLayers.hasAnyOperationLayer ? "地块边界已接入" : "暂无范围", detail: mapLayers.hasAnyOperationLayer ? "地块边界可用于空间作业与导出报告" : "暂无地块边界" },
    ],
    currentStatus: { summary: explainHuman, reasons: diagnosisLines },
    recentOperationsTop5: recentOperations.map((item) => ({ id: item.operationId || "待生成", title: item.title, statusText: item.statusText, acceptanceText: item.acceptanceText, generatedAtText: item.updatedAtText, href: item.href })),
    prescriptionCards: currentRecommendation ? [{ title: "建议动作", value: currentRecommendation.title, detail: currentRecommendation.explainText }, { title: "审批要求", value: "按作业风险审批", detail: "未闭环建议需进入审批/处方/执行链路" }] : [],
    deviceMonitoring: [{ label: "设备总数", value: formatCount(report.device_summary.total_devices) }, { label: "在线设备", value: formatCount(report.device_summary.online_devices) }, { label: "离线设备", value: formatCount(report.device_summary.offline_devices) }, { label: "最近更新", value: formatDateTime(report.device_summary.last_telemetry_at) }],
    header: { title: fieldName, subtitle: "地块病历摘要", fieldId },
    overview,
    explain: { human: explainHuman, topReasonsText: diagnosisLines },
    deviceSummary,
    nextAction,
  };
}
