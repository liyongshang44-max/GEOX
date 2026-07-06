// apps/web/src/features/admin/pages/AdminOperationsPage.tsx
// Purpose: productize Admin Operations as operation governance readback.
// Boundary: this page is not a dispatch console and does not expose hidden runtime mutation.

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

type OperationGovernanceRow = {
  field: string;
  readback: string;
  state: string;
  boundary: string;
};

const operationRows: OperationGovernanceRow[] = [
  { field: "operation_id", readback: "Identity", state: "Available", boundary: "Read only" },
  { field: "plan_status", readback: "Planning status", state: "Available", boundary: "Not dispatch" },
  { field: "approval_status", readback: "Review status", state: "Available", boundary: "No hidden approval mutation" },
  { field: "task_status", readback: "Task status", state: "Available", boundary: "No AO-ACT control" },
  { field: "receipt_status", readback: "Receipt status", state: "Available", boundary: "Readback only" },
  { field: "blocking_reason", readback: "Blocked/degraded state", state: "Degraded when present", boundary: "No execution workflow" },
];

export default function AdminOperationsPage(): React.ReactElement {
  return (
    <ProductPageShell
      surface="admin"
      width="wide"
      ariaLabel="Admin operation governance readback"
      className="adminProductSurface"
      top={
        <ProductPageHeader
          eyebrow="Admin Console / Operations"
          title="Operation governance readback"
          lead="Internal operation status readback with non-dispatch governance framing."
          metadata="Source: admin operation governance labels"
          nonclaim="Read-only governance readback. Not dispatch, not AO-ACT control, not customer operation report."
        />
      }
    >
      <ProductBoundaryBanner
        tone="readOnly"
        title="Operation governance is not dispatch"
        description="This surface reviews operation governance status, blocked state, and source identity. It does not dispatch, create tasks, or mutate runtime workflow."
        items={["No dispatch button", "No AO-ACT control", "No customer operation report framing"]}
      />
      <ProductScopeBar surface="admin" items={[{ label: "Route", value: "/admin/operations" }, { label: "Mode", value: "Operation governance readback" }, { label: "Read-only", value: "true" }]} />
      <div className="adminProductMetricGrid">
        <ProductMetricTile label="Governance labels" value={operationRows.length} source="admin operations readback" status={<ProductStatusBadge status="readOnly" />} />
        <ProductMetricTile label="Blocked/degraded copy" value="Present" description="Blocked and degraded states are shown as governance readback only." source="PFE-1 Admin contract" status={<ProductStatusBadge status="degraded" />} />
        <ProductMetricTile label="Dispatch boundary" value="Not dispatch" description="No dispatch console behavior is exposed." source="Admin Operations boundary" />
      </div>
      <ProductSectionCard title="Operation governance list" subtitle="Read-only operation status labels and boundaries.">
        <ProductDataTable<OperationGovernanceRow>
          caption="Admin operation governance list"
          rows={operationRows}
          getRowKey={(row) => row.field}
          emptyState={<ProductEmptyState title="No operation governance rows" description="No operation governance readback rows are available." />}
          mobileFallbackNote="Scroll horizontally to review operation governance columns."
          columns={[
            { key: "field", header: "Allowed field", render: (row) => row.field },
            { key: "readback", header: "Readback", render: (row) => row.readback },
            { key: "state", header: "State", render: (row) => row.state },
            { key: "boundary", header: "Boundary", render: (row) => row.boundary },
          ]}
        />
      </ProductSectionCard>
      <ProductStateBlock kind="degraded" title="Blocked state copy is readback only" description="Blocked or degraded operation rows do not become execution controls in Admin Console." />
    </ProductPageShell>
  );
}
