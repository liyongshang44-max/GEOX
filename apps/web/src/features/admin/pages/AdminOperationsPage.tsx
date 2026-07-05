// apps/web/src/features/admin/pages/AdminOperationsPage.tsx
import AdminPanel from "../components/AdminPanel";
import AdminTable from "../components/AdminTable";

export default function AdminOperationsPage(): React.ReactElement {
  return (
    <main className="adminControlPlanePage">
      <header className="adminControlPlaneHero">
        <p className="adminPill">Readback / 回查</p>
        <h1>Admin Operations / 后台作业</h1>
        <p>Operations / 作业 readback. This page does not enable dispatch or controlled execution.</p>
      </header>
      <AdminPanel title="Operation management labels / 作业管理标签">
        <AdminTable headers={["Allowed field / 允许字段", "Boundary / 边界"]} rows={[["operation_id", "read"], ["plan_status", "read"], ["approval_status", "read"], ["task_status", "read"], ["receipt_status", "read"], ["as_executed_status", "read"], ["acceptance_status", "read"], ["blocking_reason", "read"]]} />
      </AdminPanel>
    </main>
  );
}
