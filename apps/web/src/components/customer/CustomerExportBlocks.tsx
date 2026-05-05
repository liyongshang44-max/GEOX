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

  return (
    <>
      <SectionCard title="地块状态">
        <div>管理地块 {managedFields} 个，高风险地块 {highRiskFields} 个，提前发现异常 {earlyWarnings} 项</div>
      </SectionCard>
      <SectionCard title="经营汇总">
        <div>待审批处方：{pendingApproval}</div>
        <div>待验收作业：{pendingAcceptance}</div>
      </SectionCard>
      <SectionCard title="待处理事项">
        <div>{nextActionTitles}</div>
        <div className="muted">{vm.roiSummary.confidenceText}</div>
      </SectionCard>
    </>
  );
}

export function FieldExportBlocks({ vm }: { vm: FieldReportPageVm }): React.ReactElement {
  return (
    <SectionCard title="地块报告摘要">
      <div className="kvGrid2">
        <div><strong>地块名称：</strong>{vm.header.title}</div>
        <div><strong>当前风险：</strong>{vm.overview.riskText}</div>
        <div><strong>未关闭告警：</strong>{vm.overview.openAlertsText}</div>
        <div><strong>待验收作业：</strong>{vm.overview.pendingAcceptanceText}</div>
        <div><strong>作业总数：</strong>{vm.overview.totalOperationsText}</div>
        <div><strong>状态解释：</strong>{vm.explain.human}</div>
      </div>
    </SectionCard>
  );
}

export function OperationExportBlocks({ vm }: { vm: OperationReportPageVm }): React.ReactElement {
  return (
    <SectionCard title="作业闭环摘要">
      <div className="kvGrid2">
        <div><strong>作业标题：</strong>{vm.header.title}</div>
        <div><strong>当前风险：</strong>{vm.why.riskLabel}</div>
        <div><strong>主要原因：</strong>{vm.why.reasonText}</div>
        <div><strong>执行负责人：</strong>{vm.execution.ownerText}</div>
        <div><strong>执行状态：</strong>{vm.execution.statusText}</div>
        <div><strong>验收状态：</strong>{vm.acceptance.statusText}</div>
      </div>
    </SectionCard>
  );
}
