import AdminControlPlaneShell from "../components/AdminControlPlaneShell";
import AdminPanel from "../components/AdminPanel";
import AdminTable from "../components/AdminTable";
import { boundaryRules, dashboardRows } from "./adminPageData";

export default function AdminDashboardPage(): React.ReactElement {
  return <AdminControlPlaneShell title="Admin Dashboard"><section className="adminPanelGrid"><AdminPanel title="Read-only summaries"><AdminTable headers={["Area", "Mode"]} rows={dashboardRows} /></AdminPanel><AdminPanel title="Boundary rules"><ul className="adminList">{boundaryRules.map((r) => <li key={r}>{r}</li>)}</ul></AdminPanel></section></AdminControlPlaneShell>;
}
