// apps/web/src/layouts/OperatorLayout.tsx
import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import LocaleToggle from "../components/common/LocaleToggle";
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

function renderNavItem(item: OperatorNavItem, pathname: string, locale: LocaleCode): React.ReactElement {
  const activeClass = isItemActive(pathname, item) ? " isActive" : "";
  const label = localizedText(item.copy.label, locale);
  const hint = item.copy.hint ? localizedText(item.copy.hint, locale) : label;
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

export default function OperatorLayout({ children, title, lead }: OperatorLayoutProps): React.ReactElement {
  const location = useLocation();
  const { locale } = useLocale();
  const resolvedTitle = title ?? resolveTitle(location.pathname, locale);
  const resolvedLead = lead ?? resolveLead(location.pathname, locale);
  const isPilotReadiness = location.pathname === "/operator/pilot";

  return (
    <div className="customerShell operatorShell" data-layout="operator-runtime-console-shell" data-h59="operator-runtime-console-shell" data-h63="pilot-readiness-product-surface">
      <aside className="customerShellSidebar operatorShellSidebar" aria-label={localizedText(OPERATOR_SHELL_LABELS.navigationAria, locale)}>
        <div className="customerShellBrand" aria-label={localizedText(OPERATOR_SHELL_LABELS.brand, locale)}>
          <span className="customerShellLogoMark" aria-hidden="true" />
          <span>{localizedText(OPERATOR_SHELL_LABELS.brand, locale)}</span>
        </div>

        <nav className="customerShellNav" aria-label={localizedText(OPERATOR_SHELL_LABELS.navigationAria, locale)}>
          {OPERATOR_NAV_ITEMS.map((item) => renderNavItem(item, location.pathname, locale))}
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
            <div className="operatorShellLocaleToggle shellLocaleToggle">
              <LocaleToggle />
            </div>
            <span className="customerShellUserMuted">
              {localizedText(OPERATOR_SHELL_LABELS.topbarReadonly, locale)}<br />
              <small>{localizedText(OPERATOR_SHELL_LABELS.runtimeShell, locale)}</small>
            </span>
          </div>
        </header>

        <section className="customerShellMeta operatorRuntimeModeBanner" aria-label="Runtime mode and live-device nonclaims">
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
