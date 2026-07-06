// apps/web/src/features/customer/pages/CustomerOperationsIndexPage.tsx
import React from "react";
import { Link } from "react-router-dom";
import { fetchCustomerOperations } from "../../../api/customerOperations";
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
} from "../../../design-system/product";
import { buildCustomerOperationsIndexVm, filterCustomerOperations, type CustomerOperationStatusFilter, type CustomerOperationsIndexRowVm, type CustomerOperationsIndexVm } from "../../../viewmodels/customerOperationsIndexVm";

function statusForOperation(row: CustomerOperationsIndexRowVm): "available" | "partial" | "degraded" | "blocked" {
  if (row.statusFilter === "ACCEPTANCE_PASS") return "available";
  if (row.statusFilter === "EVIDENCE_INSUFFICIENT" || row.statusFilter === "ACCEPTANCE_FAIL") return "blocked";
  if (row.statusFilter === "WAIT_ACCEPTANCE") return "degraded";
  return "partial";
}

export default function CustomerOperationsIndexPage(): React.ReactElement {
  const [vm, setVm] = React.useState<CustomerOperationsIndexVm | null>(null);
  const [selected, setSelected] = React.useState<CustomerOperationStatusFilter>("ALL");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    void fetchCustomerOperations()
      .then((response) => {
        if (!alive) return;
        setVm(buildCustomerOperationsIndexVm(response));
        setError("");
      })
      .catch(() => {
        if (!alive) return;
        setVm(null);
        setError("Customer operation reports are unavailable.");
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => { alive = false; };
  }, []);

  if (loading) return <ProductPageShell surface="customer"><ProductLoadingState label="Loading operation reports" description="Preparing customer-visible operation report entries." /></ProductPageShell>;
  if (error || !vm) return <ProductPageShell surface="customer"><ProductErrorState title="Operation reports unavailable" message={error || "No operation report data is available."} /></ProductPageShell>;

  const rows = filterCustomerOperations(vm.rows, selected);

  return (
    <ProductPageShell
      surface="customer"
      ariaLabel="Customer operation reports"
      top={
        <ProductPageHeader
          eyebrow="Customer Portal / Operation reports"
          title="Operation reports"
          lead={vm.subtitle}
          metadata={`Updated at: ${vm.generatedAtText}`}
          primaryAction={<Link className="customerButton" to="/customer/dashboard">Back to overview</Link>}
          nonclaim="Operation reports are customer read-only reporting surfaces, not execution workboards."
        />
      }
    >
      <ProductBoundaryBanner tone="readOnly" title="Operation reporting only" description="This page reports operation status and delivery context. It does not provide execution, control, or review mutation workflows." />
      <ProductScopeBar surface="customer" items={[{ label: "Scope", value: vm.scopeBadgeText }, { label: "Updated", value: vm.generatedAtText }]} />
      {vm.dataScopeNote ? <ProductStateBlock kind="permissionLimited" title="Scope note" description={vm.dataScopeNote} /> : null}

      <ProductSectionCard title="Operation report entries" subtitle="Open an operation to review the customer-safe report.">
        <div className="customerFilterRow" role="tablist" aria-label="Operation report status filter">
          {vm.filters.map((filter) => (
            <button key={filter.key} type="button" className={`customerFilterButton ${selected === filter.key ? "isActive" : ""}`} onClick={() => setSelected(filter.key)}>
              {filter.label} <span>{filter.count}</span>
            </button>
          ))}
        </div>

        <ProductDataTable<CustomerOperationsIndexRowVm>
          caption="Customer operation report entries"
          rows={rows}
          getRowKey={(row) => row.operationId}
          emptyState={<ProductEmptyState title={vm.emptyState.title} description={vm.emptyState.description} />}
          mobileFallbackNote="On narrow screens, scroll the table horizontally or open each operation report directly."
          columns={[
            { key: "operation", header: "Operation", render: (row) => <Link to={row.href}>{row.primaryLine}</Link> },
            { key: "status", header: "Report status", render: (row) => <ProductStatusBadge status={statusForOperation(row)} label={row.finalStatusText} /> },
            { key: "summary", header: "Summary", render: (row) => row.summaryText || "No summary available." },
            { key: "evidence", header: "Evidence summary", render: (row) => row.evidenceExplanation || row.evidenceText },
            { key: "completed", header: "Completed", render: (row) => row.completedAtText },
          ]}
        />
      </ProductSectionCard>
    </ProductPageShell>
  );
}
