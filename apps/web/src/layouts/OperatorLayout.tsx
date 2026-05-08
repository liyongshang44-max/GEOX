import React from "react";
import { NavLink } from "react-router-dom";
import "../styles/operatorShell.css";

type OperatorLayoutProps = {
  title: string;
  lead: string;
  children: React.ReactNode;
};

const OPERATOR_NAV = [
  { to: "/operator/workbench", label: "总队列", description: "跨域待处理事项" },
  { to: "/operator/approvals", label: "审批中心", description: "建议与处方审批" },
  { to: "/operator/dispatch", label: "派发状态", description: "任务分派与回执" },
  { to: "/operator/acceptance", label: "验收中心", description: "执行结果复核" },
  { to: "/operator/evidence", label: "证据中心", description: "证据完整性检查" },
  { to: "/operator/devices-alerts", label: "设备与告警", description: "设备状态与告警事件" },
];

export default function OperatorLayout({ title, lead, children }: OperatorLayoutProps): React.ReactElement {
  return (
    <div className="operatorShell">
      <aside className="operatorSidebar" aria-label="运营导航">
        <div className="operatorBrand">
          <span>GEOX</span>
          <strong>运营工作台</strong>
        </div>
        <nav className="operatorNav">
          {OPERATOR_NAV.map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => `operatorNavItem ${isActive ? "isActive" : ""}`}>
              <span>{item.label}</span>
              <small>{item.description}</small>
            </NavLink>
          ))}
        </nav>
        <div className="operatorBoundaryNote">
          运营层用于处理审批、派发、验收、证据复核、设备与告警，不进入客户主界面。
        </div>
      </aside>

      <main className="operatorMain">
        <header className="operatorHeader">
          <div>
            <div className="operatorEyebrow">P1-C / Operator Diagnostic Enhancement</div>
            <h1>{title}</h1>
            <p>{lead}</p>
          </div>
          <div className="operatorHeaderBadge">只读增强</div>
        </header>
        <section className="operatorContent">{children}</section>
      </main>
    </div>
  );
}
