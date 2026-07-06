// apps/web/src/features/operations/pages/OperationReportPage.tsx
import React from "react";
import { Link, useParams } from "react-router-dom";
import { fetchOperationReport } from "../../../api/customerReports";
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
import { buildOperationReportVm, type OperationReportPageVm } from "../../../viewmodels/operationReportVm";

function sectionStatus(status: string): "available" | "partial" | "degraded" | "disabled" {
  if (status === "AVAILABLE") return "available";
  if (status === "PENDING") return "degraded";
  if (status === "NOT_APPLICABLE") return "disabled";
  return "partial";
}

function customerTimelineLabel(status: OperationReportPageVm["timeline"][number]["status"]): string {
  if (status === "DONE") return "已完成";
  if (status === "PENDING") return "等待复核";
  if (status === "MISSING") return "暂不可用";
  if (status === "NOT_APPLICABLE") return "不适用";
  return "可查看";
}

export default function OperationReportPageRoute(): React.ReactElement {
  const { operationId = "" } = useParams();
  const [vm, setVm] = React.useState<OperationReportPageVm | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    void fetchOperationReport(operationId)
      .then((report) => {
        if (!alive) return;
        setVm(buildOperationReportVm(report));
        setError("");
      })
      .catch(() => {
        if (!alive) return;
        setVm(null);
        setError("Operation report is unavailable.");
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => { alive = false; };
  }, [operationId]);

  if (operationId === "index") {
    return <ProductPageShell surface="customer"><ProductStateBlock kind="urlOnly" title="Operation index moved" description="Open customer operation reports from the customer portal." /></ProductPageShell>;
  }

  if (loading) return <ProductPageShell surface="customer"><ProductLoadingState label="Loading operation report" description="Preparing the customer-safe operation report." /></ProductPageShell>;
  if (error || !vm) return <ProductPageShell surface="customer"><ProductErrorState title="Operation report unavailable" message={error || "No operation report data is available."} /></ProductPageShell>;

  return (
    <ProductPageShell
      surface="customer"
      ariaLabel="Customer operation report"
      top={
        <ProductPageHeader
          eyebrow="Customer Portal / Operation report"
          title={vm.header.title || vm.operation.title}
          lead={vm.header.subtitle}
          metadata={`Updated at: ${vm.generatedAtText}`}
          primaryAction={<Link className="customerButton customerButtonPrimary" to={vm.exportHref}>Export operation report</Link>}
          secondaryActions={<Link className="customerButton" to="/customer/operations">Back to operation reports</Link>}
          nonclaim="Operation report is a read-only customer reporting surface."
        />
      }
    >
      <ProductBoundaryBanner tone="readOnly" title="Customer-safe operation report" description="This report summarizes the operation, timeline, evidence summary, and delivery status for customer review." />
      <ProductScopeBar surface="customer" items={[{ label: "Operation", value: vm.operation.operationId }, { label: "Field", value: vm.operation.fieldName }, { label: "Updated", value: vm.generatedAtText }]} />

      <ProductSectionCard title="Operation summary" subtitle="Customer-readable operation status and context." status={<ProductStatusBadge status="readOnly" label={vm.operation.finalStatusLabel} />}>
        <div className="customerDashboardGuidanceGrid">
          <ProductMetricTile label="Final status" value={vm.conclusion.finalStatusText} description={vm.conclusion.resultText} source="Operation report" />
          <ProductMetricTile label="Evidence summary" value={vm.evidenceSummary.statusText} description={vm.evidenceSummary.summary} source={vm.evidenceSummary.sourceText} />
          <ProductMetricTile label="Delivery status" value={vm.operation.updatedAtText} description="Report updated timestamp" source="Customer operation report" />
        </div>
      </ProductSectionCard>

      <ProductSectionCard title="Report sections" subtitle="Read-only customer report sections.">
        <ProductDataTable<OperationReportPageVm["sections"][number]>
          caption="Operation report sections"
          rows={vm.sections}
          getRowKey={(row) => row.key}
          emptyState={<ProductEmptyState title="No report sections" description="No customer report sections are currently available." />}
          mobileFallbackNote="On narrow screens, scroll horizontally to review each section."
          columns={[
            { key: "section", header: "Section", render: (row) => row.title },
            { key: "status", header: "Status", render: (row) => <ProductStatusBadge status={sectionStatus(row.status)} label={row.statusText || "可查看"} /> },
            { key: "summary", header: "Summary", render: (row) => row.summary || row.emptyState?.description || "No summary available." },
          ]}
        />
      </ProductSectionCard>

      <ProductSectionCard title="Timeline summary" subtitle="Customer-readable milestone sequence.">
        {vm.timeline.length ? (
          <ul className="customerList">
            {vm.timeline.map((item) => <li key={item.key} className="customerListItem"><strong>{item.label}</strong> — {item.timeText || customerTimelineLabel(item.status)}</li>)}
          </ul>
        ) : (
          <ProductEmptyState title="No timeline summary" description="No customer timeline summary is currently available." />
        )}
      </ProductSectionCard>
    </ProductPageShell>
  );
}
