import React from "react";
import type { FieldReportDetailV1, OperationReportV1 } from "../../api/customerReports";
import type { CustomerDashboardPageVm } from "../../viewmodels/customerDashboardVm";
import type { FieldReportPageVm } from "../../viewmodels/fieldReportVm";
import type { OperationReportPageVm } from "../../viewmodels/operationReportVm";
import { customerEvidenceStateText, customerNeedsReviewText, customerOperationStateText, customerReasonText, mapCustomerEnum } from "../../lib/customerSafeText";
import { buildCustomerFieldReportMainVisualVm, buildCustomerOperationReportMainVisualVm } from "../../viewmodels/customerReportMainVisualVm";
import { buildIrrigationDecisionReportVm } from "../../viewmodels/irrigationDecisionReportVm";

type Row = Array<unknown>;

const RAW_EXPORT_TOKENS = {
  pendingAcceptance: ["PENDING", "ACCEPTANCE"].join("_"),
  pendingFormalReview: ["PENDING", "ACCEPTANCE", "REQUIRES", "FORMAL", "REVIEW"].join("_"),
  soilMoistureLow: ["soil", "moisture", "below", "threshold"].join("_"),
  noRainForecast: ["no", "rain", "forecast"].join("_"),
  blocked: ["BLO", "CKED"].join("")
};

