// apps/web/src/features/admin/pages/AdminHealthzPage.tsx
// Purpose: productize Admin Healthz as readback health status with route naming debt visible.
// Boundary: this page is not production readiness proof and does not expose service actions.

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

type HealthReadbackRow = {
  label: string;
  value: string;
  state: string;
  boundary: string;
};

const healthRows: HealthReadbackRow[] = [
  { label: "System health", value: "Readback", state: "Available or degraded", boundary: "Not production readiness proof" },
  { label: "Service status", value: "Readback", state: "Unavailable state allowed", boundary: "Service action disabled" },
  { label: "Health route", value: "/admin/healthz", state: "Formal route", boundary: "Readback only" },
  { label: "Route naming debt", value: "/admin/health not promoted", state: "Future", boundary: "No route promotion" },
];

export default function AdminHealthzPage(): React.ReactElement {
  return (
    <ProductPageShell
      surface="admin"
      width="wide"
      ariaLabel="Admin healthz readback"
      className="adminProductSurface"
      top={
        <ProductPageHeader
          eyebrow="Admin Console / Healthz"
          title="Healthz readback"
          lead="Internal health status, degraded state, unavailable state, and route naming debt review."
          metadata="Route naming debt: /admin/health not promoted"
          nonclaim="Read-only health readback. Not production readiness proof, not live monitoring, service action disabled."
        />
      }
    >
      <ProductBoundaryBanner
        tone="readOnly"
        title="Healthz is readback, not production proof"
        description="This surface reviews health metadata and unavailable states. It does not claim production readiness or promote /admin/health."
        items={["/admin/health not promoted", "Service action disabled", "Not live monitoring"]}
      />
      <ProductScopeBar surface="admin" items={[{ label: "Route", value: "/admin/healthz" }, { label: "Deferred route", value: "/admin/health" }, { label: "Mode", value: "Health readback" }]} />
      <div className="adminProductMetricGrid">
        <ProductMetricTile label="Health rows" value={healthRows.length} source="admin healthz readback" status={<ProductStatusBadge status="readOnly" />} />
        <ProductMetricTile label="Degraded state" value="Defined" description="Degraded health states are readback only." source="PFE-1 Admin contract" status={<ProductStatusBadge status="degraded" />} />
        <ProductMetricTile label="Route naming debt" value="Recorded" description="/admin/health remains deferred." source="PFE-1 Admin contract" status={<ProductStatusBadge status="future" />} />
      </div>
      <ProductSectionCard title="Health status rows" subtitle="Health status, degraded state, unavailable state, and route naming debt.">
        <ProductDataTable<HealthReadbackRow>
          caption="Admin healthz readback rows"
          rows={healthRows}
          getRowKey={(row) => row.label}
          emptyState={<ProductEmptyState title="No health readback rows" description="No healthz readback rows are available." />}
          mobileFallbackNote="Scroll horizontally to review healthz readback columns."
          columns={[
            { key: "label", header: "Label", render: (row) => row.label },
            { key: "value", header: "Value", render: (row) => row.value },
            { key: "state", header: "State", render: (row) => row.state },
            { key: "boundary", header: "Boundary", render: (row) => row.boundary },
          ]}
        />
      </ProductSectionCard>
      <ProductStateBlock kind="future" title="/admin/health remains deferred" description="PFE-5 records this route naming debt without adding a new route or formal navigation item." />
    </ProductPageShell>
  );
}
