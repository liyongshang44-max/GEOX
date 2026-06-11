import React from "react";
import { Link, useParams } from "react-router-dom";
import { fetchOperationReport, type OperationReportV1 } from "../api/customerReports";
import { fetchOperationEnvironmentContext, type OperationEnvironmentContext } from "../api/weather";
import SectionSkeleton from "../components/common/SectionSkeleton";
import ErrorState from "../components/common/ErrorState";
import FieldGisMap from "../components/FieldGisMap";
import { FailSafeCustomerNotice, FormalChainSummaryCard, FormalScenarioBadge, ScenarioAcceptanceSummary, ScenarioValueMemorySummary, ZoneRollupSummary } from "../components/customer";
import FieldMemoryPanel from "../components/customer/FieldMemoryPanel";
import WeatherInterferencePanel from "../components/customer/WeatherInterferencePanel";
import { customerTimelineStatusLabel } from "../lib/customerLabels";
import { customerSafeName, customerSafeTitle } from "../lib/customerSafeText";
import { customerChainIntegrityLabel, customerSemanticLabel, isCustomerChainComplete } from "../lib/customerSemanticLabels";
import { customerReasonText, pestDiseaseAcceptanceStatusLabel, pestDiseaseAssessmentStatusLabel, pestDiseaseConfidenceLabel, pestDiseaseEvidenceTierLabel, pestDiseaseInspectionTargetLabel, pestDiseaseReviewStatusLabel, pestDiseaseSeverityLabel } from "../lib/customerScenarioLabels";
import { labelCustomerApprovalStatus, labelCustomerRoiStatus } from "../lib/customerStatusLabels";
import { buildOperationReportVm, type CustomerReportSectionVm, type OperationReportPageVm } from "../viewmodels/operationReportVm";
import { buildC8OperationMainVisualVm } from "../viewmodels/customerC8FormalReportVm";
import { buildCustomerOperationReportMainVisualVm } from "../viewmodels/customerReportMainVisualVm";
import { buildEvidenceVm } from "../lib/evidenceViewModel";
import { EvidenceGapPanel, EvidenceRefList, EvidenceTrustBadge, EvidenceTrustLegend } from "../components/evidence";

type BackendChainItem = { key: string; label: string; status: "DONE" | "AVAILABLE" | "PENDING" | "MISSING" | "NOT_APPLICABLE" | string; reason?: string | null; source?: string | null };
type MainRow = { label: string; value: string };
type MainSection = { key: "why" | "prescription_approval" | "execution" | "evidence_acceptance" | "value_learning"; title: string; summary: string; rows: MainRow[] };
type PestDiseaseSection = {
  key:
    | "inspection_reason"
    | "inspection_evidence"
    | "assessment_result"
    | "human_review"
    | "inspection_acceptance"
    | "next_boundary";
  title: string;
  summary: string;
  rows: MainRow[];
};
type SensingEvidenceVm = { summary: string; rows: MainRow[]; hasQuantifiedEvidence: boolean };

function isPestDiseaseInspectionReport(report: OperationReportV1): boolean {
  const anyReport = report as any;
  const scenario = String(
    anyReport.formal_scenario?.scenario_type ??
    anyReport.scenario_type ??
    "",
  ).toUpperCase();

  const operationType = String(
    anyReport.operation_type ??
    anyReport.prescription?.operation_type ??
    anyReport.customer_title ??
    anyReport.operation_title ??
    "",
  ).toUpperCase();

  return scenario === "FORMAL_PEST_DISEASE_INSPECTION"
    || Boolean(anyReport.pest_disease_inspection)
    || operationType.includes("PEST_DISEASE_INSPECTION");
}

const CHAIN_LABELS: Record<string, string> = {
  diagnosis: "诊断",
  recommendation: "建议",
  prescription: "处方",
  approval: "审批",
  operation_plan: "作业计划",
  execution: "执行",
  receipt: "回执",
  evidence: "证据",
  acceptance: "验收",
  roi: "价值记录",
  field_memory: "田块记忆",
};

function normalizeKey(value: unknown): string {
  return String(value ?? "").trim().replace(/[\s/-]+/g, "_").toUpperCase();
}

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isBlank(value: unknown): boolean {
  const raw = text(value);
  return !raw || raw === "--" || raw === "[object Object]" || raw.toLowerCase() === "null" || raw.toLowerCase() === "undefined";
}

function isTechnicalLike(value: unknown): boolean {
  const raw = text(value);
  return /^(rec|prc|apr|act|opl|ft_op|ft_field|receipt|recommendation|prescription|approval|operation|task)_[A-Za-z0-9_-]+$/i.test(raw)
    || /^[0-9a-f]{32}$/i.test(raw)
    || /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw);
}

function operationActionLabel(value: unknown, fallback = "作业"): string {
  const raw = text(value);
  const key = normalizeKey(raw);
  if (!raw) return fallback;
  if (["IRRIGATION", "IRRIGATE", "WATERING", "WATER"].includes(key) || key.includes("IRRIGATION")) return "灌溉";
  const mapped = customerSemanticLabel(raw, fallback);
  return /^[A-Z0-9_]{3,}$/.test(mapped) ? fallback : mapped;
}

function normalizeOperationNarrative(value: string): string {
  return value
    .replace(/\bIRRIGATION\s*([0-9]+(?:\.[0-9]+)?)\b/gi, "灌溉 $1 mm")
    .replace(/\bIRRIGATE\s*([0-9]+(?:\.[0-9]+)?)\b/gi, "灌溉 $1 mm")
    .replace(/\bIRRIGATION\b/gi, "灌溉")
    .replace(/\bIRRIGATE\b/gi, "灌溉");
}

function customerText(value: unknown, fallback = "暂无可展示信息"): string {
  if (isBlank(value) || isTechnicalLike(value)) return fallback;
  const raw = text(value);
  if (/1970\s*[\/-]/.test(raw)) return fallback;
  return normalizeOperationNarrative(customerSemanticLabel(raw, fallback));
}

function safeAuditValue(value: unknown, fallback = "暂无记录"): string {
  if (isTechnicalLike(value)) return "技术字段已隐藏，需排障时查看技术详情。";
  return customerText(value, fallback);
}

type CustomerChainStatus = "DONE" | "AVAILABLE" | "PENDING" | "MISSING" | "NOT_APPLICABLE";

const CUSTOMER_CHAIN_STATUS_BY_KEY: Record<string, CustomerChainStatus> = {
  DONE: "DONE",
  COMPLETE: "DONE",
  COMPLETED: "DONE",
  PASS: "DONE",
  SUCCESS: "DONE",
  SUCCEEDED: "DONE",
  VALID: "DONE",
  AVAILABLE: "AVAILABLE",
  PENDING: "PENDING",
  RUNNING: "PENDING",
  IN_PROGRESS: "PENDING",
  PENDING_ACCEPTANCE: "PENDING",
  NOT_APPLICABLE: "NOT_APPLICABLE",
};

function toCustomerStatus(status: unknown): CustomerChainStatus {
  return CUSTOMER_CHAIN_STATUS_BY_KEY[normalizeKey(status)] ?? "MISSING";
}

function chainLabel(value: unknown, fallback: string): string {
  const raw = text(value);
  const key = raw.toLowerCase();
  return CHAIN_LABELS[key] ?? customerSemanticLabel(raw, fallback);
}

