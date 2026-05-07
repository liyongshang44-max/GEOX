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
  { key: "fields", label: "地块", disabled: true },
  { key: "operations", label: "作业", disabled: true },
  { key: "reports", label: "总览导出", to: "/customer/export" },
];

function resolvePageTitle(pathname: string): string {
  if (pathname === "/customer/dashboard") return "经营驾驶舱";
  if (pathname === "/customer/export") return "经营驾驶舱导出";
  if (pathname.includes("/customer/fields/")) return "地块报告";
  if (pathname.includes("/customer/operations/")) return "作业报告";
  return "经营驾驶舱";
}

function resolveBreadcrumb(pathname: string): Array<{ label: string; to?: string }> {
  const root = [{ label: "客户空间", to: "/customer/dashboard" }];
  if (pathname === "/customer/export") return [...root, { label: "报告导出" }];
  if (pathname.includes("/customer/fields/")) return [...root, { label: "地块" }, { label: "详情" }];
  if (pathname.includes("/customer/operations/")) return [...root, { label: "作业" }, { label: "详情" }];
  return [...root, { label: "总览" }];
}

export default function CustomerLayout({ children }: CustomerLayoutProps): React.ReactElement {
  const location = useLocation();
  const title = resolvePageTitle(location.pathname);
  const breadcrumb = resolveBreadcrumb(location.pathname);

  return (
    <div className="customerShell" data-layout="customer-shell">
      <aside className="customerShellSidebar" aria-label="客户导航">
        <div className="customerShellBrand">GEOX 远程土地经营</div>
        <div className="customerShellIdentity">
          <div className="customerShellIdentityLabel">当前视图：客户视图</div>
          <div className="customerShellIdentityValue">范围：授权地块</div>
        </div>
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
            <div className="customerShellContext">当前角色：客户视图（保守模式） · 当前范围：授权地块 · 当前页面：{title}</div>
            <h1 className="customerShellTitle">{title}</h1>
            <div className="customerShellBreadcrumb">
              {breadcrumb.map((item, idx) => (
                <React.Fragment key={`${item.label}-${idx}`}>
                  {idx > 0 ? <span>/</span> : null}
                  {item.to ? <Link to={item.to}>{item.label}</Link> : <span>{item.label}</span>}
                </React.Fragment>
              ))}
            </div>
          </div>
          <div className="customerShellActions">
            {location.pathname === "/customer/dashboard" ? <Link className="customerButton" to="/customer/export">总览导出</Link> : null}
            {location.pathname !== "/customer/dashboard" ? <Link className="customerButton" to="/customer/dashboard">返回总览</Link> : null}
          </div>
        </header>
        <main className="customerLayoutMain">{children}</main>
      </div>
    </div>
  );
}
