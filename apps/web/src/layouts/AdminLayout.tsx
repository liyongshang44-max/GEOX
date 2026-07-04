// apps/web/src/layouts/AdminLayout.tsx
// Purpose: render the H65 Admin Console as an independent shell.
// Boundary: this layout owns admin chrome only; it does not create records or open execution workflows.

import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import AppBreadcrumb from "../components/layout/AppBreadcrumb";
import { type TopBarProps } from "../app/TopBar";
import "../styles/adminShell.css";

type AdminLayoutProps = {
  topBar: TopBarProps;
  children: React.ReactNode;
};

type AdminNavItem = {
  key: string;
  label: string;
  to?: string;
  hint?: string;
  status: "enabled" | "url-only" | "planned";
};

const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { key: "dashboard", label: "鎬昏", to: "/admin/dashboard", status: "enabled" },
  { key: "fields", label: "鍦板潡", to: "/admin/fields", status: "enabled" },
  { key: "operations", label: "浣滀笟", to: "/admin/operations", status: "enabled" },
  { key: "devices", label: "璁惧", to: "/admin/devices", status: "enabled" },
  { key: "evidence", label: "璇佹嵁", to: "/admin/evidence", status: "enabled" },
  { key: "health", label: "杩愯鍋ュ悍", to: "/admin/healthz", status: "enabled" },
  { key: "config", label: "閰嶇疆", to: "/admin/skills", status: "enabled" },
];

function isNavActive(pathname: string, item: AdminNavItem): boolean {
  if (item.key === "dashboard") return pathname === "/admin" || pathname === "/admin/dashboard";
  if (item.key === "fields") return pathname.startsWith("/admin/fields");
  if (item.key === "operations") return pathname.startsWith("/admin/operations");
  if (item.key === "devices") return pathname.startsWith("/admin/devices");
  if (item.key === "evidence") return pathname.startsWith("/admin/evidence");
  if (item.key === "health") return pathname.startsWith("/admin/healthz");
  if (item.key === "config") return pathname.startsWith("/admin/skills");
  return false;
}

export default function AdminLayout({ topBar, children }: AdminLayoutProps): React.ReactElement {
  const location = useLocation();

  return (
    <div className="adminShell" data-layout="admin-console-shell">
      <aside className="adminShellSidebar" aria-label="鍚庡彴绠＄悊瀵艰埅">
        <div className="adminShellBrand" aria-label="Admin Console">
          <span className="adminShellLogoMark" aria-hidden="true" />
          <span>Admin Console</span>
        </div>

        <nav className="adminShellNav" aria-label="Admin Console navigation">
          {ADMIN_NAV_ITEMS.map((item) => item.status === "enabled" && item.to ? (
            <NavLink
              key={item.key}
              to={item.to}
              title={item.hint || item.label}
              className={() => "adminShellNavItem" + (isNavActive(location.pathname, item) ? " isActive" : "")}
            >
              <span>{item.label}</span>
            </NavLink>
          ) : (
            <span key={item.key} className="adminShellNavItem adminShellNavItemDisabled" aria-disabled="true" title={item.hint || item.label}>
              <span>{item.label}</span>
            </span>
          ))}
        </nav>

        <div className="adminShellMeta">
          <div>Internal governance surface</div>
          <strong>Read-only shell boundary</strong>
          <div>Formal navigation</div>
          <strong>Admin routes only</strong>
        </div>

        <div className="adminShellFooterNote">Diagnostic and compatibility URLs stay URL-only until separately productized.</div>
      </aside>

      <div className="adminShellMainWrap">
        <header className="adminShellTopbar">
          <div className="adminShellHeading">
            <div className="adminShellBreadcrumbs">
              <AppBreadcrumb items={topBar.breadcrumbs} />
            </div>
            <h1 className="adminShellTitle">{topBar.title}</h1>
            <div className="adminShellContext">{topBar.lead}</div>
          </div>

          <div className="adminShellMeta adminShellTopMeta" aria-label="Admin route policy">
            <div>Route family</div>
            <strong>/admin/*</strong>
            <div>Surface mode</div>
            <strong>Governed readback</strong>
          </div>
        </header>

        <section className="adminShellBoundary" aria-label="Admin Console boundary">
          <strong>Admin Console</strong>
          <span>Internal governance surface. Read-only shell boundary. This shell does not create facts, open controlled execution, write value records, or write long-term field records.</span>
        </section>

        <main className="adminLayoutMain">{children}</main>
      </div>
    </div>
  );
}