function normalizeChain(report: OperationReportV1): BackendChainItem[] {
  const raw = (report as any).status_chain;
  if (Array.isArray(raw) && raw.length) {
    return raw.map((item, index) => {
      const key = String(item?.key ?? `chain_${index}`).trim() || `chain_${index}`;
      return {
        key,
        label: chainLabel(item?.label ?? key, `链路 ${index + 1}`),
        status: toCustomerStatus(item?.status),
        reason: item?.reason ?? null,
        source: item?.source ?? null,
      };
    });
  }
  return [{ key: "legacy", label: "历史链路", status: "MISSING", reason: "该作业为历史/人工链路，缺少正式建议或处方记录。", source: "frontend_legacy_guard" }];
}

function sectionByKey(vm: OperationReportPageVm, key: CustomerReportSectionVm["key"]): CustomerReportSectionVm | undefined {
  return vm.sections.find((item) => item.key === key);
}

function sectionForChain(vm: OperationReportPageVm, key: string): CustomerReportSectionVm | undefined {
  const normalized = key.toLowerCase();
  if (normalized === "recommendation" || normalized === "diagnosis") return sectionByKey(vm, "RECOMMENDATION");
  if (normalized === "prescription") return sectionByKey(vm, "PRESCRIPTION");
  if (normalized === "approval") return sectionByKey(vm, "APPROVAL");
  if (["operation_plan", "execution", "receipt"].includes(normalized)) return sectionByKey(vm, "EXECUTION");
  if (normalized === "evidence") return sectionByKey(vm, "EVIDENCE");
  if (normalized === "acceptance") return sectionByKey(vm, "ACCEPTANCE");
  if (normalized === "roi") return sectionByKey(vm, "ROI");
  if (normalized === "field_memory") return sectionByKey(vm, "MEMORY");
  return undefined;
}

function sectionSummary(section: CustomerReportSectionVm | undefined, fallback: string): string {
  if (!section || section.emptyState) return fallback;
  return customerText(section.summary, fallback);
}

function sectionItem(section: CustomerReportSectionVm | undefined, labelIncludes: string, fallback = "暂无记录"): string {
  const row = section?.items.find((item) => item.label.includes(labelIncludes));
  return customerText(row?.value, fallback);
}

function missingLinksText(report: OperationReportV1): string {
  const links = (report as any).missing_links;
  return Array.isArray(links) && links.length ? links.map((x) => chainLabel(x, "待补充环节")).join("、") : "无";
}

function deepValue(root: unknown, path: string): unknown {
  return path.split(".").reduce((current: unknown, segment) => {
    if (!isObject(current)) return undefined;
    return current[segment];
  }, root);
}

function firstValue(root: unknown, paths: string[]): unknown {
  for (const path of paths) {
    const value = deepValue(root, path);
    if (!isBlank(value)) return value;
  }
  return undefined;
}

function formatNumberValue(value: unknown, unit = ""): string {
  if (isBlank(value)) return "";
  if (typeof value === "number" && Number.isFinite(value)) return `${value}${unit}`;
  if (isObject(value)) {
    const v = firstValue(value, ["value", "current", "latest", "avg", "mean", "amount"]);
    const u = text(firstValue(value, ["unit", "uom"])) || unit;
    return formatNumberValue(v, u ? ` ${u}` : "");
  }
  return normalizeOperationNarrative(text(value));
}

function valueOrPending(value: unknown, fallback = "待补充"): string {
  const formatted = formatNumberValue(value);
  return formatted ? customerText(formatted, fallback) : fallback;
}

function listOrPending(value: unknown): string {
  if (Array.isArray(value)) {
    const items = value.map((item) => customerText(item, "")).filter(Boolean);
    return items.length ? items.join("、") : "待补充";
  }
  return valueOrPending(value);
}

function buildSensingEvidence(report: OperationReportV1): SensingEvidenceVm {
  const root = report as any;
  const soilMoisture = firstValue(root, [
    "diagnosis.soil_moisture",
    "diagnosis.sensing.soil_moisture",
    "diagnosis.inputs.soil_moisture",
    "recommendation.soil_moisture",
    "recommendation.sensing.soil_moisture",
    "recommendation.inputs.soil_moisture",
    "why.soil_moisture",
    "sensing.soil_moisture",
  ]);
  const threshold = firstValue(root, [
    "diagnosis.threshold",
    "diagnosis.soil_moisture_threshold",
    "recommendation.threshold",
    "recommendation.soil_moisture_threshold",
    "why.soil_moisture_threshold",
  ]);
  const observedAt = firstValue(root, [
    "diagnosis.observation_window",
    "diagnosis.window",
    "recommendation.observation_window",
    "recommendation.window",
    "why.observation_window",
  ]);
  const rainfall24h = firstValue(root, [
    "diagnosis.rainfall_24h_mm",
    "diagnosis.weather.rainfall_24h_mm",
    "recommendation.rainfall_24h_mm",
    "recommendation.weather.rainfall_24h_mm",
    "why.rainfall_24h_mm",
  ]);
  const forecast24h = firstValue(root, [
    "diagnosis.forecast_rainfall_24h_mm",
    "diagnosis.weather.forecast_rainfall_24h_mm",
    "recommendation.forecast_rainfall_24h_mm",
    "recommendation.weather.forecast_rainfall_24h_mm",
    "why.forecast_rainfall_24h_mm",
  ]);
  const source = firstValue(root, [
    "diagnosis.data_source",
    "diagnosis.source_summary",
    "recommendation.data_source",
    "recommendation.source_summary",
    "recommendation.data_summary",
    "why.source_summary",
  ]);
  const confidence = firstValue(root, [
    "diagnosis.confidence",
    "diagnosis.confidence_text",
    "recommendation.confidence",
    "recommendation.confidence_text",
    "why.confidence",
  ]);
  const missingInputs = firstValue(root, [
    "diagnosis.missing_inputs",
    "recommendation.missing_inputs",
    "why.missing_inputs",
  ]);

  const hasQuantifiedEvidence = [soilMoisture, threshold, rainfall24h, forecast24h].some((value) => !isBlank(value));
  const action = operationActionLabel(root.operation_type ?? root.prescription?.operation_type ?? root.prescription?.action, "作业");
  const summary = hasQuantifiedEvidence
    ? `系统基于地块感知数据形成${action}判断：土壤水分、天气和观测窗口已进入诊断摘要。`
    : `当前报告未提供可量化感知数据摘要；请补充土壤水分、天气和观测窗口，否则${action}建议仍存在黑箱风险。`;

  return {
    summary,
    hasQuantifiedEvidence,
    rows: [
      { label: "土壤水分", value: valueOrPending(soilMoisture) },
      { label: "触发阈值", value: valueOrPending(threshold) },
      { label: "观测窗口", value: valueOrPending(observedAt) },
      { label: "过去 24h 降雨", value: rainfall24h == null ? "待补充" : valueOrPending(rainfall24h, "待补充") },
      { label: "未来 24h 降雨预测", value: forecast24h == null ? "待补充" : valueOrPending(forecast24h, "待补充") },
      { label: "数据来源", value: valueOrPending(source, "土壤水分、天气与地块观测记录") },
      { label: "数据可信度", value: valueOrPending(confidence, "待补充") },
      { label: "缺失输入", value: listOrPending(missingInputs) },
    ],
  };
}

function approvalRecordLinked(reportAny: any): boolean {
  return Boolean((isObject(reportAny.approval) && Object.keys(reportAny.approval).length > 0) || reportAny.approval_request_id || reportAny.identifiers?.approval_id || reportAny.identifiers?.approval_request_id);
}

