import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import AppBreadcrumb, { type AppBreadcrumbItem } from "../components/layout/AppBreadcrumb";
import { useSession } from "../auth/useSession";

export type TopBarProps = {
  breadcrumbs: AppBreadcrumbItem[];
  title: string;
  lead: string;
  primaryAction: {
    label: string;
    to: string;
  };
  onPrimaryActionClick?: () => void;
};

export default function TopBar({ breadcrumbs, title, lead, primaryAction, onPrimaryActionClick }: TopBarProps): React.ReactElement {
  const navigate = useNavigate();
  const { context, role, clearSession } = useSession();
  const contextLabel = context ? `${context.tenant_id} / ${context.project_id} / ${context.group_id}` : "未建立上下文";

  function onLogout(): void {
    clearSession();
    navigate("/login?reason=AUTH_MISSING", { replace: true });
  }

  return (
    <header className="newTopBar card">
      <div className="newTopBarLeft">
        <div className="newTopBarEyebrow">GEOX / 远程农业运营控制台</div>
        <div className="newTopBarBreadcrumbArea">
          <AppBreadcrumb items={breadcrumbs} />
        </div>
        <h1 className="pageTitle">{title}</h1>
        <div className="pageLead">{lead}</div>
      </div>

      <div className="newTopBarActions">
        <label className="newTopBarSearch" aria-label="全局搜索">
          <span className="newTopBarSearchLabel">搜索</span>
          <input type="search" placeholder="搜索田块/设备/作业" />
        </label>
        <button className="btn" type="button">告警</button>
        <div className="card" style={{ padding: "6px 10px", minWidth: 260 }}>
          <div style={{ fontSize: 12, opacity: 0.85 }}>当前上下文：{contextLabel}</div>
          <div style={{ fontSize: 12, opacity: 0.72 }}>角色：{role || "未识别"}</div>
        </div>
        <button className="btn" type="button" onClick={onLogout}>退出登录</button>
        <NavLink className="btn primary" to={primaryAction.to} onClick={onPrimaryActionClick}>{primaryAction.label}</NavLink>
      </div>
    </header>
  );
}
