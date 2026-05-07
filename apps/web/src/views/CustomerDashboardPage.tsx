import React from "react";
import { Link } from "react-router-dom";
import { fetchCustomerDashboardAggregate } from "../api/customerReports";
import CockpitKpiStrip from "../components/cockpit/CockpitKpiStrip";
import CockpitFieldRiskPanel from "../components/cockpit/CockpitFieldRiskPanel";
import { CockpitActionList, DeviceHealthCard, ValueResultPanel } from "../components/cockpit/CockpitPanels";
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
  const offlineDevices = vm?.kpis.find((kpi) => kpi.key === "OFFLINE_DEVICES")?.value ?? "0";

  return (
    <div className="customerPage customerPageGapMd">
      <header className="customerHero">
        <div className="customerHeroTop">
          <div>
            <div className="customerLabel">PageHeader</div>
            <h1 className="customerTitle">经营驾驶舱（cockpit-lite）</h1>
          </div>
          <Link className="customerButton customerButtonPrimary" to="/customer/export">总览导出</Link>
        </div>
      </header>

      <CockpitKpiStrip items={kpis} />

      <section className="customerGrid3">
        <CockpitFieldRiskPanel fields={vm?.topRiskFields ?? []} mode="MATRIX" />
        <CockpitActionList items={vm?.actionItems ?? []} />
        <div className="customerPageGapMd">
          <DeviceHealthCard offlineDevices={offlineDevices} />
          <ValueResultPanel valueText={vm?.roiSummary.customerValueText ?? "暂无收益摘要"} roiItems={vm?.roiSummary.totalRoiItems ?? 0} />
        </div>
      </section>

      <section className="customerCard">
        <h3 className="customerCardTitle">RecentOperationsSection</h3>
        <ul className="customerList">
          {(vm?.recentOperations ?? []).map((item) => <li key={item.operationId} className="customerListItem"><Link to={item.href}>{item.rowText}</Link></li>)}
          {!(vm?.recentOperations.length) ? <li className="muted">暂无近期作业</li> : null}
        </ul>
      </section>

      <section className="customerCard noPrint">
        <h3 className="customerCardTitle">ReportExportCTA</h3>
        <Link className="customerButton" to="/customer/export">进入总览导出页</Link>
      </section>

      {!vm && error ? <div className="muted customerSpacingTopMd">{error}</div> : null}
    </div>
  );
}
