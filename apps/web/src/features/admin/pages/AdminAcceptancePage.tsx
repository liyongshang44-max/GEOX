import AdminControlPlaneShell from "../components/AdminControlPlaneShell";
import AdminPanel from "../components/AdminPanel";
export default function AdminAcceptancePage(): React.ReactElement { return <AdminControlPlaneShell title="Admin Acceptance"><AdminPanel title="Acceptance status"><span className="adminHealthBadge">read-only acceptance refs and gate status</span></AdminPanel></AdminControlPlaneShell>; }
