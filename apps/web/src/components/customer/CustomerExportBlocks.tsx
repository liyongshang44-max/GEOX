import React from "react";
import type { CustomerDashboardPageVm } from "../../viewmodels/customerDashboardVm";
import type { FieldReportPageVm } from "../../viewmodels/fieldReportVm";
import type { OperationReportPageVm } from "../../viewmodels/operationReportVm";

function splitRecentOperationRow(rowText: string): { operationType: string; fieldName: string; timeText: string; acceptanceText: string } {
  const [operationType = "作业", fieldName = "地块未知", timeText = "时间未知", acceptanceText = "状态待确认"] = rowText.split(" · ");
  return { operationType, fieldName, timeText, acceptanceText };
}

export function DashboardExportBlocks({ vm }: { vm: CustomerDashboardPageVm }): React.ReactElement {
  const managedFields = vm.kpis.find((item) => item.key === "managedFields")?.valueText ?? "-";
  const highRiskFields = vm.kpis.find((item) => item.key === "highRiskFields")?.valueText ?? "-";
  const pendingApproval = vm.kpis.find((item) => item.key === "pendingApproval")?.valueText ?? "-";
  const pendingAcceptance = vm.kpis.find((item) => item.key === "pendingAcceptance")?.valueText ?? "-";
  const earlyWarnings = vm.kpis.find((item) => item.key === "earlyWarnings")?.valueText ?? "-";
  const nextActionTitles = vm.nextActions.map((item) => item.title).join(" · ") || "暂无待处理事项";
  const recentOperations = (vm.recentOperations ?? []).slice(0, 5);

  return (
    <>
      <section className="customerCard">
        <h2 className="customerCardTitle">摘要</h2>
        <p className="customerSpacingTopSm">管理地块 {managedFields} 个，高风险地块 {highRiskFields} 个，提前发现异常 {earlyWarnings} 项</p>
      </section>
      <section className="customerCard">
        <h2 className="customerCardTitle">风险/诊断</h2>
        <p className="customerSpacingTopSm">待审批处方：{pendingApproval}；待验收作业：{pendingAcceptance}</p>
      </section>
      <section className="customerCard">
        <h2 className="customerCardTitle">近期作业</h2>
        <div className="customerList customerSpacingTopSm">
          {recentOperations.length ? recentOperations.map((item) => {
            const parsed = splitRecentOperationRow(item.rowText);
            return (
              <article key={item.operationId || item.href} className="customerListItem">
                <div><strong>{parsed.operationType}</strong>｜{parsed.fieldName}｜{parsed.timeText}｜{parsed.acceptanceText}</div>
              </article>
            );
          }) : <div className="customerMetricLabel">暂无近期作业</div>}
        </div>
      </section>
      <section className="customerCard"><h2 className="customerCardTitle">下一步建议</h2><p className="customerSpacingTopSm">{nextActionTitles}</p></section>
      <section className="customerCard"><h2 className="customerCardTitle">本次价值</h2><p className="customerSpacingTopSm">本周期暂无可量化价值记录</p></section>
      <section className="customerCard"><h2 className="customerCardTitle">证据可信度</h2><p className="customerSpacingTopSm">本周期暂无可量化价值记录</p></section>
      <section className="customerCard"><h2 className="customerCardTitle">系统记忆</h2><p className="customerMetricLabel customerSpacingTopSm">本周期暂无可量化价值记录</p></section>
      <section className="customerCard"><h2 className="customerCardTitle">最终结论</h2><p className="customerSpacingTopSm">当前建议按“下一步建议”优先执行，并在后续作业完成后复核风险变化。</p></section>
    </>
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
  return (
    <>
      <section className="customerCard">
        <h2 className="customerCardTitle">摘要</h2>
        <div className="customerGrid2 customerSpacingTopSm">
          <div><strong>作业标题：</strong>{vm.header.title}</div>
          <div><strong>执行负责人：</strong>{vm.execution.ownerText}</div>
          <div><strong>执行状态：</strong>{vm.execution.statusText}</div>
          <div><strong>验收状态：</strong>{vm.acceptance.statusText}</div>
        </div>
      </section>
      <section className="customerCard"><h2 className="customerCardTitle">风险/诊断</h2><p className="customerSpacingTopSm">{vm.why.riskLabel}；{vm.why.reasonText}</p></section>
      <section className="customerCard"><h2 className="customerCardTitle">近期作业</h2><p className="customerSpacingTopSm">{vm.execution.statusText}，验收状态：{vm.acceptance.statusText}</p></section>
      <section className="customerCard"><h2 className="customerCardTitle">下一步建议</h2><p className="customerSpacingTopSm">继续推进执行闭环，并按验收结果调整后续安排。</p></section>
      <section className="customerCard"><h2 className="customerCardTitle">本次价值</h2><p className="customerSpacingTopSm">本周期暂无可量化价值记录</p></section>
      <section className="customerCard"><h2 className="customerCardTitle">证据可信度</h2><p className="customerSpacingTopSm">本周期暂无可量化价值记录</p></section>
      <section className="customerCard"><h2 className="customerCardTitle">系统记忆</h2><p className="customerMetricLabel customerSpacingTopSm">本周期暂无可量化价值记录</p></section>
      <section className="customerCard"><h2 className="customerCardTitle">最终结论</h2><p className="customerSpacingTopSm">当前作业处于可追踪状态，建议按建议步骤完成闭环。</p></section>
    </>
  );
}
