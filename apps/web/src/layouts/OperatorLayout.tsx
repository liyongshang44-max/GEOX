// apps/web/src/layouts/OperatorLayout.tsx
// Purpose: render the Operator Runtime Console with persistent desktop navigation and compact responsive navigation.
// Boundary: route ownership, runtime capability, permissions, APIs, and read-only product claims remain unchanged.

import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import LocaleToggle from "../components/common/LocaleToggle";
import ProductMobileNavigation from "../components/layout/ProductMobileNavigation";
import OperatorPilotPage from "../features/operator/pilotReadiness/OperatorPilotPage";
import { localizedText, useLocale, type LocaleCode } from "../lib/locale";
import { OPERATOR_SHELL_LABELS, type ShellNavCopy } from "../lib/productSurfaceLabels";
import "../styles/operatorShell.css";

type OperatorLayoutProps = {
  children: React.ReactNode;
  title?: string;
  lead?: string;
};

type OperatorNavStatus = "enabled" | "coming-soon" | "route-preserved";

type OperatorNavItem = {
  key: string;
  copy: ShellNavCopy;
  to: string;
  status: OperatorNavStatus;
};

const OPERATOR_NAV_ITEMS: OperatorNavItem[] = [
  { key: "overview", copy: OPERATOR_SHELL_LABELS.nav.overview, to: "/operator/twin", status: "enabled" },
  { key: "fields", copy: OPERATOR_SHELL_LABELS.nav.fields, to: "/operator/fields", status: "enabled" },
  { key: "evidence", copy: OPERATOR_SHELL_LABELS.nav.evidence, to: "/operator/twin", status: "coming-soon" },
  { key: "forecast", copy: OPERATOR_SHELL_LABELS.nav.forecast, to: "/operator/twin", status: "coming-soon" },
  { key: "calibration", copy: OPERATOR_SHELL_LABELS.nav.calibration, to: "/operator/twin", status: "coming-soon" },
  { key: "health", copy: OPERATOR_SHELL_LABELS.nav.health, to: "/operator/twin", status: "coming-soon" },
  { key: "pilot", copy: OPERATOR_SHELL_LABELS.nav.pilot, to: "/operator/pilot", status: "enabled" },
  { key: "settings", copy: OPERATOR_SHELL_LABELS.nav.settings, to: "/operator/twin", status: "coming-soon" },
];

const RUNTIME_NONCLAIMS = [
  OPERATOR_SHELL_LABELS.runtimeNonclaims.runtimeMode,
  OPERATOR_SHELL_LABELS.runtimeNonclaims.liveDevice,
  OPERATOR_SHELL_LABELS.runtimeNonclaims.productionGateway,
  OPERATOR_SHELL_LABELS.runtimeNonclaims.fieldPilot,
  OPERATOR_SHELL_LABELS.runtimeNonclaims.controlledExecution,
];

function isItemActive(pathname: string, item: OperatorNavItem): boolean {
  if (item.key === "overview") return pathname === "/operator/twin" || pathname === "/operator";
  if (item.key === "fields") return pathname.startsWith("/operator/fields") || pathname.startsWith("/operator/twin/fields/");
  if (item.key === "pilot") return pathname === "/operator/pilot";
  return false;
}

function statusLabel(status: OperatorNavStatus, locale: LocaleCode): string {
  if (status === "enabled") return localizedText(OPERATOR_SHELL_LABELS.navStatus.routeActive, locale);
  if (status === "route-preserved") return localizedText(OPERATOR_SHELL_LABELS.navStatus.routePreserved, locale);
  return localizedText(OPERATOR_SHELL_LABELS.navStatus.comingSoon, locale);
}

function resolveTitle(pathname: string, locale: LocaleCode): string {
  if (pathname === "/operator/pilot") return localizedText(OPERATOR_SHELL_LABELS.titles.pilot, locale);
  if (pathname === "/operator/twin") return localizedText(OPERATOR_SHELL_LABELS.titles.overview, locale);
  if (pathname === "/operator/twin/production-workflow") return localizedText(OPERATOR_SHELL_LABELS.titles.workflow, locale);
  if (pathname === "/operator/twin/gateway-demo") return localizedText(OPERATOR_SHELL_LABELS.titles.gateway, locale);
  if (pathname.startsWith("/operator/fields") || pathname.startsWith("/operator/twin/fields/")) return localizedText(OPERATOR_SHELL_LABELS.titles.fieldRuntime, locale);
  if (pathname.startsWith("/operator/twin/traces/")) return localizedText(OPERATOR_SHELL_LABELS.titles.auditTrace, locale);
  return localizedText(OPERATOR_SHELL_LABELS.titles.fallback, locale);
}

function resolveLead(pathname: string, locale: LocaleCode): string {
  if (pathname === "/operator/pilot") return localizedText(OPERATOR_SHELL_LABELS.leads.pilot, locale);
  if (pathname === "/operator/twin") return localizedText(OPERATOR_SHELL_LABELS.leads.overview, locale);
  if (pathname === "/operator/twin/production-workflow") return localizedText(OPERATOR_SHELL_LABELS.leads.workflow, locale);
  if (pathname === "/operator/twin/gateway-demo") return localizedText(OPERATOR_SHELL_LABELS.leads.gateway, locale);
  if (pathname.startsWith("/operator/fields") || pathname.startsWith("/operator/twin/fields/")) return localizedText(OPERATOR_SHELL_LABELS.leads.fieldRuntime, locale);
  if (pathname.startsWith("/operator/twin/traces/")) return localizedText(OPERATOR_SHELL_LABELS.leads.auditTrace, locale);
  return localizedText(OPERATOR_SHELL_LABELS.leads.fallback, locale);
}

