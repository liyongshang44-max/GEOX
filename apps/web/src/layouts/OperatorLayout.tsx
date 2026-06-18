// apps/web/src/layouts/OperatorLayout.tsx
// Purpose: provide the dedicated operator shell used by existing operator pages and the new Operator Twin Workbench.
// Boundary: this shell must not become the Customer Delivery Portal or the Admin Control Plane Console.

import React from "react";
import { NavLink, useLocation } from "react-router-dom";

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
    hint: "查看需要预测分析的田块、低置信判断与数据缺口。",
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
  if (item.key === "twin") return pathname === "/operator/twin" || pathname.startsWith("/operator/twin/fields/");
  return false;
}

function resolveTitle(pathname: string): string {
  if (pathname === "/operator/twin") return "操作员数字孪生工作台";
  if (pathname.startsWith("/operator/twin/fields/")) return "地块 Twin 工作区";
  return "操作员工作台";
}

function resolveLead(pathname: string): string {
  if (pathname === "/operator/twin") return "查看田块状态、预测缺口、低置信判断与人工确认入口。";
  if (pathname.startsWith("/operator/twin/fields/")) return "按 Fact / Estimate / Forecast / Scenario 分层查看单地块数字孪生状态。";
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
        <div className="customerShellBrand" aria-label="GEOX Operator Twin">
          <span className="customerShellLogoMark" aria-hidden="true" />
          <span>GEOX Operator Twin</span>
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
          <strong>Operator Twin Workbench</strong>
          <div>边界</div>
          <strong>分析与人工确认，不直接执行</strong>
        </div>

        <div className="customerShellFooterNote">
          情景只能进入 recommendation / approval 链路，不能直接变成 AO-ACT task。
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
              View-only v1<br />
              <small>Operator shell</small>
            </span>
          </div>
        </header>

        <main className="customerLayoutMain">{children}</main>
      </div>
    </div>
  );
}
