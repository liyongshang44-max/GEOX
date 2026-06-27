import React from "react";
import { Navigate, NavLink, useLocation } from "react-router-dom";
import { CUSTOMER_SHELL_LABELS } from "../lib/customerLabels";
import { fetchSessionMe, type SessionMe } from "../api/session";
import RuntimeTextGuard from "../components/common/RuntimeTextGuard";

const CustomerFieldsIndexPage = React.lazy(() => import("../views/CustomerFieldsIndexPage"));
const CustomerOperationsIndexPage = React.lazy(() => import("../views/CustomerOperationsIndexPage"));
const CustomerReportsCenterPage = React.lazy(() => import("../views/CustomerReportsCenterPage"));

type CustomerLayoutProps = { children: React.ReactNode };

type CustomerNavItem = { key: string; label: string; to?: string; hint?: string; disabled?: boolean };

const CUSTOMER_NAV_ITEMS: CustomerNavItem[] = [
  { key: "dashboard", label: CUSTOMER_SHELL_LABELS.navDashboard, to: "/customer/dashboard" },
  { key: "fields", label: CUSTOMER_SHELL_LABELS.navFields, to: "/customer/fields", hint: "查看授权地块列表" },
  { key: "operations", label: CUSTOMER_SHELL_LABELS.navOperations, to: "/customer/operations", hint: "查看作业列表" },
  { key: "reports", label: CUSTOMER_SHELL_LABELS.navReports, to: "/customer/reports", hint: "查看报告中心" },
];

function resolvePageTitle(pathname: string): string {
  if (pathname === "/customer/dashboard") return "远程土地经营驾驶舱";
  if (pathname === "/customer/export") return "经营报告导出";
  if (pathname === "/customer/reports") return "报告中心";
  if (pathname === "/customer/fields" || pathname === "/customer/fields/index") return "地块列表";
  if (pathname === "/customer/operations" || pathname === "/customer/operations/index") return "作业列表";
  if (pathname.indexOf("/customer/fields/") >= 0) return "地块报告";
  if (pathname.indexOf("/customer/operations/") >= 0) return "作业报告";
  return "远程土地经营驾驶舱";
}

function resolveSubtitle(pathname: string): string {
  if (pathname === "/customer/dashboard") return "查看经营结论、重点风险与近期作业进展";
  if (pathname === "/customer/reports") return "查看总览、地块、作业、证据与价值报告入口";
  if (pathname === "/customer/fields" || pathname === "/customer/fields/index") return "查看授权地块、风险状态与地块报告入口";
  if (pathname === "/customer/operations" || pathname === "/customer/operations/index") return "查看近期作业、验收进展与报告入口";
  if (pathname.indexOf("/customer/fields/") >= 0) return "查看地块状态、近期作业、价值记录与长期变化";
  if (pathname.indexOf("/customer/operations/") >= 0) return "查看作业建议、审批、执行、证据、验收与价值记录";
  return "查看可交付的客户报告视图";
}

function isItemActive(pathname: string, key: string): boolean {
  if (key === "dashboard") return pathname === "/customer/dashboard";
  if (key === "fields") return pathname === "/customer/fields" || pathname.indexOf("/customer/fields/") >= 0;
  if (key === "operations") return pathname === "/customer/operations" || pathname.indexOf("/customer/operations/") >= 0;
  if (key === "reports") return pathname === "/customer/reports" || pathname === "/customer/export" || pathname.endsWith("/export");
  return false;
}

function roleOf(session: SessionMe | null): string {
  return String(session?.role ?? session?.roles?.[0] ?? "").trim().toLowerCase();
}

function accountScopeCopy(session: SessionMe | null): { scopeLine: string; statusLine: string } {
  if (!session) return { scopeLine: "授权范围待确认", statusLine: "正在读取权限" };
  const count = session.allowed_field_ids.length;
  const scopeMode = String(session.customer_scope?.scope_mode ?? "").toUpperCase();
  if (scopeMode === "INTERNAL_PREVIEW" || (roleOf(session) !== "client" && count === 0)) return { scopeLine: "内部预览", statusLine: "全域预览" };
  if (roleOf(session) === "client" && count === 0) return { scopeLine: "暂无授权地块", statusLine: "请联系运营开通" };
  return { scopeLine: `授权地块 ${count} 块`, statusLine: "授权范围已确认" };
}