function approvalResultText(approval: any): string {
  const status = normalizeKey(approval?.status ?? approval?.result ?? approval?.verdict);
  if (!status) return "待确认";
  if (["APPROVED", "PASS", "SUCCESS", "SUCCEEDED", "DONE"].includes(status)) return "审批记录已接入，需复核";
  if (["REJECTED", "FAIL", "FAILED", "RETURNED"].includes(status)) return "已退回";
  if (["PENDING", "REQUESTED", "WAITING"].includes(status)) return "待确认";
  return labelCustomerApprovalStatus(status);
}

function acceptanceResultText(value: unknown): string {
  const key = normalizeKey(value);
  if (!key) return "待确认";
  if (["PASS", "SUCCESS", "SUCCEEDED", "APPROVED"].includes(key)) return "需复核";
  if (["FAIL", "FAILED", "REJECTED"].includes(key)) return "未通过";
  if (["PENDING", "PENDING_ACCEPTANCE", "WAITING"].includes(key)) return "待确认";
  return "需复核";
}

function evidenceChainText(vm: OperationReportPageVm): string {
  if (vm.evidenceSummary.state === "PACK_SUMMARY") return "证据链完整";
  if (vm.evidenceSummary.state === "RECORDS_WITHOUT_SUMMARY") return "证据已记录，证据包摘要待生成";
  return "证据不足，需补齐后复核";
}

function formatRoiNumber(value: unknown, forceUnavailable = false): string {
  if (forceUnavailable || value === null || value === undefined || value === "") return "暂不可计算";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "暂不可计算";
  if (n === 0) return "0";
  return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 }).format(n);
}

function roiBasisText(value: unknown): string {
  const raw = text(value);
  const key = normalizeKey(raw);
  if (!raw || key === "COST_PROJECTION_ONLY_BASELINE_MISSING") return "当前仅有成本预测，缺少产量/价格基线";
  return customerText(raw, "当前仅有成本预测，缺少产量/价格基线");
}

function roiStatusText(reportAny: any): string {
  const roi = reportAny.roi ?? reportAny.roi_ledger ?? {};
  const projection = roi.projection ?? reportAny.prescription?.value_projection ?? {};
  const hypothesis = roi.hypothesis ?? reportAny.recommendation?.value_hypothesis ?? {};
  const status = normalizeKey(roi.status ?? projection.status ?? hypothesis.status ?? projection.projection_basis ?? hypothesis.baseline_status);
  if (!status || status.includes("BASELINE_MISSING") || normalizeKey(projection.projection_basis).includes("BASELINE_MISSING")) return "缺少收益基线";
  return labelCustomerRoiStatus(status);
}

function buildValueRows(reportAny: any): { summary: string; rows: MainRow[] } {
  const roi = reportAny.roi ?? reportAny.roi_ledger ?? {};
  const projection = roi.projection ?? reportAny.prescription?.value_projection ?? {};
  const hypothesis = roi.hypothesis ?? reportAny.recommendation?.value_hypothesis ?? {};
  const status = roiStatusText(reportAny);
  const baselineMissing = status === "缺少收益基线";
  const plannedCost = formatRoiNumber(projection.planned_cost ?? projection.cost ?? hypothesis.planned_cost);
  const expectedBenefit = formatRoiNumber(projection.expected_benefit ?? hypothesis.expected_benefit, baselineMissing);
  const expectedNet = formatRoiNumber(projection.expected_net_value ?? projection.expected_net ?? hypothesis.expected_net_value, baselineMissing);
  const basis = roiBasisText(projection.projection_basis ?? hypothesis.baseline_source ?? roi.projection_basis);
  const summary = baselineMissing
    ? "已有价值假设和计划成本记录；缺少历史产量/价格基线，暂不形成可信收益结论。"
    : "已有价值假设和作业学习记录，最终收益需结合后续证据复核。";
  return { summary, rows: [{ label: "价值状态", value: status }, { label: "计划成本", value: plannedCost }, { label: "预期收益", value: expectedBenefit }, { label: "预期净值", value: expectedNet }, { label: "依据", value: basis }] };
}

function buildPrescriptionRows(section: CustomerReportSectionVm | undefined, operationTypeText: string): MainRow[] {
  const rows = section?.items ?? [];
  const pick = (label: string, fallback: string) => customerText(rows.find((item) => item.label.includes(label))?.value, fallback);
  return [
    { label: "作业类型", value: operationTypeText },
    { label: "做什么", value: pick("做什么", `${operationTypeText}作业`) },
    { label: "做多少", value: pick("做多少", "作业量待确认") },
    { label: "验收条件", value: pick("验收条件", "验收条件待确认") },
  ];
}

function buildMainSections(vm: OperationReportPageVm, report: OperationReportV1): MainSection[] {
  const reportAny = report as any;
  const recommendation = sectionByKey(vm, "RECOMMENDATION");
  const prescription = sectionByKey(vm, "PRESCRIPTION");
  const approval = reportAny.approval ?? {};
  const execution = sectionByKey(vm, "EXECUTION");
  const acceptanceStatus = vm.acceptance.statusText;
  const operationTypeText = operationActionLabel(reportAny.operation_type ?? reportAny.prescription?.operation_type ?? reportAny.prescription?.action, "作业");
  const value = buildValueRows(reportAny);
  const sensing = buildSensingEvidence(report);
  const approvalLinked = approvalRecordLinked(reportAny);
  const receiptRecorded = Boolean(reportAny.execution?.receipt_id || report.evidence?.receipt_present || reportAny.identifiers?.receipt_id);
  const dispatched = Boolean(reportAny.execution?.act_task_id || reportAny.identifiers?.act_task_id || normalizeKey(reportAny.execution?.dispatch_status) === "DISPATCHED");

  return [
    {
      key: "why",
      title: "为什么做",
      summary: sensing.hasQuantifiedEvidence
        ? `系统不是直接给出${operationTypeText}结论，而是先读取感知数据，再形成诊断与建议。${sensing.summary}`
        : sensing.summary,
      rows: [
        ...sensing.rows,
        { label: "诊断结论", value: sectionSummary(recommendation, `形成${operationTypeText}建议`) },
        { label: "农艺解释", value: sectionItem(recommendation, "农艺解释", `感知数据摘要待补充，无法完整解释${operationTypeText}建议。`) },
        { label: "风险等级", value: sectionItem(recommendation, "风险等级", "风险待确认") },
      ],
    },
    {
      key: "prescription_approval",
      title: "处方与审批",
      summary: `${sectionSummary(prescription, `已形成${operationTypeText}处方。`)}审批记录${approvalLinked ? "已关联" : "待关联"}，审批结果${approvalResultText(approval)}。`,
      rows: [
        ...buildPrescriptionRows(prescription, operationTypeText),
        { label: "审批记录", value: approvalLinked ? "已关联" : "待关联" },
        { label: "审批结果", value: approvalResultText(approval) },
        { label: "审批人", value: customerText(approval.actor_name ?? approval.actor ?? approval.approver_name, "待确认") },
        { label: "审批意见", value: customerText(approval.note ?? approval.comment ?? approval.reason, "暂无") },
      ],
    },
    {
      key: "execution",
      title: "执行结果",
      summary: `${dispatched ? "任务已派发到设备" : "任务派发状态待确认"}，${receiptRecorded ? "执行回执已记录" : "执行回执待记录"}。`,
      rows: [
        { label: "派发状态", value: dispatched ? "任务已派发到设备" : "派发状态待确认" },
        { label: "执行状态", value: sectionSummary(execution, vm.execution.statusText || "执行状态待确认") },
        { label: "执行回执", value: receiptRecorded ? "已记录" : "待记录" },
        { label: "完成时间", value: customerText(reportAny.execution?.finished_at ?? report.execution?.execution_finished_at ?? vm.operation.updatedAtText, "暂无完成时间") },
      ],
    },
    {
      key: "evidence_acceptance",
      title: "证据与验收",
      summary: `${evidenceChainText(vm)}，验收结论${acceptanceStatus}。`,
      rows: [
        { label: "证据链", value: evidenceChainText(vm) },
        { label: "证据摘要", value: customerText(vm.evidenceSummary.summary, "证据摘要待生成") },
        { label: "验收结论", value: acceptanceStatus },
        { label: "复核提示", value: customerText(vm.evidenceSummary.detail, "无") },
      ],
    },
    {
      key: "value_learning",
      title: "价值与学习",
      summary: value.summary,
      rows: [...value.rows, { label: "田块记忆", value: sectionSummary(sectionByKey(vm, "MEMORY"), "暂无可展示的田块记忆") }],
    },
  ];
}

