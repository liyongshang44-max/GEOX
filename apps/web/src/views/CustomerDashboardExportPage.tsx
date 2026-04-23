import React from "react";
import { fetchCustomerDashboardAggregate } from "../api/reports";
import { buildCustomerDashboardVm, type CustomerDashboardPageVm } from "../viewmodels/customerDashboardVm";
import { PageHeader, SectionCard } from "../shared/ui";

export default function CustomerDashboardExportPage(): React.ReactElement {
  const [vm, setVm] = React.useState<CustomerDashboardPageVm | null>(null);
  const [error, setError] = React.useState<string>("");

  React.useEffect(() => {
    void fetchCustomerDashboardAggregate()
      .then((aggregate) => {
        setVm(buildCustomerDashboardVm(aggregate));
        setError("");
      })
      .catch(() => {
        setVm(null);
        setError("暂未获取到可展示的经营数据，请稍后刷新。");
      });
  }, []);

  return (
    <div className="demoDashboardPage reportPrintPage">
      <PageHeader
        eyebrow="GEOX / 客户看板"
        title={vm?.header.title ?? "客户看板"}
        description={vm?.header.subtitle ?? "经营结果、风险与行动摘要"}
        actions={[{ label: "打印导出", onClick: () => window.print() }]}
      />

      <SectionCard title="地块状态">
        <div>
          共 {vm?.fieldStatus.totalFieldsText ?? "0"} 个地块，风险 {vm?.fieldStatus.atRiskText ?? "0"} 个，
          高风险地块数 {vm?.fieldStatus.highRiskText ?? "0"} 个
        </div>
        <div className="muted">离线地块：{vm?.fieldStatus.offlineFieldsText ?? "0"}。</div>
      </SectionCard>

      <SectionCard title="经营汇总">
        <div>未关闭告警：{vm?.businessSummary.openAlertsText ?? "0"}</div>
        <div>待验收：{vm?.businessSummary.pendingAcceptanceText ?? "0"}</div>
        <div>预计成本：{vm?.businessSummary.estimatedCostText ?? "¥0.00"} · 实际成本：{vm?.businessSummary.actualCostText ?? "¥0.00"}</div>
      </SectionCard>

      <SectionCard title="待处理事项">
        <div>总告警：{vm?.pendingActions.totalAlertsText ?? "0"}</div>
        <div className="muted">
          未分配：{vm?.pendingActions.unassignedText ?? "0"} ·
          处理中：{vm?.pendingActions.inProgressText ?? "0"} ·
          已超时：{vm?.pendingActions.slaBreachedText ?? "0"} ·
          今日关闭：{vm?.pendingActions.closedTodayText ?? "0"}
        </div>
      </SectionCard>

      <SectionCard title="Top 风险地块">
        <div className="list">
          {(vm?.topRiskFields ?? []).map((item) => (
            <div key={item.fieldId} className="item">
              {item.title} · 风险 {item.riskText} · 主要原因 {item.reasonText} · 未关闭告警 {item.openAlertsText} ·
              待验收 {item.pendingAcceptanceText} · 最近作业 {item.lastOperationText}
            </div>
          ))}
          {!(vm?.topRiskFields.length) ? (
            <div className="muted">暂无风险地块数据</div>
          ) : null}
        </div>
      </SectionCard>

      <SectionCard title="近期作业">
        <div className="list">
          {(vm?.recentOperations ?? []).map((item) => (
            <div key={item.operationId} className="item">
              {item.title} · 所属地块 {item.fieldTitle} · 最终状态 {item.statusText} · 验收状态 {item.acceptanceText} · 执行时间 {item.executedAtText}
            </div>
          ))}
          {!(vm?.recentOperations.length) ? (
            <div className="muted">暂无近期作业</div>
          ) : null}
        </div>
      </SectionCard>

      {error ? <div className="muted" style={{ marginTop: 12 }}>{error}</div> : null}
    </div>
  );
}
