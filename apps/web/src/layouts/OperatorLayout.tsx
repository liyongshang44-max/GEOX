// apps/web/src/layouts/OperatorLayout.tsx
// Purpose: provide the Operator Runtime Console shell for existing operator pages and Pilot Readiness.
// Boundary: this shell is read-only; it does not create records or open controlled execution.

import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import OperatorPilotPage from "../features/operator/pilotReadiness/OperatorPilotPage";
import "../styles/operatorShell.css";

type OperatorLayoutProps = {
  children: React.ReactNode;
  title?: string;
  lead?: string;
};

type OperatorNavStatus = "enabled" | "coming-soon" | "route-preserved";

type OperatorNavItem = {
  key: string;
  label: string;
  to: string;
  hint: string;
  status: OperatorNavStatus;
};

const OPERATOR_NAV_ITEMS: OperatorNavItem[] = [
  {
    key: "overview",
    label: "Overview",
    to: "/operator/twin",
    hint: "Runtime Overview uses the preserved operator twin overview route until canonical route ownership is finalized.",
    status: "enabled",
  },
  {
    key: "fields",
    label: "Fields",
    to: "/operator/twin",
    hint: "Field Runtime list is planned; current field workspace routes remain preserved by URL.",
    status: "route-preserved",
  },
  {
    key: "evidence",
    label: "Evidence",
    to: "/operator/twin",
    hint: "Evidence Center enters formal navigation after route behavior review; current evidence capabilities remain preserved by URL or field drawer.",
    status: "coming-soon",
  },
  {
    key: "forecast",
    label: "Forecast",
    to: "/operator/twin",
    hint: "Forecast is available through Field Runtime review tabs and is not a recommendation.",
    status: "coming-soon",
  },
  {
    key: "calibration",
    label: "Calibration",
    to: "/operator/twin",
    hint: "Calibration is available through Field Runtime review tabs and does not update model state.",
    status: "coming-soon",
  },
  {
    key: "health",
    label: "Health",
    to: "/operator/twin",
    hint: "Runtime Health is available through Field Runtime Health Review; no broad operator health route is added.",
    status: "coming-soon",
  },
  {
    key: "pilot",
    label: "Pilot",
    to: "/operator/pilot",
    hint: "Pilot Readiness reviews planning and readiness gates. It is not field pilot execution.",
    status: "enabled",
  },
  {
    key: "settings",
    label: "Settings",
    to: "/operator/twin",
    hint: "Operator settings are planned for a later route review; this shell freezes the product navigation slot.",
    status: "coming-soon",
  },
];

const RUNTIME_NONCLAIMS = [
  "Runtime Mode: Replay-backed Demo",
  "Live Device: Not connected",
  "Production Gateway: Not online",
  "Field Pilot: Not started",
  "Controlled Execution: Disabled",
];

function isItemActive(pathname: string, item: OperatorNavItem): boolean {
  if (item.key === "overview") return pathname === "/operator/twin" || pathname === "/operator";
  if (item.key === "fields") return pathname.startsWith("/operator/twin/fields/");
  if (item.key === "pilot") return pathname === "/operator/pilot";
  return false;
}

function resolveTitle(pathname: string): string {
  if (pathname === "/operator/pilot") return "Pilot Readiness";
  if (pathname === "/operator/twin") return "Runtime Overview";
  if (pathname === "/operator/twin/production-workflow") return "Runtime Workflow Readback";
  if (pathname === "/operator/twin/gateway-demo") return "Replay-backed Gateway Snapshot";
  if (pathname.startsWith("/operator/twin/fields/")) return "Field Runtime";
  if (pathname.startsWith("/operator/twin/traces/")) return "Audit / Trace";
  return "Operator Runtime Console";
}

