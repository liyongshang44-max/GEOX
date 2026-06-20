import AdminControlPlaneShell from "../components/AdminControlPlaneShell";
import AdminPanel from "../components/AdminPanel";
import AdminStatusPill from "../components/AdminStatusPill";
export default function AdminSkillsPage(): React.ReactElement { return <AdminControlPlaneShell title="Admin Skills"><AdminPanel title="Skill and worker state"><div className="adminStatusRail"><AdminStatusPill label="registry" /><AdminStatusPill label="worker state" /><AdminStatusPill label="last run" /><AdminStatusPill label="failure reason" /><AdminStatusPill label="queue lag" /></div></AdminPanel></AdminControlPlaneShell>; }