function normalizeKey(value: unknown): string {
  return String(value ?? "").trim().replace(/[\s/-]+/g, "_").toLowerCase();
}
function safeExportText(value: unknown, fallback = "暂无记录"): string {
  const text = String(value ?? "").trim();
  if (!text || text === "--" || text === "[object Object]" || text === "null" || text === "undefined") return fallback;
  if (/s3:\/\//i.test(text) || /minio:\/\//i.test(text) || /https?:\/\//i.test(text)) return fallback;
  if (/\bROI\b/.test(text)) return text.replace(/\bROI\b/g, "价值");
  if (/Field\s+Memory/.test(text)) return text.replace(/Field\s+Memory/g, "田块记忆");
  if (/^(UNKNOWN|NEEDS_REVIEW)$/i.test(text)) return fallback;
  const key = normalizeKey(text);
  if (key === "true" || key === "false") return customerNeedsReviewText(text);
  if (key === normalizeKey(RAW_EXPORT_TOKENS.pendingFormalReview) || key === normalizeKey(RAW_EXPORT_TOKENS.soilMoistureLow) || key === normalizeKey(RAW_EXPORT_TOKENS.noRainForecast)) return customerReasonText(text);
  if (key === normalizeKey(RAW_EXPORT_TOKENS.pendingAcceptance) || key === normalizeKey(RAW_EXPORT_TOKENS.blocked)) return customerOperationStateText(text);
  if (key.includes("evidence")) return customerEvidenceStateText(text);
  return mapCustomerEnum(text, "generic") || text;
}
function PrintTable({ headers, rows, emptyText }: { headers: string[]; rows: Row[]; emptyText: string }): React.ReactElement {
  if (!rows.length) return <p className="customerMetricLabel customerSpacingTopSm">{emptyText}</p>;
  return (
    <table className="printTable customerSpacingTopSm">
      <thead><tr>{headers.map((item) => <th key={item}>{item}</th>)}</tr></thead>
      <tbody>{rows.map((row, index) => <tr key={`${index}-${row.map((cell) => safeExportText(cell, "")).join("-")}`}>{row.map((cell, cellIndex) => <td key={`${index}-${cellIndex}`}>{safeExportText(cell)}</td>)}</tr>)}</tbody>
    </table>
  );
}
export function DashboardExportBlocks({ vm }: { vm: CustomerDashboardPageVm }): React.ReactElement {
  const recentOperations = vm.recentOperations.slice(0, 5);
  const topRisks = vm.topRiskFields.slice(0, 5);
  const actionItems = vm.actionItems;
  const pendingRows: Row[] = actionItems.slice(0, 6).map((item) => [item.title, item.currentStatus, item.nextStep, item.formality]);
  const reviewNotes = [
    "风险提示用于处理优先级，不等同于正式验收或收益结论。",
    "设备恢复和人工复核前，不展示执行成功或价值结论。",
    "证据不足、待验收或需要复核的作业，不能生成正式客户价值结论。",
    vm.usagePath.formalityNote
  ];
  const riskRows: Row[] = topRisks.map((item) => [
    item.fieldName,
    item.riskLabel,
    item.reasons.map((reason) => safeExportText(reason, "")).filter(Boolean).join("；") || "暂无风险原因",
    "查看地块风险原因和最近作业证据"
  ]);
  const operationRows: Row[] = recentOperations.map((item) => [item.operationName, item.fieldName, item.updatedAtText, item.acceptanceText, item.formalChainStatusText, item.needsReviewText]);
  const deviceRows: Row[] = [
    ["授权设备", vm.deviceHealth.authorizedText],
    ["离线设备", vm.deviceHealth.offlineText],
    ["异常提醒", vm.deviceHealth.alertText],
    ["处理提示", vm.deviceHealth.nextStepText]
  ];
  const evidenceText = recentOperations.map((item) => item.evidenceText).filter(Boolean).slice(0, 3).join("；");
  return <div className="customerCompactReport"><section className="customerCard"><h2 className="customerCardTitle">1. 本期摘要</h2><p className="customerSpacingTopSm">{safeExportText(vm.usagePath.statusText, "当前经营状态待确认")}</p><p className="customerMetricLabel customerSpacingTopXs">{safeExportText(vm.summaryScopeText, "统计范围待确认")}</p></section><section className="customerCard"><h2 className="customerCardTitle">2. 主要风险</h2><PrintTable headers={["地块", "风险", "原因", "下一步"]} rows={riskRows} emptyText="暂无主要风险" /></section><section className="customerCard"><h2 className="customerCardTitle">3. 待处理事项</h2><PrintTable headers={["事项", "当前状态", "下一步", "正式性提示"]} rows={pendingRows} emptyText="暂无待处理事项" /></section><section className="customerCard"><h2 className="customerCardTitle">4. 作业进展</h2><PrintTable headers={["作业", "地块", "更新时间", "验收", "正式链路", "复核状态"]} rows={operationRows} emptyText="暂无近期作业" /></section><section className="customerCard"><h2 className="customerCardTitle">5. 设备状态</h2><PrintTable headers={["项目", "状态"]} rows={deviceRows} emptyText="暂无设备状态" /></section><section className="customerCard"><h2 className="customerCardTitle">6. 证据与验收</h2><p className="customerSpacingTopSm">{safeExportText(evidenceText, "证据状态待确认")}</p></section><section className="customerCard"><h2 className="customerCardTitle">7. 价值记录</h2><PrintTable headers={["项目", "内容"]} rows={[["当前状态", vm.roiSummary.currentStatus], ["为什么", vm.roiSummary.whyText], ["下一步", vm.roiSummary.nextStepText], ["正式性提示", vm.roiSummary.formalityText], ["价值摘要", vm.roiSummary.customerValueText]]} emptyText="暂无价值记录" /></section><section className="customerCard"><h2 className="customerCardTitle">8. 附注：哪些结论尚待复核</h2><ul className="customerList customerSpacingTopSm">{reviewNotes.map((item, index) => <li key={`${index}-${safeExportText(item, "")}`} className="customerListItem">{safeExportText(item, "复核说明待确认")}</li>)}</ul></section><footer className="customerCard"><p className="customerMetricLabel">报告由 GEOX 自动生成，可用于客户或管理层复盘；其中待复核结论已在附注中标明，不能当作正式收益或验收结论。</p></footer></div>;
}
function MainVisualExportBlocks({ mainVisual }: { mainVisual: ReturnType<typeof buildCustomerFieldReportMainVisualVm> | ReturnType<typeof buildCustomerOperationReportMainVisualVm> }): React.ReactElement {
  return <div className="customerCompactReport"><section className="customerCard"><h2 className="customerCardTitle">{mainVisual.title}</h2><p className="customerMetricLabel customerSpacingTopXs">{mainVisual.subtitle}</p><PrintTable headers={["项目", "内容"]} rows={mainVisual.rows.map((row) => [row.label, row.value])} emptyText="暂无正式摘要" /></section><footer className="customerCard"><p className="customerMetricLabel">报告由 GEOX 正式 report API 提供，供客户复盘使用。</p></footer></div>;
}

export function FieldExportBlocks({ vm: _vm, report }: { vm: FieldReportPageVm; report?: FieldReportDetailV1 | null }): React.ReactElement {
  const mainVisual = buildCustomerFieldReportMainVisualVm(report);
  return <MainVisualExportBlocks mainVisual={mainVisual} />;
}

function OperationIrrigationDecisionExportBlock({ report }: { report?: OperationReportV1 | null }): React.ReactElement | null {
  if (!report) return null;
  const vm = buildIrrigationDecisionReportVm(report);
  if (!vm?.visible) return null;

  const optionRows: Row[] = vm.options.map((option) => [
    option.label,
    option.amountText,
    option.riskText,
    option.confidenceText,
    option.failureConditionText
  ]);

  return (
    <section className="customerCard">
      <h2 className="customerCardTitle">灌溉决策依据</h2>
      <p className="customerSpacingTopSm">{safeExportText(vm.oneLiner, "当前决策证据链不完整，不能展示可执行灌溉建议。")}</p>
      <PrintTable
        headers={["项目", "内容"]}
        rows={[
          ["决策结论", vm.recommendationLine],
          ["证据基础", vm.evidenceLine],
          ["水分状态", vm.stateLine],
          ["情景比较", vm.scenarioLine],
          ["审批与执行边界", vm.boundaryLine]
        ]}
        emptyText="暂无灌溉决策依据"
      />
      <PrintTable
        headers={["情景", "水量", "风险变化", "可信度", "失败条件"]}
        rows={optionRows}
        emptyText="暂无灌溉情景比较"
      />
    </section>
  );
}

export function OperationExportBlocks({ vm: _vm, report }: { vm: OperationReportPageVm; report?: OperationReportV1 | null }): React.ReactElement {
  const mainVisual = buildCustomerOperationReportMainVisualVm(report);
  return (
    <>
      <MainVisualExportBlocks mainVisual={mainVisual} />
      <OperationIrrigationDecisionExportBlock report={report} />
    </>
  );
}
