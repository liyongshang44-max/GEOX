// apps/web/src/features/admin/pages/AdminDevicesPage.tsx
// Purpose: productize Admin Devices as device inventory and readback governance.
// Boundary: this page is inventory readback only.

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

type DeviceGovernanceRow = {
  field: string;
  meaning: string;
  state: string;
  boundary: string;
};

const deviceRows: DeviceGovernanceRow[] = [
  { field: "device_id", meaning: "Identity", state: "Available", boundary: "Inventory readback" },
  { field: "binding_status", meaning: "Field binding", state: "Available", boundary: "Readback only" },
  { field: "online_status", meaning: "Connectivity readback", state: "Offline or unavailable allowed", boundary: "Not live device monitor" },
  { field: "last_seen", meaning: "Telemetry recency", state: "Degraded when stale", boundary: "Readback only" },
  { field: "capability", meaning: "Declared capability", state: "Metadata only", boundary: "No production gateway action" },
  { field: "source_evidence_refs", meaning: "Traceability", state: "Available when sourced", boundary: "Source identity only" },
];

export default function AdminDevicesPage(): React.ReactElement {
  return (
    <ProductPageShell
      surface="admin"
      width="wide"
      ariaLabel="Admin device inventory readback"
      className="adminProductSurface"
      top={
        <ProductPageHeader
          eyebrow="Admin Console / Devices"
          title="Device inventory readback"
          lead="Internal device inventory, connection readback, and source identity review."
          metadata="Source: admin device governance labels"
          nonclaim="Read-only device governance. Not live device monitoring, not production gateway action."
        />
      }
    >
      <ProductBoundaryBanner
        tone="readOnly"
        title="Device inventory is not live monitoring"
        description="This surface displays connection and readback metadata. It does not claim live device connectivity."
        items={["Live device: not connected", "Production gateway: not online", "Service action disabled"]}
      />
      <ProductScopeBar surface="admin" items={[{ label: "Route", value: "/admin/devices" }, { label: "Mode", value: "Device inventory readback" }, { label: "Read-only", value: "true" }]} />
      <div className="adminProductMetricGrid">
        <ProductMetricTile label="Inventory rows" value={deviceRows.length} source="admin device source" status={<ProductStatusBadge status="readOnly" />} />
        <ProductMetricTile label="Connection state" value="Readback" description="Connection status is metadata, not a live monitoring claim." source="device governance" status={<ProductStatusBadge status="notConnected" />} />
        <ProductMetricTile label="Unavailable state" value="Defined" description="Offline and unavailable device states are allowed readback states." source="PFE-1 Admin contract" status={<ProductStatusBadge status="unavailable" />} />
      </div>
      <ProductSectionCard title="Device inventory rows" subtitle="Device governance fields and source identity boundaries.">
        <ProductDataTable<DeviceGovernanceRow>
          caption="Admin device inventory rows"
          rows={deviceRows}
          getRowKey={(row) => row.field}
          emptyState={<ProductEmptyState title="No device inventory rows" description="No device inventory readback rows are available." />}
          mobileFallbackNote="Scroll horizontally to review device governance columns."
          columns={[
            { key: "field", header: "Allowed field", render: (row) => row.field },
            { key: "meaning", header: "Meaning", render: (row) => row.meaning },
            { key: "state", header: "State", render: (row) => row.state },
            { key: "boundary", header: "Boundary", render: (row) => row.boundary },
          ]}
        />
      </ProductSectionCard>
      <ProductStateBlock kind="notConnected" title="Not a live device monitor" description="Admin Devices records readback status only. Live monitoring remains outside PFE-5." />
    </ProductPageShell>
  );
}
