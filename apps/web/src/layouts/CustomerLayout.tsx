import React from "react";
import { NavLink, useLocation } from "react-router-dom";

type CustomerLayoutProps = { children: React.ReactNode };

type CustomerNavItem = { key: string; label: string; to: string; phase?: string; hint?: string };

const CUSTOMER_NAV_ITEMS: CustomerNavItem[] = [
  { key: "dashboard", label: "总览", to: "/customer/dashboard" },
  { key: "fields", label: "地块", to: "/customer/fields/index", phase: "P0", hint: "查看授权地块列表" },
  { key: "operations", label: "作业", to: "/customer/operations/index", phase: "P0", hint: "查看近期作业列表" },
  { key: "reports", label: "报告", to: "/customer/export" },
];

function resolvePageTitle(pathname: string): string {
  if (pathname === "/customer/dashboard") return "远程土地经营驾驶舱";
  if (pathname === "/customer/export") return "经营驾驶舱导出";
  if (pathname === "/customer/fields/index") return "地块列表";
  if (pathname === "/customer/operations/index") return "作业列表";
  if (pathname.indexOf("/customer/fields/") >= 0) return "地块报告";
  if (pathname.indexOf("/customer/operations/") >= 0) return "作业报告";
  return "远程土地经营驾驶舱";
}

function resolveSubtitle(pathname: string): string {
  if (pathname === "/customer/dashboard") return "P0 cockpit-lite：先看结论，再看证据";
  if (pathname === "/customer/fields/index") return "授权地块 P0：风险列表、地块入口与报告跳转";
  if (pathname === "/customer/operations/index") return "近期作业 P0：作业摘要、验收状态与报告跳转";
  if (pathname.indexOf("/customer/fields/") >= 0) return "地块病历 P0：风险、作业、价值与记忆空态";
  if (pathname.indexOf("/customer/operations/") >= 0) return "八段闭环 P0：建议、处方、审批、执行、证据、验收、ROI、记忆";
  return "客户报告打印视图";
}

function isItemActive(pathname: string, key: string): boolean {
  if (key === "dashboard") return pathname === "/customer/dashboard";
  if (key === "fields") return pathname.indexOf("/customer/fields") >= 0;
  if (key === "operations") return pathname.indexOf("/customer/operations") >= 0;
  if (key === "reports") return pathname === "/customer/export" || pathname.endsWith("/export");
  return false;
}

export default function CustomerLayout({ children }: CustomerLayoutProps): React.ReactElement {
  const location = useLocation();
  const title = resolvePageTitle(location.pathname);
  const isExportRoute = location.pathname === "/customer/export" || location.pathname.endsWith("/export");

  if (isExportRoute) return <main className="customerLayoutMain customerLayoutPrintOnly">{children}</main>;

  return (
    <div className="customerShell" data-layout="customer-shell">
      <aside className="customerShellSidebar" aria-label="客户导航">
        <div className="customerShellBrand"><span className="customerShellLogoMark">G</span><span>GEOX</span></div>
        <nav className="customerShellNav">
          {CUSTOMER_NAV_ITEMS.map((item) => (
            <NavLink key={item.key} to={item.to} title={item.hint || item.label} className={() => "customerShellNavItem" + (isItemActive(location.pathname, item.key) ? " isActive" : "")}>
              <span>{item.label}</span>{item.phase ? <span className="customerShellPhase">{item.phase}</span> : null}
            </NavLink>
          ))}
        </nav>
        <div className="customerShellMeta"><div>客户视图</div><strong>授权地块范围</strong></div>
        <div className="customerShellCollapse">← 收起菜单</div>
      </aside>
      <div className="customerShellMainWrap">
        <header className="customerShellTopbar">
          <div><h1 className="customerShellTitle">{title}</h1><div className="customerShellContext">{resolveSubtitle(location.pathname)}</div></div>
          <div className="customerShellTopActions">
            <input className="customerShellSearch" placeholder="搜索地块、作业或报告..." disabled />
            <span className="customerShellIconMuted" aria-hidden="true">i</span>
            <span className="customerShellIconMuted" aria-hidden="true">?</span>
            <span className="customerShellUserBadge">张</span>
            <span className="customerShellUserMuted">张佳<br /><small>客户视图 / 授权地块</small></span>
          </div>
        </header>
        <main className="customerLayoutMain">{children}</main>
      </div>
    </div>
  );
}
