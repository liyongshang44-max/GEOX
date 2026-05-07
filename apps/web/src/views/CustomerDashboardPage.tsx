import React from "react";
import { Link } from "react-router-dom";
import { fetchCustomerDashboardAggregate } from "../api/customerReports";
import CockpitKpiStrip from "../components/cockpit/CockpitKpiStrip";
import CockpitFieldRiskPanel from "../components/cockpit/CockpitFieldRiskPanel";
import CockpitActionList from "../components/cockpit/CockpitActionList";
import DeviceHealthCard from "../components/cockpit/DeviceHealthCard";
import ValueResultPanel from "../components/cockpit/ValueResultPanel";
import RecentOperationsSection from "../components/cockpit/RecentOperationsSection";
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

      <CockpitKpiStrip items={kpis} />

      <section className="customerGrid3">
        <CockpitFieldRiskPanel fields={vm?.topRiskFields ?? []} mode="MATRIX" />
        <CockpitActionList items={vm?.actionItems ?? []} />
        <div className="customerPageGapMd">
          <DeviceHealthCard summary={vm?.deviceHealth ?? { empty: true }} />
          <ValueResultPanel roi={vm?.roiSummary ?? { totalRoiItems: 0, waterSavedItems: 0, customerValueText: "" }} />
        </div>
      </section>

      <RecentOperationsSection items={vm?.recentOperations ?? []} />

      <section className="customerCard noPrint">
        <h3 className="customerCardTitle">导出经营报告</h3>
        <Link className="customerButton" to="/customer/export">导出总览报告</Link>
      </section>

      {!vm && error ? <div className="muted customerSpacingTopMd">{error}</div> : null}
    </div>
  );
}
