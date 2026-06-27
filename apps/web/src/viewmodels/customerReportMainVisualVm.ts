import type { FieldReportDetailV1, OperationReportV1 } from "../api/customerReports";

export type CustomerReportMainVisualStatus = "FORMAL_READY" | "INSUFFICIENT_REPORT";

export type CustomerReportMainVisualVm = {
  status: CustomerReportMainVisualStatus;
  title: string;
  subtitle: string;
  rows: Array<{ label: string; value: string }>;
  technicalRows: Array<{ label: string; value: string }>;
};

type ValidationResult = { ok: true } | { ok: false; reasons: string[] };

function text(value: unknown): string {
  return String(value ?? "").trim();
}

const CUSTOMER_REASON_BY_CODE: Record<string, string> = {
  NO_CONFIRMED_OPERATOR_RECOMMENDATION: "暂无运营人员确认的正式建议",
  CUSTOMER_SUMMARY_ONLY: "当前仅有客户摘要，正式报告仍待补齐",
  NO_FORECAST_RUN: "缺少可回放预测结果",
  NO_SCENARIO_EDIT: "情景尚未完成确认",
  NO_RECOMMENDATION_SUBMIT: "建议尚未提交",
  NO_APPROVAL: "审批尚未完成",
  NO_DISPATCH: "任务尚未派发",
  NO_TASK_CREATION: "作业任务尚未创建",
  SCENARIO_OPTIONS_MISSING: "情景比较结果待补齐",
  ACCEPTANCE_RESULT_MISSING: "验收结果待补齐",
  WATER_RESPONSE_VERIFICATION_MISSING: "灌后效果验证待补齐",
};

function customerVisibleReason(value: unknown): string {
  const raw = text(value);
  if (!raw) return "条件待补齐";
  const direct = CUSTOMER_REASON_BY_CODE[raw.toUpperCase()];
  if (direct) return direct;

  let safe = raw
    .replace(/正式\s*report\s*API\s*条件不足/gi, "正式报告尚未形成")
    .replace(/正式\s*report\s*API\s*数据/gi, "正式报告数据")
    .replace(/report\s*API/gi, "正式报告")
    .replace(/recommendation_id/gi, "建议记录")
    .replace(/prescription_id/gi, "处方记录")
    .replace(/as_executed_id/gi, "执行记录")
    .replace(/acceptance_id/gi, "验收记录")
    .replace(/operation_id/gi, "作业记录")
    .replace(/operation_plan_id/gi, "作业计划记录")
    .replace(/field_id/gi, "地块记录")
    .replace(/approval_id/gi, "审批记录")
    .replace(/receipt_id/gi, "执行回执")
    .replace(/AO-ACT/gi, "执行任务")
    .replace(/Field\s+Memory/gi, "田块记忆")
    .replace(/\bROI\b/gi, "价值记录");

  if (/\bNO_[A-Z0-9_]+\b/.test(safe) || /\b[A-Z0-9]+_MISSING\b/.test(safe)) {
    return "正式链路仍有待补齐环节";
  }
  if (/\b[A-Z][A-Z0-9]+_[A-Z0-9_]{2,}\b/.test(safe)) {
    return "正式链路仍有待补齐环节";
  }
  return safe;
}

function customerVisibleReasons(reasons: string[]): string[] {
  const mapped = reasons.map(customerVisibleReason).filter(Boolean);
  return [...new Set(mapped.length ? mapped : ["正式链路仍有待补齐环节"])];
}

