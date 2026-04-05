import React from "react";
import { NavLink } from "react-router-dom";

function SidebarLink({ to, label }: { to: string; label: string }): React.ReactElement {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => `sideLink ${isActive ? "active" : ""}`}
      end={to === "/" || to === "/dashboard"}
    >
      {label}
    </NavLink>
  );
}

export default function AppNav({ expert }: { expert: boolean }): React.ReactElement {
  return (
    <aside className="sidebar card">
      <div className="sidebarBrand">
        <div className="brandMark">G</div>
        <div>
          <div className="brandName">GEOX</div>
          <div className="brandSub">农业运营控制台</div>
        </div>
      </div>

      <div className="sideGroupTitle">业务导航</div>
      <nav className="sideNav">
        <SidebarLink to="/dashboard" label="监控台" />
        <SidebarLink to="/fields" label="田块" />
        <SidebarLink to="/devices" label="设备" />
        <SidebarLink to="/operations" label="作业" />
        <SidebarLink to="/programs" label="经营方案" />
        <SidebarLink to="/audit-export" label="证据中心" />
      </nav>

      <div className="sideGroupTitle">二级入口</div>
      <nav className="sideNav">
        <SidebarLink to="/delivery/export-jobs" label="导出报告" />
        <SidebarLink to="/devices/onboarding" label="设备接入向导" />
        <SidebarLink to="/human-assignments" label="人工执行" />
        <SidebarLink to="/agronomy/recommendations" label="农业建议" />
        <SidebarLink to="/alerts" label="告警中心" />
        <SidebarLink to="/settings" label="系统设置" />
      </nav>

      {expert ? (
        <>
          <div className="sideGroupTitle">研发工具</div>
          <nav className="sideNav">
            <SidebarLink to="/dev" label="研发工具首页" />
          </nav>
        </>
      ) : null}
    </aside>
  );
}
