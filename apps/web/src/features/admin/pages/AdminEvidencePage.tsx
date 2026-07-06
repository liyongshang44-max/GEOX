// apps/web/src/features/admin/pages/AdminEvidencePage.tsx
// Purpose: productize Admin Evidence as evidence governance readback.
// Boundary: this page reads evidence source identity and trace metadata only.

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
  ProductStateBlock,
  ProductStatusBadge,
} from "../../../design-system/product";

type EvidenceGovernanceRow = {
  label: string;
  source: string;
  state: string;
  boundary: string;
};

const evidenceRows: EvidenceGovernanceRow[] = [
  { label: "evidence_ref", source: "evidence governance source", state: "Available when indexed", boundary: "Trace reference only" },
  { label: "fact_id", source: "fact source identity", state: "Available when linked", boundary: "Not facts writer" },
  { label: "source_ref", source: "source readback", state: "Available when sourced", boundary: "No raw mutation" },
  { label: "hashes", source: "integrity metadata", state: "Available when present", boundary: "Readback only" },
  { label: "trace_ids", source: "trace readback", state: "Missing state allowed", boundary: "No hidden source identity" },
];

export default function AdminEvidencePage(): React.ReactElement {
  return (
    <ProductPageShell
      surface="admin"
      width="wide"
      ariaLabel="Admin evidence governance readback"
      className="adminProductSurface"
      top={
        <ProductPageHeader
          eyebrow="Admin Console / Evidence"
          title="Evidence governance readback"
          lead="Internal evidence source identity, trace references, and missing-state review."
          metadata="Source: evidence governance readback"
          nonclaim="Read-only evidence governance. Not facts writer, not raw mutation, not customer evidence substitute."
        />
      }
    >
      <ProductBoundaryBanner
        tone="readOnly"
        title="Evidence governance is not facts writing"
        description="This surface reviews evidence source identity, trace refs, and missing-source states without creating or editing evidence records."
        items={["Source identity visible", "Trace refs preserved", "No raw mutation controls"]}
      />
      <ProductScopeBar surface="admin" items={[{ label: "Route", value: "/admin/evidence" }, { label: "Mode", value: "Evidence governance readback" }, { label: "Read-only", value: "true" }]} />
      <div className="adminProductMetricGrid">
        <ProductMetricTile label="Evidence rows" value={evidenceRows.length} source="evidence governance source" status={<ProductStatusBadge status="readOnly" />} />
        <ProductMetricTile label="Source identity" value="Visible" description="Source identity is part of Admin evidence governance." source="PFE-1 Admin contract" />
        <ProductMetricTile label="Missing state" value="Defined" description="Missing or source-unavailable evidence states are explicit readback states." source="PFE-1 Admin contract" status={<ProductStatusBadge status="unavailable" />} />
      </div>
      <ProductSectionCard title="Evidence governance summary" subtitle="Evidence source identity, trace refs, and missing-source readback.">
        <ProductDataTable<EvidenceGovernanceRow>
          caption="Admin evidence governance rows"
          rows={evidenceRows}
          getRowKey={(row) => row.label}
          emptyState={<ProductEmptyState title="No evidence governance rows" description="No evidence governance readback rows are available." />}
          mobileFallbackNote="Scroll horizontally to review evidence governance columns."
          columns={[
            { key: "label", header: "Label", render: (row) => row.label },
            { key: "source", header: "Source identity", render: (row) => row.source },
            { key: "state", header: "State", render: (row) => row.state },
            { key: "boundary", header: "Boundary", render: (row) => row.boundary },
          ]}
        />
      </ProductSectionCard>
      <ProductStateBlock kind="unavailable" title="Source-unavailable state is explicit" description="Admin Evidence may show missing or unavailable source metadata without exposing raw mutation controls." />
    </ProductPageShell>
  );
}
