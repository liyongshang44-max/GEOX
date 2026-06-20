import AdminControlPlaneShell from "../components/AdminControlPlaneShell";
import AdminPanel from "../components/AdminPanel";
import AdminTable from "../components/AdminTable";
export default function AdminOperationsPage(): React.ReactElement { return <AdminControlPlaneShell title="Admin Operations"><AdminPanel title="Execution chain state"><AdminTable headers={["Allowed field", "Boundary"]} rows={[["operation_id", "read"], ["plan_status", "read"], ["approval_status", "read"], ["task_status", "read"], ["receipt_status", "read"], ["as_executed_status", "read"], ["acceptance_status", "read"], ["blocking_reason", "read"]]} /></AdminPanel></AdminControlPlaneShell>; }
