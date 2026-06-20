import AdminControlPlaneShell from "../components/AdminControlPlaneShell";
import AdminPanel from "../components/AdminPanel";
export default function AdminEvidencePage(): React.ReactElement { return <AdminControlPlaneShell title="Admin Evidence"><AdminPanel title="Evidence pipeline"><ul className="adminEvidenceList"><li>evidence artifact refs</li><li>acceptance result refs</li><li>data quality status</li><li>missing evidence reasons</li></ul></AdminPanel></AdminControlPlaneShell>; }
