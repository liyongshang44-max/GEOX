import React from "react";
import { NavLink } from "react-router-dom";
import AppBreadcrumb, { type AppBreadcrumbItem } from "../components/layout/AppBreadcrumb";

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
        <button className="btn" type="button">租户切换</button>
        <button className="btn" type="button">用户菜单</button>
        <NavLink className="btn primary" to={primaryAction.to} onClick={onPrimaryActionClick}>{primaryAction.label}</NavLink>
      </div>
    </header>
  );
}