function buildPestDiseaseInspectionSections(report: OperationReportV1): PestDiseaseSection[] {
  const root = report as any;
  const pdi = root.pest_disease_inspection ?? {};
  const assessment = pdi.assessment ?? {};
  const evidence = pdi.evidence ?? {};
  const review = pdi.human_review ?? {};
  const acceptance = root.acceptance ?? pdi.acceptance ?? {};
  const nextStep = pdi.next_step ?? {};
  const blockingReasons = Array.isArray(pdi.blocking_reasons) ? pdi.blocking_reasons.map((x: unknown) => customerText(x, "")).filter(Boolean).join("、") : "无";
  const blocking = Array.isArray(pdi.blocking_reasons) ? pdi.blocking_reasons.map((x: unknown) => String(x ?? "").trim().toLowerCase()) : [];
  const skillSignalOnly = blocking.includes("pest_disease_skill_signal_only");
  const mediaCountRaw = pdi.media_count;
  const mediaCount = typeof mediaCountRaw === "number" ? mediaCountRaw : Number(mediaCountRaw);
  const mediaMissing = !Number.isFinite(mediaCount) || mediaCount <= 0;
  const geoPresent = Boolean(pdi.geo_evidence_present);
  const geoMissing = !geoPresent;
  const reviewedByHuman = Boolean(pdi.reviewed_by_human);
  const evidenceGap = Array.isArray(pdi.blocking_reasons) && pdi.blocking_reasons.length
    ? pdi.blocking_reasons.map((x: unknown) => customerReasonText(x)).join("、")
    : "无";
  const customerVisibleEligible = pdi.customer_visible_eligible !== false;
  const reviewRequired = Boolean(pdi.review_required);
  const reviewStatusRaw = String(pdi.review_status ?? "").trim().toUpperCase();
  const observationEvidence = isObject(pdi.observation_evidence) ? pdi.observation_evidence : {};
  const evidenceItems = Array.isArray((observationEvidence as any).items) ? (observationEvidence as any).items : [];
  const latestObservation = isObject((observationEvidence as any).latest_observation) ? (observationEvidence as any).latest_observation : {};
  const latestMediaRefs = Array.isArray((latestObservation as any).media_refs) ? (latestObservation as any).media_refs : [];
  const latestMediaRefText = latestMediaRefs.length
    ? latestMediaRefs.slice(0, 3).map((m: any) => customerText(`${text(m?.kind) || "media"}:${text(m?.ref_id) || "--"}`, "")).filter(Boolean).join("；")
    : "暂无图片/媒体引用";
  const latestGeo = isObject((latestObservation as any).geo_point) ? `${text((latestObservation as any).geo_point?.lat)}, ${text((latestObservation as any).geo_point?.lng)}` : "暂无定位";
  const latestCapturedAt = customerText((latestObservation as any).captured_at_text ?? (latestObservation as any).captured_at_ts, "暂无时间");
  const latestDevice = customerText(
    firstValue(latestObservation, ["device_profile.device_model", "device_profile.device_type", "device_profile.device_id"]),
    "暂无设备来源",
  );
  const latestNote = customerText((latestObservation as any).scout_note, "暂无巡检备注");
  const latestPlantPart = customerText((latestObservation as any).plant_part, "待补充");
  const latestIssueCode = customerText((latestObservation as any).suspected_issue_code ?? pdi.suspected_issue_code, "待确认");
  const latestIncidence = valueOrPending((latestObservation as any).incidence_percent, "%");
  const latestSeverityPercent = valueOrPending((latestObservation as any).severity_percent, "%");
  const latestAffectedArea = valueOrPending((latestObservation as any).affected_area_percent, "%");
  const latestEvidenceQuality = customerText((latestObservation as any).evidence_quality, "待补充");
  const hasLatestObservation = Boolean(Object.keys(latestObservation).length);
  const inspectionEvidenceSummary = hasLatestObservation
    ? (mediaMissing || geoMissing
      ? "巡检任务已有记录，但缺少定位或图片证据，需复核。"
      : customerText(pdi.evidence_summary ?? evidence.summary, "已记录巡检证据，待进一步复核。"))
    : "暂无可展示的巡检观察明细；当前仅有汇总计数。";

  return [
    {
      key: "inspection_reason",
      title: "为什么巡检",
      summary: customerText(pdi.reason_summary ?? pdi.summary_reason, "因识别到疑似病虫害风险，触发巡检任务。"),
      rows: [
        { label: "巡检目标", value: pestDiseaseInspectionTargetLabel(pdi.inspection_target ?? pdi.target_type) },
        { label: "疑似问题", value: customerText(pdi.suspected_issue_code, "待确认") },
        { label: "触发说明", value: "发现疑似病虫害风险，进入巡检证据链" },
        { label: "证据等级", value: pestDiseaseEvidenceTierLabel(pdi.evidence_tier ?? evidence.evidence_tier) },
        { label: "是否仅识别信号", value: skillSignalOnly ? "当前仅为识别信号，不作为正式巡检结论。" : "否" },
      ],
    },
    {
      key: "inspection_evidence",
      title: "巡检证据",
      summary: inspectionEvidenceSummary,
      rows: [
        { label: "图片/媒体证据", value: latestMediaRefText },
        { label: "采集时间", value: latestCapturedAt },
        { label: "定位点", value: latestGeo },
        { label: "设备来源", value: latestDevice },
        { label: "现场备注", value: latestNote },
        { label: "观察部位", value: latestPlantPart },
        { label: "疑似问题", value: latestIssueCode },
        { label: "发生率", value: latestIncidence },
        { label: "严重度比例", value: latestSeverityPercent },
        { label: "影响面积", value: latestAffectedArea },
        { label: "证据质量", value: latestEvidenceQuality },
        { label: "巡检观察次数", value: `${Number((observationEvidence as any).total_observations ?? evidenceItems.length) || 0} 次` },
        { label: "人工复核", value: reviewedByHuman ? "已完成" : "尚未完成" },
        { label: "证据等级", value: pestDiseaseEvidenceTierLabel(pdi.evidence_tier ?? evidence.evidence_tier) },
        { label: "证据缺口", value: evidenceGap },
      ],
    },
    {
      key: "assessment_result",
      title: "识别与诊断结论",
      summary: customerVisibleEligible
        ? customerText(assessment.summary ?? pdi.assessment_summary, "巡检识别已记录，结论待复核。")
        : "需要补齐正式链路后展示",
      rows: [
        { label: "巡检结论", value: pestDiseaseAssessmentStatusLabel(assessment.status ?? pdi.assessment_status) },
        { label: "巡检对象", value: pestDiseaseInspectionTargetLabel(pdi.target_type ?? assessment.target_type ?? pdi.inspection_target) },
        { label: "疑似问题", value: customerText(pdi.suspected_issue_code ?? assessment.suspected_issue_code, "待确认") },
        { label: "严重度", value: pestDiseaseSeverityLabel(assessment.severity ?? pdi.severity) },
        { label: "置信度", value: pestDiseaseConfidenceLabel(assessment.confidence ?? pdi.confidence) },
        { label: "客户可见", value: customerVisibleEligible ? "可展示" : "需补齐正式链路后展示" },
        { label: "阻塞原因", value: evidenceGap },
      ],
    },
    {
      key: "human_review",
      title: "人工复核",
      summary: reviewStatusRaw === "REJECTED"
        ? "人工复核未通过，暂不展示为正式结论。"
        : customerText(review.summary ?? pdi.review_summary, "人工复核状态待更新。"),
      rows: [
        { label: "是否需要人工复核", value: reviewRequired ? "需要" : "不需要" },
        { label: "复核状态", value: reviewRequired ? pestDiseaseReviewStatusLabel(review.status ?? pdi.review_status) : "不需要" },
        { label: "复核结果", value: reviewedByHuman ? "已记录" : "尚未完成" },
      ],
    },
    {
      key: "inspection_acceptance",
      title: "巡检证据验收",
      summary: (String(acceptance.status ?? pdi.acceptance_status ?? "").trim().toUpperCase() === "PASS")
        ? "巡检证据已有记录，可作为后续处理建议依据；仍以正式链路校验为准，且不代表防治闭环。"
        : customerVisibleEligible
          ? customerText(acceptance.summary ?? pdi.acceptance_summary, "巡检证据验收状态待确认。")
          : "需要补齐正式链路后展示",
      rows: [
        { label: "巡检证据验收", value: pestDiseaseAcceptanceStatusLabel(acceptance.status ?? pdi.acceptance_status) },
        { label: "验收说明", value: "巡检证据已有记录，可作为后续处理建议依据；仍以正式链路校验为准，且不代表防治闭环。" },
        { label: "客户可见", value: customerVisibleEligible ? "可展示" : "需补齐正式链路后展示" },
        { label: "证据缺口", value: evidenceGap },
      ],
    },
    {
      key: "next_boundary",
      title: "后续处理边界",
      summary: "当前仅完成巡检证据链；是否补喷、用药、派发执行任务，需进入后续正式决策链路。",
      rows: [
        { label: "补喷处方", value: "尚未生成补喷处方" },
        { label: "防治执行任务", value: "尚未形成防治执行任务" },
        { label: "防治效果验收", value: "尚未形成防治效果验收" },
        { label: "结论边界", value: "不代表防治闭环" },
      ],
    },
  ];
}

