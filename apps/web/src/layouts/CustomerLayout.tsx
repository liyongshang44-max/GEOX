import React from "react";
import { Link, NavLink, useLocation } from "react-router-dom";

type CustomerLayoutProps = {
  children: React.ReactNode;
};

type CustomerNavItem = {
  key: string;
  label: string;
  to?: string;
  disabled?: boolean;
};

const CUSTOMER_NAV_ITEMS: CustomerNavItem[] = [
  { key: "dashboard", label: "总览", to: "/customer/dashboard" },
  { key: "fields", label: "地块 P1 disabled", disabled: true },
  { key: "operations", label: "作业 P1 disabled", disabled: true },
  { key: "reports", label: "报告", to: "/customer/export" },
  { key: "customer_view", label: "客户视图", disabled: true },
  { key: "scope", label: "授权地块范围", disabled: true },
  { key: "collapse", label: "收起菜单", disabled: true },
];

function resolvePageTitle(pathname: string): string {
  if (pathname === "/customer/dashboard") return "经营驾驶舱";
  if (pathname === "/customer/export") return "经营驾驶舱导出";
  if (pathname.includes("/customer/fields/")) return "地块报告";
  if (pathname.includes("/customer/operations/")) return "作业报告";
  return "经营驾驶舱";
}

export default function CustomerLayout({ children }: CustomerLayoutProps): React.ReactElement {
  const location = useLocation();
  const title = resolvePageTitle(location.pathname);

  return (
    <div className="customerShell" data-layout="customer-shell">
      <aside className="customerShellSidebar" aria-label="客户导航">
        <div className="customerShellBrand">GEOX logo</div>
        <nav className="customerShellNav">
          {CUSTOMER_NAV_ITEMS.map((item) => {
            if (item.disabled) {
              return <span key={item.key} className="customerShellNavItem customerShellNavItemDisabled">{item.label}</span>;
            }
            return (
              <NavLink key={item.key} to={item.to ?? "/customer/dashboard"} className={({ isActive }) => `customerShellNavItem${isActive ? " isActive" : ""}`}>
                {item.label}
              </NavLink>
            );
          })}
        </nav>
      </aside>
      <div className="customerShellMainWrap">
        <header className="customerShellTopbar">
          <div>
            <h1 className="customerShellTitle">{title}</h1>
            <div className="customerShellContext">面向客户展示经营进展、风险、作业和报告的简明视图。</div>
          </div>
          <div className="customerShellTopActions">
            <input className="customerShellSearch" placeholder="搜索地块、作业或报告..." disabled />
            <span className="customerShellIconMuted" aria-hidden="true">🔔</span>
            <span className="customerShellIconMuted" aria-hidden="true">❓</span>
            <span className="customerShellUserMuted">张佳 / 客户视图</span>
          </div>
        </header>
        <main className="customerLayoutMain">{children}</main>
      </div>
    </div>
  );
}
