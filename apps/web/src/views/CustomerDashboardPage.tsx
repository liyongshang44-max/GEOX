import React from "react";
import { fetchCustomerDashboardAggregate, type CustomerDashboardAggregateV1 } from "../api/customerReports";
import {
  CockpitActionList,
  CockpitFieldRiskPanel,
  CockpitKpiStrip,
  DeviceHealthCard,
  ExecutionAcceptanceSummary,
  RecentOperationsSection,
  ValueResultPanel,
} from "../components/cockpit";
import RoiLedgerDrawer from "../components/customer/RoiLedgerDrawer";
import { FormalScenarioBadge } from "../components/customer";
import { getCustomerEmptyState } from "../lib/customerEmptyStates";
import { buildCustomerDashboardVm, type CustomerDashboardPageVm } from "../viewmodels/customerDashboardVm";

export default function CustomerDashboardPage(): React.ReactElement {
  const [vm, setVm] = React.useState<CustomerDashboardPageVm | null>(null);
  const [aggregate, setAggregate] = React.useState<CustomerDashboardAggregateV1 | null>(null);
  const [error, setError] = React.useState<string>("");
  const [roiDrawerOpen, setRoiDrawerOpen] = React.useState(false);

  React.useEffect(() => {
    void fetchCustomerDashboardAggregate()
      .then((nextAggregate) => {
        setAggregate(nextAggregate);
        setVm(buildCustomerDashboardVm(nextAggregate));
        setError("");
      })
      .catch(() => {
        setAggregate(null);
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
  const pendingAcceptanceKpi = vm?.kpis.find((item) => item.key === "PENDING_ACCEPTANCE"); // no-raw-enum-customer-allow: dashboard KPI key lookup only, converted to customer label before render
  const recentOperationsKpi = vm?.kpis.find((item) => item.key === "RECENT_OPERATIONS");
  const summaryScopeText = vm?.summaryScopeText ?? "统计范围：当前可见授权经营范围；来源：客户看板统一摘要。";
  const deviceFallback = {
    empty: true,
    scopeText: "设备统计范围：当前账号授权可见设备；当前地块设备请进入地块报告查看。",
    globalText: "全域设备：暂无设备摘要。",
    authorizedText: "授权可见设备：暂无设备摘要。",
    fieldText: "当前地块设备：请进入地块报告查看。",
    offlineText: "离线设备：暂无设备摘要。",
    alertText: "告警事件：暂无设备摘要。",
  };
  const acceptanceSummaryVm = {
    title: "执行与验收摘要",
    subtitle: summaryScopeText,
    metrics: [
      { key: "pending", label: "待验收", value: String(pendingAcceptanceKpi?.value ?? "0"), helperText: "统计范围：当前可见授权经营范围；与作业列表使用同一客户摘要来源。" },
      { key: "recent", label: "作业记录", value: String(recentOperationsKpi?.value ?? "0"), helperText: "统计范围：当前可见授权经营范围；下方仅展示最近 5 条作业。" },
    ],
    emptyState: emptyStates.NO_PENDING_ACTIONS,
  };
  const embeddedRoi = (aggregate as any)?.roi_ledger ?? (aggregate as any)?.roi ?? (aggregate as any)?.value_summary;

  return (
    <div className="customerDashboardPage">
      {vm ? <p className="customerMetricLabel customerSpacingBottomSm">{summaryScopeText}</p> : null}
      <CockpitKpiStrip items={kpis} emptyState={emptyStates.NO_KPI_SUMMARY} />

      <section className="customerDashboardMainGrid">
        <div className="customerDashboardRiskPanel"><CockpitFieldRiskPanel fields={vm?.topRiskFields ?? []} emptyState={emptyStates.NO_RISK_FIELDS} mode="MATRIX" /></div>
        <div className="customerDashboardActionPanel"><CockpitActionList items={vm?.actionItems ?? []} emptyState={emptyStates.NO_PENDING_ACTIONS} /></div>
        <aside className="customerDashboardRightRail">
          <ExecutionAcceptanceSummary vm={acceptanceSummaryVm} />
          <DeviceHealthCard summary={vm?.deviceHealth ?? deviceFallback} emptyState={emptyStates.NO_DEVICE_HEALTH} />
        </aside>
      </section>

      <section className="customerDashboardBottomGrid">
        {aggregate?.recent_operations?.[0] ? <FormalScenarioBadge data={aggregate.recent_operations[0]} /> : null}
        {vm?.roiSummary ? (
          <div className="customerDashboardRoiEntry">
            <ValueResultPanel roi={vm.roiSummary} emptyState={emptyStates.NO_ROI} />
            <button type="button" className="customerButton customerSpacingTopXs" onClick={() => setRoiDrawerOpen(true)}>查看价值记录明细</button>
          </div>
        ) : null}
        <RecentOperationsSection items={vm?.recentOperations ?? []} emptyState={emptyStates.NO_RECENT_OPERATIONS} />
      </section>

      {!vm && error ? <div className="muted customerSpacingTopMd">{error}</div> : null}
      <RoiLedgerDrawer open={roiDrawerOpen} embeddedRoi={embeddedRoi} onClose={() => setRoiDrawerOpen(false)} />
    </div>
  );
}
