// apps/web/src/features/admin/pages/AdminHealthzPage.tsx
import React from "react";
import AdminPanel from "../components/AdminPanel";
import { localizedText, useLocale } from "../../../lib/locale";

const COPY = {
  readback: { zh: "回查", en: "Readback" },
  title: { zh: "运行健康", en: "Runtime Health" },
  lead: { zh: "只读状态页。", en: "Read-only status page." },
  panel: { zh: "运行健康标签", en: "Runtime Health labels" },
  system: { zh: "系统健康", en: "System health" },
  service: { zh: "服务状态", en: "Service status" },
  unavailable: { zh: "不可用", en: "Unavailable" },
};

export default function AdminHealthzPage(): React.ReactElement {
  const { locale } = useLocale();
  return <main className="adminControlPlanePage"><header className="adminControlPlaneHero"><p className="adminPill">{localizedText(COPY.readback, locale)}</p><h1>{localizedText(COPY.title, locale)}</h1><p>{localizedText(COPY.lead, locale)}</p></header><AdminPanel title={localizedText(COPY.panel, locale)}><ul className="adminList"><li>{localizedText(COPY.system, locale)}</li><li>{localizedText(COPY.service, locale)}</li><li>{localizedText(COPY.unavailable, locale)}</li></ul></AdminPanel></main>;
}
