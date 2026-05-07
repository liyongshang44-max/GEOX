import React from "react";
import { Link } from "react-router-dom";
import { fetchCustomerDashboardAggregate } from "../api/customerReports";
import {
  CockpitActionList,
  CockpitFieldRiskPanel,
  CockpitKpiStrip,
  DeviceHealthCard,
  ExecutionAcceptanceSummary,
  RecentOperationsSection,
  ValueResultPanel,
} from "../components/cockpit";
import { getCustomerEmptyState } from "../lib/customerEmptyStates";
import { buildCustomerDashboardVm, type CustomerDashboardPageVm } from "../viewmodels/customerDashboardVm";

export default function CustomerDashboardPage(): React.ReactElement {
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

  const emptyStates = vm?.emptyStates ?? {
    NO_KPI_SUMMARY: getCustomerEmptyState("NO_KPI_SUMMARY"),
    NO_PENDING_ACTIONS: getCustomerEmptyState("NO_PENDING_ACTIONS"),
    NO_RISK_FIELDS: getCustomerEmptyState("NO_RISK_FIELDS"),
    NO_RECENT_OPERATIONS: getCustomerEmptyState("NO_RECENT_OPERATIONS"),
    NO_DEVICE_HEALTH: getCustomerEmptyState("NO_DEVICE_HEALTH"),
    NO_ROI: getCustomerEmptyState("NO_ROI"),
    WEATHER_UNAVAILABLE: getCustomerEmptyState("WEATHER_UNAVAILABLE"),
  };
  const kpis = vm?.kpis ?? [];
  const acceptanceSummaryVm = {
    title: "作业验收摘要",
    subtitle: "待验收与闭环状态",
    metrics: [
      { key: "pending", label: "待验收", value: String(vm?.kpis.find((item) => item.key === "PENDING_ACCEPTANCE")?.value ?? "0") },
      { key: "recent", label: "近期作业", value: String(vm?.kpis.find((item) => item.key === "RECENT_OPERATIONS")?.value ?? "0") },
    ],
    emptyState: emptyStates.NO_PENDING_ACTIONS,
  };

  return (
    <div className="customerDashboardPage">
      <header className="customerHero">
        <div className="customerHeroTop">
          <div>
            <div className="customerLabel">客户经营总览</div>
            <h1 className="customerTitle">经营驾驶舱</h1>
          </div>
          <Link className="customerButton customerButtonPrimary" to="/customer/export">总览导出</Link>
        </div>
      </header>

      <section className="customerDashboardKpiRow"><CockpitKpiStrip items={kpis} emptyState={emptyStates.NO_KPI_SUMMARY} /></section>

      <section className="customerDashboardMainGrid">
        <div className="customerDashboardRiskPanel"><CockpitFieldRiskPanel fields={vm?.topRiskFields ?? []} emptyState={emptyStates.NO_RISK_FIELDS} mode="MATRIX" /></div>
        <div className="customerDashboardActionPanel"><CockpitActionList items={vm?.actionItems ?? []} emptyState={emptyStates.NO_PENDING_ACTIONS} /></div>
        <aside className="customerDashboardRightRail">
          <ExecutionAcceptanceSummary vm={acceptanceSummaryVm} />
          <DeviceHealthCard summary={vm?.deviceHealth ?? { empty: true }} emptyState={emptyStates.NO_DEVICE_HEALTH} />
        </aside>
      </section>

      <section className="customerDashboardBottomGrid">
        {vm?.roiSummary ? <ValueResultPanel roi={vm.roiSummary} emptyState={emptyStates.NO_ROI} /> : null}
        <RecentOperationsSection items={vm?.recentOperations ?? []} emptyState={emptyStates.NO_RECENT_OPERATIONS} />
      </section>

      <section className="customerCard noPrint">
        <h3 className="customerCardTitle">导出经营报告</h3>
        <Link className="customerButton" to="/customer/export">导出总览报告</Link>
      </section>

      {!vm && error ? <div className="muted customerSpacingTopMd">{error}</div> : null}
    </div>
  );
}
