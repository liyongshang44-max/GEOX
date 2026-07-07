// apps/web/src/features/customer/pages/CustomerReportsCenterPage.tsx
import React from "react";
import { Link } from "react-router-dom";
import { fetchCustomerReportsCenter } from "../../../api/customerReportsCenter";
import { ProductBoundaryBanner, ProductEmptyState, ProductErrorState, ProductLoadingState, ProductPageHeader, ProductPageShell, ProductScopeBar, ProductSectionCard, ProductStatusBadge } from "../../../design-system/product";
import { localizedText, useLocale, type LocaleCode, type LocalizedCopy } from "../../../lib/locale";
import { CUSTOMER_COMMON_COPY, CUSTOMER_REPORTS_COPY, customerProductFallback, customerStatusLabel } from "../../../lib/productCopy/customerLocale";
import { buildCustomerReportsCenterVm, type CustomerReportGroupKey, type CustomerReportsCenterVm } from "../../../viewmodels/customerReportsCenterVm";

function groupCopy(key: CustomerReportGroupKey) {
  return CUSTOMER_REPORTS_COPY.groups[key];
}

function itemTitle(value: string, key: CustomerReportGroupKey, locale: LocaleCode): string {
  if (key === "FIELD" || key === "OPERATION") {
    const name = value.split(" · ")[0]?.trim();
    return name ? `${name} · ${localizedText(groupCopy(key).title, locale)}` : localizedText(groupCopy(key).title, locale);
  }
  return localizedText(groupCopy(key).title, locale);
}

export default function CustomerReportsCenterPage(): React.ReactElement {
  const { locale } = useLocale();
  const t = React.useCallback((copy: LocalizedCopy) => localizedText(copy, locale), [locale]);
  const [vm, setVm] = React.useState<CustomerReportsCenterVm | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    void fetchCustomerReportsCenter()
      .then((data) => { if (active) { setVm(buildCustomerReportsCenterVm(data)); setFailed(false); } })
      .catch(() => { if (active) { setVm(null); setFailed(true); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  if (loading) return <ProductPageShell surface="customer" ariaLabel={t(CUSTOMER_REPORTS_COPY.title)}><ProductLoadingState surface="customer" label={t(CUSTOMER_REPORTS_COPY.loading)} description={t(CUSTOMER_COMMON_COPY.safeLoading)} /></ProductPageShell>;
  if (failed || !vm) return <ProductPageShell surface="customer" ariaLabel={t(CUSTOMER_REPORTS_COPY.unavailable)}><ProductErrorState surface="customer" title={t(CUSTOMER_REPORTS_COPY.unavailable)} message={t(CUSTOMER_COMMON_COPY.safeError)} /></ProductPageShell>;

  return (
    <ProductPageShell surface="customer" ariaLabel={t(CUSTOMER_REPORTS_COPY.title)} top={<ProductPageHeader eyebrow={t(CUSTOMER_REPORTS_COPY.eyebrow)} title={t(CUSTOMER_REPORTS_COPY.title)} lead={t(CUSTOMER_REPORTS_COPY.lead)} metadata={`${t(CUSTOMER_COMMON_COPY.updatedAtPrefix)}: ${vm.generatedAtText}`} primaryAction={<Link className="customerButton customerButtonPrimary" to="/customer/export">{t(CUSTOMER_REPORTS_COPY.export)}</Link>} secondaryActions={<Link className="customerButton" to="/customer/dashboard">{t(CUSTOMER_COMMON_COPY.backOverview)}</Link>} nonclaim={t(CUSTOMER_REPORTS_COPY.nonclaim)} />}>
      <ProductBoundaryBanner tone="readOnly" title={t(CUSTOMER_REPORTS_COPY.boundaryTitle)} description={t(CUSTOMER_REPORTS_COPY.boundaryLead)} />
      <ProductScopeBar surface="customer" items={[{ label: t(CUSTOMER_COMMON_COPY.scope), value: customerProductFallback(vm.scopeBadgeText, locale, CUSTOMER_REPORTS_COPY.lead) }, { label: t(CUSTOMER_COMMON_COPY.trust), value: customerStatusLabel(vm.trustText, locale) }, { label: t(CUSTOMER_COMMON_COPY.updated), value: vm.generatedAtText }]} />
      <section className="customerReportsCenterGrid" aria-label={t(CUSTOMER_REPORTS_COPY.categoriesAria)}>
        {vm.groups.map((group) => {
          const copy = groupCopy(group.key);
          return (
            <ProductSectionCard key={group.key} title={t(copy.title)} subtitle={t(copy.description)}>
              {group.items.length ? <div className="customerReportEntryList">{group.items.map((item, index) => (
                <Link key={`${group.key}-${item.href || index}`} className="customerReportEntry" to={item.href || "/customer/reports"} aria-disabled={item.disabled}>
                  <div><strong>{itemTitle(item.title, group.key, locale)}</strong><p>{t(copy.description)}</p><small>{t(copy.description)}</small><small>{t(CUSTOMER_COMMON_COPY.updated)}: {item.updatedAtText}</small></div>
                  <ProductStatusBadge status={item.disabled ? "unavailable" : "readOnly"} label={customerStatusLabel(item.statusText, locale)} />
                </Link>
              ))}</div> : <ProductEmptyState surface="customer" title={t(CUSTOMER_REPORTS_COPY.noEntry)} description={t(CUSTOMER_REPORTS_COPY.noEntryLead)} />}
            </ProductSectionCard>
          );
        })}
      </section>
    </ProductPageShell>
  );
}
