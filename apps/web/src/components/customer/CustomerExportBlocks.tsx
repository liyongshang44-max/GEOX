import React from "react";
import type { CustomerDashboardPageVm } from "../../viewmodels/customerDashboardVm";
import type { FieldReportPageVm } from "../../viewmodels/fieldReportVm";
import type { OperationReportPageVm } from "../../viewmodels/operationReportVm";
import { SectionCard } from "../../shared/ui";

export function DashboardExportBlocks({ vm }: { vm: CustomerDashboardPageVm }): React.ReactElement {
  return (
    <>
      <SectionCard title="地块状态"><div>共 {vm.fieldStatus.totalFieldsText} 个地块，风险 {vm.fieldStatus.atRiskText} 个，高风险地块数 {vm.fieldStatus.highRiskText} 个</div></SectionCard>
      <SectionCard title="经营汇总"><div>未关闭告警：{vm.businessSummary.openAlertsText}</div><div>待验收：{vm.businessSummary.pendingAcceptanceText}</div></SectionCard>
      <SectionCard title="待处理事项"><div>总告警：{vm.pendingActions.totalAlertsText}</div><div className="muted">未分配：{vm.pendingActions.unassignedText} · 处理中：{vm.pendingActions.inProgressText} · 已超时：{vm.pendingActions.slaBreachedText}</div></SectionCard>
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
