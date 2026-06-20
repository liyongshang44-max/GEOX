import AdminControlPlaneShell from "../components/AdminControlPlaneShell";
import AdminPanel from "../components/AdminPanel";
export default function AdminAlertsPage(): React.ReactElement { return <AdminControlPlaneShell title="Admin Alerts"><div className="adminQueuePanel">Alert queue and audit boundary status are visible here without action shortcuts.</div><AdminPanel title="Alert lanes"><ul className="adminList"><li>system health</li><li>device offline</li><li>evidence missing</li><li>worker failure</li></ul></AdminPanel></AdminControlPlaneShell>; }
