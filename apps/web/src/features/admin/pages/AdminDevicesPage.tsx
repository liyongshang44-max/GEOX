// apps/web/src/features/admin/pages/AdminDevicesPage.tsx
import AdminPanel from "../components/AdminPanel";
import AdminTable from "../components/AdminTable";

export default function AdminDevicesPage(): React.ReactElement {
  return (
    <main className="adminControlPlanePage">
      <header className="adminControlPlaneHero">
        <p className="adminPill">Readback / 回查</p>
        <h1>Admin Devices / 后台设备</h1>
        <p>Devices / 设备 readback. This page is not proof of live device connection or production gateway online.</p>
      </header>
      <AdminPanel title="Device state labels / 设备状态标签">
        <AdminTable headers={["Allowed field / 允许字段", "Meaning / 含义"]} rows={[["device_id", "identity"], ["binding_status", "binding"], ["online_status", "connectivity"], ["last_seen", "telemetry recency"], ["capability", "declared capability"], ["source evidence refs", "traceability"]]} />
      </AdminPanel>
    </main>
  );
}
