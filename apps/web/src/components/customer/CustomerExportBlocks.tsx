import React from "react";
import type { CustomerDashboardPageVm } from "../../viewmodels/customerDashboardVm";
import type { FieldReportPageVm } from "../../viewmodels/fieldReportVm";
import type { OperationReportPageVm } from "../../viewmodels/operationReportVm";
import CockpitKpiCard from "../cockpit/CockpitKpiCard";

function splitRecentOperationRow(rowText: string): { operationType: string; fieldName: string; timeText: string; acceptanceText: string } {
  const [operationType = "作业", fieldName = "地块未知", timeText = "时间未知", acceptanceText = "状态待确认"] = rowText.split(" · ");
  return { operationType, fieldName, timeText, acceptanceText };
}

export function DashboardExportBlocks({ vm }: { vm: CustomerDashboardPageVm }): React.ReactElement {
  const dashboardKpis = vm.kpis.slice(0, 5);
  const nextActionTitles = vm.actionItems.map((item) => item.title).join(" · ") || "暂无待处理事项";
  const recentOperations = vm.recentOperations.slice(0, 5);
  const topRisks = vm.topRiskFields.slice(0, 5);
  const roi = vm.roiSummary;

  return (
    <div className="customerCompactReport">
      <section className="customerCard">
        <h2 className="customerCardTitle">概览</h2>
        <div className="customerMetrics customerSpacingTopSm">
          {dashboardKpis.map((item) => <CockpitKpiCard key={item.key} item={item} />)}
        </div>
      </section>
      <section className="customerCard">
        <h2 className="customerCardTitle">高风险地块 Top 5</h2>
        <div className="customerEvidenceGrid customerSpacingTopSm">
          {topRisks.length ? topRisks.map((item) => (
            <article key={item.fieldId || item.href} className="customerEvidenceItem">
              <strong>{item.fieldName || "未命名地块"}</strong>
              <div className="customerMetricLabel">{item.riskLabel}</div>
              <div className="customerMetricLabel">{item.reasons.join("；") || "暂无风险原因"}</div>
            </article>
          )) : <div className="customerMetricLabel">{vm.emptyStates.NO_RISK_FIELDS?.title ?? "暂无高风险地块"}</div>}
        </div>
      </section>
      <section className="customerCard">
        <h2 className="customerCardTitle">近期作业 Top 5</h2>
        <div className="customerList customerSpacingTopSm">
          {recentOperations.length ? recentOperations.map((item) => (
              <article key={item.operationId || item.href} className="customerEvidenceItem">
                <strong>{item.operationName}</strong>
                <span className="customerMetricLabel">{item.fieldName}</span>
                <span className="customerMetricLabel">{item.updatedAtText}</span>
                <span className="customerMetricLabel">{item.acceptanceText}</span>
              </article>
            )) : <div className="customerMetricLabel">{vm.emptyStates.NO_RECENT_OPERATIONS?.title ?? "暂无近期作业"}</div>}
        </div>
      </section>
      <section className="customerCard">
        <h2 className="customerCardTitle">价值摘要</h2>
        {!roi.totalRoiItems ? (
          <p className="customerSpacingTopSm">{roi.emptyState?.title ?? vm.emptyStates.NO_ROI?.title ?? "暂无可量化价值记录"}</p>
        ) : (
          <div className="customerSpacingTopSm">
            <p className="customerMetricLabel">价值记录数量：{roi.totalRoiItems}</p>
            <p className="customerMetricLabel">可量化价值摘要：{roi.customerValueText || "暂无收益摘要"}</p>
            {roi.confidenceText ? <p className="customerMetricLabel">置信度提示：{roi.confidenceText}</p> : null}
            {roi.assumptionText ? <p className="customerMetricLabel">假设条件：{roi.assumptionText}</p> : null}
          </div>
        )}
      </section>
      <section className="customerCard"><h2 className="customerCardTitle">下一步建议</h2><p className="customerSpacingTopSm">{nextActionTitles}</p></section>
      <footer className="customerCard"><p className="customerMetricLabel">报告由 GEOX 自动生成，仅供客户经营复盘与执行跟进使用。</p></footer>
    </div>
  );
}

export function FieldExportBlocks({ vm }: { vm: FieldReportPageVm }): React.ReactElement {
  return (
    <>
      <section className="customerCard">
        <h2 className="customerCardTitle">摘要</h2>
        <div className="customerGrid2 customerSpacingTopSm">
          <div><strong>地块名称：</strong>{vm.header.title}</div>
          <div><strong>作业总数：</strong>{vm.overview.totalOperationsText}</div>
        </div>
      </section>
      <section className="customerCard"><h2 className="customerCardTitle">风险/诊断</h2><p className="customerSpacingTopSm">{vm.explain.human}；当前风险 {vm.risk.levelLabel}</p></section>
      <section className="customerCard"><h2 className="customerCardTitle">近期作业</h2><p className="customerSpacingTopSm">待验收作业：{vm.overview.pendingAcceptanceText}</p></section>
      <section className="customerCard"><h2 className="customerCardTitle">下一步建议</h2><p className="customerSpacingTopSm">{vm.nextAction?.objectiveText ?? "暂无新的处理建议"}</p></section>
      <section className="customerCard"><h2 className="customerCardTitle">本次价值</h2><p className="customerSpacingTopSm">{vm.roiSummary.displayText}</p></section>
      <section className="customerCard"><h2 className="customerCardTitle">证据可信度</h2><p className="customerSpacingTopSm">{vm.diagnosis.dataQualityText}</p></section>
      <section className="customerCard"><h2 className="customerCardTitle">系统记忆</h2><p className="customerMetricLabel customerSpacingTopSm">{vm.fieldMemory.displayText}</p></section>
      <section className="customerCard"><h2 className="customerCardTitle">最终结论</h2><p className="customerSpacingTopSm">{vm.currentStatus.summary}</p></section>
    </>
  );
}

export function OperationExportBlocks({ vm }: { vm: OperationReportPageVm }): React.ReactElement {
  const sections = vm.sections;
  return (
    <div className="customerCompactReport">
      <section className="customerCard">
        <h2 className="customerCardTitle">作业报告头</h2>
        <p className="customerSpacingTopSm"><strong>{vm.header.title}</strong></p>
      </section>
      <section className="customerFlow customerFlow6">
        {sections.map((item) => (
          <article key={item.key} className="customerFlowStep">
            <h2 className="customerCardTitle">{item.title}</h2>
            <p className="customerSpacingTopSm">{item.summary}</p>
            {item.items.length ? <p className="customerMetricLabel">{item.items.map((row) => `${row.label}：${row.value}`).join("；")}</p> : null}
            {item.emptyState ? <p className="customerMetricLabel">{item.emptyState.title}：{item.emptyState.description}</p> : null}
          </article>
        ))}
      </section>
      <footer className="customerCard"><p className="customerMetricLabel">报告由 GEOX 自动生成，供作业执行留痕与验收复盘使用。</p></footer>
    </div>
  );
}
