// apps/web/src/features/customer/pages/CustomerDashboardPage.tsx
import React from "react";
import { Link } from "react-router-dom";
import { fetchCustomerDashboardAggregate } from "../../../api/customerReports";
import { ProductBoundaryBanner, ProductEmptyState, ProductErrorState, ProductLoadingState, ProductMetricTile, ProductPageHeader, ProductPageShell, ProductScopeBar, ProductSectionCard, ProductStateBlock, ProductStatusBadge } from "../../../design-system/product";
import { localizedText, useLocale, type LocaleCode, type LocalizedCopy } from "../../../lib/locale";
import { CUSTOMER_COMMON_COPY, CUSTOMER_DASHBOARD_COPY, CUSTOMER_STATUS_COPY, customerProductFallback, customerStatusLabel } from "../../../lib/productCopy/customerLocale";
import { buildCustomerDashboardVm, type CustomerDashboardPageVm, type CustomerKpiVm } from "../../../viewmodels/customerDashboardVm";

const KPI_COPY: Record<CustomerKpiVm["key"], LocalizedCopy> = {
  OPEN_ACTIONS: { zh: "待处理事项", en: "Open Items" },
  RISK_FIELDS: { zh: "风险地块", en: "Fields Requiring Attention" },
  PENDING_ACCEPTANCE: { zh: "待验收作业", en: "Operations Awaiting Acceptance" },
  OFFLINE_DEVICES: { zh: "离线设备", en: "Offline Devices" },
  RECENT_OPERATIONS: { zh: "作业记录", en: "Operation Records" },
  VALUE_RECORDS: { zh: "价值记录", en: "Value Records" },
};

function status(tone?: string): "available" | "partial" | "degraded" | "blocked" {
  if (tone === "danger") return "blocked";
  if (tone === "warning") return "degraded";
  if (tone === "good") return "available";
  return "partial";
}

function unit(value: string | undefined, locale: LocaleCode): string | undefined {
  if (locale !== "en-US") return value;
  return value === "条" ? "items" : value === "块" ? "fields" : value === "台" ? "devices" : value;
}

