// apps/web/src/layouts/AdminLayout.tsx
// Purpose: render the Admin Console as an independent bilingual shell.
// Boundary: this layout owns admin chrome only; page-level landmarks are owned by formal Admin pages.

import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { type TopBarProps } from "../app/TopBar";
import LocaleToggle from "../components/common/LocaleToggle";
import AppBreadcrumb from "../components/layout/AppBreadcrumb";
import { localizedText, useLocale, type LocaleCode } from "../lib/locale";
import { ADMIN_SHELL_LABELS, type ShellNavCopy } from "../lib/productSurfaceLabels";
import "../styles/adminShell.css";

type AdminLayoutProps = {
  topBar: TopBarProps;
  children: React.ReactNode;
};

type AdminNavItem = {
  key: string;
  copy: ShellNavCopy;
  to?: string;
  status: "enabled" | "url-only" | "planned";
};

const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { key: "dashboard", copy: ADMIN_SHELL_LABELS.nav.dashboard, to: "/admin/dashboard", status: "enabled" },
  { key: "fields", copy: ADMIN_SHELL_LABELS.nav.fields, to: "/admin/fields", status: "enabled" },
  { key: "operations", copy: ADMIN_SHELL_LABELS.nav.operations, to: "/admin/operations", status: "enabled" },
  { key: "devices", copy: ADMIN_SHELL_LABELS.nav.devices, to: "/admin/devices", status: "enabled" },
  { key: "evidence", copy: ADMIN_SHELL_LABELS.nav.evidence, to: "/admin/evidence", status: "enabled" },
  { key: "health", copy: ADMIN_SHELL_LABELS.nav.health, to: "/admin/healthz", status: "enabled" },
  { key: "config", copy: ADMIN_SHELL_LABELS.nav.config, to: "/admin/skills", status: "enabled" },
];

function navLabel(item: AdminNavItem, locale: LocaleCode): string {
  return localizedText(item.copy.label, locale);
}

function navHint(item: AdminNavItem, locale: LocaleCode): string {
  return item.copy.hint ? localizedText(item.copy.hint, locale) : navLabel(item, locale);
}

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
  const { locale } = useLocale();
  const topbarTitle = localizedText(ADMIN_SHELL_LABELS.topbar.title, locale);
  const topbarLead = localizedText(ADMIN_SHELL_LABELS.topbar.lead, locale);

  return (
    <div className="adminShell" data-layout="admin-console-shell" data-pfe5="admin-layout-landmark-corrected" data-pfa2-locale={locale}>
      <aside className="adminShellSidebar" aria-label={localizedText(ADMIN_SHELL_LABELS.navigationAria, locale)}>
        <div className="adminShellBrand" aria-label={localizedText(ADMIN_SHELL_LABELS.brand, locale)}>
          <span className="adminShellLogoMark" aria-hidden="true" />
          <span>{localizedText(ADMIN_SHELL_LABELS.brand, locale)}</span>
        </div>

        <nav className="adminShellNav" aria-label={localizedText(ADMIN_SHELL_LABELS.navigationAria, locale)}>
          {ADMIN_NAV_ITEMS.map((item) => {
            const label = navLabel(item, locale);
            const hint = navHint(item, locale);

            return item.status === "enabled" && item.to ? (
              <NavLink
                key={item.key}
                to={item.to}
                title={hint}
                className={() => "adminShellNavItem" + (isNavActive(location.pathname, item) ? " isActive" : "")}
              >
                <span>{label}</span>
              </NavLink>
            ) : (
              <span key={item.key} className="adminShellNavItem adminShellNavItemDisabled" aria-disabled="true" title={hint}>
                <span>{label}</span>
              </span>
            );
          })}
        </nav>

        <div className="adminShellMeta">
          <div>{localizedText(ADMIN_SHELL_LABELS.meta.internalGovernanceSurface, locale)}</div>
          <strong>{localizedText(ADMIN_SHELL_LABELS.meta.readOnlyShellBoundary, locale)}</strong>
          <div>{localizedText(ADMIN_SHELL_LABELS.meta.formalNavigation, locale)}</div>
          <strong>{localizedText(ADMIN_SHELL_LABELS.meta.adminRoutesOnly, locale)}</strong>
        </div>

        <div className="adminShellFooterNote">{localizedText(ADMIN_SHELL_LABELS.meta.footerNote, locale)}</div>
      </aside>

      <div className="adminShellMainWrap">
        <header className="adminShellTopbar">
          <div className="adminShellHeading">
            <div className="adminShellBreadcrumbs">
              <AppBreadcrumb items={topBar.breadcrumbs} />
            </div>
            <h1 className="adminShellTitle">{topbarTitle}</h1>
            <div className="adminShellContext">{topbarLead}</div>
          </div>

          <div className="adminShellTopActions">
            <div className="adminShellLocaleToggle shellLocaleToggle">
              <LocaleToggle />
            </div>
            <div className="adminShellMeta adminShellTopMeta" aria-label={localizedText(ADMIN_SHELL_LABELS.boundaryAria, locale)}>
              <div>{localizedText(ADMIN_SHELL_LABELS.meta.routeFamily, locale)}</div>
              <strong>/admin/*</strong>
              <div>{localizedText(ADMIN_SHELL_LABELS.meta.surfaceMode, locale)}</div>
              <strong>{localizedText(ADMIN_SHELL_LABELS.meta.governedReadback, locale)}</strong>
            </div>
          </div>
        </header>

        <section className="adminShellBoundary" aria-label={localizedText(ADMIN_SHELL_LABELS.boundaryAria, locale)}>
          <strong>{localizedText(ADMIN_SHELL_LABELS.brand, locale)}</strong>
          <span>{localizedText(ADMIN_SHELL_LABELS.meta.boundaryText, locale)}</span>
        </section>

        <div className="adminLayoutMain" data-landmark="page-owned-by-product-page-shell">{children}</div>
      </div>
    </div>
  );
}
