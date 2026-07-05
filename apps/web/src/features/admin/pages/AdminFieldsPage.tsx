// apps/web/src/features/admin/pages/AdminFieldsPage.tsx
import React from "react";
import AdminPanel from "../components/AdminPanel";
import { localizedText, useLocale } from "../../../lib/locale";

const COPY = {
  readback: { zh: "回查", en: "Readback" },
  title: { zh: "后台地块", en: "Admin Fields" },
  lead: { zh: "地块回查页面。", en: "Field readback page." },
  panel: { zh: "地块标签", en: "Field labels" },
  state: { zh: "地块状态", en: "Field state" },
};

export default function AdminFieldsPage(): React.ReactElement {
  const { locale } = useLocale();
  return (
    <main className="adminControlPlanePage">
      <header className="adminControlPlaneHero">
        <p className="adminPill">{localizedText(COPY.readback, locale)}</p>
        <h1>{localizedText(COPY.title, locale)}</h1>
        <p>{localizedText(COPY.lead, locale)}</p>
      </header>
      <div className="adminPanelGrid">
        <AdminPanel title={localizedText(COPY.panel, locale)}>
          <ul className="adminList">
            <li>{localizedText(COPY.state, locale)}</li>
            <li>{localizedText(COPY.readback, locale)}</li>
          </ul>
        </AdminPanel>
      </div>
    </main>
  );
}
