import React from "react";
import { Link } from "react-router-dom";
import { fetchCustomerDashboardAggregate } from "../api/customerReports";
import {
  CockpitActionList,
  CockpitFieldRiskPanel,
  CockpitKpiStrip,
  DeviceHealthCard,
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

  return (
    <div className="customerPage customerPageGapMd">
      <header className="customerHero">
        <div className="customerHeroTop">
          <div>
            <div className="customerLabel">客户经营总览</div>
            <h1 className="customerTitle">经营驾驶舱</h1>
          </div>
          <Link className="customerButton customerButtonPrimary" to="/customer/export">总览导出</Link>
        </div>
      </header>

      <CockpitKpiStrip items={kpis} emptyState={emptyStates.NO_KPI_SUMMARY} />

      <section className="customerGrid3">
        <CockpitFieldRiskPanel fields={vm?.topRiskFields ?? []} emptyState={emptyStates.NO_RISK_FIELDS} mode="MATRIX" />
        <CockpitActionList items={vm?.actionItems ?? []} emptyState={emptyStates.NO_PENDING_ACTIONS} />
        <div className="customerPageGapMd">
          <DeviceHealthCard summary={vm?.deviceHealth ?? { empty: true }} emptyState={emptyStates.NO_DEVICE_HEALTH} />
          {vm?.roiSummary ? <ValueResultPanel roi={vm.roiSummary} emptyState={emptyStates.NO_ROI} /> : null}
        </div>
      </section>

      <RecentOperationsSection items={vm?.recentOperations ?? []} emptyState={emptyStates.NO_RECENT_OPERATIONS} />

      <section className="customerCard noPrint">
        <h3 className="customerCardTitle">导出经营报告</h3>
        <Link className="customerButton" to="/customer/export">导出总览报告</Link>
      </section>

      {!vm && error ? <div className="muted customerSpacingTopMd">{error}</div> : null}
    </div>
  );
}
