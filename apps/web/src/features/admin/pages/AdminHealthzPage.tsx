import AdminControlPlaneShell from "../components/AdminControlPlaneShell";
import AdminPanel from "../components/AdminPanel";
export default function AdminHealthzPage(): React.ReactElement { return <AdminControlPlaneShell title="Admin Healthz"><AdminPanel title="System health"><div className="adminStatusRail"><span className="adminHealthBadge">system health</span><span className="adminHealthBadge">db health</span><span className="adminHealthBadge">worker heartbeat</span></div></AdminPanel></AdminControlPlaneShell>; }