export default function CustomerLayout({ children }: CustomerLayoutProps): React.ReactElement {
  const location = useLocation();
  const title = resolvePageTitle(location.pathname);
  const [session, setSession] = React.useState<SessionMe | null>(null);
  React.useEffect(() => {
    let alive = true;
    fetchSessionMe().then((x) => { if (alive) setSession(x); }).catch(() => { if (alive) setSession(null); });
    return () => { alive = false; };
  }, []);
  const accountName = session?.display_name || session?.user_id || CUSTOMER_SHELL_LABELS.accountFallback;
  const accountScope = accountScopeCopy(session);

  const isExportRoute = location.pathname === "/customer/export" || location.pathname.endsWith("/export");
  const mainContent = location.pathname === "/customer/fields" ? (
    <React.Suspense fallback={<div className="customerCard">页面加载中...</div>}>
      <CustomerFieldsIndexPage />
    </React.Suspense>
  ) : location.pathname === "/customer/operations" ? (
    <React.Suspense fallback={<div className="customerCard">页面加载中...</div>}>
      <CustomerOperationsIndexPage />
    </React.Suspense>
  ) : location.pathname === "/customer/reports" ? (
    <React.Suspense fallback={<div className="customerCard">页面加载中...</div>}>
      <CustomerReportsCenterPage />
    </React.Suspense>
  ) : children;

  if (location.pathname === "/customer/fields/index") return <Navigate to="/customer/fields" replace />;
  if (location.pathname === "/customer/operations/index") return <Navigate to="/customer/operations" replace />;
  if (isExportRoute) return <main className="customerLayoutMain customerLayoutPrintOnly"><RuntimeTextGuard />{children}</main>;

  return (
    <div className="customerShell" data-layout="customer-shell">
      <RuntimeTextGuard />
      <aside className="customerShellSidebar" aria-label="客户导航">
        <div className="customerShellBrand" aria-label={CUSTOMER_SHELL_LABELS.brand}>
          <span className="customerShellLogoMark" aria-hidden="true" />
          <span>{CUSTOMER_SHELL_LABELS.brand}</span>
        </div>
        <nav className="customerShellNav">
          {CUSTOMER_NAV_ITEMS.map((item) => item.disabled || !item.to ? (
            <span key={item.key} title={item.hint || item.label} className="customerShellNavItem customerShellNavItemDisabled" aria-disabled="true">
              <span>{item.label}</span>
            </span>
          ) : (
            <NavLink key={item.key} to={item.to} title={item.hint || item.label} className={() => "customerShellNavItem" + (isItemActive(location.pathname, item.key) ? " isActive" : "")}>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="customerShellMeta">
          <div>客户账户</div>
          <strong>{accountName}</strong>
          <div>{accountScope.scopeLine}</div>
          <strong>{accountScope.statusLine}</strong>
        </div>
        <div className="customerShellFooterNote">{CUSTOMER_SHELL_LABELS.sidebarFooter}</div>
      </aside>
      <div className="customerShellMainWrap">
        <header className="customerShellTopbar">
          <div className="customerShellHeading">
            <h1 className="customerShellTitle">{title}</h1>
            <div className="customerShellContext">{resolveSubtitle(location.pathname)}</div>
          </div>
          <div className="customerShellTopActions">
            <input
              className="customerShellSearch"
              placeholder={CUSTOMER_SHELL_LABELS.searchPlaceholder}
              aria-label="客户侧搜索暂未开放"
              disabled
            />
            <span className="customerShellAccountBadge" aria-hidden="true" />
            <span className="customerShellUserMuted">
              {accountName}<br />
              <small>{accountScope.statusLine}</small>
            </span>
          </div>
        </header>
        <main className="customerLayoutMain">{mainContent}</main>
      </div>
    </div>
  );
}
