// apps/web/src/views/CustomerFieldsIndexPage.tsx
import React from "react";
import { Link } from "react-router-dom";
import { fetchCustomerFields } from "../api/customerFields";
import {
  ProductBoundaryBanner,
  ProductDataTable,
  ProductEmptyState,
  ProductErrorState,
  ProductLoadingState,
  ProductPageHeader,
  ProductPageShell,
  ProductScopeBar,
  ProductSectionCard,
  ProductStateBlock,
  ProductStatusBadge,
} from "../design-system/product";
import { buildCustomerFieldsIndexVm, filterCustomerFields, type CustomerFieldRiskFilter, type CustomerFieldsIndexCardVm, type CustomerFieldsIndexVm } from "../viewmodels/customerFieldsIndexVm";

function statusForField(field: CustomerFieldsIndexCardVm): "available" | "degraded" | "blocked" | "partial" {
  if (field.riskTone === "danger") return "blocked";
  if (field.riskTone === "warning") return "degraded";
  if (field.riskTone === "neutral") return "partial";
  return "available";
}

export default function CustomerFieldsIndexPage(): React.ReactElement {
  const [vm, setVm] = React.useState<CustomerFieldsIndexVm | null>(null);
  const [selected, setSelected] = React.useState<CustomerFieldRiskFilter>("ALL");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    void fetchCustomerFields()
      .then((response) => {
        if (!alive) return;
        setVm(buildCustomerFieldsIndexVm(response));
        setError("");
      })
      .catch(() => {
        if (!alive) return;
        setVm(null);
        setError("Customer field reports are unavailable.");
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => { alive = false; };
  }, []);

  if (loading) {
    return <ProductPageShell surface="customer"><ProductLoadingState label="Loading field reports" description="Preparing authorized field report entries." /></ProductPageShell>;
  }

  if (error || !vm) {
    return <ProductPageShell surface="customer"><ProductErrorState title="Field reports unavailable" message={error || "No authorized field report data is available."} /></ProductPageShell>;
  }

  const rows = filterCustomerFields(vm.cards, selected);

  return (
    <ProductPageShell
      surface="customer"
      ariaLabel="Customer field reports"
      top={
        <ProductPageHeader
          eyebrow="Customer Portal / Field reports"
          title="Field reports"
          lead={vm.subtitle}
          metadata={`Updated at: ${vm.generatedAtText}`}
          primaryAction={<Link className="customerButton" to="/customer/dashboard">Back to overview</Link>}
          nonclaim="Field reports are customer read-only reporting surfaces, not field management tools."
        />
      }
    >
      <ProductBoundaryBanner tone="readOnly" title="Authorized field reports" description="This page lists customer-visible field reports and does not provide create, edit, or command controls." />

      <ProductScopeBar surface="customer" items={[{ label: "Scope", value: vm.scopeBadgeText }, { label: "Updated", value: vm.generatedAtText }]} />

      {vm.dataScopeNote ? <ProductStateBlock kind="permissionLimited" title="Scope note" description={vm.dataScopeNote} /> : null}

      <ProductSectionCard title="Field report entries" subtitle="Open a field to review its customer-safe report.">
        <div className="customerFilterRow" role="tablist" aria-label="Field report status filter">
          {vm.filters.map((filter) => (
            <button key={filter.key} type="button" className={`customerFilterButton ${selected === filter.key ? "isActive" : ""}`} onClick={() => setSelected(filter.key)}>
              {filter.label} <span>{filter.count}</span>
            </button>
          ))}
        </div>

        <ProductDataTable<CustomerFieldsIndexCardVm>
          caption="Customer field report entries"
          rows={rows}
          getRowKey={(row) => row.fieldId}
          emptyState={<ProductEmptyState title={vm.emptyState.title} description={vm.emptyState.description} />}
          mobileFallbackNote="On narrow screens, scroll the table horizontally or open each field report directly."
          columns={[
            { key: "field", header: "Field", render: (row) => <Link to={row.href}>{row.fieldName}</Link> },
            { key: "status", header: "Report status", render: (row) => <ProductStatusBadge status={statusForField(row)} label={row.riskLabel} /> },
            { key: "summary", header: "Summary", render: (row) => row.summaryText || row.reasons.join("; ") || "No report summary available." },
            { key: "crop", header: "Crop stage", render: (row) => row.cropStageText },
            { key: "operation", header: "Recent operation", render: (row) => row.recentOperationText },
            { key: "updated", header: "Updated", render: (row) => row.updatedAtText },
          ]}
        />
      </ProductSectionCard>
    </ProductPageShell>
  );
}