function resolveLead(pathname: string): string {
  if (pathname === "/operator/pilot") return "Review controlled pilot planning and readiness gates without starting field execution or writing product records.";
  if (pathname === "/operator/twin") return "Review runtime status, field readiness, evidence coverage, and replay-backed operating boundaries without creating tasks or records.";
  if (pathname === "/operator/twin/production-workflow") return "Read-only workflow readback for governed materialization boundaries; this shell does not open controlled execution or write formal records.";
  if (pathname === "/operator/twin/gateway-demo") return "Read-only replay-backed gateway snapshot; live devices are not connected and the production gateway is not online.";
  if (pathname.startsWith("/operator/twin/fields/")) return "Review a field through Evidence, State, Forecast, Residual, Calibration, Health, and Audit views while legacy routes remain preserved.";
  if (pathname.startsWith("/operator/twin/traces/")) return "Audit trace readback is available as a preserved route and does not mutate runtime state.";
  return "Read-only runtime surface for operator review; Customer Portal and Admin Console remain separate product surfaces.";
}

function renderNavItem(item: OperatorNavItem, pathname: string): React.ReactElement {
  const activeClass = isItemActive(pathname, item) ? " isActive" : "";
  const statusLabel = item.status === "enabled" ? "Route active" : item.status === "route-preserved" ? "Route preserved" : "Coming soon";

  if (item.status !== "enabled") {
    return (
      <span
        key={item.key}
        className={"customerShellNavItem customerShellNavItemDisabled" + activeClass}
        title={item.hint}
        aria-disabled="true"
        data-nav-status={item.status}
      >
        <span>{item.label}</span>
        <small>{statusLabel}</small>
      </span>
    );
  }

  return (
    <NavLink
      key={item.key}
      to={item.to}
      title={item.hint}
      data-nav-status={item.status}
      className={() => "customerShellNavItem" + activeClass}
    >
      <span>{item.label}</span>
      <small>{statusLabel}</small>
    </NavLink>
  );
}

export default function OperatorLayout({
  children,
  title,
  lead,
}: OperatorLayoutProps): React.ReactElement {
  const location = useLocation();
  const resolvedTitle = title ?? resolveTitle(location.pathname);
  const resolvedLead = lead ?? resolveLead(location.pathname);
  const isPilotReadiness = location.pathname === "/operator/pilot";

  return (
    <div className="customerShell operatorShell" data-layout="operator-runtime-console-shell" data-h59="operator-runtime-console-shell" data-h63="pilot-readiness-product-surface">
      <aside className="customerShellSidebar operatorShellSidebar" aria-label="Operator Runtime Console navigation">
        <div className="customerShellBrand" aria-label="GEOX Operator Runtime Console">
          <span className="customerShellLogoMark" aria-hidden="true" />
          <span>GEOX Operator Runtime Console</span>
        </div>

        <nav className="customerShellNav" aria-label="Operator Runtime Console navigation">
          {OPERATOR_NAV_ITEMS.map((item) => renderNavItem(item, location.pathname))}
        </nav>

        <div className="customerShellMeta" aria-label="Operator Runtime Console product boundary">
          <div>Product Surface</div>
          <strong>Operator Runtime Console</strong>
          <div>Boundary</div>
          <strong>Read-only runtime review; no direct execution</strong>
        </div>

        <div className="customerShellFooterNote">
          Legacy operator routes are preserved by URL. Pilot Readiness is review-only and does not open controlled execution.
        </div>
      </aside>

      <div className="customerShellMainWrap">
        <header className="customerShellTopbar">
          <div className="customerShellHeading">
            <div className="customerShellContext">Operator Runtime Console</div>
            <h1 className="customerShellTitle">{resolvedTitle}</h1>
            <div className="customerShellContext">{resolvedLead}</div>
          </div>
          <div className="customerShellTopActions">
            <span className="customerShellUserMuted">
              Read-only v1<br />
              <small>Runtime shell</small>
            </span>
          </div>
        </header>

        <section className="customerShellMeta operatorRuntimeModeBanner" aria-label="Runtime mode and live-device nonclaims">
          {RUNTIME_NONCLAIMS.map((claim) => (
            <strong key={claim}>{claim}</strong>
          ))}
        </section>

        <main className="customerLayoutMain">{isPilotReadiness ? <OperatorPilotPage /> : children}</main>
      </div>
    </div>
  );
}
