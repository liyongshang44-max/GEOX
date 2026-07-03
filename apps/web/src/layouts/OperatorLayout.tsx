// apps/web/src/layouts/OperatorLayout.tsx
// Purpose: provide the dedicated operator shell used by existing operator pages and the TK17 production workflow UX.
// Boundary: this shell must not become the Customer Delivery Portal or the Admin Control Plane Console.

import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import "../styles/operatorShell.css";

type OperatorLayoutProps = {
  children: React.ReactNode;
  title?: string;
  lead?: string;
};

type OperatorNavItem = {
  key: string;
  label: string;
  to: string;
  hint: string;
  disabled?: boolean;
};

const OPERATOR_NAV_ITEMS: OperatorNavItem[] = [
  {
    key: "twin",
    label: "Twin 总览",
    to: "/operator/twin",
    hint: "查看田块状态、判断置信度与数据缺口。",
  },
  {
    key: "production-workflow",
    label: "生产工作流",
    to: "/operator/twin/production-workflow",
    hint: "显式接入生产来源引用，并由操作员推进 formalization；不自动执行。",
  },
  {
    key: "gateway-demo",
    label: "Gateway Demo",
    to: "/operator/twin/gateway-demo",
    hint: "展示 P51 gateway-backed snapshot；只读，不接真实设备，不执行。",
  },
  {
    key: "forecast",
    label: "预测",
    to: "/operator/twin",
    hint: "预测面板将在后续 H 阶段开放。",
    disabled: true,
  },
  {
    key: "scenarios",
    label: "情景",
    to: "/operator/twin",
    hint: "情景比较将在后续 H 阶段开放。",
    disabled: true,
  },
  {
    key: "evidence",
    label: "证据质量",
    to: "/operator/twin",
    hint: "证据质量面板将在后续 H 阶段开放。",
    disabled: true,
  },
  {
    key: "calibration",
    label: "校准回放",
    to: "/operator/twin",
    hint: "预测回放和模型校准将在后续 H 阶段开放。",
    disabled: true,
  },
];

function isItemActive(pathname: string, item: OperatorNavItem): boolean {
  if (item.key === "gateway-demo") return pathname === "/operator/twin/gateway-demo";
  if (item.key === "production-workflow") return pathname === "/operator/twin/production-workflow";
  if (item.key === "twin") return pathname === "/operator/twin" || pathname.startsWith("/operator/twin/fields/");
  return false;
}

function resolveTitle(pathname: string): string {
  if (pathname === "/operator/twin") return "操作员数字孪生工作台";
  if (pathname === "/operator/twin/production-workflow") return "生产工作流";
  if (pathname === "/operator/twin/gateway-demo") return "Gateway 支撑的 Twin Demo Viewer";
  if (pathname.startsWith("/operator/twin/fields/")) return "地块 Twin 工作区";
  return "操作员工作台";
}

function resolveLead(pathname: string): string {
  if (pathname === "/operator/twin") return "查看田块状态、预测缺口、低置信判断与人工确认入口。";
  if (pathname === "/operator/twin/production-workflow") return "接入生产来源引用，并由操作员显式推进 session、review 与 formalization。";
  if (pathname === "/operator/twin/gateway-demo") return "只读展示 P51 gateway-backed snapshot：device-path simulation、标准映射、去重、clock skew、ingestion window 与 traceability。";
  if (pathname.startsWith("/operator/twin/fields/")) return "按事实、估计、预测、情景分层查看单地块数字孪生状态。";
  return "操作员侧用于分析、复核和人工确认，不承担客户报告或后台治理职责。";
}

export default function OperatorLayout({
  children,
  title,
  lead,
}: OperatorLayoutProps): React.ReactElement {
  const location = useLocation();
  const resolvedTitle = title ?? resolveTitle(location.pathname);
  const resolvedLead = lead ?? resolveLead(location.pathname);

  return (
    <div className="customerShell operatorShell" data-layout="operator-shell">
      <aside className="customerShellSidebar operatorShellSidebar" aria-label="操作员导航">
        <div className="customerShellBrand" aria-label="GEOX 操作员 Twin">
          <span className="customerShellLogoMark" aria-hidden="true" />
          <span>GEOX 操作员 Twin</span>
        </div>

        <nav className="customerShellNav" aria-label="操作员数字孪生导航">
          {OPERATOR_NAV_ITEMS.map((item) =>
            item.disabled ? (
              <span
                key={item.key}
                className="customerShellNavItem customerShellNavItemDisabled"
                title={item.hint}
                aria-disabled="true"
              >
                <span>{item.label}</span>
              </span>
            ) : (
              <NavLink
                key={item.key}
                to={item.to}
                title={item.hint}
                className={() => "customerShellNavItem" + (isItemActive(location.pathname, item) ? " isActive" : "")}
              >
                <span>{item.label}</span>
              </NavLink>
            )
          )}
        </nav>

        <div className="customerShellMeta">
          <div>产品面</div>
          <strong>操作员数字孪生工作台</strong>
          <div>边界</div>
          <strong>分析与人工确认，不直接执行</strong>
        </div>

        <div className="customerShellFooterNote">
          情景只能进入建议、审批和人工确认链路，不能直接形成作业输出。
        </div>
      </aside>

      <div className="customerShellMainWrap">
        <header className="customerShellTopbar">
          <div className="customerShellHeading">
            <h1 className="customerShellTitle">{resolvedTitle}</h1>
            <div className="customerShellContext">{resolvedLead}</div>
          </div>
          <div className="customerShellTopActions">
            <span className="customerShellUserMuted">
              只读 v1<br />
              <small>操作员壳层</small>
            </span>
          </div>
        </header>

        <main className="customerLayoutMain">{children}</main>
      </div>
    </div>
  );
}