function MainSectionCard({ section }: { section: MainSection | PestDiseaseSection }): React.ReactElement {
  return (
    <article className="customerCard operationMainSectionCard">
      <h2 className="customerCardTitle">{section.title}</h2>
      <p className="operationOneLiner">{section.summary}</p>
      <div className="customerGrid2 customerSpacingTopXs">
        {section.rows.map((row) => <div key={`${section.key}-${row.label}`}><strong>{row.label}：</strong>{row.value}</div>)}
      </div>
    </article>
  );
}

function auditRowsForChain(report: OperationReportV1, vm: OperationReportPageVm, item: BackendChainItem): MainRow[] {
  const normalized = item.key.toLowerCase();
  if (normalized === "diagnosis") return buildSensingEvidence(report).rows;
  const section = sectionForChain(vm, item.key);
  if (!section?.items.length) return [];
  return section.items.slice(0, 6).map((row) => ({ label: row.label, value: safeAuditValue(row.value) }));
}

function auditSummaryForChain(report: OperationReportV1, vm: OperationReportPageVm, item: BackendChainItem): string {
  if (item.key.toLowerCase() === "diagnosis") return buildSensingEvidence(report).summary;
  const section = sectionForChain(vm, item.key);
  return section?.summary ? customerText(section.summary, "暂无链路说明") : customerText(item.reason, "暂无链路说明");
}

function AuditChain({ chain, vm, report }: { chain: BackendChainItem[]; vm: OperationReportPageVm; report: OperationReportV1 }): React.ReactElement {
  return (
    <section className="customerCard operationAuditChain">
      <details>
        <summary className="operationTechDetailsSummary">审计链路（默认折叠）</summary>
        <p className="customerMetricLabel customerSpacingTopSm">以下为诊断、建议、处方、审批、执行、证据、验收、价值和田块记忆的摘要链路。技术来源和原始编号默认不进入客户主视图。</p>
        <div className="operationClosedLoopGrid customerSpacingTopSm">
          {chain.map((item, index) => {
            const rows = auditRowsForChain(report, vm, item);
            return (
              <details key={item.key} className="customerCard operationClosedLoopCard">
                <summary>
                  <span className="operationStepNo">{index + 1}</span> {item.label}：{customerTimelineStatusLabel(toCustomerStatus(item.status))}
                </summary>
                <p className="operationOneLiner customerSpacingTopXs">{auditSummaryForChain(report, vm, item)}</p>
                {rows.length ? (
                  <div className="customerGrid2 customerSpacingTopXs">
                    {rows.map((row) => <div key={`${item.key}-${row.label}`}><strong>{row.label}：</strong>{row.value}</div>)}
                  </div>
                ) : <p className="muted customerSpacingTopXs">该环节暂无客户可读明细。</p>}
              </details>
            );
          })}
        </div>
      </details>
    </section>
  );
}

function PestDiseaseAuditChain({ report }: { report: OperationReportV1 }): React.ReactElement {
  const pdi = ((report as any).pest_disease_inspection ?? {}) as any;
  const obs = isObject(pdi.observation_evidence?.latest_observation) ? pdi.observation_evidence.latest_observation : {};
  const mediaRefs = Array.isArray(obs.media_refs) ? obs.media_refs : [];
  const mediaText = mediaRefs.length
    ? mediaRefs.slice(0, 5).map((m: any) => `${text(m?.kind) || "media"}:${text(m?.ref_id) || "--"}`).join("；")
    : "暂无图片/媒体引用";
  const geoText = isObject(obs.geo_point) ? `${text(obs.geo_point?.lat)}, ${text(obs.geo_point?.lng)}` : "暂无定位";
  return (
    <section className="customerCard operationAuditChain">
      <details>
        <summary className="operationTechDetailsSummary">巡检审计链路（默认折叠）</summary>
        <p className="customerMetricLabel customerSpacingTopSm">以下为病虫害巡检证据链摘要：观测依据、人工复核与验收边界。</p>
        <div className="operationClosedLoopGrid customerSpacingTopSm">
          <details className="customerCard operationClosedLoopCard">
            <summary><span className="operationStepNo">1</span> 观测依据：{customerTimelineStatusLabel("DONE")}</summary>
            <div className="customerGrid2 customerSpacingTopXs">
              <div><strong>图片/媒体证据：</strong>{customerText(mediaText, "暂无图片/媒体引用")}</div>
              <div><strong>采集时间：</strong>{customerText(obs.captured_at_text ?? obs.captured_at_ts, "暂无时间")}</div>
              <div><strong>定位点：</strong>{customerText(geoText, "暂无定位")}</div>
              <div><strong>设备来源：</strong>{customerText(firstValue(obs, ["device_profile.device_model", "device_profile.device_type", "device_profile.device_id"]), "暂无设备来源")}</div>
            </div>
          </details>
          <details className="customerCard operationClosedLoopCard">
            <summary><span className="operationStepNo">2</span> 复核与验收：{customerTimelineStatusLabel("AVAILABLE")}</summary>
            <div className="customerGrid2 customerSpacingTopXs">
              <div><strong>人工复核：</strong>{Boolean(pdi.reviewed_by_human) ? "已记录" : "尚未完成"}</div>
              <div><strong>复核状态：</strong>{pestDiseaseReviewStatusLabel(pdi.review_status)}</div>
              <div><strong>验收状态：</strong>{pestDiseaseAcceptanceStatusLabel(pdi.acceptance_status)}</div>
              <div><strong>结论边界：</strong>巡检结论不等于防治执行闭环。</div>
            </div>
          </details>
        </div>
      </details>
    </section>
  );
}

