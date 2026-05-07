import React from "react";
import type { CustomerDashboardPageVm } from "../../viewmodels/customerDashboardVm";
import type { FieldReportPageVm } from "../../viewmodels/fieldReportVm";
import type { OperationReportPageVm } from "../../viewmodels/operationReportVm";

type Row = Array<string | number | undefined>;

function PrintTable({ headers, rows, emptyText }: { headers: string[]; rows: Row[]; emptyText: string }): React.ReactElement {
  if (!rows.length) {
    return <p className="customerMetricLabel customerSpacingTopSm">{emptyText}</p>;
  }

  return (
    <table className="printTable customerSpacingTopSm">
      <thead>
        <tr>{headers.map((item) => <th key={item}>{item}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={`${index}-${row.join("-")}`}>
            {row.map((cell, cellIndex) => <td key={`${index}-${cellIndex}`}>{cell || "暂无记录"}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
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
        <div className="customerDashboardKpiRow customerSpacingTopSm">
          {dashboardKpis.map((item) => (
            <article key={item.key} className="customerMetricCard">
              <div className="customerMetricLabel">{item.label}</div>
              <div className="customerMetricValue">{item.value}{item.unit ?? ""}</div>
            </article>
          ))}
        </div>
      </section>
      <section className="customerCard">
        <h2 className="customerCardTitle">高风险地块 Top 5</h2>
        <PrintTable
          headers={["地块", "风险", "原因"]}
          rows={topRisks.map((item) => [item.fieldName || "地块名称待补充", item.riskLabel, item.reasons.join("；") || "暂无风险原因"])}
          emptyText={vm.emptyStates.NO_RISK_FIELDS?.title ?? "暂无高风险地块"}
        />
      </section>
      <section className="customerCard">
        <h2 className="customerCardTitle">近期作业 Top 5</h2>
        <PrintTable
          headers={["作业", "地块", "更新时间", "验收"]}
          rows={recentOperations.map((item) => [item.operationName, item.fieldName, item.updatedAtText, item.acceptanceText])}
          emptyText={vm.emptyStates.NO_RECENT_OPERATIONS?.title ?? "暂无近期作业"}
        />
      </section>
      <section className="customerCard">
        <h2 className="customerCardTitle">价值摘要</h2>
        {!roi.totalRoiItems ? (
          <p className="customerSpacingTopSm">{roi.emptyState?.title ?? vm.emptyStates.NO_ROI?.title ?? "暂无可量化价值记录"}</p>
        ) : (
          <div className="customerGrid2 customerSpacingTopSm">
            <div><strong>价值记录数量：</strong>{roi.totalRoiItems}</div>
            <div><strong>节水记录：</strong>{roi.waterSavedItems}</div>
            <div><strong>价值摘要：</strong>{roi.customerValueText || "暂无收益摘要"}</div>
            <div><strong>置信度：</strong>{roi.confidenceText || "暂无记录"}</div>
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
    <div className="customerCompactReport">
      <section className="customerCard">
        <h2 className="customerCardTitle">摘要</h2>
        <div className="customerGrid2 customerSpacingTopSm">
          <div><strong>地块名称：</strong>{vm.header.title}</div>
          <div><strong>作业总数：</strong>{vm.overview.totalOperationsText}</div>
          <div><strong>当前风险：</strong>{vm.risk.levelLabel}</div>
          <div><strong>待验收：</strong>{vm.overview.pendingAcceptanceText}</div>
        </div>
      </section>
      <section className="customerCard"><h2 className="customerCardTitle">风险/诊断</h2><p className="customerSpacingTopSm">{vm.explain.human}；当前风险 {vm.risk.levelLabel}</p></section>
      <section className="customerCard"><h2 className="customerCardTitle">下一步建议</h2><p className="customerSpacingTopSm">{vm.nextAction?.objectiveText ?? "暂无新的处理建议"}</p></section>
      <section className="customerCard"><h2 className="customerCardTitle">价值与记忆</h2><div className="customerGrid2 customerSpacingTopSm"><div>{vm.roiSummary.displayText}</div><div>{vm.fieldMemory.displayText}</div></div></section>
      <section className="customerCard"><h2 className="customerCardTitle">最终结论</h2><p className="customerSpacingTopSm">{vm.currentStatus.summary}</p></section>
    </div>
  );
}

export function OperationExportBlocks({ vm }: { vm: OperationReportPageVm }): React.ReactElement {
  const sections = vm.sections;
  return (
    <div className="customerCompactReport">
      <section className="customerCard">
        <h2 className="customerCardTitle">作业报告头</h2>
        <div className="customerGrid2 customerSpacingTopSm">
          <div><strong>作业：</strong>{vm.header.title}</div>
          <div><strong>状态：</strong>{vm.operation.finalStatusLabel}</div>
        </div>
      </section>
      <section className="operationClosedLoopGrid">
        {sections.map((item, index) => (
          <article key={item.key} className="customerCard operationClosedLoopCard">
            <div className="operationClosedLoopHead">
              <span className="operationStepNo">{index + 1}</span>
              <h2 className="customerCardTitle">{item.title}</h2>
              <span className="operationStatusBadge">{item.statusText ?? item.status}</span>
            </div>
            <p className="customerSpacingTopSm">{item.summary}</p>
            {item.emptyState ? <p className="customerMetricLabel">{item.emptyState.title}：{item.emptyState.description}</p> : null}
          </article>
        ))}
      </section>
      {vm.technicalFoldout?.rows?.length ? (
        <details className="operationTechDetailsMuted">
          <summary className="operationTechDetailsSummary">技术附录（默认关闭）</summary>
          <p className="customerMetricLabel customerSpacingTopSm">默认客户版不突出内部技术字段，仅排障时查看。</p>
          <div className="operationTechDetailsGrid">
            {vm.technicalFoldout.rows.map((row) => <div key={row.label} className="customerMetricLabel"><strong>{row.label}：</strong>{row.value}</div>)}
          </div>
        </details>
      ) : null}
      <footer className="customerCard"><p className="customerMetricLabel">报告由 GEOX 自动生成，供作业执行留痕与验收复盘使用。</p></footer>
    </div>
  );
}
