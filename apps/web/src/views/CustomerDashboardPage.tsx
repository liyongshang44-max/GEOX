// apps/web/src/views/CustomerDashboardPage.tsx
import React from "react";
import { Link } from "react-router-dom";
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
import { localizedText, useLocale } from "../lib/locale";
import { buildCustomerDashboardVm, type CustomerDashboardPageVm } from "../viewmodels/customerDashboardVm";

const COPY = {
  unavailable: { zh: "暂未获取到可展示的经营数据，请稍后刷新。", en: "Operating data is unavailable. Refresh later." },
  scopeFallback: { zh: "统计范围：当前可见授权经营范围；来源：客户看板统一摘要。", en: "Scope: current visible authorized operating scope; source: unified customer dashboard summary." },
  deviceScope: { zh: "当前页仅展示客户可见授权设备。", en: "This page only shows customer-visible authorized devices." },
  deviceGlobal: { zh: "当前未返回全域设备摘要。", en: "No global device summary was returned." },
  deviceAuthorized: { zh: "当前暂无可见授权设备摘要。", en: "No visible authorized device summary is available." },
  deviceField: { zh: "当前地块设备请进入地块报告查看。", en: "Open the Field Report to review field-scoped devices." },
  deviceOffline: { zh: "当前没有离线设备。", en: "No offline devices are currently reported." },
  deviceAlert: { zh: "当前未发现告警事件。", en: "No alert event is currently reported." },
  deviceWhy: { zh: "当前未返回设备摘要。", en: "No device summary was returned." },
  deviceNext: { zh: "等待补齐设备状态或进入地块报告查看证据。", en: "Wait for device status or open the Field Report to review evidence." },
  deviceFormality: { zh: "设备状态未确认前，仅展示只读摘要。", en: "Only read-only summary is shown until device status is confirmed." },
  acceptanceTitle: { zh: "执行与验收摘要", en: "Execution and Acceptance Summary" },
  pendingAcceptance: { zh: "待验收", en: "Pending acceptance" },
  pendingHelper: { zh: "统计范围：当前可见授权经营范围；与作业列表使用同一客户摘要来源。", en: "Scope: current visible authorized operating scope; uses the same customer summary source as Operations." },
  operationRecords: { zh: "作业记录", en: "Operation records" },
  operationHelper: { zh: "统计范围：当前可见授权经营范围；下方仅展示最近 5 条作业。", en: "Scope: current visible authorized operating scope; only the latest five operations are shown below." },
  usagePathAria: { zh: "客户使用路径", en: "Customer usage path" },
  nextEntry: { zh: "下一步入口", en: "Next entry" },
  formalityNote: { zh: "正式性提示", en: "Formality note" },
  guidanceAria: { zh: "客户主视觉解释卡片", en: "Customer main visual explanation cards" },
  currentStatus: { zh: "当前状态", en: "Current status" },
  why: { zh: "为什么", en: "Why" },
  nextStep: { zh: "下一步", en: "Next step" },
  valueDetails: { zh: "查看价值记录明细", en: "View value record details" },
};

function UsageAction({ action }: { action: { label: string; href: string } }): React.ReactElement {
  if (action.href.startsWith("#")) return <a className="customerButton" href={action.href}>{action.label}</a>;
  return <Link className="customerButton" to={action.href}>{action.label}</Link>;
}

