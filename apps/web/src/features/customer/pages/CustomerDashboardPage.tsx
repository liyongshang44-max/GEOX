// apps/web/src/features/customer/pages/CustomerDashboardPage.tsx
import React from "react";
import { Link } from "react-router-dom";
import { fetchCustomerDashboardAggregate } from "../../../api/customerReports";
import {
  ProductBoundaryBanner,
  ProductEmptyState,
  ProductErrorState,
  ProductLoadingState,
  ProductMetricTile,
  ProductPageHeader,
  ProductPageShell,
  ProductScopeBar,
  ProductSectionCard,
  ProductStateBlock,
  ProductStatusBadge,
} from "../../../design-system/product";
import { buildCustomerDashboardVm, type CustomerDashboardPageVm } from "../../../viewmodels/customerDashboardVm";

function dashboardStatus(tone: string | undefined): "available" | "partial" | "degraded" | "blocked" {
  if (tone === "danger") return "blocked";
  if (tone === "warning") return "degraded";
  if (tone === "good") return "available";
  return "partial";
}

export default function CustomerDashboardPage(): React.ReactElement {
  const [vm, setVm] = React.useState<CustomerDashboardPageVm | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    void fetchCustomerDashboardAggregate()
      .then((aggregate) => {
        if (!alive) return;
        setVm(buildCustomerDashboardVm(aggregate));
        setError("");
      })
      .catch(() => {
        if (!alive) return;
        setVm(null);
        setError("Customer dashboard report is unavailable.");
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => { alive = false; };
  }, []);

  if (loading) {
    return (
      <ProductPageShell surface="customer" ariaLabel="Customer dashboard loading">
        <ProductLoadingState label="Loading customer report overview" description="Preparing the customer-safe reporting summary." />
      </ProductPageShell>
    );
  }

  if (error || !vm) {
    return (
      <ProductPageShell surface="customer" ariaLabel="Customer dashboard unavailable">
        <ProductErrorState title="Customer report unavailable" message={error || "No customer dashboard data is available."} />
      </ProductPageShell>
    );
  }

  return (
    <ProductPageShell
      surface="customer"
      ariaLabel="Customer reporting dashboard"
      top={
        <ProductPageHeader
          eyebrow="Customer Portal / Report overview"
          title="Customer reporting overview"
          lead={vm.header.subtitle || vm.context.subtitle}
          metadata={`Updated at: ${vm.generatedAtText}`}
          primaryAction={<Link className="customerButton customerButtonPrimary" to="/customer/export">Export report</Link>}
          secondaryActions={<Link className="customerButton" to="/customer/reports">Open reports</Link>}
          nonclaim="Reporting-only surface. No operational control, internal review workflow, value ledger, memory workflow, or diagnostic console is available here."
        />
      }
      aside={
        <div className="customerDashboardRightRail" aria-label="Customer dashboard summary rail">
          <ProductSectionCard title="Authorized scope" subtitle={vm.summaryScopeText}>
            <ProductStatusBadge status="readOnly" label="Report only" />
          </ProductSectionCard>
          <ProductSectionCard title="Delivery" subtitle="Export-ready customer report surface.">
            <Link className="customerButton customerButtonPrimary" to="/customer/export">Export dashboard report</Link>
          </ProductSectionCard>
        </div>
      }
    >
      <ProductBoundaryBanner
        tone="readOnly"
        title="Reporting-only customer surface"
        description="This page summarizes authorized fields and operations for review. It does not provide command or control workflows."
        items={["Customer-safe report language", "Authorized scope only", "Export-ready overview"]}
      />

      <ProductScopeBar
        surface="customer"
        items={[
          { label: "Scope", value: vm.summaryScopeText },
          { label: "Updated", value: vm.generatedAtText },
        ]}
      />

      <ProductSectionCard title="Summary" subtitle="Key report indicators for the authorized customer scope.">
        <div className="customerDashboardGuidanceGrid">
          {vm.kpis.slice(0, 5).map((item) => (
            <ProductMetricTile
              key={item.key}
              label={item.label}
              value={item.value}
              unit={item.unit}
              description={item.customerHint || item.sourceNote}
              status={<ProductStatusBadge status={dashboardStatus(item.tone)} label={item.tone === "good" ? "Available" : item.tone === "warning" ? "Requires review" : item.tone === "danger" ? "Blocked" : "Report only"} />}
              source="Customer dashboard summary"
            />
          ))}
        </div>
      </ProductSectionCard>

      <section className="customerDashboardMainGrid" aria-label="Customer report entry cards">
        <ProductSectionCard title="Field reports" subtitle="Review authorized field status and open field reports.">
          {vm.topRiskFields.length ? (
            <div className="customerIndexList">
              {vm.topRiskFields.map((field) => (
                <Link key={field.fieldId} className="customerIndexRow" to={field.href}>
                  <div>
                    <strong>{field.fieldName}</strong>
                    <small>{field.secondaryText}</small>
                    <small>{field.boundaryText}</small>
                  </div>
                  <ProductStatusBadge status={dashboardStatus(field.riskTone)} label={field.riskLabel} />
                </Link>
              ))}
            </div>
          ) : (
            <ProductEmptyState title="No field report entries" description="No authorized field report entry is available for this summary." />
          )}
        </ProductSectionCard>

        <ProductSectionCard title="Operation reports" subtitle="Review recent operation reports in customer language.">
          {vm.recentOperations.length ? (
            <div className="customerIndexList">
              {vm.recentOperations.slice(0, 5).map((operation) => (
                <Link key={operation.operationId} className="customerIndexRow" to={operation.href}>
                  <div>
                    <strong>{operation.operationName}</strong>
                    <small>{operation.fieldName}</small>
                    <small>{operation.evidenceText}</small>
                  </div>
                  <ProductStatusBadge status="readOnly" label={operation.stateText} />
                </Link>
              ))}
            </div>
          ) : (
            <ProductEmptyState title="No operation reports" description="No recent customer-visible operation report is available." />
          )}
        </ProductSectionCard>
      </section>

      <ProductSectionCard title="Report entries" subtitle="Customer-safe delivery surfaces for review and sharing.">
        <div className="customerUsageActions">
          <Link className="customerButton" to="/customer/fields">Field reports</Link>
          <Link className="customerButton" to="/customer/operations">Operation reports</Link>
          <Link className="customerButton" to="/customer/reports">Reports center</Link>
          <Link className="customerButton customerButtonPrimary" to="/customer/export">Export dashboard report</Link>
        </div>
      </ProductSectionCard>

      {vm.kpis.length === 0 ? (
        <ProductStateBlock kind="unavailable" title="Summary unavailable" description="The customer report overview is present, but no summary metrics are currently available." />
      ) : null}
    </ProductPageShell>
  );
}
