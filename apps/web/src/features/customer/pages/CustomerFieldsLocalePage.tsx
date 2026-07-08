// apps/web/src/features/customer/pages/CustomerFieldsLocalePage.tsx
import React from "react";
import { Link } from "react-router-dom";
import { fetchCustomerFields } from "../../../api/customerFields";
import { ProductBoundaryBanner, ProductDataTable, ProductEmptyState, ProductErrorState, ProductLoadingState, ProductPageHeader, ProductPageShell, ProductScopeBar, ProductSectionCard, ProductStateBlock, ProductStatusBadge } from "../../../design-system/product";
import { localizedText, useLocale, type LocalizedCopy } from "../../../lib/locale";
import { CUSTOMER_COMMON_COPY, CUSTOMER_FIELDS_COPY, customerFilterLabel, customerProductFallback, customerStatusLabel } from "../../../lib/productCopy/customerLocale";
import { buildCustomerFieldsIndexVm, filterCustomerFields, type CustomerFieldRiskFilter, type CustomerFieldsIndexCardVm, type CustomerFieldsIndexVm } from "../../../viewmodels/customerFieldsIndexVm";

const COPY = {
  summary: { zh: "暂无报告摘要。", en: "No report summary available." },
  crop: { zh: "作物阶段暂无记录", en: "Crop stage unavailable" },
  operation: { zh: "暂无近期作业", en: "No recent operation" },
  empty: { zh: "暂无地块报告条目", en: "No Field Report Entries" },
  emptyLead: { zh: "当前授权范围内没有可显示的地块报告。", en: "No field report is available in the authorized scope." },
} as const satisfies Record<string, LocalizedCopy>;

function fieldStatus(row: CustomerFieldsIndexCardVm): "available" | "degraded" | "blocked" | "partial" {
  return row.riskTone === "danger" ? "blocked" : row.riskTone === "warning" ? "degraded" : row.riskTone === "neutral" ? "partial" : "available";
}

export default function CustomerFieldsLocalePage(): React.ReactElement {
  const { locale } = useLocale();
  const t = React.useCallback((copy: LocalizedCopy) => localizedText(copy, locale), [locale]);
  const [vm, setVm] = React.useState<CustomerFieldsIndexVm | null>(null);
  const [selected, setSelected] = React.useState<CustomerFieldRiskFilter>("ALL");
  const [loading, setLoading] = React.useState(true);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    void fetchCustomerFields()
      .then((data) => { if (active) { setVm(buildCustomerFieldsIndexVm(data)); setFailed(false); } })
      .catch(() => { if (active) { setVm(null); setFailed(true); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  if (loading) return <ProductPageShell surface="customer" ariaLabel={t(CUSTOMER_FIELDS_COPY.title)}><ProductLoadingState surface="customer" label={t(CUSTOMER_FIELDS_COPY.loading)} description={t(CUSTOMER_COMMON_COPY.safeLoading)} /></ProductPageShell>;
  if (failed || !vm) return <ProductPageShell surface="customer" ariaLabel={t(CUSTOMER_FIELDS_COPY.unavailable)}><ProductErrorState surface="customer" title={t(CUSTOMER_FIELDS_COPY.unavailable)} message={t(CUSTOMER_COMMON_COPY.safeError)} /></ProductPageShell>;

  const rows = filterCustomerFields(vm.cards, selected);
  return (
    <ProductPageShell surface="customer" ariaLabel={t(CUSTOMER_FIELDS_COPY.title)} top={<ProductPageHeader eyebrow={t(CUSTOMER_FIELDS_COPY.eyebrow)} title={t(CUSTOMER_FIELDS_COPY.title)} lead={t(CUSTOMER_FIELDS_COPY.lead)} metadata={`${t(CUSTOMER_COMMON_COPY.updatedAtPrefix)}: ${vm.generatedAtText}`} primaryAction={<Link className="customerButton" to="/customer/dashboard">{t(CUSTOMER_COMMON_COPY.backOverview)}</Link>} nonclaim={t(CUSTOMER_FIELDS_COPY.nonclaim)} />}>
      <ProductBoundaryBanner tone="readOnly" title={t(CUSTOMER_FIELDS_COPY.boundaryTitle)} description={t(CUSTOMER_FIELDS_COPY.boundaryLead)} />
      <ProductScopeBar surface="customer" items={[{ label: t(CUSTOMER_COMMON_COPY.scope), value: customerProductFallback(vm.scopeBadgeText, locale, CUSTOMER_FIELDS_COPY.lead) }, { label: t(CUSTOMER_COMMON_COPY.updated), value: vm.generatedAtText }]} />
      {vm.dataScopeNote ? <ProductStateBlock kind="permissionLimited" surface="customer" title={t(CUSTOMER_FIELDS_COPY.scopeNote)} description={customerProductFallback(vm.dataScopeNote, locale, CUSTOMER_FIELDS_COPY.lead)} /> : null}
      <ProductSectionCard title={t(CUSTOMER_FIELDS_COPY.entries)} subtitle={t(CUSTOMER_FIELDS_COPY.entriesLead)}>
        <div className="customerFilterRow" role="tablist" aria-label={t(CUSTOMER_FIELDS_COPY.filterAria)}>{vm.filters.map((filter) => <button key={filter.key} type="button" className={`customerFilterButton ${selected === filter.key ? "isActive" : ""}`} aria-pressed={selected === filter.key} onClick={() => setSelected(filter.key)}>{customerFilterLabel(filter.key, locale)} <span>{filter.count}</span></button>)}</div>
        <ProductDataTable<CustomerFieldsIndexCardVm>
          caption={t(CUSTOMER_FIELDS_COPY.caption)}
          rows={rows}
          getRowKey={(row) => row.fieldId}
          emptyState={<ProductEmptyState surface="customer" title={t(COPY.empty)} description={t(COPY.emptyLead)} />}
          mobileFallbackNote={t(CUSTOMER_FIELDS_COPY.mobileNote)}
          columns={[
            { key: "field", header: t(CUSTOMER_FIELDS_COPY.field), render: (row) => <Link to={row.href}>{row.fieldName}</Link> },
            { key: "status", header: t(CUSTOMER_COMMON_COPY.reportStatus), render: (row) => <ProductStatusBadge status={fieldStatus(row)} label={customerStatusLabel(row.riskLabel, locale)} /> },
            { key: "summary", header: t(CUSTOMER_COMMON_COPY.summary), render: (row) => customerProductFallback(row.summaryText || row.reasons.join("; "), locale, COPY.summary) },
            { key: "crop", header: t(CUSTOMER_FIELDS_COPY.cropStage), render: (row) => customerProductFallback(row.cropStageText, locale, COPY.crop) },
            { key: "operation", header: t(CUSTOMER_FIELDS_COPY.recentOperation), render: (row) => customerProductFallback(row.recentOperationText, locale, COPY.operation) },
            { key: "updated", header: t(CUSTOMER_COMMON_COPY.updated), render: (row) => row.updatedAtText },
          ]}
        />
      </ProductSectionCard>
    </ProductPageShell>
  );
}
