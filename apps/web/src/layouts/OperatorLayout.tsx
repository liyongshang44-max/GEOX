import React from "react";
import { NavLink } from "react-router-dom";
import "../styles/operatorShell.css";
import "../styles/operatorUsability.css";
import { fetchSessionMe, type SessionMe } from "../api/session";
import { hasOperatorPermission, permissionReason, type OperatorPermissionKey } from "../lib/permissions";

type OperatorLayoutProps = {
  title: string;
  lead: string;
  children: React.ReactNode;
};

const OPERATOR_NAV: Array<{ to: string; label: string; description: string; perm?: OperatorPermissionKey }> = [
  { to: "/operator/workbench", label: "总队列", description: "跨域待处理事项" },
  { to: "/operator/approvals", label: "审批中心", description: "建议与处方审批", perm: "approve" },
  { to: "/operator/dispatch", label: "派发状态", description: "任务分派与回执", perm: "dispatch" },
  { to: "/operator/acceptance", label: "验收中心", description: "执行结果复核", perm: "acceptance" },
  { to: "/operator/evidence", label: "证据中心", description: "证据完整性检查", perm: "export_evidence" },
  { to: "/operator/devices-alerts", label: "设备与告警", description: "设备状态与告警事件" },
  { to: "/operator/roi-ledger", label: "ROI 明细账", description: "价值记录追溯" },
  { to: "/operator/field-memory", label: "田块记忆", description: "田块学习明细" },
];

export default function OperatorLayout({ title, lead, children }: OperatorLayoutProps): React.ReactElement {
  const [session, setSession] = React.useState<SessionMe | null>(null);
  React.useEffect(() => {
    let alive = true;
    fetchSessionMe().then((x) => { if (alive) setSession(x); }).catch(() => { if (alive) setSession(null); });
    return () => { alive = false; };
  }, []);
  return (
    <div className="operatorShell">
      <aside className="operatorSidebar" aria-label="运营导航">
        <div className="operatorBrand">
          <span>GEOX</span>
          <strong>运营工作台</strong>
        </div>
        <nav className="operatorNav">
          {OPERATOR_NAV.map((item) => {
            const allowed = !item.perm || hasOperatorPermission(session, item.perm);
            const reason = item.perm ? permissionReason(session, item.perm) : "";
            return (
              <div key={item.to}>
                <NavLink to={item.to} className={({ isActive }) => `operatorNavItem ${isActive ? "isActive" : ""}`}>
                  <span>{item.label}{allowed ? "" : "（无权限）"}</span>
                  <small>{allowed ? item.description : reason}</small>
                </NavLink>
              </div>
            );
          })}
        </nav>
        <div className="operatorBoundaryNote">
          运营层用于处理审批、派发、验收、证据复核、设备告警、价值记录与田块记忆追溯，不进入客户主界面。
        </div>
      </aside>

      <main className="operatorMain">
        <header className="operatorHeader">
          <div>
            <div className="operatorEyebrow">运营工作台</div>
            <h1>{title}</h1>
            <p>{lead}</p>
          </div>
          <span className="operatorHeaderBadge">运营专用</span>
        </header>
        <section className="operatorContent">{children}</section>
      </main>
    </div>
  );
}
