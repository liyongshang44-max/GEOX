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
  { key: "reports", label: "报告", to: "/customer/export" },
];

function resolvePageTitle(pathname: string): string {
  if (pathname === "/customer/dashboard") return "客户总览";
  if (pathname === "/customer/export") return "客户报告导出";
  if (pathname.includes("/customer/fields/")) return "地块详情";
  if (pathname.includes("/customer/operations/")) return "作业详情";
  return "客户总览";
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
        <div className="customerShellBrand">GEOX / Customer</div>
        <div className="customerShellIdentity">
          <div className="customerShellIdentityLabel">客户身份</div>
          <div className="customerShellIdentityValue">客户管理员 / 当前角色：运营观察者</div>
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
            <div className="customerShellContext">客户上下文 / 企业农业经营空间</div>
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
            <Link className="customerButton customerButtonPrimary" to="/customer/dashboard">主行动入口</Link>
            <Link className="customerButton" to="/customer/export">导出入口</Link>
          </div>
        </header>
        <main className="customerLayoutMain">{children}</main>
      </div>
    </div>
  );
}
