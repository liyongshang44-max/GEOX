import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import AdminBoundaryNotice from "./AdminBoundaryNotice";

const nav = ["Dashboard", "Fields", "Operations", "Devices", "Alerts", "Evidence", "Skills", "Acceptance", "Healthz"] as const;
const toPath = (label: string) => `/admin/${label.toLowerCase()}`;

export default function AdminControlPlaneShell({ title, children }: { title: string; children: ReactNode }): React.ReactElement {
  return (
    <main className="adminControlPlanePage">
      <header className="adminControlPlaneHero">
        <p className="adminPill">INTERNAL_ADMIN_CONTROL_PLANE</p>
        <h1>{title}</h1>
        <p>Governance background for device status, queues, execution-state chain, evidence, skills, acceptance, health, alerts, and audit boundaries.</p>
        <nav className="adminStatusRail" aria-label="Admin Control Plane navigation">
          {nav.map((label) => <Link key={label} className="adminPill" to={toPath(label)}>{label}</Link>)}
        </nav>
      </header>
      <AdminBoundaryNotice />
      {children}
    </main>
  );
}
