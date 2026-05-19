import React from "react";
import { Link, useParams } from "react-router-dom";
import { fetchOperationReport, type OperationReportV1 } from "../api/customerReports";
import SectionSkeleton from "../components/common/SectionSkeleton";
import ErrorState from "../components/common/ErrorState";
import { FailSafeCustomerNotice, FormalChainSummaryCard, FormalScenarioBadge, ScenarioAcceptanceSummary, ScenarioValueMemorySummary, ZoneRollupSummary } from "../components/customer";
import { customerTimelineStatusLabel } from "../lib/customerLabels";
import { customerSafeName, customerSafeTitle } from "../lib/customerSafeText";
import { customerChainIntegrityLabel, customerSemanticLabel, isCustomerChainComplete } from "../lib/customerSemanticLabels";
import { customerReasonText, pestDiseaseAcceptanceStatusLabel, pestDiseaseAssessmentStatusLabel, pestDiseaseConfidenceLabel, pestDiseaseEvidenceTierLabel, pestDiseaseInspectionTargetLabel, pestDiseaseReviewStatusLabel, pestDiseaseSeverityLabel } from "../lib/customerScenarioLabels";
import { labelCustomerAcceptanceVerdict, labelCustomerApprovalStatus, labelCustomerRoiStatus } from "../lib/customerStatusLabels";
import { buildOperationReportVm, type CustomerReportSectionVm, type OperationReportPageVm } from "../viewmodels/operationReportVm";
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

function toCustomerStatus(status: unknown): "DONE" | "AVAILABLE" | "PENDING" | "MISSING" | "NOT_APPLICABLE" {
  const raw = normalizeKey(status);
  if (["DONE", "COMPLETE", "COMPLETED", "PASS", "SUCCESS", "SUCCEEDED", "VALID"].includes(raw)) return "DONE";
  if (raw === "AVAILABLE") return "AVAILABLE";
  if (["PENDING", "RUNNING", "IN_PROGRESS", "PENDING_ACCEPTANCE"].includes(raw)) return "PENDING";
  if (raw === "NOT_APPLICABLE") return "NOT_APPLICABLE";
  return "MISSING";
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
  if (["APPROVED", "PASS", "SUCCESS", "SUCCEEDED", "DONE"].includes(status)) return "已通过";
  if (["REJECTED", "FAIL", "FAILED", "RETURNED"].includes(status)) return "已退回";
  if (["PENDING", "REQUESTED", "WAITING"].includes(status)) return "待确认";
  return labelCustomerApprovalStatus(status);
}

function acceptanceResultText(value: unknown): string {
  const key = normalizeKey(value);
  if (!key) return "待确认";
  if (["PASS", "SUCCESS", "SUCCEEDED", "APPROVED"].includes(key)) return "已通过";
  if (["FAIL", "FAILED", "REJECTED"].includes(key)) return "未通过";
  if (["PENDING", "PENDING_ACCEPTANCE", "WAITING"].includes(key)) return "待确认";
  return labelCustomerAcceptanceVerdict(key);
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
  const acceptanceStatus = acceptanceResultText(report.acceptance?.status ?? reportAny.acceptance?.status ?? reportAny.acceptance?.verdict);
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
      summary: mediaMissing || geoMissing
        ? "巡检任务已完成，但缺少定位或图片证据，需复核。"
        : customerText(pdi.evidence_summary ?? evidence.summary, "已记录巡检证据，待进一步复核。"),
      rows: [
        { label: "图片/媒体", value: mediaMissing ? "0 条" : `${mediaCount} 条` },
        { label: "定位证据", value: geoPresent ? "已提供" : "缺少定位" },
        { label: "人工复核", value: reviewedByHuman ? "已完成" : "尚未完成" },
        { label: "证据等级", value: pestDiseaseEvidenceTierLabel(pdi.evidence_tier ?? evidence.evidence_tier) },
        { label: "证据缺口", value: evidenceGap },
      ],
    },
    {
      key: "assessment_result",
      title: "识别与诊断结论",
      summary: customerVisibleEligible
        ? customerText(assessment.summary ?? pdi.assessment_summary, "巡检识别已完成，结论待复核。")
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
        { label: "复核结果", value: reviewedByHuman ? "已完成" : "尚未完成" },
      ],
    },
    {
      key: "inspection_acceptance",
      title: "巡检证据验收",
      summary: (String(acceptance.status ?? pdi.acceptance_status ?? "").trim().toUpperCase() === "PASS")
        ? "巡检证据已通过验收，可作为后续处理建议依据，但不代表已完成防治。"
        : customerVisibleEligible
          ? customerText(acceptance.summary ?? pdi.acceptance_summary, "巡检证据验收状态待确认。")
          : "需要补齐正式链路后展示",
      rows: [
        { label: "巡检证据验收", value: pestDiseaseAcceptanceStatusLabel(acceptance.status ?? pdi.acceptance_status) },
        { label: "验收说明", value: "巡检证据已通过验收，可作为后续处理建议依据，但不代表已完成防治。" },
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
        { label: "结论边界", value: "不代表已完成防治" },
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

export default function OperationReportPage(): React.ReactElement {
  const { operationId = "" } = useParams();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string>("");
  const [report, setReport] = React.useState<OperationReportV1 | null>(null);

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    void fetchOperationReport(operationId)
      .then((res) => { if (alive) setReport(res); })
      .catch((e: unknown) => { if (alive) setError(String(e instanceof Error ? e.message : "加载失败")); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [operationId]);

  if (loading) return <SectionSkeleton kind="detail" />;
  if (error || !report) return <ErrorState title="作业报告加载失败" message={error || "暂无报告"} onRetry={() => window.location.reload()} />;

  const vm = buildOperationReportVm(report);
  const chain = normalizeChain(report);
  const reportAny = report as any;
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
          {mainSections.map((section) => <MainSectionCard key={section.key} section={section} />)}
        </section>

        <AuditChain chain={chain} vm={vm} report={report} />

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