export default function CustomerDashboardPage(): React.ReactElement {
  const { locale } = useLocale();
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
        setError(localizedText(COPY.unavailable, locale));
      });
  }, [locale]);

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
  const pendingAcceptanceKpi = vm?.kpis.find((item) => item.key === "PENDING_ACCEPTANCE");
  const recentOperationsKpi = vm?.kpis.find((item) => item.key === "RECENT_OPERATIONS");
  const summaryScopeText = vm?.summaryScopeText ?? localizedText(COPY.scopeFallback, locale);
  const deviceFallback = {
    empty: true,
    scopeText: localizedText(COPY.deviceScope, locale),
    globalText: localizedText(COPY.deviceGlobal, locale),
    authorizedText: localizedText(COPY.deviceAuthorized, locale),
    fieldText: localizedText(COPY.deviceField, locale),
    offlineText: localizedText(COPY.deviceOffline, locale),
    alertText: localizedText(COPY.deviceAlert, locale),
    whyText: localizedText(COPY.deviceWhy, locale),
    nextStepText: localizedText(COPY.deviceNext, locale),
    formalityText: localizedText(COPY.deviceFormality, locale),
  };
  const acceptanceSummaryVm = {
    title: localizedText(COPY.acceptanceTitle, locale),
    subtitle: summaryScopeText,
    metrics: [
      { key: "pending", label: localizedText(COPY.pendingAcceptance, locale), value: String(pendingAcceptanceKpi?.value ?? "0"), helperText: localizedText(COPY.pendingHelper, locale) },
      { key: "recent", label: localizedText(COPY.operationRecords, locale), value: String(recentOperationsKpi?.value ?? "0"), helperText: localizedText(COPY.operationHelper, locale) },
    ],
    emptyState: emptyStates.NO_PENDING_ACTIONS,
  };
  const embeddedRoi = (aggregate as any)?.roi_ledger ?? (aggregate as any)?.roi ?? (aggregate as any)?.value_summary;

  return (
    <div className="customerDashboardPage">
      {vm ? (
        <section className="customerCard customerUsagePathCard" aria-label={localizedText(COPY.usagePathAria, locale)}>
          <div>
            <div className="customerEyebrow">{vm.usagePath.title}</div>
            <h2 className="customerCardTitle">{vm.usagePath.statusText}</h2>
            <p className="customerMetricLabel customerSpacingTopXs">{summaryScopeText}</p>
          </div>
          <div className="customerUsagePathGrid">
            <div>
              <strong>{vm.usagePath.orderTitle}</strong>
              <ol>{vm.usagePath.steps.map((step) => <li key={step}>{step}</li>)}</ol>
            </div>
            <div>
              <strong>{localizedText(COPY.nextEntry, locale)}：</strong>
              <div className="customerUsageActions">{vm.usagePath.actions.map((action) => <UsageAction key={action.label} action={action} />)}</div>
              <p className="customerMetricLabel customerSpacingTopXs">{localizedText(COPY.formalityNote, locale)}：{vm.usagePath.formalityNote}</p>
            </div>
          </div>
        </section>
      ) : null}

      {vm ? <p className="customerMetricLabel customerDashboardScopeText customerSpacingBottomSm">{summaryScopeText}</p> : null}
      <CockpitKpiStrip items={kpis} emptyState={emptyStates.NO_KPI_SUMMARY} />

      <section className="customerDashboardGuidanceGrid" aria-label={localizedText(COPY.guidanceAria, locale)}>
        {(vm?.guidanceCards ?? []).map((card) => (
          <article key={card.id} className="customerCard customerGuidanceCard">
            <h3 className="customerCardTitle">{card.title}</h3>
            <dl>
              <div><dt>{localizedText(COPY.currentStatus, locale)}</dt><dd>{card.currentStatus}</dd></div>
              <div><dt>{localizedText(COPY.why, locale)}</dt><dd>{card.why}</dd></div>
              <div><dt>{localizedText(COPY.nextStep, locale)}</dt><dd>{card.nextStep}</dd></div>
              <div><dt>{localizedText(COPY.formalityNote, locale)}</dt><dd>{card.formality}</dd></div>
            </dl>
            <UsageAction action={card.action} />
          </article>
        ))}
      </section>

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
            <button type="button" className="customerButton customerSpacingTopXs" onClick={() => setRoiDrawerOpen(true)}>{localizedText(COPY.valueDetails, locale)}</button>
          </div>
        ) : null}
        <RecentOperationsSection items={vm?.recentOperations ?? []} emptyState={emptyStates.NO_RECENT_OPERATIONS} />
      </section>

      {!vm && error ? <div className="muted customerSpacingTopMd">{error}</div> : null}
      <RoiLedgerDrawer open={roiDrawerOpen} embeddedRoi={embeddedRoi} onClose={() => setRoiDrawerOpen(false)} />
    </div>
  );
}
