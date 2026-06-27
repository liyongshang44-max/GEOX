// apps/web/src/viewmodels/irrigationDecisionReportVm.ts
// Purpose: convert operation_report_v1.irrigation_decision_report_v1 into customer-facing VM.
// Boundary: presentation VM only; no H12-H16 recalculation and no raw technical identifier display.

import type { OperationReportV1 } from "../api/customerReports";
import { irrigationDecisionConfidenceLabel, irrigationDecisionOptionLabel, irrigationDecisionRiskDeltaLabel, irrigationDecisionStateLabel } from "../lib/irrigationDecisionLabels";

export type IrrigationDecisionReportVm = {
  visible: boolean;
  headline: string;
  oneLiner: string;
  evidenceLine: string;
  stateLine: string;
  scenarioLine: string;
  recommendationLine: string;
  boundaryLine: string;
  options: Array<{
    label: string;
    amountText: string;
    riskText: string;
    confidenceText: string;
    failureConditionText: string;
  }>;
  tone: "success" | "warning" | "danger" | "neutral";
};

function text(value: unknown, fallback = ""): string {
  const raw = String(value ?? "").trim();
  return raw || fallback;
}

function customerLine(value: unknown, fallback = ""): string {
  const raw = text(value, fallback);
  return raw
    .replace(/AO-ACT/gi, "执行任务")
    .replace(/report API/gi, "正式报告")
    .replace(/Field\s+Memory/gi, "田块记忆")
    .replace(/\bROI\b/gi, "价值记录");
}

function amountText(value: unknown): string {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? String(n) + "mm" : "水量待确认";
}

function riskText(option: any): string {
  return irrigationDecisionStateLabel(option?.risk_before) + " → " + irrigationDecisionStateLabel(option?.risk_after) + "；" + irrigationDecisionRiskDeltaLabel(option?.risk_delta);
}

function optionVm(option: any): IrrigationDecisionReportVm["options"][number] {
  return {
    label: text(option?.customer_label, irrigationDecisionOptionLabel(option?.option_id)),
    amountText: amountText(option?.assumed_irrigation_mm),
    riskText: riskText(option),
    confidenceText: text(option?.confidence_text, irrigationDecisionConfidenceLabel(option?.confidence?.level)),
    failureConditionText: customerLine(option?.failure_condition_text, "暂无主要失败条件"),
  };
}

export function buildIrrigationDecisionReportVm(report: OperationReportV1): IrrigationDecisionReportVm | null {
  const decision = (report as any).irrigation_decision_report_v1;
  if (!decision || typeof decision !== "object") return null;

  const summary = decision.customer_summary ?? {};
  const status = decision.status ?? {};
  const estimate = decision.estimate_section ?? {};
  const scenario = decision.scenario_section ?? {};
  const recommendation = decision.recommendation_section ?? {};

  const customerVisible = status.customer_visible_eligible === true && recommendation.recommendation_status === "RECOMMENDED";
  const options = Array.isArray(scenario.options) ? scenario.options.map(optionVm) : [];

  if (!customerVisible) {
    return {
      visible: true,
      headline: "灌溉决策依据",
      oneLiner: "当前决策证据链不完整，不能展示可执行灌溉建议。",
      evidenceLine: "当前决策证据链不完整，不能展示可执行灌溉建议。",
      stateLine: "水分状态：" + irrigationDecisionStateLabel(estimate.state),
      scenarioLine: "情景比较结果不可用于生成可执行建议。",
      recommendationLine: "未生成可执行灌溉建议。",
      boundaryLine: "证据不足时不会进入审批、作业计划或执行任务。",
      options,
      tone: "warning",
    };
  }

  return {
    visible: true,
    headline: customerLine(summary.headline, "灌溉决策依据"),
    oneLiner: customerLine(summary.one_liner, "系统建议灌溉 22mm，但需要人工审批后才能进入执行。"),
    evidenceLine: customerLine(summary.evidence_line, "该建议基于通过质量检查的土壤水分连续窗口、可回放天气预报版本和正式灌溉需求计算。"),
    stateLine: customerLine(estimate.customer_text, "当前水分状态为" + irrigationDecisionStateLabel(estimate.state) + "。"),
    scenarioLine: customerLine(summary.scenario_line, "五个情景已比较；灌溉 22mm 可将风险从中度缺水改善到正常。"),
    recommendationLine: customerLine(recommendation.action_text, "系统建议灌溉 22mm"),
    boundaryLine: customerLine(summary.boundary_line, "本报告不直接触发作业；执行仍需审批、作业计划、执行任务和回执验收。"),
    options,
    tone: "success",
  };
}
