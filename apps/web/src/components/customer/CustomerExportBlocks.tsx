import React from "react";
import type { CustomerDashboardPageVm } from "../../viewmodels/customerDashboardVm";
import type { FieldReportPageVm } from "../../viewmodels/fieldReportVm";
import type { OperationReportPageVm } from "../../viewmodels/operationReportVm";
import { SectionCard } from "../../shared/ui";

export function DashboardExportBlocks({ vm }: { vm: CustomerDashboardPageVm }): React.ReactElement {
  const managedFields = vm.kpis.find((item) => item.key === "managedFields")?.valueText ?? "-";
  const highRiskFields = vm.kpis.find((item) => item.key === "highRiskFields")?.valueText ?? "-";
  const pendingApproval = vm.kpis.find((item) => item.key === "pendingApproval")?.valueText ?? "-";
  const pendingAcceptance = vm.kpis.find((item) => item.key === "pendingAcceptance")?.valueText ?? "-";
  const earlyWarnings = vm.kpis.find((item) => item.key === "earlyWarnings")?.valueText ?? "-";
  const nextActionTitles = vm.nextActions.map((item) => item.title).join(" · ") || "暂无待处理事项";
  const recentOperations = vm.recentOperations.map((item) => item.rowText).join("；") || "暂无近期作业";
  const valueText = "价值摘要将在后续作业账本中持续积累";
  const confidenceText = "可信度基于当前客户报告数据生成";

  return (
    <>
      <SectionCard title="摘要">
        <div>管理地块 {managedFields} 个，高风险地块 {highRiskFields} 个，提前发现异常 {earlyWarnings} 项</div>
      </SectionCard>
      <SectionCard title="风险/诊断">
        <div>待审批处方：{pendingApproval}；待验收作业：{pendingAcceptance}</div>
      </SectionCard>
      <SectionCard title="近期作业">
        <div>{recentOperations}</div>
      </SectionCard>
      <SectionCard title="下一步建议">
        <div>{nextActionTitles}</div>
      </SectionCard>
      <SectionCard title="本次价值"><div>{valueText}</div></SectionCard>
      <SectionCard title="证据可信度"><div>{confidenceText}</div></SectionCard>
      <SectionCard title="系统记忆"><div className="muted">系统持续记录历史作业与风险变化，用于支撑本次判断。</div></SectionCard>
      <SectionCard title="最终结论"><div>当前建议按“下一步建议”优先执行，并在后续作业完成后复核风险变化。</div></SectionCard>
    </>
  );
}

export function FieldExportBlocks({ vm }: { vm: FieldReportPageVm }): React.ReactElement {
  return (
    <>
    <SectionCard title="摘要">
      <div className="kvGrid2">
        <div><strong>地块名称：</strong>{vm.header.title}</div>
        <div><strong>作业总数：</strong>{vm.overview.totalOperationsText}</div>
      </div>
    </SectionCard>
    <SectionCard title="风险/诊断"><div>{vm.explain.human}；当前风险 {vm.overview.riskText}</div></SectionCard>
    <SectionCard title="近期作业"><div>待验收作业：{vm.overview.pendingAcceptanceText}</div></SectionCard>
    <SectionCard title="下一步建议"><div>优先处理未关闭异常并完成待验收作业（{vm.overview.openAlertsText}）。</div></SectionCard>
    <SectionCard title="本次价值"><div>通过聚焦关键风险，减少重复巡检与处置延迟。</div></SectionCard>
    <SectionCard title="证据可信度"><div>基于地块状态、异常记录与作业进展综合评估。</div></SectionCard>
    <SectionCard title="系统记忆"><div className="muted">系统已关联该地块历史变化，用于跟踪趋势。</div></SectionCard>
    <SectionCard title="最终结论"><div>地块整体可控，建议按优先级继续闭环处置。</div></SectionCard>
    </>
  );
}

export function OperationExportBlocks({ vm }: { vm: OperationReportPageVm }): React.ReactElement {
  return (
    <>
    <SectionCard title="摘要">
      <div className="kvGrid2">
        <div><strong>作业标题：</strong>{vm.header.title}</div>
        <div><strong>执行负责人：</strong>{vm.execution.ownerText}</div>
        <div><strong>执行状态：</strong>{vm.execution.statusText}</div>
        <div><strong>验收状态：</strong>{vm.acceptance.statusText}</div>
      </div>
    </SectionCard>
    <SectionCard title="风险/诊断"><div>{vm.why.riskLabel}；{vm.why.reasonText}</div></SectionCard>
    <SectionCard title="近期作业"><div>{vm.execution.statusText}，验收状态：{vm.acceptance.statusText}</div></SectionCard>
    <SectionCard title="下一步建议"><div>继续推进执行闭环，并按验收结果调整后续安排。</div></SectionCard>
    <SectionCard title="本次价值"><div>明确责任与进度，提升作业闭环效率。</div></SectionCard>
    <SectionCard title="证据可信度"><div>基于执行记录、负责人信息与验收结果综合判断。</div></SectionCard>
    <SectionCard title="系统记忆"><div className="muted">系统保存该作业全流程节点，便于后续复盘。</div></SectionCard>
    <SectionCard title="最终结论"><div>当前作业处于可追踪状态，建议按建议步骤完成闭环。</div></SectionCard>
    </>
  );
}
