// apps/web/src/features/admin/pages/AdminSkillsPage.tsx
import React from "react";
import AdminPanel from "../components/AdminPanel";
import AdminStatusPill from "../components/AdminStatusPill";
import { localizedText, useLocale } from "../../../lib/locale";

const COPY = {
  config: { zh: "配置", en: "Config" },
  title: { zh: "技能 / 配置", en: "Skills / Config" },
  lead: { zh: "技能注册表回查。", en: "Skill registry readback." },
  panel: { zh: "技能注册表标签", en: "Skill registry labels" },
  registry: { zh: "技能注册表", en: "Registry" },
  workerState: { zh: "工作器状态", en: "Worker state" },
  lastRun: { zh: "最近运行", en: "Last run" },
  queueLag: { zh: "队列延迟", en: "Queue lag" },
};

export default function AdminSkillsPage(): React.ReactElement {
  const { locale } = useLocale();
  return (
    <main className="adminControlPlanePage">
      <header className="adminControlPlaneHero"><p className="adminPill">{localizedText(COPY.config, locale)}</p><h1>{localizedText(COPY.title, locale)}</h1><p>{localizedText(COPY.lead, locale)}</p></header>
      <AdminPanel title={localizedText(COPY.panel, locale)}>
        <div className="adminStatusRail"><AdminStatusPill label={localizedText(COPY.registry, locale)} /><AdminStatusPill label={localizedText(COPY.workerState, locale)} /><AdminStatusPill label={localizedText(COPY.lastRun, locale)} /><AdminStatusPill label={localizedText(COPY.queueLag, locale)} /></div>
      </AdminPanel>
    </main>
  );
}
