// apps/web/src/features/admin/pages/AdminDashboardPage.tsx
// Purpose: productize Admin Dashboard as an internal governance and readback overview.
// Boundary: this page is not a dispatch console, acceptance console, import page, or production control surface.

import React from "react";
import { Link } from "react-router-dom";
import {
  ProductBoundaryBanner,
  ProductDataTable,
  ProductMetricTile,
  ProductPageHeader,
  ProductPageShell,
  ProductScopeBar,
  ProductSectionCard,
  ProductStateBlock,
  ProductStatusBadge,
} from "../../../design-system/product";

type DashboardRow = {
  area: string;
  mode: string;
  boundary: string;
  href: string;
};

type CompatibilityRow = {
  path: string;
  status: string;
  note: string;
};

const dashboardRows: DashboardRow[] = [
  { area: "Fields", mode: "Governance readback", boundary: "Not customer report framing", href: "/admin/fields" },
  { area: "Operations", mode: "Status readback", boundary: "Not dispatch", href: "/admin/operations" },
  { area: "Devices", mode: "Inventory readback", boundary: "Not live device monitor", href: "/admin/devices" },
  { area: "Evidence", mode: "Trace readback", boundary: "Not facts writer", href: "/admin/evidence" },
  { area: "Skills / Config", mode: "Registry readback", boundary: "/admin/config not promoted", href: "/admin/skills" },
  { area: "Healthz", mode: "Health readback", boundary: "/admin/health not promoted", href: "/admin/healthz" },
];

const compatibilityRows: CompatibilityRow[] = [
  { path: "/admin/alerts", status: "URL-only compatibility", note: "Not a PFE-5 formal surface." },
  { path: "/admin/acceptance", status: "URL-only compatibility", note: "Formal nav exclusion preserved." },
  { path: "/admin/import", status: "URL-only compatibility", note: "Import workflow is not promoted." },
  { path: "/admin/operations/:operationId/debug", status: "URL-only compatibility", note: "Debug route is not promoted." },
];

export default function AdminDashboardPage(): React.ReactElement {
  return (
    <ProductPageShell
      surface="admin"
      width="wide"
      ariaLabel="Admin governance overview"
      className="adminProductSurface"
      top={
        <ProductPageHeader
          eyebrow="Admin Console"
          title="Admin governance overview"
          lead="Internal governance, readback, and administration status surface."
          metadata="Source: formal Admin Console navigation / PFE-1 Admin contracts"
          nonclaim="Read-only governance readback. Not dispatch, not AO-ACT control, not device control, not production gateway control."
        />
      }
    >
      <ProductBoundaryBanner
        tone="readOnly"
        title="Internal governance and readback boundary"
        description="Admin Dashboard summarizes formal Admin surfaces. URL-only compatibility routes and future pages remain outside formal navigation."
        items={["No dispatch console", "No production control", "No customer report UI"]}
      />

      <ProductScopeBar
        surface="admin"
        items={[
          { label: "Surface", value: "Admin Console" },
          { label: "Mode", value: "Governance readback" },
          { label: "Formal entries", value: String(dashboardRows.length) },
        ]}
      />

      <div className="operatorProductMetricGrid">
        <ProductMetricTile label="Formal Admin entries" value={dashboardRows.length} description="Enabled Admin nav surfaces covered by PFE-5." source="AdminLayout formal nav" status={<ProductStatusBadge status="readOnly" />} />
        <ProductMetricTile label="URL-only routes" value={compatibilityRows.length} description="Compatibility routes not promoted to formal Admin surfaces." source="PFE-1 Admin contracts" status={<ProductStatusBadge status="urlOnly" />} />
        <ProductMetricTile label="Health summary" value="Readback only" description="Healthz is not production readiness proof." source="/admin/healthz" status={<ProductStatusBadge status="partial" />} />
      </div>

      <ProductSectionCard title="Formal Admin entries" subtitle="Governance overview and navigation into readback surfaces.">
        <ProductDataTable<DashboardRow>
          caption="Formal Admin governance entries"
          rows={dashboardRows}
          getRowKey={(row) => row.area}
          mobileFallbackNote="Scroll horizontally to review Admin entry boundaries."
          columns={[
            { key: "area", header: "Area", render: (row) => <Link to={row.href}>{row.area}</Link> },
            { key: "mode", header: "Mode", render: (row) => row.mode },
            { key: "boundary", header: "Boundary", render: (row) => row.boundary },
          ]}
        />
      </ProductSectionCard>

      <ProductSectionCard title="URL-only compatibility" subtitle="These routes are preserved but not productized or promoted by PFE-5.">
        <ProductDataTable<CompatibilityRow>
          caption="Admin URL-only compatibility routes"
          rows={compatibilityRows}
          getRowKey={(row) => row.path}
          columns={[
            { key: "path", header: "Path", render: (row) => row.path },
            { key: "status", header: "Status", render: (row) => <ProductStatusBadge status="urlOnly" label={row.status} /> },
            { key: "note", header: "Note", render: (row) => row.note },
          ]}
        />
      </ProductSectionCard>

      <ProductStateBlock
        kind="future"
        title="Future Admin contracts remain deferred"
        description="/admin/config, /admin/health, /admin/audit, /admin/imports, and /admin/tenants are not implemented or promoted in PFE-5."
      />
    </ProductPageShell>
  );
}
