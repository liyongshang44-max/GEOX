// apps/web/src/layouts/CustomerLayout.tsx
import React from "react";
import { Navigate, NavLink, useLocation } from "react-router-dom";
import { fetchSessionMe, type SessionMe } from "../api/session";
import LocaleToggle from "../components/common/LocaleToggle";
import RuntimeTextGuard from "../components/common/RuntimeTextGuard";
import { localizedText, useLocale, type LocaleCode } from "../lib/locale";
import { CUSTOMER_SHELL_LABELS, type ShellNavCopy } from "../lib/productSurfaceLabels";

type CustomerLayoutProps = { children: React.ReactNode };

type CustomerNavItem = { key: string; copy: ShellNavCopy; to?: string; disabled?: boolean };

const CUSTOMER_NAV_ITEMS: CustomerNavItem[] = [
  { key: "dashboard", copy: CUSTOMER_SHELL_LABELS.nav.dashboard, to: "/customer/dashboard" },
  { key: "fields", copy: CUSTOMER_SHELL_LABELS.nav.fields, to: "/customer/fields" },
  { key: "operations", copy: CUSTOMER_SHELL_LABELS.nav.operations, to: "/customer/operations" },
  { key: "reports", copy: CUSTOMER_SHELL_LABELS.nav.reports, to: "/customer/reports" },
  { key: "export", copy: CUSTOMER_SHELL_LABELS.nav.export, to: "/customer/export" },
];

function labelOf(copy: ShellNavCopy, locale: LocaleCode): string {
  return localizedText(copy.label, locale);
}

function hintOf(copy: ShellNavCopy, locale: LocaleCode): string {
  return copy.hint ? localizedText(copy.hint, locale) : localizedText(copy.label, locale);
}

function resolvePageTitle(pathname: string, locale: LocaleCode): string {
  if (pathname === "/customer/dashboard") return localizedText(CUSTOMER_SHELL_LABELS.titles.dashboard, locale);
  if (pathname === "/customer/export") return localizedText(CUSTOMER_SHELL_LABELS.titles.export, locale);
  if (pathname === "/customer/reports") return localizedText(CUSTOMER_SHELL_LABELS.titles.reports, locale);
  if (pathname === "/customer/fields" || pathname === "/customer/fields/index") return localizedText(CUSTOMER_SHELL_LABELS.titles.fields, locale);
  if (pathname === "/customer/operations" || pathname === "/customer/operations/index") return localizedText(CUSTOMER_SHELL_LABELS.titles.operations, locale);
  if (pathname.indexOf("/customer/fields/") >= 0) return localizedText(CUSTOMER_SHELL_LABELS.titles.fieldReport, locale);
  if (pathname.indexOf("/customer/operations/") >= 0) return localizedText(CUSTOMER_SHELL_LABELS.titles.operationReport, locale);
  return localizedText(CUSTOMER_SHELL_LABELS.titles.dashboard, locale);
}

function resolveSubtitle(pathname: string, locale: LocaleCode): string {
  if (pathname === "/customer/dashboard") return localizedText(CUSTOMER_SHELL_LABELS.subtitles.dashboard, locale);
  if (pathname === "/customer/fields" || pathname === "/customer/fields/index") return localizedText(CUSTOMER_SHELL_LABELS.subtitles.fields, locale);
  if (pathname === "/customer/operations" || pathname === "/customer/operations/index") return localizedText(CUSTOMER_SHELL_LABELS.subtitles.operations, locale);
  if (pathname === "/customer/reports") return localizedText(CUSTOMER_SHELL_LABELS.subtitles.reports, locale);
  if (pathname === "/customer/export") return localizedText(CUSTOMER_SHELL_LABELS.subtitles.export, locale);
  if (pathname.indexOf("/customer/fields/") >= 0) return localizedText(CUSTOMER_SHELL_LABELS.subtitles.fieldReport, locale);
  if (pathname.indexOf("/customer/operations/") >= 0) return localizedText(CUSTOMER_SHELL_LABELS.subtitles.operationReport, locale);
  return localizedText(CUSTOMER_SHELL_LABELS.subtitles.fallback, locale);
}

function isItemActive(pathname: string, key: string): boolean {
  if (key === "dashboard") return pathname === "/customer/dashboard";
  if (key === "fields") return pathname === "/customer/fields" || pathname.indexOf("/customer/fields/") >= 0;
  if (key === "operations") return pathname === "/customer/operations" || pathname.indexOf("/customer/operations/") >= 0;
  if (key === "reports") return pathname === "/customer/reports";
  if (key === "export") return pathname === "/customer/export" || pathname.endsWith("/export");
  return false;
}

function roleOf(session: SessionMe | null): string {
  return String(session?.role ?? session?.roles?.[0] ?? "").trim().toLowerCase();
}

