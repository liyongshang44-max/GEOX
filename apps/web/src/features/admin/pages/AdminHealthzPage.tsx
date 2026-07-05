// apps/web/src/features/admin/pages/AdminHealthzPage.tsx
import AdminPanel from "../components/AdminPanel";

export default function AdminHealthzPage(): React.ReactElement {
  return <main className="adminControlPlanePage"><header className="adminControlPlaneHero"><p className="adminPill">Readback / 回查</p><h1>Runtime Health / 运行健康</h1><p>Read-only status page / 只读状态页。</p></header><AdminPanel title="Runtime Health labels / 运行健康标签"><ul className="adminList"><li>system health / 系统健康</li><li>service status / 服务状态</li><li>Unavailable / 不可用</li></ul></AdminPanel></main>;
}
