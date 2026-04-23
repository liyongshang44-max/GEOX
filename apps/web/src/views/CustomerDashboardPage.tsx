import React from "react";
import { Link } from "react-router-dom";
import { fetchCustomerDashboardAggregate, type CustomerDashboardAggregateV1 } from "../api/reports";
import { buildCustomerDashboardVm } from "../viewmodels/customerDashboardVm";
import { PageHeader, SectionCard } from "../shared/ui";

export default function CustomerDashboardPage(): React.ReactElement {
  const [dashboard, setDashboard] = React.useState<CustomerDashboardAggregateV1 | null>(null);
  const [error, setError] = React.useState<string>("");

  React.useEffect(() => {
    void fetchCustomerDashboardAggregate()
      .then((res) => {
        setDashboard(res);
        setError("");
      })
      .catch(() => {
        setDashboard(null);
        setError("暂未获取到可展示的经营数据，请稍后刷新。");
      });
  }, []);

  const vm = dashboard ? buildCustomerDashboardVm(dashboard) : null;

  return (
    <div className="demoDashboardPage">
      <PageHeader
        eyebrow="GEOX / 客户看板"
        title={vm?.header.title ?? "客户看板"}
        description={vm?.header.subtitle ?? "围绕经营结果、风险、成本与行动建议展示"}
        actions={(
          <>
            <Link className="btn" to="/fields/portfolio">查看全部地块</Link>
            <Link className="btn" to="/alerts">进入告警中心</Link>
          </>
        )}
      />

      <SectionCard title="地块状态">
        <div>
          共 {numberFmt.format(summary?.total_fields ?? 0)} 个地块，风险 {numberFmt.format((summary?.by_risk.high ?? 0) + (summary?.by_risk.critical ?? 0))} 个，
          高风险地块数 {numberFmt.format((summary?.by_risk.high ?? 0) + (summary?.by_risk.critical ?? 0))} 个
        </div>
        <div className="muted">离线地块：{numberFmt.format(summary?.offline_fields ?? 0)}。</div>
      </SectionCard>

      <SectionCard title="经营汇总">
        <div>未关闭告警：{vm?.businessSummary.openAlertsText ?? "0"}</div>
        <div>待验收：{vm?.businessSummary.pendingAcceptanceText ?? "0"}</div>
        <div>预计成本：{vm?.businessSummary.estimatedCostText ?? "¥0.00"}</div>
        <div>实际成本：{vm?.businessSummary.actualCostText ?? "¥0.00"}</div>
      </SectionCard>

      <SectionCard title="待处理事项">
        <div>总告警：{vm?.pendingActions.totalAlertsText ?? "0"}</div>
        <div>未分配：{vm?.pendingActions.unassignedText ?? "0"}</div>
        <div>处理中：{vm?.pendingActions.inProgressText ?? "0"}</div>
        <div>已超时：{vm?.pendingActions.slaBreachedText ?? "0"}</div>
        <div>今日关闭：{vm?.pendingActions.closedTodayText ?? "0"}</div>
        <div style={{ marginTop: 8 }}><Link className="btn" to="/operations/workboard">进入作业台</Link></div>
      </SectionCard>

      <SectionCard title="Top 风险地块">
        <div className="list">
          {(vm?.topRiskFields || []).map((item) => (
            <div key={item.fieldId} className="item">
              <div>{item.title}</div>
              <div className="muted">风险：{item.riskText}</div>
              <div className="muted">主要原因：{item.reasonText}</div>
              <div className="muted">告警数：{item.openAlertsText} · 待验收数：{item.pendingAcceptanceText}</div>
              <div className="muted">最近作业时间：{item.lastOperationText}</div>
              <div style={{ marginTop: 8 }}><Link className="btn" to={item.href}>地块报告</Link></div>
            </div>
          ))}
          {vm && !vm.topRiskFields.length ? <div className="muted">暂无风险地块数据</div> : null}
        </div>
      </SectionCard>

      <SectionCard title="近期作业">
        <div className="list">
          {(vm?.recentOperations || []).map((item) => (
            <div key={item.operationId} className="item">
              <div>{item.title}</div>
              <div className="muted">所属地块：{item.fieldTitle}</div>
              <div className="muted">最终状态：{item.statusText}</div>
              <div className="muted">验收状态：{item.acceptanceText}</div>
              <div className="muted">执行时间：{item.executedAtText}</div>
              <div style={{ marginTop: 8 }}><Link className="btn" to={item.href}>作业报告</Link></div>
            </div>
          ))}
          {vm && !vm.recentOperations.length ? <div className="muted">暂无近期作业数据</div> : null}
        </div>
      </SectionCard>

      {error ? <div className="muted" style={{ marginTop: 12 }}>{error}</div> : null}
    </div>
  );
}