function accountScopeCopy(session: SessionMe | null, locale: LocaleCode): { scopeLine: string; statusLine: string } {
  if (!session) {
    return {
      scopeLine: localizedText(CUSTOMER_SHELL_LABELS.account.scopePending, locale),
      statusLine: localizedText(CUSTOMER_SHELL_LABELS.account.readingAccessScope, locale),
    };
  }

  const count = session.allowed_field_ids.length;
  const scopeMode = String(session.customer_scope?.scope_mode ?? "").toUpperCase();

  if (scopeMode === "INTERNAL_PREVIEW" || (roleOf(session) !== "client" && count === 0)) {
    return {
      scopeLine: localizedText(CUSTOMER_SHELL_LABELS.account.previewScope, locale),
      statusLine: localizedText(CUSTOMER_SHELL_LABELS.account.globalPreview, locale),
    };
  }

  if (roleOf(session) === "client" && count === 0) {
    return {
      scopeLine: localizedText(CUSTOMER_SHELL_LABELS.account.noAuthorizedFields, locale),
      statusLine: localizedText(CUSTOMER_SHELL_LABELS.account.contactOperations, locale),
    };
  }

  return {
    scopeLine: locale === "en-US" ? `${count} authorized fields` : `授权地块 ${count} 块`,
    statusLine: localizedText(CUSTOMER_SHELL_LABELS.account.authorizedScopeConfirmed, locale),
  };
}

export default function CustomerLayout({ children }: CustomerLayoutProps): React.ReactElement {
  const location = useLocation();
  const { locale } = useLocale();
  const title = resolvePageTitle(location.pathname, locale);
  const [session, setSession] = React.useState<SessionMe | null>(null);

  React.useEffect(() => {
    let alive = true;
    fetchSessionMe().then((x) => { if (alive) setSession(x); }).catch(() => { if (alive) setSession(null); });
    return () => { alive = false; };
  }, []);

  const accountName = session?.display_name || session?.user_id || localizedText(CUSTOMER_SHELL_LABELS.account.fallback, locale);
  const accountScope = accountScopeCopy(session, locale);
  const isExportRoute = location.pathname === "/customer/export" || location.pathname.endsWith("/export");

  if (location.pathname === "/customer/fields/index") return <Navigate to="/customer/fields" replace />;
  if (location.pathname === "/customer/operations/index") return <Navigate to="/customer/operations" replace />;
  if (isExportRoute) return <main className="customerLayoutMain customerLayoutPrintOnly"><RuntimeTextGuard />{children}</main>;

  return (
    <div className="customerShell" data-layout="customer-shell">
      <RuntimeTextGuard />
      <aside className="customerShellSidebar" aria-label={localizedText(CUSTOMER_SHELL_LABELS.navigationAria, locale)}>
        <div className="customerShellBrand" aria-label={localizedText(CUSTOMER_SHELL_LABELS.brand, locale)}>
          <span className="customerShellLogoMark" aria-hidden="true" />
          <span>{localizedText(CUSTOMER_SHELL_LABELS.brand, locale)}</span>
        </div>
        <nav className="customerShellNav">
          {CUSTOMER_NAV_ITEMS.map((item) => {
            const label = labelOf(item.copy, locale);
            const hint = hintOf(item.copy, locale);

            return item.disabled || !item.to ? (
              <span key={item.key} title={hint} className="customerShellNavItem customerShellNavItemDisabled" aria-disabled="true">
                <span>{label}</span>
              </span>
            ) : (
              <NavLink key={item.key} to={item.to} title={hint} className={() => "customerShellNavItem" + (isItemActive(location.pathname, item.key) ? " isActive" : "")}>
                <span>{label}</span>
              </NavLink>
            );
          })}
        </nav>
        <div className="customerShellMeta">
          <div>{localizedText(CUSTOMER_SHELL_LABELS.account.label, locale)}</div>
          <strong>{accountName}</strong>
          <div>{accountScope.scopeLine}</div>
          <strong>{accountScope.statusLine}</strong>
        </div>
        <div className="customerShellFooterNote">{localizedText(CUSTOMER_SHELL_LABELS.sidebarFooter, locale)}</div>
      </aside>
      <div className="customerShellMainWrap">
        <header className="customerShellTopbar">
          <div className="customerShellHeading">
            <h1 className="customerShellTitle">{title}</h1>
            <div className="customerShellContext">{resolveSubtitle(location.pathname, locale)}</div>
          </div>
          <div className="customerShellTopActions">
            <div className="customerShellLocaleToggle shellLocaleToggle">
              <LocaleToggle />
            </div>
            <input
              className="customerShellSearch"
              placeholder={localizedText(CUSTOMER_SHELL_LABELS.searchPlaceholder, locale)}
              aria-label={localizedText(CUSTOMER_SHELL_LABELS.searchAria, locale)}
              disabled
            />
            <span className="customerShellAccountBadge" aria-hidden="true" />
            <span className="customerShellUserMuted">
              {accountName}<br />
              <small>{accountScope.statusLine}</small>
            </span>
          </div>
        </header>
        <main className="customerLayoutMain">{children}</main>
      </div>
    </div>
  );
}
