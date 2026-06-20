import AdminControlPlaneShell from "../components/AdminControlPlaneShell";
import AdminPanel from "../components/AdminPanel";
import AdminTable from "../components/AdminTable";
export default function AdminDevicesPage(): React.ReactElement { return <AdminControlPlaneShell title="Admin Devices"><AdminPanel title="Device state only"><AdminTable headers={["Allowed field", "Meaning"]} rows={[["device_id", "identity"], ["binding_status", "binding"], ["online_status", "connectivity"], ["last_seen", "telemetry recency"], ["capability", "declared capability"], ["source evidence refs", "traceability"]]} /></AdminPanel></AdminControlPlaneShell>; }
