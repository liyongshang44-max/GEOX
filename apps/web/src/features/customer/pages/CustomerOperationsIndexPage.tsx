// apps/web/src/features/customer/pages/CustomerOperationsIndexPage.tsx
import React from "react";
import { Link } from "react-router-dom";
import { fetchCustomerOperations } from "../../../api/customerOperations";
import { ProductBoundaryBanner, ProductDataTable, ProductEmptyState, ProductErrorState, ProductLoadingState, ProductPageHeader, ProductPageShell, ProductScopeBar, ProductSectionCard, ProductStateBlock, ProductStatusBadge } from "../../../design-system/product";
import { localizedText, useLocale, type LocalizedCopy } from "../../../lib/locale";
import { CUSTOMER_COMMON_COPY, CUSTOMER_OPERATIONS_COPY, customerFilterLabel, customerProductFallback, customerStatusLabel } from "../../../lib/productCopy/customerLocale";
import { buildCustomerOperationsIndexVm, filterCustomerOperations, type CustomerOperationStatusFilter, type CustomerOperationsIndexRowVm, type CustomerOperationsIndexVm } from "../../../viewmodels/customerOperationsIndexVm";

const COPY = {
  empty: { zh: "暂无作业报告条目", en: "No Operation Report Entries" },
  emptyLead: { zh: "当前授权范围内没有可显示的作业报告。", en: "No operation report is available in the authorized scope." },
  summary: { zh: "暂无摘要。", en: "No summary available." },
  evidence: { zh: "暂无证据摘要。", en: "No evidence summary available." },
} as const satisfies Record<string, LocalizedCopy>;

function rowStatus(row: CustomerOperationsIndexRowVm): "available" | "partial" | "degraded" | "blocked" {
  if (row.statusFilter === "ACCEPTANCE_PASS") return "available";
  if (row.statusFilter === "EVIDENCE_INSUFFICIENT" || row.statusFilter === "ACCEPTANCE_FAIL") return "blocked";
  if (row.statusFilter === "WAIT_ACCEPTANCE") return "degraded";
  return "partial";
}

export default function CustomerOperationsIndexPage(): React.ReactElement {
  const { locale } = useLocale();
  const t = React.useCallback((copy: LocalizedCopy) => localizedText(copy, locale), [locale]);
  const [vm, setVm] = React.useState<CustomerOperationsIndexVm | null>(null);
  const [selected, setSelected] = React.useState<CustomerOperationStatusFilter>("ALL");
  const [loading, setLoading] = React.useState(true);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    void fetchCustomerOperations()
      .then((data) => { if (active) { setVm(buildCustomerOperationsIndexVm(data)); setFailed(false); } })
      .catch(() => { if (active) { setVm(null); setFailed(true); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  if (loading) return <ProductPageShell surface="customer" ariaLabel={t(CUSTOMER_OPERATIONS_COPY.title)}><ProductLoadingState surface="customer" label={t(CUSTOMER_OPERATIONS_COPY.loading)} description={t(CUSTOMER_COMMON_COPY.safeLoading)} /></ProductPageShell>;
  if (failed || !vm) return <ProductPageShell surface="customer" ariaLabel={t(CUSTOMER_OPERATIONS_COPY.unavailable)}><ProductErrorState surface="customer" title={t(CUSTOMER_OPERATIONS_COPY.unavailable)} message={t(CUSTOMER_COMMON_COPY.safeError)} /></ProductPageShell>;

  const rows = filterCustomerOperations(vm.rows, selected);
  return (
    <ProductPageShell surface="customer" ariaLabel={t(CUSTOMER_OPERATIONS_COPY.title)} top={<ProductPageHeader eyebrow={t(CUSTOMER_OPERATIONS_COPY.eyebrow)} title={t(CUSTOMER_OPERATIONS_COPY.title)} lead={t(CUSTOMER_OPERATIONS_COPY.lead)} metadata={`${t(CUSTOMER_COMMON_COPY.updatedAtPrefix)}: ${vm.generatedAtText}`} primaryAction={<Link className="customerButton" to="/customer/dashboard">{t(CUSTOMER_COMMON_COPY.backOverview)}</Link>} nonclaim={t(CUSTOMER_OPERATIONS_COPY.nonclaim)} />}>
      <ProductBoundaryBanner tone="readOnly" title={t(CUSTOMER_OPERATIONS_COPY.boundaryTitle)} description={t(CUSTOMER_OPERATIONS_COPY.boundaryLead)} />
      <ProductScopeBar surface="customer" items={[{ label: t(CUSTOMER_COMMON_COPY.scope), value: customerProductFallback(vm.scopeBadgeText, locale, CUSTOMER_OPERATIONS_COPY.lead) }, { label: t(CUSTOMER_COMMON_COPY.updated), value: vm.generatedAtText }]} />
      {vm.dataScopeNote ? <ProductStateBlock kind="permissionLimited" surface="customer" title={t(CUSTOMER_OPERATIONS_COPY.scopeNote)} description={customerProductFallback(vm.dataScopeNote, locale, CUSTOMER_OPERATIONS_COPY.lead)} /> : null}
      <ProductSectionCard title={t(CUSTOMER_OPERATIONS_COPY.entries)} subtitle={t(CUSTOMER_OPERATIONS_COPY.entriesLead)}>
        <div className="customerFilterRow" role="tablist" aria-label={t(CUSTOMER_OPERATIONS_COPY.filterAria)}>{vm.filters.map((filter) => <button key={filter.key} type="button" className={`customerFilterButton ${selected === filter.key ? "isActive" : ""}`} aria-pressed={selected === filter.key} onClick={() => setSelected(filter.key)}>{customerFilterLabel(filter.key, locale)} <span>{filter.count}</span></button>)}</div>
        <ProductDataTable<CustomerOperationsIndexRowVm>
          caption={t(CUSTOMER_OPERATIONS_COPY.caption)}
          rows={rows}
          getRowKey={(row) => row.operationId}
          emptyState={<ProductEmptyState surface="customer" title={t(COPY.empty)} description={t(COPY.emptyLead)} />}
          mobileFallbackNote={t(CUSTOMER_OPERATIONS_COPY.mobileNote)}
          columns={[
            { key: "operation", header: t(CUSTOMER_OPERATIONS_COPY.operation), render: (row) => <Link to={row.href}><span data-locale-neutral="true">{row.primaryLine}</span></Link> },
            { key: "status", header: t(CUSTOMER_COMMON_COPY.reportStatus), render: (row) => <ProductStatusBadge status={rowStatus(row)} label={customerStatusLabel(row.statusFilter || row.finalStatusText, locale)} /> },
            { key: "summary", header: t(CUSTOMER_COMMON_COPY.summary), render: (row) => customerProductFallback(row.summaryText, locale, COPY.summary) },
            { key: "evidence", header: t(CUSTOMER_OPERATIONS_COPY.evidenceSummary), render: (row) => customerProductFallback(row.evidenceExplanation || row.evidenceText, locale, COPY.evidence) },
            { key: "completed", header: t(CUSTOMER_OPERATIONS_COPY.completed), render: (row) => <span data-locale-neutral="true">{row.completedAtText}</span> },
          ]}
        />
      </ProductSectionCard>
    </ProductPageShell>
  );
}
