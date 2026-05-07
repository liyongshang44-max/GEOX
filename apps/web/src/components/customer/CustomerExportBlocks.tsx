import React from "react";
import type { CustomerDashboardPageVm } from "../../viewmodels/customerDashboardVm";
import type { FieldReportPageVm } from "../../viewmodels/fieldReportVm";
import type { OperationReportPageVm } from "../../viewmodels/operationReportVm";

function splitRecentOperationRow(rowText: string): { operationType: string; fieldName: string; timeText: string; acceptanceText: string } {
  const [operationType = "作业", fieldName = "地块未知", timeText = "时间未知", acceptanceText = "状态待确认"] = rowText.split(" · ");
  return { operationType, fieldName, timeText, acceptanceText };
}

export function DashboardExportBlocks({ vm }: { vm: CustomerDashboardPageVm }): React.ReactElement {
  const riskFields = vm.kpis.find((item) => item.key === "riskFields")?.valueText ?? "-";
  const pendingActions = vm.kpis.find((item) => item.key === "pendingActions")?.valueText ?? "-";
  const pendingAcceptance = vm.kpis.find((item) => item.key === "pendingAcceptance")?.valueText ?? "-";
  const offlineDevices = vm.kpis.find((item) => item.key === "offlineDevices")?.valueText ?? "-";
  const nextActionTitles = vm.nextActions.map((item) => item.title).join(" · ") || "暂无待处理事项";
  const recentOperations = (vm.recentOperations ?? []).slice(0, 5);
  const topRisks = (vm.topRiskFields ?? []).slice(0, 5);

  return (
    <div className="customerCompactReport">
      <section className="customerCard">
        <h2 className="customerCardTitle">概览</h2>
        <p className="customerSpacingTopSm">风险地块 {riskFields} 个，离线设备 {offlineDevices} 台</p>
        <p className="customerMetricLabel">待处理事项：{pendingActions}；待验收作业：{pendingAcceptance}</p>
      </section>
      <section className="customerCard">
        <h2 className="customerCardTitle">高风险地块 Top 5</h2>
        <div className="customerEvidenceGrid customerSpacingTopSm">
          {topRisks.length ? topRisks.map((item) => (
            <article key={item.id || item.href} className="customerEvidenceItem">
              <strong>{item.rowText.split(" · ")[0] || "未命名地块"}</strong>
              <div className="customerMetricLabel">{item.rowText.split(" · ")[1] || "风险待确认"}</div>
              <div className="customerMetricLabel">{item.rowText.split(" · ").slice(2).join(" · ") || "暂无风险原因"}</div>
            </article>
          )) : <div className="customerMetricLabel">暂无高风险地块</div>}
        </div>
      </section>
      <section className="customerCard">
        <h2 className="customerCardTitle">近期作业 Top 5</h2>
        <div className="customerList customerSpacingTopSm">
          {recentOperations.length ? recentOperations.map((item) => {
            const parsed = splitRecentOperationRow(item.rowText);
            return (
              <article key={item.operationId || item.href} className="customerEvidenceItem">
                <strong>{parsed.operationType}</strong>
                <span className="customerMetricLabel">{parsed.fieldName}</span>
                <span className="customerMetricLabel">{parsed.timeText}</span>
                <span className="customerMetricLabel">{parsed.acceptanceText}</span>
              </article>
            );
          }) : <div className="customerMetricLabel">暂无近期作业</div>}
        </div>
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
      <section className="customerCard"><h2 className="customerCardTitle">风险/诊断</h2><p className="customerSpacingTopSm">{vm.explain.human}；当前风险 {vm.overview.riskText}</p></section>
      <section className="customerCard"><h2 className="customerCardTitle">近期作业</h2><p className="customerSpacingTopSm">待验收作业：{vm.overview.pendingAcceptanceText}</p></section>
      <section className="customerCard"><h2 className="customerCardTitle">下一步建议</h2><p className="customerSpacingTopSm">优先处理未关闭异常并完成待验收作业（{vm.overview.openAlertsText}）。</p></section>
      <section className="customerCard"><h2 className="customerCardTitle">本次价值</h2><p className="customerSpacingTopSm">本周期暂无可量化价值记录</p></section>
      <section className="customerCard"><h2 className="customerCardTitle">证据可信度</h2><p className="customerSpacingTopSm">本周期暂无可量化价值记录</p></section>
      <section className="customerCard"><h2 className="customerCardTitle">系统记忆</h2><p className="customerMetricLabel customerSpacingTopSm">本周期暂无可量化价值记录</p></section>
      <section className="customerCard"><h2 className="customerCardTitle">最终结论</h2><p className="customerSpacingTopSm">地块整体可控，建议按优先级继续闭环处置。</p></section>
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
