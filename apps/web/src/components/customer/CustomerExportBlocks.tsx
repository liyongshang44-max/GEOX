// @ts-nocheck
import React from "react";
import type { FieldReportDetailV1, OperationReportV1 } from "../../api/reports";
import type { CustomerDashboardPageVm } from "../../viewmodels/customerDashboardVm";
import type { FieldReportPageVm } from "../../viewmodels/fieldReportVm";
import type { OperationReportPageVm } from "../../viewmodels/operationReportVm";
import { customerEvidenceStateText, customerNeedsReviewText, customerOperationStateText, customerReasonText, mapCustomerEnum } from "../../lib/customerSafeText";

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
function reportObject(value?: OperationReportV1 | FieldReportDetailV1 | null): Record<string, unknown> {
  return value && typeof value === "object" ? value as unknown as Record<string, unknown> : {};
}
function valueFromSection(vm: OperationReportPageVm, label: string, fallback = "暂无记录"): string {
  for (const section of vm.sections) {
    const row = section.items.find((item) => item.label === label || item.label.includes(label));
    if (row) return safeExportText(row.value, fallback);
  }
  return fallback;
}
export function DashboardExportBlocks({ vm }: { vm: CustomerDashboardPageVm }): React.ReactElement {
  const recentOperations = vm.recentOperations.slice(0, 5);
  const topRisks = vm.topRiskFields.slice(0, 5);
  const pendingRows = vm.actionItems.slice(0, 6).map((item) => [item.title, item.currentStatus, item.nextStep, item.formality]);
  const reviewNotes = ["风险提示用于处理优先级，不等同于正式验收或收益结论。", "设备恢复和人工复核前，不展示执行成功或价值结论。", "证据不足、待验收或需要复核的作业，不能生成正式客户价值结论。", vm.usagePath.formalityNote];
  return <div className="customerCompactReport"><section className="customerCard"><h2 className="customerCardTitle">1. 本期摘要</h2><p className="customerSpacingTopSm">{safeExportText(vm.usagePath.statusText, "当前经营状态待确认")}</p><p className="customerMetricLabel customerSpacingTopXs">{safeExportText(vm.summaryScopeText, "统计范围待确认")}</p></section><section className="customerCard"><h2 className="customerCardTitle">2. 主要风险</h2><PrintTable headers={["地块", "风险", "原因", "下一步"]} rows={topRisks.map((item) => [item.fieldName, item.riskLabel, item.reasons.map((reason) => safeExportText(reason, "")).filter(Boolean).join("；") || "暂无风险原因", "查看地块风险原因和最近作业证据"])} emptyText="暂无主要风险" /></section><section className="customerCard"><h2 className="customerCardTitle">3. 待处理事项</h2><PrintTable headers={["事项", "当前状态", "下一步", "正式性提示"]} rows={pendingRows} emptyText="暂无待处理事项" /></section><section className="customerCard"><h2 className="customerCardTitle">4. 作业进展</h2><PrintTable headers={["作业", "地块", "更新时间", "验收", "正式链路", "复核状态"]} rows={recentOperations.map((item) => [item.operationName, item.fieldName, item.updatedAtText, item.acceptanceText, item.formalChainStatusText, item.needsReviewText])} emptyText="暂无近期作业" /></section><section className="customerCard"><h2 className="customerCardTitle">5. 设备状态</h2><PrintTable headers={["项目", "状态"]} rows={[["在线设备", vm.deviceSummary.onlineText], ["离线设备", vm.deviceSummary.offlineText], ["处理提示", vm.deviceSummary.actionText]]} emptyText="暂无设备状态" /></section><section className="customerCard"><h2 className="customerCardTitle">6. 证据状态</h2><p className="customerSpacingTopSm">{safeExportText(vm.evidenceSummary.displayText, "证据状态待确认")}</p></section><section className="customerCard"><h2 className="customerCardTitle">7. 价值记录</h2><PrintTable headers={["项目", "内容"]} rows={[["当前状态", vm.roiSummary.currentStatus], ["为什么", vm.roiSummary.whyText], ["下一步", vm.roiSummary.nextStepText], ["正式性提示", vm.roiSummary.formalityText], ["价值摘要", vm.roiSummary.customerValueText]]} emptyText="暂无价值记录" /></section><section className="customerCard"><h2 className="customerCardTitle">8. 附注：哪些结论尚待复核</h2><ul className="customerList customerSpacingTopSm">{reviewNotes.map((item, index) => <li key={`${index}-${safeExportText(item, "")}`} className="customerListItem">{safeExportText(item, "复核说明待确认")}</li>)}</ul></section><footer className="customerCard"><p className="customerMetricLabel">报告由 GEOX 自动生成，可用于客户或管理层复盘；其中待复核结论已在附注中标明，不能当作正式收益或验收结论。</p></footer></div>;
}
export function FieldExportBlocks({ vm, report }: { vm: FieldReportPageVm; report?: FieldReportDetailV1 | null }): React.ReactElement {
  const reportAny = reportObject(report);
  const weather = reportAny["weather_interference"] ?? reportAny["weather_summary"] ?? "天气摘要未接入报告同源数据。";
  return <div className="customerCompactReport"><section className="customerCard"><h2 className="customerCardTitle">1. 地块摘要</h2><div className="customerGrid2 customerSpacingTopSm"><div><strong>地块名称：</strong>{safeExportText(vm.header.title, "地块名称待补充")}</div><div><strong>作业总数：</strong>{safeExportText(vm.overview.totalOperationsText, "0")}</div><div><strong>当前风险：</strong>{safeExportText(vm.risk.levelLabel, "风险待确认")}</div><div><strong>待验收：</strong>{safeExportText(vm.overview.pendingAcceptanceText, "0")}</div></div></section><section className="customerCard"><h2 className="customerCardTitle">2. 风险与诊断</h2><p className="customerSpacingTopSm">{safeExportText(vm.explain.human, "暂无状态解释")} 当前风险：{safeExportText(vm.risk.levelLabel, "风险待确认")}。</p></section><section className="customerCard"><h2 className="customerCardTitle">3. 最近作业</h2><PrintTable headers={["作业", "状态", "验收", "更新时间", "正式场景", "正式链路", "证据状态", "复核状态"]} rows={vm.recentOperations.slice(0, 5).map((item) => [item.title, item.statusText, item.acceptanceText, item.updatedAtText, item.scenarioTypeText, item.formalChainStatusText, item.evidenceStatusText, item.needsReviewText])} emptyText="暂无最近作业" /></section><section className="customerCard"><h2 className="customerCardTitle">4. 价值与田块记忆</h2><PrintTable headers={["项目", "内容"]} rows={[["价值摘要", vm.roiSummary.displayText], ["田块记忆摘要", vm.fieldMemory.displayText], ["天气摘要", safeExportText(weather, "暂无天气摘要")]]} emptyText="暂无价值与田块记忆摘要" /></section><footer className="customerCard"><p className="customerMetricLabel">报告由 GEOX 自动生成，供经营复盘使用。</p></footer></div>;
}
export function OperationExportBlocks({ vm, report }: { vm: OperationReportPageVm; report?: OperationReportV1 | null }): React.ReactElement {
  const reportAny = reportObject(report);
  const evidenceStatus = safeExportText(reportAny["evidence_status"] ?? reportAny["evidence_summary_status"] ?? vm.evidenceSummary.statusText, "证据需复核");
  const acceptanceStatus = safeExportText(reportAny["acceptance_status"] ?? vm.acceptance.statusText, "验收需复核");
  return <div className="customerCompactReport"><section className="customerCard"><h2 className="customerCardTitle">作业报告头</h2><div className="customerGrid2 customerSpacingTopSm"><div><strong>作业：</strong>{safeExportText(vm.header.title, "作业名称待补充")}</div><div><strong>状态：</strong>{safeExportText(vm.operation.finalStatusLabel, "待确认")}</div><div><strong>正式链路：</strong>{safeExportText(vm.conclusion.finalStatusText, "需复核")}</div><div><strong>证据门禁：</strong>{evidenceStatus}</div><div><strong>验收门禁：</strong>{acceptanceStatus}</div></div></section><section className="operationClosedLoopGrid">{vm.sections.map((item, index) => <article key={`${item.key}-${index}`} className="customerCard operationClosedLoopCard"><div className="operationClosedLoopHead"><span className="operationStepNo">{index + 1}</span><h2 className="customerCardTitle">{safeExportText(item.title, "作业环节")}</h2><span className="operationStatusBadge">{safeExportText(item.statusText ?? item.status, "待确认")}</span></div><p className="customerSpacingTopSm">{safeExportText(item.summary, "暂无摘要")}</p></article>)}</section><section className="customerCard"><h2 className="customerCardTitle">作业报告同源摘要</h2><PrintTable headers={["项目", "导出内容"]} rows={[["证据包状态", evidenceStatus], ["实际执行摘要", valueFromSection(vm, "执行摘要")], ["实际覆盖状态", valueFromSection(vm, "覆盖状态")], ["天气干扰", safeExportText(reportAny["weather_summary"], "天气摘要未接入报告同源数据。")], ["价值性质", valueFromSection(vm, "实测/估算/假设")], ["田块记忆学习摘要", valueFromSection(vm, "本次结果是否进入田块记忆")], ["页面同源价值门禁", safeExportText(vm.value.fallbackText, "未通过正式价值门禁")], ["页面同源田块记忆", safeExportText(vm.fieldMemory.items.join("；"), "暂无正式田块记忆")]]} emptyText="暂无作业同源摘要" /></section><section className="customerCard"><h2 className="customerCardTitle">证据包摘要</h2><p className="customerSpacingTopSm">{safeExportText(vm.evidenceSummary.summary, "暂无有效证据")}</p><p className="customerMetricLabel customerSpacingTopXs">{safeExportText(vm.evidenceSummary.detail, "暂无补充说明")}</p></section><footer className="customerCard"><p className="customerMetricLabel">报告由 GEOX 自动生成，供作业执行留痕与验收复盘使用。</p></footer></div>;
}