function isGeoJsonLike(value: unknown): boolean {
  if (!isObject(value)) return false;
  const type = text(value.type);
  return ["Feature", "FeatureCollection", "Polygon", "MultiPolygon", "LineString", "MultiLineString"].includes(type);
}

function reportGeoJson(root: any, paths: string[]): unknown | null {
  for (const path of paths) {
    const value = firstValue(root, [path]);
    if (isGeoJsonLike(value)) return value;
  }
  return null;
}

function reportTrajectorySegments(root: any): Array<{ id: string; label: string; status: "READY"; color: string; coordinates: Array<[number, number]> }> {
  const raw = firstValue(root, ["as_applied.trajectory_segments", "as_applied.trajectorySegments", "execution.trajectory_segments", "execution.trajectorySegments"]);
  if (!Array.isArray(raw)) return [];
  return raw.map((segment: any, index) => {
    const coordinates = Array.isArray(segment?.coordinates) ? segment.coordinates : Array.isArray(segment?.path) ? segment.path : [];
    return {
      id: text(segment?.id ?? segment?.segment_id) || `trajectory-${index}`,
      label: customerText(segment?.label ?? segment?.name, `轨迹 ${index + 1}`),
      status: "READY" as const,
      color: text(segment?.color) || "#2563eb",
      coordinates: coordinates
        .map((point: any) => Array.isArray(point) ? [Number(point[0]), Number(point[1])] as [number, number] : [Number(point?.lon ?? point?.lng), Number(point?.lat)] as [number, number])
        .filter(([lon, lat]) => Number.isFinite(lon) && Number.isFinite(lat)),
    };
  }).filter((segment) => segment.coordinates.length > 0);
}

function EvidencePackMetadataBlock({ report }: { report: OperationReportV1 }): React.ReactElement {
  const evidencePack = (report as any).evidence_pack_summary ?? (report as any).evidence_pack ?? {};
  const sha256 = text(evidencePack.sha256 ?? evidencePack.checksum_sha256 ?? evidencePack.checksum) || "暂无文件校验值";
  return <article className="customerCard"><h3 className="customerCardTitle">证据包元数据</h3><div className="customerGrid2 customerSpacingTopXs"><div><strong>证据包状态：</strong>{customerText(evidencePack.status ?? evidencePack.summary, "证据包摘要待生成")}</div><div><strong>sha256：</strong>{customerText(sha256, "暂无文件校验值")}</div><div><strong>下载状态：</strong>{customerText(evidencePack.download_status, "后端未返回安全下载入口")}</div><div><strong>边界：</strong>只展示后端 report API 返回的证据包元数据。</div></div></article>;
}


function operationReportObservation(root: any, metric: string): any | null {
  const observations = root?.diagnostic_inputs?.observations;
  if (!Array.isArray(observations)) return null;
  return observations.find((item: any) => String(item?.metric ?? "").trim() === metric) ?? null;
}