export default function CustomerDashboardPage(): React.ReactElement {
  const { locale } = useLocale();
  const t = React.useCallback((copy: LocalizedCopy) => localizedText(copy, locale), [locale]);
  const [vm, setVm] = React.useState<CustomerDashboardPageVm | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    setLoading(true);
    void fetchCustomerDashboardAggregate()
      .then((data) => { if (active) { setVm(buildCustomerDashboardVm(data)); setFailed(false); } })
      .catch(() => { if (active) { setVm(null); setFailed(true); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  if (loading) return <ProductPageShell surface="customer" ariaLabel={t(CUSTOMER_DASHBOARD_COPY.title)}><ProductLoadingState surface="customer" label={t(CUSTOMER_DASHBOARD_COPY.title)} description={t(CUSTOMER_COMMON_COPY.safeLoading)} /></ProductPageShell>;
  if (failed || !vm) return <ProductPageShell surface="customer" ariaLabel={t(CUSTOMER_DASHBOARD_COPY.unavailableTitle)}><ProductErrorState surface="customer" title={t(CUSTOMER_DASHBOARD_COPY.unavailableTitle)} message={t(CUSTOMER_COMMON_COPY.safeError)} /></ProductPageShell>;

  const scope = customerProductFallback(vm.summaryScopeText, locale, CUSTOMER_DASHBOARD_COPY.lead);
  const statusCopy = (tone?: string) => tone === "good" ? t(CUSTOMER_STATUS_COPY.available) : tone === "warning" ? t(CUSTOMER_STATUS_COPY.review) : tone === "danger" ? t(CUSTOMER_STATUS_COPY.blocked) : t(CUSTOMER_STATUS_COPY.reportOnly);

  return (
    <ProductPageShell surface="customer" ariaLabel={t(CUSTOMER_DASHBOARD_COPY.title)} top={(
      <ProductPageHeader
        eyebrow={t(CUSTOMER_DASHBOARD_COPY.eyebrow)}
        title={t(CUSTOMER_DASHBOARD_COPY.title)}
        lead={t(CUSTOMER_DASHBOARD_COPY.lead)}
        metadata={`${t(CUSTOMER_COMMON_COPY.updatedAtPrefix)}: ${vm.generatedAtText}`}
        primaryAction={<Link className="customerButton customerButtonPrimary" to="/customer/export">{t(CUSTOMER_DASHBOARD_COPY.exportReport)}</Link>}
        secondaryActions={<Link className="customerButton" to="/customer/reports">{t(CUSTOMER_DASHBOARD_COPY.openReports)}</Link>}
        nonclaim={t(CUSTOMER_DASHBOARD_COPY.nonclaim)}
      />
    )} aside={(
      <div className="customerDashboardRightRail" aria-label={t(CUSTOMER_DASHBOARD_COPY.railAria)}>
        <ProductSectionCard title={t(CUSTOMER_DASHBOARD_COPY.reportEntries)} subtitle={t(CUSTOMER_DASHBOARD_COPY.reportEntriesLead)}>
          <div className="customerUsageActions">
            <Link className="customerButton" to="/customer/fields">{t(CUSTOMER_DASHBOARD_COPY.fieldReports)}</Link>
            <Link className="customerButton" to="/customer/operations">{t(CUSTOMER_DASHBOARD_COPY.operationReports)}</Link>
            <Link className="customerButton" to="/customer/reports">{t(CUSTOMER_DASHBOARD_COPY.reportsCenter)}</Link>
          </div>
        </ProductSectionCard>
        <ProductSectionCard title={t(CUSTOMER_DASHBOARD_COPY.authorizedScope)} subtitle={scope}><ProductStatusBadge status="readOnly" label={t(CUSTOMER_COMMON_COPY.authorizedOnly)} /></ProductSectionCard>
        <ProductSectionCard title={t(CUSTOMER_DASHBOARD_COPY.exportDelivery)} subtitle={t(CUSTOMER_DASHBOARD_COPY.exportDeliveryLead)}><Link className="customerButton customerButtonPrimary" to="/customer/export">{t(CUSTOMER_DASHBOARD_COPY.exportDashboard)}</Link></ProductSectionCard>
      </div>
    )}>
      <ProductBoundaryBanner tone="readOnly" title={t(CUSTOMER_DASHBOARD_COPY.boundaryTitle)} description={t(CUSTOMER_DASHBOARD_COPY.boundaryLead)} items={[t(CUSTOMER_DASHBOARD_COPY.boundaryItems.language), t(CUSTOMER_DASHBOARD_COPY.boundaryItems.scope), t(CUSTOMER_DASHBOARD_COPY.boundaryItems.export)]} />
      <ProductScopeBar surface="customer" items={[{ label: t(CUSTOMER_COMMON_COPY.scope), value: scope }, { label: t(CUSTOMER_COMMON_COPY.updated), value: vm.generatedAtText }]} />

      <ProductSectionCard title={t(CUSTOMER_COMMON_COPY.summary)} subtitle={t(CUSTOMER_DASHBOARD_COPY.summaryLead)}>
        <div className="customerDashboardGuidanceGrid">
          {vm.kpis.slice(0, 5).map((item) => <ProductMetricTile key={item.key} label={t(KPI_COPY[item.key])} value={item.value} unit={unit(item.unit, locale)} description={t(KPI_COPY[item.key])} status={<ProductStatusBadge status={status(item.tone)} label={statusCopy(item.tone)} />} source={t(CUSTOMER_DASHBOARD_COPY.title)} />)}
        </div>
      </ProductSectionCard>

      <section className="customerDashboardMainGrid" aria-label={t(CUSTOMER_DASHBOARD_COPY.reportEntries)}>
        <ProductSectionCard title={t(CUSTOMER_DASHBOARD_COPY.fieldEntries)} subtitle={t(CUSTOMER_DASHBOARD_COPY.fieldEntriesLead)}>
          {vm.topRiskFields.length ? <div className="customerIndexList">{vm.topRiskFields.map((field) => (
            <Link key={field.fieldId} className="customerIndexRow" to={field.href}>
              <div><strong>{field.fieldName}</strong><small>{customerProductFallback(field.secondaryText, locale, CUSTOMER_DASHBOARD_COPY.fieldEntriesLead)}</small><small>{customerProductFallback(field.boundaryText, locale, CUSTOMER_COMMON_COPY.authorizedOnly)}</small></div>
              <ProductStatusBadge status={status(field.riskTone)} label={statusCopy(field.riskTone)} />
            </Link>
          ))}</div> : <ProductEmptyState surface="customer" title={t(CUSTOMER_DASHBOARD_COPY.noFieldEntries)} description={t(CUSTOMER_DASHBOARD_COPY.noFieldEntriesLead)} />}
        </ProductSectionCard>

        <ProductSectionCard title={t(CUSTOMER_DASHBOARD_COPY.operationEntries)} subtitle={t(CUSTOMER_DASHBOARD_COPY.operationEntriesLead)}>
          {vm.recentOperations.length ? <div className="customerIndexList">{vm.recentOperations.slice(0, 5).map((operation) => (
            <Link key={operation.operationId} className="customerIndexRow" to={operation.href}>
              <div><strong>{operation.operationName}</strong><small>{operation.fieldName}</small><small>{customerProductFallback(operation.evidenceText, locale, CUSTOMER_DASHBOARD_COPY.operationEntriesLead)}</small></div>
              <ProductStatusBadge status="readOnly" label={customerStatusLabel(operation.stateText, locale)} />
            </Link>
          ))}</div> : <ProductEmptyState surface="customer" title={t(CUSTOMER_DASHBOARD_COPY.noOperationEntries)} description={t(CUSTOMER_DASHBOARD_COPY.noOperationEntriesLead)} />}
        </ProductSectionCard>
      </section>

      <ProductSectionCard title={t(CUSTOMER_DASHBOARD_COPY.reportEntries)} subtitle={t(CUSTOMER_DASHBOARD_COPY.reportEntriesLead)}>
        <div className="customerUsageActions"><Link className="customerButton" to="/customer/fields">{t(CUSTOMER_DASHBOARD_COPY.fieldReports)}</Link><Link className="customerButton" to="/customer/operations">{t(CUSTOMER_DASHBOARD_COPY.operationReports)}</Link><Link className="customerButton" to="/customer/reports">{t(CUSTOMER_DASHBOARD_COPY.reportsCenter)}</Link><Link className="customerButton customerButtonPrimary" to="/customer/export">{t(CUSTOMER_DASHBOARD_COPY.exportDashboard)}</Link></div>
      </ProductSectionCard>

      {vm.kpis.length === 0 ? <ProductStateBlock kind="unavailable" surface="customer" title={t(CUSTOMER_DASHBOARD_COPY.summaryUnavailable)} description={t(CUSTOMER_DASHBOARD_COPY.summaryUnavailableLead)} /> : null}
    </ProductPageShell>
  );
}
