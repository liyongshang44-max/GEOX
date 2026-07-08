// apps/web/src/layouts/CustomerLayout.tsx
// Purpose: render the Customer Portal with persistent desktop navigation and compact responsive navigation.
// Boundary: route topology, session scope, permissions, APIs, and customer report semantics remain unchanged.

import React from "react";
import { Navigate, NavLink, useLocation } from "react-router-dom";
import { fetchSessionMe, type SessionMe } from "../api/session";
import LocaleToggle from "../components/common/LocaleToggle";
import ProductMobileNavigation from "../components/layout/ProductMobileNavigation";
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
  if (pathname.includes("/customer/fields/")) return localizedText(CUSTOMER_SHELL_LABELS.titles.fieldReport, locale);
  if (pathname.includes("/customer/operations/")) return localizedText(CUSTOMER_SHELL_LABELS.titles.operationReport, locale);
  return localizedText(CUSTOMER_SHELL_LABELS.titles.dashboard, locale);
}

function resolveSubtitle(pathname: string, locale: LocaleCode): string {
  if (pathname === "/customer/dashboard") return localizedText(CUSTOMER_SHELL_LABELS.subtitles.dashboard, locale);
  if (pathname === "/customer/fields" || pathname === "/customer/fields/index") return localizedText(CUSTOMER_SHELL_LABELS.subtitles.fields, locale);
  if (pathname === "/customer/operations" || pathname === "/customer/operations/index") return localizedText(CUSTOMER_SHELL_LABELS.subtitles.operations, locale);
  if (pathname === "/customer/reports") return localizedText(CUSTOMER_SHELL_LABELS.subtitles.reports, locale);
  if (pathname === "/customer/export") return localizedText(CUSTOMER_SHELL_LABELS.subtitles.export, locale);
  if (pathname.includes("/customer/fields/")) return localizedText(CUSTOMER_SHELL_LABELS.subtitles.fieldReport, locale);
  if (pathname.includes("/customer/operations/")) return localizedText(CUSTOMER_SHELL_LABELS.subtitles.operationReport, locale);
  return localizedText(CUSTOMER_SHELL_LABELS.subtitles.fallback, locale);
}

function isItemActive(pathname: string, key: string): boolean {
  if (key === "dashboard") return pathname === "/customer/dashboard";
  if (key === "fields") return pathname === "/customer/fields" || pathname.includes("/customer/fields/");
  if (key === "operations") return pathname === "/customer/operations" || pathname.includes("/customer/operations/");
  if (key === "reports") return pathname === "/customer/reports";
  if (key === "export") return pathname === "/customer/export" || pathname.endsWith("/export");
  return false;
}

function roleOf(session: SessionMe | null): string {
  return String(session?.role ?? session?.roles?.[0] ?? "").trim().toLowerCase();
}

function accountScopeCopy(session: SessionMe | null, locale: LocaleCode): { scopeLine: string; statusLine: string } {
  if (!session) return { scopeLine: localizedText(CUSTOMER_SHELL_LABELS.account.scopePending, locale), statusLine: localizedText(CUSTOMER_SHELL_LABELS.account.readingAccessScope, locale) };
  const count = session.allowed_field_ids.length;
  const scopeMode = String(session.customer_scope?.scope_mode ?? "").toUpperCase();
  if (scopeMode === "INTERNAL_PREVIEW" || (roleOf(session) !== "client" && count === 0)) return { scopeLine: localizedText(CUSTOMER_SHELL_LABELS.account.previewScope, locale), statusLine: localizedText(CUSTOMER_SHELL_LABELS.account.globalPreview, locale) };
  if (roleOf(session) === "client" && count === 0) return { scopeLine: localizedText(CUSTOMER_SHELL_LABELS.account.noAuthorizedFields, locale), statusLine: localizedText(CUSTOMER_SHELL_LABELS.account.contactOperations, locale) };
  return { scopeLine: locale === "en-US" ? `${count} authorized fields` : `授权地块 ${count} 块`, statusLine: localizedText(CUSTOMER_SHELL_LABELS.account.authorizedScopeConfirmed, locale) };
}

