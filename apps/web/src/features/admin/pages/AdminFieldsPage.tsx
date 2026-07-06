// apps/web/src/features/admin/pages/AdminFieldsPage.tsx
// Purpose: productize Admin Fields as field governance and management readback.
// Boundary: this page is not a Customer field report and does not expose dispatch or runtime mutation.

import React from "react";
import {
  ProductBoundaryBanner,
  ProductDataTable,
  ProductEmptyState,
  ProductMetricTile,
  ProductPageHeader,
  ProductPageShell,
  ProductScopeBar,
  ProductSectionCard,
  ProductStatusBadge,
} from "../../../design-system/product";

type FieldGovernanceRow = {
  field: string;
  status: string;
  source: string;
  boundary: string;
};

const fieldRows: FieldGovernanceRow[] = [
  { field: "field_id", status: "Identity readback", source: "admin field source", boundary: "Not customer report framing" },
  { field: "field_status", status: "Governance status", source: "field governance readback", boundary: "No uncontrolled mutation" },
  { field: "season_context", status: "Context readback", source: "field governance readback", boundary: "No dispatch" },
  { field: "source_identity", status: "Traceable source", source: "admin source identity", boundary: "No AO-ACT control" },
];

export default function AdminFieldsPage(): React.ReactElement {
  return (
    <ProductPageShell
      surface="admin"
      width="wide"
      ariaLabel="Admin field governance readback"
      className="adminProductSurface"
      top={
        <ProductPageHeader
          eyebrow="Admin Console / Fields"
          title="Field governance readback"
          lead="Internal field governance list and source identity review, not a Customer field report."
          metadata="Source: admin field governance readback"
          nonclaim="Read-only governance readback. Not dispatch, not AO-ACT control, not customer report UI."
        />
      }
    >
      <ProductBoundaryBanner
        tone="readOnly"
        title="Field governance boundary"
        description="This surface reviews field governance status and source identity. It does not create fields, edit customer reports, or control execution."
        items={["No customer report framing", "No dispatch", "No uncontrolled mutation"]}
      />
      <ProductScopeBar surface="admin" items={[{ label: "Route", value: "/admin/fields" }, { label: "Mode", value: "Governance readback" }, { label: "Read-only", value: "true" }]} />
      <div className="operatorProductMetricGrid">
        <ProductMetricTile label="Governance rows" value={fieldRows.length} source="admin field source" status={<ProductStatusBadge status="readOnly" />} />
        <ProductMetricTile label="Admin status" value="Readback" description="Administrative status is displayed without customer report language." source="field governance" />
        <ProductMetricTile label="Unavailable state" value="Defined" description="Empty or unavailable field governance data must not produce a blank page." source="PFE-1 Admin contract" />
      </div>
      <ProductSectionCard title="Field governance list" subtitle="Allowed Admin field readback labels and boundaries.">
        <ProductDataTable<FieldGovernanceRow>
          caption="Admin field governance list"
          rows={fieldRows}
          getRowKey={(row) => row.field}
          emptyState={<ProductEmptyState title="No field governance rows" description="No field governance readback rows are available." />}
          mobileFallbackNote="Scroll horizontally to review field governance columns."
          columns={[
            { key: "field", header: "Field", render: (row) => row.field },
            { key: "status", header: "Admin status", render: (row) => row.status },
            { key: "source", header: "Source identity", render: (row) => row.source },
            { key: "boundary", header: "Boundary", render: (row) => row.boundary },
          ]}
        />
      </ProductSectionCard>
    </ProductPageShell>
  );
}
