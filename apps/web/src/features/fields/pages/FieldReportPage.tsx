// apps/web/src/features/fields/pages/FieldReportPage.tsx
import React from "react";
import { Link, useParams } from "react-router-dom";
import { fetchFieldReport } from "../../../api/customerReports";
import {
  ProductBoundaryBanner,
  ProductDataTable,
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
import { buildFieldReportVm, type FieldReportPageVm } from "../../../viewmodels/fieldReportVm";

function statusForField(tone: FieldReportPageVm["risk"]["tone"]): "available" | "partial" | "degraded" | "blocked" {
  if (tone === "danger") return "blocked";
  if (tone === "warning") return "degraded";
  if (tone === "neutral") return "partial";
  return "available";
}

export default function FieldReportPageRoute(): React.ReactElement {
  const { fieldId = "" } = useParams();
  const [vm, setVm] = React.useState<FieldReportPageVm | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    void fetchFieldReport(fieldId)
      .then((report) => {
        if (!alive) return;
        setVm(buildFieldReportVm(report));
        setError("");
      })
      .catch(() => {
        if (!alive) return;
        setVm(null);
        setError("Field report is unavailable.");
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => { alive = false; };
  }, [fieldId]);

  if (fieldId === "index") {
    return <ProductPageShell surface="customer"><ProductStateBlock kind="urlOnly" title="Field index moved" description="Open the customer field reports index from the customer portal." /></ProductPageShell>;
  }

  if (loading) return <ProductPageShell surface="customer"><ProductLoadingState label="Loading field report" description="Preparing the customer-safe field report." /></ProductPageShell>;
  if (error || !vm) return <ProductPageShell surface="customer"><ProductErrorState title="Field report unavailable" message={error || "No field report data is available."} /></ProductPageShell>;

  return (
    <ProductPageShell
      surface="customer"
      ariaLabel="Customer field report"
      top={
        <ProductPageHeader
          eyebrow="Customer Portal / Field report"
          title={vm.field.fieldName}
          lead={vm.hero.subtitle || vm.diagnosis.headline}
          metadata={`Updated at: ${vm.generatedAtText}`}
          primaryAction={<Link className="customerButton customerButtonPrimary" to={vm.exportHref}>Export field report</Link>}
          secondaryActions={<Link className="customerButton" to="/customer/fields">Back to field reports</Link>}
          nonclaim="Field report is read-only customer reporting. It does not expose raw evidence records or command workflows."
        />
      }
    >
      <ProductBoundaryBanner tone="readOnly" title="Customer-safe field report" description="This report summarizes field status, customer-safe evidence, recent operations, and report delivery links." />
      <ProductScopeBar surface="customer" items={[{ label: "Field", value: vm.field.fieldId }, { label: "Crop", value: vm.field.cropText }, { label: "Stage", value: vm.field.stageText }, { label: "Updated", value: vm.generatedAtText }]} />

      <ProductSectionCard title="Field status summary" subtitle="Customer-readable status, context, and observation summary." status={<ProductStatusBadge status={statusForField(vm.risk.tone)} label={vm.risk.levelLabel} />}>
        <div className="customerDashboardGuidanceGrid">
          <ProductMetricTile label="Current status" value={vm.cropContext.statusText} description={vm.cropContext.explanationText} source={vm.cropContext.sourceText} />
          <ProductMetricTile label="Latest observation" value={vm.diagnosis.latestObservationText} description={vm.diagnosis.dataQualityText} source="Customer field report" />
          <ProductMetricTile label="Recent operations" value={String(vm.recentOperations.length)} unit="reports" description={vm.cropContext.historicalOperationText} source="Customer field report" />
        </div>
      </ProductSectionCard>

      <ProductSectionCard title="Evidence summary" subtitle="Customer-safe evidence explanation without raw payloads or technical storage details.">
        {vm.diagnosis.evidenceLines.length ? (
          <ul className="customerList">
            {vm.diagnosis.evidenceLines.slice(0, 6).map((line, index) => <li key={`${line}-${index}`} className="customerListItem">{line}</li>)}
          </ul>
        ) : (
          <ProductEmptyState title="No evidence summary" description="No customer-safe evidence summary is currently available." />
        )}
      </ProductSectionCard>

      <ProductSectionCard title="Recent operation reports" subtitle="Customer-visible operation history for this field.">
        <ProductDataTable<FieldReportPageVm["recentOperations"][number]>
          caption="Recent field operation reports"
          rows={vm.recentOperations}
          getRowKey={(row) => row.operationId || row.title}
          emptyState={<ProductEmptyState title="No recent operation reports" description="No operation report is currently linked to this field." />}
          mobileFallbackNote="On narrow screens, scroll horizontally or open each operation report."
          columns={[
            { key: "operation", header: "Operation", render: (row) => <Link to={row.href}>{row.title}</Link> },
            { key: "status", header: "Report status", render: (row) => <ProductStatusBadge status="readOnly" label={row.statusText} /> },
            { key: "evidence", header: "Evidence summary", render: (row) => row.evidenceText },
            { key: "updated", header: "Updated", render: (row) => row.updatedAtText },
          ]}
        />
      </ProductSectionCard>
    </ProductPageShell>
  );
}
