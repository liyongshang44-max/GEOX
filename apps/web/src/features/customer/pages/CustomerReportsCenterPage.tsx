// apps/web/src/features/customer/pages/CustomerReportsCenterPage.tsx
import React from "react";
import { Link } from "react-router-dom";
import { fetchCustomerReportsCenter } from "../../../api/customerReportsCenter";
import {
  ProductBoundaryBanner,
  ProductEmptyState,
  ProductErrorState,
  ProductLoadingState,
  ProductPageHeader,
  ProductPageShell,
  ProductScopeBar,
  ProductSectionCard,
  ProductStatusBadge,
} from "../../../design-system/product";
import { buildCustomerReportsCenterVm, type CustomerReportsCenterVm } from "../../../viewmodels/customerReportsCenterVm";

export default function CustomerReportsCenterPage(): React.ReactElement {
  const [vm, setVm] = React.useState<CustomerReportsCenterVm | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    void fetchCustomerReportsCenter()
      .then((response) => {
        if (!alive) return;
        setVm(buildCustomerReportsCenterVm(response));
        setError("");
      })
      .catch(() => {
        if (!alive) return;
        setVm(null);
        setError("Reports center is unavailable.");
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => { alive = false; };
  }, []);

  if (loading) return <ProductPageShell surface="customer"><ProductLoadingState label="Loading reports center" description="Preparing customer report entries." /></ProductPageShell>;
  if (error || !vm) return <ProductPageShell surface="customer"><ProductErrorState title="Reports center unavailable" message={error || "No report center data is available."} /></ProductPageShell>;

  return (
    <ProductPageShell
      surface="customer"
      ariaLabel="Customer reports center"
      top={
        <ProductPageHeader
          eyebrow="Customer Portal / Reports"
          title="Reports center"
          lead={vm.subtitle}
          metadata={`Updated at: ${vm.generatedAtText}`}
          primaryAction={<Link className="customerButton customerButtonPrimary" to="/customer/export">Export dashboard report</Link>}
          secondaryActions={<Link className="customerButton" to="/customer/dashboard">Back to overview</Link>}
          nonclaim="Reports center links only to customer reporting and delivery surfaces."
        />
      }
    >
      <ProductBoundaryBanner tone="readOnly" title="Customer-safe report center" description="This page organizes available field, operation, and export reports without exposing internal tools." />
      <ProductScopeBar surface="customer" items={[{ label: "Scope", value: vm.scopeBadgeText }, { label: "Trust", value: vm.trustText }, { label: "Updated", value: vm.generatedAtText }]} />

      <section className="customerReportsCenterGrid" aria-label="Customer report categories">
        {vm.groups.map((group) => (
          <ProductSectionCard key={group.key} title={group.title} subtitle={group.description}>
            {group.items.length ? (
              <div className="customerReportEntryList">
                {group.items.map((item, index) => (
                  <Link key={`${group.key}-${item.href || item.title}-${index}`} className="customerReportEntry" to={item.href || "/customer/reports"}>
                    <div>
                      <strong>{item.title}</strong>
                      <p>{item.subtitle}</p>
                      <small>{item.coverageText}</small>
                      <small>Updated: {item.updatedAtText}</small>
                    </div>
                    <ProductStatusBadge status="readOnly" label={item.statusText} />
                  </Link>
                ))}
              </div>
            ) : (
              <ProductEmptyState title="No report entry" description="No customer report entry is currently available in this category." />
            )}
          </ProductSectionCard>
        ))}
      </section>
    </ProductPageShell>
  );
}
