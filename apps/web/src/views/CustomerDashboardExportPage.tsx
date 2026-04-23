import React from "react";
import { fetchCustomerDashboardAggregate } from "../api/reports";
import { buildCustomerDashboardVm, type CustomerDashboardPageVm } from "../viewmodels/customerDashboardVm";
import { PageHeader, SectionCard } from "../shared/ui";

export default function CustomerDashboardExportPage(): React.ReactElement {
  const [vm, setVm] = React.useState<CustomerDashboardPageVm | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    void fetchCustomerDashboardAggregate()
      .then((aggregate) => {
        if (!alive) return;
        setVm(buildCustomerDashboardVm(aggregate));
        setError("");
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setVm(null);
        setError(String(e instanceof Error ? e.message : "加载失败"));
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (loading) return <div className="card" style={{ padding: 16 }}>客户看板导出加载中...</div>;
  if (error || !vm) return <div className="card" style={{ padding: 16 }}>客户看板导出加载失败：{error || "暂无数据"}</div>;

  return (
    <div className="demoDashboardPage reportPrintPage">
      <PageHeader
        eyebrow="GEOX / 客户看板"
        title={vm.header.title}
        description={vm.header.subtitle}
        actions={[{ label: "打印导出", onClick: () => window.print() }]}
      />

      <SectionCard title="地块状态">
        <div>
          共 {vm.fieldStatus.totalFieldsText} 个地块，风险 {vm.fieldStatus.atRiskText} 个，
          高风险地块数 {vm.fieldStatus.highRiskText} 个
        </div>
        <div className="muted">离线地块：{vm.fieldStatus.offlineFieldsText}。</div>
      </SectionCard>

      <SectionCard title="经营汇总">
        <div>未关闭告警：{vm.businessSummary.openAlertsText}</div>
        <div>待验收：{vm.businessSummary.pendingAcceptanceText}</div>
        <div>预计成本：{vm.businessSummary.estimatedCostText} · 实际成本：{vm.businessSummary.actualCostText}</div>
      </SectionCard>

      <SectionCard title="待处理事项">
        <div>总告警：{vm.pendingActions.totalAlertsText}</div>
        <div className="muted">
          未分配：{vm.pendingActions.unassignedText} ·
          处理中：{vm.pendingActions.inProgressText} ·
          已超时：{vm.pendingActions.slaBreachedText} ·
          今日关闭：{vm.pendingActions.closedTodayText}
        </div>
      </SectionCard>

      <SectionCard title="Top 风险地块">
        <div className="list">
          {vm.topRiskFields.map((item) => (
            <div key={item.fieldId} className="item">
              {item.title} · 风险 {item.riskText} · 主要原因 {item.reasonText} · 未关闭告警 {item.openAlertsText} ·
              待验收 {item.pendingAcceptanceText} · 最近作业 {item.lastOperationText}
            </div>
          ))}
          {!vm.topRiskFields.length ? (
            <div className="muted">暂无风险地块数据</div>
          ) : null}
        </div>
      </SectionCard>

      <SectionCard title="近期作业">
        <div className="list">
          {vm.recentOperations.map((item) => (
            <div key={item.operationId} className="item">
              {item.title} · 所属地块 {item.fieldTitle} · 最终状态 {item.statusText} · 验收状态 {item.acceptanceText} · 执行时间 {item.executedAtText}
            </div>
          ))}
          {!vm.recentOperations.length ? (
            <div className="muted">暂无近期作业</div>
          ) : null}
        </div>
      </SectionCard>
    </div>
  );
}
