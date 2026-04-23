import React from "react";
import { Link } from "react-router-dom";
import { fetchCustomerDashboardAggregate } from "../api/reports";
import { buildCustomerDashboardVm, type CustomerDashboardVm } from "../viewmodels/customerDashboardVm";
import { PageHeader, SectionCard } from "../shared/ui";

export default function CustomerDashboardPage(): React.ReactElement {
  const [vm, setVm] = React.useState<CustomerDashboardVm | null>(null);
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
    <div className="demoDashboardPage">
      <PageHeader
        eyebrow="GEOX / 客户看板"
        title={vm?.header.title ?? "客户看板"}
        description={vm?.header.description ?? "经营结果、风险与行动摘要"}
        actions={
          <>
            <Link className="btn" to="/fields/portfolio">查看全部地块</Link>
            <Link className="btn" to="/alerts">进入告警中心</Link>
          </>
        )}
      />

      <SectionCard title="地块状态">
        <div>
          共 {vm?.fieldStatus.totalFieldsText ?? "0"} 个地块，风险 {vm?.fieldStatus.atRiskText ?? "0"} 个，
          高风险地块数 {vm?.fieldStatus.highRiskText ?? "0"} 个
        </div>
        <div className="muted">离线地块：{vm?.fieldStatus.offlineFieldsText ?? "0"}。</div>
      </SectionCard>

      <SectionCard title="经营汇总">
        <div>未关闭告警：{vm?.businessSummary.totalOpenAlertsText ?? "0"}</div>
        <div>待验收：{vm?.businessSummary.pendingAcceptanceText ?? "0"}</div>
        <div>预计成本：{vm?.businessSummary.estimatedCostText ?? "¥0.00"} · 实际成本：{vm?.businessSummary.actualCostText ?? "¥0.00"}</div>
      </SectionCard>

      <SectionCard title="待处理事项">
        <div>总告警：{vm?.pendingActions.totalOpenAlertsText ?? "0"}</div>
        <div className="muted">
          未分配：{vm?.pendingActions.unassignedAlertsText ?? "0"} ·
          处理中：{vm?.pendingActions.inProgressAlertsText ?? "0"} ·
          已超时：{vm?.pendingActions.slaBreachedAlertsText ?? "0"} ·
          今日关闭：{vm?.pendingActions.closedTodayAlertsText ?? "0"}
        </div>
        <div style={{ marginTop: 8 }}><Link className="btn" to="/operations/workboard">进入作业台</Link></div>
      </SectionCard>

      <SectionCard title="Top 风险地块">
        <div className="list">
          {(vm?.topRiskFields ?? []).map((item) => (
            <div key={item.fieldId} className="item">
              地块 {item.fieldName} · 风险 {item.riskLevelText} · 告警 {item.openAlertsText} ·
              待验收 {item.pendingAcceptanceText} · 最近作业 {item.lastOperationText}
            </div>
          ))}
          {!(vm?.topRiskFields.length) ? (
            <div className="muted">暂无风险地块数据</div>
          ) : null}
        </div>
      </SectionCard>

      <SectionCard title="近期动作">
        <div className="list">
          {(vm?.recentOperations ?? []).map((item) => (
            <div key={item.operationId} className="item">
              {item.title} · 地块 {item.fieldName} · 状态 {item.statusText} · 执行时间 {item.executedAtText}
            </div>
          ))}
          {!(vm?.recentOperations.length) ? (
            <div className="muted">暂无近期动作</div>
          ) : null}
        </div>
      </SectionCard>

      {error ? <div className="muted" style={{ marginTop: 12 }}>{error}</div> : null}
    </div>
  );
}