function navHint(item: OperatorNavItem, locale: LocaleCode, label: string): string {
  if (locale === "zh-CN" && item.key === "overview") return "查看保留的运行总览路由及其归属边界";
  if (locale === "zh-CN" && item.key === "fields") return "查看规范地块运行列表与地块级审查标签";
  return item.copy.hint ? localizedText(item.copy.hint, locale) : label;
}

function renderNavItem(item: OperatorNavItem, pathname: string, locale: LocaleCode): React.ReactElement {
  const activeClass = isItemActive(pathname, item) ? " isActive" : "";
  const label = localizedText(item.copy.label, locale);
  const hint = navHint(item, locale, label);
  const status = statusLabel(item.status, locale);

  if (item.status !== "enabled") {
    return (
      <span key={item.key} className={"customerShellNavItem customerShellNavItemDisabled" + activeClass} title={hint} aria-disabled="true" data-nav-status={item.status}>
        <span>{label}</span>
        <small>{status}</small>
      </span>
    );
  }

  return (
    <NavLink key={item.key} to={item.to} title={hint} data-nav-status={item.status} className={() => "customerShellNavItem" + activeClass}>
      <span>{label}</span>
      <small>{status}</small>
    </NavLink>
  );
}

function operatorNavigation(pathname: string, locale: LocaleCode): React.ReactNode {
  return OPERATOR_NAV_ITEMS.map((item) => renderNavItem(item, pathname, locale));
}

export default function OperatorLayout({ children, title, lead }: OperatorLayoutProps): React.ReactElement {
  const location = useLocation();
  const { locale } = useLocale();
  const resolvedTitle = title ?? resolveTitle(location.pathname, locale);
  const resolvedLead = lead ?? resolveLead(location.pathname, locale);
  const isPilotReadiness = location.pathname === "/operator/pilot";
  const mobileNavigationCopy = locale === "en-US"
    ? { open: "Open navigation", close: "Close navigation", panel: "Operator navigation menu" }
    : { open: "打开导航", close: "关闭导航", panel: "操作员导航菜单" };

  return (
    <div className="customerShell operatorShell" data-layout="operator-runtime-console-shell" data-layout-key="operator-shell" data-shell-surface="operator" data-h59="operator-runtime-console-shell" data-h63="pilot-readiness-product-surface" data-pfa2-locale={locale}>
      <aside className="customerShellSidebar operatorShellSidebar productShellDesktopSidebar" data-desktop-sidebar="true" aria-label={localizedText(OPERATOR_SHELL_LABELS.navigationAria, locale)}>
        <div className="customerShellBrand" aria-label={localizedText(OPERATOR_SHELL_LABELS.brand, locale)}>
          <span className="customerShellLogoMark" aria-hidden="true" />
          <span>{localizedText(OPERATOR_SHELL_LABELS.brand, locale)}</span>
        </div>

        <nav className="customerShellNav" aria-label={localizedText(OPERATOR_SHELL_LABELS.navigationAria, locale)}>
          {operatorNavigation(location.pathname, locale)}
        </nav>

        <div className="customerShellMeta" aria-label={localizedText(OPERATOR_SHELL_LABELS.productBoundaryAria, locale)}>
          <div>{localizedText(OPERATOR_SHELL_LABELS.productSurface, locale)}</div>
          <strong>{localizedText(OPERATOR_SHELL_LABELS.titles.fallback, locale)}</strong>
          <div>{localizedText(OPERATOR_SHELL_LABELS.boundaryLabel, locale)}</div>
          <strong>{localizedText(OPERATOR_SHELL_LABELS.boundaryValue, locale)}</strong>
        </div>

        <div className="customerShellFooterNote">{localizedText(OPERATOR_SHELL_LABELS.footerNote, locale)}</div>
      </aside>

      <div className="customerShellMainWrap">
        <header className="customerShellTopbar">
          <div className="customerShellHeading">
            <div className="customerShellContext">{localizedText(OPERATOR_SHELL_LABELS.titles.fallback, locale)}</div>
            <h1 className="customerShellTitle">{resolvedTitle}</h1>
            <div className="customerShellContext">{resolvedLead}</div>
          </div>
          <div className="customerShellTopActions">
            <ProductMobileNavigation
              pathname={location.pathname}
              surface="operator"
              navigationLabel={localizedText(OPERATOR_SHELL_LABELS.navigationAria, locale)}
              openLabel={mobileNavigationCopy.open}
              closeLabel={mobileNavigationCopy.close}
              panelLabel={mobileNavigationCopy.panel}
            >
              <nav className="customerShellNav productMobileNavigation__links" aria-label={mobileNavigationCopy.panel}>
                {operatorNavigation(location.pathname, locale)}
              </nav>
            </ProductMobileNavigation>
            <div className="operatorShellLocaleToggle shellLocaleToggle">
              <LocaleToggle />
            </div>
            <span className="customerShellUserMuted">
              {localizedText(OPERATOR_SHELL_LABELS.topbarReadonly, locale)}<br />
              <small>{localizedText(OPERATOR_SHELL_LABELS.runtimeShell, locale)}</small>
            </span>
          </div>
        </header>

        <section className="customerShellMeta operatorRuntimeModeBanner" aria-label={localizedText(OPERATOR_SHELL_LABELS.productBoundaryAria, locale)}>
          {RUNTIME_NONCLAIMS.map((claim) => {
            const text = localizedText(claim, locale);
            return <strong key={text}>{text}</strong>;
          })}
        </section>

        <main className="customerLayoutMain">{isPilotReadiness ? <OperatorPilotPage /> : children}</main>
      </div>
    </div>
  );
}
