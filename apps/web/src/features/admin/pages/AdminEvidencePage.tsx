// apps/web/src/features/admin/pages/AdminEvidencePage.tsx
import AdminPanel from "../components/AdminPanel";

export default function AdminEvidencePage(): React.ReactElement {
  return (
    <main className="adminControlPlanePage">
      <header className="adminControlPlaneHero">
        <p className="adminPill">Readback / 回查</p>
        <h1>Admin Evidence / 后台证据</h1>
        <p>Evidence / 证据 readback keeps evidence_ref, fact_id, source_ref, raw_payload, hashes, and trace IDs unchanged.</p>
      </header>
      <AdminPanel title="Evidence readback labels / 证据回查标签">
        <ul className="adminEvidenceList"><li>evidence artifact refs / 证据产物引用</li><li>source summary / 来源摘要</li><li>data quality status / 数据质量状态</li><li>missing evidence reasons / 缺失证据原因</li></ul>
      </AdminPanel>
    </main>
  );
}
