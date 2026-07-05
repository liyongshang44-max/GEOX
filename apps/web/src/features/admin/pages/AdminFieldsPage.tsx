// apps/web/src/features/admin/pages/AdminFieldsPage.tsx
import React from "react";
import AdminPanel from "../components/AdminPanel";

export default function AdminFieldsPage(): React.ReactElement {
  return (
    <main className="adminControlPlanePage">
      <header className="adminControlPlaneHero">
        <p className="adminPill">Readback</p>
        <h1>Admin Fields</h1>
        <p>Fields / 地块 readback.</p>
      </header>
      <div className="adminPanelGrid">
        <AdminPanel title="Field management labels / 地块管理标签">
          <ul className="adminList"><li>Field binding state / 地块绑定状态</li><li>Readback / 回查</li></ul>
        </AdminPanel>
      </div>
    </main>
  );
}