function renderCustomerNavigation(pathname: string, locale: LocaleCode): React.ReactNode {
  return CUSTOMER_NAV_ITEMS.map((item) => {
    const label = labelOf(item.copy, locale);
    const hint = hintOf(item.copy, locale);
    if (item.disabled || !item.to) {
      return <span key={item.key} title={hint} className="customerShellNavItem customerShellNavItemDisabled" aria-disabled="true"><span>{label}</span></span>;
    }
    return (
      <NavLink
        key={item.key}
        to={item.to}
        title={hint}
        className={() => "customerShellNavItem" + (isItemActive(pathname, item.key) ? " isActive" : "")}
      >
        <span>{label}</span>
      </NavLink>
    );
  });
}

export default function CustomerLayout({ children }: CustomerLayoutProps): React.ReactElement {
  const location = useLocation();
  const { locale } = useLocale();
  const title = resolvePageTitle(location.pathname, locale);
  const [session, setSession] = React.useState<SessionMe | null>(null);

  React.useEffect(() => {
    let active = true;
    fetchSessionMe().then((value) => { if (active) setSession(value); }).catch(() => { if (active) setSession(null); });
    return () => { active = false; };
  }, []);

  const accountName = session?.display_name || session?.user_id || localizedText(CUSTOMER_SHELL_LABELS.account.fallback, locale);
  const accountScope = accountScopeCopy(session, locale);
  const isExportRoute = location.pathname === "/customer/export" || location.pathname.endsWith("/export");
  const mobileNavigationCopy = locale === "en-US"
    ? { open: "Open navigation", close: "Close navigation", panel: "Customer navigation menu" }
    : { open: "打开导航", close: "关闭导航", panel: "客户导航菜单" };

  if (location.pathname === "/customer/fields/index") return <Navigate to="/customer/fields" replace />;
  if (location.pathname === "/customer/operations/index") return <Navigate to="/customer/operations" replace />;
  if (isExportRoute) return <main className="customerLayoutMain customerLayoutPrintOnly" data-pfa2-locale={locale}>{children}</main>;

  return (
    <div className="customerShell" data-layout="customer-shell" data-layout-key="customer-shell" data-shell-surface="customer" data-pfa2-locale={locale}>
      <aside className="customerShellSidebar productShellDesktopSidebar" data-desktop-sidebar="true" aria-label={localizedText(CUSTOMER_SHELL_LABELS.navigationAria, locale)}>
        <div className="customerShellBrand" aria-label={localizedText(CUSTOMER_SHELL_LABELS.brand, locale)}><span className="customerShellLogoMark" aria-hidden="true" /><span>{localizedText(CUSTOMER_SHELL_LABELS.brand, locale)}</span></div>
        <nav className="customerShellNav" aria-label={localizedText(CUSTOMER_SHELL_LABELS.navigationAria, locale)}>
          {renderCustomerNavigation(location.pathname, locale)}
        </nav>
        <div className="customerShellMeta"><div>{localizedText(CUSTOMER_SHELL_LABELS.account.label, locale)}</div><strong>{accountName}</strong><div>{accountScope.scopeLine}</div><strong>{accountScope.statusLine}</strong></div>
        <div className="customerShellFooterNote">{localizedText(CUSTOMER_SHELL_LABELS.sidebarFooter, locale)}</div>
      </aside>
      <div className="customerShellMainWrap">
        <header className="customerShellTopbar">
          <div className="customerShellHeading"><h1 className="customerShellTitle">{title}</h1><div className="customerShellContext">{resolveSubtitle(location.pathname, locale)}</div></div>
          <div className="customerShellTopActions">
            <ProductMobileNavigation
              pathname={location.pathname}
              surface="customer"
              navigationLabel={localizedText(CUSTOMER_SHELL_LABELS.navigationAria, locale)}
              openLabel={mobileNavigationCopy.open}
              closeLabel={mobileNavigationCopy.close}
              panelLabel={mobileNavigationCopy.panel}
            >
              <nav className="customerShellNav productMobileNavigation__links" aria-label={mobileNavigationCopy.panel}>
                {renderCustomerNavigation(location.pathname, locale)}
              </nav>
            </ProductMobileNavigation>
            <div className="customerShellLocaleToggle shellLocaleToggle"><LocaleToggle /></div>
            <input className="customerShellSearch" placeholder={localizedText(CUSTOMER_SHELL_LABELS.searchPlaceholder, locale)} aria-label={localizedText(CUSTOMER_SHELL_LABELS.searchAria, locale)} disabled />
            <span className="customerShellAccountBadge" aria-hidden="true" />
            <span className="customerShellUserMuted">{accountName}<br /><small>{accountScope.statusLine}</small></span>
          </div>
        </header>
        <main className="customerLayoutMain">{children}</main>
      </div>
    </div>
  );
}