function asArray(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function numberOrNull(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function formatNumber(value: number, fractionDigits = 1): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(fractionDigits).replace(/0+$/, "").replace(/\.$/, "");
}

function booleanGate(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  const key = text(value).toUpperCase();
  if (["PASS", "PASSED", "TRUE", "READY", "FORMAL_READY", "ELIGIBLE", "APPROVED", "SUCCESS", "SUCCEEDED", "CONFIRMED", "VALID"].includes(key)) return true;
  if (["FAIL", "FAILED", "FALSE", "NOT_READY", "INELIGIBLE", "REJECTED", "PENDING", "LIMITED", "LIMITED_STATE", "INSUFFICIENT"].includes(key)) return false;
  return null;
}

function observationValue(observations: unknown, metric: string): number | null {
  const hit = asArray(observations).find((item) => text(item?.metric).toLowerCase() === metric.toLowerCase());
  return numberOrNull(hit?.value);
}

function hasBoundary(fieldContext: any): boolean {
  const status = text(fieldContext?.boundary_status).toUpperCase();
  return status === "BOUNDARY_AVAILABLE" || Boolean(fieldContext?.boundary_geojson);
}

function cropStageText(value: unknown): string {
  const raw = text(value);
  const key = raw.toUpperCase();
  if (["VEGETATIVE", "VEGETATIVE_STAGE", "V6", "V8", "NUTRITION", "NUTRITIONAL"].includes(key) || raw.includes("营养")) return "营养生长期";
  return raw || "阶段待确认";
}

function cropNameText(fieldContext: any): string {
  const cropName = text(fieldContext?.crop_name);
  const cropCode = text(fieldContext?.crop_code).toUpperCase();
  if (cropName) return cropName;
  if (cropCode === "CORN" || cropCode === "MAIZE") return "玉米";
  return "作物待确认";
}

function deviceText(devices: unknown): string | null {
  const rows = asArray(devices);
  const labels = rows.map((device) => text(device?.display_name ?? device?.display_kind_text ?? device?.sensing_role_text ?? device?.name)).filter(Boolean);
  if (labels.length >= 3) return labels.slice(0, 3).join("、");
  const haystacks = rows.map((device) => [device?.display_name, device?.display_kind_text, device?.sensing_role_text, device?.capability, device?.metric, ...(Array.isArray(device?.capabilities) ? device.capabilities : [])].map(text).join(" ").toLowerCase());
  const hasSoil = haystacks.some((item) => item.includes("soil") || item.includes("水分"));
  const hasValvePump = haystacks.some((item) => item.includes("valve") || item.includes("pump") || item.includes("阀") || item.includes("泵"));
  const hasWeather = haystacks.some((item) => item.includes("weather") || item.includes("rain") || item.includes("气象") || item.includes("降雨"));
  if (!hasSoil || !hasValvePump || !hasWeather) return null;
  return "土壤水分传感器、阀门泵站控制器、微型气象站";
}

function formalChainPassed(summary: any): boolean | null {
  if (!summary || typeof summary !== "object") return null;
  const candidates = [summary.customer_visible_eligible, summary.formal_ready, summary.is_formal_ready, summary.passed, summary.status, summary.formal_chain_status, summary.verdict];
  for (const candidate of candidates) {
    const gate = booleanGate(candidate);
    if (gate != null) return gate;
  }
  return null;
}

function pendingChainBlocks(summary: any): boolean {
  if (!summary || typeof summary !== "object") return false;
  const gate = booleanGate(summary.has_pending_chain ?? summary.pending ?? summary.requires_review);
  if (gate === true) return true;
  if (asArray(summary.items ?? summary.pending_items ?? summary.chains).length > 0) return true;
  return false;
}

function fieldFormalValidation(report: FieldReportDetailV1): ValidationResult {
  const root = report as any;
  const fieldContext = root.field_context ?? {};
  const sensing = root.sensing_summary ?? {};
  const observations = sensing.observations ?? [];
  const reasons: string[] = [];
  if (!text(fieldContext.field_name ?? root.field?.field_name)) reasons.push("缺少地块名称");
  if (numberOrNull(fieldContext.area_mu) == null) reasons.push("缺少面积");
  if (!hasBoundary(fieldContext)) reasons.push("缺少边界");
  if (!text(fieldContext.crop_name) && !text(fieldContext.crop_code)) reasons.push("缺少作物");
  if (!text(fieldContext.crop_stage)) reasons.push("缺少作物阶段");
  if (!deviceText(sensing.devices)) reasons.push("缺少感知/执行设备摘要");
  if (observationValue(observations, "soil_moisture_percent") == null) reasons.push("缺少灌前土壤水分");
  if (observationValue(observations, "forecast_rain_72h_mm") == null) reasons.push("缺少未来 72 小时降雨");
  if (observationValue(observations, "temperature_max_c") == null) reasons.push("缺少最高温度观测");
  if (observationValue(observations, "soil_moisture_after_percent") == null) reasons.push("缺少灌后土壤水分");
  if (root.value_summary?.has_customer_visible_value !== true) reasons.push("缺少可信价值记录");
  const formalMemoryCount = numberOrNull(root.learning_summary?.formal_memory_count ?? root.learning_summary?.formal_field_response_memory_count) ?? 0;
  if (formalMemoryCount < 1) reasons.push("缺少正式田块记忆");
  const formalGate = formalChainPassed(root.formal_chain_summary);
  if (formalGate === false) reasons.push("正式链路未通过");
  if (pendingChainBlocks(root.pending_chain_summary)) reasons.push("仍存在待处理链路");
  return reasons.length ? { ok: false, reasons } : { ok: true };
}

function operationId(report: OperationReportV1): string {
  const root = report as any;
  return text(root.identifiers?.operation_plan_id ?? root.identifiers?.operation_id ?? root.operation_plan_id ?? root.operation_id);
}

function fieldId(report: FieldReportDetailV1): string {
  const root = report as any;
  return text(root.field_context?.field_id ?? root.field?.field_id);
}

function operationFormalValidation(report: OperationReportV1): ValidationResult {
  const root = report as any;
  const identifiers = root.identifiers ?? {};
  const reasons: string[] = [];
  for (const [label, value] of [
    ["作业记录", identifiers.operation_id ?? identifiers.operation_plan_id],
    ["地块记录", identifiers.field_id ?? root.field_id],
    ["建议记录", identifiers.recommendation_id],
    ["审批记录", identifiers.approval_id ?? root.approval?.approval_id ?? root.approval?.request_id],
    ["执行回执", identifiers.receipt_id ?? root.as_executed?.receipt_id ?? root.execution?.receipt_id],
    ["处方记录", identifiers.prescription_id ?? root.prescription?.prescription_id],
    ["执行记录", identifiers.as_executed_id ?? root.as_executed?.as_executed_id],
  ] as Array<[string, unknown]>) {
    if (!text(value)) reasons.push(`缺少 ${label}`);
  }
  if (root.formal_scenario?.customer_visible_eligible === false) reasons.push("正式场景未通过客户可见门禁");
  if (!text(root.approval?.actor_name)) reasons.push("缺少审批人");
  if (numberOrNull(root.prescription?.amount) == null || !text(root.prescription?.unit)) reasons.push("缺少处方用量");
  if (text(root.as_executed?.status).toUpperCase() !== "CONFIRMED") reasons.push("执行记录未确认");
  if (numberOrNull(root.as_executed?.executed_amount) == null) reasons.push("缺少实际执行量");
  if ((numberOrNull(root.as_applied?.coverage_percent) ?? -1) !== 100) reasons.push("覆盖率未达到 100%");
  const acceptance = text(root.acceptance?.status ?? root.acceptance?.verdict).toUpperCase();
  if (!(readonlyPassStatuses.includes(acceptance))) reasons.push("验收未通过");
  if (root.roi_ledger?.summary?.has_customer_visible_value !== true) reasons.push("缺少可信价值记录");
  if (asArray(root.field_memory?.field_response_memory).length < 1) reasons.push("缺少田块记忆");
  return reasons.length ? { ok: false, reasons } : { ok: true };
}

const readonlyPassStatuses = ["PASS", "APPROVED", "SUCCESS", "SUCCEEDED"];

function insufficientVm(title: string, reasons: string[], technicalRows: Array<{ label: string; value: string }> = []): CustomerReportMainVisualVm {
  return {
    status: "INSUFFICIENT_REPORT",
    title,
    subtitle: "正式报告尚未形成",
    rows: [{ label: "仍需补齐", value: customerVisibleReasons(reasons).join("、") }],
    technicalRows,
  };
}

function fieldTechnicalRows(report: FieldReportDetailV1): Array<{ label: string; value: string }> {
  const root = report as any;
  return [
    { label: "报告入口", value: fieldId(report) ? `/api/v1/reports/field/${fieldId(report)}` : "--" },
    { label: "地块记录", value: fieldId(report) || "--" },
    { label: "价值门禁", value: root.value_summary?.has_customer_visible_value === true ? "已通过" : "未通过" },
    { label: "正式记忆数量", value: text(root.learning_summary?.formal_memory_count ?? root.learning_summary?.formal_field_response_memory_count ?? 0) },
  ];
}

function isPestDiseaseInspectionReport(report: OperationReportV1): boolean {
  const root = report as any;
  const scenario = text(root.formal_scenario?.scenario_type ?? root.scenario_type).toUpperCase();
  const operationType = text(root.operation_type ?? root.prescription?.operation_type ?? root.customer_title ?? root.operation_title).toUpperCase();
  return scenario === "FORMAL_PEST_DISEASE_INSPECTION" || Boolean(root.pest_disease_inspection) || operationType.includes("PEST_DISEASE_INSPECTION");
}

function pestDiseaseTargetText(value: unknown): string {
  const key = text(value).toUpperCase();
  if (key === "PEST") return "虫害";
  if (key === "DISEASE") return "病害";
  if (key === "WEED") return "草害";
  if (key === "UNKNOWN_STRESS") return "未知胁迫";
  return text(value) || "巡检对象待确认";
}

function pestDiseaseStatusText(value: unknown): string {
  const key = text(value).toUpperCase();
  if (key === "PASS" || key === "APPROVED" || key === "CONFIRMED") return "已记录，仍以正式链路边界为准";
  if (key === "SUSPECTED" || key === "NEEDS_REVIEW" || key === "PENDING") return "待复核";
  if (key === "INSUFFICIENT_EVIDENCE" || key === "MISSING") return "证据不足";
  if (key === "FAIL" || key === "REJECTED" || key === "RULED_OUT") return "未通过";
  return text(value) || "待确认";
}

function mediaEvidenceText(mediaRefs: unknown, mediaCount: unknown): string {
  const count = Array.isArray(mediaRefs) ? mediaRefs.length : numberOrNull(mediaCount);
  return count && count > 0 ? `${formatNumber(count, 0)} 项媒体证据` : "图片/媒体证据待补充";
}

function geoPointText(value: any): string {
  if (!value || typeof value !== "object") return "定位点待补充";
  const lat = text(value.lat);
  const lng = text(value.lng ?? value.lon);
  return lat && lng ? `${lat}, ${lng}` : "定位点待补充";
}

function deviceProfileText(value: any): string {
  if (!value || typeof value !== "object") return "采集设备待补充";
  return text(value.device_model ?? value.device_type ?? value.device_id) || "采集设备待补充";
}

function percentEvidenceText(value: unknown, fallback: string): string {
  const n = numberOrNull(value);
  return n == null ? fallback : `${formatNumber(n)}%`;
}

function buildPestDiseaseInspectionMainVisualVm(report: OperationReportV1, technicalRows: Array<{ label: string; value: string }>): CustomerReportMainVisualVm {
  const root = report as any;
  const pdi = root.pest_disease_inspection ?? {};
  const observationEvidence = pdi.observation_evidence ?? {};
  const latest = observationEvidence.latest_observation ?? {};
  const title = text(root.customer_title ?? root.operation_title) || "病虫害巡检报告";
  if (!root.pest_disease_inspection) return insufficientVm(title, ["缺少病虫害巡检投影"], technicalRows);
  if (pdi.customer_visible_eligible === false) {
    const reasons = asArray(pdi.blocking_reasons).map((item) => text(item)).filter(Boolean);
    return insufficientVm(title, reasons.length ? reasons : ["病虫害巡检报告条件不足"], technicalRows);
  }
  return {
    status: "FORMAL_READY",
    title,
    subtitle: "病虫害巡检摘要",
    rows: [
      { label: "巡检对象", value: pestDiseaseTargetText(pdi.target_type ?? latest.target_type) },
      { label: "疑似问题", value: text(pdi.suspected_issue_code ?? latest.suspected_issue_code) || "疑似问题待确认" },
      { label: "图片/媒体证据", value: mediaEvidenceText(latest.media_refs, pdi.media_count) },
      { label: "采集时间", value: text(latest.captured_at_text ?? latest.captured_at_ts) || "采集时间待补充" },
      { label: "定位点", value: geoPointText(latest.geo_point) },
      { label: "采集设备", value: deviceProfileText(latest.device_profile) },
      { label: "现场备注", value: text(latest.scout_note) || "现场备注待补充" },
      { label: "发生率", value: percentEvidenceText(latest.incidence_percent, "发生率待补充") },
      { label: "严重度", value: percentEvidenceText(latest.severity_percent, "严重度待补充") },
      { label: "影响面积", value: percentEvidenceText(latest.affected_area_percent, "影响面积待补充") },
      { label: "人工复核", value: pdi.reviewed_by_human === true ? "已完成人工复核" : pestDiseaseStatusText(pdi.review_status) },
      { label: "巡检证据验收", value: pestDiseaseStatusText(pdi.acceptance_status) },
      { label: "结论边界", value: "巡检证据通过不代表已执行喷药或防治闭环完成" },
    ],
    technicalRows: [
      ...technicalRows,
      { label: "巡检记录", value: text(pdi.inspection_id) || "--" },
      { label: "观测数量", value: text(observationEvidence.total_observations ?? 0) },
    ],
  };
}

function operationTechnicalRows(report: OperationReportV1): Array<{ label: string; value: string }> {
  const root = report as any;
  const identifiers = root.identifiers ?? {};
  return [
    { label: "报告入口", value: operationId(report) ? `/api/v1/reports/operation/${operationId(report)}` : "--" },
    { label: "作业记录", value: operationId(report) || "--" },
    { label: "建议记录", value: text(identifiers.recommendation_id) || "--" },
    { label: "处方记录", value: text(identifiers.prescription_id ?? root.prescription?.prescription_id) || "--" },
    { label: "审批记录", value: text(identifiers.approval_id ?? root.approval?.approval_id ?? root.approval?.request_id) || "--" },
    { label: "执行回执", value: text(identifiers.receipt_id ?? root.as_executed?.receipt_id ?? root.execution?.receipt_id) || "--" },
    { label: "执行记录", value: text(identifiers.as_executed_id ?? root.as_executed?.as_executed_id) || "--" },
  ];
}

export function buildCustomerFieldReportMainVisualVm(report?: FieldReportDetailV1 | null): CustomerReportMainVisualVm {
  if (!report) return insufficientVm("地块报告", ["缺少正式报告数据"], [{ label: "报告入口", value: "--" }]);
  const root = report as any;
  const fieldContext = root.field_context ?? {};
  const sensing = root.sensing_summary ?? {};
  const observations = sensing.observations ?? [];
  const technicalRows = fieldTechnicalRows(report);
  const validation = fieldFormalValidation(report);
  const title = text(fieldContext.field_name ?? root.field?.field_name) || "地块报告";
  if (!validation.ok) return insufficientVm(title, validation.reasons, technicalRows);

  const areaMu = numberOrNull(fieldContext.area_mu) as number;
  const soilMoisture = numberOrNull(observationValue(observations, "soil_moisture_percent")) as number;
  const rain72h = numberOrNull(observationValue(observations, "forecast_rain_72h_mm")) as number;
  const afterMoisture = numberOrNull(observationValue(observations, "soil_moisture_after_percent"));
  return {
    status: "FORMAL_READY",
    title,
    subtitle: "客户可读摘要",
    rows: [
      { label: "面积", value: `${formatNumber(areaMu, 0)} 亩` },
      { label: "边界", value: hasBoundary(fieldContext) ? "已接入" : "暂未接入" },
      { label: "作物", value: `${cropNameText(fieldContext)}，${cropStageText(fieldContext.crop_stage)}` },
      { label: "设备", value: deviceText(sensing.devices) ?? "设备摘要待确认" },
      { label: "感知", value: `灌前土壤水分 ${formatNumber(soilMoisture)}%，未来 72 小时降雨 ${formatNumber(rain72h, 0)}mm` },
      { label: "诊断", value: soilMoisture < 22 && rain72h <= 2 ? "土壤水分偏低，近期降雨不足" : text(sensing.diagnosis?.human) || "诊断待确认" },
      { label: "正式作业", value: Number(root.execution_summary?.formal_operation_count ?? 0) >= 1 ? "灌溉作业已通过验收" : "正式作业待确认" },
      { label: "价值记录", value: root.value_summary?.has_customer_visible_value === true ? "已形成可信价值记录" : "价值记录待确认" },
      { label: "田块记忆", value: afterMoisture != null ? "水分回升到目标区间" : "田块记忆待确认" },
    ],
    technicalRows,
  };
}

export function buildCustomerOperationReportMainVisualVm(report?: OperationReportV1 | null): CustomerReportMainVisualVm {
  if (!report) return insufficientVm("作业报告", ["缺少正式报告数据"], [{ label: "报告入口", value: "--" }]);
  const root = report as any;
  const technicalRows = operationTechnicalRows(report);
  if (isPestDiseaseInspectionReport(report)) return buildPestDiseaseInspectionMainVisualVm(report, technicalRows);
  const validation = operationFormalValidation(report);
  const title = text(root.customer_title ?? root.operation_title) || "作业报告";
  if (!validation.ok) return insufficientVm(title, validation.reasons, technicalRows);

  const observations = root.diagnostic_inputs?.observations ?? [];
  const soilMoisture = observationValue(observations, "soil_moisture_percent");
  const rain72h = observationValue(observations, "forecast_rain_72h_mm");
  const prescriptionAmount = numberOrNull(root.prescription?.amount) as number;
  const prescriptionUnit = text(root.prescription?.unit) || "mm";
  const executedAmount = numberOrNull(root.as_executed?.executed_amount) as number;
  const executionUnit = text(root.as_executed?.unit) || prescriptionUnit;
  const coveragePercent = numberOrNull(root.as_applied?.coverage_percent) as number;
  const why = soilMoisture != null && rain72h != null && soilMoisture < 22 && rain72h <= 2
    ? "土壤水分偏低，近期降雨不足"
    : text(root.why?.explain_human) || "作业原因待确认";

  return {
    status: "FORMAL_READY",
    title,
    subtitle: "客户可读摘要",
    rows: [
      { label: "为什么做", value: why },
      { label: "建议", value: `补灌 ${formatNumber(prescriptionAmount, 0)}${prescriptionUnit}` },
      { label: "审批", value: `${text(root.approval?.actor_name)}已审批` },
      { label: "任务", value: text(root.as_executed?.executor_label ?? root.as_executed?.executor_name ?? root.prescription?.executor_label) || "执行任务已确认" },
      { label: "执行", value: `实际补灌 ${formatNumber(executedAmount)}${executionUnit}，覆盖 ${formatNumber(coveragePercent, 0)}%` },
      { label: "验收", value: "已通过" },
      { label: "价值", value: "形成可信价值记录" },
      { label: "学习", value: "形成田块记忆" },
    ],
    technicalRows,
  };
}