function operationReportNumber(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function operationReportValueWithUnit(value: unknown, unit?: unknown): string {
  const n = operationReportNumber(value);
  const u = text(unit).trim();
  if (n == null) return "";
  return u ? String(n) + u : String(n);
}

function OperationReportWeatherPanel({ report, fallbackContext, loading }: { report: OperationReportV1; fallbackContext: OperationEnvironmentContext | null; loading: boolean }): React.ReactElement {
  const root = report as any;
  const weatherSummary = root.weather_summary ?? {};
  const forecast72h = operationReportObservation(root, "forecast_rain_72h_mm");
  const temperatureMax = operationReportObservation(root, "temperature_max_c");

  if (forecast72h || weatherSummary?.narrative) {
    const rainText = operationReportValueWithUnit(weatherSummary.rainfall_forecast_mm ?? forecast72h?.value, forecast72h?.unit || "mm");
    const temperatureText = operationReportValueWithUnit(weatherSummary.max_temperature_c ?? temperatureMax?.value, temperatureMax?.unit || "℃") || "未纳入本次判断";
    const narrative = customerText(weatherSummary.narrative, "天气输入已纳入本次农事判断。");
    return (
      <article className="customerCard">
        <h3 className="customerCardTitle">天气干扰</h3>
        <div className="customerWeatherBox customerSpacingTopSm">
          <div className="customerWeatherHeader">
            <div>
              <strong>天气干扰说明</strong>
              <p>天气数据来自 operation report 的诊断输入，用于解释作业背景，不单独替代验收结论。</p>
            </div>
            <span className="customerPill">报告内嵌天气输入</span>
          </div>
          <div className="customerGrid4 customerSpacingTopSm">
            <div className="customerMetricCard"><small>未来 72 小时降雨</small><strong>{rainText || "待补充"}</strong></div>
            <div className="customerMetricCard"><small>最高气温</small><strong>{temperatureText}</strong></div>
            <div className="customerMetricCard customerMetricCardWide"><small>诊断参考</small><strong>{narrative}</strong></div>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="customerCard">
      <h3 className="customerCardTitle">天气干扰</h3>
      <WeatherInterferencePanel context={fallbackContext} loading={loading} />
    </article>
  );
}

function operationReportFieldMemoryItems(report: OperationReportV1): any[] {
  const root = report as any;
  const memory = root.field_memory ?? {};
  const candidates = [
    memory.field_response_memory,
    memory.customer_visible_memory,
    memory.items,
    memory.memories,
  ];
  return candidates.flatMap((value) => Array.isArray(value) ? value : []);
}

function operationReportFormalMemoryVisible(item: any): boolean {
  if (!item || typeof item !== "object") return false;
  if (item.customer_visible_memory === true || item.customer_visible === true || item.customer_visible_eligible === true) return true;
  const lane = String(item.memory_lane ?? item.lane ?? item.visibility ?? "").toUpperCase();
  const trust = String(item.trust_level ?? item.status ?? "").toUpperCase();
  if (/FORMAL|CUSTOMER_VISIBLE|ACCEPTED|PASSED/.test(lane)) return true;
  if (/FORMAL|ACCEPTED|PASSED/.test(trust)) return true;
  return false;
}

function OperationReportFieldMemoryPanel({ report, fieldId, operationId }: { report: OperationReportV1; fieldId: unknown; operationId: unknown }): React.ReactElement {
  const memorySummary = (report as any).customer_memory_summary ?? null;

  if (memorySummary && typeof memorySummary === "object") {
    const learned = customerText(memorySummary.learned, "已形成正式田块记忆");
    const confidence = customerText(memorySummary.confidence, "可信度待补充");
    const beforeValue = text(memorySummary.before_value);
    const afterValue = text(memorySummary.after_value);
    const deltaValue = text(memorySummary.delta_value);

    return (
      <article className="customerCard">
        <h3 className="customerCardTitle">田块记忆</h3>
        <div className="customerFieldMemoryPanel isCompact">
          <div className="customerFieldMemoryHeader">
            <div>
              <p className="customerFieldMemorySubtitle">基于正式验收结果生成的客户可见田块响应记忆。</p>
              <small>来源：正式作业报告</small>
            </div>
            <span>正式记忆</span>
          </div>
          <div className="customerFieldMemoryEntries">
            <article className="customerFieldMemoryEntry">
              <div className="customerFieldMemoryEntryHead">
                <strong>{customerText(memorySummary.title, "田块响应记忆")}</strong>
                <span>{confidence}</span>
              </div>
              <div className="customerFieldMemoryLearned">
                <span>系统学到了什么</span>
                <p>{learned}</p>
              </div>
              <p className="customerFieldMemorySummary">
                灌前 {beforeValue || "待生成"} → 灌后 {afterValue || "待生成"}；变化 {deltaValue || "待生成"} 个百分点
              </p>
            </article>
          </div>
        </div>
      </article>
    );
  }

  const items = operationReportFieldMemoryItems(report).filter(operationReportFormalMemoryVisible);

  if (!items.length) {
    return (
      <article className="customerCard">
        <h3 className="customerCardTitle">田块记忆</h3>
        <FieldMemoryPanel fieldId={fieldId} operationId={operationId} embeddedMemory={(report as any).field_memory} compact />
      </article>
    );
  }

  return (
    <article className="customerCard">
      <h3 className="customerCardTitle">田块记忆</h3>
      <div className="customerFieldMemoryPanel isCompact">
        <div className="customerFieldMemoryHeader">
          <div>
            <p className="customerFieldMemorySubtitle">当前展示 operation report 内嵌的正式客户可见田块记忆。</p>
            <small>来源：formal field memory</small>
          </div>
          <span>正式记忆</span>
        </div>
        <div className="customerFieldMemoryEntries">
          {items.map((item, index) => {
            const learned = customerText(item.customer_text ?? item.learned_text ?? item.summary_text ?? item.text, "已形成正式田块记忆");
            const summary = customerText(item.customer_summary_text ?? item.customer_detail_text ?? item.detail_text ?? item.explain_text ?? item.description, "");
            const shouldShowSummary = Boolean(summary && summary !== learned);
            const confidence = customerText(item.confidence ?? item.confidence_score ?? item.trust_level, "可信度待补充");
            return (
              <article key={String(item.memory_id ?? item.memory_code ?? index)} className="customerFieldMemoryEntry">
                <div className="customerFieldMemoryEntryHead">
                  <strong>田块响应记忆</strong>
                  <span>{confidence}</span>
                </div>
                <div className="customerFieldMemoryLearned">
                  <span>系统学到了什么</span>
                  <p>{learned}</p>
                </div>
                {shouldShowSummary ? <p className="customerFieldMemorySummary">{summary}</p> : null}
              </article>
            );
          })}
        </div>
      </div>
    </article>
  );
}

function OperationSpatialExecutionPanel({ report }: { report: OperationReportV1 }): React.ReactElement {
  const root = report as any;
  const plannedGeoJson = reportGeoJson(root, ["planned_geojson", "plan.planned_geojson", "prescription.planned_geojson", "prescription.geometry", "operation_plan.planned_geojson"]);
  const coverageGeoJson = reportGeoJson(root, ["coverage_geojson", "as_applied.coverage_geojson", "as_applied.geometry", "as_applied.coverageGeometry"]);
  const trajectorySegments = reportTrajectorySegments(root);
  const asApplied = root.as_applied ?? {};
  const application = asApplied.application ?? {};
  const coveragePercent = firstValue(root, ["as_applied.coverage_percent", "as_applied.coveragePercent", "execution.coverage_percent", "execution.coveragePercent"]);
  const appliedAmount = firstValue(root, ["as_applied.application.applied_amount", "as_applied.applied_amount", "execution.applied_amount"]);
  const appliedUnit = firstValue(root, ["as_applied.application.applied_unit", "as_applied.applied_unit", "execution.applied_unit"]);
  const plannedAmount = firstValue(root, ["as_applied.application.planned_amount", "as_applied.planned_amount", "prescription.amount", "operation_plan.planned_amount"]);
  const plannedUnit = firstValue(root, ["as_applied.application.planned_unit", "as_applied.planned_unit", "prescription.unit", "operation_plan.planned_unit"]);
  const hasAsAppliedRecord = !isBlank(coveragePercent) || !isBlank(appliedAmount) || !isBlank(plannedAmount) || Object.keys(application).length > 0;
  const hasSpatialEvidence = Boolean(plannedGeoJson || coverageGeoJson || trajectorySegments.length);

  return (
    <article className="customerCard">
      <h3 className="customerCardTitle">空间执行</h3>
      <p className="customerMetricLabel">计划区域、实际覆盖和执行轨迹仅来自 report API；没有可渲染图层不等于 as-applied 记录缺失。</p>

      {hasAsAppliedRecord ? (
        <div className="customerGrid3 customerSpacingTopSm">
          <div className="customerMetricCard"><small>as-applied 状态</small><strong>已形成记录</strong></div>
          <div className="customerMetricCard"><small>覆盖</small><strong>{operationReportValueWithUnit(coveragePercent, "%") || "待补充"}</strong></div>
          <div className="customerMetricCard"><small>实际 / 计划</small><strong>{operationReportValueWithUnit(appliedAmount, appliedUnit) || "待补充"} / {operationReportValueWithUnit(plannedAmount, plannedUnit) || "待补充"}</strong></div>
        </div>
      ) : (
        <p className="customerMetricLabel customerSpacingTopSm">实际覆盖记录待补充。</p>
      )}

      {hasSpatialEvidence ? (
        <div className="customerSpacingTopSm">
          <FieldGisMap polygonGeoJson={null} plannedGeoJson={plannedGeoJson} coverageGeoJson={coverageGeoJson} heatGeoJson={null} markers={[]} trajectorySegments={trajectorySegments} acceptancePoints={[]} labels={{ plannedLayer: "计划区域", coverageLayer: "实际覆盖", operationTrack: "实际执行轨迹" }} />
        </div>
      ) : hasAsAppliedRecord ? (
        <p className="customerMetricLabel customerSpacingTopSm">暂无可渲染空间图层；当前报告已保留 as-applied 数值记录，地图图层待后续补充。</p>
      ) : (
        <p className="customerMetricLabel customerSpacingTopSm">暂无可渲染空间图层；当前报告尚未形成 as-applied 数值记录，需执行和验收后补充。</p>
      )}
    </article>
  );
}


export default function OperationReportPage(): React.ReactElement {
  const { operationId = "" } = useParams();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string>("");
  const [report, setReport] = React.useState<OperationReportV1 | null>(null);
  const [weatherContext, setWeatherContext] = React.useState<OperationEnvironmentContext | null>(null);
  const [weatherLoading, setWeatherLoading] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    setWeatherContext(null);
    setWeatherLoading(Boolean(operationId));
    void fetchOperationReport(operationId)
      .then((res) => { if (alive) setReport(res); })
      .catch((e: unknown) => { if (alive) setError(String(e instanceof Error ? e.message : "加载失败")); })
      .finally(() => { if (alive) setLoading(false); });
    void fetchOperationEnvironmentContext({ operationId })
      .then((context) => { if (alive) setWeatherContext(context); })
      .finally(() => { if (alive) setWeatherLoading(false); });
    return () => { alive = false; };
  }, [operationId]);

  if (loading) return <SectionSkeleton kind="detail" />;
  if (error || !report) return <ErrorState title="作业报告加载失败" message={error || "暂无报告"} onRetry={() => window.location.reload()} />;

  const vm = buildOperationReportVm(report);
  const chain = normalizeChain(report);
  const reportAny = report as any;
  const genericMainVisual = buildCustomerOperationReportMainVisualVm(report);
  const c8MainVisual = buildC8OperationMainVisualVm(report);
  const mainVisual = c8MainVisual ?? genericMainVisual;
  const chainIntegrityRaw = reportAny.chain_integrity;
  const chainIntegrity = customerChainIntegrityLabel(chainIntegrityRaw, "历史/人工链路");
  const legacyWarning = customerText(reportAny.legacy_warning, isCustomerChainComplete(chainIntegrityRaw) ? "" : "该作业为历史/人工链路，缺少正式建议或处方记录。");
  const canBackToField = Boolean(vm.operation.fieldId && vm.operation.fieldId !== "--");
  const safeOperationTitle = customerSafeTitle(vm.operation.title, "作业名称待补充");
  const safeFieldName = customerSafeName(vm.operation.fieldName, "地块名称待补充");
  const mainSections = isPestDiseaseInspectionReport(report)
    ? buildPestDiseaseInspectionSections(report)
    : buildMainSections(vm, report);
  const evidenceVm = buildEvidenceVm(report);
  const isPestDiseaseInspection = isPestDiseaseInspectionReport(report);
  const heroTitle = isPestDiseaseInspection ? "病虫害巡检报告" : safeOperationTitle;

  if (mainVisual) {
    return (
      <div className="customerReportCanvas">
        <div className="customerReportSheet operationReportSheet">
          <header className="customerHero operationHero">
            <div className="customerHeroTop">
              <div>
                <div className="customerReportLogo">GEOX / 作业报告</div>
                <h1 className="customerTitle">{mainVisual.title}</h1>
                <p className="customerSubtitle">{mainVisual.subtitle}</p>
              </div>
              <div className="customerActions">
                <Link className="customerButton" to="/customer/dashboard">返回总览</Link>
                {canBackToField ? <Link className="customerButton" to={`/customer/fields/${encodeURIComponent(vm.operation.fieldId)}`}>返回地块</Link> : null}
                <Link className="customerButton" to={vm.exportHref}>导出报告</Link>
              </div>
            </div>
          </header>

          <section className="customerCard">
            <div className="customerCardHeaderRow">
              <div>
                <h2 className="customerCardTitle">正式作业摘要</h2>
                <p className="customerMetricLabel">客户主视觉仅展示 report API 返回后的客户可读摘要；内部编号默认折叠。</p>
              </div>
              <span className="customerPill">主视觉</span>
            </div>
            <div className="customerGrid2 customerSpacingTopSm">
              {mainVisual.rows.map((row) => <div key={row.label}><strong>{row.label}：</strong>{row.value}</div>)}
            </div>
          </section>

          <section className="operationMainSectionsGrid">
            <EvidencePackMetadataBlock report={report} />
            <OperationSpatialExecutionPanel report={report} />
            <OperationReportWeatherPanel report={report} fallbackContext={weatherContext} loading={weatherLoading} />
            <OperationReportFieldMemoryPanel report={report} fieldId={vm.operation.fieldId} operationId={operationId} />

          </section>

          <section className="operationTechDetailsMuted">
            <details>
              <summary className="operationTechDetailsSummary">展开技术详情</summary>
              <div className="operationTechDetailsGrid">
                {mainVisual.technicalRows.map((row, index) => <div key={`${row.label}-${index}`}><strong>{row.label}：</strong>{row.value}</div>)}
              </div>
            </details>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="customerReportCanvas">
      <div className="customerReportSheet operationReportSheet">
        <header className="customerHero operationHero">
          <div className="customerHeroTop">
            <div>
              <div className="customerReportLogo">{isPestDiseaseInspection ? "GEOX / 巡检报告" : "GEOX / 作业报告"}</div>
              <h1 className="customerTitle">{heroTitle}</h1>
              <p className="customerSubtitle">地块：{safeFieldName}</p>
              {isPestDiseaseInspection ? <p className="customerSubtitle">场景：病虫害巡检</p> : null}
              <p className="customerSubtitle">链路完整性：{chainIntegrity}</p>
            </div>
            <div className="customerActions">
              <Link className="customerButton" to="/customer/dashboard">返回总览</Link>
              {canBackToField ? <Link className="customerButton" to={`/customer/fields/${encodeURIComponent(vm.operation.fieldId)}`}>返回地块</Link> : null}
              <Link className="customerButton" to={vm.exportHref}>导出报告</Link>
            </div>
          </div>
        </header>

        {legacyWarning ? <section className="customerCard customerScopeWarning">{legacyWarning}</section> : null}
        <section className="operationMainSectionsGrid">
          <article className="customerCard">
            <h3 className="customerCardTitle">统一证据视图</h3>
            <EvidenceTrustLegend vm={evidenceVm} />
            <EvidenceTrustBadge vm={evidenceVm} />
            <EvidenceRefList vm={evidenceVm} mode="customer" />
            <EvidenceGapPanel vm={evidenceVm} mode="customer" />
          </article>
          <article className="customerCard"><h3 className="customerCardTitle">正式场景</h3><FormalScenarioBadge data={report} /></article>
          <FormalChainSummaryCard data={report} />
          <ScenarioAcceptanceSummary data={report} />
          <ScenarioValueMemorySummary data={report} />
          <ZoneRollupSummary data={report} />
          <FailSafeCustomerNotice data={report} />
        </section>

        <section className="operationMainSectionsGrid">
          <EvidencePackMetadataBlock report={report} />
          <OperationSpatialExecutionPanel report={report} />
          <OperationReportWeatherPanel report={report} fallbackContext={weatherContext} loading={weatherLoading} />
          <OperationReportFieldMemoryPanel report={report} fieldId={vm.operation.fieldId} operationId={operationId} />

          {mainSections.map((section) => <MainSectionCard key={section.key} section={section} />)}
        </section>

        {isPestDiseaseInspection
          ? <PestDiseaseAuditChain report={report} />
          : <AuditChain chain={chain} vm={vm} report={report} />}

        <section className="operationTechDetailsMuted">
          <details>
            <summary className="operationTechDetailsSummary">展开技术详情</summary>
            <div className="operationTechDetailsGrid">
              <div><strong>operation_id：</strong>{text(reportAny.operation_id ?? report.identifiers?.operation_id) || "--"}</div>
              <div><strong>recommendation_id：</strong>{text(reportAny.recommendation?.recommendation_id ?? report.identifiers?.recommendation_id) || "--"}</div>
              <div><strong>prescription_id：</strong>{text(reportAny.prescription?.prescription_id ?? report.identifiers?.prescription_id) || "--"}</div>
              <div><strong>approval_request_id：</strong>{text(reportAny.approval?.approval_request_id ?? report.identifiers?.approval_id) || "--"}</div>
              <div><strong>act_task_id：</strong>{text(reportAny.execution?.act_task_id ?? report.identifiers?.act_task_id) || "--"}</div>
              <div><strong>receipt_id：</strong>{text(reportAny.execution?.receipt_id ?? report.identifiers?.receipt_id) || "--"}</div>
              <div><strong>roi_status：</strong>{roiStatusText(reportAny)}</div>
              <div><strong>chain_integrity：</strong>{chainIntegrity}</div>
              <div><strong>missing_links：</strong>{missingLinksText(report)}</div>
            </div>
          </details>
        </section>
      </div>
    </div>
  );
}
