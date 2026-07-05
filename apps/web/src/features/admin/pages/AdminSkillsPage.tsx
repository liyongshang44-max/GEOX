// apps/web/src/features/admin/pages/AdminSkillsPage.tsx
import AdminPanel from "../components/AdminPanel";
import AdminStatusPill from "../components/AdminStatusPill";

export default function AdminSkillsPage(): React.ReactElement {
  return (
    <main className="adminControlPlanePage">
      <header className="adminControlPlaneHero"><p className="adminPill">Config / 配置</p><h1>Skills / Config · 技能 / 配置</h1><p>Skill registry readback / 技能注册表回查。</p></header>
      <AdminPanel title="Skill registry labels / 技能注册表标签">
        <div className="adminStatusRail"><AdminStatusPill label="registry / 技能注册表" /><AdminStatusPill label="worker state / 工作器状态" /><AdminStatusPill label="last run / 最近运行" /><AdminStatusPill label="failure reason / 失败原因" /><AdminStatusPill label="queue lag / 队列延迟" /></div>
      </AdminPanel>
    </main>
  );
}
