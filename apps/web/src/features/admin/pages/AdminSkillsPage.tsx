// apps/web/src/features/admin/pages/AdminSkillsPage.tsx
// Purpose: productize Admin Skills as skills and config readback with route naming debt visible.
// Boundary: this page does not execute skills or promote /admin/config.

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

type SkillReadbackRow = {
  label: string;
  value: string;
  source: string;
  boundary: string;
};

const skillRows: SkillReadbackRow[] = [
  { label: "Skills registry", value: "Readback", source: "admin skills source", boundary: "No skill run mutation" },
  { label: "Worker state", value: "Readback", source: "worker status summary", boundary: "No execution trigger" },
  { label: "Last run", value: "Readback", source: "skills run metadata", boundary: "Metadata only" },
  { label: "Queue lag", value: "Readback", source: "queue status summary", boundary: "No production control" },
  { label: "Route naming debt", value: "/admin/config not promoted", source: "PFE-1 Admin contract", boundary: "Future page deferred" },
];

export default function AdminSkillsPage(): React.ReactElement {
  return (
    <ProductPageShell
      surface="admin"
      width="wide"
      ariaLabel="Admin skills and config readback"
      className="adminProductSurface"
      top={
        <ProductPageHeader
          eyebrow="Admin Console / Skills"
          title="Skills and config readback"
          lead="Internal skills registry, worker state, last run, and queue lag readback."
          metadata="Route naming debt: /admin/config not promoted"
          nonclaim="Read-only governance readback. Not skill execution, not dispatch, not AO-ACT control, not production control."
        />
      }
    >
      <ProductBoundaryBanner
        tone="readOnly"
        title="Skills readback is not execution"
        description="This surface records skills registry and config readback while keeping /admin/config deferred. It does not execute skills or promote future routes."
        items={["/admin/config not promoted", "No skill run mutation", "Governance boundary preserved"]}
      />
      <ProductScopeBar surface="admin" items={[{ label: "Route", value: "/admin/skills" }, { label: "Deferred route", value: "/admin/config" }, { label: "Mode", value: "Skills registry readback" }]} />
      <div className="adminProductMetricGrid">
        <ProductMetricTile label="Readback rows" value={skillRows.length} source="admin skills source" status={<ProductStatusBadge status="readOnly" />} />
        <ProductMetricTile label="Route naming debt" value="Recorded" description="/admin/config remains a future page and is not promoted by PFE-5." source="PFE-1 Admin contract" status={<ProductStatusBadge status="future" />} />
        <ProductMetricTile label="Queue lag" value="Readback" description="Queue lag is metadata only." source="skills readback" />
      </div>
      <ProductSectionCard title="Skills registry readback" subtitle="Skills, worker state, last run, queue lag, and route naming debt.">
        <ProductDataTable<SkillReadbackRow>
          caption="Admin skills readback rows"
          rows={skillRows}
          getRowKey={(row) => row.label}
          emptyState={<ProductEmptyState title="No skills readback rows" description="No skills readback rows are available." />}
          mobileFallbackNote="Scroll horizontally to review skills readback columns."
          columns={[
            { key: "label", header: "Label", render: (row) => row.label },
            { key: "value", header: "Value", render: (row) => row.value },
            { key: "source", header: "Source", render: (row) => row.source },
            { key: "boundary", header: "Boundary", render: (row) => row.boundary },
          ]}
        />
      </ProductSectionCard>
      <ProductStateBlock kind="future" title="/admin/config remains deferred" description="PFE-5 records this route naming debt without adding a new route or formal navigation item." />
    </ProductPageShell>
  );
}
